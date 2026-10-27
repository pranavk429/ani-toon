'use client';

import { useState } from 'react';
import { ArrowUpRight, Shuffle, Sparkles } from 'lucide-react';
import { useClock } from '../hooks/useClock';
import { HERO_MASCOTS, type Showcase } from '../showcase';
import { MascotCard } from './MascotCard';
import { CoffeeCup, Crown, MicWave, Sparkle, SpeechBubble, Squiggle, Star, Underline } from './Doodles';
import { randomBrief } from '../director';

type Props = {
  onGenerate: (brief: string) => void;
  onPick: (s: Showcase) => void;
};

const ROT = [-9, -3.5, 4, 10];
const OFFSET = [26, 8, 4, 26];
const PINS = ['#4b63ff', '#e15b64', '#f0b429', '#4b63ff'];

export function Hero({ onGenerate, onPick }: Props) {
  const [brief, setBrief] = useState('');
  const { time } = useClock(9000, true, true, 30);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = brief.trim() || randomBrief();
    onGenerate(text);
  };

  return (
    <section id="top" className="relative overflow-hidden pb-10 pt-28 sm:pt-32 lg:pb-16 lg:pt-32">
      <div className="paper-grain pointer-events-none absolute inset-0" aria-hidden />
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <Sparkle className="floaty absolute left-[7%] top-[16%] h-5 w-5 opacity-80" />
        <Sparkle className="floaty absolute right-[10%] top-[13%] h-3.5 w-3.5 opacity-60" color="#111" />
        <Star className="floaty absolute right-[6%] top-[34%] hidden h-14 w-14 drop-shadow-[0_10px_14px_rgba(40,34,22,0.18)] lg:block" />
        <CoffeeCup className="floaty absolute left-[3%] top-[44%] hidden h-28 w-24 drop-shadow-[0_18px_22px_rgba(40,34,22,0.16)] lg:block" />
        <SpeechBubble className="floaty wiggle absolute right-[2%] top-[52%] hidden h-20 w-24 drop-shadow-[0_14px_18px_rgba(40,34,22,0.12)] xl:block" />
        <div className="absolute left-[9%] top-[33%] hidden rotate-[-9deg] rounded-lg bg-[#f4c84f] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-ink shadow-[0_10px_18px_-10px_rgba(40,34,22,0.5)] lg:block">
          no templates
          <br />
          <span className="text-[8px] opacity-60">just a genome</span>
        </div>
      </div>

      <div className="relative mx-auto max-w-[1140px] px-5">
        <div className="mx-auto max-w-[980px] text-center">
          <div className="mb-7 flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
            AI mascot studio — no code, no templates
          </div>

          <div className="relative inline-block">
            <Crown className="absolute -top-4 left-[49%] h-9 w-16 -translate-x-1/2 rotate-[-6deg] sm:-top-6 sm:h-12 sm:w-20" />
            <Sparkle className="absolute -left-8 top-10 h-6 w-6 rotate-12 text-accent sm:-left-12 sm:h-8 sm:w-8" />
            <h1 className="puffy select-none text-[clamp(7.4rem,24vw,17.5rem)] leading-[0.72] tracking-[-0.03em]">ANI</h1>
            <Underline className="absolute -bottom-3 left-1/2 h-5 w-[78%] -translate-x-1/2 sm:-bottom-5 sm:h-7" />
            <Star className="absolute -right-6 -top-5 h-8 w-8 rotate-12 sm:-right-12 sm:top-0 sm:h-12 sm:w-12" />
          </div>

          <h2 className="mt-12 font-hand text-[clamp(2rem,4.2vw,3.4rem)] font-bold leading-[1.05] tracking-[-0.02em] sm:mt-12">
            mascots, <span className="hand-underline text-ink">alive.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-[565px] text-[15px] font-medium leading-[1.7] text-ink/75 sm:text-[15.5px]">
            Describe a brand feeling. Ani invents an original vector character and writes a performance
            just for it — not a template, not a video model. Pure code, every frame.
          </p>

          <form
            onSubmit={submit}
            className="mx-auto mt-6 flex w-full max-w-[660px] items-center gap-2 rounded-full border border-line bg-surface p-1.5 pl-4 shadow-[var(--shadow-lg)] transition focus-within:border-accent/40 focus-within:shadow-[0_26px_50px_-26px_rgba(75,99,255,0.5)] sm:mt-8 sm:pl-5"
          >
            <Sparkles size={17} className="shrink-0 text-accent" aria-hidden />
            <input
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="A cozy bear barista…"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-[14.5px] text-ink outline-none placeholder:text-muted sm:text-[15px]"
              aria-label="Describe your mascot"
            />
            <button
              type="button"
              onClick={() => setBrief(randomBrief())}
              className="hidden h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-paper hover:text-ink sm:grid"
              aria-label="Surprise me"
              title="Surprise me"
            >
              <Shuffle size={15} />
            </button>
            <button type="submit" className="group flex shrink-0 items-center gap-2 rounded-full bg-ink px-4 py-3 font-hand text-[14.5px] font-semibold text-paper transition hover:bg-ink-2 sm:px-5">
              Generate
              <ArrowUpRight size={15} className="text-accent transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </button>
          </form>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <MicWave className="h-3.5 w-3.5 text-accent" />
              or hold <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-[9px] text-ink/70">fn</kbd>
              <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-[9px] text-ink/70">space</kbd>
              and talk — Wispr Flow
            </span>
            <span className="hidden h-1 w-1 rounded-full bg-line sm:block" />
            <span>no signup</span>
            <span className="hidden h-1 w-1 rounded-full bg-line sm:block" />
            <span>svg out</span>
          </div>
        </div>

        <div className="relative mt-8 sm:mt-10">
          <div className="no-scrollbar flex items-end justify-center gap-0 overflow-x-auto px-2 pb-6 pt-8 sm:overflow-visible">
            {HERO_MASCOTS.map((m, i) => (
              <div
                key={m.id}
                className={`${i === 0 ? '' : '-ml-3 sm:-ml-6 lg:-ml-8'}  ${
                  i > 1 ? 'hidden sm:block' : ''
                }`}
              >
                <MascotCard
                  compiled={m.compiled}
                  time={(time + i * 1250) % m.compiled.score.duration}
                  rotation={ROT[i]}
                  offset={OFFSET[i]}
                  pinColor={PINS[i]}
                  label={m.compiled.genome.name}
                  meta={m.tags.slice(0, 2).join(' · ')}
                  onClick={() => onPick(m)}
                  className="w-[160px] sm:w-[198px] lg:w-[228px]"
                />
              </div>
            ))}
          </div>

          <Squiggle className="mx-auto -mt-1 h-4 w-24 opacity-30" />
          <p className="mt-3 text-center font-hand text-[13px] text-muted">
            Each one generated from a sentence. Click to load it in the studio.
          </p>
        </div>
      </div>
    </section>
  );
}
