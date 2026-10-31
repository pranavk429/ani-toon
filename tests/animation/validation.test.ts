import { describe, expect, it } from "vitest";

import {
  normalizeMotionDocument,
  validateMotionDocument,
  type MotionDocument,
  type StaggerGroup,
} from "@/lib/animation";
import { makeDocument, makeGraph, makeTrack, svgContext } from "./helpers";

const ctx = svgContext();

function group(overrides: Partial<StaggerGroup> = {}): StaggerGroup {
  return {
    id: "leaves",
    target: { kind: "svg" },
    elementIds: ["box", "dot"],
    property: "rotate",
    delay: 0.2,
    step: 0.1,
    duration: 1,
    keyframes: [
      { at: 0, value: 0 },
      { at: 1, value: 8 },
    ],
    ...overrides,
  };
}

describe("Motion DSL validation", () => {
  it("accepts a valid document and fills normalized defaults", () => {
    const result = validateMotionDocument(
      makeDocument({
        tracks: [
          makeTrack({
            id: "box-move",
            property: "translateX",
            keyframes: [
              { at: 0, value: 0 },
              { at: 1, value: 20 },
            ],
          }),
        ],
      }),
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.document).toBeDefined();
    const track = result.document?.tracks[0];
    expect(track?.delay).toBe(0);
    expect(track?.duration).toBe(2);
    expect(track?.easing).toBe("easeInOut");
    expect(track?.origin).toBe("center");
    expect(track?.muted).toBe(false);
    expect(result.document?.loop).toEqual({
      enabled: false,
      mode: "restart",
    });
    expect(result.document?.groups).toBeUndefined();
  });

  it("respects context duration bounds", () => {
    const result = validateMotionDocument(makeDocument({ duration: 0.5 }), {
      ...ctx,
      minDuration: 0.1,
      maxDuration: 0.4,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((issue) => issue.code === "duration")).toBe(true);
  });

  it("rejects bad versions, fps, durations and unknown fields", () => {
    const version = validateMotionDocument(
      { ...makeDocument(), version: 2 },
      ctx,
    );
    expect(version.errors.some((issue) => issue.code === "version")).toBe(true);

    const fps = validateMotionDocument({ ...makeDocument(), fps: 30 }, ctx);
    expect(fps.errors.some((issue) => issue.path === "fps")).toBe(true);

    const duration = validateMotionDocument(
      { ...makeDocument(), duration: 0.1 },
      ctx,
    );
    expect(duration.errors.some((issue) => issue.code === "duration")).toBe(
      true,
    );

    const extra = validateMotionDocument(
      { ...makeDocument(), unexpected: true },
      ctx,
    );
    expect(extra.errors.some((issue) => issue.path === "unexpected")).toBe(true);
  });

  it("rejects unknown or mismatched targets", () => {
    const unknown = validateMotionDocument(
      makeDocument({
        tracks: [
          makeTrack({
            id: "missing",
            property: "translateX",
            target: { kind: "svg", elementId: "nope" },
          }),
        ],
      }),
      ctx,
    );
    expect(unknown.ok).toBe(false);
    expect(
      unknown.errors.some(
        (issue) =>
          issue.code === "target" &&
          issue.path === "tracks[0].target.elementId",
      ),
    ).toBe(true);

    const mismatch = validateMotionDocument(
      makeDocument({
        targetKind: "character",
        tracks: [
          makeTrack({
            id: "wrong-kind",
            property: "translateX",
            target: { kind: "svg", elementId: "box" },
          }),
        ],
      }),
      { targetKind: "character", bones: [{ actorId: "hero", boneId: "head" }] },
    );
    expect(mismatch.errors.some((issue) => issue.code === "target")).toBe(true);
  });

  it("rejects properties and values that are invalid for the target kind", () => {
    const fillOnMascot = validateMotionDocument(
      {
        ...makeDocument({ targetKind: "character", tracks: [] }),
        tracks: [
          makeTrack({
            id: "bad-fill",
            property: "fill",
            target: { kind: "character", actorId: "hero", boneId: "head" },
          }),
        ],
      },
      { targetKind: "character", bones: [{ actorId: "hero", boneId: "head" }] },
    );
    expect(fillOnMascot.errors.some((issue) => issue.code === "property")).toBe(
      true,
    );

    const opacity = validateMotionDocument(
      makeDocument({
        tracks: [
          makeTrack({
            id: "bad-opacity",
            property: "opacity",
            keyframes: [
              { at: 0, value: 0 },
              { at: 1, value: 2 },
            ],
          }),
        ],
      }),
      ctx,
    );
    expect(
      opacity.errors.some(
        (issue) =>
          issue.code === "value" &&
          issue.path === "tracks[0].keyframes[1].value",
      ),
    ).toBe(true);

    const color = validateMotionDocument(
      makeDocument({
        tracks: [
          makeTrack({
            id: "bad-color",
            property: "fill",
            keyframes: [
              { at: 0, value: "#000" },
              { at: 1, value: "red" },
            ],
          }),
        ],
      }),
      ctx,
    );
    expect(color.errors.some((issue) => issue.code === "value")).toBe(true);

    const strokeWidth = validateMotionDocument(
      makeDocument({
        tracks: [
          makeTrack({
            id: "bad-stroke",
            property: "strokeWidth",
            keyframes: [{ at: 0, value: -1 }],
          }),
        ],
      }),
      ctx,
    );
    expect(strokeWidth.errors.some((issue) => issue.code === "value")).toBe(
      true,
    );
  });

  it("requires parseable paths for motionPath tracks", () => {
    const missing = validateMotionDocument(
      makeDocument({
        tracks: [
          makeTrack({
            id: "arc",
            property: "motionPath",
            keyframes: [
              { at: 0, value: 0 },
              { at: 1, value: 1 },
            ],
          }),
        ],
      }),
      ctx,
    );
    expect(
      missing.errors.some((issue) => issue.path === "tracks[0].path"),
    ).toBe(true);

    const invalid = validateMotionDocument(
      makeDocument({
        tracks: [
          makeTrack({
            id: "arc",
            property: "motionPath",
            path: "M 0 0 Q",
            keyframes: [
              { at: 0, value: 0 },
              { at: 1, value: 1 },
            ],
          }),
        ],
      }),
      ctx,
    );
    expect(
      invalid.errors.some(
        (issue) =>
          issue.code === "value" && issue.path === "tracks[0].path",
      ),
    ).toBe(true);
  });

  it("rejects non-ascending and duplicate keyframe times", () => {
    const result = validateMotionDocument(
      makeDocument({
        tracks: [
          makeTrack({
            id: "bad-keys",
            property: "translateX",
            keyframes: [
              { at: 0, value: 0 },
              { at: 0.5, value: 4 },
              { at: 0.5, value: 8 },
            ],
          }),
        ],
      }),
      ctx,
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((issue) => issue.code === "keyframes")).toBe(
      true,
    );
    expect(
      result.errors.some(
        (issue) => issue.path === "tracks[0].keyframes[2].at",
      ),
    ).toBe(true);
  });

  it("allows multiple same target/property tracks but rejects duplicate ids", () => {
    const explicit = validateMotionDocument(
      makeDocument({
        tracks: [
          makeTrack({
            id: "a",
            property: "translateX",
            target: { kind: "svg", elementId: "box" },
          }),
          makeTrack({
            id: "b",
            property: "translateX",
            target: { kind: "svg", elementId: "box" },
          }),
        ],
      }),
      ctx,
    );
    expect(explicit.ok).toBe(true);
    expect(explicit.errors).toEqual([]);
    expect(explicit.document?.tracks).toHaveLength(2);
    // Overlapping windows are allowed but surfaced as a warning.
    expect(
      explicit.warnings.some((issue) => /overlaps/.test(issue.message)),
    ).toBe(true);

    const groupSameProperty = validateMotionDocument(
      makeDocument({
        tracks: [
          makeTrack({
            id: "box-rotate",
            property: "rotate",
            target: { kind: "svg", elementId: "box" },
          }),
        ],
        groups: [group()],
      }),
      ctx,
    );
    expect(groupSameProperty.ok).toBe(true);
    expect(groupSameProperty.document?.tracks).toHaveLength(3);

    const duplicateId = validateMotionDocument(
      makeDocument({
        tracks: [
          makeTrack({ id: "same-id", property: "translateX" }),
          makeTrack({ id: "same-id", property: "opacity" }),
        ],
      }),
      ctx,
    );
    expect(duplicateId.ok).toBe(false);
    expect(
      duplicateId.errors.some((issue) => issue.code === "duplicate"),
    ).toBe(true);
  });

  it("rejects tracks that end beyond the document duration", () => {
    const result = validateMotionDocument(
      makeDocument({
        duration: 2,
        tracks: [
          makeTrack({
            id: "too-long",
            property: "translateX",
            delay: 1,
            duration: 2,
          }),
        ],
      }),
      ctx,
    );
    expect(result.ok).toBe(false);
    expect(
      result.errors.some(
        (issue) =>
          issue.code === "timing" && issue.path === "tracks[0].duration",
      ),
    ).toBe(true);
  });

  it("defaults an omitted track duration to the remaining document time", () => {
    const result = validateMotionDocument(
      makeDocument({
        duration: 3,
        tracks: [
          makeTrack({
            id: "delayed",
            property: "translateX",
            delay: 1.25,
          }),
        ],
      }),
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(result.document?.tracks[0].duration).toBeCloseTo(1.75, 6);
  });

  it("rejects unknown easings and invalid structured easings", () => {
    const unknown = validateMotionDocument(
      makeDocument({
        tracks: [
          makeTrack({
            id: "bad-ease",
            property: "translateX",
            easing: "wobble" as never,
          }),
        ],
      }),
      ctx,
    );
    expect(unknown.errors.some((issue) => issue.code === "value")).toBe(true);

    const bezier = validateMotionDocument(
      makeDocument({
        tracks: [
          makeTrack({
            id: "bad-bezier",
            property: "translateX",
            easing: { type: "cubicBezier", x1: 2, y1: 0, x2: 1, y2: 1 },
          }),
        ],
      }),
      ctx,
    );
    expect(bezier.errors.some((issue) => issue.path.endsWith(".x1"))).toBe(
      true,
    );
  });

  it("expands stagger groups with unique ids and delays", () => {
    const result = validateMotionDocument(
      makeDocument({ tracks: [], groups: [group()] }),
      ctx,
    );
    expect(result.ok).toBe(true);
    const tracks = result.document?.tracks ?? [];
    expect(tracks.map((track) => track.id)).toEqual([
      "leaves__box",
      "leaves__dot",
    ]);
    expect(tracks[0].delay).toBeCloseTo(0.2, 6);
    expect(tracks[1].delay).toBeCloseTo(0.3, 6);
    expect(tracks[0].duration).toBe(1);
    expect(result.document?.groups).toBeUndefined();
  });

  it("clamps a later stagger target into the document instead of failing the group", () => {
    const result = validateMotionDocument(
      makeDocument({
        duration: 2.6,
        tracks: [],
        groups: [
          group({
            delay: 0,
            step: 0.25,
            duration: 2.2,
            elementIds: ["box", "dot", "line"],
          }),
        ],
      }),
      ctx,
    );
    expect(result.ok).toBe(true);
    const last = result.document?.tracks.find(
      (track) => track.id === "leaves__line",
    );
    expect(last?.delay).toBeCloseTo(0.5, 6);
    expect(last?.duration).toBeCloseTo(2.1, 6);
    expect(
      result.warnings.some(
        (issue) => issue.path === "groups[0].elementIds[2]",
      ),
    ).toBe(true);
  });

  it("rejects group counts, track counts and keyframe counts over limits", () => {
    const tooManyTracks = Array.from({ length: 201 }, (_, index) =>
      makeTrack({
        id: `t${index}`,
        property: "translateX",
        keyframes: [{ at: 0, value: index }],
      }),
    );
    const tracks = validateMotionDocument(
      makeDocument({ tracks: tooManyTracks }),
      ctx,
    );
    expect(tracks.errors.some((issue) => issue.path === "tracks")).toBe(true);

    const tooManyGroups = Array.from({ length: 41 }, (_, index) =>
      group({ id: `g${index}`, elementIds: ["box"] }),
    );
    const groups = validateMotionDocument(
      makeDocument({ tracks: [], groups: tooManyGroups }),
      ctx,
    );
    expect(groups.errors.some((issue) => issue.path === "groups")).toBe(true);

    const tooManyKeyframes = Array.from({ length: 65 }, (_, index) => ({
      at: index / 64,
      value: index,
    }));
    const keyframes = validateMotionDocument(
      makeDocument({
        tracks: [
          makeTrack({
            id: "many",
            property: "translateX",
            keyframes: tooManyKeyframes,
          }),
        ],
      }),
      ctx,
    );
    expect(keyframes.errors.some((issue) => issue.code === "keyframes")).toBe(
      true,
    );
  });

  it("drops muted tracks only when allowMuted is false", () => {
    const doc = makeDocument({
      tracks: [
        makeTrack({ id: "visible", property: "translateX" }),
        makeTrack({ id: "muted", property: "opacity", muted: true }),
      ],
    });
    const kept = validateMotionDocument(doc, ctx);
    expect(kept.document?.tracks).toHaveLength(2);

    const dropped = validateMotionDocument(doc, {
      ...ctx,
      allowMuted: false,
    });
    expect(dropped.document?.tracks.map((track) => track.id)).toEqual([
      "visible",
    ]);
    expect(dropped.warnings.length).toBeGreaterThan(0);
  });

  it("normalizeMotionDocument and validateMotionDocument agree", () => {
    const doc = makeDocument({ tracks: [], groups: [group()] });
    const normalized = normalizeMotionDocument(doc, ctx);
    const validated = validateMotionDocument(doc, ctx);
    expect(normalized.ok).toBe(true);
    expect(normalized.document).toEqual(validated.document);
  });

  it("does not mutate the input document", () => {
    const doc: MotionDocument = makeDocument({
      tracks: [],
      groups: [group()],
    });
    const snapshot = JSON.parse(JSON.stringify(doc)) as MotionDocument;
    validateMotionDocument(doc, ctx);
    expect(doc).toEqual(snapshot);
  });

  it("accepts a character document with real bone ids", () => {
    const doc = makeDocument({
      targetKind: "character",
      tracks: [
        makeTrack({
          id: "head-nod",
          property: "rotate",
          target: { kind: "character", actorId: "hero", boneId: "head" },
        }),
      ],
    });
    const result = validateMotionDocument(doc, {
      targetKind: "character",
      bones: [
        { actorId: "hero", boneId: "head" },
        { actorId: "hero", boneId: "body" },
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.document?.tracks[0].origin).toBe("bone");
  });

  it("keeps the fixture context aligned with the scene graph", () => {
    expect(makeGraph().order).toEqual(["box", "dot", "line", "label"]);
  });
});
