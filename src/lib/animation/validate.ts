/**
 * Motion DSL v1 validation and normalization.
 *
 * The input is untrusted JSON. Validation never throws for malformed data; all
 * problems are returned as issues with precise document paths. A normalized
 * document is only returned when there are no errors.
 */

import {
  CHARACTER_BONE_PROPERTIES,
  CHARACTER_FACE_PROPERTIES,
  CHARACTER_OBJECT_PROPERTIES,
  CHARACTER_PROPERTIES,
  MAX_DURATION,
  MAX_GROUPS,
  MAX_KEYFRAMES,
  MAX_TRACKS,
  MIN_DURATION,
  MOTION_DOC_VERSION,
  MOTION_FPS,
  SVG_PROPERTIES,
  type BoneTargetContext,
  type Easing,
  type Keyframe,
  type MotionDocument,
  type MotionLoop,
  type MotionMeta,
  type MotionProperty,
  type MotionSource,
  type MotionTarget,
  type MotionTrack,
  type TransformOrigin,
  type ValidationContext,
  type ValidationIssue,
  type ValidationResult,
} from "./types";
import { isNamedEasing } from "./easing";
import { parsePath } from "./path";
import {
  boneContextByKey,
  boneKey,
  boneTargetSet,
  motionPairKey,
  splitBoneKey,
  toIdSet,
} from "./targets";

/** Times differing by less than this are treated as the document boundary. */
export const TIMING_EPSILON = 1e-6;

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const DOC_KEYS = new Set([
  "version",
  "id",
  "name",
  "targetKind",
  "duration",
  "fps",
  "loop",
  "tracks",
  "groups",
  "meta",
]);

const TRACK_KEYS = new Set([
  "id",
  "target",
  "property",
  "keyframes",
  "delay",
  "duration",
  "easing",
  "path",
  "orient",
  "origin",
  "label",
  "muted",
]);

const GROUP_BASE_KEYS = [
  "id",
  "target",
  "property",
  "keyframes",
  "delay",
  "duration",
  "easing",
  "step",
  "path",
  "orient",
  "origin",
  "label",
  "muted",
] as const;

const KEYFRAME_KEYS = new Set(["at", "value", "easing"]);
const LOOP_KEYS = new Set(["enabled", "mode", "iterations"]);
const META_KEYS = new Set([
  "prompt",
  "source",
  "provider",
  "model",
  "createdAt",
  "revisionOf",
  "summary",
  "latencyMs",
  "warnings",
]);

const SOURCES: readonly MotionSource[] = ["ai", "fallback", "preset", "manual"];
const ORIGINS: readonly TransformOrigin[] = ["center", "bone", "top-left"];
const SVG_PROPERTY_SET: ReadonlySet<string> = new Set(SVG_PROPERTIES);
const CHARACTER_PROPERTY_SET: ReadonlySet<string> = new Set(CHARACTER_PROPERTIES);
const CHARACTER_BONE_PROPERTY_SET: ReadonlySet<string> = new Set([
  ...CHARACTER_BONE_PROPERTIES,
  ...CHARACTER_FACE_PROPERTIES,
]);
const CHARACTER_FACE_PROPERTY_SET: ReadonlySet<string> = new Set(
  CHARACTER_FACE_PROPERTIES,
);
const CHARACTER_OBJECT_PROPERTY_SET: ReadonlySet<string> = new Set(
  CHARACTER_OBJECT_PROPERTIES,
);
const CHARACTER_GROUP_PROPERTY_SET: ReadonlySet<string> = new Set([
  ...CHARACTER_BONE_PROPERTIES,
  ...CHARACTER_FACE_PROPERTIES,
]);

class IssueCollector {
  readonly errors: ValidationIssue[] = [];
  readonly warnings: ValidationIssue[] = [];

  error(path: string, code: ValidationIssue["code"], message: string): void {
    this.errors.push({ path, code, message, severity: "error" });
  }

  warning(path: string, code: ValidationIssue["code"], message: string): void {
    this.warnings.push({ path, code, message, severity: "warning" });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function joinPath(base: string, key: string | number): string {
  return base.length === 0 ? String(key) : `${base}.${key}`;
}

function indexPath(base: string, index: number): string {
  return `${base}[${index}]`;
}

function checkKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: string,
  issues: IssueCollector,
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      issues.error(
        joinPath(path, key),
        "shape",
        `Unknown property "${key}"`,
      );
    }
  }
}

function readString(
  value: unknown,
  path: string,
  issues: IssueCollector,
  options: { allowEmpty?: boolean; maxLength?: number } = {},
): string | undefined {
  if (typeof value !== "string") {
    issues.error(path, "shape", "Expected a string");
    return undefined;
  }
  if (!options.allowEmpty && value.trim().length === 0) {
    issues.error(path, "shape", "Must not be empty");
    return undefined;
  }
  if (options.maxLength !== undefined && value.length > options.maxLength) {
    issues.error(
      path,
      "shape",
      `Must be at most ${options.maxLength} characters`,
    );
    return undefined;
  }
  return value;
}

function readFiniteNumber(
  value: unknown,
  path: string,
  issues: IssueCollector,
  code: ValidationIssue["code"] = "shape",
): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    issues.error(path, code, "Expected a finite number");
    return undefined;
  }
  return value;
}

function readOptionalString(
  value: unknown,
  path: string,
  issues: IssueCollector,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    issues.error(path, "shape", "Expected a string");
    return undefined;
  }
  return value;
}

function parseEasing(
  raw: unknown,
  path: string,
  issues: IssueCollector,
): Easing | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw === "string") {
    if (!isNamedEasing(raw)) {
      issues.error(path, "value", `Unknown easing "${raw}"`);
      return undefined;
    }
    return raw;
  }
  if (!isRecord(raw)) {
    issues.error(path, "shape", "Easing must be a name or an easing object");
    return undefined;
  }
  if (raw.type === "cubicBezier") {
    checkKeys(raw, new Set(["type", "x1", "y1", "x2", "y2"]), path, issues);
    const x1 = readFiniteNumber(raw.x1, `${path}.x1`, issues, "value");
    const y1 = readFiniteNumber(raw.y1, `${path}.y1`, issues, "value");
    const x2 = readFiniteNumber(raw.x2, `${path}.x2`, issues, "value");
    const y2 = readFiniteNumber(raw.y2, `${path}.y2`, issues, "value");
    if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) {
      return undefined;
    }
    if (x1 < 0 || x1 > 1) {
      issues.error(`${path}.x1`, "value", "cubicBezier.x1 must be between 0 and 1");
    }
    if (x2 < 0 || x2 > 1) {
      issues.error(`${path}.x2`, "value", "cubicBezier.x2 must be between 0 and 1");
    }
    return { type: "cubicBezier", x1, y1, x2, y2 };
  }
  if (raw.type === "spring") {
    checkKeys(
      raw,
      new Set(["type", "stiffness", "damping", "mass"]),
      path,
      issues,
    );
    const stiffness = readFiniteNumber(
      raw.stiffness,
      `${path}.stiffness`,
      issues,
      "value",
    );
    const damping = readFiniteNumber(
      raw.damping,
      `${path}.damping`,
      issues,
      "value",
    );
    const mass =
      raw.mass === undefined
        ? 1
        : readFiniteNumber(raw.mass, `${path}.mass`, issues, "value");
    if (stiffness !== undefined && (stiffness <= 0 || stiffness > 1000)) {
      issues.error(
        `${path}.stiffness`,
        "value",
        "Spring stiffness must be greater than 0 and at most 1000",
      );
    }
    if (damping !== undefined && (damping <= 0 || damping > 500)) {
      issues.error(
        `${path}.damping`,
        "value",
        "Spring damping must be greater than 0 and at most 500",
      );
    }
    if (mass !== undefined && (mass <= 0 || mass > 100)) {
      issues.error(
        `${path}.mass`,
        "value",
        "Spring mass must be greater than 0 and at most 100",
      );
    }
    if (
      stiffness === undefined ||
      damping === undefined ||
      mass === undefined
    ) {
      return undefined;
    }
    return { type: "spring", stiffness, damping, mass };
  }
  issues.error(
    `${path}.type`,
    "value",
    `Unknown easing type "${String(raw.type)}"`,
  );
  return undefined;
}

function parseLoop(
  raw: unknown,
  path: string,
  issues: IssueCollector,
): MotionLoop | undefined {
  if (raw === undefined) {
    issues.error(path, "shape", "Document loop settings are required");
    return undefined;
  }
  if (!isRecord(raw)) {
    issues.error(path, "shape", "loop must be an object");
    return undefined;
  }
  checkKeys(raw, LOOP_KEYS, path, issues);
  if (typeof raw.enabled !== "boolean") {
    issues.error(`${path}.enabled`, "shape", "loop.enabled must be a boolean");
  }
  let mode: "restart" | "pingpong" = "restart";
  if (raw.mode !== undefined) {
    if (raw.mode !== "restart" && raw.mode !== "pingpong") {
      issues.error(
        `${path}.mode`,
        "loop",
        'loop.mode must be "restart" or "pingpong"',
      );
    } else {
      mode = raw.mode;
    }
  }
  let iterations: number | undefined;
  if (raw.iterations !== undefined) {
    const value = readFiniteNumber(
      raw.iterations,
      `${path}.iterations`,
      issues,
      "loop",
    );
    if (value !== undefined) {
      if (!Number.isInteger(value) || value < 1 || value > 10000) {
        issues.error(
          `${path}.iterations`,
          "loop",
          "loop.iterations must be an integer between 1 and 10000",
        );
      } else {
        iterations = value;
      }
    }
  }
  if (typeof raw.enabled !== "boolean") return undefined;
  return {
    enabled: raw.enabled,
    mode,
    ...(iterations !== undefined ? { iterations } : {}),
  };
}

function parseMeta(
  raw: unknown,
  path: string,
  issues: IssueCollector,
): MotionMeta | undefined {
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) {
    issues.error(path, "shape", "meta must be an object");
    return undefined;
  }
  checkKeys(raw, META_KEYS, path, issues);
  const source = raw.source;
  if (typeof source !== "string" || !SOURCES.includes(source as MotionSource)) {
    issues.error(
      `${path}.source`,
      "value",
      `meta.source must be one of ${SOURCES.join(", ")}`,
    );
  }
  const result: MotionMeta = {
    source:
      typeof source === "string" && SOURCES.includes(source as MotionSource)
        ? (source as MotionSource)
        : "manual",
  };
  const stringFields: Array<keyof MotionMeta> = [
    "prompt",
    "provider",
    "model",
    "createdAt",
    "revisionOf",
    "summary",
  ];
  for (const field of stringFields) {
    const value = readOptionalString(raw[field], `${path}.${field}`, issues);
    if (value !== undefined) {
      (result as Record<string, unknown>)[field] = value;
    }
  }
  if (raw.latencyMs !== undefined) {
    const latency = readFiniteNumber(
      raw.latencyMs,
      `${path}.latencyMs`,
      issues,
      "value",
    );
    if (latency !== undefined) {
      if (latency < 0) {
        issues.error(`${path}.latencyMs`, "value", "latencyMs must be >= 0");
      } else {
        result.latencyMs = latency;
      }
    }
  }
  if (raw.warnings !== undefined) {
    if (
      !Array.isArray(raw.warnings) ||
      raw.warnings.some((item) => typeof item !== "string")
    ) {
      issues.error(`${path}.warnings`, "shape", "warnings must be a string array");
    } else {
      result.warnings = raw.warnings.slice(0, 24) as string[];
    }
  }
  return result;
}

function isColorProperty(property: MotionProperty): boolean {
  return property === "fill" || property === "stroke";
}

function validateValue(
  value: unknown,
  property: MotionProperty,
  path: string,
  issues: IssueCollector,
): boolean {
  if (isColorProperty(property)) {
    if (typeof value !== "string" || !HEX_COLOR.test(value)) {
      issues.error(
        path,
        "value",
        `${property} values must be #RGB, #RRGGBB or #RRGGBBAA colors`,
      );
      return false;
    }
    return true;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    issues.error(path, "value", `${property} values must be finite numbers`);
    return false;
  }

  if (
    property === "opacity" ||
    property === "strokeDraw" ||
    property === "motionPath" ||
    property === "faceBlink" ||
    property === "faceMouth" ||
    property === "faceWink" ||
    property === "faceCheek"
  ) {
    if (value < 0 || value > 1) {
      issues.error(path, "value", `${property} values must be between 0 and 1`);
      return false;
    }
  }
  if (
    (property === "faceLookX" || property === "faceLookY") &&
    (value < -1 || value > 1)
  ) {
    issues.error(path, "value", `${property} values must be between -1 and 1`);
    return false;
  }
  if (property === "faceExpression") {
    if (!Number.isInteger(value) || value < 0 || value > 7) {
      issues.error(
        path,
        "value",
        "faceExpression values must be integers 0..7 (0 neutral, 1 happy, 2 surprised, 3 thinking, 4 shy, 5 laugh, 6 sleepy, 7 wink)",
      );
      return false;
    }
  }
  if (property === "strokeWidth" && value < 0) {
    issues.error(path, "value", "strokeWidth values must be >= 0");
    return false;
  }
  return true;
}

function parseKeyframes(
  raw: unknown,
  path: string,
  property: MotionProperty | undefined,
  issues: IssueCollector,
): Keyframe[] | undefined {
  if (!Array.isArray(raw)) {
    issues.error(path, "shape", "keyframes must be an array");
    return undefined;
  }
  if (raw.length === 0) {
    issues.error(path, "keyframes", "At least one keyframe is required");
    return undefined;
  }
  if (raw.length > MAX_KEYFRAMES) {
    issues.error(
      path,
      "keyframes",
      `At most ${MAX_KEYFRAMES} keyframes are allowed`,
    );
  }

  const keyframes: Keyframe[] = [];
  let previousAt = -Infinity;
  let valid = raw.length <= MAX_KEYFRAMES;
  const count = Math.min(raw.length, MAX_KEYFRAMES);

  for (let i = 0; i < count; i++) {
    const itemPath = indexPath(path, i);
    const item = raw[i];
    if (!isRecord(item)) {
      issues.error(itemPath, "shape", "Keyframe must be an object");
      valid = false;
      continue;
    }
    checkKeys(item, KEYFRAME_KEYS, itemPath, issues);

    let at: number | undefined;
    if (typeof item.at !== "number" || !Number.isFinite(item.at)) {
      issues.error(`${itemPath}.at`, "shape", "Keyframe at must be a finite number");
      valid = false;
    } else if (item.at < 0 || item.at > 1) {
      issues.error(`${itemPath}.at`, "keyframes", "Keyframe at must be between 0 and 1");
      valid = false;
    } else if (item.at <= previousAt) {
      issues.error(
        `${itemPath}.at`,
        "keyframes",
        "Keyframe times must be strictly ascending",
      );
      valid = false;
    } else {
      at = item.at;
      previousAt = item.at;
    }

    let valueOk = false;
    if (property === undefined) {
      valueOk = true;
    } else {
      valueOk = validateValue(item.value, property, `${itemPath}.value`, issues);
    }
    if (!valueOk) valid = false;

    let easing: Easing | undefined;
    if (item.easing !== undefined) {
      easing = parseEasing(item.easing, `${itemPath}.easing`, issues);
      if (easing === undefined) valid = false;
    }

    if (at !== undefined) {
      keyframes.push({
        at,
        value: item.value as number | string,
        ...(easing !== undefined ? { easing } : {}),
      });
    }
  }

  return valid ? keyframes : undefined;
}

type TargetSets = {
  elementIds?: ReadonlySet<string>;
  boneIds?: ReadonlySet<string>;
  bones?: ReadonlyMap<string, BoneTargetContext>;
  objectIds?: ReadonlySet<string>;
};

function allowedPropertiesForTarget(target: MotionTarget): ReadonlySet<string> {
  switch (target.kind) {
    case "svg":
      return SVG_PROPERTY_SET;
    case "object":
      return CHARACTER_OBJECT_PROPERTY_SET;
    case "character":
      return CHARACTER_BONE_PROPERTY_SET;
  }
}

function parseTarget(
  raw: unknown,
  path: string,
  docKind: "svg" | "character",
  sets: TargetSets,
  issues: IssueCollector,
): MotionTarget | undefined {
  if (!isRecord(raw)) {
    issues.error(path, "shape", "target must be an object");
    return undefined;
  }
  if (
    raw.kind !== "svg" &&
    raw.kind !== "character" &&
    raw.kind !== "object"
  ) {
    issues.error(
      `${path}.kind`,
      "target",
      'target.kind must be "svg", "character" or "object"',
    );
    return undefined;
  }

  if (raw.kind === "svg") {
    if (docKind !== "svg") {
      issues.error(
        `${path}.kind`,
        "target",
        `SVG targets are not valid in a "${docKind}" document`,
      );
      return undefined;
    }
    checkKeys(raw, new Set(["kind", "elementId"]), path, issues);
    const elementId = readString(raw.elementId, `${path}.elementId`, issues);
    if (elementId === undefined) return undefined;
    if (sets.elementIds && !sets.elementIds.has(elementId)) {
      issues.error(
        `${path}.elementId`,
        "target",
        `Unknown SVG element "${elementId}"`,
      );
      return undefined;
    }
    return { kind: "svg", elementId };
  }

  if (raw.kind === "object") {
    if (docKind !== "character") {
      issues.error(
        `${path}.kind`,
        "target",
        `Object targets are only valid in a character document`,
      );
      return undefined;
    }
    checkKeys(raw, new Set(["kind", "objectId"]), path, issues);
    const objectId = readString(raw.objectId, `${path}.objectId`, issues);
    if (objectId === undefined) return undefined;
    if (sets.objectIds && !sets.objectIds.has(objectId)) {
      issues.error(
        `${path}.objectId`,
        "target",
        `Unknown scene object "${objectId}"`,
      );
      return undefined;
    }
    return { kind: "object", objectId };
  }

  // Character bone.
  if (docKind !== "character") {
    issues.error(
      `${path}.kind`,
      "target",
      `Character targets are not valid in an "${docKind}" document`,
    );
    return undefined;
  }
  checkKeys(raw, new Set(["kind", "actorId", "boneId"]), path, issues);
  const actorId = readString(raw.actorId, `${path}.actorId`, issues);
  const boneId = readString(raw.boneId, `${path}.boneId`, issues);
  if (actorId === undefined || boneId === undefined) return undefined;
  const key = boneKey(actorId, boneId);
  if (sets.boneIds && !sets.boneIds.has(key)) {
    issues.error(
      `${path}.boneId`,
      "target",
      `Unknown character bone "${actorId}.${boneId}"`,
    );
    return undefined;
  }
  return { kind: "character", actorId, boneId };
}

type ParsedTrack = {
  sourcePath: string;
  track: MotionTrack;
  valid: boolean;
};

type Timing = {
  delay: number;
  duration: number;
  valid: boolean;
};

function resolveTiming(
  delayRaw: unknown,
  durationRaw: unknown,
  docDuration: number,
  path: string,
  issues: IssueCollector,
): Timing {
  let valid = true;
  let delay = 0;
  if (delayRaw !== undefined) {
    const value = readFiniteNumber(delayRaw, `${path}.delay`, issues, "timing");
    if (value === undefined) {
      valid = false;
    } else if (value < 0) {
      issues.error(`${path}.delay`, "timing", "delay must be >= 0");
      valid = false;
    } else {
      delay = value;
    }
  }

  let requestedDuration: number | undefined;
  if (durationRaw !== undefined) {
    const value = readFiniteNumber(
      durationRaw,
      `${path}.duration`,
      issues,
      "timing",
    );
    if (value === undefined) {
      valid = false;
    } else if (value <= 0) {
      issues.error(`${path}.duration`, "timing", "duration must be > 0");
      valid = false;
    } else {
      requestedDuration = value;
    }
  }

  if (delay > docDuration + TIMING_EPSILON) {
    issues.error(
      `${path}.delay`,
      "timing",
      `Track starts at ${delay}s after the ${docDuration}s document ends`,
    );
    valid = false;
  }

  const available = Math.max(0, docDuration - delay);
  let duration: number;
  if (requestedDuration === undefined) {
    duration = available;
    if (duration <= 0) {
      issues.error(
        `${path}.duration`,
        "timing",
        "Track has no time left inside the document duration",
      );
      valid = false;
    }
  } else {
    const end = delay + requestedDuration;
    if (end > docDuration + TIMING_EPSILON) {
      issues.error(
        `${path}.duration`,
        "timing",
        `Track ends at ${end}s, beyond the ${docDuration}s document duration`,
      );
      valid = false;
      duration = Math.max(0, available);
    } else if (end > docDuration) {
      duration = available;
      issues.warning(
        `${path}.duration`,
        "timing",
        "Track end was clamped to the document duration",
      );
    } else {
      duration = requestedDuration;
    }
  }

  if (!Number.isFinite(duration) || duration <= 0) {
    duration = Math.max(TIMING_EPSILON, available);
    valid = false;
  }

  return { delay, duration, valid };
}

function parseOrigin(
  raw: unknown,
  path: string,
  fallback: TransformOrigin,
  isSvg: boolean,
  issues: IssueCollector,
): TransformOrigin {
  if (raw === undefined) return fallback;
  if (
    typeof raw !== "string" ||
    !ORIGINS.includes(raw as TransformOrigin)
  ) {
    issues.error(
      `${path}.origin`,
      "value",
      `origin must be one of ${ORIGINS.join(", ")}`,
    );
    return fallback;
  }
  if (isSvg && raw === "bone") {
    issues.warning(
      `${path}.origin`,
      "unsupported",
      'origin "bone" has no meaning for SVG targets; the bbox center is used',
    );
  }
  return raw as TransformOrigin;
}

function parseMotionPathFields(
  raw: Record<string, unknown>,
  path: string,
  property: MotionProperty | undefined,
  issues: IssueCollector,
): { path?: string; orient: boolean } {
  const isMotionPath = property === "motionPath";
  let pathValue: string | undefined;
  let orient = true;

  if (isMotionPath) {
    if (typeof raw.path !== "string" || raw.path.trim().length === 0) {
      issues.error(
        `${path}.path`,
        "value",
        "motionPath tracks require a non-empty path",
      );
    } else {
      try {
        parsePath(raw.path);
        pathValue = raw.path;
      } catch (error) {
        issues.error(
          `${path}.path`,
          "value",
          `Invalid motion path: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        );
      }
    }
    if (raw.orient !== undefined) {
      if (typeof raw.orient !== "boolean") {
        issues.error(`${path}.orient`, "shape", "orient must be a boolean");
      } else {
        orient = raw.orient;
      }
    }
  } else {
    if (raw.path !== undefined) {
      issues.warning(
        `${path}.path`,
        "unsupported",
        "path is only used by motionPath tracks and will be ignored",
      );
    }
    if (raw.orient !== undefined) {
      issues.warning(
        `${path}.orient`,
        "unsupported",
        "orient is only used by motionPath tracks and will be ignored",
      );
    }
  }

  return { ...(pathValue !== undefined ? { path: pathValue } : {}), orient };
}

function parseTrack(
  raw: unknown,
  path: string,
  docKind: "svg" | "character",
  docDuration: number,
  sets: TargetSets,
  issues: IssueCollector,
): ParsedTrack | undefined {
  const errorStart = issues.errors.length;
  if (!isRecord(raw)) {
    issues.error(path, "shape", "Track must be an object");
    return undefined;
  }
  checkKeys(raw, TRACK_KEYS, path, issues);

  const id = readString(raw.id, `${path}.id`, issues);
  const target = parseTarget(raw.target, `${path}.target`, docKind, sets, issues);

  let property: MotionProperty | undefined;
  const propertySet = target ? allowedPropertiesForTarget(target) : undefined;
  if (
    typeof raw.property !== "string" ||
    (propertySet !== undefined && !propertySet.has(raw.property))
  ) {
    issues.error(
      `${path}.property`,
      "property",
      target
        ? `Property "${String(raw.property)}" is not valid for a ${target.kind} target`
        : `Property "${String(raw.property)}" cannot be checked without a valid target`,
    );
  } else {
    property = raw.property as MotionProperty;
  }

  if (target?.kind === "character" && property) {
    const bone = sets.bones?.get(boneKey(target.actorId, target.boneId));
    if (
      bone &&
      (property === "translateX" || property === "translateY") &&
      bone.role !== "root"
    ) {
      issues.error(
        `${path}.property`,
        "property",
        "translateX/translateY are only valid on the character root bone; rotate or scale child joints instead",
      );
    }
    if (bone && CHARACTER_FACE_PROPERTY_SET.has(property) && bone.role !== "head") {
      issues.error(
        `${path}.property`,
        "property",
        `Facial property "${property}" must target the actor's head bone`,
      );
    }
  }

  const keyframes = parseKeyframes(
    raw.keyframes,
    `${path}.keyframes`,
    property,
    issues,
  );
  const timing = resolveTiming(
    raw.delay,
    raw.duration,
    docDuration,
    path,
    issues,
  );
  const easing =
    raw.easing === undefined
      ? "easeInOut"
      : parseEasing(raw.easing, `${path}.easing`, issues);
  if (raw.easing !== undefined && easing === undefined) {
    /* error already recorded */
  }
  const motionPath = parseMotionPathFields(raw, path, property, issues);
  const origin = parseOrigin(
    raw.origin,
    path,
    target?.kind === "character" ? "bone" : "center",
    docKind === "svg",
    issues,
  );

  let label: string | undefined;
  if (raw.label !== undefined) {
    label = readOptionalString(raw.label, `${path}.label`, issues);
  }
  let muted = false;
  if (raw.muted !== undefined) {
    if (typeof raw.muted !== "boolean") {
      issues.error(`${path}.muted`, "shape", "muted must be a boolean");
    } else {
      muted = raw.muted;
    }
  }

  const valid =
    issues.errors.length === errorStart &&
    id !== undefined &&
    target !== undefined &&
    property !== undefined &&
    keyframes !== undefined &&
    timing.valid &&
    easing !== undefined &&
    (!motionPath.path && property === "motionPath" ? false : true);

  if (
    id === undefined ||
    target === undefined ||
    property === undefined ||
    keyframes === undefined ||
    easing === undefined
  ) {
    return undefined;
  }

  const track: MotionTrack = {
    id,
    target,
    property,
    keyframes,
    delay: timing.delay,
    duration: timing.duration,
    easing,
    origin,
    muted,
    ...(property === "motionPath"
      ? { path: motionPath.path, orient: motionPath.orient }
      : {}),
    ...(label !== undefined ? { label } : {}),
  };

  return { sourcePath: path, track, valid };
}

type ParsedGroup = {
  sourcePath: string;
  id?: string;
  targetIds: string[];
  idsPath: string;
  property?: MotionProperty;
  keyframes?: Keyframe[];
  delay: number;
  duration?: number;
  step: number;
  easing: Easing;
  path?: string;
  orient: boolean;
  origin: TransformOrigin;
  label?: string;
  muted: boolean;
  valid: boolean;
};

function parseGroup(
  raw: unknown,
  path: string,
  docKind: "svg" | "character",
  docDuration: number,
  sets: TargetSets,
  issues: IssueCollector,
): ParsedGroup | undefined {
  const errorStart = issues.errors.length;
  if (!isRecord(raw)) {
    issues.error(path, "shape", "Group must be an object");
    return undefined;
  }
  const allowed = new Set<string>(GROUP_BASE_KEYS);
  if (docKind === "svg") allowed.add("elementIds");
  else allowed.add("boneIds");
  checkKeys(raw, allowed, path, issues);

  const id = readString(raw.id, `${path}.id`, issues);

  if (!isRecord(raw.target)) {
    issues.error(`${path}.target`, "shape", "Group target must be an object");
  } else {
    checkKeys(raw.target, new Set(["kind"]), `${path}.target`, issues);
    if (raw.target.kind !== docKind) {
      issues.error(
        `${path}.target.kind`,
        "target",
        `Group target kind must be "${docKind}"`,
      );
    }
  }

  const idsPath = `${path}.${docKind === "svg" ? "elementIds" : "boneIds"}`;
  const idsRaw = docKind === "svg" ? raw.elementIds : raw.boneIds;
  const targetIds: string[] = [];
  if (!Array.isArray(idsRaw) || idsRaw.length === 0) {
    issues.error(
      idsPath,
      "shape",
      `Group requires a non-empty ${
        docKind === "svg" ? "elementIds" : "boneIds"
      } array`,
    );
  } else {
    if (idsRaw.length > MAX_TRACKS) {
      issues.error(
        idsPath,
        "shape",
        `A group may expand to at most ${MAX_TRACKS} tracks`,
      );
    }
    const limit = Math.min(idsRaw.length, MAX_TRACKS);
    for (let i = 0; i < limit; i++) {
      const idValue = readString(idsRaw[i], indexPath(idsPath, i), issues);
      if (idValue === undefined) continue;
      const set = docKind === "svg" ? sets.elementIds : sets.boneIds;
      if (set && !set.has(idValue)) {
        issues.error(
          indexPath(idsPath, i),
          "target",
          `Unknown ${
            docKind === "svg" ? "SVG element" : "character bone"
          } "${idValue}"`,
        );
        continue;
      }
      targetIds.push(idValue);
    }
  }

  let property: MotionProperty | undefined;
  const propertySet =
    docKind === "svg" ? SVG_PROPERTY_SET : CHARACTER_GROUP_PROPERTY_SET;
  if (typeof raw.property !== "string" || !propertySet.has(raw.property)) {
    issues.error(
      `${path}.property`,
      "property",
      `Property "${String(raw.property)}" is not valid for ${docKind} group targets`,
    );
  } else {
    property = raw.property as MotionProperty;
  }

  const keyframes = parseKeyframes(
    raw.keyframes,
    `${path}.keyframes`,
    property,
    issues,
  );

  let delay = 0;
  if (raw.delay !== undefined) {
    const value = readFiniteNumber(raw.delay, `${path}.delay`, issues, "timing");
    if (value !== undefined) {
      if (value < 0) {
        issues.error(`${path}.delay`, "timing", "delay must be >= 0");
      } else {
        delay = value;
      }
    }
  }

  let duration: number | undefined;
  if (raw.duration !== undefined) {
    const value = readFiniteNumber(
      raw.duration,
      `${path}.duration`,
      issues,
      "timing",
    );
    if (value !== undefined) {
      if (value <= 0) {
        issues.error(`${path}.duration`, "timing", "duration must be > 0");
      } else {
        duration = value;
      }
    }
  }

  let step = 0;
  if (raw.step !== undefined) {
    const value = readFiniteNumber(raw.step, `${path}.step`, issues, "timing");
    if (value !== undefined) {
      if (value < 0) {
        issues.error(`${path}.step`, "timing", "step must be >= 0");
      } else {
        step = value;
      }
    }
  }

  let easing: Easing = "easeInOut";
  if (raw.easing !== undefined) {
    const parsed = parseEasing(raw.easing, `${path}.easing`, issues);
    if (parsed !== undefined) easing = parsed;
  }

  const motionPath = parseMotionPathFields(raw, path, property, issues);
  const origin = parseOrigin(
    raw.origin,
    path,
    docKind === "character" ? "bone" : "center",
    docKind === "svg",
    issues,
  );
  const label = readOptionalString(raw.label, `${path}.label`, issues);
  let muted = false;
  if (raw.muted !== undefined) {
    if (typeof raw.muted !== "boolean") {
      issues.error(`${path}.muted`, "shape", "muted must be a boolean");
    } else {
      muted = raw.muted;
    }
  }

  const valid =
    issues.errors.length === errorStart &&
    id !== undefined &&
    targetIds.length > 0 &&
    property !== undefined &&
    keyframes !== undefined &&
    (property === "motionPath" ? motionPath.path !== undefined : true);

  return {
    sourcePath: path,
    id,
    targetIds,
    idsPath,
    property,
    keyframes,
    delay,
    duration,
    step,
    easing,
    ...(motionPath.path !== undefined ? { path: motionPath.path } : {}),
    orient: motionPath.orient,
    origin,
    ...(label !== undefined ? { label } : {}),
    muted,
    valid,
  };
}

function trackPairKey(target: MotionTarget, property: MotionProperty): string {
  return motionPairKey(target, property);
}

function validateInternal(
  raw: unknown,
  ctx: ValidationContext,
): ValidationResult {
  const issues = new IssueCollector();

  if (!isRecord(raw)) {
    issues.error("", "shape", "Motion document must be an object");
    return { ok: false, errors: issues.errors, warnings: issues.warnings };
  }
  checkKeys(raw, DOC_KEYS, "", issues);

  if (raw.version !== MOTION_DOC_VERSION) {
    issues.error(
      "version",
      "version",
      `Unsupported Motion DSL version; expected ${MOTION_DOC_VERSION}`,
    );
  }
  const id = readString(raw.id, "id", issues);
  const name = readString(raw.name, "name", issues);

  let docKind: "svg" | "character" = ctx.targetKind;
  if (raw.targetKind !== "svg" && raw.targetKind !== "character") {
    issues.error(
      "targetKind",
      "target",
      'targetKind must be "svg" or "character"',
    );
  } else {
    docKind = raw.targetKind;
    if (raw.targetKind !== ctx.targetKind) {
      issues.error(
        "targetKind",
        "target",
        `Document targetKind "${raw.targetKind}" does not match validation context "${ctx.targetKind}"`,
      );
    }
  }

  const minDuration = Math.max(
    MIN_DURATION,
    Number.isFinite(ctx.minDuration) ? (ctx.minDuration as number) : MIN_DURATION,
  );
  const maxDuration = Math.min(
    MAX_DURATION,
    Number.isFinite(ctx.maxDuration) ? (ctx.maxDuration as number) : MAX_DURATION,
  );

  let duration = 1;
  if (typeof raw.duration !== "number" || !Number.isFinite(raw.duration)) {
    issues.error("duration", "shape", "duration must be a finite number");
  } else if (
    raw.duration < minDuration - TIMING_EPSILON ||
    raw.duration > maxDuration + TIMING_EPSILON
  ) {
    issues.error(
      "duration",
      "duration",
      `duration must be between ${minDuration} and ${maxDuration} seconds`,
    );
  } else {
    duration = Math.min(maxDuration, Math.max(minDuration, raw.duration));
  }

  if (raw.fps !== MOTION_FPS) {
    issues.error(
      "fps",
      "shape",
      `fps must be ${MOTION_FPS} for Motion DSL v1`,
    );
  }

  const loop = parseLoop(raw.loop, "loop", issues);
  if (loop?.mode === "pingpong") {
    issues.warning(
      "loop.mode",
      "unsupported",
      "Pingpong loop is exported to SVG as a restart loop",
    );
  }

  const meta = parseMeta(raw.meta, "meta", issues);
  const sets: TargetSets = {
    elementIds: toIdSet(ctx.elementIds),
    boneIds: boneTargetSet(ctx),
    bones: boneContextByKey(ctx),
    objectIds: toIdSet(ctx.objectIds),
  };

  const parsedTracks: ParsedTrack[] = [];
  if (!Array.isArray(raw.tracks)) {
    issues.error("tracks", "shape", "tracks must be an array");
  } else {
    if (raw.tracks.length > MAX_TRACKS) {
      issues.error(
        "tracks",
        "shape",
        `At most ${MAX_TRACKS} tracks are allowed`,
      );
    }
    const limit = Math.min(raw.tracks.length, MAX_TRACKS);
    for (let i = 0; i < limit; i++) {
      const parsed = parseTrack(
        raw.tracks[i],
        indexPath("tracks", i),
        docKind,
        duration,
        sets,
        issues,
      );
      if (parsed) parsedTracks.push(parsed);
    }
  }

  const parsedGroups: ParsedGroup[] = [];
  let groupExpansionCount = 0;
  if (raw.groups !== undefined) {
    if (!Array.isArray(raw.groups)) {
      issues.error("groups", "shape", "groups must be an array");
    } else {
      if (raw.groups.length > MAX_GROUPS) {
        issues.error(
          "groups",
          "shape",
          `At most ${MAX_GROUPS} groups are allowed`,
        );
      }
      const limit = Math.min(raw.groups.length, MAX_GROUPS);
      for (let i = 0; i < limit; i++) {
        const parsed = parseGroup(
          raw.groups[i],
          indexPath("groups", i),
          docKind,
          duration,
          sets,
          issues,
        );
        if (parsed) {
          parsedGroups.push(parsed);
          groupExpansionCount += parsed.targetIds.length;
        }
      }
    }
  }

  if (parsedTracks.length + groupExpansionCount > MAX_TRACKS) {
    issues.error(
      "groups",
      "shape",
      `Expanded document would contain ${
        parsedTracks.length + groupExpansionCount
      } tracks; at most ${MAX_TRACKS} are allowed`,
    );
  }

  const pairWindows = new Map<
    string,
    Array<{ path: string; start: number; end: number }>
  >();
  const ids = new Map<string, string>();
  const normalizedTracks: MotionTrack[] = [];

  const registerTrack = (
    track: MotionTrack,
    sourcePath: string,
    pairPath: string,
    idPath: string,
  ): void => {
    // Multiple tracks may target the same object/property. They compose
    // (additive, multiplicative or last-wins) during evaluation. Only an
    // overlapping window is worth a warning; it is not an error.
    const pair = trackPairKey(track.target, track.property);
    const start = Math.max(0, track.delay ?? 0);
    const trackDuration =
      track.duration ?? Math.max(0, duration - start);
    const end = start + trackDuration;
    const windows = pairWindows.get(pair);
    if (windows) {
      const overlap = windows.find(
        (window) =>
          start < window.end - TIMING_EPSILON &&
          window.start < end - TIMING_EPSILON,
      );
      if (overlap) {
        issues.warning(
          pairPath,
          "timing",
          `Track window overlaps ${overlap.path} for the same target/property; values compose deterministically`,
        );
      }
      windows.push({ path: sourcePath, start, end });
    } else {
      pairWindows.set(pair, [{ path: sourcePath, start, end }]);
    }

    const existingId = ids.get(track.id);
    if (existingId) {
      issues.error(
        idPath,
        "duplicate",
        `Duplicate track id "${track.id}"`,
      );
    } else {
      ids.set(track.id, sourcePath);
    }
    normalizedTracks.push(track);
  };

  for (const parsed of parsedTracks) {
    if (!parsed.valid) continue;
    registerTrack(
      parsed.track,
      parsed.sourcePath,
      `${parsed.sourcePath}.property`,
      `${parsed.sourcePath}.id`,
    );
  }

  for (const group of parsedGroups) {
    if (!group.valid || group.id === undefined || group.property === undefined || group.keyframes === undefined) {
      continue;
    }
    for (let index = 0; index < group.targetIds.length; index++) {
      const targetId = group.targetIds[index];
      const start = group.delay + index * group.step;
      const itemPath = indexPath(group.idsPath, index);
      const available = Math.max(0, duration - start);
      if (start > duration + TIMING_EPSILON) {
        issues.error(
          itemPath,
          "timing",
          `Staggered track starts at ${start}s, after the ${duration}s document ends`,
        );
        continue;
      }
      let trackDuration: number;
      if (group.duration === undefined) {
        trackDuration = available;
        if (trackDuration <= 0) {
          issues.error(
            itemPath,
            "timing",
            "Staggered track has no time left inside the document duration",
          );
          continue;
        }
      } else {
        const end = start + group.duration;
        if (end > duration + TIMING_EPSILON) {
          if (index === 0) {
            issues.error(
              itemPath,
              "timing",
              `Staggered track ends at ${end}s, beyond the ${duration}s document duration`,
            );
            continue;
          }
          // A group window is authored once and shared by every staggered
          // target. Later targets are clamped into the document rather than
          // making an otherwise usable group impossible to place.
          trackDuration = available;
          if (trackDuration <= 0) {
            issues.error(
              itemPath,
              "timing",
              "Staggered track has no time left inside the document duration",
            );
            continue;
          }
          issues.warning(
            itemPath,
            "timing",
            `Staggered track end was clamped from ${end}s to the ${duration}s document duration`,
          );
        } else {
          trackDuration = end > duration ? available : group.duration;
        }
      }

      const target: MotionTarget =
        docKind === "svg"
          ? { kind: "svg", elementId: targetId }
          : (() => {
              const { actorId, boneId } = splitBoneKey(targetId);
              return { kind: "character", actorId, boneId } as const;
            })();
      const safeSuffix = targetId.replace(/[^a-zA-Z0-9_-]/g, "-");
      const track: MotionTrack = {
        id: `${group.id}__${safeSuffix}`,
        target,
        property: group.property,
        keyframes: group.keyframes.map((keyframe) => ({
          ...keyframe,
          ...(keyframe.easing !== undefined
            ? { easing: keyframe.easing }
            : {}),
        })),
        delay: start,
        duration: trackDuration,
        easing: group.easing,
        origin: group.origin,
        muted: group.muted,
        ...(group.property === "motionPath"
          ? { path: group.path, orient: group.orient }
          : {}),
        ...(group.label !== undefined ? { label: group.label } : {}),
      };
      registerTrack(track, group.sourcePath, itemPath, `${group.idsPath}[${index}]`);
    }
  }

  let outputTracks = normalizedTracks;
  if (ctx.allowMuted === false) {
    const mutedCount = outputTracks.filter((track) => track.muted).length;
    if (mutedCount > 0) {
      issues.warning(
        "tracks",
        "unsupported",
        `${mutedCount} muted track(s) omitted because allowMuted is false`,
      );
      outputTracks = outputTracks.filter((track) => !track.muted);
    }
  }

  if (issues.errors.length > 0) {
    return { ok: false, errors: issues.errors, warnings: issues.warnings };
  }

  const document: MotionDocument = {
    version: MOTION_DOC_VERSION,
    id: id as string,
    name: name as string,
    targetKind: docKind,
    duration,
    fps: MOTION_FPS,
    loop: loop as MotionLoop,
    tracks: outputTracks,
    ...(meta !== undefined ? { meta } : {}),
  };

  return {
    ok: true,
    document,
    errors: issues.errors,
    warnings: issues.warnings,
  };
}

/** Validate untrusted input and return a fully normalized document on success. */
export function validateMotionDocument(
  raw: unknown,
  ctx: ValidationContext,
): ValidationResult {
  return validateInternal(raw, ctx);
}

/**
 * Normalize untrusted input. This uses the same strict validation as
 * `validateMotionDocument`: defaults are filled and groups are expanded, but
 * invalid documents do not produce a partially normalized result.
 */
export function normalizeMotionDocument(
  raw: unknown,
  ctx: ValidationContext,
): ValidationResult {
  return validateInternal(raw, ctx);
}

/**
 * Expand authoring-only stagger groups without validating. Useful for diffing
 * and for callers that already validated the document. Groups are removed and
 * expanded tracks use `${group.id}__${targetId}` ids.
 */
export function expandMotionDocument(doc: MotionDocument): MotionDocument {
  const groups = doc.groups ?? [];
  if (groups.length === 0) {
    return { ...doc, groups: undefined };
  }
  const tracks = [...doc.tracks];
  for (const group of groups) {
    const targetIds = group.elementIds ?? group.boneIds ?? [];
    targetIds.forEach((targetId, index) => {
      const delay = (group.delay ?? 0) + index * (group.step ?? 0);
      const target: MotionTarget =
        group.target.kind === "svg"
          ? { kind: "svg", elementId: targetId }
          : (() => {
              const { actorId, boneId } = splitBoneKey(targetId);
              return { kind: "character", actorId, boneId } as const;
            })();
      const duration =
        group.duration ?? Math.max(0, doc.duration - delay);
      tracks.push({
        id: `${group.id}__${targetId.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
        target,
        property: group.property,
        keyframes: group.keyframes.map((keyframe) => ({
          ...keyframe,
          ...(keyframe.easing !== undefined
            ? { easing: keyframe.easing }
            : {}),
        })),
        delay,
        duration,
        ...(group.easing !== undefined ? { easing: group.easing } : {}),
        ...(group.path !== undefined ? { path: group.path } : {}),
        ...(group.orient !== undefined ? { orient: group.orient } : {}),
        ...(group.origin !== undefined ? { origin: group.origin } : {}),
        ...(group.label !== undefined ? { label: group.label } : {}),
        ...(group.muted !== undefined ? { muted: group.muted } : {}),
      });
    });
  }
  return { ...doc, tracks, groups: undefined };
}
