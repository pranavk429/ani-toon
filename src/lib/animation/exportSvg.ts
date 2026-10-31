/**
 * Standalone animated-SVG export for the supported Motion DSL v1 subset.
 *
 * Transform tracks (including motion paths) are baked to `animateTransform`
 * matrix samples at the document frame rate. Paint tracks use `<animate>`.
 * Everything else in the sanitized scene graph is preserved verbatim.
 */

import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type {
  Document as XmlDocument,
  Element as XmlElement,
} from "@xmldom/xmldom";
import type { SceneElement, SceneGraph } from "../svg/types";
import type {
  EvaluatedTarget,
  MotionDocument,
  MotionProperty,
  MotionTrack,
  TransformOrigin,
} from "./types";
import { evaluateTargetTracks } from "./evaluate";
import {
  componentTransformString,
  componentValuesString,
  composeWrapperAnimationMatrix,
  decomposeMatrixForSmil,
  formatNumber,
  IDENTITY_MATRIX,
  type MotionTransformValues,
  type SmilMatrixComponents,
} from "./transform";
import { expandMotionDocument, TIMING_EPSILON } from "./validate";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const EXPORTABLE_TAGS: ReadonlySet<string> = new Set([
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
]);

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

export type BuildAnimatedSvgOptions = {
  title?: string;
  background?: string | null;
  fps?: number;
};

export type BuildAnimatedSvgResult = {
  svg: string;
  warnings: string[];
};

type ParsedSvg = {
  document: XmlDocument;
  root: XmlElement;
};

type TargetGroup = {
  id: string;
  tracks: MotionTrack[];
  properties: Set<MotionProperty>;
  transform: boolean;
  origin: TransformOrigin;
};

function parseSvg(source: string): ParsedSvg {
  let parseErrorMessage: string | null = null;
  const parser = new DOMParser({
    onError(level: string, message: string) {
      if (level === "error" || level === "fatalError") {
        parseErrorMessage = message;
      }
    },
  });
  const document = parser.parseFromString(source, "image/svg+xml");
  if (parseErrorMessage) {
    throw new Error(`Could not parse sanitized SVG: ${parseErrorMessage}`);
  }
  const root = document.documentElement;
  if (!root || root.tagName.toLowerCase() !== "svg") {
    throw new Error("Could not parse sanitized SVG: missing <svg> root");
  }
  return { document, root };
}

function createElement(
  document: XmlDocument,
  name: string,
): XmlElement {
  return document.createElementNS(SVG_NAMESPACE, name);
}

function findElement(
  root: XmlElement,
  scene: SceneElement,
): XmlElement | null {
  if (root.getAttribute("id") === scene.id) return root;
  const all = root.getElementsByTagName("*");
  let fallback: XmlElement | null = null;
  for (let i = 0; i < all.length; i++) {
    const element = all[i];
    const id = element.getAttribute("id");
    if (id === scene.id) return element;
    if (!fallback && scene.originalId && id === scene.originalId) {
      fallback = element;
    }
  }
  return fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function formatSeconds(value: number): string {
  return formatNumber(value, 6);
}

function sampleTimes(duration: number, fps: number): number[] {
  const safeDuration = Math.max(0.001, duration);
  const frames = Math.max(1, Math.round(fps * safeDuration));
  const times: number[] = [];
  for (let i = 0; i <= frames; i++) {
    times.push((i / frames) * safeDuration);
  }
  return times;
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

function timingAttributes(
  animation: XmlElement,
  doc: MotionDocument,
  loop: boolean,
): void {
  animation.setAttribute("begin", "0s");
  animation.setAttribute("dur", `${formatSeconds(doc.duration)}s`);
  animation.setAttribute("fill", "freeze");
  animation.setAttribute("repeatCount", loop ? "indefinite" : "1");
}

function createAnimation(
  document: XmlDocument,
  name: "animate" | "animateTransform",
  attributeName: string,
  values: string,
  doc: MotionDocument,
  loop: boolean,
): XmlElement {
  const animation = createElement(document, name);
  animation.setAttribute("attributeName", attributeName);
  animation.setAttribute("values", values);
  animation.setAttribute("calcMode", "linear");
  timingAttributes(animation, doc, loop);
  return animation;
}

function collectTargets(
  doc: MotionDocument,
  warn: (message: string) => void,
): Map<string, TargetGroup> {
  const groups = new Map<string, TargetGroup>();
  const muted = doc.tracks.filter((track) => track.muted === true);
  if (muted.length > 0) {
    warn(`${muted.length} muted track(s) omitted from export`);
  }

  for (const track of doc.tracks) {
    if (track.muted) continue;
    if (track.target.kind !== "svg") {
      warn("Mascot targets cannot be exported to animated SVG");
      continue;
    }
    const windowEnd =
      (track.delay ?? 0) +
      (track.duration ?? Math.max(0, doc.duration - (track.delay ?? 0)));
    if (windowEnd > doc.duration + TIMING_EPSILON) {
      warn(
        `Track "${track.id}" ends after the document duration; export uses the document duration`,
      );
    }
    const id = track.target.elementId;
    let group = groups.get(id);
    if (!group) {
      group = {
        id,
        tracks: [],
        properties: new Set(),
        transform: false,
        origin: "center",
      };
      groups.set(id, group);
    }
    group.tracks.push(track);
    group.properties.add(track.property);
    if (TRANSFORM_PROPERTIES.has(track.property)) {
      group.transform = true;
      const origin = track.origin ?? "center";
      if (group.origin === "center" && origin !== "center") {
        group.origin = origin;
      }
    }
  }
  return groups;
}

function safeXmlText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function buildTitle(
  document: XmlDocument,
  root: XmlElement,
  title: string,
): XmlElement {
  let existing: XmlElement | null = null;
  for (let node = root.firstChild; node; node = node.nextSibling) {
    if (node.nodeType === 1) {
      const element = node as XmlElement;
      if (element.tagName.toLowerCase() === "title") {
        existing = element;
        break;
      }
    }
  }
  const safeTitle = safeXmlText(title);
  if (existing) {
    existing.textContent = safeTitle;
    return existing;
  }
  const created = createElement(document, "title");
  created.textContent = safeTitle;
  root.insertBefore(created, root.firstChild);
  return created;
}

function addBackground(
  document: XmlDocument,
  root: XmlElement,
  title: XmlElement,
  graph: SceneGraph,
  background: string,
): void {
  const rect = createElement(document, "rect");
  rect.setAttribute("x", formatNumber(graph.viewBox.minX, 6));
  rect.setAttribute("y", formatNumber(graph.viewBox.minY, 6));
  rect.setAttribute("width", formatNumber(graph.viewBox.width, 6));
  rect.setAttribute("height", formatNumber(graph.viewBox.height, 6));
  rect.setAttribute("fill", background);
  rect.setAttribute("data-anitoon-background", "true");
  const sibling = title.nextSibling;
  if (sibling) root.insertBefore(rect, sibling);
  else root.appendChild(rect);
}

const TRANSFORM_TYPES = ["translate", "rotate", "skewX", "scale"] as const;
type TransformComponentType = (typeof TRANSFORM_TYPES)[number];

function componentIsIdentity(
  type: TransformComponentType,
  values: SmilMatrixComponents,
): boolean {
  switch (type) {
    case "translate":
      return Math.abs(values.translateX) < 1e-6 && Math.abs(values.translateY) < 1e-6;
    case "rotate":
      return Math.abs(values.rotate) < 1e-6;
    case "skewX":
      return Math.abs(values.skewX) < 1e-6;
    case "scale":
      return (
        Math.abs(values.scaleX - 1) < 1e-6 &&
        Math.abs(values.scaleY - 1) < 1e-6
      );
  }
}

function componentsNear(
  a: SmilMatrixComponents,
  b: SmilMatrixComponents,
  epsilon = 1e-5,
): boolean {
  return (
    Math.abs(a.translateX - b.translateX) < epsilon &&
    Math.abs(a.translateY - b.translateY) < epsilon &&
    Math.abs(a.rotate - b.rotate) < epsilon &&
    Math.abs(a.skewX - b.skewX) < epsilon &&
    Math.abs(a.scaleX - b.scaleX) < epsilon &&
    Math.abs(a.scaleY - b.scaleY) < epsilon
  );
}

function wrapTransform(
  document: XmlDocument,
  element: XmlElement,
  group: TargetGroup,
  graph: SceneGraph,
  scene: SceneElement,
  samples: Array<EvaluatedTarget | undefined>,
  doc: MotionDocument,
  loop: boolean,
): boolean {
  const parent = element.parentNode;
  if (!parent) return false;
  if (element === element.ownerDocument?.documentElement) return false;

  // Chromium does not apply animateTransform type="matrix" in SVG documents.
  // Emit nested component transforms instead. These are supported everywhere
  // SMIL is supported and compose in a deterministic order:
  //   translate -> rotate -> skewX -> scale
  const components: SmilMatrixComponents[] = samples.map((sample) =>
    decomposeMatrixForSmil(
      sample
        ? composeWrapperAnimationMatrix(
            graph,
            scene,
            transformValues(sample),
            group.origin,
          )
        : IDENTITY_MATRIX,
    ),
  );

  const nextSibling = element.nextSibling;
  parent.removeChild(element);
  let current: XmlElement = element;
  for (let index = TRANSFORM_TYPES.length - 1; index >= 0; index -= 1) {
    const type = TRANSFORM_TYPES[index];
    const allIdentity = components.every((sample) =>
      componentIsIdentity(type, sample),
    );
    if (allIdentity) continue;

    const first = components[0];
    const constant = components.every((sample) => componentsNear(first, sample));
    const groupElement = createElement(document, "g");
    groupElement.setAttribute("data-anitoon-transform", type);
    if (!constant) {
      const animation = createAnimation(
        document,
        "animateTransform",
        "transform",
        componentValuesString(type, components, 6),
        doc,
        loop,
      );
      animation.setAttribute("type", type);
      groupElement.appendChild(animation);
    } else {
      groupElement.setAttribute(
        "transform",
        componentTransformString(type, first, 6),
      );
    }
    groupElement.appendChild(current);
    current = groupElement;
  }

  // Mark the outermost generated group, or the element itself when the
  // animation is identity-free, so tests and consumers can find the target.
  current.setAttribute("data-anitoon-motion", group.id);

  if (nextSibling && nextSibling.parentNode === parent) {
    parent.insertBefore(current, nextSibling);
  } else {
    parent.appendChild(current);
  }
  return true;
}

function addPaintAnimation(
  document: XmlDocument,
  element: XmlElement,
  property: MotionProperty,
  samples: Array<EvaluatedTarget | undefined>,
  doc: MotionDocument,
  loop: boolean,
  scene: SceneElement,
  warn: (message: string) => void,
): boolean {
  switch (property) {
    case "opacity": {
      if (!samples.some((sample) => sample !== undefined)) return false;
      const values = samples.map((sample) =>
        formatNumber(sample?.opacity ?? 1, 5),
      );
      element.appendChild(
        createAnimation(
          document,
          "animate",
          "opacity",
          values.join(";"),
          doc,
          loop,
        ),
      );
      return true;
    }
    case "fill": {
      const values = samples.map(
        (sample) => sample?.fill ?? scene.computedStyle.fill ?? "#000000",
      );
      if (values.some((value) => typeof value !== "string")) return false;
      element.appendChild(
        createAnimation(
          document,
          "animate",
          "fill",
          values.join(";"),
          doc,
          loop,
        ),
      );
      return true;
    }
    case "stroke": {
      const values = samples.map(
        (sample) => sample?.stroke ?? scene.computedStyle.stroke ?? "none",
      );
      if (values.some((value) => typeof value !== "string")) return false;
      element.appendChild(
        createAnimation(
          document,
          "animate",
          "stroke",
          values.join(";"),
          doc,
          loop,
        ),
      );
      return true;
    }
    case "strokeWidth": {
      const values = samples.map(
        (sample) =>
          sample?.strokeWidth ??
          scene.computedStyle.strokeWidth ??
          1,
      );
      element.appendChild(
        createAnimation(
          document,
          "animate",
          "stroke-width",
          values.map((value) => formatNumber(value, 5)).join(";"),
          doc,
          loop,
        ),
      );
      return true;
    }
    case "strokeDraw": {
      const tag = element.tagName.toLowerCase();
      if (!PATH_LIKE_TAGS.has(tag)) {
        warn(
          `strokeDraw on <${tag}> target "${scene.id}" is not supported by SVG export`,
        );
        return false;
      }
      const authoredDasharray = element.getAttribute("stroke-dasharray");
      if (authoredDasharray && authoredDasharray.trim().length > 0) {
        warn(
          `strokeDraw on "${scene.id}" overrides the authored stroke-dasharray`,
        );
      }
      element.setAttribute("pathLength", "1");
      element.setAttribute("stroke-dasharray", "1 1");
      const offsets = samples.map((sample) =>
        formatNumber(1 - clamp01(sample?.strokeDraw ?? 1), 5),
      );
      element.appendChild(
        createAnimation(
          document,
          "animate",
          "stroke-dashoffset",
          offsets.join(";"),
          doc,
          loop,
        ),
      );
      // Also animate dasharray so an authored inline style does not win over
      // the reveal technique.
      element.appendChild(
        createAnimation(
          document,
          "animate",
          "stroke-dasharray",
          "1 1;1 1",
          doc,
          loop,
        ),
      );
      return true;
    }
    default:
      return false;
  }
}

/**
 * Serialize a standalone animated SVG for the supported v1 subset.
 * Throws only when the sanitized SVG cannot be parsed.
 */
export function buildAnimatedSvg(
  graph: SceneGraph,
  docInput: MotionDocument,
  options: BuildAnimatedSvgOptions = {},
): BuildAnimatedSvgResult {
  const warnings: string[] = [];
  const warningSet = new Set<string>();
  const warn = (message: string): void => {
    if (!warningSet.has(message)) {
      warningSet.add(message);
      warnings.push(message);
    }
  };

  let doc: MotionDocument;
  try {
    doc = expandMotionDocument(docInput);
  } catch (error) {
    doc = docInput;
    warn(
      `Authoring groups could not be expanded: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
  }

  const { document, root } = parseSvg(graph.sanitizedSvg);
  const title = options.title ?? doc.name ?? graph.title ?? "Animated SVG";

  // Ensure the root carries enough information to stand alone.
  if (!root.getAttribute("xmlns")) root.setAttribute("xmlns", SVG_NAMESPACE);
  if (!root.getAttribute("width")) {
    root.setAttribute("width", formatNumber(graph.width, 6));
  }
  if (!root.getAttribute("height")) {
    root.setAttribute("height", formatNumber(graph.height, 6));
  }
  if (!root.getAttribute("viewBox")) {
    const box = graph.viewBox;
    root.setAttribute(
      "viewBox",
      `${formatNumber(box.minX, 6)} ${formatNumber(box.minY, 6)} ${formatNumber(
        box.width,
        6,
      )} ${formatNumber(box.height, 6)}`,
    );
  }

  const titleElement = buildTitle(document, root, title);
  if (typeof options.background === "string" && options.background.length > 0) {
    addBackground(document, root, titleElement, graph, options.background);
  }

  if (doc.targetKind !== "svg") {
    warn(
      "Character documents cannot be exported as animated SVG; artwork is exported without animation",
    );
  } else {
    if (doc.loop?.mode === "pingpong") {
      warn(
        "Pingpong loop mode is not representable in SVG export; exported as a restart loop",
      );
    }
    if (
      doc.loop?.enabled &&
      typeof doc.loop.iterations === "number"
    ) {
      warn(
        "loop.iterations is not represented in SMIL export; the animation repeats indefinitely",
      );
    }

    const loopEnabled = doc.loop?.enabled === true;
    const fps = clamp(
      Number.isFinite(options.fps) && (options.fps as number) > 0
        ? (options.fps as number)
        : 60,
      1,
      120,
    );
    const times = sampleTimes(doc.duration, fps);
    // Export samples the authored 0..duration timeline. Looping is represented
    // by SMIL repeatCount rather than by wrapping the sample times back to 0.
    const sampleDoc: MotionDocument =
      doc.loop?.enabled === true
        ? {
            ...doc,
            loop: {
              ...doc.loop,
              enabled: false,
            },
          }
        : doc;
    const groups = collectTargets(doc, warn);

    for (const group of groups.values()) {
      const scene = graph.elements[group.id];
      if (!scene) {
        warn(`Animation target "${group.id}" is not in the scene graph; skipped`);
        continue;
      }
      const element = findElement(root, scene);
      if (!element) {
        warn(`Animation target "${group.id}" is missing from the SVG; skipped`);
        continue;
      }
      const tag = element.tagName.toLowerCase();
      if (!EXPORTABLE_TAGS.has(tag)) {
        warn(
          `Animation target "${group.id}" uses unsupported <${tag}>; tracks skipped`,
        );
        continue;
      }
      if (tag === "text") {
        warn(
          `Text target "${group.id}" supports element-level animation only; glyph-level effects are not exported`,
        );
      }
      if (group.origin === "bone") {
        warn(
          `Target "${group.id}" uses a bone origin; SVG export uses the bbox center`,
        );
      }

      let samples: Array<EvaluatedTarget | undefined>;
      try {
        samples = times.map((time) =>
          evaluateTargetTracks(group.tracks, sampleDoc, time),
        );
      } catch (error) {
        warn(
          `Target "${group.id}" could not be evaluated for export: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        );
        continue;
      }

      if (group.transform) {
        const wrapped = wrapTransform(
          document,
          element,
          group,
          graph,
          scene,
          samples,
          doc,
          loopEnabled,
        );
        if (!wrapped) {
          warn(
            `Transform track for target "${group.id}" could not be wrapped; transform animation was skipped`,
          );
        }
      }

      for (const property of group.properties) {
        if (TRANSFORM_PROPERTIES.has(property)) continue;
        if (property === "motionPath") continue;
        const applied = addPaintAnimation(
          document,
          element,
          property,
          samples,
          doc,
          loopEnabled,
          scene,
          warn,
        );
        if (!applied) {
          warn(
            `Property "${property}" on target "${group.id}" was not exported`,
          );
        }
      }
    }
  }

  const serializer = new XMLSerializer();
  const serialized = serializer.serializeToString(document);
  const svg = serialized.startsWith("<?xml")
    ? serialized
    : `<?xml version="1.0" encoding="UTF-8"?>\n${serialized}`;
  return { svg, warnings };
}
