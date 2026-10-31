/**
 * Deterministic SVG transform composition shared by the live DOM applicator
 * and the SMIL exporter.
 *
 * `Mat` is the SVG six-value affine matrix [a, b, c, d, e, f]:
 *
 *   | a c e |
 *   | b d f |
 *   | 0 0 1 |
 *
 * Rotation and scale are applied around a root-space pivot derived from the
 * scene-graph bounding box, so both the runtime and the exported SMIL agree.
 */

import type { Mat, SceneElement, SceneGraph } from "../svg/types";
import type { TransformOrigin } from "./types";

export type MotionTransformValues = {
  translateX: number;
  translateY: number;
  rotate: number;
  scaleX: number;
  scaleY: number;
  /** Additional translation from a motionPath track, in root user units. */
  motionX?: number;
  motionY?: number;
  /** Additional rotation from a motionPath tangent, in degrees. */
  motionAngle?: number;
};

export type PivotPoint = {
  x: number;
  y: number;
};

export const IDENTITY_MATRIX: Mat = [1, 0, 0, 1, 0, 0];

export function multiplyMatrix(a: Mat, b: Mat): Mat {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

export function translationMatrix(x: number, y: number): Mat {
  return [1, 0, 0, 1, x, y];
}

export function rotationMatrix(degrees: number): Mat {
  const radians = (degrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [cosine, sine, -sine, cosine, 0, 0];
}

export function scaleMatrix(sx: number, sy: number): Mat {
  return [sx, 0, 0, sy, 0, 0];
}

function invertMatrix(matrix: Mat): Mat | null {
  const [a, b, c, d, e, f] = matrix;
  const determinant = a * d - b * c;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) {
    return null;
  }
  return [
    d / determinant,
    -b / determinant,
    -c / determinant,
    a / determinant,
    (c * f - d * e) / determinant,
    (b * e - a * f) / determinant,
  ];
}

function safeNumber(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

export function transformPivot(
  element: SceneElement,
  origin: TransformOrigin = "center",
): PivotPoint {
  if (origin === "top-left") {
    return { x: element.bbox.x, y: element.bbox.y };
  }
  // `bone` is a mascot concept. SVG apply/export falls back to the bbox center.
  return {
    x: element.bbox.x + element.bbox.w / 2,
    y: element.bbox.y + element.bbox.h / 2,
  };
}

/** Product of all ancestor authored matrices, excluding this element. */
export function ancestorMatrix(
  graph: SceneGraph,
  element: SceneElement,
): Mat {
  const chain: SceneElement[] = [];
  const seen = new Set<string>([element.id]);
  let parentId = element.parentId;
  while (parentId && !seen.has(parentId)) {
    const parent = graph.elements[parentId];
    if (!parent) break;
    seen.add(parentId);
    chain.push(parent);
    parentId = parent.parentId;
  }
  chain.reverse();
  let matrix: Mat = IDENTITY_MATRIX;
  for (const ancestor of chain) {
    matrix = multiplyMatrix(matrix, ancestor.matrix);
  }
  return matrix;
}

/** Absolute authored matrix of an element, including roll-up of ancestors. */
export function absoluteElementMatrix(
  graph: SceneGraph,
  element: SceneElement,
): Mat {
  return multiplyMatrix(ancestorMatrix(graph, element), element.matrix);
}

/** Desired root-space animation transform around `pivot`. */
export function rootAnimationMatrix(
  pivot: PivotPoint,
  values: MotionTransformValues,
): Mat {
  const translateX =
    safeNumber(values.translateX, 0) + safeNumber(values.motionX ?? 0, 0);
  const translateY =
    safeNumber(values.translateY, 0) + safeNumber(values.motionY ?? 0, 0);
  const rotate =
    safeNumber(values.rotate, 0) + safeNumber(values.motionAngle ?? 0, 0);
  const scaleX = safeNumber(values.scaleX, 1);
  const scaleY = safeNumber(values.scaleY, 1);

  return multiplyMatrix(
    translationMatrix(translateX, translateY),
    multiplyMatrix(
      translationMatrix(pivot.x, pivot.y),
      multiplyMatrix(
        rotationMatrix(rotate),
        multiplyMatrix(
          scaleMatrix(scaleX, scaleY),
          translationMatrix(-pivot.x, -pivot.y),
        ),
      ),
    ),
  );
}

/**
 * Matrix for a `<g>` wrapper inserted around the target in the target's
 * parent coordinate space.
 */
export function wrapperAnimationMatrix(
  ancestor: Mat,
  pivot: PivotPoint,
  values: MotionTransformValues,
): Mat {
  const desired = rootAnimationMatrix(pivot, values);
  const inverse = invertMatrix(ancestor);
  if (!inverse) return desired;
  return multiplyMatrix(inverse, multiplyMatrix(desired, ancestor));
}

/**
 * Matrix appended to an element's authored transform attribute. The element's
 * absolute authored matrix L is conjugated so the animation happens in root
 * space while remaining a child-local transform attribute.
 */
export function elementAnimationMatrix(
  absolute: Mat,
  pivot: PivotPoint,
  values: MotionTransformValues,
): Mat {
  const desired = rootAnimationMatrix(pivot, values);
  const inverse = invertMatrix(absolute);
  if (!inverse) return desired;
  return multiplyMatrix(inverse, multiplyMatrix(desired, absolute));
}

export function composeElementAnimationMatrix(
  graph: SceneGraph,
  element: SceneElement,
  values: MotionTransformValues,
  origin: TransformOrigin = "center",
): Mat {
  return elementAnimationMatrix(
    absoluteElementMatrix(graph, element),
    transformPivot(element, origin),
    values,
  );
}

export function composeWrapperAnimationMatrix(
  graph: SceneGraph,
  element: SceneElement,
  values: MotionTransformValues,
  origin: TransformOrigin = "center",
): Mat {
  return wrapperAnimationMatrix(
    ancestorMatrix(graph, element),
    transformPivot(element, origin),
    values,
  );
}

export type SmilMatrixComponents = {
  translateX: number;
  translateY: number;
  rotate: number;
  skewX: number;
  scaleX: number;
  scaleY: number;
};

/**
 * Decompose an affine matrix into the component transforms SMIL can animate.
 *
 * Chromium does not apply `animateTransform type="matrix"` reliably, so the
 * exporter emits nested translate/rotate/skewX/scale groups instead. The
 * decomposition is M = T * R * SkewX * S.
 */
export function decomposeMatrixForSmil(matrix: Mat): SmilMatrixComponents {
  const [a, b, c, d, e, f] = matrix;
  const scaleX = Math.hypot(a, b);
  let rotate = 0;
  let skewX = 0;
  let scaleY = 0;

  const determinant = a * d - b * c;
  if (scaleX > 1e-9 && Math.abs(determinant) > 1e-9) {
    rotate = (Math.atan2(b, a) * 180) / Math.PI;
    const shear = (a * c + b * d) / determinant;
    skewX = (Math.atan(shear) * 180) / Math.PI;
    scaleY = determinant / scaleX;
  } else {
    // Degenerate x-axis (zero scale). Keep the y-axis scale so the element can
    // still collapse to a line, and fall back to no rotation/skew.
    scaleY = Math.hypot(c, d);
  }

  return {
    translateX: Number.isFinite(e) ? e : 0,
    translateY: Number.isFinite(f) ? f : 0,
    rotate: Number.isFinite(rotate) ? rotate : 0,
    skewX: Number.isFinite(skewX) ? skewX : 0,
    scaleX: Number.isFinite(scaleX) ? scaleX : 1,
    scaleY: Number.isFinite(scaleY) ? scaleY : 1,
  };
}

/** SVG transform string for one static component. */
export function componentTransformString(
  type: "translate" | "rotate" | "skewX" | "scale",
  values: SmilMatrixComponents,
  precision = 6,
): string {
  switch (type) {
    case "translate":
      return `translate(${formatNumber(values.translateX, precision)} ${formatNumber(values.translateY, precision)})`;
    case "rotate":
      return `rotate(${formatNumber(values.rotate, precision)})`;
    case "skewX":
      return `skewX(${formatNumber(values.skewX, precision)})`;
    case "scale":
      return `scale(${formatNumber(values.scaleX, precision)} ${formatNumber(values.scaleY, precision)})`;
  }
}

/** Values list for one SMIL component animation. */
export function componentValuesString(
  type: "translate" | "rotate" | "skewX" | "scale",
  samples: readonly SmilMatrixComponents[],
  precision = 6,
): string {
  return samples
    .map((values) => {
      switch (type) {
        case "translate":
          return `${formatNumber(values.translateX, precision)} ${formatNumber(values.translateY, precision)}`;
        case "rotate":
          return formatNumber(values.rotate, precision);
        case "skewX":
          return formatNumber(values.skewX, precision);
        case "scale":
          return `${formatNumber(values.scaleX, precision)} ${formatNumber(values.scaleY, precision)}`;
      }
    })
    .join(";");
}

function round(value: number, precision: number): number {
  const factor = 10 ** precision;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function formatNumber(value: number, precision = 6): string {
  if (!Number.isFinite(value)) return "0";
  return String(round(value, precision));
}

/** Deterministic `matrix(a b c d e f)` string. */
export function formatMatrix(matrix: Mat, precision = 6): string {
  const values = matrix.map((value) => formatNumber(value, precision));
  return `matrix(${values.join(" ")})`;
}

/** CSS/SVG transform string appended after an authored transform. */
export function composeTransformAttribute(
  authored: string | null | undefined,
  matrix: Mat,
  precision = 6,
): string {
  const base = authored && authored.trim().length > 0 ? authored.trim() : "";
  const animation = formatMatrix(matrix, precision);
  return base.length > 0 ? `${base} ${animation}` : animation;
}
