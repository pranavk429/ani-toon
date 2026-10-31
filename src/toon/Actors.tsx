'use client';

import type { ReactNode } from 'react';
import { bell, EASE_IN_OUT, EASE_OUT, loop, seg, seeded, wave } from '../motion/engine';
import {
  BALL_R,
  panStateAt,
  type Compiled,
  type PropState,
} from './compile';
import { Kid } from './Kid';
import {
  CAN_GEOM,
  canRoseScreen,
  FEET,
  FLOOR_Y,
  PROP_K,
  SCALE,
} from './rig';
import {
  fourPointStar,
  heartShape,
  mix,
  pentagonPath,
  pill,
  roundedPolygon,
  roundedTriangle,
} from './shapes';
import type { Pose } from './types';

// ---------------------------------------------------------------------------
// 1. RevealScene: Mystery Silhouette, 3D Swirl, and Soccer Ball with Ground Shadow

export function MysteryActor({
  compiled,
  pose,
  t,
}: {
  compiled: Compiled;
  pose: Pose;
  t: number;
}) {
  const m = compiled.mysteries.find((s) => t >= s.t0 && t < s.t1);
  if (!m) return null;
  const inK = seg(t, m.t0, m.t0 + 450);
  const outK = seg(t, m.t1 - 250, m.t1);
  const on = inK * (1 - outK);

  // Levitating silhouette hover height (RevealScene.swift L256)
  const hover =
    70 - (120 * (1 - inK) + 18 * Math.sin(((t - m.t0) / 1200) * Math.PI));
  const shadowK = Math.max(0, 1 - hover / 220);
  const mw = 140 * SCALE * shadowK;
  const mh = mw * 0.32;

  const levitatingPose: Pose = {
    ...pose,
    lift: hover / SCALE,
    float: 1,
    pedal: wave(t, 2400),
    legL: -2 + 3 * wave(t, 1800, 0.2),
    legR: -2 + 3 * wave(t, 1800, 0.55),
    armL: { a: 16 + 3 * wave(t, 2400, 0.1), e: 6 },
    armR: { a: 16 + 3 * wave(t, 2400, 0.6), e: 6 },
    lean: 0,
    head: 0,
  };

  const swirlP = (t - m.swirlAt) / 700;
  const swirlOn = swirlP > 0 && swirlP < 1;
  const swirlHead = -Math.PI / 2 + swirlP * 2 * Math.PI * 1.15;
  const swirlCy =
    FEET.y -
    70 -
    (30 + 160 * EASE_OUT(Math.max(0, Math.min(1, swirlP)))) * (SCALE / 1.72);
  const swirlTilt = (-12 * Math.PI) / 180;

  const renderSwirlHalf = (front: boolean) => {
    if (!swirlOn) return null;
    const n = 16;
    const pieces: ReactNode[] = [];
    for (let i = 0; i < n; i++) {
      const a0 = swirlHead - 2.0 + (2.0 * i) / n;
      const a1 = swirlHead - 2.0 + (2.0 * (i + 1)) / n;
      const midA = (a0 + a1) / 2;
      if ((Math.sin(midA) > 0) !== front) continue;
      const pts: Array<{ x: number; y: number }> = [];
      for (const a of [a0, a1]) {
        const lx = 105 * (SCALE / 1.72) * Math.cos(a);
        const ly = 24 * (SCALE / 1.72) * Math.sin(a);
        const px = FEET.x + lx * Math.cos(swirlTilt) - ly * Math.sin(swirlTilt);
        const py = swirlCy + lx * Math.sin(swirlTilt) + ly * Math.cos(swirlTilt);
        pts.push({ x: px, y: py });
      }
      pieces.push(
        <line
          key={i}
          x1={pts[0].x}
          y1={pts[0].y}
          x2={pts[1].x}
          y2={pts[1].y}
          stroke="#FFFFFF"
          strokeWidth={3 + (9 * i) / n}
          strokeLinecap="round"
          opacity={bell(swirlP)}
        />,
      );
    }
    return <g>{pieces}</g>;
  };

  const center = { x: FEET.x, y: FEET.y - 70 - 120 * (SCALE / 1.72) };
  const sparks = Array.from({ length: 16 }, (_, i) => {
    const burst = i < 10;
    const start = burst
      ? m.t0 + 400 + seeded(i, 2) * 350
      : m.t0 + 1000 + seeded(i, 4) * 800;
    const p = (t - start) / 700;
    if (p <= 0 || p >= 1) return null;
    const a = seeded(i, 1) * 2 * Math.PI;
    const r = (95 + seeded(i, 3) * 45 + (burst ? 35 * EASE_OUT(p) : 0)) * (SCALE / 1.72);
    const px = center.x + Math.cos(a) * r;
    const py = center.y + Math.sin(a) * r * 1.3;
    const s = bell(p);
    return (
      <g key={i} transform={`translate(${px} ${py}) scale(${s})`}>
        {i % 3 === 0 ? (
          <path d={fourPointStar(10 + seeded(i, 5) * 8)} fill="#FFFFFF" />
        ) : i % 3 === 1 ? (
          <circle r={5} fill="#FFFFFF" />
        ) : (
          <g transform={`rotate(${(a * 180) / Math.PI + 90})`}>
            <path d={pill(0, 0, 8, 24)} fill="#FFFFFF" />
          </g>
        )}
      </g>
    );
  });

  return (
    <g opacity={on}>
      {sparks}
      <ellipse
        cx={FEET.x}
        cy={FEET.y - 7 * SCALE}
        rx={mw / 2}
        ry={mh / 2}
        fill="#26356F"
        opacity={0.35}
      />
      {renderSwirlHalf(false)}
      <Kid
        ch={compiled.spec.character}
        pose={levitatingPose}
        floor="#00000000"
        flat="#5A6D88"
      />
      <text
        x={FEET.x}
        y={FEET.y - hover - (FLOOR_Y - 82) * SCALE}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#E6F2FF"
        fontSize={46 * (SCALE / 1.72)}
        fontWeight="800"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        ?
      </text>
      {renderSwirlHalf(true)}
    </g>
  );
}

export function SoccerBall({ prop }: { prop: PropState }) {
  const r = BALL_R;
  const sx = 1 - 0.16 * prop.squash;
  const sy = 1 + 0.12 * prop.squash;
  const ground = FEET.y - r;
  const low = Math.max(0, 1 - (ground - prop.y) / 160);
  const bw = r * 2.2 * low;
  const bh = bw * 0.32;

  return (
    <g>
      {low > 0 && (
        <ellipse
          cx={prop.x}
          cy={FEET.y - 6 * SCALE}
          rx={bw / 2}
          ry={bh / 2}
          fill="#3B4C96"
          opacity={0.35 * low}
        />
      )}
      <g transform={`translate(${prop.x} ${prop.y}) scale(${sx} ${sy})`}>
        <defs>
          <clipPath id="ballDisc">
            <circle cx={0} cy={0} r={r} />
          </clipPath>
        </defs>
        <circle cx={0} cy={0} r={r} fill="#D7E6F5" />
        <g clipPath="url(#ballDisc)">
          <ellipse cx={-r * 0.2} cy={-r * 0.2} rx={r * 1.1} ry={r * 1.1} fill="#FFFFFF" />
          <g transform={`rotate(${prop.rot})`}>
            <path d={pentagonPath(0, 0, r * 0.36, 0)} fill="#2B303A" />
            {[0, 1, 2, 3, 4].map((i) => {
              const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
              return (
                <path
                  key={i}
                  d={pentagonPath(
                    Math.cos(a) * r,
                    Math.sin(a) * r,
                    r * 0.34,
                    a + Math.PI,
                  )}
                  fill="#2B303A"
                />
              );
            })}
          </g>
        </g>
      </g>
    </g>
  );
}

export function TennisBall({
  prop,
  color = '#D4E157',
}: {
  prop: PropState;
  color?: string;
}) {
  const r = BALL_R * 0.72;
  const sx = 1 + 0.3 * prop.squash;
  const sy = 1 - 0.22 * prop.squash;
  const ground = FEET.y - 12;
  const distToGround = Math.max(0, ground - prop.y);
  const low = Math.max(0, 1 - distToGround / 550);
  const bw = r * 2.4 * (0.4 + 0.6 * low);
  const bh = bw * 0.28;

  return (
    <g>
      {/* Ground court shadow */}
      {low > 0 && (
        <ellipse
          cx={prop.x}
          cy={FEET.y - 4 * SCALE}
          rx={bw / 2}
          ry={bh / 2}
          fill="#1E293B"
          opacity={0.3 * low}
        />
      )}

      {/* Explosive impact shockwave burst on contact */}
      {prop.squash > 0.15 && (
        <g transform={`translate(${prop.x} ${prop.y})`}>
          <circle cx={0} cy={0} r={r * 1.6} fill="#FFFFFF" opacity={0.45 * prop.squash} />
          <circle cx={0} cy={0} r={r * 2.2} fill="none" stroke="#FFF275" strokeWidth={3} opacity={prop.squash} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((ang) => {
            const rad = (ang * Math.PI) / 180;
            return (
              <line
                key={ang}
                x1={Math.cos(rad) * (r + 4)}
                y1={Math.sin(rad) * (r + 4)}
                x2={Math.cos(rad) * (r + 20 + prop.squash * 16)}
                y2={Math.sin(rad) * (r + 20 + prop.squash * 16)}
                stroke="#FFFFFF"
                strokeWidth={2.8}
                strokeLinecap="round"
              />
            );
          })}
        </g>
      )}

      {/* The Tennis Ball */}
      <g transform={`translate(${prop.x} ${prop.y}) scale(${sx} ${sy})`}>
        <defs>
          <clipPath id="tennisDisc">
            <circle cx={0} cy={0} r={r} />
          </clipPath>
        </defs>
        {/* Felt Base */}
        <circle cx={0} cy={0} r={r} fill={color} />
        <g clipPath="url(#tennisDisc)">
          {/* 3D Top-left light sheen */}
          <ellipse cx={-r * 0.28} cy={-r * 0.28} rx={r * 0.8} ry={r * 0.7} fill="#F7FEE7" opacity={0.5} />
          {/* Bottom shadow */}
          <ellipse cx={r * 0.3} cy={r * 0.35} rx={r * 0.75} ry={r * 0.6} fill="#84CC16" opacity={0.45} />
          {/* Dual curved tennis seams */}
          <g transform={`rotate(${prop.rot})`}>
            <path
              d={`M ${-r * 0.88} 0 C ${-r * 0.2} ${-r * 0.68}, ${r * 0.2} ${-r * 0.68}, ${r * 0.88} 0`}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={3}
              strokeLinecap="round"
            />
            <path
              d={`M ${-r * 0.88} 0 C ${-r * 0.2} ${r * 0.68}, ${r * 0.2} ${r * 0.68}, ${r * 0.88} 0`}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={3}
              strokeLinecap="round"
            />
          </g>
        </g>
      </g>
    </g>
  );
}

// ---------------------------------------------------------------------------
// 2. ChefScene: Pan, 3D Flipping Pancake, and Curling Steam Wisps + Landing Puffs

export function Pan({ ps }: { ps: { x: number; y: number; roll: number } }) {
  const r = 58 * PROP_K;
  const rh = r * 0.28;
  const wall = 9 * PROP_K;
  const gripX = 128 * PROP_K;
  const gripY = -4 * PROP_K;

  return (
    <g transform={`translate(${ps.x} ${ps.y}) rotate(${ps.roll})`}>
      {/* Wooden handle under hand */}
      <line
        x1={r - 6 * PROP_K}
        y1={0}
        x2={gripX - 30 * PROP_K}
        y2={gripY}
        stroke="#2A2E37"
        strokeWidth={11 * PROP_K}
        strokeLinecap="round"
      />
      <line
        x1={gripX - 32 * PROP_K}
        y1={gripY}
        x2={gripX + 10 * PROP_K}
        y2={gripY}
        stroke="#C97A40"
        strokeWidth={14 * PROP_K}
        strokeLinecap="round"
      />
      {/* Pan body */}
      <ellipse cx={0} cy={wall} rx={r} ry={rh} fill="#1E2229" />
      <rect x={-r} y={0} width={r * 2} height={wall} fill="#1E2229" />
      <ellipse cx={0} cy={0} rx={r} ry={rh} fill="#2B3038" />
      <ellipse cx={0} cy={2 * PROP_K} rx={r - 6 * PROP_K} ry={rh - 3 * PROP_K} fill="#3A404B" />
    </g>
  );
}

export function Pancake({
  prop,
  color = '#F7CF78',
}: {
  prop: PropState;
  color?: string;
}) {
  const r = 40 * PROP_K;
  const thick = 8 * PROP_K;
  // Exact ChefScene.swift L705-728 3D tilt flip ratio
  const ratio = Math.sin(0.38 + prop.theta);
  const paleUp = ratio >= 0;
  const rh = Math.max(1.8, r * Math.abs(ratio));
  const sx = 1 + 0.14 * prop.squash;
  const sy = 1 - 0.28 * prop.squash;
  const darkC = '#C9742A';
  const paleC = color;
  const edgeC = '#D99B4E';

  return (
    <g transform={`translate(${prop.x} ${prop.y}) rotate(${prop.rot}) scale(${sx} ${sy})`}>
      {/* Edge thickness */}
      <ellipse cx={0} cy={thick * 0.5} rx={r} ry={rh + thick * 0.5} fill={edgeC} />
      {/* Face */}
      <ellipse cx={0} cy={-thick * 0.3} rx={r} ry={rh} fill={paleUp ? paleC : darkC} />
      {/* Surface details */}
      <g
        transform={`translate(0 ${-thick * 0.3}) scale(1 ${Math.abs(ratio) / Math.sin(0.38)})`}
      >
        {paleUp ? (
          <>
            {[0, 1, 2, 3, 4].map((i) => {
              const bx = (seeded(i, 6) - 0.5) * 44 * PROP_K;
              const by = (seeded(i, 7) - 0.5) * 14 * PROP_K;
              const br = (2.4 + seeded(i, 8) * 2) * PROP_K;
              return (
                <ellipse
                  key={i}
                  cx={bx}
                  cy={by}
                  rx={br}
                  ry={br * 0.6}
                  fill="#E0B25B"
                />
              );
            })}
          </>
        ) : (
          <ellipse
            cx={0}
            cy={0}
            rx={26 * PROP_K}
            ry={8 * PROP_K}
            fill="#B3621E"
          />
        )}
      </g>
    </g>
  );
}

export function Steam({
  compiled,
  prop,
  t,
}: {
  compiled: Compiled;
  prop: PropState;
  t: number;
}) {
  const period = 1920;
  const wisps: ReactNode[] = [];

  // 5 Wisps curling outward from pan edges when pancake is in the pan (ChefScene.swift L735-759)
  if (prop.mode === 'pan') {
    for (let i = 0; i < 5; i++) {
      const p = loop(t, period, seeded(i, 11));
      const life = 0.75;
      if (p >= life) continue;
      const q = p / life;
      const side = i % 2 === 0 ? -1 : 1;
      const x0 = prop.x + side * (14 + seeded(i, 12) * 22) * PROP_K;
      const rise = EASE_OUT(q);
      const y0 = prop.y - 8 * PROP_K - 46 * PROP_K * rise;
      const pts: string[] = [];
      for (let k = 0; k <= 6; k++) {
        const s = k / 6;
        const px =
          x0 +
          side * 22 * PROP_K * rise * (0.6 + 0.4 * s) +
          4 * Math.sin(s * 3.4 + q * 4 + i);
        const py = y0 - 20 * PROP_K * s;
        pts.push(`${px},${py}`);
      }
      wisps.push(
        <polyline
          key={`wisp-${i}`}
          points={pts.join(' ')}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={(6.5 - 2.5 * q) * PROP_K}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={bell(q) * 0.8}
        />,
      );
    }
  }

  // Puff clouds on landing (ChefScene.swift L761-775)
  const puffs: ReactNode[] = [];
  const lands: number[] = [];
  for (const p of compiled.props) {
    if (p.type === 'toss') lands.push(p.land);
    else if (p.type === 'hat-catch') lands.push(p.onHat, p.catchAt);
  }
  for (const land of lands) {
    const q = (t - land) / 480;
    if (q <= 0 || q >= 1) continue;
    for (let k = 0; k < 6; k++) {
      const side = k % 2 === 0 ? -1 : 1;
      const d =
        (40 + 34 * EASE_OUT(q)) * (0.75 + 0.5 * seeded(k, 10)) * PROP_K;
      const rr = (3 + 5 * EASE_OUT(q)) * (0.8 + 0.4 * seeded(k, 13)) * PROP_K;
      const cx = prop.x + side * d;
      const cy = prop.y - 4 - 10 * seeded(k, 9) - 6 * q;
      puffs.push(
        <circle
          key={`puff-${land}-${k}`}
          cx={cx}
          cy={cy}
          r={rr}
          fill="#FFFFFF"
          opacity={bell(q) * 0.85}
        />,
      );
    }
  }

  return (
    <g>
      {wisps}
      {puffs}
    </g>
  );
}

// ---------------------------------------------------------------------------
// 3. GardenScene: Terracotta Pot, Growing Plant, Flowers, Butterflies, Falling Petals, and Water

type Stem = {
  base: { x: number; y: number };
  ctrl: { x: number; y: number };
  tip: { x: number; y: number };
  len: number;
};

function evalStem(
  t: number,
  bloomPlan?: { land: number; takeoff: number; growStart: number; wilt: number },
): Stem {
  const potX = 535;
  const soilY = FEET.y - 12;
  const sprout = 18 * SCALE;
  const full = 68 * SCALE;

  let g = 0;
  if (bloomPlan) {
    const grow =
      seg(t, bloomPlan.growStart, bloomPlan.growStart + 2200) *
      (1 - seg(t, bloomPlan.wilt, bloomPlan.wilt + 900));
    g = grow;
  }
  const len = sprout + (full - sprout) * g;

  // Sways from soil on two waves; butterfly landing dips it, takeoff kicks it (GardenScene.swift L357-358)
  let a = (2.5 * wave(t, 2500) + 1.5 * wave(t, 5000, 0.3)) * (0.4 + 0.6 * g);
  if (bloomPlan) {
    if (t > bloomPlan.land) {
      const s = t - bloomPlan.land;
      a += 5 * Math.sin((2 * Math.PI * s) / 800) * Math.exp(-s / 400);
    }
    if (t > bloomPlan.takeoff) {
      const s = t - bloomPlan.takeoff;
      a -= 7 * Math.sin((2 * Math.PI * s) / 700) * Math.exp(-s / 350);
    }
  }
  const r = (a * Math.PI) / 180;
  const base = { x: potX, y: soilY };
  const tip = { x: base.x + Math.sin(r) * len, y: base.y - Math.cos(r) * len };
  const ctrl = {
    x: base.x + Math.sin(r * 0.35) * len * 0.55 - 6 * g * (SCALE / 1.72),
    y: base.y - Math.cos(r * 0.35) * len * 0.55,
  };
  return { base, ctrl, tip, len };
}

function alongStem(s: Stem, h: number): { pt: { x: number; y: number }; angle: number } {
  const u = Math.min(1, Math.max(0, h / Math.max(1, s.len)));
  const a = 1 - u;
  const pt = {
    x: a * a * s.base.x + 2 * a * u * s.ctrl.x + u * u * s.tip.x,
    y: a * a * s.base.y + 2 * a * u * s.ctrl.y + u * u * s.tip.y,
  };
  const dx = 2 * a * (s.ctrl.x - s.base.x) + 2 * u * (s.tip.x - s.ctrl.x);
  const dy = 2 * a * (s.ctrl.y - s.base.y) + 2 * u * (s.tip.y - s.ctrl.y);
  return { pt, angle: (Math.atan2(dx, -dy) * 180) / Math.PI };
}

export function GardenPot({
  compiled,
  t,
}: {
  compiled: Compiled;
  t: number;
}) {
  const potX = 535;
  const base = FEET.y + 36;
  const rim = FEET.y - 14;
  const topW = 96 * (SCALE / 1.72);
  const bottomW = 74 * (SCALE / 1.72);
  const lipW = 110 * (SCALE / 1.72);

  // Soil darkens when watered and dries when wilting (GardenScene.swift L339-340)
  let wet = 0;
  for (const pr of compiled.pours) {
    wet += seg(t, pr.t0 + 100, pr.t1 + 100);
  }
  for (const bl of compiled.blooms) {
    wet *= 1 - seg(t, bl.wilt, bl.wilt + 800);
  }
  wet = Math.min(1, Math.max(0, wet));
  const soilColor = mix('#8A6552', '#4D3328', wet);

  const bodyPts = [
    { x: potX - topW / 2, y: rim + 8 },
    { x: potX + topW / 2, y: rim + 8 },
    { x: potX + bottomW / 2, y: base },
    { x: potX - bottomW / 2, y: base },
  ];

  return (
    <g>
      {/* Floor shadow */}
      <ellipse
        cx={potX}
        cy={base - 4}
        rx={68 * (SCALE / 1.72)}
        ry={20 * (SCALE / 1.72)}
        fill="#26356F"
        opacity={0.2}
      />
      {/* Terracotta body & shade */}
      <path d={roundedPolygon(bodyPts, 10)} fill="#E57F5E" />
      <g>
        <rect
          x={potX + topW / 2 - 28}
          y={rim}
          width={40}
          height={base - rim}
          fill="#CC6849"
          opacity={0.8}
        />
      </g>
      {/* Pot lip & soil */}
      <rect
        x={potX - lipW / 2}
        y={rim}
        width={lipW}
        height={22}
        rx={8}
        fill="#F29676"
      />
      <ellipse cx={potX} cy={rim} rx={lipW / 2} ry={11} fill="#F29676" />
      <ellipse
        cx={potX}
        cy={rim + 3}
        rx={50 * (SCALE / 1.72)}
        ry={8 * (SCALE / 1.72)}
        fill="#CC6849"
      />
      <ellipse
        cx={potX}
        cy={rim + 5}
        rx={46 * (SCALE / 1.72)}
        ry={6 * (SCALE / 1.72)}
        fill={soilColor}
      />
    </g>
  );
}

export function GardenPlant({
  compiled,
  t,
}: {
  compiled: Compiled;
  t: number;
}) {
  const bloomPlan = compiled.blooms[0];
  const s = evalStem(t, bloomPlan);

  // Draw leaf helper
  const drawLeaf = (
    at: { x: number; y: number },
    angle: number,
    L: number,
    W: number,
    vein: boolean,
  ) => {
    return (
      <g transform={`translate(${at.x} ${at.y}) rotate(${angle})`}>
        <path
          d={`M0 0Q${W} ${-L * 0.45} 0 ${-L}Q${-W} ${-L * 0.55} 0 0Z`}
          fill="#6CCB72"
        />
        {vein && (
          <path
            d={`M0 -3Q${W * 0.12} ${-L * 0.4} 0 ${-L * 0.72}`}
            fill="none"
            stroke="#4EA756"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        )}
      </g>
    );
  };

  // Seed leaves stay low on stem
  const low = alongStem(s, Math.min(14 * (SCALE / 1.72), s.len - 3));

  // True leaves
  const leafHs = [26, 46, 64].map((h) => h * (SCALE / 1.72));

  // Flower blooming
  const renderFlower = () => {
    if (!bloomPlan) return null;
    const bud =
      seg(t, bloomPlan.bud, bloomPlan.bud + 500) *
      (1 - seg(t, bloomPlan.wilt, bloomPlan.wilt + 350));
    if (bud <= 0.01) return null;
    const top = alongStem(s, s.len);

    const petals: ReactNode[] = [];
    const petalFall = (i: number) =>
      bloomPlan.takeoff + 160 * [4, 0, 2, 5, 1, 3][i];

    for (const i of [1, 3, 5, 0, 2, 4]) {
      if (t >= petalFall(i)) continue;
      const open = seg(
        t,
        bloomPlan.bloom + 90 * i,
        bloomPlan.bloom + 90 * i + 520,
      );
      if (open <= 0) continue;
      const sc = (0.25 + 0.75 * open) * (SCALE / 1.72);
      const d = (2 + 9 * open) * (SCALE / 1.72);
      const pAngle =
        -90 + 60 * i + 25 * (1 - open) + 1.5 * wave(t - 60 * i, 1250);
      petals.push(
        <g key={i} transform={`rotate(${pAngle})`}>
          <ellipse
            cx={d}
            cy={0}
            rx={17 * sc}
            ry={12 * sc}
            fill={i % 2 === 0 ? '#C9A3FF' : '#B283F7'}
          />
        </g>,
      );
    }

    const heart =
      seg(t, bloomPlan.bloom - 50, bloomPlan.bloom + 350) *
      (1 - seg(t, bloomPlan.wilt, bloomPlan.wilt + 350));

    return (
      <g transform={`translate(${top.pt.x} ${top.pt.y}) rotate(${top.angle})`}>
        {/* Bud cup */}
        <path
          d={roundedTriangle(
            { x: -12 * bud * (SCALE / 1.72), y: 2 },
            { x: 12 * bud * (SCALE / 1.72), y: 2 },
            { x: 0, y: -30 * bud * (SCALE / 1.72) },
            8 * bud,
          )}
          fill="#5CB862"
        />
        <g transform={`translate(0 ${-14 * (SCALE / 1.72)})`}>
          {petals}
          {heart > 0 && (
            <circle
              cx={0}
              cy={0}
              r={12 * heart * (SCALE / 1.72)}
              fill="#FFCF4A"
            />
          )}
        </g>
      </g>
    );
  };

  return (
    <g>
      {/* Stem */}
      <path
        d={`M${s.base.x} ${s.base.y}Q${s.ctrl.x} ${s.ctrl.y} ${s.tip.x} ${s.tip.y}`}
        fill="none"
        stroke="#5CB862"
        strokeWidth={8 * (SCALE / 1.72)}
        strokeLinecap="round"
      />
      {/* Low seed leaves */}
      {[-1, 1].map((side) => {
        const sw = 5 * wave(t - 100, 2500, side * 0.1);
        return (
          <g key={side}>
            {drawLeaf(
              low.pt,
              low.angle + side * 58 + sw,
              20 * (SCALE / 1.72),
              12 * (SCALE / 1.72),
              false,
            )}
          </g>
        );
      })}
      {/* True leaves */}
      {bloomPlan &&
        leafHs.map((h, i) => {
          const side = i % 2 === 0 ? -1 : 1;
          const unfurlT = bloomPlan.growStart + 800 + i * 500;
          const foldT = bloomPlan.wilt + (2 - i) * 150;
          const open =
            seg(t, unfurlT, unfurlT + 520) *
            (1 - seg(t, foldT, foldT + 300));
          if (open <= 0.01) return null;
          const at = alongStem(s, h);
          const lag = 6 * wave(t - 140 * (i + 1), 2500);
          return (
            <g key={i}>
              {drawLeaf(
                at.pt,
                at.angle + side * (12 + 46 * open) + lag,
                46 * (0.25 + 0.75 * open) * (SCALE / 1.72),
                14 * open * (SCALE / 1.72),
                true,
              )}
            </g>
          );
        })}
      {renderFlower()}
    </g>
  );
}

export function GardenButterfly({
  compiled,
  t,
}: {
  compiled: Compiled;
  t: number;
}) {
  const bl = compiled.blooms[0];
  if (!bl || t < bl.enter || t >= bl.gone) return null;
  const s = evalStem(t, bl);
  const top = alongStem(s, s.len);
  const rRad = (top.angle * Math.PI) / 180;
  const perch = {
    x: top.pt.x + Math.sin(rRad) * 16 * (SCALE / 1.72),
    y: top.pt.y - Math.cos(rRad) * 16 * (SCALE / 1.72) - 8,
  };

  let pos = perch;
  let flying = 0;
  let tilt = -8 + 8 * wave(t, 1250, 0.2);

  if (t < bl.land) {
    const k = (t - bl.enter) / (bl.land - bl.enter);
    const from = { x: 740, y: 320 };
    pos = {
      x: from.x + (perch.x - from.x) * EASE_OUT(k) + 26 * wave(t, 1250) * bell(k),
      y: from.y + (perch.y - from.y) * EASE_IN_OUT(k) + 30 * wave(t, 625, 0.25) * bell(k),
    };
    flying = 1 - seg(t, bl.land - 160, bl.land + 40);
  } else if (t < bl.takeoff) {
    pos = perch;
    flying = 0;
    tilt = top.angle * 0.6;
  } else {
    const k = (t - bl.takeoff) / (bl.gone - bl.takeoff);
    const to = { x: 90, y: 160 };
    pos = {
      x: perch.x + (to.x - perch.x) * Math.pow(k, 1.6) + 20 * wave(t, 1250, 0.4) * bell(k),
      y: perch.y + (to.y - perch.y) * EASE_OUT(k) + 24 * wave(t, 625) * bell(k),
    };
    flying = seg(t, bl.takeoff, bl.takeoff + 80);
    tilt = -18 + 8 * wave(t, 1250);
  }

  const fast = 0.12 + 0.88 * (0.5 + 0.5 * wave(t, 200));
  const slow = 0.55 + 0.45 * (0.5 + 0.5 * wave(t, 1250));
  const open = flying * fast + (1 - flying) * slow;

  return (
    <g
      transform={`translate(${pos.x} ${pos.y}) rotate(${tilt}) scale(${SCALE / 1.72})`}
    >
      {[-1, 1].map((side) => (
        <g key={side} transform={`scale(${side * open} 1)`}>
          <ellipse cx={16} cy={-12} rx={15} ry={13.5} fill="#3B3452" />
          <ellipse cx={15} cy={-11} rx={11.5} ry={10} fill="#FFA24C" />
          <ellipse cx={12} cy={8} rx={10.5} ry={10} fill="#3B3452" />
          <ellipse cx={11} cy={7} rx={7.5} ry={7} fill="#FFA24C" />
          <circle cx={26} cy={-17} r={2.4} fill="#FFFFFF" />
          <circle cx={28.5} cy={-9} r={1.8} fill="#FFFFFF" />
        </g>
      ))}
      <path d={pill(0, -2, 7, 26)} fill="#3B3452" />
      <circle cx={0} cy={-21} r={4.5} fill="#3B3452" />
    </g>
  );
}

export function WaterDrops({
  compiled,
  pose,
  t,
}: {
  compiled: Compiled;
  pose: Pose;
  t: number;
}) {
  const pr = compiled.pours[0];
  if (!pr || t < pr.t0 || t >= pr.t1 + 900) return null;
  const drops: ReactNode[] = [];
  const soilY = FEET.y - 12;
  const g = 1300 * (SCALE / 1.72);
  const vSpeed = 70 * (SCALE / 1.72);

  let te = pr.t0;
  let n = 0;
  while (te <= pr.t1) {
    if (t >= te && t < te + 900) {
      const r = canRoseScreen(pose);
      for (let j = 0; j < 2; j++) {
        const i = n * 2 + j;
        const o =
          ((j === 0 ? -4 : 4) + (seeded(i, 1) - 0.5) * 3) * (SCALE / 1.72);
        const x0 = r.x - Math.sin(r.dir) * o;
        const y0 = r.y + Math.cos(r.dir) * o;
        const v = vSpeed + 50 * seeded(i, 2) * (SCALE / 1.72);
        const vx =
          Math.cos(r.dir) * v + (seeded(i, 3) - 0.5) * 24 * (SCALE / 1.72);
        const vy = Math.sin(r.dir) * v;
        const land = soilY + 3 * seeded(i, 4);
        const sLand =
          (-vy + Math.sqrt(Math.max(0, vy * vy + 2 * g * Math.max(0, land - y0)))) /
          g;
        const s = (t - te) / 1000;
        if (s < sLand) {
          const dx = x0 + vx * s;
          const dy = y0 + vy * s + 0.5 * g * s * s;
          const a = Math.atan2(vy + g * s, vx);
          drops.push(
            <g
              key={`${te}-${j}`}
              transform={`translate(${dx} ${dy}) rotate(${(a * 180) / Math.PI})`}
            >
              <path
                d={pill(0, 0, 11 * (SCALE / 1.72), 6 * (SCALE / 1.72))}
                fill="#6EC3FF"
              />
            </g>,
          );
        } else if (s < sLand + 0.22) {
          const p = (s - sLand) / 0.22;
          const xl = x0 + vx * sLand;
          for (const side of [-1, 1]) {
            const rr = 2.6 * (1 - 0.5 * p) * (SCALE / 1.72);
            const cx = xl + side * 14 * p * (SCALE / 1.72);
            const cy = land - 16 * 4 * p * (1 - p) * (SCALE / 1.72);
            drops.push(
              <circle
                key={`splash-${te}-${j}-${side}`}
                cx={cx}
                cy={cy}
                r={rr}
                fill="#6EC3FF"
              />,
            );
          }
        }
      }
    }
    te += 45;
    n++;
  }
  return <g>{drops}</g>;
}

export function FallingPetals({
  compiled,
  t,
}: {
  compiled: Compiled;
  t: number;
}) {
  const bl = compiled.blooms[0];
  if (!bl) return null;
  const petals: ReactNode[] = [];

  for (let i = 0; i < 6; i++) {
    const start = bl.takeoff + 160 * [4, 0, 2, 5, 1, 3][i];
    const s = (t - start) / 1000;
    if (s <= 0) continue;
    const st = evalStem(start, bl);
    const top = alongStem(st, st.len);
    const rRad = (top.angle * Math.PI) / 180;
    const pAngleRad = ((-90 + 60 * i) * Math.PI) / 180;
    const p0 = {
      x: top.pt.x + Math.cos(rRad + pAngleRad) * 28 * (SCALE / 1.72),
      y: top.pt.y + Math.sin(rRad + pAngleRad) * 28 * (SCALE / 1.72),
    };
    const wind = (-40 + 30 * seeded(i, 7)) * (SCALE / 1.72);
    const phase = seeded(i, 8) * 2 * Math.PI;
    const land = FEET.y + 10;
    const sLand =
      (-110 + Math.sqrt(110 * 110 + 4 * 150 * Math.max(0, land - p0.y))) /
      (2 * 150);
    const sc = Math.min(s, sLand);
    const fade =
      1 - seg(t, start + sLand * 1000 + 100, start + sLand * 1000 + 300);
    if (fade <= 0) continue;

    const px =
      p0.x +
      wind * sc +
      18 * (Math.sin((2 * Math.PI * sc) / 0.8 + phase) - Math.sin(phase));
    const py = p0.y + 110 * sc + 150 * sc * sc;
    const dir = seeded(i, 10) < 0.5 ? -1 : 1;
    const rot =
      top.angle +
      (-90 + 60 * i) +
      dir * 160 * sc +
      18 * Math.sin((2 * Math.PI * sc) / 0.8 + phase);
    const flip = 0.3 + 0.7 * Math.abs(Math.cos((Math.PI * sc) / 0.55));

    petals.push(
      <g
        key={i}
        transform={`translate(${px} ${py}) rotate(${rot}) scale(1 ${flip})`}
        opacity={fade}
      >
        <ellipse
          cx={0}
          cy={0}
          rx={17 * (SCALE / 1.72)}
          ry={12 * (SCALE / 1.72)}
          fill={i % 2 === 0 ? '#C9A3FF' : '#B283F7'}
        />
      </g>,
    );
  }
  return <g>{petals}</g>;
}

export function FloatingHearts({
  compiled,
  t,
}: {
  compiled: Compiled;
  t: number;
}) {
  const bl = compiled.blooms[0];
  if (!bl) return null;
  const spots = [
    { dx: -74 * (SCALE / 1.72), start: bl.hop - 50 },
    { dx: 8 * (SCALE / 1.72), start: bl.hop + 80 },
    { dx: 78 * (SCALE / 1.72), start: bl.hop + 210 },
  ];
  const baseY = FEET.y - (FLOOR_Y + 40) * SCALE;

  return (
    <g>
      {spots.map((h, i) => {
        const p = (t - h.start) / 900;
        if (p <= 0 || p >= 1) return null;
        const px = FEET.x + h.dx + 6 * wave(t, 1000, i * 0.3);
        const py = baseY - 60 * EASE_OUT(p);
        const sc = bell(p) * (0.85 + 0.3 * seeded(i, 11)) * (SCALE / 1.72);
        const rot = -12 + 24 * seeded(i, 12);
        return (
          <g
            key={i}
            transform={`translate(${px} ${py}) scale(${sc}) rotate(${rot})`}
          >
            <path d={heartShape(11)} fill="#FF7A9A" />
          </g>
        );
      })}
    </g>
  );
}

// ---------------------------------------------------------------------------
// 4. StargazerScene: Brass Telescope, Falling Star Arc, Glass Lantern Jar & Glow

export function Telescope({ t }: { t: number }) {
  const mountX = 220;
  const mountY = 820;
  const legBottomY = FEET.y + 20;

  return (
    <g>
      {/* Wooden Tripod Legs */}
      <line
        x1={mountX}
        y1={mountY}
        x2={120}
        y2={legBottomY}
        stroke="#4A2612"
        strokeWidth={10}
        strokeLinecap="round"
      />
      <line
        x1={mountX}
        y1={mountY}
        x2={220}
        y2={legBottomY}
        stroke="#3B1C0B"
        strokeWidth={10}
        strokeLinecap="round"
      />
      <line
        x1={mountX}
        y1={mountY}
        x2={295}
        y2={legBottomY}
        stroke="#593019"
        strokeWidth={10}
        strokeLinecap="round"
      />
      {/* Tripod Brass Spreader Bracket */}
      <line x1={155} y1={940} x2={270} y2={940} stroke="#C48E2E" strokeWidth={5} />

      {/* Brass Mount Head */}
      <circle cx={mountX} cy={mountY} r={16} fill="#D49A33" />
      <circle cx={mountX} cy={mountY} r={8} fill="#FAD161" />

      {/* Main Telescope Brass Barrel, angled at -34 deg into the cosmos */}
      <g transform={`translate(${mountX} ${mountY}) rotate(-34)`}>
        {/* Main Body */}
        <rect x={-110} y={-18} width={200} height={36} rx={6} fill="#E5A638" />
        <rect x={-110} y={-10} width={200} height={14} fill="#FCE083" opacity={0.65} />
        {/* Shaded bands */}
        <rect x={-80} y={-20} width={12} height={40} rx={3} fill="#B57B1B" />
        <rect x={10} y={-20} width={16} height={40} rx={3} fill="#B57B1B" />
        <rect x={60} y={-20} width={12} height={40} rx={3} fill="#B57B1B" />

        {/* Large Objective Lens (sky side) */}
        <rect x={-124} y={-23} width={16} height={46} rx={4} fill="#D49A33" />
        <ellipse cx={-124} cy={0} rx={6} ry={23} fill="#72C6EB" />

        {/* Eyepiece Extension & Eyepiece (viewer side) */}
        <rect x={90} y={-10} width={45} height={20} rx={3} fill="#B57B1B" />
        <rect x={132} y={-14} width={12} height={28} rx={3} fill="#D49A33" />
        <rect x={142} y={-10} width={8} height={20} rx={2} fill="#262833" />

        {/* Finder Scope on top */}
        <line x1={-30} y1={-25} x2={-30} y2={-18} stroke="#B57B1B" strokeWidth={4} />
        <line x1={30} y1={-25} x2={30} y2={-18} stroke="#B57B1B" strokeWidth={4} />
        <rect x={-45} y={-33} width={90} height={12} rx={3} fill="#D49A33" />
      </g>
    </g>
  );
}

export function ShootingStarAndJar({
  compiled,
  prop,
  t,
}: {
  compiled: Compiled;
  prop: PropState;
  t: number;
}) {
  const plan = compiled.starCatches[0];
  if (!plan) return null;

  const caught = t >= plan.catchAt;
  const jarX = 360;
  const jarY = 780;
  const jarW = 76;
  const jarH = 96;

  // Star trajectory trail particles
  const isStreaking = t >= plan.streakStart && t < plan.catchAt;
  const streakP = isStreaking ? (t - plan.streakStart) / (plan.catchAt - plan.streakStart) : 0;

  return (
    <g>
      {/* 1. Shooting Star & Radiant Sparkle Tail */}
      {isStreaking && (
        <g>
          {Array.from({ length: 14 }).map((_, i) => {
            const lag = (i + 1) * 0.055;
            const sp = Math.max(0, streakP - lag);
            const startX = 640;
            const startY = 140;
            const targetX = 360;
            const targetY = 770;
            const ctrlX = 490;
            const ctrlY = 220;
            const a = 1 - sp;
            const px = a * a * startX + 2 * a * sp * ctrlX + sp * sp * targetX;
            const py = a * a * startY + 2 * a * sp * ctrlY + sp * sp * targetY;
            const sc = (1 - i / 14) * 1.2;
            const op = Math.max(0, (1 - i / 14) * 0.9);
            return (
              <g key={i} transform={`translate(${px} ${py}) scale(${sc})`} opacity={op}>
                <path d={fourPointStar(16)} fill="#FFF399" />
              </g>
            );
          })}
          <g transform={`translate(${prop.x} ${prop.y}) rotate(${prop.rot})`}>
            <circle r={28} fill="#FFF6A3" opacity={0.35} />
            <circle r={16} fill="#FFFCE0" opacity={0.7} />
            <path d={fourPointStar(26)} fill="#FFFFFF" />
          </g>
        </g>
      )}

      {/* 2. Impact stardust rings upon catch */}
      {caught && t < plan.catchAt + 600 && (
        <g transform={`translate(${jarX} ${jarY})`}>
          {(() => {
            const p = (t - plan.catchAt) / 600;
            const r = p * 110;
            return (
              <>
                <circle
                  r={r}
                  fill="none"
                  stroke="#FFF7A8"
                  strokeWidth={5 * (1 - p)}
                  opacity={1 - p}
                />
                <circle
                  r={r * 0.65}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth={3 * (1 - p)}
                  opacity={1 - p}
                />
              </>
            );
          })()}
        </g>
      )}

      {/* 3. The Glass Lantern Jar */}
      <g transform={`translate(${jarX} ${jarY})`}>
        {caught && (
          <g>
            <radialGradient id="starGlowInside" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFF7B8" stopOpacity="0.9" />
              <stop offset="35%" stopColor="#FFDE6A" stopOpacity="0.55" />
              <stop offset="70%" stopColor="#FFB338" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#FFA61F" stopOpacity="0" />
            </radialGradient>
            <circle cx={0} cy={10} r={170} fill="url(#starGlowInside)" />
          </g>
        )}

        {/* Jar Base Glass */}
        <rect
          x={-jarW / 2}
          y={-10}
          width={jarW}
          height={jarH}
          rx={18}
          fill="#D6EEFC"
          opacity={0.32}
        />
        {/* Glass Edge Highlights */}
        <rect
          x={-jarW / 2}
          y={-10}
          width={jarW}
          height={jarH}
          rx={18}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={3.5}
          opacity={0.65}
        />
        {/* Reflection vertical sheen */}
        <path
          d={`M${-jarW / 2 + 10} 2 L${-jarW / 2 + 10} ${jarH - 24}`}
          stroke="#FFFFFF"
          strokeWidth={5}
          strokeLinecap="round"
          opacity={0.45}
        />

        {/* Cork Lid & Twine */}
        <rect
          x={-jarW / 2 + 6}
          y={-24}
          width={jarW - 12}
          height={16}
          rx={5}
          fill="#C98B53"
        />
        <rect
          x={-jarW / 2 + 3}
          y={-12}
          width={jarW - 6}
          height={6}
          rx={2}
          fill="#A66F3E"
        />
        <ellipse cx={0} cy={-24} rx={(jarW - 12) / 2} ry={5} fill="#DFA46C" />

        {/* The Trapped Star Pulsing Inside */}
        {caught && (
          <g
            transform={`translate(0 ${
              14 + Math.sin((t - plan.catchAt) / 250) * 4
            }) rotate(${((t - plan.catchAt) / 30) % 360})`}
          >
            <circle r={22} fill="#FFFAD1" opacity={0.5} />
            <path d={fourPointStar(22)} fill="#FFF275" />
            <path d={fourPointStar(14)} fill="#FFFFFF" />
          </g>
        )}
      </g>
    </g>
  );
}
