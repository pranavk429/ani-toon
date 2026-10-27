import type { AccessoryType, ActionName, OutfitType, PropType } from '../mascot/types';

// Words the director understands. This is deliberately small and legible: every
// entry maps to a real trait, never to a canned character.

export const COLOR_WORDS: Record<string, { hex: string; role: 'primary' | 'secondary' | 'accent' }> = {
  honey: { hex: '#D79A55', role: 'primary' },
  caramel: { hex: '#B97A4B', role: 'primary' },
  coffee: { hex: '#8B5E3C', role: 'primary' },
  mocha: { hex: '#7B4B36', role: 'primary' },
  cream: { hex: '#F3E3C8', role: 'accent' },
  butter: { hex: '#F2C75C', role: 'accent' },
  mustard: { hex: '#D9A62E', role: 'accent' },
  orange: { hex: '#E07A3F', role: 'primary' },
  coral: { hex: '#F07C6C', role: 'accent' },
  peach: { hex: '#F3B38C', role: 'primary' },
  red: { hex: '#D94F4F', role: 'primary' },
  tomato: { hex: '#E1543E', role: 'primary' },
  pink: { hex: '#E8A7BC', role: 'primary' },
  rose: { hex: '#DE8FA5', role: 'primary' },
  blush: { hex: '#F4C6CC', role: 'accent' },
  purple: { hex: '#9A86C8', role: 'primary' },
  lavender: { hex: '#B7A6D9', role: 'primary' },
  violet: { hex: '#7D6BB0', role: 'primary' },
  blue: { hex: '#6D8FD8', role: 'primary' },
  navy: { hex: '#2E3A59', role: 'secondary' },
  sky: { hex: '#9BC4E8', role: 'primary' },
  teal: { hex: '#3E8E86', role: 'primary' },
  turquoise: { hex: '#54B8AE', role: 'primary' },
  mint: { hex: '#8FD4B8', role: 'primary' },
  green: { hex: '#79B96A', role: 'primary' },
  sage: { hex: '#9DB58E', role: 'primary' },
  olive: { hex: '#7C8A4E', role: 'primary' },
  forest: { hex: '#2F5D4A', role: 'secondary' },
  yellow: { hex: '#F2C94C', role: 'accent' },
  gold: { hex: '#D9A62E', role: 'accent' },
  black: { hex: '#2B2D42', role: 'secondary' },
  charcoal: { hex: '#33343D', role: 'secondary' },
  white: { hex: '#F8F5EE', role: 'accent' },
  silver: { hex: '#B9C2CC', role: 'primary' },
};

export const VIBE_WORDS = {
  warm: /warm|cozy|cosy|homely|friendly|hug|soft|comfort|bakery|coffee|tea|cafe|kitchen|home/,
  cool: /cool|premium|sleek|modern|future|tech|ai|software|cloud|data|crypto|fintech|bank/,
  fresh: /fresh|green|eco|sustain|nature|plant|garden|health|organic|climate|farm/,
  bold: /bold|energetic|hype|game|gaming|sport|fitness|street|loud|vivid|playful/,
  soft: /soft|gentle|calm|dreamy|pastel|wellness|beauty|baby|care|mindful|serene|sleep/,
  mono: /minimal|luxury|editorial|mono|premium|studio|architect|fashion|clean/,
} as const;

export const PROPS: Array<[PropType, RegExp]> = [
  ['cup', /\b(coffee|tea|latte|matcha|espresso|drink|cafe|barista|mug|brew|roast)\b/],
  ['phone', /\b(phone|mobile|social|app|text|message|fintech|bank)\b/],
  ['laptop', /\b(laptop|software|code|developer|saas|platform|computer|tech|ai)\b/],
  ['package', /\b(delivery|shipping|logistics|package|order|commerce|store|shop)\b/],
  ['plant', /\b(plant|garden|eco|green|sustain|climate|farm|nature|wellness)\b/],
  ['star', /\b(star|magic|sparkle|premium|favorite|review|rating)\b/],
  ['heart', /\b(love|heart|care|health|charity|community|dating|family)\b/],
  ['megaphone', /\b(marketing|announce|launch|social|media|newsletter|brand)\b/],
  ['book', /\b(book|education|learn|school|course|read|publish|study)\b/],
  ['bag', /\b(shop|store|fashion|retail|ecommerce|travel|bag)\b/],
];

export const OUTFITS: Array<[OutfitType, RegExp]> = [
  ['apron', /\b(coffee|cafe|bakery|chef|kitchen|food|barista|restaurant)\b/],
  ['scarf', /\b(cozy|cosy|winter|warm|autumn|travel|outdoor|home)\b/],
  ['hoodie', /\b(developer|startup|software|community|student|casual|gaming|tech)\b/],
  ['collar', /\b(finance|bank|legal|consult|premium|formal|business)\b/],
  ['bowtie', /\b(formal|premium|luxury|hotel|concierge|wedding)\b/],
];

export const ACCESSORIES: Array<[AccessoryType, RegExp]> = [
  ['beanie', /\b(cozy|cosy|winter|cold|beanie|outdoor|cabin)\b/],
  ['cap', /\b(delivery|sport|cap|runner|logistics|street)\b/],
  ['glasses', /\b(smart|nerd|developer|study|book|intellectual|designer)\b/],
  ['headphones', /\b(music|podcast|audio|sound|focus|study|dj)\b/],
  ['flower', /\b(flower|bloom|spring|beauty|garden|friendly|nature)\b/],
  ['crown', /\b(premium|luxury|king|queen|royal|win|champion|best)\b/],
  ['badge', /\b(badge|team|club|community|member|official)\b/],
];

export const ACTION_WORDS: Array<[ActionName, RegExp]> = [
  ['wave', /\b(wave|waves|waving|wave hello|hello|hi|greet|greets|greeting)\b/],
  ['hop', /\b(hop|hops|hopping|jump|jumps|jumping|bounce|bounces|bouncing|bouncy|excited)\b/],
  ['dance', /\b(dance|dances|dancing|groove|grooves|spin|spins|twirl|twirls|party)\b/],
  ['wink', /\b(wink|winks|winking|cheeky|flirt|flirty)\b/],
  ['nod', /\b(nod|nods|nodding|agree|agrees|yes|confirm|confirms|approve|approves)\b/],
  ['shake', /\b(shake|shakes|shaking|disagree|disagrees|refuse|refuses)\b/],
  ['cheer', /\b(cheer|cheers|cheering|celebrate|celebrates|celebrating|hooray|yay|victory|party|launch|launches)\b/],
  ['point', /\b(point|points|pointing|there|direction)\b/],
  ['present', /\b(present|presents|presenting|show|shows|showing|showcase|showcases|introduce|introduces|reveal|reveals|offer|offers)\b/],
  ['sip', /\b(sip|sips|sipping|drink|drinks|taste|tastes|coffee|tea|latte)\b/],
  ['think', /\b(think|thinks|thinking|wonder|wonders|curious|idea|ideas|brainstorm|brainstorms|hmm)\b/],
  ['laugh', /\b(laugh|laughs|laughing|funny|giggle|giggles|joy)\b/],
  ['shrug', /\b(shrug|shrugs|shrugging|maybe|unsure)\b/],
  ['bow', /\b(bow|bows|bowing|thank|thanks|welcome|polite)\b/],
  ['stretch', /\b(stretch|stretches|stretching|wake|wakes|morning|tired)\b/],
  ['sleepy', /\b(sleepy|sleep|sleeps|sleeping|yawn|yawns|cozy|cosy|calm)\b/],
  ['listen', /\b(listen|listens|listening|hear|hears|music|podcast|support)\b/],
  ['tap', /\b(tap|taps|tapping|impatient|waiting|drum|drums)\b/],
  ['look', /\b(look|looks|looking|glance|glances|search|searches|around)\b/],
  ['recoil', /\b(surprise|surprised|surprising|shock|shocked|wow|recoil|recoils|gasp|gasps)\b/],
];

export const ADJECTIVE_PERSONALITY: Array<{
  re: RegExp;
  add: Partial<{ energy: number; warmth: number; calm: number; snappiness: number; playfulness: number }>;
  word: string;
}> = [
  { re: /\b(calm|serene|zen|sleepy|gentle|soft|mindful|cosy|cozy|quiet)\b/, add: { calm: 0.18, energy: -0.12, snappiness: -0.12 }, word: 'calm' },
  { re: /\b(energetic|hype|bouncy|excited|lively|bold|fast|quick|rapid|snappy|zippy|party)\b/, add: { energy: 0.2, snappiness: 0.18, calm: -0.18 }, word: 'energetic' },
  { re: /\b(playful|cheeky|mischief|funny|silly|goofy|wink)\b/, add: { playfulness: 0.22, energy: 0.1 }, word: 'playful' },
  { re: /\b(warm|sunny|friendly|kind|hug|lovable|cute|sweet|welcoming|hopeful|optimistic)\b/, add: { warmth: 0.18, playfulness: 0.04 }, word: 'warm' },
  { re: /\b(premium|luxury|sleek|cool|confident|sharp|modern|minimal)\b/, add: { warmth: -0.12, calm: 0.08, snappiness: -0.04 }, word: 'polished' },
  { re: /\b(wise|thoughtful|patient|trustworthy|reliable|professional)\b/, add: { calm: 0.12, playfulness: -0.08 }, word: 'grounded' },
  { re: /\b(weird|strange|quirky|unique|odd|surreal)\b/, add: { playfulness: 0.16, energy: 0.04 }, word: 'quirky' },
];

export const NAME_PARTS_A = ['Mochi', 'Pip', 'Nori', 'Taro', 'Lumi', 'Biz', 'Kito', 'Momo', 'Bramble', 'Coco', 'Pebble', 'Juno', 'Miso', 'Poppy', 'Sprout', 'Tico'];
export const NAME_PARTS_B = ['Bean', 'Bun', 'Fox', 'Puff', 'Ollie', 'Wren', 'Pip', 'Moss', 'Dot', 'Fizz', 'Nib', 'Kip'];

export const RANDOM_BRIEFS = [
  'A cozy bear barista for a slow-coffee brand. Warm, sleepy, waves hello and sips a latte.',
  'A mischievous fox for a fintech startup. Sharp, quick, points at the chart and winks.',
  'A dreamy axolotl for a mindfulness app. Soft pastels, calm, breathes slowly and stretches.',
  'A tiny robot for a developer tool. Cool silver and electric blue, helpful, presents a laptop.',
  'A sunny frog for a climate startup. Bright green, optimistic, hops and cheers.',
  'A fluffy bunny for a skincare brand. Blush pink, gentle, waves and blinks slowly.',
  'A wise owl for an education platform. Lavender and mustard, nods, thinks, then celebrates.',
  'A friendly blob for a social app. Mint and violet, weird, dances and laughs.',
];

export const colorFromText = (text: string): { primary?: string; secondary?: string; accent?: string } => {
  const found = Object.entries(COLOR_WORDS).filter(([word]) => new RegExp(`\\b${word}\\b`, 'i').test(text));
  const out: { primary?: string; secondary?: string; accent?: string } = {};
  for (const [, v] of found) {
    if (v.role === 'primary' && !out.primary) out.primary = v.hex;
    else if (v.role === 'secondary' && !out.secondary) out.secondary = v.hex;
    else if (v.role === 'accent' && !out.accent) out.accent = v.hex;
  }
  return out;
};

export const familyFromText = (text: string): 'warm' | 'cool' | 'fresh' | 'bold' | 'soft' | 'mono' => {
  if (VIBE_WORDS.bold.test(text)) return 'bold';
  if (VIBE_WORDS.fresh.test(text)) return 'fresh';
  if (VIBE_WORDS.soft.test(text)) return 'soft';
  if (VIBE_WORDS.cool.test(text)) return 'cool';
  if (VIBE_WORDS.mono.test(text)) return 'mono';
  return 'warm';
};

export const findFirst = <T,>(pairs: Array<[T, RegExp]>, text: string): T | undefined => {
  for (const [value, re] of pairs) if (re.test(text)) return value;
  return undefined;
};

export const allMatches = <T,>(pairs: Array<[T, RegExp]>, text: string): T[] => {
  const out: T[] = [];
  for (const [value, re] of pairs) if (re.test(text) && !out.includes(value)) out.push(value);
  return out;
};
