/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { seg } from '../motion/engine';
import {
  FallingPetals,
  FloatingHearts,
  GardenButterfly,
  GardenPlant,
  GardenPot,
  MysteryActor,
  Pancake,
  Pan,
  ShootingStarAndJar,
  SoccerBall,
  Steam,
  Telescope,
  WaterDrops,
} from './Actors';
import { Kid, KidForearms } from './Kid';
import { compile, panStateAt, poseAt, propAt, type Compiled } from './compile';
import { PROP_K, STAGE } from './rig';
import { WorldBack, WorldFront, worldFloor, worldHidesLegs } from './World';

function SimpleProp({
  kind,
  color,
  x,
  y,
  rot,
  squash,
}: {
  kind: string;
  color: string;
  x: number;
  y: number;
  rot: number;
  squash: number;
}) {
  const sx = 1 + 0.1 * squash;
  const sy = 1 - 0.15 * squash;
  const base = `translate(${x} ${y}) scale(${sx * PROP_K} ${sy * PROP_K})`;

  switch (kind) {
    case 'cup':
      return (
        <g transform={`${base} rotate(${rot * 0.2})`}>
          <path
            d="M18 -10h10a10 10 0 0 1 0 22h-10"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={6}
          />
          <path
            d="M-22 -22h40v34a10 10 0 0 1-10 10h-20a10 10 0 0 1-10-10z"
            fill="#FFFFFF"
          />
          <rect x={-22} y={-8} width={40} height={10} fill={color} />
        </g>
      );
    case 'gift':
      return (
        <g transform={`${base} rotate(${rot * 0.5})`}>
          <rect x={-30} y={-26} width={60} height={52} rx={8} fill={color} />
          <rect x={-6} y={-26} width={12} height={52} fill="#FFFFFF" />
          <rect x={-30} y={-6} width={60} height={12} fill="#FFFFFF" />
          <circle cx={-10} cy={-32} r={9} fill="#FFFFFF" />
          <circle cx={10} cy={-32} r={9} fill="#FFFFFF" />
        </g>
      );
    case 'heart':
      return (
        <path
          transform={`${base} rotate(${rot * 0.3}) scale(1.6)`}
          d="M0 14C-34 -8 -22 -34 0 -16C22 -34 34 -8 0 14Z"
          fill={color}
        />
      );
    case 'star': {
      const pts = Array.from({ length: 10 }, (_, i) => {
        const r = i % 2 ? 14 : 34;
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`;
      }).join(' ');
      return (
        <polygon transform={`${base} rotate(${rot})`} points={pts} fill={color} />
      );
    }
    default:
      return null;
  }
}

export function ToonFrame({ compiled, t }: { compiled: Compiled; t: number }) {
  const { spec } = compiled;
  const pose = poseAt(compiled, t);
  const prop = propAt(compiled, t);
  const hasDrop = compiled.drops.length > 0;
  const hasMystery = compiled.mysteries.length > 0;
  const characterOpacity =
    hasDrop || hasMystery ? seg(t, compiled.appearAt, compiled.appearAt + 180) : 1;

  const isGarden =
    spec.world.preset === 'garden' ||
    compiled.blooms.length > 0 ||
    compiled.pours.length > 0;
  const isKitchen = spec.world.preset === 'kitchen';
  const hasPan =
    spec.prop.kind === 'pancake' &&
    compiled.props.some((p) => p.type === 'toss' || p.type === 'hat-catch');
  const holdingCan =
    spec.prop.kind === 'watering-can' || compiled.pours.length > 0;
  const isNight = spec.world.preset === 'night';
  const hasStarCatch = compiled.starCatches.length > 0;

  return (
    <svg
      viewBox={`0 0 ${STAGE.w} ${STAGE.h}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={spec.title}
    >
      <WorldBack spec={spec} t={t} />

      {/* Brass Telescope for Stargazer */}
      {isNight && <Telescope t={t} />}

      {/* Garden Pot & Sprouting/Blooming Plant */}
      {isGarden && (
        <>
          <GardenPot compiled={compiled} t={t} />
          <GardenPlant compiled={compiled} t={t} />
        </>
      )}

      {/* Mystery silhouette opener before character drops in */}
      {hasMystery && t < compiled.appearAt && (
        <MysteryActor compiled={compiled} pose={pose} t={t} />
      )}

      {/* Character */}
      {characterOpacity > 0 && (
        <Kid
          ch={spec.character}
          pose={pose}
          floor={worldFloor(spec)}
          opacity={characterOpacity}
          hideLegs={worldHidesLegs(spec)}
          holdingCan={holdingCan}
          canColor={spec.prop.color}
        />
      )}

      {/* Kitchen pan & pancake with forearms drawn in front so hand closes over handle */}
      {hasPan && (
        <>
          <Pan ps={panStateAt(compiled, t)} />
          <KidForearms ch={spec.character} pose={pose} />
          {prop.visible && <Pancake prop={prop} color={spec.prop.color} />}
          <Steam compiled={compiled} prop={prop} t={t} />
        </>
      )}

      {/* Soccer Ball */}
      {spec.prop.kind === 'ball' && prop.visible && <SoccerBall prop={prop} />}

      {/* Stargazer: Falling Star Arc, Glass Lantern Jar & Trapped Pulsing Star */}
      {hasStarCatch && (
        <ShootingStarAndJar compiled={compiled} prop={prop} t={t} />
      )}

      {/* Other Props (gift, cup, star, heart) */}
      {spec.prop.kind !== 'pancake' &&
        spec.prop.kind !== 'ball' &&
        spec.prop.kind !== 'watering-can' &&
        !(spec.prop.kind === 'star' && hasStarCatch) &&
        spec.prop.kind !== 'none' &&
        prop.visible && (
          <SimpleProp
            kind={spec.prop.kind}
            color={spec.prop.color}
            x={prop.x}
            y={prop.y}
            rot={prop.rot}
            squash={prop.squash}
          />
        )}

      {/* Water Drops & Splashes */}
      {holdingCan && <WaterDrops compiled={compiled} pose={pose} t={t} />}

      {/* Garden Petals, Butterfly, and Floating Hearts */}
      {isGarden && (
        <>
          <FallingPetals compiled={compiled} t={t} />
          <GardenButterfly compiled={compiled} t={t} />
          <FloatingHearts compiled={compiled} t={t} />
        </>
      )}

      {/* Foreground elements (e.g. kitchen stove counter, flickering burner, glowing oven) */}
      <WorldFront spec={spec} compiled={compiled} t={t} />
    </svg>
  );
}

/** Live player: one clock, paused when hidden, still on reduced motion. */
export function ToonPlayer({ rawSpec, fixedT }: { rawSpec: unknown; fixedT?: number }) {
  const compiled = useMemo(() => compile(rawSpec), [rawSpec]);
  const [t, setT] = useState(fixedT ?? 0);
  const raf = useRef(0);

  useEffect(() => {
    if (fixedT !== undefined) {
      setT(fixedT);
      return;
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setT(compiled.spec.duration - 1);
      return;
    }
    let start = performance.now();
    const tick = (now: number) => {
      if (document.visibilityState === 'visible')
        setT((now - start) % compiled.spec.duration);
      else start = now - t;
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compiled, fixedT]);

  return <ToonFrame compiled={compiled} t={t} />;
}
