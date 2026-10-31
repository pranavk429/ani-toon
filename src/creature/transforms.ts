// Scene-graph transforms. Actors are processed in depth order; an attached
// actor (a rider) samples the parent actor's bone matrix, so it inherits the
// mount's gait, bob and rear automatically.

import { IDENTITY, apply, mul, rotate, scale, translate, type Mat } from './math';
import { restPoseAt, type ScenePose } from './pose';
import type { Actor, Bone, Scene } from './types';

export type ActorTransforms = {
  base: Mat;
  bones: Map<string, Mat>;
  skeleton: Actor['skeleton'];
};

export type SceneTransforms = Map<string, ActorTransforms>;

export function sceneTransforms(scene: Scene, pose: ScenePose): SceneTransforms {
  const out: SceneTransforms = new Map();
  const byId = new Map(scene.actors.map((a) => [a.id, a]));
  const sorted = [...scene.actors].sort((a, b) => a.depth - b.depth);

  for (const actor of sorted) {
    const p = pose[actor.id];
    const root = actor.skeleton.bones.find((b) => b.role === 'root');

    let base: Mat = IDENTITY;

    if (actor.attach) {
      const parent = byId.get(actor.attach.actor);
      const parentT = parent ? out.get(parent.id) : undefined;
      const parentBone = parentT?.bones.get(actor.attach.bone);
      if (parentBone && parentT) {
        // The saddle anchor is a POINT. Its own rotation is a drawing marker
        // (the saddle points up); the rider should inherit the mount's BODY
        // rotation, not the marker, or the rider ends up lying sideways.
        const bodyBone: Bone | undefined = parentT.skeleton.bones.find(
          (b) => b.role === 'spine',
        );
        const bodyM = bodyBone ? parentT.bones.get(bodyBone.id) : undefined;
        const bodyRot = bodyM ? (Math.atan2(bodyM[1], bodyM[0]) * 180) / Math.PI : 0;
        const seat = apply(parentBone, 0, 0);
        base = mul(
          translate(seat.x, seat.y),
          mul(
            translate(actor.attach.x, actor.attach.y),
            mul(rotate(bodyRot + actor.attach.rot), scale(actor.attach.scale)),
          ),
        );
        // A rider's hips sit on the saddle; shift the feet-origin skeleton up
        // so the root bone's hip lands at the attachment point.
        if (actor.pose === 'ride' && root) {
          base = mul(base, translate(0, -root.y));
        }
      }
    } else if (actor.place) {
      base = mul(translate(actor.place.x, actor.place.y), scale(actor.place.scale ?? 1));
    }

    if (p) {
      base = mul(base, translate(p.root.x, p.root.y));
      base = mul(base, rotate(p.root.rot));
      base = mul(base, scale(p.root.scale));
    }

    const byBone = new Map(actor.skeleton.bones.map((b) => [b.id, b]));
    const memo = new Map<string, Mat>();

    const compute = (bone: Bone): Mat => {
      const cached = memo.get(bone.id);
      if (cached) return cached;

      const parentBone = bone.parent ? byBone.get(bone.parent) : undefined;
      const parentM = parentBone ? compute(parentBone) : base;
      const bp = p?.bones[bone.id];
      const local = mul(
        translate(bone.x, bone.y),
        mul(
          rotate(bone.rot + (bp?.rot ?? 0)),
          scale(bp?.sx ?? 1, bp?.sy ?? 1),
        ),
      );
      const world = mul(parentM, local);
      memo.set(bone.id, world);
      return world;
    };

    for (const bone of actor.skeleton.bones) compute(bone);
    out.set(actor.id, { base, bones: memo, skeleton: actor.skeleton });
  }

  return out;
}

export type Fit = {
  s: number;
  ox: number;
  oy: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

/**
 * Fit the whole scene to the 720x1280 stage using the rest pose, so the camera
 * never zooms while the character moves.
 */
export function fitScene(
  scene: Scene,
  stageW = 720,
  stageH = 720,
): Fit {
  const transforms = sceneTransforms(scene, restPoseAt(scene));
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const actor of scene.actors) {
    const t = transforms.get(actor.id);
    if (!t) continue;
    const hasRacket = actor.genome.accessories.some((a) => a.kind === 'tennis-racket');
    const human = actor.genome.human;
    const bigHair =
      human?.hair.style === 'afro' || human?.hair.style === 'curly'
        ? 12
        : human?.hair.style === 'long' || human?.hair.style === 'braids'
          ? 6
          : 0;
    const chefHat = actor.genome.accessories.some((a) => a.kind === 'chef-hat') ? 4 : 0;
    for (const bone of actor.skeleton.bones) {
      const m = t.bones.get(bone.id);
      if (!m) continue;
      const a = apply(m, 0, 0);
      const b = apply(m, bone.len, 0);
      const propRoom =
        hasRacket && (bone.role === 'handR' || bone.role === 'handL') ? 34 : 0;
      let humanRoom = 0;
      if (bone.role === 'head') humanRoom = Math.max(bigHair, chefHat);
      if (bone.role === 'spine' && human) {
        const shoulders = Math.max(0, bone.w * 0.5 * (human.body.shoulders - 1));
        const skirt = human.outfit.top === 'dress' || human.outfit.top === 'coat' ? 9 : 0;
        humanRoom = Math.max(shoulders, skirt, 2);
      }
      const r = bone.w / 2 + 2 + propRoom + humanRoom;
      for (const q of [a, b]) {
        if (q.x - r < minX) minX = q.x - r;
        if (q.x + r > maxX) maxX = q.x + r;
        if (q.y - r < minY) minY = q.y - r;
        if (q.y + r > maxY) maxY = q.y + r;
      }
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return { s: 4, ox: stageW / 2, oy: stageH * 0.89, minX: -45, maxX: 45, minY: 0, maxY: 130 };
  }

  const padX = stageW * 0.09;
  const padTop = stageH * 0.13;
  // Leave room for the stage title scrim and the actor chips so the feet and
  // shoes are never hidden behind the overlay.
  const padBottom = stageH * 0.17;
  const sx = (stageW - padX * 2) / Math.max(1, maxX - minX);
  const sy = (stageH - padTop - padBottom) / Math.max(1, maxY - minY);
  const s = Math.min(sx, sy);
  const ox = stageW / 2 - s * (minX + maxX) / 2;
  const oy = stageH - padBottom + s * minY;

  return { s, ox, oy, minX, maxX, minY, maxY };
}
