/**
 * Frozen shared product contracts (ANI studio v1).
 *
 * MotionPlan is the generic Motion DSL document (see src/lib/animation/types).
 * AssetGraph is the sanitized SVG scene graph (see src/lib/svg/types).
 * CharacterGenome wraps the creature genome with persistent identity fields.
 * AniProject is the canonical lossless project format.
 */

import type { MotionDocument } from "@/lib/animation/types";
import type { SceneGraph } from "@/lib/svg/types";
import type { Genome, Skeleton } from "@/creature/types";
import type { Scene } from "@/creature/types";

export const PROJECT_SCHEMA_VERSION = 1 as const;
export const ILLUSTRATION_STYLE_ID = "anitoon-storybook-v1";

export type IllustrationStyle = {
  id: string;
  version: number;
  name: string;
  palette: {
    paper: string;
    ink: string;
    skin: string[];
    garment: string[];
    accent: string[];
    shadow: string;
  };
  proportions: {
    headScale: [number, number];
    torsoScale: [number, number];
    limbWidthScale: [number, number];
    eyeSize: [number, number];
    eyeSpacing: [number, number];
    limbRoundness: number;
  };
  face: {
    eyes: "large-oval";
    pupil: "dark-oval";
    highlight: "single-white-dot";
    nose: "small-rounded";
    mouth: "simple-curve";
  };
  shapeLanguage: {
    cornerRadius: "rounded";
    outlines: "none";
    shading: "flat-cel";
    detailBudget: "low";
  };
  background: {
    horizon: true;
    gradients: false;
    texture: "flat";
  };
};

export const ILLUSTRATION_STYLE: IllustrationStyle = {
  id: ILLUSTRATION_STYLE_ID,
  version: 1,
  name: "Anitoon Storybook",
  palette: {
    paper: "#FEFDF9",
    ink: "#2B2420",
    skin: ["#F3C9A3", "#E8B48C", "#C98B63", "#8D5A3B", "#F7D9BE"],
    garment: ["#4A8FD4", "#E8564E", "#6FAF6B", "#F2B35E", "#8C6AD6", "#E88BA8"],
    accent: ["#FFD45E", "#5BA7C9", "#F05A74", "#8FD8FF"],
    shadow: "#2B242026",
  },
  proportions: {
    headScale: [0.9, 1.45],
    torsoScale: [0.8, 1.35],
    limbWidthScale: [1.0, 1.45],
    eyeSize: [1.05, 1.4],
    eyeSpacing: [0.95, 1.35],
    limbRoundness: 1,
  },
  face: {
    eyes: "large-oval",
    pupil: "dark-oval",
    highlight: "single-white-dot",
    nose: "small-rounded",
    mouth: "simple-curve",
  },
  shapeLanguage: {
    cornerRadius: "rounded",
    outlines: "none",
    shading: "flat-cel",
    detailBudget: "low",
  },
  background: { horizon: true, gradients: false, texture: "flat" },
};

/** A persistent character identity. Changing motion never mutates this. */
export type CharacterGenome = {
  schemaVersion: 1;
  styleId: string;
  seed: number;
  genome: Genome;
};

/** The skeletal contract generated from a genome. */
export type RigDefinition = {
  schemaVersion: 1;
  root: string;
  skeleton: Skeleton;
  boneCount: number;
};

export type AssetGraph = SceneGraph;
export type MotionPlan = MotionDocument;

export type AniProjectSource =
  | { kind: "character"; scene: Scene }
  | {
      kind: "svg";
      graph: SceneGraph;
      sourceSvg: string;
      filename?: string;
    };

export type AniProject = {
  schemaVersion: typeof PROJECT_SCHEMA_VERSION;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  styleId: string;
  source: AniProjectSource;
  motion: MotionDocument;
  /** Original prompt, kept for project reopening and auditability. */
  prompt?: string;
  /** Small data URL preview for the project list. */
  thumbnail?: string;
};

export type ProjectSummary = {
  id: string;
  name: string;
  updatedAt: string;
  sourceKind: AniProjectSource["kind"];
  thumbnail?: string;
};
