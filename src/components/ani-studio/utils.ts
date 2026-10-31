/**
 * Pure utilities and helpers for ANI vector animation studio.
 *
 * Safe to test in Node.js environments without DOM or React.
 */

import type {
  Keyframe,
  KeyframeValue,
  MotionDocument,
  MotionProperty,
  MotionSource,
  MotionTrack,
} from "@/lib/animation/types";
import type { TrackChangeSet } from "@/lib/ai/contracts";
import type { AniProject } from "@/lib/studio/contracts";
import type { SceneGraph } from "@/lib/svg/types";
import { buildSofiaScene } from "@/creature/examples";
import { studioScene } from "@/creature/validate";
import {
  buildTimeTicks,
  changedTrackCount,
  clamp,
  filterDocumentTracks,
  flattenVisibleElements,
  formatBytesShort,
  formatClock,
  formatSeconds,
  revisionSourceLabel,
  safeFilename,
  summarizeChanges,
  timePercent,
  type FlatTreeRow,
  type TimeTick,
  type TreeGraphLike,
} from "@/components/studio/ai/studio-utils";

export {
  buildTimeTicks,
  changedTrackCount,
  clamp,
  filterDocumentTracks,
  flattenVisibleElements,
  formatBytesShort,
  formatClock,
  formatSeconds,
  revisionSourceLabel,
  safeFilename,
  summarizeChanges,
  timePercent,
  type FlatTreeRow,
  type TimeTick,
  type TreeGraphLike,
};

const APPEARANCE_REGEX =
  /\b(shirt|color|colour|hair|hat|outfit|body|face|background|world|character|add\s+a\b|remove\b|costume|clothes|pants|skirt|dress|hoodie|jacket|coat|shoes|sneakers|boots|glasses|beanie|cap|beard|mustache|facial|skin|accessory|accessories|palette)\b/i;

const MOTION_REGEX =
  /\b(jump|swing|walk|run|dance|wave|nod|shake|stretch|yawn|blink|faster|slower|higher|speed|timing|delay|ease|bounce|spin|fly|float|slide|turn|tilt|hop|step|clap|bow|celebrate|gait|tempo|beat|landing|pause|duration|playful)\b/i;

/**
 * Classify user prompt intent between appearance/scene edits and motion revisions.
 * For appearance words (shirt, color, hair, hat, outfit, body, face, background,
 * world, character, add a, remove), call character edit; otherwise call motion revise.
 * If ambiguous (both appearance and motion words present), returns "both".
 */
export function classifyInstructionIntent(
  instruction: string,
): "appearance" | "motion" | "both" {
  const hasAppearance = APPEARANCE_REGEX.test(instruction);
  const hasMotion = MOTION_REGEX.test(instruction);

  if (hasAppearance && hasMotion) return "both";
  if (hasAppearance) return "appearance";
  return "motion";
}

/**
 * Immutable update of a single track inside a MotionDocument.
 */
export function updateTrackInDocument(
  doc: MotionDocument,
  trackId: string,
  updates: Partial<MotionTrack>,
): MotionDocument {
  let changed = false;
  const tracks = doc.tracks.map((track) => {
    if (track.id !== trackId) return track;
    changed = true;
    return {
      ...track,
      ...updates,
      // If keyframes were not in updates, preserve existing
      keyframes: updates.keyframes ?? track.keyframes,
    };
  });

  if (!changed) return doc;
  return {
    ...doc,
    tracks,
  };
}

/**
 * Updates first and/or last keyframe values in an immutable keyframe list.
 */
export function updateKeyframeValues(
  keyframes: Keyframe[],
  firstVal?: KeyframeValue,
  lastVal?: KeyframeValue,
): Keyframe[] {
  if (!keyframes.length) return keyframes;
  const copy = keyframes.map((kf) => ({ ...kf }));

  if (firstVal !== undefined && firstVal !== null) {
    copy[0].value = firstVal;
  }
  if (lastVal !== undefined && lastVal !== null) {
    copy[copy.length - 1].value = lastVal;
  }

  return copy;
}

/**
 * Removes a track by id from a MotionDocument.
 */
export function deleteTrackFromDocument(
  doc: MotionDocument,
  trackId: string,
): MotionDocument {
  const tracks = doc.tracks.filter((t) => t.id !== trackId);
  if (tracks.length === doc.tracks.length) return doc;
  return {
    ...doc,
    tracks,
  };
}

export type UndoHistory<T> = {
  past: T[];
  present: T;
  future: T[];
};

export function createHistory<T>(initial: T): UndoHistory<T> {
  return {
    past: [],
    present: initial,
    future: [],
  };
}

export function pushHistory<T>(
  history: UndoHistory<T>,
  next: T,
  limit = 50,
): UndoHistory<T> {
  const past = [...history.past, history.present];
  if (past.length > limit) {
    past.splice(0, past.length - limit);
  }
  return {
    past,
    present: next,
    future: [],
  };
}

export function undoHistory<T>(history: UndoHistory<T>): UndoHistory<T> {
  if (history.past.length === 0) return history;
  const previous = history.past[history.past.length - 1];
  const newPast = history.past.slice(0, -1);
  return {
    past: newPast,
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redoHistory<T>(history: UndoHistory<T>): UndoHistory<T> {
  if (history.future.length === 0) return history;
  const next = history.future[0];
  const newFuture = history.future.slice(1);
  return {
    past: [...history.past, history.present],
    present: next,
    future: newFuture,
  };
}

/**
 * Authoritative Sofia starter project.
 * Uses buildSofiaScene() wrapped with studioScene(scene, 8000) and a valid manual starter motion document.
 * This starter is explicitly marked source: "manual", never fake AI.
 */
export function buildSofiaStarterProject(): AniProject {
  const scene = studioScene(buildSofiaScene(), 8000);
  // Deterministic starter timestamp: keeps /studio prerenderable.
  const now = "2026-10-31T00:00:00.000Z";

  const motion: MotionDocument = {
    version: 1,
    id: "sofia-baseline-starter",
    name: "Sofia — Baseline Racket Idle",
    targetKind: "character",
    duration: 8,
    fps: 60,
    loop: { enabled: true, mode: "restart" },
    tracks: [
      {
        id: "sofia-head-tilt",
        target: { kind: "character", actorId: "sofia", boneId: "head" },
        property: "rotate",
        keyframes: [
          { at: 0, value: 0, easing: "easeInOut" },
          { at: 0.25, value: 8, easing: "easeInOut" },
          { at: 0.5, value: 0, easing: "easeInOut" },
          { at: 0.75, value: -6, easing: "easeInOut" },
          { at: 1, value: 0, easing: "easeInOut" },
        ],
        delay: 0,
        duration: 8,
        label: "Head Tilt",
      },
      {
        id: "sofia-racket-swing",
        target: { kind: "character", actorId: "sofia", boneId: "armR" },
        property: "rotate",
        keyframes: [
          { at: 0, value: 0, easing: "easeInOut" },
          { at: 0.2, value: -30, easing: "easeInOut" },
          { at: 0.4, value: 45, easing: "easeInOut" },
          { at: 0.6, value: 0, easing: "easeInOut" },
          { at: 1, value: 0, easing: "easeInOut" },
        ],
        delay: 0,
        duration: 8,
        label: "Racket Arm Swing",
      },
      {
        id: "sofia-spine-sway",
        target: { kind: "character", actorId: "sofia", boneId: "spine" },
        property: "rotate",
        keyframes: [
          { at: 0, value: 0, easing: "easeInOut" },
          { at: 0.3, value: -4, easing: "easeInOut" },
          { at: 0.7, value: 4, easing: "easeInOut" },
          { at: 1, value: 0, easing: "easeInOut" },
        ],
        delay: 0,
        duration: 8,
        label: "Spine Sway",
      },
      {
        id: "sofia-root-bob",
        target: { kind: "character", actorId: "sofia", boneId: "root" },
        property: "translateY",
        keyframes: [
          { at: 0, value: 0, easing: "easeInOut" },
          { at: 0.25, value: -8, easing: "easeInOut" },
          { at: 0.5, value: 0, easing: "easeInOut" },
          { at: 0.75, value: -6, easing: "easeInOut" },
          { at: 1, value: 0, easing: "easeInOut" },
        ],
        delay: 0,
        duration: 8,
        label: "Root Bounce",
      },
    ],
    meta: {
      source: "manual",
      summary: "Authored baseline performance for Sofia",
      createdAt: now,
    },
  };

  return {
    schemaVersion: 1,
    id: "project-sofia-starter",
    name: "Sofia — Tennis",
    createdAt: now,
    updatedAt: now,
    styleId: "anitoon-storybook-v1",
    source: {
      kind: "character",
      scene,
    },
    motion,
    prompt:
      "A focused tennis player with a high ponytail for a sportswear brand. She swings, celebrates, and waves.",
  };
}

/**
 * Builds a starter project for an imported SVG.
 */
export function buildStarterSvgProject(
  graph: SceneGraph,
  sourceSvg: string,
  filename = "Imported SVG",
): AniProject {
  // Deterministic starter timestamp: keeps /studio prerenderable.
  const now = "2026-10-31T00:00:00.000Z";
  const firstAnimatable = graph.order[0] ?? graph.rootIds[0] ?? "root";

  const motion: MotionDocument = {
    version: 1,
    id: `svg-motion-${Date.now()}`,
    name: `${filename} — Starter Animation`,
    targetKind: "svg",
    duration: 4,
    fps: 60,
    loop: { enabled: true, mode: "restart" },
    tracks: [
      {
        id: `track-${firstAnimatable}-opacity`,
        target: { kind: "svg", elementId: firstAnimatable },
        property: "opacity",
        keyframes: [
          { at: 0, value: 0.7, easing: "easeInOut" },
          { at: 0.5, value: 1, easing: "easeInOut" },
          { at: 1, value: 0.7, easing: "easeInOut" },
        ],
        delay: 0,
        duration: 4,
        label: `Pulse ${firstAnimatable}`,
      },
    ],
    meta: {
      source: "manual",
      summary: "Starter opacity pulse",
      createdAt: now,
    },
  };

  return {
    schemaVersion: 1,
    id: `project-svg-${Date.now()}`,
    name: filename.replace(/\.svg$/i, ""),
    createdAt: now,
    updatedAt: now,
    styleId: "anitoon-storybook-v1",
    source: {
      kind: "svg",
      graph,
      sourceSvg,
      filename,
    },
    motion,
  };
}
