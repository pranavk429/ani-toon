/**
 * Motion DSL v1 — frozen shared contract.
 *
 * The AI may only produce this declarative document. It is never executable
 * code. Deterministic evaluation lives in `evaluate.ts` / `runtime.ts`.
 *
 * ANI extension (v1, backward compatible):
 * - A document targets either an imported SVG (`svg`) or a generated character
 *   scene (`character`).
 * - A character document may target skeletal bones, scene objects and the
 *   character's facial channels. Mixed tracks are the point: a jump, a wave,
 *   a ball arc and a blink can run at the same time without blocking one
 *   another.
 */

export const MOTION_DOC_VERSION = 1 as const;
export const MOTION_FPS = 60 as const;
export const MIN_DURATION = 0.2;
export const MAX_DURATION = 60;
export const MAX_TRACKS = 200;
export const MAX_KEYFRAMES = 64;
export const MAX_GROUPS = 40;

/** What the whole document is about. Character documents may also target objects. */
export type MotionTargetKind = "svg" | "character";

/** A single addressable thing a track can drive. */
export type MotionTarget =
  | { kind: "svg"; elementId: string }
  | { kind: "character"; actorId: string; boneId: string }
  | { kind: "object"; objectId: string };

export type NamedEasing =
  | "linear"
  | "easeIn"
  | "easeOut"
  | "easeInOut"
  | "quadIn"
  | "quadOut"
  | "quadInOut"
  | "cubicIn"
  | "cubicOut"
  | "cubicInOut"
  | "backIn"
  | "backOut"
  | "backInOut"
  | "spring"
  | "springSoft"
  | "springBouncy";

export type CubicBezierEasing = {
  type: "cubicBezier";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type SpringEasing = {
  type: "spring";
  stiffness: number;
  damping: number;
  mass?: number;
};

export type Easing = NamedEasing | CubicBezierEasing | SpringEasing;

export type TransformOrigin = "center" | "bone" | "top-left";

export type MotionProperty =
  | "translateX"
  | "translateY"
  | "rotate"
  | "scale"
  | "scaleX"
  | "scaleY"
  | "opacity"
  | "fill"
  | "stroke"
  | "strokeWidth"
  | "strokeDraw"
  | "motionPath"
  | "faceBlink"
  | "faceLookX"
  | "faceLookY"
  | "faceMouth"
  | "faceWink"
  | "faceCheek"
  | "faceExpression";

export const SVG_PROPERTIES: readonly MotionProperty[] = [
  "translateX",
  "translateY",
  "rotate",
  "scale",
  "scaleX",
  "scaleY",
  "opacity",
  "fill",
  "stroke",
  "strokeWidth",
  "strokeDraw",
  "motionPath",
];

/** Bone transforms. Translate is only meaningful on the root bone. */
export const CHARACTER_BONE_PROPERTIES: readonly MotionProperty[] = [
  "translateX",
  "translateY",
  "rotate",
  "scale",
  "scaleX",
  "scaleY",
];

/** Facial channels evaluated by the character renderer. */
export const CHARACTER_FACE_PROPERTIES: readonly MotionProperty[] = [
  "faceBlink",
  "faceLookX",
  "faceLookY",
  "faceMouth",
  "faceWink",
  "faceCheek",
  "faceExpression",
];

export const CHARACTER_OBJECT_PROPERTIES: readonly MotionProperty[] = [
  "translateX",
  "translateY",
  "rotate",
  "scale",
  "scaleX",
  "scaleY",
  "opacity",
  "fill",
  "stroke",
];

/** Union allowed by a character document (per-target rules are stricter). */
export const CHARACTER_PROPERTIES: readonly MotionProperty[] = [
  ...CHARACTER_BONE_PROPERTIES,
  ...CHARACTER_FACE_PROPERTIES,
  ...CHARACTER_OBJECT_PROPERTIES,
];

/** Backwards-compatible alias used by the original mascot tests. */
export const MASCOT_PROPERTIES: readonly MotionProperty[] =
  CHARACTER_BONE_PROPERTIES;

export type KeyframeValue = number | string;

export type Keyframe = {
  /** Normalized position inside the track window, 0..1. */
  at: number;
  value: KeyframeValue;
  /** Applies from this keyframe to the next. */
  easing?: Easing;
};

export type MotionTrack = {
  id: string;
  target: MotionTarget;
  property: MotionProperty;
  keyframes: Keyframe[];
  /** Seconds. */
  delay?: number;
  /** Seconds. Defaults to document duration minus delay. */
  duration?: number;
  easing?: Easing;
  /** Required for `motionPath`; relative offset path in SVG user units. */
  path?: string;
  /** Motion-path orientation. Default true. */
  orient?: boolean;
  /** Rotation/scale origin. SVG defaults to center; characters default to bone. */
  origin?: TransformOrigin;
  /** Authoring label. */
  label?: string;
  /** Track is present in the document but muted in preview/export. */
  muted?: boolean;
};

export type StaggerGroup = {
  id: string;
  target: { kind: MotionTargetKind };
  /** SVG element IDs. */
  elementIds?: string[];
  /**
   * Character bone keys. Use "actorId:boneId" (for example "hero:armR").
   * Character scene graphs may contain more than one actor.
   */
  boneIds?: string[];
  property: MotionProperty;
  keyframes: Keyframe[];
  delay?: number;
  duration?: number;
  easing?: Easing;
  /** Seconds added per target, in array order. */
  step?: number;
  path?: string;
  orient?: boolean;
  origin?: TransformOrigin;
  label?: string;
  muted?: boolean;
};

export type MotionSource = "ai" | "fallback" | "preset" | "manual";

export type MotionMeta = {
  prompt?: string;
  source: MotionSource;
  provider?: string;
  model?: string;
  createdAt?: string;
  revisionOf?: string;
  summary?: string;
  /** Server-measured latency in milliseconds. */
  latencyMs?: number;
  /** Non-fatal notes produced by the validator or revision guard. */
  warnings?: string[];
};

export type MotionLoop = {
  enabled: boolean;
  mode?: "restart" | "pingpong";
  iterations?: number;
};

export type MotionDocument = {
  version: typeof MOTION_DOC_VERSION;
  id: string;
  name: string;
  targetKind: MotionTargetKind;
  duration: number;
  fps: typeof MOTION_FPS;
  loop: MotionLoop;
  tracks: MotionTrack[];
  /** Authoring only. Validation expands and removes groups. */
  groups?: StaggerGroup[];
  meta?: MotionMeta;
};

/** A bone exposed to the Director, with its real rig limits. */
export type BoneTargetContext = {
  actorId: string;
  boneId: string;
  role?: string;
  parent?: string | null;
  rotationLimit?: { min: number; max: number };
  scaleLimit?: { min: number; max: number };
  note?: string;
};

export type ValidationContext = {
  targetKind: MotionTargetKind;
  elementIds?: ReadonlySet<string> | readonly string[];
  /**
   * Legacy flat bone list. Keys must be "actorId:boneId" when a document has
   * more than one actor. Prefer `bones` for new code.
   */
  boneIds?: ReadonlySet<string> | readonly string[];
  /** Full character rig context. */
  bones?: readonly BoneTargetContext[];
  objectIds?: ReadonlySet<string> | readonly string[];
  /** Optional stricter duration range, in seconds. */
  minDuration?: number;
  maxDuration?: number;
  /** When false, `muted` tracks are kept (default true). */
  allowMuted?: boolean;
};

export type ValidationIssue = {
  path: string;
  message: string;
  code:
    | "shape"
    | "version"
    | "duration"
    | "target"
    | "property"
    | "keyframes"
    | "value"
    | "timing"
    | "duplicate"
    | "loop"
    | "unsupported";
  severity: "error" | "warning";
};

export type ValidationResult = {
  ok: boolean;
  /** Normalized document (groups expanded, defaults filled, issues fixed). */
  document?: MotionDocument;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
};

/** Normalized property values for one target at one timestamp. */
export type EvaluatedTarget = {
  translateX: number;
  translateY: number;
  rotate: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDraw?: number;
  motionPath?: {
    x: number;
    y: number;
    angle: number;
    progress: number;
  };
  /** Character face channels. Unset means "leave the procedural face alone". */
  faceBlink?: number;
  faceLookX?: number;
  faceLookY?: number;
  faceMouth?: number;
  faceWink?: number;
  faceCheek?: number;
  /** 0 neutral, 1 happy, 2 surprised, 3 thinking, 4 shy, 5 laugh, 6 sleepy, 7 wink. */
  faceExpression?: number;
};

export type EvaluatedState = {
  time: number;
  duration: number;
  targets: Record<string, EvaluatedTarget>;
  /** Absolute time in seconds modulo/loop mapping. */
  localTime: number;
  loopIteration: number;
};

export type EvaluateOptions = {
  hiddenTrackIds?: ReadonlySet<string> | readonly string[];
};

export type TrackWindow = {
  start: number;
  end: number;
  duration: number;
};

export type TimelineTrack = {
  id: string;
  label: string;
  targetId: string;
  targetKind: MotionTarget["kind"];
  property: MotionProperty;
  window: TrackWindow;
  keyframeTimes: number[];
  muted: boolean;
};

export type TimelineModel = {
  duration: number;
  tracks: TimelineTrack[];
  targetIds: string[];
};

export type RuntimeOptions = {
  loop?: boolean;
  speed?: number;
  autoplay?: boolean;
  reducedMotion?: boolean;
  hiddenTrackIds?: ReadonlySet<string> | readonly string[];
};

export type RuntimeSnapshot = {
  time: number;
  duration: number;
  playing: boolean;
  speed: number;
  loop: boolean;
  iteration: number;
  state: EvaluatedState;
};
