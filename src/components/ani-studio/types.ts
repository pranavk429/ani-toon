/**
 * View and state types for the ANI vector animation studio.
 *
 * Conforms to frozen shared contracts in:
 * - @/lib/studio/contracts
 * - @/lib/animation/types
 * - @/lib/ai/contracts
 * - @/creature/types
 * - @/lib/svg/types
 */

import type {
  KeyframeValue,
  MotionDocument,
  MotionProperty,
  MotionSource,
  RuntimeSnapshot,
} from "@/lib/animation/types";
import type {
  AnimationDirectionSuccess,
  TrackChangeSet,
} from "@/lib/ai/contracts";
import type { AniProject, AniProjectSource } from "@/lib/studio/contracts";
import type { Scene } from "@/creature/types";
import type { SceneGraph } from "@/lib/svg/types";

export type SourceKind = AniProjectSource["kind"]; // "character" | "svg"

export type StageBackground = "paper" | "grid" | "checker" | "none";

export type StudioPhase =
  | "idle"
  | "generating_character"
  | "planning_motion"
  | "validating"
  | "ready"
  | "error";

export type StudioStatus = {
  phase: StudioPhase;
  message: string;
  providerLabel?: string;
  isFallback?: boolean;
  ms?: number;
};

export type StudioError = {
  title: string;
  detail?: string;
  issues?: string[];
};

export type ChatRole = "user" | "assistant" | "system" | "error";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
  isFallback?: boolean;
  providerLabel?: string;
  changes?: TrackChangeSet;
  warnings?: string[];
};

export type RevisionEntry = {
  id: string;
  document: MotionDocument;
  name: string;
  summary: string;
  source: MotionSource;
  providerLabel?: string;
  createdAt: string;
  explanation: string;
  changes?: TrackChangeSet;
};

export type PlaybackChannel = {
  playing: boolean;
  speed: number;
  duration: number;
  loop: boolean;
  reducedMotion: boolean;
  onToggle: () => void;
  onRestart: () => void;
  onSeek: (seconds: number) => void;
  onSpeed: (speed: number) => void;
  onToggleLoop: () => void;
  subscribeTime: (listener: (time: number, duration: number) => void) => () => void;
  getTime: () => number;
  subscribeFrame?: (listener: (time: number) => void) => () => void;
};

export type StudioTab = "source" | "stage" | "director";

export type TrackInspectorDraft = {
  trackId: string;
  label: string;
  targetId: string;
  targetKind: "character" | "object" | "svg";
  property: MotionProperty;
  delay: number;
  duration: number;
  easingName: string;
  firstValue: KeyframeValue;
  lastValue: KeyframeValue;
};
