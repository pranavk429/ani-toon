import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AniProject } from "@/lib/studio/contracts";
import { characterContextForScene } from "@/creature/motion";

const build = process.env.BUILD_REVISION === "1" ? it : it.skip;

describe("build live revision request", () => {
  build("writes the request fixture", () => {
    const project = JSON.parse(
      readFileSync(resolve(process.cwd(), "agent-reports/live-project.json"), "utf8"),
    ) as AniProject;
    if (project.source.kind !== "character") throw new Error("character project required");
    const payload = {
      version: 1,
      action: "revise",
      targetKind: "character",
      instruction:
        "Make the jump higher, slow down the landing, make Kiran look surprised just before jumping, and change the smile into a big laugh at the end.",
      character: characterContextForScene(project.source.scene),
      currentDocument: project.motion,
      history: [],
    };
    writeFileSync(resolve(process.cwd(), "agent-reports/revision-request.json"), JSON.stringify(payload, null, 2));
    expect(payload.currentDocument.tracks.length).toBeGreaterThan(0);
  });
});
