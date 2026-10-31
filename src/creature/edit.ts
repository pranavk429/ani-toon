// Edit safety. A model can return a whole new scene when asked to "make it
// night and slower"; that is the wrong answer. The compiler already has a
// scene. For world/timing edits we keep the cast and patch the data, and for
// structural edits we never silently drop an attached rider.

import { localEdit } from './local';
import type { Attachment, Scene } from './types';

// A brief that names anatomy, cast, clothing or colour is allowed to change
// the actors. A brief about time/light/mood is not.
const STRUCTURAL =
  /\b(add|remove|delete|replace|swap|turn|transform|another|new|rider|mount|cowboy|cowgirl|horse|dragon|animal|creature|character|actor|body|species|wings?|horns?|hat|scarf|glasses|beanie|cap|saddle|reins|colou?r|palette|outfit|clothes)\b/i;

const EXPLICIT_REMOVE =
  /\b(remove|without|no rider|dismount|stand beside|take off|delete)\b/i;

type PreviousShape = {
  actors?: Array<{
    id?: string;
    genome?: { bodyPlan?: string; id?: string };
    attach?: Attachment;
  }>;
};

export function guardEdit(previous: unknown, next: Scene, prompt: string): Scene {
  if (!previous || typeof previous !== 'object') return next;

  const patched = localEdit(previous, prompt);
  if (patched && !STRUCTURAL.test(prompt)) {
    return {
      ...patched,
      // The hosted director still owns the look/title of the edit.
      title: next.title || patched.title,
      world: next.world ?? patched.world,
      score: {
        ...patched.score,
        mood: next.score.mood || patched.score.mood,
      },
    };
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

  return next;
}
