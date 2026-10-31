/**
 * Shared SVG scene-graph contract.
 *
 * This file is frozen by the orchestrator. Specialists import these types; they
 * must not redefine them. Objective geometry and inferred semantics are kept in
 * separate fields on purpose.
 */

export const SCENE_GRAPH_VERSION = 1 as const;

/** SVG affine matrix: [a, b, c, d, e, f]. */
export type Mat = [number, number, number, number, number, number];

export type BBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ViewBox = {
  minX: number;
  minY: number;
  width: number;
  height: number;
};

export const SUPPORTED_SVG_TAGS = [
  "svg",
  "g",
  "defs",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
  "linearGradient",
  "radialGradient",
  "stop",
  "clipPath",
] as const;

export type SupportedSvgTag = (typeof SUPPORTED_SVG_TAGS)[number];

/** Tags that can be addressed by an animation track. */
export const ANIMATABLE_SVG_TAGS = [
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
] as const;

export type AnimatableSvgTag = (typeof ANIMATABLE_SVG_TAGS)[number];

export type SceneStyle = {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  fillOpacity?: number;
  strokeOpacity?: number;
  strokeLinecap?: string;
  strokeLinejoin?: string;
  strokeDasharray?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  textAnchor?: string;
  dominantBaseline?: string;
  letterSpacing?: number;
};

export type AnimatableProperties = {
  transform: boolean;
  opacity: boolean;
  fill: boolean;
  stroke: boolean;
  strokeWidth: boolean;
  strokeDraw: boolean;
  motionPath: boolean;
};

/**
 * Semantic metadata is inferred. It must never be presented as objective
 * geometry. `source` records how the label was obtained.
 */
export type SemanticInfo = {
  label?: string;
  role?: string;
  tags: string[];
  confidence: number;
  source: "authored" | "heuristic" | "ai";
};

export type SceneElement = {
  /** Stable, unique, animation-safe ID. May differ from the authored ID. */
  id: string;
  /** Original authored ID before duplicate resolution. */
  originalId?: string;
  tag: AnimatableSvgTag | "defs" | "linearGradient" | "radialGradient" | "stop" | "clipPath" | "tspan" | "svg";
  /** Human-facing name from aria-label, data-name, title or ID. */
  name?: string;
  parentId: string | null;
  childIds: string[];
  /** 0 for top-level children of <svg>. */
  depth: number;
  /** Pre-order position in document order. */
  order: number;
  /** Absolute bounding box in root user coordinates. */
  bbox: BBox;
  /** Bounding box in this element's own pre-transform coordinate space. */
  localBBox: BBox;
  /** Center of `bbox` in root coordinates. */
  center: { x: number; y: number };
  /** Authored transform attribute, preserved verbatim after sanitization. */
  transform: string;
  /** Parsed author transform, identity when absent or unparseable. */
  matrix: Mat;
  style: SceneStyle;
  /** Style after inheriting presentation attributes from ancestors. */
  computedStyle: SceneStyle;
  animatable: AnimatableProperties;
  semantic: SemanticInfo;
  text?: string;
  /** Safe authored hints useful to the Director. */
  hints: Record<string, string>;
  /** Excluded from AI context (defs, gradients, clipping geometry). */
  isDefinition: boolean;
};

export type SceneGraphStats = {
  bytes: number;
  elementCount: number;
  animatableCount: number;
  groupCount: number;
  removedNodeCount: number;
  duplicateIdCount: number;
  durationMs: number;
};

export type SceneGraph = {
  version: typeof SCENE_GRAPH_VERSION;
  assetId: string;
  filename?: string;
  title?: string;
  viewBox: ViewBox;
  width: number;
  height: number;
  rootIds: string[];
  elements: Record<string, SceneElement>;
  /** Pre-order traversal of animatable elements. */
  order: string[];
  /** Sanitized SVG serialization. Safe to render after this contract. */
  sanitizedSvg: string;
  warnings: string[];
  stats: SceneGraphStats;
};

export type SceneElementContext = {
  id: string;
  name?: string;
  tag: SceneElement["tag"];
  parentId: string | null;
  childCount: number;
  bbox: BBox;
  role?: string;
  tags?: string[];
  text?: string;
  animated: boolean;
  selected?: boolean;
};

/** Compact context sent to the AI Director. */
export type SceneContext = {
  assetId: string;
  filename?: string;
  viewBox: ViewBox;
  elementCount: number;
  animatableCount: number;
  truncated: boolean;
  elements: SceneElementContext[];
};

export type ImportOptions = {
  filename?: string;
  maxBytes?: number;
  maxElements?: number;
  maxDepth?: number;
};

export type ImportSuccess = {
  ok: true;
  graph: SceneGraph;
};

export type ImportFailure = {
  ok: false;
  error: {
    code:
      | "empty"
      | "too_large"
      | "invalid_xml"
      | "not_svg"
      | "too_many_elements"
      | "too_deep"
      | "unsafe_markup"
      | "no_animatable_elements";
    message: string;
  };
  warnings: string[];
};

export type ImportResult = ImportSuccess | ImportFailure;
