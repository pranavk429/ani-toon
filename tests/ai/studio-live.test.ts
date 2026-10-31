import { describe, expect, it } from "vitest";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { AnimationDirectionResponse } from "@/lib/ai/contracts";
import type { AniProject } from "@/lib/studio/contracts";
import { validateMotionDocument } from "@/lib/animation";
import { characterContextForScene, validationContextForScene } from "@/creature/motion";
import type { Scene } from "@/creature/types";

const live = process.env.RUN_STUDIO_LIVE === "1" ? it : it.skip;

describe("live studio pipeline (local Gemini CLI)", () => {
  live(
    "generates a character motion plan through the real API",
    async () => {
      const sceneFile = resolve(process.cwd(), "agent-reports/live-character.json");
      const payload = JSON.parse(readFileSync(sceneFile, "utf8")) as {
        scene: Scene;
        meta: { source: string; provider?: string; model?: string };
      };
      expect(payload.meta.source).toBe("ai");
      expect(payload.meta.provider).toBe("agy");

      const scene = payload.scene;
      const character = characterContextForScene(scene);
      const context = validationContextForScene(scene);
      const instruction =
        "Kiran notices the glowing star, gasps, jumps up to catch it, lands with a squash, then smiles and waves at the camera.";

      const started = Date.now();
      const response = await fetch("http://localhost:3000/api/animation/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: 1,
          action: "generate",
          targetKind: "character",
          instruction,
          character,
          history: [],
        }),
      });
      const body = (await response.json()) as AnimationDirectionResponse;
      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      if (!body.ok) {
        throw new Error(`${body.error.code}: ${body.error.message}`);
      }
      expect(body.source).toBe("ai");
      expect(body.provider?.id).toBe("agy");
      expect(body.document.tracks.length).toBeGreaterThan(3);

      const validated = validateMotionDocument(body.document, context);
      expect(validated.ok).toBe(true);
      expect(validated.errors).toEqual([]);

      const now = new Date().toISOString();
      const project: AniProject = {
        schemaVersion: 1,
        id: `live-astro-${Date.now()}`,
        name: "Nova catches the star",
        createdAt: now,
        updatedAt: now,
        styleId: "anitoon-storybook-v1",
        source: { kind: "character", scene },
        motion: body.document,
        prompt: instruction,
      };
      const outDir = resolve(process.cwd(), "agent-reports");
      mkdirSync(outDir, { recursive: true });
      writeFileSync(resolve(outDir, "live-project.json"), JSON.stringify(project, null, 2));
      writeFileSync(
        resolve(outDir, "live-motion-response.json"),
        JSON.stringify(
          {
            elapsedMs: Date.now() - started,
            source: body.source,
            provider: body.provider,
            latencyMs: body.latencyMs,
            repairs: body.repairs,
            explanation: body.explanation,
            changes: body.changes,
            warnings: body.warnings,
            document: body.document,
          },
          null,
          2,
        ),
      );
    },
    600_000,
  );
});
