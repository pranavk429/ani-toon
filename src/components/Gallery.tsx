'use client';

import { ArrowUpRight, Sparkles } from 'lucide-react';
import { useClock } from '../hooks/useClock';
import { SHOWCASE, type Showcase } from '../showcase';
import { MascotCard } from './MascotCard';
import { Sparkle, Squiggle } from './Doodles';

const ROT = [-2.2, 1.4, -1.2, 2, -1.6, 1.2];

export function Gallery({ onPick }: { onPick: (s: Showcase) => void }) {
  const { time } = useClock(9000, true, true, 24);

  return (
    <section id="examples" className="relative border-t border-line/70 py-20 sm:py-28">
      <div className="mx-auto max-w-[1140px] px-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mono-label mb-3">02 / the residents</p>
            <h2 className="max-w-[640px] font-hand text-[clamp(2.2rem,5vw,4rem)] font-bold leading-[1.02] tracking-[-0.03em]">
              Six sentences.
              <br />
              Six <span className="hand-underline">different</span> lives.
            </h2>
          </div>
          <p className="max-w-[320px] text-[13.5px] leading-[1.7] text-ink/75">
            These were not drawn by hand. Each one came from a short brief, then wrote its own movement.
            Open any of them and change a single word.
          </p>
        </div>

        <div className="relative mt-12">
          <Sparkle className="absolute -left-5 top-24 hidden h-6 w-6 lg:block" />
          <Sparkle className="floaty absolute -right-4 top-1/3 hidden h-4 w-4 lg:block" color="#111" />
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-6 lg:grid-cols-3">
            {SHOWCASE.map((m, i) => (
              <div key={m.id} className="relative">
                <MascotCard
                  compiled={m.compiled}
                  time={(time + i * 1370) % m.compiled.score.duration}
                  rotation={ROT[i]}
                  pinColor={i % 2 === 0 ? '#4b63ff' : '#e15b64'}
                  label={m.compiled.genome.name}
                  meta={m.compiled.genome.brand}
                  onClick={() => onPick(m)}
                  className="w-full"
                />
                <div className="mt-2 flex flex-wrap items-center justify-center gap-1 px-1">
                  {m.tags.map((t) => (
                    <span key={t} className="rounded-full border border-line bg-surface/60 px-2 py-0.5 font-mono text-[7px] uppercase tracking-[0.08em] text-muted">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Squiggle className="mx-auto mt-10 h-4 w-28 opacity-25" />
        </div>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href="#studio" className="group inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3.5 font-hand text-[15px] font-semibold text-paper transition hover:-translate-y-0.5 hover:bg-ink-2">
            <Sparkles size={14} className="text-accent" />
            Make yours in the studio
            <ArrowUpRight size={15} className="text-accent transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>
          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">no two genomes are alike</span>
        </div>
      </div>
    </section>
  );
}
