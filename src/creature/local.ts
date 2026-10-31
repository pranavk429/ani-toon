// The offline director. Not a gallery: it infers a body plan, proportions,
// palette, face, accessories and a beat sheet from the brief, then composes a
// scene with the same grammar the hosted director uses.
//
// This is the fallback for venue Wi-Fi, rate limits and billing. It is also the
// proof that the grammar works without a model.

import { mix } from '../toon/shapes';
import { buildSkeleton } from './skeleton';
import type {
  Actor,
  AccessorySpec,
  Beat,
  BodyPlan,
  Bottom,
  FaceSpec,
  FacialHair,
  Fringe,
  Genome,
  HairStyle,
  HumanLook,
  Presentation,
  Scene,
  Score,
  Shoes,
  SurfaceKind,
  SurfacePattern,
  Top,
  Verb,
  WorldPreset,
} from './types';

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

const NAMES = [
  'Nova', 'Milo', 'Juno', 'Mochi', 'Pip', 'Sage', 'Rumi', 'Kai', 'Luna',
  'Theo', 'Iris', 'Finn', 'Cleo', 'Nico', 'Ada', 'Ezra', 'Maya', 'Leo',
  'Marco', 'Muddle', 'Biscuit', 'Jelly', 'Pepper', 'Cosmo', 'Wren', 'Otis',
];

const BASES = [
  '#E8A87C', '#C68642', '#8D5524', '#F5B092', '#B57A4B',
  '#6D5BD0', '#34D399', '#F472B6', '#38BDF8', '#FB923C',
];

const ACCENTS = ['#FDE047', '#FF4B4B', '#22D3EE', '#A3E635', '#F472B6', '#F59E0B'];

const COLORS: Record<string, string> = {
  red: '#EF4444', crimson: '#DC2626', coral: '#F87171', orange: '#F97316',
  amber: '#F59E0B', yellow: '#FACC15', gold: '#EAB308', green: '#22C55E',
  mint: '#6EE7B7', emerald: '#10B981', teal: '#14B8A6', cyan: '#06B6D4',
  blue: '#3B82F6', navy: '#1E3A8A', indigo: '#4F46E5', purple: '#8B5CF6',
  violet: '#7C3AED', lavender: '#C4B5FD', pink: '#EC4899', rose: '#F43F5E',
  brown: '#8B5E3C', black: '#141414', white: '#F8FAFC', cream: '#F3E9DC',
  silver: '#CBD5E1', rust: '#B96438', burgundy: '#7A2E3A', olive: '#6B7040',
};

const OCTO = /\b(octopus|octopi|squid|kraken|jellyfish|spider|tarantula|tentacle|cuttlefish|anemone)\b/i;
const QUAD = /\b(horse|pony|dog|puppy|cat|kitten|lion|tiger|wolf|fox|cow|bull|deer|moose|elephant|bear|rabbit|bunny|dragon|dino|dinosaur|unicorn|donkey|goat|sheep|pig|hamster|mouse|rat|squirrel|otter|seal|whale|dolphin|shark|cheetah|leopard|panther|zebra|giraffe|hippo|rhino|camel|llama|alpaca|panda|koala|steed|mount)\b/i;
const BLOB = /\b(blob|slime|ghost|cloud|jelly|goo|spirit|ooze|mochi|marshmallow|bubble)\b/i;
const BIPED = /\b(human|man|woman|boy|girl|cowboy|cowgirl|rider|founder|chef|baker|barista|doctor|teacher|artist|designer|hero|knight|wizard|ninja|pirate|robot|android|astronaut|scientist|musician|gamer|detective|singer|dancer|person|guy|gal|character|mascot|traveler|traveller|athlete|coach|model|influencer|stylist|skier|hiker|photographer|tennis)\b/i;
const RIDING = /\b(riding|rider|cowboy|cowgirl|jockey|knight|mounted|on a horse|on a dragon|on a steed)\b/i;
const MOUNT = /\b(horse|pony|dragon|elephant|camel|llama|unicorn|bull|ox|steed|mount)\b/i;

type Plan = Exclude<BodyPlan, 'custom'>;

function bodyPlanFor(text: string, h: number): Plan {
  if (OCTO.test(text)) return 'octopod';
  if (QUAD.test(text)) return 'quadruped';
  if (BLOB.test(text)) return 'blob';
  if (BIPED.test(text)) return 'biped';
  const plans: Plan[] = ['biped', 'quadruped', 'octopod', 'blob'];
  return plans[h % plans.length];
}

function speciesFor(text: string, plan: Plan): string {
  if (/\boctopus\b/i.test(text)) return 'octopus';
  if (/\bsquid\b/i.test(text)) return 'squid';
  if (/\bspider\b/i.test(text)) return 'spider';
  if (/\bhorse\b/i.test(text)) return 'horse';
  if (/\bdragon\b/i.test(text)) return 'dragon';
  if (/\bdog\b|\bpuppy\b/i.test(text)) return 'dog';
  if (/\bcat\b|\bkitten\b/i.test(text)) return 'cat';
  if (/\bfox\b/i.test(text)) return 'fox';
  if (/\bwolf\b/i.test(text)) return 'wolf';
  if (/\blion\b/i.test(text)) return 'lion';
  if (/\bghost\b/i.test(text)) return 'ghost';
  if (/\bslime\b|\bgoo\b/i.test(text)) return 'slime';
  if (/\brobot\b|\bandroid\b/i.test(text)) return 'robot';
  if (/\bcowboy\b/i.test(text)) return 'cowboy';
  if (/\bchef\b/i.test(text)) return 'chef';
  if (/\bbaker\b|\bbakery\b/i.test(text)) return 'baker';
  if (/\bmusician\b|\bsynth\b/i.test(text)) return 'musician';
  if (/\btraveler\b|\btraveller\b|\btravel\b/i.test(text)) return 'traveler';
  if (/\btennis\b/i.test(text)) return 'tennis player';
  if (/\bskincare\b/i.test(text)) return 'founder';
  if (/\bfounder\b/i.test(text)) return 'founder';
  return plan;
}

function paletteFor(
  text: string,
  h: number,
  plan: Plan,
  human?: HumanLook,
): Genome['palette'] {
  const rng = mulberry32(h);
  const direct = text.match(/#([0-9a-fA-F]{6})\b/);
  let base = direct ? `#${direct[1]}` : '';
  if (!base) {
    for (const [word, hex] of Object.entries(COLORS)) {
      if (new RegExp(`\\b${word}\\b`, 'i').test(text)) {
        base = hex;
        break;
      }
    }
  }
  if (plan === 'biped' && human) {
    const skin = skinFor(text, h);
    const hair = hairColorFor(text, h);
    const cloth = garmentFor(text, human, h);
    const accent = accentFor(text, human, h);
    return {
      skin,
      belly: mix(skin, '#FFF1DC', 0.56),
      accent,
      detail: mix(skin, '#2B1838', 0.62),
      eye: '#2B2233',
      mouth: mix(skin, '#7A3E35', 0.52),
      cloth,
      trim:
        human.outfit.top === 'suit'
          ? mix(cloth, '#FFF1DC', 0.66)
          : human.outfit.top === 'sport'
            ? mix(accent, '#FFFFFF', 0.12)
            : '#FFF6E3',
      hair,
      pants: pantsFor(human, h),
    };
  }
  if (!base) {
    base =
      plan === 'octopod'
        ? '#6D5BD0'
        : plan === 'blob'
          ? '#34D399'
          : plan === 'quadruped'
            ? '#B57A4B'
            : BASES[Math.floor(rng() * BASES.length)];
  }
  const accent = ACCENTS[Math.floor(rng() * ACCENTS.length)];
  return {
    skin: base,
    belly: mix(base, '#FFFFFF', 0.48),
    accent,
    detail: mix(base, '#000000', 0.42),
    eye: '#141414',
    mouth: mix(base, '#000000', 0.58),
  };
}

const SKIN_TONES = ['#F7D2B0', '#F3C9A3', '#E8B48C', '#D99A6C', '#C68642', '#B57A4B', '#8D5524', '#6B3E2E'];
const HAIR_COLORS = ['#241714', '#3B2418', '#4A2F1F', '#6B4428', '#A9683A', '#D9A45E'];
const GARMENTS = ['#4A8FD4', '#E08A3C', '#5E8C6A', '#6D5BD0', '#E06A4E', '#3AA6A0', '#C94A3F', '#F3E4C6'];
const TROUSERS = ['#3E5C76', '#2F3A5C', '#3A4A5C', '#B08A5A', '#2E3440'];

function pick<T>(all: readonly T[], h: number, shift: number): T {
  return all[(h >>> shift) % all.length];
}

function skinFor(text: string, h: number): string {
  if (/\b(deep|dark) skin\b|\bblack skin\b/i.test(text)) return '#6B3E2E';
  if (/\b(brown skin|olive skin)\b/i.test(text)) return '#B57A4B';
  if (/\b(pale|fair) skin\b/i.test(text)) return '#F7D2B0';
  return pick(SKIN_TONES, h, 3);
}

function hairColorFor(text: string, h: number): string {
  if (/\b(red|ginger|auburn)\b/i.test(text)) return '#B5532E';
  if (/\b(blonde|blond|golden hair)\b/i.test(text)) return '#D9A45E';
  if (/\b(black|jet[- ]black)\b/i.test(text)) return '#241714';
  if (/\b(grey|gray|silver)\b/i.test(text)) return '#9A9AA5';
  if (/\b(brown|chestnut)\b/i.test(text)) return '#6B4428';
  if (/\b(afro|braids?|locs?|dreadlocks?)\b/i.test(text)) return pick(['#241714', '#3B2418'], h, 9);
  return pick(HAIR_COLORS, h, 7);
}

function garmentFor(text: string, human: HumanLook, h: number): string {
  const explicit =
    text.match(
      /\b(?:wearing|in) (?:a |an )?(red|blue|green|purple|orange|pink|yellow|teal|cream|navy|coral|mint|rust|burgundy|olive) (?:shirt|coat|dress|hoodie|jacket|tee|blouse|suit|apron|raincoat|parka)\b/i,
    ) ??
    text.match(
      /\b(red|blue|green|purple|orange|pink|yellow|teal|cream|navy|coral|mint|rust|burgundy|olive) (?:shirt|coat|dress|hoodie|jacket|tee|blouse|suit|apron|raincoat|parka)\b/i,
    );
  if (explicit) {
    const word = explicit[1].toLowerCase();
    if (COLORS[word]) return COLORS[word];
    if (word === 'rust') return '#B96438';
    if (word === 'burgundy') return '#7A2E3A';
    if (word === 'olive') return '#6B7040';
  }
  if (/\b(chef|apron)\b/i.test(text)) return '#F3E4C6';
  if (/\b(skincare|founder|confident|cosmetic)\b/i.test(text)) return '#E08A3C';
  if (/\b(baker|bakery)\b/i.test(text)) return '#5E8C6A';
  if (/\b(musician|synth|dj)\b/i.test(text)) return '#6D5BD0';
  if (/\b(travel|traveler|traveller|journey)\b/i.test(text)) return '#E06A4E';
  if (/\b(winter|lodge|snow|cozy)\b/i.test(text)) return '#3F6B5A';
  if (/\b(tennis|sport|athlete|jersey)\b/i.test(text)) return '#F4F0E6';
  if (human.outfit.top === 'apron') return '#F3E4C6';
  if (human.outfit.top === 'dress') return '#E06A4E';
  if (human.outfit.top === 'sport') return '#F4F0E6';
  return pick(GARMENTS, h, 11);
}

function accentFor(text: string, human: HumanLook, h: number): string {
  if (/\b(chef|winter|lodge)\b/i.test(text)) return '#C94A3F';
  if (/\b(tennis|sport|racket|athlete)\b/i.test(text)) return '#2F6BBA';
  if (human.outfit.bottom === 'jeans' && human.outfit.top === 'coat') return '#F2B84B';
  return pick(ACCENTS, h, 13);
}

function pantsFor(human: HumanLook, h: number): string {
  if (human.outfit.bottom === 'jeans') return '#3E5C76';
  if (human.outfit.bottom === 'chinos') return '#B08A5A';
  if (human.outfit.bottom === 'leggings') return '#2E3440';
  if (human.outfit.bottom === 'shorts') return '#2F3A5C';
  return pick(TROUSERS, h, 17);
}

function humanFor(text: string, h: number): HumanLook {
  let presentation: Presentation = 'androgynous';
  if (/\b(woman|women|girl|girls|lady|ladies|mother|mom|mum|grandmother|grandma|she|her|actress|bride)\b/i.test(text)) {
    presentation = 'feminine';
  } else if (/\b(man|men|boy|boys|guy|guys|father|dad|grandfather|grandpa|he|his|actor|groom)\b/i.test(text)) {
    presentation = 'masculine';
  } else if (/\b(androgynous|nonbinary|non-binary|they|them)\b/i.test(text)) {
    presentation = 'androgynous';
  }

  let style: HairStyle;
  if (/\bafro\b/i.test(text)) style = 'afro';
  else if (/\b(braids?|locs?|dreadlocks?)\b/i.test(text)) style = 'braids';
  else if (/\b(ponytail|high pony)\b/i.test(text)) style = 'ponytail';
  else if (/\b(bun|updo)\b/i.test(text)) style = 'bun';
  else if (/\bbob\b/i.test(text)) style = 'bob';
  else if (/\b(curly|curls)\b/i.test(text)) style = 'curly';
  else if (/\b(bald|shaved)\b/i.test(text)) style = 'bald';
  else if (/\blong hair\b|\bshoulder-length\b/i.test(text)) style = 'long';
  else if (/\bshort hair\b|\bcropped\b/i.test(text)) style = 'short';
  else if (/\b(chef|baker|barista|athlete)\b/i.test(text)) style = 'short';
  else style = pick(['short', 'bob', 'ponytail', 'bun', 'long', 'curly', 'afro', 'braids'], h, 5);

  let fringe: Fringe = 'side';
  if (/\b(curtain bangs?|curtain fringe)\b/i.test(text)) fringe = 'curtain';
  else if (/\b(bangs?|fringe)\b/i.test(text)) fringe = 'straight';
  else if (style === 'bald' || style === 'bun' || style === 'afro' || style === 'curly') fringe = 'none';
  else if (style === 'bob') fringe = 'straight';

  let facialHair: FacialHair = 'none';
  if (/\b(full beard|beard|bearded|whiskers)\b/i.test(text)) facialHair = 'beard';
  else if (/\b(mustache|moustache|stache)\b/i.test(text)) facialHair = 'mustache';
  else if (/\bgoatee\b/i.test(text)) facialHair = 'goatee';
  else if (/\bstubble\b/i.test(text)) facialHair = 'stubble';

  let shoulders = 0.97 + ((h >>> 3) % 5) * 0.02;
  let hips = 0.97 + ((h >>> 5) % 5) * 0.02;
  let waist = 0.95 + ((h >>> 7) % 5) * 0.02;
  let height = 0.96 + ((h >>> 9) % 5) * 0.02;
  if (/\b(broad[- ]shouldered|broad shoulders?|burly|athletic|muscular|strong(?: shoulders)?)\b/i.test(text)) shoulders = 1.12;
  if (/\b(narrow|slim|lean|petite|willowy)\b/i.test(text)) shoulders = 0.92;
  if (/\b(curvy|hourglass|wide hips)\b/i.test(text)) hips = 1.13;
  if (/\b(chef|proud|hearty|round|chubby|stocky|pudgy)\b/i.test(text)) {
    waist = 1.07;
    hips = Math.max(hips, 1.04);
  }
  if (/\b(tall|long-legged)\b/i.test(text)) height = 1.07;
  if (/\b(short|petite|little)\b(?!\s+(hair|beard|fringe|bangs|sleeves?|crop|story))/i.test(text)) {
    height = 0.95;
  }

  let top: Top;
  if (/\bchef\b|\bapron\b|\bpancake\b/i.test(text)) top = 'apron';
  else if (/\b(baker|bakery)\b/i.test(text)) top = 'hoodie';
  else if (/\bsuit\b|\btie\b|\bformal\b|\bbusiness\b/i.test(text)) top = 'suit';
  else if (/\b(dress|gown|travel|traveler|traveller)\b/i.test(text)) top = 'dress';
  else if (/\bhoodie\b|\bsweatshirt\b/i.test(text)) top = 'hoodie';
  else if (/\b(coat|jacket|parka|raincoat|winter|lodge|snow|skincare|founder)\b/i.test(text)) top = 'coat';
  else if (/\bblouse\b/i.test(text)) top = 'blouse';
  else if (/\b(tennis|sport|jersey|athlete|racket)\b/i.test(text)) top = 'sport';
  else if (/\b(shirt|button[- ]down|oxford|musician|synth)\b/i.test(text)) top = 'shirt';
  else if (/\b(tee|t-shirt)\b/i.test(text)) top = 'tee';
  else {
    const pool: readonly Top[] =
      presentation === 'masculine'
        ? ['tee', 'shirt', 'hoodie', 'coat', 'sport', 'suit', 'apron']
        : ['tee', 'shirt', 'blouse', 'dress', 'hoodie', 'coat', 'sport', 'apron', 'suit'];
    top = pick(pool, h, 19);
  }

  let bottom: Bottom;
  if (/\bskirt\b/i.test(text)) bottom = 'skirt';
  else if (/\bshorts\b/i.test(text)) bottom = 'shorts';
  else if (/\b(leggings|tights)\b/i.test(text)) bottom = 'leggings';
  else if (/\b(jeans|denim)\b/i.test(text)) bottom = 'jeans';
  else if (/\b(trousers|pants|chinos|slacks)\b/i.test(text)) bottom = 'chinos';
  else if (top === 'dress') bottom = 'none';
  else if (top === 'sport') bottom = 'shorts';
  else if (top === 'suit') bottom = 'chinos';
  else if (top === 'apron') bottom = 'jeans';
  else if (top === 'coat') bottom = 'jeans';
  else if (top === 'hoodie') bottom = 'jeans';
  else if (top === 'shirt') bottom = 'chinos';
  else if (top === 'blouse') bottom = pick(['skirt', 'chinos', 'jeans'], h, 23);
  else bottom = pick(['jeans', 'chinos', 'shorts'], h, 23);

  let shoes: Shoes;
  if (/\bbarefoot\b|\bbare feet\b/i.test(text)) shoes = 'barefoot';
  else if (top === 'sport' || /\b(sneakers?|trainers?)\b/i.test(text)) shoes = 'sneakers';
  else if (top === 'apron') shoes = 'boots';
  else if (top === 'coat') shoes = /\b(winter|snow|lodge|rain|storm)\b/i.test(text) ? 'boots' : 'sneakers';
  else if (/\b(boots?|winter|snow)\b/i.test(text)) shoes = 'boots';
  else if (top === 'dress' || bottom === 'skirt' || /\b(flats?|heels?)\b/i.test(text)) shoes = 'flats';
  else if (top === 'hoodie' || top === 'shirt' || top === 'tee') shoes = 'sneakers';
  else shoes = pick(['sneakers', 'boots'], h, 27);

  const jaw =
    /\b(square jaw|strong jaw)\b/i.test(text) ||
    (presentation === 'masculine' && ((h >>> 29) % 4 === 0))
      ? 'square'
      : 'soft';
  const brow =
    /\b(strong brow|thick brow)\b/i.test(text) ||
    (presentation === 'masculine' && ((h >>> 31) % 2 === 0))
      ? 'strong'
      : 'soft';
  const nose = /\b(broad|wide) nose\b/i.test(text)
    ? 'broad'
    : /\b(small|button) nose\b/i.test(text)
      ? 'small'
      : pick(['small', 'medium', 'medium', 'broad'] as const, h, 21);
  const lashes = /\b(lashes|mascara|eyelashes)\b/i.test(text) || presentation === 'feminine';

  return {
    presentation,
    hair: { style, fringe, volume: style === 'afro' || style === 'curly' ? 1.2 : 1 },
    facialHair,
    body: { shoulders, hips, waist, height },
    outfit: { top, bottom, shoes },
    face: { jaw, lashes, brow, nose },
  };
}

function proportionsFor(text: string, plan: Plan, h: number) {
  const rng = mulberry32(h ^ 0x9e3779b9);
  const p = {
    head: 1,
    torso: 1,
    limbLength: 1,
    limbWidth: 1,
    limbCount: plan === 'quadruped' ? 4 : plan === 'octopod' ? 8 : 2,
    taper: 0.25,
    neck: 1,
  };
  if (/\b(tiny|small|little|mini)\b/i.test(text)) {
    p.head *= 1.15;
    p.torso *= 0.82;
  }
  if (/\b(huge|big|giant|tall|large)\b/i.test(text)) {
    p.head *= 0.92;
    p.torso *= 1.28;
    p.limbLength *= 1.15;
  }
  if (/\b(long|lanky|leggy)\b/i.test(text)) {
    p.limbLength *= 1.3;
    p.neck *= 1.2;
  }
  if (/\b(round|chubby|fat|chonky|pudgy)\b/i.test(text)) {
    p.torso *= 1.25;
    p.limbWidth *= 1.2;
  }
  if (/\b(slim|thin|lean)\b/i.test(text)) {
    p.limbWidth *= 0.78;
    p.torso *= 0.9;
  }
  if (/\b(spiky|spikey|jagged)\b/i.test(text)) p.taper *= 2.2;
  p.head *= 0.94 + rng() * 0.14;
  p.torso *= 0.94 + rng() * 0.14;
  p.limbLength *= 0.94 + rng() * 0.14;
  p.limbWidth *= 0.94 + rng() * 0.14;
  if (plan === 'biped') {
    // The human anchor is chunky: shorter, thicker limbs and a wider torso.
    p.limbLength *= 0.93;
    p.limbWidth = Math.max(1.18, p.limbWidth * 1.14);
    p.torso = Math.max(1.02, p.torso * 1.02);
  }
  p.head = Math.min(1.5, Math.max(0.65, p.head));
  p.torso = Math.min(1.6, Math.max(0.65, p.torso));
  p.limbLength = Math.min(1.5, Math.max(0.7, p.limbLength));
  p.limbWidth = Math.min(1.5, Math.max(0.7, p.limbWidth));
  return p;
}

function faceFor(text: string): FaceSpec {
  const eyes = /\b(three[- ]eyed|3 eyes|third eye)\b/i.test(text)
    ? 3
    : /\b(four[- ]eyed|4 eyes)\b/i.test(text)
      ? 4
      : /\b(cyclops|one[- ]eyed|single eye)\b/i.test(text)
        ? 1
        : 2;
  return {
    eyes,
    eyeSize: /\b(big eyes|huge eyes|wide eyes)\b/i.test(text)
      ? 1.35
      : /\b(tiny eyes|small eyes|beady)\b/i.test(text)
        ? 0.7
        : 1,
    eyeSpacing: /\b(wide[- ]set|wide eyes)\b/i.test(text) ? 1.25 : 1,
    pupil: /\b(cat|dragon|snake|lizard|reptile|slit)\b/i.test(text)
      ? 'slit'
      : /\b(star|cosmic|magic)\b/i.test(text)
        ? 'star'
        : 'round',
    mouth: /\b(fang|monster|dragon|vampire)\b/i.test(text)
      ? 'fang'
      : /\b(beak|bird|owl|duck)\b/i.test(text)
        ? 'beak'
        : /\b(grin|smile|happy|cheeky|goofy)\b/i.test(text)
          ? 'grin'
          : /\b(no mouth|mouthless)\b/i.test(text)
            ? 'none'
            : 'smile',
    brows: true,
  };
}

function surfaceFor(text: string, plan: Plan): { kind: SurfaceKind; pattern: SurfacePattern } {
  if (/\brobot\b|\bcyborg\b|\bandroid\b|\bmech\b/i.test(text)) {
    return { kind: 'metal', pattern: 'plates' };
  }
  if (/\bdragon\b|\blizard\b|\bsnake\b|\breptile\b|\bfish\b/i.test(text)) {
    return { kind: 'scales', pattern: /\bstripe\b/i.test(text) ? 'stripes' : 'none' };
  }
  if (plan === 'octopod' || plan === 'blob') {
    return { kind: 'goo', pattern: /\bspot\b|\bdalmatian\b/i.test(text) ? 'spots' : 'none' };
  }
  if (/\bbird\b|\bowl\b|\bduck\b|\bparrot\b|\bpenguin\b/i.test(text)) {
    return { kind: 'feathers', pattern: 'none' };
  }
  return {
    kind: 'fur',
    pattern: /\bstripe\b|\btiger\b|\bzebra\b/i.test(text)
      ? 'stripes'
      : /\bspot\b|\bdalmatian\b|\bleopard\b/i.test(text)
        ? 'spots'
        : 'none',
  };
}

function accessoriesFor(text: string, opts: { mount?: boolean } = {}): AccessorySpec[] {
  const out: AccessorySpec[] = [];
  const add = (kind: AccessorySpec['kind'], color: string, attach = 'head') => {
    if (!out.some((a) => a.kind === kind)) out.push({ kind, color, attach });
  };
  if (/\bcowboy\b|\bcowgirl\b|\brider\b|\bjockey\b/i.test(text)) {
    add('cowboy-hat', '#5D3A1A');
  } else if (/\bchef\b|\bcook\b|\bapron\b/i.test(text)) {
    add('chef-hat', '#FFF8EA');
  } else if (/\bbeanie\b|\bwinter\b|\bcozy\b/i.test(text)) {
    add('beanie', '#C94A3F');
  } else if (/\bcap\b|\bbaseball\b/i.test(text)) {
    add('cap', '#2563EB');
  }
  if (/\b(chef|winter|lodge|scarf|neckerchief|cozy)\b/i.test(text)) {
    add('scarf', /winter|lodge|cozy/i.test(text) ? '#C94A3F' : '#C94A3F', 'spine');
  }
  if (/\bglasses\b|\bnerd\b|\bgeek\b|\bsmart\b/i.test(text)) add('glasses', '#141414');
  if (/\b(tennis|racket|serve|forehand|backhand)\b/i.test(text)) {
    add('tennis-racket', '#E8B84B', 'handR');
  }
  if (opts.mount) add('saddle', '#3F2A1D', 'back');
  return out;
}

function genomeFor(
  text: string,
  h: number,
  plan: Plan,
  opts: { id?: string; species?: string; mount?: boolean; rider?: boolean } = {},
): Genome {
  const rng = mulberry32(h ^ (opts.rider ? 0x51ed270b : 0x2545f491));
  const species = opts.species ?? speciesFor(text, plan);
  const human = plan === 'biped' ? humanFor(text, h) : undefined;
  const proportions = proportionsFor(text, plan, h);
  if (human && /\b(chef|proud|hearty|round|chubby|stocky)\b/i.test(text)) {
    proportions.limbWidth *= 1.1;
    proportions.torso *= 1.04;
  }
  return {
    id: opts.id ?? species,
    name: NAMES[Math.floor(rng() * NAMES.length)],
    species,
    bodyPlan: plan,
    palette: paletteFor(text, h, plan, human),
    proportions,
    face: faceFor(text),
    surface: surfaceFor(text, plan),
    accessories: accessoriesFor(text, { mount: opts.mount }),
    human,
  };
}

function newScene(title: string, world: Scene['world'], actors: Actor[], score: Score): Scene {
  return { title, world, actors, score };
}

function worldFor(text: string, plan: Plan, human?: HumanLook): WorldPreset {
  if (/\b(tennis|racket|serve|forehand|backhand)\b/i.test(text)) return 'court';
  if (/\b(chef|kitchen|pancake|breakfast|cook)\b/i.test(text)) return 'kitchen';
  if (/\b(skincare|meadow|wildflower|field|picnic|spring)\b/i.test(text)) return 'meadow';
  if (/\b(baker|bakery|forest|woods|woodland)\b/i.test(text)) return 'forest';
  if (/\b(synth|sunset|dusk|golden hour)\b/i.test(text)) return 'sunset';
  if (/\b(travel|traveler|traveller|desert|dune|cactus)\b/i.test(text)) return 'desert';
  if (/\b(winter|lodge|snow|ice|frost|cozy)\b/i.test(text)) return 'winter';
  if (/\b(ocean|beach|sea|coast|surf)\b/i.test(text)) return 'ocean';
  if (/\b(autumn|fall leaves|maple|harvest)\b/i.test(text)) return 'autumn';
  if (/\b(rain|rainy|storm|drizzle|raincoat)\b/i.test(text)) return 'rain';
  if (/\b(sakura|cherry blossom|blossom)\b/i.test(text)) return 'sakura';
  if (/\b(garden|park|outdoors?|nature)\b/i.test(text)) return 'garden';
  if (/\b(night|moonlit|midnight|deep-sea)\b/i.test(text)) return 'night';
  if (plan === 'quadruped') return 'sky';
  if (plan === 'octopod') return 'night';
  if (plan === 'biped' && human) return 'meadow';
  return 'studio';
}

/** Read the named human actions in the order the brief mentions them. */
function humanBeats(text: string, actor: string): Beat[] {
  const defs: Array<[RegExp, Verb, number]> = [
    [/\b(wave|waves|hello|greet|greets)\b/i, 'wave', 2000],
    [/\b(point|points|pointing|gesture)\b/i, 'point', 1600],
    [/\b(think|thinks|thinking|ponder|wonder)\b/i, 'think', 1900],
    [/\b(shrug|shrugs|shrugging)\b/i, 'shrug', 1600],
    [/\b(clap|claps|clapping|applaud)\b/i, 'clap', 1800],
    [/\b(laugh|laughs|laughing|giggle|chuckle)\b/i, 'laugh', 1800],
    [/\b(dance|dances|dancing|groove|boogie)\b/i, 'dance', 2800],
    [/\b(bow|bows|bowing)\b/i, 'bow', 1800],
    [/\b(run|runs|running|sprint)\b/i, 'run', 2200],
    [/\b(stretch|stretches|stretching)\b/i, 'stretch', 2000],
    [/\b(yawn|yawns|yawning)\b/i, 'yawn', 1800],
    [/\b(wink|winks|winking)\b/i, 'wink', 1200],
    [/\b(stir|stirs|stirring|flip|pancake)\b/i, 'stir', 2200],
    [/\b(nod|nods|nodding)\b/i, 'nod', 1100],
    [/\b(jump|jumps|hop|leap)\b/i, 'jump', 1000],
    [/\b(celebrate|celebrates|win|victory|party)\b/i, 'celebrate', 1700],
  ];
  const found = defs
    .map(([re, verb, dur]) => {
      const m = text.match(re);
      return m && m.index !== undefined ? { verb, dur, index: m.index } : null;
    })
    .filter((v): v is { verb: Verb; dur: number; index: number } => Boolean(v))
    .sort((a, b) => a.index - b.index);

  const picked = found.slice(0, 3);
  if (picked.length === 0) picked.push({ verb: 'wave', dur: 2000, index: 0 }, { verb: 'laugh', dur: 1800, index: 1 });

  const slots = [2200, 4500, 6700];
  return picked.map((action, i) => ({
    actor,
    verb: action.verb,
    at: slots[i],
    dur: action.dur,
    intensity: 0.9,
  }));
}

function singleScene(text: string, h: number, plan: Plan): Scene {
  const genome = genomeFor(text, h, plan);
  const human = genome.human;
  const actor: Actor = {
    id: genome.id,
    genome,
    skeleton: buildSkeleton(genome),
    pose: 'stand',
    depth: 0,
  };

  const baseVerb = plan === 'quadruped' ? 'walk' : 'idle';
  const beats: Beat[] = [
    { actor: actor.id, verb: baseVerb, at: 0, dur: 9600, layer: 'base' },
    { actor: actor.id, verb: 'look', at: 500, dur: 1200, target: 'viewer' },
  ];

  const shy = /\b(shy|nervous|timid|hide|hides|hiding|peek|peeks|bashful)\b/i.test(text);
  const tennis = /\b(tennis|racket|serve|forehand|backhand)\b/i.test(text);
  const rear = /\b(rear|rears|buck|bucks|prance)\b/i.test(text) && plan === 'quadruped';
  const celebrate = /\b(celebrate|win|victory|dance|party|cheer|excited)\b/i.test(text);
  const jump = /\b(jump|hop|bounce|leap)\b/i.test(text);

  if (tennis) {
    beats.push({ actor: actor.id, verb: 'swing', at: 2200, dur: 2000, intensity: 0.95 });
    if (/\b(celebrate|celebrates|win|victory|cheer)\b/i.test(text)) {
      beats.push({ actor: actor.id, verb: 'celebrate', at: 4800, dur: 1700, intensity: 0.9 });
    }
    if (/\b(wave|waves|hello|greet)\b/i.test(text)) {
      beats.push({ actor: actor.id, verb: 'wave', at: 7000, dur: 1900, intensity: 0.8 });
    }
    if (!beats.some((beat) => beat.layer !== 'base' && beat.verb !== 'swing')) {
      beats.push({ actor: actor.id, verb: 'nod', at: 5800, dur: 1000 });
    }
  } else if (plan === 'biped' && human) {
    beats.push(...humanBeats(text, actor.id));
  } else if (shy) {
    beats.push({ actor: actor.id, verb: 'greet', at: 2400, dur: 2000, intensity: 0.6 });
    beats.push({ actor: actor.id, verb: 'hide', at: 5200, dur: 1800, intensity: 0.8 });
    beats.push({ actor: actor.id, verb: 'peek', at: 7600, dur: 1200, intensity: 0.7 });
  } else {
    beats.push({ actor: actor.id, verb: 'greet', at: 2400, dur: 2200, intensity: 0.8 });
    if (rear) beats.push({ actor: actor.id, verb: 'rear', at: 5800, dur: 1600, intensity: 0.7 });
    else if (celebrate) beats.push({ actor: actor.id, verb: 'celebrate', at: 5800, dur: 1600 });
    else if (jump) beats.push({ actor: actor.id, verb: 'jump', at: 5800, dur: 900 });
    else beats.push({ actor: actor.id, verb: 'nod', at: 5800, dur: 1000 });
  }

  return newScene(
    `${genome.name} — ${genome.species}`,
    { preset: worldFor(text, plan, human), accent: genome.palette.accent },
    [actor],
    { duration: 9600, mood: shy ? 'shy' : human ? 'warm' : 'curious', beats },
  );
}

function mountScene(text: string, h: number, mountSpecies: string): Scene {
  const mountPlan: Plan = 'quadruped';
  const riderPlan: Plan = 'biped';
  const mount = genomeFor(text, h, mountPlan, {
    id: 'mount',
    species: mountSpecies,
    mount: true,
  });
  const rider = genomeFor(text, h ^ 0x7f4a7c15, riderPlan, {
    id: 'rider',
    species: /\bcowboy\b|\bcowgirl\b/i.test(text) ? 'cowboy' : 'rider',
    rider: true,
  });

  mount.id = 'mount';
  rider.id = 'rider';
  mount.accessories = accessoriesFor(text, { mount: true });
  rider.accessories = accessoriesFor(text, { mount: false });
  mount.proportions.torso *= 1.15;
  mount.proportions.limbLength *= 1.1;
  rider.proportions.head *= 0.95;

  const mountActor: Actor = {
    id: 'mount',
    genome: mount,
    skeleton: buildSkeleton(mount),
    pose: 'stand',
    depth: 0,
  };
  const riderActor: Actor = {
    id: 'rider',
    genome: rider,
    skeleton: buildSkeleton(rider),
    pose: 'ride',
    depth: 1,
    attach: {
      actor: 'mount',
      bone: mountActor.skeleton.back ?? 'back',
      x: 0,
      y: 0,
      rot: 0,
      scale: 0.62,
    },
  };

  const beats: Beat[] = [
    { actor: 'mount', verb: 'walk', at: 0, dur: 9600, layer: 'base' },
    { actor: 'rider', verb: 'idle', at: 0, dur: 9600, layer: 'base' },
    { actor: 'rider', verb: 'look', at: 600, dur: 1200, target: 'viewer' },
    { actor: 'rider', verb: 'greet', at: 2400, dur: 2200, intensity: 0.8 },
  ];

  const rear = /\b(rear|rears|buck|bucks|prance)\b/i.test(text);
  if (rear) {
    beats.push({ actor: 'mount', verb: 'rear', at: 6000, dur: 1600, intensity: 0.7 });
    beats.push({ actor: 'rider', verb: 'celebrate', at: 6400, dur: 1600, intensity: 0.8 });
  } else {
    beats.push({ actor: 'rider', verb: 'celebrate', at: 5800, dur: 1600, intensity: 0.8 });
  }

  return newScene(
    `${rider.name} & ${mount.name} — trail ride`,
    { preset: 'sky', accent: rider.palette.accent },
    [mountActor, riderActor],
    { duration: 9600, mood: 'confident', beats },
  );
}

export function localScene(prompt: string): Scene {
  const text = (prompt || '').trim() || 'A friendly mascot for a new brand';
  const h = hashText(text);

  if (RIDING.test(text) || (MOUNT.test(text) && /\bon\b/i.test(text))) {
    const mountSpecies = MOUNT.test(text)
      ? (text.match(MOUNT)?.[0] ?? 'horse').toLowerCase()
      : 'horse';
    return mountScene(text, h, mountSpecies);
  }

  return singleScene(text, h, bodyPlanFor(text, h));
}

const COLOR_WORDS: Record<string, string> = {
  red: '#D9544D',
  blue: '#4A8FD4',
  green: '#5E9E64',
  purple: '#7C4DD8',
  orange: '#E58A45',
  pink: '#E67FA0',
  yellow: '#F2B84B',
  teal: '#3AA6A0',
  cream: '#F3DDB4',
};

/** Human edits stay on the genome: hair, facial hair, outfit, body, face. The
 * skeleton and score are untouched, which is exactly the demo claim. */
function applyHumanEdit(human: HumanLook, text: string): HumanLook | null {
  const hair = { ...human.hair };
  const outfit = { ...human.outfit };
  const body = { ...human.body };
  const face = { ...human.face };
  let presentation = human.presentation;
  let facialHair = human.facialHair;
  let changed = false;

  const setHair = (style: HairStyle, fringe = hair.fringe) => {
    hair.style = style;
    hair.fringe = fringe;
    changed = true;
  };
  if (/\bafro\b/.test(text)) setHair('afro', 'none');
  else if (/\bbraids?\b/.test(text)) setHair('braids', 'straight');
  else if (/\b(ponytail|high pony)\b/.test(text)) setHair('ponytail', 'side');
  else if (/\bbun\b/.test(text)) setHair('bun', 'none');
  else if (/\bbob\b/.test(text)) setHair('bob', 'straight');
  else if (/\b(curly|curls)\b/.test(text)) setHair('curly');
  else if (/\b(bald|shaved head)\b/.test(text)) setHair('bald', 'none');
  else if (/\blong hair\b|\bshoulder-length\b/.test(text)) setHair('long');
  else if (/\b(short hair|cropped)\b/.test(text)) setHair('short');

  if (/\b(no beard|clean[- ]shaven|shave)\b/.test(text)) {
    facialHair = 'none';
    changed = true;
  } else if (/\b(full beard|beard)\b/.test(text)) {
    facialHair = 'beard';
    changed = true;
  } else if (/\b(mustache|moustache|stache)\b/.test(text)) {
    facialHair = 'mustache';
    changed = true;
  } else if (/\bstubble\b/.test(text)) {
    facialHair = 'stubble';
    changed = true;
  } else if (/\bgoatee\b/.test(text)) {
    facialHair = 'goatee';
    changed = true;
  }

  if (/\b(dress|gown)\b/.test(text)) {
    outfit.top = 'dress';
    outfit.bottom = 'none';
    changed = true;
  } else if (/\bsuit\b|\bblazer\b/.test(text)) {
    outfit.top = 'suit';
    outfit.bottom = 'chinos';
    changed = true;
  } else if (/\bhoodie\b|\bsweatshirt\b/.test(text)) {
    outfit.top = 'hoodie';
    changed = true;
  } else if (/\b(coat|jacket|parka)\b/.test(text)) {
    outfit.top = 'coat';
    changed = true;
  } else if (/\bapron\b/.test(text)) {
    outfit.top = 'apron';
    changed = true;
  } else if (/\bblouse\b/.test(text)) {
    outfit.top = 'blouse';
    changed = true;
  } else if (/\b(tee|t-shirt)\b/.test(text)) {
    outfit.top = 'tee';
    changed = true;
  } else if (/\bshirt\b/.test(text)) {
    outfit.top = 'shirt';
    changed = true;
  } else if (/\bsport\b|\bjersey\b/.test(text)) {
    outfit.top = 'sport';
    changed = true;
  }

  if (/\bskirt\b/.test(text)) {
    outfit.bottom = 'skirt';
    changed = true;
  } else if (/\bshorts\b/.test(text)) {
    outfit.bottom = 'shorts';
    changed = true;
  } else if (/\bjeans\b/.test(text)) {
    outfit.bottom = 'jeans';
    changed = true;
  } else if (/\b(trousers|chinos|pants)\b/.test(text)) {
    outfit.bottom = 'chinos';
    changed = true;
  }

  if (/\bsneakers?\b|\btrainers?\b/.test(text)) {
    outfit.shoes = 'sneakers';
    changed = true;
  } else if (/\bboots?\b/.test(text)) {
    outfit.shoes = 'boots';
    changed = true;
  } else if (/\bflats?\b/.test(text)) {
    outfit.shoes = 'flats';
    changed = true;
  } else if (/\bbarefoot\b/.test(text)) {
    outfit.shoes = 'barefoot';
    changed = true;
  }

  if (/\b(feminine|woman|girl)\b/.test(text) && /\b(presentation|make (her|them)|more feminine)\b/.test(text)) {
    presentation = 'feminine';
    changed = true;
  } else if (/\b(masculine|man|boy)\b/.test(text) && /\b(presentation|make (him|them)|more masculine)\b/.test(text)) {
    presentation = 'masculine';
    changed = true;
  } else if (/\bandrogynous\b/.test(text)) {
    presentation = 'androgynous';
    changed = true;
  }

  if (/\bcurvy\b|\bwide hips\b/.test(text)) {
    body.hips = 1.12;
    changed = true;
  }
  if (/\bbroad shoulders?\b/.test(text)) {
    body.shoulders = 1.13;
    changed = true;
  }
  if (/\bslim\b|\bnarrow\b/.test(text)) {
    body.waist = 0.94;
    body.shoulders = Math.min(body.shoulders, 0.95);
    changed = true;
  }
  if (/\btaller\b/.test(text)) {
    body.height = Math.min(1.1, body.height + 0.05);
    changed = true;
  }
  if (/\bshorter\b/.test(text)) {
    body.height = Math.max(0.9, body.height - 0.05);
    changed = true;
  }
  if (/\bsquare jaw\b/.test(text)) {
    face.jaw = 'square';
    changed = true;
  }
  if (/\blashes\b/.test(text)) {
    face.lashes = true;
    changed = true;
  }
  if (/\bstrong brow\b/.test(text)) {
    face.brow = 'strong';
    changed = true;
  }

  if (!changed) return null;
  return { presentation, hair, facialHair, body, outfit, face };
}

/**
 * The offline edit path. It must never replace the scene with a fresh preset:
 * a rider stays attached, the cast stays the same, and only the requested
 * world/timing/colour changes. Returns null when the payload is unusable.
 */
export function localEdit(previous: unknown, prompt: string): Scene | null {
  if (!previous || typeof previous !== 'object') return null;
  const base = previous as {
    title?: unknown;
    world?: { preset?: unknown; accent?: unknown };
    actors?: unknown;
    score?: {
      duration?: unknown;
      mood?: unknown;
      beats?: Array<{
        actor?: unknown;
        verb?: unknown;
        at?: unknown;
        dur?: unknown;
        target?: unknown;
        intensity?: unknown;
        layer?: unknown;
      }>;
    };
  };
  if (!Array.isArray(base.actors) || base.actors.length === 0) return null;

  const actors: Actor[] = [];
  for (let i = 0; i < base.actors.length; i++) {
    const raw = base.actors[i] as Partial<Actor> & { genome?: Genome };
    if (!raw?.genome || typeof raw.genome !== 'object') return null;
    try {
      actors.push({
        id: raw.id ?? raw.genome.id ?? `actor-${i}`,
        genome: raw.genome,
        skeleton: raw.skeleton ?? buildSkeleton(raw.genome),
        attach: raw.attach,
        pose: raw.pose ?? (raw.attach ? 'ride' : 'stand'),
        place: raw.place,
        depth: raw.depth ?? i,
      });
    } catch {
      return null;
    }
  }

  const text = prompt.toLowerCase();
  const previousDuration =
    typeof base.score?.duration === 'number' ? base.score.duration : 9600;
  const slow = /\b(slower|slow|slowly|calmer|calm|relaxed)\b/.test(text);
  const fast = /\b(faster|fast|quick|quickly|snappier)\b/.test(text);
  const factor = slow && !fast ? 1.3 : fast && !slow ? 0.75 : 1;
  const duration = Math.max(5000, Math.min(14000, Math.round(previousDuration * factor)));

  const rawBeats = Array.isArray(base.score?.beats) ? base.score!.beats! : [];
  const beats: Beat[] = rawBeats
    .filter((b) => typeof b?.verb === 'string' && typeof b?.actor === 'string')
    .map((b) => ({
      actor: String(b.actor),
      verb: b.verb as Beat['verb'],
      at: Math.round(Number(b.at ?? 0) * factor),
      dur: Math.round(Number(b.dur ?? 1200) * factor),
      target: b.target as Beat['target'],
      intensity: typeof b.intensity === 'number' ? b.intensity : undefined,
      layer: b.layer as Beat['layer'],
    }))
    .filter((b) => b.at < duration)
    .map((b) => ({ ...b, dur: Math.min(b.dur, duration - b.at) }));

  // Keep each actor's base layer continuous after a duration edit.
  for (const actor of actors) {
    const bases = beats
      .filter((b) => b.actor === actor.id && b.layer === 'base')
      .sort((a, b) => a.at - b.at);
    for (let i = 0; i < bases.length - 1; i++) {
      const current = bases[i];
      const next = bases[i + 1];
      if (current.at + current.dur < next.at) current.dur = next.at - current.at;
    }
    const last = bases[bases.length - 1];
    if (last && last.at + last.dur < duration) last.dur = duration - last.at;
  }

  let preset = (base.world?.preset as Scene['world']['preset']) ?? 'studio';
  if (/\b(night|midnight|dark|moonlit)\b/.test(text)) preset = 'night';
  else if (/\b(day|daylight|morning|sunny|noon)\b/.test(text)) preset = 'sky';
  else if (/\b(meadow|wildflower|field)\b/.test(text)) preset = 'meadow';
  else if (/\b(forest|woods|woodland)\b/.test(text)) preset = 'forest';
  else if (/\b(sunset|dusk|golden hour)\b/.test(text)) preset = 'sunset';
  else if (/\b(desert|dune|cactus)\b/.test(text)) preset = 'desert';
  else if (/\b(winter|snow|lodge|frost)\b/.test(text)) preset = 'winter';
  else if (/\b(ocean|beach|sea|coast)\b/.test(text)) preset = 'ocean';
  else if (/\b(autumn|maple|harvest)\b/.test(text)) preset = 'autumn';
  else if (/\b(rain|rainy|storm|raincoat)\b/.test(text)) preset = 'rain';
  else if (/\b(sakura|cherry blossom|blossom)\b/.test(text)) preset = 'sakura';
  else if (/\b(garden|park|outdoors?)\b/.test(text)) preset = 'garden';
  else if (/\b(kitchen|cafe|bakery)\b/.test(text)) preset = 'kitchen';
  else if (/\b(studio|clean|minimal|plain)\b/.test(text)) preset = 'studio';

  for (const actor of actors) {
    if (actor.genome.bodyPlan !== 'biped') continue;
    const current = actor.genome.human ?? humanFor(actor.id, hashText(actor.id));
    const next = applyHumanEdit(current, text);
    if (next) actor.genome = { ...actor.genome, human: next };
  }

  let accent =
    typeof base.world?.accent === 'string'
      ? base.world.accent
      : actors[0]?.genome.palette.accent ?? '#4B63FF';
  for (const [word, hex] of Object.entries(COLOR_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(text)) {
      accent = hex;
      break;
    }
  }

  return {
    title: typeof base.title === 'string' && base.title ? base.title : actors[0].genome.name,
    world: { preset, accent },
    actors,
    score: {
      duration,
      mood: typeof base.score?.mood === 'string' ? base.score.mood : 'curious',
      beats: beats.length
        ? beats
        : [{ actor: actors[0].id, verb: 'idle', at: 0, dur: duration, layer: 'base' }],
    },
  };
}

export { hashText };
