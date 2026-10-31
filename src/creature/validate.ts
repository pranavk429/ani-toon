// The model's JSON is untrusted. Clamp, default, drop, and build the skeletons.
// A bad generation must never crash the stage; the worst case is a weird but
// coherent creature that the compiler can still perform.

import { mix } from '../toon/shapes';
import { buildSkeleton } from './skeleton';
import {
  type AccessoryKind,
  type Actor,
  type Beat,
  type BodyPlan,
  type Bottom,
  type FaceSpec,
  type FacialHair,
  type Fringe,
  type Genome,
  type HairStyle,
  type HumanLook,
  type Palette,
  type Presentation,
  type Scene,
  type SceneObject,
  type SceneObjectKind,
  type Shoes,
  type SurfaceKind,
  type SurfacePattern,
  type Top,
  type Verb,
  type WorldPreset,
} from './types';

const HEX = /^#[0-9a-fA-F]{6}$/;
const hex = (v: unknown, d: string) => (typeof v === 'string' && HEX.test(v) ? v : d);
const str = (v: unknown, d = '') => (typeof v === 'string' ? v.trim() : d);
const num = (v: unknown, lo: number, hi: number, d: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;
const oneOf = <T extends string>(v: unknown, all: readonly T[], d: T): T =>
  typeof v === 'string' && (all as readonly string[]).includes(v) ? (v as T) : d;

const BODY_PLANS = ['biped', 'quadruped', 'octopod', 'blob', 'custom'] as const;
const WORLD_PRESETS = [
  'sky', 'garden', 'kitchen', 'night', 'studio', 'court',
  'meadow', 'forest', 'sunset', 'desert', 'winter', 'ocean', 'autumn', 'rain', 'sakura',
] as const;
const VERBS = [
  'idle', 'look', 'greet', 'move', 'reach', 'celebrate', 'hide', 'interact',
  'emote', 'walk', 'trot', 'gallop', 'rear', 'peek', 'wave', 'nod', 'shake',
  'jump', 'swing', 'point', 'think', 'shrug', 'clap', 'laugh', 'dance', 'bow',
  'run', 'stretch', 'yawn', 'wink', 'stir',
] as const;
const LAYERS = ['base', 'action'] as const;
const TARGETS = ['viewer', 'left', 'right', 'up', 'down', 'prop', 'self'] as const;
const SURFACES = ['fur', 'feathers', 'scales', 'skin', 'metal', 'goo'] as const;
const PATTERNS = ['none', 'spots', 'stripes', 'plates'] as const;
const PUPILS = ['round', 'slit', 'star'] as const;
const MOUTHS = ['smile', 'grin', 'fang', 'beak', 'none'] as const;
const OBJECT_KINDS = [
  'ball', 'star', 'plant', 'flower', 'cup', 'gift', 'heart', 'watering-can',
  'pancake', 'racket', 'sparkle', 'cloud', 'orb', 'flower-pot', 'rocket', 'note',
] as const;

const ACCESSORIES = [
  'cowboy-hat', 'chef-hat', 'beanie', 'cap', 'glasses', 'scarf', 'saddle', 'reins',
  'leaf-ears', 'tennis-racket', 'none',
] as const;

const PRESENTATIONS = ['feminine', 'masculine', 'androgynous'] as const;
const HAIR_STYLES = [
  'short', 'bob', 'ponytail', 'bun', 'long', 'curly', 'afro', 'braids', 'bald',
] as const;
const FRINGES = ['none', 'straight', 'side', 'curtain'] as const;
const FACIAL_HAIR = ['none', 'stubble', 'mustache', 'goatee', 'beard'] as const;
const TOPS = [
  'tee', 'hoodie', 'shirt', 'blouse', 'dress', 'suit', 'apron', 'coat', 'sport',
] as const;
const BOTTOMS = ['jeans', 'chinos', 'shorts', 'skirt', 'leggings', 'none'] as const;
const SHOES = ['sneakers', 'boots', 'flats', 'barefoot'] as const;

const BASE_VERBS = new Set<string>(['idle', 'walk', 'trot', 'gallop']);

const DEFAULTS: Record<Exclude<BodyPlan, 'custom'>, Palette> = {
  biped: {
    skin: '#F3C9A3', belly: '#FFF1DC', accent: '#4A8FD4', detail: '#6B4A33',
    eye: '#2B2233', mouth: '#9A4B3F', cloth: '#4A8FD4', trim: '#FFF1DC', hair: '#A9683A',
    pants: '#3F5F86',
  },
  quadruped: {
    skin: '#B97A45', belly: '#E8C39E', accent: '#C4573F', detail: '#63402A',
    eye: '#2B2233', mouth: '#5B3A2B', hair: '#EAD3A0',
  },
  octopod: {
    skin: '#7C4DD8', belly: '#C9A9F2', accent: '#F7C948', detail: '#532B9F',
    eye: '#2B1B3F', mouth: '#5B2A4E',
  },
  blob: {
    skin: '#6E9E6A', belly: '#A9C99A', accent: '#F2B84B', detail: '#476E4B',
    eye: '#2C3A2E', mouth: '#5B3A2B', hair: '#4E8A5C',
  },
};

function slug(v: string, fallback: string): string {
  return (
    v
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24) || fallback
  );
}

function defaultFace(): FaceSpec {
  return { eyes: 2, eyeSize: 1, eyeSpacing: 1, pupil: 'round', mouth: 'smile', brows: true };
}

function normalisePlan(v: unknown, species: string): Exclude<BodyPlan, 'custom'> {
  const plan = oneOf(v, BODY_PLANS, 'biped');
  if (plan !== 'custom') return plan;
  // The custom bone-tree path is a later feature. Until then, pick the closest
  // buildable plan so the model can still invent a creature.
  if (/octopus|squid|spider|jelly|tentacle/i.test(species)) return 'octopod';
  if (/horse|dog|cat|lion|wolf|fox|cow|bear|dragon|dino|deer|elephant|mount/i.test(species))
    return 'quadruped';
  if (/blob|slime|ghost|goo|cloud/i.test(species)) return 'blob';
  return 'biped';
}

function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(all: readonly T[], h: number, shift: number): T {
  return all[(h >>> shift) % all.length];
}

/**
 * The hosted model frequently forgets the human object. Infer a coherent look
 * from the brief, then clamp whatever it did supply. Presentation is shape
 * language: it changes proportions and styling, never a costume rule.
 */
function normaliseHuman(
  raw: unknown,
  brief: string,
  plan: Exclude<BodyPlan, 'custom'>,
  seed: string,
): HumanLook | undefined {
  if (plan !== 'biped') return undefined;

  const r = (raw ?? {}) as Record<string, unknown>;
  const rh = (r.hair ?? {}) as Record<string, unknown>;
  const rb = (r.body ?? {}) as Record<string, unknown>;
  const ro = (r.outfit ?? {}) as Record<string, unknown>;
  const rf = (r.face ?? {}) as Record<string, unknown>;
  const h = hashString(`${seed}:${brief}`);
  const text = brief.toLowerCase();

  let presentation = oneOf(r.presentation, PRESENTATIONS, 'androgynous') as Presentation;
  if (r.presentation === undefined) {
    if (/\b(woman|women|girl|girls|lady|ladies|mother|mom|mum|grandmother|grandma|she|her|actress|bride)\b/i.test(text)) {
      presentation = 'feminine';
    } else if (/\b(man|men|boy|boys|guy|guys|father|dad|grandfather|grandpa|he|his|actor|groom)\b/i.test(text)) {
      presentation = 'masculine';
    } else if (/\b(androgynous|nonbinary|non-binary|they|them)\b/i.test(text)) {
      presentation = 'androgynous';
    }
  }

  const styleRaw = str(rh.style);
  let style = (HAIR_STYLES as readonly string[]).includes(styleRaw)
    ? (styleRaw as HairStyle)
    : undefined;
  if (!style) {
    if (/\b(afro)\b/i.test(text)) style = 'afro';
    else if (/\b(braids?|locs?|dreadlocks?)\b/i.test(text)) style = 'braids';
    else if (/\b(ponytail|pony tail|high pony)\b/i.test(text)) style = 'ponytail';
    else if (/\b(bun|updo)\b/i.test(text)) style = 'bun';
    else if (/\b(bob)\b/i.test(text)) style = 'bob';
    else if (/\b(curly|curls)\b/i.test(text)) style = 'curly';
    else if (/\b(bald|shaved|no hair)\b/i.test(text)) style = 'bald';
    else if (/\b(long hair|long-haired|shoulder-length)\b/i.test(text)) style = 'long';
    else if (/\b(short hair|short-haired|cropped)\b/i.test(text)) style = 'short';
    else if (/\b(chef|baker|barista|athlete)\b/i.test(text)) style = 'short';
    else {
      style = pick(
        ['short', 'bob', 'ponytail', 'bun', 'long', 'curly', 'afro', 'braids'],
        h,
        2,
      );
    }
  }

  const fringeRaw = str(rh.fringe);
  let fringe = (FRINGES as readonly string[]).includes(fringeRaw)
    ? (fringeRaw as Fringe)
    : undefined;
  if (!fringe) {
    if (/\b(curtain bangs?|curtain fringe)\b/i.test(text)) fringe = 'curtain';
    else if (/\b(bangs?|fringe)\b/i.test(text)) fringe = 'straight';
    else if (/\bside[- ]part\b/i.test(text)) fringe = 'side';
    else if (style === 'bald' || style === 'bun' || style === 'afro' || style === 'curly') {
      fringe = 'none';
    } else fringe = style === 'bob' ? 'straight' : 'side';
  }
  // A short/bob/long style with "no fringe" reads as a receding hairline, not
  // a choice. Keep none only for pulled-back styles or an explicit request.
  if (
    fringe === 'none' &&
    (style === 'short' || style === 'bob' || style === 'long') &&
    !/\b(no bangs?|pulled back|slicked|no fringe|receding)\b/i.test(text)
  ) {
    fringe = style === 'bob' ? 'straight' : 'side';
  }

  let facialHair = oneOf(r.facialHair, FACIAL_HAIR, 'none') as FacialHair;
  if (r.facialHair === undefined) {
    if (/\b(full beard|beard|bearded|whiskers)\b/i.test(text)) facialHair = 'beard';
    else if (/\b(mustache|moustache|stache)\b/i.test(text)) facialHair = 'mustache';
    else if (/\b(goatee)\b/i.test(text)) facialHair = 'goatee';
    else if (/\b(stubble|five o'clock|shadow)\b/i.test(text)) facialHair = 'stubble';
  }

  let shoulders = 0.97 + ((h >>> 3) % 5) * 0.02;
  let hips = 0.97 + ((h >>> 5) % 5) * 0.02;
  let waist = 0.95 + ((h >>> 7) % 5) * 0.02;
  let height = 0.96 + ((h >>> 9) % 5) * 0.02;
  if (/\b(broad[- ]shouldered|broad shoulders?|burly|athletic|muscular|strong shoulders?)\b/i.test(text)) shoulders = 1.13;
  if (/\b(narrow|slim|lean|petite|willowy)\b/i.test(text)) shoulders = 0.92;
  if (/\b(curvy|hourglass|wide hips)\b/i.test(text)) hips = 1.13;
  if (/\b(round|chubby|belly|stocky|pudgy|hearty)\b/i.test(text)) {
    waist = 1.08;
    hips = Math.max(hips, 1.04);
  }
  if (/\b(tall|towering|long-legged)\b/i.test(text)) height = 1.08;
  if (/\b(short|petite|small|little)\b(?!\s+(hair|beard|fringe|bangs|sleeves?|crop|story))/i.test(text)) {
    height = 0.94;
  }
  const body = {
    shoulders: num(rb.shoulders, 0.85, 1.2, shoulders),
    hips: num(rb.hips, 0.85, 1.2, hips),
    waist: num(rb.waist, 0.85, 1.1, waist),
    height: num(rb.height, 0.9, 1.1, height),
  };

  const topRaw = str(ro.top);
  let top = (TOPS as readonly string[]).includes(topRaw) ? (topRaw as Top) : undefined;
  if (!top) {
    if (/\b(chef|cook|bakery|baker|apron)\b/i.test(text)) top = 'apron';
    else if (/\b(suit|tie|blazer|business|formal)\b/i.test(text)) top = 'suit';
    else if (/\b(dress|gown|travel|traveler|traveller)\b/i.test(text)) top = 'dress';
    else if (/\b(hoodie|sweatshirt)\b/i.test(text)) top = 'hoodie';
    else if (/\b(coat|jacket|parka|raincoat|winter|snow)\b/i.test(text)) top = 'coat';
    else if (/\b(blouse)\b/i.test(text)) top = 'blouse';
    else if (/\b(tennis|sport|jersey|athlete|runner|fitness)\b/i.test(text)) top = 'sport';
    else if (/\b(shirt|button[- ]down|oxford)\b/i.test(text)) top = 'shirt';
    else if (/\b(tee|t-shirt|tshirt)\b/i.test(text)) top = 'tee';
    else {
      const pool: readonly Top[] =
        presentation === 'masculine'
          ? ['tee', 'shirt', 'hoodie', 'coat', 'sport', 'suit', 'apron']
          : presentation === 'feminine'
            ? ['tee', 'shirt', 'blouse', 'dress', 'hoodie', 'coat', 'sport', 'apron', 'suit']
            : ['tee', 'shirt', 'blouse', 'dress', 'hoodie', 'coat', 'sport', 'apron', 'suit'];
      top = pick(pool, h, 11);
    }
  }

  const bottomRaw = str(ro.bottom);
  let bottom = (BOTTOMS as readonly string[]).includes(bottomRaw)
    ? (bottomRaw as Bottom)
    : undefined;
  if (!bottom) {
    if (/\b(skirt)\b/i.test(text)) bottom = 'skirt';
    else if (/\b(shorts)\b/i.test(text)) bottom = 'shorts';
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
    else if (top === 'blouse') bottom = pick(['skirt', 'chinos', 'jeans'], h, 13);
    else bottom = pick(['jeans', 'chinos', 'shorts'], h, 13);
  }

  const shoesRaw = str(ro.shoes);
  let shoes = (SHOES as readonly string[]).includes(shoesRaw) ? (shoesRaw as Shoes) : undefined;
  if (!shoes) {
    if (/\b(barefoot|bare feet)\b/i.test(text)) shoes = 'barefoot';
    else if (top === 'sport' || /\b(sneakers?|trainers?)\b/i.test(text)) shoes = 'sneakers';
    else if (top === 'apron') shoes = 'boots';
    else if (top === 'coat') shoes = /\b(winter|snow|lodge|rain|storm)\b/i.test(text) ? 'boots' : 'sneakers';
    else if (/\b(boots?|winter|snow)\b/i.test(text)) shoes = 'boots';
    else if (top === 'dress' || bottom === 'skirt' || /\b(flats?|heels?)\b/i.test(text)) shoes = 'flats';
    else if (top === 'hoodie' || top === 'shirt' || top === 'tee') shoes = 'sneakers';
    else shoes = pick(['sneakers', 'boots'], h, 15);
  }
  // The model likes to send a chef to work barefoot. Only honour barefoot
  // when the brief actually asks for it.
  if (shoes === 'barefoot' && !/\b(barefoot|bare feet)\b/i.test(text)) {
    shoes = top === 'apron' || top === 'coat' ? 'boots' : 'sneakers';
  }
  if (bottom === 'none' && top !== 'dress' && !/\b(no pants|swim|beach|bare legs)\b/i.test(text)) {
    bottom = 'jeans';
  }

  const jawRaw = str(rf.jaw);
  const jaw =
    (['soft', 'square'] as const).includes(jawRaw as 'soft' | 'square')
      ? (jawRaw as 'soft' | 'square')
      : /\b(square jaw|strong jaw|chiselled|chiseled)\b/i.test(text) ||
          (presentation === 'masculine' && ((h >>> 19) % 3 === 0))
        ? 'square'
        : 'soft';
  const browRaw = str(rf.brow);
  const brow =
    (['soft', 'strong'] as const).includes(browRaw as 'soft' | 'strong')
      ? (browRaw as 'soft' | 'strong')
      : /\b(strong brow|thick brow|heavy brow)\b/i.test(text) ||
          (presentation === 'masculine' && ((h >>> 21) % 2 === 0))
        ? 'strong'
        : 'soft';
  const noseRaw = str(rf.nose);
  const nose = (['small', 'medium', 'broad'] as const).includes(noseRaw as 'small' | 'medium' | 'broad')
    ? (noseRaw as 'small' | 'medium' | 'broad')
    : /\b(broad nose|wide nose)\b/i.test(text)
      ? 'broad'
      : /\b(small nose|button nose)\b/i.test(text)
        ? 'small'
        : pick(['small', 'medium', 'medium', 'broad'] as const, h, 23);
  const lashes =
    typeof rf.lashes === 'boolean'
      ? rf.lashes
      : /\b(lashes|mascara|eyelashes)\b/i.test(text) ||
        (presentation === 'feminine' && ((h >>> 17) % 2 === 0));

  return {
    presentation,
    hair: {
      style,
      fringe,
      volume: num(rh.volume, 0.7, 1.5, style === 'afro' || style === 'curly' ? 1.2 : 1),
    },
    facialHair,
    body,
    outfit: { top, bottom, shoes },
    face: { jaw, lashes, brow, nose },
  };
}

/** The first pass over the brief that decides the world when the model forgets
 * one. Kept separate from the human look so a horse brief can use it too. */
function worldFromBrief(brief: string): WorldPreset | undefined {
  const text = brief.toLowerCase();
  if (/\b(kitchen|bakery|cafe|cook|chef)\b/.test(text)) return 'kitchen';
  if (/\b(football|soccer|striker|goalkeeper|pitch|stadium)\b/.test(text)) return 'meadow';
  if (/\b(tennis|court|racket)\b/.test(text)) return 'court';
  if (/\b(meadow|field|wildflower|picnic|spring)\b/.test(text)) return 'meadow';
  if (/\b(forest|woods|woodland|moss)\b/.test(text)) return 'forest';
  if (/\b(sunset|dusk|golden hour|evening)\b/.test(text)) return 'sunset';
  if (/\b(desert|dune|sahara|cactus)\b/.test(text)) return 'desert';
  if (/\b(winter|snow|lodge|ice|frost)\b/.test(text)) return 'winter';
  if (/\b(ocean|beach|sea|coast|surf)\b/.test(text)) return 'ocean';
  if (/\b(autumn|fall leaves|maple|harvest)\b/.test(text)) return 'autumn';
  if (/\b(rain|rainy|storm|drizzle|raincoat)\b/.test(text)) return 'rain';
  if (/\b(sakura|cherry blossom|blossom)\b/.test(text)) return 'sakura';
  if (/\b(garden|outdoors?|park)\b/.test(text)) return 'garden';
  if (/\b(night|moonlit|midnight)\b/.test(text)) return 'night';
  return undefined;
}

function palettesFor(
  plan: Exclude<BodyPlan, 'custom'>,
  raw: unknown,
  human?: HumanLook,
): Palette {
  const d = DEFAULTS[plan];
  const p = (raw ?? {}) as Record<string, unknown>;
  const out: Palette = {
    skin: hex(p.skin, d.skin),
    belly: hex(p.belly, d.belly),
    accent: hex(p.accent, d.accent),
    detail: hex(p.detail, d.detail),
    eye: hex(p.eye, d.eye),
    mouth: hex(p.mouth, d.mouth),
  };
  // Garment slots are optional; keep them only when the director supplied one
  // so the renderer can fall back to accent/belly/detail.
  if (p.cloth !== undefined) out.cloth = hex(p.cloth, d.cloth ?? d.accent);
  if (p.trim !== undefined) out.trim = hex(p.trim, d.trim ?? d.belly);
  if (p.hair !== undefined) out.hair = hex(p.hair, d.hair ?? d.detail);
  if (p.pants !== undefined) out.pants = hex(p.pants, d.pants ?? d.detail);
  return harmonisePalette(out, plan, human);
}

function channels(color: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
}

function luminance(color: string): number {
  const [r, g, b] = channels(color);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function saturation(color: string): number {
  const [r, g, b] = channels(color);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = channels(a);
  const [r2, g2, b2] = channels(b);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return (
    '#' +
    [r + m, g + m, b + m]
      .map((v) => Math.round(v * 255).toString(16).padStart(2, '0'))
      .join('')
  );
}

/** Lift a muted skin colour toward the flat-vector palette without changing
 * its hue. Greys are left alone; they can be intentional. */
function vibrance(color: string): string {
  const [r, g, b] = channels(color);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
  if (s < 0.12 || s >= 0.4) return color;
  const d = max - min;
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return hslToHex(h, Math.max(s, 0.5), Math.min(0.6, Math.max(0.42, l)));
}

/**
 * The model is an art director, not a colourist. Left alone it ships white
 * pupils, washed-out bellies and near-black limbs. This pass forces the six
 * slots into the hard-cel palette contract: saturated skin, light underside,
 * dark detail, dark pupil, readable mouth.
 */
function harmonisePalette(
  p: Palette,
  plan: Exclude<BodyPlan, 'custom'>,
  human?: HumanLook,
): Palette {
  let skin = vibrance(p.skin);
  if (luminance(skin) < 0.24) skin = mix(skin, '#FFFFFF', 0.28);

  let detail = p.detail;
  if (luminance(detail) > luminance(skin) - 0.08) {
    detail = mix(skin, '#33253F', 0.58);
  }

  let belly = p.belly;
  if (luminance(belly) < luminance(skin) + 0.12) {
    belly = mix(skin, '#FFF1DA', 0.55);
  }

  let eye = p.eye;
  if (luminance(eye) > 0.3) eye = mix(detail, '#2B1B3F', 0.6);

  let mouth = p.mouth;
  if (luminance(mouth) > 0.4) mouth = mix(detail, '#5B2A4E', 0.55);

  let accent = p.accent;
  if (luminance(accent) < 0.12 || luminance(accent) > 0.9 || saturation(accent) < 0.2) {
    accent = mix(p.accent, '#F2B84B', 0.55);
  }

  const out: Palette = { ...p, skin, detail, belly, eye, mouth, accent };

  if (out.cloth && (luminance(out.cloth) < 0.12 || luminance(out.cloth) > 0.92)) {
    out.cloth = mix(out.cloth, '#FFFFFF', 0.18);
  }
  if (out.trim && luminance(out.trim) < luminance(skin) + 0.1) {
    out.trim = mix(skin, '#FFF1DA', 0.6);
  }
  if (out.hair && Math.abs(luminance(out.hair) - luminance(skin)) < 0.06) {
    out.hair = detail;
  }
  if (out.pants && luminance(out.pants) > 0.5) {
    out.pants = mix(out.pants, '#33253F', 0.35);
  }

  // Quadrupeds need a light mane/tail against the body, even when the model
  // forgets the optional hair slot.
  if (plan === 'quadruped' && (!out.hair || luminance(out.hair) < 0.55)) {
    out.hair = mix(out.belly, '#FFF1DA', 0.35);
  }

  // Bipeds need one clear garment colour. Muddy/black shirts become the brand
  // denim blue; saturated brand colours are left alone. A chef's cream coat or
  // a deliberate pale suit is shape language, so it keeps its value.
  if (plan === 'biped') {
    const cloth = out.cloth ?? out.accent;
    const paleGarment =
      Boolean(
        human &&
          (human.outfit.top === 'apron' ||
            human.outfit.top === 'coat' ||
            human.outfit.top === 'suit' ||
            human.outfit.top === 'shirt' ||
            human.outfit.top === 'blouse'),
      ) && luminance(cloth) > 0.68;
    if (
      !paleGarment &&
      (luminance(cloth) < 0.22 ||
        saturation(cloth) < 0.3 ||
        (luminance(cloth) < 0.32 && saturation(cloth) < 0.5) ||
        colorDistance(cloth, out.skin) < 0.22)
    ) {
      out.cloth = '#4A8FD4';
    } else if (!out.cloth) {
      out.cloth = cloth;
    } else if (paleGarment && luminance(out.cloth) > 0.93) {
      // Pure white is a screen, not a garment. Warm it to the reference cream.
      out.cloth = mix(out.cloth, '#F3E4C6', 0.55);
    }
  }

  // A saddle blanket needs to separate from the leather. If accent and detail
  // are the same mud, use the reference terracotta.
  if (colorDistance(out.accent, out.detail) < 0.2) {
    out.accent = '#C4573F';
  }

  return out;
}

function normaliseActor(raw: unknown, index: number, brief = ''): Genome {
  const a = (raw ?? {}) as Record<string, unknown>;
  const species = str(a.species, 'creature').slice(0, 40) || 'creature';
  const plan = normalisePlan(a.bodyPlan, species);
  const p = (a.proportions ?? {}) as Record<string, unknown>;
  const f = (a.face ?? {}) as Record<string, unknown>;
  const s = (a.surface ?? {}) as Record<string, unknown>;
  const id = slug(str(a.id, `actor-${index}`), `actor-${index}`);
  const name = str(a.name, 'Friend').slice(0, 24) || 'Friend';
  const human = normaliseHuman(a.human, brief, plan, `${id}:${name}:${species}`);

  const limbCount =
    plan === 'quadruped'
      ? 4
      : plan === 'octopod'
        ? Math.round(num(p.limbCount, 4, 12, 8))
        : plan === 'blob'
          ? 2
          : 2;

  const accessories = Array.isArray(a.accessories)
    ? (a.accessories as unknown[])
        .slice(0, 4)
        .map((v) => {
          const o = (v ?? {}) as Record<string, unknown>;
          const kind = oneOf(o.kind, ACCESSORIES, 'none');
          return {
            kind: kind as AccessoryKind,
            color: hex(o.color, '#5D3A1A'),
            attach: str(o.attach, 'head'),
          };
        })
        .filter((v) => v.kind !== 'none')
    : [];

  const mouthRaw = oneOf(f.mouth, MOUTHS, 'smile');
  const mouth =
    mouthRaw === 'none' && (plan === 'octopod' || plan === 'blob') ? 'smile' : mouthRaw;

  const palette = palettesFor(plan, a.palette, human);
  const text = brief.toLowerCase();
  const hasCowboyHat = accessories.some((v) => v.kind === 'cowboy-hat');
  if (plan === 'biped' && hasCowboyHat) {
    if (!palette.pants || luminance(palette.pants) < 0.25) {
      palette.pants = mix(palette.cloth ?? palette.accent, '#33253F', 0.42);
    }
    if (!accessories.some((v) => v.kind === 'scarf')) {
      accessories.push({ kind: 'scarf', color: '#E05243', attach: 'spine' });
    }
  }

  // Human wardrobe props that are part of the silhouette, not a general prop
  // system: a chef toque, a winter beanie, glasses.
  if (plan === 'biped' && human) {
    const wantsChef =
      /\b(chef|cook|bakery|baker|pancake|breakfast)\b/i.test(text) ||
      (human.outfit.top === 'apron' && /\b(kitchen|apron)\b/i.test(text));
    if (wantsChef && !accessories.some((v) => v.kind === 'chef-hat')) {
      accessories.push({ kind: 'chef-hat', color: '#FFF8EA', attach: 'head' });
    }
    if (wantsChef) {
      const chefHat = accessories.find((v) => v.kind === 'chef-hat');
      if (chefHat && luminance(chefHat.color) < 0.6) chefHat.color = '#FFF8EA';
      const scarf = accessories.find((v) => v.kind === 'scarf');
      if (scarf) scarf.color = '#C94A3F';
      else accessories.push({ kind: 'scarf', color: '#C94A3F', attach: 'spine' });
    }
    if (
      /\b(winter|snow|lodge|beanie|cozy)\b/i.test(text) &&
      !accessories.some((v) => v.kind === 'beanie' || v.kind === 'chef-hat')
    ) {
      accessories.push({ kind: 'beanie', color: palette.accent, attach: 'head' });
    }
    if (
      /\b(glasses|nerd|geek|smart)\b/i.test(text) &&
      !accessories.some((v) => v.kind === 'glasses')
    ) {
      accessories.push({ kind: 'glasses', color: palette.detail, attach: 'head' });
    }
  }

  const styledAccessories = accessories.map((accessory) => {
    if (
      accessory.kind === 'cowboy-hat' &&
      luminance(accessory.color) < 0.35
    ) {
      return { ...accessory, color: mix(accessory.color, '#D9A45E', 0.6) };
    }
    if (
      accessory.kind === 'tennis-racket' &&
      (luminance(accessory.color) > 0.72 || saturation(accessory.color) < 0.25)
    ) {
      return { ...accessory, color: '#2F6BBA' };
    }
    return accessory;
  });

  return {
    id,
    name,
    species,
    bodyPlan: plan,
    styleId: str(a.styleId, 'anitoon-storybook-v1'),
    seed: Math.round(
      num(a.seed, 0, 2_147_483_647, hashString(`${id}:${name}:${species}`) % 2_147_483_647),
    ),
    palette,
    proportions: {
      head: num(
        p.head,
        plan === 'octopod' || plan === 'blob' ? 1 : plan === 'biped' ? 0.95 : 0.85,
        1.45,
        1,
      ),
      torso: num(p.torso, 0.8, 1.35, human ? 1.04 : 1),
      limbLength: num(p.limbLength, 0.8, plan === 'octopod' ? 1.15 : 1.35, human ? 0.94 : 1),
      limbWidth: num(p.limbWidth, human ? 1.12 : 1.0, 1.45, human ? 1.24 : 1.05),
      limbCount,
      taper: num(p.taper, 0, 0.5, 0.2),
      neck: num(p.neck, 0.7, 1.6, 1),
    },
    face: {
      // Side-view animals read with one near eye; two eyes on the cheek is the
      // "human face pasted on an animal" tell we are trying to kill.
      eyes: plan === 'quadruped' ? 1 : Math.round(num(f.eyes, 1, 4, 2)),
      eyeSize: num(
        f.eyeSize,
        1.05,
        1.4,
        plan === 'quadruped' ? 1 : plan === 'octopod' || plan === 'blob' ? 1.15 : 1.1,
      ),
      eyeSpacing: num(f.eyeSpacing, 0.95, 1.35, 1.05),
      pupil: oneOf(f.pupil, PUPILS, 'round'),
      mouth,
      brows: f.brows !== false,
    },
    surface: {
      kind: oneOf(s.kind, SURFACES, plan === 'octopod' || plan === 'blob' ? 'goo' : 'fur') as SurfaceKind,
      pattern: oneOf(s.pattern, PATTERNS, 'none') as SurfacePattern,
    },
    accessories: styledAccessories,
    human,
  };
}

function normaliseBeats(raw: unknown, actorIds: Set<string>, duration: number): Beat[] {
  const list = Array.isArray(raw) ? raw.slice(0, 12) : [];
  const out: Beat[] = [];

  for (const v of list) {
    const b = (v ?? {}) as Record<string, unknown>;
    const actor = str(b.actor);
    if (!actorIds.has(actor)) continue;
    const verb = oneOf(b.verb, VERBS, 'look') as Verb;
    if (!(VERBS as readonly string[]).includes(str(b.verb))) continue;
    const at = Math.round(num(b.at, 0, Math.max(0, duration - 400), 0));
    const dur = Math.round(num(b.dur, 400, 8000, 1200));
    if (at + dur > duration) continue;
    out.push({
      actor,
      verb,
      at,
      dur,
      target: oneOf(b.target, TARGETS, 'viewer'),
      intensity: num(b.intensity, 0, 1, 1),
      layer: b.layer === 'base' || b.layer === 'action'
        ? b.layer
        : BASE_VERBS.has(verb)
          ? 'base'
          : 'action',
    });
  }

  return out;
}

function ensureScore(score: Beat[], actors: Actor[], duration: number): Beat[] {
  const out = [...score];
  for (const actor of actors) {
    const mine = out.filter((b) => b.actor === actor.id);
    const bases = mine
      .filter((b) => b.layer === 'base')
      .sort((a, b) => a.at - b.at);
    if (bases.length === 0) {
      out.unshift({
        actor: actor.id,
        verb: actor.genome.bodyPlan === 'quadruped' ? 'walk' : 'idle',
        at: 0,
        dur: duration,
        layer: 'base',
      });
    } else {
      // An edit can stretch score.duration without stretching the base. Keep
      // the base layer continuous: fill any gap up to the next base beat, and
      // run the last one to the end so breathing/gait never freeze.
      for (let i = 0; i < bases.length - 1; i++) {
        const current = bases[i];
        const next = bases[i + 1];
        if (current.at + current.dur < next.at) {
          current.dur = next.at - current.at;
        }
      }
      const last = bases[bases.length - 1];
      if (last.at + last.dur < duration) last.dur = duration - last.at;
    }
    if (!mine.some((b) => b.layer !== 'base')) {
      out.push(
        { actor: actor.id, verb: 'look', at: 500, dur: 1200, target: 'viewer', layer: 'action' },
        { actor: actor.id, verb: 'greet', at: 2400, dur: 2200, intensity: 0.8, layer: 'action' },
        { actor: actor.id, verb: 'nod', at: 6000, dur: 1000, layer: 'action' },
      );
    }
  }
  return out;
}

function addBriefAction(
  out: Beat[],
  actorId: string,
  verb: Verb,
  at: number,
  dur: number,
  duration: number,
  extra: Partial<Beat> = {},
) {
  if (at + dur > duration) return;
  if (out.some((b) => b.actor === actorId && b.verb === verb)) return;
  out.push({ actor: actorId, verb, at, dur, layer: 'action', ...extra });
}

/** The model often stacks actions on top of each other. Base layers may run
 * under actions; actions may not. Shift a late beat after the previous one and
 * drop it only when the loop has no room left. */
function resolveActionOverlaps(beats: Beat[], duration: number): Beat[] {
  const bases = beats.filter((beat) => beat.layer === 'base');
  const byActor = new Map<string, Beat[]>();
  for (const beat of beats) {
    if (beat.layer === 'base') continue;
    const list = byActor.get(beat.actor) ?? [];
    list.push({ ...beat });
    byActor.set(beat.actor, list);
  }

  const resolved: Beat[] = [];
  for (const list of byActor.values()) {
    list.sort((a, b) => a.at - b.at || a.dur - b.dur);
    let cursor = 0;
    for (const beat of list) {
      if (beat.at < cursor) beat.at = cursor + 80;
      if (beat.at >= duration - 400) continue;
      beat.dur = Math.min(beat.dur, duration - beat.at);
      if (beat.dur < 500) continue;
      cursor = beat.at + beat.dur;
      resolved.push(beat);
    }
  }

  return [...bases, ...resolved];
}

/**
 * The model is creative but literal details can be missed. This pass makes the
 * performance honour the brief: if the judge says hide, the creature hides.
 * It only ADDS actions, never rewrites the model's choices.
 */
function applyBriefActions(
  brief: string,
  beats: Beat[],
  actors: Actor[],
  duration: number,
): Beat[] {
  const text = brief.toLowerCase();
  const main = actors.find((a) => !a.attach) ?? actors[0];
  if (!main) return beats;

  const mount = actors.find((a) => a.genome.bodyPlan === 'quadruped' && !a.attach);
  let out = [...beats];

  if (/\b(hide|hides|hiding|shy|bashful|peek|peeks)\b/.test(text)) {
    out = out.filter(
      (b) => !(b.actor === main.id && b.verb === 'nod' && b.at >= 5000 && b.at < 7000),
    );
    addBriefAction(out, main.id, 'hide', 5600, 1800, duration, { intensity: 0.8 });
    addBriefAction(out, main.id, 'peek', 7800, 1200, duration, { intensity: 0.7 });
  }
  if (/\b(tennis|racket|forehand|backhand|serve|serves)\b/.test(text)) {
    // One clean, readable swing instead of the model's 600 ms flicks. Keep the
    // base walk (a player steps into the shot) but clear competing arm actions.
    out = out.filter(
      (b) =>
        !(
          b.actor === main.id &&
          (b.verb === 'swing' ||
            (b.layer !== 'base' && b.at >= 1800 && b.at < 4400))
        ),
    );
    addBriefAction(out, main.id, 'swing', 2200, 2000, duration, { intensity: 0.95 });
  }
  if (/\b(rear|rears|buck|bucks|prance)\b/.test(text)) {
    addBriefAction(out, (mount ?? main).id, 'rear', 6000, 1600, duration, { intensity: 0.7 });
  }
  if (/\b(celebrate|win|victory|party|cheer|cheers)\b/.test(text)) {
    addBriefAction(out, main.id, 'celebrate', mount ? 6400 : 6200, 1600, duration, {
      intensity: 0.8,
    });
  }
  if (/\b(dance|dances|dancing|groove|boogie)\b/.test(text)) {
    addBriefAction(out, main.id, 'dance', 3000, 2600, duration, { intensity: 0.9 });
  }
  if (/\b(clap|claps|clapping|applaud|applauds)\b/.test(text)) {
    addBriefAction(out, main.id, 'clap', 5800, 1800, duration, { intensity: 0.85 });
  }
  if (/\b(laugh|laughs|laughing|giggle|giggles|chuckle)\b/.test(text)) {
    addBriefAction(out, main.id, 'laugh', 4300, 1900, duration, { intensity: 0.9 });
  }
  if (/\b(point|points|pointing|gesture|gestures)\b/.test(text)) {
    addBriefAction(out, main.id, 'point', 2800, 1700, duration, { target: 'prop' });
  }
  if (/\b(think|thinks|thinking|ponder|ponders|wonder|wonders)\b/.test(text)) {
    addBriefAction(out, main.id, 'think', 2600, 1900, duration, { intensity: 0.85 });
  }
  if (/\b(shrug|shrugs|shrugging)\b/.test(text)) {
    addBriefAction(out, main.id, 'shrug', 3000, 1600, duration, { intensity: 0.85 });
  }
  if (/\b(bow|bows|bowing)\b/.test(text)) {
    addBriefAction(out, main.id, 'bow', 3200, 1900, duration, { intensity: 0.9 });
  }
  if (/\b(run|runs|running|sprint|sprints)\b/.test(text)) {
    addBriefAction(out, main.id, 'run', 2800, 2400, duration, { intensity: 0.9 });
  }
  if (/\b(stretch|stretches|stretching|wake up|wakes up)\b/.test(text)) {
    addBriefAction(out, main.id, 'stretch', 2400, 2100, duration, { intensity: 0.85 });
  }
  if (/\b(yawn|yawns|yawning|sleepy|tired)\b/.test(text)) {
    addBriefAction(out, main.id, 'yawn', 4700, 1900, duration, { intensity: 0.85 });
  }
  if (/\b(wink|winks|winking)\b/.test(text)) {
    addBriefAction(out, main.id, 'wink', 3000, 1300, duration, { intensity: 0.9 });
  }
  if (/\b(stir|stirs|stirring|flip|flips|pancake|pancakes|cook|cooks)\b/.test(text)) {
    addBriefAction(out, main.id, 'stir', 3400, 2400, duration, { intensity: 0.85 });
  }
  if (/\b(nod|nods|nodding)\b/.test(text)) {
    addBriefAction(out, main.id, 'nod', 6000, 1100, duration);
  }
  if (/\b(wave|waves|greet|hello|hi|welcome)\b/.test(text)) {
    if (
      !out.some(
        (b) => b.actor === main.id && (b.verb === 'wave' || b.verb === 'greet'),
      )
    ) {
      addBriefAction(out, main.id, 'greet', 2400, 2200, duration, { intensity: 0.8 });
    }
  }
  if (/\b(jump|hop|leap|bounce)\b/.test(text)) {
    addBriefAction(out, main.id, 'jump', 5800, 900, duration);
  }
  if (/\b(look|watch|peek)\b/.test(text)) {
    addBriefAction(out, main.id, 'look', 500, 1200, duration, { target: 'viewer' });
  }

  return out;
}

const OBJECT_DEFAULTS: Record<
  SceneObjectKind,
  { color: string; x: number; y: number; layer: 'back' | 'front' }
> = {
  ball: { color: '#F4F0E6', x: 520, y: 548, layer: 'front' },
  star: { color: '#FFD45E', x: 520, y: 220, layer: 'front' },
  plant: { color: '#6FAF6B', x: 150, y: 518, layer: 'back' },
  flower: { color: '#F28BA8', x: 560, y: 500, layer: 'back' },
  cup: { color: '#F2B35E', x: 520, y: 470, layer: 'front' },
  gift: { color: '#E8564E', x: 540, y: 532, layer: 'front' },
  heart: { color: '#F05A74', x: 520, y: 260, layer: 'front' },
  'watering-can': { color: '#5BA7C9', x: 560, y: 486, layer: 'front' },
  pancake: { color: '#E8B45E', x: 360, y: 420, layer: 'front' },
  racket: { color: '#E8B84B', x: 520, y: 480, layer: 'front' },
  sparkle: { color: '#FFE38A', x: 500, y: 250, layer: 'front' },
  cloud: { color: '#FFFFFF', x: 560, y: 170, layer: 'back' },
  orb: { color: '#8FD8FF', x: 520, y: 300, layer: 'front' },
  'flower-pot': { color: '#C97B54', x: 540, y: 540, layer: 'back' },
  rocket: { color: '#E8EEF7', x: 520, y: 300, layer: 'front' },
  note: { color: '#4B63FF', x: 520, y: 250, layer: 'front' },
};

const BRIEF_PROPS: Array<{ match: RegExp; kind: SceneObjectKind }> = [
  { match: /\b(astronaut|space|cosmic|star|meteor|comet)\b/i, kind: 'star' },
  { match: /\b(football|soccer|tennis|basketball|ball|kick)\b/i, kind: 'ball' },
  { match: /\b(garden|gardener|plant|bloom|flower|sprout)\b/i, kind: 'plant' },
  { match: /\b(water|watering|can)\b/i, kind: 'watering-can' },
  { match: /\b(cup|drink|coffee|tea)\b/i, kind: 'cup' },
  { match: /\b(gift|present|box)\b/i, kind: 'gift' },
  { match: /\b(heart|love)\b/i, kind: 'heart' },
  { match: /\b(pancake|chef|cook)\b/i, kind: 'pancake' },
  { match: /\b(rocket|launch)\b/i, kind: 'rocket' },
];

function normaliseObjects(
  raw: unknown,
  actors: Actor[],
  brief: string,
): SceneObject[] {
  const list = Array.isArray(raw) ? raw.slice(0, 8) : [];
  const seen = new Set<string>();
  const out: SceneObject[] = [];

  for (let index = 0; index < list.length; index++) {
    const item = (list[index] ?? {}) as Record<string, unknown>;
    const kind = oneOf(item.kind, OBJECT_KINDS, 'ball') as SceneObjectKind;
    let id = slug(str(item.id, kind), kind);
    while (seen.has(id)) id = `${id}-${index}`;
    seen.add(id);
    const defaults = OBJECT_DEFAULTS[kind];
    out.push({
      id,
      kind,
      label: str(item.label).slice(0, 40) || undefined,
      color: hex(item.color, defaults.color),
      x: Math.round(num(item.x, 24, 696, defaults.x)),
      y: Math.round(num(item.y, 24, 696, defaults.y)),
      scale: num(item.scale, 0.35, 2.2, 1),
      rotation: num(item.rotation, -180, 180, 0),
      layer: item.layer === 'back' || item.layer === 'front' ? item.layer : defaults.layer,
      opacity: num(item.opacity, 0, 1, 1),
    });
  }

  if (out.length === 0 && actors.length > 0) {
    const match = BRIEF_PROPS.find((rule) => rule.match.test(brief));
    if (match) {
      const defaults = OBJECT_DEFAULTS[match.kind];
      out.push({
        id: match.kind,
        kind: match.kind,
        color: defaults.color,
        x: defaults.x,
        y: defaults.y,
        scale: 1,
        rotation: 0,
        layer: defaults.layer,
        opacity: 1,
      });
    }
  }

  return out;
}

/** Force a scene into studio mode: the procedural score becomes an idle base
 * layer and the generated MotionPlan owns the performance. */
export function studioScene(scene: Scene, duration = 8000): Scene {
  const ms = Math.round(Math.max(2000, Math.min(12000, duration)));
  return {
    ...scene,
    styleId: scene.styleId ?? 'anitoon-storybook-v1',
    score: {
      duration: ms,
      mood: scene.score.mood || 'playful',
      beats: scene.actors.map((actor) => ({
        actor: actor.id,
        verb: actor.genome.bodyPlan === 'quadruped' ? 'walk' : 'idle',
        at: 0,
        dur: ms,
        layer: 'base' as const,
        intensity: 1,
      })),
    },
  };
}

export function sceneFromUnknown(raw: unknown, brief = ''): Scene {
  const root = (raw ?? {}) as Record<string, unknown>;
  const source = (root.scene ?? root) as Record<string, unknown>;

  const duration = Math.round(num(source.duration ?? (source.score as Record<string, unknown> | undefined)?.duration, 6000, 12000, 9600));
  const rawActors = Array.isArray(source.actors) ? source.actors.slice(0, 3) : [];
  const genomes = rawActors.map((a, i) => normaliseActor(a, i, brief));

  if (genomes.length === 0) {
    genomes.push(normaliseActor({ id: 'friend', bodyPlan: 'blob', species: 'blob' }, 0, brief));
  }

  // A mushroom, rock or box is environment, not a second character. Only keep
  // extra actors when the brief actually asks for a cast or a mount.
  const explicitMulti =
    /\b(rider|cowboy|cowgirl|jockey|knight|mount|horse|dragon|steed|riding|mounted|two|pair|duo|friends?|group|together|squad|team)\b/i.test(
      brief,
    );
  if (!explicitMulti && genomes.length > 1) genomes.splice(1);

  // Normalise ids and attachments. An attached actor must come after its mount.
  const seen = new Set<string>();
  const withIds = genomes.map((g, i) => {
    let id = g.id || `actor-${i}`;
    while (seen.has(id)) id = `${id}-${i}`;
    seen.add(id);
    return { ...g, id };
  });

  // Models sometimes shorten "horse-01" to "horse" (or invent a name). Resolve
  // the parent by suffix, then by the only mountable actor, so a rider is never
  // silently left standing on the ground.
  const ids = withIds.map((g) => g.id);
  const resolveParent = (raw: string, selfId: string): string | null => {
    if (!raw || raw === selfId) return null;
    if (ids.includes(raw)) return raw;
    const suffix = withIds.find(
      (g) => g.id.startsWith(`${raw}-`) || raw.startsWith(`${g.id}-`),
    );
    if (suffix) return suffix.id;
    const mount = withIds.find(
      (g) => g.id !== selfId && (g.bodyPlan === 'quadruped' || g.bodyPlan === 'custom'),
    );
    return mount?.id ?? null;
  };

  type Draft = { genome: Genome; attach?: Actor['attach'] };
  const drafts: Draft[] = withIds.map((genome, i) => {
    const rawActor = (rawActors[i] ?? {}) as Record<string, unknown>;
    const a = (rawActor.attach ?? {}) as Record<string, unknown>;
    const parent = resolveParent(str(a.actor), genome.id);
    if (!parent) return { genome };
    return {
      genome,
      attach: {
        actor: parent,
        bone: str(a.bone, 'back'),
        x: num(a.x, -20, 20, 0),
        y: num(a.y, -20, 20, 0),
        rot: num(a.rot, -15, 15, 0),
        scale: num(a.scale, 0.4, 0.9, 0.62),
      },
    };
  });

  const ordered = [...drafts].sort((a, b) => Number(Boolean(a.attach)) - Number(Boolean(b.attach)));
  const skeletons = new Map<string, Actor['skeleton']>();
  const actors: Actor[] = [];

  for (const draft of ordered) {
    const skeleton = buildSkeleton(draft.genome);
    let attach = draft.attach;
    const candidate = attach;
    if (candidate) {
      const parentSkeleton = skeletons.get(candidate.actor);
      if (!parentSkeleton || !parentSkeleton.bones.some((b) => b.id === candidate.bone)) {
        attach = undefined;
      } else if (draft.genome.bodyPlan === 'biped') {
        candidate.scale = Math.max(0.42, Math.min(0.68, candidate.scale));
      }
    }
    const actor: Actor = {
      id: draft.genome.id,
      genome: draft.genome,
      skeleton,
      attach,
      pose: attach && draft.genome.bodyPlan === 'biped' ? 'ride' : 'stand',
      depth: actors.length,
    };
    skeletons.set(actor.id, skeleton);
    actors.push(actor);
  }

  // Tennis is a prop + action, not a second actor. If the model forgot the
  // racket, attach one to the main character's hand.
  const wantsTennis = /\b(tennis|racket|forehand|backhand|serve|serves)\b/i.test(
    brief,
  );
  const wantsFootball = /\b(football|soccer|striker|goalkeeper|pitch)\b/i.test(brief);
  if (wantsTennis) {
    const main = actors.find((a) => !a.attach) ?? actors[0];
    if (main && !main.genome.accessories.some((a) => a.kind === 'tennis-racket')) {
      main.genome.accessories.push({
        kind: 'tennis-racket',
        color: '#E8B84B',
        attach: 'handR',
      });
    }
  }

  // If two actors are unattached and both ground-based, give them space.
  const grounded = actors.filter((a) => !a.attach);
  if (grounded.length > 1) {
    grounded.forEach((a, i) => {
      a.place = { x: (i - (grounded.length - 1) / 2) * 95, y: 0 };
    });
  }

  const actorIds = new Set(actors.map((a) => a.id));
  const scoreBeats = normaliseBeats(
    source.beats ?? (source.score as Record<string, unknown> | undefined)?.beats,
    actorIds,
    duration,
  );
  const withBrief = resolveActionOverlaps(
    applyBriefActions(
      brief,
      ensureScore(scoreBeats, actors, duration),
      actors,
      duration,
    ),
    duration,
  );

  const rawWorld = (source.world as Record<string, unknown> | undefined)?.preset;
  const briefWorld = worldFromBrief(brief);
  const preset: WorldPreset = wantsTennis
    ? 'court'
    : wantsFootball && (rawWorld === undefined || rawWorld === 'court')
      ? 'meadow'
      : rawWorld === undefined
        ? (briefWorld ?? 'studio')
        : (oneOf(rawWorld, WORLD_PRESETS, briefWorld ?? 'studio') as WorldPreset);

  const objects = normaliseObjects(source.objects ?? source.props, actors, brief);
  const scene: Scene = {
    title: str(source.title, 'Untitled creature').slice(0, 60) || 'Untitled creature',
    styleId: str(source.styleId, 'anitoon-storybook-v1'),
    world: {
      preset,
      accent: hex((source.world as Record<string, unknown> | undefined)?.accent, actors[0]?.genome.palette.accent ?? '#4B63FF'),
    },
    actors,
    ...(objects.length > 0 ? { objects } : {}),
    score: {
      duration,
      mood: str((source.score as Record<string, unknown> | undefined)?.mood, 'curious') || 'curious',
      beats: withBrief,
    },
  };

  return scene;
}
