import { DOMParser, type Document as XmlDocument, type Element as XmlElement } from "@xmldom/xmldom";
import { describe, expect, it } from "vitest";

import {
  buildAnimatedSvg,
  type MotionDocument,
} from "@/lib/animation";
import { makeDocument, makeGraph, makeTrack } from "./helpers";

function parseXml(svg: string): XmlDocument {
  const errors: string[] = [];
  const document = new DOMParser({
    onError: (level: string, message: string) => {
      if (level === "error" || level === "fatalError") {
        errors.push(message);
      }
    },
  }).parseFromString(svg, "image/svg+xml");
  if (errors.length > 0) throw new Error(errors.join("; "));
  return document;
}

function elements(document: XmlDocument, tag: string): XmlElement[] {
  const list = document.getElementsByTagName(tag);
  const result: XmlElement[] = [];
  for (let i = 0; i < list.length; i++) {
    const element = list.item(i);
    if (element) result.push(element);
  }
  return result;
}

function byId(document: XmlDocument, id: string): XmlElement | undefined {
  return elements(document, "*").find(
    (element) => element.getAttribute("id") === id,
  );
}

function animatedDocument(loop = true): MotionDocument {
  return makeDocument({
    duration: 1,
    loop: { enabled: loop, mode: "restart" },
    tracks: [
      makeTrack({
        id: "box-move",
        property: "translateX",
        easing: "linear",
        keyframes: [
          { at: 0, value: 0 },
          { at: 1, value: 20 },
        ],
      }),
      makeTrack({
        id: "box-fill",
        property: "fill",
        easing: "linear",
        target: { kind: "svg", elementId: "box" },
        keyframes: [
          { at: 0, value: "#000000" },
          { at: 1, value: "#ffffff" },
        ],
      }),
      makeTrack({
        id: "dot-turn",
        property: "rotate",
        easing: "linear",
        target: { kind: "svg", elementId: "dot" },
        keyframes: [
          { at: 0, value: 0 },
          { at: 1, value: 90 },
        ],
      }),
      makeTrack({
        id: "dot-fade",
        property: "opacity",
        easing: "linear",
        target: { kind: "svg", elementId: "dot" },
        keyframes: [
          { at: 0, value: 1 },
          { at: 1, value: 0.5 },
        ],
      }),
    ],
  });
}

describe("buildAnimatedSvg", () => {
  it("exports valid standalone SMIL with transforms and paint", () => {
    const graph = makeGraph();
    const result = buildAnimatedSvg(graph, animatedDocument(), {
      title: "Export test",
    });
    expect(result.warnings).toEqual([]);
    const document = parseXml(result.svg);
    const root = document.documentElement;
    expect(root).not.toBeNull();
    if (!root) throw new Error("missing SVG root");
    expect(root.tagName.toLowerCase()).toBe("svg");
    expect(root.getAttribute("viewBox")).toBe("0 0 100 100");

    const title = document.getElementsByTagName("title").item(0);
    expect(title?.textContent).toBe("Export test");

    const wrappers = elements(document, "g").filter(
      (element) => element.getAttribute("data-anitoon-motion") !== null,
    );
    expect(wrappers).toHaveLength(2);
    expect(wrappers.map((element) => element.getAttribute("data-anitoon-motion")).sort()).toEqual([
      "box",
      "dot",
    ]);

    const transforms = elements(document, "animateTransform");
    // box: translate; dot: pivot-compensating translate + rotate.
    expect(transforms).toHaveLength(3);
    for (const animation of transforms) {
      expect(animation.getAttribute("attributeName")).toBe("transform");
      expect(animation.getAttribute("calcMode")).toBe("linear");
      expect(animation.getAttribute("repeatCount")).toBe("indefinite");
      expect(animation.getAttribute("fill")).toBe("freeze");
      expect(animation.getAttribute("dur")).toBe("1s");
      expect(animation.getAttribute("type")).not.toBe("matrix");
      const values = (animation.getAttribute("values") ?? "").split(";");
      expect(values).toHaveLength(61);
      expect(values.some((value) => /matrix\(/i.test(value))).toBe(false);
    }
    const translateAnimations = transforms.filter(
      (animation) => animation.getAttribute("type") === "translate",
    );
    const rotateAnimation = transforms.find(
      (animation) => animation.getAttribute("type") === "rotate",
    );
    const boxTranslateValues = (
      translateAnimations[0]?.getAttribute("values") ?? ""
    ).split(";");
    expect(boxTranslateValues[0]).toBe("0 0");
    expect(boxTranslateValues[60]).toBe("20 0");
    const rotateValues = (rotateAnimation?.getAttribute("values") ?? "").split(";");
    expect(rotateValues[0]).toBe("0");
    expect(rotateValues[60]).toBe("90");

    const animations = elements(document, "animate");
    const fillAnimation = animations.find(
      (animation) => animation.getAttribute("attributeName") === "fill",
    );
    const opacityAnimation = animations.find(
      (animation) => animation.getAttribute("attributeName") === "opacity",
    );
    expect(fillAnimation).toBeDefined();
    expect(opacityAnimation).toBeDefined();
    const fillValues = (fillAnimation?.getAttribute("values") ?? "").split(";");
    expect(fillValues[0]).toBe("#000000");
    expect(fillValues[fillValues.length - 1]).toBe("#ffffff");
    const opacityValues = (opacityAnimation?.getAttribute("values") ?? "").split(";");
    expect(opacityValues[0]).toBe("1");
    expect(opacityValues[opacityValues.length - 1]).toBe("0.5");

    expect(byId(document, "box")?.getAttribute("fill")).toBe("#ff0000");
    expect(byId(document, "line")?.getAttribute("d")).toBe("M 0 0 L 40 0");
    expect(byId(document, "label")).toBeDefined();
  });

  it("exports additive sequential same-property tracks", () => {
    const graph = makeGraph();
    const doc = makeDocument({
      duration: 3,
      loop: { enabled: false },
      tracks: [
        makeTrack({
          id: "shake",
          property: "translateX",
          easing: "linear",
          delay: 0,
          duration: 0.7,
          keyframes: [
            { at: 0, value: 0 },
            { at: 0.5, value: -8 },
            { at: 1, value: 0 },
          ],
        }),
        makeTrack({
          id: "launch",
          property: "translateX",
          easing: "linear",
          delay: 0.7,
          duration: 2.3,
          keyframes: [
            { at: 0, value: 0 },
            { at: 1, value: 10 },
          ],
        }),
      ],
    });
    const { svg } = buildAnimatedSvg(graph, doc);
    const document = parseXml(svg);
    const animation = elements(document, "animateTransform")[0];
    expect(animation.getAttribute("type")).toBe("translate");
    const values = (animation.getAttribute("values") ?? "").split(";");
    expect(values[21]).toBe("-8 0");
    expect(values[150]).toBe("7.826087 0");
  });

  it("uses repeatCount=1 for non-looping documents", () => {
    const graph = makeGraph();
    const result = buildAnimatedSvg(graph, animatedDocument(false));
    const document = parseXml(result.svg);
    const animations = [
      ...elements(document, "animate"),
      ...elements(document, "animateTransform"),
    ];
    expect(animations.length).toBeGreaterThan(0);
    expect(
      animations.every(
        (animation) => animation.getAttribute("repeatCount") === "1",
      ),
    ).toBe(true);
  });

  it("warns about pingpong even when looping is disabled", () => {
    const graph = makeGraph();
    const doc = makeDocument({
      loop: { enabled: false, mode: "pingpong" },
      tracks: [makeTrack({ id: "move", property: "translateX" })],
    });
    const { warnings } = buildAnimatedSvg(graph, doc);
    expect(warnings.some((warning) => /ping[\s-]?pong/i.test(warning))).toBe(
      true,
    );
  });

  it("emits strokeDraw via pathLength and dash animation", () => {
    const graph = makeGraph();
    const doc = makeDocument({
      tracks: [
        makeTrack({
          id: "draw",
          property: "strokeDraw",
          target: { kind: "svg", elementId: "line" },
          easing: "linear",
          keyframes: [
            { at: 0, value: 0 },
            { at: 1, value: 1 },
          ],
        }),
      ],
    });
    const { svg, warnings } = buildAnimatedSvg(graph, doc);
    expect(warnings).toEqual([]);
    const document = parseXml(svg);
    const line = byId(document, "line");
    expect(line?.getAttribute("pathLength")).toBe("1");
    expect(line?.getAttribute("stroke-dasharray")).toBe("1 1");
    const animations = elements(document, "animate");
    expect(
      animations.some(
        (animation) =>
          animation.getAttribute("attributeName") === "stroke-dashoffset",
      ),
    ).toBe(true);
    expect(
      animations.some(
        (animation) =>
          animation.getAttribute("attributeName") === "stroke-dasharray",
      ),
    ).toBe(true);
    const offset = animations.find(
      (animation) =>
        animation.getAttribute("attributeName") === "stroke-dashoffset",
    );
    const values = (offset?.getAttribute("values") ?? "").split(";");
    expect(values[0]).toBe("1");
    expect(values[values.length - 1]).toBe("0");
  });

  it("warns for text targets while preserving the artwork", () => {
    const graph = makeGraph();
    const doc = makeDocument({
      tracks: [
        makeTrack({
          id: "label-move",
          property: "translateX",
          target: { kind: "svg", elementId: "label" },
        }),
      ],
    });
    const { svg, warnings } = buildAnimatedSvg(graph, doc);
    expect(warnings.some((warning) => /text/i.test(warning))).toBe(true);
    const document = parseXml(svg);
    expect(byId(document, "label")?.textContent).toBe("Hi");
  });

  it("warns for missing, unsupported and out-of-duration tracks", () => {
    const graph = makeGraph();
    const doc = makeDocument({
      duration: 1,
      tracks: [
        makeTrack({
          id: "ghost",
          property: "translateX",
          target: { kind: "svg", elementId: "ghost" },
        }),
        makeTrack({
          id: "too-long",
          property: "translateX",
          delay: 0.5,
          duration: 1,
        }),
      ],
    });
    const { warnings } = buildAnimatedSvg(graph, doc);
    expect(warnings.some((warning) => /ghost/.test(warning))).toBe(true);
    expect(warnings.some((warning) => /ends after/.test(warning))).toBe(true);
  });

  it("warns for character documents and returns unanimated valid SVG", () => {
    const graph = makeGraph();
    const doc = makeDocument({
      targetKind: "character",
      tracks: [
        makeTrack({
          id: "head-turn",
          property: "rotate",
          target: { kind: "character", actorId: "hero", boneId: "head" },
        }),
      ],
    });
    const { svg, warnings } = buildAnimatedSvg(graph, doc);
    expect(warnings.some((warning) => /character/i.test(warning))).toBe(true);
    const document = parseXml(svg);
    expect(elements(document, "animate")).toHaveLength(0);
    expect(byId(document, "box")).toBeDefined();
  });

  it("adds a background rect and keeps output deterministic", () => {
    const graph = makeGraph();
    const first = buildAnimatedSvg(graph, animatedDocument(), {
      background: "#ffffff",
    });
    const second = buildAnimatedSvg(graph, animatedDocument(), {
      background: "#ffffff",
    });
    expect(second.svg).toBe(first.svg);
    const document = parseXml(first.svg);
    const backgrounds = elements(document, "rect").filter(
      (element) => element.getAttribute("data-anitoon-background") === "true",
    );
    expect(backgrounds).toHaveLength(1);
    expect(backgrounds[0].getAttribute("fill")).toBe("#ffffff");
  });

  it("omits muted tracks with a warning", () => {
    const graph = makeGraph();
    const doc = makeDocument({
      tracks: [
        makeTrack({
          id: "muted",
          property: "translateX",
          muted: true,
          target: { kind: "svg", elementId: "box" },
        }),
      ],
    });
    const { svg, warnings } = buildAnimatedSvg(graph, doc);
    expect(warnings.some((warning) => /muted/i.test(warning))).toBe(true);
    const document = parseXml(svg);
    expect(elements(document, "animateTransform")).toHaveLength(0);
  });
});
