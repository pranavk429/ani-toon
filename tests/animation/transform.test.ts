import { describe, expect, it } from "vitest";

import {
  composeElementAnimationMatrix,
  composeTransformAttribute,
  componentTransformString,
  componentValuesString,
  composeWrapperAnimationMatrix,
  decomposeMatrixForSmil,
  formatMatrix,
  formatNumber,
  IDENTITY_MATRIX,
  multiplyMatrix,
  rotationMatrix,
  scaleMatrix,
  translationMatrix,
  type MotionTransformValues,
} from "@/lib/animation";
import { makeGraph } from "./helpers";

function values(
  overrides: Partial<MotionTransformValues> = {},
): MotionTransformValues {
  return {
    translateX: 0,
    translateY: 0,
    rotate: 0,
    scaleX: 1,
    scaleY: 1,
    ...overrides,
  };
}

describe("deterministic transform composition", () => {

  it("decomposes matrices into nested SMIL components", () => {
    const skewMatrix = (degrees: number): [number, number, number, number, number, number] => [
      1,
      0,
      Math.tan((degrees * Math.PI) / 180),
      1,
      0,
      0,
    ];
    const expected = multiplyMatrix(
      translationMatrix(12, -8),
      multiplyMatrix(
        rotationMatrix(32),
        multiplyMatrix(skewMatrix(7), scaleMatrix(1.4, 0.8)),
      ),
    );
    const components = decomposeMatrixForSmil(expected);
    const reconstructed = multiplyMatrix(
      translationMatrix(components.translateX, components.translateY),
      multiplyMatrix(
        rotationMatrix(components.rotate),
        multiplyMatrix(
          skewMatrix(components.skewX),
          scaleMatrix(components.scaleX, components.scaleY),
        ),
      ),
    );
    for (let index = 0; index < 6; index += 1) {
      expect(reconstructed[index]).toBeCloseTo(expected[index], 5);
    }
    expect(componentTransformString("translate", components)).toMatch(/^translate\(/);
    expect(componentValuesString("rotate", [components])).not.toMatch(/matrix\(/);
  });
  it("formats identity and rounds negative zero", () => {
    expect(formatMatrix(IDENTITY_MATRIX)).toBe("matrix(1 0 0 1 0 0)");
    expect(formatNumber(-0)).toBe("0");
    expect(formatNumber(1.23456789)).toBe("1.234568");
    expect(composeTransformAttribute("translate(2 3)", IDENTITY_MATRIX)).toBe(
      "translate(2 3) matrix(1 0 0 1 0 0)",
    );
  });

  it("applies translation in root user units", () => {
    const graph = makeGraph();
    const matrix = composeWrapperAnimationMatrix(
      graph,
      graph.elements.box,
      values({ translateX: 10, translateY: -5 }),
      "center",
    );
    expect(formatMatrix(matrix)).toBe("matrix(1 0 0 1 10 -5)");
  });

  it("applies motion-path offsets with translation", () => {
    const graph = makeGraph();
    const matrix = composeWrapperAnimationMatrix(
      graph,
      graph.elements.box,
      values({ translateX: 5, motionX: 10, motionY: 20 }),
      "center",
    );
    expect(formatMatrix(matrix)).toBe("matrix(1 0 0 1 15 20)");
  });

  it("rotates around the bbox center or top-left", () => {
    const graph = makeGraph();
    const center = composeWrapperAnimationMatrix(
      graph,
      graph.elements.box,
      values({ rotate: 90 }),
      "center",
    );
    expect(formatMatrix(center)).toBe("matrix(0 1 -1 0 40 0)");

    const topLeft = composeWrapperAnimationMatrix(
      graph,
      graph.elements.box,
      values({ rotate: 90 }),
      "top-left",
    );
    expect(formatMatrix(topLeft)).toBe("matrix(0 1 -1 0 20 0)");
  });

  it("scales around the bbox center", () => {
    const graph = makeGraph();
    const matrix = composeWrapperAnimationMatrix(
      graph,
      graph.elements.box,
      values({ scaleX: 2, scaleY: 2 }),
      "center",
    );
    expect(formatMatrix(matrix)).toBe("matrix(2 0 0 2 -20 -20)");
  });

  it("conjugates a wrapper animation through ancestor transforms", () => {
    const graph = makeGraph();
    graph.elements.box.transform = "translate(100 0)";
    graph.elements.box.matrix = [1, 0, 0, 1, 100, 0];
    graph.elements.dot.parentId = "box";

    const matrix = composeWrapperAnimationMatrix(
      graph,
      graph.elements.dot,
      values({ rotate: 90 }),
      "center",
    );
    // The dot's root-space pivot (50,50) becomes (-50,50) in the parent's
    // translated coordinate space.
    expect(formatMatrix(matrix)).toBe("matrix(0 1 -1 0 0 100)");
  });

  it("conjugates an element transform so the visual result is root-space", () => {
    const graph = makeGraph();
    graph.elements.box.transform = "translate(10 10)";
    graph.elements.box.matrix = [1, 0, 0, 1, 10, 10];

    const matrix = composeElementAnimationMatrix(
      graph,
      graph.elements.box,
      values({ rotate: 90 }),
      "center",
    );
    // The root pivot (20,20) maps to (10,10) in the element's local space.
    expect(formatMatrix(matrix)).toBe("matrix(0 1 -1 0 20 0)");
  });

  it("is stable across repeated composition", () => {
    const graph = makeGraph();
    const first = composeWrapperAnimationMatrix(
      graph,
      graph.elements.box,
      values({ rotate: 33, scaleX: 1.2, translateX: 4 }),
      "center",
    );
    const second = composeWrapperAnimationMatrix(
      graph,
      graph.elements.box,
      values({ rotate: 33, scaleX: 1.2, translateX: 4 }),
      "center",
    );
    expect(second).toEqual(first);
  });
});
