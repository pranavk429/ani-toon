import { describe, expect, it } from "vitest";

import type { MotionDocument, MotionTrack } from "@/lib/animation/types";
import {
  absoluteKeyframeSeconds,
  buildTimeTicks,
  changedTrackCount,
  chooseTickSeconds,
  clamp,
  filterDocumentTracks,
  flattenVisibleElements,
  formatBbox,
  formatClock,
  formatViewBox,
  revisionSourceLabel,
  safeFilename,
  summarizeChanges,
  timePercent,
} from "@/components/studio/ai/studio-utils";

const changes = {
  added: ["a", "b"],
  removed: ["c"],
  modified: ["d"],
  unchanged: ["e", "f"],
};

function track(id: string): MotionTrack {
  return {
    id,
    target: { kind: "svg", elementId: "shape" },
    property: "opacity",
    keyframes: [
      { at: 0, value: 0 },
      { at: 1, value: 1 },
    ],
    delay: 0,
    duration: 1,
  };
}

function documentWithTracks(tracks: MotionTrack[]): MotionDocument {
  return {
    version: 1,
    id: "anim_test",
    name: "Test",
    targetKind: "svg",
    duration: 2,
    fps: 60,
    loop: { enabled: false },
    tracks,
  };
}

describe("studio numeric helpers", () => {
  it("clamps invalid and out-of-range values", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
    expect(clamp(Number.NaN, 2, 10)).toBe(2);
  });

  it("formats transport time", () => {
    expect(formatClock(0)).toBe("0:00.0");
    expect(formatClock(3.25)).toBe("0:03.2");
    expect(formatClock(65.9)).toBe("1:05.9");
    expect(formatClock(-4)).toBe("0:00.0");
  });

  it("chooses readable ruler steps", () => {
    expect(chooseTickSeconds(0.5)).toBe(0.1);
    expect(chooseTickSeconds(3.2)).toBe(1);
    expect(chooseTickSeconds(10)).toBe(2);
    expect(chooseTickSeconds(60)).toBe(15);
  });

  it("builds ruler ticks from the real duration", () => {
    expect(buildTimeTicks(3.2).map((tick) => tick.time)).toEqual([0, 1, 2, 3]);
    expect(buildTimeTicks(0)).toEqual([]);
  });

  it("maps seconds to percentages and rejects zero durations", () => {
    expect(timePercent(1, 4)).toBe(25);
    expect(timePercent(9, 4)).toBe(100);
    expect(timePercent(1, 0)).toBe(0);
  });

  it("computes absolute keyframe times and clamps at", () => {
    expect(
      absoluteKeyframeSeconds({ start: 1, duration: 2 }, 0.5),
    ).toBe(2);
    expect(
      absoluteKeyframeSeconds({ start: 1, duration: 2 }, -1),
    ).toBe(1);
    expect(
      absoluteKeyframeSeconds({ start: 1, duration: 2 }, 2),
    ).toBe(3);
  });
});

describe("studio change summaries", () => {
  it("counts every changed track exactly once", () => {
    expect(changedTrackCount(changes)).toBe(4);
  });

  it("summarizes added, removed and modified tracks", () => {
    expect(summarizeChanges(changes)).toBe("2 added · 1 removed · 1 modified");
    expect(
      summarizeChanges({ added: [], removed: [], modified: [], unchanged: [] }),
    ).toBe("No track changes");
  });

  it("labels provider sources honestly", () => {
    expect(revisionSourceLabel("ai")).toBe("Hosted AI");
    expect(revisionSourceLabel("fallback")).toBe("Local fallback");
    expect(revisionSourceLabel("manual")).toBe("Manual");
  });
});

describe("studio formatting", () => {
  it("makes safe download names", () => {
    expect(safeFilename("Rocket / Launch: v2")).toBe("Rocket-Launch-v2");
    expect(safeFilename("   ")).toBe("animation");
    expect(safeFilename("a".repeat(120)).length).toBe(80);
  });

  it("formats asset geometry", () => {
    expect(formatBbox({ x: 1.234, y: 2, w: 10, h: 20 })).toBe(
      "1.2, 2.0 · 10.0×20.0",
    );
    expect(formatViewBox({ minX: 0, minY: 0, width: 512, height: 256 })).toBe(
      "0 0 512 256",
    );
  });
});

describe("scene graph flattening", () => {
  const graph = {
    rootIds: ["group", "other"],
    elements: {
      group: { id: "group", childIds: ["a", "b"] },
      a: { id: "a", childIds: [] },
      b: { id: "b", childIds: [] },
      other: { id: "other", childIds: [] },
    },
  };

  it("walks roots and expanded children in paint order", () => {
    expect(
      flattenVisibleElements(graph, new Set(["group"])).map((row) => ({
        id: row.id,
        depth: row.depth,
        zIndex: row.zIndex,
      })),
    ).toEqual([
      { id: "group", depth: 0, zIndex: 0 },
      { id: "a", depth: 1, zIndex: 0 },
      { id: "b", depth: 1, zIndex: 1 },
      { id: "other", depth: 0, zIndex: 1 },
    ]);
  });

  it("stops at collapsed groups", () => {
    expect(
      flattenVisibleElements(graph, new Set()).map((row) => row.id),
    ).toEqual(["group", "other"]);
  });

  it("survives cycles and missing ids", () => {
    const cyclic = {
      rootIds: ["a", "missing"],
      elements: {
        a: { id: "a", childIds: ["b"] },
        b: { id: "b", childIds: ["a"] },
      },
    };
    expect(
      flattenVisibleElements(cyclic, new Set(["a", "b"])).map((row) => row.id),
    ).toEqual(["a", "b"]);
  });
});

describe("hidden track filtering", () => {
  it("returns the same document when nothing is hidden", () => {
    const doc = documentWithTracks([track("one")]);
    expect(filterDocumentTracks(doc, [])).toBe(doc);
  });

  it("removes only the requested tracks", () => {
    const doc = documentWithTracks([track("one"), track("two")]);
    const filtered = filterDocumentTracks(doc, ["one"]);
    expect(filtered).not.toBe(doc);
    expect(filtered.tracks.map((entry) => entry.id)).toEqual(["two"]);
  });
});
