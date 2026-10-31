/**
 * Shared AI Director request/response contract.
 *
 * The browser sends this to `POST /api/animation/direct`; provider credentials
 * never leave the server. Character context is derived from the real scene
 * skeleton, and SVG context from the real sanitized scene graph, so the model
 * cannot invent target IDs.
 */

import type {
  BoneTargetContext,
  MotionDocument,
  MotionSource,
} from "@/lib/animation/types";
import type { SceneContext } from "@/lib/svg/types";

export const DIRECTOR_REQUEST_VERSION = 1 as const;

export type DirectorMessage = {
  role: "user" | "assistant";
  content: string;
};

export type CharacterActorContext = {
  id: string;
  name: string;
  species: string;
  bodyPlan: string;
  summary: string;
  palette: Record<string, string>;
  accessories: string[];
};

export type CharacterObjectContext = {
  id: string;
  kind: string;
  label?: string;
  /** Authored centre in 720x720 stage coordinates. */
  x: number;
  y: number;
  scale?: number;
  rotation?: number;
};

export type CharacterDirectionContext = {
  styleId: string;
  actors: CharacterActorContext[];
  /** Every real bone, keyed to its actor, with rig limits. */
  bones: BoneTargetContext[];
  objects: CharacterObjectContext[];
  /** World / scene summary for art direction. */
  world: { preset: string; accent: string };
  notes: string[];
};

export type DirectorStyleProfile = {
  id: string;
  name: string;
  description: string;
  constraints: string[];
};

export type AnimationDirectionRequest = {
  version: typeof DIRECTOR_REQUEST_VERSION;
  action: "generate" | "revise";
  instruction: string;
  targetKind: "svg" | "character";
  scene?: SceneContext;
  character?: CharacterDirectionContext;
  currentDocument?: MotionDocument;
  selectedElementIds?: string[];
  selectedObjectIds?: string[];
  history?: DirectorMessage[];
  styleProfile?: DirectorStyleProfile;
};

export type TrackChangeSet = {
  added: string[];
  removed: string[];
  modified: string[];
  unchanged: string[];
};

export type DirectorProviderInfo = {
  id: string;
  model: string;
};

export type AnimationDirectionSuccess = {
  ok: true;
  document: MotionDocument;
  explanation: string;
  source: Exclude<MotionSource, "preset" | "manual">;
  provider?: DirectorProviderInfo;
  warnings: string[];
  changes: TrackChangeSet;
  revisionId: string;
  parentRevisionId?: string;
  latencyMs: number;
  repairs: number;
};

export type AnimationDirectionFailure = {
  ok: false;
  error: {
    code:
      | "bad_request"
      | "missing_context"
      | "provider_unavailable"
      | "provider_error"
      | "invalid_output"
      | "timeout"
      | "rate_limited";
    message: string;
    retryable: boolean;
  };
  latencyMs: number;
};

export type AnimationDirectionResponse =
  | AnimationDirectionSuccess
  | AnimationDirectionFailure;

export type ProviderGenerateInput = {
  systemPrompt: string;
  userPrompt: string;
  /** Previous model JSON for a repair attempt. */
  repair?: {
    previousText: string;
    errors: string[];
  };
  signal?: AbortSignal;
  temperature?: number;
  maxOutputTokens?: number;
};

export type ProviderGenerateOutput = {
  text: string;
  provider: DirectorProviderInfo;
  latencyMs: number;
};

export interface AnimationDirectorProvider {
  readonly id: string;
  readonly model: string;
  generate(input: ProviderGenerateInput): Promise<ProviderGenerateOutput>;
}
