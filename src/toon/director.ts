// The local director.
//
// The director never draws a frame. It casts a character from a small,
// hand-built vocabulary, picks a world and a prop, and times 4–7 beats. The
// compiler in compile.ts owns the physics, so every performance has the same
// floor of quality whether it came from a judge's one-line brief or from us.
//
// This is deliberately deterministic: the same brief and seed produce the same
// character. That makes the demo cacheable, shareable and impossible to break
// on venue Wi-Fi. A hosted model can be layered in front (see directAsync), but
// it only ever writes the same SceneSpec.

import { validate } from './compile';
import type {
  Accessory,
  BeatSpec,
  CharacterSpec,
  HairStyle,
  LookTarget,
  Pattern,
  PropKind,
  SceneSpec,
  Verb,
  WorldPreset,
} from './types';

export type Directed = {
  spec: SceneSpec;
  prompt: string;
  interpretation: string;
  story: string;
  notes: string[];
  seed: number;
  kind: 'new' | 'edit';
  change: string;
};

export type DirectOptions = {
  seed?: number;
  previous?: Directed | SceneSpec;
  archetypeId?: string;
  variant?: number;
};

export type StarterPrompt = {
  label: string;
  prompt: string;
};

export const STARTER_PROMPTS: StarterPrompt[] = [
  {
    label: 'Nervous astronomer',
    prompt:
      'A curious astronomer named Pip for a climate startup, peers at a falling star, catches it, and waves.',
  },
  {
    label: 'Chef on a hat',
    prompt:
      'A cheerful chef named Cleo for a neighborhood bakery, flips a pancake, catches it on his hat, and winks.',
  },
  {
    label: 'Night-shift blob',
    prompt:
      'A goofy blob named Muddle for a late-night radio station, dances, laughs, and waves.',
  },
  {
    label: 'Tennis champion',
    prompt:
      'A confident tennis champion named Juno for a sportswear brand, smashes a forehand, and celebrates.',
  },
  {
    label: 'Gentle gardener',
    prompt:
      'A gentle gardener named Sage for an eco brand, waters a sprout until it blooms, then waves.',
  },
  {
    label: 'Tiny robot',
    prompt:
      'A tiny robot named Finn for a developer tool, points at the docs, nods, and gives a cheerful wave.',
  },
];

// ---------------------------------------------------------------------------
// deterministic helpers

function hashText(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)];
}

const titleCase = (s: string) =>
  s
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

function shade(hex: string, amount: number): string {
  const clean = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#888888';
  const n = parseInt(clean.slice(1), 16);
  const channel = (shift: number) => {
    const v = (n >> shift) & 255;
    const out = amount >= 0 ? v + (255 - v) * amount : v * (1 + amount);
    return Math.max(0, Math.min(255, Math.round(out)))
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

// ---------------------------------------------------------------------------
// vocabulary

type PlanBeat = {
  verb: Verb;
  dur?: number;
  target?: LookTarget;
  gap?: number;
  lead?: number;
};

type Palette = {
  skin: string;
  hair: string;
  top: string;
  bottom: string;
  shoe: string;
  accent: string;
  prop: string;
};

type Archetype = {
  id: string;
  label: string;
  role: string;
  match: RegExp;
  priority: number;
  world: WorldPreset;
  prop: PropKind;
  palette: Palette;
  hairStyle: HairStyle;
  accessory: Accessory;
  pattern: Pattern;
  plan: PlanBeat[];
};

const BEAT_DUR: Record<Verb, number> = {
  mystery: 1800,
  'drop-in': 1100,
  wave: 1700,
  kick: 900,
  toss: 1800,
  'hat-catch': 3200,
  pour: 1600,
  bloom: 5200,
  cheer: 1400,
  hop: 760,
  look: 1200,
  nod: 900,
  shrug: 1000,
  hip: 1700,
  point: 1300,
  wink: 700,
  peer: 1700,
  gasp: 1100,
  'star-catch': 2600,
  hug: 1700,
  'tennis-shot': 1200,
  swing: 1200,
};

const PROP_LABEL: Record<PropKind, string> = {
  none: '',
  ball: 'a ball',
  pancake: 'a pancake',
  'watering-can': 'a watering can',
  gift: 'a gift',
  star: 'a falling star',
  jar: 'a glass jar',
  cup: 'a cup',
  heart: 'a heart',
  racket: 'a racket',
};

const WORLD_LABEL: Record<WorldPreset, string> = {
  sky: 'sky',
  garden: 'garden',
  kitchen: 'kitchen',
  night: 'night',
  studio: 'studio',
};

const COLOR_WORDS: Record<string, string> = {
  red: '#EF4444',
  crimson: '#DC2626',
  coral: '#F87171',
  orange: '#F97316',
  amber: '#F59E0B',
  yellow: '#FACC15',
  gold: '#EAB308',
  green: '#22C55E',
  mint: '#6EE7B7',
  emerald: '#10B981',
  teal: '#14B8A6',
  cyan: '#06B6D4',
  blue: '#3B82F6',
  navy: '#1E3A8A',
  indigo: '#4F46E5',
  purple: '#8B5CF6',
  violet: '#7C3AED',
  lavender: '#C4B5FD',
  pink: '#EC4899',
  rose: '#F43F5E',
  brown: '#8B5E3C',
  black: '#141414',
  white: '#F8FAFC',
  cream: '#F3E9DC',
  silver: '#CBD5E1',
};

const NAME_PARTS = [
  'Nova',
  'Milo',
  'Juno',
  'Mochi',
  'Pip',
  'Sage',
  'Rumi',
  'Kai',
  'Luna',
  'Theo',
  'Iris',
  'Finn',
  'Cleo',
  'Nico',
  'Ada',
  'Ezra',
  'Maya',
  'Leo',
  'Marco',
  'Muddle',
];

// ---------------------------------------------------------------------------
// archetypes

const arch = (a: Omit<Archetype, 'role'> & { role?: string }): Archetype => ({
  role: a.label,
  ...a,
});

const ARCHETYPES: Archetype[] = [
  // characters first: an explicit noun should beat an industry word
  arch({
    id: 'chef',
    label: 'chef',
    role: 'little chef',
    match: /\b(chef|cook|baker|bakery|pastry|pancake|kitchen|cooking)\b/i,
    priority: 3,
    world: 'kitchen',
    prop: 'pancake',
    palette: {
      skin: '#F5B092',
      hair: '#4A2C1C',
      top: '#FFF8EF',
      bottom: '#2B2B2B',
      shoe: '#33333B',
      accent: '#FF4B4B',
      prop: '#F8CB69',
    },
    hairStyle: 'short',
    accessory: 'chef-hat',
    pattern: 'chef',
    plan: [
      { verb: 'look', dur: 1100, target: 'down' },
      { verb: 'toss', dur: 1700 },
      { verb: 'nod', dur: 900 },
      { verb: 'wink', dur: 700 },
    ],
  }),
  arch({
    id: 'gardener',
    label: 'gardener',
    role: 'garden friend',
    match: /\b(garden|gardener|plant|flower|bloom|sprout|nature|eco|climate|sustain|farm)\b/i,
    priority: 3,
    world: 'garden',
    prop: 'watering-can',
    palette: {
      skin: '#E8A87C',
      hair: '#2C1810',
      top: '#7BBF6A',
      bottom: '#3E6B48',
      shoe: '#5B4636',
      accent: '#FFC6D3',
      prop: '#3BB8C7',
    },
    hairStyle: 'bun',
    accessory: 'sun-hat',
    pattern: 'apron',
    plan: [
      { verb: 'look', dur: 1100, target: 'down' },
      { verb: 'pour', dur: 1600 },
      { verb: 'bloom', dur: 5200 },
    ],
  }),
  arch({
    id: 'astronomer',
    label: 'astronomer',
    role: 'stargazer',
    match: /\b(astronom\w*|stargaz\w*|telescope|galaxy|planet|moon|space|cosmic|stars?)\b/i,
    priority: 3,
    world: 'night',
    prop: 'star',
    palette: {
      skin: '#F5C3A6',
      hair: '#2C1810',
      top: '#3B4C8A',
      bottom: '#1E2749',
      shoe: '#33333B',
      accent: '#FFD166',
      prop: '#FFE29A',
    },
    hairStyle: 'long',
    accessory: 'glasses',
    pattern: 'badge',
    plan: [
      { verb: 'peer', dur: 1700, target: 'up' },
      { verb: 'gasp', dur: 1100 },
      { verb: 'star-catch', dur: 2600 },
      { verb: 'hug', dur: 1700 },
      { verb: 'wave', dur: 1600 },
    ],
  }),
  arch({
    id: 'tennis',
    label: 'tennis champion',
    role: 'tennis ace',
    match: /\b(tennis|racket|forehand|smash|sportswear|athlete|champion)\b/i,
    priority: 3,
    world: 'sky',
    prop: 'ball',
    palette: {
      skin: '#F5C3A6',
      hair: '#2C1810',
      top: '#FFFFFF',
      bottom: '#FFFFFF',
      shoe: '#FFFFFF',
      accent: '#10B981',
      prop: '#D4E157',
    },
    hairStyle: 'bun',
    accessory: 'headband',
    pattern: 'tennis',
    plan: [
      { verb: 'look', dur: 1000, target: 'right' },
      { verb: 'nod', dur: 800 },
      { verb: 'tennis-shot', dur: 1200 },
      { verb: 'cheer', dur: 1400 },
      { verb: 'wink', dur: 700 },
    ],
  }),
  arch({
    id: 'football',
    label: 'footballer',
    role: 'striker',
    match: /\b(football|soccer|striker|goalkeeper|sneaker|boots?|kick)\b/i,
    priority: 3,
    world: 'sky',
    prop: 'ball',
    palette: {
      skin: '#C68642',
      hair: '#1A1A1A',
      top: '#FF4B4B',
      bottom: '#1453A3',
      shoe: '#33333B',
      accent: '#FFD166',
      prop: '#F8FAFC',
    },
    hairStyle: 'short',
    accessory: 'headband',
    pattern: 'stripes',
    plan: [
      { verb: 'mystery', dur: 1700 },
      { verb: 'drop-in', dur: 1100 },
      { verb: 'wave', dur: 1400 },
      { verb: 'kick', dur: 900 },
      { verb: 'cheer', dur: 1400 },
    ],
  }),
  arch({
    id: 'musician',
    label: 'musician',
    role: 'frontperson',
    match: /\b(music|musician|radio|podcast|dj|singer|band|audio|sound|streamer|broadcast)\b/i,
    priority: 3,
    world: 'studio',
    prop: 'star',
    palette: {
      skin: '#8D5524',
      hair: '#1A1A1A',
      top: '#7C3AED',
      bottom: '#1F1B2E',
      shoe: '#111827',
      accent: '#F472B6',
      prop: '#FDE047',
    },
    hairStyle: 'curly',
    accessory: 'beanie',
    pattern: 'badge',
    plan: [
      { verb: 'hip', dur: 1600 },
      { verb: 'hop', dur: 760 },
      { verb: 'star-catch', dur: 2600 },
      { verb: 'cheer', dur: 1400 },
      { verb: 'wink', dur: 700 },
    ],
  }),
  arch({
    id: 'founder',
    label: 'founder',
    role: 'builder',
    match: /\b(founder|startup|tech|saas|software|developer|dev|app|product|data|cloud|api|platform|ai)\b/i,
    priority: 2,
    world: 'studio',
    prop: 'none',
    palette: {
      skin: '#F5B092',
      hair: '#2C1810',
      top: '#2563EB',
      bottom: '#0F172A',
      shoe: '#111827',
      accent: '#38BDF8',
      prop: '#FDE047',
    },
    hairStyle: 'short',
    accessory: 'glasses',
    pattern: 'badge',
    plan: [
      { verb: 'look', dur: 1000, target: 'viewer' },
      { verb: 'point', dur: 1300, target: 'right' },
      { verb: 'nod', dur: 800 },
      { verb: 'hip', dur: 1500 },
      { verb: 'wink', dur: 700 },
    ],
  }),
  arch({
    id: 'barista',
    label: 'barista',
    role: 'coffee guide',
    match: /\b(coffee|cafe|barista|latte|espresso|tea|matcha|drink|cup)\b/i,
    priority: 2,
    world: 'kitchen',
    prop: 'cup',
    palette: {
      skin: '#C68642',
      hair: '#2C1810',
      top: '#8B5E3C',
      bottom: '#2B2B2B',
      shoe: '#33333B',
      accent: '#F3E9DC',
      prop: '#FFFFFF',
    },
    hairStyle: 'bun',
    accessory: 'none',
    pattern: 'apron',
    plan: [
      { verb: 'look', dur: 1000, target: 'down' },
      { verb: 'toss', dur: 1700 },
      { verb: 'nod', dur: 800 },
      { verb: 'wink', dur: 700 },
    ],
  }),
  arch({
    id: 'doctor',
    label: 'caregiver',
    role: 'calm coach',
    match: /\b(doctor|nurse|health|medical|wellness|care|therapy|mindful|yoga)\b/i,
    priority: 2,
    world: 'studio',
    prop: 'none',
    palette: {
      skin: '#F5C3A6',
      hair: '#2C1810',
      top: '#F8FAFC',
      bottom: '#0E7490',
      shoe: '#FFFFFF',
      accent: '#14B8A6',
      prop: '#99F6E4',
    },
    hairStyle: 'short',
    accessory: 'none',
    pattern: 'badge',
    plan: [
      { verb: 'look', dur: 1000, target: 'viewer' },
      { verb: 'nod', dur: 900 },
      { verb: 'wave', dur: 1600 },
      { verb: 'hip', dur: 1500 },
    ],
  }),
  arch({
    id: 'teacher',
    label: 'teacher',
    role: 'study buddy',
    match: /\b(teacher|education|learn|school|student|course|book|study|tutor)\b/i,
    priority: 2,
    world: 'studio',
    prop: 'none',
    palette: {
      skin: '#E8A87C',
      hair: '#4A2C1C',
      top: '#F59E0B',
      bottom: '#1E3A8A',
      shoe: '#33333B',
      accent: '#FDE68A',
      prop: '#FDE047',
    },
    hairStyle: 'bun',
    accessory: 'glasses',
    pattern: 'badge',
    plan: [
      { verb: 'look', dur: 1000, target: 'right' },
      { verb: 'point', dur: 1300, target: 'right' },
      { verb: 'nod', dur: 800 },
      { verb: 'wave', dur: 1500 },
    ],
  }),
  arch({
    id: 'artist',
    label: 'designer',
    role: 'maker',
    match: /\b(artist|designer|creative|art|draw|paint|illustrat\w*|maker)\b/i,
    priority: 2,
    world: 'studio',
    prop: 'none',
    palette: {
      skin: '#F5B092',
      hair: '#D4A373',
      top: '#EC4899',
      bottom: '#312E81',
      shoe: '#111827',
      accent: '#FDE047',
      prop: '#F9A8D4',
    },
    hairStyle: 'curly',
    accessory: 'beanie',
    pattern: 'stripes',
    plan: [
      { verb: 'look', dur: 1000, target: 'right' },
      { verb: 'point', dur: 1300, target: 'right' },
      { verb: 'wink', dur: 700 },
      { verb: 'hip', dur: 1500 },
    ],
  }),
  arch({
    id: 'gamer',
    label: 'gamer',
    role: 'player one',
    match: /\b(gamer|gaming|twitch|esports|quest|game|player)\b/i,
    priority: 2,
    world: 'night',
    prop: 'none',
    palette: {
      skin: '#F5C3A6',
      hair: '#1A1A1A',
      top: '#111827',
      bottom: '#4C1D95',
      shoe: '#111827',
      accent: '#A3E635',
      prop: '#A3E635',
    },
    hairStyle: 'short',
    accessory: 'headband',
    pattern: 'badge',
    plan: [
      { verb: 'peer', dur: 1400, target: 'right' },
      { verb: 'gasp', dur: 1100 },
      { verb: 'cheer', dur: 1400 },
      { verb: 'wink', dur: 700 },
    ],
  }),
  arch({
    id: 'detective',
    label: 'detective',
    role: 'sleuth',
    match: /\b(detective|mystery|spy|investigat\w*|sleuth|noir)\b/i,
    priority: 2,
    world: 'night',
    prop: 'none',
    palette: {
      skin: '#C68642',
      hair: '#1A1A1A',
      top: '#6B7280',
      bottom: '#111827',
      shoe: '#111827',
      accent: '#F59E0B',
      prop: '#FDE047',
    },
    hairStyle: 'short',
    accessory: 'cap',
    pattern: 'badge',
    plan: [
      { verb: 'mystery', dur: 1700 },
      { verb: 'peer', dur: 1600, target: 'left' },
      { verb: 'shrug', dur: 1000 },
      { verb: 'wink', dur: 700 },
    ],
  }),
  arch({
    id: 'wizard',
    label: 'wizard',
    role: 'spellcaster',
    match: /\b(wizard|magic\w*|magician|sorcer\w*|spell|fantasy)\b/i,
    priority: 3,
    world: 'night',
    prop: 'star',
    palette: {
      skin: '#F5C3A6',
      hair: '#E5E7EB',
      top: '#4C1D95',
      bottom: '#1E1B4B',
      shoe: '#111827',
      accent: '#FDE047',
      prop: '#FDE047',
    },
    hairStyle: 'long',
    accessory: 'cap',
    pattern: 'badge',
    plan: [
      { verb: 'mystery', dur: 1700 },
      { verb: 'star-catch', dur: 2600 },
      { verb: 'cheer', dur: 1400 },
      { verb: 'wink', dur: 700 },
    ],
  }),
  arch({
    id: 'pirate',
    label: 'explorer',
    role: 'adventurer',
    match: /\b(pirate|adventure|explorer|treasure|sailor|captain)\b/i,
    priority: 2,
    world: 'sky',
    prop: 'none',
    palette: {
      skin: '#C68642',
      hair: '#1A1A1A',
      top: '#B91C1C',
      bottom: '#1F2937',
      shoe: '#111827',
      accent: '#FCD34D',
      prop: '#FDE047',
    },
    hairStyle: 'long',
    accessory: 'cap',
    pattern: 'stripes',
    plan: [
      { verb: 'mystery', dur: 1600 },
      { verb: 'drop-in', dur: 1100 },
      { verb: 'point', dur: 1300, target: 'right' },
      { verb: 'cheer', dur: 1400 },
    ],
  }),
  arch({
    id: 'ninja',
    label: 'ninja',
    role: 'shadow',
    match: /\b(ninja|samurai|stealth|shadow|assassin|warrior)\b/i,
    priority: 3,
    world: 'night',
    prop: 'none',
    palette: {
      skin: '#F5C3A6',
      hair: '#1A1A1A',
      top: '#111827',
      bottom: '#111827',
      shoe: '#111827',
      accent: '#EF4444',
      prop: '#EF4444',
    },
    hairStyle: 'short',
    accessory: 'headband',
    pattern: 'badge',
    plan: [
      { verb: 'peer', dur: 1400, target: 'left' },
      { verb: 'shrug', dur: 1000 },
      { verb: 'wink', dur: 700 },
      { verb: 'hop', dur: 760 },
    ],
  }),
  arch({
    id: 'superhero',
    label: 'hero',
    role: 'guardian',
    match: /\b(superhero|hero|superpower|guardian|rocket)\b/i,
    priority: 3,
    world: 'sky',
    prop: 'star',
    palette: {
      skin: '#F5B092',
      hair: '#1A1A1A',
      top: '#DC2626',
      bottom: '#1D4ED8',
      shoe: '#111827',
      accent: '#FDE047',
      prop: '#FDE047',
    },
    hairStyle: 'short',
    accessory: 'cap',
    pattern: 'badge',
    plan: [
      { verb: 'drop-in', dur: 1000 },
      { verb: 'star-catch', dur: 2600 },
      { verb: 'cheer', dur: 1400 },
      { verb: 'hip', dur: 1500 },
    ],
  }),
  arch({
    id: 'robot',
    label: 'robot',
    role: 'helper bot',
    match: /\b(robot|android|bot|machine|cyber|mech)\b/i,
    priority: 3,
    world: 'studio',
    prop: 'none',
    palette: {
      skin: '#C7D2FE',
      hair: '#94A3B8',
      top: '#94A3B8',
      bottom: '#334155',
      shoe: '#1E293B',
      accent: '#22D3EE',
      prop: '#22D3EE',
    },
    hairStyle: 'bald',
    accessory: 'antenna',
    pattern: 'badge',
    plan: [
      { verb: 'look', dur: 1000, target: 'viewer' },
      { verb: 'point', dur: 1300, target: 'right' },
      { verb: 'nod', dur: 800 },
      { verb: 'wink', dur: 700 },
    ],
  }),
  arch({
    id: 'cat',
    label: 'cat',
    role: 'curious cat',
    match: /\b(cat|kitten|feline|meow)\b/i,
    priority: 4,
    world: 'studio',
    prop: 'none',
    palette: {
      skin: '#F59E0B',
      hair: '#B45309',
      top: '#FDE68A',
      bottom: '#92400E',
      shoe: '#78350F',
      accent: '#F472B6',
      prop: '#FDE047',
    },
    hairStyle: 'short',
    accessory: 'cat-ears',
    pattern: 'none',
    plan: [
      { verb: 'look', dur: 1000, target: 'viewer' },
      { verb: 'hop', dur: 760 },
      { verb: 'wink', dur: 700 },
      { verb: 'wave', dur: 1400 },
    ],
  }),
  arch({
    id: 'dog',
    label: 'puppy',
    role: 'best friend',
    match: /\b(dog|puppy|retriever|pup)\b/i,
    priority: 4,
    world: 'garden',
    prop: 'none',
    palette: {
      skin: '#C68642',
      hair: '#8B5A2B',
      top: '#60A5FA',
      bottom: '#1E3A8A',
      shoe: '#78350F',
      accent: '#F59E0B',
      prop: '#FDE047',
    },
    hairStyle: 'short',
    accessory: 'bear-ears',
    pattern: 'none',
    plan: [
      { verb: 'look', dur: 1000, target: 'viewer' },
      { verb: 'hop', dur: 760 },
      { verb: 'wave', dur: 1400 },
      { verb: 'wink', dur: 700 },
    ],
  }),
  arch({
    id: 'bear',
    label: 'bear',
    role: 'teddy',
    match: /\b(bear|teddy)\b/i,
    priority: 4,
    world: 'garden',
    prop: 'none',
    palette: {
      skin: '#8B5A2B',
      hair: '#6B4F3A',
      top: '#F59E0B',
      bottom: '#4B2E1E',
      shoe: '#3F2A1D',
      accent: '#FDE68A',
      prop: '#FDE047',
    },
    hairStyle: 'short',
    accessory: 'bear-ears',
    pattern: 'none',
    plan: [
      { verb: 'look', dur: 1000, target: 'viewer' },
      { verb: 'hip', dur: 1500 },
      { verb: 'nod', dur: 800 },
      { verb: 'wave', dur: 1400 },
    ],
  }),
  arch({
    id: 'bunny',
    label: 'bunny',
    role: 'little hare',
    match: /\b(bunny|rabbit|hare)\b/i,
    priority: 4,
    world: 'garden',
    prop: 'none',
    palette: {
      skin: '#F8FAFC',
      hair: '#E2E8F0',
      top: '#F9A8D4',
      bottom: '#BE185D',
      shoe: '#9D174D',
      accent: '#F472B6',
      prop: '#FDE047',
    },
    hairStyle: 'short',
    accessory: 'bunny-ears',
    pattern: 'none',
    plan: [
      { verb: 'hop', dur: 760 },
      { verb: 'look', dur: 1000, target: 'viewer' },
      { verb: 'wink', dur: 700 },
      { verb: 'wave', dur: 1400 },
    ],
  }),
  arch({
    id: 'penguin',
    label: 'penguin',
    role: 'cool bird',
    match: /\b(penguin|owl|duck|bird)\b/i,
    priority: 4,
    world: 'night',
    prop: 'none',
    palette: {
      skin: '#111827',
      hair: '#111827',
      top: '#F8FAFC',
      bottom: '#1E293B',
      shoe: '#F59E0B',
      accent: '#38BDF8',
      prop: '#FDE047',
    },
    hairStyle: 'bald',
    accessory: 'beanie',
    pattern: 'none',
    plan: [
      { verb: 'look', dur: 1000, target: 'viewer' },
      { verb: 'wave', dur: 1400 },
      { verb: 'hop', dur: 760 },
      { verb: 'wink', dur: 700 },
    ],
  }),
  arch({
    id: 'fox',
    label: 'fox',
    role: 'quick thinker',
    match: /\b(fox|wolf)\b/i,
    priority: 4,
    world: 'garden',
    prop: 'none',
    palette: {
      skin: '#EA580C',
      hair: '#C2410C',
      top: '#FED7AA',
      bottom: '#7C2D12',
      shoe: '#431407',
      accent: '#FDE047',
      prop: '#FDE047',
    },
    hairStyle: 'short',
    accessory: 'cat-ears',
    pattern: 'none',
    plan: [
      { verb: 'look', dur: 1000, target: 'right' },
      { verb: 'hop', dur: 760 },
      { verb: 'wink', dur: 700 },
      { verb: 'wave', dur: 1400 },
    ],
  }),
  arch({
    id: 'dragon',
    label: 'dragon',
    role: 'friendly monster',
    match: /\b(dragon|dino|monster|godzilla)\b/i,
    priority: 4,
    world: 'night',
    prop: 'none',
    palette: {
      skin: '#6BBF59',
      hair: '#2F6B3A',
      top: '#14532D',
      bottom: '#0F2E1A',
      shoe: '#0B1F12',
      accent: '#FDE047',
      prop: '#F97316',
    },
    hairStyle: 'bald',
    accessory: 'horns',
    pattern: 'none',
    plan: [
      { verb: 'mystery', dur: 1700 },
      { verb: 'drop-in', dur: 1100 },
      { verb: 'gasp', dur: 1100 },
      { verb: 'cheer', dur: 1400 },
      { verb: 'wink', dur: 700 },
    ],
  }),
  arch({
    id: 'blob',
    label: 'blob',
    role: 'little creature',
    match: /\b(blob|alien|slime|creature|ghost|squish)\b/i,
    priority: 4,
    world: 'studio',
    prop: 'none',
    palette: {
      skin: '#A7F3D0',
      hair: '#7C3AED',
      top: '#8B5CF6',
      bottom: '#4C1D95',
      shoe: '#2E1065',
      accent: '#F472B6',
      prop: '#FDE047',
    },
    hairStyle: 'bald',
    accessory: 'antenna',
    pattern: 'none',
    plan: [
      { verb: 'hop', dur: 760 },
      { verb: 'gasp', dur: 1100 },
      { verb: 'wink', dur: 700 },
      { verb: 'cheer', dur: 1400 },
    ],
  }),
  arch({
    id: 'cactus',
    label: 'cactus',
    role: 'desert optimist',
    match: /\b(cactus|succulent|desert)\b/i,
    priority: 4,
    world: 'garden',
    prop: 'none',
    palette: {
      skin: '#6BBF59',
      hair: '#2F6B3A',
      top: '#FDE68A',
      bottom: '#3E6B48',
      shoe: '#5B4636',
      accent: '#FB7185',
      prop: '#FDE047',
    },
    hairStyle: 'bald',
    accessory: 'sun-hat',
    pattern: 'none',
    plan: [
      { verb: 'look', dur: 1000, target: 'up' },
      { verb: 'nod', dur: 800 },
      { verb: 'wave', dur: 1500 },
      { verb: 'hip', dur: 1500 },
    ],
  }),
  arch({
    id: 'astronaut',
    label: 'astronaut',
    role: 'space explorer',
    match: /\b(astronaut|spaceman|nasa)\b/i,
    priority: 4,
    world: 'night',
    prop: 'star',
    palette: {
      skin: '#F5C3A6',
      hair: '#2C1810',
      top: '#F8FAFC',
      bottom: '#1E293B',
      shoe: '#111827',
      accent: '#38BDF8',
      prop: '#FDE047',
    },
    hairStyle: 'short',
    accessory: 'glasses',
    pattern: 'badge',
    plan: [
      { verb: 'mystery', dur: 1700 },
      { verb: 'drop-in', dur: 1100 },
      { verb: 'star-catch', dur: 2600 },
      { verb: 'wave', dur: 1500 },
    ],
  }),
  arch({
    id: 'critter',
    label: 'creature',
    role: 'little mascot',
    match:
      /\b(animal|creature|critter|pig|hog|llama|alpaca|whale|dolphin|shark|octopus|squid|jellyfish|starfish|crab|seal|otter|hamster|mouse|rat|squirrel|hedgehog|badger|sloth|monkey|gorilla|elephant|giraffe|zebra|hippo|camel|sheep|horse|donkey|cow|bull|goat|deer|moose|rhino|unicorn|turtle|tortoise|frog|toad|snake|lizard|bee|butterfly|spider|snail|parrot|flamingo|peacock|swan|eagle|owl|duck|bird)\b/i,
    priority: 1,
    world: 'garden',
    prop: 'none',
    palette: {
      skin: '#E8A87C',
      hair: '#8B5A2B',
      top: '#FDE68A',
      bottom: '#4B2E1E',
      shoe: '#5B4636',
      accent: '#F472B6',
      prop: '#FDE047',
    },
    hairStyle: 'short',
    accessory: 'bear-ears',
    pattern: 'none',
    plan: [
      { verb: 'look', dur: 1000, target: 'viewer' },
      { verb: 'hop', dur: 760 },
      { verb: 'wink', dur: 700 },
      { verb: 'wave', dur: 1400 },
    ],
  }),
  // industry-only fallbacks, used when the brief has no character noun
  arch({
    id: 'finance',
    label: 'guide',
    role: 'money guide',
    match: /\b(finance|fintech|bank|invest|crypto|money|payments?)\b/i,
    priority: 1,
    world: 'studio',
    prop: 'none',
    palette: {
      skin: '#E8A87C',
      hair: '#1A1A1A',
      top: '#0F766E',
      bottom: '#0F172A',
      shoe: '#111827',
      accent: '#FBBF24',
      prop: '#FDE047',
    },
    hairStyle: 'short',
    accessory: 'glasses',
    pattern: 'badge',
    plan: [
      { verb: 'look', dur: 1000, target: 'viewer' },
      { verb: 'nod', dur: 800 },
      { verb: 'point', dur: 1300, target: 'right' },
      { verb: 'wink', dur: 700 },
    ],
  }),
  arch({
    id: 'kids',
    label: 'friend',
    role: 'playmate',
    match: /\b(kids|children|baby|family|play|school)\b/i,
    priority: 1,
    world: 'garden',
    prop: 'star',
    palette: {
      skin: '#F5B092',
      hair: '#4A2C1C',
      top: '#F472B6',
      bottom: '#2563EB',
      shoe: '#111827',
      accent: '#FDE047',
      prop: '#FDE047',
    },
    hairStyle: 'curly',
    accessory: 'none',
    pattern: 'stripes',
    plan: [
      { verb: 'hop', dur: 760 },
      { verb: 'star-catch', dur: 2600 },
      { verb: 'cheer', dur: 1400 },
      { verb: 'wave', dur: 1400 },
    ],
  }),
];

const SPEECHY_ACCESSORIES: Accessory[] = ['cat-ears', 'bear-ears', 'bunny-ears', 'horns'];

const SPECIES_IDS = new Set([
  'cat',
  'dog',
  'bear',
  'bunny',
  'penguin',
  'fox',
  'dragon',
  'blob',
  'cactus',
  'critter',
  'robot',
]);

function matchArchetype(text: string): Archetype | null {
  let best: { a: Archetype; score: number } | null = null;
  let bestRole: { a: Archetype; score: number } | null = null;
  let bestSpecies: { a: Archetype; score: number } | null = null;
  for (const a of ARCHETYPES) {
    const m = text.match(a.match);
    if (!m) continue;
    const score = a.priority * 1000 - (m.index ?? 0);
    const hit = { a, score };
    if (!best || score > best.score) best = hit;
    if (SPECIES_IDS.has(a.id)) {
      if (!bestSpecies || score > bestSpecies.score) bestSpecies = hit;
    } else if (!bestRole || score > bestRole.score) {
      bestRole = hit;
    }
  }
  // "cat astronaut" is an astronaut with cat ears, not a cat. A real role
  // noun (priority 3+) owns the scene; the species still drives the ears.
  if (bestRole && bestRole.a.priority >= 3) return bestRole.a;
  return bestSpecies?.a ?? bestRole?.a ?? best?.a ?? null;
}

// ---------------------------------------------------------------------------
// mood + colour

type Mood = {
  id: string;
  label: string;
  accent: string;
  prop: string;
};

const MOODS: Array<{ re: RegExp; mood: Mood }> = [
  {
    re: /\b(nervous|anxious|shy|awkward|worried|panic|jittery)\b/i,
    mood: { id: 'nervous', label: 'nervous', accent: '#60A5FA', prop: '#BFDBFE' },
  },
  {
    re: /\b(cranky|grumpy|grump|sassy|angry|fierce|stoic|serious|stern|moody)\b/i,
    mood: { id: 'cranky', label: 'cranky', accent: '#DC2626', prop: '#FCA5A5' },
  },
  {
    re: /\b(playful|fun|cheeky|mischievous|goofy|quirky|silly|happy|joyful|whimsical|cheerful)\b/i,
    mood: { id: 'playful', label: 'playful', accent: '#F472B6', prop: '#FDE047' },
  },
  {
    re: /\b(energetic|hyper|excited|bold|loud|wild|dynamic|electric)\b/i,
    mood: { id: 'energetic', label: 'energetic', accent: '#F97316', prop: '#FDE047' },
  },
  {
    re: /\b(calm|gentle|quiet|serene|mindful|soft)\b/i,
    mood: { id: 'calm', label: 'gentle', accent: '#14B8A6', prop: '#A7F3D0' },
  },
  {
    re: /\b(cozy|warm|friendly|kind|caring|homey|comfort)\b/i,
    mood: { id: 'cozy', label: 'warm', accent: '#F59E0B', prop: '#FDE68A' },
  },
  {
    re: /\b(confident|brave|cool|smug|charming|sleek|sharp|decisive)\b/i,
    mood: { id: 'confident', label: 'confident', accent: '#111827', prop: '#F59E0B' },
  },
  {
    re: /\b(mysterious|mystery|noir|secret|shadow|eerie|strange)\b/i,
    mood: { id: 'mysterious', label: 'mysterious', accent: '#8B5CF6', prop: '#C4B5FD' },
  },
  {
    re: /\b(sleepy|tired|dreamy|drowsy|late-night|midnight)\b/i,
    mood: { id: 'sleepy', label: 'dreamy', accent: '#94A3B8', prop: '#CBD5E1' },
  },
];

function moodFor(text: string): Mood {
  for (const m of MOODS) if (m.re.test(text)) return m.mood;
  return { id: 'curious', label: 'curious', accent: '#4B63FF', prop: '#FDE047' };
}

function findColor(text: string): { word: string; hex: string } | null {
  const direct = text.match(/#([0-9a-fA-F]{6})\b/);
  if (direct) return { word: direct[0], hex: `#${direct[1]}` };
  for (const [word, hex] of Object.entries(COLOR_WORDS)) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(text)) return { word, hex };
  }
  return null;
}

// ---------------------------------------------------------------------------
// text parsing

// Sentence-initial words that look like names in "X the Y" but are really the
// imperative most briefs start with ("Make a nervous astronomer…").
const NOT_A_NAME = new Set([
  'a', 'an', 'the', 'make', 'build', 'create', 'design', 'draw', 'generate',
  'meet', 'give', 'show', 'use', 'try', 'add', 'turn', 'keep', 'put', 'rename',
  'call', 'imagine', 'direct', 'write', 'animate', 'render', 'start', 'set',
  'swap', 'change', 'update', 'bring', 'move', 'need', 'want', 'get', 'let',
  'have', 'here', 'this', 'that', 'our', 'your', 'my', 'we', 'i', 'it', 'he',
  'she', 'they', 'there', 'introducing', 'presenting',
]);

function parseName(text: string): string | null {
  const renamed = text.match(
    /\b(?:rename|call)\s+(?:it|him|her|them|the character)\s+["“']?([A-Za-z]{2,16})/i,
  );
  if (renamed?.[1]) return titleCase(renamed[1]);
  const named = text.match(/\b(?:named|called|mascot named|mascot called)\s+["“']?([A-Za-z]{2,16})/i);
  if (named?.[1]) return titleCase(named[1]);
  const theName = text.match(/\b([A-Z][a-z]{1,12})\s+(?:the|a|an)\s+/);
  if (theName?.[1] && !NOT_A_NAME.has(theName[1].toLowerCase())) return titleCase(theName[1]);
  return null;
}

function parseBrand(text: string): string {
  const forMatch = text.match(
    /\bfor\s+([A-Z][A-Za-z0-9&'’\-]*(?:\s+[A-Z][A-Za-z0-9&'’\-]*){0,3})/,
  );
  if (!forMatch?.[1]) return '';
  return forMatch[1].replace(/[.,;:!?]+$/, '').trim();
}

function parseAccessory(text: string, fallback: Accessory): Accessory {
  const lower = text.toLowerCase();
  if (/\b(no|remove|without|take off)\s+(the\s+)?(hat|beanie|cap|glasses|headband|ears|antenna|horns)\b/.test(lower)) {
    return 'none';
  }
  if (/\b(cow|bull|goat|deer|moose|rhino|unicorn|ram|devil|demon)\b/.test(lower)) return 'horns';
  if (/\b(cat|kitten|tiger|lion|leopard|cheetah|fox|wolf|panther)\b/.test(lower)) return 'cat-ears';
  if (/\bbunny\s+ears\b|\bbunny\b|\brabbit\b|\bhare\b/.test(lower)) return 'bunny-ears';
  if (
    /\b(bear|teddy|panda|koala|dog|puppy|pig|hog|llama|alpaca|whale|dolphin|seal|otter|hamster|mouse|rat|squirrel|hedgehog|badger|sloth|monkey|gorilla|elephant|giraffe|zebra|hippo|camel|sheep|horse|donkey)\b/.test(
      lower,
    )
  ) {
    return 'bear-ears';
  }
  if (/\bcat\s+ears\b|\bcat\b/.test(lower)) return 'cat-ears';
  if (/\bbear\s+ears\b|\bbear\b|\bteddy\b/.test(lower)) return 'bear-ears';
  if (/\bbunny\s+ears\b|\brabbit\b/.test(lower)) return 'bunny-ears';
  if (/\bantenna\b|\brobot\b|\balien\b|\bcyborg\b/.test(lower)) return 'antenna';
  if (/\bhorns?\b|\bdragon\b|\bdevil\b|\bmonster\b|\bdino\w*\b/.test(lower)) return 'horns';
  if (/\bbeanie\b|\bknit\s+hat\b/.test(lower)) return 'beanie';
  if (/\bcap\b|\bbaseball\s+hat\b/.test(lower)) return 'cap';
  if (/\bglasses\b|\bspectacles\b/.test(lower)) return 'glasses';
  if (/\bheadband\b/.test(lower)) return 'headband';
  if (/\bmustache\b|\bmoustache\b/.test(lower)) return 'mustache';
  if (/\bsun\s*hat\b|\bstraw\s+hat\b/.test(lower)) return 'sun-hat';
  if (/\bchef\s*hat\b|\btoque\b/.test(lower)) return 'chef-hat';
  if (/\bhat\b/.test(lower)) return fallback === 'none' ? 'beanie' : fallback;
  return fallback;
}

function parseWorld(text: string, fallback: WorldPreset): WorldPreset {
  if (/^\s*night\s*$/i.test(text)) return 'night';
  if (/^\s*(garden|forest|nature)\s*$/i.test(text)) return 'garden';
  if (/^\s*kitchen\s*$/i.test(text)) return 'kitchen';
  if (/^\s*studio\s*$/i.test(text)) return 'studio';
  if (/^\s*sky\s*$/i.test(text)) return 'sky';
  if (/\b(make it|turn it|set it|at|in|into|background)\b.*\bnight\b|\bmidnight\b|\bnight\s+world\b/i.test(text)) return 'night';
  if (/\b(make it|turn it|set it|at|in|into|background)\b.*\b(garden|forest|nature)\b|\bgarden\s+world\b/i.test(text)) return 'garden';
  if (/\b(make it|turn it|set it|at|in|into|background)\b.*\bkitchen\b|\bkitchen\s+world\b/i.test(text)) return 'kitchen';
  if (/\b(make it|turn it|set it|at|in|into|background)\b.*\bstudio\b|\bstudio\s+world\b/i.test(text)) return 'studio';
  if (/\b(make it|turn it|set it|at|in|into|background)\b.*\bsky\b|\bsky\s+world\b/i.test(text)) return 'sky';
  return fallback;
}

// ---------------------------------------------------------------------------
// beats

type ActionHit = {
  verb: Verb;
  target?: LookTarget;
  prop?: PropKind;
  plan?: PlanBeat[];
  at: number;
};

const ACTIONS: Array<{
  re: RegExp;
  verb?: Verb;
  target?: LookTarget;
  prop?: PropKind;
  plan?: PlanBeat[];
}> = [
  {
    re: /\b(hat|catch.*hat|flip.*hat|hat.*catch)\b/i,
    verb: 'hat-catch',
    prop: 'pancake',
    plan: [
      { verb: 'look', dur: 1000, target: 'down' },
      { verb: 'hat-catch', dur: 3200 },
      { verb: 'nod', dur: 800 },
      { verb: 'wink', dur: 700 },
    ],
  },
  {
    re: /\b(tennis|forehand|smash|serve)\b/i,
    verb: 'tennis-shot',
    prop: 'ball',
    plan: [
      { verb: 'look', dur: 1000, target: 'right' },
      { verb: 'nod', dur: 800 },
      { verb: 'tennis-shot', dur: 1200 },
      { verb: 'cheer', dur: 1400 },
    ],
  },
  {
    re: /\b(kick|football|soccer|penalty|goal)\b/i,
    verb: 'kick',
    prop: 'ball',
    plan: [
      { verb: 'look', dur: 900, target: 'down' },
      { verb: 'kick', dur: 900 },
      { verb: 'cheer', dur: 1400 },
    ],
  },
  {
    re: /\b(dance|dancing|groove|party|ragdoll)\b/i,
    verb: 'hop',
    plan: [
      { verb: 'hip', dur: 1500 },
      { verb: 'hop', dur: 760 },
      { verb: 'point', dur: 1200, target: 'right' },
      { verb: 'wink', dur: 700 },
      { verb: 'cheer', dur: 1400 },
    ],
  },
  {
    re: /\b(water|watering|pour|bloom|grow|sprout|plant)\b/i,
    verb: 'bloom',
    prop: 'watering-can',
    plan: [
      { verb: 'look', dur: 1000, target: 'down' },
      { verb: 'pour', dur: 1600 },
      { verb: 'bloom', dur: 5200 },
    ],
  },
  {
    re: /\b(star|wish|shooting star|catch.*star)\b/i,
    verb: 'star-catch',
    prop: 'star',
    plan: [
      { verb: 'peer', dur: 1600, target: 'up' },
      { verb: 'gasp', dur: 1000 },
      { verb: 'star-catch', dur: 2600 },
      { verb: 'hug', dur: 1600 },
    ],
  },
  {
    re: /\b(flip|toss|pancake|catch)\b/i,
    verb: 'toss',
    prop: 'pancake',
    plan: [
      { verb: 'look', dur: 1000, target: 'down' },
      { verb: 'toss', dur: 1700 },
      { verb: 'nod', dur: 800 },
    ],
  },
  { re: /\b(swing|baseball|bat)\b/i, verb: 'swing', prop: 'racket' },
  { re: /\b(wave|hello|hi\b|goodbye|greet|welcome)\b/i, verb: 'wave' },
  { re: /\b(wink|smirk)\b/i, verb: 'wink' },
  { re: /\b(point|present|show|explain)\b/i, verb: 'point', target: 'right' },
  { re: /\b(nod|agree|yes)\b/i, verb: 'nod' },
  { re: /\b(shrug|dunno|maybe|who knows)\b/i, verb: 'shrug' },
  { re: /\b(hip|pose|confident)\b/i, verb: 'hip' },
  { re: /\b(hug|love|heart)\b/i, verb: 'hug', prop: 'star' },
  { re: /\b(jump|hop|bounce|boing)\b/i, verb: 'hop' },
  { re: /\b(cheer|celebrate|win|yay|hooray|laugh)\b/i, verb: 'cheer' },
  { re: /\b(look|glance|search|peer)\b/i, verb: 'look' },
  { re: /\b(gasp|surprise|shock|wow)\b/i, verb: 'gasp' },
];

function detectActions(text: string): ActionHit[] {
  const hits: ActionHit[] = [];
  const removingHat =
    /\b(remove|take off|without|no)\b[^.]*\b(hat|beanie|cap|glasses|headband|ears|antenna|horns)\b/i.test(
      text,
    );
  for (const a of ACTIONS) {
    const m = text.match(a.re);
    if (!m) continue;
    if (removingHat && (a.verb === 'hat-catch' || a.verb === 'toss')) continue;
    hits.push({
      at: m.index ?? 0,
      verb: a.verb ?? 'nod',
      target: a.target,
      prop: a.prop,
      plan: a.plan,
    });
  }
  return hits.sort((a, b) => a.at - b.at);
}

function verbPhrase(b: BeatSpec): string {
  const target = b.target;
  switch (b.verb) {
    case 'mystery':
      return 'arrives as a silhouette';
    case 'drop-in':
      return 'drops in';
    case 'wave':
      return 'waves';
    case 'kick':
      return 'kicks it';
    case 'toss':
      return 'flips it';
    case 'hat-catch':
      return 'flips it onto its hat';
    case 'pour':
      return 'waters it';
    case 'bloom':
      return 'makes it bloom';
    case 'cheer':
      return 'cheers';
    case 'hop':
      return 'hops';
    case 'look':
      return target === 'up'
        ? 'looks up'
        : target === 'down'
          ? 'looks down'
          : target === 'left'
            ? 'looks left'
            : target === 'right'
              ? 'looks right'
              : target === 'prop'
                ? 'looks at it'
                : 'looks at you';
    case 'nod':
      return 'nods';
    case 'shrug':
      return 'shrugs';
    case 'hip':
      return 'strikes a pose';
    case 'point':
      return target === 'left' ? 'points left' : 'points right';
    case 'wink':
      return 'winks';
    case 'peer':
      return 'peers in';
    case 'gasp':
      return 'gasps';
    case 'star-catch':
      return 'catches a star';
    case 'hug':
      return 'hugs it';
    case 'tennis-shot':
      return 'smashes it';
    case 'swing':
      return 'swings';
    default:
      return b.verb;
  }
}

export function storyFor(beats: BeatSpec[]): string {
  return beats.map(verbPhrase).join(' → ');
}

function beatEnd(at: number, verb: Verb, dur: number): number {
  if (verb === 'kick' || verb === 'tennis-shot' || verb === 'swing') return at + dur + 100;
  if (verb === 'drop-in' || verb === 'hat-catch') return at + dur + 200;
  return at + dur;
}

function pack(plan: PlanBeat[], minDuration = 9200): { beats: BeatSpec[]; duration: number } {
  const beats: BeatSpec[] = [];
  let cursor = 360;
  for (const p of plan) {
    const dur = Math.min(7200, Math.max(400, p.dur ?? BEAT_DUR[p.verb] ?? 1200));
    const lead =
      p.lead ??
      (p.verb === 'kick' || p.verb === 'tennis-shot' || p.verb === 'swing' ? 1250 : 0);
    const at = cursor + lead;
    beats.push({ at, verb: p.verb, dur, target: p.target });
    cursor = beatEnd(at, p.verb, dur) + (p.gap ?? 180);
  }

  let duration = Math.max(minDuration, Math.ceil((cursor + 900) / 100) * 100);
  duration = Math.min(14000, duration);

  const kept = beats.filter((b) => beatEnd(b.at, b.verb, b.dur ?? 0) <= duration - 250);
  if (!kept.some((b) => b.verb === 'look' || b.verb === 'mystery' || b.verb === 'drop-in')) {
    // A performance should acknowledge the viewer before it does anything else.
    kept.unshift({ at: 300, verb: 'look', dur: 900, target: 'viewer' });
  }
  return { beats: kept, duration };
}

function applyMood(plan: PlanBeat[], mood: Mood): PlanBeat[] {
  const has = (v: Verb) => plan.some((p) => p.verb === v);
  let out = [...plan];

  if (mood.id === 'nervous') {
    out = [
      { verb: 'look', dur: 900, target: 'left' },
      { verb: 'look', dur: 900, target: 'right' },
      ...out.filter((p) => p.verb !== 'cheer'),
      { verb: 'shrug', dur: 900 },
    ];
  } else if (mood.id === 'playful') {
    if (!has('hop')) out.push({ verb: 'hop', dur: 700 });
    if (!has('wink')) out.push({ verb: 'wink', dur: 700 });
  } else if (mood.id === 'energetic') {
    if (!has('hop')) out.push({ verb: 'hop', dur: 700 });
    if (!has('cheer')) out.push({ verb: 'cheer', dur: 1400 });
    out = out.map((p) => ({ ...p, gap: 110 }));
  } else if (mood.id === 'calm') {
    out = out.filter((p) => p.verb !== 'cheer' && p.verb !== 'hop' && p.verb !== 'kick');
    if (!has('nod')) out.push({ verb: 'nod', dur: 1000 });
    out = out.map((p) => ({
      ...p,
      gap: 280,
      dur: Math.min(7200, Math.round((p.dur ?? BEAT_DUR[p.verb] ?? 1200) * 1.12)),
    }));
  } else if (mood.id === 'cozy') {
    if (!has('look')) out.unshift({ verb: 'look', dur: 1100, target: 'viewer' });
    if (!has('nod')) out.push({ verb: 'nod', dur: 900 });
    out = out.map((p) => ({ ...p, gap: 240 }));
  } else if (mood.id === 'confident') {
    if (!has('hip')) out.push({ verb: 'hip', dur: 1500 });
    if (!has('point')) out.push({ verb: 'point', dur: 1300, target: 'right' });
    out = out.map((p) => ({ ...p, gap: 150 }));
  } else if (mood.id === 'mysterious') {
    if (!has('mystery') && !has('drop-in')) out.unshift({ verb: 'mystery', dur: 1700 });
    if (!has('peer')) out.push({ verb: 'peer', dur: 1300, target: 'left' });
    if (!has('shrug')) out.push({ verb: 'shrug', dur: 1000 });
  } else if (mood.id === 'sleepy') {
    out = out.filter((p) => p.verb !== 'cheer' && p.verb !== 'hop');
    if (!has('look')) out.unshift({ verb: 'look', dur: 1300, target: 'down' });
    if (!has('nod')) out.push({ verb: 'nod', dur: 1100 });
    out = out.map((p) => ({
      ...p,
      gap: 300,
      dur: Math.min(7200, Math.round((p.dur ?? BEAT_DUR[p.verb] ?? 1200) * 1.18)),
    }));
  }

  // Cap the performance at seven beats while keeping the opener and the closer.
  if (out.length > 7) out = [...out.slice(0, 5), ...out.slice(-2)];
  return out;
}

function planFor(arch: Archetype | null, text: string, mood: Mood): PlanBeat[] {
  const hits = detectActions(text);
  const hero = hits.find((h) => h.plan) ?? hits.find((h) => h.verb !== 'look') ?? hits[0];
  let plan: PlanBeat[];

  if (hero?.plan) {
    plan = [...hero.plan];
    // Keep the archetype's opening beat if it is different and adds context.
    const opener = arch?.plan[0];
    if (opener && opener.verb !== plan[0]?.verb && opener.verb === 'look') {
      plan.unshift({ ...opener });
    }
  } else if (arch) {
    plan = [...arch.plan];
    if (hero) {
      // Replace the archetype's hero with the action the judge actually asked for.
      const heroIndex = plan.findIndex((p) =>
        ['kick', 'toss', 'hat-catch', 'pour', 'bloom', 'star-catch', 'tennis-shot', 'swing'].includes(p.verb),
      );
      if (heroIndex >= 0) plan[heroIndex] = { verb: hero.verb, target: hero.target };
      else plan.splice(Math.max(1, plan.length - 1), 0, { verb: hero.verb, target: hero.target });
    }
  } else {
    plan = [
      { verb: 'look', dur: 1000, target: 'viewer' },
      { verb: hero?.verb ?? 'point', dur: hero ? undefined : 1300, target: hero?.target ?? 'right' },
      { verb: 'nod', dur: 800 },
      { verb: 'wave', dur: 1500 },
    ];
  }

  if (hits.some((h) => h.verb === 'wave') && !plan.some((p) => p.verb === 'wave')) {
    plan.push({ verb: 'wave', dur: 1500 });
  }

  plan = applyMood(plan, mood);

  if (plan.length < 3) plan.push({ verb: 'nod', dur: 800 });
  if (!['wave', 'nod', 'look', 'hip', 'wink', 'cheer'].includes(plan[plan.length - 1].verb)) {
    plan.push({ verb: 'wave', dur: 1500 });
  }

  // The plan is layered (archetype + detected actions + mood + closer).
  // Collapse the duplicates that layering introduces: one opening look, one
  // closing wave.
  const firstLook = plan.findIndex((p) => p.verb === 'look');
  const lastWave = plan.map((p) => p.verb).lastIndexOf('wave');
  plan = plan.filter((p, i) => {
    if (p.verb === 'look') return i === firstLook;
    if (p.verb === 'wave') return i === lastWave;
    return true;
  });

  // Keep the contract: at most seven beats, opener and closer intact.
  if (plan.length > 7) plan = [...plan.slice(0, 6), plan[plan.length - 1]];
  return plan;
}

// ---------------------------------------------------------------------------
// spec assembly

function paletteFor(arch: Archetype | null, text: string, mood: Mood, rng: () => number): Palette {
  const base: Palette = arch
    ? { ...arch.palette }
    : {
        skin: pick(rng, ['#F5B092', '#E8A87C', '#C68642', '#8D5524', '#FFD1B3']),
        hair: pick(rng, ['#4A2C1C', '#2C1810', '#1A1A1A', '#6B4F3A']),
        top: pick(rng, ['#4B63FF', '#F97316', '#14B8A6', '#EC4899', '#8B5CF6']),
        bottom: pick(rng, ['#1453A3', '#1E293B', '#3E6B48', '#4C1D95']),
        shoe: '#33333B',
        accent: '#4B63FF',
        prop: '#F8CB69',
      };

  const color = findColor(text);
  if (!color) {
    // Mood still gets a say in the light and the prop, even when the brand
    // palette is fixed. This is how "nervous" and "cozy" read at a glance.
    base.accent = mood.id === 'curious' ? base.accent : mood.accent;
    base.prop = mood.prop;
    return base;
  }

  const nonHuman = new Set(['cat', 'dog', 'bear', 'bunny', 'penguin', 'fox', 'dragon', 'blob', 'cactus', 'robot']);
  const outfitWords = /\b(shirt|top|jacket|hoodie|outfit|uniform|dress|suit)\b/i.test(text);
  if ((arch && nonHuman.has(arch.id)) || /\b(skin|fur|body)\b/i.test(text)) {
    base.skin = color.hex;
    base.hair = shade(color.hex, -0.28);
  } else if (!outfitWords && arch && arch.id !== 'chef') {
    base.top = color.hex;
  } else {
    base.top = color.hex;
  }
  base.accent = color.hex;
  base.prop = shade(color.hex, 0.2);
  return base;
}

function accessoryColorFor(accessory: Accessory, p: Palette): string {
  switch (accessory) {
    case 'chef-hat':
      return '#FFFFFF';
    case 'sun-hat':
      return '#F2C14E';
    case 'beanie':
      return p.top;
    case 'cap':
      return p.accent;
    case 'headband':
      return p.accent;
    case 'glasses':
      return '#33333B';
    case 'mustache':
      return p.hair;
    case 'cat-ears':
    case 'bear-ears':
    case 'bunny-ears':
    case 'horns':
      return p.hair;
    case 'antenna':
      return p.accent;
    default:
      return '#FFFFFF';
  }
}

function buildSpec(
  prompt: string,
  arch: Archetype | null,
  mood: Mood,
  seed: number,
  variant = 0,
): { spec: SceneSpec; interpretation: string; warnings: string[] } {
  const rng = mulberry32(seed);
  const palette = paletteFor(arch, prompt, mood, rng);
  const name = parseName(prompt) ?? pick(rng, NAME_PARTS);
  const brand = parseBrand(prompt);
  const fallbackWorlds: WorldPreset[] = ['studio', 'night', 'sky', 'garden'];
  const fallbackAccessories: Accessory[] = [
    'none',
    'beanie',
    'cap',
    'headband',
    'cat-ears',
    'bear-ears',
    'antenna',
  ];
  const fallbackHair: HairStyle[] = ['short', 'curly', 'bun', 'long'];
  const world =
    variant === 1
      ? altWorld(arch?.world ?? 'studio')
      : arch?.world ?? pick(rng, fallbackWorlds);
  const accessory = parseAccessory(
    prompt,
    arch?.accessory ?? pick(rng, fallbackAccessories),
  );
  const hairStyle: HairStyle =
    accessory === 'antenna' || accessory === 'horns'
      ? 'bald'
      : arch?.hairStyle ?? pick(rng, fallbackHair);

  let prop: PropKind = arch?.prop ?? 'none';
  const explicitColor = findColor(prompt);
  if (explicitColor && prop === 'none') prop = 'star';

  const hits = detectActions(prompt);
  const heroProp = hits.find((h) => h.prop)?.prop;
  if (heroProp) prop = heroProp;

  let plan = planFor(arch, prompt, mood);
  if (variant === 2) {
    if (!plan.some((p) => p.verb === 'wink')) plan.push({ verb: 'wink', dur: 700 });
    plan = plan.map((p) => ({ ...p, gap: 140 }));
  }

  // Keep prop and verb in the contract the compiler understands.
  const verbs = plan.map((b) => b.verb);
  if (verbs.some((v) => v === 'kick' || v === 'tennis-shot' || v === 'swing')) prop = 'ball';
  if (verbs.some((v) => v === 'hat-catch')) {
    prop = 'pancake';
  } else if (verbs.some((v) => v === 'toss') && (prop === 'none' || prop === 'ball' || prop === 'watering-can')) {
    prop = 'pancake';
  }
  if (verbs.some((v) => v === 'pour' || v === 'bloom')) prop = 'watering-can';
  if (verbs.some((v) => v === 'star-catch' || v === 'hug')) prop = 'star';

  const { beats, duration } = pack(plan, variant === 1 ? 9800 : 9200);
  const top = variant === 2 ? shade(palette.top, 0.12) : palette.top;

  const raw: SceneSpec = {
    title: `${name} — ${brand || arch?.role || 'original character'}`,
    duration,
    character: {
      name,
      skin: palette.skin,
      hair: palette.hair,
      hairStyle,
      accessory,
      accessoryColor: accessoryColorFor(accessory, palette),
      top,
      topShade: shade(top, -0.16),
      bottom: palette.bottom,
      shoe: palette.shoe,
      pattern: arch?.pattern ?? 'none',
    },
    world: { preset: world, accent: palette.accent },
    prop: { kind: prop, color: palette.prop },
    beats,
  };

  const { spec, warnings } = validate(raw);
  const interpretation = interpretationFor(spec, arch, mood, brand);
  return { spec, interpretation, warnings };
}

function altWorld(world: WorldPreset): WorldPreset {
  const order: WorldPreset[] = ['studio', 'night', 'sky', 'garden', 'kitchen'];
  const i = order.indexOf(world);
  return order[(i + 1) % order.length];
}

function interpretationFor(
  spec: SceneSpec,
  arch: Archetype | null,
  mood: Mood,
  brand: string,
): string {
  const who = arch ? `${mood.label} ${arch.label}` : `${mood.label} character`;
  const prop = PROP_LABEL[spec.prop.kind];
  const lead = article(who);
  return `${lead.charAt(0).toUpperCase()}${lead.slice(1)} ${who}${brand ? ` for ${brand}` : ''} in a ${
    WORLD_LABEL[spec.world.preset]
  } world${prop ? `, with ${prop}` : ''}`;
}

// ---------------------------------------------------------------------------
// public director

const EDIT_RE =
  /\b(make|add|remove|delete|take off|change|turn|keep|give|put|rename|call|set|swap|switch|replace|adjust|tweak|update|use|try|show|hide|bring|move|speed|slow|faster|slower|bright|dark|calm|more|less|without|outfit|background|world|night|day|color|colour|red|blue|green|pink|purple|black|white|yellow|orange|beanie|cap|hat|glasses|headband|ears|horns|antenna|mustache)\b/i;

const NEW_RE = /^(?:a|an|create|design|draw|build|generate|another|new)\b/i;
const NEW_MAKE_RE = /^(?:make|build|create|design|draw|generate)\s+(?:a|an)\b/i;

// A brief is an edit only when it reads like one. A sentence that introduces a
// character ("Our logo, a blue hexagon…", "Meet the new mascot…") is a new
// scene even though it contains edit words like "blue" or "wave".
const NEW_BRIEF_RE =
  /^(?:a|an|our|my|your|their|his|her|its|here|meet|introducing|presenting|two|three|four|five|six|seven|eight|nine|ten)\b/i;
const EDIT_START_RE =
  /^(?:make|add|remove|delete|take off|change|turn|keep|give|put|rename|call|set|swap|switch|replace|adjust|tweak|update|use|try|show|hide|bring|move|speed|slow|without)\b/i;

function looksLikeEdit(text: string): boolean {
  const t = text.trim();
  if (/\b(new character|start over|another character|remix|different character)\b/i.test(t)) {
    return false;
  }
  if (NEW_RE.test(t) || NEW_MAKE_RE.test(t) || NEW_BRIEF_RE.test(t)) return false;
  if (EDIT_START_RE.test(t)) return true;
  const words = t.split(/\s+/).length;
  // "The mascot is a blue hexagon that waves" introduces a character; "the hat
  // should go" is still an edit.
  if (/\b(?:is|are|was|were)\s+(?:a|an|the)\b/i.test(t) && words >= 6) return false;
  if (words <= 4 && EDIT_RE.test(t)) return true;
  return EDIT_RE.test(t);
}

function cloneSpec(spec: SceneSpec): SceneSpec {
  return {
    ...spec,
    character: { ...spec.character },
    world: { ...spec.world },
    prop: { ...spec.prop },
    beats: spec.beats.map((b) => ({ ...b })),
  };
}

function scaleBeats(beats: BeatSpec[], factor: number, maxDuration: number): BeatSpec[] {
  return beats.map((b) => ({
    ...b,
    at: Math.max(0, Math.round(b.at * factor)),
    dur: Math.min(7200, Math.max(400, Math.round((b.dur ?? 1200) * factor))),
  })).filter((b) => beatEnd(b.at, b.verb, b.dur ?? 0) <= maxDuration - 200);
}

function applyEdit(previous: Directed, prompt: string, seed: number): Directed {
  const spec = cloneSpec(previous.spec);
  const lower = prompt.toLowerCase();
  const changes: string[] = [];
  let plan: PlanBeat[] = spec.beats.map((b) => ({
    verb: b.verb,
    dur: b.dur,
    target: b.target,
  }));
  let duration = spec.duration;

  const name = parseName(prompt);
  if (name) {
    spec.character.name = name;
    spec.title = `${name} — ${spec.title.split(' — ')[1] ?? 'original character'}`;
    changes.push(`renamed it ${name}`);
  }

  const world = parseWorld(prompt, spec.world.preset);
  if (world !== spec.world.preset) {
    spec.world.preset = world;
    changes.push(`moved it to the ${WORLD_LABEL[world]} world`);
  }

  const accessory = parseAccessory(prompt, spec.character.accessory);
  if (accessory !== spec.character.accessory) {
    spec.character.accessory = accessory;
    spec.character.accessoryColor = accessoryColorFor(accessory, {
      skin: spec.character.skin,
      hair: spec.character.hair,
      top: spec.character.top,
      bottom: spec.character.bottom,
      shoe: spec.character.shoe,
      accent: spec.world.accent,
      prop: spec.prop.color,
    });
    changes.push(accessory === 'none' ? 'removed the accessory' : `added ${accessory.replace(/-/g, ' ')}`);
  }

  const color = findColor(prompt);
  if (color) {
    if (/\b(skin|fur|body)\b/i.test(lower)) {
      spec.character.skin = color.hex;
      changes.push(`made the character ${color.word}`);
    } else {
      spec.character.top = color.hex;
      spec.character.topShade = shade(color.hex, -0.16);
      spec.world.accent = color.hex;
      spec.prop.color = shade(color.hex, 0.2);
      changes.push(`turned the outfit ${color.word}`);
    }
  }

  if (/\b(faster|quicker|speed it up)\b/i.test(lower)) {
    duration = Math.max(6000, Math.round((duration * 0.84) / 100) * 100);
    plan = plan.map((b) => ({ ...b, dur: Math.round((b.dur ?? 1200) * 0.84), gap: 110 }));
    changes.push('sped up the loop');
  } else if (/\b(slower|slow it down|take your time)\b/i.test(lower)) {
    duration = Math.min(14000, Math.round((duration * 1.16) / 100) * 100);
    plan = plan.map((b) => ({ ...b, dur: Math.round((b.dur ?? 1200) * 1.16), gap: 260 }));
    changes.push('slowed the loop down');
  }

  const mood = moodFor(prompt);
  if (mood.id !== 'curious' && /\b(more|less|make it|feel|mood|vibe)\b/i.test(lower)) {
    plan = applyMood(plan, mood);
    spec.world.accent = mood.accent;
    spec.prop.color = mood.prop;
    changes.push(`made it feel more ${mood.label}`);
  }

  const hits = detectActions(prompt);
  const hero = hits.find((h) => h.plan) ?? hits[0];
  if (hero) {
    if (hero.plan) {
      plan = [...hero.plan, { verb: 'wave', dur: 1500 }];
    } else {
      const last = plan[plan.length - 1];
      if (last?.verb === 'wave') plan.splice(Math.max(1, plan.length - 1), 0, { verb: hero.verb, target: hero.target });
      else plan.push({ verb: hero.verb, target: hero.target });
    }
    changes.push(`added a ${hero.verb === 'star-catch' ? 'star catch' : hero.verb.replace(/-/g, ' ')}`);
  }

  if (hero?.prop) spec.prop.kind = hero.prop;
  if (!hero?.prop) {
    if (/\bgift\b/i.test(lower)) {
      spec.prop.kind = 'gift';
      if (!plan.some((p) => p.verb === 'toss')) plan.push({ verb: 'toss', dur: 1700 });
      changes.push('gave it a gift');
    } else if (/\bcup\b|\bcoffee\b/i.test(lower)) {
      spec.prop.kind = 'cup';
      changes.push('gave it a cup');
    } else if (/\bheart\b/i.test(lower)) {
      spec.prop.kind = 'heart';
      changes.push('gave it a heart');
    } else if (/\bball\b/i.test(lower)) {
      spec.prop.kind = 'ball';
      changes.push('gave it a ball');
    }
  }

  const verbs = plan.map((b) => b.verb);
  if (verbs.some((v) => v === 'kick' || v === 'tennis-shot' || v === 'swing')) spec.prop.kind = 'ball';
  if (verbs.some((v) => v === 'hat-catch')) {
    spec.prop.kind = 'pancake';
    spec.character.accessory = 'chef-hat';
  } else if (verbs.some((v) => v === 'toss') && (spec.prop.kind === 'none' || spec.prop.kind === 'ball')) {
    spec.prop.kind = 'pancake';
  }
  if (verbs.some((v) => v === 'pour' || v === 'bloom')) spec.prop.kind = 'watering-can';
  if (verbs.some((v) => v === 'star-catch' || v === 'hug')) spec.prop.kind = 'star';

  if (plan.length > 7) plan = [...plan.slice(0, 5), ...plan.slice(-2)];

  if (changes.length === 0) {
    // A useful, honest fallback: a small punctuation beat, never a dead end.
    plan.push({ verb: 'wink', dur: 700 });
    changes.push('added a wink');
  }

  const packed = pack(plan, duration);
  spec.duration = packed.duration;
  spec.beats = packed.beats;

  const { spec: clean, warnings } = validate(spec);
  return {
    spec: clean,
    prompt,
    interpretation: previous.interpretation,
    story: storyFor(clean.beats),
    notes: warnings,
    seed,
    kind: 'edit',
    change: changes.join(', '),
  };
}

export function direct(prompt: string, opts: DirectOptions = {}): Directed {
  const text = prompt.trim() || STARTER_PROMPTS[0].prompt;
  const seed = (opts.seed ?? hashText(text)) >>> 0;
  const previous = opts.previous && 'spec' in opts.previous ? opts.previous : null;

  if (previous && looksLikeEdit(text) && !/\b(new character|start over|another character|remix)\b/i.test(text)) {
    return applyEdit(previous, text, seed);
  }

  const arch = opts.archetypeId
    ? ARCHETYPES.find((a) => a.id === opts.archetypeId) ?? matchArchetype(text)
    : matchArchetype(text);
  const mood = moodFor(text);
  const variant = opts.variant ?? 0;
  const built = buildSpec(text, arch, mood, seed, variant);
  return {
    spec: built.spec,
    prompt: text,
    interpretation: built.interpretation,
    story: storyFor(built.spec.beats),
    notes: built.warnings,
    seed,
    kind: 'new',
    change: '',
  };
}

/**
 * Hybrid seam: if a hosted director is configured, it gets first refusal. It
 * must return `{ spec, direction?, story? }` — a SceneSpec, never SVG. If it
 * times out or returns something invalid, the local director answers instead,
 * so the demo never has a dead end.
 */
export async function directAsync(prompt: string, opts: DirectOptions = {}): Promise<Directed> {
  const endpoint = process.env.NEXT_PUBLIC_DIRECTOR_ENDPOINT;
  const previous = opts.previous && 'spec' in opts.previous ? opts.previous : null;
  if (!endpoint || (previous && looksLikeEdit(prompt))) return direct(prompt, opts);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2600);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('director unavailable');
    const data = (await response.json()) as {
      spec?: unknown;
      direction?: string;
      story?: string;
    };
    const { spec, warnings } = validate(data.spec ?? data);
    if (!spec.beats.length) throw new Error('empty direction');
    return {
      spec,
      prompt,
      interpretation: data.direction ?? `A custom character in a ${WORLD_LABEL[spec.world.preset]} world`,
      story: data.story ?? storyFor(spec.beats),
      notes: warnings,
      seed: hashText(prompt),
      kind: 'new',
      change: '',
    };
  } catch {
    return direct(prompt, opts);
  } finally {
    clearTimeout(timer);
  }
}

export function directVariants(prompt: string, count = 3, variantOffset = 0): Directed[] {
  const text = prompt.trim() || STARTER_PROMPTS[0].prompt;
  const base = hashText(text);
  const explicit = matchArchetype(text);
  // A named character (chef, ninja, cat) stays itself across auditions. A
  // generic brief ("a mascot for a startup") gets three genuinely different
  // casts so the user can pick a direction, not three colour swaps.
  const strong =
    explicit && (explicit.priority >= 3 || parseName(text) !== null) ? explicit : null;
  const castIds = [
    'astronomer',
    'robot',
    'cat',
    'chef',
    'blob',
    'gardener',
    'tennis',
    'barista',
    'detective',
    'bunny',
    'dragon',
    'musician',
    'superhero',
    'critter',
  ];
  const offset = base % castIds.length;
  const out: Directed[] = [];
  const used = new Set<string>();
  for (let i = 0; i < count; i++) {
    let id: string | undefined;
    if (strong) {
      id = strong.id;
    } else if (i === 0 && explicit) {
      id = explicit.id;
    } else {
      let cursor = offset + i * 3;
      for (let tries = 0; tries < castIds.length; tries++) {
        const candidate = castIds[cursor % castIds.length];
        if (!used.has(candidate)) {
          id = candidate;
          break;
        }
        cursor += 1;
      }
    }
    if (id) used.add(id);
    out.push(
      direct(text, {
        seed: base + i * 97 + 11,
        archetypeId: id,
        variant: i + variantOffset,
      }),
    );
  }
  return out;
}

export function replayFromSpec(spec: SceneSpec, prompt = 'Shared performance'): Directed {
  const { spec: clean, warnings } = validate(spec);
  return {
    spec: clean,
    prompt,
    interpretation: `A shared ${clean.character.name} performance in a ${WORLD_LABEL[clean.world.preset]} world`,
    story: storyFor(clean.beats),
    notes: warnings,
    seed: hashText(JSON.stringify(spec)),
    kind: 'new',
    change: '',
  };
}

export { hashText, shade, WORLD_LABEL as worldLabel, PROP_LABEL as propLabel };
