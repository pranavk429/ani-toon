/**
 * Server-side request validation and compact Director context helpers.
 *
 * The browser payload is untrusted. Validate its shape before any provider
 * call, then derive the Motion DSL validation context from the real target IDs.
 */

import type {
  AnimationDirectionFailure,
  AnimationDirectionRequest,
  CharacterActorContext,
  CharacterDirectionContext,
  CharacterObjectContext,
  DirectorMessage,
  DirectorStyleProfile,
} from "./contracts";
import type { BoneTargetContext, ValidationContext } from "@/lib/animation/types";
import type { SceneContext, SceneElementContext } from "@/lib/svg/types";
import { characterContextForScene } from "@/creature/motion";
import type { Scene } from "@/creature/types";

export const MAX_INSTRUCTION_LENGTH = 1200;
export const MIN_DIRECTED_DURATION = 0.8;
export const MAX_DIRECTED_DURATION = 8;

export type RequestValidation =
  | { ok: true; request: AnimationDirectionRequest }
  | {
      ok: false;
      code: AnimationDirectionFailure["error"]["code"];
      message: string;
      retryable: boolean;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function fail(
  code: AnimationDirectionFailure["error"]["code"],
  message: string,
  retryable = false,
): RequestValidation {
  return { ok: false, code, message, retryable };
}

function validateScene(raw: unknown): SceneContext | null {
  if (!isRecord(raw)) return null;
  const viewBox = raw.viewBox;
  if (!isRecord(viewBox)) return null;
  if (
    !isFiniteNumber(viewBox.minX) ||
    !isFiniteNumber(viewBox.minY) ||
    !isFiniteNumber(viewBox.width) ||
    !isFiniteNumber(viewBox.height) ||
    viewBox.width <= 0 ||
    viewBox.height <= 0
  ) {
    return null;
  }
  if (typeof raw.assetId !== "string" || !Array.isArray(raw.elements)) return null;

  const seen = new Set<string>();
  const elements: SceneElementContext[] = [];
  for (const item of raw.elements) {
    if (!isRecord(item)) return null;
    if (typeof item.id !== "string" || item.id.length === 0 || item.id.length > 200) {
      return null;
    }
    if (typeof item.tag !== "string" || item.tag.length === 0) return null;
    if (seen.has(item.id)) return null;
    seen.add(item.id);
    const parentId =
      item.parentId === null || typeof item.parentId === "string"
        ? (item.parentId as string | null)
        : null;
    const bbox = isRecord(item.bbox)
      ? {
          x: isFiniteNumber(item.bbox.x) ? item.bbox.x : 0,
          y: isFiniteNumber(item.bbox.y) ? item.bbox.y : 0,
          w: isFiniteNumber(item.bbox.w) ? item.bbox.w : 0,
          h: isFiniteNumber(item.bbox.h) ? item.bbox.h : 0,
        }
      : { x: 0, y: 0, w: 0, h: 0 };
    elements.push({
      id: item.id,
      tag: item.tag as SceneElementContext["tag"],
      parentId,
      childCount: isFiniteNumber(item.childCount) ? Math.max(0, item.childCount) : 0,
      bbox,
      name: typeof item.name === "string" ? item.name : undefined,
      role: typeof item.role === "string" ? item.role : undefined,
      tags: isStringArray(item.tags) ? item.tags : undefined,
      text: typeof item.text === "string" ? item.text : undefined,
      animated: item.animated === true,
      selected: item.selected === true,
    });
  }

  if (elements.length === 0) return null;

  return {
    assetId: raw.assetId,
    filename: typeof raw.filename === "string" ? raw.filename : undefined,
    viewBox: {
      minX: viewBox.minX,
      minY: viewBox.minY,
      width: viewBox.width,
      height: viewBox.height,
    },
    elementCount: isFiniteNumber(raw.elementCount)
      ? Math.max(elements.length, raw.elementCount)
      : elements.length,
    animatableCount: isFiniteNumber(raw.animatableCount)
      ? Math.max(0, raw.animatableCount)
      : elements.length,
    truncated: raw.truncated === true,
    elements,
  };
}

function validateCharacter(
  rawCharacter: unknown,
  rawScene?: unknown,
): CharacterDirectionContext | null {
  // If a creature Scene is passed in scene, convert to CharacterDirectionContext
  if (
    (!rawCharacter || !isRecord(rawCharacter)) &&
    isRecord(rawScene) &&
    Array.isArray(rawScene.actors) &&
    isRecord(rawScene.world)
  ) {
    try {
      return characterContextForScene(rawScene as unknown as Scene);
    } catch {
      return null;
    }
  }

  if (!isRecord(rawCharacter)) return null;

  // Validate actors
  if (!Array.isArray(rawCharacter.actors) || rawCharacter.actors.length === 0) {
    return null;
  }
  const actors: CharacterActorContext[] = [];
  for (const actor of rawCharacter.actors) {
    if (!isRecord(actor)) return null;
    if (typeof actor.id !== "string" || actor.id.length === 0) return null;
    actors.push({
      id: actor.id,
      name: typeof actor.name === "string" ? actor.name : actor.id,
      species: typeof actor.species === "string" ? actor.species : "human",
      bodyPlan: typeof actor.bodyPlan === "string" ? actor.bodyPlan : "biped",
      summary: typeof actor.summary === "string" ? actor.summary : "",
      palette: isRecord(actor.palette)
        ? (actor.palette as Record<string, string>)
        : {},
      accessories: isStringArray(actor.accessories) ? actor.accessories : [],
    });
  }

  // Validate bones
  if (!Array.isArray(rawCharacter.bones) || rawCharacter.bones.length === 0) {
    return null;
  }
  const bones: BoneTargetContext[] = [];
  for (const bone of rawCharacter.bones) {
    if (!isRecord(bone)) return null;
    if (typeof bone.actorId !== "string" || bone.actorId.length === 0) return null;
    if (typeof bone.boneId !== "string" || bone.boneId.length === 0) return null;
    const rotationMin =
      isRecord(bone.rotationLimit) && isFiniteNumber(bone.rotationLimit.min)
        ? bone.rotationLimit.min
        : -180;
    const rotationMax =
      isRecord(bone.rotationLimit) && isFiniteNumber(bone.rotationLimit.max)
        ? bone.rotationLimit.max
        : 180;
    const scaleMin =
      isRecord(bone.scaleLimit) && isFiniteNumber(bone.scaleLimit.min)
        ? bone.scaleLimit.min
        : 0.5;
    const scaleMax =
      isRecord(bone.scaleLimit) && isFiniteNumber(bone.scaleLimit.max)
        ? bone.scaleLimit.max
        : 1.5;
    bones.push({
      actorId: bone.actorId,
      boneId: bone.boneId,
      role: typeof bone.role === "string" ? bone.role : undefined,
      parent:
        bone.parent === null || typeof bone.parent === "string"
          ? bone.parent
          : null,
      rotationLimit: {
        min: Math.min(rotationMin, rotationMax),
        max: Math.max(rotationMin, rotationMax),
      },
      scaleLimit: {
        min: Math.min(scaleMin, scaleMax),
        max: Math.max(scaleMin, scaleMax),
      },
      note: typeof bone.note === "string" ? bone.note : "",
    });
  }

  // Validate objects
  const objects: CharacterObjectContext[] = [];
  if (Array.isArray(rawCharacter.objects)) {
    for (const obj of rawCharacter.objects) {
      if (!isRecord(obj)) continue;
      if (typeof obj.id !== "string" || obj.id.length === 0) continue;
      if (typeof obj.kind !== "string" || obj.kind.length === 0) continue;
      objects.push({
        id: obj.id,
        kind: obj.kind,
        label: typeof obj.label === "string" ? obj.label : undefined,
        x: isFiniteNumber(obj.x) ? obj.x : 360,
        y: isFiniteNumber(obj.y) ? obj.y : 360,
        scale: isFiniteNumber(obj.scale) ? obj.scale : 1,
        rotation: isFiniteNumber(obj.rotation) ? obj.rotation : 0,
      });
    }
  }

  const world = isRecord(rawCharacter.world)
    ? {
        preset:
          typeof rawCharacter.world.preset === "string"
            ? rawCharacter.world.preset
            : "studio",
        accent:
          typeof rawCharacter.world.accent === "string"
            ? rawCharacter.world.accent
            : "#4B63FF",
      }
    : { preset: "studio", accent: "#4B63FF" };

  return {
    styleId:
      typeof rawCharacter.styleId === "string"
        ? rawCharacter.styleId
        : "anitoon-storybook-v1",
    actors,
    bones,
    objects,
    world,
    notes: isStringArray(rawCharacter.notes) ? rawCharacter.notes : [],
  };
}

function validateHistory(raw: unknown): DirectorMessage[] {
  if (!Array.isArray(raw)) return [];
  const messages: DirectorMessage[] = [];
  for (const item of raw.slice(-32)) {
    if (!isRecord(item)) continue;
    if (item.role !== "user" && item.role !== "assistant") continue;
    if (typeof item.content !== "string" || item.content.trim().length === 0) continue;
    messages.push({ role: item.role, content: item.content });
  }
  return messages.slice(-16);
}

function validateStyleProfile(raw: unknown): DirectorStyleProfile | undefined {
  if (!isRecord(raw)) return undefined;
  if (typeof raw.id !== "string" || typeof raw.name !== "string") return undefined;
  if (typeof raw.description !== "string") return undefined;
  const constraints = isStringArray(raw.constraints)
    ? raw.constraints.filter((item) => item.trim().length > 0).slice(0, 20)
    : [];
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    constraints,
  };
}

function validateCurrentDocument(
  raw: unknown,
  targetKind: "svg" | "character",
): AnimationDirectionRequest["currentDocument"] | null {
  if (!isRecord(raw)) return null;
  if (raw.version !== 1) return null;
  if (raw.targetKind !== targetKind) return null;
  if (typeof raw.id !== "string" || raw.id.length === 0) return null;
  if (typeof raw.name !== "string") return null;
  if (!isFiniteNumber(raw.duration) || raw.duration <= 0) return null;
  if (!Array.isArray(raw.tracks)) return null;
  if (!isRecord(raw.loop) || typeof raw.loop.enabled !== "boolean") return null;
  return raw as unknown as NonNullable<AnimationDirectionRequest["currentDocument"]>;
}

export function validateDirectionRequest(raw: unknown): RequestValidation {
  if (!isRecord(raw)) {
    return fail("bad_request", "Request body must be a JSON object.");
  }
  if (raw.version !== 1) {
    return fail("bad_request", "Unsupported request version. Expected version 1.");
  }
  if (raw.action !== "generate" && raw.action !== "revise") {
    return fail("bad_request", 'action must be "generate" or "revise".');
  }
  if (raw.targetKind !== "svg" && raw.targetKind !== "character") {
    return fail("bad_request", 'targetKind must be "svg" or "character".');
  }

  if (typeof raw.instruction !== "string") {
    return fail("bad_request", "instruction must be a string.");
  }
  const instruction = raw.instruction.trim();
  if (instruction.length === 0) {
    return fail("bad_request", "instruction must not be empty.");
  }
  if (instruction.length > MAX_INSTRUCTION_LENGTH) {
    return fail(
      "bad_request",
      `instruction must be at most ${MAX_INSTRUCTION_LENGTH} characters.`,
    );
  }

  const targetKind = raw.targetKind;
  const scene = targetKind === "svg" ? validateScene(raw.scene) : null;
  const character =
    targetKind === "character" ? validateCharacter(raw.character, raw.scene) : null;

  if (targetKind === "svg" && !scene) {
    return fail(
      "missing_context",
      "SVG direction requires a valid scene context with at least one element.",
    );
  }
  if (targetKind === "character" && !character) {
    return fail(
      "missing_context",
      "Character direction requires a valid character context with at least one bone.",
    );
  }

  let currentDocument: AnimationDirectionRequest["currentDocument"];
  if (raw.action === "revise") {
    const current = validateCurrentDocument(raw.currentDocument, targetKind);
    if (!current) {
      return fail(
        "bad_request",
        `Revision requires currentDocument with matching version 1 and targetKind "${targetKind}".`,
      );
    }
    currentDocument = current;
  }

  const sceneIds = new Set(scene?.elements.map((element) => element.id) ?? []);
  const selectedElementIds = isStringArray(raw.selectedElementIds)
    ? Array.from(
        new Set(
          raw.selectedElementIds.filter(
            (id) => id.length > 0 && (targetKind !== "svg" || sceneIds.has(id)),
          ),
        ),
      ).slice(0, 80)
    : [];

  const objectIds = new Set(character?.objects?.map((obj) => obj.id) ?? []);
  const selectedObjectIds = isStringArray(raw.selectedObjectIds)
    ? Array.from(
        new Set(
          raw.selectedObjectIds.filter(
            (id) => id.length > 0 && objectIds.has(id),
          ),
        ),
      ).slice(0, 40)
    : [];

  const request: AnimationDirectionRequest = {
    version: 1,
    action: raw.action,
    instruction,
    targetKind,
    scene: targetKind === "svg" ? scene ?? undefined : undefined,
    character: targetKind === "character" ? character ?? undefined : undefined,
    currentDocument: raw.action === "revise" ? currentDocument : undefined,
    selectedElementIds,
    selectedObjectIds,
    history: validateHistory(raw.history),
    styleProfile: validateStyleProfile(raw.styleProfile),
  };

  return { ok: true, request };
}

export function collectTargetIds(request: AnimationDirectionRequest): string[] {
  if (request.targetKind === "character") {
    const ids: string[] = [];
    for (const bone of request.character?.bones ?? []) {
      ids.push(`${bone.actorId}:${bone.boneId}`);
      ids.push(bone.boneId);
    }
    for (const obj of request.character?.objects ?? []) {
      ids.push(obj.id);
    }
    return Array.from(new Set(ids));
  }
  return request.scene?.elements.map((element) => element.id) ?? [];
}

export function buildValidationContext(
  request: AnimationDirectionRequest,
): ValidationContext {
  const targetKind = request.targetKind;
  if (targetKind === "character") {
    return {
      targetKind: "character",
      bones: request.character?.bones ?? [],
      objectIds: new Set(request.character?.objects?.map((obj) => obj.id) ?? []),
      minDuration: MIN_DIRECTED_DURATION,
      maxDuration: MAX_DIRECTED_DURATION,
    };
  }
  return {
    targetKind: "svg",
    elementIds: request.scene?.elements.map((element) => element.id) ?? [],
    minDuration: MIN_DIRECTED_DURATION,
    maxDuration: MAX_DIRECTED_DURATION,
  };
}
