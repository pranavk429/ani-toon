// The character genome: a continuous description of a brand creature.
// Species presets only seed it. Every field can be mixed, so the mascot is
// generated, not selected from a library.

export type HeadShape = 'round' | 'tomb' | 'wide' | 'box' | 'blob' | 'cup' | 'screen';
export type EarType = 'round' | 'pointy' | 'long' | 'floppy' | 'tuft' | 'antenna' | 'none';
export type BodyShape = 'round' | 'pear' | 'egg' | 'box' | 'blob' | 'cup';
export type TailType = 'none' | 'stub' | 'puff' | 'bushy' | 'thin' | 'curly';
export type FootType = 'round' | 'long' | 'webbed' | 'talon' | 'hover';
export type NoseType = 'none' | 'oval' | 'triangle' | 'beak' | 'snout';
export type MouthType = 'smile' | 'open' | 'wide' | 'cat';
export type PatternType = 'none' | 'belly' | 'blaze' | 'spots' | 'stripes' | 'mask';
export type OutfitType = 'none' | 'scarf' | 'apron' | 'hoodie' | 'collar' | 'bowtie';
export type AccessoryType = 'none' | 'beanie' | 'cap' | 'glasses' | 'headphones' | 'flower' | 'badge' | 'crown';
export type PropType = 'none' | 'cup' | 'laptop' | 'phone' | 'package' | 'plant' | 'star' | 'heart' | 'megaphone' | 'book' | 'bag';

export type Palette = {
  fur: string;
  furDark: string;
  furLight: string;
  outfit: string;
  outfitDark: string;
  outfitLight: string;
  accent: string;
  accentSoft: string;
  ink: string;
  white: string;
  blush: string;
  bg1: string;
  bg2: string;
};

export type Personality = {
  /** 0 calm, 1 bouncy */
  energy: number;
  /** 0 cool, 1 affectionate */
  warmth: number;
  /** 0 animated, 1 still */
  calm: number;
  /** 0 languid, 1 quick */
  snappiness: number;
  /** 0 sincere, 1 mischievous */
  playfulness: number;
};

export type Genome = {
  id: string;
  /** which preset seeded this genome; traits can drift far from it */
  speciesKey?: string;
  /** Mascot's own name, e.g. Ember */
  name: string;
  brand: string;
  tagline: string;
  /** What the director calls it, e.g. "cozy bear barista" */
  concept: string;
  head: {
    shape: HeadShape;
    w: number;
    h: number;
    tilt: number;
  };
  ears: {
    type: EarType;
    size: number;
    spread: number;
    tilt: number;
  };
  face: {
    eyeW: number;
    eyeH: number;
    eyeGap: number;
    eyeY: number;
    pupil: number;
    shine: number;
    nose: NoseType;
    muzzle: boolean;
    mouth: MouthType;
    brows: 'none' | 'soft' | 'bold';
    blush: number;
    freckles: boolean;
    lashes: boolean;
    whiskers: boolean;
  };
  body: {
    shape: BodyShape;
    w: number;
    h: number;
    belly: boolean;
  };
  arms: {
    len: number;
    width: number;
    hand: number;
  };
  legs: {
    len: number;
    width: number;
    foot: FootType;
  };
  tail: {
    type: TailType;
    size: number;
  };
  pattern: PatternType;
  extras: {
    wings: boolean;
    gills: boolean;
    horn: boolean;
    leaf: boolean;
    flame: boolean;
  };
  outfit: OutfitType;
  accessory: AccessoryType;
  prop: PropType;
  palette: Palette;
  personality: Personality;
  logo: {
    /** data URL of an uploaded logo; empty = use the mark */
    image: string;
    mark: 'bean' | 'leaf' | 'bolt' | 'spark' | 'moon' | 'heart' | 'initial';
    initial: string;
  };
};

import type { FlowKey, Keys } from '../motion/engine';

// ---------------------------------------------------------------------------
// Motion

export type Arm = { a: number; e: number };

export type PoseTarget = Partial<{
  lift: number;
  sx: number;
  sy: number;
  lean: number;
  shift: number;
  yaw: number;
  head: number;
  armL: Arm;
  armR: Arm;
  legL: number;
  legR: number;
  tail: number;
  earL: number;
  earR: number;
  gazeX: number;
  gazeY: number;
  lid: number;
  lidR: number;
  cheek: number;
  mouth: number;
  brow: number;
  propTilt: number;
  propLift: number;
}>;

export type Pose = {
  lift: number;
  sx: number;
  sy: number;
  lean: number;
  shift: number;
  yaw: number;
  head: number;
  armL: Arm;
  armR: Arm;
  legL: number;
  legR: number;
  tail: number;
  earL: number;
  earR: number;
  gazeX: number;
  gazeY: number;
  lid: number;
  lidR: number;
  cheek: number;
  mouth: number;
  brow: number;
  propTilt: number;
  propLift: number;
};

export type ActionName =
  | 'wake'
  | 'perk'
  | 'wave'
  | 'point'
  | 'present'
  | 'sip'
  | 'nod'
  | 'shake'
  | 'shrug'
  | 'think'
  | 'cheer'
  | 'hop'
  | 'dance'
  | 'laugh'
  | 'recoil'
  | 'sleepy'
  | 'stretch'
  | 'listen'
  | 'wink'
  | 'look'
  | 'tap'
  | 'settle'
  | 'spin'
  | 'bow';

export type Beat = {
  t: number;
  action: ActionName;
  intensity?: number;
  side?: -1 | 1;
  hold?: number;
  /** raw channel overrides applied across the beat; the director can add these */
  pose?: PoseTarget;
};

export type GazeKey = { t: number; x: number; y: number; hold?: number };

export type AccentType = 'sparkle' | 'heart' | 'confetti' | 'steam' | 'note' | 'motion' | 'blush';

export type Accent = {
  type: AccentType;
  t: number;
  x?: number;
  y?: number;
  color?: string;
  seed?: number;
};

export type Idle = {
  breath: number;
  sway: number;
  blinkEvery: number;
  gazeWander: number;
  earFlick: number;
};

export type MotionScore = {
  title: string;
  story: string;
  duration: number;
  loop: boolean;
  beats: Beat[];
  gazes?: GazeKey[];
  blinks?: number[];
  accents?: Accent[];
  idle?: Partial<Idle>;
  /** how much the whole performance leans on its personality 0..1 */
  personalityMix?: number;
};

export type CompiledScore = {
  score: MotionScore;
  genome: Genome;
  tracks: {
    lift: FlowKey[];
    sx: FlowKey[];
    sy: FlowKey[];
    lean: FlowKey[];
    shift: FlowKey[];
    yaw: FlowKey[];
    head: FlowKey[];
    armLA: FlowKey[];
    armLE: FlowKey[];
    armRA: FlowKey[];
    armRE: FlowKey[];
    legL: FlowKey[];
    legR: FlowKey[];
    tail: FlowKey[];
    earL: FlowKey[];
    earR: FlowKey[];
    gazeX: FlowKey[];
    gazeY: FlowKey[];
    propTilt: FlowKey[];
    propLift: FlowKey[];
  };
  face: {
    lid: Keys;
    lidR: Keys;
    cheek: Keys;
    mouth: Keys;
    brow: Keys;
  };
  idle: Idle;
  personality: Personality;
};
