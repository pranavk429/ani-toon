import { describe, expect, it } from "vitest";

import {
  diffMotionDocuments,
  type MotionDocument,
} from "@/lib/animation";
import { makeDocument, makeTrack } from "./helpers";

function clone(doc: MotionDocument): MotionDocument {
  return JSON.parse(JSON.stringify(doc)) as MotionDocument;
}

function baseDocument(): MotionDocument {
  return makeDocument({
    tracks: [
      makeTrack({
        id: "box-move",
        property: "translateX",
        keyframes: [
          { at: 0, value: 0 },
          { at: 1, value: 10 },
        ],
      }),
      makeTrack({
        id: "box-fade",
        property: "opacity",
        keyframes: [
          { at: 0, value: 1 },
          { at: 1, value: 0.5 },
        ],
      }),
    ],
    groups: [
      {
        id: "leaves",
        target: { kind: "svg" },
        elementIds: ["dot", "line"],
        property: "rotate",
        step: 0.1,
        duration: 1,
        keyframes: [
          { at: 0, value: 0 },
          { at: 1, value: 8 },
        ],
      },
    ],
  });
}

describe("diffMotionDocuments", () => {
  it("reports added, removed, modified and unchanged tracks", () => {
    const previous = baseDocument();
    const next = clone(previous);
    next.tracks = next.tracks.filter((track) => track.id !== "box-fade");
    next.tracks.push(
      makeTrack({
        id: "box-color",
        property: "fill",
        keyframes: [
          { at: 0, value: "#000000" },
          { at: 1, value: "#ffffff" },
        ],
      }),
    );
    const moved = next.tracks.find((track) => track.id === "box-move");
    if (moved) {
      moved.keyframes[moved.keyframes.length - 1].value = 42;
    }

    const changes = diffMotionDocuments(previous, next);
    expect(changes.added).toEqual(["box-color"]);
    expect(changes.removed).toEqual(["box-fade"]);
    expect(changes.modified).toEqual(["box-move"]);
    expect(changes.unchanged).toEqual([
      "leaves__dot",
      "leaves__line",
    ]);
  });

  it("treats group expansion and key order as equivalent", () => {
    const previous = baseDocument();
    const next = clone(previous);
    next.groups = undefined;
    next.tracks = [
      ...next.tracks,
      makeTrack({
        id: "leaves__dot",
        property: "rotate",
        target: { kind: "svg", elementId: "dot" },
        delay: 0,
        duration: 1,
        keyframes: [
          { at: 0, value: 0 },
          { at: 1, value: 8 },
        ],
      }),
      makeTrack({
        id: "leaves__line",
        property: "rotate",
        target: { kind: "svg", elementId: "line" },
        delay: 0.1,
        duration: 1,
        keyframes: [
          { at: 0, value: 0 },
          { at: 1, value: 8 },
        ],
      }),
    ];

    const changes = diffMotionDocuments(previous, next);
    expect(changes.added).toEqual([]);
    expect(changes.removed).toEqual([]);
    expect(changes.modified).toEqual([]);
    expect(changes.unchanged).toContain("leaves__dot");
    expect(changes.unchanged).toContain("leaves__line");
  });

  it("diffs multiple tracks for the same target/property by track id", () => {
    const previous = makeDocument({
      tracks: [
        makeTrack({
          id: "shake",
          property: "translateX",
          duration: 0.7,
          keyframes: [
            { at: 0, value: 0 },
            { at: 1, value: -8 },
          ],
        }),
        makeTrack({
          id: "launch",
          property: "translateX",
          delay: 0.7,
          duration: 1.3,
          keyframes: [
            { at: 0, value: 0 },
            { at: 1, value: 10 },
          ],
        }),
      ],
    });
    const next = clone(previous);
    const launch = next.tracks.find((track) => track.id === "launch");
    if (launch) launch.keyframes[1].value = 20;

    const changes = diffMotionDocuments(previous, next);
    expect(changes.modified).toEqual(["launch"]);
    expect(changes.unchanged).toEqual(["shake"]);
    expect(changes.added).toEqual([]);
    expect(changes.removed).toEqual([]);
  });

  it("detects easing changes without depending on object key order", () => {
    const previous = baseDocument();
    const next = clone(previous);
    const first = next.tracks.find((track) => track.id === "box-move");
    if (first) {
      first.easing = { type: "spring", stiffness: 12, damping: 5, mass: 1 };
    }
    const reordered = clone(next);
    const changed = reordered.tracks.find((track) => track.id === "box-move");
    if (changed) {
      changed.easing = { mass: 1, damping: 5, stiffness: 12, type: "spring" };
    }

    expect(diffMotionDocuments(previous, next).modified).toEqual(["box-move"]);
    expect(diffMotionDocuments(next, reordered).modified).toEqual([]);
  });
});
