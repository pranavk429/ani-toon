/**
 * Stable track-level document diff used by conversational revisions.
 */

import type {
  Easing,
  Keyframe,
  MotionDocument,
  MotionTrack,
} from "./types";
import { expandMotionDocument } from "./validate";
import { defaultTransformOrigin, motionTargetKey } from "./targets";

export type MotionTrackChangeSet = {
  added: string[];
  removed: string[];
  modified: string[];
  unchanged: string[];
};

function canonicalEasing(easing: Easing | undefined): string {
  if (easing === undefined) return "";
  if (typeof easing === "string") return easing;
  if (easing.type === "cubicBezier") {
    return `cubicBezier:${easing.x1},${easing.y1},${easing.x2},${easing.y2}`;
  }
  return `spring:${easing.stiffness},${easing.damping},${easing.mass ?? 1}`;
}

function canonicalKeyframe(
  keyframe: Keyframe,
  fallbackEasing: Easing,
): string {
  return JSON.stringify({
    at: keyframe.at,
    value: keyframe.value,
    easing: canonicalEasing(keyframe.easing ?? fallbackEasing),
  });
}

function canonicalTrack(
  doc: MotionDocument,
  track: MotionTrack,
): string {
  const delay = track.delay ?? 0;
  const duration =
    track.duration ?? Math.max(0, doc.duration - delay);
  const easing = track.easing ?? "easeInOut";
  return JSON.stringify({
    id: track.id,
    target: motionTargetKey(track.target),
    property: track.property,
    delay,
    duration,
    easing: canonicalEasing(easing),
    path: track.path ?? null,
    orient:
      track.property === "motionPath" ? (track.orient ?? true) : null,
    origin: track.origin ?? defaultTransformOrigin(track.target),
    label: track.label ?? null,
    muted: track.muted ?? false,
    keyframes: track.keyframes.map((keyframe) =>
      canonicalKeyframe(keyframe, easing),
    ),
  });
}

/**
 * Compare two documents by track id. Groups are expanded first so authoring
 * convenience groups do not appear as changes when only their spelling differs.
 */
export function diffMotionDocuments(
  previous: MotionDocument,
  next: MotionDocument,
): MotionTrackChangeSet {
  const before = expandMotionDocument(previous).tracks;
  const after = expandMotionDocument(next).tracks;
  const beforeById = new Map(before.map((track) => [track.id, track]));
  const afterById = new Map(after.map((track) => [track.id, track]));

  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];
  const unchanged: string[] = [];

  for (const track of after) {
    const previousTrack = beforeById.get(track.id);
    if (!previousTrack) {
      added.push(track.id);
    } else if (
      canonicalTrack(previous, previousTrack) !==
      canonicalTrack(next, track)
    ) {
      modified.push(track.id);
    } else {
      unchanged.push(track.id);
    }
  }
  for (const track of before) {
    if (!afterById.has(track.id)) removed.push(track.id);
  }

  return { added, removed, modified, unchanged };
}
