'use client';

import { memo } from 'react';

import type { ObjectFrame } from './objects';
import type { SceneObjectKind } from './types';

function shade(hex: string, amount: number): string {
  const clean = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#888888';
  const n = parseInt(clean.slice(1), 16);
  const channel = (shift: number) => {
    const v = (n >> shift) & 255;
    const out = amount >= 0 ? v + (255 - v) * amount : v * (1 + amount);
    return Math.max(0, Math.min(255, Math.round(out)))
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

function ObjectShape({ frame }: { frame: ObjectFrame }) {
  const { object, fill } = frame;
  const dark = shade(fill, -0.22);
  const light = shade(fill, 0.35);
  const cream = '#FFF8EA';
  const ink = '#2B2420';

  const kind: SceneObjectKind = object.kind;

  switch (kind) {
    case 'ball':
      return (
        <g>
          <circle r={26} fill={fill} />
          <path d="M-20 8 Q0 24 20 8" fill="none" stroke={dark} strokeWidth={5} strokeLinecap="round" />
          <path d="M-5 -24 Q-12 0 4 22" fill="none" stroke={dark} strokeWidth={4} strokeLinecap="round" />
          <circle cx={-9} cy={-13} r={6} fill={light} opacity={0.85} />
        </g>
      );
    case 'star':
      return (
        <g>
          <path
            d="M0 -32 L8 -10 L31 -7 L13 8 L19 31 L0 18 L-19 31 L-13 8 L-31 -7 L-8 -10 Z"
            fill={fill}
            stroke={dark}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <circle cx={-8} cy={-4} r={3.5} fill={cream} opacity={0.9} />
        </g>
      );
    case 'plant':
      return (
        <g>
          <path d="M-22 20 H22 L17 44 H-17 Z" fill={dark} />
          <rect x={-25} y={15} width={50} height={10} rx={4} fill={shade(dark, -0.12)} />
          <path d="M0 18 C-2 2 -1 -12 2 -26" fill="none" stroke="#4E8B57" strokeWidth={5} strokeLinecap="round" />
          <ellipse cx={-13} cy={-4} rx={14} ry={7} fill={fill} transform="rotate(-28 -13 -4)" />
          <ellipse cx={14} cy={-14} rx={14} ry={7} fill={light} transform="rotate(26 14 -14)" />
          <circle cx={3} cy={-28} r={9} fill={fill} />
          <circle cx={3} cy={-28} r={4} fill={cream} />
        </g>
      );
    case 'flower':
      return (
        <g>
          <path d="M0 44 C-2 20 2 4 0 -6" fill="none" stroke="#4E8B57" strokeWidth={5} strokeLinecap="round" />
          <ellipse cx={-12} cy={26} rx={12} ry={6} fill="#6FAF6B" transform="rotate(-24 -12 26)" />
          <ellipse cx={12} cy={34} rx={11} ry={5} fill="#6FAF6B" transform="rotate(22 12 34)" />
          {[0, 72, 144, 216, 288].map((angle) => (
            <ellipse key={angle} cx={0} cy={-15} rx={9} ry={15} fill={fill} transform={`rotate(${angle} 0 -1)`} />
          ))}
          <circle r={10} fill={light} />
          <circle r={4} fill={cream} />
        </g>
      );
    case 'cup':
      return (
        <g>
          <path d="M-20 -16 H18 V16 Q18 28 4 28 H-4 Q-20 28 -20 16 Z" fill={fill} />
          <path d="M18 -8 Q34 -8 34 4 Q34 16 18 16" fill="none" stroke={dark} strokeWidth={6} strokeLinecap="round" />
          <ellipse cx={-1} cy={-16} rx={19} ry={6} fill={light} />
          <path d="M-8 -28 C-14 -38 0 -40 -6 -50" fill="none" stroke={cream} strokeWidth={4} strokeLinecap="round" opacity={0.8} />
        </g>
      );
    case 'gift':
      return (
        <g>
          <rect x={-26} y={-10} width={52} height={40} rx={6} fill={fill} />
          <rect x={-29} y={-22} width={58} height={14} rx={5} fill={light} />
          <rect x={-5} y={-22} width={10} height={52} fill={cream} />
          <path d="M0 -22 C-18 -34 -26 -18 -4 -18 Z" fill={cream} />
          <path d="M0 -22 C18 -34 26 -18 4 -18 Z" fill={cream} />
        </g>
      );
    case 'heart':
      return (
        <path
          d="M0 30 C-34 8 -34 -16 -16 -24 C-6 -28 0 -20 0 -14 C0 -20 6 -28 16 -24 C34 -16 34 8 0 30 Z"
          fill={fill}
          stroke={dark}
          strokeWidth={3}
        />
      );
    case 'watering-can':
      return (
        <g>
          <path d="M-22 -12 H14 V22 Q14 32 2 32 H-10 Q-22 32 -22 22 Z" fill={fill} />
          <path d="M-16 0 L-38 -20 L-32 -28 L-8 -10 Z" fill={light} />
          <path d="M-38 -20 Q-46 -24 -44 -32" fill="none" stroke={dark} strokeWidth={4} strokeLinecap="round" />
          <path d="M-8 -12 Q-4 -34 14 -34 Q28 -34 28 -18" fill="none" stroke={dark} strokeWidth={6} strokeLinecap="round" />
          <rect x={-26} y={-16} width={44} height={8} rx={4} fill={light} />
        </g>
      );
    case 'pancake':
      return (
        <g>
          <ellipse cx={0} cy={18} rx={30} ry={9} fill={dark} />
          <ellipse cx={0} cy={10} rx={30} ry={10} fill={fill} />
          <ellipse cx={0} cy={2} rx={28} ry={9} fill={light} />
          <ellipse cx={0} cy={-6} rx={26} ry={8} fill={fill} />
          <rect x={-8} y={-14} width={16} height={9} rx={3} fill="#FFD86E" transform="rotate(-8 0 -10)" />
          <path d="M-12 -16 Q-2 -24 8 -16" fill="none" stroke={cream} strokeWidth={3} strokeLinecap="round" opacity={0.8} />
        </g>
      );
    case 'racket':
      return (
        <g>
          <ellipse cx={0} cy={-14} rx={24} ry={30} fill={cream} stroke={fill} strokeWidth={7} />
          {[-12, 0, 12].map((x) => (
            <path key={`v${x}`} d={`M${x} -40 V12`} stroke={dark} strokeWidth={1.6} opacity={0.5} />
          ))}
          {[-20, -8, 4].map((y) => (
            <path key={`h${y}`} d={`M-22 ${y} H22`} stroke={dark} strokeWidth={1.6} opacity={0.5} />
          ))}
          <path d="M-4 16 L-7 44 H7 L4 16 Z" fill={fill} />
        </g>
      );
    case 'sparkle':
      return (
        <path
          d="M0 -24 C3 -8 8 -3 24 0 C8 3 3 8 0 24 C-3 8 -8 3 -24 0 C-8 -3 -3 -8 0 -24 Z"
          fill={fill}
        />
      );
    case 'cloud':
      return (
        <g>
          <circle cx={-24} cy={8} r={20} fill={fill} />
          <circle cx={0} cy={-2} r={26} fill={fill} />
          <circle cx={26} cy={10} r={18} fill={fill} />
          <rect x={-30} y={8} width={58} height={20} rx={10} fill={fill} />
          <ellipse cx={-10} cy={0} rx={9} ry={4} fill={light} opacity={0.7} />
        </g>
      );
    case 'orb':
      return (
        <g>
          <circle r={28} fill={fill} />
          <circle r={20} fill={light} opacity={0.55} />
          <circle cx={-8} cy={-9} r={6} fill={cream} opacity={0.9} />
        </g>
      );
    case 'flower-pot':
      return (
        <g>
          <path d="M-24 6 H24 L18 38 H-18 Z" fill={fill} />
          <rect x={-27} y={0} width={54} height={10} rx={4} fill={light} />
          <path d="M-10 0 C-12 -12 -2 -18 0 -28 C2 -18 12 -12 10 0 Z" fill="#6FAF6B" />
        </g>
      );
    case 'rocket':
      return (
        <g>
          <path d="M0 -40 C14 -26 18 -8 14 16 H-14 C-18 -8 -14 -26 0 -40 Z" fill={fill} />
          <circle cx={0} cy={-8} r={9} fill={cream} stroke={dark} strokeWidth={3} />
          <path d="M-14 6 L-28 24 L-14 20 Z" fill={light} />
          <path d="M14 6 L28 24 L14 20 Z" fill={light} />
          <path d="M-8 18 Q0 44 8 18 Z" fill="#FF9B4A" />
          <path d="M-4 18 Q0 34 4 18 Z" fill="#FFD86E" />
        </g>
      );
    case 'note':
      return (
        <g>
          <ellipse cx={-8} cy={18} rx={12} ry={8} fill={fill} transform="rotate(-18 -8 18)" />
          <path d="M4 14 V-28 L22 -20 V-12 L8 -18 V14" fill={fill} />
          <path d="M4 14 V-28" stroke={ink} strokeWidth={2} opacity={0.2} />
        </g>
      );
  }
}

export const ObjectLayer = memo(function ObjectLayer({
  frames,
}: {
  frames: ObjectFrame[];
}) {
  if (frames.length === 0) return null;
  return (
    <g aria-hidden="true">
      {frames.map((frame) => (
        <g
          key={frame.object.id}
          transform={`translate(${frame.x.toFixed(2)} ${frame.y.toFixed(2)}) rotate(${frame.rotation.toFixed(2)}) scale(${frame.scale.toFixed(3)})`}
          opacity={frame.opacity}
        >
          <ObjectShape frame={{ ...frame, fill: frame.fill }} />
        </g>
      ))}
    </g>
  );
});
