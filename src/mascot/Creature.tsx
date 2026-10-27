'use client';

import { useId, type ReactElement } from 'react';
import type { Genome, Pose } from './types';

type Props = {
  genome: Genome;
  pose: Pose;
  /** draw the ground shadow (off for transparent export) */
  shadow?: boolean;
};

// All geometry lives in a 400 x 400 stage with the character's feet at (200, 360).
// The character is built once and every frame only moves parts: no morph-target
// soup, so it stays editable and exports as clean SVG.

const STAGE = 400;
const GROUND = 352;
const SCALE = 1.72;

function armPoints(a: number, e: number, side: -1 | 1, len: number, shoulderX: number, shoulderY: number) {
  const upper = len * 0.54;
  const fore = len * 0.46;
  const ar = (a * Math.PI) / 180;
  const fr = ((a + e) * Math.PI) / 180;
  const ex = shoulderX + side * Math.sin(ar) * upper;
  const ey = shoulderY + Math.cos(ar) * upper;
  const hx = ex + side * Math.sin(fr) * fore;
  const hy = ey + Math.cos(fr) * fore;
  return { upper, fore, ex, ey, hx, hy };
}

export function Creature({ genome, pose, shadow = true }: Props) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const g = genome;
  const p = g.palette;

  const legLen = g.legs.len + 13;
  const bodyW = g.body.w * 1.1;
  const bodyH = g.body.h * 1.06;
  const bodyCY = -(legLen + bodyH * 0.42);
  const bodyTop = bodyCY - bodyH / 2;
  const headH = g.head.h;
  const headW = g.head.w;
  const headCY = bodyTop - headH * 0.15;

  const shoulderY = bodyCY - bodyH * 0.16;
  const shoulderX = bodyW * 0.52;
  const leftArm = armPoints(pose.armL.a + 3, pose.armL.e, -1, g.arms.len, -shoulderX, shoulderY);
  const rightArm = armPoints(pose.armR.a + 3, pose.armR.e, 1, g.arms.len, shoulderX, shoulderY);

  const footGap = bodyW * 0.2;
  const footLiftL = Math.max(0, pose.legL - 3) * 0.55;
  const footLiftR = Math.max(0, pose.legR - 3) * 0.55;
  const footLx = -footGap + pose.shift * 0.25;
  const footRx = footGap + pose.shift * 0.25;

  const hipL = { x: -bodyW * 0.23, y: bodyCY + bodyH * 0.26 };
  const hipR = { x: bodyW * 0.23, y: bodyCY + bodyH * 0.26 };

  // Face coordinates are local to the head group (which is translated by headCY).
  const eyeCY = g.face.eyeY;
  const muzzleY = headH * 0.2;
  const mouthY = headH * (g.face.muzzle ? 0.35 : 0.27);

  const bodyShape = shapePath(g.body.shape, bodyW, bodyH);
  const headShape = shapePath(g.head.shape === 'screen' ? 'box' : g.head.shape, headW, headH);

  const blush = Math.max(0, pose.cheek);

  return (
    <svg
      viewBox={`0 0 ${STAGE} ${STAGE}`}
      className="h-full w-full overflow-visible"
      role="img"
      aria-label={`${g.name}, ${g.concept}`}
    >
      <defs>
        <filter id={`${uid}-shadow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <clipPath id={`${uid}-eyeL`}>
          <ellipse cx={-g.face.eyeGap} cy={eyeCY} rx={g.face.eyeW / 2} ry={g.face.eyeH / 2} />
        </clipPath>
        <clipPath id={`${uid}-eyeR`}>
          <ellipse cx={g.face.eyeGap} cy={eyeCY} rx={g.face.eyeW / 2} ry={g.face.eyeH / 2} />
        </clipPath>
        <clipPath id={`${uid}-body`}>
          <g transform={`translate(0 ${bodyCY})`}>{bodyShape.node}</g>
        </clipPath>
        <clipPath id={`${uid}-badge`}>
          <circle cx={-bodyW * 0.14} cy={bodyCY - 1} r={10.5} />
        </clipPath>
        <linearGradient id={`${uid}-metal`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.furLight} />
          <stop offset="1" stopColor={p.furDark} />
        </linearGradient>
      </defs>

      {/* ground contact. A wide, low-opacity oval reads as weight; a hard ellipse doesn't. */}
      {shadow && (
        <ellipse
          cx={200 + pose.shift * 0.55}
          cy={GROUND + 3}
          rx={bodyW * 0.86 * SCALE * (1 - Math.min(0.28, pose.lift * 0.012))}
          ry={11 * SCALE * (1 - Math.min(0.4, pose.lift * 0.012))}
          fill="#2a1f33"
          opacity={0.16 * (1 - Math.min(0.55, pose.lift * 0.02))}
          filter={`url(#${uid}-shadow)`}
        />
      )}

      <g
        transform={`translate(${200 + pose.shift * 0.55} ${GROUND - pose.lift}) rotate(${pose.lean * 0.5}) scale(${SCALE * pose.sx} ${SCALE * pose.sy})`}
      >
        {/* tail is behind the body and lags it */}
        <Tail type={g.tail.type} size={g.tail.size} color={p.fur} light={p.furLight} angle={pose.tail} x={bodyW * 0.46} y={bodyCY + bodyH * 0.12} />

        {/* wings / gills sit behind everything */}
        {g.extras.wings && <Wings x={bodyW * 0.42} y={bodyCY + bodyH * 0.08} color={p.furLight} dark={p.furDark} angle={pose.earL * 0.4} />}

        {/* legs and feet */}
        <Leg side={-1} hip={hipL} footX={footLx} footLift={footLiftL} color={p.fur} dark={p.furDark} foot={g.legs.foot} width={g.legs.width} />
        <Leg side={1} hip={hipR} footX={footRx} footLift={footLiftR} color={p.fur} dark={p.furDark} foot={g.legs.foot} width={g.legs.width} />

        {/* back arm */}
        <Arm arm={leftArm} width={g.arms.width} hand={g.arms.hand} color={p.fur} light={p.furLight} />

        {/* body */}
        <g transform={`translate(${pose.shift * 0.18} 0)`}>
          <g fill={p.fur} transform={`translate(0 ${bodyCY})`}>{bodyShape.node}</g>
          {g.pattern === 'spots' && <Spots bodyW={bodyW} bodyCY={bodyCY} bodyH={bodyH} color={p.furDark} clip={`${uid}-body`} />}
          {g.pattern === 'stripes' && <Stripes bodyW={bodyW} bodyCY={bodyCY} bodyH={bodyH} color={p.furDark} clip={`${uid}-body`} />}
          {g.body.belly && (
            <ellipse cx={0} cy={bodyCY + bodyH * 0.12} rx={bodyW * 0.29} ry={bodyH * 0.3} fill={p.furLight} opacity={0.85} />
          )}
          <ellipse cx={0} cy={bodyTop + bodyH * 0.92} rx={bodyW * 0.42} ry={bodyH * 0.16} fill={p.furDark} opacity={0.08} />
          <ellipse cx={-bodyW * 0.18} cy={bodyTop + bodyH * 0.2} rx={bodyW * 0.16} ry={bodyH * 0.2} fill="#fff" opacity={0.07} />

          {/* A soft bridge between the legs: without it the stage shows through as a hard white V. */}
          <path
            d={`M ${-bodyW * 0.21} ${bodyCY + bodyH * 0.34} Q 0 ${bodyCY + bodyH * 0.46} ${bodyW * 0.21} ${bodyCY + bodyH * 0.34} L ${bodyW * 0.11} ${-2} Q 0 2 ${-bodyW * 0.11} ${-2} Z`}
            fill={p.fur}
          />
          <Outfit type={g.outfit} bodyW={bodyW} bodyCY={bodyCY} bodyH={bodyH} pose={g.palette} />
          <Logo genome={g} uid={uid} x={-bodyW * 0.14} y={bodyCY - 1} />
        </g>

        {/* feet sit in front of the soft lower-body bridge, so they still read as feet */}
        {g.legs.foot === 'round' && (
          <g>
            {[{ x: footLx, lift: footLiftL }, { x: footRx, lift: footLiftR }].map((f, i) => (
              <g key={i}>
                <ellipse cx={f.x} cy={-3 - f.lift} rx={g.legs.width * 1.02} ry={9.5} fill={p.fur} />
                <ellipse cx={f.x - 2} cy={-5 - f.lift} rx={g.legs.width * 0.52} ry={3.2} fill="#fff" opacity={0.14} />
                <path d={`M ${f.x - g.legs.width * 0.55} ${-3 - f.lift} Q ${f.x} ${1 - f.lift} ${f.x + g.legs.width * 0.55} ${-3 - f.lift}`} fill="none" stroke={p.furDark} strokeWidth={2.2} strokeLinecap="round" opacity={0.22} />
              </g>
            ))}
          </g>
        )}

        {/* front arm, over the body */}
        <Arm arm={rightArm} width={g.arms.width} hand={g.arms.hand} color={p.fur} light={p.furLight} />

        {/* held prop, anchored to the front hand */}
        {g.prop !== 'none' && (
          <g transform={`translate(${rightArm.hx} ${rightArm.hy}) rotate(${pose.propTilt * 0.9 + pose.armR.a * 0.22 + pose.armR.e * 0.08})`}>
            <Prop type={g.prop} palette={p} />
          </g>
        )}

        {/* a soft neck shadow seats the head on the shoulders */}
        <ellipse cx={0} cy={bodyTop + 13} rx={headW * 0.34} ry={9} fill={p.ink} opacity={0.1} />

        {/* head */}
        <g transform={`translate(0 ${headCY}) rotate(${pose.head * 0.7 + pose.yaw * 3}) scale(${1 - Math.min(0.14, Math.abs(pose.yaw) * 0.16)} 1)`}>
          {/* ears behind the head */}
          <Ear type={g.ears.type} side={-1} size={g.ears.size} spread={g.ears.spread} tilt={g.ears.tilt} angle={pose.earL} headW={headW} headH={headH} color={p.fur} dark={p.furDark} light={p.furLight} accent={p.accent} />
          <Ear type={g.ears.type} side={1} size={g.ears.size} spread={g.ears.spread} tilt={g.ears.tilt} angle={pose.earR} headW={headW} headH={headH} color={p.fur} dark={p.furDark} light={p.furLight} accent={p.accent} />

          {g.head.shape === 'cup' && (
            <g>
              <path d={`M ${headW * 0.36} ${-headH * 0.2} C ${headW * 0.74} ${-headH * 0.22} ${headW * 0.74} ${headH * 0.2} ${headW * 0.34} ${headH * 0.18}`} fill="none" stroke={p.furDark} strokeWidth={11} strokeLinecap="round" />
            </g>
          )}
          <g fill={p.fur}>{headShape.node}</g>
          {g.head.shape === 'cup' && (
            <>
              <ellipse cx={0} cy={-headH * 0.46} rx={headW * 0.4} ry={headH * 0.055} fill={p.furLight} />
              <path d={`M ${-headW * 0.34} ${-headH * 0.09} L ${headW * 0.34} ${-headH * 0.09}`} stroke={p.outfit} strokeWidth={7} opacity={0.85} />
            </>
          )}
          {g.head.shape === 'screen' && (
            <g>
              <rect x={-headW * 0.43} y={-headH * 0.36} width={headW * 0.86} height={headH * 0.64} rx={headH * 0.16} fill={p.ink} />
              <rect x={-headW * 0.39} y={-headH * 0.32} width={headW * 0.78} height={headH * 0.06} rx={3} fill={p.accent} opacity={0.28} />
            </g>
          )}

          {g.face.nose === 'none' && g.ears.type === 'none' && g.head.shape === 'wide' && (
            <g fill={p.fur}>
              <circle cx={-g.face.eyeGap} cy={eyeCY - g.face.eyeH * 0.16} r={g.face.eyeW * 0.72} />
              <circle cx={g.face.eyeGap} cy={eyeCY - g.face.eyeH * 0.16} r={g.face.eyeW * 0.72} />
            </g>
          )}
          {g.face.nose === 'beak' && !g.face.muzzle && (
            <g fill={p.furLight} opacity={0.55}>
              <ellipse cx={-g.face.eyeGap} cy={eyeCY + 2} rx={g.face.eyeW * 0.78} ry={g.face.eyeH * 0.84} />
              <ellipse cx={g.face.eyeGap} cy={eyeCY + 2} rx={g.face.eyeW * 0.78} ry={g.face.eyeH * 0.84} />
            </g>
          )}
          {g.pattern === 'blaze' && (
            <path
              d={`M 0 ${-headH * 0.47} C ${headW * 0.13} ${-headH * 0.42} ${headW * 0.12} ${-headH * 0.1} ${headW * 0.075} ${headH * 0.16} C ${headW * 0.05} ${headH * 0.34} ${-headW * 0.05} ${headH * 0.34} ${-headW * 0.075} ${headH * 0.16} C ${-headW * 0.12} ${-headH * 0.1} ${-headW * 0.13} ${-headH * 0.42} 0 ${-headH * 0.47} Z`}
              fill={p.furLight}
              opacity={0.9}
            />
          )}
          {g.pattern === 'mask' && (
            <path
              d={`M ${-headW * 0.48} ${-headH * 0.12} Q 0 ${-headH * 0.24} ${headW * 0.48} ${-headH * 0.12} L ${headW * 0.42} ${headH * 0.05} Q 0 ${headH * 0.12} ${-headW * 0.42} ${headH * 0.05} Z`}
              fill={p.furDark}
              opacity={0.75}
            />
          )}
          {g.pattern === 'spots' && (
            <>
              <circle cx={-headW * 0.34} cy={-headH * 0.27} r={headW * 0.055} fill={p.furDark} opacity={0.2} />
              <circle cx={headW * 0.29} cy={-headH * 0.34} r={headW * 0.04} fill={p.furDark} opacity={0.2} />
              <circle cx={headW * 0.18} cy={-headH * 0.43} r={headW * 0.03} fill={p.furDark} opacity={0.18} />
            </>
          )}
          {g.pattern === 'stripes' && (
            <>
              <path d={`M ${-headW * 0.16} ${-headH * 0.47} Q ${-headW * 0.1} ${-headH * 0.36} ${-headW * 0.14} ${-headH * 0.3}`} stroke={p.furDark} strokeWidth={5} strokeLinecap="round" fill="none" opacity={0.35} />
              <path d={`M 0 ${-headH * 0.49} Q ${headW * 0.02} ${-headH * 0.38} ${-headW * 0.02} ${-headH * 0.32}`} stroke={p.furDark} strokeWidth={5} strokeLinecap="round" fill="none" opacity={0.35} />
              <path d={`M ${headW * 0.16} ${-headH * 0.47} Q ${headW * 0.1} ${-headH * 0.36} ${headW * 0.14} ${-headH * 0.3}`} stroke={p.furDark} strokeWidth={5} strokeLinecap="round" fill="none" opacity={0.35} />
            </>
          )}

          {g.extras.gills && <Gills color={p.blush} />}
          {g.extras.horn && <Horn color={p.accentSoft} dark={p.furDark} />}
          {g.extras.leaf && <Sprout color={p.accent} dark={p.outfitDark} />}
          {g.extras.flame && <Flame small />}

          {/* cowlick: one asymmetric curve is worth ten details */}
          <path
            d={`M ${-headW * 0.06} ${-headH * 0.46} C ${-headW * 0.03} ${-headH * 0.59} ${headW * 0.08} ${-headH * 0.61} ${headW * 0.11} ${-headH * 0.53} C ${headW * 0.06} ${-headH * 0.55} ${headW * 0.02} ${-headH * 0.52} ${-headW * 0.01} ${-headH * 0.45} Z`}
            fill={p.furDark}
            opacity={0.55}
          />

          {/* muzzle and face */}
          {g.face.muzzle && (
            <ellipse cx={0} cy={muzzleY} rx={headW * 0.3} ry={headH * 0.215} fill={p.furLight} />
          )}

          <Eye side={-1} genome={g} pose={pose} eyeCY={eyeCY} uid={`${uid}-eyeL`} />
          <Eye side={1} genome={g} pose={pose} eyeCY={eyeCY} uid={`${uid}-eyeR`} />

          {g.face.brows !== 'none' && (
            <>
              <Brow side={-1} y={eyeCY - g.face.eyeH * 0.72} value={pose.brow} color={p.furDark} gap={g.face.eyeGap} w={g.face.eyeW} bold={g.face.brows === 'bold'} />
              <Brow side={1} y={eyeCY - g.face.eyeH * 0.72} value={pose.brow} color={p.furDark} gap={g.face.eyeGap} w={g.face.eyeW} bold={g.face.brows === 'bold'} />
            </>
          )}

          <Nose type={g.face.nose} y={muzzleY + headH * 0.03} open={pose.mouth} color={p.ink} accent={p.accent} />
          {g.face.nose !== 'beak' && <Mouth type={g.face.mouth} y={mouthY} open={pose.mouth} color={g.head.shape === 'screen' ? p.accent : p.ink} tongue={p.blush} width={headW} />}

          {g.face.whiskers && <Whiskers y={muzzleY + 2} color={p.ink} />}
          {g.face.freckles && <Freckles y={eyeCY + headH * 0.1} color={p.furDark} />}

          {/* blush lives under the eyes, never on the eye line */}
          {g.face.blush > 0 && (
            <>
              <ellipse cx={-headW * 0.31} cy={eyeCY + g.face.eyeH * 0.64} rx={10.5} ry={5.6} fill={p.blush} opacity={(0.28 + blush * 0.5) * g.face.blush} />
              <ellipse cx={headW * 0.31} cy={eyeCY + g.face.eyeH * 0.64} rx={10.5} ry={5.6} fill={p.blush} opacity={(0.28 + blush * 0.5) * g.face.blush} />
            </>
          )}

          <Accessory type={g.accessory} genome={g} headW={headW} headH={headH} eyeCY={eyeCY} />
        </g>
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// geometry helpers

function shapePath(shape: Genome['head']['shape'] | Genome['body']['shape'], w: number, h: number): { node: ReactElement } {
  const rx = w / 2;
  const ry = h / 2;
  switch (shape) {
    case 'pear':
      return {
        node: (
          <path
            d={`M 0 ${-ry} C ${rx * 0.78} ${-ry} ${rx * 0.9} ${-ry * 0.12} ${rx} ${ry * 0.3} C ${rx * 1.06} ${ry * 0.86} ${rx * 0.58} ${ry} 0 ${ry} C ${-rx * 0.58} ${ry} ${-rx * 1.06} ${ry * 0.86} ${-rx} ${ry * 0.3} C ${-rx * 0.9} ${-ry * 0.12} ${-rx * 0.78} ${-ry} 0 ${-ry} Z`}
          />
        ),
      };
    case 'egg':
      return { node: <ellipse cx={0} cy={0} rx={rx * 0.94} ry={ry * 1.04} /> };
    case 'wide':
      return { node: <ellipse cx={0} cy={0} rx={rx * 1.06} ry={ry * 0.95} /> };
    case 'tomb':
      return { node: <rect x={-rx} y={-ry} width={w} height={h} rx={ry * 0.8} /> };
    case 'box':
    case 'screen':
      return { node: <rect x={-rx} y={-ry} width={w} height={h} rx={w * 0.23} /> };
    case 'blob': {
      const d = `M ${-rx} ${0} C ${-rx} ${-ry * 1.12} ${-rx * 0.55} ${-ry * 1.18} ${-rx * 0.2} ${-ry * 1.02} C ${rx * 0.1} ${-ry * 0.9} ${rx * 0.36} ${-ry * 1.2} ${rx * 0.72} ${-ry * 0.95} C ${rx * 1.1} ${-ry * 0.68} ${rx * 1.06} ${-ry * 0.1} ${rx * 0.92} ${ry * 0.38} C ${rx * 0.78} ${ry * 0.9} ${rx * 0.3} ${ry * 1.12} ${-rx * 0.18} ${ry * 1.02} C ${-rx * 0.62} ${ry * 0.94} ${-rx * 1.04} ${ry * 0.62} ${-rx} ${0} Z`;
      return { node: <path d={d} /> };
    }
    case 'cup':
      return {
        node: (
          <path
            d={`M ${-rx * 0.82} ${-ry} L ${rx * 0.82} ${-ry} L ${rx * 0.64} ${ry * 0.88} Q ${rx * 0.6} ${ry} ${rx * 0.42} ${ry} L ${-rx * 0.42} ${ry} Q ${-rx * 0.6} ${ry} ${-rx * 0.64} ${ry * 0.88} Z`}
          />
        ),
      };
    case 'round':
    default:
      return { node: <ellipse cx={0} cy={0} rx={rx} ry={ry} /> };
  }
}

// ---------------------------------------------------------------------------
// parts

function Ear(props: {
  type: Genome['ears']['type'];
  side: -1 | 1;
  size: number;
  spread: number;
  tilt: number;
  angle: number;
  headW: number;
  headH: number;
  color: string;
  dark: string;
  light: string;
  accent: string;
}) {
  const { type, side, size, spread, tilt, angle, headW, headH, color, dark, light, accent } = props;
  const x = side * (headW * 0.32 + spread * 0.22);
  const y = -headH * 0.34;
  const t = `translate(${x} ${y}) rotate(${side * (tilt + angle)} ${-side * 6} ${headH * 0.12})`;

  if (type === 'none') return null;

  if (type === 'round') {
    return (
      <g transform={t}>
        <circle cx={side * size * 0.15} cy={-size * 0.35} r={size} fill={color} />
        <circle cx={side * size * 0.12} cy={-size * 0.32} r={size * 0.56} fill={light} opacity={0.9} />
      </g>
    );
  }
  if (type === 'pointy') {
    return (
      <g transform={t}>
        <path d={`M ${-size * 0.72} ${size * 0.28} Q ${-size * 0.3} ${-size * 0.5} 0 ${-size * 1.42} Q ${size * 0.34} ${-size * 0.45} ${size * 0.72} ${size * 0.28} Q 0 ${size * 0.52} ${-size * 0.72} ${size * 0.28} Z`} fill={color} />
        <path d={`M ${-size * 0.32} ${size * 0.18} Q ${-size * 0.12} ${-size * 0.35} 0 ${-size * 0.92} Q ${size * 0.14} ${-size * 0.32} ${size * 0.32} ${size * 0.18} Q 0 ${size * 0.32} ${-size * 0.32} ${size * 0.18} Z`} fill={light} opacity={0.7} />
      </g>
    );
  }
  if (type === 'long') {
    return (
      <g transform={t}>
        <ellipse cx={side * size * 0.18} cy={-size * 0.55} rx={size * 0.26} ry={size * 0.95} fill={color} transform={`rotate(${side * 7} ${side * size * 0.18} ${-size * 0.55})`} />
        <ellipse cx={side * size * 0.2} cy={-size * 0.52} rx={size * 0.12} ry={size * 0.68} fill={light} opacity={0.85} transform={`rotate(${side * 7} ${side * size * 0.2} ${-size * 0.52})`} />
      </g>
    );
  }
  if (type === 'floppy') {
    return (
      <g transform={t}>
        <path d={`M ${-size * 0.3} 0 Q ${side * size * 0.9} ${size * 0.2} ${side * size * 0.58} ${size * 1.15} Q ${side * size * 0.15} ${size * 1.45} ${-size * 0.3} ${size * 0.9} Z`} fill={color} />
        <path d={`M ${-size * 0.12} ${size * 0.18} Q ${side * size * 0.52} ${size * 0.35} ${side * size * 0.36} ${size * 0.95} Q ${side * size * 0.12} ${size * 1.05} ${-size * 0.12} ${size * 0.7} Z`} fill={light} opacity={0.7} />
      </g>
    );
  }
  if (type === 'tuft') {
    return (
      <g transform={t}>
        <path d={`M ${-size * 0.6} ${size * 0.2} Q ${side * size * 0.1} ${-size * 0.9} ${side * size * 0.5} ${-size * 0.1} Q ${side * size * 0.1} ${-size * 0.2} ${size * 0.3} ${size * 0.25} Z`} fill={color} />
      </g>
    );
  }
  if (type === 'antenna') {
    return (
      <g transform={t}>
        <path d={`M 0 ${size * 0.1} Q ${side * size * 0.55} ${-size * 0.9} ${side * size * 0.16} ${-size * 1.5}`} fill="none" stroke={dark} strokeWidth={4} strokeLinecap="round" />
        <circle cx={side * size * 0.16} cy={-size * 1.55} r={size * 0.34} fill={accent} />
        <circle cx={side * size * 0.16 - 1.5} cy={-size * 1.62} r={size * 0.1} fill="#fff" opacity={0.7} />
      </g>
    );
  }
  return null;
}

function Eye({ side, genome, pose, eyeCY, uid }: { side: -1 | 1; genome: Genome; pose: Pose; eyeCY: number; uid: string }) {
  const g = genome;
  const p = g.palette;
  const cx = side * g.face.eyeGap;
  const lid = side === -1 ? pose.lid : pose.lidR;
  const eyeW = g.face.eyeW;
  const eyeH = g.face.eyeH;
  const top = eyeCY - eyeH / 2;

  if (g.head.shape === 'screen') {
    // A robot gets a screen visor, still with parallax pupils.
    return (
      <g>
        <rect x={cx - eyeW / 2} y={top} width={eyeW} height={eyeH} rx={7} fill={p.accent} opacity={0.16} />
        <rect
          x={cx - eyeW / 2 + 4 + pose.gazeX * 0.6}
          y={top + 4 + pose.gazeY * 0.5}
          width={eyeW - 8}
          height={Math.max(2, (eyeH - 8) * (1 - lid))}
          rx={4}
          fill={p.accent}
        />
        <rect x={cx - eyeW * 0.22} y={top + 5} width={eyeW * 0.16} height={3} rx={1.5} fill="#fff" opacity={0.8} />
      </g>
    );
  }

  const pupil = g.face.pupil;
  const px = cx + pose.gazeX * 0.82;
  const py = eyeCY + pose.gazeY * 0.7;

  return (
    <g>
      <ellipse cx={cx} cy={eyeCY} rx={eyeW / 2} ry={eyeH / 2} fill={p.white} />
      <g clipPath={`url(#${uid})`}>
        <ellipse cx={px} cy={py} rx={pupil * 0.56} ry={eyeH * 0.36} fill={p.ink} />
        {g.face.shine > 0 && <circle cx={px - pupil * 0.16} cy={py - eyeH * 0.14} r={g.face.shine} fill="#fff" opacity={0.92} />}
        {g.face.shine > 0 && <circle cx={px + pupil * 0.13} cy={py + eyeH * 0.13} r={g.face.shine * 0.48} fill="#fff" opacity={0.5} />}
        {/* lid: a fur-coloured cover scaled by the blink / squint value */}
        <rect x={cx - eyeW} y={top - 1} width={eyeW * 2} height={eyeH * lid + 1} fill={p.fur} />
        {lid > 0.06 && (
          <path
            d={`M ${cx - eyeW / 2} ${top + eyeH * lid} Q ${cx} ${top + eyeH * lid + 2.4} ${cx + eyeW / 2} ${top + eyeH * lid}`}
            fill="none"
            stroke={p.ink}
            strokeWidth={2.1}
            strokeLinecap="round"
            opacity={0.8}
          />
        )}
      </g>
      {g.face.lashes && (
        <path
          d={`M ${cx + side * eyeW * 0.42} ${top + 3} l ${side * 4} ${-4} M ${cx + side * eyeW * 0.5} ${top + 9} l ${side * 4.6} ${-2.4}`}
          stroke={p.ink}
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
          opacity={0.75}
        />
      )}
    </g>
  );
}

function Brow({ side, y, value, color, gap, w, bold }: { side: -1 | 1; y: number; value: number; color: string; gap: number; w: number; bold: boolean }) {
  const cx = side * gap;
  const tilt = side * value * 4.2;
  return (
    <path
      d={`M ${cx - side * w * 0.28} ${y + tilt * 0.4} Q ${cx} ${y - 2 + tilt * 0.1} ${cx + side * w * 0.28} ${y + tilt}`}
      fill="none"
      stroke={color}
      strokeWidth={bold ? 3.8 : 2.6}
      strokeLinecap="round"
      opacity={0.62}
    />
  );
}

function Nose({ type, y, open, color, accent }: { type: Genome['face']['nose']; y: number; open: number; color: string; accent: string }) {
  if (type === 'none') return null;
  if (type === 'oval') return <ellipse cx={0} cy={y} rx={8.4} ry={5.8} fill={color} />;
  if (type === 'triangle') {
    return <path d={`M -9 ${y - 3} Q 0 ${y - 6} 9 ${y - 3} Q 2 ${y + 7} 0 ${y + 8.5} Q -2 ${y + 7} -9 ${y - 3} Z`} fill={color} />;
  }
  if (type === 'beak') {
    const k = Math.max(0, (open - 10) / 14);
    return (
      <g>
        <path d={`M -13 ${y - 5} Q 0 ${y - 15} 13 ${y - 5} L 1 ${y + 3} L -1 ${y + 3} Z`} fill={accent} />
        <path d={`M -9 ${y + 2} L 0 ${y + 3} L 9 ${y + 2} Q 4 ${y + 10 + k * 7} 0 ${y + 13 + k * 7} Q -4 ${y + 10 + k * 7} -9 ${y + 2} Z`} fill={accent} opacity={0.86} />
      </g>
    );
  }
  return <rect x={-11} y={y - 5.5} width={22} height={12} rx={6} fill={color} />;
}

function Mouth({ type, y, open, color, tongue, width }: { type: Genome['face']['mouth']; y: number; open: number; color: string; tongue: string; width: number }) {
  const mw = width * 0.08 + open * 0.115;
  const openK = Math.max(0, (open - 12) / 13);
  if (type === 'cat') {
    return (
      <g>
        <path d={`M ${-mw} ${y} Q ${-mw * 0.5} ${y + 4.5 + openK * 5} 0 ${y} Q ${mw * 0.5} ${y + 4.5 + openK * 5} ${mw} ${y}`} fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
      </g>
    );
  }
  if (type === 'wide' || openK > 0.14) {
    const h = 3.5 + openK * 8.5;
    return (
      <g>
        <path d={`M ${-mw} ${y - 1} Q 0 ${y - 4} ${mw} ${y - 1} Q ${mw * 0.8} ${y + h} 0 ${y + h} Q ${-mw * 0.8} ${y + h} ${-mw} ${y - 1} Z`} fill={color} />
        {openK > 0.18 && <ellipse cx={0} cy={y + h * 0.86} rx={mw * 0.58} ry={h * 0.34} fill={tongue} />}
        {openK > 0.62 && <rect x={-mw * 0.22} y={y - 0.6} width={mw * 0.44} height={2.8} rx={1.2} fill="#fffdf8" opacity={0.92} />}
      </g>
    );
  }
  return (
    <path
      d={`M ${-mw} ${y - 1} Q 0 ${y + 4 + openK * 10} ${mw} ${y - 1}`}
      fill="none"
      stroke={color}
      strokeWidth={2.6}
      strokeLinecap="round"
    />
  );
}

function Whiskers({ y, color }: { y: number; color: string }) {
  return (
    <g stroke={color} strokeWidth={1.7} strokeLinecap="round" opacity={0.45} fill="none">
      <path d={`M -24 ${y} L -40 ${y - 3}`} />
      <path d={`M -24 ${y + 4} L -39 ${y + 7}`} />
      <path d={`M 24 ${y} L 40 ${y - 3}`} />
      <path d={`M 24 ${y + 4} L 39 ${y + 7}`} />
    </g>
  );
}

function Freckles({ y, color }: { y: number; color: string }) {
  return (
    <g fill={color} opacity={0.55}>
      {[
        [-26, 0],
        [-20, 4],
        [-30, 5],
        [26, 0],
        [20, 4],
        [30, 5],
      ].map(([x, dy], i) => (
        <circle key={i} cx={x} cy={y + dy} r={1.7} />
      ))}
    </g>
  );
}

function Tail({ type, size, color, light, angle, x, y }: { type: Genome['tail']['type']; size: number; color: string; light: string; angle: number; x: number; y: number }) {
  if (type === 'none') return null;
  const rot = angle * 0.9 - 18;
  if (type === 'stub') {
    return <circle cx={x + 6} cy={y + 2} r={size * 0.8} fill={color} transform={`rotate(${rot} ${x} ${y})`} />;
  }
  if (type === 'puff') {
    return (
      <g transform={`rotate(${rot} ${x} ${y})`}>
        <circle cx={x + size * 0.55} cy={y - size * 0.2} r={size * 0.95} fill={light} />
        <circle cx={x + size * 0.3} cy={y + size * 0.2} r={size * 0.6} fill={light} />
      </g>
    );
  }
  if (type === 'bushy') {
    return (
      <g transform={`rotate(${rot} ${x} ${y})`}>
        <path d={`M ${x - 4} ${y} C ${x + size * 0.9} ${y - size * 0.2} ${x + size * 1.5} ${y - size * 1.2} ${x + size * 1.1} ${y - size * 1.9} C ${x + size * 0.7} ${y - size * 1.25} ${x + size * 0.2} ${y - size * 0.9} ${x - 4} ${y} Z`} fill={color} />
        <path d={`M ${x + size * 0.5} ${y - size * 0.38} C ${x + size * 1.0} ${y - size * 0.55} ${x + size * 1.2} ${y - size * 1.2} ${x + size * 1.05} ${y - size * 1.55} C ${x + size * 0.85} ${y - size * 0.95} ${x + size * 0.5} ${y - size * 0.7} ${x + size * 0.5} ${y - size * 0.38} Z`} fill={light} opacity={0.95} />
      </g>
    );
  }
  if (type === 'thin') {
    return <path d={`M ${x - 2} ${y} Q ${x + size * 1.1} ${y + 4} ${x + size * 1.5} ${y - size * 0.7} Q ${x + size * 1.75} ${y - size * 1.2} ${x + size * 1.35} ${y - size * 1.35}`} fill="none" stroke={color} strokeWidth={7} strokeLinecap="round" transform={`rotate(${rot} ${x} ${y})`} />;
  }
  return (
    <path
      d={`M ${x} ${y} C ${x + size} ${y - size * 0.2} ${x + size * 1.2} ${y - size * 0.9} ${x + size * 0.75} ${y - size * 1.15} C ${x + size * 1.1} ${y - size * 0.7} ${x + size * 0.55} ${y - size * 0.4} ${x} ${y} Z`}
      fill={color}
    />
  );
}

function Leg({ hip, footX, footLift, color, dark, foot, width }: { side: -1 | 1; hip: { x: number; y: number }; footX: number; footLift: number; color: string; dark: string; foot: Genome['legs']['foot']; width: number }) {
  if (foot === 'hover') {
    return <ellipse cx={hip.x} cy={4} rx={width * 0.8} ry={4} fill={dark} opacity={0.25} />;
  }
  const fy = -footLift - 4;
  const d = `M ${hip.x} ${hip.y} Q ${hip.x + (footX - hip.x) * 0.3} ${(hip.y + fy) / 2} ${footX} ${fy}`;
  return (
    <g>
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" />
      <ellipse cx={footX} cy={fy - 2} rx={width * 0.52} ry={3.2} fill="#fff" opacity={0.12} />
      {foot === 'round' && <ellipse cx={footX} cy={fy + 1} rx={width * 1.18} ry={10.5} fill={color} />}
      {foot === 'round' && <ellipse cx={footX - 2} cy={fy - 0.5} rx={width * 0.55} ry={4} fill={dark} opacity={0.14} />}
      {foot === 'long' && <ellipse cx={footX} cy={fy + 2} rx={width * 1.25} ry={8} fill={color} />}
      {foot === 'webbed' && (
        <path d={`M ${footX - width * 1.1} ${fy + 5} Q ${footX} ${fy - 5} ${footX + width * 1.1} ${fy + 5} Q ${footX} ${fy + 9} ${footX - width * 1.1} ${fy + 5} Z`} fill={color} />
      )}
      {foot === 'talon' && (
        <g fill={color}>
          <ellipse cx={footX - 6} cy={fy + 3} rx={4} ry={6} transform={`rotate(-18 ${footX - 6} ${fy + 3})`} />
          <ellipse cx={footX + 1} cy={fy + 4} rx={4} ry={6} />
          <ellipse cx={footX + 7} cy={fy + 3} rx={4} ry={6} transform={`rotate(18 ${footX + 7} ${fy + 3})`} />
        </g>
      )}
    </g>
  );
}

function Arm({ arm, width, hand, color, light }: { arm: ReturnType<typeof armPoints>; width: number; hand: number; color: string; light: string }) {
  return (
    <g>
      <path d={`M 0 0 L ${arm.ex} ${arm.ey}`} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" />
      <path d={`M ${arm.ex} ${arm.ey} L ${arm.hx} ${arm.hy}`} fill="none" stroke={color} strokeWidth={width * 0.86} strokeLinecap="round" />
      <circle cx={arm.hx} cy={arm.hy} r={hand * 0.92} fill={light} />
      <circle cx={arm.hx - hand * 0.22} cy={arm.hy - hand * 0.3} r={hand * 0.32} fill="#fff" opacity={0.2} />
    </g>
  );
}

function Wings({ x, y, color, dark, angle }: { x: number; y: number; color: string; dark: string; angle: number }) {
  return (
    <g>
      {[-1, 1].map((s) => (
        <g key={s}>
          <path d={`M ${s * x} ${y} C ${s * (x + 34)} ${y - 42 - angle} ${s * (x + 48)} ${y + 2} ${s * (x + 6)} ${y + 12} Z`} fill={color} stroke={dark} strokeWidth={1.5} opacity={0.95} />
          <path d={`M ${s * (x - 1)} ${y + 6} C ${s * (x + 22)} ${y - 20 - angle * 0.5} ${s * (x + 34)} ${y + 4} ${s * (x + 2)} ${y + 13} Z`} fill={color} stroke={dark} strokeWidth={1.4} opacity={0.8} />
        </g>
      ))}
    </g>
  );
}

function Gills({ color }: { color: string }) {
  return (
    <g fill={color} opacity={0.9}>
      {[-1, 1].map((s) =>
        [-12, 0, 12].map((dy, i) => (
          <path key={`${s}-${i}`} d={`M ${s * 44} ${-8 + dy} Q ${s * 66} ${-18 + dy} ${s * 62} ${2 + dy} Q ${s * 52} ${-2 + dy} ${s * 44} ${-8 + dy} Z`} transform={`rotate(${s * (i * 8 - 8)} ${s * 44} ${dy})`} />
        )),
      )}
    </g>
  );
}

function Horn({ color, dark }: { color: string; dark: string }) {
  return (
    <g transform="translate(0 -52)">
      <path d="M -8 6 Q -3 -14 2 -18 Q 6 -8 8 5 Q 0 10 -8 6 Z" fill={color} />
      <path d="M -1 4 Q 1 -8 2 -16" stroke={dark} strokeWidth={1.6} opacity={0.3} fill="none" />
    </g>
  );
}

function Sprout({ color, dark }: { color: string; dark: string }) {
  return (
    <g transform="translate(6 -54) rotate(8)">
      <path d="M 0 8 Q 0 -2 0 -6" stroke={dark} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <path d="M 0 -7 C -10 -14 -16 -7 -10 0 C -5 4 -1 1 0 -7 Z" fill={color} />
      <path d="M 0 -7 C 10 -16 16 -8 11 -1 C 6 3 1 1 0 -7 Z" fill={color} opacity={0.85} />
    </g>
  );
}

function Flame({ small = false }: { small?: boolean }) {
  const k = small ? 0.6 : 1;
  return (
    <g transform={`translate(0 ${-56 * k}) scale(${k})`}>
      <path d="M 0 10 C -12 6 -10 -4 -2 -12 C -2 -6 2 -6 4 -13 C 10 -5 12 4 0 10 Z" fill="#F4A340" />
      <path d="M 0 8 C -5 5 -5 0 -1 -5 C 0 -1 3 0 3 -6 C 7 0 6 5 0 8 Z" fill="#FFD166" />
    </g>
  );
}

function Spots({ bodyW, bodyCY, bodyH, color, clip }: { bodyW: number; bodyCY: number; bodyH: number; color: string; clip: string }) {
  return (
    <g clipPath={`url(#${clip})`} fill={color} opacity={0.16}>
      <circle cx={-bodyW * 0.34} cy={bodyCY - bodyH * 0.16} r={bodyW * 0.07} />
      <circle cx={bodyW * 0.31} cy={bodyCY + bodyH * 0.1} r={bodyW * 0.05} />
      <circle cx={-bodyW * 0.18} cy={bodyCY + bodyH * 0.28} r={bodyW * 0.04} />
      <circle cx={bodyW * 0.12} cy={bodyCY - bodyH * 0.3} r={bodyW * 0.035} />
    </g>
  );
}

function Stripes({ bodyW, bodyCY, bodyH, color, clip }: { bodyW: number; bodyCY: number; bodyH: number; color: string; clip: string }) {
  return (
    <g clipPath={`url(#${clip})`} stroke={color} strokeWidth={6} strokeLinecap="round" fill="none" opacity={0.2}>
      <path d={`M ${-bodyW * 0.4} ${bodyCY - bodyH * 0.2} Q 0 ${bodyCY - bodyH * 0.05} ${bodyW * 0.4} ${bodyCY - bodyH * 0.22}`} />
      <path d={`M ${-bodyW * 0.4} ${bodyCY + bodyH * 0.02} Q 0 ${bodyCY + bodyH * 0.16} ${bodyW * 0.4} ${bodyCY}`} />
    </g>
  );
}

function Outfit({ type, bodyW, bodyCY, bodyH, pose }: { type: Genome['outfit']; bodyW: number; bodyCY: number; bodyH: number; pose: Genome['palette'] }) {
  if (type === 'none') return null;
  const y = bodyCY - bodyH * 0.2;
  if (type === 'scarf') {
    return (
      <g>
        <path d={`M ${-bodyW * 0.33} ${y - 3} Q 0 ${y + 9} ${bodyW * 0.33} ${y - 3} L ${bodyW * 0.34} ${y + 7} Q 0 ${y + 20} ${-bodyW * 0.34} ${y + 7} Z`} fill={pose.outfit} />
        <path d={`M ${bodyW * 0.17} ${y + 8} Q ${bodyW * 0.35} ${y + 26} ${bodyW * 0.24} ${y + 42} L ${bodyW * 0.1} ${y + 37} Q ${bodyW * 0.2} ${y + 24} ${bodyW * 0.07} ${y + 12} Z`} fill={pose.outfitDark} />
        <path d={`M ${-bodyW * 0.33} ${y - 2} Q 0 ${y + 8} ${bodyW * 0.33} ${y - 2}`} stroke={pose.outfitLight} strokeWidth={2.4} fill="none" opacity={0.55} />
      </g>
    );
  }
  if (type === 'apron') {
    return (
      <g>
        <path d={`M ${-bodyW * 0.22} ${bodyCY - bodyH * 0.34} L ${bodyW * 0.22} ${bodyCY - bodyH * 0.34} L ${bodyW * 0.28} ${bodyCY + bodyH * 0.46} Q 0 ${bodyCY + bodyH * 0.53} ${-bodyW * 0.28} ${bodyCY + bodyH * 0.46} Z`} fill={pose.outfitLight} />
        <path d={`M ${-bodyW * 0.15} ${bodyCY + bodyH * 0.02} L ${bodyW * 0.15} ${bodyCY + bodyH * 0.02} L ${bodyW * 0.16} ${bodyCY + bodyH * 0.22} L ${-bodyW * 0.16} ${bodyCY + bodyH * 0.22} Z`} fill={pose.outfit} opacity={0.35} />
        <path d={`M ${-bodyW * 0.22} ${bodyCY - bodyH * 0.34} L ${-bodyW * 0.38} ${bodyCY - bodyH * 0.44} M ${bodyW * 0.22} ${bodyCY - bodyH * 0.34} L ${bodyW * 0.38} ${bodyCY - bodyH * 0.44}`} stroke={pose.outfitLight} strokeWidth={3} />
      </g>
    );
  }
  if (type === 'hoodie') {
    return (
      <g>
        <path d={`M ${-bodyW * 0.44} ${bodyCY - bodyH * 0.3} Q 0 ${bodyCY - bodyH * 0.44} ${bodyW * 0.44} ${bodyCY - bodyH * 0.3} L ${bodyW * 0.46} ${bodyCY + bodyH * 0.42} Q 0 ${bodyCY + bodyH * 0.52} ${-bodyW * 0.46} ${bodyCY + bodyH * 0.42} Z`} fill={pose.outfit} opacity={0.95} />
        <path d={`M ${-bodyW * 0.22} ${bodyCY + bodyH * 0.16} Q 0 ${bodyCY + bodyH * 0.1} ${bodyW * 0.22} ${bodyCY + bodyH * 0.16} L ${bodyW * 0.24} ${bodyCY + bodyH * 0.3} Q 0 ${bodyCY + bodyH * 0.38} ${-bodyW * 0.24} ${bodyCY + bodyH * 0.3} Z`} fill={pose.outfitDark} opacity={0.55} />
        <path d={`M ${-bodyW * 0.09} ${bodyCY - bodyH * 0.28} L ${-bodyW * 0.12} ${bodyCY - bodyH * 0.08} M ${bodyW * 0.09} ${bodyCY - bodyH * 0.28} L ${bodyW * 0.12} ${bodyCY - bodyH * 0.08}`} stroke={pose.outfitLight} strokeWidth={2.2} strokeLinecap="round" />
      </g>
    );
  }
  if (type === 'collar') {
    return (
      <g>
        <path d={`M ${-bodyW * 0.3} ${y - 1} Q 0 ${y + 7} ${bodyW * 0.3} ${y - 1} L ${bodyW * 0.3} ${y + 5} Q 0 ${y + 13} ${-bodyW * 0.3} ${y + 5} Z`} fill={pose.outfit} />
        <path d={`M ${-bodyW * 0.08} ${y + 6} L 0 ${y + 18} L ${bodyW * 0.08} ${y + 6} Z`} fill={pose.outfitLight} />
      </g>
    );
  }
  if (type === 'bowtie') {
    return (
      <g transform={`translate(0 ${y + 4})`}>
        <path d="M -4 0 L -20 -9 L -20 9 Z" fill={pose.outfit} />
        <path d="M 4 0 L 20 -9 L 20 9 Z" fill={pose.outfit} />
        <circle cx={0} cy={0} r={5} fill={pose.outfitDark} />
      </g>
    );
  }
  return null;
}

function markPath(mark: Genome['logo']['mark']) {
  switch (mark) {
    case 'leaf':
      return 'M12 3 C5 4 3 9 4 15 C10 17 18 13 20 5 C17 5 14 4 12 3 Z';
    case 'bolt':
      return 'M13 2 L5 14 L10 14 L8 22 L18 9 L12 9 Z';
    case 'spark':
      return 'M12 2 C13 8 16 11 22 12 C16 13 13 16 12 22 C11 16 8 13 2 12 C8 11 11 8 12 2 Z';
    case 'moon':
      return 'M15 3 C9 4 5 8 5 13 C5 18 9 21 14 21 C17 21 20 19 21 16 C12 18 9 10 15 3 Z';
    case 'heart':
      return 'M12 21 C4 15 2 11 2 8 C2 4 7 2 12 7 C17 2 22 4 22 8 C22 11 20 15 12 21 Z';
    default:
      return 'M4 6 C4 3 8 2 12 4 C16 2 20 4 20 8 C20 12 18 18 12 21 C6 18 4 12 4 6 Z';
  }
}

function Logo({ genome, uid, x, y }: { genome: Genome; uid: string; x: number; y: number }) {
  if (genome.logo.image) {
    return (
      <g>
        <circle cx={x} cy={y} r={12} fill={genome.palette.white} />
        <image href={genome.logo.image} x={x - 11} y={y - 11} width={22} height={22} clipPath={`url(#${uid}-badge)`} preserveAspectRatio="xMidYMid slice" />
      </g>
    );
  }
  return (
    <g transform={`translate(${x} ${y}) scale(0.7) translate(-12 -12)`} opacity={0.9}>
      <circle cx={12} cy={12} r={13} fill={genome.palette.accent} />
      {genome.logo.mark === 'initial' ? (
        <text x={12} y={17} textAnchor="middle" fontSize={15} fontWeight={700} fill={genome.palette.ink} fontFamily="ui-rounded, system-ui">
          {genome.logo.initial}
        </text>
      ) : (
        <path d={markPath(genome.logo.mark)} fill={genome.palette.ink} transform="scale(0.72) translate(4.7 4.7)" />
      )}
    </g>
  );
}

function Accessory({ type, genome, headW, headH, eyeCY }: { type: Genome['accessory']; genome: Genome; headW: number; headH: number; eyeCY: number }) {
  const p = genome.palette;
  if (type === 'none') return null;
  if (type === 'beanie') {
    return (
      <g>
        <path d={`M ${-headW * 0.48} ${-headH * 0.2} Q ${-headW * 0.5} ${-headH * 0.72} 0 ${-headH * 0.74} Q ${headW * 0.5} ${-headH * 0.72} ${headW * 0.48} ${-headH * 0.2} Q 0 ${-headH * 0.1} ${-headW * 0.48} ${-headH * 0.2} Z`} fill={p.outfit} />
        <path d={`M ${-headW * 0.5} ${-headH * 0.28} Q 0 ${-headH * 0.16} ${headW * 0.5} ${-headH * 0.28} L ${headW * 0.49} ${-headH * 0.15} Q 0 ${-headH * 0.04} ${-headW * 0.49} ${-headH * 0.15} Z`} fill={p.outfitLight} />
        <circle cx={0} cy={-headH * 0.8} r={headW * 0.07} fill={p.outfitLight} />
      </g>
    );
  }
  if (type === 'cap') {
    return (
      <g>
        <path d={`M ${-headW * 0.46} ${-headH * 0.28} Q ${-headW * 0.42} ${-headH * 0.72} 0 ${-headH * 0.73} Q ${headW * 0.42} ${-headH * 0.72} ${headW * 0.46} ${-headH * 0.28} Z`} fill={p.accent} />
        <path d={`M ${headW * 0.1} ${-headH * 0.29} Q ${headW * 0.62} ${-headH * 0.3} ${headW * 0.7} ${-headH * 0.2} Q ${headW * 0.4} ${-headH * 0.1} ${headW * 0.02} ${-headH * 0.19} Z`} fill={p.accentSoft} />
        <circle cx={0} cy={-headH * 0.75} r={headW * 0.045} fill={p.accentSoft} />
      </g>
    );
  }
  if (type === 'glasses') {
    const y = eyeCY;
    return (
      <g fill="none" stroke={p.ink} strokeWidth={2.6} opacity={0.85}>
        <circle cx={-genome.face.eyeGap} cy={y} r={genome.face.eyeW * 0.62} />
        <circle cx={genome.face.eyeGap} cy={y} r={genome.face.eyeW * 0.62} />
        <path d={`M ${-genome.face.eyeGap + genome.face.eyeW * 0.62} ${y} Q 0 ${y - 4} ${genome.face.eyeGap - genome.face.eyeW * 0.62} ${y}`} />
        <path d={`M ${-genome.face.eyeGap - genome.face.eyeW * 0.62} ${y - 2} L ${-headW * 0.5} ${y - 6} M ${genome.face.eyeGap + genome.face.eyeW * 0.62} ${y - 2} L ${headW * 0.5} ${y - 6}`} />
      </g>
    );
  }
  if (type === 'headphones') {
    return (
      <g>
        <path d={`M ${-headW * 0.48} ${-headH * 0.08} Q ${-headW * 0.52} ${-headH * 0.7} 0 ${-headH * 0.78} Q ${headW * 0.52} ${-headH * 0.7} ${headW * 0.48} ${-headH * 0.08}`} fill="none" stroke={p.outfitDark} strokeWidth={7} strokeLinecap="round" />
        <rect x={-headW * 0.56} y={-headH * 0.16} width={12} height={headH * 0.3} rx={6} fill={p.outfit} />
        <rect x={headW * 0.56 - 12} y={-headH * 0.16} width={12} height={headH * 0.3} rx={6} fill={p.outfit} />
      </g>
    );
  }
  if (type === 'flower') {
    return (
      <g transform={`translate(${-headW * 0.36} ${-headH * 0.34}) rotate(-12)`}>
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse key={a} cx={0} cy={-7} rx={4.6} ry={7.2} fill={p.blush} transform={`rotate(${a})`} />
        ))}
        <circle cx={0} cy={0} r={4} fill={p.accent} />
      </g>
    );
  }
  if (type === 'crown') {
    return (
      <g transform={`translate(0 ${-headH * 0.48})`}>
        <path d="M -18 0 L -20 -14 L -8 -7 L 0 -19 L 8 -7 L 20 -14 L 18 0 Z" fill={p.accent} />
        <circle cx={0} cy={-6} r={2.6} fill={p.accentSoft} />
        <circle cx={-14} cy={-5} r={2} fill={p.accentSoft} />
        <circle cx={14} cy={-5} r={2} fill={p.accentSoft} />
      </g>
    );
  }
  if (type === 'badge') {
    return (
      <g transform={`translate(${headW * 0.3} ${headH * 0.3})`}>
        <circle cx={0} cy={0} r={9} fill={p.accent} />
        <path d="M -3 0 L 0 -3 L 3 0 L 0 3 Z" fill={p.ink} />
      </g>
    );
  }
  return null;
}

function Prop({ type, palette }: { type: Genome['prop']; palette: Genome['palette'] }) {
  const p = palette;
  if (type === 'cup') {
    return (
      <g transform="translate(0 -6)">
        <path d="M -11 -10 L 11 -10 L 8 12 Q 8 15 4 15 L -4 15 Q -8 15 -8 12 Z" fill={p.white} />
        <path d="M 10 -5 Q 20 -2 18 5 Q 16 10 9 8" fill="none" stroke={p.white} strokeWidth={4} />
        <path d="M -9 -6 L 9 -6 L 7 4 L -7 4 Z" fill={p.outfit} opacity={0.9} />
        <ellipse cx={0} cy={-10} rx={11} ry={3.6} fill={p.outfitDark} />
        <g stroke={p.white} strokeWidth={2.4} fill="none" strokeLinecap="round" opacity={0.85}>
          <path d="M -4 -18 Q -7 -23 -4 -27" />
          <path d="M 3 -18 Q 0 -23 3 -27" />
        </g>
      </g>
    );
  }
  if (type === 'laptop') {
    return (
      <g transform="translate(0 -4)">
        <rect x={-17} y={-16} width={34} height={24} rx={3} fill={p.ink} />
        <rect x={-14} y={-13} width={28} height={18} rx={2} fill={p.accentSoft} />
        <path d="M -21 8 L 21 8 L 19 13 L -19 13 Z" fill={p.furDark} />
      </g>
    );
  }
  if (type === 'phone') {
    return (
      <g transform="translate(0 -8)">
        <rect x={-9} y={-17} width={18} height={32} rx={4} fill={p.ink} />
        <rect x={-6.5} y={-13} width={13} height={22} rx={2} fill={p.accentSoft} />
      </g>
    );
  }
  if (type === 'package') {
    return (
      <g transform="translate(0 -10)">
        <rect x={-14} y={-14} width={28} height={26} rx={3} fill={p.accent} />
        <path d="M 0 -14 L 0 12 M -14 -3 L 14 -3" stroke={p.outfit} strokeWidth={2.5} opacity={0.45} />
        <path d="M -5 -14 L -5 -3 L 5 -3 L 5 -14" fill={p.outfitLight} opacity={0.5} />
      </g>
    );
  }
  if (type === 'plant') {
    return (
      <g transform="translate(0 -8)">
        <path d="M -11 0 L 11 0 L 8 15 L -8 15 Z" fill={p.outfit} />
        <path d="M 0 0 Q -2 -18 -12 -23 Q 4 -20 2 -2 Z" fill={p.accent} />
        <path d="M 0 0 Q 4 -20 16 -22 Q 3 -13 3 0 Z" fill={p.accentSoft} />
      </g>
    );
  }
  if (type === 'star') {
    return <path d="M 0 -18 L 5.2 -6.4 L 18 -5.5 L 8.2 3 L 11 15 L 0 8.4 L -11 15 L -8.2 3 L -18 -5.5 L -5.2 -6.4 Z" fill={p.accent} />;
  }
  if (type === 'heart') {
    return <path d="M 0 15 C -18 3 -20 -6 -13 -11 C -7 -15 -2 -10 0 -6 C 2 -10 7 -15 13 -11 C 20 -6 18 3 0 15 Z" fill={p.blush} />;
  }
  if (type === 'megaphone') {
    return (
      <g transform="translate(0 -8) rotate(-18)">
        <path d="M -6 -8 L 16 -18 L 16 12 L -6 3 Z" fill={p.accent} />
        <rect x={-14} y={-8} width={9} height={12} rx={3} fill={p.outfit} />
        <path d="M 16 -14 Q 24 -3 16 8" fill="none" stroke={p.accentSoft} strokeWidth={2.5} />
      </g>
    );
  }
  if (type === 'book') {
    return (
      <g transform="translate(0 -10)">
        <path d="M -16 -10 L 0 -13 L 16 -10 L 16 12 L 0 9 L -16 12 Z" fill={p.outfit} />
        <path d="M 0 -13 L 0 9" stroke={p.outfitLight} strokeWidth={2} />
        <path d="M -13 -5 L -3 -7 M -13 0 L -3 -2 M 3 -7 L 13 -5 M 3 -2 L 13 0" stroke={p.white} strokeWidth={1.6} opacity={0.7} />
      </g>
    );
  }
  if (type === 'bag') {
    return (
      <g transform="translate(0 -10)">
        <path d="M -14 0 L 14 0 L 12 18 L -12 18 Z" fill={p.outfit} />
        <path d="M -8 0 Q -8 -12 0 -12 Q 8 -12 8 0" fill="none" stroke={p.outfitDark} strokeWidth={3} />
        <circle cx={0} cy={5} r={2.5} fill={p.accent} />
      </g>
    );
  }
  return null;
}

export { STAGE };
