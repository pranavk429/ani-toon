import { describe, expect, it } from "vitest";

import { buildAnimatedSvg } from "@/lib/animation/exportSvg";
import { evaluateDocument } from "@/lib/animation/evaluate";
import type { MotionDocument } from "@/lib/animation/types";
import { makeDocument, makeGraph } from "../animation/helpers";

describe("buildAnimatedSvg export honesty", () => {
  describe("Character document export honesty", () => {
    it("returns no SMIL animation and emits a warning mentioning 'Character'", () => {
      const graph = makeGraph();
      const characterDoc: MotionDocument = {
        version: 1,
        id: "anim_char_honesty",
        name: "Character Jump & Wave",
        targetKind: "character",
        duration: 3,
        fps: 60,
        loop: { enabled: true, mode: "restart" },
        tracks: [
          {
            id: "root-jump",
            target: { kind: "character", actorId: "sofia", boneId: "root" },
            property: "translateY",
            keyframes: [
              { at: 0, value: 0 },
              { at: 0.5, value: 30 },
              { at: 1, value: 0 },
            ],
          },
          {
            id: "arm-wave",
            target: { kind: "character", actorId: "sofia", boneId: "armR" },
            property: "rotate",
            keyframes: [
              { at: 0, value: 0 },
              { at: 0.5, value: 20 },
              { at: 1, value: 0 },
            ],
          },
        ],
      };

      const result = buildAnimatedSvg(graph, characterDoc);

      // 1. Must warn specifically about Character documents not being supported as animated SMIL SVG
      expect(result.warnings.length).toBeGreaterThan(0);
      const characterWarning = result.warnings.find((w) =>
        /character/i.test(w),
      );
      expect(characterWarning).toBeDefined();
      expect(characterWarning).toContain(
        "Character documents cannot be exported as animated SVG; artwork is exported without animation",
      );

      // 2. Must NOT emit any SMIL animation tags
      expect(result.svg).not.toMatch(/<animate[\s>]/);
      expect(result.svg).not.toMatch(/<animateTransform[\s>]/);
      expect(result.svg).not.toMatch(/<animateMotion[\s>]/);

      // 3. Static SVG structure is still intact and valid
      expect(result.svg).toContain("<svg");
      expect(result.svg).toContain("</svg>");
      expect(result.svg).toContain('viewBox="0 0 100 100"');
    });
  });

  describe("SVG document export honesty and intent preservation", () => {
    it("emits SMIL animation elements and preserves geometry", () => {
      const graph = makeGraph();
      const svgDoc: MotionDocument = {
        version: 1,
        id: "anim_svg_honesty",
        name: "SVG Box Animation",
        targetKind: "svg",
        duration: 4,
        fps: 60,
        loop: { enabled: true, mode: "restart" },
        tracks: [
          {
            id: "box-slide",
            target: { kind: "svg", elementId: "box" },
            property: "translateX",
            delay: 0,
            duration: 4,
            keyframes: [
              { at: 0, value: 0 },
              { at: 0.5, value: 50 },
              { at: 1, value: 100 },
            ],
          },
          {
            id: "dot-fade",
            target: { kind: "svg", elementId: "dot" },
            property: "opacity",
            delay: 1,
            duration: 2,
            keyframes: [
              { at: 0, value: 1 },
              { at: 1, value: 0.2 },
            ],
          },
        ],
      };

      const result = buildAnimatedSvg(graph, svgDoc);

      // No character warning emitted
      expect(result.warnings.some((w) => /character/i.test(w))).toBe(false);

      // Animation tags ARE emitted
      expect(
        result.svg.includes("<animate") || result.svg.includes("<animateTransform"),
      ).toBe(true);

      // Geometry and elements are preserved
      expect(result.svg).toContain('id="box"');
      expect(result.svg).toContain('id="dot"');
      expect(result.svg).toContain('viewBox="0 0 100 100"');
      expect(result.svg).toContain('width="100"');
      expect(result.svg).toContain('height="100"');
    });

    it("evaluates transform and opacity intent across multiple timestamps (0, mid, end)", () => {
      const svgDoc: MotionDocument = makeDocument({
        id: "anim_intent_eval",
        name: "Intent Eval",
        targetKind: "svg",
        duration: 4,
        loop: { enabled: false, mode: "restart" },
        tracks: [
          {
            id: "box-move-x",
            target: { kind: "svg", elementId: "box" },
            property: "translateX",
            delay: 0,
            duration: 4,
            easing: "linear",
            keyframes: [
              { at: 0, value: 10 },
              { at: 0.5, value: 60 },
              { at: 1, value: 110 },
            ],
          },
          {
            id: "box-fade",
            target: { kind: "svg", elementId: "box" },
            property: "opacity",
            delay: 0,
            duration: 4,
            easing: "linear",
            keyframes: [
              { at: 0, value: 1 },
              { at: 0.5, value: 0.6 },
              { at: 1, value: 0.2 },
            ],
          },
        ],
      });

      // t = 0 (start)
      const stateStart = evaluateDocument(svgDoc, 0);
      expect(stateStart.targets["box"]?.translateX).toBeCloseTo(10, 4);
      expect(stateStart.targets["box"]?.opacity).toBeCloseTo(1, 4);

      // t = 2 (mid)
      const stateMid = evaluateDocument(svgDoc, 2);
      expect(stateMid.targets["box"]?.translateX).toBeCloseTo(60, 4);
      expect(stateMid.targets["box"]?.opacity).toBeCloseTo(0.6, 4);

      // t = 4 (end)
      const stateEnd = evaluateDocument(svgDoc, 4);
      expect(stateEnd.targets["box"]?.translateX).toBeCloseTo(110, 4);
      expect(stateEnd.targets["box"]?.opacity).toBeCloseTo(0.2, 4);

      // Determinism: evaluating again at t = 2 yields identical numbers
      const stateMidAgain = evaluateDocument(svgDoc, 2);
      expect(stateMidAgain.targets["box"]).toEqual(stateMid.targets["box"]);
    });
  });
});
