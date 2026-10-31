import { DOMParser, type Document as XmlDocument, type Element as XmlElement } from "@xmldom/xmldom";
import { describe, expect, it } from "vitest";

import {
  buildAnimatedSvg,
  validateMotionDocument,
  type MotionDocument,
} from "@/lib/animation";
import { importSvg, type SceneGraph } from "@/lib/svg";

import { readSvgFixture } from "../fixtures/load";

function importGraph(filename: string): SceneGraph {
  const result = importSvg(readSvgFixture(filename), { filename });
  if (!result.ok) {
    throw new Error(`Fixture ${filename} failed to import: ${result.error.code} ${result.error.message}`);
  }
  return result.graph;
}

function validateOrThrow(doc: MotionDocument, graph: SceneGraph): MotionDocument {
  const result = validateMotionDocument(doc, {
    targetKind: "svg",
    elementIds: new Set(graph.order),
  });
  if (!result.ok) {
    throw new Error(
      `Export fixture document failed validation: ${result.errors
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  if (!result.document) throw new Error("Validated export document was not normalized");
  return result.document;
}

function rocketExportDocument(): MotionDocument {
  return {
    version: 1,
    id: "anim_export_rocket",
    name: "Rocket launch export",
    targetKind: "svg",
    duration: 3.2,
    fps: 60,
    loop: { enabled: true, mode: "restart" },
    tracks: [
      {
        id: "rocket-launch",
        target: { kind: "svg", elementId: "rocket" },
        property: "translateY",
        delay: 0.7,
        duration: 2.2,
        easing: "easeInOut",
        keyframes: [
          { at: 0, value: 0 },
          { at: 0.35, value: -8, easing: "springSoft" },
          { at: 1, value: -420 },
        ],
      },
      {
        id: "rocket-tilt",
        target: { kind: "svg", elementId: "rocket" },
        property: "rotate",
        delay: 0.7,
        duration: 2.2,
        easing: "easeInOut",
        keyframes: [
          { at: 0, value: 0 },
          { at: 0.5, value: -8 },
          { at: 1, value: -18 },
        ],
      },
      {
        id: "rocket-arc",
        target: { kind: "svg", elementId: "rocket" },
        property: "motionPath",
        path: "M 0 0 C 80 -40 180 -180 260 -300",
        orient: true,
        delay: 0.7,
        duration: 2.2,
        easing: "easeInOut",
        keyframes: [
          { at: 0, value: 0 },
          { at: 1, value: 1 },
        ],
      },
    ],
    groups: [
      {
        id: "flames",
        target: { kind: "svg" },
        elementIds: ["flame-1", "flame-2", "flame-3"],
        property: "scaleY",
        step: 0.06,
        delay: 0.8,
        duration: 1.2,
        easing: "springBouncy",
        keyframes: [
          { at: 0, value: 0.65 },
          { at: 0.5, value: 1.35 },
          { at: 1, value: 0.8 },
        ],
      },
      {
        id: "stars",
        target: { kind: "svg" },
        elementIds: ["star-1", "star-2", "star-3", "star-4"],
        property: "opacity",
        step: 0.15,
        delay: 0.2,
        duration: 1.4,
        easing: "easeInOut",
        keyframes: [
          { at: 0, value: 0.35 },
          { at: 0.5, value: 1 },
          { at: 1, value: 0.35 },
        ],
      },
    ],
    meta: { source: "manual" },
  };
}

function plantExportDocument(loopMode: "restart" | "pingpong" = "restart"): MotionDocument {
  return {
    version: 1,
    id: "anim_export_plant",
    name: "Plant sway export",
    targetKind: "svg",
    duration: 3.4,
    fps: 60,
    loop: { enabled: false, mode: loopMode },
    tracks: [
      {
        id: "stem-sway",
        target: { kind: "svg", elementId: "stem" },
        property: "rotate",
        duration: 2.8,
        easing: "easeInOut",
        keyframes: [
          { at: 0, value: 0 },
          { at: 0.25, value: 4 },
          { at: 0.6, value: -3 },
          { at: 1, value: 0 },
        ],
      },
    ],
    groups: [
      {
        id: "leaf-sway",
        target: { kind: "svg" },
        elementIds: ["leaf-1", "leaf-2", "leaf-3"],
        property: "rotate",
        step: 0.12,
        delay: 0.2,
        duration: 1.6,
        easing: "easeInOut",
        keyframes: [
          { at: 0, value: 0 },
          { at: 0.5, value: 8 },
          { at: 1, value: 0 },
        ],
      },
      {
        id: "flower-bloom",
        target: { kind: "svg" },
        elementIds: ["flower-1", "flower-2", "flower-3"],
        property: "scale",
        step: 0.18,
        delay: 0.5,
        duration: 1.8,
        easing: "backOut",
        keyframes: [
          { at: 0, value: 0.85 },
          { at: 0.6, value: 1.08 },
          { at: 1, value: 1 },
        ],
      },
      {
        id: "flower-glow",
        target: { kind: "svg" },
        elementIds: ["flower-1", "flower-2", "flower-3"],
        property: "opacity",
        step: 0.18,
        delay: 0.5,
        duration: 1.8,
        easing: "easeOut",
        keyframes: [
          { at: 0, value: 0.6 },
          { at: 0.5, value: 1 },
          { at: 1, value: 0.9 },
        ],
      },
    ],
    meta: { source: "manual" },
  };
}

function parseSvg(source: string): XmlDocument {
  const errors: string[] = [];
  const document = new DOMParser({
    onError: (level, message) => {
      if (level === "error" || level === "fatalError") errors.push(`${level}: ${message}`);
    },
  }).parseFromString(source, "image/svg+xml");
  if (errors.length > 0) {
    throw new Error(`Animated SVG is not valid XML: ${errors.join("; ")}`);
  }
  return document;
}

function allElements(document: XmlDocument): XmlElement[] {
  const list = document.getElementsByTagName("*");
  const elements: XmlElement[] = [];
  for (let index = 0; index < list.length; index += 1) {
    const element = list.item(index);
    if (element) elements.push(element);
  }
  return elements;
}

function elementsByTag(document: XmlDocument, tag: string): XmlElement[] {
  const list = document.getElementsByTagName(tag);
  const elements: XmlElement[] = [];
  for (let index = 0; index < list.length; index += 1) {
    const element = list.item(index);
    if (element) elements.push(element);
  }
  return elements;
}

function elementById(document: XmlDocument, id: string): XmlElement | undefined {
  return allElements(document).find((element) => element.getAttribute("id") === id);
}

function viewBoxNumbers(value: string | null): number[] {
  if (!value) return [];
  return value
    .trim()
    .split(/[\s,]+/)
    .map((part) => Number(part));
}

function durationSeconds(value: string | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  const numeric = Number.parseFloat(trimmed);
  if (!Number.isFinite(numeric)) return null;
  return /ms$/i.test(trimmed) ? numeric / 1000 : numeric;
}

function expectSafeExport(svg: string) {
  const checks: Array<[string, RegExp]> = [
    ["script tag", /<script[\s>]/i],
    ["foreignObject", /<foreignObject[\s>]/i],
    ["event handler", /\son[a-z]+\s*=/i],
    ["javascript URL", /javascript\s*:/i],
    ["external href", /\s(?:xlink:)?href\s*=\s*["']\s*(?:https?:|\/\/|data:)/i],
    ["external url()", /url\(\s*["']?\s*(?:https?:|\/\/)/i],
    ["external image", /<image[\s>]/i],
  ];
  for (const [label, pattern] of checks) {
    if (pattern.test(svg)) {
      throw new Error(`Animated SVG export still contains ${label}`);
    }
  }
}

function expectExportedGeometryMatchesSource(graph: SceneGraph, outputSvg: string) {
  const sourceDocument = parseSvg(graph.sanitizedSvg);
  const outputDocument = parseSvg(outputSvg);

  const sourcePaths = elementsByTag(sourceDocument, "path").filter(
    (element) => element.getAttribute("id") && element.getAttribute("d"),
  );
  expect(sourcePaths.length).toBeGreaterThan(0);

  for (const sourcePath of sourcePaths) {
    const id = sourcePath.getAttribute("id") as string;
    const outputPath = elementById(outputDocument, id);
    expect(outputPath, `exported SVG lost #${id}`).toBeDefined();
    expect(outputPath?.getAttribute("d"), `exported geometry changed for #${id}`).toBe(
      sourcePath.getAttribute("d"),
    );
  }
}

describe("Animated SVG export", () => {
  it("exports the rocket with valid root, preserved geometry and SMIL animation", () => {
    const graph = importGraph("rocket.svg");
    const document = validateOrThrow(rocketExportDocument(), graph);
    const { svg, warnings } = buildAnimatedSvg(graph, document, { title: "QA rocket" });

    expect(Array.isArray(warnings)).toBe(true);

    const output = parseSvg(svg);
    const root = output.documentElement;
    if (!root) throw new Error("Animated SVG export has no root element");
    expect(root.tagName.toLowerCase()).toBe("svg");
    expect(viewBoxNumbers(root.getAttribute("viewBox"))).toEqual([0, 0, 400, 520]);

    for (const id of ["rocket", "rocket-body", "rocket-window", "flame-1", "flame-3", "star-1"]) {
      expect(elementById(output, id), `exported rocket lost #${id}`).toBeDefined();
    }
    expectExportedGeometryMatchesSource(graph, svg);

    const animations = elementsByTag(output, "animate");
    const transforms = elementsByTag(output, "animateTransform");
    expect(animations.length, "no SMIL <animate> elements emitted").toBeGreaterThan(0);
    expect(transforms.length, "no SMIL <animateTransform> elements emitted").toBeGreaterThan(0);

    const animationElements = [...animations, ...transforms];
    const expectedDurations = new Set<number>([
      document.duration,
      ...document.tracks.map((track) => track.duration ?? document.duration - (track.delay ?? 0)),
    ]);
    for (const animation of animationElements) {
      const duration = durationSeconds(animation.getAttribute("dur"));
      expect(duration, `animation is missing a valid dur attribute: ${animation.toString()}`).not.toBeNull();
      if (duration === null) continue;
      expect(duration).toBeGreaterThan(0);
      expect(
        [...expectedDurations].some((expected) => Math.abs(expected - duration) < 0.001),
        `unexpected SMIL duration ${duration}s; expected one of ${[...expectedDurations].join(", ")}`,
      ).toBe(true);
    }

    // Loop is enabled without an iteration cap, so the export must repeat forever.
    expect(
      animationElements.some((animation) => animation.getAttribute("repeatCount") === "indefinite"),
    ).toBe(true);

    expectSafeExport(svg);
  });

  it("exports the plant with loop disabled and correct repetition", () => {
    const graph = importGraph("plant.svg");
    const document = validateOrThrow(plantExportDocument(), graph);
    const { svg, warnings } = buildAnimatedSvg(graph, document);

    expect(Array.isArray(warnings)).toBe(true);

    const output = parseSvg(svg);
    const root = output.documentElement;
    if (!root) throw new Error("Animated SVG export has no root element");
    expect(root.tagName.toLowerCase()).toBe("svg");
    expect(viewBoxNumbers(root.getAttribute("viewBox"))).toEqual([0, 0, 320, 420]);

    for (const id of ["leaf-1", "leaf-2", "leaf-3", "flower-1", "flower-2", "flower-3", "stem"]) {
      expect(elementById(output, id), `exported plant lost #${id}`).toBeDefined();
    }
    expectExportedGeometryMatchesSource(graph, svg);

    const animations = elementsByTag(output, "animate");
    const transforms = elementsByTag(output, "animateTransform");
    expect(animations.length, "no SMIL <animate> elements emitted").toBeGreaterThan(0);
    expect(transforms.length, "no SMIL <animateTransform> elements emitted").toBeGreaterThan(0);

    const animationElements = [...animations, ...transforms];
    expect(
      animationElements.some((animation) => animation.getAttribute("repeatCount") === "indefinite"),
      "loop is disabled but the export repeats indefinitely",
    ).toBe(false);

    for (const animation of animationElements) {
      const duration = durationSeconds(animation.getAttribute("dur"));
      expect(duration, "animation is missing a valid dur attribute").not.toBeNull();
      if (duration !== null) expect(duration).toBeGreaterThan(0);
    }

    expectSafeExport(svg);
  });

  it("warns when pingpong loop mode cannot be represented in the export", () => {
    const graph = importGraph("plant.svg");
    const document = validateOrThrow(plantExportDocument("pingpong"), graph);
    const { warnings } = buildAnimatedSvg(graph, document);
    expect(warnings.some((warning) => /ping[\s-]?pong/i.test(warning))).toBe(true);
  });

  it("never emits executable or external content", () => {
    const graph = importGraph("rocket.svg");
    const document = validateOrThrow(rocketExportDocument(), graph);
    const { svg } = buildAnimatedSvg(graph, document);
    expectSafeExport(svg);
  });
});
