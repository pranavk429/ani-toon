import type { Genome, Personality } from './types';
import { makePalette, PALETTE_PRESETS, type BrandColorInput } from './palette';

const DEFAULT_PERSONALITY: Personality = {
  energy: 0.55,
  warmth: 0.72,
  calm: 0.45,
  snappiness: 0.5,
  playfulness: 0.5,
};

function base(partial: Partial<Genome> = {}): Genome {
  return {
    id: 'ani',
    name: 'Pip',
    brand: 'Your brand',
    tagline: 'A little character with a lot of heart.',
    concept: 'a friendly little creature',
    head: { shape: 'round', w: 108, h: 96, tilt: 0 },
    ears: { type: 'round', size: 20, spread: 40, tilt: 0 },
    face: {
      eyeW: 28,
      eyeH: 34,
      eyeGap: 21,
      eyeY: -8,
      pupil: 13,
      shine: 3,
      nose: 'oval',
      muzzle: true,
      mouth: 'smile',
      brows: 'soft',
      blush: 0.55,
      freckles: false,
      lashes: false,
      whiskers: false,
    },
    body: { shape: 'round', w: 78, h: 72, belly: true },
    arms: { len: 54, width: 22, hand: 11 },
    legs: { len: 26, width: 18, foot: 'round' },
    tail: { type: 'stub', size: 14 },
    pattern: 'none',
    extras: { wings: false, gills: false, horn: false, leaf: false, flame: false },
    outfit: 'none',
    accessory: 'none',
    prop: 'none',
    palette: makePalette(PALETTE_PRESETS.ember.input),
    personality: { ...DEFAULT_PERSONALITY },
    logo: { image: '', mark: 'spark', initial: 'A' },
    ...partial,
  };
}

export type SpeciesKey =
  | 'bear'
  | 'bunny'
  | 'fox'
  | 'owl'
  | 'frog'
  | 'blob'
  | 'robot'
  | 'cup'
  | 'otter'
  | 'axolotl';

export const SPECIES: Record<SpeciesKey, { label: string; hint: string; genome: Genome }> = {
  bear: {
    label: 'Bear',
    hint: 'warm, sturdy, huggable',
    genome: base({
      concept: 'a warm bear',
      head: { shape: 'round', w: 110, h: 98, tilt: 0 },
      ears: { type: 'round', size: 21, spread: 41, tilt: 0 },
      face: { ...base().face, eyeGap: 22, eyeY: -7, nose: 'oval', muzzle: true, mouth: 'smile', blush: 0.6 },
      body: { shape: 'round', w: 80, h: 74, belly: true },
      arms: { len: 54, width: 23, hand: 11 },
      tail: { type: 'stub', size: 13 },
      pattern: 'belly',
    }),
  },
  bunny: {
    label: 'Bunny',
    hint: 'soft, quick, sweet',
    genome: base({
      concept: 'a soft bunny',
      head: { shape: 'round', w: 104, h: 94, tilt: 0 },
      ears: { type: 'long', size: 58, spread: 21, tilt: -4 },
      face: { ...base().face, eyeGap: 20, nose: 'triangle', mouth: 'smile', blush: 0.7 },
      body: { shape: 'pear', w: 72, h: 76, belly: true },
      arms: { len: 52, width: 20, hand: 10 },
      legs: { len: 30, width: 17, foot: 'long' },
      tail: { type: 'puff', size: 17 },
      pattern: 'belly',
    }),
  },
  fox: {
    label: 'Fox',
    hint: 'clever, bright, confident',
    genome: base({
      concept: 'a clever fox',
      head: { shape: 'wide', w: 112, h: 92, tilt: 0 },
      ears: { type: 'pointy', size: 30, spread: 36, tilt: 0 },
      face: { ...base().face, eyeGap: 22, eyeY: -6, nose: 'triangle', muzzle: true, mouth: 'cat', whiskers: true, blush: 0.4 },
      body: { shape: 'pear', w: 70, h: 72, belly: true },
      arms: { len: 52, width: 20, hand: 10 },
      legs: { len: 28, width: 16, foot: 'round' },
      tail: { type: 'bushy', size: 30 },
      pattern: 'blaze',
    }),
  },
  owl: {
    label: 'Owl',
    hint: 'wise, calm, a little funny',
    genome: base({
      concept: 'a wise owl',
      head: { shape: 'round', w: 110, h: 96, tilt: 0 },
      ears: { type: 'tuft', size: 15, spread: 34, tilt: 0 },
      face: {
        ...base().face,
        eyeW: 34,
        eyeH: 38,
        eyeGap: 24,
        eyeY: -6,
        nose: 'beak',
        muzzle: false,
        mouth: 'wide',
        brows: 'none',
        blush: 0.35,
        lashes: true,
      },
      body: { shape: 'egg', w: 82, h: 78, belly: true },
      arms: { len: 48, width: 20, hand: 10 },
      legs: { len: 20, width: 15, foot: 'talon' },
      tail: { type: 'none', size: 0 },
      pattern: 'spots',
      extras: { wings: true, gills: false, horn: false, leaf: false, flame: false },
    }),
  },
  frog: {
    label: 'Frog',
    hint: 'sunny, open, a little goofy',
    genome: base({
      concept: 'a sunny frog',
      head: { shape: 'wide', w: 118, h: 88, tilt: 0 },
      ears: { type: 'none', size: 0, spread: 0, tilt: 0 },
      face: {
        ...base().face,
        eyeW: 30,
        eyeH: 34,
        eyeGap: 26,
        eyeY: -13,
        nose: 'none',
        muzzle: false,
        mouth: 'wide',
        brows: 'none',
        blush: 0.5,
        lashes: false,
      },
      body: { shape: 'blob', w: 78, h: 64, belly: true },
      arms: { len: 46, width: 18, hand: 10 },
      legs: { len: 24, width: 16, foot: 'webbed' },
      tail: { type: 'none', size: 0 },
      pattern: 'spots',
    }),
  },
  blob: {
    label: 'Blob',
    hint: 'mutable, friendly, weird in a good way',
    genome: base({
      concept: 'a friendly blob',
      head: { shape: 'blob', w: 102, h: 98, tilt: 0 },
      ears: { type: 'antenna', size: 16, spread: 24, tilt: 6 },
      face: { ...base().face, eyeGap: 20, nose: 'none', muzzle: false, mouth: 'smile', brows: 'soft', blush: 0.45 },
      body: { shape: 'blob', w: 78, h: 70, belly: false },
      arms: { len: 44, width: 18, hand: 10 },
      legs: { len: 20, width: 15, foot: 'round' },
      tail: { type: 'none', size: 0 },
      pattern: 'none',
      extras: { wings: false, gills: false, horn: false, leaf: true, flame: false },
    }),
  },
  robot: {
    label: 'Robot',
    hint: 'precise, helpful, unexpectedly sweet',
    genome: base({
      concept: 'a helpful little robot',
      head: { shape: 'screen', w: 104, h: 90, tilt: 0 },
      ears: { type: 'antenna', size: 18, spread: 0, tilt: 0 },
      face: {
        ...base().face,
        eyeW: 30,
        eyeH: 22,
        eyeGap: 22,
        eyeY: -4,
        pupil: 12,
        shine: 0,
        nose: 'none',
        muzzle: false,
        mouth: 'wide',
        brows: 'none',
        blush: 0,
        lashes: false,
      },
      body: { shape: 'box', w: 72, h: 68, belly: false },
      arms: { len: 48, width: 16, hand: 9 },
      legs: { len: 18, width: 14, foot: 'hover' },
      tail: { type: 'none', size: 0 },
      pattern: 'none',
      outfit: 'none',
      accessory: 'none',
    }),
  },
  cup: {
    label: 'Cup',
    hint: 'cosy, crafted, always warm',
    genome: base({
      concept: 'a cosy coffee cup',
      head: { shape: 'cup', w: 106, h: 100, tilt: 0 },
      ears: { type: 'none', size: 0, spread: 0, tilt: 0 },
      face: { ...base().face, eyeGap: 21, eyeY: -2, nose: 'none', muzzle: false, mouth: 'smile', brows: 'soft', blush: 0.55 },
      body: { shape: 'round', w: 70, h: 62, belly: true },
      arms: { len: 46, width: 18, hand: 10 },
      legs: { len: 20, width: 15, foot: 'round' },
      tail: { type: 'none', size: 0 },
      pattern: 'none',
      prop: 'none',
    }),
  },
  otter: {
    label: 'Otter',
    hint: 'playful, loyal, a little sleepy',
    genome: base({
      concept: 'a playful otter',
      head: { shape: 'wide', w: 108, h: 94, tilt: 0 },
      ears: { type: 'round', size: 14, spread: 38, tilt: 0 },
      face: { ...base().face, eyeGap: 22, nose: 'oval', muzzle: true, mouth: 'smile', whiskers: true, blush: 0.55 },
      body: { shape: 'pear', w: 74, h: 72, belly: true },
      arms: { len: 50, width: 21, hand: 10 },
      legs: { len: 24, width: 16, foot: 'webbed' },
      tail: { type: 'thin', size: 28 },
      pattern: 'belly',
    }),
  },
  axolotl: {
    label: 'Axolotl',
    hint: 'dreamy, gentle, unexpectedly magical',
    genome: base({
      concept: 'a dreamy axolotl',
      head: { shape: 'wide', w: 112, h: 94, tilt: 0 },
      ears: { type: 'none', size: 0, spread: 0, tilt: 0 },
      face: { ...base().face, eyeGap: 22, nose: 'none', muzzle: false, mouth: 'smile', blush: 0.75, lashes: true },
      body: { shape: 'pear', w: 74, h: 72, belly: true },
      arms: { len: 48, width: 20, hand: 10 },
      legs: { len: 24, width: 16, foot: 'round' },
      tail: { type: 'thin', size: 30 },
      pattern: 'none',
      extras: { wings: false, gills: true, horn: false, leaf: false, flame: false },
    }),
  },
};

const SPECIES_WORDS: Array<[SpeciesKey, RegExp]> = [
  ['bear', /\b(bear|panda|teddy|grizzly|koala)\b/i],
  ['bunny', /\b(bunny|rabbit|hare|cottontail)\b/i],
  ['fox', /\b(fox|wolf|dog|puppy|shiba|corgi|husky)\b/i],
  ['owl', /\b(owl|bird|duck|penguin|chick|eagle|parrot)\b/i],
  ['frog', /\b(frog|toad|dino|dinosaur|lizard|gecko)\b/i],
  ['blob', /\b(blob|slime|ghost|cloud|star|alien|monster|creature|sprout|seed)\b/i],
  ['robot', /\b(robot|bot|android|machine|ai|computer|chip)\b/i],
  ['cup', /\b(cup|coffee|tea|latte|espresso|mug|drink|cafe|barista)\b/i],
  ['otter', /\b(otter|seal|beaver|cat|kitten|raccoon)\b/i],
  ['axolotl', /\b(axolotl|salamander|fish|octopus|squid|jellyfish)\b/i],
];

const INDUSTRY_SPECIES: Array<[SpeciesKey, RegExp]> = [
  ['cup', /\b(coffee|cafe|bakery|food|restaurant|drink|tea|matcha)\b/i],
  ['fox', /\b(finance|fintech|bank|invest|crypto|consult|strategy|legal)\b/i],
  ['owl', /\b(education|learning|study|school|course|book|publish|research)\b/i],
  ['bunny', /\b(wellness|health|care|beauty|skincare|baby|kids|yoga|therapy)\b/i],
  ['frog', /\b(eco|climate|green|sustain|garden|farm|outdoor|energy)\b/i],
  ['robot', /\b(dev|developer|software|saas|data|ai|tech|api|cloud|cyber)\b/i],
  ['otter', /\b(travel|hospitality|hotel|community|social| pet)\b/i],
  ['bear', /\b(home|furniture|real estate|construction|cozy|family)\b/i],
];

// Each species starts from a different palette family so the generator's range is
// visible immediately. The director still overrides every colour from the brief.
const SPECIES_PALETTES: Record<SpeciesKey, BrandColorInput> = {
  bear: { primary: '#C98A5B', secondary: '#3E6B57', accent: '#F2A65A', family: 'warm' },
  bunny: { primary: '#E8B7C0', secondary: '#6B5B95', accent: '#F6D6A8', family: 'soft' },
  fox: { primary: '#D8743F', secondary: '#2F5D5A', accent: '#F4C15D', family: 'warm' },
  owl: { primary: '#A393B0', secondary: '#4B3F63', accent: '#F2C14E', family: 'soft' },
  frog: { primary: '#79B96A', secondary: '#20574B', accent: '#F4A259', family: 'fresh' },
  blob: { primary: '#7FD0B5', secondary: '#4B3A78', accent: '#FFD166', family: 'cool' },
  robot: { primary: '#AEB9C6', secondary: '#2B3A55', accent: '#64D8E8', family: 'cool' },
  cup: { primary: '#C97A52', secondary: '#5C4033', accent: '#F2D7A0', family: 'warm' },
  otter: { primary: '#B9845C', secondary: '#2C4A6B', accent: '#F0B45A', family: 'warm' },
  axolotl: { primary: '#EFA9C4', secondary: '#4C7C7C', accent: '#9BE3D6', family: 'soft' },
};
for (const key of Object.keys(SPECIES) as SpeciesKey[]) {
  SPECIES[key].genome.palette = makePalette(SPECIES_PALETTES[key]);
}

export function speciesFromText(text: string): { key: SpeciesKey; explicit: boolean } {
  for (const [key, re] of SPECIES_WORDS) if (re.test(text)) return { key, explicit: true };
  for (const [key, re] of INDUSTRY_SPECIES) if (re.test(text)) return { key, explicit: false };
  return { key: 'bear', explicit: false };
}

/** Build a genome from a species, then allow the director to morph it. */
export function genomeFor(key: SpeciesKey, overrides: Partial<Genome> = {}): Genome {
  const preset = SPECIES[key].genome;
  return {
    ...preset,
    ...overrides,
    speciesKey: key,
    head: { ...preset.head, ...(overrides.head ?? {}) },
    ears: { ...preset.ears, ...(overrides.ears ?? {}) },
    face: { ...preset.face, ...(overrides.face ?? {}) },
    body: { ...preset.body, ...(overrides.body ?? {}) },
    arms: { ...preset.arms, ...(overrides.arms ?? {}) },
    legs: { ...preset.legs, ...(overrides.legs ?? {}) },
    tail: { ...preset.tail, ...(overrides.tail ?? {}) },
    extras: { ...preset.extras, ...(overrides.extras ?? {}) },
    palette: { ...preset.palette, ...(overrides.palette ?? {}) },
    personality: { ...preset.personality, ...(overrides.personality ?? {}) },
    logo: { ...preset.logo, ...(overrides.logo ?? {}) },
  };
}

/** Hybridize two species: the director can create something new. */
export function hybridGenome(a: SpeciesKey, b: SpeciesKey, mix = 0.5): Genome {
  const A = SPECIES[a].genome;
  const B = SPECIES[b].genome;
  const k = Math.max(0.2, Math.min(0.8, mix));
  const pick = <T,>(x: T, y: T) => (Math.random() < k ? x : y);
  return genomeFor(a, {
    concept: `${SPECIES[a].label.toLowerCase()}-${SPECIES[b].label.toLowerCase()} hybrid`,
    head: { ...A.head, w: A.head.w + (B.head.w - A.head.w) * k, h: A.head.h + (B.head.h - A.head.h) * k },
    ears: { ...B.ears },
    tail: { ...B.tail },
    body: { ...A.body, w: A.body.w + (B.body.w - A.body.w) * k, h: A.body.h + (B.body.h - A.body.h) * k },
    pattern: pick(A.pattern, B.pattern),
    extras: { ...A.extras, ...B.extras },
    accessory: pick(A.accessory, B.accessory),
  });
}

export function defaultGenome(): Genome {
  return genomeFor('bear');
}
