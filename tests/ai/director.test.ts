import { describe, expect, it } from "vitest";

import { directAnimation } from "@/lib/ai/director";
import type {
  AnimationDirectorProvider,
  AnimationDirectionRequest,
  ProviderGenerateInput,
  ProviderGenerateOutput,
} from "@/lib/ai/contracts";
import type { MotionDocument } from "@/lib/animation/types";
import { validateMotionDocument } from "@/lib/animation";
import {
  characterContextForScene,
  validationContextForScene,
} from "@/creature/motion";
import { studioScene } from "@/creature/validate";
import { buildSofiaScene } from "@/creature/examples";

class FakeProvider implements AnimationDirectorProvider {
  readonly id = "fake";
  readonly model = "fake-model-1";
  calls = 0;
  readonly texts: string[];

  constructor(texts: string[]) {
    this.texts = texts;
  }

  async generate(_input: ProviderGenerateInput): Promise<ProviderGenerateOutput> {
    const text = this.texts[Math.min(this.calls, this.texts.length - 1)];
    this.calls += 1;
    return {
      text,
      provider: { id: this.id, model: this.model },
      latencyMs: 3,
    };
  }
}

function setup() {
  const scene = studioScene(buildSofiaScene(), 8000);
  const actor = scene.actors[0];
  const character = characterContextForScene(scene);
  const context = validationContextForScene(scene);

  const doc: MotionDocument = {
    version: 1,
    id: "anim_test_generated",
    name: "Test generated",
    targetKind: "character",
    duration: 3,
    fps: 60,
    loop: { enabled: false, mode: "restart" },
    tracks: [
      {
        id: "root-jump",
        target: { kind: "character", actorId: actor.id, boneId: "root" },
        property: "translateY",
        keyframes: [
          { at: 0, value: 0 },
          { at: 0.5, value: -40 },
          { at: 1, value: 0 },
        ],
        easing: "easeInOut",
        origin: "bone",
        label: "crouch -> jump -> land",
      },
      {
        id: "arm-wave",
        target: { kind: "character", actorId: actor.id, boneId: "armR" },
        property: "rotate",
        keyframes: [
          { at: 0, value: 0 },
          { at: 0.4, value: -95 },
          { at: 1, value: 0 },
        ],
        easing: "easeInOut",
        origin: "bone",
        label: "start: arm down -> end: arm down",
      },
    ],
    meta: { source: "ai", summary: "A jump and wave." },
  };

  const request: AnimationDirectionRequest = {
    version: 1,
    action: "generate",
    targetKind: "character",
    instruction: "She jumps and waves.",
    character,
    history: [],
  };

  return { scene, actor, character, context, doc, request };
}

function envelope(document: MotionDocument, explanation = "Generated motion."): string {
  return JSON.stringify({ document, explanation });
}

describe("Director orchestration", () => {
  it("returns a validated AI document from a provider", async () => {
    const { doc, request, context } = setup();
    const provider = new FakeProvider([envelope(doc)]);
    const response = await directAnimation(request, { provider });

    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.source).toBe("ai");
    expect(response.provider?.id).toBe("fake");
    expect(response.document.tracks).toHaveLength(2);
    expect(response.explanation).toContain("Generated");
    expect(response.repairs).toBe(0);

    const validated = validateMotionDocument(response.document, context);
    expect(validated.ok).toBe(true);
  });

  it("repairs exactly once when the first response is invalid", async () => {
    const { doc, request } = setup();
    const provider = new FakeProvider(["not json at all", envelope(doc)]);
    const response = await directAnimation(request, { provider });

    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.source).toBe("ai");
    expect(response.repairs).toBe(1);
    expect(provider.calls).toBe(2);
  });

  it("preserves unrelated tracks during a revision", async () => {
    const { doc, request, context } = setup();
    const keepTrack = doc.tracks[1];
    const baseline: MotionDocument = {
      ...doc,
      id: "anim_baseline",
      tracks: [keepTrack],
      meta: { source: "ai", summary: "Baseline wave." },
    };
    const revised: MotionDocument = {
      ...doc,
      id: "anim_revised",
      tracks: [doc.tracks[0]],
      meta: { source: "ai", summary: "Higher jump." },
    };

    const revisionRequest: AnimationDirectionRequest = {
      ...request,
      action: "revise",
      instruction: "Make the jump higher.",
      currentDocument: baseline,
    };
    const provider = new FakeProvider([envelope(revised, "Raised the jump.")]);
    const response = await directAnimation(revisionRequest, { provider });

    expect(response.ok).toBe(true);
    if (!response.ok) return;
    const ids = response.document.tracks.map((track) => track.id);
    expect(ids).toContain("root-jump");
    expect(ids).toContain(keepTrack.id);
    expect(response.parentRevisionId).toBe("anim_baseline");

    const validated = validateMotionDocument(response.document, context);
    expect(validated.ok).toBe(true);
  });

  it("uses a labelled fallback when the provider fails", async () => {
    const { request, context } = setup();
    const provider: AnimationDirectorProvider = {
      id: "broken",
      model: "broken-1",
      async generate() {
        throw new Error("network down");
      },
    };
    const response = await directAnimation(request, { provider });

    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.source).toBe("fallback");
    expect(response.provider).toBeUndefined();
    expect(response.warnings.join(" ")).toMatch(/fallback/i);

    const validated = validateMotionDocument(response.document, context);
    expect(validated.ok).toBe(true);
  });

  it("rejects a malformed request before calling the provider", async () => {
    const { request } = setup();
    const provider = new FakeProvider(["unused"]);
    const response = await directAnimation(
      { ...request, instruction: "" },
      { provider },
    );
    expect(response.ok).toBe(false);
    if (response.ok) return;
    expect(response.error.code).toBe("bad_request");
    expect(provider.calls).toBe(0);
  });
});
