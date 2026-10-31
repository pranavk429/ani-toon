import { describe, expect, it } from "vitest";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { AnimationDirectionResponse } from "@/lib/ai/contracts";
import type { AniProject } from "@/lib/studio/contracts";
import { validateMotionDocument } from "@/lib/animation";
import { characterContextForScene, validationContextForScene } from "@/creature/motion";

const live = process.env.RUN_STUDIO_LIVE === "1" ? it : it.skip;

describe("live conversational revision (local Gemini CLI)", () => {
  live(
    "raises the jump and changes the expression while preserving unrelated tracks",
    async () => {
      const project = JSON.parse(
        readFileSync(resolve(process.cwd(), "agent-reports/live-project.json"), "utf8"),
      ) as AniProject;
      if (project.source.kind !== "character") throw new Error("expected character project");
      const scene = project.source.scene;
      const character = characterContextForScene(scene);
      const context = validationContextForScene(scene);
      const before = project.motion;
      const baselineIds = new Set(before.tracks.map((track) => track.id));

      const instruction =
        "Make the jump higher, slow down the landing, make Kiran look surprised just before jumping, and change the smile into a big laugh at the end.";

      const response = await fetch("http://localhost:3000/api/animation/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: 1,
          action: "revise",
          targetKind: "character",
          instruction,
          character,
          currentDocument: before,
          history: [],
        }),
      });
      const body = (await response.json()) as AnimationDirectionResponse;
      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      if (!body.ok) throw new Error(`${body.error.code}: ${body.error.message}`);
      expect(body.source).toBe("ai");
      expect(body.provider?.id).toBe("agy");
      expect(body.parentRevisionId).toBe(before.id);

      const afterIds = new Set(body.document.tracks.map((track) => track.id));
      const preserved = [...baselineIds].filter((id) => afterIds.has(id));
      expect(preserved.length).toBeGreaterThan(baselineIds.size / 2);

      const validated = validateMotionDocument(body.document, context);
      expect(validated.ok).toBe(true);
      expect(validated.errors).toEqual([]);

      const changed = body.changes.modified.concat(body.changes.added);
      expect(changed.length).toBeGreaterThan(0);

      writeFileSync(
        resolve(process.cwd(), "agent-reports/live-revision.json"),
        JSON.stringify(
          {
            instruction,
            source: body.source,
            provider: body.provider,
            latencyMs: body.latencyMs,
            repairs: body.repairs,
            explanation: body.explanation,
            changes: body.changes,
            preservedCount: preserved.length,
            baselineCount: baselineIds.size,
            document: body.document,
          },
          null,
          2,
        ),
      );
      mkdirSync(resolve(process.cwd(), "agent-reports"), { recursive: true });
    },
    420_000,
  );
});
