/**
 * Hosted provider abstraction for the AI Director.
 *
 * Server-only: credentials are read from `process.env` here and never sent to
 * the browser. Both providers return raw model text; the Director owns JSON
 * parsing and Motion DSL validation.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

import type {
  AnimationDirectorProvider,
  DirectorProviderInfo,
  ProviderGenerateInput,
  ProviderGenerateOutput,
} from "./contracts";

export const EXPERIENTIAL_ENDPOINT =
  "https://api.experientiallabs.ai/v1/chat/completions";
export const GEMINI_ENDPOINT_ROOT =
  "https://generativelanguage.googleapis.com/v1beta/models";

export const PROVIDER_TIMEOUT_MS = 45_000;
export const AGY_TIMEOUT_MS = 360_000;
export const DIRECTOR_DEFAULT_MAX_TOKENS = 5_000;
export const DEFAULT_AGY_BIN =
  "/Applications/cmux.app/Contents/Resources/bin/agy";

export type AnimationDirectorProviderId =
  | "gateway"
  | "experiential"
  | "gemini"
  | "agy";

export type AnimationProviderErrorCode =
  | "missing_credentials"
  | "timeout"
  | "rate_limited"
  | "http"
  | "network"
  | "invalid_response";

export class AnimationProviderError extends Error {
  readonly code: AnimationProviderErrorCode;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(
    code: AnimationProviderErrorCode,
    message: string,
    options: { status?: number; retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "AnimationProviderError";
    this.code = code;
    this.status = options.status;
    this.retryable = options.retryable ?? (code === "timeout" || code === "rate_limited");
  }
}

export type ProviderOptions = {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  bin?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeProviderId(value: string | undefined): AnimationDirectorProviderId | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "gemini" || normalized === "google") return "gemini";
  if (normalized === "agy" || normalized === "cli" || normalized === "gemini-cli") {
    return "agy";
  }
  if (
    normalized === "gateway" ||
    normalized === "api-gateway" ||
    normalized === "openai" ||
    normalized === "openai-compatible"
  ) {
    return "gateway";
  }
  if (
    normalized === "experiential" ||
    normalized === "experiental" ||
    normalized === "explabs" ||
    normalized === "experientiallabs" ||
    normalized === "experiential-labs"
  ) {
    return "experiential";
  }
  return undefined;
}

function agyBinary(): string | undefined {
  if (process.env.VERCEL) return undefined;
  const bin = readEnv("AGY_BIN") ?? DEFAULT_AGY_BIN;
  return existsSync(/* turbopackIgnore: true */ bin) ? bin : undefined;
}

/** Preference order for providers. Local fallback is the caller's job. */
export function getConfiguredProvider(
  preferred?: AnimationDirectorProviderId,
): AnimationDirectorProvider | null {
  const requested = preferred ?? normalizeProviderId(readEnv("ANIMATION_DIRECTOR_PROVIDER"));
  if (requested) {
    if (requested === "gateway" && readEnv("AI_BASE_URL")) return new GatewayProvider();
    if (requested === "experiential" && readEnv("EXPLABS_API_KEY")) {
      return new ExperientialProvider();
    }
    if (requested === "gemini" && readEnv("GEMINI_API_KEY")) {
      return new GeminiProvider();
    }
    if (requested === "agy" && agyBinary()) return new AgyProvider();
    return null;
  }

  // No explicit preference: deployed gateway first, then the local Gemini CLI
  // for verification, then the direct API providers.
  if (readEnv("AI_BASE_URL")) return new GatewayProvider();
  if (agyBinary()) return new AgyProvider();
  if (readEnv("EXPLABS_API_KEY")) return new ExperientialProvider();
  if (readEnv("GEMINI_API_KEY")) return new GeminiProvider();
  return null;
}

/** Safe health information. Never includes credentials. */
export function getProviderStatus(): {
  configured: boolean;
  provider: string | null;
  model: string | null;
} {
  const provider = getConfiguredProvider();
  if (!provider) {
    return { configured: false, provider: null, model: null };
  }
  return { configured: true, provider: provider.id, model: provider.model };
}

export function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json|JSON)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1].trim() : trimmed;
}

function combineSignals(
  timeoutMs: number,
  external: AbortSignal | undefined,
): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!external) return timeout;
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([external, timeout]);
  }
  return external;
}

function mapFetchError(error: unknown): AnimationProviderError {
  if (error instanceof AnimationProviderError) return error;
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name?: unknown }).name)
      : "";
  if (name === "TimeoutError") {
    return new AnimationProviderError("timeout", "Provider request timed out.", {
      retryable: true,
      cause: error,
    });
  }
  if (name === "AbortError") {
    return new AnimationProviderError("timeout", "Provider request was aborted.", {
      retryable: false,
      cause: error,
    });
  }
  const message = error instanceof Error ? error.message : "Network request failed";
  return new AnimationProviderError("network", message, {
    retryable: true,
    cause: error,
  });
}

function httpError(providerLabel: string, status: number): AnimationProviderError {
  if (status === 429) {
    return new AnimationProviderError("rate_limited", `${providerLabel} rate limit reached.`, {
      status,
      retryable: true,
    });
  }
  return new AnimationProviderError(
    "http",
    `${providerLabel} request failed with HTTP ${status}.`,
    {
      status,
      retryable: status >= 500,
    },
  );
}

function repairSuffix(input: ProviderGenerateInput): string {
  if (!input.repair) return "";
  const errors = input.repair.errors
    .slice(0, 20)
    .map((error) => `- ${error}`)
    .join("\n");
  const previous = input.repair.previousText.slice(0, 16_000);
  return [
    "",
    "",
    "REPAIR REQUIRED. Your previous response failed validation.",
    "Concrete errors:",
    errors || "- The response was not a valid Motion DSL document.",
    "",
    "Previous response:",
    previous,
    "",
    "Return the full corrected response as JSON only. Fix every listed error. Do not add commentary or code fences.",
  ].join("\n");
}

async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    const name =
      typeof error === "object" && error !== null && "name" in error
        ? String((error as { name?: unknown }).name)
        : "";
    if (name === "TimeoutError" || name === "AbortError") {
      throw new AnimationProviderError("timeout", "Provider response timed out.", {
        retryable: true,
        cause: error,
      });
    }
    throw new AnimationProviderError(
      "invalid_response",
      "Provider returned a non-JSON response envelope.",
      { retryable: false, cause: error },
    );
  }
}

type OpenAiChatPayload = {
  choices?: Array<{
    message?: { content?: unknown };
    finish_reason?: unknown;
  }>;
};

type GeminiPayload = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: unknown }> };
    finishReason?: unknown;
  }>;
  promptFeedback?: { blockReason?: unknown };
};

/**
 * Generic OpenAI-compatible gateway. This is the deployment path: point
 * AI_BASE_URL at the gateway's /v1 root and set AI_API_KEY/AI_MODEL.
 */
export class GatewayProvider implements AnimationDirectorProvider {
  readonly id = "gateway";
  readonly model: string;
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: ProviderOptions = {}) {
    this.apiKey = options.apiKey ?? readEnv("AI_API_KEY");
    this.baseUrl = options.baseUrl ?? readEnv("AI_BASE_URL");
    this.model = options.model ?? readEnv("AI_MODEL") ?? "gemini-3.8-flash";
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? PROVIDER_TIMEOUT_MS;
  }

  async generate(input: ProviderGenerateInput): Promise<ProviderGenerateOutput> {
    if (!this.apiKey || !this.baseUrl) {
      throw new AnimationProviderError(
        "missing_credentials",
        "AI_BASE_URL and AI_API_KEY are required for the gateway provider.",
        { retryable: false },
      );
    }
    const startedAt = Date.now();
    const root = this.baseUrl.replace(/\/+$/, "");
    const url = root.endsWith("/chat/completions")
      ? root
      : `${root}/chat/completions`;

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: input.systemPrompt },
            { role: "user", content: `${input.userPrompt}${repairSuffix(input)}` },
          ],
          temperature: input.temperature ?? 0.4,
          max_tokens: input.maxOutputTokens ?? DIRECTOR_DEFAULT_MAX_TOKENS,
        }),
        signal: combineSignals(this.timeoutMs, input.signal),
      });
    } catch (error) {
      throw mapFetchError(error);
    }
    if (!response.ok) throw httpError("AI gateway", response.status);

    const payload = (await readJsonBody(response)) as OpenAiChatPayload;
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      throw new AnimationProviderError(
        "invalid_response",
        "The AI gateway returned no message content.",
        { retryable: false },
      );
    }
    return {
      text: stripCodeFences(content),
      provider: { id: this.id, model: this.model },
      latencyMs: Math.max(0, Date.now() - startedAt),
    };
  }
}

/**
 * Local verification provider: runs the installed Gemini subagent CLI.
 *
 * This exists so the full studio can be exercised with real Gemini output on a
 * developer machine without embedding an API key. It is deliberately disabled
 * on Vercel. Production must use GatewayProvider.
 */
export class AgyProvider implements AnimationDirectorProvider {
  readonly id = "agy";
  readonly model: string;
  private readonly bin: string;
  private readonly timeoutMs: number;

  constructor(options: ProviderOptions = {}) {
    this.bin = options.bin ?? readEnv("AGY_BIN") ?? DEFAULT_AGY_BIN;
    this.model = options.model ?? readEnv("AGY_MODEL") ?? "gemini-3.8-flash-low";
    const configuredTimeout = Number(readEnv("AGY_TIMEOUT_MS"));
    this.timeoutMs =
      options.timeoutMs ??
      (Number.isFinite(configuredTimeout) && configuredTimeout > 0
        ? configuredTimeout
        : AGY_TIMEOUT_MS);
  }

  async generate(input: ProviderGenerateInput): Promise<ProviderGenerateOutput> {
    if (process.env.VERCEL) {
      throw new AnimationProviderError(
        "missing_credentials",
        "The local Gemini CLI provider is disabled on Vercel.",
        { retryable: false },
      );
    }
    if (!existsSync(this.bin)) {
      throw new AnimationProviderError(
        "missing_credentials",
        "The local Gemini CLI is not installed (AGY_BIN).",
        { retryable: false },
      );
    }

    const startedAt = Date.now();
    const prompt = [
      input.systemPrompt,
      "",
      "USER REQUEST:",
      input.userPrompt,
      repairSuffix(input),
    ].join("\n");

    let stdout = "";
    let stderr = "";
    const child = spawn(
      this.bin,
      ["--print", prompt, "--model", this.model],
      {
        env: process.env,
        // Put the CLI and its MCP child in one process group so a timeout
        // cannot leave an orphaned Gemini process behind.
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    const killTree = () => {
      if (!child.pid) return;
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        try {
          child.kill("SIGKILL");
        } catch {
          /* already gone */
        }
      }
    };

    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout += String(chunk);
      if (stdout.length > 12 * 1024 * 1024) {
        stdout = stdout.slice(0, 12 * 1024 * 1024);
        killTree();
      }
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += String(chunk);
      if (stderr.length > 2 * 1024 * 1024) stderr = stderr.slice(0, 2 * 1024 * 1024);
    });

    const outcome = await new Promise<{ code: number | null; timedOut: boolean; spawnError?: string }>(
      (resolve) => {
        let settled = false;
        const finish = (value: { code: number | null; timedOut: boolean; spawnError?: string }) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(value);
        };
        const timer = setTimeout(() => {
          killTree();
          finish({ code: null, timedOut: true });
        }, this.timeoutMs);

        const onAbort = () => {
          killTree();
          finish({ code: null, timedOut: false, spawnError: "aborted" });
        };
        if (input.signal) {
          if (input.signal.aborted) onAbort();
          else input.signal.addEventListener("abort", onAbort, { once: true });
        }

        child.once("error", (error) => {
          finish({ code: -1, timedOut: false, spawnError: error.message });
        });
        child.once("close", (code) => {
          // Clean up any MCP child that outlived the CLI wrapper.
          killTree();
          finish({ code, timedOut: false });
        });
      },
    );

    if (outcome.spawnError === "aborted") {
      throw new AnimationProviderError("timeout", "The local Gemini CLI request was aborted.", {
        retryable: false,
      });
    }
    if (outcome.timedOut) {
      throw new AnimationProviderError(
        "timeout",
        "The local Gemini CLI timed out.",
        { retryable: true },
      );
    }
    if (outcome.spawnError) {
      throw new AnimationProviderError(
        "network",
        `The local Gemini CLI failed to start: ${outcome.spawnError}`,
        { retryable: true },
      );
    }
    if (outcome.code !== 0) {
      const details = stderr.trim() || `exit code ${outcome.code ?? "unknown"}`;
      if (/quota|rate limit|429/i.test(details)) {
        throw new AnimationProviderError(
          "rate_limited",
          "The local Gemini CLI reported a quota or rate limit.",
          { retryable: true },
        );
      }
      if (/401|UNAUTHENTICATED|authentication|invalid authentication/i.test(details)) {
        throw new AnimationProviderError(
          "http",
          "The local Gemini CLI is not authenticated.",
          { status: 401, retryable: false },
        );
      }
      throw new AnimationProviderError(
        "network",
        "The local Gemini CLI failed.",
        { retryable: true },
      );
    }

    const text = stripCodeFences(stdout.trim());
    if (!text) {
      throw new AnimationProviderError(
        "invalid_response",
        stderr.trim() || "The local Gemini CLI returned no text.",
        { retryable: false },
      );
    }
    return {
      text,
      provider: { id: this.id, model: this.model },
      latencyMs: Math.max(0, Date.now() - startedAt),
    };
  }
}

export class ExperientialProvider implements AnimationDirectorProvider {
  readonly id = "experiential";
  readonly model: string;
  private readonly apiKey: string | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: ProviderOptions = {}) {
    this.apiKey = options.apiKey ?? readEnv("EXPLABS_API_KEY");
    this.model =
      options.model ??
      readEnv("ANIMATION_DIRECTOR_MODEL") ??
      readEnv("CREATURE_MODEL") ??
      "claude-haiku-4.5";
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? PROVIDER_TIMEOUT_MS;
  }

  async generate(input: ProviderGenerateInput): Promise<ProviderGenerateOutput> {
    if (!this.apiKey) {
      throw new AnimationProviderError(
        "missing_credentials",
        "EXPLABS_API_KEY is not configured.",
        { retryable: false },
      );
    }

    const startedAt = Date.now();
    const messages: Array<{ role: "system" | "user"; content: string }> = [
      { role: "system", content: input.systemPrompt },
      { role: "user", content: `${input.userPrompt}${repairSuffix(input)}` },
    ];

    let response: Response;
    try {
      response = await this.fetchImpl(EXPERIENTIAL_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: input.temperature ?? 0.4,
          max_tokens: input.maxOutputTokens ?? DIRECTOR_DEFAULT_MAX_TOKENS,
        }),
        signal: combineSignals(this.timeoutMs, input.signal),
      });
    } catch (error) {
      throw mapFetchError(error);
    }

    if (!response.ok) throw httpError("Experiential Labs", response.status);

    const payload = (await readJsonBody(response)) as OpenAiChatPayload;
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      throw new AnimationProviderError(
        "invalid_response",
        "Experiential Labs returned no message content.",
        { retryable: false },
      );
    }

    const provider: DirectorProviderInfo = { id: this.id, model: this.model };
    return {
      text: stripCodeFences(content),
      provider,
      latencyMs: Math.max(0, Date.now() - startedAt),
    };
  }
}

export class GeminiProvider implements AnimationDirectorProvider {
  readonly id = "gemini";
  readonly model: string;
  private readonly apiKey: string | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: ProviderOptions = {}) {
    this.apiKey = options.apiKey ?? readEnv("GEMINI_API_KEY");
    const configured = options.model ?? readEnv("GEMINI_MODEL") ?? "gemini-2.5-flash";
    this.model = configured.replace(/^models\//, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? PROVIDER_TIMEOUT_MS;
  }

  async generate(input: ProviderGenerateInput): Promise<ProviderGenerateOutput> {
    if (!this.apiKey) {
      throw new AnimationProviderError(
        "missing_credentials",
        "GEMINI_API_KEY is not configured.",
        { retryable: false },
      );
    }

    const startedAt = Date.now();
    const url = `${GEMINI_ENDPOINT_ROOT}/${encodeURIComponent(this.model)}:generateContent`;

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: input.systemPrompt }],
          },
          contents: [
            {
              role: "user",
              parts: [
                { text: `${input.userPrompt}${repairSuffix(input)}` },
              ],
            },
          ],
          generationConfig: {
            temperature: input.temperature ?? 0.4,
            maxOutputTokens: input.maxOutputTokens ?? DIRECTOR_DEFAULT_MAX_TOKENS,
            responseMimeType: "application/json",
          },
        }),
        signal: combineSignals(this.timeoutMs, input.signal),
      });
    } catch (error) {
      throw mapFetchError(error);
    }

    if (!response.ok) throw httpError("Gemini", response.status);

    const payload = (await readJsonBody(response)) as GeminiPayload;
    if (payload.promptFeedback?.blockReason) {
      throw new AnimationProviderError(
        "invalid_response",
        "Gemini blocked the request before generating a response.",
        { retryable: false },
      );
    }

    const parts = payload.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("")
      .trim();
    if (text.length === 0) {
      throw new AnimationProviderError(
        "invalid_response",
        "Gemini returned no candidate text.",
        { retryable: false },
      );
    }

    const provider: DirectorProviderInfo = { id: this.id, model: this.model };
    return {
      text: stripCodeFences(text),
      provider,
      latencyMs: Math.max(0, Date.now() - startedAt),
    };
  }
}
