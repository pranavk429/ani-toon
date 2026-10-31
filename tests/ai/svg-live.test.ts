import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { AnimationDirectionResponse } from "@/lib/ai/contracts";
import { importSvg, sceneToContext } from "@/lib/svg";
import { buildAnimatedSvg, validateMotionDocument } from "@/lib/animation";

const live = process.env.RUN_STUDIO_LIVE === "1" ? it : it.skip;

describe("live SVG motion generation (local Gemini CLI)", () => {
  live(
    "animates a layered logo and exports SMIL",
    async () => {
      const source = readFileSync(resolve(process.cwd(), "tests/fixtures/svg/logo.svg"), "utf8");
      const imported = importSvg(source, { filename: "logo.svg" });
      expect(imported.ok).toBe(true);
      if (!imported.ok) throw new Error(imported.error.message);
      const graph = imported.graph;
      const instruction =
        "Make the icon ring draw itself, the bolt pop in, and the wordmark slide in from the left, then let the whole logo float gently.";

      const response = await fetch("http://localhost:3000/api/animation/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: 1,
          action: "generate",
          targetKind: "svg",
          instruction,
          scene: sceneToContext(graph),
          selectedElementIds: graph.order,
          history: [],
        }),
      });
      const body = (await response.json()) as AnimationDirectionResponse;
      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      if (!body.ok) throw new Error(`${body.error.code}: ${body.error.message}`);
      expect(body.source).toBe("ai");
      expect(body.provider?.id).toBe("agy");
      expect(body.document.tracks.length).toBeGreaterThan(2);

      const validated = validateMotionDocument(body.document, {
        targetKind: "svg",
        elementIds: graph.order,
      });
      expect(validated.ok).toBe(true);
      expect(validated.errors).toEqual([]);

      const exported = buildAnimatedSvg(graph, body.document);
      expect(exported.svg).toContain("<animate");
      expect(exported.warnings).toEqual([]);

      writeFileSync(
        resolve(process.cwd(), "agent-reports/live-svg-motion.json"),
        JSON.stringify(
          {
            instruction,
            source: body.source,
            provider: body.provider,
            latencyMs: body.latencyMs,
            explanation: body.explanation,
            document: body.document,
            exportedBytes: exported.svg.length,
          },
          null,
          2,
        ),
      );
      writeFileSync(resolve(process.cwd(), "agent-reports/live-logo-animated.svg"), exported.svg);
    },
    420_000,
  );
});
