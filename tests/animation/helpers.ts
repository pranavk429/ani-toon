import type { SceneElement, SceneGraph } from "@/lib/svg/types";
import type {
  MotionDocument,
  MotionLoop,
  MotionTrack,
} from "@/lib/animation/types";

export const DEFAULT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><title>Fixture</title><rect id="box" x="10" y="10" width="20" height="20" fill="#ff0000" opacity="0.75"/><circle id="dot" cx="50" cy="50" r="5" fill="#00ff00"/><path id="line" d="M 0 0 L 40 0" fill="none" stroke="#000000" stroke-width="2"/><text id="label" x="5" y="90" fill="#333333">Hi</text></svg>`;

function element(
  id: string,
  tag: SceneElement["tag"],
  bbox: SceneElement["bbox"],
  overrides: Partial<SceneElement> = {},
): SceneElement {
  return {
    id,
    originalId: id,
    tag,
    parentId: null,
    childIds: [],
    depth: 0,
    order: 0,
    bbox,
    localBBox: bbox,
    center: { x: bbox.x + bbox.w / 2, y: bbox.y + bbox.h / 2 },
    transform: "",
    matrix: [1, 0, 0, 1, 0, 0],
    style: {},
    computedStyle: {},
    animatable: {
      transform: true,
      opacity: true,
      fill: true,
      stroke: true,
      strokeWidth: true,
      strokeDraw: true,
      motionPath: true,
    },
    semantic: { tags: [], confidence: 1, source: "authored" },
    hints: {},
    isDefinition: false,
    ...overrides,
  };
}

export function makeGraph(svg = DEFAULT_SVG): SceneGraph {
  const elements: Record<string, SceneElement> = {
    box: element("box", "rect", { x: 10, y: 10, w: 20, h: 20 }, {
      order: 0,
      style: { fill: "#ff0000", opacity: 0.75 },
      computedStyle: { fill: "#ff0000", opacity: 0.75 },
    }),
    dot: element("dot", "circle", { x: 45, y: 45, w: 10, h: 10 }, {
      order: 1,
      style: { fill: "#00ff00" },
      computedStyle: { fill: "#00ff00" },
    }),
    line: element("line", "path", { x: 0, y: 0, w: 40, h: 0 }, {
      order: 2,
      style: { fill: "none", stroke: "#000000", strokeWidth: 2 },
      computedStyle: { fill: "none", stroke: "#000000", strokeWidth: 2 },
    }),
    label: element("label", "text", { x: 5, y: 80, w: 20, h: 15 }, {
      order: 3,
      text: "Hi",
      style: { fill: "#333333" },
      computedStyle: { fill: "#333333" },
    }),
  };
  return {
    version: 1,
    assetId: "asset-test",
    filename: "fixture.svg",
    title: "Fixture",
    viewBox: { minX: 0, minY: 0, width: 100, height: 100 },
    width: 100,
    height: 100,
    rootIds: ["box", "dot", "line", "label"],
    elements,
    order: ["box", "dot", "line", "label"],
    sanitizedSvg: svg,
    warnings: [],
    stats: {
      bytes: svg.length,
      elementCount: 4,
      animatableCount: 4,
      groupCount: 0,
      removedNodeCount: 0,
      duplicateIdCount: 0,
      durationMs: 0,
    },
  };
}

export function svgContext(graph = makeGraph()) {
  return {
    targetKind: "svg" as const,
    elementIds: new Set(graph.order),
  };
}

export function makeTrack(
  overrides: Partial<MotionTrack> & Pick<MotionTrack, "id" | "property">,
): MotionTrack {
  return {
    target: { kind: "svg", elementId: "box" },
    keyframes: [
      { at: 0, value: 0 },
      { at: 1, value: 1 },
    ],
    ...overrides,
  };
}

export function makeDocument(
  overrides: Partial<MotionDocument> = {},
): MotionDocument {
  const tracks = overrides.tracks ?? [
    makeTrack({
      id: "box-opacity",
      property: "opacity",
      keyframes: [
        { at: 0, value: 1 },
        { at: 1, value: 0.25 },
      ],
    }),
  ];
  return {
    version: 1,
    id: "anim_test",
    name: "Test animation",
    targetKind: "svg",
    duration: 2,
    fps: 60,
    loop: { enabled: false, mode: "restart" } satisfies MotionLoop,
    tracks,
    ...overrides,
  };
}
