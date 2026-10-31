// Edit safety. A model can return a whole new scene when asked to "make it
// night and slower"; that is the wrong answer. The compiler already has a
// scene. For world/timing edits we keep the cast and patch the data, and for
// structural edits we never silently drop an attached rider.

import { localEdit } from './local';
import type { Attachment, Palette, Scene, SceneObject } from './types';

// A brief that names anatomy, cast, clothing or colour is allowed to change
// the actors. A brief about time/light/mood is not.
const STRUCTURAL =
  /\b(add|remove|delete|replace|swap|turn|transform|another|new|rider|mount|cowboy|cowgirl|horse|dragon|animal|creature|character|actor|body|species|wings?|horns?|hat|scarf|glasses|beanie|cap|saddle|reins|colou?r|palette|outfit|clothes)\b/i;

const EXPLICIT_REMOVE =
  /\b(remove|without|no rider|dismount|stand beside|take off|delete)\b/i;


const COLOR_WORDS: Array<{ names: RegExp; hex: string }> = [
  { names: /\b(red|crimson|scarlet)\b/i, hex: '#E8564E' },
  { names: /\b(blue|navy|azure|cobalt)\b/i, hex: '#2F6BBA' },
  { names: /\b(green|emerald|forest|mint)\b/i, hex: '#5FAF6B' },
  { names: /\b(yellow|gold|golden|mustard)\b/i, hex: '#F2C14E' },
  { names: /\b(pink|rose|magenta)\b/i, hex: '#F28BA8' },
  { names: /\b(purple|violet|lavender|lilac)\b/i, hex: '#8C6AD6' },
  { names: /\b(orange|tangerine|peach)\b/i, hex: '#F08A4B' },
  { names: /\b(teal|turquoise|cyan)\b/i, hex: '#3FA7A0' },
  { names: /\b(black|charcoal)\b/i, hex: '#2B2420' },
  { names: /\b(white|cream|ivory)\b/i, hex: '#F7F4EC' },
  { names: /\b(brown|tan|caramel)\b/i, hex: '#8A5A3B' },
  { names: /\b(grey|gray|silver)\b/i, hex: '#8A8A8A' },
];

const GARMENT = /\b(shirt|jersey|suit|top|tee|hoodie|blouse|dress|coat|apron|jacket|uniform)\b/i;
const PANTS = /\b(pants|shorts|trousers|jeans|skirt|leggings)\b/i;
const HAIR = /\bhair\b/i;
const SKIN = /\bskin\b/i;

function findColor(prompt: string): string | undefined {
  return COLOR_WORDS.find((entry) => entry.names.test(prompt))?.hex;
}

/** Deterministic colour/garment pass for edits the model often under-applies. */
function applyColorIntent(scene: Scene, prompt: string): Scene {
  const hex = findColor(prompt);
  if (!hex) return scene;
  const wantsGarment = GARMENT.test(prompt) || (!PANTS.test(prompt) && !HAIR.test(prompt) && !SKIN.test(prompt));
  const target =
    scene.actors.find((actor) => !actor.attach) ?? scene.actors[0];
  if (!target) return scene;

  const palette: Palette = { ...target.genome.palette };
  if (PANTS.test(prompt)) palette.pants = hex;
  else if (HAIR.test(prompt)) palette.hair = hex;
  else if (SKIN.test(prompt)) palette.skin = hex;
  else if (wantsGarment) {
    palette.cloth = hex;
    // Keep the trim/cuffs readable against a dark garment.
    const dark = ['#2B2420', '#2F6BBA', '#8C6AD6', '#E8564E'].includes(hex);
    palette.trim = dark ? '#F7F4EC' : '#FFF1DC';
  }

  return {
    ...scene,
    actors: scene.actors.map((actor) =>
      actor.id === target.id
        ? { ...actor, genome: { ...actor.genome, palette } }
        : actor,
    ),
  };
}

function preserveObjects(next: Scene, previous: Scene, prompt: string): SceneObject[] | undefined {
  if (/\b(remove|delete|without|no props?|drop the)\b/i.test(prompt)) return next.objects;
  if (next.objects && next.objects.length > 0) return next.objects;
  return previous.objects;
}

type PreviousShape = {
  actors?: Array<{
    id?: string;
    genome?: { bodyPlan?: string; id?: string };
    attach?: Attachment;
  }>;
};

export function guardEdit(previous: unknown, next: Scene, prompt: string): Scene {
  if (!previous || typeof previous !== 'object') return next;

  const previousScene = previous as Scene;
  const patched = localEdit(previous, prompt);
  if (patched && !STRUCTURAL.test(prompt)) {
    const merged: Scene = {
      ...patched,
      // The hosted director still owns the look/title of the edit.
      title: next.title || patched.title,
      world: next.world ?? patched.world,
      score: {
        ...patched.score,
        mood: next.score.mood || patched.score.mood,
      },
      objects: preserveObjects(patched, previousScene, prompt),
    };
    return applyColorIntent(merged, prompt);
  }

  // Structural edit: allow the model's new cast, but put the rider back if the
  // brief did not ask to remove them.
  if (!EXPLICIT_REMOVE.test(prompt) && !next.actors.some((a) => a.attach)) {
    const prev = previous as PreviousShape;
    const prevAttached = prev.actors?.find((a) => a.attach);
    if (prevAttached) {
      const rider =
        next.actors.find((a) => a.id === prevAttached.id) ??
        next.actors.find((a) => a.genome.bodyPlan === 'biped');
      const mount = next.actors.find((a) => a.genome.bodyPlan === 'quadruped');
      if (rider && mount) {
        rider.attach = {
          actor: mount.id,
          bone: 'back',
          x: prevAttached.attach?.x ?? 0,
          y: prevAttached.attach?.y ?? 0,
          rot: prevAttached.attach?.rot ?? 0,
          scale: Math.max(0.42, Math.min(0.66, prevAttached.attach?.scale ?? 0.62)),
        };
        rider.pose = 'ride';
      }
    }
  }

  const merged: Scene = {
    ...next,
    objects: preserveObjects(next, previousScene, prompt),
  };
  return applyColorIntent(merged, prompt);
}
