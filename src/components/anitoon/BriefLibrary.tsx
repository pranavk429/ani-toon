'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight, Sparkles } from 'lucide-react';

import { HUMAN_CAST } from '@/creature/examples';
import { SceneFrame } from '@/creature/render';
import type { Scene } from '@/creature/types';

const CARD_ORDER: Array<{ id: string; label: string; prompt: string }> = [
  {
    id: 'marco',
    label: 'Chef · kitchen',
    prompt:
      'A warm, proud chef with a thick brown mustache for a breakfast brand. He flips a pancake, laughs, and waves.',
  },
  {
    id: 'mara',
    label: 'Afro · meadow',
    prompt:
      'A confident woman with a curly afro for a skincare brand in a meadow. She waves, laughs, and points at the product.',
  },
  {
    id: 'theo',
    label: 'Baker · forest',
    prompt:
      'A shy baker with short hair and a beard in a forest bakery. He thinks, shrugs, and nods.',
  },
  {
    id: 'jun',
    label: 'Bob · sunset',
    prompt:
      'An androgynous musician with a black bob for a synth brand at sunset. They look around, point, and bow.',
  },
  {
    id: 'amara',
    label: 'Braids · desert',
    prompt:
      'A joyful woman with long braids for a desert travel app. She dances, claps, and celebrates.',
  },
  {
    id: 'noah',
    label: 'Beard · winter',
    prompt:
      'A sleepy man with a red beard for a snowy winter lodge. He stretches, yawns, and waves.',
  },
];

type Brief = {
  label: string;
  prompt: string;
  scene: Scene;
};

const BRIEFS: Brief[] = CARD_ORDER.map((card) => {
  const member = HUMAN_CAST.find((person) => person.id === card.id);
  return {
    label: card.label,
    prompt: card.prompt,
    scene: member?.scene ?? HUMAN_CAST[0].scene,
  };
});

const SURPRISES = [
  'A tall woman with a bun and a teal coat in a rainy city, points at the camera and smiles.',
  'A broad-shouldered man with a beard in a meadow, laughs, stretches, and waves.',
  'An androgynous dancer with a curly bob at sunset, dances, claps, and bows.',
  'A grandmother with silver braids in an autumn garden, waves, laughs, and nods.',
  'A focused tennis player with a high ponytail on a court, swings, celebrates, and waves.',
  'A cozy baker with a beard in a snowy lodge, stirs, yawns, and waves.',
];

export function BriefLibrary() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <section className="briefs" id="briefs" aria-labelledby="briefs-title">
      <div className="shell">
        <div className="briefs-head" data-reveal>
          <div>
            <p className="kicker">Starter directions</p>
            <h2 id="briefs-title" className="h2">
              Six people.
              <br />
              Six performances.
            </h2>
          </div>
          <p>
            Every card is a real scene the compiler rebuilds from one sentence. Open a brief, then
            change the hair, the outfit, the world, or the ending in the studio.
          </p>
        </div>

        <div className="briefs-grid">
          {BRIEFS.map((brief, index) => {
            const scene = brief.scene;
            const at = scene.score.duration * (0.34 + (index % 3) * 0.08);
            const human = scene.actors[0]?.genome.human;
            const look = human
              ? `${human.presentation} · ${human.hair.style}`
              : scene.actors.map((a) => a.genome.bodyPlan).join(' + ');
            const actions = [
              ...new Set(
                scene.score.beats
                  .filter((beat) => beat.layer !== 'base')
                  .map((beat) => (beat.verb === 'greet' ? 'wave' : beat.verb)),
              ),
            ]
              .slice(0, 3)
              .join(' · ');

            return (
              <article
                key={brief.label}
                className="brief-card"
                data-reveal
                data-delay={index > 0 ? String(index) : undefined}
              >
                <Link
                  href={`/creature?prompt=${encodeURIComponent(brief.prompt)}`}
                  className="brief-frame"
                  aria-label={`Direct ${brief.label}`}
                >
                  {mounted ? (
                    <SceneFrame scene={scene} t={at} />
                  ) : (
                    <span className="block h-full w-full bg-[#EEE9DE]" aria-hidden="true" />
                  )}
                  <span className="brief-play">
                    <ArrowUpRight size={15} strokeWidth={2} />
                  </span>
                  <span className="brief-index">{String(index + 1).padStart(2, '0')}</span>
                </Link>
                <div className="brief-body">
                  <div className="brief-title-row">
                    <h3>{scene.actors[0]?.genome.name ?? brief.label}</h3>
                    <span>{brief.label}</span>
                  </div>
                  <p>{brief.prompt}</p>
                  <div className="brief-meta">
                    <span>{look}</span>
                    <span>{scene.world.preset}</span>
                    <span>{actions}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="briefs-foot" data-reveal>
          <p>
            Don&apos;t see your person? That is the point. The director infers a human genome, then
            lets you change the hair, outfit, world and performance.
          </p>
          <div className="briefs-foot-actions">
            <button
              type="button"
              className="btn btn-light"
              onClick={() => {
                const prompt = SURPRISES[Math.floor(Math.random() * SURPRISES.length)];
                window.location.href = `/creature?prompt=${encodeURIComponent(prompt)}`;
              }}
            >
              <Sparkles size={15} strokeWidth={1.9} />
              Surprise me
            </button>
            <Link href="/creature" className="btn btn-dark">
              Write your own brief
              <ArrowUpRight size={15} strokeWidth={1.9} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
