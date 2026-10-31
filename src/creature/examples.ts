// Three acceptance tests for the grammar:
//   1. a shy octopus        -> one actor, 8 tentacle chains
//   2. a cowboy on a horse  -> two actors, rider attached to the horse's back
//   3. a blob mascot        -> one actor, squash-and-stretch body
//
// If these three render in the same style, the "it only does humanoids" problem
// is dead. The fourth test is whatever the judge invents; that is `custom`.

import { buildSkeleton } from './skeleton';
import type { Genome, HumanLook, Scene, Score } from './types';

const octopusGenome = (): Genome => ({
  id: 'muddle',
  name: 'Muddle',
  species: 'octopus',
  bodyPlan: 'octopod',
  palette: {
    skin: '#7C4DD8',
    belly: '#C9A9F2',
    accent: '#F7C948',
    detail: '#532B9F',
    eye: '#2B1B3F',
    mouth: '#5B2A4E',
  },
  proportions: {
    head: 1.05,
    torso: 1,
    limbLength: 1,
    limbWidth: 1.05,
    limbCount: 8,
    taper: 0.7,
    neck: 1,
  },
  face: {
    eyes: 2,
    eyeSize: 1.15,
    eyeSpacing: 1.1,
    pupil: 'round',
    mouth: 'smile',
    brows: true,
  },
  surface: { kind: 'goo', pattern: 'spots' },
  accessories: [],
});

const horseGenome = (): Genome => ({
  id: 'biscuit',
  name: 'Biscuit',
  species: 'horse',
  bodyPlan: 'quadruped',
  palette: {
    skin: '#B97A45',
    belly: '#E8C39E',
    accent: '#C4573F',
    detail: '#63402A',
    eye: '#2B2233',
    mouth: '#5B3A2B',
    hair: '#EAD3A0',
  },
  proportions: {
    head: 1,
    torso: 1,
    limbLength: 1,
    limbWidth: 1.1,
    limbCount: 4,
    taper: 0.3,
    neck: 1.05,
  },
  face: {
    eyes: 1,
    eyeSize: 0.95,
    eyeSpacing: 1.15,
    pupil: 'round',
    mouth: 'smile',
    brows: false,
  },
  surface: { kind: 'fur', pattern: 'none' },
  accessories: [{ kind: 'saddle', color: '#3F2A1D', attach: 'back' }],
});

const cowboyGenome = (): Genome => ({
  id: 'cass',
  name: 'Cass',
  species: 'cowboy',
  bodyPlan: 'biped',
  palette: {
    skin: '#F3C9A3',
    belly: '#FFF1DC',
    accent: '#4A8FD4',
    detail: '#6B4A33',
    eye: '#2B2233',
    mouth: '#9A4B3F',
    cloth: '#4A8FD4',
    trim: '#FFF1DC',
    hair: '#A9683A',
    pants: '#3F5F86',
  },
  proportions: {
    head: 1.05,
    torso: 1,
    limbLength: 1,
    limbWidth: 1,
    limbCount: 2,
    taper: 0.2,
    neck: 1,
  },
  face: {
    eyes: 2,
    eyeSize: 1.1,
    eyeSpacing: 1,
    pupil: 'round',
    mouth: 'smile',
    brows: true,
  },
  surface: { kind: 'skin', pattern: 'none' },
  accessories: [
    { kind: 'cowboy-hat', color: '#D9A45E', attach: 'head' },
    { kind: 'scarf', color: '#E05243', attach: 'spine' },
  ],
});

const blobGenome = (): Genome => ({
  id: 'jelly',
  name: 'Jelly',
  species: 'blob',
  bodyPlan: 'blob',
  palette: {
    skin: '#6E9E6A',
    belly: '#A9C99A',
    accent: '#F2B84B',
    detail: '#476E4B',
    eye: '#2C3A2E',
    mouth: '#5B3A2B',
    hair: '#4E8A5C',
  },
  proportions: {
    head: 1,
    torso: 1,
    limbLength: 1,
    limbWidth: 1,
    limbCount: 2,
    taper: 0.2,
    neck: 1,
  },
  face: {
    eyes: 2,
    eyeSize: 1.1,
    eyeSpacing: 1,
    pupil: 'round',
    mouth: 'smile',
    brows: true,
  },
  surface: { kind: 'goo', pattern: 'none' },
  accessories: [{ kind: 'leaf-ears', color: '#4E8A5C', attach: 'body' }],
});

const octopusScore = (): Score => ({
  duration: 9600,
  mood: 'shy',
  beats: [
    { actor: 'muddle', verb: 'idle', at: 0, dur: 9600, layer: 'base' },
    { actor: 'muddle', verb: 'look', at: 600, dur: 1200, target: 'viewer' },
    { actor: 'muddle', verb: 'greet', at: 2400, dur: 2200, intensity: 0.7 },
    { actor: 'muddle', verb: 'hide', at: 6000, dur: 1800, intensity: 0.8 },
    { actor: 'muddle', verb: 'peek', at: 8000, dur: 1200, intensity: 0.6 },
  ],
});

const cowboyScore = (): Score => ({
  duration: 9600,
  mood: 'confident',
  beats: [
    { actor: 'biscuit', verb: 'walk', at: 0, dur: 9600, layer: 'base' },
    { actor: 'cass', verb: 'look', at: 600, dur: 1200, target: 'viewer' },
    { actor: 'cass', verb: 'greet', at: 2400, dur: 2200, intensity: 0.8 },
    { actor: 'biscuit', verb: 'rear', at: 6000, dur: 1600, intensity: 0.7 },
    { actor: 'cass', verb: 'celebrate', at: 6400, dur: 1600, intensity: 0.8 },
  ],
});

const blobScore = (): Score => ({
  duration: 9600,
  mood: 'playful',
  beats: [
    { actor: 'jelly', verb: 'idle', at: 0, dur: 9600, layer: 'base' },
    { actor: 'jelly', verb: 'look', at: 600, dur: 1200, target: 'viewer' },
    { actor: 'jelly', verb: 'greet', at: 2400, dur: 2200, intensity: 0.8 },
    { actor: 'jelly', verb: 'celebrate', at: 5600, dur: 1600, intensity: 0.9 },
  ],
});

export function buildShyOctopus(): Scene {
  const genome = octopusGenome();
  return {
    title: 'Muddle — deep-sea podcast',
    world: { preset: 'night', accent: '#6D5BD0' },
    actors: [
      {
        id: 'muddle',
        genome,
        skeleton: buildSkeleton(genome),
        pose: 'stand',
        depth: 0,
      },
    ],
    score: octopusScore(),
  };
}

export function buildCowboyOnHorse(): Scene {
  const horse = horseGenome();
  const rider = cowboyGenome();
  const horseSkeleton = buildSkeleton(horse);
  const riderSkeleton = buildSkeleton(rider);

  return {
    title: 'Cass & Biscuit — trail ride',
    world: { preset: 'sky', accent: '#B91C1C' },
    actors: [
      {
        id: 'biscuit',
        genome: horse,
        skeleton: horseSkeleton,
        pose: 'stand',
        depth: 0,
      },
      {
        id: 'cass',
        genome: rider,
        skeleton: riderSkeleton,
        pose: 'ride',
        depth: 1,
        attach: {
          actor: 'biscuit',
          bone: horseSkeleton.back ?? 'back',
          x: 0,
          y: 0,
          rot: 0,
          scale: 0.62,
        },
      },
    ],
    score: cowboyScore(),
  };
}

export function buildBlobMascot(): Scene {
  const genome = blobGenome();
  return {
    title: 'Jelly — playful mascot',
    world: { preset: 'studio', accent: '#F2B84B' },
    actors: [
      {
        id: 'jelly',
        genome,
        skeleton: buildSkeleton(genome),
        pose: 'stand',
        depth: 0,
      },
    ],
    score: blobScore(),
  };
}

export function describeScene(scene: Scene): string {
  const actors = scene.actors
    .map(
      (actor) =>
        `${actor.id}:${actor.genome.bodyPlan} ${actor.skeleton.bones.length} bones${
          actor.attach ? ` -> ${actor.attach.actor}.${actor.attach.bone}` : ''
        }`,
    )
    .join(' | ');
  return `${scene.title} :: ${actors} :: ${scene.score.beats.length} beats`;
}

// ---------------------------------------------------------------------------
// The demo cast. These are fixtures, not the product: each one is a human look
// (presentation, hair, face, body, outfit) plus a different score and world.
// The same 16-bone rig carries all seven.

const HUMAN_DURATION = 9600;

function humanGenome(opts: {
  id: string;
  name: string;
  species: string;
  palette: Genome['palette'];
  human: HumanLook;
  proportions?: Partial<Genome['proportions']>;
  face?: Partial<Genome['face']>;
  accessories?: Genome['accessories'];
}): Genome {
  return {
    id: opts.id,
    name: opts.name,
    species: opts.species,
    bodyPlan: 'biped',
    palette: opts.palette,
    proportions: {
      head: 1.08,
      torso: 1.04,
      limbLength: 0.92,
      limbWidth: 1.24,
      limbCount: 2,
      taper: 0.2,
      neck: 1,
      ...opts.proportions,
    },
    face: {
      eyes: 2,
      eyeSize: 1.12,
      eyeSpacing: 1.05,
      pupil: 'round',
      mouth: 'smile',
      brows: true,
      ...opts.face,
    },
    surface: { kind: 'skin', pattern: 'none' },
    accessories: opts.accessories ?? [],
    human: opts.human,
  };
}

function humanScene(opts: {
  title: string;
  world: Scene['world'];
  genome: Genome;
  mood: string;
  beats: Score['beats'];
}): Scene {
  const skeleton = buildSkeleton(opts.genome);
  return {
    title: opts.title,
    world: opts.world,
    actors: [
      {
        id: opts.genome.id,
        genome: opts.genome,
        skeleton,
        pose: 'stand',
        depth: 0,
      },
    ],
    score: { duration: HUMAN_DURATION, mood: opts.mood, beats: opts.beats },
  };
}

function base(actor: string): Score['beats'][number] {
  return { actor, verb: 'idle', at: 0, dur: HUMAN_DURATION, layer: 'base' };
}

export function buildChefScene(): Scene {
  const genome = humanGenome({
    id: 'marco',
    name: 'Marco',
    species: 'chef',
    palette: {
      skin: '#F2C29B',
      belly: '#FFF1DC',
      accent: '#C94A3F',
      detail: '#5A3B26',
      eye: '#2B2233',
      mouth: '#9A4B3F',
      cloth: '#F3E4C6',
      trim: '#FFF6E3',
      hair: '#4A2F1F',
      pants: '#2F3A5C',
    },
    human: {
      presentation: 'masculine',
      hair: { style: 'short', fringe: 'side', volume: 1 },
      facialHair: 'mustache',
      body: { shoulders: 1.04, hips: 1.08, waist: 1.06, height: 0.98 },
      outfit: { top: 'apron', bottom: 'jeans', shoes: 'boots' },
      face: { jaw: 'soft', lashes: false, brow: 'strong', nose: 'broad' },
    },
    proportions: { head: 1.1, torso: 1.08, limbLength: 0.86, limbWidth: 1.38 },
    accessories: [
      { kind: 'chef-hat', color: '#FFF8EA', attach: 'head' },
      { kind: 'scarf', color: '#C94A3F', attach: 'spine' },
    ],
  });
  return humanScene({
    title: 'Marco — breakfast kitchen',
    world: { preset: 'kitchen', accent: '#C94A3F' },
    genome,
    mood: 'warm',
    beats: [
      base('marco'),
      { actor: 'marco', verb: 'look', at: 500, dur: 1200, target: 'viewer' },
      { actor: 'marco', verb: 'wave', at: 2200, dur: 2100, intensity: 0.85 },
      { actor: 'marco', verb: 'stir', at: 4600, dur: 1900, intensity: 0.9 },
      { actor: 'marco', verb: 'laugh', at: 6900, dur: 1800, intensity: 0.9 },
    ],
  });
}

export function buildMaraScene(): Scene {
  const genome = humanGenome({
    id: 'mara',
    name: 'Mara',
    species: 'founder',
    palette: {
      skin: '#8D5524',
      belly: '#D9A066',
      accent: '#F2B84B',
      detail: '#3B2418',
      eye: '#241A1A',
      mouth: '#7A3E35',
      cloth: '#E08A3C',
      trim: '#F6E7CC',
      hair: '#2B1B14',
      pants: '#3E5C76',
    },
    human: {
      presentation: 'feminine',
      hair: { style: 'afro', fringe: 'none', volume: 1.25 },
      facialHair: 'none',
      body: { shoulders: 0.99, hips: 1.05, waist: 0.94, height: 1.03 },
      outfit: { top: 'coat', bottom: 'jeans', shoes: 'sneakers' },
      face: { jaw: 'soft', lashes: true, brow: 'soft', nose: 'medium' },
    },
    proportions: { head: 1.1, torso: 1.04 },
    accessories: [{ kind: 'scarf', color: '#F2B84B', attach: 'spine' }],
  });
  return humanScene({
    title: 'Mara — meadow skincare',
    world: { preset: 'meadow', accent: '#F2B84B' },
    genome,
    mood: 'bright',
    beats: [
      base('mara'),
      { actor: 'mara', verb: 'look', at: 500, dur: 1200, target: 'viewer' },
      { actor: 'mara', verb: 'wave', at: 2100, dur: 2000, intensity: 0.85 },
      { actor: 'mara', verb: 'laugh', at: 4300, dur: 1900, intensity: 0.9 },
      { actor: 'mara', verb: 'point', at: 6400, dur: 1700, target: 'left', intensity: 0.9 },
    ],
  });
}

export function buildTheoScene(): Scene {
  const genome = humanGenome({
    id: 'theo',
    name: 'Theo',
    species: 'baker',
    palette: {
      skin: '#E8B48C',
      belly: '#FBE2C8',
      accent: '#D9A45E',
      detail: '#4A3024',
      eye: '#2B2233',
      mouth: '#8A4B3F',
      cloth: '#5E8C6A',
      trim: '#DCE8D4',
      hair: '#6B4428',
      pants: '#3B4C63',
    },
    human: {
      presentation: 'masculine',
      hair: { style: 'short', fringe: 'side', volume: 1 },
      facialHair: 'beard',
      body: { shoulders: 1.01, hips: 0.96, waist: 0.99, height: 0.99 },
      outfit: { top: 'hoodie', bottom: 'jeans', shoes: 'sneakers' },
      face: { jaw: 'soft', lashes: false, brow: 'strong', nose: 'medium' },
    },
    proportions: { head: 1.07, torso: 1.03, limbWidth: 1.28 },
    accessories: [],
  });
  return humanScene({
    title: 'Theo — neighborhood bakery',
    world: { preset: 'forest', accent: '#5E8C6A' },
    genome,
    mood: 'shy',
    beats: [
      base('theo'),
      { actor: 'theo', verb: 'look', at: 500, dur: 1200, target: 'down' },
      { actor: 'theo', verb: 'think', at: 2200, dur: 2000, intensity: 0.9 },
      { actor: 'theo', verb: 'shrug', at: 4700, dur: 1600, intensity: 0.85 },
      { actor: 'theo', verb: 'nod', at: 7000, dur: 1100 },
    ],
  });
}

export function buildJunScene(): Scene {
  const genome = humanGenome({
    id: 'jun',
    name: 'Jun',
    species: 'musician',
    palette: {
      skin: '#F0C6A0',
      belly: '#FFF1DC',
      accent: '#22D3EE',
      detail: '#2A2233',
      eye: '#221D2A',
      mouth: '#8A4B54',
      cloth: '#6D5BD0',
      trim: '#F3E9DC',
      hair: '#1E1A1F',
      pants: '#2E3440',
    },
    human: {
      presentation: 'androgynous',
      hair: { style: 'bob', fringe: 'straight', volume: 1 },
      facialHair: 'none',
      body: { shoulders: 0.97, hips: 1.0, waist: 0.94, height: 1.04 },
      outfit: { top: 'shirt', bottom: 'chinos', shoes: 'flats' },
      face: { jaw: 'soft', lashes: true, brow: 'soft', nose: 'small' },
    },
    proportions: { head: 1.06, torso: 0.98, limbLength: 1.02, limbWidth: 1.04 },
    accessories: [],
  });
  return humanScene({
    title: 'Jun — sunset synth',
    world: { preset: 'sunset', accent: '#22D3EE' },
    genome,
    mood: 'cool',
    beats: [
      base('jun'),
      { actor: 'jun', verb: 'look', at: 500, dur: 1300, target: 'left' },
      { actor: 'jun', verb: 'look', at: 1900, dur: 1200, target: 'right' },
      { actor: 'jun', verb: 'point', at: 3400, dur: 1700, target: 'right', intensity: 0.9 },
      { actor: 'jun', verb: 'bow', at: 5900, dur: 1900, intensity: 0.9 },
    ],
  });
}

export function buildAmaraScene(): Scene {
  const genome = humanGenome({
    id: 'amara',
    name: 'Amara',
    species: 'traveler',
    palette: {
      skin: '#6B3E2E',
      belly: '#A96B4A',
      accent: '#F2B84B',
      detail: '#2E1B18',
      eye: '#1E1414',
      mouth: '#7A3E35',
      cloth: '#E06A4E',
      trim: '#F7D9A0',
      hair: '#241714',
    },
    human: {
      presentation: 'feminine',
      hair: { style: 'braids', fringe: 'straight', volume: 1.1 },
      facialHair: 'none',
      body: { shoulders: 0.98, hips: 1.08, waist: 0.95, height: 1.02 },
      outfit: { top: 'dress', bottom: 'none', shoes: 'flats' },
      face: { jaw: 'soft', lashes: true, brow: 'soft', nose: 'broad' },
    },
    proportions: { head: 1.08, torso: 1.02, limbLength: 0.98, limbWidth: 1.2 },
    accessories: [],
  });
  return humanScene({
    title: 'Amara — desert travel',
    world: { preset: 'desert', accent: '#F2B84B' },
    genome,
    mood: 'joyful',
    beats: [
      base('amara'),
      { actor: 'amara', verb: 'dance', at: 1400, dur: 3000, intensity: 0.9 },
      { actor: 'amara', verb: 'clap', at: 4900, dur: 1800, intensity: 0.9 },
      { actor: 'amara', verb: 'celebrate', at: 7200, dur: 1800, intensity: 0.85 },
    ],
  });
}

export function buildNoahScene(): Scene {
  const genome = humanGenome({
    id: 'noah',
    name: 'Noah',
    species: 'lodgekeeper',
    palette: {
      skin: '#E8B48C',
      belly: '#FBE2C8',
      accent: '#C94A3F',
      detail: '#4A3024',
      eye: '#2B2233',
      mouth: '#8A4B3F',
      cloth: '#3F6B5A',
      trim: '#D8C6A8',
      hair: '#B5532E',
      pants: '#3A4A5C',
    },
    human: {
      presentation: 'masculine',
      hair: { style: 'short', fringe: 'none', volume: 1 },
      facialHair: 'beard',
      body: { shoulders: 1.08, hips: 1.0, waist: 1.0, height: 1.04 },
      outfit: { top: 'coat', bottom: 'jeans', shoes: 'boots' },
      face: { jaw: 'square', lashes: false, brow: 'strong', nose: 'broad' },
    },
    proportions: { head: 1.06, torso: 1.04, limbWidth: 1.32 },
    accessories: [{ kind: 'beanie', color: '#C94A3F', attach: 'head' }],
  });
  return humanScene({
    title: 'Noah — winter lodge',
    world: { preset: 'winter', accent: '#C94A3F' },
    genome,
    mood: 'cozy',
    beats: [
      base('noah'),
      { actor: 'noah', verb: 'look', at: 500, dur: 1200, target: 'down' },
      { actor: 'noah', verb: 'stretch', at: 2000, dur: 2200, intensity: 0.9 },
      { actor: 'noah', verb: 'yawn', at: 4700, dur: 2000, intensity: 0.95 },
      { actor: 'noah', verb: 'wave', at: 7200, dur: 2000, intensity: 0.8 },
    ],
  });
}

export function buildSofiaScene(): Scene {
  const genome = humanGenome({
    id: 'sofia',
    name: 'Sofia',
    species: 'tennis player',
    palette: {
      skin: '#D99A6C',
      belly: '#F7D2B0',
      accent: '#D8E84A',
      detail: '#3B2418',
      eye: '#241A1A',
      mouth: '#8A4B3F',
      cloth: '#F4F0E6',
      trim: '#2F6BBA',
      hair: '#3B2418',
      pants: '#2F6BBA',
    },
    human: {
      presentation: 'feminine',
      hair: { style: 'ponytail', fringe: 'side', volume: 1.05 },
      facialHair: 'none',
      body: { shoulders: 1.05, hips: 0.98, waist: 0.92, height: 1.01 },
      outfit: { top: 'sport', bottom: 'shorts', shoes: 'sneakers' },
      face: { jaw: 'soft', lashes: true, brow: 'strong', nose: 'small' },
    },
    proportions: { head: 1.04, torso: 0.98, limbLength: 1.02, limbWidth: 1.08 },
    accessories: [{ kind: 'tennis-racket', color: '#E8B84B', attach: 'handR' }],
  });
  return humanScene({
    title: 'Sofia — baseline',
    world: { preset: 'court', accent: '#2F6BBA' },
    genome,
    mood: 'focused',
    beats: [
      base('sofia'),
      { actor: 'sofia', verb: 'look', at: 500, dur: 1200, target: 'right' },
      { actor: 'sofia', verb: 'swing', at: 2200, dur: 2000, intensity: 0.95 },
      { actor: 'sofia', verb: 'celebrate', at: 5400, dur: 1600, intensity: 0.9 },
      { actor: 'sofia', verb: 'wave', at: 7500, dur: 1800, intensity: 0.8 },
    ],
  });
}

export type CastMember = {
  id: string;
  label: string;
  name: string;
  prompt: string;
  scene: Scene;
  presentation: string;
  hair: string;
  outfit: string;
  world: string;
  actions: string;
};

export const HUMAN_CAST: CastMember[] = [
  {
    id: 'marco',
    label: 'Marco — chef',
    name: 'Marco',
    prompt:
      'A warm, proud chef with a thick brown mustache for a breakfast brand. He flips a pancake, laughs, and waves.',
    scene: buildChefScene(),
    presentation: 'masculine',
    hair: 'short',
    outfit: 'apron',
    world: 'kitchen',
    actions: 'wave · stir · laugh',
  },
  {
    id: 'mara',
    label: 'Mara — afro',
    name: 'Mara',
    prompt:
      'A confident woman with a curly afro for a skincare brand in a meadow. She waves, laughs, and points at the product.',
    scene: buildMaraScene(),
    presentation: 'feminine',
    hair: 'afro',
    outfit: 'coat',
    world: 'meadow',
    actions: 'wave · laugh · point',
  },
  {
    id: 'theo',
    label: 'Theo — baker',
    name: 'Theo',
    prompt:
      'A shy baker with short hair and a beard in a forest bakery. He thinks, shrugs, and nods.',
    scene: buildTheoScene(),
    presentation: 'masculine',
    hair: 'short + beard',
    outfit: 'hoodie',
    world: 'forest',
    actions: 'think · shrug · nod',
  },
  {
    id: 'jun',
    label: 'Jun — musician',
    name: 'Jun',
    prompt:
      'An androgynous musician with a black bob for a synth brand at sunset. They look around, point, and bow.',
    scene: buildJunScene(),
    presentation: 'androgynous',
    hair: 'bob',
    outfit: 'shirt',
    world: 'sunset',
    actions: 'look · point · bow',
  },
  {
    id: 'amara',
    label: 'Amara — traveler',
    name: 'Amara',
    prompt:
      'A joyful woman with long braids for a desert travel app. She dances, claps, and celebrates.',
    scene: buildAmaraScene(),
    presentation: 'feminine',
    hair: 'braids',
    outfit: 'dress',
    world: 'desert',
    actions: 'dance · clap · celebrate',
  },
  {
    id: 'noah',
    label: 'Noah — lodge',
    name: 'Noah',
    prompt:
      'A sleepy man with a red beard for a snowy winter lodge. He stretches, yawns, and waves.',
    scene: buildNoahScene(),
    presentation: 'masculine',
    hair: 'short + beard',
    outfit: 'coat',
    world: 'winter',
    actions: 'stretch · yawn · wave',
  },
  {
    id: 'sofia',
    label: 'Sofia — tennis',
    name: 'Sofia',
    prompt:
      'A focused tennis player with a high ponytail for a sportswear brand. She swings, celebrates, and waves.',
    scene: buildSofiaScene(),
    presentation: 'feminine',
    hair: 'ponytail',
    outfit: 'sport',
    world: 'court',
    actions: 'swing · celebrate · wave',
  },
];

export const ACCEPTANCE_SCENES = [buildShyOctopus, buildCowboyOnHorse, buildBlobMascot];
