'use client';

import { ArrowUpRight, GitBranch, Mic } from 'lucide-react';
import { AniMark } from './Nav';
import { Sparkle, Squiggle } from './Doodles';

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-ink text-paper">
      <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: 'radial-gradient(70% 60% at 50% 0%, rgba(75,99,255,0.28), transparent 70%)' }} />
      <div className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '22px 22px' }} />

      <div className="relative mx-auto max-w-[1140px] px-5 pb-8 pt-20 sm:pt-28">
        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-paper/60">04 / your turn</p>
            <div className="relative mt-3 inline-block">
              <h2 className="font-display text-[clamp(3.4rem,10vw,8.5rem)] leading-[0.86] tracking-[-0.03em] text-[#fbf8f0]">
                make it
                <br />
                alive.
              </h2>
              <Sparkle className="absolute -right-6 top-2 h-6 w-6 text-accent sm:-right-10 sm:h-9 sm:w-9" />
            </div>
            <p className="mt-5 max-w-[460px] text-[14.5px] leading-[1.7] text-paper/60">
              One sentence is enough. Ani will invent the character, write the performance, and hand you
              a file that actually ships.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a href="#studio" className="group inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3.5 font-hand text-[15px] font-semibold text-white shadow-[0_18px_36px_-18px_rgba(75,99,255,0.8)] transition hover:-translate-y-0.5 hover:bg-[#5f75ff]">
                Open the studio
                <ArrowUpRight size={15} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
              <a href="https://github.com/pranavk429/ani-toon" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-3.5 font-hand text-[14px] text-paper/70 transition hover:border-white/40 hover:text-paper">
                <GitBranch size={14} />
                View the repo
              </a>
            </div>
            <div className="mt-8 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.1em] text-paper/60">
              <Mic size={12} className="text-accent" />
              built with Wispr Flow · speak the brief, not the keyframes
            </div>
          </div>

          <div className="flex flex-col justify-between gap-8 rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
            <div>
              <AniMark size={42} />
              <p className="mt-3 font-hand text-[22px] font-bold leading-tight">A mascot studio for people who don&apos;t animate.</p>
              <p className="mt-2 text-[12px] leading-relaxed text-paper/65">No signup. No server. Your brief and your character stay in the browser.</p>
            </div>
            <div className="space-y-2">
              {[
                ['Studio', '#studio'],
                ['How it works', '#how'],
                ['Examples', '#examples'],
                ['Why code', '#why'],
              ].map(([label, href]) => (
                <a key={href} href={href} className="flex items-center justify-between border-b border-white/10 pb-1.5 font-hand text-[13px] text-paper/60 transition hover:text-paper">
                  {label}
                  <span className="text-paper/60">↗</span>
                </a>
              ))}
            </div>
            <Squiggle className="h-4 w-20 opacity-20" color="#fbf8f0" />
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[8px] uppercase leading-[1.8] tracking-[0.1em] text-paper/60">
            © 2026 Ani · a no-code mascot studio
            <br />
            WeMakeDevs × Wispr Flow · Track 02
          </p>
          <p className="max-w-[360px] font-mono text-[8px] uppercase leading-[1.8] tracking-[0.1em] text-paper/65 sm:text-right">
            Motion method inspired by Rossark (MIT).
            <br />
            No video models. No templates. Original characters only.
          </p>
        </div>
      </div>
      <div className="pointer-events-none relative -mb-6 overflow-hidden sm:-mb-10" aria-hidden>
        <p className="whitespace-nowrap text-center font-display text-[clamp(5rem,18vw,16rem)] leading-[0.8] tracking-[-0.04em] text-[#666666]">mochi juno lumi bolt pip coco</p>
      </div>
    </footer>
  );
}
