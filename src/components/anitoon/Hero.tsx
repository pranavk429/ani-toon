'use client';

import Link from 'next/link';
import { ArrowUpRight, CornerDownLeft } from 'lucide-react';

import { ScenePlayer } from '@/creature/ScenePlayer';
import { buildChefScene } from '@/creature/examples';

const PREVIEW = buildChefScene();

export function Hero() {
  return (
    <section className="studio-hero" aria-labelledby="hero-title">
      <div className="shell studio-hero-shell">
        <div className="studio-hero-top">
          <p className="kicker hero-kicker" data-reveal>
            Wispr No Hands Challenge · 2026
          </p>
          <div className="hero-proof" data-reveal>
            <span>
              <i aria-hidden="true" />
              AI art director
            </span>
            <span>16-bone human rig</span>
            <span>60fps compiler</span>
          </div>
        </div>

        <div className="studio-hero-grid">
          <div className="studio-hero-copy">
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-black/40">
              The human compiler
            </p>
            <h1 id="hero-title" className="display studio-hero-title">
              <span>Describe a person.</span>
              <span>
                Watch them <em>move.</em>
              </span>
            </h1>

            <p className="studio-hero-sub">
              One sentence becomes a human genome — presentation, hair, face, body, outfit — and a
              performance score. A local compiler builds the skeleton and performs every beat.
              Same hand, any person, any action, any world.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/creature" className="btn btn-dark">
                Open the human compiler
                <ArrowUpRight size={16} strokeWidth={2} />
              </Link>
              <Link href="/creature?skeleton=1" className="btn btn-light">
                See the skeleton
                <ArrowUpRight size={16} strokeWidth={2} />
              </Link>
            </div>

            <p className="hero-prompt-note">
              <CornerDownLeft size={12} strokeWidth={2} />
              Voice-first: speak the brief with Wispr Flow
            </p>

            <div className="mt-7 flex flex-wrap gap-2" aria-label="Human genome">
              {[
                'feminine · masculine · androgynous',
                '9 hair styles',
                '9 outfit shapes',
                '9 worlds',
              ].map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-black/10 bg-white/60 px-3 py-1.5 text-[10px] font-medium text-black/55"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="w-full max-w-[560px] justify-self-center" data-reveal>
            <div className="relative aspect-square w-full overflow-hidden rounded-[28px] bg-[#0B0B10] shadow-[0_36px_90px_-36px_rgba(20,20,20,0.55)]">
              <ScenePlayer scene={PREVIEW} />

              <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-semibold text-[#141414] backdrop-blur">
                <i className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
                LIVE · 60 FPS
              </div>

              <div className="absolute right-3 top-3 rounded-full bg-black/45 px-3 py-1.5 text-[10px] font-medium text-white/85 backdrop-blur">
                kitchen
              </div>

              <div className="absolute inset-x-3 bottom-3">
                <div className="mb-2 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/50">
                      generated person
                    </div>
                    <div className="mt-0.5 text-[13px] font-semibold leading-tight text-white">
                      Marco — 16 bones
                    </div>
                  </div>
                  <div className="rounded-full bg-black/40 px-2.5 py-1 text-[9px] text-white/65 backdrop-blur">
                    wave · stir · laugh
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['masculine', 'mustache', 'chef hat + apron', '0 assets'].map((label) => (
                    <span
                      key={label}
                      className="rounded-full bg-black/50 px-2.5 py-1 text-[9px] leading-none text-white/85 backdrop-blur"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-black/40">
              The same 16-bone rig carries the whole cast. Hair, outfits and worlds are data.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
