import { describe, expect, it } from "vitest";

import {
  downloadBlob,
  parseProjectJson,
  projectToJson,
  renderWebM,
  safeFilename,
  svgMarkupToPng,
} from "@/lib/studio-export";
import {
  PROJECT_SCHEMA_VERSION,
  type AniProject,
} from "@/lib/studio/contracts";
import { buildSofiaScene } from "@/creature/examples";
import { makeDocument, makeGraph } from "../animation/helpers";

function createValidCharacterProject(): AniProject {
  const scene = buildSofiaScene();
  const motion = makeDocument({
    id: "anim_sofia_test",
    name: "Sofia Test Motion",
    targetKind: "character",
    tracks: [],
  });
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: "proj_sofia_123",
    name: "Sofia Tennis Morning",
    createdAt: "2026-10-31T12:00:00.000Z",
    updatedAt: "2026-10-31T12:30:00.000Z",
    styleId: "anitoon-storybook-v1",
    source: {
      kind: "character",
      scene,
    },
    motion,
    prompt: "A focused tennis player serving on court",
  };
}

function createValidSvgProject(): AniProject {
  const graph = makeGraph();
  const motion = makeDocument({
    id: "anim_svg_test",
    name: "SVG Rocket Motion",
    targetKind: "svg",
  });
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: "proj_svg_456",
    name: "Rocket Launch Project",
    createdAt: "2026-10-31T12:00:00.000Z",
    updatedAt: "2026-10-31T12:45:00.000Z",
    styleId: "anitoon-storybook-v1",
    source: {
      kind: "svg",
      graph,
      sourceSvg: graph.sanitizedSvg,
      filename: "rocket.svg",
    },
    motion,
  };
}

describe("safeFilename", () => {
  it("converts spaces and mixed case to lowercase hyphenated names", () => {
    expect(safeFilename("Sofia Tennis Jump")).toBe("sofia-tennis-jump");
  });

  it("strips special symbols and collapses consecutive hyphens", () => {
    expect(safeFilename("Rocket #1 -- Super @ Launch!!")).toBe("rocket-1-super-launch");
  });

  it("trims leading and trailing hyphens", () => {
    expect(safeFilename("---leading-and-trailing---")).toBe("leading-and-trailing");
  });

  it("slices strings to at most 60 characters", () => {
    const veryLongName = "a".repeat(100);
    const result = safeFilename(veryLongName);
    expect(result).toHaveLength(60);
    expect(result).toBe("a".repeat(60));
  });

  it("falls back to default fallback 'ani-project' when cleaned result is empty", () => {
    expect(safeFilename("")).toBe("ani-project");
    expect(safeFilename("   ")).toBe("ani-project");
    expect(safeFilename("!@#$%^&*()_+=")).toBe("ani-project");
  });

  it("honors custom fallback parameter", () => {
    expect(safeFilename("   ", "custom-fallback")).toBe("custom-fallback");
    expect(safeFilename("???", "my-fallback")).toBe("my-fallback");
  });
});

describe("projectToJson and parseProjectJson round-trip", () => {
  it("performs lossless round-trip for a character project", () => {
    const original = createValidCharacterProject();
    const json = projectToJson(original);
    const parsed = parseProjectJson(json);

    expect(parsed).toEqual(original);
    expect(parsed.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
    expect(parsed.id).toBe(original.id);
    expect(parsed.source.kind).toBe("character");
  });

  it("performs lossless round-trip for an SVG project", () => {
    const original = createValidSvgProject();
    const json = projectToJson(original);
    const parsed = parseProjectJson(json);

    expect(parsed).toEqual(original);
    expect(parsed.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
    expect(parsed.id).toBe(original.id);
    expect(parsed.source.kind).toBe("svg");
  });
});

describe("parseProjectJson malformed input rejection", () => {
  it("rejects invalid JSON syntax", () => {
    expect(() => parseProjectJson("{not valid json")).toThrow(
      "That file is not valid JSON.",
    );
  });

  it("rejects non-object JSON values", () => {
    expect(() => parseProjectJson('"a string"')).toThrow(
      "The project file must be a JSON object.",
    );
    expect(() => parseProjectJson("123")).toThrow(
      "The project file must be a JSON object.",
    );
    expect(() => parseProjectJson("null")).toThrow(
      "The project file must be a JSON object.",
    );
    expect(() => parseProjectJson("[]")).toThrow(
      "The project file must be a JSON object.",
    );
  });

  it("rejects unsupported schemaVersion", () => {
    const raw = createValidCharacterProject();
    const withWrongVersion = { ...raw, schemaVersion: 2 };
    expect(() => parseProjectJson(JSON.stringify(withWrongVersion))).toThrow(
      "Unsupported project schema version: 2.",
    );

    const withMissingVersion = { ...raw, schemaVersion: undefined };
    expect(() => parseProjectJson(JSON.stringify(withMissingVersion))).toThrow(
      "Unsupported project schema version: undefined.",
    );
  });

  it("rejects projects missing id or name", () => {
    const raw = createValidCharacterProject();
    const withoutId = { ...raw, id: undefined };
    expect(() => parseProjectJson(JSON.stringify(withoutId))).toThrow(
      "The project file is missing an id or name.",
    );

    const withoutName = { ...raw, name: undefined };
    expect(() => parseProjectJson(JSON.stringify(withoutName))).toThrow(
      "The project file is missing an id or name.",
    );

    const withNonStringName = { ...raw, name: 42 };
    expect(() => parseProjectJson(JSON.stringify(withNonStringName))).toThrow(
      "The project file is missing an id or name.",
    );
  });

  it("rejects projects missing source or motion document", () => {
    const raw = createValidCharacterProject();
    const withoutSource = { ...raw, source: undefined };
    expect(() => parseProjectJson(JSON.stringify(withoutSource))).toThrow(
      "The project file is missing its source or motion document.",
    );

    const withoutMotion = { ...raw, motion: undefined };
    expect(() => parseProjectJson(JSON.stringify(withoutMotion))).toThrow(
      "The project file is missing its source or motion document.",
    );

    const withArraySource = { ...raw, source: [] };
    expect(() => parseProjectJson(JSON.stringify(withArraySource))).toThrow(
      "The project file is missing its source or motion document.",
    );
  });
});

describe("Browser export pure boundary verification (Node environment)", () => {
  it("verifies Node lacks browser DOM globals without faking a DOM", () => {
    expect(typeof document).toBe("undefined");
    expect(typeof window).toBe("undefined");
  });

  it("downloadBlob safely no-ops when document is undefined in node", () => {
    // Should not throw or crash in Node
    expect(() => downloadBlob(new Blob(["test"]), "test.json")).not.toThrow();
  });

  it("svgMarkupToPng rejects with descriptive browser-only error in node", async () => {
    await expect(svgMarkupToPng("<svg></svg>")).rejects.toThrow(
      "PNG export runs in the browser.",
    );
  });

  it("renderWebM rejects with descriptive browser-only error in node", async () => {
    await expect(
      renderWebM(() => null, { duration: 1 }),
    ).rejects.toThrow("WebM export runs in the browser.");
  });

  it("documents why serializeStageSvg is skipped in pure node tests", () => {
    // Note: serializeStageSvg relies on SVGSVGElement.cloneNode and XMLSerializer,
    // which are browser DOM APIs. Because jsdom is not installed and faking a DOM
    // is explicitly forbidden by product policy, serializeStageSvg is exercised in
    // browser manual QA (see qa/STUDIO_QA.md) rather than simulated in node.
    expect(true).toBe(true);
  });
});
