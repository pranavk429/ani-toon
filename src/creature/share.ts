// Share links carry the scene as data, not a rendered frame. The skeleton is
// rebuilt from the genome on load, so the URL stays small enough for a demo.
//
// Format: /creature#s=<base64url(JSON)>. The payload is versioned so an old
// link can fail closed instead of crashing the studio.

import { buildSkeleton } from './skeleton';
import type { Actor, ActorPose, Attachment, Genome, Scene, Score } from './types';

type CompactActor = {
  id: string;
  g: Genome;
  at?: Attachment;
  p?: ActorPose;
  d?: number;
};

type CompactScene = {
  v: 1;
  t: string;
  w: Scene['world'];
  a: CompactActor[];
  s: Score;
};

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(token: string): Uint8Array {
  const padded = token.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export function encodeScene(scene: Scene): string {
  const payload: CompactScene = {
    v: 1,
    t: scene.title,
    w: scene.world,
    a: scene.actors.map((actor) => ({
      id: actor.id,
      g: actor.genome,
      at: actor.attach,
      p: actor.pose,
      d: actor.depth,
    })),
    s: scene.score,
  };
  return toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

export function decodeScene(token: string): Scene | null {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(token))) as CompactScene;
    if (parsed.v !== 1 || !Array.isArray(parsed.a) || !parsed.s || !parsed.w) return null;
    const actors: Actor[] = parsed.a
      .filter((a) => a && a.g && typeof a.g.bodyPlan === 'string')
      .map((a, i) => ({
        id: a.id,
        genome: a.g,
        skeleton: buildSkeleton(a.g),
        attach: a.at,
        pose: a.p ?? 'stand',
        depth: a.d ?? i,
      }));
    if (actors.length === 0) return null;
    return {
      title: parsed.t || 'Shared creature',
      world: parsed.w,
      actors,
      score: parsed.s,
    };
  } catch {
    return null;
  }
}

/** A readable, skeleton-free payload for Copy spec / Download JSON. */
export function sceneSpec(scene: Scene) {
  return {
    title: scene.title,
    world: scene.world,
    actors: scene.actors.map((actor) => ({
      id: actor.id,
      genome: actor.genome,
      attach: actor.attach ?? null,
      pose: actor.pose ?? 'stand',
      depth: actor.depth,
    })),
    score: scene.score,
  };
}

export function shareUrl(scene: Scene): string {
  const base =
    typeof window === 'undefined'
      ? 'https://anitoon.example/creature'
      : `${window.location.origin}${window.location.pathname}`;
  return `${base}#s=${encodeScene(scene)}`;
}
