/**
 * Public AI Director surface.
 *
 * Import types from here in UI code (`import type { ... }`). The runtime
 * functions are server-only because they read provider credentials from
 * `process.env`; the route handler is the browser-facing entry point.
 */

export * from "./contracts";
export { directAnimation, DIRECTOR_MAX_PROVIDER_ATTEMPTS } from "./director";
export {
  ExperientialProvider,
  GeminiProvider,
  getConfiguredProvider,
  getProviderStatus,
  AnimationProviderError,
  EXPERIENTIAL_ENDPOINT,
  GEMINI_ENDPOINT_ROOT,
  PROVIDER_TIMEOUT_MS,
  DIRECTOR_DEFAULT_MAX_TOKENS,
  stripCodeFences,
} from "./provider";
export type {
  AnimationDirectorProviderId,
  AnimationProviderErrorCode,
  ProviderOptions,
} from "./provider";
export {
  buildPrompts,
  MOTION_DSL_SYSTEM_PROMPT,
  trimDocumentForPrompt,
  MAX_PROMPT_DOCUMENT_CHARS,
} from "./prompt";
export type { PromptBundle } from "./prompt";
export { composeFallback, fallbackHash } from "./fallback";
export type { FallbackResult } from "./fallback";
export { diffTracks, mergeRevision, trackPairKey } from "./revision";
export type { MergeRevisionResult } from "./revision";
export {
  validateDirectionRequest,
  buildValidationContext,
  collectTargetIds,
  MAX_INSTRUCTION_LENGTH,
  MIN_DIRECTED_DURATION,
  MAX_DIRECTED_DURATION,
} from "./request";
export type { RequestValidation } from "./request";
