/**
 * Revision diffing and unrelated-track preservation.
 *
 * The model is told to return the full document, but prompts are not a
 * security boundary. This guard restores previously validated tracks that the
 * model dropped when they are not related to the new instruction.
 *
 * Behaviour:
 * - If the new document's meta.summary says "replace all", no restoration.
 * - Restoration is by track id only. If the id exists in the new document,
 *   the model's version wins. If the id is absent, the old track is restored
 *   unless its target/property is invalid or it would exceed the 8s limit.
 *   Same (target, property) pairs are legal and compose deterministically, so
 *   a new track targeting the same pair must not suppress the old track.
 * - When a restored track overlaps in time with a new track on the same
 *   target/property, a note is added because the values compose at runtime.
 * - The document duration is extended up to 8s when a restored track would
 *   otherwise fall outside it.
 */

import {
  CHARACTER_PROPERTIES,
  SVG_PROPERTIES,
  type MotionDocument,
  type MotionProperty,
  type MotionTrack,
} from "@/lib/animation/types";
import { motionPairKey, motionTargetKey } from "@/lib/animation/targets";
import type { TrackChangeSet } from "./contracts";
import { MAX_DIRECTED_DURATION } from "./request";

export type MergeRevisionResult = {
  document: MotionDocument;
  notes: string[];
  restoredTrackIds: string[];
  skippedTrackIds: string[];
};

export function trackPairKey(track: MotionTrack): string {
  return motionPairKey(track.target, track.property);
}

function trackWindow(
  track: MotionTrack,
  documentDuration: number,
): { start: number; end: number } {
  const start = Math.max(0, track.delay ?? 0);
  const duration = track.duration ?? Math.max(0, documentDuration - start);
  return { start, end: start + duration };
}

function windowsOverlap(
  a: { start: number; end: number },
  b: { start: number; end: number },
): boolean {
  return a.start < b.end - 1e-6 && b.start < a.end - 1e-6;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      result[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return result;
  }
  return value;
}

function trackSignature(track: MotionTrack): string {
  return JSON.stringify(canonicalize(track));
}

export function diffTracks(
  previous: readonly MotionTrack[],
  next: readonly MotionTrack[],
): TrackChangeSet {
  const oldById = new Map(previous.map((track) => [track.id, track]));
  const newById = new Map(next.map((track) => [track.id, track]));
  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];
  const unchanged: string[] = [];

  for (const track of next) {
    const old = oldById.get(track.id);
    if (!old) {
      added.push(track.id);
    } else if (trackSignature(old) === trackSignature(track)) {
      unchanged.push(track.id);
    } else {
      modified.push(track.id);
    }
  }
  for (const track of previous) {
    if (!newById.has(track.id)) removed.push(track.id);
  }

  return { added, removed, modified, unchanged };
}

export function mergeRevision(
  current: MotionDocument,
  next: MotionDocument,
  options: { allowedTargetIds?: ReadonlySet<string> } = {},
): MergeRevisionResult {
  const notes: string[] = [];
  const nextSummary = next.meta?.summary ?? "";
  if (
    /\breplace all\b|\bstart over\b|\bfrom scratch\b|\bfull regeneration\b/i.test(
      nextSummary,
    )
  ) {
    return {
      document: next,
      notes: [
        "Revision summary requested a full replacement; unrelated tracks were not restored.",
      ],
      restoredTrackIds: [],
      skippedTrackIds: [],
    };
  }

  const nextIds = new Set(next.tracks.map((track) => track.id));
  const nextByPair = new Map<string, MotionTrack[]>();
  for (const track of next.tracks) {
    const pair = trackPairKey(track);
    const existing = nextByPair.get(pair);
    if (existing) existing.push(track);
    else nextByPair.set(pair, [track]);
  }

  const allowedProperties = new Set<MotionProperty>(
    next.targetKind === "svg" ? SVG_PROPERTIES : CHARACTER_PROPERTIES,
  );
  const restored: MotionTrack[] = [];
  const restoredTrackIds: string[] = [];
  const skippedTrackIds: string[] = [];
  let duration = next.duration;

  for (const track of current.tracks) {
    if (nextIds.has(track.id)) continue;
    if (!allowedProperties.has(track.property)) {
      skippedTrackIds.push(track.id);
      continue;
    }
    const targetKey = motionTargetKey(track.target);
    if (options.allowedTargetIds && !options.allowedTargetIds.has(targetKey)) {
      // In case bone key was checked with single boneId instead of actorId:boneId
      const secondaryKey =
        track.target.kind === "character" ? track.target.boneId : undefined;
      if (!secondaryKey || !options.allowedTargetIds.has(secondaryKey)) {
        skippedTrackIds.push(track.id);
        continue;
      }
    }

    const window = trackWindow(track, current.duration);
    if (window.end > MAX_DIRECTED_DURATION + 1e-6) {
      skippedTrackIds.push(track.id);
      continue;
    }
    if (window.end > duration + 1e-6) {
      duration = Math.min(MAX_DIRECTED_DURATION, window.end);
    }

    const overlapping = (nextByPair.get(trackPairKey(track)) ?? []).filter((other) =>
      windowsOverlap(window, trackWindow(other, next.duration)),
    );
    if (overlapping.length > 0) {
      const listed = overlapping
        .slice(0, 4)
        .map((other) => `"${other.id}"`)
        .join(", ");
      notes.push(
        `Restored "${track.id}" overlaps ${listed}${
          overlapping.length > 4 ? ", …" : ""
        } on ${trackPairKey(track)}; same-property tracks compose deterministically.`,
      );
    }

    restored.push({
      ...track,
      target: { ...track.target },
      keyframes: track.keyframes.map((keyframe) => ({ ...keyframe })),
    });
    restoredTrackIds.push(track.id);
  }

  if (restoredTrackIds.length > 0) {
    notes.push(
      `Preserved ${restoredTrackIds.length} unrelated track(s): ${restoredTrackIds.join(", ")}.`,
    );
  }
  if (skippedTrackIds.length > 0) {
    notes.push(
      `Skipped ${skippedTrackIds.length} stale or out-of-range track(s): ${skippedTrackIds.join(", ")}.`,
    );
  }

  return {
    document: {
      ...next,
      duration,
      tracks: [...next.tracks, ...restored],
    },
    notes,
    restoredTrackIds,
    skippedTrackIds,
  };
}
