'use client';

import { Check, Minus, Sparkles, X } from 'lucide-react';
import { LoopArrow, Star } from './Doodles';

export function WhyCode() {
  const cols = [
    {
      label: 'Template mascot apps',
      tone: 'muted',
      price: 'a move library',
      points: [
        ['Bitmap or rigged inside a player', false],
        ['11 ready-made moves', false],
        ['Every brand gets the same wave', false],
        ['Export gated by credits', false],
      ],
      foot: 'Fast to start. Impossible to make yours.',
    },
    {
      label: 'Video models',
      tone: 'muted',
      price: 'per second',
      points: [
        ['Beautiful pixels', true],
        ['No transparency, no rig', false],
        ['Reroll the whole clip to change one blink', false],
        ['Cost scales with every second', false],
      ],
      foot: 'Looks alive in a clip. Can’t live in a product.',
    },
    {
      label: 'Ani',
      tone: 'ani',
      price: 'one sentence',
      points: [
        ['A genome, generated from the brief', true],
        ['A score written for this character', true],
        ['Real SVG: transparent, crisp, 60fps', true],
        ['Change any trait and recompile forever', true],
      ],
      foot: 'Small enough to ship. Alive enough to remember.',
    },
  ];

  return (
    <section id="why" className="relative border-t border-line/70 py-20 sm:py-28">
      <div className="mx-auto max-w-[1140px] px-5">
        <div className="mx-auto max-w-[760px] text-center">
          <p className="mono-label mb-3">04 / the difference</p>
          <h2 className="font-hand text-[clamp(2.2rem,5vw,4.2rem)] font-bold leading-[1.02] tracking-[-0.03em]">
            Why <span className="text-[#3548d8]">code</span>, not video.
          </h2>
          <p className="mx-auto mt-4 max-w-[560px] text-[14.5px] leading-[1.7] text-ink/75">
            A mascot is not a clip. It is a brand asset that has to wave in an app, blink in a footer, and scale to a billboard.
            So we generate the character and the choreography as data — then render every frame.
          </p>
        </div>

        <div className="mt-12 grid gap-3 md:grid-cols-3">
          {cols.map((c) => (
            <article
              key={c.label}
              className={`relative flex flex-col rounded-[26px] border p-5 sm:p-6 ${
                c.tone === 'ani'
                  ? 'border-accent/45 bg-[#f7f8ff] shadow-[0_24px_50px_-34px_rgba(75,99,255,0.6)]'
                  : 'border-line bg-surface/70'
              }`}
            >
              {c.tone === 'ani' && (
                <span className="absolute -top-3 left-5 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-white shadow-sm">
                  <Sparkles size={9} /> the one
                </span>
              )}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-muted">{c.label}</p>
                  <p className={`mt-2 font-hand text-[26px] font-bold leading-none ${c.tone === 'ani' ? 'text-[#3548d8]' : 'text-ink/80'}`}>{c.price}</p>
                </div>
                {c.tone === 'ani' ? <Star className="h-9 w-9 -rotate-6" /> : <span className="h-8 w-8 rounded-full border border-line" />}
              </div>

              <ul className="mt-6 space-y-2.5">
                {c.points.map(([text, ok]) => (
                  <li key={text as string} className="flex items-start gap-2 text-[12.5px] leading-snug">
                    <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full ${ok ? (c.tone === 'ani' ? 'bg-accent/12 text-[#3548d8]' : 'bg-[#eef3e9] text-[#5b7a4e]') : 'bg-[#f4ece9] text-[#a26c5d]'}`}>
                      {ok ? <Check size={9} strokeWidth={3} /> : <X size={9} strokeWidth={3} />}
                    </span>
                    <span className={ok ? 'text-ink/75' : 'text-ink/70'}>{text}</span>
                  </li>
                ))}
              </ul>
              <p className={`mt-auto pt-6 font-mono text-[8.5px] uppercase leading-[1.7] tracking-[0.06em] ${c.tone === 'ani' ? 'text-[#3548d8]' : 'text-muted'}`}>{c.foot}</p>
            </article>
          ))}
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['0', 'templates'],
            ['100%', 'vector'],
            ['~12kb', 'of character'],
            ['60fps', 'in the browser'],
          ].map(([n, l]) => (
            <div key={l} className="rounded-2xl border border-line bg-surface/60 px-4 py-4">
              <p className="font-display text-[32px] leading-none text-ink">{n}</p>
              <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-muted">{l}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-3xl border border-line bg-surface/50 px-5 py-4 sm:flex-row">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-[#3548d8]">
              <Minus size={15} />
            </span>
            <p className="font-hand text-[15px] leading-snug text-ink/75">
              No video model. No sprite sheet. No hardcoded mascot.
              <span className="block font-mono text-[8px] uppercase tracking-[0.1em] text-muted">the whole performance is a few hundred numbers</span>
            </p>
          </div>
          <LoopArrow className="hidden h-8 w-14 text-ink/75 sm:block" />
          <a href="#studio" className="shrink-0 rounded-full border border-ink/15 px-4 py-2.5 font-hand text-[13px] font-semibold transition hover:border-accent hover:text-[#3548d8]">
            See the score →
          </a>
        </div>
      </div>
    </section>
  );
}
