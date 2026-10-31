import { describe, expect, it } from "vitest";

import {
  createTimelineModel,
  EVALUATED_TARGET_META,
  evaluateDocument,
  evaluateTrack,
  interpolateColor,
  trackWindow,
  validateMotionDocument,
  type EvaluatedTargetWithMeta,
  type MotionDocument,
  type MotionTrack,
} from "@/lib/animation";
import { makeDocument, makeTrack } from "./helpers";

function linearTrack(
  id: string,
  property: MotionTrack["property"],
  values: [number, number],
  overrides: Partial<MotionTrack> = {},
): MotionTrack {
  return makeTrack({
    id,
    property,
    easing: "linear",
    keyframes: [
      { at: 0, value: values[0] },
      { at: 1, value: values[1] },
    ],
    ...overrides,
  });
}

describe("deterministic evaluation", () => {
  it("interpolates numbers with the selected easing", () => {
    const track = linearTrack("move", "translateX", [0, 10]);
    const doc = makeDocument({ tracks: [track], loop: { enabled: false } });
    expect(evaluateTrack(track, doc, 0)).toBeCloseTo(0, 8);
    expect(evaluateTrack(track, doc, 1)).toBeCloseTo(5, 8);
    expect(evaluateTrack(track, doc, 2)).toBeCloseTo(10, 8);
    expect(evaluateDocument(doc, 1).targets.box.translateX).toBeCloseTo(5, 8);
  });

  it("fills before and after the track window with first/last values", () => {
    const track = linearTrack("delayed", "translateX", [10, 20], {
      delay: 1,
      duration: 2,
    });
    const doc = makeDocument({ duration: 4, tracks: [track] });
    expect(evaluateTrack(track, doc, 0)).toBe(10);
    expect(evaluateTrack(track, doc, 2)).toBeCloseTo(15, 8);
    expect(evaluateTrack(track, doc, 4)).toBe(20);
  });

  it("interpolates 3/6/8-digit hex colors in sRGB", () => {
    const six = makeTrack({
      id: "fill-six",
      property: "fill",
      easing: "linear",
      keyframes: [
        { at: 0, value: "#000000" },
        { at: 1, value: "#ffffff" },
      ],
    });
    const docSix = makeDocument({ tracks: [six] });
    expect(evaluateTrack(six, docSix, 1)).toBe("#808080");
    expect(interpolateColor("#000", "#fff", 0.5)).toBe("#808080");
    expect(interpolateColor("#ff000080", "#00ff00ff", 1)).toBe("#00ff00ff");
    expect(interpolateColor("#ff000080", "#00ff00ff", 0)).toBe("#ff000080");
    expect(interpolateColor("#000000", "#ffffff", 2)).toBe("#ffffff");
  });

  it("holds non-color strings instead of inventing values", () => {
    const track = makeTrack({
      id: "fill-hold",
      property: "fill",
      easing: "linear",
      keyframes: [
        { at: 0, value: "#ffffff" },
        { at: 1, value: "red" },
      ],
    });
    const doc = makeDocument({ tracks: [track] });
    expect(evaluateTrack(track, doc, 1)).toBe("#ffffff");
  });

  it("multiplies scale, scaleX and scaleY composition", () => {
    const doc = makeDocument({
      tracks: [
        linearTrack("uniform", "scale", [1, 2]),
        linearTrack("axis", "scaleX", [1, 3]),
      ],
    });
    const target = evaluateDocument(doc, 2).targets.box;
    expect(target.scaleX).toBeCloseTo(6, 8);
    expect(target.scaleY).toBeCloseTo(2, 8);
    expect(target.translateX).toBe(0);
    expect(target.opacity).toBe(1);
  });

  it("adds sequential translateX tracks (shake then launch)", () => {
    const shake = makeTrack({
      id: "trk_rocket_anticipation_x",
      property: "translateX",
      easing: "linear",
      delay: 0,
      duration: 0.7,
      keyframes: [
        { at: 0, value: 0 },
        { at: 0.5, value: -8 },
        { at: 1, value: 0 },
      ],
    });
    const launch = makeTrack({
      id: "trk_rocket_launch_x",
      property: "translateX",
      easing: "linear",
      delay: 0.7,
      duration: 2.3,
      keyframes: [
        { at: 0, value: 0 },
        { at: 1, value: 10 },
      ],
    });
    const doc = makeDocument({
      duration: 3,
      loop: { enabled: false },
      tracks: [shake, launch],
    });

    const validated = validateMotionDocument(doc, {
      targetKind: "svg",
      elementIds: ["box"],
    });
    expect(validated.ok).toBe(true);
    expect(validated.errors).toEqual([]);
    const normalized = validated.document ?? doc;

    const duringShake = evaluateDocument(normalized, 0.35);
    expect(duringShake.targets.box.translateX).toBeCloseTo(-8, 8);

    const duringLaunch = evaluateDocument(normalized, 2.5);
    expect(duringLaunch.targets.box.translateX).toBeGreaterThan(5);
    expect(duringLaunch.targets.box.translateX).toBeCloseTo(
      10 * (1.8 / 2.3),
      8,
    );
  });

  it("adds rotation and multiplies opacity from multiple tracks", () => {
    const doc = makeDocument({
      tracks: [
        linearTrack("turn-a", "rotate", [0, 10]),
        linearTrack("turn-b", "rotate", [0, 5]),
        linearTrack("fade-a", "opacity", [1, 0.5]),
        linearTrack("fade-b", "opacity", [1, 0.5]),
      ],
    });
    const target = evaluateDocument(doc, 2).targets.box;
    expect(target.rotate).toBeCloseTo(15, 8);
    expect(target.opacity).toBeCloseTo(0.25, 8);
  });

  it("uses the last declared track for paint and motion-path properties", () => {
    const firstFill = makeTrack({
      id: "fill-first",
      property: "fill",
      easing: "linear",
      keyframes: [
        { at: 0, value: "#000000" },
        { at: 1, value: "#ffffff" },
      ],
    });
    const secondFill = makeTrack({
      id: "fill-second",
      property: "fill",
      easing: "linear",
      keyframes: [
        { at: 0, value: "#ff0000" },
        { at: 1, value: "#00ff00" },
      ],
    });
    const doc = makeDocument({ tracks: [firstFill, secondFill] });
    expect(evaluateDocument(doc, 1).targets.box.fill).toBe("#808000");
    expect(evaluateDocument(doc, 2).targets.box.fill).toBe("#00ff00");
  });

  it("respects muted and hidden tracks", () => {
    const visible = linearTrack("visible", "opacity", [1, 0.5]);
    const muted = linearTrack("muted", "translateX", [0, 30], { muted: true });
    const doc = makeDocument({ tracks: [visible, muted] });

    const state = evaluateDocument(doc, 2);
    expect(state.targets.box.opacity).toBeCloseTo(0.5, 8);
    expect(state.targets.box.translateX).toBe(0);
    expect(evaluateTrack(muted, doc, 2)).toBeUndefined();

    const withTwoVisible = makeDocument({
      tracks: [
        linearTrack("move-visible", "translateX", [0, 10]),
        linearTrack("fade-visible", "opacity", [1, 0.5]),
      ],
    });
    const hidden = evaluateDocument(withTwoVisible, 2, {
      hiddenTrackIds: ["move-visible"],
    });
    expect(hidden.targets.box.translateX).toBe(0);
    expect(hidden.targets.box.opacity).toBeCloseTo(0.5, 8);

    // Hiding the only non-muted track leaves nothing to aggregate.
    const hiddenAll = evaluateDocument(doc, 2, {
      hiddenTrackIds: ["visible"],
    });
    expect(hiddenAll.targets.box).toBeUndefined();
  });

  it("maps restart looping and iteration counts", () => {
    const track = linearTrack("move", "translateX", [0, 10]);
    const doc = makeDocument({
      loop: { enabled: true, mode: "restart" },
      tracks: [track],
    });
    const state = evaluateDocument(doc, 2.5);
    expect(state.time).toBeCloseTo(0.5, 8);
    expect(state.localTime).toBeCloseTo(0.5, 8);
    expect(state.loopIteration).toBe(1);
    expect(state.targets.box.translateX).toBeCloseTo(2.5, 8);
    expect(evaluateDocument(doc, 4).loopIteration).toBe(2);
    expect(evaluateDocument(doc, 4).targets.box.translateX).toBeCloseTo(0, 8);
  });

  it("maps pingpong looping in both directions", () => {
    const track = linearTrack("move", "translateX", [0, 10]);
    const doc = makeDocument({
      loop: { enabled: true, mode: "pingpong" },
      tracks: [track],
    });
    const forward = evaluateDocument(doc, 1);
    const backward = evaluateDocument(doc, 3);
    expect(forward.targets.box.translateX).toBeCloseTo(5, 8);
    expect(backward.time).toBeCloseTo(1, 8);
    expect(backward.targets.box.translateX).toBeCloseTo(5, 8);
    expect(evaluateDocument(doc, 4.5).loopIteration).toBe(1);
    expect(evaluateDocument(doc, 4.5).time).toBeCloseTo(0.5, 8);
  });

  it("clamps a non-looping document to its end", () => {
    const track = linearTrack("move", "translateX", [0, 10]);
    const doc = makeDocument({ tracks: [track], loop: { enabled: false } });
    const state = evaluateDocument(doc, 99);
    expect(state.time).toBe(2);
    expect(state.loopIteration).toBe(0);
    expect(state.targets.box.translateX).toBeCloseTo(10, 8);
  });

  it("evaluates relative motion paths and orientation", () => {
    const track = makeTrack({
      id: "arc",
      property: "motionPath",
      path: "M 0 0 C 0 10 10 10 10 0",
      orient: true,
      easing: "linear",
      keyframes: [
        { at: 0, value: 0 },
        { at: 1, value: 1 },
      ],
    });
    const doc = makeDocument({ tracks: [track] });
    const halfway = evaluateTrack(track, doc, 1);
    expect(halfway).toBeCloseTo(0.5, 8);
    const target = evaluateDocument(doc, 1).targets.box;
    expect(target.motionPath?.progress).toBeCloseTo(0.5, 8);
    expect(target.motionPath?.x).toBeCloseTo(5, 4);
    expect(target.motionPath?.y).toBeCloseTo(7.5, 4);
    expect(Math.abs(target.motionPath?.angle ?? 0)).toBeLessThan(1);

    const noOrient = makeTrack({
      ...track,
      id: "arc-no-orient",
      orient: false,
    });
    const noOrientDoc = makeDocument({ tracks: [noOrient] });
    expect(
      evaluateDocument(noOrientDoc, 1).targets.box.motionPath?.angle,
    ).toBe(0);
  });

  it("attaches non-enumerable animated-property metadata", () => {
    const doc = makeDocument({
      tracks: [
        linearTrack("move", "translateX", [0, 10]),
        {
          ...linearTrack("turn", "rotate", [0, 20]),
          origin: "top-left" as const,
        },
      ],
    });
    const target = evaluateDocument(doc, 1).targets
      .box as EvaluatedTargetWithMeta;
    const meta = target[EVALUATED_TARGET_META];
    expect(meta?.origin).toBe("top-left");
    expect([...(meta?.properties ?? [])].sort()).toEqual([
      "rotate",
      "translateX",
    ]);
    expect(Object.keys(target)).toEqual([
      "translateX",
      "translateY",
      "rotate",
      "scaleX",
      "scaleY",
      "opacity",
    ]);
  });

  it("builds a timeline model with absolute keyframe times", () => {
    const track = linearTrack("move", "translateX", [0, 10], {
      delay: 0.5,
      duration: 1,
      label: "Slide box",
    });
    const doc = makeDocument({ duration: 3, tracks: [track] });
    const model = createTimelineModel(doc);
    expect(model.duration).toBe(3);
    expect(model.targetIds).toEqual(["box"]);
    expect(model.tracks[0].label).toBe("Slide box");
    expect(model.tracks[0].window).toEqual({
      start: 0.5,
      end: 1.5,
      duration: 1,
    });
    expect(model.tracks[0].keyframeTimes).toEqual([0.5, 1.5]);
    expect(trackWindow(track, doc)).toEqual({
      start: 0.5,
      end: 1.5,
      duration: 1,
    });
  });

  it("returns the same state object shape for repeated calls", () => {
    const doc: MotionDocument = makeDocument({
      tracks: [linearTrack("move", "translateX", [0, 10])],
      loop: { enabled: true, mode: "restart" },
    });
    expect(evaluateDocument(doc, 1.25)).toEqual(evaluateDocument(doc, 1.25));
  });
});
