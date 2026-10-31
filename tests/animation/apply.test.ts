import { describe, expect, it } from "vitest";

import {
  applySvgEvaluation,
  evaluateDocument,
} from "@/lib/animation";
import { makeDocument, makeGraph, makeTrack } from "./helpers";

class FakeStyle {
  private readonly values = new Map<
    string,
    { value: string; priority: string }
  >();

  getPropertyValue(name: string): string {
    return this.values.get(name)?.value ?? "";
  }

  getPropertyPriority(name: string): string {
    return this.values.get(name)?.priority ?? "";
  }

  setProperty(name: string, value: string, priority = ""): void {
    this.values.set(name, { value, priority });
  }

  removeProperty(name: string): string {
    const previous = this.values.get(name)?.value ?? "";
    this.values.delete(name);
    return previous;
  }
}

class FakeElement {
  readonly style = new FakeStyle();
  private readonly attributes = new Map<string, string>();

  constructor(
    readonly tagName: string,
    attributes: Record<string, string> = {},
  ) {
    for (const [key, value] of Object.entries(attributes)) {
      this.attributes.set(key, value);
    }
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, String(value));
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
}

class FakeRoot extends FakeElement {
  constructor(private readonly children: FakeElement[]) {
    super("svg", { id: "root", xmlns: "http://www.w3.org/2000/svg" });
  }

  getElementsByTagName(tag: string): FakeElement[] {
    if (tag === "*") return this.children;
    return this.children.filter(
      (element) => element.tagName.toLowerCase() === tag.toLowerCase(),
    );
  }
}

function asRoot(root: FakeRoot): SVGSVGElement {
  return root as unknown as SVGSVGElement;
}

describe("applySvgEvaluation", () => {
  it("applies transform, opacity and paint, then restores authored values", () => {
    const graph = makeGraph();
    const box = new FakeElement("rect", {
      id: "box",
      transform: "translate(5 5)",
      opacity: "0.75",
      fill: "#ff0000",
    });
    const line = new FakeElement("path", {
      id: "line",
      "stroke-dasharray": "4 2",
    });
    const root = new FakeRoot([box, line]);

    const doc = makeDocument({
      tracks: [
        makeTrack({
          id: "box-move",
          property: "translateX",
          easing: "linear",
          keyframes: [
            { at: 0, value: 0 },
            { at: 1, value: 10 },
          ],
        }),
        makeTrack({
          id: "box-fade",
          property: "opacity",
          easing: "linear",
          keyframes: [
            { at: 0, value: 1 },
            { at: 1, value: 0.5 },
          ],
        }),
      ],
    });

    applySvgEvaluation(asRoot(root), graph, evaluateDocument(doc, 1));
    expect(box.getAttribute("transform")).toBe(
      "translate(5 5) matrix(1 0 0 1 5 0)",
    );
    expect(box.getAttribute("opacity")).toBe("0.75");
    expect(box.style.getPropertyValue("opacity")).toBe("0.75");
    expect(box.style.getPropertyPriority("opacity")).toBe("important");
    expect(box.getAttribute("fill")).toBe("#ff0000");

    const fillDoc = makeDocument({
      tracks: [
        makeTrack({
          id: "box-fill",
          property: "fill",
          easing: "linear",
          keyframes: [
            { at: 0, value: "#000000" },
            { at: 1, value: "#ffffff" },
          ],
        }),
      ],
    });
    applySvgEvaluation(asRoot(root), graph, evaluateDocument(fillDoc, 1));
    expect(box.getAttribute("transform")).toBe("translate(5 5)");
    expect(box.getAttribute("opacity")).toBe("0.75");
    expect(box.style.getPropertyValue("opacity")).toBe("");
    expect(box.getAttribute("fill")).toBe("#808080");
    expect(box.style.getPropertyValue("fill")).toBe("#808080");

    applySvgEvaluation(asRoot(root), graph, {
      time: 0,
      duration: 2,
      targets: {},
      localTime: 0,
      loopIteration: 0,
    });
    expect(box.getAttribute("fill")).toBe("#ff0000");
    expect(box.style.getPropertyValue("fill")).toBe("");
  });

  it("uses pathLength=1 for strokeDraw and restores dash settings", () => {
    const graph = makeGraph();
    const line = new FakeElement("path", {
      id: "line",
      pathLength: "100",
      "stroke-dasharray": "4 2",
    });
    const root = new FakeRoot([line]);

    const drawDoc = makeDocument({
      tracks: [
        makeTrack({
          id: "line-draw",
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
    applySvgEvaluation(asRoot(root), graph, evaluateDocument(drawDoc, 1));
    expect(line.getAttribute("pathLength")).toBe("1");
    expect(line.getAttribute("stroke-dasharray")).toBe("1 1");
    expect(line.getAttribute("stroke-dashoffset")).toBe("0.5");
    expect(line.style.getPropertyValue("stroke-dashoffset")).toBe("0.5");

    applySvgEvaluation(asRoot(root), graph, {
      time: 0,
      duration: 2,
      targets: {},
      localTime: 0,
      loopIteration: 0,
    });
    expect(line.getAttribute("pathLength")).toBe("100");
    expect(line.getAttribute("stroke-dasharray")).toBe("4 2");
    expect(line.getAttribute("stroke-dashoffset")).toBeNull();
    expect(line.style.getPropertyValue("stroke-dashoffset")).toBe("");
  });

  it("ignores missing DOM targets", () => {
    const graph = makeGraph();
    const root = new FakeRoot([]);
    const doc = makeDocument({
      tracks: [
        makeTrack({
          id: "box-move",
          property: "translateX",
          target: { kind: "svg", elementId: "box" },
        }),
      ],
    });
    expect(() =>
      applySvgEvaluation(asRoot(root), graph, evaluateDocument(doc, 1)),
    ).not.toThrow();
  });
});
