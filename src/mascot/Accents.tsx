'use client';

import type { Accent, CompiledScore } from './types';
import { bell, seeded } from '../motion/engine';

// Small punctuation marks around the character: sparkle, heart, steam, confetti.
// They are generated from the score, never baked into the mascot.

const LIFE: Record<Accent['type'], number> = {
  sparkle: 1100,
  heart: 1500,
  confetti: 1600,
  steam: 1600,
  note: 1500,
  motion: 700,
  blush: 1200,
};

export function Accents({ compiled, time }: { compiled: CompiledScore; time: number }) {
  const accents = compiled.score.accents ?? [];
  if (!accents.length) return null;
  return (
    <svg viewBox="0 0 400 400" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
      {accents.map((a, i) => {
        const life = LIFE[a.type] ?? 1200;
        const age = time - a.t;
        if (age < 0 || age > life) return null;
        const p = age / life;
        return <AccentMark key={i} a={a} p={p} palette={compiled.genome.palette} index={i} />;
      })}
    </svg>
  );
}

function AccentMark({ a, p, palette, index }: { a: Accent; p: number; palette: CompiledScore['genome']['palette']; index: number }) {
  const x = a.x ?? 200;
  const y = a.y ?? 150;
  const color = a.color ?? palette.accent;

  if (a.type === 'sparkle') {
    const s = bell(p) * 1.1;
    return (
      <g transform={`translate(${x} ${y}) scale(${s}) rotate(${p * 40 + seeded(index, 2) * 30})`} opacity={Math.sin(p * Math.PI)}>
        <path d="M 0 -16 C 2 -5 5 -2 16 0 C 5 2 2 5 0 16 C -2 5 -5 2 -16 0 C -5 -2 -2 -5 0 -16 Z" fill={color} />
        <circle cx={12} cy={-11} r={3} fill={palette.white} opacity={0.8} />
      </g>
    );
  }

  if (a.type === 'heart') {
    const rise = p * 46;
    return (
      <g transform={`translate(${x + Math.sin(p * 8) * 7} ${y - rise}) scale(${0.5 + bell(p) * 0.7})`} opacity={Math.min(1, (1 - p) * 2.2)}>
        <path d="M 0 8 C -12 0 -13 -7 -8 -10 C -4 -12 -1 -8 0 -6 C 1 -8 4 -12 8 -10 C 13 -7 12 0 0 8 Z" fill={color} />
      </g>
    );
  }

  if (a.type === 'confetti') {
    return (
      <g opacity={1 - p * p}>
        {Array.from({ length: 9 }).map((_, k) => {
          const ang = -Math.PI / 2 + (seeded(k + index * 9, 1) - 0.5) * 2.4;
          const dist = (28 + seeded(k + index * 9, 5) * 52) * p;
          const cx = x + Math.cos(ang) * dist;
          const cy = y + Math.sin(ang) * dist + p * p * 34;
          const rot = seeded(k, 3) * 360 + p * 220;
          const c = [palette.accent, palette.outfit, palette.blush, palette.furLight][k % 4];
          return <rect key={k} x={cx - 2.4} y={cy - 3.6} width={4.8} height={7.2} rx={1.2} fill={c} transform={`rotate(${rot} ${cx} ${cy})`} opacity={0.85} />;
        })}
      </g>
    );
  }

  if (a.type === 'steam') {
    return (
      <g opacity={0.7 * (1 - p)}>
        {[0, 1, 2].map((k) => {
          const cx = x + (k - 1) * 10 + Math.sin(p * 7 + k) * 4;
          const cy = y - p * 34 - k * 5;
          return <circle key={k} cx={cx} cy={cy} r={3.6 + p * 3 + k * 0.4} fill={palette.white} opacity={0.55 - k * 0.1} />;
        })}
      </g>
    );
  }

  if (a.type === 'note') {
    return (
      <g transform={`translate(${x + Math.sin(p * 6) * 10} ${y - p * 44}) scale(${0.7 + bell(p) * 0.3})`} opacity={1 - p * 0.9} fill={palette.ink}>
        <ellipse cx={0} cy={0} rx={5.5} ry={4.2} transform="rotate(-18)" />
        <path d="M 4 -1 L 4 -18 Q 10 -16 12 -11" fill="none" stroke={palette.ink} strokeWidth={2} strokeLinecap="round" />
      </g>
    );
  }

  if (a.type === 'motion') {
    return (
      <g opacity={0.35 * (1 - p)} stroke={palette.ink} strokeWidth={2.4} strokeLinecap="round" fill="none">
        <path d={`M ${x - 44 - p * 20} ${y - 8} L ${x - 18 - p * 12} ${y - 8}`} />
        <path d={`M ${x + 18 + p * 12} ${y - 8} L ${x + 44 + p * 20} ${y - 8}`} />
      </g>
    );
  }

  return null;
}
