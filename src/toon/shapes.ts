// Exact vector shape generators ported from RevealScene.swift, ChefScene.swift,
// and GardenScene.swift. Every curve is closed-form SVG path data with zero
// cutout seams across the face or eyes.

export type Pt = { x: number; y: number };

const f = (n: number) => Number(n.toFixed(2));

export function mix(a: string, b: string, k: number): string {
  const ca = a.startsWith('#') && a.length === 7 ? a : '#888888';
  const cb = b.startsWith('#') && b.length === 7 ? b : '#888888';
  const pa = [1, 3, 5].map((i) => parseInt(ca.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(cb.slice(i, i + 2), 16));
  return (
    '#' +
    pa
      .map((v, i) =>
        Math.max(0, Math.min(255, Math.round(v + (pb[i] - v) * k)))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

/** A capsule/pill centred on (cx, cy). */
export function pill(cx: number, cy: number, w: number, h: number): string {
  const r = Math.min(w, h) / 2;
  const x = cx - w / 2;
  const y = cy - h / 2;
  return `M${f(x + r)} ${f(y)}H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)}V${f(y + h - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w - r)} ${f(y + h)}H${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + h - r)}V${f(y + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)}Z`;
}

/**
 * A tombstone: a half-circle top, straight sides, bottom corners of radius r.
 * When h <= w/2 it is a cap: an arc cut flat at the bottom (used for sun-hat crown).
 */
export function tomb(cx: number, top: number, w: number, h: number, r: number): string {
  const R = w / 2;
  const yb = top + h;
  if (h <= R) {
    const half = Math.sqrt(Math.max(0, R * R - (R - h) * (R - h)));
    return `M${f(cx - half)} ${f(yb)}A${f(R)} ${f(R)} 0 0 1 ${f(cx + half)} ${f(yb)}Z`;
  }
  const q = Math.min(r, R, h - R);
  const cy = top + R;
  return [
    `M${f(cx - R)} ${f(cy)}`,
    `A${f(R)} ${f(R)} 0 0 1 ${f(cx + R)} ${f(cy)}`,
    `L${f(cx + R)} ${f(yb - q)}`,
    `Q${f(cx + R)} ${f(yb)} ${f(cx + R - q)} ${f(yb)}`,
    `L${f(cx - R + q)} ${f(yb)}`,
    `Q${f(cx - R)} ${f(yb)} ${f(cx - R)} ${f(yb - q)}`,
    'Z',
  ].join('');
}

/** A rectangle with only its top corners rounded. */
export function topRound(x: number, y: number, w: number, h: number, r: number): string {
  const q = Math.min(r, w / 2, h);
  return [
    `M${f(x)} ${f(y + h)}`,
    `L${f(x)} ${f(y + q)}`,
    `Q${f(x)} ${f(y)} ${f(x + q)} ${f(y)}`,
    `L${f(x + w - q)} ${f(y)}`,
    `Q${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + q)}`,
    `L${f(x + w)} ${f(y + h)}`,
    'Z',
  ].join('');
}

/** A polygon with every corner rounded (radius r). */
export function roundedPolygon(pts: Pt[], r: number): string {
  const n = pts.length;
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const pt = pts[i];
    const prev = pts[(i + n - 1) % n];
    const next = pts[(i + 1) % n];
    const toward = (q: Pt): Pt => {
      const dx = q.x - pt.x;
      const dy = q.y - pt.y;
      const l = Math.max(0.001, Math.hypot(dx, dy));
      const d = Math.min(r, l * 0.48);
      return { x: pt.x + (dx / l) * d, y: pt.y + (dy / l) * d };
    };
    const s = toward(prev);
    const e = toward(next);
    parts.push(`${i === 0 ? 'M' : 'L'}${f(s.x)} ${f(s.y)}`);
    parts.push(`Q${f(pt.x)} ${f(pt.y)} ${f(e.x)} ${f(e.y)}`);
  }
  parts.push('Z');
  return parts.join('');
}

export function roundedTriangle(a: Pt, b: Pt, c: Pt, r: number): string {
  return roundedPolygon([a, b, c], r);
}

/**
 * The hair cap as ONE outline (RevealScene.swift L557-574):
 * a half-circle top, sideburns down to above the ears, and the face's opening
 * (rounded at the top) starting at `window` and 78 wide.
 * Never a cutout over the eyes!
 */
export function hairCap(x0: number): string {
  const R = 55;
  const cy = -19;
  const bottom = -10;
  const q = 8;
  const top = -42;
  const w = 78;
  const r = 18;
  // Clamp window so sideburns stay well-ordered even on wide turns
  const wx = Math.max(-R + q + 2, Math.min(R - q - w - 2, x0));
  return [
    `M${f(-R)} ${f(cy)}`,
    `A${f(R)} ${f(R)} 0 0 1 ${f(R)} ${f(cy)}`,
    `L${f(R)} ${f(bottom - q)}`,
    `Q${f(R)} ${f(bottom)} ${f(R - q)} ${f(bottom)}`,
    `L${f(wx + w)} ${f(bottom)}`,
    `L${f(wx + w)} ${f(top + r)}`,
    `Q${f(wx + w)} ${f(top)} ${f(wx + w - r)} ${f(top)}`,
    `L${f(wx + r)} ${f(top)}`,
    `Q${f(wx)} ${f(top)} ${f(wx)} ${f(top + r)}`,
    `L${f(wx)} ${f(bottom)}`,
    `L${f(-R + q)} ${f(bottom)}`,
    `Q${f(-R)} ${f(bottom)} ${f(-R)} ${f(bottom - q)}`,
    'Z',
  ].join('');
}

/**
 * The hair bob as ONE outline (GardenScene.swift L823-840):
 * a half-circle top, sides down to the jaw, and the face's opening starting at `window`,
 * 80 wide, its top edge swept lower on the left like a fringe.
 */
export function hairBob(x0: number): string {
  const R = 55;
  const cy = -19;
  const bottom = 26;
  const q = 14;
  const w = 80;
  const r = 16;
  const topL = -31;
  const topR = -38;
  const wx = Math.max(-R + q + 1, Math.min(R - q - w - 1, x0));
  return [
    `M${f(-R)} ${f(cy)}`,
    `A${f(R)} ${f(R)} 0 0 1 ${f(R)} ${f(cy)}`,
    `L${f(R)} ${f(bottom - q)}`,
    `Q${f(R)} ${f(bottom)} ${f(R - q)} ${f(bottom)}`,
    `L${f(wx + w)} ${f(bottom)}`,
    `L${f(wx + w)} ${f(topR + r)}`,
    `Q${f(wx + w)} ${f(topR)} ${f(wx + w - r)} ${f(topR)}`,
    `Q${f(wx + w * 0.42)} ${f(topR + 7)} ${f(wx + r)} ${f(topL)}`,
    `Q${f(wx)} ${f(topL)} ${f(wx)} ${f(topL + r)}`,
    `L${f(wx)} ${f(bottom)}`,
    `L${f(-R + q)} ${f(bottom)}`,
    `Q${f(-R)} ${f(bottom)} ${f(-R)} ${f(bottom - q)}`,
    'Z',
  ].join('');
}

/**
 * A bushy mustache in one outline (ChefScene.swift L577-596):
 * two lobes from the middle, tips that curl up (curl > 0) or droop.
 */
export function mustachePath(cx: number, cy: number, curl: number): string {
  const tipL = { x: cx - 34, y: cy - 6 - 6 * curl };
  const tipR = { x: cx + 34, y: cy - 6 - 6 * curl };
  return [
    `M${f(cx)} ${f(cy - 6)}`,
    `Q${f(cx - 12)} ${f(cy - 12)} ${f(cx - 24)} ${f(cy - 5)}`,
    `Q${f(cx - 32)} ${f(cy - 2)} ${f(tipL.x)} ${f(tipL.y)}`,
    `Q${f(cx - 32)} ${f(cy + 10)} ${f(cx - 14)} ${f(cy + 9)}`,
    `Q${f(cx - 6)} ${f(cy + 9)} ${f(cx)} ${f(cy + 4)}`,
    `Q${f(cx + 6)} ${f(cy + 9)} ${f(cx + 14)} ${f(cy + 9)}`,
    `Q${f(cx + 32)} ${f(cy + 10)} ${f(tipR.x)} ${f(tipR.y)}`,
    `Q${f(cx + 32)} ${f(cy - 2)} ${f(cx + 24)} ${f(cy - 5)}`,
    `Q${f(cx + 12)} ${f(cy - 12)} ${f(cx)} ${f(cy - 6)}`,
    'Z',
  ].join('');
}

/** A soft four-point star centred on (0, 0). */
export function fourPointStar(r: number): string {
  const w = r * 0.32;
  return [
    `M0 ${f(-r)}`,
    `Q${f(w)} ${f(-w)} ${f(r)} 0`,
    `Q${f(w)} ${f(w)} 0 ${f(r)}`,
    `Q${f(-w)} ${f(w)} ${f(-r)} 0`,
    `Q${f(-w)} ${f(-w)} 0 ${f(-r)}`,
    'Z',
  ].join('');
}

/** Heart shape centred on (0, 0) from GardenScene.swift L876-885. */
export function heartShape(r: number): string {
  return [
    `M0 ${f(r * 0.9)}`,
    `C${f(-r * 0.3)} ${f(r * 0.55)} ${f(-r)} ${f(r * 0.3)} ${f(-r)} ${f(-r * 0.2)}`,
    `C${f(-r)} ${f(-r * 0.85)} ${f(-r * 0.15)} ${f(-r * 0.9)} 0 ${f(-r * 0.45)}`,
    `C${f(r * 0.15)} ${f(-r * 0.9)} ${f(r)} ${f(-r * 0.85)} ${f(r)} ${f(-r * 0.2)}`,
    `C${f(r)} ${f(r * 0.3)} ${f(r * 0.3)} ${f(r * 0.55)} 0 ${f(r * 0.9)}`,
    'Z',
  ].join('');
}

/** Burner flame petal from ChefScene.swift L670-678. */
export function petalShape(x: number, y: number, w: number, h: number): string {
  return [
    `M${f(x)} ${f(y - h)}`,
    `Q${f(x + w / 2)} ${f(y - h * 0.4)} ${f(x + w / 2)} ${f(y - 2)}`,
    `Q${f(x)} ${f(y + w * 0.5)} ${f(x - w / 2)} ${f(y - 2)}`,
    `Q${f(x - w / 2)} ${f(y - h * 0.4)} ${f(x)} ${f(y - h)}`,
    'Z',
  ].join('');
}

/** Rounded pentagon for soccer ball patches (RevealScene.swift L415-420). */
export function pentagonPath(cx: number, cy: number, radius: number, turn: number): string {
  const pts: Pt[] = [];
  for (let i = 0; i < 5; i++) {
    const a = turn + (i / 5) * Math.PI * 2 - Math.PI / 2;
    pts.push({ x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius });
  }
  return roundedPolygon(pts, radius * 0.25);
}
