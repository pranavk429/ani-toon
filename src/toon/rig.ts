// Rig geometry shared by the drawing (Kid.tsx) and by anything that must touch
// the character (props that land in a hand or on a hat, a ball that meets a foot,
// water droplets leaving a held watering-can spout).
// Units: the head is 100 wide, centred on (0, 0), y grows down. Same build as
// the rossark demos (RevealScene.swift / ChefScene.swift / GardenScene.swift).

import type { ArmPose, Pose } from './types';

export const BUILD = {
  headW: 100,
  torsoTop: 50,
  torsoBottom: 112,
  shoulders: 42, // half width at the top of the torso
  waist: 38,
  hip: 22,
  hipY: 132,
  legLen: 40,
  shoeBottom: 62, // from hipY to the soles
  shadow: 140,
  shadowRatio: 0.32,
  shadowUp: 7,
} as const;

export const ARM = {
  x: 34,
  y: 66,
  w: 26,
  sleeve: 24,
  hand: 13,
  upper: 30,
  fore: 28,
  reach: 12,
} as const;

/** Soles are this far below the head centre. */
export const FLOOR_Y = BUILD.hipY + BUILD.shoeBottom;

export const STAGE = { w: 720, h: 1280 } as const;
export const FEET = { x: 360, y: 1070 } as const;
export const SCALE = 2.6;
/** Props are drawn for SCALE 1.72; this keeps them in proportion with the character. */
export const PROP_K = SCALE / 1.72;

/** Watering can geometry in its own grip frame (GardenScene.swift L97). */
export const CAN_GEOM = {
  spoutFrom: { x: 20, y: 40 },
  spoutTip: { x: 58, y: 4 },
} as const;

const rad = (d: number) => (d * Math.PI) / 180;

export type ArmGeom = {
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  hx: number;
  hy: number;
  ux: number;
  uy: number;
};

/** Shoulder, elbow and hand of one arm, in head units. side: -1 viewer's left, 1 right. */
export function armGeom(arm: ArmPose, side: -1 | 1, shift: number): ArmGeom {
  const sx = side * ARM.x + shift;
  const sy = ARM.y;
  const a = rad(arm.a);
  const f = rad(arm.a + arm.e);
  // Exact RevealScene.swift L463-468 cartoon reach when arm is raised straight
  const straight = Math.min(1, Math.max(0, 1 - Math.abs(arm.e) / 40));
  const extra = ARM.reach * Math.min(1, Math.max(0, (arm.a - 100) / 50)) * straight;
  const ex = sx + side * Math.sin(a) * ARM.upper;
  const ey = sy + Math.cos(a) * ARM.upper;
  const ux = side * Math.sin(f);
  const uy = Math.cos(f);
  const hx = ex + ux * (ARM.fore + extra);
  const hy = ey + uy * (ARM.fore + extra);
  return { sx, sy, ex, ey, hx, hy, ux, uy };
}

/**
 * Two-segment inverse kinematics for the right arm (ChefScene.swift L442-457):
 * Given a target point in screen coordinates, returns the ArmPose (a, e) that
 * places the right hand on the target with the elbow out.
 */
export function solveArmIK(p: Pose, screenX: number, screenY: number, side: -1 | 1 = 1): ArmPose {
  const target = fromScreen(p, screenX, screenY);
  const fx = side * ARM.x + p.shift;
  const fy = ARM.y;
  const dx = (target.x - fx) * side;
  const dy = target.y - fy;
  const l1 = ARM.upper;
  const l2 = ARM.fore;
  const dist = Math.max(0.001, Math.hypot(dx, dy));
  const d = Math.min(l1 + l2 - 0.5, Math.max(Math.abs(l1 - l2) + 0.5, dist));
  const tx = (dx / dist) * d;
  const ty = (dy / dist) * d;
  const phi = Math.atan2(tx, ty);
  const cosAlpha = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  const alpha = Math.acos(cosAlpha);
  const a = phi + alpha;
  const f = Math.atan2(tx - Math.sin(a) * l1, ty - Math.cos(a) * l1);
  return { a: (a * 180) / Math.PI, e: ((f - a) * 180) / Math.PI };
}

export type LegGeom = { hx: number; hy: number; fx: number; fy: number };

/** Hip to foot. The feet stay planted when the hips shift, so the leg angle changes. */
export function legGeom(angle: number, side: -1 | 1, shift: number, float: number, pedal: number): LegGeom {
  const hx = side * BUILD.hip + shift;
  const hy = BUILD.hipY;
  const tuck = float * 8 * (0.5 + 0.5 * side * pedal);
  const a = rad(-side * angle + shift);
  const len = 46 - tuck;
  const fx = hx - Math.sin(a) * len;
  const fy = hy + Math.cos(a) * len;
  return { hx, hy, fx, fy };
}

/** Head-unit point to screen, through the same transform the SVG group applies. */
export function toScreen(p: Pose, x: number, y: number): { x: number; y: number } {
  const ux = x * p.sx;
  const uy = (y - FLOOR_Y) * p.sy;
  const th = rad(p.lean);
  const rx = ux * Math.cos(th) - uy * Math.sin(th);
  const ry = ux * Math.sin(th) + uy * Math.cos(th);
  return { x: FEET.x + rx * SCALE, y: FEET.y - p.lift * SCALE + ry * SCALE };
}

/** Screen point back to head-unit coordinates (inverse of toScreen). */
export function fromScreen(p: Pose, sx: number, sy: number): { x: number; y: number } {
  const rx = (sx - FEET.x) / SCALE;
  const ry = (sy - (FEET.y - p.lift * SCALE)) / SCALE;
  const th = -rad(p.lean);
  const ux = rx * Math.cos(th) - ry * Math.sin(th);
  const uy = rx * Math.sin(th) + ry * Math.cos(th);
  return { x: ux / p.sx, y: uy / p.sy + FLOOR_Y };
}

/** Transform a point inside the head's frame (pivoting at collar y=56) to screen. */
export function headToScreen(p: Pose, hx: number, hy: number): { x: number; y: number } {
  const th = rad(p.head);
  const dy = hy - 56;
  const rx = hx * Math.cos(th) - dy * Math.sin(th);
  const ry = hx * Math.sin(th) + dy * Math.cos(th);
  return toScreen(p, p.shift + rx, 56 + p.headDy + ry);
}

/**
 * Top of the chef's hat on stage (ChefScene.swift L327-332 `onHat`),
 * including hat squash `hatSy` and wobble `hatTilt` around band edge y=-44.
 */
export function hatTopScreen(p: Pose, along = 0): { x: number; y: number; rot: number } {
  const hatSx = 1 / Math.pow(Math.max(0.5, p.hatSy), 0.6);
  const sx = along * hatSx;
  const sy = (-178 - -44) * p.hatSy;
  const th = rad(p.hatTilt);
  const hx = sx * Math.cos(th) - sy * Math.sin(th);
  const hy = -44 + sx * Math.sin(th) + sy * Math.cos(th);
  const pt = headToScreen(p, hx, hy);
  return { x: pt.x, y: pt.y, rot: p.hatTilt + p.head + p.lean };
}

/**
 * Where the watering-can rose is on screen and which direction water leaves it (radians).
 * Ported from GardenScene.swift L263-269.
 */
export function canRoseScreen(p: Pose): { x: number; y: number; dir: number } {
  const g = armGeom(p.armR, 1, p.shift);
  const rotDeg = p.tilt - p.lean;
  const th = rad(rotDeg);
  const rx = CAN_GEOM.spoutTip.x * Math.cos(th) - CAN_GEOM.spoutTip.y * Math.sin(th);
  const ry = CAN_GEOM.spoutTip.x * Math.sin(th) + CAN_GEOM.spoutTip.y * Math.cos(th);
  const pt = toScreen(p, g.hx + rx, g.hy + ry);
  const baseDir = Math.atan2(
    CAN_GEOM.spoutTip.y - CAN_GEOM.spoutFrom.y,
    CAN_GEOM.spoutTip.x - CAN_GEOM.spoutFrom.x,
  );
  return { x: pt.x, y: pt.y, dir: baseDir + rad(p.tilt) };
}

export function handScreen(p: Pose, side: -1 | 1) {
  const g = armGeom(side === 1 ? p.armR : p.armL, side, p.shift);
  return toScreen(p, g.hx, g.hy);
}

export function footScreen(p: Pose, side: -1 | 1) {
  const g = legGeom(side === 1 ? p.legR : p.legL, side, p.shift, p.float, p.pedal);
  return toScreen(p, g.fx, g.fy);
}
