'use client';

import { ArrowRight, Mic, PenLine, Play } from 'lucide-react';
import { Squiggle } from './Doodles';
import { AniMark } from './Nav';

export function HowItWorks() {
  const steps = [
    {
      n: '01',
      title: 'Say it',
      body: 'Type a feeling, a job, or a whole brand. Or hold Fn + Space and talk — Wispr Flow turns the thought into a brief.',
      extra: (
        <div className="relative mt-5 rounded-2xl border border-line bg-paper/70 p-3">
          <div className="flex items-start gap-2">
            <Mic size={14} className="mt-0.5 shrink-0 text-accent" />
            <p className="font-hand text-[13px] leading-snug text-ink/75">
              “a cozy bear barista for a slow-coffee brand — warm, a little sleepy, waves hello”
            </p>
          </div>
          <span className="absolute -right-2 -top-3 rotate-6 rounded bg-[#f4c84f] px-2 py-1 font-mono text-[7.5px] uppercase tracking-[0.08em] shadow-sm">spoken</span>
        </div>
      ),
    },
    {
      n: '02',
      title: 'Meet it',
      body: 'A genome is generated: head, ears, face, body, palette, outfit, prop and personality. Not a template with a colour swap.',
      extra: (
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-line bg-paper/70 p-3">
          <AniMark size={44} />
          <div>
            <p className="font-hand text-[14px] font-bold">Mochi · bear barista</p>
            <p className="font-mono text-[8px] uppercase tracking-[0.08em] text-muted">honey / forest / scarf / cup</p>
          </div>
        </div>
      ),
    },
    {
      n: '03',
      title: 'Move it',
      body: 'The director writes a score of beats. The compiler turns each beat into poses, breath, weight shift and follow-through. One clock. Real SVG.',
      extra: (
        <div className="mt-5 rounded-2xl border border-line bg-paper/70 p-3">
          <div className="mb-2 flex items-center justify-between font-mono text-[7.5px] uppercase tracking-[0.1em] text-muted">
            <span>score.ani</span>
            <span className="inline-flex items-center gap-1 text-[#3f7049]"><Play size={8} fill="currentColor" /> 60fps</span>
          </div>
          <div className="flex gap-1">
            {[
              ['wake', '#b9b2a5', 16, '#111'],
              ['perk', '#f0b429', 12, '#111'],
              ['sip', '#d98a52', 26, '#111'],
              ['present', '#4b63ff', 22, '#fff'],
              ['settle', '#b9b2a5', 14, '#111'],
            ].map(([name, color, w, ink]) => (
              <span key={name as string} className="flex h-5 items-center overflow-hidden rounded px-1.5 font-mono text-[7px] uppercase" style={{ background: color as string, width: `${w}%`, color: ink as string }}>
                {name}
              </span>
            ))}
          </div>
        </div>
      ),
    },
  ];

  return (
    <section id="how" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-[1140px] px-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mono-label mb-3">01 / how it works</p>
            <h2 className="max-w-[620px] font-hand text-[clamp(2.2rem,5vw,4rem)] font-bold leading-[1.02] tracking-[-0.03em]">
              From a sentence
              <br />
              to a <span className="text-accent">performance.</span>
            </h2>
          </div>
          <p className="max-w-[300px] font-mono text-[10px] uppercase leading-[1.8] tracking-[0.08em] text-muted">
            No timeline. No rigging. No keyframes.
            <br />
            Just a director with a point of view.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <article key={s.n} className="group relative flex flex-col rounded-[28px] border border-line bg-surface p-5 shadow-[var(--shadow-sm)] transition duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-md)] sm:p-6">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] tracking-[0.14em] text-muted">{s.n}</span>
                <span className="grid h-8 w-8 place-items-center rounded-full border border-line text-ink/70 transition group-hover:border-accent group-hover:text-accent">
                  {i === 0 ? <Mic size={13} /> : i === 1 ? <PenLine size={13} /> : <Play size={12} fill="currentColor" />}
                </span>
              </div>
              <h3 className="mt-6 font-hand text-[28px] font-bold leading-none">{s.title}</h3>
              <p className="mt-2 text-[13px] leading-[1.65] text-ink/75">{s.body}</p>
              <div className="mt-auto">{s.extra}</div>
            </article>
          ))}
        </div>

        <div className="relative mt-8 flex items-center justify-center gap-3 text-muted">
          <Squiggle className="h-4 w-16 opacity-30" />
          <span className="font-hand text-[13px]">the character never leaves the browser</span>
          <ArrowRight size={13} />
        </div>
      </div>
    </section>
  );
}
