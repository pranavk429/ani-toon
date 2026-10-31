/**
 * AI Director orchestration.
 *
 * Pipeline: validate request -> build prompts -> call one hosted provider ->
 * parse/validate -> at most one repair -> preserve unrelated revision tracks ->
 * deterministic local fallback with an explicit label.
 *
 * No provider credential is ever returned, logged or sent to the browser.
 */

import {
  validateMotionDocument,
  type MotionDocument,
  type MotionTrack,
  type ValidationContext,
  type ValidationIssue,
} from "@/lib/animation";
import type {
  AnimationDirectorProvider,
  AnimationDirectionRequest,
  AnimationDirectionResponse,
  AnimationDirectionSuccess,
  DirectorProviderInfo,
  ProviderGenerateInput,
  ProviderGenerateOutput,
  TrackChangeSet,
} from "./contracts";
import { composeFallback } from "./fallback";
import { buildPrompts } from "./prompt";
import {
  DIRECTOR_DEFAULT_MAX_TOKENS,
  AnimationProviderError,
  getConfiguredProvider,
} from "./provider";
import { mergeRevision, diffTracks } from "./revision";
import {
  buildValidationContext,
  collectTargetIds,
  validateDirectionRequest,
} from "./request";

const MAX_PROVIDER_ATTEMPTS = 2;

type ParsedCandidate = {
  document: Record<string, unknown>;
  explanation?: string;
  summary?: string;
};

type ParseCandidateResult =
  | { ok: true; candidate: ParsedCandidate }
  | { ok: false; error: string };

type CandidateValidation =
  | { ok: true; document: MotionDocument; warnings: string[] }
  | { ok: false; errors: string[] };

type BaselineResult = {
  document?: MotionDocument;
  warning?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  const attempts = [trimmed];
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const sliced = trimmed.slice(firstBrace, lastBrace + 1);
    if (sliced !== trimmed) attempts.push(sliced);
  }
  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      // Try next attempt.
    }
  }
  return undefined;
}

function readSummary(document: Record<string, unknown>): string | undefined {
  const meta = document.meta;
  if (!isRecord(meta) || typeof meta.summary !== "string") return undefined;
  const summary = meta.summary.replace(/\s+/g, " ").trim();
  return summary.length > 0 ? summary.slice(0, 240) : undefined;
}

function parseModelResponse(text: string): ParseCandidateResult {
  const parsed = parseJsonLoose(text);
  if (!isRecord(parsed)) {
    return {
      ok: false,
      error: "Response was not a JSON object. Return the JSON envelope only.",
    };
  }

  if ("document" in parsed) {
    if (!isRecord(parsed.document)) {
      return { ok: false, error: '"document" must be a JSON object.' };
    }
    return {
      ok: true,
      candidate: {
        document: parsed.document,
        explanation:
          typeof parsed.explanation === "string" ? parsed.explanation : undefined,
        summary: readSummary(parsed.document),
      },
    };
  }

  if ("tracks" in parsed || "version" in parsed) {
    return {
      ok: true,
      candidate: {
        document: parsed,
        explanation:
          typeof parsed.explanation === "string" ? parsed.explanation : undefined,
        summary: readSummary(parsed),
      },
    };
  }

  return {
    ok: false,
    error: "Response did not contain a Motion DSL document.",
  };
}

/**
 * The model's meta/source/provider fields are never trusted. Strip them and
 * attach only a server-controlled source + summary so the validator and the
 * revision guard can see the requested summary.
 */
function prepareDocumentForValidation(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const clone: Record<string, unknown> = { ...raw };
  const summary = readSummary(raw);
  delete clone.meta;
  if (summary) clone.meta = { source: "ai", summary };
  delete clone.explanation;
  for (const key of [
    "source",
    "provider",
    "model",
    "createdAt",
    "latencyMs",
    "revisionOf",
  ]) {
    delete clone[key];
  }
  return clone;
}

function formatErrorIssues(issues: readonly ValidationIssue[], limit = 24): string[] {
  return issues
    .filter((issue) => issue.severity === "error")
    .slice(0, limit)
    .map((issue) => `${issue.path || "document"}: ${issue.message}`);
}

function formatWarningIssues(issues: readonly ValidationIssue[]): string[] {
  return issues.map((issue) => `${issue.path || "document"}: ${issue.message}`);
}

function validateCandidate(
  document: Record<string, unknown>,
  context: ValidationContext,
): CandidateValidation {
  const result = validateMotionDocument(prepareDocumentForValidation(document), context);
  if (result.ok && result.document) {
    return {
      ok: true,
      document: result.document,
      warnings: formatWarningIssues(result.warnings),
    };
  }
  const errors = formatErrorIssues(result.errors);
  return {
    ok: false,
    errors:
      errors.length > 0
        ? errors
        : ["Document failed Motion DSL validation without a reported error."],
  };
}

function normalizeBaseline(
  request: AnimationDirectionRequest,
  context: ValidationContext,
): BaselineResult {
  if (!request.currentDocument) return {};
  const result = validateMotionDocument(request.currentDocument, context);
  if (result.ok && result.document) return { document: result.document };
  const first = result.errors[0];
  return {
    warning: `Current document could not be normalized for revision preservation${
      first ? ` (${first.path || "document"}: ${first.message})` : ""
    }.`,
  };
}

function cleanText(value: unknown, maxLength = 300): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length === 0) return undefined;
  return cleaned.slice(0, maxLength);
}

function instructionRequestsLoop(instruction: string): boolean {
  return /\b(loop|looping|repeat|repeats|repeating|forever|continuous|continuously|cycle|cycles|cycling|ping[- ]?pong|alternate|back and forth)\b/i.test(
    instruction,
  );
}

function generatedExplanation(document: MotionDocument): string {
  const targets = new Set(
    document.tracks.map((track) => {
      switch (track.target.kind) {
        case "svg":
          return track.target.elementId;
        case "character":
          return `${track.target.actorId}:${track.target.boneId}`;
        case "object":
          return track.target.objectId;
      }
    }),
  );
  return `Composed ${document.tracks.length} track(s) across ${targets.size} target(s) over ${document.duration}s.`;
}

function randomSuffix(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID().replace(/-/g, "").slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

function idFragment(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug.length > 0 ? slug : "motion";
}

function ensureDocumentId(
  document: MotionDocument,
  currentId: string | undefined,
  createdAt: string,
): string {
  if (
    /^anim_[A-Za-z0-9_-]+$/.test(document.id) &&
    document.id !== currentId &&
    document.id.length <= 200
  ) {
    return document.id;
  }
  const suffix = randomSuffix();
  const stamp = Date.parse(createdAt);
  return `anim_${idFragment(document.name)}_${Number.isFinite(stamp) ? stamp.toString(36) : Date.now().toString(36)}_${suffix}`;
}

function dedupeWarnings(warnings: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const warning of warnings) {
    const trimmed = warning.trim();
    if (trimmed.length === 0 || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function fallbackReason(error: unknown): string {
  if (error instanceof AnimationProviderError) {
    switch (error.code) {
      case "missing_credentials":
        return "Hosted provider is not configured; local fallback used.";
      case "timeout":
        return "Hosted provider timed out; local fallback used.";
      case "rate_limited":
        return "Hosted provider rate limit reached; local fallback used.";
      case "http":
        return `Hosted provider returned HTTP ${error.status ?? "error"}; local fallback used.`;
      case "network":
        return "Hosted provider network request failed; local fallback used.";
      case "invalid_response":
        return "Hosted provider returned an invalid response envelope; local fallback used.";
      default:
        return "Hosted provider failed; local fallback used.";
    }
  }
  return "Hosted provider failed; local fallback used.";
}

type FinalizeOptions = {
  request: AnimationDirectionRequest;
  source: "ai" | "fallback";
  explanation: string;
  summary?: string;
  provider?: DirectorProviderInfo;
  providerLatencyMs?: number;
  totalLatencyMs: number;
};

function finalizeDocument(
  document: MotionDocument,
  options: FinalizeOptions,
): MotionDocument {
  const createdAt = new Date().toISOString();
  const summary =
    cleanText(options.summary, 240) ??
    cleanText(options.explanation, 240) ??
    `Composed ${document.tracks.length} track(s).`;
  const id = ensureDocumentId(document, options.request.currentDocument?.id, createdAt);

  return {
    ...document,
    id,
    meta: {
      prompt: options.request.instruction,
      source: options.source,
      ...(options.source === "ai" && options.provider
        ? { provider: options.provider.id, model: options.provider.model }
        : {}),
      createdAt,
      ...(options.request.action === "revise" && options.request.currentDocument
        ? { revisionOf: options.request.currentDocument.id }
        : {}),
      summary,
      latencyMs:
        options.source === "ai"
          ? options.providerLatencyMs ?? options.totalLatencyMs
          : options.totalLatencyMs,
    },
  };
}

function oldTracksForDiff(
  request: AnimationDirectionRequest,
  baseline: BaselineResult,
): readonly MotionTrack[] {
  if (baseline.document) return baseline.document.tracks;
  return request.currentDocument?.tracks ?? [];
}

type FallbackArgs = {
  request: AnimationDirectionRequest;
  context: ValidationContext;
  baseWarnings: readonly string[];
  reason: string;
  startedAt: number;
  repairs: number;
  baseline: BaselineResult;
};

function buildFallbackResponse(args: FallbackArgs): AnimationDirectionSuccess {
  const { request, context, baseWarnings, reason, startedAt, repairs, baseline } = args;
  const composed = composeFallback(request);
  const initial = validateMotionDocument(composed.document, context);
  if (!initial.ok || !initial.document) {
    throw new Error(
      `Local fallback produced an invalid document: ${formatErrorIssues(initial.errors).join("; ")}`,
    );
  }

  let document = initial.document;
  const warnings: string[] = [...baseWarnings];
  warnings.push("Local fallback — no hosted model used");
  warnings.push(reason);
  if (baseline.warning) warnings.push(baseline.warning);
  warnings.push(...formatWarningIssues(initial.warnings));

  if (request.action === "revise" && baseline.document) {
    const merged = mergeRevision(baseline.document, document, {
      allowedTargetIds: new Set(collectTargetIds(request)),
    });
    if (merged.restoredTrackIds.length > 0) {
      const revalidated = validateMotionDocument(merged.document, context);
      if (revalidated.ok && revalidated.document) {
        document = revalidated.document;
        warnings.push(...merged.notes);
        warnings.push(...formatWarningIssues(revalidated.warnings));
      } else {
        warnings.push(
          "Local revision merge did not validate; unrelated track preservation was skipped.",
        );
      }
    } else {
      document = merged.document;
      warnings.push(...merged.notes);
    }
  }

  const totalLatencyMs = Math.max(0, Date.now() - startedAt);
  const explanation = cleanText(composed.explanation) ?? generatedExplanation(document);
  const finalDocument = finalizeDocument(document, {
    request,
    source: "fallback",
    explanation,
    providerLatencyMs: undefined,
    totalLatencyMs,
  });
  const changes: TrackChangeSet = diffTracks(
    oldTracksForDiff(request, baseline),
    finalDocument.tracks,
  );

  return {
    ok: true,
    document: finalDocument,
    explanation,
    source: "fallback",
    warnings: dedupeWarnings(warnings),
    changes,
    revisionId: finalDocument.id,
    ...(request.action === "revise" && request.currentDocument
      ? { parentRevisionId: request.currentDocument.id }
      : {}),
    latencyMs: totalLatencyMs,
    repairs,
  };
}

async function runDirector(
  req: AnimationDirectionRequest,
  overrides?: { provider?: AnimationDirectorProvider },
): Promise<AnimationDirectionResponse> {
  const startedAt = Date.now();
  const validation = validateDirectionRequest(req);
  if (!validation.ok) {
    return {
      ok: false,
      error: {
        code: validation.code,
        message: validation.message,
        retryable: validation.retryable,
      },
      latencyMs: Math.max(0, Date.now() - startedAt),
    };
  }

  const request = validation.request;
  const context = buildValidationContext(request);
  const baseline = normalizeBaseline(request, context);
  const provider = overrides?.provider ?? getConfiguredProvider();

  if (!provider) {
    return buildFallbackResponse({
      request,
      context,
      baseWarnings: [],
      reason: "No hosted Director credentials are configured; local fallback used.",
      startedAt,
      repairs: 0,
      baseline,
    });
  }

  const prompts = buildPrompts(request, { compact: provider.id === "agy" });
  const baseWarnings: string[] = [...prompts.warnings];
  if (baseline.warning) baseWarnings.push(baseline.warning);

  const temperature = request.action === "revise" ? 0.25 : 0.4;
  const baseInput: ProviderGenerateInput = {
    systemPrompt: prompts.systemPrompt,
    userPrompt: prompts.userPrompt,
    temperature,
    maxOutputTokens: DIRECTOR_DEFAULT_MAX_TOKENS,
  };

  let repairs = 0;
  let providerLatencyMs = 0;
  let providerInfo: DirectorProviderInfo | undefined;
  let latestOutput: ProviderGenerateOutput;

  try {
    latestOutput = await provider.generate(baseInput);
  } catch (error) {
    return buildFallbackResponse({
      request,
      context,
      baseWarnings,
      reason: fallbackReason(error),
      startedAt,
      repairs,
      baseline,
    });
  }

  providerLatencyMs = latestOutput.latencyMs;
  providerInfo = latestOutput.provider;

  let parsed = parseModelResponse(latestOutput.text);
  let validated: CandidateValidation | undefined = parsed.ok
    ? validateCandidate(parsed.candidate.document, context)
    : undefined;
  let explanationSource = parsed.ok ? parsed.candidate.explanation : undefined;
  let summarySource = parsed.ok ? parsed.candidate.summary : undefined;

  if (!parsed.ok || !validated?.ok) {
    repairs = 1;
    const errors = parsed.ok
      ? validated && !validated.ok
        ? validated.errors
        : ["Document failed validation."]
      : [parsed.error];

    let repairOutput: ProviderGenerateOutput;
    try {
      repairOutput = await provider.generate({
        ...baseInput,
        repair: {
          previousText: latestOutput.text,
          errors: errors.slice(0, 24),
        },
      });
    } catch (error) {
      return buildFallbackResponse({
        request,
        context,
        baseWarnings,
        reason: fallbackReason(error),
        startedAt,
        repairs,
        baseline,
      });
    }

    providerLatencyMs += repairOutput.latencyMs;
    providerInfo = repairOutput.provider;
    parsed = parseModelResponse(repairOutput.text);
    if (!parsed.ok) {
      return buildFallbackResponse({
        request,
        context,
        baseWarnings: [
          ...baseWarnings,
          "Model output was not valid JSON after one repair.",
        ],
        reason: "Model output did not validate after one repair; local fallback used.",
        startedAt,
        repairs,
        baseline,
      });
    }

    const repairValidation = validateCandidate(parsed.candidate.document, context);
    if (!repairValidation.ok) {
      return buildFallbackResponse({
        request,
        context,
        baseWarnings: [
          ...baseWarnings,
          `Model output still failed Motion DSL validation after one repair: ${repairValidation.errors
            .slice(0, 4)
            .join("; ")}`,
        ],
        reason: "Model output did not validate after one repair; local fallback used.",
        startedAt,
        repairs,
        baseline,
      });
    }

    explanationSource = parsed.candidate.explanation;
    summarySource = parsed.candidate.summary;
    validated = repairValidation;
    baseWarnings.push("Model output required one validation repair.");
  }

  if (!validated || !validated.ok) {
    return buildFallbackResponse({
      request,
      context,
      baseWarnings,
      reason: "Model output did not validate; local fallback used.",
      startedAt,
      repairs,
      baseline,
    });
  }

  let document = validated.document;
  const warnings: string[] = [...baseWarnings, ...validated.warnings];
  if (document.tracks.length > 40) {
    warnings.push(
      `Model returned ${document.tracks.length} tracks; the preferred maximum is 40.`,
    );
  }

  if (request.action === "revise" && baseline.document) {
    const merged = mergeRevision(baseline.document, document, {
      allowedTargetIds: new Set(collectTargetIds(request)),
    });
    if (merged.restoredTrackIds.length > 0) {
      const revalidated = validateMotionDocument(merged.document, context);
      if (revalidated.ok && revalidated.document) {
        document = revalidated.document;
        warnings.push(...merged.notes);
        warnings.push(...formatWarningIssues(revalidated.warnings));
      } else {
        warnings.push(
          "Revision merge did not validate; unrelated track preservation was skipped.",
        );
      }
    } else {
      document = merged.document;
      warnings.push(...merged.notes);
    }
  }

  if (document.loop.enabled && !instructionRequestsLoop(request.instruction)) {
    document = {
      ...document,
      loop: { ...document.loop, enabled: false, mode: "restart" },
    };
    warnings.push(
      "Loop disabled because the instruction did not explicitly request looping.",
    );
  }

  const totalLatencyMs = Math.max(0, Date.now() - startedAt);
  const explanation =
    cleanText(explanationSource) ??
    cleanText(summarySource) ??
    generatedExplanation(document);
  const finalDocument = finalizeDocument(document, {
    request,
    source: "ai",
    explanation,
    summary: summarySource,
    provider: providerInfo,
    providerLatencyMs,
    totalLatencyMs,
  });
  const changes = diffTracks(oldTracksForDiff(request, baseline), finalDocument.tracks);

  return {
    ok: true,
    document: finalDocument,
    explanation,
    source: "ai",
    ...(providerInfo ? { provider: providerInfo } : {}),
    warnings: dedupeWarnings(warnings),
    changes,
    revisionId: finalDocument.id,
    ...(request.action === "revise" && request.currentDocument
      ? { parentRevisionId: request.currentDocument.id }
      : {}),
    latencyMs: totalLatencyMs,
    repairs,
  };
}

/**
 * Public Director entry point.
 *
 * Provider failures and invalid model output return a successful local
 * fallback. Only malformed client requests return `ok: false` from the normal
 * path; this wrapper converts an unexpected internal/fallback failure into a
 * typed failure instead of rejecting the promise.
 */
export async function directAnimation(
  req: AnimationDirectionRequest,
  overrides?: { provider?: AnimationDirectorProvider },
): Promise<AnimationDirectionResponse> {
  const startedAt = Date.now();
  try {
    return await runDirector(req, overrides);
  } catch {
    return {
      ok: false,
      error: {
        code: "invalid_output",
        message:
          "The Director could not compose a valid animation from this request.",
        retryable: true,
      },
      latencyMs: Math.max(0, Date.now() - startedAt),
    };
  }
}

export const DIRECTOR_MAX_PROVIDER_ATTEMPTS = MAX_PROVIDER_ATTEMPTS;
