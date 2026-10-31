import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { directAnimation } from "@/lib/ai/director";
import { getConfiguredProvider } from "@/lib/ai/provider";
import { validateMotionDocument } from "@/lib/animation";
import { characterContextForScene, validationContextForScene } from "@/creature/motion";
import { studioScene } from "@/creature/validate";
import { buildSofiaScene } from "@/creature/examples";

const live = process.env.RUN_AGY_LIVE === "1" ? it : it.skip;

describe("Director with the local Gemini CLI", () => {
  live(
    "generates a request-specific character performance",
    async () => {
      const scene = studioScene(buildSofiaScene(), 8000);
      const character = characterContextForScene(scene);
      const context = validationContextForScene(scene);
      const provider = getConfiguredProvider("agy");
      expect(provider?.id).toBe("agy");

      const response = await directAnimation(
        {
          version: 1,
          action: "generate",
          targetKind: "character",
          instruction:
            "She notices the star, gasps in surprise, jumps up to catch it, lands with a squash, then smiles and waves at the camera.",
          character,
          history: [],
        },
        { provider: provider! },
      );

      expect(response.ok).toBe(true);
      if (!response.ok) return;
      expect(response.source).toBe("ai");
      expect(response.provider?.id).toBe("agy");
      expect(response.document.tracks.length).toBeGreaterThan(3);
      expect(response.document.duration).toBeGreaterThanOrEqual(1);

      const validated = validateMotionDocument(response.document, context);
      expect(validated.ok).toBe(true);
      expect(validated.errors).toEqual([]);

      const targets = response.document.tracks.map((track) =>
        track.target.kind === "character"
          ? `${track.target.actorId}.${track.target.boneId}`
          : track.target.kind === "object"
            ? track.target.objectId
            : track.target.elementId,
      );
      expect(new Set(targets).size).toBeGreaterThan(1);

      const outDir = resolve(process.cwd(), "agent-reports");
      mkdirSync(outDir, { recursive: true });
      writeFileSync(
        resolve(outDir, "agy-motion-live.json"),
        JSON.stringify(
          {
            instruction:
              "She notices the star, gasps in surprise, jumps up to catch it, lands with a squash, then smiles and waves at the camera.",
            source: response.source,
            provider: response.provider,
            latencyMs: response.latencyMs,
            repairs: response.repairs,
            document: response.document,
            explanation: response.explanation,
            changes: response.changes,
            warnings: response.warnings,
          },
          null,
          2,
        ),
      );
    },
    180_000,
  );
});
