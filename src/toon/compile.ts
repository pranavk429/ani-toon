/* eslint-disable @typescript-eslint/no-explicit-any */
// Spec -> motion. A beat is a verb from a fixed vocabulary; each verb writes key
// poses into channel tracks. Every channel is then read with `flow` (never stops
// at a key), and layered with idle life, follow-through and squash that keeps
// its volume. The Director can choose and time verbs, but cannot make ugly motion.

import { bell, clamp, flow, seg, seeded, track, wave, EASE_OUT, type Keys } from '../motion/engine';
import {
  FEET,
  FLOOR_Y,
  PROP_K,
  SCALE,
  footScreen,
  handScreen,
  hatTopScreen,
  solveArmIK,
} from './rig';
import type { BeatSpec, CharacterSpec, Pose, SceneSpec, Verb } from './types';

type Ch =
  | 'lean'
  | 'shift'
  | 'yaw'
  | 'head'
  | 'headDy'
  | 'sy'
  | 'aRa'
  | 'aRe'
  | 'aLa'
  | 'aLe'
  | 'kick'
  | 'toe'
  | 'lookX'
  | 'lookY'
  | 'cheek'
  | 'mouth'
  | 'mouthW'
  | 'brow'
  | 'smug'
  | 'widen'
  | 'tilt'
  | 'panX'
  | 'panY'
  | 'panRoll';

type KV = [number, number];
type Tracks = Record<Ch, KV[]>;

const REST: Record<Ch, number> = {
  lean: 0,
  shift: 0,
  yaw: 0,
  head: 0,
  headDy: 0,
  sy: 1,
  aRa: 12,
  aRe: 0,
  aLa: 12,
  aLe: 0,
  kick: 0,
  toe: 0,
  lookX: 0,
  lookY: 0,
  cheek: 0,
  mouth: 11,
  mouthW: 33,
  brow: 0,
  smug: 0,
  widen: 0,
  tilt: 0,
  panX: 350,
  panY: 790,
  panRoll: 0,
};

export type Bump = { t0: number; t1: number; amp: number };
export type Drop = { t0: number; t1: number; t2: number; hover: number; top: number };
export type MysterySpan = { t0: number; t1: number; swirlAt: number };
export type HatCatchPlan = {
  toss: number;
  onHat: number;
  slide: number;
  drop: number;
  catchAt: number;
};
export type PourPlan = { t0: number; t1: number };
export type BloomPlan = {
  growStart: number;
  bud: number;
  bloom: number;
  enter: number;
  land: number;
  hop: number;
  hopEnd: number;
  takeoff: number;
  gone: number;
  wilt: number;
};

export type StarCatchPlan = {
  streakStart: number;
  catchAt: number;
  t0: number;
  t1: number;
};

export type PropPlan =
  | { type: 'kick'; contact: number; enter: number }
  | { type: 'tennis-shot'; contact: number; enter: number }
  | { type: 'toss'; launch: number; land: number }
  | ({ type: 'hat-catch' } & HatCatchPlan)
  | ({ type: 'star-catch' } & StarCatchPlan);

export type Compiled = {
  spec: SceneSpec;
  tracks: Tracks;
  lid: Keys;
  lidR: Keys;
  bumps: Bump[];
  drops: Drop[];
  mysteries: MysterySpan[];
  pours: PourPlan[];
  blooms: BloomPlan[];
  starCatches: StarCatchPlan[];
  waves: Array<[number, number]>;
  shrugs: Array<[number, number]>;
  props: PropPlan[];
  /** when the character first exists (a drop-in or mystery hides it before) */
  appearAt: number;
  warnings: string[];
};

// ---------------------------------------------------------------------------
// validation: a Director's JSON is untrusted. Clamp, default, drop, warn.

const HEX = /^#[0-9a-fA-F]{6}$/;
const hex = (v: unknown, d: string) => (typeof v === 'string' && HEX.test(v) ? v : d);
const oneOf = <T extends string>(v: unknown, all: readonly T[], d: T): T =>
  typeof v === 'string' && (all as readonly string[]).includes(v) ? (v as T) : d;
const num = (v: unknown, lo: number, hi: number, d: number) =>
  typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : d;

const VERBS: readonly Verb[] = [
  'mystery',
  'drop-in',
  'wave',
  'kick',
  'toss',
  'hat-catch',
  'pour',
  'bloom',
  'cheer',
  'hop',
  'look',
  'nod',
  'shrug',
  'hip',
  'point',
  'wink',
  'peer',
  'gasp',
  'star-catch',
  'hug',
  'tennis-shot',
  'swing',
];

const DEFAULT_DUR: Record<Verb, number> = {
  mystery: 1800,
  'drop-in': 1100,
  wave: 1800,
  kick: 900,
  toss: 1800,
  'hat-catch': 3200,
  pour: 1600,
  bloom: 5200,
  cheer: 1500,
  hop: 760,
  look: 1200,
  nod: 900,
  shrug: 1000,
  hip: 1800,
  point: 1400,
  wink: 700,
  peer: 1800,
  gasp: 1200,
  'star-catch': 2600,
  hug: 1800,
  'tennis-shot': 1200,
  swing: 1200,
};

/** The time window a beat owns. Beats may not overlap. */
function span(b: { at: number; verb: Verb; dur: number }): [number, number] {
  if (b.verb === 'kick' || b.verb === 'tennis-shot' || b.verb === 'swing') return [b.at - 200, b.at + b.dur];
  if (b.verb === 'drop-in') return [b.at, b.at + b.dur + 200];
  if (b.verb === 'hat-catch') return [b.at, b.at + b.dur + 200];
  return [b.at, b.at + b.dur];
}

export function validate(raw: unknown): { spec: SceneSpec; warnings: string[] } {
  const w: string[] = [];
  const r = (raw ?? {}) as Record<string, any>;
  const c = (r.character ?? {}) as Record<string, any>;
  const world = (r.world ?? {}) as Record<string, any>;
  const prop = (r.prop ?? {}) as Record<string, any>;

  const character: CharacterSpec = {
    name: typeof c.name === 'string' ? c.name.slice(0, 24) : 'Friend',
    skin: hex(c.skin, '#F5B092'),
    hair: hex(c.hair, '#4A2C1C'),
    hairStyle: oneOf(c.hairStyle, ['quiff', 'short', 'bun', 'long', 'bald', 'curly'] as const, 'short'),
    accessory: oneOf(
      c.accessory,
      [
        'none',
        'chef-hat',
        'sun-hat',
        'beanie',
        'cap',
        'glasses',
        'headband',
        'mustache',
        'cat-ears',
        'bear-ears',
        'bunny-ears',
        'antenna',
        'horns',
      ] as const,
      'none',
    ),
    accessoryColor: hex(c.accessoryColor, '#FFFFFF'),
    top: hex(c.top, '#FF4B4B'),
    topShade: hex(c.topShade, '#EA2B2B'),
    bottom: hex(c.bottom, '#1453A3'),
    shoe: hex(c.shoe, '#33333B'),
    pattern: oneOf(c.pattern, ['none', 'stripes', 'badge', 'apron', 'overalls', 'chef', 'tennis'] as const, 'none'),
  };

  const duration = num(r.duration, 5000, 14000, 9600);
  const beats: BeatSpec[] = [];
  const list = Array.isArray(r.beats) ? r.beats.slice(0, 20) : [];
  const taken: Array<[number, number]> = [];
  for (const rawBeat of list.sort((a: any, b: any) => (a?.at ?? 0) - (b?.at ?? 0))) {
    const verb = oneOf(rawBeat?.verb, VERBS, 'look');
    if (!VERBS.includes(rawBeat?.verb)) {
      w.push(`unknown verb "${String(rawBeat?.verb)}" dropped`);
      continue;
    }
    const dur = num(rawBeat.dur, 400, 7200, DEFAULT_DUR[verb]);
    const at = num(rawBeat.at, 0, duration - 400, 0);
    const [s0, s1] = span({ at, verb, dur });
    if (s1 > duration) {
      w.push(`${verb}@${at} runs past the loop, dropped`);
      continue;
    }
    if (taken.some(([a, b]) => s0 < b && s1 > a)) {
      w.push(`${verb}@${at} overlaps another beat, dropped`);
      continue;
    }
    taken.push([s0, s1]);
    beats.push({
      at,
      verb,
      dur,
      target: oneOf(rawBeat.target, ['viewer', 'left', 'right', 'up', 'down', 'prop'] as const, 'viewer'),
    });
  }

  let kind = oneOf(
    prop.kind,
    ['none', 'ball', 'pancake', 'watering-can', 'gift', 'star', 'jar', 'cup', 'heart', 'racket'] as const,
    'none',
  );
  if (beats.some((b) => b.verb === 'star-catch' || b.verb === 'hug') && (kind === 'none' || kind === 'cup')) {
    kind = 'star';
  }
  if ((beats.some((b) => b.verb === 'kick') || beats.some((b) => b.verb === 'tennis-shot' || b.verb === 'swing')) && kind !== 'ball') {
    kind = 'ball';
  }
  if (beats.some((b) => b.verb === 'hat-catch')) {
    kind = 'pancake';
    if (character.accessory === 'none') character.accessory = 'chef-hat';
  }
  if (beats.some((b) => b.verb === 'toss') && (kind === 'none' || kind === 'ball' || kind === 'watering-can')) {
    w.push('toss needs a tossable prop; set to pancake');
    kind = 'pancake';
  }
  if (beats.some((b) => b.verb === 'pour' || b.verb === 'bloom') && kind === 'none') {
    kind = 'watering-can';
  }

  return {
    spec: {
      title: typeof r.title === 'string' ? r.title.slice(0, 60) : 'Untitled',
      duration,
      character,
      world: {
        preset: oneOf(world.preset, ['sky', 'garden', 'kitchen', 'night', 'studio'] as const, 'sky'),
        accent: hex(world.accent, '#4B63FF'),
      },
      prop: { kind, color: hex(prop.color, '#F8CB69') },
      beats,
    },
    warnings: w,
  };
}

// ---------------------------------------------------------------------------
// compile

export function compile(rawSpec: unknown): Compiled {
  const { spec, warnings } = validate(rawSpec);
  const D = spec.duration;
  const T = Object.fromEntries((Object.keys(REST) as Ch[]).map((k) => [k, [] as KV[]])) as Tracks;
  const bumps: Bump[] = [];
  const drops: Drop[] = [];
  const mysteries: MysterySpan[] = [];
  const pours: PourPlan[] = [];
  const blooms: BloomPlan[] = [];
  const starCatches: StarCatchPlan[] = [];
  const waves: Array<[number, number]> = [];
  const shrugs: Array<[number, number]> = [];
  const props: PropPlan[] = [];
  const blinkAt: number[] = [];
  const winks: number[] = [];
  const K = (ch: Ch, rel: number, pairs: KV[]) => {
    for (const [dt, v] of pairs) T[ch].push([rel + dt, v]);
  };

  for (const b of spec.beats) {
    const at = b.at;
    const dur = b.dur ?? DEFAULT_DUR[b.verb];
    switch (b.verb) {
      case 'mystery': {
        mysteries.push({ t0: at, t1: at + dur, swirlAt: at + Math.min(900, dur * 0.5) });
        break;
      }
      case 'drop-in': {
        const land = at + dur;
        const fall = land - 300;
        drops.push({ t0: at, t1: fall, t2: land, hover: 104, top: 116 });
        // If there wasn't an explicit mystery beat before a late drop-in, add the RevealScene mystery silhouette automatically
        if (at >= 1600 && mysteries.length === 0) {
          mysteries.push({ t0: 360, t1: at - 60, swirlAt: Math.max(900, at - 1100) });
        }
        K('aRa', 0, [
          [at, 110],
          [fall, 135],
          [land - 100, 150],
          [land, 92],
          [land + 90, 84],
          [land + 240, 70],
          [land + 700, 12],
        ]);
        K('aLa', 0, [
          [at, 110],
          [fall, 130],
          [land - 100, 148],
          [land, 90],
          [land + 90, 80],
          [land + 260, 66],
          [land + 700, 12],
        ]);
        K('aRe', 0, [
          [at, 0],
          [land, 0],
          [land + 240, 12],
          [land + 700, 0],
        ]);
        K('aLe', 0, [
          [at, 0],
          [land, 0],
          [land + 240, 10],
          [land + 700, 0],
        ]);
        K('sy', 0, [
          [at, 1],
          [fall + 60, 1.06],
          [land - 80, 1.1],
          [land, 1.06],
          [land + 60, 0.8],
          [land + 160, 1.03],
          [land + 300, 1],
        ]);
        K('head', 0, [
          [at, -4],
          [land, 0],
        ]);
        K('lookY', 0, [
          [at, -3],
          [land, -3],
          [land + 350, 0],
        ]);
        K('mouth', 0, [
          [at, 22],
          [land, 22],
          [land + 240, 16],
          [land + 600, 11],
        ]);
        K('lean', 0, [
          [at, 0],
          [fall, -2],
          [land, 0],
        ]);
        break;
      }
      case 'wave': {
        waves.push([at + 300, at + dur - 300]);
        K('aRa', at, [
          [0, 12],
          [260, 62],
          [dur - 300, 62],
          [dur, 12],
        ]);
        K('aRe', at, [
          [0, 0],
          [260, 108],
          [dur - 300, 108],
          [dur, 0],
        ]);
        K('aLa', at, [
          [0, 12],
          [320, 22],
          [dur, 12],
        ]);
        K('head', at, [
          [0, 0],
          [250, 6],
          [dur - 250, 4],
          [dur, 0],
        ]);
        K('yaw', at, [
          [0, 0],
          [300, 0.12],
          [dur, 0],
        ]);
        K('cheek', at, [
          [0, 0],
          [350, 1],
          [dur - 350, 1],
          [dur - 80, 0],
        ]);
        K('mouth', at, [
          [0, 11],
          [260, 22],
          [dur - 300, 22],
          [dur, 11],
        ]);
        blinkAt.push(at + 90);
        break;
      }
      case 'cheer': {
        K('aRa', at, [
          [0, 12],
          [260, 150],
          [dur - 400, 146],
          [dur, 12],
        ]);
        K('aLa', at, [
          [0, 12],
          [300, 146],
          [dur - 380, 150],
          [dur, 12],
        ]);
        K('aRe', at, [
          [0, 0],
          [260, 0],
          [dur - 400, 6],
          [dur, 0],
        ]);
        K('aLe', at, [
          [0, 0],
          [300, 6],
          [dur - 380, 0],
          [dur, 0],
        ]);
        bumps.push({ t0: at + 220, t1: at + 640, amp: 26 });
        K('sy', at, [
          [0, 1],
          [110, 0.9],
          [270, 1.08],
          [560, 1.03],
          [680, 0.88],
          [780, 1.03],
          [960, 1],
        ]);
        K('cheek', at, [
          [0, 0],
          [380, 1],
          [dur - 250, 1],
          [dur, 0],
        ]);
        K('mouth', at, [
          [0, 11],
          [250, 22],
          [dur - 250, 22],
          [dur, 11],
        ]);
        K('head', at, [
          [0, 0],
          [300, -4],
          [dur, 0],
        ]);
        break;
      }
      case 'hop': {
        bumps.push({ t0: at + 130, t1: at + 530, amp: 28 });
        K('sy', at, [
          [0, 1],
          [120, 0.9],
          [210, 1.08],
          [500, 1.02],
          [570, 0.88],
          [680, 1.03],
          [dur + 120, 1],
        ]);
        K('aRa', at, [
          [0, 12],
          [150, 12],
          [330, 42],
          [600, 20],
          [dur, 12],
        ]);
        K('aLa', at, [
          [0, 12],
          [180, 12],
          [360, 48],
          [640, 18],
          [dur, 12],
        ]);
        K('cheek', at, [
          [0, 0],
          [200, 1],
          [dur - 100, 0],
        ]);
        K('mouth', at, [
          [0, 11],
          [160, 20],
          [dur - 60, 11],
        ]);
        break;
      }
      case 'look': {
        const t = b.target ?? 'viewer';
        const lx = t === 'left' ? -4 : t === 'right' || t === 'prop' ? 4 : 0;
        const ly = t === 'up' ? -5 : t === 'down' || t === 'prop' ? 3 : 0;
        const ya = t === 'left' ? -0.45 : t === 'right' || t === 'prop' ? 0.45 : 0;
        K('lookX', at, [
          [0, 0],
          [300, lx],
          [dur - 300, lx],
          [dur, 0],
        ]);
        K('lookY', at, [
          [0, 0],
          [300, ly],
          [dur - 300, ly],
          [dur, 0],
        ]);
        K('yaw', at, [
          [0, 0],
          [380, ya],
          [dur - 300, ya],
          [dur, 0],
        ]);
        K('head', at, [
          [0, 0],
          [380, -ya * 10],
          [dur - 300, -ya * 8],
          [dur, 0],
        ]);
        blinkAt.push(at + 70);
        break;
      }
      case 'nod': {
        K('head', at, [
          [0, 0],
          [220, 8],
          [470, -1],
          [dur, 0],
        ]);
        K('headDy', at, [
          [0, 0],
          [220, 5],
          [470, 0],
          [dur, 0],
        ]);
        K('lookY', at, [
          [0, 0],
          [220, 3],
          [dur, 0],
        ]);
        K('cheek', at, [
          [0, 0],
          [260, 0.7],
          [dur - 120, 0],
        ]);
        K('lean', at, [
          [0, 0],
          [220, 2],
          [dur, 0],
        ]);
        break;
      }
      case 'shrug': {
        shrugs.push([at + 200, at + dur - 200]);
        K('aRa', at, [
          [0, 12],
          [260, 48],
          [dur - 260, 46],
          [dur, 12],
        ]);
        K('aLa', at, [
          [0, 12],
          [300, 44],
          [dur - 240, 50],
          [dur, 12],
        ]);
        K('aRe', at, [
          [0, 0],
          [260, 60],
          [dur - 260, 56],
          [dur, 0],
        ]);
        K('aLe', at, [
          [0, 0],
          [300, 52],
          [dur - 240, 62],
          [dur, 0],
        ]);
        K('head', at, [
          [0, 0],
          [300, 7],
          [dur - 200, 5],
          [dur, 0],
        ]);
        K('sy', at, [
          [0, 1],
          [300, 0.97],
          [dur, 1],
        ]);
        K('mouth', at, [
          [0, 11],
          [300, 8],
          [dur, 11],
        ]);
        K('smug', at, [
          [0, 0],
          [260, 0.7],
          [dur - 200, 0.7],
          [dur, 0],
        ]);
        blinkAt.push(at + 420);
        break;
      }
      case 'hip': {
        K('aRa', at, [
          [0, 12],
          [320, 30],
          [dur - 300, 30],
          [dur, 12],
        ]);
        K('aRe', at, [
          [0, 0],
          [320, -95],
          [dur - 300, -95],
          [dur, 0],
        ]);
        K('lean', at, [
          [0, 0],
          [400, 3],
          [dur - 300, 3],
          [dur, 0],
        ]);
        K('shift', at, [
          [0, 0],
          [420, -3],
          [dur - 300, -3],
          [dur, 0],
        ]);
        K('head', at, [
          [0, 0],
          [400, -4],
          [dur, 0],
        ]);
        K('cheek', at, [
          [0, 0],
          [450, 0.5],
          [dur - 200, 0.5],
          [dur, 0],
        ]);
        break;
      }
      case 'point': {
        const left = b.target === 'left';
        const a = left ? ('aLa' as const) : ('aRa' as const);
        const e = left ? ('aLe' as const) : ('aRe' as const);
        const s = left ? -1 : 1;
        K(a, at, [
          [0, 12],
          [280, 86],
          [dur - 300, 86],
          [dur, 12],
        ]);
        K(e, at, [
          [0, 0],
          [280, 4],
          [dur - 300, 4],
          [dur, 0],
        ]);
        K('yaw', at, [
          [0, 0],
          [320, 0.4 * s],
          [dur - 250, 0.4 * s],
          [dur, 0],
        ]);
        K('lookX', at, [
          [0, 0],
          [260, 4 * s],
          [dur - 250, 4 * s],
          [dur, 0],
        ]);
        K('head', at, [
          [0, 0],
          [320, -4 * s],
          [dur, 0],
        ]);
        blinkAt.push(at + 60);
        break;
      }
      case 'wink': {
        winks.push(at);
        K('cheek', at, [
          [0, 0],
          [160, 0.5],
          [dur - 100, 0.5],
          [dur, 0],
        ]);
        K('mouth', at, [
          [0, 11],
          [180, 18],
          [dur, 11],
        ]);
        K('head', at, [
          [0, 0],
          [200, 5],
          [dur, 0],
        ]);
        break;
      }
      case 'peer': {
        // Nova leans into the brass telescope on the left, squints right eye shut, left hand on barrel
        K('lean', at, [
          [0, 0],
          [280, 8],
          [dur - 250, 8],
          [dur, 0],
        ]);
        K('shift', at, [
          [0, 0],
          [320, -14],
          [dur - 250, -14],
          [dur, 0],
        ]);
        K('yaw', at, [
          [0, 0],
          [250, -0.42],
          [dur - 250, -0.42],
          [dur, 0],
        ]);
        K('head', at, [
          [0, 0],
          [300, 7],
          [dur - 250, 7],
          [dur, 0],
        ]);
        K('lookX', at, [
          [0, 0],
          [200, -5],
          [dur - 200, -5],
          [dur, 0],
        ]);
        K('lookY', at, [
          [0, 0],
          [200, -3],
          [dur - 200, -3],
          [dur, 0],
        ]);
        K('aLa', at, [
          [0, 12],
          [350, 36],
          [dur - 250, 36],
          [dur, 12],
        ]);
        K('aLe', at, [
          [0, -4],
          [350, 74],
          [dur - 250, 74],
          [dur, -4],
        ]);
        K('mouth', at, [
          [0, 11],
          [200, 13],
          [dur - 200, 13],
          [dur, 11],
        ]);
        winks.push(at + 120);
        break;
      }
      case 'gasp': {
        // Spots bright streak in the night sky! Pulls back in wonder, eyes wide, mouth open
        K('lean', at, [
          [0, 0],
          [220, -6],
          [dur - 200, -5],
          [dur, 0],
        ]);
        K('shift', at, [
          [0, 0],
          [200, 2],
          [dur - 200, 1],
          [dur, 0],
        ]);
        K('head', at, [
          [0, 0],
          [220, -16],
          [dur - 200, -16],
          [dur, 0],
        ]);
        K('lookY', at, [
          [0, 0],
          [180, -6],
          [dur - 150, -6],
          [dur, 0],
        ]);
        K('widen', at, [
          [0, 0],
          [160, 1],
          [dur - 180, 1],
          [dur, 0],
        ]);
        K('brow', at, [
          [0, 0],
          [160, 1],
          [dur - 180, 1],
          [dur, 0],
        ]);
        K('mouth', at, [
          [0, 11],
          [180, 26],
          [dur - 150, 26],
          [dur, 11],
        ]);
        K('aLa', at, [
          [0, 12],
          [240, 26],
          [dur - 200, 26],
          [dur, 12],
        ]);
        K('aLe', at, [
          [0, -4],
          [240, 48],
          [dur - 200, 48],
          [dur, -4],
        ]);
        K('aRa', at, [
          [0, 12],
          [240, 26],
          [dur - 200, 26],
          [dur, 12],
        ]);
        K('aRe', at, [
          [0, -4],
          [240, 48],
          [dur - 200, 48],
          [dur, -4],
        ]);
        break;
      }
      case 'star-catch': {
        const streakStart = at + 150;
        const catchAt = at + Math.min(1450, dur - 600);
        starCatches.push({ streakStart, catchAt, t0: at, t1: at + dur });
        props.push({ type: 'star-catch', streakStart, catchAt, t0: at, t1: at + dur });

        // Arms raise holding the glass jar upward
        K('aLa', at, [
          [0, 12],
          [350, 42],
          [catchAt - at, 42],
          [catchAt - at + 180, 38],
          [dur, 34],
        ]);
        K('aLe', at, [
          [0, -4],
          [350, 84],
          [catchAt - at, 84],
          [catchAt - at + 180, 80],
          [dur, 76],
        ]);
        K('aRa', at, [
          [0, 12],
          [350, 42],
          [catchAt - at, 42],
          [catchAt - at + 180, 38],
          [dur, 34],
        ]);
        K('aRe', at, [
          [0, -4],
          [350, 84],
          [catchAt - at, 84],
          [catchAt - at + 180, 80],
          [dur, 76],
        ]);

        // Head tracks the star falling from top-right down into jar
        K('head', at, [
          [0, -14],
          [catchAt - at - 400, -10],
          [catchAt - at, 4],
          [catchAt - at + 300, 0],
          [dur, 0],
        ]);
        K('lookX', at, [
          [0, 4],
          [catchAt - at - 400, 2],
          [catchAt - at, 0],
          [dur, 0],
        ]);
        K('lookY', at, [
          [0, -6],
          [catchAt - at - 400, -4],
          [catchAt - at, 3],
          [dur, 0],
        ]);

        // Landing squash upon catch
        K('sy', at, [
          [0, 1],
          [catchAt - at - 50, 1],
          [catchAt - at + 80, 0.90],
          [catchAt - at + 240, 1.04],
          [catchAt - at + 400, 1.0],
          [dur, 1],
        ]);
        K('mouth', at, [
          [0, 11],
          [catchAt - at, 18],
          [catchAt - at + 200, 24],
          [dur, 16],
        ]);
        K('cheek', at, [
          [catchAt - at, 0.2],
          [catchAt - at + 300, 0.8],
          [dur, 0.6],
        ]);
        break;
      }
      case 'hug': {
        // Nova holds the glowing jar close to chest, eyes softly closed, smiling
        K('head', at, [
          [0, 0],
          [280, 6],
          [dur - 200, 6],
          [dur, 0],
        ]);
        K('tilt', at, [
          [0, 0],
          [300, -7],
          [dur - 200, -7],
          [dur, 0],
        ]);
        K('aLa', at, [
          [0, 34],
          [300, 26],
          [dur - 200, 26],
          [dur, 34],
        ]);
        K('aLe', at, [
          [0, 76],
          [300, 102],
          [dur - 200, 102],
          [dur, 76],
        ]);
        K('aRa', at, [
          [0, 34],
          [300, 26],
          [dur - 200, 26],
          [dur, 34],
        ]);
        K('aRe', at, [
          [0, 76],
          [300, 102],
          [dur - 200, 102],
          [dur, 76],
        ]);
        K('mouth', at, [
          [0, 16],
          [250, 12],
          [dur - 200, 12],
          [dur, 14],
        ]);
        K('cheek', at, [
          [0, 0.6],
          [250, 0.8],
          [dur - 200, 0.8],
          [dur, 0.4],
        ]);
        K('sy', at, [
          [0, 1],
          [300, 1.02],
          [dur - 200, 1.02],
          [dur, 1],
        ]);
        K('widen', at, [
          [0, 0],
          [200, 0],
          [dur, 0],
        ]);
        break;
      }
      case 'tennis-shot':
      case 'swing': {
        const c = at;
        props.push({ type: 'tennis-shot', contact: c, enter: c - 1100 });
        K('lookX', 0, [
          [c - 1100, 0],
          [c - 850, 5],
          [c - 200, 3],
          [c, 1],
          [c + 100, 5],
          [c + 500, 6],
          [c + 800, 0],
        ]);
        K('lookY', 0, [
          [c - 1100, 0],
          [c - 600, -1],
          [c - 150, 2],
          [c, 1],
          [c + 120, -2],
          [c + 450, -3],
          [c + 800, 0],
        ]);
        K('yaw', 0, [
          [c - 750, 0],
          [c - 450, 0.46],
          [c - 80, 0.18],
          [c, 0],
          [c + 140, -0.42],
          [c + 500, -0.28],
          [c + 800, 0],
        ]);
        K('head', 0, [
          [c - 750, 0],
          [c - 450, 6],
          [c, 2],
          [c + 140, -6],
          [c + 500, -3],
          [c + 800, 0],
        ]);
        K('lean', 0, [
          [c - 550, 0],
          [c - 300, -6],
          [c - 50, -2],
          [c, 5],
          [c + 160, 7],
          [c + 450, 2],
          [c + 800, 0],
        ]);
        K('shift', 0, [
          [c - 550, 0],
          [c - 300, -14],
          [c - 50, -4],
          [c, 12],
          [c + 160, 15],
          [c + 450, 4],
          [c + 800, 0],
        ]);
        K('sy', 0, [
          [c - 500, 1],
          [c - 250, 0.94],
          [c, 1.05],
          [c + 160, 1.02],
          [c + 600, 1],
        ]);
        K('aRa', 0, [
          [c - 750, 12],
          [c - 450, -26],
          [c - 120, -10],
          [c, 36],
          [c + 90, 76],
          [c + 220, 96],
          [c + 550, 84],
          [c + 850, 12],
        ]);
        K('aRe', 0, [
          [c - 750, 0],
          [c - 450, 52],
          [c - 120, 32],
          [c, 14],
          [c + 90, 56],
          [c + 220, 82],
          [c + 550, 66],
          [c + 850, 0],
        ]);
        K('aLa', 0, [
          [c - 700, 12],
          [c - 450, 44],
          [c - 100, 36],
          [c, 15],
          [c + 180, -10],
          [c + 550, 6],
          [c + 800, 12],
        ]);
        K('aLe', 0, [
          [c - 700, 0],
          [c - 450, -16],
          [c, 20],
          [c + 180, 42],
          [c + 550, 12],
          [c + 800, 0],
        ]);
        K('tilt', 0, [
          [c - 600, 0],
          [c - 350, -28],
          [c, 10],
          [c + 140, 58],
          [c + 280, 75],
          [c + 550, 36],
          [c + 800, 0],
        ]);
        K('mouth', 0, [
          [c - 400, 11],
          [c - 50, 14],
          [c, 22],
          [c + 220, 18],
          [c + 500, 12],
          [c + 800, 11],
        ]);
        blinkAt.push(c - 700);
        break;
      }
      case 'kick': {
        const c = at;
        props.push({ type: 'kick', contact: c, enter: c - 1250 });
        // Eyes and head follow the ball in from the right, then after it as it flies (RevealScene.swift L152-182).
        K('lookX', 0, [
          [c - 1250, 0],
          [c - 900, 4],
          [c - 250, 3],
          [c + 150, 5],
          [c + 600, 4],
          [c + 800, 0],
        ]);
        K('lookY', 0, [
          [c - 1250, 0],
          [c - 900, 3],
          [c - 250, 4],
          [c + 80, 0],
          [c + 300, -5],
          [c + 800, 0],
        ]);
        K('yaw', 0, [
          [c - 700, 0],
          [c - 450, 0.45],
          [c, 0.3],
          [c + 150, 0.55],
          [c + 650, 0.5],
          [c + 800, 0],
        ]);
        K('head', 0, [
          [c - 700, 0],
          [c - 450, 6],
          [c, 3],
          [c + 150, -6],
          [c + 650, -4],
          [c + 800, 0],
        ]);
        K('lean', 0, [
          [c - 450, 0],
          [c - 250, -4],
          [c, -9],
          [c + 200, -5],
          [c + 500, 0],
        ]);
        K('shift', 0, [
          [c - 450, 0],
          [c - 250, -10],
          [c, -8],
          [c + 400, 0],
        ]);
        K('kick', 0, [
          [c - 450, 0],
          [c - 250, -20],
          [c - 50, -2],
          [c, 22],
          [c + 60, 58],
          [c + 150, 52],
          [c + 400, 0],
        ]);
        K('toe', 0, [
          [c - 450, 0],
          [c - 150, 0],
          [c, 40],
          [c + 150, 35],
          [c + 400, 0],
        ]);
        K('aRa', 0, [
          [c - 450, 12],
          [c - 250, 22],
          [c - 50, 40],
          [c, 18],
          [c + 150, 30],
          [c + 600, 12],
        ]);
        K('aLa', 0, [
          [c - 450, 12],
          [c - 250, 30],
          [c - 50, 55],
          [c, 85],
          [c + 150, 60],
          [c + 600, 12],
        ]);
        K('mouth', 0, [
          [c - 450, 11],
          [c, 16],
          [c + 300, 20],
          [c + 700, 11],
        ]);
        blinkAt.push(c - 650);
        break;
      }
      case 'toss': {
        const L = at + 250;
        const C = at + dur - 220;
        props.push({ type: 'toss', launch: L, land: C });
        // Pan trajectory & acting from ChefScene.swift L152-222 (toss1..catch1)
        K('panX', at, [
          [0, 350],
          [150, 344],
          [250, 352],
          [dur - 220, 354],
          [dur, 350],
        ]);
        K('panY', at, [
          [0, 790],
          [150, 800],
          [250, 745],
          [500, 736],
          [dur - 220, 760],
          [dur - 100, 786],
          [dur, 790],
        ]);
        K('panRoll', at, [
          [0, 0],
          [150, -6],
          [250, 10],
          [400, 4],
          [dur - 220, 0],
          [dur - 150, -4],
          [dur, 0],
        ]);
        K('aRa', at, [
          [0, 72],
          [130, 62],
          [230, 56],
          [260, 100],
          [520, 92],
          [dur - 420, 84],
          [dur - 260, 80],
          [dur - 120, 66],
          [dur, 72],
        ]);
        K('aRe', at, [
          [0, -64],
          [130, -70],
          [230, -76],
          [260, -30],
          [520, -40],
          [dur - 420, -50],
          [dur - 260, -58],
          [dur - 120, -72],
          [dur, -64],
        ]);
        K('aLa', at, [
          [0, 35],
          [150, 45],
          [280, 62],
          [600, 55],
          [dur - 220, 48],
          [dur, 35],
        ]);
        K('aLe', at, [
          [0, -25],
          [150, -10],
          [280, 20],
          [600, 25],
          [dur - 220, 40],
          [dur - 80, 90],
          [dur, -25],
        ]);
        K('sy', at, [
          [0, 1],
          [160, 0.94],
          [280, 1.05],
          [550, 1.01],
          [dur - 220, 1],
          [dur - 120, 0.95],
          [dur, 1],
        ]);
        const peak = (L + C) / 2;
        K('lookY', at, [
          [0, 2],
          [250, 0],
          [peak - at, -6],
          [dur - 220, 2],
          [dur, 0],
        ]);
        K('head', at, [
          [0, 0],
          [150, 3],
          [peak - at, -8],
          [dur - 220, 4],
          [dur, 0],
        ]);
        K('brow', at, [
          [0, 0],
          [150, -0.4],
          [peak - at, 0.8],
          [dur - 220, 0.3],
          [dur, 0],
        ]);
        K('widen', at, [
          [0, 0],
          [250, 0],
          [peak - at, 0.45],
          [dur - 220, 0],
          [dur, 0],
        ]);
        K('cheek', at, [
          [0, 0],
          [dur - 250, 0],
          [dur - 100, 0.9],
          [dur + 100, 0],
        ]);
        K('mouth', at, [
          [0, 11],
          [150, 7],
          [peak - at, 18],
          [dur - 160, 16],
          [dur, 11],
        ]);
        blinkAt.push(at + 60);
        break;
      }
      case 'hat-catch': {
        // Ported from ChefScene.swift L152-222 (toss2 -> onHat -> slide -> drop -> catch2 + smug shrug)
        const toss = at + 250;
        const onHat = at + 1150;
        const slide = at + 1850;
        const drop = at + 2250;
        const catchAt = at + Math.max(2650, dur - 450);
        props.push({ type: 'hat-catch', toss, onHat, slide, drop, catchAt });
        shrugs.push([catchAt + 150, at + dur]);

        K('panX', 0, [
          [at, 350],
          [at + 150, 342],
          [toss, 352],
          [onHat, 352],
          [slide, 352],
          [drop - 100, 372],
          [catchAt, 382],
          [catchAt + 250, 378],
          [at + dur, 350],
        ]);
        K('panY', 0, [
          [at, 790],
          [at + 150, 802],
          [toss, 710],
          [onHat, 756],
          [slide, 762],
          [drop - 100, 738],
          [catchAt - 100, 725],
          [catchAt, 736],
          [catchAt + 150, 762],
          [at + dur, 790],
        ]);
        K('panRoll', 0, [
          [at, 0],
          [at + 150, -9],
          [toss, 14],
          [onHat, 0],
          [catchAt - 120, -3],
          [catchAt, 0],
          [catchAt + 60, -6],
          [catchAt + 250, 0],
          [at + dur, 0],
        ]);
        K('sy', 0, [
          [at, 1],
          [at + 150, 0.91],
          [toss + 50, 1.08],
          [onHat - 100, 1.03],
          [onHat + 60, 0.93],
          [onHat + 250, 0.98],
          [drop, 0.98],
          [drop + 100, 1.02],
          [catchAt, 1],
          [catchAt + 90, 0.94],
          [catchAt + 230, 1.02],
          [at + dur, 1],
        ]);
        K('lean', 0, [
          [at, 0],
          [at + 150, 4],
          [toss + 50, -5],
          [onHat, -2],
          [slide, 0],
          [drop, 6],
          [catchAt, 4],
          [catchAt + 200, -2],
          [at + dur, 0],
        ]);
        K('shift', 0, [
          [at, 0],
          [at + 150, -3],
          [toss + 50, 4],
          [onHat, 0],
          [slide, 0],
          [drop, 10],
          [catchAt, 8],
          [at + dur, 0],
        ]);
        K('yaw', 0, [
          [at, 0],
          [toss, 0.14],
          [onHat, 0],
          [slide, 0.08],
          [drop, 0.25],
          [catchAt, 0.22],
          [catchAt + 200, 0],
          [at + dur, 0],
        ]);
        K('head', 0, [
          [at, 0],
          [at + 150, 4],
          [toss + 50, -14],
          [onHat, -10],
          [onHat + 80, 6],
          [onHat + 250, -2],
          [slide, 4],
          [drop, 12],
          [catchAt, 5],
          [catchAt + 250, 7],
          [at + dur, 0],
        ]);
        K('lookY', 0, [
          [at, 2],
          [toss + 200, -7],
          [onHat + 100, -7],
          [drop, 2],
          [catchAt, 3],
          [catchAt + 200, 0],
          [at + dur, 0],
        ]);
        K('lookX', 0, [
          [at, 0],
          [slide, 1],
          [drop, 4],
          [catchAt, 3],
          [catchAt + 200, 0],
          [at + dur, 0],
        ]);
        K('brow', 0, [
          [at, 0],
          [at + 150, -0.6],
          [toss + 100, 1],
          [drop, 1],
          [catchAt, 0.3],
          [at + dur, 0],
        ]);
        K('smug', 0, [
          [at, 0],
          [catchAt + 100, 0],
          [catchAt + 250, 0.85],
          [at + dur - 150, 0.85],
          [at + dur, 0],
        ]);
        K('widen', 0, [
          [at, 0],
          [toss + 100, 0.9],
          [onHat + 50, 1],
          [drop, 0.7],
          [catchAt, 0],
          [at + dur, 0],
        ]);
        K('aLa', 0, [
          [at, 35],
          [at + 150, 50],
          [toss, 78],
          [onHat - 100, 150],
          [onHat + 70, 160],
          [slide, 145],
          [drop, 80],
          [catchAt, 65],
          [catchAt + 200, 32],
          [at + dur - 150, 32],
          [at + dur, 35],
        ]);
        K('aLe', 0, [
          [at, -25],
          [at + 150, -5],
          [toss, 30],
          [onHat, 18],
          [drop, 15],
          [catchAt, 10],
          [catchAt + 200, 75],
          [at + dur - 150, 75],
          [at + dur, -25],
        ]);
        K('cheek', 0, [
          [at, 0],
          [catchAt, 0],
          [catchAt + 160, 0.95],
          [at + dur - 100, 0.95],
          [at + dur, 0],
        ]);
        K('mouth', 0, [
          [at, 11],
          [at + 150, 6],
          [toss + 100, 22],
          [onHat + 100, 25],
          [slide, 15],
          [drop, 20],
          [catchAt, 10],
          [catchAt + 180, 22],
          [at + dur - 120, 18],
          [at + dur, 11],
        ]);
        K('mouthW', 0, [
          [at, 32],
          [toss + 100, 22],
          [drop, 22],
          [catchAt, 32],
          [catchAt + 200, 38],
          [at + dur, 32],
        ]);
        blinkAt.push(onHat + 120, catchAt + 180);
        break;
      }
      case 'pour': {
        // Ported from GardenScene.swift L156-191 (lifting the can, tilting to pour water onto the pot)
        const p0 = at + 300;
        const p1 = at + dur - 250;
        pours.push({ t0: p0, t1: p1 });
        K('sy', at, [
          [0, 1],
          [150, 0.97],
          [300, 1.02],
          [450, 1],
          [dur, 1],
        ]);
        K('lean', at, [
          [0, 0],
          [150, -3],
          [350, 4],
          [dur - 250, 4],
          [dur, 0],
        ]);
        K('shift', at, [
          [0, 0],
          [350, 6],
          [dur - 250, 6],
          [dur, 0],
        ]);
        K('yaw', at, [
          [0, 0.15],
          [350, 0.4],
          [dur - 250, 0.4],
          [dur, 0.2],
        ]);
        K('head', at, [
          [0, 0],
          [350, 6],
          [dur - 250, 5],
          [dur, 2],
        ]);
        K('lookX', at, [
          [0, 1],
          [300, 3],
          [dur, 3],
        ]);
        K('lookY', at, [
          [0, 2],
          [300, 5],
          [dur, 4],
        ]);
        K('aRa', at, [
          [0, 16],
          [150, 8],
          [350, 92],
          [dur - 250, 90],
          [dur - 80, 40],
          [dur, 16],
        ]);
        K('aRe', at, [
          [0, 8],
          [150, 14],
          [350, 36],
          [dur - 250, 36],
          [dur - 80, 18],
          [dur, 8],
        ]);
        K('aLa', at, [
          [0, 12],
          [350, 28],
          [dur - 250, 26],
          [dur, 12],
        ]);
        K('aLe', at, [
          [0, -4],
          [350, -10],
          [dur - 250, -10],
          [dur, -4],
        ]);
        K('tilt', at, [
          [0, 0],
          [150, -12],
          [350, 50],
          [dur - 250, 48],
          [dur, 0],
        ]);
        K('mouth', at, [
          [0, 11],
          [250, 8],
          [dur - 200, 8],
          [dur, 12],
        ]);
        blinkAt.push(at + 80);
        break;
      }
      case 'bloom': {
        // Ported from GardenScene.swift L86-94, 156-195:
        // Plant grows, unfurls leaves, blooms with sparkles, butterfly visits, girl hops & grins with hearts, waves goodbye, petals fall
        const growStart = at;
        const bud = at + dur * 0.28;
        const bloom = at + dur * 0.36;
        const enter = at + dur * 0.43;
        const land = at + dur * 0.62;
        const hop = at + dur * 0.66;
        const hopEnd = hop + 340;
        const takeoff = at + dur * 0.78;
        const wilt = at + dur * 0.9;
        const gone = at + dur * 0.96;
        blooms.push({ growStart, bud, bloom, enter, land, hop, hopEnd, takeoff, gone, wilt });
        bumps.push({ t0: hop, t1: hopEnd, amp: 26 });
        waves.push([takeoff + 200, wilt]);

        K('sy', 0, [
          [hop - 120, 1],
          [hop - 30, 0.9],
          [hop + 40, 1.07],
          [hopEnd - 50, 1.02],
          [hopEnd + 20, 0.88],
          [hopEnd + 120, 1.03],
          [hopEnd + 250, 1],
        ]);
        K('lean', 0, [
          [growStart, 0],
          [bud, -1],
          [bloom, -3],
          [enter, -1],
          [land - 300, 2],
          [land, 1],
          [hop, 0],
          [takeoff, 0],
          [takeoff + 400, -3],
          [wilt, -2],
          [at + dur, 0],
        ]);
        K('shift', 0, [
          [growStart, 0],
          [land - 300, 2],
          [hop, 0],
          [takeoff + 400, -5],
          [at + dur, 0],
        ]);
        K('yaw', 0, [
          [growStart, 0.25],
          [enter, 0.38],
          [land, 0.4],
          [hop, 0.08],
          [takeoff, 0.05],
          [takeoff + 400, -0.3],
          [wilt, -0.25],
          [at + dur, 0.15],
        ]);
        K('head', 0, [
          [growStart, 2],
          [bud, -1],
          [bloom, -4],
          [enter, -3],
          [land - 300, 4],
          [land, 6],
          [hop, 0],
          [takeoff, -3],
          [takeoff + 400, -6],
          [wilt, -3],
          [at + dur, 0],
        ]);
        K('lookX', 0, [
          [growStart, 3],
          [enter, 5],
          [land - 300, 4.5],
          [land, 3],
          [hop, -0.4],
          [takeoff, -0.25],
          [takeoff + 200, -2],
          [takeoff + 600, -5],
          [wilt, -4],
          [wilt + 250, 1.5],
          [at + dur, 0],
        ]);
        K('lookY', 0, [
          [growStart, 5],
          [growStart + 500, 3],
          [bud, 1],
          [bloom, 0],
          [enter, -5],
          [land - 300, -4],
          [land, 1],
          [hop, 0],
          [takeoff, 0],
          [takeoff + 200, -4],
          [takeoff + 600, -7],
          [wilt, -2],
          [wilt + 250, 4],
          [at + dur, 1],
        ]);
        K('aLa', 0, [
          [growStart, 12],
          [bloom - 100, 12],
          [bloom + 150, 48],
          [enter, 42],
          [enter + 300, 12],
          [hop - 100, 12],
          [hop + 50, 128],
          [hopEnd, 120],
          [takeoff - 100, 28],
          [takeoff + 200, 104],
          [wilt, 104],
          [at + dur, 12],
        ]);
        K('aLe', 0, [
          [growStart, -4],
          [bloom - 100, -4],
          [bloom + 150, 70],
          [enter, 64],
          [enter + 300, -4],
          [hop - 100, -4],
          [hop + 50, 12],
          [hopEnd, 18],
          [takeoff - 100, 6],
          [takeoff + 200, 80],
          [wilt, 80],
          [at + dur, -4],
        ]);
        K('cheek', 0, [
          [hop - 150, 0],
          [hop - 50, 1],
          [takeoff - 150, 1],
          [takeoff, 0],
        ]);
        K('mouth', 0, [
          [growStart, 12],
          [bloom - 100, 12],
          [bloom + 100, 24],
          [enter, 20],
          [enter + 300, 13],
          [hop - 150, 11],
          [hop - 50, 22],
          [takeoff - 150, 22],
          [takeoff, 14],
          [at + dur, 11],
        ]);
        blinkAt.push(growStart + 300, enter + 250, wilt);
        break;
      }
    }
  }

  // Finalise tracks: rest at 0 and at the loop's end, sorted, near-duplicates merged.
  const holdingPan = props.some((p) => p.type === 'toss' || p.type === 'hat-catch');
  const holdingCan = spec.prop.kind === 'watering-can' || pours.length > 0;
  const rest: Record<Ch, number> = {
    ...REST,
    ...(holdingPan ? { aRa: 72, aRe: -64, aLa: 35, aLe: -25 } : {}),
    ...(holdingCan ? { aRa: 16, aRe: 8, aLa: 12, aLe: -4, yaw: 0.15 } : {}),
  };
  if (holdingPan) {
    for (const k of T.aRa) if (k[1] === 12) k[1] = 72;
    for (const k of T.aRe) if (k[1] === 0) k[1] = -64;
  }
  if (holdingCan) {
    for (const k of T.aRa) if (k[1] === 12) k[1] = 16;
    for (const k of T.aRe) if (k[1] === 0) k[1] = 8;
  }
  for (const ch of Object.keys(T) as Ch[]) {
    const keys = T[ch];
    if (!keys.some(([t]) => t <= 0)) keys.push([0, rest[ch]]);
    if (!keys.some(([t]) => t >= D)) keys.push([D, rest[ch]]);
    keys.sort((a, b) => a[0] - b[0]);
    const out: KV[] = [];
    for (const k of keys) {
      if (out.length && k[0] - out[out.length - 1][0] < 20) out[out.length - 1] = k;
      else out.push(k);
    }
    T[ch] = out;
  }

  // Blinks: ones the verbs asked for (on head turns), plus calm periodic ones,
  // never closer than 600 ms. Close 110, hold 40, reopen 190 with ease-out.
  const appearAt = spec.beats.find((b) => b.verb === 'drop-in')?.at ?? 0;
  const calm: number[] = [];
  for (let t = appearAt + 900 + seeded(1) * 600; t < D - 900; t += 3200 + seeded(Math.round(t)) * 1400)
    calm.push(t);
  const blinks = [...blinkAt, ...calm]
    .filter((t) => t > appearAt + 400 && t < D - 400)
    .sort((a, b) => a - b)
    .filter((t, i, arr) => i === 0 || t - arr[i - 1] > 600);
  const mkLid = (times: number[]): Keys => {
    const k: Array<[number, number, 'out'?]> = [[0, 0]];
    for (const b of times) k.push([b, 0], [b + 110, 1], [b + 150, 1], [b + 340, 0, 'out']);
    k.push([D, 0]);
    return k.sort((a, b) => a[0] - b[0]);
  };
  const lid = mkLid(blinks);
  const lidR = mkLid(
    [...blinks, ...winks.map((w) => w + 80)]
      .sort((a, b) => a - b)
      .filter((t, i, arr) => i === 0 || t - arr[i - 1] > 600 || winks.some((w) => Math.abs(t - w - 80) < 1)),
  );
  for (const w of winks) {
    for (let i = 0; i < lidR.length; i++)
      if (Math.abs(lidR[i][0] - (w + 190)) < 2) (lidR as any)[i] = [w + 400, 1];
  }

  return {
    spec,
    tracks: T,
    lid,
    lidR,
    bumps,
    drops,
    mysteries,
    pours,
    blooms,
    starCatches,
    waves,
    shrugs,
    props,
    appearAt,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// pose at time t

function swing(t: number, at: number, amp: number, period = 600): number {
  if (t <= at) return 0;
  const s = t - at;
  return amp * Math.sin((2 * Math.PI * s) / period) * Math.exp(-s / (period * 0.5));
}

function liftAt(c: Compiled, t: number): { lift: number; air: number; airFloat: number } {
  let lift = 0;
  for (const b of c.bumps) {
    if (t >= b.t0 && t < b.t1) {
      const k = (t - b.t0) / (b.t1 - b.t0);
      lift += b.amp * 4 * k * (1 - k);
    }
  }
  let air = 0;
  let airFloat = 0;
  for (const d of c.drops) {
    if (t >= d.t0 && t < d.t1)
      lift += d.hover + (d.top - d.hover) * EASE_OUT((t - d.t0) / (d.t1 - d.t0));
    else if (t >= d.t1 && t < d.t2) {
      const k = (t - d.t1) / (d.t2 - d.t1);
      lift += d.top * (1 - k * k);
    }
    if (t >= d.t0 && t < d.t2) {
      air = 1 - seg(t, d.t2 - 80, d.t2);
      airFloat = 1 - seg(t, d.t2 - 160, d.t2 - 20);
    }
  }
  return { lift, air, airFloat };
}

export function poseAt(c: Compiled, tIn: number, opts: { idle?: boolean } = {}): Pose {
  const t = clamp(tIn, 0, c.spec.duration);
  const on = opts.idle === false || t < c.appearAt ? 0 : 1;
  const T = c.tracks;
  const f = (ch: Ch, dt = 0) => flow(t - dt, T[ch]);

  const { lift, air, airFloat } = liftAt(c, t);
  const s = f('sy');
  const sx = 1 / Math.pow(s, 0.6);
  const sy = s * (1 + 0.014 * wave(t, 2400) * on);
  const lean = f('lean') + 1.4 * wave(t, 4800, 0.2) * on;
  const shift = f('shift') + 1.2 * wave(t, 4800) * on;
  const yaw = f('yaw') + 0.06 * wave(t, 3000, 0.1) * on;
  const head = f('head') - 0.45 * flow(t - 110, T.lean) + 1.8 * wave(t, 4800, 0.6) * on;
  const headDy = f('headDy');

  // Hair & sun-hat follow-through (GardenScene.swift L626-628)
  const pastHead = flow(t - 140, T.head) - 0.45 * flow(t - 250, T.lean);
  const pastLean = flow(t - 140, T.lean);
  const hairSwing = (pastHead + pastLean - (head + lean)) * on;
  const hairUp = (liftAt(c, clamp(t - 90, 0, c.spec.duration)).lift - lift) * on;

  // Hat follow-through & pancake landing wobble (ChefScene.swift L250-261)
  let hatTilt = 0.5 * (flow(t - 120, T.head) - f('head'));
  let hatSquash = 0;
  for (const p of c.props) {
    if (p.type === 'hat-catch') {
      const carrying = seg(t, p.onHat, p.onHat + 120) * (1 - seg(t, p.drop, p.drop + 100));
      hatSquash += 0.03 * carrying;
      const d = (t - p.onHat) / 1000;
      if (d > 0 && d < 0.9) {
        hatSquash += 0.14 * Math.exp(-5 * d) * Math.cos(2 * Math.PI * 3.2 * d);
        hatTilt += 6 * Math.exp(-4 * d) * Math.sin(2 * Math.PI * 2.4 * d);
      }
      hatTilt += 4 * seg(t, p.slide, p.drop) * (1 - seg(t, p.drop, p.drop + 150));
      const d2 = (t - p.drop) / 1000;
      if (d2 > 0 && d2 < 0.8) {
        hatTilt -= 4 * Math.exp(-5 * d2) * Math.sin(2 * Math.PI * 2.4 * d2);
      }
    }
  }
  const hatSy = 1 - hatSquash;

  // Watering-can tilt with delayed swing and hop jolt (GardenScene.swift L237-240)
  let pouring = 0;
  for (const pr of c.pours) {
    pouring += seg(t, pr.t0, pr.t0 + 100) * (1 - seg(t, pr.t1, pr.t1 + 100));
  }
  let tilt =
    flow(t - 70, T.tilt) +
    0.3 * (flow(t - 150, T.aRa) - flow(t - 40, T.aRa)) +
    2.5 * wave(t, 500) * pouring;
  for (const b of c.bumps) {
    tilt += swing(t, b.t0, -10) + swing(t, b.t1, 8);
  }

  const flap = 8 * wave(t, 450) * (air > 0 ? 1 : 0);
  const arm = (ka: Ch, ke: Ch, phase: number, isRight: boolean) => {
    const sway = 3.5 * wave(t, 3000, phase) + 2 * wave(t, 1800, phase + 0.3);
    const a = f(ka) + sway * on + flap;
    const trail = 0.45 * (flow(t - 90, T[ka]) - f(ka));
    let e = f(ke) + 4.5 * wave(t, 2400, phase + 0.6) * on + trail;
    if (isRight) {
      for (const [w0, w1] of c.waves) {
        // If holding a watering can in right hand, wave with left hand instead
        if (c.spec.prop.kind !== 'watering-can') {
          e += 14 * wave(t, 700) * seg(t, w0, w0 + 150) * (1 - seg(t, w1 - 150, w1));
        }
      }
    } else {
      for (const [w0, w1] of c.waves) {
        if (c.spec.prop.kind === 'watering-can') {
          e += 14 * wave(t, 500) * seg(t, w0, w0 + 150) * (1 - seg(t, w1 - 150, w1));
        }
      }
      for (const [s0, s1] of c.shrugs) {
        e += 6 * wave(t, 600) * seg(t, s0, s0 + 150) * (1 - seg(t, s1 - 150, s1));
      }
    }
    return { a, e };
  };

  const splay = Math.max(0, 1 - s) * 50;
  const legR = 3 + air * (5 + 7 * wave(t, 600)) + splay + f('kick') + Math.max(0, -shift) * 0.9;
  const legL = 3 + air * (5 + 7 * wave(t, 600, 0.35)) + splay + Math.max(0, shift) * 0.9;

  const lookX = f('lookX') + 0.5 * wave(t, 5200, 0.1) * on;
  const lookY = f('lookY') + 0.35 * wave(t, 6900, 0.45) * on;
  const brow = f('brow') + 0.08 * wave(t, 3200, 0.4) * on;
  const browL = brow;
  const browR = brow + f('smug') + 0.06 * wave(t, 2400, 0.1) * on;

  const basePose: Pose = {
    lift,
    sx: clamp(sx, 0.7, 1.3),
    sy: clamp(sy, 0.7, 1.3),
    lean: clamp(lean, -24, 24),
    shift: clamp(shift, -16, 16),
    yaw: clamp(yaw, -0.8, 0.8),
    head: clamp(head, -24, 24),
    headDy: clamp(headDy, -12, 12),
    armL: arm('aLa', 'aLe', 0.5, false),
    armR: arm('aRa', 'aRe', 0, true),
    legL,
    legR,
    toeR: f('toe'),
    float: airFloat,
    pedal: wave(t, 600),
    lookX: clamp(lookX, -7, 7),
    lookY: clamp(lookY, -8, 8),
    lid: clamp(track(t, c.lid), 0, 1),
    lidR: clamp(track(t, c.lidR), 0, 1),
    cheek: clamp(f('cheek'), 0, 1),
    mouth: clamp(f('mouth'), 2, 28),
    mouthW: clamp(f('mouthW'), 18, 42),
    browL: clamp(browL, -1.2, 1.5),
    browR: clamp(browR, -1.2, 1.5),
    widen: clamp(f('widen'), 0, 1.2),
    hatTilt: clamp(hatTilt, -18, 18),
    hatSy: clamp(hatSy, 0.72, 1.15),
    hairSwing: clamp(hairSwing, -22, 22),
    hairUp: clamp(hairUp, -16, 24),
    tilt: clamp(tilt, -35, 70),
  };

  // When holding a frying pan in the kitchen, solve 2-bone IK so the right hand grips the pan handle
  if (
    c.spec.prop.kind === 'pancake' &&
    c.props.some((p) => p.type === 'toss' || p.type === 'hat-catch')
  ) {
    const ps = panStateAt(c, t);
    const radRoll = (ps.roll * Math.PI) / 180;
    const gx = 128 * PROP_K;
    const gy = -4 * PROP_K;
    const rx = gx * Math.cos(radRoll) - gy * Math.sin(radRoll);
    const ry = gx * Math.sin(radRoll) + gy * Math.cos(radRoll);
    basePose.armR = solveArmIK(basePose, ps.x + rx, ps.y + ry, 1);
  }

  return basePose;
}

// ---------------------------------------------------------------------------
// Pan, Pancake, Soccer Ball, and Tossed Props with real contact

export function panStateAt(c: Compiled, tIn: number): { x: number; y: number; roll: number } {
  const t = clamp(tIn, 0, c.spec.duration);
  const T = c.tracks;
  // Subtle pan shake near the start (ChefScene.swift L295)
  const shake = 4 * wave(t, 400) * seg(t, 250, 450) * (1 - seg(t, 1300, 1500));
  const x = flow(t, T.panX) + shake + 1.2 * wave(t, 3200, 0.3);
  const y = flow(t, T.panY) + 1.0 * wave(t, 2400, 0.5);
  const roll = flow(t, T.panRoll) + 1.5 * wave(t, 1920, 0.2);
  return { x, y, roll };
}

function inPanAt(c: Compiled, t: number): { x: number; y: number; roll: number } {
  const now = panStateAt(c, t);
  const before = panStateAt(c, t - 90);
  const slide = clamp(0.6 * (before.x - now.x), -10, 10);
  const radRoll = (now.roll * Math.PI) / 180;
  const oy = -4 * PROP_K;
  const rx = slide * Math.cos(radRoll) - oy * Math.sin(radRoll);
  const ry = slide * Math.sin(radRoll) + oy * Math.cos(radRoll);
  return { x: now.x + rx, y: now.y + ry, roll: now.roll };
}

/** The pan sits at panStateAt for pancake scenes; other props sit on the right palm. */
export function panCenter(p: Pose, kind: string = 'pancake', c?: Compiled, t = 0) {
  if (kind === 'pancake' && c) {
    const ps = panStateAt(c, t);
    return { x: ps.x, y: ps.y, roll: ps.roll };
  }
  const h = handScreen(p, 1);
  return kind === 'pancake'
    ? { x: h.x - 80 * PROP_K, y: h.y - 6 * PROP_K, roll: 0 }
    : { x: h.x, y: h.y - 34 * PROP_K, roll: 0 };
}

export type PropState = {
  x: number;
  y: number;
  rot: number;
  theta: number; // 3D pancake flip angle in radians (0 pale up, pi brown up)
  squash: number;
  mode: 'pan' | 'air' | 'hat';
  visible: boolean;
};

export const BALL_R = 36 * (SCALE / 1.72);
const HIDDEN: PropState = {
  x: -999,
  y: -999,
  rot: 0,
  theta: 0,
  squash: 0,
  mode: 'pan',
  visible: false,
};

export function propAt(c: Compiled, t: number): PropState {
  const kind = c.spec.prop.kind;
  if (kind === 'none' || kind === 'watering-can') return HIDDEN;

  // Landing squash for pancake tosses/catches
  let landingSquash = 0;
  for (const p of c.props) {
    if (p.type === 'toss' && t >= p.land && t < p.land + 140) {
      landingSquash = 1 - seg(t, p.land, p.land + 140);
    } else if (p.type === 'hat-catch') {
      for (const land of [p.onHat, p.catchAt]) {
        if (t >= land && t < land + 140) landingSquash = 1 - seg(t, land, land + 140);
      }
    }
  }

  for (const p of c.props) {
    if (p.type === 'tennis-shot') {
      const hand = handScreen(poseAt(c, p.contact), 1);
      const hitX = hand.x + 102;
      const hitY = hand.y + 32;
      const startX = 740;
      const startY = 440;
      const arrive = p.contact - 15;
      if (t >= p.enter && t < p.contact) {
        const k = Math.min(1, Math.max(0, (t - p.enter) / (arrive - p.enter)));
        const x = startX + (hitX - startX) * (k * 0.75 + k * k * 0.25);
        const y = startY + (hitY - startY) * (k * k * 0.75 + k * 0.25);
        const angleRad = -k * 16;
        return {
          x,
          y,
          rot: (angleRad * 180) / Math.PI,
          theta: angleRad,
          squash: 0,
          mode: 'air',
          visible: true,
        };
      }
      if (t >= p.contact && t < p.contact + 950) {
        const s = (t - p.contact) / 1000;
        const contactSquash = 1 - seg(t, p.contact, p.contact + 90);
        const angleRad = -16 + 36 * s;
        return {
          x: hitX + 920 * s,
          y: hitY - 320 * s + 650 * s * s * 0.5,
          rot: (angleRad * 180) / Math.PI,
          theta: angleRad,
          squash: contactSquash * 0.65,
          mode: 'air',
          visible: true,
        };
      }
    } else if (p.type === 'kick') {
      const groundY = FEET.y - BALL_R;
      const foot = footScreen(poseAt(c, p.contact), 1);
      const stopX = foot.x + BALL_R * 0.55;
      const startX = 830;
      const arrive = p.contact - 100;
      if (t >= p.enter && t < p.contact) {
        const k = Math.min(1, Math.max(0, (t - p.enter) / (arrive - p.enter)));
        const x = startX + (stopX - startX) * EASE_OUT(k);
        const angleRad = (x - startX) / BALL_R;
        return {
          x,
          y: groundY,
          rot: (angleRad * 180) / Math.PI,
          theta: angleRad,
          squash: 0,
          mode: 'air',
          visible: true,
        };
      }
      if (t >= p.contact && t < p.contact + 900) {
        const s = (t - p.contact) / 1000;
        const contact = 1 - seg(t, p.contact, p.contact + 90);
        const angleRad = (stopX - startX) / BALL_R + 16 * s;
        return {
          x: stopX + 950 * s,
          y: groundY - 780 * s + 1500 * s * s * 0.5,
          rot: (angleRad * 180) / Math.PI,
          theta: angleRad,
          squash: contact,
          mode: 'air',
          visible: true,
        };
      }
    } else if (p.type === 'toss') {
      if (t >= p.launch && t < p.land) {
        const a = kind === 'pancake' ? inPanAt(c, p.launch) : panCenter(poseAt(c, p.launch), kind, c, p.launch);
        const b = kind === 'pancake' ? inPanAt(c, p.land) : panCenter(poseAt(c, p.land), kind, c, p.land);
        const s = (t - p.launch) / (p.land - p.launch);
        const T = (p.land - p.launch) / 1000;
        const peak = ((1400 * T * T) / 8) * (SCALE / 1.72);
        return {
          x: a.x + (b.x - a.x) * s,
          y: a.y + (b.y - a.y) * s - peak * 4 * s * (1 - s),
          rot: kind === 'pancake' ? 8 * Math.sin(Math.PI * s) : s * 360,
          theta: Math.PI * s,
          squash: 0,
          mode: 'air',
          visible: true,
        };
      }
    } else if (p.type === 'hat-catch') {
      if (t >= p.toss && t < p.onHat) {
        const a = inPanAt(c, p.toss);
        const b = hatTopScreen(poseAt(c, p.onHat));
        const s = (t - p.toss) / (p.onHat - p.toss);
        const T = (p.onHat - p.toss) / 1000;
        const peak = ((1400 * T * T) / 8) * (SCALE / 1.72);
        return {
          x: a.x + (b.x - a.x) * s,
          y: a.y + (b.y - a.y) * s - peak * 4 * s * (1 - s),
          rot: -10 * Math.sin(Math.PI * s),
          theta: Math.PI + 2 * Math.PI * s,
          squash: 0,
          mode: 'air',
          visible: true,
        };
      }
      if (t >= p.onHat && t < p.drop) {
        const slide = seg(t, p.slide, p.drop);
        const hatNow = hatTopScreen(poseAt(c, t), 14 * slide);
        const hatPrev = hatTopScreen(poseAt(c, Math.max(0, t - 80)), 14 * slide);
        const lag = hatPrev.rot - hatNow.rot;
        return {
          x: hatNow.x,
          y: hatNow.y,
          rot: hatNow.rot + 0.6 * lag + 14 * slide,
          theta: 3 * Math.PI + 0.5 * slide,
          squash: landingSquash,
          mode: 'hat',
          visible: true,
        };
      }
      if (t >= p.drop && t < p.catchAt) {
        const a = hatTopScreen(poseAt(c, p.drop), 14);
        const b = inPanAt(c, p.catchAt);
        const s = (t - p.drop) / (p.catchAt - p.drop);
        return {
          x: a.x + (b.x - a.x) * s,
          y: a.y + (b.y - a.y) * s * s,
          rot: 14 * (1 - s),
          theta: 3 * Math.PI + 0.5 + (Math.PI - 0.5) * s,
          squash: 0,
          mode: 'air',
          visible: true,
        };
      }
    } else if (p.type === 'star-catch') {
      if (t >= p.streakStart && t < p.catchAt) {
        const s = (t - p.streakStart) / (p.catchAt - p.streakStart);
        const startX = 640;
        const startY = 140;
        const targetX = 360;
        const targetY = 770;
        const ctrlX = 490;
        const ctrlY = 220;
        const a = 1 - s;
        const x = a * a * startX + 2 * a * s * ctrlX + s * s * targetX;
        const y = a * a * startY + 2 * a * s * ctrlY + s * s * targetY;
        return {
          x,
          y,
          rot: s * 360,
          theta: s * Math.PI * 4,
          squash: 0,
          mode: 'air',
          visible: true,
        };
      }
      if (t >= p.catchAt) {
        const bob = Math.sin((t - p.catchAt) / 250) * 4;
        return {
          x: 360,
          y: 785 + bob,
          rot: ((t - p.catchAt) / 40) % 360,
          theta: 0,
          squash: landingSquash,
          mode: 'pan',
          visible: true,
        };
      }
    }
  }

  // Resting in the pan or hand outside the flight so it never teleports in or out
  if (
    c.props.some((p) => p.type === 'toss' || p.type === 'hat-catch') &&
    (c.drops.length === 0 || t >= c.appearAt + 300)
  ) {
    if (kind === 'pancake') {
      const rest = inPanAt(c, t);
      // Flipped to brown side after first toss until second toss
      const toss1 = c.props.find((p) => p.type === 'toss');
      const hc = c.props.find((p) => p.type === 'hat-catch');
      const flipped =
        toss1 && t >= toss1.land && (!hc || t < hc.toss) ? Math.PI : 0;
      return {
        x: rest.x,
        y: rest.y,
        rot: rest.roll,
        theta: flipped,
        squash: landingSquash,
        mode: 'pan',
        visible: true,
      };
    }
    const h = panCenter(poseAt(c, clamp(t, 0, c.spec.duration)), kind, c, t);
    return {
      x: h.x,
      y: h.y,
      rot: 0,
      theta: 0,
      squash: landingSquash,
      mode: 'pan',
      visible: true,
    };
  }

  return HIDDEN;
}

export const FLOOR = FLOOR_Y;
