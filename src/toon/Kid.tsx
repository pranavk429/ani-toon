'use client';

import { useId } from 'react';
import { ARM, BUILD, CAN_GEOM, FEET, FLOOR_Y, SCALE, armGeom } from './rig';
import {
  hairBob,
  hairCap,
  mix,
  mustachePath,
  pill,
  roundedPolygon,
  roundedTriangle,
  tomb,
} from './shapes';
import type { CharacterSpec, Pose } from './types';

// Exact shapes and proportions from RevealScene.swift, ChefScene.swift, and GardenScene.swift:
// - 100-wide tombstone head from y = -66 to y = +56, pivoting at the collar (0, 56)
// - Pill eyes at cy = -8, w = 30, h = 40 with skin lids clipped 2 units wider
// - Hair drawn as ONE outline (hairCap / hairBob) with face opening at y = -42..-31 (never touching eyes)
// - Capsule arms behind torso with short wide sleeve (w+10) or long chef sleeve + cuff
// - Rotated leg frames with tucked shoes, skin calves, socks/stripes or rain-boots

const INK = {
  white: '#FFFFFF',
  pupil: '#3C3C3C',
  mouth: '#B03A3A',
  tongue: '#F15A5A',
  feature: '#D97856',
};

const HEAD_PATH = tomb(0, -66, 100, 122, 26);
const TORSO_PATH = roundedPolygon(
  [
    { x: -BUILD.shoulders, y: BUILD.torsoTop },
    { x: BUILD.shoulders, y: BUILD.torsoTop },
    { x: BUILD.waist, y: BUILD.torsoBottom },
    { x: -BUILD.waist, y: BUILD.torsoBottom },
  ],
  18,
);

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

/** Watering can hanging from the right hand grip (GardenScene.swift L748-770). */
export function WateringCanInBody({
  gx,
  gy,
  angle,
  color = '#3BB8C7',
  flat,
}: {
  gx: number;
  gy: number;
  angle: number;
  color?: string;
  flat?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const canC = flat ?? color;
  const shadeC = flat ?? mix(color, '#000000', 0.18);
  const roseDeg =
    (Math.atan2(
      CAN_GEOM.spoutTip.y - CAN_GEOM.spoutFrom.y,
      CAN_GEOM.spoutTip.x - CAN_GEOM.spoutFrom.x,
    ) *
      180) /
    Math.PI;
  return (
    <g transform={`translate(${gx} ${gy}) rotate(${angle})`}>
      <defs>
        <clipPath id={`${uid}can`}>
          <rect x={-24} y={14} width={48} height={38} rx={10} />
        </clipPath>
      </defs>
      <line
        x1={CAN_GEOM.spoutFrom.x}
        y1={CAN_GEOM.spoutFrom.y}
        x2={CAN_GEOM.spoutTip.x}
        y2={CAN_GEOM.spoutTip.y}
        stroke={shadeC}
        strokeWidth={9}
        strokeLinecap="round"
      />
      <g
        transform={`translate(${CAN_GEOM.spoutTip.x} ${CAN_GEOM.spoutTip.y}) rotate(${roseDeg})`}
      >
        <rect x={-2} y={-10} width={9} height={20} rx={4.5} fill={canC} />
      </g>
      <path
        d="M-20 18Q-2 -16 18 16"
        fill="none"
        stroke={shadeC}
        strokeWidth={7}
        strokeLinecap="round"
      />
      <rect x={-24} y={14} width={48} height={38} rx={10} fill={canC} />
      {!flat && (
        <g clipPath={`url(#${uid}can)`}>
          <rect x={10} y={14} width={20} height={40} fill={shadeC} />
        </g>
      )}
      <rect x={-26} y={12} width={52} height={8} rx={4} fill={shadeC} />
    </g>
  );
}

/**
 * Forearms and hands drawn in front of the kitchen counter and pan handle
 * (ChefScene.swift L600-617) so the chef's right hand closes over the handle.
 */
export function KidForearms({
  ch,
  pose,
}: {
  ch: CharacterSpec;
  pose: Pose;
}) {
  const isChef = ch.pattern === 'chef' || ch.accessory === 'chef-hat';
  const sleeveC = isChef ? '#FFFFFF' : ch.top;
  const cuffC = isChef ? '#DCE5EF' : ch.topShade;
  const L = armGeom(pose.armL, -1, pose.shift);
  const R = armGeom(pose.armR, 1, pose.shift);
  return (
    <g
      transform={`translate(${FEET.x} ${FEET.y - pose.lift * SCALE}) scale(${SCALE}) rotate(${pose.lean}) scale(${pose.sx} ${pose.sy}) translate(0 ${-FLOOR_Y})`}
    >
      {[L, R].map((pts, i) => {
        const dx = pts.hx - pts.ex;
        const dy = pts.hy - pts.ey;
        const l = Math.max(0.001, Math.hypot(dx, dy));
        return (
          <g key={i}>
            {isChef ? (
              <>
                <line
                  x1={pts.ex}
                  y1={pts.ey}
                  x2={pts.hx}
                  y2={pts.hy}
                  stroke={sleeveC}
                  strokeWidth={ARM.sleeve}
                  strokeLinecap="round"
                />
                <line
                  x1={pts.hx - (dx / l) * 13}
                  y1={pts.hy - (dy / l) * 13}
                  x2={pts.hx - (dx / l) * 7}
                  y2={pts.hy - (dy / l) * 7}
                  stroke={cuffC}
                  strokeWidth={ARM.sleeve}
                  strokeLinecap="butt"
                />
              </>
            ) : (
              <line
                x1={pts.ex}
                y1={pts.ey}
                x2={pts.hx - (dx / l) * 6}
                y2={pts.hy - (dy / l) * 6}
                stroke={ch.skin}
                strokeWidth={ARM.w}
                strokeLinecap="round"
              />
            )}
            <circle cx={pts.hx} cy={pts.hy} r={ARM.hand} fill={ch.skin} />
          </g>
        );
      })}
    </g>
  );
}

export function Kid({
  ch,
  pose,
  floor,
  opacity = 1,
  flat,
  hideLegs = false,
  holdingCan = false,
  canColor = '#3BB8C7',
}: {
  ch: CharacterSpec;
  pose: Pose;
  floor: string;
  opacity?: number;
  /** draw as a single flat silhouette colour (RevealScene mystery opener) */
  flat?: string;
  hideLegs?: boolean;
  holdingCan?: boolean;
  canColor?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const skin = flat ?? ch.skin;
  const isChef = ch.pattern === 'chef' || ch.accessory === 'chef-hat';
  const topC = flat ?? (isChef && ch.pattern === 'chef' ? '#FFFFFF' : ch.top);
  const shade = flat ?? (isChef && ch.pattern === 'chef' ? '#DCE5EF' : ch.topShade);
  const bottomC = flat ?? ch.bottom;
  const hairC = flat ?? ch.hair;
  const shoeC = flat ?? ch.shoe;
  const featureC = flat ?? mix(ch.skin, '#7A2810', 0.36);
  const cheekC = mix(ch.skin, '#FF6B6B', 0.34);
  const freckleC = mix(ch.skin, '#8A4828', 0.28);
  const yaw = pose.yaw;
  const sh = pose.shift;

  const L = armGeom(pose.armL, -1, sh);
  const R = armGeom(pose.armR, 1, sh);

  // Shadow stays on the floor, shrinks with height, shifts slightly with hips
  const hk = 1 - Math.min(1, (pose.lift * SCALE) / 250);
  const shW = BUILD.shadow * SCALE * hk * pose.sx;
  const shH = shW * BUILD.shadowRatio;

  const dx = 10 * yaw;
  const dy = 2.5 * (pose.lookY / 6);

  // LiveEye ported from templates/swiftui/LiveFace.swift & RevealScene.swift / ChefScene.swift
  const eye = (side: -1 | 1) => {
    const widen = pose.widen;
    const cx = side * 19.5 + dx;
    const cy = -8 + dy;
    const w = 30 * (1 + 0.1 * widen);
    const h = 40 * (1 + 0.16 * widen);
    const pw = 13 * (1 - 0.12 * widen);
    const ph = 20 * (1 - 0.12 * widen);
    const lid = side === -1 ? pose.lid : pose.lidR;
    const cheek = Math.max(pose.cheek, 0.18 * lid);
    const top = cy - h / 2 + 7;
    const lidH = h + 4;
    const id = `${uid}e${side === -1 ? 'L' : 'R'}`;
    const px = cx + 5 * yaw + pose.lookX - pw / 2;
    const py = top + pose.lookY;
    const lashY = cy - h / 2 - 2 + lid * lidH;
    const lashOn =
      Math.min(1, lid / 0.06) * Math.min(1, Math.max(0, (0.95 - lid) / 0.08));
    const closedOn = Math.min(1, Math.max(0, (lid - 0.88) / 0.12));
    const happyOn = Math.min(1, Math.max(0, (pose.cheek - 0.86) / 0.14));
    const cheekH = cheek * lidH;
    const closedD = `M${cx - side * w * 0.37} ${cy}H${cx + side * w * 0.13}Q${cx + side * w * 0.33} ${cy} ${cx + side * w * 0.37} ${cy + h * 0.17}`;
    const happyD = `M${cx - w * 0.4} ${cy - h * 0.1}Q${cx} ${cy - h * 0.7} ${cx + w * 0.4} ${cy - h * 0.1}`;
    return (
      <g key={side}>
        <defs>
          <clipPath id={id}>
            <path d={pill(cx, cy, w, h)} />
          </clipPath>
          <clipPath id={`${id}S`}>
            <path d={pill(cx, cy, w + 2, h + 2)} />
          </clipPath>
        </defs>
        <path d={pill(cx, cy, w, h)} fill={INK.white} />
        <g clipPath={`url(#${id})`}>
          <rect
            x={px}
            y={py}
            width={pw}
            height={ph}
            rx={pw / 2}
            fill={INK.pupil}
          />
          <circle
            cx={cx + 5 * yaw + pose.lookX - pw * 0.25}
            cy={py + 5}
            r={2.8}
            fill={INK.white}
          />
        </g>
        <g clipPath={`url(#${id}S)`}>
          <rect
            x={cx - w / 2 - 2}
            y={cy - h / 2 - 2}
            width={w + 4}
            height={Math.max(0, lid * lidH)}
            fill={skin}
          />
          <line
            x1={cx - w / 2 - 2}
            x2={cx + w / 2 + 2}
            y1={lashY}
            y2={lashY}
            stroke={featureC}
            strokeWidth={3}
            strokeOpacity={lashOn}
          />
          <rect
            x={cx - w / 2 - 2}
            y={cy + h / 2 + 2 - cheekH}
            width={w + 4}
            height={Math.max(0, cheekH)}
            fill={skin}
          />
        </g>
        <path
          d={closedD}
          stroke={featureC}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeOpacity={closedOn}
        />
        <path
          d={happyD}
          stroke={featureC}
          strokeWidth={5}
          strokeLinecap="round"
          fill="none"
          strokeOpacity={happyOn}
        />
      </g>
    );
  };

  // LiveMouth ported from templates/swiftui/LiveFace.swift L97-126
  const renderMouth = () => {
    const hasMustache = ch.accessory === 'mustache' || ch.pattern === 'chef';
    const top = (hasMustache ? 30 : 24) + dy;
    const tilt = hasMustache ? 3 : 5.5;
    const mw = pose.mouthW || 33;
    const x0 = -mw / 2 + dx;
    const x1 = mw / 2 + dx;
    const d = Math.max(0.5, pose.mouth);
    const y0 = top + tilt * 0.5;
    const y1 = top - tilt * 0.5;
    const mid = (x0 + x1) * 0.5;
    const my = (y0 + y1) * 0.5;
    const w = x1 - x0;
    const mouthBag = `M${x0} ${y0}L${x1} ${y1}C${x1 + 2} ${y1 + d * 0.9} ${mid + w * 0.3} ${my + d * 1.15} ${mid} ${my + d * 1.1}C${mid - w * 0.3} ${my + d * 1.05} ${x0 - 2} ${y0 + d * 0.85} ${x0} ${y0}Z`;
    const mId = `${uid}mouth`;
    return (
      <g>
        <defs>
          <clipPath id={mId}>
            <path d={mouthBag} />
          </clipPath>
        </defs>
        <path d={mouthBag} fill={INK.mouth} />
        <g clipPath={`url(#${mId})`}>
          {d > 3 && (
            <ellipse
              cx={mid + 2}
              cy={my + d * 0.65}
              rx={w * 0.36}
              ry={d * 0.55}
              fill={INK.tongue}
            />
          )}
          {d > 6 && (
            <path
              d={`M${x0 - 2} ${y0 - 2}L${x1 + 2} ${y1 - 2}L${x1 + 2} ${y1 + 5}L${x0 - 2} ${y0 + 5}Z`}
              fill={INK.white}
            />
          )}
        </g>
      </g>
    );
  };

  // Pigtails behind head (GardenScene.swift L720-729)
  const renderPigtails = () => {
    if (ch.hairStyle !== 'bun' && ch.hairStyle !== 'long') return null;
    const drop = Math.max(-12, Math.min(20, pose.hairUp));
    return (
      <g fill={hairC}>
        {[-1, 1].map((side) => {
          const out = 24 + 1.1 * drop;
          const rot = -side * out + 0.9 * pose.hairSwing;
          return (
            <g
              key={side}
              transform={`translate(${side * 50 - 6 * yaw} 20) rotate(${rot})`}
            >
              <ellipse cx={0} cy={17} rx={14} ry={19} />
            </g>
          );
        })}
      </g>
    );
  };

  // Hair front: ONE outline around the face (RevealScene.swift L557-574 & GardenScene.swift L823-840)
  // Window top is at y = -42 (or -38..-31 for bob), well above the eyes (top at y = -28).
  const renderHairFront = () => {
    if (ch.hairStyle === 'bald') return null;
    if (ch.accessory === 'chef-hat') return null; // chef hat band covers the hairline cleanly
    const q = 5 * yaw;
    if (ch.hairStyle === 'bun' || ch.hairStyle === 'long') {
      const bandC = flat ?? (ch.accessoryColor !== '#FFFFFF' ? ch.accessoryColor : ch.top);
      return (
        <g>
          <path d={hairBob(-40 + 9 * yaw)} fill={hairC} />
          {[-1, 1].map((side) => (
            <path
              key={side}
              d={pill(side * 52 - 6 * yaw, 22, 12, 10)}
              fill={bandC}
            />
          ))}
          {ch.hairStyle === 'bun' && ch.accessory === 'none' && (
            <circle cx={-2 * yaw} cy={-78} r={22} fill={hairC} />
          )}
        </g>
      );
    }
    return (
      <g fill={hairC}>
        <path d={hairCap(-39 + 9 * yaw)} />
        {ch.hairStyle === 'quiff' && (
          <path
            d={roundedTriangle(
              { x: -30 + q, y: -70 },
              { x: 34 + q, y: -104 },
              { x: 48 + q, y: -58 },
              12,
            )}
          />
        )}
        {ch.hairStyle === 'short' && (
          <path
            d={roundedTriangle(
              { x: -18 + q, y: -68 },
              { x: 18 + q, y: -88 },
              { x: 34 + q, y: -62 },
              9,
            )}
          />
        )}
        {ch.hairStyle === 'curly' &&
          [-34, -17, 0, 17, 34].map((x, i) => (
            <circle
              key={i}
              cx={x + q * 0.7}
              cy={-66 - (i % 2 ? 10 : 4) + (Math.abs(x) > 25 ? 6 : 0)}
              r={16}
            />
          ))}
      </g>
    );
  };

  // Hats & accessories ported from ChefScene.swift L512-521 & GardenScene.swift L733-745
  const renderHat = () => {
    const c = flat ?? ch.accessoryColor;
    const c2 = flat ?? mix(ch.accessoryColor, '#7088A0', 0.22);
    switch (ch.accessory) {
      case 'chef-hat': {
        const hatSy = Math.max(0.6, pose.hatSy);
        const hatSx = 1 / Math.pow(hatSy, 0.6);
        return (
          <g
            transform={`translate(0 -44) rotate(${pose.hatTilt}) scale(${hatSx} ${hatSy}) translate(0 44)`}
          >
            <circle cx={-38} cy={-102} r={34} fill={c} />
            <circle cx={38} cy={-104} r={33} fill={c} />
            <circle cx={2} cy={-132} r={42} fill={c} />
            <rect x={-52} y={-112} width={104} height={50} fill={c} />
            {!flat && (
              <>
                <path d={pill(-20 + 3 * yaw, -96, 7, 30)} fill={c2} />
                <path d={pill(18 + 3 * yaw, -98, 7, 26)} fill={c2} />
              </>
            )}
            <rect x={-54} y={-80} width={108} height={36} rx={12} fill={c2} />
          </g>
        );
      }
      case 'sun-hat': {
        const hdx = 3 * yaw;
        const brimC = flat ?? mix(ch.accessoryColor, '#D86C88', 0.16);
        const bandC = flat ?? ch.top;
        return (
          <g
            transform={`translate(0 ${-62 - 0.35 * Math.max(0, pose.hairUp)}) rotate(${0.4 * pose.hairSwing})`}
          >
            <ellipse cx={2 * hdx} cy={0} rx={82} ry={15} fill={brimC} />
            <path d={tomb(1.5 * hdx, -50, 96, 46, 0)} fill={c} />
            <path d={pill(1.5 * hdx, -9, 96, 12)} fill={bandC} />
            {!flat && (
              <g transform={`translate(${26 + 3 * hdx} -10)`}>
                <Daisy r={4.6} />
              </g>
            )}
          </g>
        );
      }
      case 'beanie':
        return (
          <g transform={`translate(${3 * yaw} 0)`}>
            <path d={tomb(0, -88, 108, 46, 0)} fill={c} />
            <rect x={-56} y={-52} width={112} height={15} rx={7.5} fill={c2} />
            <circle cx={0} cy={-92} r={12} fill={c2} />
          </g>
        );
      case 'cap':
        return (
          <g transform={`translate(${3 * yaw} 0)`}>
            <path d={tomb(0, -84, 106, 42, 0)} fill={c} />
            <ellipse cx={28 + yaw * 16} cy={-44} rx={42} ry={8} fill={c2} />
          </g>
        );
      case 'headband':
        return (
          <rect
            x={-54 + 3 * yaw}
            y={-52}
            width={108}
            height={11}
            rx={5.5}
            fill={c}
          />
        );
      case 'glasses':
        return (
          <g fill="none" stroke={flat ?? '#33333B'} strokeWidth={4}>
            <circle cx={-19.5 + dx} cy={-8 + dy} r={22} />
            <circle cx={19.5 + dx} cy={-8 + dy} r={22} />
            <path d={`M${-0.5 + dx} ${-10 + dy}Q${dx} ${-14 + dy} ${0.5 + dx} ${-10 + dy}`} />
          </g>
        );
      default:
        return null;
    }
  };

  // Torso patterns from RevealScene.swift, GardenScene.swift, ChefScene.swift
  const renderTorsoPattern = () => {
    if (flat) return null;
    const clip = `url(#${uid}torso)`;
    if (ch.pattern === 'stripes') {
      return (
        <g clipPath={clip}>
          {[-24, -5, 14].map((x) => (
            <rect
              key={x}
              x={sh + x + 5 * yaw}
              y={BUILD.torsoTop}
              width={10}
              height={BUILD.torsoBottom - BUILD.torsoTop}
              fill={shade}
            />
          ))}
          <path d={pill(sh + 4 * yaw, BUILD.torsoTop + 3, 30, 10)} fill={shade} />
          <circle cx={sh + 19 + 7 * yaw} cy={66} r={6} fill="#FFFFFF" />
        </g>
      );
    }
    if (ch.pattern === 'overalls') {
      const bx = sh + 6 * yaw;
      const denimShade = mix(bottomC, '#000000', 0.16);
      const stripeC = mix(topC, '#FFFFFF', 0.55);
      return (
        <g clipPath={clip}>
          {[62, 80, 98].map((y) => (
            <rect key={y} x={sh - 50} y={y} width={100} height={6} fill={stripeC} />
          ))}
          <line
            x1={bx - 17}
            y1={84}
            x2={sh - 27 + 3 * yaw}
            y2={46}
            stroke={bottomC}
            strokeWidth={9}
          />
          <line
            x1={bx + 17}
            y1={84}
            x2={sh + 27 + 3 * yaw}
            y2={46}
            stroke={bottomC}
            strokeWidth={9}
          />
          <rect x={bx - 24} y={78} width={48} height={40} rx={10} fill={bottomC} />
          <rect x={bx - 11} y={89} width={22} height={14} rx={4} fill={denimShade} />
          <circle cx={bx - 16} cy={85} r={3.6} fill="#FFD84D" />
          <circle cx={bx + 16} cy={85} r={3.6} fill="#FFD84D" />
        </g>
      );
    }
    if (ch.pattern === 'chef' || ch.accessory === 'chef-hat') {
      const kx = sh + 5 * yaw;
      return (
        <>
          <g clipPath={clip}>
            {[-11, 11].map((bx) =>
              [72, 88].map((by) => (
                <circle
                  key={`${bx}-${by}`}
                  cx={sh + bx + 6 * yaw}
                  cy={by}
                  r={3.5}
                  fill="#B7C4D4"
                />
              )),
            )}
            <path d={pill(sh + 27 + 7 * yaw, 72, 4, 14)} fill="#FF5A4E" />
            <rect
              x={sh + 18 + 7 * yaw}
              y={74}
              width={17}
              height={14}
              rx={4}
              fill="#DCE5EF"
            />
          </g>
          <path
            d={roundedPolygon(
              [
                { x: kx - 16, y: 52 },
                { x: kx + 16, y: 52 },
                { x: kx, y: 74 },
              ],
              6,
            )}
            fill="#FF5A4E"
          />
          <ellipse cx={kx} cy={60} rx={7} ry={6} fill="#D93B30" />
        </>
      );
    }
    if (ch.pattern === 'apron') {
      const apronC =
        ch.accessoryColor === '#FFFFFF' ? '#FFF8EE' : ch.accessoryColor;
      return (
        <g clipPath={clip}>
          <path
            d={`M${sh - 28} 66H${sh + 28}L${sh + BUILD.waist} ${BUILD.torsoBottom + 4}H${sh - BUILD.waist}Z`}
            fill={apronC}
          />
          <path
            d={`M${sh - 14} 50L${sh - 8} 66M${sh + 14} 50L${sh + 8} 66`}
            stroke={apronC}
            strokeWidth={5}
          />
        </g>
      );
    }
    if (ch.pattern === 'badge') {
      return (
        <g clipPath={clip}>
          <path d={pill(sh + 4 * yaw, BUILD.torsoTop + 3, 30, 10)} fill={shade} />
          <circle cx={sh + 18 + 7 * yaw} cy={68} r={7} fill="#FFD84D" />
        </g>
      );
    }
    return (
      <g clipPath={clip}>
        <path d={pill(sh + 4 * yaw, BUILD.torsoTop + 3, 30, 10)} fill={shade} />
      </g>
    );
  };

  const hasMustache = ch.accessory === 'mustache' || ch.pattern === 'chef';
  const rainBoots = ch.pattern === 'overalls' || ch.accessory === 'sun-hat';
  const bootRim = mix(ch.shoe, '#FFFFFF', 0.25);

  return (
    <g opacity={opacity}>
      <ellipse
        cx={FEET.x + sh * 0.4 * SCALE}
        cy={FEET.y - BUILD.shadowUp * SCALE}
        rx={Math.max(0, shW / 2)}
        ry={Math.max(0, shH / 2)}
        fill={floor}
      />
      <g
        transform={`translate(${FEET.x} ${FEET.y - pose.lift * SCALE}) scale(${SCALE}) rotate(${pose.lean}) scale(${pose.sx} ${pose.sy}) translate(0 ${-FLOOR_Y})`}
      >
        <defs>
          <clipPath id={`${uid}torso`}>
            <path d={TORSO_PATH} transform={`translate(${sh} 0)`} />
          </clipPath>
        </defs>

        {ch.hairStyle === 'long' && (
          <path
            transform={`translate(${sh - yaw * 4} 0)`}
            d="M-56 -10Q-56 -56 0 -56Q56 -56 56 -10V52Q56 70 38 70H-38Q-56 70 -56 52Z"
            fill={hairC}
          />
        )}

        {/* Legs in their rotated hip frames (RevealScene.swift L437-452 / GardenScene.swift L650-658) */}
        {!hideLegs &&
          ([-1, 1] as const).map((side) => {
            const angle = side === -1 ? pose.legL : pose.legR;
            const tuck = pose.float * 8 * (0.5 + 0.5 * side * pose.pedal);
            const rot = -side * angle + sh;
            const shoeRot = side > 0 ? pose.toeR : 0;
            const shoeSx = 1 - 0.3 * pose.float;
            const shoeSy = 1 + 0.35 * pose.float;
            return (
              <g
                key={side}
                transform={`translate(${side * BUILD.hip + sh} ${BUILD.hipY}) rotate(${rot})`}
              >
                <g
                  transform={`translate(0 ${46 - tuck}) rotate(${shoeRot}) scale(${shoeSx} ${shoeSy})`}
                >
                  <rect
                    x={-15 + side * 2}
                    y={-4}
                    width={30}
                    height={20}
                    rx={10}
                    fill={shoeC}
                  />
                </g>
                <line
                  x1={0}
                  y1={0}
                  x2={0}
                  y2={24 - tuck}
                  stroke={skin}
                  strokeWidth={20}
                  strokeLinecap="round"
                />
                {rainBoots ? (
                  <>
                    <rect
                      x={-13}
                      y={14 - tuck}
                      width={26}
                      height={37}
                      rx={9}
                      fill={shoeC}
                    />
                    {!flat && (
                      <rect
                        x={-14}
                        y={12 - tuck}
                        width={28}
                        height={9}
                        rx={4.5}
                        fill={bootRim}
                      />
                    )}
                  </>
                ) : (
                  <>
                    <rect
                      x={-12.5}
                      y={16 - tuck}
                      width={25}
                      height={33}
                      rx={9}
                      fill={topC}
                    />
                    {!flat && (
                      <rect
                        x={-12.5}
                        y={21 - tuck}
                        width={25}
                        height={5}
                        fill={INK.white}
                      />
                    )}
                  </>
                )}
              </g>
            );
          })}

        {/* Shorts (RevealScene.swift L457) */}
        {!hideLegs && (
          <rect
            x={sh - 40}
            y={104}
            width={80}
            height={34}
            rx={12}
            fill={bottomC}
          />
        )}

        {/* Arms behind the torso (RevealScene.swift L459-472 & ChefScene.swift L469-472) */}
        {(
          [
            [L, -1, pose.armL],
            [R, 1, pose.armR],
          ] as const
        ).map(([g, side, limb]) => {
          const aRad = (limb.a * Math.PI) / 180;
          if (isChef && !flat) {
            return (
              <g key={side}>
                <polyline
                  points={`${g.sx},${g.sy} ${g.ex},${g.ey} ${g.hx},${g.hy}`}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth={ARM.sleeve}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx={g.hx} cy={g.hy} r={ARM.hand} fill={skin} />
              </g>
            );
          }
          return (
            <g key={side}>
              <polyline
                points={`${g.sx},${g.sy} ${g.ex},${g.ey} ${g.hx - g.ux * 8},${g.hy - g.uy * 8}`}
                fill="none"
                stroke={skin}
                strokeWidth={ARM.w}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx={g.hx} cy={g.hy} r={ARM.hand} fill={skin} />
              <line
                x1={g.sx}
                y1={g.sy}
                x2={g.sx + side * Math.sin(aRad) * 16}
                y2={g.sy + Math.cos(aRad) * 16}
                stroke={topC}
                strokeWidth={ARM.w + 10}
                strokeLinecap="round"
              />
            </g>
          );
        })}

        {/* If carrying a watering can, it hangs in front of the right arm and the hand closes over its handle (GardenScene.swift L675-678) */}
        {holdingCan && (
          <>
            <WateringCanInBody
              gx={R.hx}
              gy={R.hy}
              angle={pose.tilt - pose.lean}
              color={canColor}
              flat={flat}
            />
            <circle cx={R.hx} cy={R.hy} r={ARM.hand} fill={skin} />
          </>
        )}

        {/* Torso (RevealScene.swift L476-488) */}
        <path d={TORSO_PATH} transform={`translate(${sh} 0)`} fill={topC} />
        {renderTorsoPattern()}

        {/* Forearms in front of torso when bent across the body (e.g. wave, shrug, hip) and not hidden behind kitchen counter */}
        {!hideLegs &&
          !holdingCan &&
          (
            [
              [L, -1, pose.armL],
              [R, 1, pose.armR],
            ] as const
          ).map(([g, side, limb]) => {
            if (Math.abs(limb.e) < 25) return null;
            return (
              <g key={side}>
                <line
                  x1={g.ex}
                  y1={g.ey}
                  x2={g.hx - g.ux * 8}
                  y2={g.hy - g.uy * 8}
                  stroke={skin}
                  strokeWidth={ARM.w}
                  strokeLinecap="round"
                />
                <circle cx={g.hx} cy={g.hy} r={ARM.hand} fill={skin} />
              </g>
            );
          })}

        {/* Head, tilting where it meets the collar at y=56 (RevealScene.swift L493-507) */}
        <g
          transform={`translate(${sh} ${56 + pose.headDy}) rotate(${pose.head}) translate(0 -56)`}
        >
          {renderPigtails()}
          {[-1, 1].map((side) => (
            <circle
              key={side}
              cx={side * 50 - 9 * yaw}
              cy={-8 - 0.5 * dy}
              r={11}
              fill={skin}
            />
          ))}
          <path d={HEAD_PATH} fill={skin} />

          {!flat && (
            <>
              {/* Rosy cheeks + optional freckles */}
              {[-1, 1].map((side) => (
                <ellipse
                  key={side}
                  cx={side * 31 + dx}
                  cy={12 + dy}
                  rx={9}
                  ry={5}
                  fill={cheekC}
                />
              ))}
              {rainBoots &&
                [-1, 1].map((side) =>
                  [
                    [26, 15],
                    [21, 19],
                    [31, 20],
                  ].map(([fx, fy], j) => (
                    <circle
                      key={`${side}-${j}`}
                      cx={side * fx + dx}
                      cy={fy + dy}
                      r={1.9}
                      fill={freckleC}
                    />
                  )),
                )}

              {eye(-1)}
              {eye(1)}

              {/* Expressive eyebrows when surprised, focused, or wearing chef hat/mustache */}
              {(isChef ||
                hasMustache ||
                Math.abs(pose.browL) > 0.05 ||
                Math.abs(pose.browR) > 0.05 ||
                pose.widen > 0.05) &&
                (
                  [
                    [-1, pose.browL],
                    [1, pose.browR],
                  ] as const
                ).map(([side, b]) => (
                  <g
                    key={side}
                    transform={`translate(${side * 20 + dx} ${-33 + dy - 5 * Math.max(0, b) + 2 * Math.max(0, -b) - 0.72 * pose.widen}) rotate(${-side * 16 * Math.max(0, -b) + side * 4 * Math.max(0, b)})`}
                  >
                    <path d={pill(0, 0, 22, 8)} fill={hairC} />
                  </g>
                ))}

              {renderMouth()}

              {/* Nose & Mustache (RevealScene.swift L522-524 / ChefScene.swift L571-574) */}
              {hasMustache ? (
                <>
                  <path
                    d={mustachePath(
                      12 * yaw,
                      22 + dy - 0.12 * pose.mouth,
                      Math.max(pose.cheek, 0) - 0.5 * pose.widen,
                    )}
                    fill={hairC}
                  />
                  <ellipse
                    cx={13 * yaw}
                    cy={10 + dy}
                    rx={10}
                    ry={9}
                    fill={featureC}
                  />
                </>
              ) : (
                <g fill={featureC}>
                  <path d={pill(2 + 13 * yaw, -2 + dy, 8, 21)} />
                  <circle cx={2 + 13 * yaw} cy={8.5 + dy} r={6.5} />
                </g>
              )}
            </>
          )}

          {renderHairFront()}
          {renderHat()}
        </g>
      </g>
    </g>
  );
}
