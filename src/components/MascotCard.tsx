'use client';

import { Stage } from './Stage';
import { Pin } from './Doodles';
import type { CompiledScore } from '../mascot/types';

type Props = {
  compiled: CompiledScore;
  time: number;
  rotation?: number;
  offset?: number;
  label?: string;
  meta?: string;
  pinColor?: string;
  onClick?: () => void;
  className?: string;
};

export function MascotCard({
  compiled,
  time,
  rotation = 0,
  offset = 0,
  label,
  meta,
  pinColor = '#4b63ff',
  onClick,
  className = '',
}: Props) {
  const name = label ?? compiled.genome.name;
  const sub = meta ?? compiled.genome.concept.replace(/^a /, '');

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative block shrink-0 text-left ${className}`}
      style={{ transform: `rotate(${rotation}deg) translateY(${offset}px)` }}
      aria-label={`Open ${name} in the studio`}
    >
      <span className="absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-1/2">
        <Pin color={pinColor} />
      </span>
      <span className="block rounded-[22px] border-[5px] border-[#fffdf9] bg-[#fffdf9] p-1.5 shadow-[0_18px_38px_-18px_rgba(30,25,20,0.42),0_2px_6px_rgba(30,25,20,0.08)] transition-[transform,box-shadow] duration-300 ease-out group-hover:-translate-y-2.5 group-hover:shadow-[0_28px_50px_-20px_rgba(30,25,20,0.5)] group-focus-visible:-translate-y-2.5">
        <span className="block aspect-[4/5] overflow-hidden rounded-[15px] bg-[#f4efe6]">
          <Stage compiled={compiled} time={time} />
        </span>
        <span className="flex flex-col items-start gap-0.5 px-2 pb-1 pt-2">
          <span className="max-w-full truncate font-hand text-[17px] font-extrabold leading-none tracking-[0.34px] text-ink">{name}</span>
          <span className="max-w-full truncate font-mono text-[8px] uppercase tracking-[0.1em] text-muted">{sub}</span>
        </span>
      </span>
    </button>
  );
}
