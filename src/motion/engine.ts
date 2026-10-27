// The motion engine, ported from rossark-motion-skill (motion.ts) to the web.
// One clock. Everything is a pure function of time, so every frame is deterministic.

export const EASE_IN_OUT = bezier(0.77, 0, 0.175, 1);
export const EASE_OUT = bezier(0.23, 1, 0.32, 1);
export const EASE_IN = bezier(0.55, 0, 1, 0.45);

type Bezier = (p: number) => number;

function bezier(x1: number, y1: number, x2: number, y2: number): Bezier {
  // Cubic bezier solved for y at x, via Newton + bisection. Curves are fixed, so
  // a small lookup table is faster and stable at 60fps.
  const n = 32;
  const xs = new Float64Array(n + 1);
  const ys = new Float64Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const mt = 1 - t;
    xs[i] = 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t;
    ys[i] = 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t;
  }
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = n;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] < x) lo = mid;
      else hi = mid;
    }
    const span = xs[hi] - xs[lo] || 1;
    const f = (x - xs[lo]) / span;
    return ys[lo] + (ys[hi] - ys[lo]) * f;
  };
}

export type Key = readonly [time: number, value: number, curve?: 'out'];
export type Keys = readonly Key[];
export type FlowKey = readonly [time: number, value: number];

/** Keyframes that ease in and out of EVERY key: right for one move (a blink, a lid). */
export function track(t: number, keys: Keys): number {
  if (keys.length === 0) return 0;
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const k1 = keys[i];
    if (t <= k1[0]) {
      const k0 = keys[i - 1];
      const span = k1[0] - k0[0];
      const p = span > 0 ? (t - k0[0]) / span : 1;
      const e = k1[2] === 'out' ? EASE_OUT(p) : EASE_IN_OUT(p);
      return k0[1] + (k1[1] - k0[1]) * e;
    }
  }
  return keys[keys.length - 1][1];
}

/**
 * A smooth track through acting poses: a monotone cubic that keeps its speed
 * through every key and never overshoots. This is what stops a character
 * freezing at each pose like a robot.
 */
export function flow(t: number, keys: readonly FlowKey[]): number {
  const n = keys.length;
  if (n === 0) return 0;
  if (t <= keys[0][0]) return keys[0][1];
  if (t >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 0;
  while (i < n - 2 && keys[i + 1][0] < t) i++;

  const slope = (j: number) => {
    const dt = keys[j + 1][0] - keys[j][0];
    return dt === 0 ? 0 : (keys[j + 1][1] - keys[j][1]) / dt;
  };
  const tangent = (j: number) => {
    if (j === 0 || j === n - 1) return 0;
    const a = slope(j - 1);
    const b = slope(j);
    if (a * b <= 0) return 0;
    const h0 = keys[j][0] - keys[j - 1][0];
    const h1 = keys[j + 1][0] - keys[j][0];
    const w0 = 2 * h1 + h0;
    const w1 = h1 + 2 * h0;
    const d = w0 / a + w1 / b;
    return d === 0 ? 0 : (w0 + w1) / d;
  };

  const h = keys[i + 1][0] - keys[i][0];
  const s = h === 0 ? 0 : (t - keys[i][0]) / h;
  const s2 = s * s;
  const s3 = s2 * s;
  return (
    (2 * s3 - 3 * s2 + 1) * keys[i][1] +
    (s3 - 2 * s2 + s) * h * tangent(i) +
    (-2 * s3 + 3 * s2) * keys[i + 1][1] +
    (s3 - s2) * h * tangent(i + 1)
  );
}

/** 0 → 1 inside [a, b], eased. 0 before, 1 after. */
export function seg(t: number, a: number, b: number, curve: 'out' | 'inOut' = 'out'): number {
  if (t <= a) return 0;
  if (t >= b) return 1;
  const p = (t - a) / (b - a);
  return curve === 'out' ? EASE_OUT(p) : EASE_IN_OUT(p);
}

/** -1 → 1, smooth. `phase` (0..1) offsets one item from the next. */
export function wave(t: number, period: number, phase = 0): number {
  return Math.sin((t / period + phase) * Math.PI * 2);
}

/** 0 → 1 progress through a loop. */
export function loop(t: number, period: number, phase = 0): number {
  const p = (t / period + phase) % 1;
  return p < 0 ? p + 1 : p;
}

/** 0 at both ends of a loop, 1 in the middle. */
export function bell(p: number): number {
  return Math.sin(Math.PI * Math.min(1, Math.max(0, p)));
}

/** Stable pseudo-random in [0, 1) for item i. */
export function seeded(i: number, salt = 0): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

/** A damped swing after a jolt at `at`: one quick back-and-forth that dies out. */
export function swing(t: number, at: number, amp: number, period = 600): number {
  if (t <= at) return 0;
  const s = t - at;
  return amp * Math.sin((2 * Math.PI * s) / period) * Math.exp(-s / (period * 0.5));
}

/** A blink track: close 110ms, hold 40ms, reopen 190ms ease-out. */
export function blinkKeys(times: number[], period: number): Keys {
  const keys: Key[] = [[0, 0]];
  for (const b of times) {
    if (b <= 0 || b >= period) continue;
    keys.push([b, 0], [b + 110, 1], [b + 150, 1], [b + 340, 0, 'out']);
  }
  keys.push([period, 0]);
  // Sort and dedupe times (keep the last write at the same timestamp).
  const byTime = new Map<number, Key>();
  for (const k of keys) byTime.set(k[0], k);
  return [...byTime.values()].sort((a, b) => a[0] - b[0]);
}
