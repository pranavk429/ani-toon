import type {
  AnimationDirectionRequest,
  AnimationDirectorProvider,
  CharacterDirectionContext,
  DirectorProviderInfo,
  ProviderGenerateInput,
  ProviderGenerateOutput,
} from "@/lib/ai/contracts";
import type {
  BoneTargetContext,
  MotionDocument,
  MotionTrack,
} from "@/lib/animation/types";
import type {
  SceneContext,
  SceneElementContext,
} from "@/lib/svg/types";

type ElementInput = {
  id: string;
  tag?: SceneElementContext["tag"];
  parentId?: string | null;
  name?: string;
  role?: string;
  tags?: string[];
  text?: string;
  bbox?: { x: number; y: number; w: number; h: number };
  childCount?: number;
  selected?: boolean;
};

export function sceneElement(input: ElementInput): SceneElementContext {
  return {
    id: input.id,
    tag: input.tag ?? "path",
    parentId: input.parentId ?? null,
    childCount: input.childCount ?? 0,
    bbox: input.bbox ?? { x: 100, y: 100, w: 60, h: 60 },
    name: input.name,
    role: input.role,
    tags: input.tags,
    text: input.text,
    animated: false,
    selected: input.selected,
  };
}

export function sampleSvgScene(): SceneContext {
  const elements: SceneElementContext[] = [
    sceneElement({
      id: "logo-mark",
      tag: "g",
      name: "Logo mark",
      role: "brand",
      bbox: { x: 20, y: 20, w: 80, h: 80 },
      childCount: 2,
      selected: true,
    }),
    sceneElement({
      id: "icon-ring",
      parentId: "logo-mark",
      tag: "circle",
      name: "Ring",
      bbox: { x: 24, y: 24, w: 72, h: 72 },
    }),
    sceneElement({
      id: "icon-bolt",
      parentId: "logo-mark",
      tag: "path",
      name: "Bolt",
      bbox: { x: 40, y: 30, w: 40, h: 60 },
    }),
    sceneElement({
      id: "logo-wordmark",
      tag: "g",
      name: "Wordmark",
      role: "text",
      bbox: { x: 110, y: 40, w: 180, h: 40 },
      childCount: 1,
    }),
    sceneElement({
      id: "wordmark",
      parentId: "logo-wordmark",
      tag: "path",
      name: "Letters",
      bbox: { x: 118, y: 42, w: 170, h: 36 },
    }),
  ];

  return {
    assetId: "asset_sample_logo",
    filename: "logo.svg",
    viewBox: { minX: 0, minY: 0, width: 320, height: 120 },
    elementCount: elements.length,
    animatableCount: elements.length,
    truncated: false,
    elements,
  };
}

export const SAMPLE_BONES: BoneTargetContext[] = [
  {
    actorId: "hero",
    boneId: "root",
    role: "root",
    parent: null,
    rotationLimit: { min: -15, max: 15 },
    scaleLimit: { min: 0.85, max: 1.18 },
    note: "whole-character translation; translateX/Y use skeleton units, +Y is down",
  },
  {
    actorId: "hero",
    boneId: "spine",
    role: "spine",
    parent: "root",
    rotationLimit: { min: -28, max: 28 },
    scaleLimit: { min: 0.82, max: 1.2 },
    note: "spine joint; local rotation in degrees",
  },
  {
    actorId: "hero",
    boneId: "head",
    role: "head",
    parent: "spine",
    rotationLimit: { min: -38, max: 38 },
    scaleLimit: { min: 0.86, max: 1.16 },
    note: "head and facial channels (face* properties target this bone)",
  },
  {
    actorId: "hero",
    boneId: "armL",
    role: "armL",
    parent: "spine",
    rotationLimit: { min: -120, max: 120 },
    scaleLimit: { min: 0.75, max: 1.25 },
    note: "armL joint; local rotation in degrees",
  },
  {
    actorId: "hero",
    boneId: "handL",
    role: "handL",
    parent: "armL",
    rotationLimit: { min: -165, max: 165 },
    scaleLimit: { min: 0.75, max: 1.25 },
    note: "handL joint; local rotation in degrees",
  },
  {
    actorId: "hero",
    boneId: "armR",
    role: "armR",
    parent: "spine",
    rotationLimit: { min: -120, max: 120 },
    scaleLimit: { min: 0.75, max: 1.25 },
    note: "armR joint; local rotation in degrees",
  },
  {
    actorId: "hero",
    boneId: "handR",
    role: "handR",
    parent: "armR",
    rotationLimit: { min: -165, max: 165 },
    scaleLimit: { min: 0.75, max: 1.25 },
    note: "handR joint; local rotation in degrees",
  },
  {
    actorId: "hero",
    boneId: "legL",
    role: "legL",
    parent: "root",
    rotationLimit: { min: -120, max: 120 },
    scaleLimit: { min: 0.75, max: 1.25 },
    note: "legL joint; local rotation in degrees",
  },
  {
    actorId: "hero",
    boneId: "footL",
    role: "footL",
    parent: "legL",
    rotationLimit: { min: -95, max: 95 },
    scaleLimit: { min: 0.8, max: 1.2 },
    note: "footL joint; local rotation in degrees",
  },
  {
    actorId: "hero",
    boneId: "legR",
    role: "legR",
    parent: "root",
    rotationLimit: { min: -120, max: 120 },
    scaleLimit: { min: 0.75, max: 1.25 },
    note: "legR joint; local rotation in degrees",
  },
  {
    actorId: "hero",
    boneId: "footR",
    role: "footR",
    parent: "legR",
    rotationLimit: { min: -95, max: 95 },
    scaleLimit: { min: 0.8, max: 1.2 },
    note: "footR joint; local rotation in degrees",
  },
];

export function sampleCharacterContext(): CharacterDirectionContext {
  return {
    styleId: "anitoon-storybook-v1",
    actors: [
      {
        id: "hero",
        name: "Alex",
        species: "human",
        bodyPlan: "biped",
        summary: "human, masculine, short hair, tee + shorts",
        palette: {
          skin: "#F3C9A3",
          belly: "#FFF1DC",
          accent: "#E8564E",
          detail: "#6B4A33",
          eye: "#2B2233",
          mouth: "#9A4B3F",
          cloth: "#E8564E",
          pants: "#3F5F86",
        },
        accessories: [],
      },
    ],
    bones: SAMPLE_BONES,
    objects: [
      {
        id: "soccer-ball",
        kind: "ball",
        label: "Soccer ball",
        x: 520,
        y: 548,
        scale: 1,
        rotation: 0,
      },
    ],
    world: {
      preset: "studio",
      accent: "#4B63FF",
    },
    notes: [
      "The procedural idle layer stays on.",
      "Character root translateX/Y is in skeleton units; a humanoid is roughly 120-180 units tall.",
      "Object translateX/Y is in 720x720 stage pixels; +Y is down.",
      "Face properties target the head bone.",
    ],
  };
}

export function sampleCharacterDocument(): MotionDocument {
  return {
    version: 1,
    id: "anim_sample_char",
    name: "Kick and celebrate",
    targetKind: "character",
    duration: 3.5,
    fps: 60,
    loop: { enabled: false, mode: "restart" },
    tracks: [
      {
        id: "root-jump",
        target: { kind: "character", actorId: "hero", boneId: "root" },
        property: "translateY",
        duration: 1.2,
        easing: "easeInOut",
        keyframes: [
          { at: 0, value: 0 },
          { at: 0.15, value: 10 },
          { at: 0.45, value: -65 },
          { at: 0.75, value: 5 },
          { at: 1, value: 0 },
        ],
        label: "start: crouch -> end: land",
      },
      {
        id: "head-look",
        target: { kind: "character", actorId: "hero", boneId: "head" },
        property: "faceLookY",
        delay: 0.2,
        duration: 1.5,
        easing: "easeInOut",
        keyframes: [
          { at: 0, value: 0 },
          { at: 0.3, value: -0.7 },
          { at: 0.8, value: -0.7 },
          { at: 1, value: 0 },
        ],
        label: "start: neutral -> end: look up",
      },
      {
        id: "ball-arc",
        target: { kind: "object", objectId: "soccer-ball" },
        property: "translateY",
        delay: 0.5,
        duration: 2.0,
        easing: "easeOut",
        keyframes: [
          { at: 0, value: 0 },
          { at: 0.5, value: -220 },
          { at: 1, value: -400 },
        ],
        label: "start: ground -> end: fly high",
      },
    ],
    meta: {
      source: "ai",
      summary: "Hero jumps, looks up as the ball flies away.",
    },
  };
}

export function sampleSvgDocument(): MotionDocument {
  return {
    version: 1,
    id: "anim_sample_svg",
    name: "Logo reveal",
    targetKind: "svg",
    duration: 2.5,
    fps: 60,
    loop: { enabled: false, mode: "restart" },
    tracks: [
      {
        id: "mark-pop",
        target: { kind: "svg", elementId: "logo-mark" },
        property: "scale",
        duration: 1.0,
        easing: "springBouncy",
        keyframes: [
          { at: 0, value: 0 },
          { at: 0.7, value: 1.15 },
          { at: 1, value: 1 },
        ],
        label: "start: zero -> end: pop",
      },
      {
        id: "bolt-spin",
        target: { kind: "svg", elementId: "icon-bolt" },
        property: "rotate",
        delay: 0.2,
        duration: 0.8,
        easing: "easeOut",
        keyframes: [
          { at: 0, value: -45 },
          { at: 1, value: 0 },
        ],
        label: "start: tilted -> end: straight",
      },
      {
        id: "wordmark-draw",
        target: { kind: "svg", elementId: "wordmark" },
        property: "strokeDraw",
        delay: 0.5,
        duration: 1.5,
        easing: "easeInOut",
        keyframes: [
          { at: 0, value: 0 },
          { at: 1, value: 1 },
        ],
        label: "start: empty -> end: drawn",
      },
    ],
    meta: {
      source: "ai",
      summary: "Logo mark pops and wordmark draws on.",
    },
  };
}

export class MockProvider implements AnimationDirectorProvider {
  readonly id: string;
  readonly model: string;
  calls: ProviderGenerateInput[] = [];
  responses: Array<string | Error> = [];

  constructor(options: {
    id?: string;
    model?: string;
    responses?: Array<string | Error>;
  } = {}) {
    this.id = options.id ?? "mock";
    this.model = options.model ?? "mock-model";
    this.responses = options.responses ? [...options.responses] : [];
  }

  async generate(input: ProviderGenerateInput): Promise<ProviderGenerateOutput> {
    this.calls.push(input);
    const next = this.responses.shift();
    if (next instanceof Error) throw next;
    const text = next ?? JSON.stringify({
      document: sampleCharacterDocument(),
      explanation: "Mock performance generated.",
    });
    return {
      text,
      provider: { id: this.id, model: this.model },
      latencyMs: 45,
    };
  }
}
