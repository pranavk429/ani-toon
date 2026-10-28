'use client';

import { bell, loop, seg, seeded, wave } from '../motion/engine';
import type { Compiled } from './compile';
import { FEET, SCALE, STAGE } from './rig';
import { fourPointStar, mix, petalShape, pill, roundedTriangle, topRound } from './shapes';
import type { SceneSpec } from './types';

// Backgrounds are layered and quietly alive: clouds drift in parallax, stars
// twinkle at seeded times, grass tufts sway with daisies, kitchen utensils
// swing on their hooks, and the stove burner flickers with 12 blue flame petals.

const per = (D: number, target: number) => D / Math.max(1, Math.round(D / target));

export function worldFloor(spec: SceneSpec): string {
  switch (spec.world.preset) {
    case 'garden':
      return '#CDEAB4';
    case 'night':
      return '#223066';
    case 'kitchen':
      return '#E2A862';
    case 'studio':
      return mix(spec.world.accent, '#FFFFFF', 0.48);
    default:
      return '#D3ECFA';
  }
}

export function worldHidesLegs(spec: SceneSpec) {
  return spec.world.preset === 'kitchen';
}

function Daisy({ r }: { r: number }) {
  return (
    <g>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        return (
          <circle
            key={i}
            cx={Math.cos(a) * r * 1.2}
            cy={Math.sin(a) * r * 1.2}
            r={r}
            fill="#FFFFFF"
          />
        );
      })}
      <circle cx={0} cy={0} r={r * 0.8} fill="#FFD84D" />
    </g>
  );
}

function Twinkles({
  t,
  D,
  fill,
  n = 9,
  region = [0, 0, 720, 800] as number[],
}: {
  t: number;
  D: number;
  fill: string;
  n?: number;
  region?: number[];
}) {
  const P = per(D, 1800);
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const p = loop(t, P, seeded(i, 2)) / 0.45;
        if (p >= 1) return null;
        const x = region[0] + seeded(i, 7) * region[2];
        const y = region[1] + seeded(i, 9) * region[3];
        const s = bell(p);
        return (
          <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
            <path d={fourPointStar(8 + seeded(i, 5) * 8)} fill={fill} />
          </g>
        );
      })}
    </>
  );
}

export function WorldBack({ spec, t }: { spec: SceneSpec; t: number }) {
  const D = spec.duration;
  const { preset, accent } = spec.world;
  const W = STAGE.w;
  const H = STAGE.h;
  const floorY = FEET.y;

  if (preset === 'night') {
    return (
      <g>
        <defs>
          <linearGradient id="nightG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#080C22" />
            <stop offset="0.55" stopColor="#12183B" />
            <stop offset="0.85" stopColor="#1C2758" />
            <stop offset="1" stopColor="#25356D" />
          </linearGradient>
          <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFF9D2" stopOpacity="0.45" />
            <stop offset="60%" stopColor="#FFF2A3" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#FFF2A3" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#nightG)" />
        {/* Moon Glow & Crescent Moon */}
        <circle cx={570} cy={210} r={140} fill="url(#moonGlow)" />
        <g transform="translate(570 210) rotate(-18)">
          <circle cx={0} cy={0} r={58} fill="#FFF6C2" />
          <circle cx={20} cy={-12} r={52} fill="#0E1433" />
        </g>
        {/* Constellations and Twinkles */}
        <Twinkles t={t} D={D} fill="#FFFFFF" n={24} region={[20, 30, 680, 750]} />
        {/* Rolling Midnight Hills */}
        <ellipse cx={160} cy={floorY - 60} rx={440} ry={110} fill="#18234D" />
        <ellipse cx={600} cy={floorY - 40} rx={420} ry={95} fill="#1F2C5F" />
        <ellipse cx={360} cy={floorY + 12} rx={460} ry={90} fill="#162045" />
      </g>
    );
  }

  if (preset === 'studio') {
    const bg = mix(accent, '#FFFFFF', 0.84);
    const blob = mix(accent, '#FFFFFF', 0.7);
    const confetti = Array.from({ length: 20 }, (_, i) => i);
    const P = per(D, 7000);
    return (
      <g>
        <rect width={W} height={H} fill={bg} />
        <circle cx={120 + 10 * wave(t, D, 0.1)} cy={300} r={190} fill={blob} />
        <circle cx={640 - 10 * wave(t, D, 0.4)} cy={620} r={230} fill={blob} />
        <ellipse cx={360} cy={floorY + 6} rx={380} ry={80} fill={mix(accent, '#FFFFFF', 0.62)} />
        {confetti.map((i) => {
          const p = loop(t, P * (0.8 + seeded(i, 1) * 0.4), seeded(i, 2));
          const x = 20 + seeded(i, 3) * 680 + 12 * wave(t, per(D, 3000), seeded(i, 4));
          const y = -20 + p * (floorY - 120);
          const col = [accent, '#FFD84A', '#FF6B6B', '#3EC6A8'][i % 4];
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={9}
              height={18}
              rx={3}
              fill={col}
              transform={`rotate(${p * 540 * (i % 2 ? 1 : -1)} ${x} ${y})`}
            />
          );
        })}
      </g>
    );
  }

  if (preset === 'kitchen') {
    // Ported from ChefScene.swift L380-428: tiles behind stove, swinging ladle/spatula/whisk, shelf with jar & plant
    return (
      <g>
        <rect width={W} height={H} fill="#FBF2DF" />
        {/* Band of tiles behind the stove */}
        {[0, 1, 2, 3].map((row) => (
          <g key={row} fill="#F2E2C4">
            {Array.from({ length: 12 }, (_, col) => (
              <rect
                key={col}
                x={col * 56 + (row % 2 === 0 ? 0 : 28) + 24}
                y={640 + row * 56}
                width={50}
                height={50}
                rx={8}
              />
            ))}
          </g>
        ))}

        {/* Utensil rail on left */}
        <path d={pill(145, 290, 130, 12)} fill="#BF7F45" />
        {[
          { x: 100, period: per(D, 4800), amp: 4, kind: 0 },
          { x: 145, period: per(D, 3200), amp: 5, kind: 1 },
          { x: 190, period: per(D, 2400), amp: 6, kind: 2 },
        ].map((hk, i) => (
          <g
            key={i}
            transform={`translate(${hk.x} 294) rotate(${hk.amp * wave(t, hk.period, seeded(i, 3))})`}
          >
            <ellipse
              cx={0}
              cy={2}
              rx={6}
              ry={7}
              fill="none"
              stroke="#8C98A6"
              strokeWidth={3}
            />
            {hk.kind === 0 && (
              <>
                <path d={pill(0, 62, 10, 110)} fill="#AEB8C4" />
                <ellipse cx={0} cy={112} rx={20} ry={15} fill="#8C98A6" />
              </>
            )}
            {hk.kind === 1 && (
              <>
                <path d={pill(0, 48, 11, 76)} fill="#D99A5B" />
                <rect x={-17} y={80} width={34} height={46} rx={9} fill="#BF7F45" />
              </>
            )}
            {hk.kind === 2 && (
              <>
                <path d={pill(0, 42, 11, 62)} fill="#D99A5B" />
                {[12, 20, 28].map((w) => (
                  <ellipse
                    key={w}
                    cx={0}
                    cy={96}
                    rx={w / 2}
                    ry={28}
                    fill="none"
                    stroke="#AEB8C4"
                    strokeWidth={3}
                  />
                ))}
              </>
            )}
          </g>
        ))}

        {/* Wooden shelf on right with flour jar and 3-leaf swaying potted plant */}
        <rect x={510} y={470} width={160} height={12} rx={6} fill="#BF7F45" />
        <g>
          <rect x={582} y={392} width={44} height={78} rx={11} fill="#E6F2F8" />
          <rect x={587} y={422} width={34} height={43} rx={7} fill="#FFFDF7" />
          <rect x={579} y={382} width={50} height={13} rx={6} fill="#FF6B5B" />
        </g>
        <g transform="translate(545 442)">
          {[-28, 0, 26].map((ang, i) => (
            <g
              key={i}
              transform={`rotate(${ang + 4 * wave(t, per(D, 3200), 0.15 * i)})`}
            >
              <ellipse cx={0} cy={-26} rx={10} ry={25} fill="#58C27D" />
            </g>
          ))}
          <path d={topRound(-18, -4, 36, 32, 7)} fill="#E57F5E" />
        </g>
      </g>
    );
  }

  if (preset === 'garden') {
    // Ported from GardenScene.swift L273-320: sky gradient, drifting puff clouds, hills, meadow, grass tufts & daisies
    const horizon = floorY - 125;
    const clouds = [
      { x: 190, y: 240, s: 1.15 },
      { x: 530, y: 170, s: 0.95 },
      { x: 640, y: 340, s: 0.8 },
      { x: 90, y: 380, s: 0.85 },
    ];
    const tufts = [
      { x: 120, y: horizon + 35, s: 0.75, daisy: true },
      { x: 610, y: horizon + 28, s: 0.7, daisy: false },
      { x: 370, y: horizon + 18, s: 0.6, daisy: false },
      { x: 110, y: floorY + 75, s: 1.15, daisy: false },
      { x: 615, y: floorY + 65, s: 1.05, daisy: true },
      { x: 260, y: floorY + 135, s: 1.2, daisy: false },
      { x: 485, y: floorY + 165, s: 1.1, daisy: true },
      { x: 165, y: floorY + 190, s: 1.0, daisy: false },
    ];
    return (
      <g>
        <defs>
          <linearGradient id="gardenG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#A9E4FF" />
            <stop offset="0.75" stopColor="#E8F8FF" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill="url(#gardenG)" />
        {clouds.map((c, i) => (
          <g
            key={i}
            transform={`translate(${c.x + 12 * wave(t, D, i * 0.27)} ${c.y}) scale(${c.s})`}
            fill="#FFFFFF"
          >
            <circle cx={-30} cy={0} r={24} />
            <circle cx={0} cy={-14} r={30} />
            <circle cx={32} cy={-2} r={22} />
            <rect x={-56} y={-4} width={112} height={26} rx={13} />
          </g>
        ))}
        <ellipse cx={120} cy={horizon + 20} rx={380} ry={75} fill="#D6F0BF" />
        <ellipse cx={620} cy={horizon + 28} rx={360} ry={65} fill="#C9EBAE" />
        <rect y={horizon} width={W} height={H - horizon} fill="#E3F6D1" />
        {tufts.map((f, i) => {
          const rot =
            4 * wave(t, per(D, 2500), seeded(i, 21)) +
            2 * wave(t, per(D, 1250), seeded(i, 22));
          return (
            <g
              key={i}
              transform={`translate(${f.x} ${f.y}) scale(${f.s}) rotate(${rot})`}
            >
              {(
                [
                  [-7, 22, -18],
                  [0, 30, 4],
                  [7, 20, 22],
                ] as const
              ).map(([dx, h, lean], j) => (
                <g key={j} transform={`translate(${dx} 0) rotate(${lean})`}>
                  <path
                    d={roundedTriangle(
                      { x: -4, y: 0 },
                      { x: 4, y: 0 },
                      { x: 0, y: -h },
                      2,
                    )}
                    fill="#9CD481"
                  />
                </g>
              ))}
              {f.daisy && (
                <g transform="translate(0 -34)">
                  <Daisy r={4.2} />
                </g>
              )}
            </g>
          );
        })}
        <Twinkles t={t} D={D} fill="#FFFFFF" n={5} region={[40, 80, 640, 420]} />
      </g>
    );
  }

  // sky (RevealScene.swift L221-243)
  return (
    <g>
      <defs>
        <linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#84D8FF" />
          <stop offset={0.52} stopColor="#DDF4FF" />
          <stop offset={0.82} stopColor="#FFFFFF" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#skyG)" />
      {(
        [
          [-10, 420, 96, 0.0],
          [66, 330, 62, 0.17],
          [730, 520, 104, 0.34],
          [654, 410, 66, 0.51],
        ] as const
      ).map(([x, y, r, ph], i) => (
        <g key={i} transform={`translate(${8 * wave(t, D, ph)} 0)`}>
          <circle cx={x} cy={y} r={r} fill="#B5E6FF" />
        </g>
      ))}
      <Twinkles t={t} D={D} fill="#FFFFFF" n={9} region={[60, 80, 600, 560]} />
    </g>
  );
}

/**
 * In front of the character in the kitchen: butcher-block counter, stove knobs,
 * oven door with breathing warm glow, and live gas burner with 12 flickering blue petals
 * (ChefScene.swift L621-678).
 */
export function WorldFront({
  spec,
  compiled,
  t,
}: {
  spec: SceneSpec;
  compiled?: Compiled;
  t: number;
}) {
  if (spec.world.preset !== 'kitchen') return null;
  const D = spec.duration;
  const counterBack = FEET.y - 68 * SCALE;
  const counterFront = counterBack + 36;
  const counterLip = 14;

  // Gas flare turns up during toss / hat-catch flips (ChefScene.swift L650-653)
  let flare = 0;
  if (compiled) {
    for (const p of compiled.props) {
      if (p.type === 'toss') {
        flare += seg(t, p.launch - 250, p.launch) * (1 - seg(t, p.land, p.land + 350));
      } else if (p.type === 'hat-catch') {
        flare += seg(t, p.toss - 250, p.toss) * (1 - seg(t, p.onHat + 200, p.onHat + 600));
      }
    }
  }
  flare = Math.min(1, flare);

  const b = 1 + 0.06 * wave(t, per(D, 2400), 0.3) + 0.03 * wave(t, per(D, 1600));
  const burnerX = 350;
  const burnerY = counterBack + 18;

  return (
    <g>
      {/* Butcher-block top, lip, and teal stove body */}
      <rect y={counterBack} width={STAGE.w} height={counterFront - counterBack} fill="#F3C27E" />
      <rect y={counterFront} width={STAGE.w} height={counterLip} fill="#E2A862" />
      <rect
        y={counterFront + counterLip}
        width={STAGE.w}
        height={STAGE.h - counterFront - counterLip}
        fill="#33B2A6"
      />

      {/* 4 Stove knobs; knob #1 rotates with `flare` */}
      {[240, 310, 410, 480].map((x, i) => (
        <g key={x}>
          <circle cx={x} cy={counterFront + 44} r={14} fill="#FFF3DC" />
          <g
            transform={`translate(${x} ${counterFront + 44}) rotate(${i * 50 - 60 + (i === 1 ? 70 * flare : 0)})`}
          >
            <path d={pill(0, -5, 5, 11)} fill="#1F5E5A" />
          </g>
        </g>
      ))}

      {/* Oven door, handle, and breathing warm glow in window */}
      <rect
        x={150}
        y={counterFront + 76}
        width={420}
        height={260}
        rx={24}
        fill="#27978D"
      />
      <path d={pill(360, counterFront + 92, 300, 12)} fill="#FFF3DC" />
      <defs>
        <clipPath id="ovenWin">
          <rect
            x={190}
            y={counterFront + 112}
            width={340}
            height={175}
            rx={18}
          />
        </clipPath>
      </defs>
      <rect
        x={190}
        y={counterFront + 112}
        width={340}
        height={175}
        rx={18}
        fill="#1F5E5A"
      />
      <g clipPath="url(#ovenWin)">
        <ellipse
          cx={360}
          cy={counterFront + 210}
          rx={140 * b}
          ry={46 * b}
          fill="#E9893B"
        />
        <ellipse
          cx={360}
          cy={counterFront + 214}
          rx={78 * b}
          ry={24 * b}
          fill="#FFD166"
        />
      </g>
      <rect
        x={214}
        y={counterFront + 124}
        width={76}
        height={12}
        rx={6}
        fill="#33B2A6"
      />

      {/* Burner ring and 12 flickering blue flame petals (ChefScene.swift L655-668) */}
      <ellipse cx={burnerX} cy={burnerY} rx={68} ry={18} fill="#2A2E37" />
      <ellipse cx={burnerX} cy={burnerY} rx={48} ry={13} fill="#1E2229" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const fx = burnerX + 56 * Math.cos(a);
        const fy = burnerY + 14 * Math.sin(a);
        const flick =
          1 +
          0.18 * wave(t, 400, seeded(i, 1)) +
          0.12 * wave(t, 640, seeded(i, 2));
        const hgt = 19 * flick * (1 + 0.45 * flare);
        return (
          <g key={i}>
            <path d={petalShape(fx, fy, 13, hgt)} fill="#4FA8FF" />
            <path d={petalShape(fx, fy, 6.5, hgt * 0.55)} fill="#BCE3FF" />
          </g>
        );
      })}
    </g>
  );
}
