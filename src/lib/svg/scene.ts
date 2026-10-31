/**
 * Scene graph construction and traversal.
 *
 * Geometry and inferred semantics are kept in separate fields. Bounding boxes
 * are estimates in the SVG user coordinate system: stroke width, markers and
 * font metrics are not included.
 */

import type { Element as XmlElement } from "@xmldom/xmldom";

import {
  cleanNumber,
  elementGeometryBBox,
  multiplyMatrices,
  parseTransform,
  roundBBox,
  roundNumber,
  transformBBox,
  translationMatrix,
  unionBBox,
} from "./geometry";
import {
  canonicalSvgTag,
  isXmlElement,
  type ElementMetadata,
  type SanitizeResult,
} from "./sanitize";
import {
  ANIMATABLE_SVG_TAGS,
  type AnimatableProperties,
  type BBox,
  type ImportFailure,
  type ImportResult,
  type Mat,
  type SceneContext,
  type SceneElement,
  type SceneElementContext,
  type SceneGraph,
  type SceneGraphStats,
  type SceneStyle,
  type SemanticInfo,
  type ViewBox,
} from "./types";

const NUMBER_SOURCE = "[+-]?(?:\\d*\\.\\d+|\\d+\\.?)(?:[eE][+-]?\\d+)?";
const VIEWBOX_RE = new RegExp(
  `^\\s*(${NUMBER_SOURCE})[\\s,]+(${NUMBER_SOURCE})[\\s,]+(${NUMBER_SOURCE})[\\s,]+(${NUMBER_SOURCE})\\s*$`,
);
const LENGTH_RE = new RegExp(`^(${NUMBER_SOURCE})(?:px)?$`);

const ANIMATABLE_TAGS = new Set<string>(ANIMATABLE_SVG_TAGS);
const CONTAINER_TAGS = new Set<string>(["g", "defs", "clipPath", "svg"]);
const ZERO_STYLE_TAGS = new Set<string>(["linearGradient", "radialGradient", "stop", "tspan"]);
const GEOMETRY_TAGS = new Set<string>([
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
]);

const DEFAULT_COMPUTED_STYLE: SceneStyle = {
  fill: "#000000",
  stroke: "none",
  strokeWidth: 1,
  opacity: 1,
  fillOpacity: 1,
  strokeOpacity: 1,
};

const STYLE_ATTRIBUTE_MAP: Record<string, keyof SceneStyle> = {
  fill: "fill",
  stroke: "stroke",
  "stroke-width": "strokeWidth",
  opacity: "opacity",
  "fill-opacity": "fillOpacity",
  "stroke-opacity": "strokeOpacity",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "stroke-dasharray": "strokeDasharray",
  "font-family": "fontFamily",
  "font-size": "fontSize",
  "font-weight": "fontWeight",
  "text-anchor": "textAnchor",
  "dominant-baseline": "dominantBaseline",
  "letter-spacing": "letterSpacing",
};

const INHERITED_STYLE_KEYS: Array<keyof SceneStyle> = [
  "fill",
  "stroke",
  "strokeWidth",
  "fillOpacity",
  "strokeOpacity",
  "strokeLinecap",
  "strokeLinejoin",
  "strokeDasharray",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "textAnchor",
  "dominantBaseline",
  "letterSpacing",
];

type SemanticKeyword = {
  tag: string;
  words: readonly string[];
};

const SEMANTIC_KEYWORDS: readonly SemanticKeyword[] = [
  { tag: "rocket", words: ["rocket", "spaceship", "spacecraft", "missile", "shuttle"] },
  { tag: "flame", words: ["flame", "fire", "ignite", "ignition", "burn", "blaze", "ember", "exhaust"] },
  { tag: "star", words: ["star", "sparkle", "twinkle", "shine", "spark"] },
  { tag: "leaf", words: ["leaf", "leaves", "foliage", "sprout", "frond"] },
  { tag: "flower", words: ["flower", "petal", "blossom", "bloom", "rose", "sunflower"] },
  { tag: "steam", words: ["steam", "vapor", "vapour", "smoke", "mist"] },
  { tag: "cloud", words: ["cloud", "clouds"] },
  { tag: "sun", words: ["sun", "sunlight", "sunshine"] },
  { tag: "moon", words: ["moon", "crescent"] },
  { tag: "tree", words: ["tree", "trunk", "branch", "canopy"] },
  { tag: "plant", words: ["plant", "stem", "grass", "vine"] },
  { tag: "heart", words: ["heart"] },
  { tag: "wing", words: ["wing", "wings"] },
  { tag: "tail", words: ["tail"] },
  { tag: "arm", words: ["arm", "forearm"] },
  { tag: "leg", words: ["leg", "thigh", "shin", "feet"] },
  { tag: "eye", words: ["eye", "pupil", "iris", "eyelid"] },
  { tag: "head", words: ["head"] },
  { tag: "body", words: ["body", "torso", "chest"] },
  { tag: "face", words: ["face", "cheek"] },
  { tag: "mouth", words: ["mouth", "lip", "smile"] },
  { tag: "nose", words: ["nose"] },
  { tag: "hand", words: ["hand", "palm", "finger", "thumb"] },
  { tag: "foot", words: ["foot", "toe"] },
  { tag: "wheel", words: ["wheel", "tire", "tyre", "rim"] },
  { tag: "cup", words: ["cup", "mug", "glass", "goblet"] },
  { tag: "logo", words: ["logo", "brand", "wordmark", "emblem"] },
  { tag: "ball", words: ["ball", "sphere", "orb"] },
  { tag: "planet", words: ["planet", "saturn", "jupiter", "mars"] },
  { tag: "ship", words: ["ship", "boat", "vessel", "sail"] },
  { tag: "bird", words: ["bird", "beak", "feather"] },
  { tag: "fish", words: ["fish", "fin"] },
  { tag: "car", words: ["car", "vehicle", "truck", "bus"] },
  { tag: "person", words: ["person", "people", "human", "character", "mascot"] },
  { tag: "bubble", words: ["bubble", "speech"] },
  { tag: "wave", words: ["wave", "ripple"] },
  { tag: "light", words: ["light", "glow", "ray", "beam"] },
  { tag: "shadow", words: ["shadow", "silhouette"] },
  { tag: "ground", words: ["ground", "floor", "terrain"] },
  { tag: "window", words: ["window", "porthole"] },
  { tag: "door", words: ["door", "hatch"] },
  { tag: "background", words: ["background", "backdrop", "sky"] },
];

export type SceneBuildInput = {
  sanitized: SanitizeResult;
  sourceBytes: number;
  durationMs: number;
  filename?: string;
};

type WorkItem = {
  element: XmlElement;
  parentId: string | null;
  depth: number;
  parentMatrix: Mat;
  inheritedStyle: SceneStyle;
};

type BuiltElement = {
  element: SceneElement;
  xml: XmlElement;
};

/** Build the public scene graph from an already-sanitized tree. */
export function buildSceneGraph(input: SceneBuildInput): ImportResult {
  const { sanitized } = input;
  const root = sanitized.root;
  const rootMetadata = sanitized.metadata.get(root);
  const rootStyle = resolveComputedStyle(DEFAULT_COMPUTED_STYLE, readOwnStyle(root));
  const rootMatrix = parseTransform(root.getAttribute("transform"));
  const dimensions = resolveDimensions(root);

  const elements: Record<string, SceneElement> = {};
  const all: BuiltElement[] = [];
  const absoluteMatrices = new Map<string, Mat>();
  const stack: WorkItem[] = [];

  const rootChildren = directElementChildren(root);
  for (let index = rootChildren.length - 1; index >= 0; index -= 1) {
    stack.push({
      element: rootChildren[index],
      parentId: null,
      depth: 0,
      parentMatrix: rootMatrix,
      inheritedStyle: rootStyle,
    });
  }

  let order = 0;
  let sawNestedSvg = false;

  while (stack.length > 0) {
    const item = stack.pop();
    if (!item) break;
    const tag = canonicalSvgTag(item.element);
    if (!tag) continue;

    const id = item.element.getAttribute("id") ?? "";
    if (!id) continue;

    const meta = sanitized.metadata.get(item.element) ?? defaultMetadata();
    const ownStyle = readOwnStyle(item.element);
    const computedStyle = resolveComputedStyle(item.inheritedStyle, ownStyle);
    const text = readElementText(item.element, tag);
    const semantic = buildSemantic(id, meta, text);
    const isDefinition = meta.isDefinition;
    const animatable = !isDefinition && ANIMATABLE_TAGS.has(tag);
    const localMatrix = elementMatrix(item.element, tag);
    const absoluteMatrix = multiplyMatrices(item.parentMatrix, localMatrix);
    absoluteMatrices.set(id, absoluteMatrix);
    if (tag === "svg") sawNestedSvg = true;

    const childIds = directElementChildren(item.element)
      .map((child) => child.getAttribute("id") ?? "")
      .filter((childId) => childId !== "");

    const element: SceneElement = {
      id,
      originalId: meta.originalId,
      tag,
      name: semantic.label,
      parentId: item.parentId,
      childIds,
      depth: item.depth,
      order,
      bbox: { x: 0, y: 0, w: 0, h: 0 },
      localBBox: { x: 0, y: 0, w: 0, h: 0 },
      center: { x: 0, y: 0 },
      transform: (item.element.getAttribute("transform") ?? "").trim(),
      matrix: localMatrix.map((value) => roundNumber(value, 6)) as Mat,
      style: ownStyle,
      computedStyle,
      animatable: animatableProperties(tag, animatable),
      semantic,
      text,
      hints: { ...meta.hints },
      isDefinition,
    };

    elements[id] = element;
    all.push({ element, xml: item.element });
    order += 1;

    const children = directElementChildren(item.element);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({
        element: children[index],
        parentId: id,
        depth: item.depth + 1,
        parentMatrix: absoluteMatrix,
        inheritedStyle: computedStyle,
      });
    }
  }

  if (all.length === 0) {
    return failure(
      "no_animatable_elements",
      "The SVG contains no animatable elements.",
      sanitized.warnings,
    );
  }

  // Local boxes are computed bottom-up: reverse pre-order visits children
  // before their parents. Empty containers do not contribute a phantom box at
  // the origin to an ancestor's union.
  const renderable = new Set<string>();
  for (let index = all.length - 1; index >= 0; index -= 1) {
    const built = all[index];
    const sceneElement = built.element;
    if (CONTAINER_TAGS.has(sceneElement.tag)) {
      let union: BBox | null = null;
      for (const childId of sceneElement.childIds) {
        if (!renderable.has(childId)) continue;
        const child = elements[childId];
        if (!child) continue;
        if (child.isDefinition && !sceneElement.isDefinition) continue;
        union = unionBBox(union, transformBBox(child.localBBox, child.matrix));
      }
      sceneElement.localBBox = roundBBox(union ?? { x: 0, y: 0, w: 0, h: 0 });
      if (union) renderable.add(sceneElement.id);
    } else if (ZERO_STYLE_TAGS.has(sceneElement.tag)) {
      sceneElement.localBBox = { x: 0, y: 0, w: 0, h: 0 };
    } else {
      sceneElement.localBBox = roundBBox(
        elementGeometryBBox(sceneElement.tag, built.xml, {
          fontSize: sceneElement.computedStyle.fontSize,
          textAnchor: sceneElement.computedStyle.textAnchor,
        }),
      );
      if (
        GEOMETRY_TAGS.has(sceneElement.tag) &&
        (sceneElement.tag !== "text" || sceneElement.text !== undefined)
      ) {
        renderable.add(sceneElement.id);
      }
    }
  }

  for (const built of all) {
    const sceneElement = built.element;
    const matrix = absoluteMatrices.get(sceneElement.id) ?? rootMatrix;
    const bbox = roundBBox(transformBBox(sceneElement.localBBox, matrix));
    sceneElement.bbox = bbox;
    sceneElement.center = {
      x: roundNumber(bbox.x + bbox.w / 2),
      y: roundNumber(bbox.y + bbox.h / 2),
    };
  }

  const animatableElements = all
    .map((built) => built.element)
    .filter((element) => element.animatable.transform);
  if (animatableElements.length === 0) {
    return failure(
      "no_animatable_elements",
      "The SVG contains no animatable elements.",
      sanitized.warnings,
    );
  }

  const rootIds = directElementChildren(root)
    .map((child) => child.getAttribute("id") ?? "")
    .filter((id) => id !== "");

  const warnings = [...sanitized.warnings];
  if (sawNestedSvg) warnings.push("Nested <svg> viewports are approximated.");

  const stats: SceneGraphStats = {
    bytes: input.sourceBytes,
    elementCount: all.length,
    animatableCount: animatableElements.length,
    groupCount: all.filter((built) => built.element.tag === "g").length,
    removedNodeCount: sanitized.removedNodeCount,
    duplicateIdCount: sanitized.duplicateIdCount,
    durationMs: roundNumber(input.durationMs, 2),
  };

  const graph: SceneGraph = {
    version: 1,
    assetId: `svg-${hashString(sanitized.sanitizedSvg)}`,
    filename: sanitizeFilename(input.filename),
    title: rootMetadata?.title ?? rootMetadata?.ariaLabel ?? rootMetadata?.dataName,
    viewBox: dimensions.viewBox,
    width: dimensions.width,
    height: dimensions.height,
    rootIds,
    elements,
    order: animatableElements.map((element) => element.id),
    sanitizedSvg: sanitized.sanitizedSvg,
    warnings,
    stats,
  };

  return { ok: true, graph };
}

function failure(
  code: ImportFailure["error"]["code"],
  message: string,
  warnings: string[],
): ImportFailure {
  return { ok: false, error: { code, message }, warnings };
}

function defaultMetadata(): ElementMetadata {
  return { idAuthored: false, hints: {}, isDefinition: false };
}

function directElementChildren(element: XmlElement): XmlElement[] {
  const children: XmlElement[] = [];
  for (let index = 0; index < element.childNodes.length; index += 1) {
    const child = element.childNodes.item(index);
    if (isXmlElement(child)) children.push(child);
  }
  return children;
}

function elementMatrix(element: XmlElement, tag: string): Mat {
  const transform = parseTransform(element.getAttribute("transform"));
  if (tag !== "svg") return transform;

  const x = cleanNumber(Number.parseFloat(element.getAttribute("x") ?? "0"));
  const y = cleanNumber(Number.parseFloat(element.getAttribute("y") ?? "0"));
  if (x === 0 && y === 0) return transform;
  return multiplyMatrices(translationMatrix(x, y), transform);
}

function readElementText(element: XmlElement, tag: string): string | undefined {
  if (tag !== "text" && tag !== "tspan") return undefined;
  const text = (element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  return text === "" ? undefined : text;
}

function animatableProperties(tag: string, animatable: boolean): AnimatableProperties {
  if (!animatable) {
    return {
      transform: false,
      opacity: false,
      fill: false,
      stroke: false,
      strokeWidth: false,
      strokeDraw: false,
      motionPath: false,
    };
  }
  const strokeDraw =
    tag === "path" ||
    tag === "line" ||
    tag === "polyline" ||
    tag === "polygon" ||
    tag === "rect" ||
    tag === "circle" ||
    tag === "ellipse";
  return {
    transform: true,
    opacity: true,
    fill: true,
    stroke: true,
    strokeWidth: true,
    strokeDraw,
    motionPath: true,
  };
}

function readOwnStyle(element: XmlElement): SceneStyle {
  const style: SceneStyle = {};

  for (const [attribute, key] of Object.entries(STYLE_ATTRIBUTE_MAP)) {
    const raw = element.getAttribute(attribute);
    if (raw === null) continue;
    assignStyleValue(style, key, raw);
  }

  const inline = element.getAttribute("style");
  if (inline) {
    for (const declaration of inline.split(";")) {
      const colon = declaration.indexOf(":");
      if (colon === -1) continue;
      const property = declaration.slice(0, colon).trim().toLowerCase();
      const key = STYLE_ATTRIBUTE_MAP[property];
      if (!key) continue;
      assignStyleValue(style, key, declaration.slice(colon + 1).trim());
    }
  }

  return style;
}

function assignStyleValue(style: SceneStyle, key: keyof SceneStyle, raw: string): void {
  const value = raw.trim();
  if (value === "") return;

  if (key === "fill" || key === "stroke" || key === "strokeLinecap" ||
      key === "strokeLinejoin" || key === "strokeDasharray" ||
      key === "fontFamily" || key === "fontWeight" || key === "textAnchor" ||
      key === "dominantBaseline") {
    style[key] = value;
    return;
  }

  const allowPercent = key === "opacity" || key === "fillOpacity" || key === "strokeOpacity";
  const parsed = parseStyleNumber(value, allowPercent);
  if (parsed === null) return;

  if (key === "opacity" || key === "fillOpacity" || key === "strokeOpacity") {
    style[key] = Math.min(1, Math.max(0, parsed));
  } else if (key === "strokeWidth") {
    style.strokeWidth = Math.max(0, parsed);
  } else if (key === "fontSize") {
    if (parsed > 0) style.fontSize = parsed;
  } else if (key === "letterSpacing") {
    style.letterSpacing = parsed;
  }
}

function parseStyleNumber(value: string, allowPercent: boolean): number | null {
  if (/^[+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?%$/.test(value)) {
    if (!allowPercent) return null;
    const percent = Number.parseFloat(value);
    return Number.isFinite(percent) ? cleanNumber(percent / 100) : null;
  }
  const match = new RegExp(`^\\s*(${NUMBER_SOURCE})`).exec(value);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? cleanNumber(parsed) : null;
}

function resolveComputedStyle(parent: SceneStyle, own: SceneStyle): SceneStyle {
  const computed: SceneStyle = { ...parent };

  for (const key of INHERITED_STYLE_KEYS) {
    const value = own[key];
    if (value === undefined) continue;
    if (typeof value === "string" && value.toLowerCase() === "inherit") continue;
    if (key === "strokeWidth") {
      computed.strokeWidth = Math.max(0, own.strokeWidth ?? parent.strokeWidth ?? 1);
    } else if (key === "fontSize") {
      computed.fontSize = own.fontSize ?? parent.fontSize;
    } else if (key === "letterSpacing") {
      computed.letterSpacing = own.letterSpacing ?? parent.letterSpacing;
    } else if (key === "fillOpacity" || key === "strokeOpacity") {
      const opacity = own[key];
      if (opacity !== undefined) computed[key] = opacity;
    } else {
      assignComputedValue(computed, key, value);
    }
  }

  // opacity is not an inherited CSS property.
  computed.opacity = own.opacity ?? 1;
  return computed;
}

function assignComputedValue(
  target: SceneStyle,
  key: keyof SceneStyle,
  value: string | number,
): void {
  switch (key) {
    case "fill":
    case "stroke":
    case "strokeLinecap":
    case "strokeLinejoin":
    case "strokeDasharray":
    case "fontFamily":
    case "fontWeight":
    case "textAnchor":
    case "dominantBaseline":
      if (typeof value === "string") target[key] = value;
      break;
    default:
      break;
  }
}

function buildSemantic(
  id: string,
  meta: ElementMetadata,
  text: string | undefined,
): SemanticInfo {
  const ariaLabel = meta.ariaLabel;
  const dataName = meta.dataName;
  const title = meta.title;
  const authored = ariaLabel ?? dataName;
  const source: SemanticInfo["source"] = authored ? "authored" : "heuristic";
  const label = ariaLabel ?? dataName ?? title ?? id;

  const haystack = [
    ariaLabel,
    dataName,
    title,
    meta.authoredId ?? "",
    id,
    text ?? "",
    meta.hints.role ?? "",
    meta.hints.class ?? "",
    ...Object.values(meta.hints),
  ]
    .filter(Boolean)
    .join(" ");
  const tokens = tokenizeSemanticText(haystack);
  const tags: string[] = [];
  for (const keyword of SEMANTIC_KEYWORDS) {
    if (tags.includes(keyword.tag)) continue;
    if (keyword.words.some((word) => tokens.some((token) => wordMatches(token, word)))) {
      tags.push(keyword.tag);
    }
  }

  let confidence: number;
  if (ariaLabel) confidence = 0.92;
  else if (dataName) confidence = 0.88;
  else if (title) confidence = 0.62;
  else if (meta.idAuthored) confidence = tags.length > 0 ? 0.55 : 0.45;
  else confidence = tags.length > 0 ? 0.35 : 0.18;

  if (source === "authored" && tags.length > 0) {
    confidence = Math.min(0.98, confidence + 0.03);
  }

  return {
    label,
    role: tags[0],
    tags,
    confidence: roundNumber(confidence, 2),
    source,
  };
}

function tokenizeSemanticText(value: string): string[] {
  const splitCamel = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([a-zA-Z])([0-9])/g, "$1 $2")
    .replace(/([0-9])([a-zA-Z])/g, "$1 $2");
  return splitCamel
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token !== "");
}

function wordMatches(token: string, word: string): boolean {
  if (token === word) return true;
  if (token === `${word}s` || token === `${word}es`) return true;
  if (word.endsWith("y") && token === `${word.slice(0, -1)}ies`) return true;
  return false;
}

function resolveDimensions(root: XmlElement): {
  viewBox: ViewBox;
  width: number;
  height: number;
} {
  const authoredBox = parseViewBox(root.getAttribute("viewBox"));
  const authoredWidth = parseSvgLength(root.getAttribute("width"));
  const authoredHeight = parseSvgLength(root.getAttribute("height"));

  if (authoredBox) {
    return {
      viewBox: authoredBox,
      width: authoredWidth ?? authoredBox.width,
      height: authoredHeight ?? authoredBox.height,
    };
  }

  const width = authoredWidth ?? 300;
  const height = authoredHeight ?? 150;
  return {
    viewBox: { minX: 0, minY: 0, width, height },
    width,
    height,
  };
}

function parseViewBox(value: string | null): ViewBox | null {
  if (!value) return null;
  const match = VIEWBOX_RE.exec(value);
  if (!match) return null;
  const minX = Number(match[1]);
  const minY = Number(match[2]);
  const width = Number(match[3]);
  const height = Number(match[4]);
  if (![minX, minY, width, height].every((number) => Number.isFinite(number))) return null;
  if (width <= 0 || height <= 0) return null;
  return {
    minX: cleanNumber(minX),
    minY: cleanNumber(minY),
    width: cleanNumber(width),
    height: cleanNumber(height),
  };
}

function parseSvgLength(value: string | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.endsWith("%")) return null;
  const match = LENGTH_RE.exec(trimmed);
  if (!match) return null;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return cleanNumber(parsed);
}

function sanitizeFilename(filename: string | undefined): string | undefined {
  if (typeof filename !== "string" || filename === "") return undefined;
  const cleaned = filename.replace(/\s+/g, " ").trim().slice(0, 240);
  return cleaned === "" ? undefined : cleaned;
}

function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function getSceneElement(graph: SceneGraph, id: string): SceneElement | undefined {
  if (typeof id !== "string") return undefined;
  if (!Object.prototype.hasOwnProperty.call(graph.elements, id)) return undefined;
  return graph.elements[id];
}

export function getSceneChildren(graph: SceneGraph, id: string | null): SceneElement[] {
  if (id === null) {
    return graph.rootIds
      .map((rootId) => getSceneElement(graph, rootId))
      .filter((element): element is SceneElement => element !== undefined);
  }
  const parent = getSceneElement(graph, id);
  if (!parent) return [];
  return parent.childIds
    .map((childId) => getSceneElement(graph, childId))
    .filter((element): element is SceneElement => element !== undefined);
}

/** Ancestors are returned outermost-first (root child before immediate parent). */
export function getSceneAncestors(graph: SceneGraph, id: string): SceneElement[] {
  const start = getSceneElement(graph, id);
  if (!start) return [];
  const ancestors: SceneElement[] = [];
  const seen = new Set<string>([id]);
  let parentId = start.parentId;
  while (parentId !== null) {
    if (seen.has(parentId)) break;
    seen.add(parentId);
    const parent = getSceneElement(graph, parentId);
    if (!parent) break;
    ancestors.push(parent);
    parentId = parent.parentId;
  }
  return ancestors.reverse();
}

/** Compact scene context for the AI Director. Definitions are never included. */
export function sceneToContext(
  graph: SceneGraph,
  options?: {
    maxElements?: number;
    selectedElementIds?: string[];
    animatedElementIds?: string[];
  },
): SceneContext {
  const requested = options?.maxElements;
  const maxElements =
    requested === undefined || !Number.isFinite(requested)
      ? 120
      : Math.max(0, Math.floor(requested));
  const selected = new Set(options?.selectedElementIds ?? []);
  const animated = new Set(options?.animatedElementIds ?? []);

  const visible = Object.values(graph.elements)
    .filter((element) => !element.isDefinition)
    .sort((left, right) => left.order - right.order);

  const truncated = visible.length > maxElements;
  const elements: SceneElementContext[] = visible.slice(0, maxElements).map((element) => {
    const context: SceneElementContext = {
      id: element.id,
      name: element.name,
      tag: element.tag,
      parentId: element.parentId,
      childCount: element.childIds.length,
      bbox: roundBBox(element.bbox, 2),
      animated: animated.has(element.id),
    };
    if (element.semantic.role) context.role = element.semantic.role;
    if (element.semantic.tags.length > 0) context.tags = [...element.semantic.tags];
    if (element.text) context.text = element.text;
    if (selected.has(element.id)) context.selected = true;
    return context;
  });

  return {
    assetId: graph.assetId,
    filename: graph.filename,
    viewBox: { ...graph.viewBox },
    elementCount: graph.stats.elementCount,
    animatableCount: graph.stats.animatableCount,
    truncated,
    elements,
  };
}
