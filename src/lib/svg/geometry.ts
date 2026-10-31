/**
 * Geometry helpers for the SVG importer.
 *
 * This module is intentionally DOM-free at its core: transforms, path parsing
 * and bounding-box estimation work on plain numbers so the importer never
 * depends on a browser layout engine. `elementGeometryBBox` is the only helper
 * that reads a parsed xmldom element.
 */

import type { Element as XmlElement } from "@xmldom/xmldom";

import type { BBox, Mat } from "./types";

const NUMBER_SOURCE = "[+-]?(?:\\d*\\.\\d+|\\d+\\.?)(?:[eE][+-]?\\d+)?";

const NUMBER_RE = new RegExp(`^${NUMBER_SOURCE}$`);
const NUMBER_GLOBAL_RE = new RegExp(NUMBER_SOURCE, "g");
const TRANSFORM_FN_RE = /([a-zA-Z]+)\s*\(([^)]*)\)/g;

const DEG_TO_RAD = Math.PI / 180;

export const IDENTITY_MATRIX: Mat = [1, 0, 0, 1, 0, 0];

/** Finite number, never NaN/Infinity. Near-zero values are snapped to zero. */
export function cleanNumber(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.abs(value) < 1e-12 ? 0 : value;
}

export function roundNumber(value: number, precision = 4): number {
  const finite = cleanNumber(value);
  const factor = 10 ** precision;
  return Math.round(finite * factor) / factor;
}

export function roundBBox(box: BBox, precision = 4): BBox {
  return {
    x: roundNumber(box.x, precision),
    y: roundNumber(box.y, precision),
    w: Math.max(0, roundNumber(box.w, precision)),
    h: Math.max(0, roundNumber(box.h, precision)),
  };
}

export function identityMatrix(): Mat {
  return [...IDENTITY_MATRIX];
}

/** Compose two affine matrices: the result applies `right` then `left`. */
export function multiplyMatrices(left: Mat, right: Mat): Mat {
  const [a1, b1, c1, d1, e1, f1] = left;
  const [a2, b2, c2, d2, e2, f2] = right;
  return [
    cleanNumber(a1 * a2 + c1 * b2),
    cleanNumber(b1 * a2 + d1 * b2),
    cleanNumber(a1 * c2 + c1 * d2),
    cleanNumber(b1 * c2 + d1 * d2),
    cleanNumber(a1 * e2 + c1 * f2 + e1),
    cleanNumber(b1 * e2 + d1 * f2 + f1),
  ];
}

export function translationMatrix(x: number, y: number): Mat {
  return [1, 0, 0, 1, cleanNumber(x), cleanNumber(y)];
}

export function applyMatrix(matrix: Mat, x: number, y: number): { x: number; y: number } {
  const [a, b, c, d, e, f] = matrix;
  return {
    x: cleanNumber(a * x + c * y + e),
    y: cleanNumber(b * x + d * y + f),
  };
}

export function transformBBox(box: BBox, matrix: Mat): BBox {
  const x1 = box.x;
  const y1 = box.y;
  const x2 = box.x + Math.max(0, box.w);
  const y2 = box.y + Math.max(0, box.h);
  const corners = [
    applyMatrix(matrix, x1, y1),
    applyMatrix(matrix, x2, y1),
    applyMatrix(matrix, x2, y2),
    applyMatrix(matrix, x1, y2),
  ];
  return bboxFromPoints(corners);
}

export function bboxFromPoints(points: ReadonlyArray<{ x: number; y: number }>): BBox {
  if (points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    const x = cleanNumber(point.x);
    const y = cleanNumber(point.y);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return { x: 0, y: 0, w: 0, h: 0 };
  return {
    x: cleanNumber(minX),
    y: cleanNumber(minY),
    w: Math.max(0, cleanNumber(maxX - minX)),
    h: Math.max(0, cleanNumber(maxY - minY)),
  };
}

export function unionBBox(a: BBox | null, b: BBox): BBox {
  if (!a) return { ...b };
  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x + Math.max(0, a.w), b.x + Math.max(0, b.w));
  const maxY = Math.max(a.y + Math.max(0, a.h), b.y + Math.max(0, b.h));
  return {
    x: cleanNumber(minX),
    y: cleanNumber(minY),
    w: Math.max(0, cleanNumber(maxX - minX)),
    h: Math.max(0, cleanNumber(maxY - minY)),
  };
}

function parseNumber(value: string): number | null {
  if (!NUMBER_RE.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? cleanNumber(parsed) : null;
}

/**
 * Parse an SVG `transform` attribute into a matrix.
 *
 * The matrix applies the function list left-to-right, matching SVG semantics:
 * `translate(10) scale(2)` scales local geometry and then translates it.
 * A malformed transform list returns the identity matrix.
 */
export function parseTransform(input: string | null | undefined): Mat {
  if (!input) return identityMatrix();
  const source = input.trim();
  if (source === "" || source.toLowerCase() === "none") return identityMatrix();

  let matrix = identityMatrix();
  let cursor = 0;
  TRANSFORM_FN_RE.lastIndex = 0;

  for (;;) {
    const match = TRANSFORM_FN_RE.exec(source);
    if (!match) break;

    const between = source.slice(cursor, match.index);
    if (!/^[\s,]*$/.test(between)) return identityMatrix();

    const name = match[1].toLowerCase();
    const args = parseArgs(match[2]);
    if (!args) return identityMatrix();

    const fn = transformFunction(name, args);
    if (!fn) return identityMatrix();
    matrix = multiplyMatrices(matrix, fn);
    cursor = TRANSFORM_FN_RE.lastIndex;
  }

  if (!/^[\s,]*$/.test(source.slice(cursor))) return identityMatrix();
  return matrix;
}

function parseArgs(source: string): number[] | null {
  const trimmed = source.trim();
  if (trimmed === "") return [];
  const numbers: number[] = [];
  const scanner = new RegExp(NUMBER_SOURCE, "g");
  let cursor = 0;
  let match: RegExpExecArray | null = scanner.exec(trimmed);

  while (match) {
    if (!/^[\s,]*$/.test(trimmed.slice(cursor, match.index))) return null;
    const parsed = parseNumber(match[0]);
    if (parsed === null) return null;
    numbers.push(parsed);
    cursor = scanner.lastIndex;
    match = scanner.exec(trimmed);
  }

  if (!/^[\s,]*$/.test(trimmed.slice(cursor))) return null;
  return numbers;
}

function transformFunction(name: string, args: number[]): Mat | null {
  switch (name) {
    case "matrix":
      return args.length === 6 ? [args[0], args[1], args[2], args[3], args[4], args[5]] : null;
    case "translate": {
      if (args.length !== 1 && args.length !== 2) return null;
      return translationMatrix(args[0], args.length === 2 ? args[1] : 0);
    }
    case "scale": {
      if (args.length !== 1 && args.length !== 2) return null;
      const sx = args[0];
      const sy = args.length === 2 ? args[1] : sx;
      return [sx, 0, 0, sy, 0, 0];
    }
    case "rotate": {
      if (args.length !== 1 && args.length !== 3) return null;
      const angle = args[0] * DEG_TO_RAD;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const rotation: Mat = [cos, sin, -sin, cos, 0, 0];
      if (args.length === 1) return rotation;
      const cx = args[1];
      const cy = args[2];
      return multiplyMatrices(
        multiplyMatrices(translationMatrix(cx, cy), rotation),
        translationMatrix(-cx, -cy),
      );
    }
    case "skewx": {
      if (args.length !== 1) return null;
      return [1, 0, Math.tan(args[0] * DEG_TO_RAD), 1, 0, 0];
    }
    case "skewy": {
      if (args.length !== 1) return null;
      return [1, Math.tan(args[0] * DEG_TO_RAD), 0, 1, 0, 0];
    }
    default:
      return null;
  }
}

function parseNumberList(value: string): number[] {
  const matches = value.match(NUMBER_GLOBAL_RE);
  if (!matches) return [];
  const numbers: number[] = [];
  for (const match of matches) {
    const parsed = parseNumber(match);
    if (parsed === null) continue;
    numbers.push(parsed);
  }
  return numbers;
}

/** Parse SVG polygon/polyline points into coordinate pairs. */
export function parsePoints(value: string | null | undefined): Array<{ x: number; y: number }> {
  if (!value) return [];
  const numbers = parseNumberList(value);
  const points: Array<{ x: number; y: number }> = [];
  for (let index = 0; index + 1 < numbers.length; index += 2) {
    points.push({ x: numbers[index], y: numbers[index + 1] });
  }
  return points;
}

class PointBounds {
  private minX = Number.POSITIVE_INFINITY;
  private minY = Number.POSITIVE_INFINITY;
  private maxX = Number.NEGATIVE_INFINITY;
  private maxY = Number.NEGATIVE_INFINITY;

  add(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < this.minX) this.minX = x;
    if (y < this.minY) this.minY = y;
    if (x > this.maxX) this.maxX = x;
    if (y > this.maxY) this.maxY = y;
  }

  toBBox(): BBox {
    if (!Number.isFinite(this.minX) || !Number.isFinite(this.minY)) {
      return { x: 0, y: 0, w: 0, h: 0 };
    }
    return {
      x: cleanNumber(this.minX),
      y: cleanNumber(this.minY),
      w: Math.max(0, cleanNumber(this.maxX - this.minX)),
      h: Math.max(0, cleanNumber(this.maxY - this.minY)),
    };
  }
}

type PathCommand =
  | "M"
  | "L"
  | "H"
  | "V"
  | "C"
  | "S"
  | "Q"
  | "T"
  | "A"
  | "Z";

const COMMAND_ARG_COUNT: Record<PathCommand, number> = {
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

const PATH_COMMANDS = new Set<string>(Object.keys(COMMAND_ARG_COUNT));

function asPathCommand(value: string): PathCommand | null {
  const upper = value.toUpperCase();
  return PATH_COMMANDS.has(upper) ? (upper as PathCommand) : null;
}

function tokenizePath(d: string): string[] {
  // The regex only recognises command letters and numeric tokens. Anything
  // else is ignored, which keeps malformed user paths from throwing.
  return d.match(/[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? [];
}

function cubicExtrema(p0: number, p1: number, p2: number, p3: number): number[] {
  const extrema: number[] = [];
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = p1 - p0;
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) > 1e-12) {
      const t = -c / b;
      if (t > 0 && t < 1) extrema.push(t);
    }
    return extrema;
  }
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return extrema;
  const root = Math.sqrt(discriminant);
  for (const t of [(-b + root) / (2 * a), (-b - root) / (2 * a)]) {
    if (t > 0 && t < 1) extrema.push(t);
  }
  return extrema;
}

function cubicAt(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const mt = 1 - t;
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
}

function quadAt(p0: number, p1: number, p2: number, t: number): number {
  const mt = 1 - t;
  return mt * mt * p0 + 2 * mt * t * p1 + t * t * p2;
}

function quadraticExtrema(p0: number, p1: number, p2: number): number[] {
  const denominator = p0 - 2 * p1 + p2;
  if (Math.abs(denominator) < 1e-12) return [];
  const t = (p0 - p1) / denominator;
  return t > 0 && t < 1 ? [t] : [];
}

function addCubic(
  bounds: PointBounds,
  start: { x: number; y: number },
  control1: { x: number; y: number },
  control2: { x: number; y: number },
  end: { x: number; y: number },
): void {
  bounds.add(start.x, start.y);
  bounds.add(end.x, end.y);
  for (const t of cubicExtrema(start.x, control1.x, control2.x, end.x)) {
    bounds.add(cubicAt(start.x, control1.x, control2.x, end.x, t), cubicAt(
      start.y,
      control1.y,
      control2.y,
      end.y,
      t,
    ));
  }
  for (const t of cubicExtrema(start.y, control1.y, control2.y, end.y)) {
    bounds.add(cubicAt(start.x, control1.x, control2.x, end.x, t), cubicAt(
      start.y,
      control1.y,
      control2.y,
      end.y,
      t,
    ));
  }
}

function addQuadratic(
  bounds: PointBounds,
  start: { x: number; y: number },
  control: { x: number; y: number },
  end: { x: number; y: number },
): void {
  bounds.add(start.x, start.y);
  bounds.add(end.x, end.y);
  for (const t of quadraticExtrema(start.x, control.x, end.x)) {
    bounds.add(
      quadAt(start.x, control.x, end.x, t),
      quadAt(start.y, control.y, end.y, t),
    );
  }
  for (const t of quadraticExtrema(start.y, control.y, end.y)) {
    bounds.add(
      quadAt(start.x, control.x, end.x, t),
      quadAt(start.y, control.y, end.y, t),
    );
  }
}

/**
 * Add sampled points for an SVG elliptical arc. This is a standard endpoint to
 * centre conversion; it is exact enough for an estimated geometry bbox.
 */
function addArc(
  bounds: PointBounds,
  start: { x: number; y: number },
  rxInput: number,
  ryInput: number,
  rotationDegrees: number,
  largeArc: boolean,
  sweep: boolean,
  end: { x: number; y: number },
): void {
  bounds.add(start.x, start.y);
  bounds.add(end.x, end.y);
  if (start.x === end.x && start.y === end.y) return;

  let rx = Math.abs(cleanNumber(rxInput));
  let ry = Math.abs(cleanNumber(ryInput));
  if (rx === 0 || ry === 0) {
    bounds.add(end.x, end.y);
    return;
  }

  const phi = cleanNumber(rotationDegrees) * DEG_TO_RAD;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const dx = (start.x - end.x) / 2;
  const dy = (start.y - end.y) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const scale = Math.sqrt(lambda);
    rx *= scale;
    ry *= scale;
  }
  const rx2 = rx * rx;
  const ry2 = ry * ry;
  const denominator = rx2 * y1p * y1p + ry2 * x1p * x1p;
  const numerator = rx2 * ry2 - rx2 * y1p * y1p - ry2 * x1p * x1p;
  const sign = largeArc === sweep ? -1 : 1;
  const coefficient =
    denominator <= 0 ? 0 : sign * Math.sqrt(Math.max(0, numerator / denominator));
  const cxp = (coefficient * rx * y1p) / ry;
  const cyp = (-coefficient * ry * x1p) / rx;
  const cx = cosPhi * cxp - sinPhi * cyp + (start.x + end.x) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (start.y + end.y) / 2;

  const ux = (x1p - cxp) / rx;
  const uy = (y1p - cyp) / ry;
  const vx = (-x1p - cxp) / rx;
  const vy = (-y1p - cyp) / ry;
  const startAngle = Math.atan2(uy, ux);
  let delta = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  else if (sweep && delta < 0) delta += 2 * Math.PI;

  const steps = Math.max(1, Math.min(64, Math.ceil(Math.abs(delta) / (Math.PI / 18))));
  for (let step = 0; step <= steps; step += 1) {
    const angle = startAngle + (delta * step) / steps;
    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);
    bounds.add(
      cx + cosPhi * rx * cosAngle - sinPhi * ry * sinAngle,
      cy + sinPhi * rx * cosAngle + cosPhi * ry * sinAngle,
    );
  }
}

/**
 * Approximate the bounding box of an SVG path. Curves use exact extrema on the
 * Bezier hull and arcs are sampled. Stroke width, markers and fill rules are
 * intentionally not included.
 */
export function pathBBox(d: string | null | undefined): BBox {
  if (!d) return { x: 0, y: 0, w: 0, h: 0 };
  const tokens = tokenizePath(d);
  if (tokens.length === 0) return { x: 0, y: 0, w: 0, h: 0 };

  const bounds = new PointBounds();
  let index = 0;
  let command: PathCommand | null = null;
  let relative = false;
  let current = { x: 0, y: 0 };
  let subpathStart = { x: 0, y: 0 };
  let previousCommand: PathCommand | null = null;
  let lastCubicControl: { x: number; y: number } | null = null;
  let lastQuadraticControl: { x: number; y: number } | null = null;

  while (index < tokens.length) {
    const token = tokens[index];
    const commandToken = asPathCommand(token);
    if (commandToken) {
      command = commandToken;
      relative = token !== token.toUpperCase();
      index += 1;
    } else if (command === null) {
      break;
    }

    if (command === null) break;

    if (command === "Z") {
      bounds.add(subpathStart.x, subpathStart.y);
      current = { ...subpathStart };
      lastCubicControl = null;
      lastQuadraticControl = null;
      previousCommand = "Z";
      command = null;
      continue;
    }

    const argumentCount = COMMAND_ARG_COUNT[command];
    if (index + argumentCount > tokens.length) break;

    const rawArguments: number[] = [];
    let valid = true;
    for (let offset = 0; offset < argumentCount; offset += 1) {
      const argument = parseNumber(tokens[index + offset]);
      if (argument === null) {
        valid = false;
        break;
      }
      rawArguments.push(argument);
    }
    if (!valid) break;
    index += argumentCount;

    const startX = current.x;
    const startY = current.y;
    const upper = command;
    const isRelative = relative;

    if (upper === "M") {
      current = {
        x: isRelative ? startX + rawArguments[0] : rawArguments[0],
        y: isRelative ? startY + rawArguments[1] : rawArguments[1],
      };
      subpathStart = { ...current };
      bounds.add(current.x, current.y);
      lastCubicControl = null;
      lastQuadraticControl = null;
      previousCommand = "M";
      command = "L";
      relative = isRelative;
      continue;
    }

    if (upper === "L") {
      current = {
        x: isRelative ? startX + rawArguments[0] : rawArguments[0],
        y: isRelative ? startY + rawArguments[1] : rawArguments[1],
      };
      bounds.add(current.x, current.y);
      lastCubicControl = null;
      lastQuadraticControl = null;
      previousCommand = "L";
    } else if (upper === "H") {
      current = {
        x: isRelative ? startX + rawArguments[0] : rawArguments[0],
        y: startY,
      };
      bounds.add(current.x, current.y);
      lastCubicControl = null;
      lastQuadraticControl = null;
      previousCommand = "H";
    } else if (upper === "V") {
      current = {
        x: startX,
        y: isRelative ? startY + rawArguments[0] : rawArguments[0],
      };
      bounds.add(current.x, current.y);
      lastCubicControl = null;
      lastQuadraticControl = null;
      previousCommand = "V";
    } else if (upper === "C") {
      const control1 = {
        x: isRelative ? startX + rawArguments[0] : rawArguments[0],
        y: isRelative ? startY + rawArguments[1] : rawArguments[1],
      };
      const control2 = {
        x: isRelative ? startX + rawArguments[2] : rawArguments[2],
        y: isRelative ? startY + rawArguments[3] : rawArguments[3],
      };
      const end = {
        x: isRelative ? startX + rawArguments[4] : rawArguments[4],
        y: isRelative ? startY + rawArguments[5] : rawArguments[5],
      };
      addCubic(bounds, current, control1, control2, end);
      current = end;
      lastCubicControl = control2;
      lastQuadraticControl = null;
      previousCommand = "C";
    } else if (upper === "S") {
      const control1 =
        (previousCommand === "C" || previousCommand === "S") && lastCubicControl
          ? { x: 2 * startX - lastCubicControl.x, y: 2 * startY - lastCubicControl.y }
          : { x: startX, y: startY };
      const control2 = {
        x: isRelative ? startX + rawArguments[0] : rawArguments[0],
        y: isRelative ? startY + rawArguments[1] : rawArguments[1],
      };
      const end = {
        x: isRelative ? startX + rawArguments[2] : rawArguments[2],
        y: isRelative ? startY + rawArguments[3] : rawArguments[3],
      };
      addCubic(bounds, current, control1, control2, end);
      current = end;
      lastCubicControl = control2;
      lastQuadraticControl = null;
      previousCommand = "S";
    } else if (upper === "Q") {
      const control = {
        x: isRelative ? startX + rawArguments[0] : rawArguments[0],
        y: isRelative ? startY + rawArguments[1] : rawArguments[1],
      };
      const end = {
        x: isRelative ? startX + rawArguments[2] : rawArguments[2],
        y: isRelative ? startY + rawArguments[3] : rawArguments[3],
      };
      addQuadratic(bounds, current, control, end);
      current = end;
      lastCubicControl = null;
      lastQuadraticControl = control;
      previousCommand = "Q";
    } else if (upper === "T") {
      const control: { x: number; y: number } =
        (previousCommand === "Q" || previousCommand === "T") && lastQuadraticControl
          ? { x: 2 * startX - lastQuadraticControl.x, y: 2 * startY - lastQuadraticControl.y }
          : { x: startX, y: startY };
      const end = {
        x: isRelative ? startX + rawArguments[0] : rawArguments[0],
        y: isRelative ? startY + rawArguments[1] : rawArguments[1],
      };
      addQuadratic(bounds, current, control, end);
      current = end;
      lastCubicControl = null;
      lastQuadraticControl = control;
      previousCommand = "T";
    } else if (upper === "A") {
      const rx = rawArguments[0];
      const ry = rawArguments[1];
      const rotation = rawArguments[2];
      const largeArc = rawArguments[3] !== 0;
      const sweep = rawArguments[4] !== 0;
      const end = {
        x: isRelative ? startX + rawArguments[5] : rawArguments[5],
        y: isRelative ? startY + rawArguments[6] : rawArguments[6],
      };
      addArc(bounds, current, rx, ry, rotation, largeArc, sweep, end);
      current = end;
      lastCubicControl = null;
      lastQuadraticControl = null;
      previousCommand = "A";
    }
  }

  return bounds.toBBox();
}

function numberAttribute(element: XmlElement, name: string, fallback = 0): number {
  const raw = element.getAttribute(name);
  if (raw === null) return fallback;
  const match = new RegExp(`^\\s*(${NUMBER_SOURCE})`).exec(raw);
  if (!match) return fallback;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? cleanNumber(parsed) : fallback;
}

/** Approximate a text element's bbox without browser font metrics. */
export function textBBox(
  text: string,
  x: number,
  y: number,
  fontSize: number,
  textAnchor?: string,
): BBox {
  const size = Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 16;
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized === "") return { x: cleanNumber(x), y: cleanNumber(y), w: 0, h: 0 };

  const codePoints = Array.from(normalized).length;
  const width = codePoints * size * 0.55;
  const height = size * 1.15;
  let left = x;
  if (textAnchor === "middle") left -= width / 2;
  else if (textAnchor === "end") left -= width;

  return {
    x: cleanNumber(left),
    y: cleanNumber(y - size * 0.8),
    w: Math.max(0, cleanNumber(width)),
    h: Math.max(0, cleanNumber(height)),
  };
}

/**
 * Geometry bbox in the element's own pre-transform coordinate space.
 * Container tags (`g`, `defs`, `clipPath`, nested `svg`) return a zero box here;
 * the scene builder unions their children.
 */
export function elementGeometryBBox(
  tag: string,
  element: XmlElement,
  textStyle?: { fontSize?: number; textAnchor?: string },
): BBox {
  switch (tag) {
    case "rect": {
      const x = numberAttribute(element, "x");
      const y = numberAttribute(element, "y");
      const width = Math.max(0, numberAttribute(element, "width"));
      const height = Math.max(0, numberAttribute(element, "height"));
      return { x, y, w: width, h: height };
    }
    case "circle": {
      const cx = numberAttribute(element, "cx");
      const cy = numberAttribute(element, "cy");
      const radius = Math.max(0, numberAttribute(element, "r"));
      return { x: cx - radius, y: cy - radius, w: radius * 2, h: radius * 2 };
    }
    case "ellipse": {
      const cx = numberAttribute(element, "cx");
      const cy = numberAttribute(element, "cy");
      const rx = Math.max(0, numberAttribute(element, "rx"));
      const ry = Math.max(0, numberAttribute(element, "ry"));
      return { x: cx - rx, y: cy - ry, w: rx * 2, h: ry * 2 };
    }
    case "line":
      return bboxFromPoints([
        { x: numberAttribute(element, "x1"), y: numberAttribute(element, "y1") },
        { x: numberAttribute(element, "x2"), y: numberAttribute(element, "y2") },
      ]);
    case "polyline":
    case "polygon":
      return bboxFromPoints(parsePoints(element.getAttribute("points")));
    case "path":
      return pathBBox(element.getAttribute("d"));
    case "text": {
      const x = numberAttribute(element, "x");
      const y = numberAttribute(element, "y");
      return textBBox(
        element.textContent ?? "",
        x,
        y,
        textStyle?.fontSize ?? 16,
        textStyle?.textAnchor,
      );
    }
    default:
      return { x: 0, y: 0, w: 0, h: 0 };
  }
}
