import { direct } from './director';
import { compileScore } from './motion/score';
import type { CompiledScore } from './mascot/types';

export type Showcase = {
  id: string;
  brief: string;
  compiled: CompiledScore;
  tags: string[];
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
