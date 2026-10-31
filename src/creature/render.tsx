'use client';

import { useId, useMemo } from 'react';

import { apply, faceMatrix, toSvg } from './math';
import { mix } from '../toon/shapes';
import { scenePoseAt, type ActorPose } from './pose';
import { applyMotionToScene } from './motion';
import { ObjectLayer } from './objectLayer';
import type { MotionDocument } from '@/lib/animation/types';
import {
  ART,
  clothOf,
  darken,
  hairOf,
  lighten,
  muzzleOf,
  noseOf,
  shadowOf,
  trimOf,
} from './style';
import { fitScene, sceneTransforms, type ActorTransforms, type Fit } from './transforms';
import {
  DEFAULT_HUMAN,
  type AccessorySpec,
  type Actor,
  type BodyPlan,
  type Bone,
  type Genome,
  type HumanLook,
  type Scene,
} from './types';

// The creature stage is square, like the 1080x1080 Anitoon clips. One viewBox,
// one fit, one style. The backdrop is stage-agnostic so a horse and an octopus
// can share the same frame.
//
// The look is a hard-cel flat vector toy, not a visible rig with skin stretched
// over it. See docs/ART-STYLE.md. The skeleton still drives every pixel; it is
// simply not drawn as a skeleton.

function humanOf(genome: Genome): HumanLook {
  return genome.human ?? DEFAULT_HUMAN;
}

export function SceneFrame({
  scene,
  t,
  showSkeleton = false,
  motion = null,
}: {
  scene: Scene;
  t: number;
  showSkeleton?: boolean;
  motion?: MotionDocument | null;
}) {
  const basePose = scenePoseAt(scene, t);
  const frame = applyMotionToScene(scene, basePose, motion, t);
  const pose = frame.pose;
  const transforms = sceneTransforms(scene, pose);
  const fit = useMemo(() => fitScene(scene, 720, 720), [scene]);
  const actors = useMemo(
    () => [...scene.actors].sort((a, b) => a.depth - b.depth),
    [scene.actors],
  );

  return (
    <svg
      viewBox="0 0 720 720"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={scene.title}
    >
      <SceneBackdrop world={scene.world} t={t} />
      <ObjectLayer frames={frame.backObjects} />
      {actors.map((actor) => {
        const tr = transforms.get(actor.id);
        if (!tr) return null;
        return (
          <ActorView
            key={actor.id}
            actor={actor}
            pose={pose[actor.id]}
            transforms={tr}
            fit={fit}
            t={t}
            night={scene.world.preset === 'night'}
          />
        );
      })}
      <ObjectLayer frames={frame.frontObjects} />
      {showSkeleton && <SkeletonOverlay scene={scene} transforms={transforms} fit={fit} />}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Backdrops: flat planes, flat shapes, no gradients.

function SceneBackdrop({ world, t }: { world: Scene['world']; t: number }) {
  const { preset, accent } = world;
  const { sky, ground, hill } = worldColors(preset, accent);

  return (
    <g>
      <rect width={720} height={720} fill={sky} />

      {preset === 'night' && <NightBack />}
      {preset === 'sky' && <SkyBack t={t} />}
      {preset === 'garden' && <GardenBack />}
      {preset === 'studio' && <StudioBack accent={accent} />}
      {preset === 'kitchen' && <KitchenBack />}
      <WorldBack preset={preset} t={t} />

      {/* Flat horizon with a gentle curve. No gradient, no vignette. */}
      <path d="M0 568 Q180 546 360 560 T720 552 V720 H0 Z" fill={ground} />
      <path d="M0 612 Q220 590 420 606 T720 598 V720 H0 Z" fill={hill} opacity={preset === 'night' ? 0.55 : 0.6} />
      <WorldFront preset={preset} t={t} />
      {preset === 'court' && <CourtBack accent={accent} />}
    </g>
  );
}

function worldColors(
  preset: Scene['world']['preset'],
  accent: string,
): { sky: string; ground: string; hill: string } {
  switch (preset) {
    case 'night':
      return { sky: ART.night, ground: '#2E345E', hill: '#3A4270' };
    case 'garden':
      return { sky: '#EAF4D8', ground: ART.moss, hill: ART.mossDeep };
    case 'kitchen':
      return { sky: '#FCEBD2', ground: '#E2AE72', hill: '#D59A58' };
    case 'studio':
      return {
        sky: ART.cream,
        ground: mix(accent, ART.cream, 0.72),
        hill: mix(accent, ART.cream, 0.5),
      };
    case 'court':
      return { sky: ART.sky, ground: '#77B27A', hill: '#6AA56E' };
    case 'meadow':
      return { sky: '#CFEBF4', ground: '#8FC96F', hill: '#74B25E' };
    case 'forest':
      return { sky: '#BFD9B4', ground: '#5B8B52', hill: '#466E45' };
    case 'sunset':
      return { sky: '#F7B27A', ground: '#7A4A5A', hill: '#5E384C' };
    case 'desert':
      return { sky: '#F9D9A6', ground: '#E8B96A', hill: '#D9A45E' };
    case 'winter':
      return { sky: '#D6E8F2', ground: '#EAF4F8', hill: '#D3E6EF' };
    case 'ocean':
      return { sky: '#CFEBF4', ground: '#F2D6A2', hill: '#5FB7C9' };
    case 'autumn':
      return { sky: '#F7E4C8', ground: '#C98A47', hill: '#A86A3C' };
    case 'rain':
      return { sky: '#9FB0C0', ground: '#6E8296', hill: '#5B7184' };
    case 'sakura':
      return { sky: '#FBE4EC', ground: '#CFA6A6', hill: '#B98C92' };
    default:
      return { sky: ART.sky, ground: '#BEE3D2', hill: '#A9D8C4' };
  }
}

/** Sky-layer scenery: sun, clouds, tree silhouettes, distant hills. Drawn
 * before the flat horizon so the ground stays one clean mass. */
function WorldBack({
  preset,
  t,
}: {
  preset: Scene['world']['preset'];
  t: number;
}) {
  if (preset === 'meadow') {
    return (
      <g>
        <circle cx={128} cy={112} r={48} fill="#FFE7A3" />
        <Cloud x={((120 + t / 60) % 860) - 70} y={148} s={1} />
        <Cloud x={((470 + t / 80) % 860) - 70} y={224} s={0.7} />
        <path d="M0 552 Q120 512 250 540 T520 528 T720 548 V580 H0 Z" fill="#A4D889" />
      </g>
    );
  }
  if (preset === 'forest') {
    return (
      <g>
        <circle cx={590} cy={104} r={40} fill="#D8E8A8" opacity={0.7} />
        <path d="M150 0 L250 0 L330 548 L180 548 Z" fill="#EAF4D8" opacity={0.16} />
        <path d="M420 0 L490 0 L540 548 L440 548 Z" fill="#EAF4D8" opacity={0.13} />
        {[60, 150, 590, 680].map((x, i) => (
          <g key={x} opacity={0.8}>
            <rect x={x - 7} y={410} width={14} height={160} rx={7} fill="#5B4633" />
            <circle cx={x} cy={392 - (i % 2) * 18} r={54} fill="#2F5A3A" />
            <circle cx={x - 34} cy={430} r={38} fill="#3D6E45" />
            <circle cx={x + 36} cy={424} r={42} fill="#35663F" />
          </g>
        ))}
      </g>
    );
  }
  if (preset === 'sunset') {
    return (
      <g>
        <rect y={0} width={720} height={190} fill="#F8C48F" />
        <rect y={190} width={720} height={160} fill="#F4A06E" />
        <rect y={350} width={720} height={140} fill="#EE8A65" />
        <circle cx={360} cy={430} r={62} fill="#FFD27A" />
        <path d="M0 508 Q100 462 210 492 T440 480 T720 502 V560 H0 Z" fill="#8E4F63" />
        <path d="M0 544 Q160 508 320 532 T720 524 V570 H0 Z" fill="#6B3F55" />
        {[
          [140, 150, 0.9],
          [214, 122, 0.7],
          [508, 176, 0.8],
        ].map(([x, y, s], i) => (
          <Bird key={i} x={x + Math.sin(t / 2100 + i) * 12} y={y} s={s} color="#7A4258" />
        ))}
      </g>
    );
  }
  if (preset === 'desert') {
    return (
      <g>
        <circle cx={584} cy={112} r={46} fill="#FFE7A3" />
        <rect y={0} width={720} height={220} fill="#F9D9A6" />
        <rect y={220} width={720} height={220} fill="#F5C98A" />
        <path d="M0 512 Q150 452 300 496 T720 486 V560 H0 Z" fill="#E8B96A" />
        <path d="M0 548 Q180 506 380 536 T720 526 V572 H0 Z" fill="#D9A45E" />
      </g>
    );
  }
  if (preset === 'winter') {
    return (
      <g>
        <circle cx={592} cy={110} r={42} fill="#FBF3DA" opacity={0.85} />
        <path d="M0 512 Q140 462 290 500 T720 494 V560 H0 Z" fill="#C4DDE9" />
        {[80, 180, 550, 650].map((x, i) => (
          <g key={x}>
            <rect x={x - 5} y={450} width={10} height={92} rx={5} fill="#8A9BAC" />
            <path
              d={`M ${x - 38} 470 L ${x} ${382 - (i % 2) * 14} L ${x + 38} 470 Z`}
              fill="#5E8C7E"
            />
            <path
              d={`M ${x - 28} 436 L ${x} ${396 - (i % 2) * 14} L ${x + 28} 436 Z`}
              fill="#EEF6FA"
              opacity={0.9}
            />
          </g>
        ))}
      </g>
    );
  }
  if (preset === 'ocean') {
    return (
      <g>
        <circle cx={590} cy={104} r={44} fill="#FFE7A3" />
        <Cloud x={132} y={148} s={0.9} />
        <Cloud x={468} y={206} s={0.55} />
        <rect y={462} width={720} height={112} fill="#5FB7C9" />
        {[0, 1, 2, 3].map((i) => (
          <path
            key={i}
            d={`M ${-40 + i * 190} ${492 + (i % 2) * 16} q 34 -18 68 0 t 68 0 t 68 0 v 10 h -204 Z`}
            fill="#8FD3DF"
            opacity={0.8}
          />
        ))}
        {[
          [120, 140, 0.7],
          [208, 112, 0.55],
          [520, 168, 0.65],
        ].map(([x, y, s], i) => (
          <Bird key={i} x={x + Math.sin(t / 2400 + i) * 16} y={y} s={s} color="#4F7D8C" />
        ))}
      </g>
    );
  }
  if (preset === 'autumn') {
    return (
      <g>
        <circle cx={130} cy={118} r={44} fill="#FFE7A3" />
        <Cloud x={((180 + t / 70) % 860) - 70} y={210} s={0.65} />
        {[70, 170, 570, 668].map((x, i) => (
          <g key={x}>
            <rect x={x - 8} y={430} width={16} height={150} rx={8} fill="#7A4E32" />
            <circle cx={x} cy={404} r={52} fill={i % 2 ? '#C96B3E' : '#D98A45'} />
            <circle cx={x - 36} cy={436} r={36} fill={i % 2 ? '#B45A36' : '#C9763A'} />
            <circle cx={x + 36} cy={430} r={40} fill={i % 2 ? '#D98A45' : '#E09A4E'} />
          </g>
        ))}
      </g>
    );
  }
  if (preset === 'rain') {
    return (
      <g>
        <rect y={0} width={720} height={260} fill="#93A6B8" />
        <rect y={260} width={720} height={290} fill="#A6B8C8" />
        <Cloud x={160} y={112} s={1.15} />
        <Cloud x={520} y={150} s={0.95} />
        <Cloud x={340} y={78} s={0.8} />
      </g>
    );
  }
  if (preset === 'sakura') {
    return (
      <g>
        <circle cx={140} cy={106} r={42} fill="#FFE7A3" opacity={0.8} />
        <Cloud x={((500 + t / 75) % 860) - 70} y={150} s={0.7} />
        {[80, 620].map((x, i) => (
          <g key={x}>
            <rect x={x - 9} y={430} width={18} height={150} rx={9} fill="#8A5A55" />
            <circle cx={x} cy={402} r={58} fill={i ? '#F4B6C6' : '#F7C4D0'} />
            <circle cx={x - 40} cy={438} r={38} fill="#EFA7BA" />
            <circle cx={x + 42} cy={430} r={42} fill="#F2B0C2" />
          </g>
        ))}
      </g>
    );
  }
  return null;
}

/** Ground-layer scenery: things that stand on the flat horizon, plus simple
 * time-driven particles. No gradients, no blur, no outlines. */
function WorldFront({
  preset,
  t,
}: {
  preset: Scene['world']['preset'];
  t: number;
}) {
  if (preset === 'meadow') {
    return (
      <g>
        {[
          [64, 638],
          [126, 668],
          [206, 644],
          [300, 676],
          [520, 648],
          [604, 676],
          [668, 640],
        ].map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <rect x={-1.2} y={0} width={2.4} height={14} rx={1.2} fill="#4E8A45" />
            {[0, 1, 2, 3].map((k) => {
              const a = (k / 4) * Math.PI * 2;
              return (
                <circle
                  key={k}
                  cx={Math.cos(a) * 4}
                  cy={-2 + Math.sin(a) * 4}
                  r={3}
                  fill={i % 3 === 0 ? '#FFF1DC' : i % 3 === 1 ? '#F2B84B' : '#F28C7E'}
                />
              );
            })}
            <circle cx={0} cy={-2} r={1.8} fill="#F2B84B" />
          </g>
        ))}
        {[0, 1].map((i) => (
          <g key={i} transform={`translate(${190 + i * 260 + Math.sin(t / 900 + i) * 18} ${330 + i * 40})`}>
            <ellipse cx={-5} cy={0} rx={6} ry={4} fill="#F7C948" transform="rotate(-24)" />
            <ellipse cx={5} cy={0} rx={6} ry={4} fill="#F7C948" transform="rotate(24)" />
            <rect x={-0.8} y={-3} width={1.6} height={8} rx={0.8} fill="#5B3A2B" />
          </g>
        ))}
      </g>
    );
  }
  if (preset === 'forest') {
    return (
      <g>
        {[24, 118, 612, 696].map((x, i) => (
          <g key={x}>
            <rect x={x - 8} y={470} width={16} height={190} rx={8} fill="#5B4633" />
            <circle cx={x} cy={452 - (i % 2) * 14} r={48} fill="#3D6E45" />
            <circle cx={x - 30} cy={482} r={32} fill="#2F5A3A" />
            <circle cx={x + 32} cy={476} r={34} fill="#35663F" />
          </g>
        ))}
        {[240, 336, 420, 500].map((x, i) => (
          <g key={x} transform={`translate(${x} 690)`}>
            {[-32, -16, 0, 16, 32].map((dx, k) => (
              <ellipse
                key={dx}
                cx={dx}
                cy={-18 - Math.abs(dx) * 0.2}
                rx={9}
                ry={24}
                fill={i % 2 ? '#2F6B45' : '#3A7A4E'}
                transform={`rotate(${dx * 1.5})`}
              />
            ))}
          </g>
        ))}
        {Array.from({ length: 18 }, (_, i) => {
          const x = ((i * 137) % 660) + 30;
          const y = ((i * 89) % 300) + 250;
          const glow = 0.35 + 0.5 * (0.5 + 0.5 * Math.sin(t / 700 + i));
          return <circle key={i} cx={x} cy={y} r={i % 4 === 0 ? 3 : 2} fill="#F7E28A" opacity={glow} />;
        })}
      </g>
    );
  }
  if (preset === 'sunset') {
    return (
      <g>
        <path d="M0 646 Q90 620 190 640 T400 634 T720 646 V720 H0 Z" fill="#4C2E44" />
        {[70, 160, 250, 470, 560, 650].map((x, i) => (
          <path
            key={x}
            d={`M ${x} 720 L ${x - 5} ${668 - (i % 3) * 10} L ${x + 5} ${668 - (i % 3) * 10} Z`}
            fill="#3E2539"
            opacity={0.85}
          />
        ))}
      </g>
    );
  }
  if (preset === 'desert') {
    return (
      <g>
        <path d="M0 596 Q140 560 300 590 T720 582 V720 H0 Z" fill="#E8B96A" />
        <path d="M0 646 Q180 612 360 640 T720 634 V720 H0 Z" fill="#D9A45E" />
        <g transform="translate(120 560)">
          <rect x={-15} y={-70} width={30} height={120} rx={15} fill="#4E8A5C" />
          <rect x={-15} y={-30} width={70} height={22} rx={11} fill="#4E8A5C" />
          <rect x={40} y={-52} width={20} height={44} rx={10} fill="#4E8A5C" />
          <rect x={-15} y={-20} width={42} height={18} rx={9} fill="#3D7049" opacity={0.5} />
        </g>
        <ellipse cx={600} cy={650} rx={42} ry={18} fill="#C98A47" />
        <ellipse cx={616} cy={642} rx={28} ry={12} fill="#B97A3F" />
        <circle cx={662} cy={676} r={12} fill="#C98A47" />
      </g>
    );
  }
  if (preset === 'winter') {
    return (
      <g>
        <path d="M0 620 Q140 592 280 614 T720 606 V720 H0 Z" fill="#F7FBFD" />
        <g transform="translate(112 592)">
          <rect x={-7} y={-56} width={14} height={100} rx={7} fill="#7A6A5A" />
          <rect x={-44} y={-28} width={40} height={9} rx={4.5} fill="#7A6A5A" transform="rotate(-24 -44 -28)" />
          <rect x={4} y={-42} width={40} height={9} rx={4.5} fill="#7A6A5A" transform="rotate(28 4 -42)" />
          <rect x={-32} y={-58} width={32} height={8} rx={4} fill="#7A6A5A" transform="rotate(-18 -32 -58)" />
        </g>
        {[240, 520, 640].map((x, i) => (
          <g key={x}>
            <rect x={x - 4} y={600} width={8} height={58} rx={4} fill="#8A9BAC" />
            <path d={`M ${x - 28} 620 L ${x} ${560 + (i % 2) * 8} L ${x + 28} 620 Z`} fill="#5E8C7E" />
            <path d={`M ${x - 19} 600 L ${x} ${576 + (i % 2) * 8} L ${x + 19} 600 Z`} fill="#EEF6FA" />
          </g>
        ))}
        {Array.from({ length: 34 }, (_, i) => {
          const x = ((i * 97) % 700) + 10;
          const speed = 0.5 + (i % 5) * 0.12;
          const y = ((i * 131 + (t / 18) * speed) % 760) - 20;
          return <circle key={i} cx={x + Math.sin(t / 1600 + i) * 8} cy={y} r={1.8 + (i % 3)} fill="#FFFFFF" opacity={0.75} />;
        })}
      </g>
    );
  }
  if (preset === 'ocean') {
    return (
      <g>
        <path d="M0 640 Q120 610 260 634 T520 628 T720 640 V720 H0 Z" fill="#F2D6A2" />
        <path d="M0 676 Q160 650 340 670 T720 664 V720 H0 Z" fill="#E8C48A" />
        {[0, 1, 2].map((i) => (
          <path
            key={i}
            d={`M ${40 + i * 220} ${560 + (i % 2) * 8} q 30 -16 60 0 t 60 0 v 8 h -120 Z`}
            fill="#8FD3DF"
            opacity={0.75}
          />
        ))}
        <g transform="translate(610 600)">
          <rect x={-6} y={-90} width={12} height={110} rx={6} fill="#8A5A3C" />
          {[-58, -20, 18, 56].map((rot, i) => (
            <ellipse
              key={i}
              cx={0}
              cy={-90}
              rx={8}
              ry={38}
              fill="#3F8A5E"
              transform={`rotate(${rot} 0 -90)`}
            />
          ))}
          <circle cx={-8} cy={-88} r={7} fill="#5B4633" />
          <circle cx={9} cy={-86} r={6} fill="#5B4633" />
        </g>
      </g>
    );
  }
  if (preset === 'autumn') {
    return (
      <g>
        <path d="M0 646 Q140 620 300 640 T720 632 V720 H0 Z" fill="#B97A3F" />
        {Array.from({ length: 16 }, (_, i) => {
          const x = ((i * 149) % 690) + 12;
          const speed = 0.4 + (i % 4) * 0.16;
          const y = ((i * 113 + (t / 20) * speed) % 740) - 20;
          return (
            <ellipse
              key={i}
              cx={x + Math.sin(t / 1400 + i) * 12}
              cy={y}
              rx={4}
              ry={2.2}
              fill={i % 3 === 0 ? '#E09A4E' : i % 3 === 1 ? '#C96B3E' : '#D98A45'}
              transform={`rotate(${(t / 30 + i * 40) % 360} ${x} ${y})`}
            />
          );
        })}
      </g>
    );
  }
  if (preset === 'rain') {
    return (
      <g>
        {Array.from({ length: 26 }, (_, i) => {
          const x = ((i * 83) % 700) + 8;
          const y = ((i * 127 + (t / 3.4) * (0.8 + (i % 4) * 0.1)) % 720) - 30;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={2}
              height={i % 4 === 0 ? 26 : 18}
              rx={1}
              fill="#D7E7F2"
              opacity={0.55}
            />
          );
        })}
        <ellipse cx={170} cy={684} rx={58} ry={12} fill="#8FA6B8" />
        <ellipse cx={540} cy={700} rx={74} ry={14} fill="#8FA6B8" />
        <ellipse cx={170} cy={682} rx={40} ry={7} fill="#B6CAD8" opacity={0.7} />
      </g>
    );
  }
  if (preset === 'sakura') {
    return (
      <g>
        <path d="M0 646 Q140 620 300 640 T720 632 V720 H0 Z" fill="#C99A9A" />
        <g transform="translate(130 596)">
          <rect x={-9} y={-120} width={18} height={150} rx={9} fill="#8A5A55" />
          <rect x={-60} y={-96} width={54} height={13} rx={6.5} fill="#8A5A55" transform="rotate(-26 -60 -96)" />
          <rect x={6} y={-72} width={54} height={13} rx={6.5} fill="#8A5A55" transform="rotate(22 6 -72)" />
          <circle cx={0} cy={-126} r={46} fill="#F2B0C2" />
          <circle cx={-38} cy={-100} r={30} fill="#EFA7BA" />
          <circle cx={40} cy={-98} r={32} fill="#F7C4D0" />
        </g>
        {Array.from({ length: 18 }, (_, i) => {
          const x = ((i * 127) % 690) + 12;
          const speed = 0.36 + (i % 4) * 0.14;
          const y = ((i * 101 + (t / 24) * speed) % 740) - 20;
          return (
            <ellipse
              key={i}
              cx={x + Math.sin(t / 1500 + i) * 14}
              cy={y}
              rx={4.4}
              ry={2.4}
              fill={i % 3 === 0 ? '#F7C4D0' : '#F2B0C2'}
              transform={`rotate(${(t / 26 + i * 33) % 360} ${x} ${y})`}
            />
          );
        })}
      </g>
    );
  }
  return null;
}

function Bird({ x, y, s, color }: { x: number; y: number; s: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={color}>
      <path d="M -14 0 Q -7 -7 -1 0 Q -7 -3 -14 0 Z" />
      <path d="M 1 0 Q 7 -7 14 0 Q 7 -3 1 0 Z" />
    </g>
  );
}

function NightBack() {
  return (
    <g>
      <circle cx={585} cy={112} r={46} fill={ART.moon} opacity={0.95} />
      <circle cx={602} cy={100} r={38} fill={ART.night} opacity={0.7} />
      {Array.from({ length: 34 }, (_, i) => {
        const x = ((i * 137.5) % 690) + 15;
        const y = ((i * 83.3) % 430) + 20;
        const star = i % 7 === 0;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={star ? 2.6 : 1.3}
            fill={ART.moon}
            opacity={star ? 0.9 : 0.55}
          />
        );
      })}
    </g>
  );
}

function SkyBack({ t }: { t: number }) {
  const drift = (t / 55) % 860;
  return (
    <g>
      <circle cx={592} cy={116} r={54} fill="#FFE7A3" />
      <Cloud x={120 + drift * 0.35} y={150} s={1} />
      <Cloud x={((460 + drift) % 860) - 70} y={232} s={0.74} />
      <Cloud x={((760 + drift) % 860) - 70} y={92} s={0.55} />
    </g>
  );
}

function Cloud({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="#FFFFFF" opacity={0.92}>
      <ellipse cx={0} cy={0} rx={58} ry={22} />
      <ellipse cx={42} cy={-10} rx={38} ry={24} />
      <ellipse cx={-40} cy={-6} rx={34} ry={18} />
      <ellipse cx={6} cy={-18} rx={30} ry={20} />
    </g>
  );
}

function GardenBack() {
  return (
    <g>
      <circle cx={122} cy={112} r={46} fill="#FFE7A3" />
      {[
        [80, 610, 1.1],
        [210, 620, 0.8],
        [560, 612, 1.2],
        [655, 626, 0.75],
      ].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <circle cx={0} cy={-12} r={26} fill="#6AA25B" />
          <circle cx={20} cy={-4} r={20} fill="#7FB06A" />
          <circle cx={-20} cy={-2} r={18} fill="#75A961" />
        </g>
      ))}
    </g>
  );
}

function CourtBack({ accent }: { accent: string }) {
  const net = '#F8F0DD';
  const band = mix(accent, '#FFFFFF', 0.25);
  return (
    <g>
      <circle cx={596} cy={106} r={44} fill="#FFE7A3" />
      <Cloud x={118} y={142} s={0.85} />
      <Cloud x={470} y={208} s={0.6} />

      {/* Flat net across the back of the court. The actor is drawn in front. */}
      <g opacity={0.92}>
        <rect x={92} y={420} width={9} height={170} rx={4.5} fill={net} />
        <rect x={619} y={420} width={9} height={170} rx={4.5} fill={net} />
        <rect x={92} y={488} width={536} height={7} fill={band} />
        {Array.from({ length: 19 }, (_, i) => (
          <rect
            key={`v-${i}`}
            x={110 + i * 26}
            y={420}
            width={1.6}
            height={170}
            fill={net}
            opacity={0.45}
          />
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <rect
            key={`h-${i}`}
            x={92}
            y={432 + i * 22}
            width={536}
            height={1.6}
            fill={net}
            opacity={0.45}
          />
        ))}
      </g>

      {/* Court marks */}
      <g fill="#FFFFFF" opacity={0.72}>
        <rect x={118} y={652} width={484} height={4} rx={2} />
        <rect x={118} y={606} width={484} height={3} rx={1.5} />
        <rect x={150} y={606} width={4} height={80} rx={2} />
        <rect x={566} y={606} width={4} height={80} rx={2} />
      </g>

      {/* Ball on the baseline */}
      <circle cx={575} cy={632} r={9} fill="#D8E84A" />
      <path
        d="M568 626 Q575 634 582 626"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={1.4}
        opacity={0.8}
      />
    </g>
  );
}

function StudioBack({ accent }: { accent: string }) {
  return (
    <g>
      <circle cx={360} cy={332} r={246} fill={mix(accent, ART.cream, 0.78)} />
      <circle cx={360} cy={332} r={164} fill={mix(accent, ART.cream, 0.6)} />
      <path d="M0 590 H720 V720 H0 Z" fill={mix(accent, ART.cream, 0.68)} />
    </g>
  );
}

function KitchenBack() {
  return (
    <g>
      <rect x={0} y={0} width={720} height={574} fill="#FFF4DF" />
      <rect x={0} y={574} width={720} height={146} fill="#E2AE72" />
      <rect x={0} y={566} width={720} height={14} fill="#C98A47" />
      {[96, 218, 502, 624].map((x, i) => (
        <g key={x}>
          <rect
            x={x - 17}
            y={430 + (i % 2) * 10}
            width={34}
            height={44}
            rx={7}
            fill={i % 2 ? '#D9A45E' : '#C98A47'}
          />
          <rect x={x - 21} y={422 + (i % 2) * 10} width={42} height={12} rx={6} fill="#F3DDB4" />
        </g>
      ))}
      <rect x={0} y={120} width={720} height={8} fill="#F0D7B0" />
      {[150, 360, 570].map((x) => (
        <g key={x}>
          <rect x={x - 4} y={128} width={8} height={44} rx={4} fill="#D9A45E" />
          <circle cx={x} cy={184} r={19} fill="#F2B84B" />
          <circle cx={x} cy={184} r={11} fill="#E2A032" />
        </g>
      ))}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Actor

function ActorView({
  actor,
  pose,
  transforms,
  fit,
  t,
  night,
}: {
  actor: Actor;
  pose: ActorPose;
  transforms: ActorTransforms;
  fit: Fit;
  t: number;
  night: boolean;
}) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const palette = actor.genome.palette;
  const plan = actor.genome.bodyPlan;
  const human = plan === 'biped' ? humanOf(actor.genome) : undefined;
  const bones = useMemo(
    () => [...actor.skeleton.bones].sort((a, b) => a.depth - b.depth),
    [actor.skeleton.bones],
  );
  const hat = actor.genome.accessories.find(
    (a) =>
      a.kind === 'cowboy-hat' ||
      a.kind === 'chef-hat' ||
      a.kind === 'beanie' ||
      a.kind === 'cap',
  );
  const saddle = actor.genome.accessories.find((a) => a.kind === 'saddle');
  const hasMuzzle = actor.skeleton.bones.some((b) => b.role === 'mouth');
  const head = actor.skeleton.bones.find((b) => b.id === actor.skeleton.head);
  const body = actor.skeleton.bones.find((b) => b.role === 'spine');
  const headMatrix = head ? transforms.bones.get(head.id) : undefined;
  const quadrupedFace = plan === 'quadruped' ? 0.95 : 1;
  const faceSize = Math.max(
    0.6,
    Math.min(2.7, ((head?.w ?? 26) / 26) * quadrupedFace),
  );
  const foot = apply(transforms.base, 0, 0);
  const shadowScale =
    plan === 'quadruped'
      ? 56
      : plan === 'octopod'
        ? 40
        : plan === 'blob'
          ? 34
          : 28;

  return (
    <g>
      {!actor.attach && (
        <ellipse
          cx={fit.ox + fit.s * foot.x}
          cy={fit.oy - fit.s * (fit.minY + 2)}
          rx={fit.s * shadowScale}
          ry={fit.s * 8}
          fill={ART.shadow}
          opacity={night ? 0.3 : 0.13}
        />
      )}

      <defs>
        {body && plan === 'quadruped' && (
          <clipPath id={`body-${uid}`}>{quadBodyShapes(body, 0)}</clipPath>
        )}
      </defs>

      {/* Back hair is behind the torso, the arms and the head, so a long bob
          or braids read as one silhouette, not a cap pasted on the skull. */}
      {plan === 'biped' && human && head && headMatrix && (
        <g transform={toSvg(headMatrix, fit.ox, fit.oy, fit.s)}>
          <HairBack bone={head} human={human} palette={palette} t={t} />
        </g>
      )}

      {bones.map((bone) => {
        const m = transforms.bones.get(bone.id);
        if (!m) return null;
        const isHead = bone.id === actor.skeleton.head;
        const screen = toSvg(m, fit.ox, fit.oy, fit.s);

        return (
          <g key={bone.id} transform={screen}>
            <BoneArt
              bone={bone}
              actor={actor}
              plan={plan}
              pose={pose}
              uid={uid}
              human={human}
              saddle={saddle}
            />
            {bone.role === 'back' && saddle && (
              <Saddle color={saddle.color} accent={palette.accent} />
            )}
            {isHead && (
              <g
                transform={faceMatrix(
                  actor.skeleton.faceAt.x,
                  actor.skeleton.faceAt.y,
                  actor.skeleton.faceAt.rot,
                  faceSize,
                )}
              >
                <FaceView
                  actor={actor}
                  pose={pose}
                  plan={plan}
                  hat={hat}
                  human={human}
                  hasMuzzle={hasMuzzle}
                />
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Per-bone skin

function BoneArt({
  bone,
  actor,
  plan,
  pose,
  uid,
  human,
  saddle,
}: {
  bone: Bone;
  actor: Actor;
  plan: BodyPlan;
  pose: ActorPose;
  uid: string;
  human?: HumanLook;
  saddle?: AccessorySpec;
}) {
  const genome = actor.genome;
  const palette = genome.palette;
  const fill = palette[bone.color];

  if (bone.role === 'head') {
    return <HeadMass bone={bone} genome={genome} plan={plan} uid={uid} human={human} />;
  }

  if (plan === 'biped') {
    const look = human ?? DEFAULT_HUMAN;
    if (bone.role === 'spine') return <Torso bone={bone} genome={genome} human={look} uid={uid} />;
    if (bone.shape === 'blob' && /^hand/.test(bone.id)) {
      const racket = actor.genome.accessories.find((accessory) => {
        if (accessory.kind !== 'tennis-racket') return false;
        if (accessory.attach === bone.id || accessory.attach === bone.role) return true;
        return accessory.attach !== 'handL' && bone.role === 'handR';
      });
      return (
        <g>
          <Mitten bone={bone} skin={palette.skin} cuff={trimOf(palette)} />
          {racket && <TennisRacket color={racket.color} />}
        </g>
      );
    }
    if (bone.shape === 'blob' && /^foot/.test(bone.id)) {
      return <Shoe bone={bone} human={look} palette={palette} />;
    }
    if (/^(arm|fore)/.test(bone.id)) {
      return <Arm bone={bone} genome={genome} human={look} />;
    }
    if (/^(thigh|shin)/.test(bone.id)) {
      return <Leg bone={bone} genome={genome} human={look} />;
    }
  }

  if (plan === 'quadruped') {
    if (bone.role === 'spine') return <QuadBody bone={bone} genome={genome} saddle={saddle} uid={uid} />;
    if (bone.role === 'neck') return <QuadNeck bone={bone} genome={genome} />;
    if (bone.role === 'mouth') return <QuadMuzzle bone={bone} genome={genome} bridle={Boolean(saddle)} />;
    if (bone.role === 'tail') return <Tail bone={bone} genome={genome} />;
    if (bone.shape === 'blob' && /^hoof/.test(bone.id)) {
      return <Hoof bone={bone} detail={palette.detail} />;
    }
    if (/^ear/.test(bone.id)) return <Ear bone={bone} genome={genome} />;
    if (/^(thigh|shin)/.test(bone.id)) {
      return <Capsule bone={bone} fill={palette.skin} />;
    }
  }

  if (plan === 'octopod') {
    if (bone.role === 'tentacle') {
      return <Tentacle bone={bone} paletteSkin={palette.skin} paletteBelly={palette.belly} />;
    }
  }

  if (plan === 'blob') {
    if (bone.shape === 'blob' && /^hand/.test(bone.id)) {
      return <Mitten bone={bone} skin={palette.skin} />;
    }
    if (bone.shape === 'blob' && /^foot/.test(bone.id)) {
      return <BlobFoot bone={bone} skin={palette.skin} />;
    }
    if (/^arm/.test(bone.id)) return <Capsule bone={bone} fill={palette.skin} />;
  }

  if (bone.shape === 'blob') return <BlobShape bone={bone} fill={fill} paletteBelly={palette.belly} />;
  return <Capsule bone={bone} fill={fill} />;
}

// ---------------------------------------------------------------------------
// Heads

function HeadMass({
  bone,
  genome,
  plan,
  uid,
  human,
}: {
  bone: Bone;
  genome: Genome;
  plan: BodyPlan;
  uid: string;
  human?: HumanLook;
}) {
  if (plan === 'octopod') return <Mantle bone={bone} genome={genome} uid={uid} />;
  if (plan === 'blob') return <BlobMass bone={bone} genome={genome} uid={uid} />;
  if (plan === 'quadruped') return <HorseHead bone={bone} genome={genome} uid={uid} />;
  return <BipedHead bone={bone} genome={genome} uid={uid} human={human} />;
}

function BipedHead({
  bone,
  genome,
  uid,
  human,
}: {
  bone: Bone;
  genome: Genome;
  uid: string;
  human?: HumanLook;
}) {
  const palette = genome.palette;
  const rx = bone.len / 2;
  const ry = bone.w / 2;
  const skin = palette.skin;
  const hair = hairOf(palette);
  const clip = `head-${uid}`;
  const square = human?.face.jaw === 'square';

  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <ellipse cx={rx} cy={0} rx={rx} ry={ry} />
        </clipPath>
      </defs>

      {/* A square jaw is a wider chin mass behind the oval, not a new head. */}
      {square && (
        <rect
          x={-2}
          y={-ry * 0.84}
          width={rx * 0.66}
          height={ry * 1.68}
          rx={ry * 0.24}
          fill={skin}
        />
      )}

      {/* ears first, so the head covers their roots */}
      <circle cx={rx * 0.55} cy={-ry * 0.96} r={ry * 0.24} fill={skin} />
      <circle cx={rx * 0.55} cy={ry * 0.96} r={ry * 0.24} fill={skin} />
      <circle cx={rx * 0.55} cy={-ry * 0.98} r={ry * 0.11} fill={darken(skin, 0.12)} />
      <circle cx={rx * 0.55} cy={ry * 0.98} r={ry * 0.11} fill={darken(skin, 0.12)} />

      <ellipse cx={rx} cy={0} rx={rx} ry={ry} fill={skin} />

      {/* one hard cel shadow, clipped to the skull */}
      <g clipPath={`url(#${clip})`}>
        <ellipse
          cx={rx * 0.72}
          cy={-ry * 0.34}
          rx={rx * 0.82}
          ry={ry * 0.72}
          fill={shadowOf(skin, 0.14)}
          opacity={0.55}
        />
        <ellipse
          cx={rx * 1.26}
          cy={ry * 0.42}
          rx={rx * 0.3}
          ry={ry * 0.36}
          fill={ART.paper}
          opacity={0.22}
        />
      </g>

      {/* a short sideburn root under the hair cap; the cap itself is behind */}
      {!square && human?.hair.style !== 'bald' && (
        <ellipse cx={rx * 0.42} cy={-ry * 1.01} rx={rx * 0.16} ry={ry * 0.14} fill={hair} />
      )}
      {!square && human?.hair.style !== 'bald' && (
        <ellipse cx={rx * 0.42} cy={ry * 1.01} rx={rx * 0.16} ry={ry * 0.14} fill={hair} />
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Hair. The head bone frame is +x up, +y left; the face frame is separate and
// handled by HairFront. Back hair is drawn before the torso so long/bob masses
// read behind the body; front hair is drawn over the forehead.

function HairBack({
  bone,
  human,
  palette,
  t,
}: {
  bone: Bone;
  human: HumanLook;
  palette: Genome['palette'];
  t: number;
}) {
  const rx = bone.len / 2;
  const ry = bone.w / 2;
  const hair = hairOf(palette);
  const dark = darken(hair, 0.14);
  const style = human.hair.style;
  const vol = Math.max(0.7, Math.min(1.5, human.hair.volume));
  const sway = Math.sin(t / 1900 + 0.8) * 1.2;

  if (style === 'bald') return null;

  const cap = (
    <ellipse
      cx={rx * 0.96}
      cy={0}
      rx={rx * (0.98 + (vol - 1) * 0.05)}
      ry={ry * (1.06 + (vol - 1) * 0.08)}
      fill={hair}
    />
  );

  if (style === 'short') {
    return (
      <g>
        {cap}
        <ellipse cx={rx * 1.04} cy={-ry * 0.28} rx={rx * 0.18} ry={ry * 0.3} fill={hair} />
        <ellipse cx={rx * 1.02} cy={ry * 0.34} rx={rx * 0.14} ry={ry * 0.24} fill={dark} opacity={0.5} />
      </g>
    );
  }

  if (style === 'bob') {
    return (
      <g>
        {cap}
        <ellipse cx={rx * 0.24} cy={0} rx={rx * 0.56} ry={ry * 1.12} fill={hair} />
        <ellipse cx={rx * 0.16} cy={0} rx={rx * 0.34} ry={ry * 0.9} fill={dark} opacity={0.45} />
        <ellipse cx={rx * 0.48} cy={-ry * 1.02} rx={rx * 0.26} ry={ry * 0.22} fill={hair} />
        <ellipse cx={rx * 0.48} cy={ry * 1.02} rx={rx * 0.26} ry={ry * 0.22} fill={hair} />
      </g>
    );
  }

  if (style === 'ponytail') {
    return (
      <g>
        {cap}
        <circle cx={rx * 0.52} cy={ry * 1.0} r={ry * 0.24} fill={dark} />
        <circle cx={rx * 0.5} cy={ry * 1.02} r={ry * 0.14} fill={palette.accent} />
        <g transform={`translate(${rx * 0.26} ${ry * 1.06}) rotate(${-18 + sway * 0.4})`}>
          <ellipse cx={-rx * 0.44} cy={0} rx={rx * 0.52} ry={ry * 0.22} fill={hair} />
          <ellipse cx={-rx * 0.96} cy={ry * 0.04} rx={rx * 0.38} ry={ry * 0.18} fill={hair} />
          <ellipse cx={-rx * 1.34} cy={ry * 0.02} rx={rx * 0.24} ry={ry * 0.12} fill={dark} />
        </g>
      </g>
    );
  }

  if (style === 'bun') {
    return (
      <g>
        {cap}
        <circle cx={rx * 1.08} cy={0} r={ry * 0.44 * vol} fill={hair} />
        <circle cx={rx * 1.1} cy={-ry * 0.12} r={ry * 0.2} fill={dark} opacity={0.55} />
      </g>
    );
  }

  if (style === 'long') {
    return (
      <g>
        {cap}
        <path
          d={`M ${rx * 0.98} ${-ry * 1.02} Q ${rx * 1.3} 0 ${rx * 0.98} ${ry * 1.02}
              L ${-rx * 0.18} ${ry * 1.2}
              Q ${-rx * 1.4} ${ry * 1.34} ${-rx * 1.52} ${ry * 0.72}
              L ${-rx * 1.52} ${-ry * 0.72}
              Q ${-rx * 1.4} ${-ry * 1.34} ${-rx * 0.18} ${-ry * 1.2} Z`}
          fill={hair}
        />
        <path
          d={`M ${rx * 0.6} ${-ry * 1.02} L ${-rx * 0.2} ${-ry * 1.1}
              Q ${-rx * 1.2} ${-ry * 1.2} ${-rx * 1.28} ${-ry * 0.6}
              L ${-rx * 1.28} ${ry * 0.6}
              Q ${-rx * 1.2} ${ry * 1.2} ${-rx * 0.2} ${ry * 1.1} L ${rx * 0.6} ${ry * 1.02} Z`}
          fill={dark}
          opacity={0.28}
        />
        <ellipse cx={-rx * 1.2} cy={-ry * 1.02} rx={rx * 0.24} ry={ry * 0.18} fill={dark} opacity={0.4} />
        <ellipse cx={-rx * 1.2} cy={ry * 1.02} rx={rx * 0.24} ry={ry * 0.18} fill={dark} opacity={0.4} />
      </g>
    );
  }

  if (style === 'curly' || style === 'afro') {
    const afro = style === 'afro';
    const count = afro ? 13 : 9;
    const ringX = afro ? rx * 0.96 : rx * 0.76;
    const ringY = afro ? ry * 1.3 : ry * 1.12;
    const dot = (afro ? ry * 0.42 : ry * 0.36) * vol;
    return (
      <g>
        {cap}
        <ellipse
          cx={rx * 0.9}
          cy={0}
          rx={ringX + dot * 0.28}
          ry={ringY + dot * 0.28}
          fill={hair}
        />
        {Array.from({ length: count }, (_, i) => {
          const a = (i / count) * Math.PI * 2;
          const drift = Math.sin(i * 2.3) * (afro ? 2.2 : 1.4);
          return (
            <circle
              key={i}
              cx={rx * 0.9 + Math.cos(a) * ringX + drift}
              cy={Math.sin(a) * ringY}
              r={dot * (i % 3 === 0 ? 1.08 : 0.92)}
              fill={i % 4 === 0 ? dark : hair}
            />
          );
        })}
        <circle cx={rx * 1.02} cy={0} r={dot * 0.8} fill={hair} />
      </g>
    );
  }

  // braids
  return (
    <g>
      {cap}
      {[1, -1].map((side) => (
        <g key={side}>
          <circle cx={rx * 0.58} cy={side * ry * 1.0} r={ry * 0.19} fill={dark} />
          {[0, 1, 2, 3, 4].map((i) => (
            <circle
              key={i}
              cx={rx * (0.46 - i * 0.36)}
              cy={side * ry * (1.06 + i * 0.02) + sway * (i / 5)}
              r={ry * (0.18 - i * 0.018)}
              fill={i % 2 === 0 ? hair : dark}
            />
          ))}
          <circle
            cx={rx * (0.46 - 4.6 * 0.36)}
            cy={side * ry * 1.14 + sway}
            r={ry * 0.09}
            fill={palette.accent}
          />
        </g>
      ))}
    </g>
  );
}

/** Hair that sits in front of the face. Coordinates are the face frame:
 * +x right, +y down. The skull spans about ±13.2 / ±14.5. */
function HairFront({
  human,
  palette,
}: {
  human: HumanLook;
  palette: Genome['palette'];
}) {
  const hair = hairOf(palette);
  const dark = darken(hair, 0.12);
  const style = human.hair.style;
  const fringe = human.hair.fringe;
  if (style === 'bald') return null;

  const sideburns = (
    <>
      <rect x={-13.4} y={-2.4} width={2.8} height={7.4} rx={1.4} fill={hair} />
      <rect x={10.6} y={-2.4} width={2.8} height={7.4} rx={1.4} fill={hair} />
    </>
  );

  const bobSides = (
    <>
      <rect x={-13.8} y={-7.2} width={4.6} height={18} rx={2.3} fill={hair} />
      <rect x={9.2} y={-7.2} width={4.6} height={18} rx={2.3} fill={hair} />
      <rect x={-13.9} y={-7} width={3} height={14} rx={1.5} fill={dark} opacity={0.32} />
      <rect x={9.3} y={-7} width={3} height={14} rx={1.5} fill={dark} opacity={0.32} />
    </>
  );

  const longSides = (
    <>
      <rect x={-14} y={-7.6} width={4.8} height={21} rx={2.4} fill={hair} />
      <rect x={9.2} y={-7.6} width={4.8} height={21} rx={2.4} fill={hair} />
    </>
  );

  const fringeShape =
    fringe === 'none' ? null : fringe === 'straight' ? (
      <path
        d="M -13.6 -13.4 Q 0 -15.4 13.6 -13.4 L 13.6 -7.4 L 8.4 -7.4 Q 0 -9.8 -8.4 -7.4 L -13.6 -7.4 Z"
        fill={hair}
      />
    ) : fringe === 'curtain' ? (
      <g fill={hair}>
        <path d="M -13.6 -13.4 Q -2.4 -15.2 -0.6 -13 L -0.6 -8 Q -6 -10.4 -13.6 -7.4 Z" />
        <path d="M 13.6 -13.4 Q 2.4 -15.2 0.6 -13 L 0.6 -8 Q 6 -10.4 13.6 -7.4 Z" />
      </g>
    ) : (
      <path
        d="M -13.8 -13.2 Q 0 -15.6 13.8 -13 L 13.8 -6.2 Q 7.6 -9.8 1.4 -7.2 Q -6.4 -4.6 -13.8 -8.2 Z"
        fill={hair}
      />
    );

  const afroFringe = (
    <g fill={hair}>
      {[-9.5, -4.5, 0.5, 5.5, 10].map((x, i) => (
        <circle key={x} cx={x} cy={-12 + (i % 2) * 1.2} r={i % 2 ? 3.1 : 3.6} />
      ))}
      <circle cx={-12.4} cy={-6} r={3.1} fill={dark} />
      <circle cx={12.4} cy={-6} r={3.1} fill={dark} />
    </g>
  );

  return (
    <g>
      {fringeShape}
      {style === 'short' && sideburns}
      {style === 'bob' && bobSides}
      {style === 'long' && longSides}
      {(style === 'curly' || style === 'afro') && afroFringe}
      {style === 'braids' && (
        <g fill={hair}>
          <rect x={-13.3} y={-4.8} width={3.2} height={9} rx={1.6} />
          <rect x={10.1} y={-4.8} width={3.2} height={9} rx={1.6} />
          <circle cx={-11.7} cy={4.8} r={1.7} fill={palette.accent} />
          <circle cx={11.7} cy={4.8} r={1.7} fill={palette.accent} />
        </g>
      )}
      {style === 'ponytail' && (
        <path d="M -12.8 -10.4 Q 0 -13.8 12.8 -10.4 L 12.8 -8.4 Q 0 -11.4 -12.8 -8.4 Z" fill={hair} />
      )}
      {style === 'bun' && (
        <path d="M -12.4 -10.2 Q 0 -13.2 12.4 -10.2 L 12.4 -8.2 Q 0 -11 -12.4 -8.2 Z" fill={hair} />
      )}
      {style !== 'short' && style !== 'bob' && fringe !== 'none' && (
        <path
          d="M -11.6 -8.4 Q 0 -10.4 11.6 -8.4 Q 0 -7 -11.6 -8.4 Z"
          fill={dark}
          opacity={0.28}
        />
      )}
    </g>
  );
}

function HorseHead({ bone, genome, uid }: { bone: Bone; genome: Genome; uid: string }) {
  const palette = genome.palette;
  const rx = bone.len / 2;
  const ry = bone.w / 2;
  const skin = palette.skin;
  const hair = hairOf(palette);
  const clip = `head-${uid}`;

  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <ellipse cx={rx} cy={0} rx={rx} ry={ry} />
        </clipPath>
      </defs>

      {/* cheek + skull read as one mass */}
      <circle cx={rx * 0.62} cy={0} r={ry * 1.02} fill={skin} />
      <ellipse cx={rx} cy={0} rx={rx} ry={ry} fill={skin} />

      <g clipPath={`url(#${clip})`}>
        <ellipse
          cx={rx * 0.66}
          cy={-ry * 0.3}
          rx={rx * 0.8}
          ry={ry * 0.7}
          fill={shadowOf(skin, 0.15)}
          opacity={0.5}
        />
        <ellipse
          cx={rx * 1.18}
          cy={ry * 0.42}
          rx={rx * 0.26}
          ry={ry * 0.34}
          fill={ART.paper}
          opacity={0.2}
        />
      </g>

      {/* forelock sits on the forehead, in front of the ears */}
      <ellipse cx={rx * 0.34} cy={ry * 0.58} rx={ry * 0.16} ry={ry * 0.24} fill={hair} />
    </g>
  );
}

function Mantle({ bone, genome, uid }: { bone: Bone; genome: Genome; uid: string }) {
  const palette = genome.palette;
  const rx = bone.len / 2;
  const ry = bone.w / 2;
  const skin = palette.skin;
  const clip = `head-${uid}`;

  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <ellipse cx={rx} cy={0} rx={rx} ry={ry} />
        </clipPath>
      </defs>
      <ellipse cx={rx} cy={0} rx={rx} ry={ry} fill={skin} />

      <g clipPath={`url(#${clip})`}>
        {/* hard cel shadow on the lower right */}
        <ellipse
          cx={bone.len * 0.28}
          cy={-ry * 0.34}
          rx={rx * 0.82}
          ry={ry * 0.72}
          fill={shadowOf(skin, 0.17)}
          opacity={0.55}
        />
        {/* light underside, under the face */}
        <ellipse
          cx={bone.len * 0.12}
          cy={0}
          rx={bone.len * 0.3}
          ry={ry * 0.34}
          fill={palette.belly}
        />
        {/* one sheen patch, not a gradient */}
        <ellipse
          cx={bone.len * 0.68}
          cy={ry * 0.24}
          rx={bone.len * 0.1}
          ry={ry * 0.16}
          fill={ART.paper}
          opacity={0.24}
        />
      </g>
    </g>
  );
}

function BlobMass({ bone, genome, uid }: { bone: Bone; genome: Genome; uid: string }) {
  const palette = genome.palette;
  const rx = bone.len / 2;
  const ry = bone.w / 2;
  const skin = palette.skin;
  const clip = `head-${uid}`;
  const leaves = genome.accessories.find((a) => a.kind === 'leaf-ears');

  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <ellipse cx={rx} cy={0} rx={rx} ry={ry} />
        </clipPath>
      </defs>

      {leaves && (
        <g>
          <Leaf x={bone.len * 0.99} y={-11} rot={-30} color={leaves.color} />
          <Leaf x={bone.len * 0.99} y={11} rot={30} color={leaves.color} />
        </g>
      )}

      <ellipse cx={rx} cy={0} rx={rx} ry={ry} fill={skin} />

      <g clipPath={`url(#${clip})`}>
        <ellipse
          cx={bone.len * 0.18}
          cy={0}
          rx={bone.len * 0.29}
          ry={ry * 0.38}
          fill={palette.belly}
        />
        <ellipse
          cx={bone.len * 0.74}
          cy={-ry * 0.24}
          rx={rx * 0.56}
          ry={ry * 0.66}
          fill={shadowOf(skin, 0.16)}
          opacity={0.55}
        />
        <ellipse
          cx={bone.len * 0.64}
          cy={ry * 0.26}
          rx={bone.len * 0.1}
          ry={ry * 0.16}
          fill={ART.paper}
          opacity={0.2}
        />
      </g>
    </g>
  );
}

function Leaf({ x, y, rot, color }: { x: number; y: number; rot: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <path d="M0 0 C 8 -5 17 -6 21 0 C 17 6 8 5 0 0 Z" fill={color} />
      <path d="M0 0 C 8 -2 16 -2 21 0 C 16 2 8 2 0 0 Z" fill={darken(color, 0.16)} opacity={0.55} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Biped body

function Torso({
  bone,
  genome,
  human,
  uid,
}: {
  bone: Bone;
  genome: Genome;
  human: HumanLook;
  uid: string;
}) {
  const palette = genome.palette;
  const w = bone.w / 2;
  const L = bone.len;
  const cloth = clothOf(palette);
  const trim = trimOf(palette);
  const accent = palette.accent;
  const b = human.body;
  const top = human.outfit.top;
  const chest = w * b.shoulders;
  const hip = w * 0.84 * b.hips;
  const waist = w * 0.8 * b.waist;
  const scarf = genome.accessories.find((a) => a.kind === 'scarf');
  const clip = `torso-${uid}`;

  const d = [
    `M 3 ${-hip}`,
    `Q 0 ${-hip} 0 ${-hip + 4}`,
    `L 0 ${hip - 4}`,
    `Q 0 ${hip} 3 ${hip}`,
    `L ${L * 0.28} ${hip}`,
    `Q ${L * 0.38} ${hip} ${L * 0.45} ${waist}`,
    `L ${L * 0.7} ${waist}`,
    `Q ${L * 0.78} ${chest} ${L * 0.84} ${chest}`,
    `L ${L - 4} ${chest}`,
    `Q ${L} ${chest} ${L} ${chest - 4}`,
    `L ${L} ${-chest + 4}`,
    `Q ${L} ${-chest} ${L - 4} ${-chest}`,
    `L ${L * 0.84} ${-chest}`,
    `Q ${L * 0.78} ${-chest} ${L * 0.7} ${-waist}`,
    `L ${L * 0.45} ${-waist}`,
    `Q ${L * 0.38} ${-hip} ${L * 0.28} ${-hip}`,
    'Z',
  ].join(' ');

  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <path d={d} />
        </clipPath>
      </defs>

      {/* garment skirts and long panels sit behind the torso mass */}
      {top === 'dress' && (
        <g>
          <path
            d={`M ${L * 0.12} ${-hip * 0.98} L ${-L * 0.46} ${-hip * 1.62}
                Q ${-L * 0.56} 0 ${-L * 0.46} ${hip * 1.62}
                L ${L * 0.12} ${hip * 0.98} Z`}
            fill={cloth}
          />
          <path
            d={`M ${-L * 0.34} ${-hip * 1.58} L ${-L * 0.46} ${-hip * 1.62}
                Q ${-L * 0.56} 0 ${-L * 0.46} ${hip * 1.62}
                L ${-L * 0.34} ${hip * 1.58} Q ${-L * 0.44} 0 ${-L * 0.34} ${-hip * 1.58} Z`}
            fill={darken(cloth, 0.1)}
            opacity={0.35}
          />
        </g>
      )}
      {top === 'coat' && (
        <g>
          <path
            d={`M ${L * 0.06} ${-hip} L ${-L * 0.46} ${-hip * 1.12}
                Q ${-L * 0.54} 0 ${-L * 0.46} ${hip * 1.12}
                L ${L * 0.06} ${hip} Z`}
            fill={cloth}
          />
          <rect
            x={-L * 0.5}
            y={-1.1}
            width={L * 0.56}
            height={2.2}
            fill={darken(cloth, 0.18)}
            opacity={0.55}
          />
        </g>
      )}
      {top === 'hoodie' && (
        <ellipse cx={L * 0.94} cy={0} rx={10} ry={chest * 0.9} fill={darken(cloth, 0.12)} />
      )}

      <path d={d} fill={cloth} />

      {/* one soft cel shadow across the belly, clipped to the garment */}
      <g clipPath={`url(#${clip})`}>
        <ellipse
          cx={L * 0.26}
          cy={-hip * 0.34}
          rx={L * 0.34}
          ry={hip * 0.72}
          fill={shadowOf(cloth, 0.12)}
          opacity={0.3}
        />
        <ellipse
          cx={L * 0.86}
          cy={hip * 0.36}
          rx={L * 0.1}
          ry={hip * 0.22}
          fill={ART.paper}
          opacity={0.16}
        />
      </g>

      {/* collars and necklines */}
      {top === 'shirt' && (
        <g fill={trim}>
          <path d={`M ${L - 1} ${-7.8} L ${L - 10} ${-1.6} L ${L - 2} 0 Z`} />
          <path d={`M ${L - 1} ${7.8} L ${L - 10} ${1.6} L ${L - 2} 0 Z`} />
          <rect x={L * 0.56} y={-0.9} width={L * 0.28} height={1.8} rx={0.9} fill={darken(cloth, 0.16)} />
          {[0.62, 0.72, 0.82].map((k) => (
            <circle key={k} cx={L * k} cy={0} r={1.15} fill={lighten(cloth, 0.4)} />
          ))}
        </g>
      )}
      {top === 'blouse' && (
        <g>
          <path d={`M ${L - 1} ${-7.4} L ${L - 12} 0 L ${L - 1} 7.4 L ${L - 5.2} 0 Z`} fill={trim} />
          <circle cx={L - 10.4} cy={0} r={1.5} fill={accent} />
        </g>
      )}
      {top === 'suit' && (
        <g>
          <path d={`M ${L - 1} ${-8.4} L ${L - 15} 0 L ${L - 3} 0 Z`} fill={darken(cloth, 0.16)} />
          <path d={`M ${L - 1} ${8.4} L ${L - 15} 0 L ${L - 3} 0 Z`} fill={darken(cloth, 0.16)} />
          <path d={`M ${L - 2} ${-2.6} L ${L - 7} ${-1} L ${L - 15} 0 L ${L - 7} 1 L ${L - 2} ${2.6} Z`} fill={accent} />
        </g>
      )}
      {(top === 'tee' || top === 'dress' || top === 'sport' || top === 'hoodie') && (
        <path
          d={`M ${L - 1} ${-7} L ${L - 9} 0 L ${L - 1} 7 L ${L - 4} 0 Z`}
          fill={trim}
        />
      )}
      {top === 'hoodie' && (
        <g>
          <rect x={L * 0.52} y={-4} width={L * 0.26} height={1.6} rx={0.8} fill={trim} />
          <rect x={L * 0.52} y={2.4} width={L * 0.26} height={1.6} rx={0.8} fill={trim} />
          <circle cx={L * 0.52} cy={-3.2} r={1.4} fill={trim} />
          <circle cx={L * 0.52} cy={3.2} r={1.4} fill={trim} />
        </g>
      )}
      {top === 'sport' && (
        <g>
          <rect x={L * 0.62} y={-chest} width={3.6} height={chest * 2} fill={trim} />
          <rect x={L * 0.54} y={-chest} width={1.4} height={chest * 2} fill={darken(accent, 0.12)} opacity={0.55} />
          <rect x={L * 0.38} y={-3} width={8} height={2} rx={1} fill={accent} opacity={0.8} />
          <rect x={L * 0.38} y={1} width={8} height={2} rx={1} fill={accent} opacity={0.8} />
        </g>
      )}
      {top === 'apron' && (
        <g>
          <path
            d={`M ${L * 0.32} ${-waist * 0.92} L ${L * 0.9} ${-waist * 0.7}
                L ${L * 0.92} ${waist * 0.7} L ${L * 0.32} ${waist * 0.92} Z`}
            fill={trim}
          />
          <rect x={L * 0.88} y={-waist * 0.58 - 1} width={L * 0.1} height={2} rx={1} fill={trim} />
          <rect x={L * 0.88} y={waist * 0.58 - 1} width={L * 0.1} height={2} rx={1} fill={trim} />
          <rect
            x={L * 0.3}
            y={-hip * 0.98}
            width={3.4}
            height={hip * 1.96}
            rx={1.7}
            fill={darken(trim, 0.18)}
          />
          <path
            d={`M ${L * 0.3} ${-hip * 0.92} l -3.4 -2.6 l 0 5.2 Z`}
            fill={darken(trim, 0.18)}
          />
          <path
            d={`M ${L * 0.3} ${hip * 0.92} l -3.4 2.6 l 0 -5.2 Z`}
            fill={darken(trim, 0.18)}
          />
          {[0.56, 0.66, 0.76, 0.86].map((k) => (
            <circle key={k} cx={L * k} cy={0} r={1.25} fill={darken(trim, 0.26)} opacity={0.8} />
          ))}
        </g>
      )}
      {top === 'coat' && (
        <g>
          <path d={`M ${L - 1} ${-8.6} L ${L - 16} 0 L ${L - 4} 0 Z`} fill={darken(cloth, 0.1)} />
          <path d={`M ${L - 1} ${8.6} L ${L - 16} 0 L ${L - 4} 0 Z`} fill={darken(cloth, 0.1)} />
          {[0.5, 0.62, 0.74].map((k) => (
            <circle key={k} cx={L * k} cy={0} r={1.2} fill={darken(cloth, 0.28)} opacity={0.7} />
          ))}
        </g>
      )}

      {/* waist belt on trousers/skirts */}
      {human.outfit.bottom !== 'none' && (
        <>
          <rect x={3} y={-hip * 0.92} width={5} height={hip * 1.84} rx={2} fill={darken(palette.detail, 0.1)} />
          <rect x={4.4} y={-3} width={2.2} height={6} rx={1} fill={accent} />
        </>
      )}

      {scarf && (
        <g>
          <path d={`M ${L - 4} ${-8.5} L ${L - 4} 8.5 L ${L - 19} 0 Z`} fill={scarf.color} />
          <circle cx={L - 4} cy={0} r={3.1} fill={scarf.color} />
          <path d={`M ${L - 4} 0 L ${L - 12} -5 L ${L - 10} 0 Z`} fill={darken(scarf.color, 0.12)} />
        </g>
      )}
    </g>
  );
}

/** Sleeve length is part of the silhouette: short sleeves expose the forearm,
 * long sleeves keep one cloth mass to the cuff. */
function Arm({ bone, genome, human }: { bone: Bone; genome: Genome; human: HumanLook }) {
  const palette = genome.palette;
  const cloth = clothOf(palette);
  const trim = trimOf(palette);
  const top = human.outfit.top;
  const isUpper = bone.id.startsWith('arm');
  const long = top === 'shirt' || top === 'hoodie' || top === 'suit' || top === 'coat' || top === 'apron';

  if (long) {
    return (
      <g>
        <Capsule bone={bone} fill={cloth} />
        {!isUpper && (
          <rect
            x={bone.len - 3.4}
            y={-bone.w * 0.44}
            width={3}
            height={bone.w * 0.88}
            rx={1.5}
            fill={trim}
          />
        )}
      </g>
    );
  }
  if (top === 'blouse') {
    return isUpper ? (
      <Capsule bone={bone} fill={cloth} />
    ) : (
      <g>
        <Capsule bone={bone} fill={palette.skin} />
        <rect x={0} y={-bone.w * 0.46} width={3.2} height={bone.w * 0.92} rx={1.6} fill={trim} />
      </g>
    );
  }
  if (top === 'tee' || top === 'dress' || top === 'sport') {
    return isUpper ? (
      <SplitCapsule bone={bone} fillA={cloth} fillB={palette.skin} split={0.56} />
    ) : (
      <Capsule bone={bone} fill={palette.skin} />
    );
  }
  return <Capsule bone={bone} fill={cloth} />;
}

function Leg({ bone, genome, human }: { bone: Bone; genome: Genome; human: HumanLook }) {
  const palette = genome.palette;
  const pants = palette.pants ?? darken(palette.detail, 0.04);
  const bottom = human.outfit.bottom;
  const isThigh = bone.id.startsWith('thigh');

  if (bottom === 'none' || bottom === 'skirt') {
    return <Capsule bone={bone} fill={palette.skin} />;
  }
  if (bottom === 'shorts') {
    return isThigh ? (
      <SplitCapsule bone={bone} fillA={pants} fillB={palette.skin} split={0.58} />
    ) : (
      <Capsule bone={bone} fill={palette.skin} />
    );
  }
  if (bottom === 'leggings') {
    return <Capsule bone={{ ...bone, w: bone.w * 0.86 }} fill={pants} />;
  }
  return <Capsule bone={bone} fill={pants} />;
}

function Shoe({
  bone,
  human,
  palette,
}: {
  bone: Bone;
  human: HumanLook;
  palette: Genome['palette'];
}) {
  const L = bone.len;
  const w = bone.w;
  const shoes = human.outfit.shoes;
  const accent = palette.accent;

  if (shoes === 'barefoot') {
    return <ellipse cx={L * 0.42} cy={0} rx={L * 0.56} ry={w * 0.5} fill={palette.skin} />;
  }
  if (shoes === 'flats') {
    return (
      <g>
        <ellipse cx={L * 0.45} cy={0} rx={L * 0.62} ry={w * 0.5} fill={darken(accent, 0.24)} />
        <ellipse cx={L * 0.52} cy={-w * 0.1} rx={L * 0.3} ry={w * 0.28} fill={lighten(accent, 0.24)} opacity={0.6} />
      </g>
    );
  }
  if (shoes === 'sneakers') {
    return (
      <g>
        <rect x={-2} y={-w * 0.5} width={L + 5} height={w} rx={w * 0.42} fill={lighten(accent, 0.42)} />
        <rect x={L + 1} y={-w * 0.5} width={3.4} height={w} rx={1.7} fill={ART.paper} />
        <rect x={-1.2} y={-w * 0.46} width={3} height={w * 0.92} rx={1.5} fill={accent} />
        <rect x={L * 0.34} y={-w * 0.47} width={2.1} height={w * 0.94} rx={1} fill={ART.paper} opacity={0.8} />
      </g>
    );
  }
  return <Boot bone={bone} detail={palette.detail} />;
}

function SplitCapsule({
  bone,
  fillA,
  fillB,
  split,
}: {
  bone: Bone;
  fillA: string;
  fillB: string;
  split: number;
}) {
  const short = { ...bone, len: bone.len * split };
  return (
    <g>
      <Capsule bone={bone} fill={fillB} />
      <Capsule bone={short} fill={fillA} />
    </g>
  );
}

function Mitten({ bone, skin, cuff }: { bone: Bone; skin: string; cuff?: string }) {
  return (
    <g>
      <ellipse cx={bone.len * 0.42} cy={0} rx={bone.w * 0.62} ry={bone.w * 0.68} fill={skin} />
      <circle cx={bone.len * 0.42 + bone.w * 0.28} cy={bone.w * 0.26} r={bone.w * 0.24} fill={skin} />
      {cuff && <rect x={-1.5} y={-bone.w * 0.5} width={3} height={bone.w} rx={1.5} fill={cuff} />}
    </g>
  );
}

function TennisRacket({ color }: { color: string }) {
  const frame = darken(color, 0.3);
  return (
    <g transform="translate(2 0)">
      <rect x={0} y={-1.7} width={2.6} height={3.4} rx={1.3} fill={darken(color, 0.7)} />
      <rect x={0} y={-1.1} width={15} height={2.2} rx={1.1} fill={darken(color, 0.5)} />
      <ellipse cx={26} cy={0} rx={8} ry={11} fill={frame} />
      <ellipse cx={26} cy={0} rx={6.2} ry={9} fill="#F8F0DD" />
      {[-6, -3, 0, 3, 6].map((y) => (
        <line
          key={`h-${y}`}
          x1={20}
          y1={y}
          x2={32}
          y2={y}
          stroke={frame}
          strokeWidth={0.55}
          opacity={0.55}
        />
      ))}
      {[-8, -4, 0, 4, 8].map((x) => (
        <line
          key={`v-${x}`}
          x1={26 + x}
          y1={-8.5}
          x2={26 + x}
          y2={8.5}
          stroke={frame}
          strokeWidth={0.55}
          opacity={0.4}
        />
      ))}
    </g>
  );
}

function Boot({ bone, detail }: { bone: Bone; detail: string }) {
  const boot = darken(detail, 0.12);
  return (
    <g>
      <rect x={-2} y={-bone.w * 0.5} width={bone.len + 5} height={bone.w} rx={bone.w * 0.42} fill={boot} />
      <rect x={bone.len + 1} y={-bone.w * 0.5} width={3} height={bone.w} rx={1.5} fill={darken(boot, 0.28)} />
      <rect x={-1.5} y={-bone.w * 0.46} width={3} height={bone.w * 0.92} rx={1.5} fill={lighten(boot, 0.12)} />
    </g>
  );
}

function BlobFoot({ bone, skin }: { bone: Bone; skin: string }) {
  return (
    <g>
      <ellipse cx={bone.len * 0.42} cy={0} rx={bone.len * 0.55} ry={bone.w * 0.5} fill={skin} />
      <ellipse cx={bone.len * 0.52} cy={0} rx={bone.len * 0.34} ry={bone.w * 0.32} fill={shadowOf(skin, 0.14)} opacity={0.55} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Quadruped body

function quadBodyShapes(bone: Bone, inset: number) {
  const L = bone.len;
  const w = bone.w;
  return (
    <g>
      <ellipse cx={L * 0.16} cy={0} rx={L * 0.2 - inset} ry={w * 0.56 - inset} />
      <ellipse cx={L * 0.82} cy={0} rx={L * 0.19 - inset} ry={w * 0.62 - inset} />
      <rect
        x={L * 0.12 + inset}
        y={-w * 0.45 + inset}
        width={L * 0.76 - inset * 2}
        height={w * 0.9 - inset * 2}
        rx={w * 0.3}
      />
    </g>
  );
}

function QuadBody({
  bone,
  genome,
  saddle,
  uid,
}: {
  bone: Bone;
  genome: Genome;
  saddle?: AccessorySpec;
  uid: string;
}) {
  const palette = genome.palette;
  const L = bone.len;
  const w = bone.w;
  const skin = palette.skin;
  const clip = `body-${uid}`;

  return (
    <g>
      <g fill={skin}>{quadBodyShapes(bone, 0)}</g>

      <g clipPath={`url(#${clip})`}>
        {/* light belly */}
        <ellipse cx={L * 0.5} cy={-w * 0.18} rx={L * 0.3} ry={w * 0.28} fill={palette.belly} />
        {/* hard shadow under the barrel and on the rump */}
        <ellipse cx={L * 0.52} cy={-w * 0.48} rx={L * 0.4} ry={w * 0.3} fill={shadowOf(skin, 0.16)} opacity={0.6} />
        <ellipse cx={L * 0.2} cy={-w * 0.1} rx={L * 0.13} ry={w * 0.5} fill={shadowOf(skin, 0.12)} opacity={0.4} />
        {/* top sheen */}
        <ellipse cx={L * 0.48} cy={w * 0.34} rx={L * 0.22} ry={w * 0.16} fill={ART.paper} opacity={0.18} />
      </g>

      {saddle && (
        <g clipPath={`url(#${clip})`}>
          <rect
            x={L * 0.52}
            y={-w * 0.56}
            width={6}
            height={w * 1.12}
            rx={3}
            fill={darken(saddle.color, 0.2)}
          />
        </g>
      )}
    </g>
  );
}

function QuadNeck({ bone, genome }: { bone: Bone; genome: Genome }) {
  const palette = genome.palette;
  const hair = hairOf(palette);
  const L = bone.len;
  const w = bone.w;

  return (
    <g>
      <Capsule bone={bone} fill={palette.skin} />
      {Array.from({ length: 7 }, (_, i) => {
        const t = i / 6;
        const r = w * (0.18 - t * 0.045);
        return (
          <circle
            key={i}
            cx={L * (0.03 + t * 0.94)}
            cy={w * 0.48 - t * w * 0.03}
            r={r}
            fill={hair}
          />
        );
      })}
      <circle cx={L * 0.01} cy={w * 0.45} r={w * 0.18} fill={hair} />
    </g>
  );
}

function QuadMuzzle({
  bone,
  genome,
  bridle,
}: {
  bone: Bone;
  genome: Genome;
  bridle?: boolean;
}) {
  const palette = genome.palette;
  const L = bone.len;
  const w = bone.w;
  const muzzle = muzzleOf(palette);
  const nose = noseOf(palette);

  return (
    <g>
      <ellipse cx={L * 0.44} cy={0} rx={L * 0.55} ry={w * 0.5} fill={muzzle} />
      {/* nose pad */}
      <ellipse cx={L * 0.82} cy={-w * 0.04} rx={L * 0.14} ry={w * 0.2} fill={nose} />
      <ellipse cx={L * 0.8} cy={w * 0.08} rx={L * 0.045} ry={w * 0.06} fill={ART.paper} opacity={0.35} />
      {/* smile */}
      <path
        d={`M ${L * 0.3} ${-w * 0.26} Q ${L * 0.44} ${-w * 0.4} ${L * 0.58} ${-w * 0.26}`}
        fill="none"
        stroke={palette.mouth}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      {bridle && (
        <rect
          x={L * 0.5}
          y={-w * 0.54}
          width={2.4}
          height={w * 1.08}
          rx={1.2}
          fill={darken(palette.detail, 0.2)}
        />
      )}
    </g>
  );
}

function Ear({ bone, genome }: { bone: Bone; genome: Genome }) {
  const skin = genome.palette.skin;
  return (
    <g>
      <path
        d={`M0 0 C ${bone.len * 0.42} ${-bone.w * 0.36} ${bone.len * 0.86} ${-bone.w * 0.28} ${bone.len} 0 C ${bone.len * 0.86} ${bone.w * 0.28} ${bone.len * 0.42} ${bone.w * 0.36} 0 0 Z`}
        fill={skin}
      />
      <path
        d={`M ${bone.len * 0.12} 0 C ${bone.len * 0.42} ${-bone.w * 0.18} ${bone.len * 0.7} ${-bone.w * 0.16} ${bone.len * 0.86} 0 C ${bone.len * 0.7} ${bone.w * 0.16} ${bone.len * 0.42} ${bone.w * 0.18} ${bone.len * 0.12} 0 Z`}
        fill={genome.palette.belly}
        opacity={0.8}
      />
    </g>
  );
}

function Tail({ bone, genome }: { bone: Bone; genome: Genome }) {
  const palette = genome.palette;
  const fill = bone.id === 'tail1' ? palette.skin : hairOf(palette);
  return (
    <g>
      <Capsule bone={bone} fill={fill} />
      {bone.id === 'tail3' && (
        <ellipse cx={bone.len * 0.92} cy={0} rx={bone.len * 0.46} ry={bone.w * 0.78} fill={hairOf(palette)} />
      )}
    </g>
  );
}

function Hoof({ bone, detail }: { bone: Bone; detail: string }) {
  return (
    <g>
      <rect x={-1} y={-bone.w * 0.52} width={bone.len + 3} height={bone.w * 1.04} rx={bone.w * 0.32} fill={detail} />
      <rect x={bone.len + 1} y={-bone.w * 0.52} width={2.6} height={bone.w * 1.04} rx={1.3} fill={darken(detail, 0.3)} />
      <rect x={-0.5} y={-bone.w * 0.5} width={2.4} height={bone.w} rx={1.2} fill={lighten(detail, 0.12)} opacity={0.7} />
    </g>
  );
}

function Saddle({ color, accent }: { color: string; accent: string }) {
  return (
    <g>
      <ellipse cx={0} cy={0} rx={7.5} ry={18} fill={accent} opacity={0.95} />
      <ellipse cx={0} cy={0} rx={7} ry={17} fill={darken(color, 0.14)} />
      <ellipse cx={0} cy={0} rx={4.4} ry={13} fill={color} />
      <rect x={-2.3} y={-9} width={4.6} height={18} rx={2.3} fill={darken(color, 0.3)} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Octopus tentacles

function Tentacle({
  bone,
  paletteSkin,
  paletteBelly,
}: {
  bone: Bone;
  paletteSkin: string;
  paletteBelly: string;
}) {
  const seg = Number(bone.id.split('_')[1] ?? 0);
  const chain = Number(bone.id.match(/tentacle(\d+)/)?.[1] ?? 0);
  const front = chain >= 4;

  return (
    <g>
      <Capsule bone={bone} fill={paletteSkin} />
      {front &&
        seg % 2 === 0 &&
        [0.32, 0.7].map((u) => (
          <circle
            key={u}
            cx={bone.len * u}
            cy={-bone.w * 0.22}
            r={bone.w * 0.1}
            fill={paletteBelly}
            opacity={0.75}
          />
        ))}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Faces

function FaceView({
  actor,
  pose,
  plan,
  hat,
  human,
  hasMuzzle,
}: {
  actor: Actor;
  pose: ActorPose;
  plan: BodyPlan;
  hat?: AccessorySpec;
  human?: HumanLook;
  hasMuzzle: boolean;
}) {
  const face = actor.genome.face;
  const palette = actor.genome.palette;
  const hair = hairOf(palette);
  const expr = plan === 'biped' ? (pose.face.expression ?? 'neutral') : 'neutral';
  const wink = Math.max(0, Math.min(1, pose.face.wink ?? 0));
  let blink = Math.max(0, Math.min(1, pose.face.blink));
  if (expr === 'laugh') blink = Math.max(blink, 0.38);
  if (expr === 'sleepy') blink = Math.max(blink, 0.5);

  const eyeSize = face.eyeSize * (expr === 'surprised' ? 1.08 : 1);
  const eyeR = (face.eyes >= 3 ? 4.2 : 5.2) * eyeSize;
  const eyeRy = eyeR * 1.18;
  const gap = (face.eyes >= 3 ? 5.2 : 6.4) * face.eyeSpacing;
  const mouthY = plan === 'octopod' ? 6.5 : plan === 'blob' ? 7.5 : 10;

  const positions =
    face.eyes <= 1
      ? [0]
      : face.eyes === 2
        ? [-gap, gap]
        : face.eyes === 3
          ? [-gap * 1.35, 0, gap * 1.35]
          : [-gap * 1.6, -gap * 0.55, gap * 0.55, gap * 1.6];

  const browLift =
    expr === 'surprised'
      ? 3
      : expr === 'thinking'
        ? 1.2
        : expr === 'shy'
          ? 0.7
          : expr === 'laugh'
            ? 1.5
            : expr === 'sleepy'
              ? -1.2
              : 0;
  const browW = human?.face.brow === 'strong' ? 10 : 9.2;
  const browH = human?.face.brow === 'strong' ? 3.2 : 2.4;
  const browTilt = expr === 'surprised' ? 8 : expr === 'shy' ? 9 : 4;

  const cheekBoost =
    Math.max(0, pose.face.cheek) +
    (expr === 'shy' ? 0.4 : expr === 'laugh' ? 0.3 : expr === 'happy' ? 0.2 : 0);
  const blushR = 3.1 * (1 + Math.min(0.35, cheekBoost) * 0.5);
  const blushOpacity = Math.min(0.95, 0.72 + cheekBoost * 0.18);

  const noseRx = human?.face.nose === 'broad' ? 3.4 : human?.face.nose === 'small' ? 2.1 : 2.55;
  const facialHair = human?.facialHair ?? 'none';

  return (
    <g>
      {face.brows &&
        plan === 'biped' &&
        positions.map((x, i) => (
          <rect
            key={`brow-${i}`}
            x={x - browW / 2}
            y={-eyeRy - 4.4 - pose.face.lookY * 0.6 - browLift + (expr === 'thinking' && i === 1 ? 1.7 : 0)}
            width={browW}
            height={browH}
            rx={browH / 2}
            fill={hair}
            opacity={0.92}
            transform={`rotate(${(i % 2 === 0 ? -1 : 1) * browTilt} ${x} ${-eyeRy - 3})`}
          />
        ))}

      {positions.map((x, i) => {
        const closed = blink > 0.82 || (wink > 0.5 && i === 1);
        return (
          <g key={`eye-${i}`} transform={`translate(${x} 0)`}>
            {closed ? (
              <path
                d={`M ${-eyeR} 0 Q 0 ${eyeRy * 0.55} ${eyeR} 0 Q 0 ${eyeRy * 0.18} ${-eyeR} 0 Z`}
                fill={palette.eye}
              />
            ) : (
              <>
                <ellipse rx={eyeR} ry={Math.max(0.9, eyeRy * (1 - 0.9 * blink))} fill={ART.eyeWhite} />
                {face.pupil === 'slit' ? (
                  <ellipse
                    cx={pose.face.lookX * 1.1}
                    cy={pose.face.lookY * 1.1}
                    rx={eyeR * 0.26}
                    ry={eyeRy * (0.8 - 0.7 * blink)}
                    fill={palette.eye}
                  />
                ) : face.pupil === 'star' ? (
                  <path
                    d="M0 -5 L1.4 -1.6 L5 -1.2 L2.2 1.2 L3 4.8 L0 2.8 L-3 4.8 L-2.2 1.2 L-5 -1.2 L-1.4 -1.6 Z"
                    transform={`translate(${pose.face.lookX * 1.1} ${pose.face.lookY * 1.1}) scale(${eyeR / 5})`}
                    fill={palette.eye}
                  />
                ) : (
                  <circle
                    cx={pose.face.lookX * 1.1}
                    cy={pose.face.lookY * 1.1}
                    r={eyeR * (0.66 - 0.56 * blink)}
                    fill={palette.eye}
                  />
                )}
                {blink < 0.62 && (
                  <>
                    <circle
                      cx={pose.face.lookX * 1.1 - eyeR * 0.32}
                      cy={pose.face.lookY * 1.1 - eyeRy * 0.3}
                      r={eyeR * 0.24}
                      fill={ART.eyeWhite}
                    />
                    <circle
                      cx={pose.face.lookX * 1.1 + eyeR * 0.3}
                      cy={pose.face.lookY * 1.1 + eyeRy * 0.28}
                      r={eyeR * 0.1}
                      fill={ART.eyeWhite}
                      opacity={0.9}
                    />
                  </>
                )}
                {human?.face.lashes && blink < 0.4 && (
                  <g fill={palette.eye}>
                    {[0, 1, 2].map((k) => {
                      const side = x < 0 ? -1 : 1;
                      return (
                        <circle
                          key={k}
                          cx={side * (eyeR * 0.92 + k * 1.2)}
                          cy={-eyeRy * 0.55 + k * 1.15}
                          r={1.5 - k * 0.32}
                        />
                      );
                    })}
                  </g>
                )}
              </>
            )}
          </g>
        );
      })}

      <ellipse cx={-10.2} cy={mouthY - 2.6} rx={blushR} ry={blushR * 0.74} fill={ART.blush} opacity={blushOpacity} />
      <ellipse cx={10.2} cy={mouthY - 2.6} rx={blushR} ry={blushR * 0.74} fill={ART.blush} opacity={blushOpacity} />

      {plan === 'biped' && !hasMuzzle && (
        <ellipse cx={0} cy={mouthY - 4.6} rx={noseRx} ry={noseRx * 0.72} fill={noseOf(palette)} />
      )}

      {facialHair === 'stubble' && (
        <path
          d="M -9.8 3.4 Q -11.8 10.4 -6 13.2 Q 0 14.8 6 13.2 Q 11.8 10.4 9.8 3.4 Q 0 7 -9.8 3.4 Z"
          fill={hair}
          opacity={0.18}
        />
      )}
      {facialHair === 'beard' && (
        <g fill={hair}>
          <path d="M -11.4 2.2 Q -12.8 9.6 -8 12.8 Q -3.4 15 0 15 Q 3.4 15 8 12.8 Q 12.8 9.6 11.4 2.2 Q 8 5.6 4.6 5.8 Q 0 7.4 -4.6 5.8 Q -8 5.6 -11.4 2.2 Z" />
          <path
            d="M -9.4 5.4 Q -10.4 10.2 -6.6 12.2 Q 0 14.8 6.6 12.2 Q 10.4 10.2 9.4 5.4 Q 0 9.4 -9.4 5.4 Z"
            fill={darken(hair, 0.12)}
            opacity={0.35}
          />
        </g>
      )}
      {facialHair === 'goatee' && (
        <g fill={hair}>
          <ellipse cx={0} cy={12.2} rx={4.6} ry={3.2} />
          <path d="M -2.2 7.6 Q 0 8.6 2.2 7.6 L 1.6 9.6 Q 0 10.4 -1.6 9.6 Z" />
        </g>
      )}

      {expr === 'surprised' ? (
        <g>
          <ellipse cx={0} cy={mouthY + 1.4} rx={3.2} ry={4.2} fill={palette.mouth} />
          <ellipse cx={0} cy={mouthY + 2.9} rx={2} ry={1.2} fill="#E86A6A" opacity={0.8} />
        </g>
      ) : expr === 'thinking' || expr === 'sleepy' ? (
        <rect x={expr === 'sleepy' ? -3.2 : -4.6} y={mouthY - 0.8} width={expr === 'sleepy' ? 6.4 : 9.2} height={2.2} rx={1.1} fill={palette.mouth} />
      ) : expr === 'laugh' ? (
        <g>
          <path
            d={`M -7 ${mouthY - 1.6} Q 0 ${mouthY + 8} 7 ${mouthY - 1.6} Q 0 ${mouthY + 2} -7 ${mouthY - 1.6} Z`}
            fill={palette.mouth}
          />
          <ellipse cx={0} cy={mouthY + 3.6} rx={3.4} ry={1.6} fill="#E86A6A" />
        </g>
      ) : !hasMuzzle && face.mouth !== 'none' ? (
        <Mouth
          kind={face.mouth}
          y={mouthY}
          open={expr === 'happy' ? Math.max(0.32, pose.face.mouth) : expr === 'shy' ? 0.14 : pose.face.mouth}
          color={palette.mouth}
        />
      ) : null}

      {(facialHair === 'mustache' || facialHair === 'beard') && (
        <path
          d="M -9.2 6.6 Q -4.8 4.6 -0.6 7 Q 0 7.6 0.6 7 Q 4.8 4.6 9.2 6.6 Q 6.6 9.8 3.4 9.4 Q 0 9 0 7.9 Q 0 9 -3.4 9.4 Q -6.6 9.8 -9.2 6.6 Z"
          fill={hair}
        />
      )}

      {plan === 'biped' && human && <HairFront human={human} palette={palette} />}

      {hat?.kind === 'cowboy-hat' && <CowboyHat color={hat.color} band={palette.detail} />}
      {hat?.kind === 'chef-hat' && <ChefHat color={hat.color} />}
      {hat?.kind === 'beanie' && <Beanie color={hat.color} band={palette.accent} />}
      {hat?.kind === 'cap' && <Cap color={hat.color} band={palette.accent} />}
      {actor.genome.accessories
        .filter((a) => a.kind === 'glasses')
        .map((a) => (
          <Glasses key="glasses" color={a.color} positions={positions} eyeR={eyeR} eyeRy={eyeRy} />
        ))}
    </g>
  );
}

function Mouth({
  kind,
  y,
  open,
  color,
}: {
  kind: 'smile' | 'grin' | 'fang' | 'beak';
  y: number;
  open: number;
  color: string;
}) {
  const k = Math.max(0, Math.min(1, open));
  if (kind === 'smile') {
    return (
      <path
        d={`M-5.4 ${y} Q0 ${y + 3.4 + 3 * k} 5.4 ${y}`}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    );
  }
  if (kind === 'grin') {
    return (
      <g>
        <path d={`M-6.5 ${y - 1} Q0 ${y + 7 + 2 * k} 6.5 ${y - 1} Q0 ${y + 2.5} -6.5 ${y - 1} Z`} fill={color} />
        <ellipse cx={0} cy={y + 3.6 + k} rx={3.2} ry={1.7 + k * 0.6} fill="#E86A6A" />
      </g>
    );
  }
  if (kind === 'fang') {
    return (
      <g>
        <path
          d={`M-6 ${y} Q0 ${y + 5.5} 6 ${y}`}
          fill="none"
          stroke={color}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
        <path d={`M-3.6 ${y + 1.4} l1.8 4.2 l1.8 -4.2 Z`} fill={ART.paper} />
        <path d={`M1.8 ${y + 1.4} l1.8 4.2 l1.8 -4.2 Z`} fill={ART.paper} />
      </g>
    );
  }
  return <path d={`M-4.5 ${y - 2} L4.5 ${y - 2} L0 ${y + 5.5} Z`} fill={color} />;
}

// ---------------------------------------------------------------------------
// Hats & glasses

function CowboyHat({ color, band }: { color: string; band: string }) {
  return (
    <g transform="translate(0 -15.5)">
      <ellipse cx={0} cy={0} rx={21} ry={4.5} fill={color} />
      <path d="M-11.5 0 Q-11.5 -14.5 0 -14.5 Q11.5 -14.5 11.5 0 Z" fill={color} />
      <rect x={-11.5} y={-4.6} width={23} height={3.8} rx={1.9} fill={band} />
      <path d="M-11.5 0 Q0 3.4 11.5 0" fill="none" stroke={darken(color, 0.14)} strokeWidth={1.3} opacity={0.45} />
    </g>
  );
}

function ChefHat({ color }: { color: string }) {
  const shadow = darken(color, 0.09);
  return (
    <g transform="translate(0 -13.5)">
      {/* band */}
      <path d="M -10.6 0 L 10.6 0 L 10 -7 L -10 -7 Z" fill={color} />
      <rect x={-10.6} y={-2.2} width={21.2} height={3.4} rx={1.7} fill={shadow} />
      {/* three puffs, one solid mass */}
      <circle cx={-7.6} cy={-10} r={6.8} fill={color} />
      <circle cx={7.6} cy={-10} r={6.8} fill={color} />
      <circle cx={0} cy={-13.4} r={8.2} fill={color} />
      <circle cx={0} cy={-7.2} r={7.6} fill={color} />
      {/* flat creases so the puffs read without an outline */}
      <path d="M -13 -7 Q -9 -4.4 -4.6 -7.4 Q -8.6 -9.4 -13 -7 Z" fill={shadow} opacity={0.55} />
      <path d="M 13 -7 Q 9 -4.4 4.6 -7.4 Q 8.6 -9.4 13 -7 Z" fill={shadow} opacity={0.55} />
      <path d="M -8 -10 Q -4 -12.4 0 -9.6 Q -4 -8.4 -8 -10 Z" fill={shadow} opacity={0.3} />
    </g>
  );
}

function Beanie({ color, band }: { color: string; band: string }) {
  return (
    <g transform="translate(0 -12.5)">
      <path d="M-14 0 Q-14 -18 0 -18 Q14 -18 14 0 Z" fill={color} />
      <rect x={-14} y={-4} width={28} height={5.4} rx={2.7} fill={band} />
      <circle cx={0} cy={-18} r={3.2} fill={band} />
    </g>
  );
}

function Cap({ color, band }: { color: string; band: string }) {
  return (
    <g transform="translate(0 -12.5)">
      <path d="M-13 0 Q-13 -16 0 -16 Q13 -16 13 0 Z" fill={color} />
      <ellipse cx={4} cy={-1} rx={18} ry={4} fill={color} />
      <rect x={-13} y={-4} width={26} height={3.6} rx={1.8} fill={band} />
    </g>
  );
}

function Glasses({
  color,
  positions,
  eyeR,
  eyeRy,
}: {
  color: string;
  positions: number[];
  eyeR: number;
  eyeRy: number;
}) {
  return (
    <g>
      {positions.map((x) => (
        <rect
          key={x}
          x={x - eyeR - 1.4}
          y={-eyeRy - 1}
          width={(eyeR + 1.4) * 2}
          height={(eyeRy + 1) * 2}
          rx={4}
          fill="none"
          stroke={color}
          strokeWidth={1.6}
        />
      ))}
      {positions.length > 1 && (
        <line
          x1={positions[0] + eyeR + 1.4}
          y1={0}
          x2={positions[positions.length - 1] - eyeR - 1.4}
          y2={0}
          stroke={color}
          strokeWidth={1.4}
        />
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Primitives

function Capsule({ bone, fill }: { bone: Bone; fill: string }) {
  if (bone.len <= 0.01) return <circle cx={0} cy={0} r={Math.max(0.1, bone.w / 2)} fill={fill} />;
  const w0 = bone.w / 2;
  const w1 = Math.max(0.2, (bone.w * (1 - bone.taper)) / 2);
  const d = `M0 ${-w0} L${bone.len} ${-w1} Q${bone.len + w1} 0 ${bone.len} ${w1} L0 ${w0} Q${-w0} 0 0 ${-w0} Z`;
  return (
    <g>
      <path d={d} fill={fill} />
      <circle cx={0} cy={0} r={w0} fill={fill} />
    </g>
  );
}

function BlobShape({ bone, fill, paletteBelly }: { bone: Bone; fill: string; paletteBelly: string }) {
  const rx = Math.max(0.1, bone.len / 2);
  const ry = Math.max(0.1, bone.w / 2);
  return (
    <g>
      <ellipse cx={rx} cy={0} rx={rx} ry={ry} fill={fill} />
      {(bone.role === 'spine' || bone.id === 'body' || bone.id === 'mantle') && (
        <ellipse cx={rx * 0.82} cy={-ry * 0.2} rx={rx * 0.44} ry={ry * 0.44} fill={paletteBelly} opacity={0.45} />
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Skeleton overlay

function SkeletonOverlay({
  scene,
  transforms,
  fit,
}: {
  scene: Scene;
  transforms: ReturnType<typeof sceneTransforms>;
  fit: Fit;
}) {
  return (
    <g pointerEvents="none">
      {scene.actors.map((actor) => {
        const tr = transforms.get(actor.id);
        if (!tr) return null;
        return (
          <g key={actor.id}>
            {actor.skeleton.bones.map((bone) => {
              const m = tr.bones.get(bone.id);
              if (!m) return null;
              return (
                <g key={bone.id} transform={toSvg(m, fit.ox, fit.oy, fit.s)}>
                  <line
                    x1={0}
                    y1={0}
                    x2={bone.len}
                    y2={0}
                    stroke="#22D3EE"
                    strokeWidth={1.4}
                    vectorEffect="non-scaling-stroke"
                    opacity={0.92}
                  />
                  <circle cx={0} cy={0} r={0.9} fill="#0EA5E9" stroke="#FFFFFF" strokeWidth={0.25} />
                </g>
              );
            })}
          </g>
        );
      })}
    </g>
  );
}
