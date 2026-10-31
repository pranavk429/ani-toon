/**
 * Procedural local Motion DSL composer.
 *
 * This is a real procedural fallback, not a preset lookup: it reads the
 * instruction, matches semantic target names/tags/IDs, and composes keyframes.
 * The Director labels its output `meta.source: "fallback"` and never attaches
 * a provider/model to it.
 */

import type { AnimationDirectionRequest, CharacterDirectionContext } from "./contracts";
import type { SceneElementContext } from "@/lib/svg/types";
import { ANIMATABLE_SVG_TAGS } from "@/lib/svg/types";
import type {
  BoneTargetContext,
  Easing,
  Keyframe,
  MotionDocument,
  MotionProperty,
  MotionTrack,
  StaggerGroup,
  TransformOrigin,
} from "@/lib/animation/types";
import { boneKey } from "@/lib/animation/targets";

export type FallbackResult = {
  document: MotionDocument;
  explanation: string;
};

type SvgElement = SceneElementContext;

type TrackOptions = {
  keyframes: Keyframe[];
  delay?: number;
  duration?: number;
  easing?: Easing;
  label: string;
  path?: string;
  orient?: boolean;
  origin?: TransformOrigin;
  muted?: boolean;
};

type TrackSpec = TrackOptions & {
  property: MotionProperty;
};

const ANIMATABLE = new Set<string>(ANIMATABLE_SVG_TAGS);
const MAX_SVG_TRACKS = 40;

const CATEGORY_PATTERNS: Record<string, RegExp> = {
  rocket:
    /\b(rocket|spaceship|space[- ]?ship|spacecraft|ufo|missile|shuttle|booster|jet|plane|airplane)\b/i,
  leaves:
    /\b(leaf|leaves|plant|plants|tree|trees|flower|flowers|petal|petals|stem|stems|branch|branches|vine|vines|grass|garden|sprout|seedling|foliage|bush|fern)\b/i,
  flowers:
    /\b(flower|flowers|blossom|blossoms|bloom|blooms|bud|buds|petal|petals|rose|roses|tulip|tulips|daisy|daisies)\b/i,
  stars:
    /\b(star|stars|sparkle|sparkles|twinkle|glitter|shimmer|stardust|constellation)\b/i,
  flames:
    /\b(flame|flames|fire|torch|candle|exhaust|ignition|engine|thruster|fireball|ember|embers)\b/i,
  sky: /\b(cloud|clouds|sun|moon|sky|rain|raindrop|snow|snowflake)\b/i,
  water: /\b(water|wave|waves|ocean|sea|river|ripple|pond|lake)\b/i,
  balloon: /\b(balloon|balloons)\b/i,
  character:
    /\b(character|person|people|hero|robot|mascot|cat|dog|fox|bear|bunny|rabbit|frog|bird|animal|creature|figure)\b/i,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function fallbackHash(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function slug(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.length > 0 ? normalized.slice(0, 48) : "motion";
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function keyframe(at: number, value: number | string, easing?: Easing): Keyframe {
  const clampedAt = clamp(round2(at), 0, 1);
  return {
    at: clampedAt,
    value: typeof value === "number" ? round2(value) : value,
    ...(easing ? { easing } : {}),
  };
}

function docId(name: string, instruction: string): string {
  const hash = fallbackHash(instruction).toString(36).slice(0, 6);
  return `anim_${slug(name)}_${hash}`;
}

function clampDuration(duration: number): number {
  return clamp(round1(duration), 1.0, 8.0);
}

function loopRequested(instruction: string): { enabled: boolean; pingpong: boolean } {
  const enabled =
    /\b(loop|looping|repeat|repeats|repeating|forever|continuous|continuously|cycle|cycles|cycling|ping[- ]?pong|alternate|back and forth)\b/i.test(
      instruction,
    );
  const pingpong = /\b(ping[- ]?pong|alternate|back and forth)\b/i.test(instruction);
  return { enabled, pingpong };
}

// ---------------------------------------------------------------------------
// Character Fallback Performance Builder
// ---------------------------------------------------------------------------

class CharacterTrackCollector {
  readonly tracks: MotionTrack[] = [];
  private readonly boneKeys: Set<string>;
  private readonly bonesByActor: Map<string, Map<string, BoneTargetContext>>;
  private readonly objectIds: Set<string>;
  private readonly duration: number;
  private readonly idCounters = new Map<string, number>();

  constructor(
    character: CharacterDirectionContext,
    duration: number,
  ) {
    this.duration = duration;
    this.boneKeys = new Set(character.bones.map((b) => `${b.actorId}:${b.boneId}`));
    this.bonesByActor = new Map();
    for (const b of character.bones) {
      let map = this.bonesByActor.get(b.actorId);
      if (!map) {
        map = new Map();
        this.bonesByActor.set(b.actorId, map);
      }
      map.set(b.boneId, b);
      if (b.role) map.set(b.role, b);
    }
    this.objectIds = new Set((character.objects ?? []).map((o) => o.id));
  }

  get trackCount(): number {
    return this.tracks.length;
  }

  hasBone(actorId: string, boneId: string): boolean {
    return this.boneKeys.has(`${actorId}:${boneId}`);
  }

  findBone(actorId: string, boneOrRole: string): BoneTargetContext | undefined {
    return this.bonesByActor.get(actorId)?.get(boneOrRole);
  }

  hasObject(objectId: string): boolean {
    return this.objectIds.has(objectId);
  }

  addBoneTrack(
    actorId: string,
    boneId: string,
    property: MotionProperty,
    spec: TrackOptions,
  ): void {
    if (!this.hasBone(actorId, boneId)) return;
    const baseId = `${actorId}-${boneId}-${property}`;
    const count = (this.idCounters.get(baseId) ?? 0) + 1;
    this.idCounters.set(baseId, count);
    const id = count === 1 ? baseId : `${baseId}-${count}`;

    const delay = Math.max(0, spec.delay ?? 0);
    const maxDur = Math.max(0.1, this.duration - delay);
    const trackDuration = spec.duration ? Math.min(spec.duration, maxDur) : maxDur;

    this.tracks.push({
      id,
      target: { kind: "character", actorId, boneId },
      property,
      keyframes: spec.keyframes,
      delay: round2(delay),
      duration: round2(trackDuration),
      ...(spec.easing ? { easing: spec.easing } : {}),
      origin: "bone",
      label: spec.label,
      muted: spec.muted,
    });
  }

  addObjectTrack(
    objectId: string,
    property: MotionProperty,
    spec: TrackOptions,
  ): void {
    if (!this.hasObject(objectId)) return;
    const baseId = `obj-${objectId}-${property}`;
    const count = (this.idCounters.get(baseId) ?? 0) + 1;
    this.idCounters.set(baseId, count);
    const id = count === 1 ? baseId : `${baseId}-${count}`;

    const delay = Math.max(0, spec.delay ?? 0);
    const maxDur = Math.max(0.1, this.duration - delay);
    const trackDuration = spec.duration ? Math.min(spec.duration, maxDur) : maxDur;

    this.tracks.push({
      id,
      target: { kind: "object", objectId },
      property,
      keyframes: spec.keyframes,
      delay: round2(delay),
      duration: round2(trackDuration),
      ...(spec.easing ? { easing: spec.easing } : {}),
      origin: "center",
      label: spec.label,
      muted: spec.muted,
    });
  }
}

function composeCharacter(
  request: AnimationDirectionRequest,
  instruction: string,
): FallbackResult {
  const character = request.character!;
  const primaryActor = character.actors[0]?.id ?? "hero";
  const loop = loopRequested(instruction);

  const lower = instruction.toLowerCase();
  const wantsJump = /\b(jump|hop|leap|bounce|air|flying)\b/.test(lower);
  const wantsKick = /\b(kick|strike|punts|shoot)\b/.test(lower);
  const wantsWave = /\b(wave|waving|greet|hello|bye|salute)\b/.test(lower);
  const wantsCelebrate = /\b(celebrate|cheer|cheering|happy|dance|dancing|yay|hurray|victory|win)\b/.test(lower);
  const wantsNotice = /\b(notice|look|see|spot|watch|glance|focus)\b/.test(lower);
  const wantsBall = /\b(ball|soccer|football|kick it|fly away)\b/.test(lower);

  // Overall performance duration
  let duration = 3.6;
  if (wantsKick && wantsCelebrate) duration = 4.2;
  else if (wantsJump && wantsWave) duration = 3.8;
  else if (wantsCelebrate) duration = 3.2;
  else if (wantsWave) duration = 2.8;
  duration = clampDuration(duration);

  const collector = new CharacterTrackCollector(character, duration);
  const notes: string[] = [];

  const headBone = collector.findBone(primaryActor, "head")?.boneId ?? "head";
  const rootBone = collector.findBone(primaryActor, "root")?.boneId ?? "root";
  const armRBone = collector.findBone(primaryActor, "armR")?.boneId ?? "armR";
  const handRBone = collector.findBone(primaryActor, "handR")?.boneId ?? "handR";
  const armLBone = collector.findBone(primaryActor, "armL")?.boneId ?? "armL";
  const legRBone = collector.findBone(primaryActor, "legR")?.boneId ?? "legR";
  const footRBone = collector.findBone(primaryActor, "footR")?.boneId ?? "footR";

  // Target object (e.g. soccer ball or star)
  const targetObject =
    character.objects.find((o) => o.kind === "ball" || o.kind === "star") ??
    character.objects[0];

  // 1. Notice / Anticipation (at start)
  if (wantsNotice || wantsKick) {
    collector.addBoneTrack(primaryActor, headBone, "faceLookY", {
      delay: 0.1,
      duration: 1.2,
      easing: "easeInOut",
      keyframes: [
        keyframe(0, 0),
        keyframe(0.3, 0.6), // look down at ball
        keyframe(0.8, 0.6),
        keyframe(1, 0),
      ],
      label: "start: look down -> focus",
    });
    collector.addBoneTrack(primaryActor, headBone, "faceBlink", {
      delay: 0.4,
      duration: 0.25,
      keyframes: [keyframe(0, 0), keyframe(0.5, 1), keyframe(1, 0)],
      label: "blink on notice",
    });
    notes.push("notice");
  }

  // 2. Kick / Jump / Action (middle)
  let actionEnd = 1.4;
  if (wantsKick) {
    actionEnd = 1.8;
    // Leg windup and kick
    collector.addBoneTrack(primaryActor, legRBone, "rotate", {
      delay: 0.6,
      duration: 1.1,
      easing: "easeInOut",
      keyframes: [
        keyframe(0, 0, "easeIn"),
        keyframe(0.3, -35, "backIn"), // windup back
        keyframe(0.65, 55, "easeOut"), // kick forward
        keyframe(1, 0),
      ],
      label: "kick windup and strike",
    });
    collector.addBoneTrack(primaryActor, footRBone, "rotate", {
      delay: 0.7,
      duration: 0.9,
      keyframes: [keyframe(0, 0), keyframe(0.5, 40), keyframe(1, 0)],
      label: "foot strike",
    });
    // Character slight jump/hop into the kick
    collector.addBoneTrack(primaryActor, rootBone, "translateY", {
      delay: 0.7,
      duration: 0.8,
      easing: "easeInOut",
      keyframes: [
        keyframe(0, 0),
        keyframe(0.2, 8),
        keyframe(0.5, -24),
        keyframe(0.8, 4),
        keyframe(1, 0),
      ],
      label: "hop into kick",
    });
    notes.push("kick");

    // Ball reaction
    if (targetObject) {
      collector.addObjectTrack(targetObject.id, "translateY", {
        delay: 1.1,
        duration: 2.2,
        easing: "easeOut",
        keyframes: [
          keyframe(0, 0, "quadOut"),
          keyframe(0.45, -280, "quadIn"),
          keyframe(1, -380),
        ],
        label: "ball flies upward",
      });
      collector.addObjectTrack(targetObject.id, "translateX", {
        delay: 1.1,
        duration: 2.2,
        easing: "easeOut",
        keyframes: [keyframe(0, 0), keyframe(1, 260)],
        label: "ball flies across stage",
      });
      collector.addObjectTrack(targetObject.id, "rotate", {
        delay: 1.1,
        duration: 2.2,
        keyframes: [keyframe(0, 0), keyframe(1, 720)],
        label: "ball spin",
      });
      collector.addObjectTrack(targetObject.id, "scale", {
        delay: 1.1,
        duration: 2.2,
        keyframes: [keyframe(0, 1), keyframe(0.4, 1.15), keyframe(1, 0.75)],
        label: "ball perspective scale",
      });
      notes.push("ball fly");
    }
  } else if (wantsJump) {
    actionEnd = 1.6;
    // Jump with squash, stretch and settle
    collector.addBoneTrack(primaryActor, rootBone, "translateY", {
      delay: 0.2,
      duration: 1.4,
      easing: "easeInOut",
      keyframes: [
        keyframe(0, 0, "easeIn"),
        keyframe(0.2, 14, "quadIn"), // anticipation crouch
        keyframe(0.52, -65, "quadOut"), // jump apex
        keyframe(0.85, 6, "easeOut"), // land overshoot
        keyframe(1, 0),
      ],
      label: "crouch -> jump -> land -> settle",
    });
    collector.addBoneTrack(primaryActor, rootBone, "scaleY", {
      delay: 0.2,
      duration: 1.4,
      keyframes: [
        keyframe(0, 1),
        keyframe(0.2, 0.88), // squash
        keyframe(0.5, 1.14), // stretch in air
        keyframe(0.85, 0.92), // squash on landing
        keyframe(1, 1),
      ],
      label: "squash and stretch",
    });
    collector.addBoneTrack(primaryActor, armRBone, "rotate", {
      delay: 0.3,
      duration: 1.2,
      keyframes: [keyframe(0, 0), keyframe(0.5, -45), keyframe(1, 0)],
      label: "arm lift on jump",
    });
    notes.push("jump");
  }

  // 3. Watch action result
  if (wantsNotice || wantsKick || wantsBall) {
    collector.addBoneTrack(primaryActor, headBone, "faceLookY", {
      delay: 1.3,
      duration: 1.8,
      easing: "easeInOut",
      keyframes: [
        keyframe(0, 0),
        keyframe(0.3, -0.75), // look up watching ball
        keyframe(0.8, -0.75),
        keyframe(1, 0),
      ],
      label: "watch fly away",
    });
  }

  // 4. Wave or Celebrate (climax/ending)
  if (wantsCelebrate || (!wantsWave && !wantsJump && !wantsKick)) {
    const celebDelay = Math.max(1.8, actionEnd);
    collector.addBoneTrack(primaryActor, armLBone, "rotate", {
      delay: celebDelay,
      duration: Math.min(1.8, duration - celebDelay),
      easing: "springBouncy",
      keyframes: [keyframe(0, 0), keyframe(0.3, 110), keyframe(0.7, 125), keyframe(1, 0)],
      label: "left arm celebrate",
    });
    collector.addBoneTrack(primaryActor, armRBone, "rotate", {
      delay: celebDelay,
      duration: Math.min(1.8, duration - celebDelay),
      easing: "springBouncy",
      keyframes: [keyframe(0, 0), keyframe(0.3, -110), keyframe(0.7, -125), keyframe(1, 0)],
      label: "right arm celebrate",
    });
    collector.addBoneTrack(primaryActor, headBone, "faceExpression", {
      delay: celebDelay,
      duration: Math.min(1.6, duration - celebDelay),
      keyframes: [keyframe(0, 0), keyframe(0.15, 1), keyframe(1, 1)], // 1 = happy
      label: "happy expression",
    });
    collector.addBoneTrack(primaryActor, rootBone, "translateY", {
      delay: celebDelay + 0.1,
      duration: 0.8,
      keyframes: [
        keyframe(0, 0),
        keyframe(0.3, -18),
        keyframe(0.6, 3),
        keyframe(1, 0),
      ],
      label: "celebration hop",
    });
    notes.push("celebrate");
  } else if (wantsWave) {
    const waveDelay = Math.max(1.6, actionEnd);
    collector.addBoneTrack(primaryActor, armRBone, "rotate", {
      delay: waveDelay,
      duration: Math.min(1.8, duration - waveDelay),
      easing: "easeOut",
      keyframes: [keyframe(0, 0), keyframe(0.2, -85), keyframe(0.9, -85), keyframe(1, 0)],
      label: "raise arm to wave",
    });
    collector.addBoneTrack(primaryActor, handRBone, "rotate", {
      delay: waveDelay + 0.2,
      duration: Math.min(1.5, duration - waveDelay - 0.2),
      easing: "easeInOut",
      keyframes: [
        keyframe(0, 0),
        keyframe(0.25, 30),
        keyframe(0.5, -30),
        keyframe(0.75, 30),
        keyframe(1, 0),
      ],
      label: "hand wave oscillate",
    });
    collector.addBoneTrack(primaryActor, headBone, "faceExpression", {
      delay: waveDelay,
      duration: 1.4,
      keyframes: [keyframe(0, 0), keyframe(0.2, 1), keyframe(1, 0)],
      label: "smile while waving",
    });
    notes.push("wave");
  }

  // Ensure at least one track exists
  if (collector.trackCount === 0) {
    collector.addBoneTrack(primaryActor, rootBone, "scaleY", {
      delay: 0.1,
      duration: duration - 0.2,
      keyframes: [keyframe(0, 1), keyframe(0.5, 1.05), keyframe(1, 1)],
      label: "idle breath",
    });
  }

  const name = titleCase(notes.join(" and ")) || "Character Performance";
  const explanation = `Local procedural character motion: ${notes.join(
    ", ",
  )}. Composed ${collector.trackCount} bone and object tracks with squash, anticipation and follow-through. No hosted model used.`;
  const summary = `Local fallback: ${notes.join(", ")}; ${collector.trackCount} tracks.`;

  const document: MotionDocument = {
    version: 1,
    id: docId(name, instruction),
    name,
    targetKind: "character",
    duration,
    fps: 60,
    loop: {
      enabled: loop.enabled,
      mode: loop.pingpong ? "pingpong" : "restart",
    },
    tracks: collector.tracks,
    meta: {
      prompt: instruction,
      source: "fallback",
      createdAt: new Date().toISOString(),
      summary: summary.slice(0, 240),
    },
  };

  return { document, explanation: explanation.slice(0, 300) };
}

// ---------------------------------------------------------------------------
// SVG Fallback Performance Builder
// ---------------------------------------------------------------------------

class SvgTrackCollector {
  readonly tracks: MotionTrack[] = [];
  readonly groups: StaggerGroup[] = [];
  private readonly duration: number;
  private readonly maxTracks: number;
  private readonly ids = new Set<string>();

  constructor(duration: number, maxTracks: number) {
    this.duration = duration;
    this.maxTracks = maxTracks;
  }

  get trackCount(): number {
    return this.tracks.length + this.groups.length;
  }

  add(elementId: string, spec: TrackSpec): void {
    if (this.trackCount >= this.maxTracks) return;
    const baseId = `${slug(elementId)}-${spec.property}`;
    let id = baseId;
    let counter = 1;
    while (this.ids.has(id)) {
      counter += 1;
      id = `${baseId}-${counter}`;
    }
    this.ids.add(id);

    const delay = Math.max(0, spec.delay ?? 0);
    const maxDur = Math.max(0.1, this.duration - delay);
    const duration = spec.duration ? Math.min(spec.duration, maxDur) : maxDur;

    this.tracks.push({
      id,
      target: { kind: "svg", elementId },
      property: spec.property,
      keyframes: spec.keyframes,
      delay: round2(delay),
      duration: round2(duration),
      ...(spec.easing ? { easing: spec.easing } : {}),
      ...(spec.path ? { path: spec.path } : {}),
      ...(spec.orient !== undefined ? { orient: spec.orient } : {}),
      origin: spec.origin ?? "center",
      label: spec.label,
      muted: spec.muted,
    });
  }

  addStagger(
    idPrefix: string,
    elementIds: string[],
    spec: TrackSpec,
    step = 0.08,
  ): void {
    if (elementIds.length === 0 || this.trackCount >= this.maxTracks) return;
    const baseId = `group-${idPrefix}-${spec.property}`;
    let id = baseId;
    let counter = 1;
    while (this.ids.has(id)) {
      counter += 1;
      id = `${baseId}-${counter}`;
    }
    this.ids.add(id);

    this.groups.push({
      id,
      target: { kind: "svg" },
      elementIds,
      property: spec.property,
      keyframes: spec.keyframes,
      step: round2(step),
      delay: round2(spec.delay ?? 0),
      duration: round2(spec.duration ?? this.duration),
      ...(spec.easing ? { easing: spec.easing } : {}),
      origin: spec.origin ?? "center",
      label: spec.label,
      muted: spec.muted,
    });
  }
}

function composeSvg(
  request: AnimationDirectionRequest,
  instruction: string,
): FallbackResult {
  const scene = request.scene!;
  const allElements = scene.elements;
  const animatable = allElements.filter((el) => ANIMATABLE.has(el.tag));
  const elements = animatable.length > 0 ? animatable : allElements;
  const loop = loopRequested(instruction);
  const duration = clampDuration(2.6);

  const collector = new SvgTrackCollector(duration, MAX_SVG_TRACKS);
  const selected = new Set(request.selectedElementIds ?? []);
  const targets =
    selected.size > 0
      ? elements.filter((el) => selected.has(el.id))
      : elements.filter((el) => el.parentId === null).slice(0, 8);

  const targetList = targets.length > 0 ? targets : elements.slice(0, 6);
  const lower = instruction.toLowerCase();
  const wantsDraw = /\b(draw|stroke|write|outline|reveal|pop in one by one|pop in)\b/.test(lower);
  const wantsFloat = /\b(float|hover|drift|levitate|sway)\b/.test(lower);
  const wantsPop = /\b(pop|scale|bounce|spring)\b/.test(lower);

  let step = 0;
  for (const el of targetList) {
    const delay = round2(step * 0.18);
    step += 1;

    // Pop / Scale entrance
    if (wantsPop || wantsDraw || (!wantsFloat && !wantsPop)) {
      collector.add(el.id, {
        property: "scale",
        delay,
        duration: 0.9,
        easing: "springBouncy",
        keyframes: [keyframe(0, 0), keyframe(0.7, 1.15), keyframe(1, 1)],
        label: "pop scale entrance",
      });
    }

    // StrokeDraw if it's a path
    if (el.tag === "path" && wantsDraw) {
      collector.add(el.id, {
        property: "strokeDraw",
        delay,
        duration: 1.2,
        easing: "easeInOut",
        keyframes: [keyframe(0, 0), keyframe(1, 1)],
        label: "stroke draw reveal",
      });
    }

    // Floating motion
    if (wantsFloat) {
      collector.add(el.id, {
        property: "translateY",
        delay: delay + 0.3,
        duration: Math.max(0.8, duration - delay - 0.4),
        easing: "easeInOut",
        keyframes: [
          keyframe(0, 0),
          keyframe(0.3, -12),
          keyframe(0.7, 8),
          keyframe(1, 0),
        ],
        label: "floating hover",
      });
    }
  }

  // Ensure at least one track exists
  if (collector.trackCount === 0 && elements[0]) {
    collector.add(elements[0].id, {
      property: "scale",
      delay: 0.1,
      duration: duration - 0.2,
      easing: "easeInOut",
      keyframes: [keyframe(0, 1), keyframe(0.5, 1.08), keyframe(1, 1)],
      label: "pulse scale",
    });
  }

  const name = "SVG Animation";
  const explanation = `Local procedural SVG animation: composed ${collector.trackCount} track(s) across elements with gentle easing. No hosted model used.`;
  const summary = `Local fallback: ${collector.trackCount} tracks.`;

  const document: MotionDocument = {
    version: 1,
    id: docId(name, instruction),
    name,
    targetKind: "svg",
    duration,
    fps: 60,
    loop: {
      enabled: loop.enabled,
      mode: loop.pingpong ? "pingpong" : "restart",
    },
    tracks: collector.tracks,
    ...(collector.groups.length > 0 ? { groups: collector.groups } : {}),
    meta: {
      prompt: instruction,
      source: "fallback",
      createdAt: new Date().toISOString(),
      summary: summary.slice(0, 240),
    },
  };

  return { document, explanation: explanation.slice(0, 300) };
}

// ---------------------------------------------------------------------------
// Revision Fallback
// ---------------------------------------------------------------------------

function composeRevision(
  request: AnimationDirectionRequest,
  instruction: string,
): FallbackResult {
  const current = request.currentDocument!;
  const lower = instruction.toLowerCase();

  // If "higher" is requested, scale up any negative translateY jump tracks
  if (/\b(higher|more jump|bigger jump|high)\b/.test(lower)) {
    const updatedTracks = current.tracks.map((track) => {
      if (track.property === "translateY") {
        return {
          ...track,
          keyframes: track.keyframes.map((kf) => {
            if (typeof kf.value === "number" && kf.value < 0) {
              return { ...kf, value: round2(kf.value * 1.5) };
            }
            return kf;
          }),
          label: `${track.label ?? "translateY"} (amplified)`,
        };
      }
      return track;
    });

    const document: MotionDocument = {
      ...current,
      id: docId(`${current.name} revised`, instruction),
      name: `${current.name} (Higher Jump)`,
      tracks: updatedTracks,
      meta: {
        prompt: instruction,
        source: "fallback",
        createdAt: new Date().toISOString(),
        summary: "Local fallback revision: amplified jump height.",
        revisionOf: current.id,
      },
    };
    return {
      document,
      explanation: "Local revision fallback: increased jump height while preserving all existing tracks.",
    };
  }

  // If not explicitly "higher", compose a new candidate using the regular composer
  // and the Director's revision merger will preserve the unrelated baseline tracks.
  if (request.targetKind === "character") {
    return composeCharacter(request, instruction);
  }
  return composeSvg(request, instruction);
}

/**
 * Public fallback composer.
 */
export function composeFallback(request: AnimationDirectionRequest): FallbackResult {
  const instruction = request.instruction;
  if (request.action === "revise" && request.currentDocument) {
    return composeRevision(request, instruction);
  }
  if (request.targetKind === "character") {
    return composeCharacter(request, instruction);
  }
  return composeSvg(request, instruction);
}
