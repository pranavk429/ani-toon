import { describe, expect, it } from "vitest";
import type { Keyframe, MotionDocument, MotionTrack } from "@/lib/animation/types";
import { validateMotionDocument } from "@/lib/animation/validate";
import { validationContextForScene } from "@/creature/motion";
import { importSvg } from "@/lib/svg";
import {
  buildSofiaStarterProject,
  buildStarterSvgProject,
  classifyInstructionIntent,
  createHistory,
  deleteTrackFromDocument,
  filterDocumentTracks,
  formatBytesShort,
  formatClock,
  formatSeconds,
  pushHistory,
  redoHistory,
  revisionSourceLabel,
  undoHistory,
  updateKeyframeValues,
  updateTrackInDocument,
} from "@/components/ani-studio/utils";

function mockTrack(id: string): MotionTrack {
  return {
    id,
    target: { kind: "character", actorId: "sofia", boneId: "head" },
    property: "rotate",
    keyframes: [
      { at: 0, value: 0 },
      { at: 0.5, value: 10 },
      { at: 1, value: 0 },
    ],
    delay: 0,
    duration: 8,
  };
}

function mockDoc(tracks: MotionTrack[]): MotionDocument {
  return {
    version: 1,
    id: "test-doc",
    name: "Test Doc",
    targetKind: "character",
    duration: 8,
    fps: 60,
    loop: { enabled: true },
    tracks,
  };
}

describe("ANI Studio: time and formatting helpers", () => {
  it("formats clock with minute, seconds, and tenths", () => {
    expect(formatClock(0)).toBe("0:00.0");
    expect(formatClock(3.2)).toBe("0:03.2");
    expect(formatClock(65.4)).toBe("1:05.4");
    expect(formatClock(-10)).toBe("0:00.0");
  });

  it("formats seconds with single decimal place", () => {
    expect(formatSeconds(3.1415)).toBe("3.1s");
    expect(formatSeconds(0)).toBe("0.0s");
    expect(formatSeconds(12)).toBe("12.0s");
  });

  it("formats byte sizes human-readably", () => {
    expect(formatBytesShort(500)).toBe("500 B");
    expect(formatBytesShort(2048)).toBe("2.0 KB");
    expect(formatBytesShort(2.5 * 1024 * 1024)).toBe("2.50 MB");
  });
});

describe("ANI Studio: track filtering and source labels", () => {
  it("filters out hidden tracks and preserves original when empty", () => {
    const doc = mockDoc([mockTrack("t1"), mockTrack("t2"), mockTrack("t3")]);
    expect(filterDocumentTracks(doc, [])).toBe(doc);

    const filtered = filterDocumentTracks(doc, ["t2"]);
    expect(filtered.tracks.map((t) => t.id)).toEqual(["t1", "t3"]);
  });

  it("labels revision sources honestly without claiming fallback as AI", () => {
    expect(revisionSourceLabel("ai")).toBe("Hosted AI");
    expect(revisionSourceLabel("fallback")).toBe("Local fallback");
    expect(revisionSourceLabel("manual")).toBe("Manual");
    expect(revisionSourceLabel("preset")).toBe("Preset");
  });
});

describe("ANI Studio: keyframe and track editing", () => {
  it("updates first and last keyframe values immutably", () => {
    const kfs: Keyframe[] = [
      { at: 0, value: 0 },
      { at: 0.5, value: 15 },
      { at: 1, value: 30 },
    ];

    const updated = updateKeyframeValues(kfs, -10, 45);
    expect(updated[0].value).toBe(-10);
    expect(updated[1].value).toBe(15);
    expect(updated[2].value).toBe(45);
    // Original untouched
    expect(kfs[0].value).toBe(0);
    expect(kfs[2].value).toBe(30);
  });

  it("updates track properties in a document immutably", () => {
    const doc = mockDoc([mockTrack("t1"), mockTrack("t2")]);
    const updated = updateTrackInDocument(doc, "t1", {
      label: "Custom Label",
      duration: 5,
    });

    expect(updated.tracks[0].label).toBe("Custom Label");
    expect(updated.tracks[0].duration).toBe(5);
    expect(doc.tracks[0].label).toBeUndefined();
  });

  it("deletes a track by id from a document", () => {
    const doc = mockDoc([mockTrack("t1"), mockTrack("t2")]);
    const updated = deleteTrackFromDocument(doc, "t1");
    expect(updated.tracks.map((t) => t.id)).toEqual(["t2"]);
  });
});

describe("ANI Studio: instruction intent classification", () => {
  it("identifies appearance instructions", () => {
    expect(classifyInstructionIntent("Change the shirt to blue")).toBe("appearance");
    expect(classifyInstructionIntent("Add a cowboy hat")).toBe("appearance");
    expect(classifyInstructionIntent("Make the hair blonde and add glasses")).toBe(
      "appearance",
    );
    expect(classifyInstructionIntent("Remove shoes and change outfit")).toBe(
      "appearance",
    );
  });

  it("identifies motion instructions", () => {
    expect(classifyInstructionIntent("Make the jump higher")).toBe("motion");
    expect(classifyInstructionIntent("Slow down the landing and swing faster")).toBe(
      "motion",
    );
    expect(classifyInstructionIntent("Blink and wave arms")).toBe("motion");
    expect(classifyInstructionIntent("Make her nod her head")).toBe("motion");
    expect(classifyInstructionIntent("Make it more playful")).toBe("motion");
  });

  it("identifies combined or ambiguous instructions as both", () => {
    expect(
      classifyInstructionIntent("Jump higher and change the shirt to green"),
    ).toBe("both");
    expect(
      classifyInstructionIntent("Add a hat and make her jump"),
    ).toBe("both");
  });
});

describe("ANI Studio: bounded undo/redo stack", () => {
  it("pushes history, supports undo, and redo", () => {
    let hist = createHistory<string>("state-0");
    expect(hist.present).toBe("state-0");
    expect(hist.past).toEqual([]);
    expect(hist.future).toEqual([]);

    hist = pushHistory(hist, "state-1");
    hist = pushHistory(hist, "state-2");
    expect(hist.present).toBe("state-2");
    expect(hist.past).toEqual(["state-0", "state-1"]);

    hist = undoHistory(hist);
    expect(hist.present).toBe("state-1");
    expect(hist.future).toEqual(["state-2"]);

    hist = undoHistory(hist);
    expect(hist.present).toBe("state-0");
    expect(hist.future).toEqual(["state-1", "state-2"]);

    hist = redoHistory(hist);
    expect(hist.present).toBe("state-1");
    expect(hist.future).toEqual(["state-2"]);

    // Pushing new branch clears future
    hist = pushHistory(hist, "state-branch");
    expect(hist.present).toBe("state-branch");
    expect(hist.future).toEqual([]);
  });

  it("bounds undo history to maximum entries", () => {
    let hist = createHistory<number>(0);
    for (let i = 1; i <= 40; i++) {
      hist = pushHistory(hist, i, 30);
    }
    expect(hist.past.length).toBe(30);
    expect(hist.past[0]).toBe(10);
    expect(hist.present).toBe(40);
  });
});

describe("ANI Studio: Sofia starter project validation", () => {
  it("builds an authoritative Sofia project that passes motion document validation", () => {
    const project = buildSofiaStarterProject();
    expect(project.schemaVersion).toBe(1);
    expect(project.source.kind).toBe("character");

    if (project.source.kind !== "character") {
      throw new Error("Expected character source");
    }

    const scene = project.source.scene;
    expect(scene.actors[0].id).toBe("sofia");
    expect(scene.score.duration).toBe(8000);

    const motion = project.motion;
    expect(motion.targetKind).toBe("character");
    expect(motion.duration).toBe(8);
    expect(motion.meta?.source).toBe("manual");
    expect(motion.tracks.length).toBeGreaterThanOrEqual(4);

    const valContext = validationContextForScene(scene);
    const result = validateMotionDocument(motion, valContext);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("builds a valid starter SVG project", () => {
    const rawSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle id="logo-circle" cx="50" cy="50" r="40" fill="#4B63FF" /></svg>';
    const importRes = importSvg(rawSvg, { filename: "test.svg" });
    expect(importRes.ok).toBe(true);
    if (!importRes.ok) throw new Error("Failed to import SVG");

    const project = buildStarterSvgProject(importRes.graph, rawSvg, "test.svg");
    expect(project.source.kind).toBe("svg");
    expect(project.motion.targetKind).toBe("svg");
    expect(project.motion.tracks.length).toBe(1);
    expect(project.motion.tracks[0].target).toEqual({
      kind: "svg",
      elementId: "logo-circle",
    });

    const result = validateMotionDocument(project.motion, {
      targetKind: "svg",
      elementIds: new Set(["logo-circle"]),
    });
    expect(result.ok).toBe(true);
  });
});
