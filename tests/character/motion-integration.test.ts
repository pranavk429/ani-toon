import { describe, expect, it } from "vitest";

import {
  applyMotionToScene,
  characterContextForScene,
  validationContextForScene,
} from "@/creature/motion";
import { studioScene } from "@/creature/validate";
import { buildCowboyOnHorse, buildSofiaScene } from "@/creature/examples";
import { scenePoseAt } from "@/creature/pose";
import type { Scene, SceneObject } from "@/creature/types";
import { evaluateDocument } from "@/lib/animation/evaluate";
import type { MotionDocument } from "@/lib/animation/types";
import { validateMotionDocument } from "@/lib/animation/validate";

function cloneDeep<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

describe("Character motion integration (node environment)", () => {
  describe("Scene setup and context generation", () => {
    it("wraps buildSofiaScene with studioScene and provides valid contexts", () => {
      const baseScene = buildSofiaScene();
      const starObject: SceneObject = {
        id: "star",
        kind: "star",
        color: "#FFD45E",
        x: 520,
        y: 220,
        layer: "front",
      };
      baseScene.objects = [starObject];

      const scene = studioScene(baseScene, 8000);

      // studioScene establishes an idle base beat and duration
      expect(scene.score.duration).toBe(8000);
      expect(scene.score.beats).toHaveLength(1);
      expect(scene.score.beats[0].actor).toBe("sofia");
      expect(scene.score.beats[0].layer).toBe("base");
      expect(scene.score.beats[0].verb).toBe("idle");
      expect(scene.objects).toEqual([starObject]);

      // characterContextForScene
      const charCtx = characterContextForScene(scene);
      expect(charCtx.styleId).toBe("anitoon-storybook-v1");
      expect(charCtx.actors).toHaveLength(1);
      expect(charCtx.actors[0].id).toBe("sofia");
      expect(charCtx.objects).toHaveLength(1);
      expect(charCtx.objects[0].id).toBe("star");
      expect(charCtx.bones.some((b) => b.actorId === "sofia" && b.boneId === "root")).toBe(true);
      expect(charCtx.bones.some((b) => b.actorId === "sofia" && b.boneId === "head")).toBe(true);
      expect(charCtx.bones.some((b) => b.actorId === "sofia" && b.boneId === "armR")).toBe(true);

      // validationContextForScene
      const valCtx = validationContextForScene(scene);
      expect(valCtx.targetKind).toBe("character");
      expect(valCtx.bones?.length).toBeGreaterThan(10);
      expect((valCtx.objectIds as ReadonlySet<string> | undefined)?.has("star")).toBe(true);
    });
  });

  describe("Hand-authored MotionDocument (a): root jump + arm wave + blink + star arc", () => {
    function buildDocA(loopEnabled = false): MotionDocument {
      return {
        version: 1,
        id: "doc_a_jump_wave_blink_star",
        name: "Sofia Jump Wave Blink Star Arc",
        targetKind: "character",
        duration: 4,
        fps: 60,
        loop: { enabled: loopEnabled, mode: "restart" },
        tracks: [
          // 1. Root jump: translateY on root
          {
            id: "track-root-jump",
            target: { kind: "character", actorId: "sofia", boneId: "root" },
            property: "translateY",
            delay: 0,
            duration: 4,
            easing: "linear",
            keyframes: [
              { at: 0, value: 0 },
              { at: 0.5, value: 40 },
              { at: 1, value: 0 },
            ],
          },
          // 2. Arm wave: rotate on armR
          {
            id: "track-arm-wave",
            target: { kind: "character", actorId: "sofia", boneId: "armR" },
            property: "rotate",
            delay: 0,
            duration: 4,
            easing: "linear",
            keyframes: [
              { at: 0, value: 0 },
              { at: 0.5, value: 30 },
              { at: 1, value: 0 },
            ],
          },
          // 3. Face blink: faceBlink on head
          {
            id: "track-head-blink",
            target: { kind: "character", actorId: "sofia", boneId: "head" },
            property: "faceBlink",
            delay: 0,
            duration: 4,
            easing: "linear",
            keyframes: [
              { at: 0, value: 0 },
              { at: 0.5, value: 1 },
              { at: 1, value: 0 },
            ],
          },
          // 4. Object star arc: translateX and translateY on star object
          {
            id: "track-star-x",
            target: { kind: "object", objectId: "star" },
            property: "translateX",
            delay: 0,
            duration: 4,
            easing: "linear",
            keyframes: [
              { at: 0, value: 0 },
              { at: 0.5, value: 60 },
              { at: 1, value: 120 },
            ],
          },
          {
            id: "track-star-y",
            target: { kind: "object", objectId: "star" },
            property: "translateY",
            delay: 0,
            duration: 4,
            easing: "linear",
            keyframes: [
              { at: 0, value: 0 },
              { at: 0.5, value: -70 },
              { at: 1, value: 0 },
            ],
          },
        ],
      };
    }

    it("passes validateMotionDocument cleanly", () => {
      const scene = studioScene(buildSofiaScene(), 8000);
      scene.objects = [{ id: "star", kind: "star", color: "#FFD45E", x: 520, y: 220 }];
      const valCtx = validationContextForScene(scene);

      const docA = buildDocA();
      const result = validateMotionDocument(docA, valCtx);

      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.document).toBeDefined();
    });

    it("evaluates deterministically at 0, mid, and end", () => {
      const docA = buildDocA();

      // At t = 0
      const eval0 = evaluateDocument(docA, 0);
      expect(eval0.targets["sofia:root"]?.translateY).toBeCloseTo(0, 4);
      expect(eval0.targets["sofia:armR"]?.rotate).toBeCloseTo(0, 4);
      expect(eval0.targets["sofia:head"]?.faceBlink).toBeCloseTo(0, 4);
      expect(eval0.targets["star"]?.translateX).toBeCloseTo(0, 4);
      expect(eval0.targets["star"]?.translateY).toBeCloseTo(0, 4);

      // At t = mid (2.0s)
      const evalMid = evaluateDocument(docA, 2.0);
      expect(evalMid.targets["sofia:root"]?.translateY).toBeCloseTo(40, 4);
      expect(evalMid.targets["sofia:armR"]?.rotate).toBeCloseTo(30, 4);
      expect(evalMid.targets["sofia:head"]?.faceBlink).toBeCloseTo(1, 4);
      expect(evalMid.targets["star"]?.translateX).toBeCloseTo(60, 4);
      expect(evalMid.targets["star"]?.translateY).toBeCloseTo(-70, 4);

      // At t = end (4.0s)
      const evalEnd = evaluateDocument(docA, 4.0);
      expect(evalEnd.targets["sofia:root"]?.translateY).toBeCloseTo(0, 4);
      expect(evalEnd.targets["sofia:armR"]?.rotate).toBeCloseTo(0, 4);
      expect(evalEnd.targets["sofia:head"]?.faceBlink).toBeCloseTo(0, 4);
      expect(evalEnd.targets["star"]?.translateX).toBeCloseTo(120, 4);
      expect(evalEnd.targets["star"]?.translateY).toBeCloseTo(0, 4);

      // Repeated evaluation is strictly deterministic
      const evalMidAgain = evaluateDocument(docA, 2.0);
      expect(evalMidAgain).toEqual(evalMid);
    });

    it("applyMotionToScene applies cloned pose, moves objects, changes face, and does not mutate base pose", () => {
      const scene = studioScene(buildSofiaScene(), 8000);
      scene.objects = [{ id: "star", kind: "star", color: "#FFD45E", x: 520, y: 220, layer: "front" }];
      const docA = buildDocA();

      // Sample base procedural pose at t = 2000 ms (2.0 s)
      const basePose = scenePoseAt(scene, 2000);
      const basePoseSnapshot = cloneDeep(basePose);

      const frame = applyMotionToScene(scene, basePose, docA, 2.0);

      // 1. Base pose MUST NOT be mutated
      expect(basePose).toEqual(basePoseSnapshot);

      // 2. Motion frame is marked active
      expect(frame.active).toBe(true);

      // 3. Additive root translation:
      // Note: In creature/motion.ts, actorPose.root.y -= state.translateY because skeleton +Y is up.
      expect(frame.pose.sofia.root.y).toBeCloseTo(basePoseSnapshot.sofia.root.y - 40, 3);

      // 4. Arm rotation additive change
      expect(frame.pose.sofia.bones.armR.rot).toBeCloseTo(basePoseSnapshot.sofia.bones.armR.rot + 30, 3);

      // 5. Face changed
      expect(frame.pose.sofia.face.blink).toBe(1);

      // 6. Object frames moved
      const starFrame = frame.frontObjects.find((fo) => fo.object.id === "star");
      expect(starFrame).toBeDefined();
      expect(starFrame!.x).toBeCloseTo(520 + 60, 3);
      expect(starFrame!.y).toBeCloseTo(220 - 70, 3);
    });
  });

  describe("Hand-authored MotionDocument (b): two actors and two objects", () => {
    function buildMultiActorScene(): Scene {
      const scene = studioScene(buildCowboyOnHorse(), 8000);
      scene.objects = [
        { id: "star", kind: "star", color: "#FFD45E", x: 500, y: 200, layer: "front" },
        { id: "ball", kind: "ball", color: "#F4F0E6", x: 400, y: 500, layer: "back" },
      ];
      return scene;
    }

    function buildDocB(): MotionDocument {
      return {
        version: 1,
        id: "doc_b_multi_actor_multi_object",
        name: "Cowboy on Horse with Star and Ball",
        targetKind: "character",
        duration: 4,
        fps: 60,
        loop: { enabled: true, mode: "restart" },
        tracks: [
          // Actor 1 (horse): root bounce
          {
            id: "horse-bounce",
            target: { kind: "character", actorId: "biscuit", boneId: "root" },
            property: "translateY",
            keyframes: [
              { at: 0, value: 0 },
              { at: 0.5, value: 25 },
              { at: 1, value: 0 },
            ],
          },
          // Actor 2 (rider): head nod / look
          {
            id: "rider-head",
            target: { kind: "character", actorId: "cass", boneId: "head" },
            property: "rotate",
            keyframes: [
              { at: 0, value: 0 },
              { at: 0.5, value: -15 },
              { at: 1, value: 0 },
            ],
          },
          // Object 1 (star in front): rotate
          {
            id: "star-spin",
            target: { kind: "object", objectId: "star" },
            property: "rotate",
            keyframes: [
              { at: 0, value: 0 },
              { at: 1, value: 180 },
            ],
          },
          // Object 2 (ball in back): bounce
          {
            id: "ball-bounce",
            target: { kind: "object", objectId: "ball" },
            property: "translateY",
            keyframes: [
              { at: 0, value: 0 },
              { at: 0.5, value: -40 },
              { at: 1, value: 0 },
            ],
          },
        ],
      };
    }

    it("validates multi-actor and multi-object tracks", () => {
      const scene = buildMultiActorScene();
      const valCtx = validationContextForScene(scene);
      const docB = buildDocB();

      const result = validateMotionDocument(docB, valCtx);
      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("evaluates and applies motion across both actors and both objects without mutating base pose", () => {
      const scene = buildMultiActorScene();
      const docB = buildDocB();

      const basePose = scenePoseAt(scene, 2000);
      const basePoseSnapshot = cloneDeep(basePose);

      const frame = applyMotionToScene(scene, basePose, docB, 2.0);

      // Base pose remains untouched
      expect(basePose).toEqual(basePoseSnapshot);

      // Actor 1 (horse) root moved
      expect(frame.pose.biscuit.root.y).toBeCloseTo(basePoseSnapshot.biscuit.root.y - 25, 3);

      // Actor 2 (rider) head rotated
      expect(frame.pose.cass.bones.head.rot).toBeCloseTo(basePoseSnapshot.cass.bones.head.rot - 15, 3);

      // Front object (star) rotated
      const starFrame = frame.frontObjects.find((o) => o.object.id === "star");
      expect(starFrame).toBeDefined();
      expect(starFrame!.rotation).toBeCloseTo(90, 3);

      // Back object (ball) translated
      const ballFrame = frame.backObjects.find((o) => o.object.id === "ball");
      expect(ballFrame).toBeDefined();
      expect(ballFrame!.y).toBeCloseTo(500 - 40, 3);
    });
  });

  describe("Hand-authored MotionDocument (c): invalid target, unknown bone, out-of-range values", () => {
    it("rejects unknown character bones", () => {
      const scene = studioScene(buildSofiaScene(), 8000);
      const valCtx = validationContextForScene(scene);

      const invalidDoc: MotionDocument = {
        version: 1,
        id: "doc_c_unknown_bone",
        name: "Unknown Bone Test",
        targetKind: "character",
        duration: 3,
        fps: 60,
        loop: { enabled: false },
        tracks: [
          {
            id: "t-invalid-bone",
            target: { kind: "character", actorId: "sofia", boneId: "unknown_tail_99" },
            property: "rotate",
            keyframes: [
              { at: 0, value: 0 },
              { at: 1, value: 20 },
            ],
          },
        ],
      };

      const result = validateMotionDocument(invalidDoc, valCtx);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => /unknown character bone/i.test(e.message))).toBe(true);
    });

    it("rejects invalid target kind in character document (e.g. SVG target)", () => {
      const scene = studioScene(buildSofiaScene(), 8000);
      const valCtx = validationContextForScene(scene);

      const invalidDoc: MotionDocument = {
        version: 1,
        id: "doc_c_svg_target",
        name: "SVG Target in Character Doc",
        targetKind: "character",
        duration: 3,
        fps: 60,
        loop: { enabled: false },
        tracks: [
          {
            id: "t-svg-in-char",
            target: { kind: "svg", elementId: "rect1" },
            property: "translateX",
            keyframes: [
              { at: 0, value: 0 },
              { at: 1, value: 50 },
            ],
          },
        ],
      };

      const result = validateMotionDocument(invalidDoc, valCtx);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => /svg targets are not valid/i.test(e.message))).toBe(true);
    });

    it("rejects unknown scene objects", () => {
      const scene = studioScene(buildSofiaScene(), 8000);
      const valCtx = validationContextForScene(scene);

      const invalidDoc: MotionDocument = {
        version: 1,
        id: "doc_c_unknown_obj",
        name: "Unknown Object Test",
        targetKind: "character",
        duration: 3,
        fps: 60,
        loop: { enabled: false },
        tracks: [
          {
            id: "t-unknown-obj",
            target: { kind: "object", objectId: "nonexistent_prop_99" },
            property: "translateX",
            keyframes: [
              { at: 0, value: 0 },
              { at: 1, value: 20 },
            ],
          },
        ],
      };

      const result = validateMotionDocument(invalidDoc, valCtx);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => /unknown scene object/i.test(e.message))).toBe(true);
    });

    it("rejects out-of-range face values", () => {
      const scene = studioScene(buildSofiaScene(), 8000);
      const valCtx = validationContextForScene(scene);

      // faceBlink value must be 0..1; value 2.5 is invalid
      const invalidBlinkDoc: MotionDocument = {
        version: 1,
        id: "doc_c_face_out_of_range",
        name: "Out of Range Face Blink",
        targetKind: "character",
        duration: 3,
        fps: 60,
        loop: { enabled: false },
        tracks: [
          {
            id: "t-bad-blink",
            target: { kind: "character", actorId: "sofia", boneId: "head" },
            property: "faceBlink",
            keyframes: [
              { at: 0, value: 0 },
              { at: 1, value: 2.5 },
            ],
          },
        ],
      };

      const result = validateMotionDocument(invalidBlinkDoc, valCtx);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => /faceBlink values must be between 0 and 1/i.test(e.message))).toBe(true);
    });

    it("rejects translation properties on non-root bones", () => {
      const scene = studioScene(buildSofiaScene(), 8000);
      const valCtx = validationContextForScene(scene);

      // translateX is only allowed on root
      const invalidTranslateDoc: MotionDocument = {
        version: 1,
        id: "doc_c_bad_translate",
        name: "Translate on Arm",
        targetKind: "character",
        duration: 3,
        fps: 60,
        loop: { enabled: false },
        tracks: [
          {
            id: "t-arm-translate",
            target: { kind: "character", actorId: "sofia", boneId: "armR" },
            property: "translateX",
            keyframes: [
              { at: 0, value: 0 },
              { at: 1, value: 10 },
            ],
          },
        ],
      };

      const result = validateMotionDocument(invalidTranslateDoc, valCtx);
      expect(result.ok).toBe(false);
      expect(
        result.errors.some((e) =>
          /translateX\/translateY are only valid on the character root bone/i.test(e.message),
        ),
      ).toBe(true);
    });
  });

  describe("SceneFrame component note", () => {
    it("documents why SceneFrame is not tested in node", () => {
      // SceneFrame is a React component requiring browser DOM rendering and SVG mounting.
      // In Node.js, we test the pure evaluation engine (applyMotionToScene + scenePoseAt),
      // which is what SceneFrame invokes internally.
      expect(typeof applyMotionToScene).toBe("function");
      expect(typeof scenePoseAt).toBe("function");
    });
  });
});
