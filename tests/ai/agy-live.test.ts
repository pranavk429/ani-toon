import { describe, expect, it } from "vitest";

import { getConfiguredProvider } from "@/lib/ai/provider";

const live = process.env.RUN_AGY_LIVE === "1" ? it : it.skip;

describe("local Gemini CLI provider", () => {
  live(
    "returns parseable model text without an API key",
    async () => {
      const provider = getConfiguredProvider("agy");
      expect(provider).not.toBeNull();
      expect(provider?.id).toBe("agy");
      const output = await provider!.generate({
        systemPrompt:
          'You are a test. Return only the JSON object {"ok":true,"provider":"agy"} with no markdown.',
        userPrompt: "Return the object now.",
        temperature: 0,
        maxOutputTokens: 64,
      });
      expect(output.provider.id).toBe("agy");
      expect(output.text.length).toBeGreaterThan(0);
      const parsed = JSON.parse(output.text) as { ok?: boolean };
      expect(parsed.ok).toBe(true);
    },
    120_000,
  );
});
