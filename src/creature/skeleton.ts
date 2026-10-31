// The skeleton grammar. Every body plan is a function that returns role-tagged
// bones. Motion programs target ROLES (head, handR, footL, tentacle, tail), not
// body-plan-specific bone names, so one `greet` works for a human, a horse, an
// octopus and a blob.
//
// The octopus is not special here. It is just the body plan that proves a
// chain-heavy invertebrate. A horse is `quadruped`; a cowboy on a horse is a
// `biped` actor attached to the horse's `back` bone. A centaur is `custom`.

import type { Bone, BoneRole, Genome, Skeleton } from './types';

type BoneInit = {
  id: string;
  parent: string | null;
  role: BoneRole;
  x?: number;
  y?: number;
  rot?: number;
  len?: number;
  w?: number;
  taper?: number;
  shape?: Bone['shape'];
  color?: Bone['color'];
  depth?: number;
  chain?: string;
  phase?: number;
};

const B = (b: BoneInit): Bone => ({
  x: 0,
  y: 0,
  rot: 0,
  len: 10,
  w: 8,
  taper: 0.2,
  shape: 'tapered',
  color: 'skin',
  depth: 10,
  ...b,
});

export function buildSkeleton(genome: Genome): Skeleton {
  switch (genome.bodyPlan) {
    case 'biped':
      return biped(genome);
    case 'quadruped':
      return quadruped(genome);
    case 'octopod':
      return octopod(genome);
    case 'blob':
      return blob(genome);
    case 'custom':
      return custom(genome);
  }
}

// ---------------------------------------------------------------------------
// biped: humans, cowboys, founders, children, stylized characters.
// The same plan is used for a rider; the riding pose is applied by the compiler.

function biped(g: Genome): Skeleton {
  const p = g.proportions;
  // Height is a leg/arm multiplier, not a new rig. The stage fit reads the
  // resulting bone lengths, so a taller person still sits inside the frame.
  const height = g.human?.body.height ?? 1;
  const thigh = 21 * p.limbLength * height;
  const shin = 15 * p.limbLength * height;
  const foot = 6 * p.limbLength * height;
  const hip = thigh + shin + foot;
  const torso = 46 * p.torso;
  const neck = 7 * p.neck;
  const headLen = 38 * p.head;
  const headW = 34 * p.head;
  const armU = 22 * p.limbLength * height;
  const armF = 20 * p.limbLength * height;
  const shoulderX = torso * 0.8;
  const shoulderW = 11 * p.limbWidth * (g.human?.body.shoulders ?? 1);
  const hipW = 15 * p.limbWidth * (g.human?.body.hips ?? 1);

  const bones: Bone[] = [
    B({ id: 'root', parent: null, role: 'root', x: 0, y: hip, len: 0, w: 0, depth: 0 }),
    B({
      id: 'spine',
      parent: 'root',
      role: 'spine',
      rot: 90,
      len: torso,
      w: 32 * p.limbWidth,
      taper: 0.02,
      depth: 10,
    }),
    B({
      id: 'neck',
      parent: 'spine',
      role: 'neck',
      x: torso * 0.94,
      rot: 0,
      len: neck,
      w: 11,
      taper: 0.05,
      shape: 'capsule',
      depth: 11,
    }),
    B({
      id: 'head',
      parent: 'neck',
      role: 'head',
      x: neck,
      rot: 0,
      len: headLen,
      w: headW,
      taper: 0,
      shape: 'blob',
      depth: 30,
    }),

    // left arm (viewer's left)
    B({
      id: 'armL',
      parent: 'spine',
      role: 'handL',
      x: shoulderX,
      y: -13,
      rot: 195,
      len: armU,
      w: shoulderW,
      taper: 0.03,
      depth: 12,
      chain: 'armL',
    }),
    B({
      id: 'foreL',
      parent: 'armL',
      role: 'handL',
      x: armU,
      rot: -10,
      len: armF,
      w: shoulderW * 0.9,
      taper: 0.05,
      depth: 13,
      chain: 'armL',
    }),
    B({
      id: 'handL',
      parent: 'foreL',
      role: 'handL',
      x: armF,
      len: 5,
      w: 11,
      taper: 0,
      shape: 'blob',
      depth: 14,
      chain: 'armL',
    }),

    // right arm
    B({
      id: 'armR',
      parent: 'spine',
      role: 'handR',
      x: shoulderX,
      y: 13,
      rot: 165,
      len: armU,
      w: shoulderW,
      taper: 0.03,
      depth: 12,
      chain: 'armR',
    }),
    B({
      id: 'foreR',
      parent: 'armR',
      role: 'handR',
      x: armU,
      rot: 10,
      len: armF,
      w: shoulderW * 0.9,
      taper: 0.05,
      depth: 13,
      chain: 'armR',
    }),
    B({
      id: 'handR',
      parent: 'foreR',
      role: 'handR',
      x: armF,
      len: 5,
      w: 11,
      taper: 0,
      shape: 'blob',
      depth: 14,
      chain: 'armR',
    }),

    // left leg
    B({
      id: 'thighL',
      parent: 'root',
      role: 'footL',
      x: -11,
      rot: -92,
      len: thigh,
      w: hipW,
      taper: 0.05,
      depth: 6,
      chain: 'legL',
    }),
    B({
      id: 'shinL',
      parent: 'thighL',
      role: 'footL',
      x: thigh,
      len: shin,
      w: hipW * 0.8,
      taper: 0.05,
      depth: 5,
      chain: 'legL',
    }),
    B({
      id: 'footL',
      parent: 'shinL',
      role: 'footL',
      x: shin,
      len: foot,
      w: 13,
      taper: 0,
      shape: 'blob',
      color: 'detail',
      depth: 7,
      chain: 'legL',
    }),

    // right leg
    B({
      id: 'thighR',
      parent: 'root',
      role: 'footR',
      x: 11,
      rot: -88,
      len: thigh,
      w: hipW,
      taper: 0.05,
      depth: 6,
      chain: 'legR',
    }),
    B({
      id: 'shinR',
      parent: 'thighR',
      role: 'footR',
      x: thigh,
      len: shin,
      w: hipW * 0.8,
      taper: 0.05,
      depth: 5,
      chain: 'legR',
    }),
    B({
      id: 'footR',
      parent: 'shinR',
      role: 'footR',
      x: shin,
      len: foot,
      w: 13,
      taper: 0,
      shape: 'blob',
      color: 'detail',
      depth: 7,
      chain: 'legR',
    }),
  ];

  return {
    bones,
    head: 'head',
    face: g.face,
    faceAt: { bone: 'head', x: headLen * 0.5, y: 0, rot: -90 },
    back: 'spine',
  };
}

// ---------------------------------------------------------------------------
// quadruped: horses, dogs, cats, lions, cows, dragons without wings.
// Front legs are footL/footR (primary pair); back legs are footBL/footBR.

function quadruped(g: Genome): Skeleton {
  const p = g.proportions;
  const bodyY = 40 * p.limbLength;
  const bodyLen = 84 * p.torso;
  const bodyW = 42 * p.limbWidth;
  const neckLen = 24 * p.neck;
  const headLen = 38 * p.head;
  const headW = 26 * p.head;
  const legU = 20 * p.limbLength;
  const legL = 18 * p.limbLength;
  const hoof = 7 * p.limbLength;

  const bones: Bone[] = [
    B({ id: 'root', parent: null, role: 'root', len: 0, w: 0, depth: 0 }),
    B({
      id: 'body',
      parent: 'root',
      role: 'spine',
      x: -bodyLen * 0.5,
      y: bodyY,
      len: bodyLen,
      w: bodyW,
      taper: 0.02,
      shape: 'blob',
      depth: 10,
    }),
    B({
      id: 'neck',
      parent: 'body',
      role: 'neck',
      x: bodyLen * 0.88,
      rot: 46,
      len: neckLen,
      w: 26 * p.limbWidth,
      taper: 0.08,
      depth: 11,
    }),
    B({
      id: 'head',
      parent: 'neck',
      role: 'head',
      x: neckLen,
      rot: -44,
      len: headLen,
      w: headW,
      taper: 0.02,
      shape: 'blob',
      depth: 30,
    }),
    B({
      id: 'muzzle',
      parent: 'head',
      role: 'mouth',
      x: headLen * 0.8,
      rot: -16,
      len: headLen * 0.34,
      w: 17,
      taper: 0.1,
      shape: 'blob',
      color: 'detail',
      depth: 31,
    }),
    B({
      id: 'earL',
      parent: 'head',
      role: 'accessory',
      x: headLen * 0.24,
      y: 11,
      rot: 65,
      len: 14,
      w: 11,
      taper: 0.35,
      depth: 32,
    }),
    B({
      id: 'earR',
      parent: 'head',
      role: 'accessory',
      x: headLen * 0.24,
      y: -11,
      rot: 115,
      len: 14,
      w: 11,
      taper: 0.35,
      depth: 32,
    }),
    // saddle / rider anchor, on top of the body
    B({
      id: 'back',
      parent: 'body',
      role: 'back',
      x: bodyLen * 0.52,
      y: bodyW * 0.46,
      rot: 90,
      len: 0,
      w: 0,
      depth: 12,
    }),
    // tail chain
    B({
      id: 'tail1',
      parent: 'body',
      role: 'tail',
      rot: 200,
      len: 18,
      w: 12,
      taper: 0.15,
      depth: 5,
      chain: 'tail',
    }),
    B({
      id: 'tail2',
      parent: 'tail1',
      role: 'tail',
      x: 18,
      rot: -18,
      len: 16,
      w: 11,
      taper: 0.1,
      color: 'belly',
      depth: 5,
      chain: 'tail',
    }),
    B({
      id: 'tail3',
      parent: 'tail2',
      role: 'tail',
      x: 16,
      rot: -14,
      len: 15,
      w: 10,
      taper: 0.25,
      color: 'belly',
      depth: 5,
      chain: 'tail',
    }),
    ...leg('FL', 'body', bodyLen * 0.82 - 4, legU, legL, hoof, 0),
    ...leg('FR', 'body', bodyLen * 0.82 + 4, legU, legL, hoof, 0.5),
    ...leg('BL', 'body', bodyLen * 0.18 - 4, legU, legL, hoof, 0.5),
    ...leg('BR', 'body', bodyLen * 0.18 + 4, legU, legL, hoof, 0),
  ];

  return {
    bones,
    head: 'head',
    face: g.face,
    faceAt: { bone: 'head', x: headLen * 0.4, y: 0, rot: -8 },
    back: 'back',
  };
}

function leg(
  suffix: 'FL' | 'FR' | 'BL' | 'BR',
  parent: string,
  x: number,
  upper: number,
  lower: number,
  hoof: number,
  phase: number,
): Bone[] {
  const role: BoneRole =
    suffix === 'FL' ? 'footL' : suffix === 'FR' ? 'footR' : suffix === 'BL' ? 'footBL' : 'footBR';
  const depth = suffix.endsWith('L') ? 6 : 4;
  const chain = `leg${suffix}`;
  return [
    B({
      id: `thigh${suffix}`,
      parent,
      role,
      x,
      rot: -92,
      len: upper,
      w: 14,
      taper: 0.05,
      depth,
      chain,
      phase,
    }),
    B({
      id: `shin${suffix}`,
      parent: `thigh${suffix}`,
      role,
      x: upper,
      rot: 4,
      len: lower,
      w: 11,
      taper: 0.05,
      depth: depth - 1,
      chain,
      phase,
    }),
    B({
      id: `hoof${suffix}`,
      parent: `shin${suffix}`,
      role,
      x: lower,
      len: hoof,
      w: 15,
      taper: 0,
      shape: 'blob',
      color: 'detail',
      depth: depth - 2,
      chain,
      phase,
    }),
  ];
}

// ---------------------------------------------------------------------------
// octopod: octopus, squid, spider, jellyfish, anything with a fan of chains.
// `limbCount` controls the number of tentacles (4–12, default 8).

function octopod(g: Genome): Skeleton {
  const p = g.proportions;
  const mantleH = 54 * p.head;
  const mantleW = 54 * p.head;
  const baseY = 32 * p.limbLength;
  const count = Math.max(4, Math.min(12, Math.round(p.limbCount || 8)));
  const segments = 6;
  const segLen = 10.2 * p.limbLength;

  const bones: Bone[] = [
    B({ id: 'root', parent: null, role: 'root', len: 0, w: 0, depth: 0 }),
    B({
      id: 'mantle',
      parent: 'root',
      role: 'head',
      y: baseY,
      rot: 90,
      len: mantleH,
      w: mantleW,
      taper: 0,
      shape: 'blob',
      depth: 20,
    }),
  ];

  for (let i = 0; i < count; i++) {
    // Fan the chains across the lower half; -160° is down-left, -20° down-right.
    // The first bone starts on the rim of the mantle, not at a single point, so
    // the octopus reads as a dome with legs instead of a skirt on a pin.
    const angle = -160 + (i * 140) / Math.max(1, count - 1);
    const rad = (angle * Math.PI) / 180;
    const chain = `tentacle${i}`;
    const front = i >= count / 2;
    let parent = 'root';

    for (let s = 0; s < segments; s++) {
      const id = `${chain}_${s}`;
      bones.push(
        B({
          id,
          parent,
          role: 'tentacle',
          x: s === 0 ? Math.cos(rad) * mantleW * 0.3 : segLen,
          y: s === 0 ? baseY + Math.sin(rad) * 8 : 0,
          rot: s === 0 ? angle : s % 2 === 0 ? 10 : -5,
          len: segLen * (1 - s * 0.03),
          w: 13 * p.limbWidth * (1 - s * 0.055),
          taper: s === segments - 1 ? 0.45 : 0.03,
          depth: front ? 24 + s : 8 + s,
          chain,
          phase: i / count,
        }),
      );
      parent = id;
    }
  }

  return {
    bones,
    head: 'mantle',
    face: g.face,
    faceAt: { bone: 'mantle', x: mantleH * 0.5, y: 0, rot: -90 },
  };
}

// ---------------------------------------------------------------------------
// blob: slimes, ghosts, clouds, abstract mascots. Squash and stretch do the
// acting; the stub arms give `greet` and `celebrate` something to work with.

function blob(g: Genome): Skeleton {
  const p = g.proportions;
  const bodyH = 58 * p.torso;
  const bodyW = 58 * p.limbWidth;
  const bodyY = 10 * p.limbLength;

  const bones: Bone[] = [
    B({ id: 'root', parent: null, role: 'root', len: 0, w: 0, depth: 0 }),
    B({
      id: 'body',
      parent: 'root',
      role: 'head',
      y: bodyY,
      rot: 90,
      len: bodyH,
      w: bodyW,
      taper: 0,
      shape: 'blob',
      depth: 20,
    }),
    B({
      id: 'stalkL',
      parent: 'body',
      role: 'eyeL',
      x: bodyH * 0.78,
      y: -10,
      rot: 200,
      len: 12,
      w: 6,
      taper: 0.25,
      depth: 22,
    }),
    B({
      id: 'stalkR',
      parent: 'body',
      role: 'eyeR',
      x: bodyH * 0.78,
      y: 10,
      rot: 160,
      len: 12,
      w: 6,
      taper: 0.25,
      depth: 22,
    }),
    B({
      id: 'armL',
      parent: 'body',
      role: 'handL',
      x: bodyH * 0.3,
      y: -bodyW * 0.5,
      rot: 205,
      len: 20,
      w: 11,
      taper: 0.1,
      depth: 24,
      chain: 'armL',
    }),
    B({
      id: 'handL',
      parent: 'armL',
      role: 'handL',
      x: 20,
      len: 7,
      w: 11,
      taper: 0,
      shape: 'blob',
      depth: 25,
      chain: 'armL',
    }),
    B({
      id: 'armR',
      parent: 'body',
      role: 'handR',
      x: bodyH * 0.3,
      y: bodyW * 0.5,
      rot: 155,
      len: 20,
      w: 11,
      taper: 0.1,
      depth: 24,
      chain: 'armR',
    }),
    B({
      id: 'handR',
      parent: 'armR',
      role: 'handR',
      x: 20,
      len: 7,
      w: 11,
      taper: 0,
      shape: 'blob',
      depth: 25,
      chain: 'armR',
    }),
    B({
      id: 'footL',
      parent: 'root',
      role: 'footL',
      x: -15,
      y: bodyY,
      rot: -90,
      len: 9,
      w: 15,
      taper: 0,
      shape: 'blob',
      depth: 10,
    }),
    B({
      id: 'footR',
      parent: 'root',
      role: 'footR',
      x: 15,
      y: bodyY,
      rot: -90,
      len: 9,
      w: 15,
      taper: 0,
      shape: 'blob',
      depth: 10,
    }),
  ];

  return {
    bones,
    head: 'body',
    face: g.face,
    faceAt: { bone: 'body', x: bodyH * 0.52, y: 0, rot: -90 },
  };
}

// ---------------------------------------------------------------------------
// custom: the escape hatch. The LLM can emit a bone tree for a centaur, a
// mermaid, a two-headed mushroom, a rider on a dragon, or anything the four
// plans don't cover. Roles are the contract.

function custom(g: Genome): Skeleton {
  const bones = (g.customBones ?? []).map((b) => ({ ...b }));
  if (!bones.some((b) => b.role === 'head')) {
    bones.push(
      B({
        id: 'head',
        parent: bones[0]?.id ?? null,
        role: 'head',
        rot: 90,
        len: 40,
        w: 30,
        taper: 0,
        shape: 'blob',
        depth: 30,
      }),
    );
  }
  const head = bones.find((b) => b.role === 'head')!;
  return {
    bones,
    head: head.id,
    face: g.face,
    faceAt: { bone: head.id, x: head.len * 0.5, y: 0, rot: -90 },
    back: bones.find((b) => b.role === 'back')?.id,
  };
}

// ---------------------------------------------------------------------------
// role helpers used by motion programs

export function bonesByRole(skeleton: Skeleton, role: BoneRole): Bone[] {
  return skeleton.bones.filter((b) => b.role === role);
}

export function boneById(skeleton: Skeleton, id: string): Bone | undefined {
  return skeleton.bones.find((b) => b.id === id);
}

export function chainBones(skeleton: Skeleton, chain: string): Bone[] {
  return skeleton.bones.filter((b) => b.chain === chain);
}

export function headBone(skeleton: Skeleton): Bone {
  return boneById(skeleton, skeleton.head) ?? skeleton.bones[0];
}
