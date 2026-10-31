import { describe, expect, it } from "vitest";

import {
  getSceneAncestors,
  getSceneChildren,
  getSceneElement,
  importSvg,
  sceneToContext,
  type ImportResult,
  type SceneGraph,
} from "@/lib/svg";

const ROCKET = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="400" height="400">
  <title>Rocket Launch</title>
  <g id="rocket" aria-label="Rocket" transform="translate(100 100)">
    <path id="body" d="M0 0 L20 0 L20 60 L0 60 Z" fill="#eeeeee" stroke="#333333"/>
    <g id="flame" data-name="Flame">
      <path id="flame-inner" d="M5 60 L15 60 L10 90 Z" fill="orange"/>
    </g>
  </g>
</svg>`;

function expectOk(result: ImportResult): SceneGraph {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.graph;
}

describe("importSvg - valid artwork", () => {
  it("imports nested groups, preserves ids and computes transforms", () => {
    const graph = expectOk(importSvg(ROCKET, { filename: "rocket.svg" }));

    expect(graph.title).toBe("Rocket Launch");
    expect(graph.filename).toBe("rocket.svg");
    expect(graph.viewBox).toEqual({ minX: 0, minY: 0, width: 200, height: 200 });
    expect(graph.width).toBe(400);
    expect(graph.height).toBe(400);
    expect(graph.rootIds).toEqual(["rocket"]);

    const rocket = getSceneElement(graph, "rocket");
    const body = getSceneElement(graph, "body");
    const flame = getSceneElement(graph, "flame");
    const inner = getSceneElement(graph, "flame-inner");
    expect(rocket).toBeDefined();
    expect(body).toBeDefined();
    expect(flame).toBeDefined();
    expect(inner).toBeDefined();
    if (!rocket || !body || !flame || !inner) return;

    expect(rocket.parentId).toBeNull();
    expect(rocket.depth).toBe(0);
    expect(rocket.childIds).toEqual(["body", "flame"]);
    expect(body.depth).toBe(1);
    expect(flame.depth).toBe(1);
    expect(inner.depth).toBe(2);
    expect(graph.order).toEqual(["rocket", "body", "flame", "flame-inner"]);
    expect([rocket.order, body.order, flame.order, inner.order]).toEqual([0, 1, 2, 3]);

    expect(rocket.transform).toBe("translate(100 100)");
    expect(rocket.matrix).toEqual([1, 0, 0, 1, 100, 100]);
    expect(body.localBBox).toEqual({ x: 0, y: 0, w: 20, h: 60 });
    expect(body.bbox).toEqual({ x: 100, y: 100, w: 20, h: 60 });
    expect(flame.localBBox).toEqual({ x: 5, y: 60, w: 10, h: 30 });
    expect(flame.bbox).toEqual({ x: 105, y: 160, w: 10, h: 30 });
    expect(rocket.localBBox).toEqual({ x: 0, y: 0, w: 20, h: 90 });
    expect(rocket.bbox).toEqual({ x: 100, y: 100, w: 20, h: 90 });
    expect(rocket.center).toEqual({ x: 110, y: 145 });
  });

  it("separates authored and inferred semantics", () => {
    const graph = expectOk(importSvg(ROCKET));
    const rocket = getSceneElement(graph, "rocket");
    const flame = getSceneElement(graph, "flame");
    const body = getSceneElement(graph, "body");
    expect(rocket?.semantic.source).toBe("authored");
    expect(rocket?.semantic.label).toBe("Rocket");
    expect(rocket?.semantic.role).toBe("rocket");
    expect(rocket?.semantic.tags).toContain("rocket");
    expect(rocket?.semantic.confidence).toBeGreaterThan(0.9);
    expect(flame?.semantic.source).toBe("authored");
    expect(flame?.semantic.label).toBe("Flame");
    expect(flame?.semantic.tags).toContain("flame");
    expect(body?.semantic.source).toBe("heuristic");
    expect(body?.semantic.tags).toContain("body");
    expect(body?.semantic.confidence).toBeLessThan(0.8);
  });

  it("serializes a safe SVG containing the resolved ids and geometry", () => {
    const graph = expectOk(importSvg(ROCKET));
    expect(graph.sanitizedSvg).toContain('id="rocket"');
    expect(graph.sanitizedSvg).toContain('id="flame-inner"');
    expect(graph.sanitizedSvg).toContain('d="M0 0 L20 0 L20 60 L0 60 Z"');
    expect(graph.sanitizedSvg).toContain('transform="translate(100 100)"');
    expect(graph.sanitizedSvg).toContain("http://www.w3.org/2000/svg");
    expect(graph.sanitizedSvg).not.toContain("<title");
    expect(graph.stats.elementCount).toBe(4);
    expect(graph.stats.animatableCount).toBe(4);
    expect(graph.stats.groupCount).toBe(2);
    expect(graph.stats.removedNodeCount).toBe(0);
  });

  it("supports prefixed SVG documents without losing the namespace binding", () => {
    const graph = expectOk(
      importSvg(`
        <svg:svg xmlns:svg="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
          <svg:rect id="prefixed" width="5" height="5"/>
        </svg:svg>`),
    );
    expect(graph.rootIds).toEqual(["prefixed"]);
    expect(graph.sanitizedSvg).toContain("xmlns:svg");
    expect(graph.sanitizedSvg).toContain("prefixed");
  });

  it("is idempotent when the sanitized SVG is imported again", () => {
    const first = expectOk(importSvg(ROCKET));
    const second = expectOk(importSvg(first.sanitizedSvg));
    expect(second.rootIds).toEqual(first.rootIds);
    expect(second.order).toEqual(first.order);
    expect(second.sanitizedSvg).toBe(first.sanitizedSvg);
    expect(second.warnings).toEqual([]);
  });
});

describe("importSvg - stable generated ids", () => {
  const UNNAMED = `
    <svg viewBox="0 0 100 100">
      <g>
        <rect x="10" y="10" width="20" height="10"/>
        <circle cx="5" cy="5" r="4"/>
      </g>
    </svg>`;

  it("generates deterministic ids for unnamed elements", () => {
    const graph = expectOk(importSvg(UNNAMED));
    expect(graph.rootIds).toEqual(["g-1"]);
    expect(graph.order).toEqual(["g-1", "rect-1", "circle-1"]);
    expect(getSceneElement(graph, "g-1")?.childIds).toEqual(["rect-1", "circle-1"]);
    expect(getSceneElement(graph, "g-1")?.semantic.source).toBe("heuristic");
    expect(getSceneElement(graph, "g-1")?.name).toBe("g-1");

    const again = expectOk(importSvg(UNNAMED));
    expect(again.order).toEqual(graph.order);
  });

  it("resolves duplicate and unsafe ids and keeps internal references working", () => {
    const source = `
      <svg viewBox="0 0 20 20">
        <defs>
          <linearGradient id="my.grad">
            <stop offset="0" stop-color="red"/>
            <stop offset="1" stop-color="blue"/>
          </linearGradient>
        </defs>
        <path id="leaf" d="M0 0 L1 0 L1 1 Z" fill="url(#my.grad)"/>
        <path id="leaf" d="M0 0 L2 0 L2 2 Z"/>
        <path id="1bad" d="M0 0 L3 0 L3 3 Z"/>
        <path id="leaf" d="M0 0 L4 0 L4 4 Z"/>
        <rect id="swatch" width="2" height="2" fill="#1bad"/>
      </svg>`;
    const graph = expectOk(importSvg(source));
    const leaf = getSceneElement(graph, "leaf");
    const second = getSceneElement(graph, "leaf-1");
    const unsafe = getSceneElement(graph, "path-1bad-1");
    const third = getSceneElement(graph, "leaf-2");

    expect(leaf?.originalId).toBeUndefined();
    expect(second?.originalId).toBe("leaf");
    expect(unsafe?.originalId).toBe("1bad");
    expect(third?.originalId).toBe("leaf");
    expect(graph.stats.duplicateIdCount).toBe(2);
    expect(graph.warnings.some((warning) => warning.includes("duplicate"))).toBe(true);
    expect(graph.warnings.some((warning) => warning.includes("unsafe SVG id"))).toBe(true);
    expect(graph.sanitizedSvg).toContain('id="leaf-1"');
    expect(graph.sanitizedSvg).toContain('id="path-1bad-1"');
    expect(graph.sanitizedSvg).toContain('fill="url(#my-grad-1)"');
    expect(graph.sanitizedSvg).toContain('id="my-grad-1"');
    expect(graph.sanitizedSvg).toContain('fill="#1bad"');

    const ids = graph.order;
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("importSvg - viewBox and dimensions", () => {
  it("falls back to width and height when viewBox is absent", () => {
    const graph = expectOk(
      importSvg('<svg width="200" height="100"><rect width="10" height="10"/></svg>'),
    );
    expect(graph.viewBox).toEqual({ minX: 0, minY: 0, width: 200, height: 100 });
    expect(graph.width).toBe(200);
    expect(graph.height).toBe(100);
  });

  it("uses viewBox dimensions when width and height are missing", () => {
    const graph = expectOk(
      importSvg('<svg viewBox="10 20 300 400"><circle cx="10" cy="20" r="5"/></svg>'),
    );
    expect(graph.viewBox).toEqual({ minX: 10, minY: 20, width: 300, height: 400 });
    expect(graph.width).toBe(300);
    expect(graph.height).toBe(400);
  });

  it("falls back from invalid dimensions to the SVG defaults", () => {
    const graph = expectOk(importSvg('<svg viewBox="0 0 -1 100"><rect width="5" height="5"/></svg>'));
    expect(graph.viewBox).toEqual({ minX: 0, minY: 0, width: 300, height: 150 });
    expect(graph.width).toBe(300);
    expect(graph.height).toBe(150);
  });

  it("ignores percentage sizes for the metadata dimensions", () => {
    const graph = expectOk(
      importSvg('<svg viewBox="0 0 64 32" width="100%"><rect width="5" height="5"/></svg>'),
    );
    expect(graph.width).toBe(64);
    expect(graph.height).toBe(32);
  });
});

describe("scene traversal", () => {
  it("returns children, ancestors and unknown ids predictably", () => {
    const graph = expectOk(importSvg(ROCKET));
    expect(getSceneChildren(graph, null).map((element) => element.id)).toEqual(["rocket"]);
    expect(getSceneChildren(graph, "rocket").map((element) => element.id)).toEqual([
      "body",
      "flame",
    ]);
    expect(getSceneChildren(graph, "missing")).toEqual([]);
    expect(getSceneAncestors(graph, "flame-inner").map((element) => element.id)).toEqual([
      "rocket",
      "flame",
    ]);
    expect(getSceneAncestors(graph, "rocket")).toEqual([]);
    expect(getSceneAncestors(graph, "missing")).toEqual([]);
    expect(getSceneElement(graph, "missing")).toBeUndefined();
  });
});

describe("sceneToContext", () => {
  function manyRects(count: number): string {
    const rects = Array.from(
      { length: count },
      (_, index) => `<rect x="${index + 0.12345}" y="1" width="2" height="3" id="rect-${index + 1}"/>`,
    ).join("");
    return `<svg viewBox="0 0 200 200">${rects}</svg>`;
  }

  it("truncates to 120 elements by default and marks selection and animation", () => {
    const graph = expectOk(importSvg(manyRects(130)));
    const context = sceneToContext(graph, {
      selectedElementIds: ["rect-5"],
      animatedElementIds: ["rect-7"],
    });

    expect(context.elements).toHaveLength(120);
    expect(context.truncated).toBe(true);
    expect(context.elementCount).toBe(130);
    expect(context.animatableCount).toBe(130);
    expect(context.elements[0].id).toBe("rect-1");
    expect(context.elements[0].bbox).toEqual({ x: 0.12, y: 1, w: 2, h: 3 });
    expect(context.elements.find((element) => element.id === "rect-5")?.selected).toBe(true);
    expect(context.elements.find((element) => element.id === "rect-7")?.animated).toBe(true);
    expect(context.elements.find((element) => element.id === "rect-7")?.selected).toBeUndefined();
  });

  it("respects custom limits and skips definitions", () => {
    const source = `
      <svg viewBox="0 0 20 20">
        <defs>
          <linearGradient id="grad"><stop offset="0" stop-color="red"/></linearGradient>
          <clipPath id="clip"><rect width="10" height="10"/></clipPath>
        </defs>
        <rect width="10" height="10" fill="url(#grad)"/>
      </svg>`;
    const graph = expectOk(importSvg(source));
    expect(graph.stats.elementCount).toBe(6);
    expect(graph.stats.animatableCount).toBe(1);
    const context = sceneToContext(graph, { maxElements: 5 });
    expect(context.elements.map((element) => element.id)).toEqual(["rect-2"]);
    expect(context.truncated).toBe(false);

    const empty = sceneToContext(graph, { maxElements: 0 });
    expect(empty.elements).toEqual([]);
    expect(empty.truncated).toBe(true);
  });
});
