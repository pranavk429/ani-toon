/**
 * Small, deterministic SVG path parser and sampler.
 *
 * Supports M/L/H/V/C/S/Q/T/A/Z in absolute and relative form. Arcs are
 * converted to cubic beziers using the SVG implementation notes, so the
 * sampler works on a single normalized segment representation.
 *
 * Angles are returned in degrees, clockwise in SVG user space (+Y is down).
 */

export type PathPoint = {
  x: number;
  y: number;
};

export type PathLineSegment = {
  type: "line";
  from: PathPoint;
  to: PathPoint;
};

export type PathCubicSegment = {
  type: "cubic";
  from: PathPoint;
  c1: PathPoint;
  c2: PathPoint;
  to: PathPoint;
};

export type PathMoveSegment = {
  type: "move";
  from: PathPoint;
  to: PathPoint;
};

export type PathSegment =
  | PathLineSegment
  | PathCubicSegment
  | PathMoveSegment;

export type ParsedPath = {
  segments: PathSegment[];
  start: PathPoint;
  /** True when at least one subpath was closed with Z. */
  closed: boolean;
};

export type PathSample = {
  x: number;
  y: number;
  /** Tangent direction in degrees. */
  angle: number;
  progress: number;
};

type NumberToken = { kind: "number"; value: number };
type CommandToken = { kind: "command"; value: string };
type Token = NumberToken | CommandToken;

const COMMANDS = "MmLlHhVvCcSsQqTtAaZz";
const ARG_COUNT: Record<string, number> = {
  M: 2,
  L: 2,
  H: 1,
  V: 1,
  C: 6,
  S: 4,
  Q: 4,
  T: 2,
  A: 7,
  Z: 0,
};

const NUMBER_RE =
  /[+-]?(?:(?:\d+\.\d*)|(?:\.\d+)|(?:\d+))(?:[eE][+-]?\d+)?/y;

function tokenize(d: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < d.length) {
    const char = d[i];
    if (char === "," || /\s/.test(char)) {
      i++;
      continue;
    }
    if (COMMANDS.includes(char)) {
      tokens.push({ kind: "command", value: char });
      i++;
      continue;
    }
    NUMBER_RE.lastIndex = i;
    const match = NUMBER_RE.exec(d);
    if (!match || match.index !== i) {
      throw new Error(`Invalid path character "${char}" at position ${i}`);
    }
    const value = Number(match[0]);
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid path number "${match[0]}" at position ${i}`);
    }
    tokens.push({ kind: "number", value });
    i += match[0].length;
  }
  return tokens;
}

function point(x: number, y: number): PathPoint {
  return { x, y };
}

function distance(a: PathPoint, b: PathPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function vectorAngle(from: PathPoint, to: PathPoint): number {
  return (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
}

function cubicDerivativeAngle(
  segment: PathCubicSegment,
  t: number,
): number {
  const mt = 1 - t;
  const dx =
    3 * mt * mt * (segment.c1.x - segment.from.x) +
    6 * mt * t * (segment.c2.x - segment.c1.x) +
    3 * t * t * (segment.to.x - segment.c2.x);
  const dy =
    3 * mt * mt * (segment.c1.y - segment.from.y) +
    6 * mt * t * (segment.c2.y - segment.c1.y) +
    3 * t * t * (segment.to.y - segment.c2.y);
  if (Math.hypot(dx, dy) < 1e-9) {
    return vectorAngle(segment.from, segment.to);
  }
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

function cubicPoint(segment: PathCubicSegment, t: number): PathPoint {
  const mt = 1 - t;
  return {
    x:
      mt * mt * mt * segment.from.x +
      3 * mt * mt * t * segment.c1.x +
      3 * mt * t * t * segment.c2.x +
      t * t * t * segment.to.x,
    y:
      mt * mt * mt * segment.from.y +
      3 * mt * mt * t * segment.c1.y +
      3 * mt * t * t * segment.c2.y +
      t * t * t * segment.to.y,
  };
}

type ArcCubic = {
  c1: PathPoint;
  c2: PathPoint;
  to: PathPoint;
};

/**
 * Convert an SVG endpoint-parameterized arc into cubic beziers.
 * Follows the algorithm in SVG 1.1 appendix F.6.
 */
function arcToCubics(
  from: PathPoint,
  rxInput: number,
  ryInput: number,
  rotationDegrees: number,
  largeArcFlag: number,
  sweepFlag: number,
  to: PathPoint,
): ArcCubic[] {
  if (from.x === to.x && from.y === to.y) return [];

  let rx = Math.abs(rxInput);
  let ry = Math.abs(ryInput);
  if (rx === 0 || ry === 0) {
    return [
      {
        c1: from,
        c2: to,
        to,
      },
    ];
  }

  const phi = (rotationDegrees * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  const dx = (from.x - to.x) / 2;
  const dy = (from.y - to.y) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  const lambda =
    (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const scale = Math.sqrt(lambda);
    rx *= scale;
    ry *= scale;
  }

  const rx2 = rx * rx;
  const ry2 = ry * ry;
  const x1p2 = x1p * x1p;
  const y1p2 = y1p * y1p;
  const denominator = rx2 * y1p2 + ry2 * x1p2;
  const numerator = rx2 * ry2 - rx2 * y1p2 - ry2 * x1p2;
  const sign = largeArcFlag === sweepFlag ? -1 : 1;
  const coefficient =
    denominator === 0
      ? 0
      : sign * Math.sqrt(Math.max(0, numerator / denominator));
  const cxp = coefficient * ((rx * y1p) / ry);
  const cyp = coefficient * -((ry * x1p) / rx);
  const cx = cosPhi * cxp - sinPhi * cyp + (from.x + to.x) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (from.y + to.y) / 2;

  const startVector = point((x1p - cxp) / rx, (y1p - cyp) / ry);
  const endVector = point((-x1p - cxp) / rx, (-y1p - cyp) / ry);
  const startAngle = Math.atan2(startVector.y, startVector.x);
  let deltaAngle =
    Math.atan2(
      startVector.x * endVector.y - startVector.y * endVector.x,
      startVector.x * endVector.x + startVector.y * endVector.y,
    );
  if (!sweepFlag && deltaAngle > 0) deltaAngle -= Math.PI * 2;
  if (sweepFlag && deltaAngle < 0) deltaAngle += Math.PI * 2;

  const count = Math.max(1, Math.ceil(Math.abs(deltaAngle) / (Math.PI / 2)));
  const step = deltaAngle / count;
  const alpha = (4 / 3) * Math.tan(step / 4);
  const ell = (theta: number): PathPoint => ({
    x: cx + cosPhi * rx * Math.cos(theta) - sinPhi * ry * Math.sin(theta),
    y: cy + sinPhi * rx * Math.cos(theta) + cosPhi * ry * Math.sin(theta),
  });
  const derivative = (theta: number): PathPoint => ({
    x: -cosPhi * rx * Math.sin(theta) - sinPhi * ry * Math.cos(theta),
    y: -sinPhi * rx * Math.sin(theta) + cosPhi * ry * Math.cos(theta),
  });

  const cubics: ArcCubic[] = [];
  let theta = startAngle;
  let current = from;
  for (let i = 0; i < count; i++) {
    const nextTheta = theta + step;
    const nextPoint = i === count - 1 ? to : ell(nextTheta);
    const d1 = derivative(theta);
    const d2 = derivative(nextTheta);
    cubics.push({
      c1: point(current.x + alpha * d1.x, current.y + alpha * d1.y),
      c2: point(nextPoint.x - alpha * d2.x, nextPoint.y - alpha * d2.y),
      to: nextPoint,
    });
    current = nextPoint;
    theta = nextTheta;
  }
  return cubics;
}

function lineSegment(from: PathPoint, to: PathPoint): PathLineSegment {
  return { type: "line", from, to };
}

function cubicSegment(
  from: PathPoint,
  c1: PathPoint,
  c2: PathPoint,
  to: PathPoint,
): PathCubicSegment {
  return { type: "cubic", from, c1, c2, to };
}

/** Parse a path into line/cubic segments. Throws on invalid syntax. */
export function parsePath(d: string): ParsedPath {
  if (typeof d !== "string" || d.trim().length === 0) {
    throw new Error("Path data must be a non-empty string");
  }
  const tokens = tokenize(d);
  if (tokens.length === 0) {
    throw new Error("Path data is empty");
  }
  if (tokens[0].kind !== "command" || tokens[0].value.toUpperCase() !== "M") {
    throw new Error("Path data must begin with a moveto command");
  }

  const segments: PathSegment[] = [];
  let current = point(0, 0);
  let subpathStart = point(0, 0);
  let hasCurrent = false;
  let closed = false;
  let previousCommand = "";
  let lastCubicControl: PathPoint | null = null;
  let lastQuadraticControl: PathPoint | null = null;
  let tokenIndex = 0;

  const readArgs = (count: number, command: string): number[] => {
    const args: number[] = [];
    for (let i = 0; i < count; i++) {
      const token = tokens[tokenIndex];
      if (!token || token.kind !== "number") {
        throw new Error(
          `Command "${command}" expects ${count} numbers (missing argument ${i + 1})`,
        );
      }
      args.push(token.value);
      tokenIndex++;
    }
    return args;
  };

  const process = (command: string, args: number[]): void => {
    const upper = command.toUpperCase();
    const relative = command !== upper;

    switch (upper) {
      case "M": {
        const to = relative
          ? point(current.x + args[0], current.y + args[1])
          : point(args[0], args[1]);
        if (hasCurrent) {
          segments.push({ type: "move", from: current, to });
        }
        current = to;
        subpathStart = to;
        hasCurrent = true;
        lastCubicControl = null;
        lastQuadraticControl = null;
        break;
      }
      case "L": {
        const to = relative
          ? point(current.x + args[0], current.y + args[1])
          : point(args[0], args[1]);
        segments.push(lineSegment(current, to));
        current = to;
        lastCubicControl = null;
        lastQuadraticControl = null;
        break;
      }
      case "H": {
        const to = relative
          ? point(current.x + args[0], current.y)
          : point(args[0], current.y);
        segments.push(lineSegment(current, to));
        current = to;
        lastCubicControl = null;
        lastQuadraticControl = null;
        break;
      }
      case "V": {
        const to = relative
          ? point(current.x, current.y + args[0])
          : point(current.x, args[0]);
        segments.push(lineSegment(current, to));
        current = to;
        lastCubicControl = null;
        lastQuadraticControl = null;
        break;
      }
      case "C": {
        const c1 = relative
          ? point(current.x + args[0], current.y + args[1])
          : point(args[0], args[1]);
        const c2 = relative
          ? point(current.x + args[2], current.y + args[3])
          : point(args[2], args[3]);
        const to = relative
          ? point(current.x + args[4], current.y + args[5])
          : point(args[4], args[5]);
        segments.push(cubicSegment(current, c1, c2, to));
        current = to;
        lastCubicControl = c2;
        lastQuadraticControl = null;
        break;
      }
      case "S": {
        const c1 =
          previousCommand === "C" || previousCommand === "S"
            ? point(
                2 * current.x - (lastCubicControl?.x ?? current.x),
                2 * current.y - (lastCubicControl?.y ?? current.y),
              )
            : current;
        const c2 = relative
          ? point(current.x + args[0], current.y + args[1])
          : point(args[0], args[1]);
        const to = relative
          ? point(current.x + args[2], current.y + args[3])
          : point(args[2], args[3]);
        segments.push(cubicSegment(current, c1, c2, to));
        current = to;
        lastCubicControl = c2;
        lastQuadraticControl = null;
        break;
      }
      case "Q": {
        const control = relative
          ? point(current.x + args[0], current.y + args[1])
          : point(args[0], args[1]);
        const to = relative
          ? point(current.x + args[2], current.y + args[3])
          : point(args[2], args[3]);
        const c1 = point(
          current.x + (2 / 3) * (control.x - current.x),
          current.y + (2 / 3) * (control.y - current.y),
        );
        const c2 = point(
          to.x + (2 / 3) * (control.x - to.x),
          to.y + (2 / 3) * (control.y - to.y),
        );
        segments.push(cubicSegment(current, c1, c2, to));
        current = to;
        lastQuadraticControl = control;
        lastCubicControl = null;
        break;
      }
      case "T": {
        const control =
          previousCommand === "Q" || previousCommand === "T"
            ? point(
                2 * current.x - (lastQuadraticControl?.x ?? current.x),
                2 * current.y - (lastQuadraticControl?.y ?? current.y),
              )
            : current;
        const to = relative
          ? point(current.x + args[0], current.y + args[1])
          : point(args[0], args[1]);
        const c1 = point(
          current.x + (2 / 3) * (control.x - current.x),
          current.y + (2 / 3) * (control.y - current.y),
        );
        const c2 = point(
          to.x + (2 / 3) * (control.x - to.x),
          to.y + (2 / 3) * (control.y - to.y),
        );
        segments.push(cubicSegment(current, c1, c2, to));
        current = to;
        lastQuadraticControl = control;
        lastCubicControl = null;
        break;
      }
      case "A": {
        const largeArc = args[3];
        const sweep = args[4];
        if (
          (largeArc !== 0 && largeArc !== 1) ||
          (sweep !== 0 && sweep !== 1)
        ) {
          throw new Error("Arc flags must be 0 or 1");
        }
        const to = relative
          ? point(current.x + args[5], current.y + args[6])
          : point(args[5], args[6]);
        const cubics = arcToCubics(
          current,
          args[0],
          args[1],
          args[2],
          largeArc,
          sweep,
          to,
        );
        if (cubics.length === 0) {
          current = to;
          break;
        }
        for (const cubic of cubics) {
          segments.push(cubicSegment(current, cubic.c1, cubic.c2, cubic.to));
          current = cubic.to;
        }
        lastCubicControl = null;
        lastQuadraticControl = null;
        break;
      }
      default:
        throw new Error(`Unsupported path command "${command}"`);
    }
    previousCommand = upper;
  };

  while (tokenIndex < tokens.length) {
    const token = tokens[tokenIndex];
    if (token.kind !== "command") {
      throw new Error("Expected a path command");
    }
    const command = token.value;
    const upper = command.toUpperCase();
    tokenIndex++;

    if (upper === "Z") {
      if (tokenIndex < tokens.length && tokens[tokenIndex].kind === "number") {
        throw new Error("Unexpected number after closepath command");
      }
      if (hasCurrent) {
        if (current.x !== subpathStart.x || current.y !== subpathStart.y) {
          segments.push(lineSegment(current, subpathStart));
        }
        current = subpathStart;
        closed = true;
      }
      previousCommand = "Z";
      lastCubicControl = null;
      lastQuadraticControl = null;
      continue;
    }

    let repetition = 0;
    while (true) {
      const effective =
        upper === "M" && repetition > 0
          ? command === "m"
            ? "l"
            : "L"
          : command;
      const args = readArgs(ARG_COUNT[upper], effective);
      process(effective, args);
      repetition++;
      if (tokenIndex < tokens.length && tokens[tokenIndex].kind === "number") {
        continue;
      }
      break;
    }
  }

  if (!hasCurrent) {
    throw new Error("Path data does not contain a moveto");
  }

  return {
    segments,
    start: segments.length > 0 ? segments[0].from : current,
    closed,
  };
}

const CURVE_SAMPLES = 24;
const TABLE_CACHE_LIMIT = 64;
const tableCache = new Map<string, PathTable>();

type TablePoint = {
  x: number;
  y: number;
  angle: number;
  dist: number;
};

type PathTable = {
  points: TablePoint[];
  total: number;
};

function buildTable(parsed: ParsedPath): PathTable {
  if (parsed.segments.length === 0) {
    return {
      points: [
        {
          x: parsed.start.x,
          y: parsed.start.y,
          angle: 0,
          dist: 0,
        },
      ],
      total: 0,
    };
  }

  const first = parsed.segments[0].from;
  const points: TablePoint[] = [
    { x: first.x, y: first.y, angle: 0, dist: 0 },
  ];
  let total = 0;
  let hasRealSegment = false;

  for (const segment of parsed.segments) {
    if (segment.type === "move") {
      points.push({
        x: segment.to.x,
        y: segment.to.y,
        angle: points[points.length - 1].angle,
        dist: total,
      });
      continue;
    }

    if (segment.type === "line") {
      const length = distance(segment.from, segment.to);
      const angle = vectorAngle(segment.from, segment.to);
      if (!hasRealSegment) {
        points[0].angle = angle;
        hasRealSegment = true;
      }
      total += length;
      points.push({
        x: segment.to.x,
        y: segment.to.y,
        angle,
        dist: total,
      });
      continue;
    }

    if (!hasRealSegment) {
      points[0].angle = cubicDerivativeAngle(segment, 0);
      hasRealSegment = true;
    }
    let previous = segment.from;
    for (let i = 1; i <= CURVE_SAMPLES; i++) {
      const t = i / CURVE_SAMPLES;
      const next = cubicPoint(segment, t);
      total += distance(previous, next);
      points.push({
        x: next.x,
        y: next.y,
        angle: cubicDerivativeAngle(segment, t),
        dist: total,
      });
      previous = next;
    }
  }

  return { points, total };
}

function getTable(d: string): PathTable {
  const cached = tableCache.get(d);
  if (cached) return cached;
  const parsed = parsePath(d);
  const table = buildTable(parsed);
  if (tableCache.size >= TABLE_CACHE_LIMIT) tableCache.clear();
  tableCache.set(d, table);
  return table;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return value > 0 ? 1 : 0;
  return Math.min(1, Math.max(0, value));
}

/** Sample a path at normalized progress, returning point and tangent angle. */
export function samplePath(d: string, progress: number): PathSample {
  const p = clamp01(progress);
  const table = getTable(d);
  const target = p * table.total;
  if (table.total === 0 || table.points.length === 1) {
    const only = table.points[0];
    return { x: only.x, y: only.y, angle: only.angle, progress: p };
  }

  let low = 0;
  let high = table.points.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (table.points[mid].dist < target) low = mid + 1;
    else high = mid;
  }
  const end = table.points[low];
  const start = table.points[Math.max(0, low - 1)];
  if (low === 0) {
    return { x: end.x, y: end.y, angle: end.angle, progress: p };
  }
  if (end.dist === start.dist) {
    return { x: end.x, y: end.y, angle: end.angle, progress: p };
  }
  const fraction = (target - start.dist) / (end.dist - start.dist);
  return {
    x: start.x + (end.x - start.x) * fraction,
    y: start.y + (end.y - start.y) * fraction,
    angle: end.angle,
    progress: p,
  };
}

/** Approximate arc length of a path, using the same sampler as `samplePath`. */
export function pathLength(d: string): number {
  return getTable(d).total;
}
