/**
 * UI-only view types for the generative studio.
 *
 * These never replace the shared contracts in `src/lib/**`; they only describe
 * local state that the panels exchange.
 */

import type {
  MotionDocument,
  MotionSource,
  RuntimeSnapshot,
} from "@/lib/animation/types";
import type {
  AnimationDirectionSuccess,
  TrackChangeSet,
} from "@/lib/ai/contracts";

export type SourceKind = "character" | "svg";

export type StageBackground = "paper" | "grid" | "checker" | "none";

export type StudioPhase =
  | "idle"
  | "importing"
  | "requesting"
  | "validating"
  | "ready"
  | "error";

export type StudioStatus = {
  phase: StudioPhase;
  message: string;
};

export type StudioError = {
  title: string;
  detail?: string;
  issues?: string[];
};

export type ChatRole = "user" | "assistant" | "error" | "system";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
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

/** Everything the stage, timeline and transport bar need from one clock. */
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
  /** SVG only: raw snapshots with evaluated target state. */
  subscribeFrame?: (listener: (snapshot: RuntimeSnapshot) => void) => () => void;
};

export type LastDirectionResponse = AnimationDirectionSuccess;
