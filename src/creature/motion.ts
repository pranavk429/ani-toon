/**
 * Bridge between the declarative Motion DSL and the creature renderer.
 *
 * The renderer already owns a procedural idle layer (breathing, blinks, gaits,
 * secondary motion). Generated tracks are layered on top of that pose, so an
 * AI performance never replaces the character's baseline life. Independent
 * bones, facial channels and free-standing objects are evaluated at the same
 * timestamp from the same document.
 */

import {
  evaluateDocument,
  type BoneTargetContext,
  type MotionDocument,
  type ValidationContext,
} from '@/lib/animation';
import type { CharacterDirectionContext } from '@/lib/ai/contracts';

import { baseObjectFrame, type ObjectFrame } from './objects';
import type { ActorPose, BonePose, ScenePose } from './pose';
import type {
  Actor,
  Bone,
  Expression,
  Scene,
  SceneObject,
  WorldPreset,
} from './types';

export const CHARACTER_STYLE_ID = 'anitoon-storybook-v1';

const EXPRESSIONS: readonly Expression[] = [
  'neutral',
  'happy',
  'surprised',
  'thinking',
  'shy',
  'laugh',
  'sleepy',
  'wink',
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function limitsForBone(bone: Bone): {
  rotation: { min: number; max: number };
  scale: { min: number; max: number };
} {
  const id = bone.id.toLowerCase();
  if (id === 'root') {
    return { rotation: { min: -15, max: 15 }, scale: { min: 0.85, max: 1.18 } };
  }
  if (bone.role === 'head' || bone.role === 'neck') {
    return { rotation: { min: -38, max: 38 }, scale: { min: 0.86, max: 1.16 } };
  }
  if (bone.role === 'spine') {
    return { rotation: { min: -28, max: 28 }, scale: { min: 0.82, max: 1.2 } };
  }
  if (bone.role === 'handL' || bone.role === 'handR') {
    return { rotation: { min: -165, max: 165 }, scale: { min: 0.75, max: 1.25 } };
  }
  if (bone.role === 'footL' || bone.role === 'footR' || bone.role === 'footBL' || bone.role === 'footBR') {
    return { rotation: { min: -95, max: 95 }, scale: { min: 0.8, max: 1.2 } };
  }
  if (
    bone.role === 'tail' ||
    bone.role === 'tentacle' ||
    bone.role === 'wingL' ||
    bone.role === 'wingR'
  ) {
    return { rotation: { min: -70, max: 70 }, scale: { min: 0.85, max: 1.2 } };
  }
  return { rotation: { min: -120, max: 120 }, scale: { min: 0.75, max: 1.25 } };
}

function humanSummary(actor: Actor): string {
  const human = actor.genome.human;
  if (!human) return `${actor.genome.species} (${actor.genome.bodyPlan})`;
  return [
    `${actor.genome.species}`,
    `${human.presentation}`,
    `${human.hair.style} hair`,
    `${human.outfit.top} + ${human.outfit.bottom}`,
    human.facialHair !== 'none' ? human.facialHair : '',
  ]
    .filter(Boolean)
    .join(', ');
}

export function characterBoneContexts(scene: Scene): BoneTargetContext[] {
  const out: BoneTargetContext[] = [];
  for (const actor of scene.actors) {
    for (const bone of actor.skeleton.bones) {
      const limits = limitsForBone(bone);
      out.push({
        actorId: actor.id,
        boneId: bone.id,
        role: bone.role,
        parent: bone.parent,
        rotationLimit: limits.rotation,
        scaleLimit: limits.scale,
        note:
          bone.id === 'root'
            ? 'whole-character translation; translateX/Y use skeleton units, +Y is down'
            : bone.role === 'head'
              ? 'head and facial channels (face* properties target this bone)'
              : `${bone.role} joint; local rotation in degrees`,
      });
    }
  }
  return out;
}

export function characterContextForScene(scene: Scene): CharacterDirectionContext {
  const objects = scene.objects ?? [];
  return {
    styleId: scene.styleId ?? CHARACTER_STYLE_ID,
    actors: scene.actors.map((actor) => ({
      id: actor.id,
      name: actor.genome.name || actor.id,
      species: actor.genome.species,
      bodyPlan: actor.genome.bodyPlan,
      summary: humanSummary(actor),
      palette: { ...actor.genome.palette },
      accessories: actor.genome.accessories
        .filter((item) => item.kind !== 'none')
        .map((item) => `${item.kind}@${item.attach}`),
    })),
    bones: characterBoneContexts(scene),
    objects: objects.map((object) => ({
      id: object.id,
      kind: object.kind,
      label: object.label,
      x: object.x,
      y: object.y,
      scale: object.scale,
      rotation: object.rotation,
    })),
    world: { preset: scene.world.preset, accent: scene.world.accent },
    notes: [
      'The procedural idle layer stays on: do not animate breathing or blinking unless the instruction asks for it.',
      'Character root translateX/Y is in skeleton units; a humanoid is roughly 120-180 units tall.',
      'Object translateX/Y is in 720x720 stage pixels; +Y is down.',
      'Face properties target the head bone: faceBlink, faceLookX, faceLookY, faceMouth, faceWink, faceCheek, faceExpression.',
      'faceExpression: 0 neutral, 1 happy, 2 surprised, 3 thinking, 4 shy, 5 laugh, 6 sleepy, 7 wink.',
    ],
  };
}

export function validationContextForScene(scene: Scene): ValidationContext {
  return {
    targetKind: 'character',
    bones: characterBoneContexts(scene),
    objectIds: new Set((scene.objects ?? []).map((object) => object.id)),
  };
}

function ensureActorPose(pose: ScenePose, actor: Actor): ActorPose {
  return pose[actor.id];
}

function ensureBonePose(
  actorPose: ActorPose,
  actor: Actor,
  boneId: string,
): BonePose | undefined {
  const existing = actorPose.bones[boneId];
  if (existing) return existing;
  if (!actor.skeleton.bones.some((bone) => bone.id === boneId)) return undefined;
  const created: BonePose = { rot: 0, sx: 1, sy: 1 };
  actorPose.bones[boneId] = created;
  return created;
}

function applyFace(
  face: ActorPose['face'],
  state: {
    faceBlink?: number;
    faceLookX?: number;
    faceLookY?: number;
    faceMouth?: number;
    faceWink?: number;
    faceCheek?: number;
    faceExpression?: number;
  },
): boolean {
  let touched = false;
  if (typeof state.faceBlink === 'number') {
    face.blink = clamp01(face.blink + state.faceBlink);
    touched = true;
  }
  if (typeof state.faceLookX === 'number') {
    face.lookX = clamp(face.lookX + state.faceLookX, -1.4, 1.4);
    touched = true;
  }
  if (typeof state.faceLookY === 'number') {
    face.lookY = clamp(face.lookY + state.faceLookY, -1.4, 1.4);
    touched = true;
  }
  if (typeof state.faceMouth === 'number') {
    face.mouth = clamp01(face.mouth + state.faceMouth);
    touched = true;
  }
  if (typeof state.faceWink === 'number') {
    face.wink = clamp01(face.wink + state.faceWink);
    touched = true;
  }
  if (typeof state.faceCheek === 'number') {
    face.cheek = clamp01(face.cheek + state.faceCheek);
    touched = true;
  }
  if (typeof state.faceExpression === 'number') {
    face.expression = EXPRESSIONS[clamp(Math.round(state.faceExpression), 0, 7)];
    touched = true;
  }
  return touched;
}

function applyObjectState(
  object: SceneObject,
  state: {
    translateX: number;
    translateY: number;
    rotate: number;
    scaleX: number;
    scaleY: number;
    opacity: number;
    fill?: string;
    stroke?: string;
  },
): ObjectFrame {
  const frame = baseObjectFrame(object);
  const uniform = Math.sqrt(Math.max(0, state.scaleX * state.scaleY));
  return {
    object,
    x: frame.x + state.translateX,
    y: frame.y + state.translateY,
    scale: frame.scale * uniform,
    rotation: frame.rotation + state.rotate,
    opacity: clamp01(frame.opacity * state.opacity),
    fill: state.fill ?? state.stroke ?? frame.fill,
  };
}

export type MotionFrame = {
  pose: ScenePose;
  backObjects: ObjectFrame[];
  frontObjects: ObjectFrame[];
  active: boolean;
};

/**
 * Layer a document on top of a procedurally sampled pose. Pure: the input pose
 * is cloned before mutation, so the renderer can call this on every frame
 * without hidden state.
 */
export function applyMotionToScene(
  scene: Scene,
  basePose: ScenePose,
  document: MotionDocument | null | undefined,
  seconds: number,
): MotionFrame {
  const objects = scene.objects ?? [];
  const baseBack = objects
    .filter((object) => (object.layer ?? 'front') === 'back')
    .map(baseObjectFrame);
  const baseFront = objects
    .filter((object) => (object.layer ?? 'front') !== 'back')
    .map(baseObjectFrame);

  if (!document || document.targetKind !== 'character') {
    return {
      pose: basePose,
      backObjects: baseBack,
      frontObjects: baseFront,
      active: false,
    };
  }

  const pose: ScenePose = {};
  for (const [actorId, actorPose] of Object.entries(basePose)) {
    pose[actorId] = {
      ...actorPose,
      bones: Object.fromEntries(
        Object.entries(actorPose.bones).map(([id, bone]) => [id, { ...bone }]),
      ),
      face: { ...actorPose.face },
      root: { ...actorPose.root },
    };
  }

  const evaluated = evaluateDocument(document, seconds);
  let active = false;
  const objectFrames = new Map<string, ObjectFrame>(
    [...baseBack, ...baseFront].map((frame) => [frame.object.id, frame]),
  );

  for (const actor of scene.actors) {
    const actorPose = ensureActorPose(pose, actor);
    if (!actorPose) continue;

    for (const bone of actor.skeleton.bones) {
      const state = evaluated.targets[`${actor.id}:${bone.id}`];
      if (!state) continue;
      const bonePose = ensureBonePose(actorPose, actor, bone.id);
      if (!bonePose) continue;
      bonePose.rot += state.rotate;
      bonePose.sx *= state.scaleX;
      bonePose.sy *= state.scaleY;
      if (bone.id === 'root') {
        // Plan +Y is down; skeleton +Y is up.
        actorPose.root.x += state.translateX;
        actorPose.root.y -= state.translateY;
      }
      if (applyFace(actorPose.face, state)) active = true;
      active = true;
    }
  }

  for (const object of objects) {
    const state = evaluated.targets[object.id];
    if (!state) continue;
    objectFrames.set(object.id, applyObjectState(object, state));
    active = true;
  }

  return {
    pose,
    backObjects: objects
      .filter((object) => (object.layer ?? 'front') === 'back')
      .map((object) => objectFrames.get(object.id) ?? baseObjectFrame(object)),
    frontObjects: objects
      .filter((object) => (object.layer ?? 'front') !== 'back')
      .map((object) => objectFrames.get(object.id) ?? baseObjectFrame(object)),
    active,
  };
}

export function sceneWorldLabel(preset: WorldPreset): string {
  return preset.charAt(0).toUpperCase() + preset.slice(1);
}
