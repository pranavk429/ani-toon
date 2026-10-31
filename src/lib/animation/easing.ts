/**
 * Deterministic easing evaluation for the Motion DSL.
 *
 * No wall-clock time, randomness or environment state is consulted. Every
 * function here is a pure mapping from a normalized progress value to an eased
 * progress value.
 */

import type {
  CubicBezierEasing,
  Easing,
  NamedEasing,
  SpringEasing,
} from "./types";

export const NAMED_EASINGS: readonly NamedEasing[] = [
  "linear",
  "easeIn",
  "easeOut",
  "easeInOut",
  "quadIn",
  "quadOut",
  "quadInOut",
  "cubicIn",
  "cubicOut",
  "cubicInOut",
  "backIn",
  "backOut",
  "backInOut",
  "spring",
  "springSoft",
  "springBouncy",
] as const;

const NAMED_EASING_SET: ReadonlySet<string> = new Set(NAMED_EASINGS);

export function isNamedEasing(value: unknown): value is NamedEasing {
  return typeof value === "string" && NAMED_EASING_SET.has(value);
}

const BACK_CONSTANT = 1.70158;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return value > 0 ? 1 : 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * CSS-style cubic-bezier timing function.
 *
 * The x coordinate is solved with Newton-Raphson followed by a deterministic
 * bisection fallback. 24 fixed iterations are cheap and stable.
 */
export function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (t: number) => number {
  const cx1 = Math.min(1, Math.max(0, x1));
  const cx2 = Math.min(1, Math.max(0, x2));

  const sampleX = (t: number): number => {
    const mt = 1 - t;
    return (
      3 * mt * mt * t * cx1 +
      3 * mt * t * t * cx2 +
      t * t * t
    );
  };
  const sampleY = (t: number): number => {
    const mt = 1 - t;
    return 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t;
  };
  const derivativeX = (t: number): number => {
    const mt = 1 - t;
    return (
      3 * mt * mt * cx1 +
      6 * mt * t * (cx2 - cx1) +
      3 * t * t * (1 - cx2)
    );
  };

  return (input: number): number => {
    const x = clamp01(input);
    if (x === 0) return 0;
    if (x === 1) return 1;

    let t = x;
    for (let i = 0; i < 8; i++) {
      const error = sampleX(t) - x;
      if (Math.abs(error) < 1e-7) return sampleY(t);
      const slope = derivativeX(t);
      if (Math.abs(slope) < 1e-6) break;
      const next = t - error / slope;
      if (!Number.isFinite(next) || next < 0 || next > 1) break;
      t = next;
    }

    let low = 0;
    let high = 1;
    t = x;
    for (let i = 0; i < 40; i++) {
      const value = sampleX(t);
      if (Math.abs(value - x) < 1e-7) break;
      if (value < x) low = t;
      else high = t;
      t = (low + high) / 2;
    }
    return sampleY(t);
  };
}

const cssEaseIn = cubicBezier(0.42, 0, 1, 1);
const cssEaseOut = cubicBezier(0, 0, 0.58, 1);
const cssEaseInOut = cubicBezier(0.42, 0, 0.58, 1);

const SPRING_PRESETS: Record<
  "spring" | "springSoft" | "springBouncy",
  Required<SpringEasing>
> = {
  spring: { type: "spring", stiffness: 12, damping: 5, mass: 1 },
  springSoft: { type: "spring", stiffness: 9, damping: 5.2, mass: 1 },
  springBouncy: { type: "spring", stiffness: 22, damping: 3.4, mass: 1 },
};

function namedEasingValue(name: NamedEasing, t: number): number {
  switch (name) {
    case "linear":
      return t;
    case "easeIn":
      return cssEaseIn(t);
    case "easeOut":
      return cssEaseOut(t);
    case "easeInOut":
      return cssEaseInOut(t);
    case "quadIn":
      return t * t;
    case "quadOut":
      return 1 - (1 - t) * (1 - t);
    case "quadInOut":
      return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    case "cubicIn":
      return t * t * t;
    case "cubicOut":
      return 1 - (1 - t) ** 3;
    case "cubicInOut":
      return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
    case "backIn": {
      const c3 = BACK_CONSTANT + 1;
      return c3 * t * t * t - BACK_CONSTANT * t * t;
    }
    case "backOut": {
      const c3 = BACK_CONSTANT + 1;
      return 1 + c3 * (t - 1) ** 3 + BACK_CONSTANT * (t - 1) ** 2;
    }
    case "backInOut": {
      const c2 = BACK_CONSTANT * 1.525;
      if (t < 0.5) {
        return ((2 * t) ** 2 * ((c2 + 1) * 2 * t - c2)) / 2;
      }
      return ((2 * t - 2) ** 2 * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
    }
    case "spring":
      return springValue(SPRING_PRESETS.spring, t);
    case "springSoft":
      return springValue(SPRING_PRESETS.springSoft, t);
    case "springBouncy":
      return springValue(SPRING_PRESETS.springBouncy, t);
    default:
      return t;
  }
}

type SpringParams = {
  stiffness: number;
  damping: number;
  mass: number;
};

export function springValue(
  params: SpringParams,
  progress: number,
): number {
  const t = clamp01(progress);
  if (t === 0) return 0;
  if (t === 1) return 1;

  const mass = Number.isFinite(params.mass) && params.mass > 0 ? params.mass : 1;
  const stiffness =
    Number.isFinite(params.stiffness) && params.stiffness > 0
      ? params.stiffness
      : 1;
  const damping =
    Number.isFinite(params.damping) && params.damping > 0 ? params.damping : 0.0001;

  const omega0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const decay = Math.max(1e-6, zeta * omega0);
  // Time (in normalized seconds) over which the spring is observed. Chosen so
  // the envelope has effectively settled for expressive presets, with a hard
  // cap for extremely under-damped user values.
  const horizon = Math.min(20, Math.max(0.05, 6.9 / decay));

  const displacement = (tau: number): number => {
    if (zeta < 1 - 1e-6) {
      const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
      const envelope = Math.exp(-zeta * omega0 * tau);
      return (
        1 -
        envelope *
          (Math.cos(omegaD * tau) +
            (zeta * omega0 / omegaD) * Math.sin(omegaD * tau))
      );
    }
    if (zeta > 1 + 1e-6) {
      const root = Math.sqrt(zeta * zeta - 1);
      const r1 = -omega0 * (zeta - root);
      const r2 = -omega0 * (zeta + root);
      return (
        1 +
        (r2 * Math.exp(r1 * tau) - r1 * Math.exp(r2 * tau)) / (r1 - r2)
      );
    }
    return 1 - Math.exp(-omega0 * tau) * (1 + omega0 * tau);
  };

  const end = displacement(horizon);
  if (!Number.isFinite(end) || Math.abs(end) < 1e-9) return t;
  return displacement(t * horizon) / end;
}

export function evaluateEasing(easing: Easing, progress: number): number {
  const t = clamp01(progress);
  if (typeof easing === "string") {
    if (!isNamedEasing(easing)) {
      throw new Error(`Unknown easing "${String(easing)}"`);
    }
    return namedEasingValue(easing, t);
  }
  if (easing && easing.type === "cubicBezier") {
    return cubicBezier(easing.x1, easing.y1, easing.x2, easing.y2)(t);
  }
  if (easing && easing.type === "spring") {
    return springValue(
      {
        stiffness: easing.stiffness,
        damping: easing.damping,
        mass: easing.mass ?? 1,
      },
      t,
    );
  }
  throw new Error(`Unknown easing ${JSON.stringify(easing)}`);
}

export type EasingSplinePoint = {
  /** Normalized progress, 0..1. */
  offset: number;
  value: number;
};

/** Deterministic sampled representation of an easing curve. */
export function easingSpline(
  easing: Easing,
  samples = 24,
): EasingSplinePoint[] {
  const count = Math.max(2, Math.floor(Number.isFinite(samples) ? samples : 24));
  const points: EasingSplinePoint[] = [];
  for (let i = 0; i < count; i++) {
    const offset = i / (count - 1);
    points.push({ offset, value: evaluateEasing(easing, offset) });
  }
  // Guarantee exact endpoints even for oscillators with rounded totals.
  points[0] = { offset: 0, value: 0 };
  points[points.length - 1] = { offset: 1, value: 1 };
  return points;
}

const CSS_NAMED: Partial<Record<NamedEasing, string>> = {
  linear: "linear",
  easeIn: "ease-in",
  easeOut: "ease-out",
  easeInOut: "ease-in-out",
  quadIn: "cubic-bezier(0.11, 0, 0.5, 0)",
  quadOut: "cubic-bezier(0.5, 1, 0.89, 1)",
  quadInOut: "cubic-bezier(0.45, 0, 0.55, 1)",
  cubicIn: "cubic-bezier(0.32, 0, 0.67, 0)",
  cubicOut: "cubic-bezier(0.33, 1, 0.68, 1)",
  cubicInOut: "cubic-bezier(0.65, 0, 0.35, 1)",
  backIn: "cubic-bezier(0.36, 0, 0.66, -0.56)",
  backOut: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  backInOut: "cubic-bezier(0.68, -0.6, 0.32, 1.6)",
};

function formatCssNumber(value: number): string {
  const rounded = Math.round(value * 1e5) / 1e5;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

/** CSS timing-function representation. Springs use sampled `linear()`. */
export function easingToCss(easing: Easing): string {
  if (typeof easing === "string") {
    if (!isNamedEasing(easing)) {
      throw new Error(`Unknown easing "${String(easing)}"`);
    }
    const named = CSS_NAMED[easing];
    if (named) return named;
    const points = easingSpline(easing, 20);
    return `linear(${points
      .map((point) => `${formatCssNumber(point.value)} ${formatCssNumber(point.offset * 100)}%`)
      .join(", ")})`;
  }
  if (easing.type === "cubicBezier") {
    return `cubic-bezier(${[
      easing.x1,
      easing.y1,
      easing.x2,
      easing.y2,
    ]
      .map(formatCssNumber)
      .join(", ")})`;
  }
  if (easing.type === "spring") {
    const points = easingSpline(easing, 20);
    return `linear(${points
      .map((point) => `${formatCssNumber(point.value)} ${formatCssNumber(point.offset * 100)}%`)
      .join(", ")})`;
  }
  throw new Error(`Unknown easing ${JSON.stringify(easing)}`);
}

/** Type guard used by validation and diagnostics without evaluating. */
export function isCubicBezierEasing(value: unknown): value is CubicBezierEasing {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "cubicBezier"
  );
}

export function isSpringEasing(value: unknown): value is SpringEasing {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "spring"
  );
}
