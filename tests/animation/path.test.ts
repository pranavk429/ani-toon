import { describe, expect, it } from "vitest";

import {
  parsePath,
  pathLength,
  samplePath,
} from "@/lib/animation";

describe("SVG path parsing and sampling", () => {
  it("samples lines and reports tangent angles", () => {
    const sample = samplePath("M 0 0 L 10 0", 0.5);
    expect(sample.x).toBeCloseTo(5, 6);
    expect(sample.y).toBeCloseTo(0, 6);
    expect(sample.angle).toBeCloseTo(0, 6);
    expect(pathLength("M 0 0 L 10 0")).toBeCloseTo(10, 6);

    const down = samplePath("M 0 0 L 0 10", 1);
    expect(down.angle).toBeCloseTo(90, 6);
  });

  it("supports relative commands, H/V and closepath", () => {
    const path = "M 10 10 h 10 v 10 l -10 0 z";
    expect(parsePath(path).closed).toBe(true);
    const start = samplePath(path, 0);
    const end = samplePath(path, 1);
    expect(start.x).toBeCloseTo(10, 6);
    expect(start.y).toBeCloseTo(10, 6);
    expect(end.x).toBeCloseTo(10, 6);
    expect(end.y).toBeCloseTo(10, 6);
    expect(pathLength(path)).toBeCloseTo(10 + 10 + 10 + 10, 5);
  });

  it("samples cubic and quadratic curves", () => {
    const cubic = samplePath("M 0 0 C 0 10 10 10 10 0", 0.5);
    expect(cubic.x).toBeCloseTo(5, 4);
    expect(cubic.y).toBeCloseTo(7.5, 4);
    expect(cubic.angle).toBeCloseTo(0, 4);

    const quadratic = samplePath("M 0 0 Q 5 10 10 0", 0.5);
    expect(quadratic.x).toBeCloseTo(5, 4);
    expect(quadratic.y).toBeCloseTo(5, 4);
  });

  it("supports smooth cubic and quadratic reflection", () => {
    const smoothCubic = samplePath(
      "M 0 0 C 0 10 10 10 10 0 S 20 -10 20 0",
      1,
    );
    expect(smoothCubic.x).toBeCloseTo(20, 4);
    expect(smoothCubic.y).toBeCloseTo(0, 4);

    const smoothQuad = samplePath("M 0 0 Q 5 10 10 0 T 20 0", 1);
    expect(smoothQuad.x).toBeCloseTo(20, 4);
    expect(smoothQuad.y).toBeCloseTo(0, 4);
  });

  it("converts and samples elliptical arcs", () => {
    const sample = samplePath("M 0 0 A 10 10 0 0 1 20 0", 0.5);
    expect(sample.x).toBeCloseTo(10, 2);
    expect(sample.y).toBeCloseTo(-10, 2);

    const length = pathLength("M 0 0 A 10 10 0 0 1 20 0");
    expect(length).toBeGreaterThan(30);
    expect(length).toBeLessThan(32);
  });

  it("clamps progress and handles closed/multiple subpaths", () => {
    expect(samplePath("M 0 0 L 10 0", -1).x).toBeCloseTo(0, 6);
    expect(samplePath("M 0 0 L 10 0", 2).x).toBeCloseTo(10, 6);

    const multi = "M 0 0 L 10 0 M 20 0 L 30 0";
    expect(pathLength(multi)).toBeCloseTo(20, 5);
    const threeQuarters = samplePath(multi, 0.75);
    expect(threeQuarters.x).toBeCloseTo(25, 4);
    expect(threeQuarters.y).toBeCloseTo(0, 4);

    const closed = "M 0 0 L 10 0 L 10 10 Z";
    expect(pathLength(closed)).toBeCloseTo(10 + 10 + Math.hypot(10, 10), 4);
    expect(samplePath(closed, 1).x).toBeCloseTo(0, 4);
  });

  it("rejects malformed paths with useful errors", () => {
    expect(() => parsePath("")).toThrow();
    expect(() => parsePath("L 0 0")).toThrow(/moveto/);
    expect(() => parsePath("M 0 0 L")).toThrow(/expects/);
    expect(() => parsePath("M 0 0 Z 10 10")).toThrow(/closepath/);
    expect(() => parsePath("M 0 0 A 10 10 0 2 0 20 0")).toThrow(/flags/);
    expect(() => parsePath("M 0 0 X 1 2")).toThrow(/Invalid path character/);
  });
});
