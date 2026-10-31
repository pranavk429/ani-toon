/**
 * Target identity helpers shared by validation, evaluation, revisions and the
 * character adapter.
 *
 * A target key is stable for the lifetime of a document:
 * - SVG:      "svg:<elementId>"
 * - bone:     "character:<actorId>:<boneId>"
 * - object:   "object:<objectId>"
 */

import type {
  BoneTargetContext,
  MotionDocument,
  MotionTarget,
  MotionTrack,
  ValidationContext,
} from "./types";

export function boneKey(actorId: string, boneId: string): string {
  return `${actorId}:${boneId}`;
}

/** Default rotation/scale origin for a target kind. */
export function defaultTransformOrigin(
  target: MotionTarget,
): "center" | "bone" {
  return target.kind === "character" ? "bone" : "center";
}

export function splitBoneKey(key: string): { actorId: string; boneId: string } {
  const index = key.indexOf(":");
  if (index <= 0 || index === key.length - 1) {
    return { actorId: "", boneId: key };
  }
  return { actorId: key.slice(0, index), boneId: key.slice(index + 1) };
}

/**
 * Evaluation key for a target.
 *
 * SVG element IDs and object IDs stay unprefixed because the SVG apply/export
 * path addresses DOM elements by exactly this key. Character bones include the
 * actor so a multi-character scene cannot collide. Document kind disambiguates
 * an object ID from an SVG ID.
 */
export function motionTargetKey(target: MotionTarget): string {
  switch (target.kind) {
    case "svg":
      return target.elementId;
    case "character":
      return boneKey(target.actorId, target.boneId);
    case "object":
      return target.objectId;
  }
}

/** Short human-readable target label used by the timeline. */
export function motionTargetLabel(target: MotionTarget): string {
  switch (target.kind) {
    case "svg":
      return target.elementId;
    case "character":
      return `${target.actorId}.${target.boneId}`;
    case "object":
      return target.objectId;
  }
}

/** Pair key for conflict diagnostics. Targets of different kinds never collide. */
export function motionPairKey(
  target: MotionTarget,
  property: MotionTrack["property"],
): string {
  return `${target.kind}:${motionTargetKey(target)}:${property}`;
}

export function toIdSet(
  value: ReadonlySet<string> | readonly string[] | undefined,
): ReadonlySet<string> | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return new Set(value);
  const maybeSet = value as ReadonlySet<string>;
  if (typeof maybeSet.has === "function") return maybeSet;
  return new Set(value as readonly string[]);
}

/** All accepted bone keys from either the legacy list or the rich context. */
export function boneTargetSet(context: ValidationContext): ReadonlySet<string> | undefined {
  const keys = new Set<string>();
  const legacy = toIdSet(context.boneIds);
  if (legacy) for (const key of legacy) keys.add(key);
  for (const bone of context.bones ?? []) keys.add(boneKey(bone.actorId, bone.boneId));
  return keys.size > 0 ? keys : undefined;
}

export function boneContextByKey(
  context: ValidationContext,
): ReadonlyMap<string, BoneTargetContext> {
  const map = new Map<string, BoneTargetContext>();
  for (const bone of context.bones ?? []) {
    map.set(boneKey(bone.actorId, bone.boneId), bone);
  }
  return map;
}

export function documentTargetIds(document: MotionDocument): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const track of document.tracks) {
    const key = motionTargetKey(track.target);
    if (!seen.has(key)) {
      seen.add(key);
      ids.push(key);
    }
  }
  return ids;
}
