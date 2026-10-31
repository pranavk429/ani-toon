import { describe, expect, it } from "vitest";

import {
  cubicBezier,
  easingSpline,
  easingToCss,
  evaluateEasing,
  NAMED_EASINGS,
  springValue,
} from "@/lib/animation";

describe("easing", () => {
  it("has exact endpoints for every named easing", () => {
    for (const name of NAMED_EASINGS) {
      expect(evaluateEasing(name, 0), name).toBeCloseTo(0, 10);
      expect(evaluateEasing(name, 1), name).toBeCloseTo(1, 10);
    }
  });

  it("clamps input progress outside the unit interval", () => {
    for (const name of NAMED_EASINGS) {
      expect(evaluateEasing(name, -1), name).toBeCloseTo(0, 10);
      expect(evaluateEasing(name, 2), name).toBeCloseTo(1, 10);
    }
  });

  it("solves cubic bezier curves deterministically", () => {
    const curve = cubicBezier(0.25, 0.1, 0.25, 1);
    const first = Array.from({ length: 21 }, (_, index) =>
      curve(index / 20),
    );
    const second = Array.from({ length: 21 }, (_, index) =>
      cubicBezier(0.25, 0.1, 0.25, 1)(index / 20),
    );
    expect(second).toEqual(first);
    expect(first[0]).toBe(0);
    expect(first[first.length - 1]).toBe(1);
    for (let i = 1; i < first.length; i++) {
      expect(first[i]).toBeGreaterThanOrEqual(first[i - 1]);
    }
  });

  it("supports structured cubic-bezier easings", () => {
    const structured = evaluateEasing(
      { type: "cubicBezier", x1: 0.22, y1: 1, x2: 0.36, y2: 1 },
      0.5,
    );
    expect(structured).toBeGreaterThan(0.5);
    expect(structured).toBeLessThanOrEqual(1);
  });

  it("produces a deterministic spring with overshoot", () => {
    const samples = Array.from({ length: 101 }, (_, index) =>
      evaluateEasing("springBouncy", index / 100),
    );
    const again = Array.from({ length: 101 }, (_, index) =>
      springValue({ stiffness: 22, damping: 3.4, mass: 1 }, index / 100),
    );
    expect(again).toEqual(samples);
    expect(Math.max(...samples)).toBeGreaterThan(1);
    expect(samples[0]).toBe(0);
    expect(samples[samples.length - 1]).toBe(1);
  });

  it("produces deterministic samples for easingSpline", () => {
    const first = easingSpline(
      { type: "spring", stiffness: 12, damping: 5, mass: 1 },
      12,
    );
    const second = easingSpline(
      { type: "spring", stiffness: 12, damping: 5, mass: 1 },
      12,
    );
    expect(second).toEqual(first);
    expect(first).toHaveLength(12);
    expect(first[0]).toEqual({ offset: 0, value: 0 });
    expect(first[first.length - 1]).toEqual({ offset: 1, value: 1 });
  });

  it("serializes CSS timing functions", () => {
    expect(easingToCss("linear")).toBe("linear");
    expect(easingToCss("easeInOut")).toBe("ease-in-out");
    expect(easingToCss("backOut")).toContain("cubic-bezier");
    expect(
      easingToCss({ type: "cubicBezier", x1: 0.2, y1: 0, x2: 0.8, y2: 1 }),
    ).toBe("cubic-bezier(0.2, 0, 0.8, 1)");
    expect(easingToCss("spring")).toMatch(/^linear\(/);
  });

  it("throws on unknown easings", () => {
    expect(() => evaluateEasing("wobble" as never, 0.5)).toThrow(/Unknown/);
  });
});
