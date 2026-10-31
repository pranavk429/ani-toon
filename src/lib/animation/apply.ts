/**
 * Apply one evaluated Motion DSL frame to a sanitized SVG DOM.
 *
 * This module only mutates attributes and inline presentation properties. It
 * never parses or executes SVG content. Authored transforms, paints and dash
 * settings are snapshotted the first time a property is animated and restored
 * when that target/property stops being animated.
 */

import type { SceneElement, SceneGraph } from "../svg/types";
import type {
  EvaluatedState,
  EvaluatedTarget,
  MotionProperty,
  TransformOrigin,
} from "./types";
import {
  EVALUATED_TARGET_META,
  type EvaluatedTargetWithMeta,
} from "./evaluate";
import {
  composeElementAnimationMatrix,
  composeTransformAttribute,
  type MotionTransformValues,
} from "./transform";

const PATH_LIKE_TAGS: ReadonlySet<string> = new Set([
  "path",
  "line",
  "polyline",
  "polygon",
  "circle",
  "ellipse",
  "rect",
]);

const TRANSFORM_PROPERTIES: ReadonlySet<MotionProperty> = new Set([
  "translateX",
  "translateY",
  "rotate",
  "scale",
  "scaleX",
  "scaleY",
  "motionPath",
]);

type PropertyKey =
  | "transform"
  | "opacity"
  | "fill"
  | "stroke"
  | "strokeWidth"
  | "strokeDraw";

type SavedStyle = {
  value: string;
  priority: string;
};

type TrackedElement = {
  element: Element;
  attributes: Map<string, string | null>;
  styles: Map<string, SavedStyle>;
  applied: Set<PropertyKey>;
};

type RootBookkeeping = Map<string, TrackedElement>;

const ROOT_BOOKKEEPING = new WeakMap<SVGSVGElement, RootBookkeeping>();

type StyleLike = {
  getPropertyValue(name: string): string;
  getPropertyPriority(name: string): string;
  setProperty(name: string, value: string, priority?: string): void;
  removeProperty(name: string): string;
};

function styleOf(element: Element): StyleLike | null {
  const maybe = (element as unknown as { style?: Partial<StyleLike> }).style;
  if (
    maybe &&
    typeof maybe.getPropertyValue === "function" &&
    typeof maybe.setProperty === "function"
  ) {
    return maybe as StyleLike;
  }
  return null;
}

function findElement(
  root: SVGSVGElement,
  scene: SceneElement,
): Element | null {
  const id = scene.id;
  const originalId = scene.originalId;
  try {
    if (root.getAttribute("id") === id) return root;
    const all = root.getElementsByTagName("*");
    let fallback: Element | null = null;
    for (let i = 0; i < all.length; i++) {
      const element = all[i];
      const elementId = element.getAttribute("id");
      if (elementId === id) return element;
      if (!fallback && originalId && elementId === originalId) {
        fallback = element;
      }
    }
    return fallback;
  } catch {
    return null;
  }
}

function ensureAttribute(
  tracked: TrackedElement,
  name: string,
): void {
  if (!tracked.attributes.has(name)) {
    tracked.attributes.set(name, tracked.element.getAttribute(name));
  }
}

function setAttribute(
  tracked: TrackedElement,
  name: string,
  value: string,
): void {
  ensureAttribute(tracked, name);
  tracked.element.setAttribute(name, value);
}

function restoreAttribute(
  tracked: TrackedElement,
  name: string,
): void {
  if (!tracked.attributes.has(name)) return;
  const original = tracked.attributes.get(name) ?? null;
  if (original === null) tracked.element.removeAttribute(name);
  else tracked.element.setAttribute(name, original);
  tracked.attributes.delete(name);
}

function setStyle(
  tracked: TrackedElement,
  name: string,
  value: string,
): void {
  const style = styleOf(tracked.element);
  if (!style) return;
  if (!tracked.styles.has(name)) {
    tracked.styles.set(name, {
      value: style.getPropertyValue(name),
      priority:
        typeof style.getPropertyPriority === "function"
          ? style.getPropertyPriority(name)
          : "",
    });
  }
  style.setProperty(name, value, "important");
}

function restoreStyle(
  tracked: TrackedElement,
  name: string,
): void {
  if (!tracked.styles.has(name)) return;
  const style = styleOf(tracked.element);
  const original = tracked.styles.get(name) as SavedStyle;
  if (style) {
    if (original.value.length === 0) style.removeProperty(name);
    else style.setProperty(name, original.value, original.priority);
  }
  tracked.styles.delete(name);
}

function setPresentation(
  tracked: TrackedElement,
  attributeName: string,
  cssName: string,
  value: string,
): void {
  setAttribute(tracked, attributeName, value);
  setStyle(tracked, cssName, value);
}

function restorePresentation(
  tracked: TrackedElement,
  attributeName: string,
  cssName: string,
): void {
  restoreAttribute(tracked, attributeName);
  restoreStyle(tracked, cssName);
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 1e5) / 1e5;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function restoreProperty(
  tracked: TrackedElement,
  property: PropertyKey,
): void {
  switch (property) {
    case "transform":
      restoreAttribute(tracked, "transform");
      break;
    case "opacity":
      restorePresentation(tracked, "opacity", "opacity");
      break;
    case "fill":
      restorePresentation(tracked, "fill", "fill");
      break;
    case "stroke":
      restorePresentation(tracked, "stroke", "stroke");
      break;
    case "strokeWidth":
      restorePresentation(tracked, "stroke-width", "stroke-width");
      break;
    case "strokeDraw":
      restoreAttribute(tracked, "pathLength");
      restorePresentation(tracked, "stroke-dasharray", "stroke-dasharray");
      restorePresentation(tracked, "stroke-dashoffset", "stroke-dashoffset");
      break;
    default:
      break;
  }
  tracked.applied.delete(property);
}

function restoreAll(tracked: TrackedElement): void {
  for (const property of [...tracked.applied]) {
    restoreProperty(tracked, property);
  }
  tracked.applied.clear();
}

function isPathLike(element: Element): boolean {
  return PATH_LIKE_TAGS.has(element.tagName.toLowerCase());
}

function requestedProperties(
  target: EvaluatedTarget,
): {
  transform: boolean;
  opacity: boolean;
  fill: boolean;
  stroke: boolean;
  strokeWidth: boolean;
  strokeDraw: boolean;
} {
  const meta = (target as EvaluatedTargetWithMeta)[EVALUATED_TARGET_META];
  if (meta) {
    const properties = meta.properties;
    let transform = false;
    for (const property of properties) {
      if (TRANSFORM_PROPERTIES.has(property)) {
        transform = true;
        break;
      }
    }
    return {
      transform,
      opacity: properties.has("opacity"),
      fill: properties.has("fill") && typeof target.fill === "string",
      stroke: properties.has("stroke") && typeof target.stroke === "string",
      strokeWidth:
        properties.has("strokeWidth") &&
        typeof target.strokeWidth === "number",
      strokeDraw:
        properties.has("strokeDraw") &&
        typeof target.strokeDraw === "number",
    };
  }

  // Hand-built states do not carry metadata. Apply a transform only when a
  // non-identity transform value is present, and only override present paints.
  const hasTransform =
    target.translateX !== 0 ||
    target.translateY !== 0 ||
    target.rotate !== 0 ||
    target.scaleX !== 1 ||
    target.scaleY !== 1 ||
    target.motionPath !== undefined;
  return {
    transform: hasTransform,
    opacity: target.opacity !== 1,
    fill: typeof target.fill === "string",
    stroke: typeof target.stroke === "string",
    strokeWidth: typeof target.strokeWidth === "number",
    strokeDraw: typeof target.strokeDraw === "number",
  };
}

function transformValues(target: EvaluatedTarget): MotionTransformValues {
  return {
    translateX: target.translateX,
    translateY: target.translateY,
    rotate: target.rotate,
    scaleX: target.scaleX,
    scaleY: target.scaleY,
    motionX: target.motionPath?.x ?? 0,
    motionY: target.motionPath?.y ?? 0,
    motionAngle: target.motionPath?.angle ?? 0,
  };
}

function applyTarget(
  tracked: TrackedElement,
  scene: SceneElement,
  graph: SceneGraph,
  target: EvaluatedTarget,
): void {
  const meta = (target as EvaluatedTargetWithMeta)[EVALUATED_TARGET_META];
  const origin: TransformOrigin = meta?.origin ?? "center";
  const wanted = requestedProperties(target);

  if (wanted.transform) {
    const matrix = composeElementAnimationMatrix(
      graph,
      scene,
      transformValues(target),
      origin,
    );
    ensureAttribute(tracked, "transform");
    const authored = tracked.attributes.get("transform") ?? null;
    tracked.element.setAttribute(
      "transform",
      composeTransformAttribute(authored, matrix),
    );
    tracked.applied.add("transform");
  } else {
    restoreProperty(tracked, "transform");
  }

  if (wanted.opacity) {
    setPresentation(
      tracked,
      "opacity",
      "opacity",
      formatNumber(target.opacity),
    );
    tracked.applied.add("opacity");
  } else {
    restoreProperty(tracked, "opacity");
  }

  if (wanted.fill && typeof target.fill === "string") {
    setPresentation(tracked, "fill", "fill", target.fill);
    tracked.applied.add("fill");
  } else {
    restoreProperty(tracked, "fill");
  }

  if (wanted.stroke && typeof target.stroke === "string") {
    setPresentation(tracked, "stroke", "stroke", target.stroke);
    tracked.applied.add("stroke");
  } else {
    restoreProperty(tracked, "stroke");
  }

  if (wanted.strokeWidth && typeof target.strokeWidth === "number") {
    setPresentation(
      tracked,
      "stroke-width",
      "stroke-width",
      formatNumber(target.strokeWidth),
    );
    tracked.applied.add("strokeWidth");
  } else {
    restoreProperty(tracked, "strokeWidth");
  }

  if (
    wanted.strokeDraw &&
    typeof target.strokeDraw === "number" &&
    isPathLike(tracked.element)
  ) {
    setAttribute(tracked, "pathLength", "1");
    setPresentation(tracked, "stroke-dasharray", "stroke-dasharray", "1 1");
    setPresentation(
      tracked,
      "stroke-dashoffset",
      "stroke-dashoffset",
      formatNumber(1 - target.strokeDraw),
    );
    tracked.applied.add("strokeDraw");
  } else {
    restoreProperty(tracked, "strokeDraw");
  }
}

/**
 * Apply a deterministic evaluated state to a sanitized SVG root.
 * Missing DOM nodes are ignored.
 */
export function applySvgEvaluation(
  root: SVGSVGElement,
  graph: SceneGraph,
  state: EvaluatedState,
): void {
  if (!root) return;
  let bookkeeping = ROOT_BOOKKEEPING.get(root);
  if (!bookkeeping) {
    bookkeeping = new Map();
    ROOT_BOOKKEEPING.set(root, bookkeeping);
  }

  const activeIds = new Set(Object.keys(state.targets));
  // Restore targets that are no longer present in the evaluated state.
  for (const [id, tracked] of [...bookkeeping]) {
    if (!activeIds.has(id)) {
      restoreAll(tracked);
      bookkeeping.delete(id);
    }
  }

  for (const [id, target] of Object.entries(state.targets)) {
    const scene = graph.elements[id];
    if (!scene) {
      const stale = bookkeeping.get(id);
      if (stale) {
        restoreAll(stale);
        bookkeeping.delete(id);
      }
      continue;
    }

    let tracked = bookkeeping.get(id);
    let element: Element | null = tracked?.element ?? null;
    if (
      element &&
      typeof root.contains === "function" &&
      !root.contains(element)
    ) {
      if (tracked) restoreAll(tracked);
      bookkeeping.delete(id);
      tracked = undefined;
      element = null;
    }
    if (!element) element = findElement(root, scene);
    if (!element) {
      if (tracked) {
        restoreAll(tracked);
        bookkeeping.delete(id);
      }
      continue;
    }
    if (tracked && tracked.element !== element) {
      restoreAll(tracked);
      tracked = undefined;
    }
    if (!tracked) {
      tracked = {
        element,
        attributes: new Map(),
        styles: new Map(),
        applied: new Set(),
      };
      bookkeeping.set(id, tracked);
    }
    applyTarget(tracked, scene, graph, target);
  }
}
