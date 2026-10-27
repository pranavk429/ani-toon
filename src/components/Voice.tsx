'use client';

import { ArrowUpRight, Mic } from 'lucide-react';
import { Sparkle, Squiggle } from './Doodles';

export function Voice() {
  return (
    <section id="voice" className="relative border-t border-line/70 py-20 sm:py-28">
      <div className="mx-auto max-w-[1140px] px-5">
        <div className="grid items-center gap-10 lg:grid-cols-[1.02fr_0.98fr]">
          <div>
            <p className="mono-label mb-3">03 / voice first</p>
            <h2 className="max-w-[620px] font-hand text-[clamp(2.2rem,5vw,4rem)] font-bold leading-[1.02] tracking-[-0.03em]">
              The fastest interface
              <br />
              is your <span className="hand-underline">voice.</span>
            </h2>
            <p className="mt-4 max-w-[520px] text-[16.5px] font-normal leading-[1.7] text-ink/75">
              Wispr Flow turns a spoken thought into a brief. We built and demoed Ani this way: no forms, no
              dropdowns, no typing while you think. Say the character, say the feeling, and the director takes it
              from there.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              <span className="mr-1 font-display text-[19px] leading-none text-ink">hold</span>
              <Key>fn</Key>
              <span className="font-display text-[19px] leading-none text-ink/70">+</span>
              <Key wide>space</Key>
              <span className="ml-1 font-display text-[19px] leading-none text-ink">then talk</span>
            </div>

            <a href="#studio" className="group mt-6 inline-flex items-center gap-2 text-[18px] font-normal tracking-[0.54px] text-ink/75 underline-offset-4 transition hover:text-accent hover:underline">
              Try a spoken brief in the studio
              <ArrowUpRight size={16} className="text-accent transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
          </div>

          <div className="relative">
            <Sparkle className="floaty absolute -left-4 -top-5 z-10 h-6 w-6 text-accent" />
            <div className="relative overflow-hidden rounded-[28px] border border-line bg-surface p-5 shadow-[var(--shadow-lg)] sm:p-6">
              <div className="flex items-center gap-3 border-b border-line/70 pb-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-white shadow-[0_10px_18px_-10px_rgba(75,99,255,0.8)]">
                  <Mic size={16} />
                </span>
                <div className="flex h-8 flex-1 items-center gap-[3px]">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23].map((i) => (
                    <span
                      key={i}
                      className="voice-bar w-full rounded-full bg-accent/70"
                      style={{
                        height: `${18 + Math.sin(i * 1.7) * 8 + (i % 3) * 5}px`,
                        animationDelay: `${i * 55}ms`,
                      }}
                    />
                  ))}
                </div>
                <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-muted">listening</span>
              </div>

              <p className="mt-5 font-hand text-[24px] font-bold leading-[1.25] text-ink">
                “a cozy bear barista, a little sleepy — waves hello and sips a latte.”
              </p>
              <p className="mt-2 font-hand text-[21px] font-extrabold tracking-[0.84px] text-accent">spoken, not typed.</p>

              <div className="mt-5 rounded-xl border border-line bg-paper/60 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-muted">brief received</span>
                  <span className="font-mono text-[8px] text-[#3f7049]">genome + score ✓</span>
                </div>
                <div className="mt-2 flex gap-1">
                  {['wake', 'perk', 'wave', 'sip', 'settle'].map((s, i) => (
                    <span
                      key={s}
                      className="flex h-5 items-center justify-center rounded px-1.5 font-mono text-[7px] uppercase"
                      style={{
                        width: `${[16, 12, 28, 26, 14][i]}%`,
                        background: ['#b9b2a5', '#f0b429', '#4b63ff', '#d98a52', '#b9b2a5'][i],
                        color: i === 2 ? '#fff' : '#111',
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <Squiggle className="mx-auto mt-5 h-4 w-24 opacity-25" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Key({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <span
      className={`inline-grid h-10 place-items-center rounded-xl border border-line bg-surface px-3 font-mono text-[10px] uppercase tracking-[0.08em] text-ink/70 shadow-[0_4px_0_#d7d4cb,0_8px_14px_-8px_rgba(40,34,22,0.3)] ${wide ? 'min-w-[74px]' : 'min-w-[42px]'}`}
    >
      {children}
    </span>
  );
}
