// A small procedural motion layer. It is not a keyframe player: every frame is
// evaluated from the score, so a new body plan can reuse the same verbs and a
// new beat can be applied without rebuilding tracks.
//
// Verbs are intentions. The body plan decides how to express them:
//   greet  -> arm wave | tentacle curl | tail wag | stub wave
//   hide   -> turn away | tentacles over the face | curl up | shrink
//   rear   -> front legs lift, rider inherits the body transform

import type { Actor, Beat, Bone, Expression, Scene } from './types';

export type BonePose = { rot: number; sx: number; sy: number };
export type FacePose = {
  blink: number;
  lookX: number;
  lookY: number;
  mouth: number;
  cheek: number;
  expression: Expression;
  wink: number;
};
export type ActorPose = {
  bones: Record<string, BonePose>;
  face: FacePose;
  root: { x: number; y: number; rot: number; scale: number };
};
export type ScenePose = Record<string, ActorPose>;

const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function emptyPose(actor: Actor): ActorPose {
  const bones: Record<string, BonePose> = {};
  for (const b of actor.skeleton.bones) bones[b.id] = { rot: 0, sx: 1, sy: 1 };
  return {
    bones,
    face: { blink: 0, lookX: 0, lookY: 0, mouth: 0, cheek: 0, expression: 'neutral', wink: 0 },
    root: { x: 0, y: 0, rot: 0, scale: 1 },
  };
}

function addRot(pose: ActorPose, id: string | undefined, value: number) {
  if (!id) return;
  const p = pose.bones[id];
  if (p) p.rot += value;
}

function addScale(pose: ActorPose, id: string | undefined, sx: number, sy: number) {
  if (!id) return;
  const p = pose.bones[id];
  if (p) {
    p.sx *= sx;
    p.sy *= sy;
  }
}

function addRoot(pose: ActorPose, x: number, y: number, rot: number) {
  pose.root.x += x;
  pose.root.y += y;
  pose.root.rot += rot;
}

function chainsOf(actor: Actor, prefix: string): Bone[][] {
  const map = new Map<string, Bone[]>();
  for (const b of actor.skeleton.bones) {
    if (!b.chain || !b.chain.startsWith(prefix)) continue;
    const list = map.get(b.chain) ?? [];
    list.push(b);
    map.set(b.chain, list);
  }
  return [...map.values()].sort((a, b) => (a[0].phase ?? 0) - (b[0].phase ?? 0));
}

function chainOf(actor: Actor, name: string): Bone[] | undefined {
  const chain = actor.skeleton.bones.filter((b) => b.chain === name);
  return chain.length ? chain : undefined;
}

function roleBone(actor: Actor, role: Bone['role']): Bone | undefined {
  return actor.skeleton.bones.find((b) => b.role === role);
}

const BASE_VERBS = new Set(['idle', 'walk', 'trot', 'gallop']);

function isBase(beat: Beat): boolean {
  return beat.layer === 'base' || (!beat.layer && BASE_VERBS.has(beat.verb));
}

/** 0 -> 1 -> 0 with a plateau in the middle. */
function envelope(u: number, rise = 0.18, fall = 0.82): number {
  if (u <= 0 || u >= 1) return 0;
  if (u < rise) return u / rise;
  if (u > fall) return (1 - u) / (1 - fall);
  return 1;
}

function blinkAt(t: number, id: string): number {
  const offset = hash(id) % 1200;
  const p = (t + offset) % 3400;
  if (p < 110) return p / 110;
  if (p < 170) return 1;
  if (p < 340) return 1 - (p - 170) / 170;
  return 0;
}

// ---------------------------------------------------------------------------
// base layers

function baseIdle(actor: Actor, pose: ActorPose, t: number) {
  const breathe = Math.sin((t / 1800) * TAU);

  for (const b of actor.skeleton.bones) {
    if (b.role === 'spine' || b.id === 'body' || b.id === 'mantle') {
      addScale(pose, b.id, 1 + 0.006 * breathe, 1 + 0.012 * breathe);
    }
  }

  addRot(pose, actor.skeleton.head, 1.2 * Math.sin((t / 3600) * TAU));
  addRot(pose, roleBone(actor, 'neck')?.id, 0.8 * Math.sin((t / 4200) * TAU));
  addRoot(
    pose,
    0.55 * Math.sin((t / 4800) * TAU),
    0,
    0.65 * Math.sin((t / 4800) * TAU + 1.1),
  );

  // Chains breathe on their own: tentacles drift, tails flick.
  for (const chain of chainsOf(actor, 'tentacle')) {
    chain.forEach((b, i) => {
      const amp = 3.4 * (1 - i / Math.max(1, chain.length));
      addRot(
        pose,
        b.id,
        amp * Math.sin((t / 2400) * TAU + (b.phase ?? 0) * TAU + i * 0.55),
      );
    });
  }
  for (const chain of chainsOf(actor, 'tail')) {
    chain.forEach((b, i) => {
      addRot(
        pose,
        b.id,
        4.2 * Math.sin((t / 1600) * TAU + (b.phase ?? 0) * TAU + i * 0.7),
      );
    });
  }

  if (actor.genome.bodyPlan === 'blob') {
    const body = roleBone(actor, 'head');
    addScale(pose, body?.id, 1 + 0.018 * Math.sin((t / 1500) * TAU), 1 - 0.014 * Math.sin((t / 1500) * TAU));
  }

  pose.face.blink = Math.max(pose.face.blink, blinkAt(t, actor.id));
  pose.face.lookX += 0.55 * Math.sin((t / 5200) * TAU);
  pose.face.lookY += 0.3 * Math.sin((t / 6900) * TAU);
}

function baseWalk(actor: Actor, pose: ActorPose, t: number, speed = 850) {
  const legs = chainsOf(actor, 'leg');
  for (const chain of legs) {
    const first = chain[0];
    if (!first) continue;
    const phase = first.phase ?? 0;
    const swing = Math.sin((t / speed) * TAU + phase * TAU);
    addRot(pose, first.id, swing * 21);
    addRot(pose, chain[1]?.id, Math.max(0, -swing) * 30);
    addRot(pose, chain[2]?.id, -swing * 6);
  }

  const body = roleBone(actor, 'spine');
  addRot(pose, body?.id, 1.2 * Math.sin((t / speed) * TAU));
  addRot(pose, roleBone(actor, 'neck')?.id, 1.6 * Math.sin((t / (speed * 2)) * TAU));
  addRot(pose, actor.skeleton.head, 2.1 * Math.sin((t / speed) * TAU + 0.6));
  addRoot(pose, 0, 1.1 * Math.sin((t / (speed / 2)) * TAU), 0);

  for (const chain of chainsOf(actor, 'tail')) {
    chain.forEach((b, i) => {
      addRot(pose, b.id, 5 * Math.sin((t / (speed * 1.4)) * TAU + i * 0.55));
    });
  }
}

// ---------------------------------------------------------------------------
// actions

function actionLook(actor: Actor, pose: ActorPose, beat: Beat, u: number) {
  const env = Math.sin(Math.PI * clamp01(u));
  const dir = beat.target ?? 'viewer';
  const lx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
  const ly = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;

  addRot(pose, actor.skeleton.head, env * lx * 9);
  addRot(pose, roleBone(actor, 'neck')?.id, env * lx * 3);
  if (actor.genome.bodyPlan === 'octopod') addRot(pose, roleBone(actor, 'head')?.id, env * lx * 6);
  if (actor.genome.bodyPlan === 'blob') addRot(pose, roleBone(actor, 'head')?.id, env * lx * 4);

  pose.face.lookX += env * lx * 2.2;
  pose.face.lookY += env * ly * 1.8;
}

function actionGreet(actor: Actor, pose: ActorPose, beat: Beat, u: number) {
  const env = envelope(u, 0.18, 0.82);
  const intensity = beat.intensity ?? 1;
  const plan = actor.genome.bodyPlan;

  if (plan === 'biped') {
    const arm = chainOf(actor, 'armR') ?? chainOf(actor, 'armL');
    const sign = armSign(arm);
    if (arm) {
      addRot(pose, arm[0]?.id, sign * (env * 145 * intensity + env * 4 * Math.sin(u * 6 * Math.PI)));
      addRot(
        pose,
        arm[1]?.id,
        sign * (env * 8 + env * 16 * Math.sin(u * 6 * Math.PI + 0.6)),
      );
      addRot(pose, arm[2]?.id, sign * env * 22 * Math.sin(u * 6 * Math.PI + 1.2));
    }
    addRot(pose, actor.skeleton.head, env * -3);
    pose.face.expression = 'happy';
  } else if (plan === 'octopod') {
    const fronts = chainsOf(actor, 'tentacle').slice(-3);
    fronts.forEach((chain, ci) => {
      const sign = (chain[0]?.rot ?? 0) < -90 ? -1 : 1;
      chain.forEach((b, i) => {
        const falloff = 1 - i / Math.max(1, chain.length);
        addRot(
          pose,
          b.id,
          env * intensity * sign * (i === 0 ? 55 : 24) * falloff +
            env * 5 * Math.sin(u * 7 * Math.PI + ci + i * 0.5),
        );
      });
    });
  } else if (plan === 'quadruped') {
    for (const chain of chainsOf(actor, 'tail')) {
      chain.forEach((b, i) => {
        addRot(pose, b.id, env * 10 * Math.sin(u * 7 * Math.PI + i * 0.6));
      });
    }
    addRot(pose, actor.skeleton.head, env * 6 * Math.sin(u * 4 * Math.PI));
    const front = chainOf(actor, 'legFL');
    if (front) {
      addRot(pose, front[0]?.id, env * -20);
      addRot(pose, front[1]?.id, env * 28);
    }
  } else if (plan === 'blob') {
    const arm = chainOf(actor, 'armR') ?? chainOf(actor, 'armL');
    if (arm) {
      addRot(pose, arm[0]?.id, env * 160 * intensity);
      addRot(pose, arm[1]?.id, env * 18 * Math.sin(u * 6 * Math.PI));
    }
    const body = roleBone(actor, 'head');
    addScale(pose, body?.id, 1 + 0.03 * env, 1 - 0.03 * env);
  }

  pose.face.mouth = Math.max(pose.face.mouth, env * 0.7);
  pose.face.cheek = Math.max(pose.face.cheek, env * 0.55);
}

function actionHide(actor: Actor, pose: ActorPose, beat: Beat, u: number) {
  const env = Math.min(1, u / 0.25);
  const plan = actor.genome.bodyPlan;

  if (plan === 'octopod') {
    const fronts = chainsOf(actor, 'tentacle')
      .filter((c) => (c[0]?.rot ?? 0) > -90)
      .slice(-4);
    fronts.forEach((chain) => {
      chain.forEach((b, i) => {
        const falloff = 1 - i / Math.max(1, chain.length);
        addRot(pose, b.id, env * (i === 0 ? 92 : 38) * falloff);
      });
    });
    addRot(pose, actor.skeleton.head, env * 6);
    addRoot(pose, 0, -2 * env, 0);
    pose.face.blink = Math.max(pose.face.blink, env * 0.9);
    pose.face.lookY += env * 1.2;
  } else if (plan === 'biped') {
    addRot(pose, roleBone(actor, 'spine')?.id, env * -8);
    const left = chainOf(actor, 'armL');
    const right = chainOf(actor, 'armR');
    addRot(pose, left?.[0]?.id, armSign(left) * env * 90);
    addRot(pose, left?.[1]?.id, armSign(left) * env * 45);
    addRot(pose, right?.[0]?.id, armSign(right) * env * 90);
    addRot(pose, right?.[1]?.id, armSign(right) * env * 45);
    pose.face.blink = Math.max(pose.face.blink, env * 0.7);
  } else if (plan === 'quadruped') {
    addRot(pose, roleBone(actor, 'neck')?.id, env * 10);
    addRot(pose, actor.skeleton.head, env * 8);
    pose.face.blink = Math.max(pose.face.blink, env * 0.6);
  } else if (plan === 'blob') {
    pose.root.scale *= 1 - 0.2 * env;
    const body = roleBone(actor, 'head');
    addScale(pose, body?.id, 1 - 0.04 * env, 1 - 0.09 * env);
    pose.face.blink = Math.max(pose.face.blink, env * 0.85);
  }
}

function actionPeek(actor: Actor, pose: ActorPose, beat: Beat, u: number) {
  const env = Math.sin(Math.PI * clamp01(u));
  const plan = actor.genome.bodyPlan;

  if (plan === 'octopod') {
    const front = chainsOf(actor, 'tentacle')
      .filter((c) => (c[0]?.rot ?? 0) > -90)
      .slice(-1)[0];
    if (front) {
      front.forEach((b, i) => {
        addRot(pose, b.id, env * -32 * (1 - i / Math.max(1, front.length)));
      });
    }
    addRot(pose, actor.skeleton.head, env * 4);
    pose.face.blink = Math.max(0, 0.35 - env * 0.35);
    pose.face.lookX += env * 1.8;
  } else if (plan === 'blob') {
    addRot(pose, roleBone(actor, 'eyeL')?.id, env * -25);
    pose.face.lookX += env * 1.5;
  } else {
    addRot(pose, roleBone(actor, 'spine')?.id, env * 5);
    pose.face.lookX += env * 1.5;
  }
}

function actionRear(actor: Actor, pose: ActorPose, beat: Beat, u: number) {
  const env = envelope(u, 0.2, 0.8);
  if (actor.genome.bodyPlan !== 'quadruped') {
    actionCelebrate(actor, pose, beat, u);
    return;
  }

  const body = roleBone(actor, 'spine');
  addRot(pose, body?.id, env * 18);
  addRot(pose, roleBone(actor, 'neck')?.id, env * -6);
  addRot(pose, actor.skeleton.head, env * -8);
  addRoot(pose, 0, env * 2.5, 0);

  for (const chain of chainsOf(actor, 'leg')) {
    const id = chain[0]?.id ?? '';
    if (id.includes('BL') || id.includes('BR')) {
      addRot(pose, chain[0]?.id, env * -18);
    } else {
      addRot(pose, chain[0]?.id, env * 30);
      addRot(pose, chain[1]?.id, env * 40);
    }
  }
  pose.face.mouth = Math.max(pose.face.mouth, env * 0.5);
}

function actionCelebrate(actor: Actor, pose: ActorPose, beat: Beat, u: number) {
  const env = envelope(u, 0.15, 0.8);
  const plan = actor.genome.bodyPlan;

  if (plan === 'quadruped') {
    actionRear(actor, pose, beat, u);
    return;
  }

  if (plan === 'biped') {
    for (const side of ['armL', 'armR']) {
      const arm = chainOf(actor, side);
      const sign = armSign(arm);
      addRot(pose, arm?.[0]?.id, sign * env * 115);
      addRot(pose, arm?.[1]?.id, sign * env * 15);
    }
    addRoot(pose, 0, env * 5 * Math.sin(Math.PI * clamp01(u)), 0);
  } else if (plan === 'octopod') {
    for (const chain of chainsOf(actor, 'tentacle')) {
      const sign = (chain[0]?.rot ?? 0) < -90 ? -1 : 1;
      chain.forEach((b, i) => {
        addRot(pose, b.id, env * -sign * 34 * (1 - i / Math.max(1, chain.length)));
      });
    }
    pose.root.scale *= 1 + 0.05 * env;
  } else if (plan === 'blob') {
    pose.root.scale *= 1 + 0.1 * env;
    for (const side of ['armL', 'armR']) {
      addRot(pose, chainOf(actor, side)?.[0]?.id, env * -160);
    }
  }

  pose.face.mouth = Math.max(pose.face.mouth, env * 0.9);
  pose.face.cheek = Math.max(pose.face.cheek, env * 0.7);
}

function actionNod(actor: Actor, pose: ActorPose, u: number) {
  const env = Math.sin(Math.PI * clamp01(u));
  addRot(pose, roleBone(actor, 'neck')?.id, env * 8);
  addRot(pose, actor.skeleton.head, env * 6);
  pose.face.lookY += env * 1.2;
}

function actionShake(actor: Actor, pose: ActorPose, u: number) {
  const env = Math.sin(Math.PI * clamp01(u));
  addRot(pose, actor.skeleton.head, env * 10 * Math.sin(u * 8 * Math.PI));
}

function actionJump(actor: Actor, pose: ActorPose, u: number) {
  const env = Math.sin(Math.PI * clamp01(u));
  addRoot(pose, 0, env * 10, 0);
  const body = roleBone(actor, 'spine') ?? roleBone(actor, 'head');
  addScale(pose, body?.id, 1 + 0.03 * env, 1 - 0.03 * env);
  for (const side of ['armL', 'armR']) {
    const arm = chainOf(actor, side);
    addRot(pose, arm?.[0]?.id, armSign(arm) * env * 40);
  }
  for (const side of ['legL', 'legR']) {
    addRot(pose, chainOf(actor, side)?.[0]?.id, env * 10);
    addRot(pose, chainOf(actor, side)?.[1]?.id, env * 18);
  }
  pose.face.expression = 'happy';
  pose.face.mouth = Math.max(pose.face.mouth, env * 0.5);
}

function actionReach(actor: Actor, pose: ActorPose, u: number) {
  const env = Math.sin(Math.PI * clamp01(u));
  const arm = chainOf(actor, 'armR') ?? chainOf(actor, 'armL');
  const sign = armSign(arm);
  addRot(pose, arm?.[0]?.id, sign * env * 60);
  addRot(pose, arm?.[1]?.id, sign * env * 20);
  pose.face.lookX += env * 1.5;
}

function actionSwing(actor: Actor, pose: ActorPose, beat: Beat, u: number) {
  if (actor.genome.bodyPlan !== 'biped') return;
  const racket = actor.genome.accessories.find((a) => a.kind === 'tennis-racket');
  const attach = racket?.attach ?? 'handR';
  const chainName = /L$|left/i.test(attach) ? 'armL' : 'armR';
  const arm =
    chainOf(actor, chainName) ?? chainOf(actor, 'armR') ?? chainOf(actor, 'armL');
  if (!arm) return;

  const intensity = beat.intensity ?? 1;
  const p = clamp01(u);
  const sideSign = arm[0]?.id === 'armL' ? -1 : 1;
  // Wind up for the first third, then sweep through and settle back.
  const wind = p < 0.3 ? p / 0.3 : Math.max(0, 1 - (p - 0.3) / 0.35);
  const hit = Math.sin(Math.PI * clamp01((p - 0.2) / 0.8));

  addRot(pose, arm[0]?.id, sideSign * (wind * 18 - hit * 115) * intensity);
  addRot(pose, arm[1]?.id, sideSign * (wind * 14 - hit * 25) * intensity);
  addRot(pose, arm[2]?.id, sideSign * (wind * -6 + hit * 20) * intensity);
  addRot(pose, roleBone(actor, 'spine')?.id, (hit * 8 - wind * 4) * intensity);
  pose.face.lookX += hit * 1.2 - wind * 0.4;
}

// ---------------------------------------------------------------------------
// Human action library. Every verb is procedural: rotations on the same
// 16-bone rig, so a new action never needs a new skeleton or a keyframe clip.

function targetSide(beat: Beat): -1 | 0 | 1 {
  return beat.target === 'left' ? -1 : beat.target === 'right' ? 1 : 0;
}

/** The arm chains are mirrored, so a raise is +r on the left arm and -r on the
 * right arm. Keeping this in one helper avoids one arm going up while the
 * other goes down. */
function armSign(arm: Bone[] | undefined): 1 | -1 {
  return arm?.[0]?.id === 'armL' ? 1 : -1;
}

function actionPoint(actor: Actor, pose: ActorPose, beat: Beat, u: number) {
  const env = envelope(u, 0.14, 0.86);
  const side = targetSide(beat);
  const chain =
    (side < 0 ? chainOf(actor, 'armL') : chainOf(actor, 'armR')) ??
    chainOf(actor, 'armR') ??
    chainOf(actor, 'armL');
  if (!chain) return;
  const sign = armSign(chain);
  addRot(pose, chain[0]?.id, sign * env * 82);
  addRot(pose, chain[1]?.id, sign * env * 6);
  addRot(pose, chain[2]?.id, sign * env * 5);
  addRot(pose, actor.skeleton.head, env * (side || 1) * 5);
  addRot(pose, roleBone(actor, 'spine')?.id, env * 2);
  pose.face.lookX += env * (side || 0.6) * 1.8;
  pose.face.lookY -= env * 0.7;
  pose.face.expression = 'happy';
  pose.face.mouth = Math.max(pose.face.mouth, env * 0.3);
}

function actionThink(actor: Actor, pose: ActorPose, u: number) {
  const env = envelope(u, 0.15, 0.85);
  const arm = chainOf(actor, 'armR') ?? chainOf(actor, 'armL');
  const sign = armSign(arm);
  addRot(pose, arm?.[0]?.id, sign * env * 46);
  addRot(pose, arm?.[1]?.id, sign * env * 100);
  addRot(pose, arm?.[2]?.id, sign * env * 10);
  addRot(pose, actor.skeleton.head, env * 6);
  addRot(pose, roleBone(actor, 'neck')?.id, env * 2);
  pose.face.lookX += env * 0.9;
  pose.face.lookY -= env * 1.6;
  pose.face.expression = 'thinking';
}

function actionShrug(actor: Actor, pose: ActorPose, u: number) {
  const env = envelope(u, 0.16, 0.84);
  for (const side of ['armL', 'armR']) {
    const arm = chainOf(actor, side);
    const sign = armSign(arm);
    addRot(pose, arm?.[0]?.id, sign * env * 54);
    addRot(pose, arm?.[1]?.id, sign * env * 18);
    addRot(pose, arm?.[2]?.id, sign * env * 8);
  }
  const spine = roleBone(actor, 'spine');
  addScale(pose, spine?.id, 1 + 0.01 * env, 1 + 0.035 * env);
  addRoot(pose, 0, env * 1.4, 0);
  addRot(pose, actor.skeleton.head, env * 4);
  pose.face.lookY -= env * 0.4;
  pose.face.expression = 'shy';
  pose.face.mouth = Math.max(pose.face.mouth, env * 0.15);
}

function actionClap(actor: Actor, pose: ActorPose, u: number) {
  const env = envelope(u, 0.12, 0.88);
  const beat = Math.sin(u * Math.PI * 6);
  for (const side of ['armL', 'armR']) {
    const arm = chainOf(actor, side);
    const sign = armSign(arm);
    addRot(pose, arm?.[0]?.id, sign * env * 28);
    addRot(pose, arm?.[1]?.id, -sign * env * (82 + beat * 10));
    addRot(pose, arm?.[2]?.id, -sign * env * beat * 8);
  }
  addRot(pose, actor.skeleton.head, env * beat * 1.5);
  addRoot(pose, 0, Math.abs(beat) * env * 0.5, 0);
  pose.face.expression = 'happy';
  pose.face.mouth = Math.max(pose.face.mouth, env * 0.45);
  pose.face.cheek = Math.max(pose.face.cheek, env * 0.6);
}

function actionLaugh(actor: Actor, pose: ActorPose, u: number) {
  const env = envelope(u, 0.12, 0.88);
  const bounce = Math.abs(Math.sin(u * Math.PI * 5));
  addRot(pose, actor.skeleton.head, env * -10);
  addRot(pose, roleBone(actor, 'neck')?.id, env * -3);
  addRot(pose, roleBone(actor, 'spine')?.id, env * -3);
  addScale(pose, roleBone(actor, 'spine')?.id, 1 + 0.012 * env, 1 - 0.01 * env);
  addRoot(pose, 0, bounce * env * 1.8, 0);
  for (const side of ['armL', 'armR']) {
    const arm = chainOf(actor, side);
    const sign = armSign(arm);
    addRot(pose, arm?.[0]?.id, sign * env * 24);
    addRot(pose, arm?.[1]?.id, sign * env * 8);
  }
  pose.face.expression = 'laugh';
  pose.face.mouth = Math.max(pose.face.mouth, env);
  pose.face.cheek = Math.max(pose.face.cheek, env * 0.9);
}

function actionDance(actor: Actor, pose: ActorPose, u: number) {
  const env = envelope(u, 0.08, 0.92);
  const swing = Math.sin(u * Math.PI * 4);
  const sway = Math.sin(u * Math.PI * 2);

  addRoot(pose, sway * env * 4.2, Math.abs(swing) * env * 2.2, sway * env * 3);
  addRot(pose, roleBone(actor, 'spine')?.id, swing * env * 5);
  addRot(pose, actor.skeleton.head, -swing * env * 4);

  const left = chainOf(actor, 'armL');
  const right = chainOf(actor, 'armR');
  addRot(pose, left?.[0]?.id, env * (52 + swing * 30));
  addRot(pose, left?.[1]?.id, env * (16 + swing * 8));
  addRot(pose, right?.[0]?.id, env * -(52 - swing * 30));
  addRot(pose, right?.[1]?.id, env * -(16 - swing * 8));

  const legL = chainOf(actor, 'legL');
  const legR = chainOf(actor, 'legR');
  addRot(pose, legL?.[0]?.id, env * swing * 8);
  addRot(pose, legL?.[1]?.id, env * Math.max(0, -swing) * 10);
  addRot(pose, legR?.[0]?.id, env * -swing * 8);
  addRot(pose, legR?.[1]?.id, env * Math.max(0, swing) * 10);

  pose.face.expression = 'happy';
  pose.face.mouth = Math.max(pose.face.mouth, env * 0.45);
  pose.face.cheek = Math.max(pose.face.cheek, env * 0.65);
}

function actionBow(actor: Actor, pose: ActorPose, u: number) {
  const env = envelope(u, 0.16, 0.84);
  addRot(pose, roleBone(actor, 'spine')?.id, env * 14);
  addRot(pose, roleBone(actor, 'neck')?.id, env * 5);
  addRot(pose, actor.skeleton.head, env * 15);
  addScale(pose, roleBone(actor, 'spine')?.id, 1, 1 - 0.02 * env);
  addRoot(pose, 0, -env * 1.6, 0);
  for (const side of ['armL', 'armR']) {
    const arm = chainOf(actor, side);
    addRot(pose, arm?.[0]?.id, env * 16);
    addRot(pose, arm?.[1]?.id, env * 8);
  }
  pose.face.expression = 'shy';
  pose.face.lookY += env * 1.4;
  pose.face.mouth = Math.max(pose.face.mouth, env * 0.2);
}

function actionRun(actor: Actor, pose: ActorPose, u: number) {
  const env = envelope(u, 0.1, 0.9);
  baseWalk(actor, pose, u * 1400, 380);
  addRot(pose, roleBone(actor, 'spine')?.id, env * 9);
  addRot(pose, actor.skeleton.head, env * -5);
  const swing = Math.sin(u * Math.PI * 6);
  const left = chainOf(actor, 'armL');
  const right = chainOf(actor, 'armR');
  addRot(pose, left?.[0]?.id, env * (26 + swing * 24));
  addRot(pose, left?.[1]?.id, env * (40 + swing * 12));
  addRot(pose, right?.[0]?.id, env * -(26 - swing * 24));
  addRot(pose, right?.[1]?.id, env * -(40 - swing * 12));
  pose.face.expression = 'happy';
  pose.face.mouth = Math.max(pose.face.mouth, env * 0.3);
}

function actionStretch(actor: Actor, pose: ActorPose, u: number, yawn: boolean) {
  const env = envelope(u, 0.16, 0.84);
  const left = chainOf(actor, 'armL');
  const right = chainOf(actor, 'armR');
  const leftSign = armSign(left);
  const rightSign = armSign(right);

  if (yawn) {
    addRot(pose, right?.[0]?.id, rightSign * env * 92);
    addRot(pose, right?.[1]?.id, rightSign * env * 60);
    addRot(pose, right?.[2]?.id, rightSign * env * 8);
    addRot(pose, left?.[0]?.id, leftSign * env * 120);
    addRot(pose, left?.[1]?.id, leftSign * env * 6);
    pose.face.expression = 'sleepy';
    pose.face.mouth = Math.max(pose.face.mouth, env);
    pose.face.lookY -= env * 0.8;
  } else {
    for (const arm of [left, right]) {
      const sign = armSign(arm);
      addRot(pose, arm?.[0]?.id, sign * env * 118);
      addRot(pose, arm?.[1]?.id, sign * env * 6);
      addRot(pose, arm?.[2]?.id, sign * env * 4);
    }
    pose.face.expression = 'happy';
    pose.face.mouth = Math.max(pose.face.mouth, env * 0.35);
    pose.face.cheek = Math.max(pose.face.cheek, env * 0.3);
  }

  addRot(pose, roleBone(actor, 'spine')?.id, env * -4);
  addRot(pose, roleBone(actor, 'neck')?.id, env * -3);
  addRot(pose, actor.skeleton.head, env * -8);
  addScale(pose, roleBone(actor, 'spine')?.id, 1 + 0.01 * env, 1 + 0.035 * env);
  addRoot(pose, 0, env * 2, 0);
}

function actionWink(actor: Actor, pose: ActorPose, u: number) {
  const env = envelope(u, 0.16, 0.84);
  pose.face.wink = Math.max(pose.face.wink, env);
  pose.face.expression = 'wink';
  pose.face.mouth = Math.max(pose.face.mouth, env * 0.35);
  pose.face.cheek = Math.max(pose.face.cheek, env * 0.5);
  addRot(pose, actor.skeleton.head, env * 4);
  addRot(pose, roleBone(actor, 'neck')?.id, env * 1.5);
}

function actionStir(actor: Actor, pose: ActorPose, beat: Beat, u: number) {
  const env = envelope(u, 0.14, 0.86);
  const arm = chainOf(actor, 'armR') ?? chainOf(actor, 'armL');
  const circle = u * Math.PI * 4;
  addRot(pose, arm?.[0]?.id, env * -58);
  addRot(pose, arm?.[1]?.id, env * (48 + Math.sin(circle) * 14));
  addRot(pose, arm?.[2]?.id, env * Math.cos(circle) * 12);
  addRot(pose, roleBone(actor, 'spine')?.id, env * 2);
  addRot(pose, actor.skeleton.head, env * 2);
  pose.face.lookY += env * 1.2;
  pose.face.lookX += env * (targetSide(beat) || 0.4);
  pose.face.expression = 'happy';
  pose.face.mouth = Math.max(pose.face.mouth, env * 0.3);
}

function applyAction(actor: Actor, pose: ActorPose, beat: Beat, u: number) {
  switch (beat.verb) {
    case 'look':
      actionLook(actor, pose, beat, u);
      break;
    case 'greet':
    case 'wave':
      actionGreet(actor, pose, beat, u);
      break;
    case 'swing':
      actionSwing(actor, pose, beat, u);
      break;
    case 'point':
      actionPoint(actor, pose, beat, u);
      break;
    case 'think':
      actionThink(actor, pose, u);
      break;
    case 'shrug':
      actionShrug(actor, pose, u);
      break;
    case 'clap':
      actionClap(actor, pose, u);
      break;
    case 'laugh':
      actionLaugh(actor, pose, u);
      break;
    case 'dance':
      actionDance(actor, pose, u);
      break;
    case 'bow':
      actionBow(actor, pose, u);
      break;
    case 'run':
      actionRun(actor, pose, u);
      break;
    case 'stretch':
      actionStretch(actor, pose, u, false);
      break;
    case 'yawn':
      actionStretch(actor, pose, u, true);
      break;
    case 'wink':
      actionWink(actor, pose, u);
      break;
    case 'stir':
      actionStir(actor, pose, beat, u);
      break;
    case 'hide':
      actionHide(actor, pose, beat, u);
      break;
    case 'peek':
      actionPeek(actor, pose, beat, u);
      break;
    case 'rear':
      actionRear(actor, pose, beat, u);
      break;
    case 'celebrate':
      actionCelebrate(actor, pose, beat, u);
      break;
    case 'nod':
      actionNod(actor, pose, u);
      break;
    case 'shake':
      actionShake(actor, pose, u);
      break;
    case 'jump':
      actionJump(actor, pose, u);
      break;
    case 'reach':
    case 'interact':
      actionReach(actor, pose, u);
      break;
    case 'move':
      baseWalk(actor, pose, u * 1200, 900);
      break;
    case 'emote':
      pose.face.mouth = Math.max(pose.face.mouth, Math.sin(Math.PI * clamp01(u)) * 0.6);
      break;
    default:
      break;
  }
}

function ridePose(actor: Actor, pose: ActorPose) {
  for (const chain of chainsOf(actor, 'leg')) {
    addRot(pose, chain[0]?.id, 24);
    addRot(pose, chain[1]?.id, 38);
    addRot(pose, chain[2]?.id, -14);
  }
  addRot(pose, roleBone(actor, 'spine')?.id, -3);
  const left = chainOf(actor, 'armL');
  if (left) {
    addRot(pose, left[0]?.id, -42);
    addRot(pose, left[1]?.id, 26);
    addRot(pose, left[2]?.id, 4);
  }
  addRot(pose, actor.skeleton.head, 2);
}

// ---------------------------------------------------------------------------
// public frame evaluator

export function scenePoseAt(scene: Scene, t: number): ScenePose {
  const out: ScenePose = {};

  for (const actor of scene.actors) {
    const pose = emptyPose(actor);
    if (actor.pose === 'ride') ridePose(actor, pose);

    baseIdle(actor, pose, t);

    const beats = scene.score.beats.filter((b) => b.actor === actor.id);
    for (const beat of beats) {
      if (!isBase(beat)) continue;
      if (t < beat.at || t > beat.at + beat.dur) continue;
      const u = (t - beat.at) / Math.max(1, beat.dur);
      if (beat.verb === 'walk' || beat.verb === 'trot' || beat.verb === 'gallop') {
        const speed = beat.verb === 'gallop' ? 560 : beat.verb === 'trot' ? 720 : 900;
        baseWalk(actor, pose, t - beat.at, speed);
      }
      if (beat.verb === 'move') baseWalk(actor, pose, t - beat.at, 900);
    }

    for (const beat of beats) {
      if (isBase(beat)) continue;
      if (t < beat.at || t > beat.at + beat.dur) continue;
      const u = (t - beat.at) / Math.max(1, beat.dur);
      applyAction(actor, pose, beat, u);
    }

    out[actor.id] = pose;
  }

  return out;
}

/** A quiet rest pose used for fit calculations and thumbnails. */
export function restPoseAt(scene: Scene): ScenePose {
  const out: ScenePose = {};
  for (const actor of scene.actors) {
    const pose = emptyPose(actor);
    if (actor.pose === 'ride') ridePose(actor, pose);
    out[actor.id] = pose;
  }
  return out;
}

export { clamp01, lerp };
