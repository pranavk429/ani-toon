/**
 * Server-only AI Director endpoint.
 *
 * POST body: AnimationDirectionRequest (see src/lib/ai/contracts.ts)
 * POST response: AnimationDirectionResponse, always 200 for a completed
 * Director attempt (including a clearly labelled local fallback). 400 for
 * a malformed client request. 429 for rate limit exceeded. 500 only when even
 * the local fallback could not be composed.
 */

import { connection } from "next/server";

import type {
  AnimationDirectionFailure,
  AnimationDirectionRequest,
} from "@/lib/ai/contracts";
import { directAnimation } from "@/lib/ai/director";
import { getProviderStatus } from "@/lib/ai/provider";

export const maxDuration = 60;

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;

// In-memory rate limiting by IP
const ipRequestTimestamps = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = ipRequestTimestamps.get(ip) ?? [];
  const valid = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (valid.length >= MAX_REQUESTS_PER_WINDOW) {
    ipRequestTimestamps.set(ip, valid);
    return false;
  }

  valid.push(now);
  ipRequestTimestamps.set(ip, valid);

  // Periodic cleanup if map grows
  if (ipRequestTimestamps.size > 10_000) {
    for (const [key, times] of ipRequestTimestamps.entries()) {
      const active = times.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
      if (active.length === 0) ipRequestTimestamps.delete(key);
      else ipRequestTimestamps.set(key, active);
    }
  }

  return true;
}

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

function badRequest(message: string, latencyMs = 0): Response {
  const failure: AnimationDirectionFailure = {
    ok: false,
    error: {
      code: "bad_request",
      message,
      retryable: false,
    },
    latencyMs,
  };
  return jsonResponse(failure, 400);
}

function rateLimited(latencyMs = 0): Response {
  const failure: AnimationDirectionFailure = {
    ok: false,
    error: {
      code: "rate_limited",
      message: "Rate limit exceeded. Maximum 20 requests per minute.",
      retryable: true,
    },
    latencyMs,
  };
  return jsonResponse(failure, 429);
}

async function readBodyWithLimit(request: Request): Promise<string | null> {
  const body = request.body;
  if (!body) return "";
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } catch {
    await reader.cancel().catch(() => undefined);
    return null;
  }
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "127.0.0.1";
}

export async function POST(request: Request): Promise<Response> {
  const startedAt = Date.now();

  const ip = getClientIp(request);
  if (!checkRateLimit(ip)) {
    return rateLimited(Date.now() - startedAt);
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return badRequest("Request body is too large.", Date.now() - startedAt);
  }

  const text = await readBodyWithLimit(request);
  if (text === null) {
    return badRequest("Request body is too large.", Date.now() - startedAt);
  }

  if (text.trim().length === 0) {
    return badRequest("Request body must be JSON.", Date.now() - startedAt);
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return badRequest("Request body is not valid JSON.", Date.now() - startedAt);
  }

  try {
    const result = await directAnimation(body as AnimationDirectionRequest);
    const status = result.ok
      ? 200
      : result.error.code === "bad_request" || result.error.code === "missing_context"
        ? 400
        : result.error.code === "rate_limited"
          ? 429
          : 500;
    return jsonResponse(result, status);
  } catch {
    const failure: AnimationDirectionFailure = {
      ok: false,
      error: {
        code: "provider_unavailable",
        message:
          "The Director could not produce a valid animation. Try a shorter instruction or retry.",
        retryable: true,
      },
      latencyMs: Math.max(0, Date.now() - startedAt),
    };
    return jsonResponse(failure, 500);
  }
}

/** Safe configuration health. Never includes credentials. */
export async function GET(): Promise<Response> {
  try {
    await connection();
  } catch {
    /* Direct invocation outside request scope */
  }
  return jsonResponse({
    ok: true,
    provider: getProviderStatus(),
  });
}
