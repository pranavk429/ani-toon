/**
 * Pure Motion DSL evaluation.
 *
 * `evaluateDocument(document, seconds)` depends only on its arguments. Document
 * level looping is mapped here once; individual tracks receive the mapped local
 * time and use their own delay/duration window.
 *
 * Multiple tracks may target the same object/property. Composition is fixed:
 * - translateX / translateY / rotate: additive (defaults 0)
 * - scale / scaleX / scaleY: multiplicative (defaults 1)
 * - opacity: multiplicative (default 1)
 * - strokeWidth / fill / stroke / strokeDraw / motionPath: last declared wins
 *
 * Every track fills before/after its window with its first/last keyframe, so a
 * sequential shake (0..0.7s) and launch (0.7..3.2s) compose as expected.
 */

import type {
  EvaluatedState,
  EvaluatedTarget,
  EvaluateOptions,
  Keyframe,
  MotionDocument,
  MotionProperty,
  MotionTrack,
  TimelineModel,
  TimelineTrack,
  TrackWindow,
  TransformOrigin,
} from "./types";
import { evaluateEasing } from "./easing";
import { samplePath } from "./path";
import { defaultTransformOrigin, motionTargetKey } from "./targets";

/** Non-enumerable metadata used by `applySvgEvaluation` for exact restores. */
export const EVALUATED_TARGET_META: unique symbol = Symbol(
  "anitoon.motion.evaluatedTargetMeta",
);

export type EvaluatedTargetMeta = {
  properties: ReadonlySet<MotionProperty>;
  origin: TransformOrigin;
};

export type EvaluatedTargetWithMeta = EvaluatedTarget & {
  [EVALUATED_TARGET_META]?: EvaluatedTargetMeta;
};

export type ResolvedDocumentTime = {
  /** Mapped time inside the document, 0..duration. */
  time: number;
  localTime: number;
  loopIteration: number;
};

const TRANSFORM_PROPERTIES: ReadonlySet<MotionProperty> = new Set([
  "translateX",
  "translateY",
  "rotate",
  "scale",
  "scaleX",
  "scaleY",
  "motionPath",
]);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function toHiddenSet(
  options?: EvaluateOptions,
): ReadonlySet<string> | undefined {
  const hidden = options?.hiddenTrackIds;
  if (!hidden) return undefined;
  if (Array.isArray(hidden)) return new Set(hidden);
  const maybeSet = hidden as ReadonlySet<string>;
  if (typeof maybeSet.has === "function") return maybeSet;
  return new Set(hidden as readonly string[]);
}

function isHidden(
  track: MotionTrack,
  hidden: ReadonlySet<string> | undefined,
): boolean {
  return track.muted === true || (hidden !== undefined && hidden.has(track.id));
}

/**
 * Resolve absolute elapsed seconds to the document's local playhead.
 *
 * - non-loop: clamped to [0, duration]
 * - restart: modulo duration; iteration counts completed cycles
 * - pingpong: folded at the duration boundary; iteration counts completed
 *   forward+backward cycles
 */
export function resolveDocumentTime(
  doc: MotionDocument,
  seconds: number,
): ResolvedDocumentTime {
  const duration = Math.max(1e-9, finiteOr(doc.duration, 1));
  const safeSeconds = Number.isFinite(seconds) ? seconds : 0;
  const loop = doc.loop?.enabled === true;
  if (!loop) {
    const time = clamp(safeSeconds, 0, duration);
    return { time, localTime: time, loopIteration: 0 };
  }

  const elapsed = Math.max(0, safeSeconds);
  if (doc.loop?.mode === "pingpong") {
    const cycle = duration * 2;
    const loopIteration = Math.floor(elapsed / cycle);
    const phase = elapsed - loopIteration * cycle;
    const time = phase <= duration ? phase : cycle - phase;
    return {
      time: clamp(time, 0, duration),
      localTime: clamp(time, 0, duration),
      loopIteration,
    };
  }

  const loopIteration = Math.floor(elapsed / duration);
  const time = elapsed - loopIteration * duration;
  return {
    time: clamp(time, 0, duration),
    localTime: clamp(time, 0, duration),
    loopIteration,
  };
}

export type ParsedColor = {
  r: number;
  g: number;
  b: number;
  a: number;
};

/** Parse #RGB, #RRGGBB or #RRGGBBAA. Returns null for other strings. */
export function parseHexColor(value: string): ParsedColor | null {
  const match = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(value);
  if (!match) return null;
  const hex = match[1];
  if (hex.length === 3) {
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
      a: 1,
    };
  }
  if (hex.length === 6) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: 1,
    };
  }
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
    a: parseInt(hex.slice(6, 8), 16) / 255,
  };
}

function hexChannel(value: number): string {
  return Math.round(clamp(value, 0, 255))
    .toString(16)
    .padStart(2, "0");
}

/** Interpolate two hex colors in straight sRGB. Invalid inputs hold `from`. */
export function interpolateColor(
  from: string,
  to: string,
  progress: number,
): string {
  const start = parseHexColor(from);
  const end = parseHexColor(to);
  if (!start || !end) return from;
  const t = Number.isFinite(progress) ? progress : 0;
  const r = start.r + (end.r - start.r) * t;
  const g = start.g + (end.g - start.g) * t;
  const b = start.b + (end.b - start.b) * t;
  const a = start.a + (end.a - start.a) * t;
  const keepAlpha =
    from.length === 9 || to.length === 9 || Math.abs(a - 1) > 1e-6;
  const base = `#${hexChannel(r)}${hexChannel(g)}${hexChannel(b)}`;
  return keepAlpha ? `${base}${hexChannel(clamp01(a) * 255)}` : base;
}

function interpolateValues(
  from: number | string,
  to: number | string,
  eased: number,
): number | string {
  if (typeof from === "number" && typeof to === "number") {
    return from + (to - from) * eased;
  }
  if (typeof from === "string" && typeof to === "string") {
    return interpolateColor(from, to, eased);
  }
  // Non-color string values and mixed types hold the starting value.
  return from;
}

function keyframeValueAt(
  track: MotionTrack,
  progress: number,
): number | string | undefined {
  const keyframes: Keyframe[] = track.keyframes;
  if (!keyframes || keyframes.length === 0) return undefined;
  const first = keyframes[0];
  if (progress <= first.at) return first.value;
  const last = keyframes[keyframes.length - 1];
  if (progress >= last.at) return last.value;

  let index = 0;
  while (
    index < keyframes.length - 2 &&
    keyframes[index + 1].at <= progress
  ) {
    index++;
  }
  const start = keyframes[index];
  const end = keyframes[index + 1];
  const span = end.at - start.at;
  if (!(span > 0)) return end.value;
  const local = clamp01((progress - start.at) / span);
  const easing = start.easing ?? track.easing ?? "easeInOut";
  return interpolateValues(
    start.value,
    end.value,
    evaluateEasing(easing, local),
  );
}

/** Evaluate a track value at already-mapped local document seconds. */
function evaluateTrackAtLocalTime(
  track: MotionTrack,
  doc: MotionDocument,
  localTime: number,
): number | string | undefined {
  const window = trackWindow(track, doc);
  const duration = Math.max(1e-9, window.duration);
  const progress =
    localTime <= window.start
      ? 0
      : localTime >= window.end
        ? 1
        : clamp01((localTime - window.start) / duration);
  return keyframeValueAt(track, progress);
}

/** Public single-track evaluation. Applies document loop mapping. */
export function evaluateTrack(
  track: MotionTrack,
  doc: MotionDocument,
  seconds: number,
  options?: EvaluateOptions,
): number | string | undefined {
  const hidden = toHiddenSet(options);
  if (isHidden(track, hidden)) return undefined;
  const time = resolveDocumentTime(doc, seconds);
  return evaluateTrackAtLocalTime(track, doc, time.localTime);
}

function numberValue(value: number | string | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function targetIdOf(track: MotionTrack): string {
  return motionTargetKey(track.target);
}

function applyTrackValue(
  target: EvaluatedTarget,
  animated: Set<MotionProperty>,
  track: MotionTrack,
  value: number | string,
): void {
  const property = track.property;

  if (property === "fill" || property === "stroke") {
    if (typeof value === "string") {
      if (property === "fill") target.fill = value;
      else target.stroke = value;
      animated.add(property);
    }
    return;
  }

  const numeric = numberValue(value);
  if (numeric === undefined) return;

  switch (property) {
    // Positional properties compose additively. Sequential tracks (for example
    // a shake followed by a launch) both contribute their settled value.
    case "translateX":
      target.translateX += numeric;
      animated.add(property);
      break;
    case "translateY":
      target.translateY += numeric;
      animated.add(property);
      break;
    case "rotate":
      target.rotate += numeric;
      animated.add(property);
      break;
    // Scale composes multiplicatively with a default of 1.
    case "scale":
      target.scaleX *= numeric;
      target.scaleY *= numeric;
      animated.add(property);
      break;
    case "scaleX":
      target.scaleX *= numeric;
      animated.add(property);
      break;
    case "scaleY":
      target.scaleY *= numeric;
      animated.add(property);
      break;
    // Opacity composes multiplicatively with a default of 1.
    case "opacity":
      target.opacity *= numeric;
      animated.add(property);
      break;
    // Last-declared track wins for these properties.
    case "strokeWidth":
      target.strokeWidth = Math.max(0, numeric);
      animated.add(property);
      break;
    case "strokeDraw":
      target.strokeDraw = clamp01(numeric);
      animated.add(property);
      break;
    case "faceBlink":
      target.faceBlink = (target.faceBlink ?? 0) + numeric;
      animated.add(property);
      break;
    case "faceLookX":
      target.faceLookX = (target.faceLookX ?? 0) + numeric;
      animated.add(property);
      break;
    case "faceLookY":
      target.faceLookY = (target.faceLookY ?? 0) + numeric;
      animated.add(property);
      break;
    case "faceMouth":
      target.faceMouth = (target.faceMouth ?? 0) + numeric;
      animated.add(property);
      break;
    case "faceWink":
      target.faceWink = (target.faceWink ?? 0) + numeric;
      animated.add(property);
      break;
    case "faceCheek":
      target.faceCheek = (target.faceCheek ?? 0) + numeric;
      animated.add(property);
      break;
    case "faceExpression":
      target.faceExpression = numeric;
      animated.add(property);
      break;
    case "motionPath": {
      const path = track.path;
      if (!path) return;
      const progress = clamp01(numeric);
      try {
        const sample = samplePath(path, progress);
        target.motionPath = {
          x: sample.x,
          y: sample.y,
          angle: track.orient === false ? 0 : sample.angle,
          progress,
        };
        animated.add(property);
      } catch {
        /* Validated documents always have parseable paths. */
      }
      break;
    }
    default:
      break;
  }
}

/**
 * Evaluate the tracks belonging to one target. Every matching track contributes
 * one property; the returned object always has normalized transform defaults.
 *
 * This helper is shared by `evaluateDocument` and the SMIL exporter so both
 * paths aggregate values identically.
 */
export function evaluateTargetTracks(
  tracks: MotionTrack[],
  doc: MotionDocument,
  seconds: number,
  options?: EvaluateOptions,
): EvaluatedTarget | undefined {
  const hidden = toHiddenSet(options);
  const active = tracks.filter((track) => !isHidden(track, hidden));
  if (active.length === 0) return undefined;
  const time = resolveDocumentTime(doc, seconds);
  return evaluateTargetTracksAt(active, doc, time.localTime);
}

function evaluateTargetTracksAt(
  tracks: MotionTrack[],
  doc: MotionDocument,
  localTime: number,
): EvaluatedTarget | undefined {
  if (tracks.length === 0) return undefined;
  const target: EvaluatedTarget = {
    translateX: 0,
    translateY: 0,
    rotate: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
  };
  const animated = new Set<MotionProperty>();
  let origin: TransformOrigin | undefined;

  for (const track of tracks) {
    const value = evaluateTrackAtLocalTime(track, doc, localTime);
    if (value === undefined) continue;
    applyTrackValue(target, animated, track, value);
    if (TRANSFORM_PROPERTIES.has(track.property)) {
      const fallbackOrigin = defaultTransformOrigin(track.target);
      const trackOrigin = track.origin ?? fallbackOrigin;
      if (origin === undefined) {
        origin = trackOrigin;
      } else if (origin === fallbackOrigin && trackOrigin !== fallbackOrigin) {
        // An explicitly authored non-default origin wins over the default.
        origin = trackOrigin;
      }
    }
  }

  if (animated.size === 0) return undefined;

  // Multiplied opacity is clamped to the DSL's valid state range.
  target.opacity = clamp01(target.opacity);

  const meta: EvaluatedTargetMeta = {
    properties: animated,
    origin: origin ?? defaultTransformOrigin(tracks[0].target),
  };
  Object.defineProperty(target, EVALUATED_TARGET_META, {
    value: meta,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return target;
}

/** Evaluate a complete document at one timestamp. */
export function evaluateDocument(
  doc: MotionDocument,
  seconds: number,
  options?: EvaluateOptions,
): EvaluatedState {
  const hidden = toHiddenSet(options);
  const time = resolveDocumentTime(doc, seconds);
  const groups = new Map<string, MotionTrack[]>();
  for (const track of doc.tracks) {
    if (isHidden(track, hidden)) continue;
    const id = targetIdOf(track);
    const list = groups.get(id);
    if (list) list.push(track);
    else groups.set(id, [track]);
  }

  const targets: Record<string, EvaluatedTarget> = {};
  for (const [id, tracks] of groups) {
    const target = evaluateTargetTracksAt(tracks, doc, time.localTime);
    if (target) {
      // defineProperty keeps ids like "__proto__" as ordinary keys.
      Object.defineProperty(targets, id, {
        value: target,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
  }

  return {
    time: time.time,
    duration: doc.duration,
    targets,
    localTime: time.localTime,
    loopIteration: time.loopIteration,
  };
}

/** Real track window in seconds. */
export function trackWindow(track: MotionTrack, doc: MotionDocument): TrackWindow {
  const start = Math.max(0, finiteOr(track.delay ?? 0, 0));
  const authored = track.duration;
  const duration =
    typeof authored === "number" && Number.isFinite(authored) && authored > 0
      ? authored
      : Math.max(0, doc.duration - start);
  return { start, end: start + duration, duration };
}

/** Timeline representation with absolute keyframe times. */
export function createTimelineModel(doc: MotionDocument): TimelineModel {
  const targetIds: string[] = [];
  const seenTargets = new Set<string>();
  const tracks: TimelineTrack[] = doc.tracks.map((track) => {
    const window = trackWindow(track, doc);
    const targetId = targetIdOf(track);
    if (!seenTargets.has(targetId)) {
      seenTargets.add(targetId);
      targetIds.push(targetId);
    }
    return {
      id: track.id,
      label: track.label ?? track.id,
      targetId,
      targetKind: track.target.kind,
      property: track.property,
      window,
      keyframeTimes: track.keyframes.map(
        (keyframe) => window.start + keyframe.at * window.duration,
      ),
      muted: track.muted === true,
    };
  });
  return { duration: doc.duration, tracks, targetIds };
}
