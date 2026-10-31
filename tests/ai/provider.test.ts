import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  AnimationProviderError,
  EXPERIENTIAL_ENDPOINT,
  GEMINI_ENDPOINT_ROOT,
  ExperientialProvider,
  GeminiProvider,
  getConfiguredProvider,
  getProviderStatus,
  stripCodeFences,
} from "@/lib/ai/provider";

describe("ai provider abstraction", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.EXPLABS_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.ANIMATION_DIRECTOR_PROVIDER;
    delete process.env.ANIMATION_DIRECTOR_MODEL;
    delete process.env.CREATURE_MODEL;
    delete process.env.GEMINI_MODEL;
    delete process.env.AI_BASE_URL;
    delete process.env.AI_API_KEY;
    delete process.env.AI_MODEL;
    delete process.env.VERCEL;
    // Keep unit tests independent of a developer's installed Gemini CLI.
    process.env.AGY_BIN = "/nonexistent/agy-for-tests";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getConfiguredProvider & getProviderStatus", () => {
    it("returns null when no credentials configured", () => {
      const provider = getConfiguredProvider();
      expect(provider).toBeNull();

      const status = getProviderStatus();
      expect(status).toEqual({
        configured: false,
        provider: null,
        model: null,
      });
    });

    it("prefers experiential when configured by default", () => {
      process.env.EXPLABS_API_KEY = "exp-secret-key";
      process.env.GEMINI_API_KEY = "gemini-secret-key";

      const provider = getConfiguredProvider();
      expect(provider).not.toBeNull();
      expect(provider?.id).toBe("experiential");

      const status = getProviderStatus();
      expect(status.configured).toBe(true);
      expect(status.provider).toBe("experiential");
      // Check that credentials are NOT exposed in status
      expect(JSON.stringify(status)).not.toContain("exp-secret-key");
    });

    it("prefers a configured gateway over direct keys", () => {
      process.env.EXPLABS_API_KEY = "exp-secret-key";
      process.env.AI_BASE_URL = "https://gateway.example.com/v1";
      process.env.AI_API_KEY = "gateway-secret";
      process.env.AI_MODEL = "gateway-model";

      const provider = getConfiguredProvider();
      expect(provider?.id).toBe("gateway");
      expect(provider?.model).toBe("gateway-model");
      expect(getProviderStatus().provider).toBe("gateway");
      expect(JSON.stringify(getProviderStatus())).not.toContain("gateway-secret");
    });

    it("respects ANIMATION_DIRECTOR_PROVIDER=gemini", () => {
      process.env.EXPLABS_API_KEY = "exp-secret-key";
      process.env.GEMINI_API_KEY = "gemini-secret-key";
      process.env.ANIMATION_DIRECTOR_PROVIDER = "gemini";

      const provider = getConfiguredProvider();
      expect(provider?.id).toBe("gemini");
      expect(getProviderStatus().provider).toBe("gemini");
    });

    it("falls back to gemini if only gemini key configured", () => {
      process.env.GEMINI_API_KEY = "gemini-secret-key";

      const provider = getConfiguredProvider();
      expect(provider?.id).toBe("gemini");
    });

    it("picks model from ANIMATION_DIRECTOR_MODEL or CREATURE_MODEL or default for experiential", () => {
      process.env.EXPLABS_API_KEY = "key";
      expect(new ExperientialProvider().model).toBe("claude-haiku-4.5");

      process.env.CREATURE_MODEL = "custom-creature-model";
      expect(new ExperientialProvider().model).toBe("custom-creature-model");

      process.env.ANIMATION_DIRECTOR_MODEL = "director-model";
      expect(new ExperientialProvider().model).toBe("director-model");
    });

    it("picks model from GEMINI_MODEL or default for gemini and strips models/ prefix", () => {
      process.env.GEMINI_API_KEY = "key";
      expect(new GeminiProvider().model).toBe("gemini-2.5-flash");

      process.env.GEMINI_MODEL = "models/gemini-2.0-pro-exp";
      expect(new GeminiProvider().model).toBe("gemini-2.0-pro-exp");
    });
  });

  describe("stripCodeFences", () => {
    it("strips ```json code fences", () => {
      const input = "```json\n{\"foo\":\"bar\"}\n```";
      expect(stripCodeFences(input)).toBe("{\"foo\":\"bar\"}");
    });

    it("handles plain text without fences", () => {
      expect(stripCodeFences("{\"a\":1}")).toBe("{\"a\":1}");
    });
  });

  describe("ExperientialProvider generate", () => {
    it("fails with missing_credentials if no apiKey", async () => {
      const p = new ExperientialProvider({ apiKey: "" });
      await expect(
        p.generate({ systemPrompt: "sys", userPrompt: "user" }),
      ).rejects.toThrowError(AnimationProviderError);
    });

    it("handles successful response", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "{\"result\": true}" } }],
        }),
      });

      const p = new ExperientialProvider({
        apiKey: "test-key",
        fetchImpl: fetchMock as unknown as typeof fetch,
      });

      const out = await p.generate({
        systemPrompt: "system text",
        userPrompt: "user text",
      });

      expect(out.text).toBe("{\"result\": true}");
      expect(out.provider.id).toBe("experiential");
      expect(fetchMock).toHaveBeenCalledWith(
        EXPERIENTIAL_ENDPOINT,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-key",
          }),
        }),
      );
    });

    it("maps 429 to rate_limited error", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
      });
      const p = new ExperientialProvider({
        apiKey: "test-key",
        fetchImpl: fetchMock as unknown as typeof fetch,
      });

      await expect(
        p.generate({ systemPrompt: "sys", userPrompt: "user" }),
      ).rejects.toMatchObject({
        code: "rate_limited",
        retryable: true,
      });
    });

    it("maps 503 to http error with retryable: true", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      });
      const p = new ExperientialProvider({
        apiKey: "test-key",
        fetchImpl: fetchMock as unknown as typeof fetch,
      });

      await expect(
        p.generate({ systemPrompt: "sys", userPrompt: "user" }),
      ).rejects.toMatchObject({
        code: "http",
        status: 503,
        retryable: true,
      });
    });
  });

  describe("GeminiProvider generate", () => {
    it("handles successful response", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            { content: { parts: [{ text: "{\"document\": {}}" }] } },
          ],
        }),
      });

      const p = new GeminiProvider({
        apiKey: "test-gemini-key",
        fetchImpl: fetchMock as unknown as typeof fetch,
      });

      const out = await p.generate({
        systemPrompt: "sys",
        userPrompt: "user",
      });

      expect(out.text).toBe("{\"document\": {}}");
      expect(out.provider.id).toBe("gemini");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(GEMINI_ENDPOINT_ROOT),
        expect.objectContaining({
          headers: expect.objectContaining({
            "x-goog-api-key": "test-gemini-key",
          }),
        }),
      );
    });
  });
});
