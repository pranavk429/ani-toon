import { describe, expect, it } from "vitest";

import { sceneFromUnknown, studioScene } from "@/creature/validate";

describe("Scene object parsing in sceneFromUnknown", () => {
  it("accepts objects with kinds, colors, positions, and layers", () => {
    const raw = {
      title: "Playful Star and Ball",
      actors: [
        { id: "hero", species: "biped", bodyPlan: "biped" },
      ],
      objects: [
        {
          id: "star-prop",
          kind: "star",
          label: "Magic Star",
          color: "#FFD45E",
          x: 520,
          y: 220,
          scale: 1.2,
          rotation: 15,
          layer: "front",
          opacity: 0.9,
        },
        {
          id: "back-cloud",
          kind: "cloud",
          label: "Fluffy Cloud",
          color: "#FFFFFF",
          x: 180,
          y: 120,
          scale: 0.8,
          rotation: -5,
          layer: "back",
          opacity: 0.75,
        },
      ],
    };

    const scene = sceneFromUnknown(raw);

    expect(scene.objects).toBeDefined();
    expect(scene.objects).toHaveLength(2);

    const [star, cloud] = scene.objects!;
    expect(star).toEqual({
      id: "star-prop",
      kind: "star",
      label: "Magic Star",
      color: "#FFD45E",
      x: 520,
      y: 220,
      scale: 1.2,
      rotation: 15,
      layer: "front",
      opacity: 0.9,
    });

    expect(cloud).toEqual({
      id: "back-cloud",
      kind: "cloud",
      label: "Fluffy Cloud",
      color: "#FFFFFF",
      x: 180,
      y: 120,
      scale: 0.8,
      rotation: -5,
      layer: "back",
      opacity: 0.75,
    });
  });

  it("clamps out-of-range positions, scale, rotation, and opacity", () => {
    const raw = {
      actors: [{ id: "hero", bodyPlan: "blob" }],
      objects: [
        {
          id: "clamped-item",
          kind: "ball",
          color: "invalid-not-hex",
          x: -999, // clamped to 24
          y: 9999, // clamped to 696
          scale: 10, // clamped to 2.2
          rotation: 360, // clamped to 180
          opacity: 5, // clamped to 1
        },
        {
          id: "low-clamp-item",
          kind: "unknown-kind-fallback", // falls back to ball
          x: 5, // clamped to 24
          y: 10, // clamped to 24
          scale: 0.05, // clamped to 0.35
          rotation: -270, // clamped to -180
          opacity: -0.5, // clamped to 0
        },
      ],
    };

    const scene = sceneFromUnknown(raw);
    expect(scene.objects).toHaveLength(2);

    const [first, second] = scene.objects!;

    // First item assertions
    expect(first.x).toBe(24);
    expect(first.y).toBe(696);
    expect(first.scale).toBe(2.2);
    expect(first.rotation).toBe(180);
    expect(first.opacity).toBe(1);
    // Invalid hex color falls back to default ball color '#F4F0E6'
    expect(first.color).toBe("#F4F0E6");

    // Second item assertions
    expect(second.kind).toBe("ball");
    expect(second.x).toBe(24);
    expect(second.y).toBe(24);
    expect(second.scale).toBe(0.35);
    expect(second.rotation).toBe(-180);
    expect(second.opacity).toBe(0);
  });

  it("limits objects to at most 8 and gives stable, deduplicated ids", () => {
    const duplicateList = Array.from({ length: 12 }, () => ({
      id: "shared-id",
      kind: "star",
    }));

    const scene = sceneFromUnknown({
      actors: [{ id: "hero", bodyPlan: "biped" }],
      objects: duplicateList,
    });

    expect(scene.objects).toBeDefined();
    // Clamped to max 8 items
    expect(scene.objects).toHaveLength(8);

    const ids = scene.objects!.map((o) => o.id);
    // All IDs must be unique
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(8);

    expect(ids[0]).toBe("shared-id");
    expect(ids[1]).toBe("shared-id-1");
    expect(ids[2]).toBe("shared-id-2");
  });

  describe("Default object from brief when none supplied", () => {
    it("adds a star object for cosmic/astronaut briefs", () => {
      const scene = sceneFromUnknown(
        { actors: [{ id: "astro", bodyPlan: "biped" }] },
        "An astronaut floating in cosmic space looking at a star",
      );
      expect(scene.objects).toBeDefined();
      expect(scene.objects).toHaveLength(1);
      expect(scene.objects![0].kind).toBe("star");
      expect(scene.objects![0].color).toBe("#FFD45E");
    });

    it("adds a ball object for soccer/football briefs", () => {
      const scene = sceneFromUnknown(
        { actors: [{ id: "player", bodyPlan: "biped" }] },
        "A child playing football and kicking a ball",
      );
      expect(scene.objects).toBeDefined();
      expect(scene.objects).toHaveLength(1);
      expect(scene.objects![0].kind).toBe("ball");
      expect(scene.objects![0].color).toBe("#F4F0E6");
    });

    it("adds a plant object for gardener briefs", () => {
      const scene = sceneFromUnknown(
        { actors: [{ id: "gardener", bodyPlan: "biped" }] },
        "A friendly gardener caring for a lovely green plant",
      );
      expect(scene.objects).toBeDefined();
      expect(scene.objects).toHaveLength(1);
      expect(scene.objects![0].kind).toBe("plant");
    });

    it("adds a pancake object for chef breakfast briefs", () => {
      const scene = sceneFromUnknown(
        { actors: [{ id: "chef", bodyPlan: "biped" }] },
        "A chef in the kitchen flipping a golden pancake",
      );
      expect(scene.objects).toBeDefined();
      expect(scene.objects).toHaveLength(1);
      expect(scene.objects![0].kind).toBe("pancake");
    });

    it("adds a gift object for birthday briefs", () => {
      const scene = sceneFromUnknown(
        { actors: [{ id: "kid", bodyPlan: "biped" }] },
        "A happy friend carrying a surprise gift box",
      );
      expect(scene.objects).toBeDefined();
      expect(scene.objects).toHaveLength(1);
      expect(scene.objects![0].kind).toBe("gift");
    });

    it("leaves objects undefined when brief matches no prop pattern and none are supplied", () => {
      const scene = sceneFromUnknown(
        { actors: [{ id: "hero", bodyPlan: "blob" }] },
        "A simple little green blob waving at the viewer",
      );
      expect(scene.objects).toBeUndefined();
    });
  });

  describe("Preserving objects through studioScene", () => {
    it("preserves objects and their properties when converted to studio mode", () => {
      const initialScene = sceneFromUnknown({
        title: "Sofia Court Scene",
        actors: [{ id: "sofia", bodyPlan: "biped" }],
        objects: [
          {
            id: "tennis-ball",
            kind: "ball",
            color: "#D8E84A",
            x: 540,
            y: 480,
            scale: 1.1,
            rotation: 20,
            layer: "front",
          },
          {
            id: "court-net",
            kind: "flower-pot",
            color: "#C97B54",
            x: 360,
            y: 540,
            layer: "back",
          },
        ],
      });

      expect(initialScene.objects).toHaveLength(2);

      const studio = studioScene(initialScene, 8000);

      // Objects array is preserved
      expect(studio.objects).toBeDefined();
      expect(studio.objects).toEqual(initialScene.objects);

      // Score is updated to idle base layer
      expect(studio.score.duration).toBe(8000);
      expect(studio.score.beats).toHaveLength(1);
      expect(studio.score.beats[0].verb).toBe("idle");
      expect(studio.score.beats[0].layer).toBe("base");
    });
  });
});
