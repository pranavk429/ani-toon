import { genomeFor, SPECIES, speciesFromText, type SpeciesKey } from '../mascot/genome';
import { makePalette } from '../mascot/palette';
import type {
  AccessoryType,
  Accent,
  ActionName,
  Beat,
  Genome,
  MotionScore,
  OutfitType,
  Personality,
  PropType,
} from '../mascot/types';
import {
  ACCESSORIES,
  ACTION_WORDS,
  ADJECTIVE_PERSONALITY,
  allMatches,
  colorFromText,
  familyFromText,
  findFirst,
  NAME_PARTS_A,
  NAME_PARTS_B,
  OUTFITS,
  PROPS,
  RANDOM_BRIEFS,
} from './lexicon';

export type ImageSignal = {
  colors: string[];
  brightness: number;
  saturation: number;
  warmth: number;
  aspect: number;
  filename: string;
  species?: SpeciesKey;
};

export type DirectorResult = {
  genome: Genome;
  score: MotionScore;
  reply: string;
  notes: string[];
  intent: 'new' | 'edit' | 'image';
};

export type DirectOptions = {
  seed?: number;
  image?: ImageSignal;
  previous?: { genome: Genome; score: MotionScore };
};

// ---------------------------------------------------------------------------
// deterministic variation

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

function hashText(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

const titleCase = (s: string) =>
  s
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

// ---------------------------------------------------------------------------
// reading the brief

function universe(text: string, rng: () => number, image?: ImageSignal): SpeciesKey {
  const explicit = speciesFromText(text);
  if (explicit.explicit) return explicit.key;
  if (image?.species) return image.species;
  const hasIndustry =
    /\b(home|furniture|real estate|construction|cozy|family|coffee|cafe|bakery|food|restaurant|drink|tea|matcha|finance|fintech|bank|invest|crypto|consult|legal|education|learning|study|school|course|book|publish|research|wellness|health|care|beauty|skincare|baby|kids|yoga|therapy|eco|climate|green|sustain|garden|farm|outdoor|energy|dev|developer|software|saas|data|ai|tech|api|cloud|cyber|travel|hospitality|hotel|community|social|pet)\b/i.test(
      text,
    );
  if (hasIndustry) return explicit.key;
  return pick(rng, Object.keys(SPECIES) as SpeciesKey[]);
}

function personalityFor(text: string): { personality: Personality; words: string[] } {
  const p: Personality = { energy: 0.58, warmth: 0.7, calm: 0.42, snappiness: 0.52, playfulness: 0.5 };
  const words: string[] = [];
  for (const a of ADJECTIVE_PERSONALITY) {
    if (a.re.test(text)) {
      p.energy += a.add.energy ?? 0;
      p.warmth += a.add.warmth ?? 0;
      p.calm += a.add.calm ?? 0;
      p.snappiness += a.add.snappiness ?? 0;
      p.playfulness += a.add.playfulness ?? 0;
      if (!words.includes(a.word)) words.push(a.word);
    }
  }
  for (const k of Object.keys(p) as Array<keyof Personality>) p[k] = Math.max(0.06, Math.min(0.96, p[k]));
  if (!words.length) words.push(p.energy > 0.6 ? 'bright' : 'easy-going');
  return { personality: p, words };
}

function extractBrand(text: string): string | undefined {
  const forMatch = text.match(/\bfor\s+([A-Za-z0-9&'’\- ]{2,36})(?:[.,;]|\s+(?:that|which|with|who|and)\b|$)/i);
  if (forMatch?.[1]) {
    const raw = forMatch[1].trim().replace(/\s+/g, ' ');
    if (!/^(me|us|my|a|an|the|people|everyone|you)$/i.test(raw)) return titleCase(raw);
  }
  const called = text.match(/\b(?:called|named|brand)\s+["“']?([A-Za-z0-9&'’\- ]{2,24})["”']?/i);
  if (called?.[1]) return titleCase(called[1].trim());
  return undefined;
}

function mascotName(text: string, rng: () => number): string {
  const called = text.match(/\b(?:named|called|mascot called|mascot named)\s+["“']?([A-Za-z]{2,16})["”']?/i);
  if (called?.[1] && !/^(a|an|the)$/i.test(called[1])) return titleCase(called[1]);
  const a = pick(rng, NAME_PARTS_A);
  return rng() > 0.55 ? `${a} ${pick(rng, NAME_PARTS_B)}` : a;
}

function roleFor(text: string, key: SpeciesKey, prop?: PropType, outfit?: OutfitType): string {
  if (/\b(coffee|cafe|barista|latte|espresso|brew|roast)\b/.test(text)) return 'barista';
  if (/\b(tea|matcha|drink)\b/.test(text)) return 'tea guide';
  if (/\b(bakery|chef|food|kitchen|restaurant)\b/.test(text)) return 'little chef';
  if (/\b(delivery|shipping|logistics|package)\b/.test(text)) return 'courier';
  if (/\b(developer|software|code|saas|tech|ai|data|cloud)\b/.test(text)) return 'studio assistant';
  if (/\b(finance|bank|invest|crypto|fintech)\b/.test(text)) return 'money guide';
  if (/\b(wellness|health|care|mindful|yoga|therapy)\b/.test(text)) return 'calm coach';
  if (/\b(education|learn|school|course|book)\b/.test(text)) return 'study buddy';
  if (/\b(travel|hotel|hospitality)\b/.test(text)) return 'front desk friend';
  if (/\b(shop|store|commerce|retail)\b/.test(text)) return 'shopkeeper';
  if (prop === 'plant') return 'garden friend';
  if (prop === 'star') return 'little star';
  if (outfit === 'apron') return 'barista';
  return '';
}

function taglineFor(text: string, name: string): string {
  if (/\b(coffee|cafe|barista|latte|brew)\b/.test(text)) return 'Slow mornings. Warm hellos.';
  if (/\b(tea|matcha)\b/.test(text)) return 'A little calm in every cup.';
  if (/\b(ai|software|tech|data|developer|saas)\b/.test(text)) return 'Small helper. Big difference.';
  if (/\b(health|wellness|care|mindful|yoga)\b/.test(text)) return 'A softer way to start.';
  if (/\b(finance|bank|invest)\b/.test(text)) return 'Money, made friendlier.';
  if (/\b(eco|climate|green|sustain)\b/.test(text)) return 'Better choices, brighter days.';
  if (/\b(delivery|shipping|order)\b/.test(text)) return 'From our door to yours.';
  return `${name} is here to help.`;
}

function accentsFor(text: string, actions: ActionName[], duration: number): Accent[] {
  const out: Accent[] = [];
  const has = (a: ActionName) => actions.includes(a);
  if (has('sip')) out.push({ type: 'steam', t: 2200, x: 286, y: 260 });
  if (has('cheer') || has('hop')) out.push({ type: 'confetti', t: Math.min(duration - 1300, 5000), x: 200, y: 120 });
  if (has('wave')) out.push({ type: 'sparkle', t: 2300, x: 305, y: 140 });
  if (has('dance')) {
    out.push({ type: 'note', t: 2200, x: 300, y: 190 });
    out.push({ type: 'note', t: 3000, x: 112, y: 160 });
  }
  if (/\b(love|heart|care|warm|friendly|cute)\b/.test(text)) out.push({ type: 'heart', t: 4200, x: 305, y: 190 });
  out.push({ type: 'sparkle', t: 1300, x: 118, y: 160 });
  return out.slice(0, 6);
}

function defaultActions(text: string, p: Personality, prop?: PropType): ActionName[] {
  if (prop === 'cup' || /\b(coffee|tea|latte|sip)\b/.test(text)) return ['wave', 'sip', 'present'];
  if (p.energy > 0.68) return ['hop', 'cheer', 'wave'];
  if (p.calm > 0.6) return ['stretch', 'listen', 'nod'];
  if (p.playfulness > 0.62) return ['wink', 'dance', 'wave'];
  return ['perk', 'wave', 'present'];
}

function buildScore(text: string, p: Personality, prop: PropType | undefined, actions: ActionName[], duration: number): MotionScore {
  const beats: Beat[] = [];
  beats.push({ t: 250, action: 'wake', intensity: 0.62 });
  beats.push({ t: 1150, action: 'perk', intensity: 0.82 });

  const main = actions.filter((a) => a !== 'wake' && a !== 'perk' && a !== 'settle');
  const count = Math.min(4, Math.max(2, main.length));
  let t = 2150;
  for (let i = 0; i < count; i++) {
    const action = main[i % main.length] ?? 'wave';
    beats.push({
      t,
      action,
      intensity: 0.72 + p.energy * 0.24,
      side: prop && (action === 'wave' || action === 'cheer') ? -1 : i % 3 === 1 ? -1 : 1,
      hold: action === 'sip' ? 500 : action === 'think' ? 450 : 260,
    });
    t += action === 'sip' ? 2200 : action === 'dance' ? 2600 : 2050;
  }
  beats.push({ t: Math.max(5200, duration - 1200), action: 'settle', intensity: 0.55 });

  const story = `${beats
    .slice(1, -1)
    .map((b) => b.action)
    .join(' → ')}`;
  const accentList = accentsFor(text, main, duration);
  return {
    title: `${p.energy > 0.65 ? 'Bright' : 'Easy'} hello`,
    story: story || 'a small hello',
    duration,
    loop: true,
    beats,
    accents: accentList,
    gazes: [
      { t: 900, x: 0, y: 0, hold: 1300 },
      { t: Math.max(3000, duration - 2700), x: 2, y: -1, hold: 1000 },
    ],
    blinks: [1450, 3450, 5750, 7600].filter((b) => b < duration - 500),
    idle: {
      breath: 1,
      sway: 0.85 + p.energy * 0.35,
      blinkEvery: 3500 - p.playfulness * 650,
      gazeWander: p.calm > 0.55 ? 0.7 : 0.95,
      earFlick: 0.6,
    },
    personalityMix: 0.82,
  };
}

// ---------------------------------------------------------------------------
// the director

export function direct(brief: string, opts: DirectOptions = {}): DirectorResult {
  const text = brief.trim() || RANDOM_BRIEFS[0];
  const seed = opts.seed ?? hashText(text);
  const rng = mulberry32(seed);
  const key = universe(text, rng, opts.image);
  const base = genomeFor(key);
  const { personality, words } = personalityFor(text);
  const brand = extractBrand(text) ?? opts.previous?.genome.brand ?? 'Your brand';
  const name = mascotName(text, rng);

  const fromText = colorFromText(text);
  const imageColors = opts.image?.colors ?? [];
  const family = familyFromText(text);
  const primary = fromText.primary ?? imageColors[0] ?? base.palette.fur;
  const secondary = fromText.secondary ?? imageColors[2] ?? base.palette.outfit;
  const accent = fromText.accent ?? imageColors[1] ?? base.palette.accent;

  const prop = /\b(no|without|remove)\s+(prop|object|cup|laptop|phone)\b/i.test(text) ? undefined : findFirst(PROPS, text);
  const outfit = /\b(no|without|remove)\s+(outfit|scarf|apron|hoodie|bowtie|costume)\b/i.test(text) ? 'none' : findFirst(OUTFITS, text);
  const accessory = /\b(no|without|remove)\s+(accessory|hat|glasses|headphones)\b/i.test(text)
    ? 'none'
    : findFirst(ACCESSORIES, text);
  const role = roleFor(text, key, prop, outfit);
  const article = /^[aeiou]/i.test(words[0]) ? 'an' : 'a';

  const headMorph = 1 + (rng() - 0.5) * 0.12;
  const eyeMorph = 1 + (rng() - 0.5) * 0.14;
  const bodyMorph = 1 + (rng() - 0.5) * 0.1;

  const genome = genomeFor(key, {
    id: `ani-${seed.toString(36)}`,
    speciesKey: key,
    name,
    brand,
    tagline: taglineFor(text, name),
    concept: `${article} ${words[0]} ${SPECIES[key].label.toLowerCase()}${role ? ` ${role}` : ''}`,
    head: {
      ...base.head,
      w: base.head.w * headMorph,
      h: base.head.h * (2 - headMorph),
    },
    face: {
      ...base.face,
      eyeGap: base.face.eyeGap * eyeMorph,
      eyeH: base.face.eyeH * (0.96 + rng() * 0.1),
    },
    body: {
      ...base.body,
      w: base.body.w * bodyMorph,
      h: base.body.h * (2 - bodyMorph),
    },
    ears: { ...base.ears, size: base.ears.size * (0.92 + rng() * 0.2) },
    personality,
    palette: makePalette({ primary, secondary, accent, family }),
    outfit: (outfit ?? base.outfit) as OutfitType,
    accessory: (accessory ?? base.accessory) as AccessoryType,
    prop: (prop ?? base.prop) as PropType,
    logo: {
      ...base.logo,
      mark: pick(rng, ['bean', 'leaf', 'bolt', 'spark', 'moon', 'heart'] as const),
      initial: (brand[0] ?? 'A').toUpperCase(),
    },
  });

  const explicitActions = allMatches(ACTION_WORDS, text).filter(
    (a) => !(a === 'sip' && prop !== 'cup' && !/\b(sip|drink|taste)\b/.test(text)),
  );
  const actions = explicitActions.length ? explicitActions : defaultActions(text, personality, genome.prop);
  const duration = Math.min(12000, Math.max(7600, 4600 + actions.length * 1850));
  const score = buildScore(text, personality, genome.prop, actions, duration);
  // The grammar is a vocabulary, not a reel: every generated performance gets
  // seeded timing, weight and hold variation, so the same brief never repeats.
  score.beats = score.beats.map((b) => {
    if (b.action === 'wake' || b.action === 'settle') return b;
    return {
      ...b,
      t: Math.max(800, Math.min(duration - 1400, b.t + (rng() - 0.5) * 260)),
      intensity: Math.max(0.55, Math.min(0.98, (b.intensity ?? 0.8) + (rng() - 0.5) * 0.2)),
      hold: Math.max(120, Math.min(620, (b.hold ?? 260) + (rng() - 0.5) * 180)),
      side:
        genome.prop === 'cup' && b.action === 'sip'
          ? 1
          : genome.prop !== 'none' && (b.action === 'wave' || b.action === 'cheer' || b.action === 'point')
            ? -1
            : rng() > 0.5
              ? 1
              : -1,
    };
  });
  score.title = `${genome.name} says hello`;

  const paletteWord = fromText.primary ? 'custom palette' : imageColors.length ? 'palette pulled from your image' : `${family} palette`;
  const motionWords = actions.slice(0, 3).join(', ');
  const reply = `Say hello to **${genome.name}** — ${genome.concept} for ${genome.brand}. ${score.story.replace(/ → /g, ', then ')}.`;
  const notes = [
    `${SPECIES[key].label} genome`,
    paletteWord,
    genome.outfit !== 'none' ? `${genome.outfit}` : 'clean silhouette',
    genome.prop !== 'none' ? `holds a ${genome.prop}` : 'no prop',
    `moves: ${motionWords}`,
  ];

  return { genome, score, reply, notes, intent: opts.image ? 'image' : 'new' };
}

// ---------------------------------------------------------------------------
// edits: the chat can change the character or the performance

export function applyEdit(command: string, genome: Genome, score: MotionScore): DirectorResult {
  const text = command.toLowerCase();
  const next: Genome = {
    ...genome,
    head: { ...genome.head },
    face: { ...genome.face },
    body: { ...genome.body },
    ears: { ...genome.ears },
    personality: { ...genome.personality },
    palette: { ...genome.palette },
    logo: { ...genome.logo },
  };
  const nextScore: MotionScore = { ...score, beats: [...score.beats], accents: [...(score.accents ?? [])] };
  const notes: string[] = [];
  let reply = 'Done — take a look.';

  const bump = (key: keyof Personality, delta: number, note: string) => {
    next.personality[key] = Math.max(0.05, Math.min(0.97, next.personality[key] + delta));
    notes.push(note);
  };

  if (/\b(more|very|super)?\s*(playful|cheeky|fun|silly)\b/.test(text)) {
    bump('playfulness', 0.16, 'more playful');
    bump('energy', 0.05, 'more energy');
    nextScore.idle = { ...nextScore.idle, blinkEvery: 2900 };
    reply = 'Turned up the mischief. Expect more winks, bounces and blinks.';
  } else if (/\b(calmer|calm|slower|slow|sleepy|gentle)\b/.test(text)) {
    bump('calm', 0.16, 'calmer');
    bump('snappiness', -0.12, 'slower');
    bump('energy', -0.06, 'less energy');
    reply = 'Slowed the clock and softened the acting. Fewer, longer beats.';
  } else if (/\b(more energy|energetic|faster|snappier|hype)\b/.test(text)) {
    bump('energy', 0.16, 'more energy');
    bump('snappiness', 0.14, 'snappier');
    reply = 'Made it quicker and springier. The same score now hits harder.';
  } else if (/\b(warm|warmer|friendly|sweeter)\b/.test(text)) {
    bump('warmth', 0.14, 'warmer');
    reply = 'Warmer read: softer eyes, more cheek, a little more lean-in.';
  } else if (/\b(cooler|cool|premium|confident|sharp)\b/.test(text)) {
    bump('warmth', -0.12, 'cooler');
    bump('calm', 0.08, 'composed');
    reply = 'Sharper and more composed. Less bounce, more intent.';
  }

  if (/\b(remove|no|lose|without)\s+(the\s+)?(prop|cup|object|laptop|phone|package|plant|bag)\b/.test(text)) {
    next.prop = 'none';
    notes.push('removed prop');
    reply = 'Removed the prop. The hands and silhouette do the talking now.';
  } else {
    const prop = findFirst(PROPS, text);
    if (prop) {
      next.prop = prop;
      notes.push(`holds a ${prop}`);
      reply = `Gave ${genome.name} a ${prop}. The arm and prop channels are already animated.`;
    }
  }

  if (/\b(remove|no|without)\s+(the\s+)?(scarf|apron|hoodie|outfit|bowtie|costume)\b/.test(text)) {
    next.outfit = 'none';
    notes.push('removed outfit');
  } else {
    const outfit = findFirst(OUTFITS, text);
    if (outfit) {
      next.outfit = outfit;
      notes.push(`wearing a ${outfit}`);
    }
  }

  if (/\b(remove|no|without)\s+(the\s+)?(glasses|hat|beanie|cap|accessory|headphones|crown)\b/.test(text)) {
    next.accessory = 'none';
    notes.push('removed accessory');
  } else {
    const accessory = findFirst(ACCESSORIES, text);
    if (accessory) {
      next.accessory = accessory;
      notes.push(`wearing ${accessory}`);
    }
  }

  const colors = colorFromText(text);
  if (colors.primary || colors.secondary || colors.accent) {
    const p = makePalette({
      primary: colors.primary ?? next.palette.fur,
      secondary: colors.secondary ?? next.palette.outfit,
      accent: colors.accent ?? next.palette.accent,
    });
    next.palette = p;
    notes.push('new palette');
    reply = 'Recoloured the whole character — fur, outfit and stage all follow the same tokens.';
  }

  const sp = speciesFromText(text);
  if (sp.explicit && SPECIES[sp.key].label.toLowerCase() !== genome.concept) {
    const swapped = genomeFor(sp.key, {
      ...next,
      concept: `${sp.key} with a new job`,
    });
    Object.assign(next, swapped);
    notes.push(`${SPECIES[sp.key].label} silhouette`);
    reply = `Rebuilt the genome around ${SPECIES[sp.key].label.toLowerCase()} anatomy.`;
  }

  const action = allMatches(ACTION_WORDS, text)[0];
  if (action) {
    if (/\b(remove|no|stop|without)\b/.test(text)) {
      nextScore.beats = nextScore.beats.filter((b) => b.action !== action);
      notes.push(`removed ${action}`);
    } else {
      const t = Math.min(nextScore.duration - 1600, 4300);
      nextScore.beats = [...nextScore.beats.filter((b) => b.action !== action), { t, action, intensity: 0.9 }].sort((a, b) => a.t - b.t);
      notes.push(`added ${action}`);
      reply = `Added a ${action} at ${(t / 1000).toFixed(1)}s. The compiler blends it with the idle layer.`;
    }
  }

  if (/\b(one[- ]shot|no loop|stop looping)\b/.test(text)) {
    nextScore.loop = false;
    notes.push('one-shot');
  }
  if (/\b(loop|repeat)\b/.test(text)) {
    nextScore.loop = true;
    notes.push('looping');
  }
  if (/\b(longer|slow it down|stretch)\b/.test(text)) {
    nextScore.duration = Math.min(16000, nextScore.duration + 1800);
    notes.push('longer');
  }
  if (/\b(shorter|trim|cut it)\b/.test(text)) {
    nextScore.duration = Math.max(5200, nextScore.duration - 1800);
    notes.push('shorter');
  }

  return {
    genome: next,
    score: nextScore,
    reply,
    notes: notes.length ? notes : ['kept the current performance'],
    intent: 'edit',
  };
}

export function randomBrief(seed = Math.floor(Math.random() * 100000)): string {
  return RANDOM_BRIEFS[seed % RANDOM_BRIEFS.length];
}

export const EXAMPLE_BRIEFS = RANDOM_BRIEFS;
