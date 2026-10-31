import { describe, expect, it } from "vitest";

import {
  getSceneElement,
  importSvg,
  parseTransform,
  type ImportResult,
  type SceneGraph,
} from "@/lib/svg";

function expectOk(result: ImportResult): SceneGraph {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.graph;
}

describe("parseTransform", () => {
  it("composes translate and scale left-to-right", () => {
    expect(parseTransform("translate(10 20) scale(2)")).toEqual([2, 0, 0, 2, 10, 20]);
  });

  it("parses rotate and matrix functions", () => {
    const rotate = parseTransform("rotate(90)");
    expect(rotate[0]).toBeCloseTo(0, 6);
    expect(rotate[1]).toBeCloseTo(1, 6);
    expect(rotate[2]).toBeCloseTo(-1, 6);
    expect(rotate[3]).toBeCloseTo(0, 6);

    const aroundPoint = parseTransform("rotate(90 10 10)");
    expect(aroundPoint).toEqual([0, 1, -1, 0, 20, 0]);

    expect(parseTransform("matrix(1 2 3 4 5 6)")).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("accepts signs as separators between transform arguments", () => {
    expect(parseTransform("translate(10-20)")).toEqual([1, 0, 0, 1, 10, -20]);
    expect(parseTransform("scale(2,.5)")).toEqual([2, 0, 0, 0.5, 0, 0]);
  });

  it("returns identity for absent or malformed transforms", () => {
    for (const value of [null, undefined, "", "none", "garbage", "translate(1) rotate()", "scale(1) nope"]) {
      expect(parseTransform(value)).toEqual([1, 0, 0, 1, 0, 0]);
    }
  });
});

describe("bounding boxes", () => {
  it("computes shape bounds", () => {
    const graph = expectOk(
      importSvg(`
        <svg viewBox="0 0 100 100">
          <rect id="rect" x="10" y="20" width="30" height="40"/>
          <circle id="circle" cx="50" cy="50" r="5"/>
          <ellipse id="ellipse" cx="20" cy="20" rx="4" ry="2"/>
          <line id="line" x1="1" y1="2" x2="9" y2="6"/>
          <polygon id="polygon" points="0,0 10,0 10,10"/>
          <path id="path" d="M0 0 H10 V10 Z"/>
        </svg>`),
    );
    expect(getSceneElement(graph, "rect")?.localBBox).toEqual({ x: 10, y: 20, w: 30, h: 40 });
    expect(getSceneElement(graph, "circle")?.localBBox).toEqual({ x: 45, y: 45, w: 10, h: 10 });
    expect(getSceneElement(graph, "ellipse")?.localBBox).toEqual({ x: 16, y: 18, w: 8, h: 4 });
    expect(getSceneElement(graph, "line")?.localBBox).toEqual({ x: 1, y: 2, w: 8, h: 4 });
    expect(getSceneElement(graph, "polygon")?.localBBox).toEqual({ x: 0, y: 0, w: 10, h: 10 });
    expect(getSceneElement(graph, "path")?.localBBox).toEqual({ x: 0, y: 0, w: 10, h: 10 });
  });

  it("clamps non-finite geometry values to zero", () => {
    const graph = expectOk(
      importSvg(`
        <svg viewBox="0 0 10 10">
          <rect id="bad" x="NaN" y="Infinity" width="-4" height="1e999"
            transform="translate(Infinity 0)"/>
        </svg>`),
    );
    const bad = getSceneElement(graph, "bad");
    expect(bad?.bbox).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    expect(bad?.matrix).toEqual([1, 0, 0, 1, 0, 0]);
  });

  it("computes curve extrema and relative path bounds", () => {
    const graph = expectOk(
      importSvg(`
        <svg viewBox="0 0 100 100">
          <path id="curve" d="M0 0 C 0 10 10 10 10 0"/>
          <path id="relative" d="m10 10 l5 0 l0 5 z"/>
          <path id="implicit" d="M1 1 6 1 6 4"/>
          <path id="arc" d="M0 0 A10 10 0 0 1 20 0"/>
        </svg>`),
    );
    const curve = getSceneElement(graph, "curve")?.localBBox;
    expect(curve?.x).toBeCloseTo(0, 4);
    expect(curve?.w).toBeCloseTo(10, 4);
    expect(curve?.h).toBeCloseTo(7.5, 4);
    expect(getSceneElement(graph, "relative")?.localBBox).toEqual({ x: 10, y: 10, w: 5, h: 5 });
    expect(getSceneElement(graph, "implicit")?.localBBox).toEqual({ x: 1, y: 1, w: 5, h: 3 });
    const arc = getSceneElement(graph, "arc")?.localBBox;
    expect(arc?.w).toBeCloseTo(20, 4);
    expect(arc?.h).toBeCloseTo(10, 4);
  });

  it("unions group children and applies ancestor transforms", () => {
    const graph = expectOk(
      importSvg(`
        <svg viewBox="0 0 100 100">
          <g id="outer" transform="translate(10 10)">
            <g id="inner" transform="scale(2)">
              <rect id="a" x="0" y="0" width="5" height="5"/>
              <rect id="b" x="10" y="0" width="5" height="5"/>
            </g>
          </g>
        </svg>`),
    );
    const inner = getSceneElement(graph, "inner");
    const outer = getSceneElement(graph, "outer");
    expect(inner?.localBBox).toEqual({ x: 0, y: 0, w: 15, h: 5 });
    expect(inner?.bbox).toEqual({ x: 10, y: 10, w: 30, h: 10 });
    expect(outer?.localBBox).toEqual({ x: 0, y: 0, w: 30, h: 10 });
    expect(outer?.bbox).toEqual({ x: 10, y: 10, w: 30, h: 10 });
  });

  it("ignores empty groups when unioning an ancestor box", () => {
    const graph = expectOk(
      importSvg(`
        <svg viewBox="0 0 100 100">
          <g id="outer" transform="translate(50 50)">
            <g id="empty"/>
            <rect id="content" x="10" y="10" width="5" height="5"/>
          </g>
        </svg>`),
    );
    expect(getSceneElement(graph, "empty")?.localBBox).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    expect(getSceneElement(graph, "outer")?.localBBox).toEqual({ x: 10, y: 10, w: 5, h: 5 });
    expect(getSceneElement(graph, "outer")?.bbox).toEqual({ x: 60, y: 60, w: 5, h: 5 });
  });

  it("does not let nested definitions expand a visible group", () => {
    const graph = expectOk(
      importSvg(`
        <svg viewBox="0 0 100 100">
          <g id="outer" transform="translate(10 10)">
            <defs><path id="definition-path" d="M0 0 L100 100"/></defs>
            <rect id="content" x="0" y="0" width="5" height="5"/>
          </g>
        </svg>`),
    );
    expect(getSceneElement(graph, "outer")?.localBBox).toEqual({ x: 0, y: 0, w: 5, h: 5 });
    expect(getSceneElement(graph, "outer")?.bbox).toEqual({ x: 10, y: 10, w: 5, h: 5 });
  });

  it("handles rotation as an axis-aligned bounding box", () => {
    const graph = expectOk(
      importSvg(`
        <svg viewBox="-50 -50 100 100">
          <rect id="rotated" x="0" y="0" width="10" height="10" transform="rotate(90)"/>
        </svg>`),
    );
    expect(getSceneElement(graph, "rotated")?.bbox).toEqual({ x: -10, y: 0, w: 10, h: 10 });
  });

  it("estimates text bounds without a browser", () => {
    const graph = expectOk(
      importSvg(`
        <svg viewBox="0 0 100 100">
          <text id="label" x="50" y="30" font-size="10" text-anchor="middle">Hi</text>
        </svg>`),
    );
    const label = getSceneElement(graph, "label");
    expect(label?.text).toBe("Hi");
    expect(label?.computedStyle.fontSize).toBe(10);
    expect(label?.localBBox.w).toBeCloseTo(11, 4);
    expect(label?.localBBox.h).toBeCloseTo(11.5, 4);
    expect(label?.localBBox.x).toBeCloseTo(44.5, 4);
    expect(label?.localBBox.y).toBeCloseTo(22, 4);
  });
});

describe("computed styles", () => {
  it("inherits presentation attributes and lets inline style win", () => {
    const graph = expectOk(
      importSvg(`
        <svg viewBox="0 0 100 100" fill="#112233" stroke-width="4">
          <g id="group" fill="#445566" opacity="0.5">
            <rect id="child" width="10" height="10" stroke="#abcdef" style="fill: #998877"/>
          </g>
        </svg>`),
    );
    const group = getSceneElement(graph, "group");
    const child = getSceneElement(graph, "child");
    expect(group?.style.fill).toBe("#445566");
    expect(group?.computedStyle.fill).toBe("#445566");
    expect(group?.computedStyle.strokeWidth).toBe(4);
    expect(group?.computedStyle.opacity).toBe(0.5);
    expect(child?.style.fill).toBe("#998877");
    expect(child?.computedStyle.fill).toBe("#998877");
    expect(child?.computedStyle.stroke).toBe("#abcdef");
    expect(child?.computedStyle.strokeWidth).toBe(4);
    // CSS opacity is not inherited; the group applies it to the whole subtree.
    expect(child?.computedStyle.opacity).toBe(1);
  });
});
