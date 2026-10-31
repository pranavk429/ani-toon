/**
 * Scene object geometry. Objects are stage-space props with a stable id. They
 * are intentionally separate from bones: a ball, a falling star or a flower
 * should be animatable even when no skeleton exists.
 */

import type { SceneObject, SceneObjectKind } from "./types";

export type ObjectFrame = {
  object: SceneObject;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  fill: string;
};

export const OBJECT_LABELS: Record<SceneObjectKind, string> = {
  ball: "ball",
  star: "star",
  plant: "plant",
  flower: "flower",
  cup: "cup",
  gift: "gift",
  heart: "heart",
  "watering-can": "watering can",
  pancake: "pancake",
  racket: "racket",
  sparkle: "sparkle",
  cloud: "cloud",
  orb: "orb",
  "flower-pot": "flower pot",
  rocket: "rocket",
  note: "music note",
};

export function baseObjectFrame(object: SceneObject): ObjectFrame {
  return {
    object,
    x: object.x,
    y: object.y,
    scale: object.scale ?? 1,
    rotation: object.rotation ?? 0,
    opacity: object.opacity ?? 1,
    fill: object.color,
  };
}

export function objectSortKey(object: SceneObject): number {
  return object.layer === "back" ? 0 : 2;
}

/** Rough visual radius used by tests and composition guides. */
export function objectRadius(kind: SceneObjectKind): number {
  switch (kind) {
    case "ball":
      return 28;
    case "star":
      return 34;
    case "plant":
      return 42;
    case "flower":
      return 30;
    case "cup":
      return 24;
    case "gift":
      return 28;
    case "heart":
      return 28;
    case "watering-can":
      return 40;
    case "pancake":
      return 30;
    case "racket":
      return 40;
    case "sparkle":
      return 20;
    case "cloud":
      return 52;
    case "orb":
      return 30;
    case "flower-pot":
      return 30;
    case "rocket":
      return 34;
    case "note":
      return 20;
  }
}
