import { direct } from './director';
import { compileScore } from './motion/score';
import type { CompiledScore } from './mascot/types';

export type Showcase = {
  id: string;
  brief: string;
  compiled: CompiledScore;
  tags: string[];
};

export type Project = Showcase & {
  title: string;
  brand: string;
  category: 'brand' | 'studio';
  description: string;
  chips: string[];
};

const BRIEFS = [
  {
    id: 'mochi',
    brief: 'A cozy bear barista named Mochi for Ember Coffee. Warm, a little sleepy, waves hello and sips a latte.',
    tags: ['bear', 'coffee', 'warm'],
  },
  {
    id: 'juno',
    brief: 'A mischievous fox named Juno for Ledger & Co, a fintech startup. Sharp, quick, points at the chart and winks.',
    tags: ['fox', 'fintech', 'quick'],
  },
  {
    id: 'lumi',
    brief: 'A dreamy axolotl named Lumi for Soft Hours, a mindfulness app. Soft pastels, calm, breathes and stretches.',
    tags: ['axolotl', 'wellness', 'calm'],
  },
  {
    id: 'bolt',
    brief: 'A tiny robot named Bolt for Tinker, a developer tool. Cool silver and electric blue, helpful, presents a laptop.',
    tags: ['robot', 'devtool', 'precise'],
  },
  {
    id: 'pip',
    brief: 'A sunny frog named Pip for Moss & Main, a climate startup. Bright green, optimistic, hops and cheers.',
    tags: ['frog', 'climate', 'sunny'],
  },
  {
    id: 'coco',
    brief: 'A fluffy bunny named Coco for Dewdrop, a skincare brand. Blush pink, gentle, waves and blinks slowly.',
    tags: ['bunny', 'beauty', 'gentle'],
  },
];

export const SHOWCASE: Showcase[] = BRIEFS.map((b, i) => {
  const result = direct(b.brief, { seed: 4100 + i * 37 });
  return {
    id: b.id,
    brief: b.brief,
    tags: b.tags,
    compiled: compileScore({ ...result.score, duration: 9000 }, result.genome),
  };
});

export const HERO_MASCOTS = SHOWCASE.slice(0, 4);

const PROJECT_META: Record<string, Omit<Project, keyof Showcase>> = {
  mochi: {
    title: 'Mochi',
    brand: 'Ember Coffee',
    category: 'brand',
    description:
      'A cozy bear barista for a slow-coffee brand. Warm, a little sleepy, waves you in, takes a sip, then settles into a satisfied nod. The cup follows the hand; the head trails the lean by 110 ms.',
    chips: ['Bear', 'Coffee', 'Warm'],
  },
  juno: {
    title: 'Juno',
    brand: 'Ledger & Co',
    category: 'brand',
    description:
      'A sharp fox for a fintech startup. Quick, mischievous, points at the chart, winks, and lands the close. The performance is written as channel curves, not picked from a move menu.',
    chips: ['Fox', 'Fintech', 'Quick'],
  },
  lumi: {
    title: 'Lumi',
    brand: 'Soft Hours',
    category: 'studio',
    description:
      'A dreamy axolotl for a mindfulness app. Soft pastels, a long breath, a stretch, and a blink timed to the head turn. The whole character and its loop live in a few kilobytes of vector.',
    chips: ['Axolotl', 'Wellness', 'Calm'],
  },
  bolt: {
    title: 'Bolt',
    brand: 'Tinker',
    category: 'studio',
    description:
      'A tiny robot for a developer tool. Cool silver, electric blue, presents a laptop, blinks twice, and powers down. Every frame is a pure function of one clock, so it never drifts.',
    chips: ['Robot', 'Devtool', 'Precise'],
  },
};

export const PROJECTS: Project[] = SHOWCASE.filter((showcase) => PROJECT_META[showcase.id]).map((showcase) => ({
  ...showcase,
  ...PROJECT_META[showcase.id],
}));
