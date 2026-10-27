'use client';

import { useEffect } from 'react';
import { Creature } from '../mascot/Creature';
import { Accents } from '../mascot/Accents';
import { computePose } from '../motion/pose';
import type { CompiledScore } from '../mascot/types';
import { useClock } from '../hooks/useClock';

type StageProps = {
  compiled: CompiledScore;
  time: number;
  className?: string;
  meta?: boolean;
  bare?: boolean;
};

export function Stage({ compiled, time, className, meta = false, bare = false }: StageProps) {
  const pose = computePose(compiled, time);
  const p = compiled.genome.palette;

  return (
    <div className={className ?? 'relative h-full w-full'}>
      <div className="absolute inset-0 overflow-hidden rounded-[28px]">
        {!bare && (
          <>
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(120% 95% at 50% 16%, ${p.bg1} 0%, ${p.bg1} 38%, ${p.bg2} 100%)`,
              }}
            />
            <div
              className="absolute inset-0 opacity-[0.18]"
              style={{
                backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(30,25,20,0.54) 1px, transparent 0)',
                backgroundSize: '16px 16px',
                maskImage: 'radial-gradient(72% 68% at 50% 44%, black, transparent 80%)',
                WebkitMaskImage: 'radial-gradient(72% 68% at 50% 44%, black, transparent 80%)',
              }}
            />
            <div
              className="absolute left-1/2 top-[9%] h-[64%] w-[64%] -translate-x-1/2 rounded-full border border-dashed"
              style={{ borderColor: `${p.ink}18` }}
            />
            <div
              className="absolute left-1/2 top-[18%] h-[42%] w-[42%] -translate-x-1/2 rounded-full"
              style={{ background: `radial-gradient(circle, ${p.accentSoft}66 0%, transparent 68%)` }}
            />
          </>
        )}
      </div>

      <div className="absolute inset-0">
        <Creature genome={compiled.genome} pose={pose} />
        <Accents compiled={compiled} time={time} />
      </div>

      {meta && (
        <>
          <div className="absolute left-4 top-4 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/70 backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#4b63ff]" />
              live svg
            </span>
            <span className="rounded-full border border-white/60 bg-white/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/75 backdrop-blur">
              {compiled.genome.name}
            </span>
          </div>
          <div className="absolute right-4 top-4 rounded-full border border-white/60 bg-white/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/70 backdrop-blur">
            60 fps · code
          </div>
        </>
      )}
    </div>
  );
}

/** A complete little player for previews and the hero. */
export function StagePlayer({ compiled, autoPlay = true, fps = 60 }: { compiled: CompiledScore; autoPlay?: boolean; fps?: number }) {
  const { time, playing, toggle, seek } = useClock(compiled.score.duration, compiled.score.loop, autoPlay, fps);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as unknown as { __ani?: Record<string, unknown> }).__ani = {
      play: () => {
        if (!playing) toggle();
      },
      pause: () => {
        if (playing) toggle();
      },
      seek,
      setTime: seek,
      time,
    };
  }, [playing, seek, time, toggle]);

  return (
    <div className="relative h-full w-full">
      <Stage compiled={compiled} time={time} meta />
      <div className="absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-2xl border border-white/70 bg-white/75 px-3 py-2 shadow-[0_10px_30px_-14px_rgba(30,25,20,0.5)] backdrop-blur-md">
        <button
          onClick={toggle}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-paper transition hover:scale-105 active:scale-95"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor"><rect x="1" y="1" width="3.4" height="10" rx="1" /><rect x="7.6" y="1" width="3.4" height="10" rx="1" /></svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor"><path d="M2 1.4 10.4 6 2 10.6Z" /></svg>
          )}
        </button>
        <input
          type="range"
          min={0}
          max={compiled.score.duration}
          step={16}
          value={time}
          onChange={(e) => seek(Number(e.target.value))}
          className="ani-range flex-1 cursor-pointer appearance-none"
          aria-label="Timeline"
        />
        <span className="w-11 shrink-0 text-right font-mono text-[11px] tabular-nums text-ink/70">{(time / 1000).toFixed(1)}s</span>
      </div>
    </div>
  );
}
