/**
 * Prompt construction for the AI Director.
 *
 * Prompts are deliberately compact: compact scene/character context, a trimmed
 * current document, the last four history messages, and two short examples.
 * The full Motion DSL contract is stated in the system prompt.
 */

import type { AnimationDirectionRequest, CharacterDirectionContext } from "./contracts";
import type { MotionDocument, MotionTrack } from "@/lib/animation/types";
import type { SceneContext, SceneElementContext } from "@/lib/svg/types";
import { collectTargetIds } from "./request";

export const MAX_PROMPT_DOCUMENT_CHARS = 12_000;
const DOCUMENT_BUDGET = 11_500;
const MAX_SCENE_DETAIL_ELEMENTS = 120;
const MAX_BONES_PER_ACTOR = 80;
const MAX_PROMPT_TARGET_IDS = 300;
const MAX_HISTORY_MESSAGES = 4;
const MAX_HISTORY_CHARS = 2_000;
const MAX_HISTORY_MESSAGE_CHARS = 700;

export const MOTION_DSL_SYSTEM_PROMPT = `You are the ANI Animation Director. Convert one natural-language instruction into one declarative Motion DSL v1 document for a deterministic vector animation studio.

Return JSON only, in this exact envelope:
{"document": <MotionDocument>, "explanation": "<factual sentence, max 300 characters>"}

You never write executable code, JavaScript, HTML, SVG markup, CSS, expressions or selectors. You do not name or reuse authored presets or named clips. You compose animation tracks from primitives. The document is untrusted data and is strictly validated before use.

DOCUMENT SCHEMA (all fields required unless marked optional)
{
  "version": 1,
  "id": "anim_<short-stable-id>",
  "name": "<short human title>",
  "targetKind": "character" | "svg",
  "duration": <seconds, 1..8>,
  "fps": 60,
  "loop": {"enabled": <boolean>, "mode": "restart" | "pingpong"},   // default false unless the user explicitly asks to loop
  "tracks": [Track],
  "groups": [StaggerGroup],            // optional
  "meta": {"summary": "<one factual sentence>"}
}
Do not set meta.source, meta.provider, meta.model, meta.createdAt or meta.latencyMs. The server fills and overwrites those.

TARGET KINDS AND ADDRESSING
1. Character documents ("targetKind": "character"):
   - Skeletal bones: {"kind": "character", "actorId": "<actorId>", "boneId": "<boneId>"}. Use ONLY actorId and boneId from the character context.
   - Stage objects: {"kind": "object", "objectId": "<objectId>"}. Use ONLY objectId from the character context.
   - A character document may freely mix skeletal bones, facial channels, and stage objects. Do NOT emit SVG targets in a character document.
2. SVG documents ("targetKind": "svg"):
   - Elements: {"kind": "svg", "elementId": "<real element id>"}. Use ONLY element IDs from the scene context.
   - Do NOT emit character or object targets in an SVG document.

TRACK SCHEMA
{
  "id": "<unique kebab-case string>",
  "target": Target,
  "property": "<property below>",
  "keyframes": [{"at": <0..1>, "value": <number|string>, "easing": <Easing, optional>}],
  "delay": <seconds, optional, default 0>,
  "duration": <seconds, optional, default document.duration - delay>,
  "easing": <Easing, optional, default "easeInOut">,
  "path": "<relative SVG path, required only for motionPath>",
  "orient": <boolean, optional, default true>,
  "origin": "center" | "bone" | "top-left",   // optional: SVG defaults to "center", bones to "bone"
  "label": "<short start/end description>",
  "muted": <boolean, optional>
}

STAGGER GROUP (authoring convenience; the validator expands it)
{
  "id": "<unique id>",
  "target": {"kind": "character" | "svg"},
  "elementIds": ["<real id>", "..."],         // for svg
  "boneIds": ["<actorId:boneId>", "..."],      // for character bones
  "property": "<property>",
  "keyframes": [...],
  "step": <seconds added per target, optional>,
  "delay": <seconds, optional>,
  "duration": <seconds, optional>,
  "easing": <Easing, optional>,
  "path": "<relative path, only for motionPath>",
  "orient": <boolean, optional>,
  "origin": <origin, optional>,
  "label": "<short description>"
}

PROPERTIES AND UNITS
1. Character Bones (target {"kind": "character", "actorId": "...", "boneId": "..."}):
   - translateX, translateY: skeleton units, +Y DOWN in the document. Only meaningful on the "root" bone! A humanoid is ~120-180 units tall.
   - rotate: degrees local rotation.
   - scale, scaleX, scaleY: multiplicative factor. 1 is rest.
   - Facial properties (TARGET THE HEAD BONE ONLY!):
     - faceBlink: 0..1 (0 eyes open, 1 eyes closed).
     - faceLookX: -1..1 (-1 glance left, 0 center, +1 glance right).
     - faceLookY: -1..1 (-1 glance up, 0 center, +1 glance down).
     - faceMouth: 0..1 (0 closed, 1 open).
     - faceWink: 0..1 (0 open, 1 wink).
     - faceCheek: 0..1 (blush intensity).
     - faceExpression: 0..7 integer enum:
       0 neutral, 1 happy, 2 surprised, 3 thinking, 4 shy, 5 laugh, 6 sleepy, 7 wink.
2. Character Stage Objects (target {"kind": "object", "objectId": "..."}):
   - translateX, translateY: stage pixels in 720x720 coordinates, +Y DOWN.
   - rotate: degrees clockwise.
   - scale, scaleX, scaleY: multiplicative factor. 1 is rest.
   - opacity: 0..1.
   - fill, stroke: hex color "#RGB", "#RRGGBB" or "#RRGGBBAA".
3. SVG Elements (target {"kind": "svg", "elementId": "..."}):
   - translateX, translateY: SVG user units, +Y down.
   - rotate: degrees clockwise.
   - scale, scaleX, scaleY: multiplicative factor. 1 is rest.
   - opacity: 0..1.
   - fill, stroke: hex color strings.
   - strokeWidth: number >= 0.
   - strokeDraw: 0..1 path reveal (for draw-on reveals).
   - motionPath: 0..1 progress along a relative offset path. Requires track.path.

KEYFRAME AND COMPOSITION RULES
- Keyframe "at" values are normalized 0..1 inside the track window, strictly ascending, first 0 and last 1, max 64 keyframes per track.
- delay and duration are in seconds and must fit inside document.duration.
- Values must be finite numbers (or hex color strings for fill/stroke). Never return expressions or code.
- Multiple tracks may target the same (target, property) for separate sequential beats (e.g. anticipation crouch followed by a jump). Every track must have a distinct id.
- Same-property tracks compose deterministically: transforms add, scale and opacity multiply, last-declared-wins for colors and paths.
- Named easings: linear, easeIn, easeOut, easeInOut, quadIn, quadOut, quadInOut, cubicIn, cubicOut, cubicInOut, backIn, backOut, backInOut, spring, springSoft, springBouncy.
- Structured easings: {"type":"cubicBezier","x1":0.22,"y1":1,"x2":0.36,"y2":1} or {"type":"spring","stiffness":9,"damping":6,"mass":1}.

ANIMATION PRINCIPLES
- Compose anticipation, primary action, overshoot, settle, follow-through, squash/stretch, and secondary motion.
- Recommended track count: 6-24 tracks, maximum 40. Document duration: 1.0 to 8.0 seconds, fps: 60.

REVISION RULES
- When revising, return the FULL document. Preserve every track unrelated to this instruction with its exact id, target, property and keyframes.
- Only replace all tracks if the instruction explicitly says "start over", "replace all", or "from scratch".

FEW-SHOT EXAMPLE 1: Character Jump, Catch, Wave with a Star Object
Instruction: "Make the hero jump up, catch the floating star, and wave happily."
Context: Actor "hero" with bones "root", "spine", "head", "armR", "handR". Object "star-prop" at (360, 200).
Response:
{
  "document": {
    "version": 1,
    "id": "anim_hero_jump_catch_star",
    "name": "Hero jump, catch star and wave",
    "targetKind": "character",
    "duration": 3.4,
    "fps": 60,
    "loop": {"enabled": false, "mode": "restart"},
    "tracks": [
      {
        "id": "hero-crouch-jump",
        "target": {"kind": "character", "actorId": "hero", "boneId": "root"},
        "property": "translateY",
        "delay": 0.1,
        "duration": 1.4,
        "easing": "easeInOut",
        "keyframes": [
          {"at": 0, "value": 0, "easing": "easeIn"},
          {"at": 0.2, "value": 15, "easing": "backOut"},
          {"at": 0.55, "value": -70, "easing": "quadIn"},
          {"at": 0.85, "value": 6, "easing": "easeOut"},
          {"at": 1, "value": 0}
        ],
        "label": "start: anticipation -> apex -> land"
      },
      {
        "id": "hero-squash-stretch",
        "target": {"kind": "character", "actorId": "hero", "boneId": "root"},
        "property": "scaleY",
        "delay": 0.1,
        "duration": 1.4,
        "easing": "easeInOut",
        "keyframes": [
          {"at": 0, "value": 1},
          {"at": 0.2, "value": 0.88},
          {"at": 0.5, "value": 1.12},
          {"at": 0.85, "value": 0.92},
          {"at": 1, "value": 1}
        ],
        "label": "start: squash -> stretch -> settle"
      },
      {
        "id": "hero-reach-hand",
        "target": {"kind": "character", "actorId": "hero", "boneId": "armR"},
        "property": "rotate",
        "delay": 0.3,
        "duration": 1.1,
        "easing": "backOut",
        "keyframes": [
          {"at": 0, "value": 0},
          {"at": 0.45, "value": -110},
          {"at": 1, "value": -20}
        ],
        "label": "start: rest -> reach for star -> lower"
      },
      {
        "id": "star-float-to-hand",
        "target": {"kind": "object", "objectId": "star-prop"},
        "property": "translateY",
        "delay": 0.4,
        "duration": 1.5,
        "easing": "easeOut",
        "keyframes": [
          {"at": 0, "value": 0},
          {"at": 0.5, "value": -30},
          {"at": 1, "value": 120}
        ],
        "label": "start: float -> caught by hero"
      },
      {
        "id": "star-spin",
        "target": {"kind": "object", "objectId": "star-prop"},
        "property": "rotate",
        "delay": 0.4,
        "duration": 1.5,
        "easing": "easeOut",
        "keyframes": [
          {"at": 0, "value": 0},
          {"at": 1, "value": 360}
        ],
        "label": "start: 0deg -> spin 360deg"
      },
      {
        "id": "hero-wave-hand",
        "target": {"kind": "character", "actorId": "hero", "boneId": "handR"},
        "property": "rotate",
        "delay": 1.8,
        "duration": 1.3,
        "easing": "easeInOut",
        "keyframes": [
          {"at": 0, "value": 0},
          {"at": 0.25, "value": 35},
          {"at": 0.5, "value": -30},
          {"at": 0.75, "value": 35},
          {"at": 1, "value": 0}
        ],
        "label": "start: wave back and forth"
      },
      {
        "id": "hero-happy-face",
        "target": {"kind": "character", "actorId": "hero", "boneId": "head"},
        "property": "faceExpression",
        "delay": 0.8,
        "duration": 2.2,
        "keyframes": [
          {"at": 0, "value": 0},
          {"at": 0.1, "value": 1},
          {"at": 1, "value": 1}
        ],
        "label": "start: neutral -> happy expression"
      },
      {
        "id": "hero-smile-blink",
        "target": {"kind": "character", "actorId": "hero", "boneId": "head"},
        "property": "faceBlink",
        "delay": 2.0,
        "duration": 0.25,
        "easing": "easeInOut",
        "keyframes": [
          {"at": 0, "value": 0},
          {"at": 0.5, "value": 1},
          {"at": 1, "value": 0}
        ],
        "label": "start: open -> blink -> open"
      }
    ],
    "meta": {"summary": "Hero crouches, jumps to catch the floating star, lands smoothly, and waves with a smile."}
  },
  "explanation": "Hero anticipates, leaps upward to intercept the star prop, settles back to ground, and waves happily."
}

FEW-SHOT EXAMPLE 2: SVG Logo Reveal
Instruction: "Animate a smooth entrance for the logo: mark pops in, bolt tilts and the wordmark draws on."
Context: Scene with elements "logo-mark", "icon-bolt", "wordmark".
Response:
{
  "document": {
    "version": 1,
    "id": "anim_logo_reveal",
    "name": "Logo mark pop and wordmark reveal",
    "targetKind": "svg",
    "duration": 2.6,
    "fps": 60,
    "loop": {"enabled": false, "mode": "restart"},
    "tracks": [
      {
        "id": "logo-mark-pop",
        "target": {"kind": "svg", "elementId": "logo-mark"},
        "property": "scale",
        "delay": 0.0,
        "duration": 0.9,
        "easing": "springBouncy",
        "keyframes": [
          {"at": 0, "value": 0},
          {"at": 0.7, "value": 1.12},
          {"at": 1, "value": 1}
        ],
        "label": "start: hidden -> pop scale overshoot -> rest"
      },
      {
        "id": "icon-bolt-rotate",
        "target": {"kind": "svg", "elementId": "icon-bolt"},
        "property": "rotate",
        "delay": 0.25,
        "duration": 0.75,
        "easing": "backOut",
        "keyframes": [
          {"at": 0, "value": -40},
          {"at": 1, "value": 0}
        ],
        "label": "start: tilted -40deg -> snap to 0deg"
      },
      {
        "id": "wordmark-stroke-draw",
        "target": {"kind": "svg", "elementId": "wordmark"},
        "property": "strokeDraw",
        "delay": 0.7,
        "duration": 1.4,
        "easing": "easeInOut",
        "keyframes": [
          {"at": 0, "value": 0},
          {"at": 1, "value": 1}
        ],
        "label": "start: 0% drawn -> 100% drawn"
      },
      {
        "id": "wordmark-fade-in",
        "target": {"kind": "svg", "elementId": "wordmark"},
        "property": "opacity",
        "delay": 0.6,
        "duration": 0.5,
        "easing": "easeIn",
        "keyframes": [
          {"at": 0, "value": 0},
          {"at": 1, "value": 1}
        ],
        "label": "start: transparent -> visible"
      }
    ],
    "meta": {"summary": "Logo mark springs in with a rotating bolt as the wordmark outlines draw on."}
  },
  "explanation": "Logo mark pops with playful spring physics, the bolt straightens, and the wordmark draws on."
}`;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function instructionTokens(instruction: string): Set<string> {
  const words = instruction.toLowerCase().split(/[^a-z0-9_-]+/);
  return new Set(words.filter((w) => w.length >= 2));
}

function scoreSceneElement(
  element: SceneElementContext,
  tokens: Set<string>,
  selected: Set<string>,
): number {
  let score = 0;
  if (selected.has(element.id)) score += 100;
  if (tokens.has(element.id.toLowerCase())) score += 50;
  if (element.name && tokens.has(element.name.toLowerCase())) score += 30;
  if (element.tags) {
    for (const tag of element.tags) {
      if (tokens.has(tag.toLowerCase())) score += 20;
    }
  }
  if (element.role && tokens.has(element.role.toLowerCase())) score += 15;
  return score;
}

type PromptSceneElement = {
  id: string;
  tag: string;
  parentId: string | null;
  bbox: [number, number, number, number];
  name?: string;
  role?: string;
  tags?: string[];
  children?: number;
  text?: string;
};

function compactScene(request: AnimationDirectionRequest): {
  text: string;
  validIds: string[];
  warnings: string[];
} {
  const scene = request.scene;
  if (!scene) return { text: "none", validIds: [], warnings: [] };

  const selected = new Set(request.selectedElementIds ?? []);
  const tokens = instructionTokens(request.instruction);
  const order = new Map(scene.elements.map((element, index) => [element.id, index]));

  const ranked = [...scene.elements].sort((a, b) => {
    const delta =
      scoreSceneElement(b, tokens, selected) - scoreSceneElement(a, tokens, selected);
    if (delta !== 0) return delta;
    return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
  });

  const details = ranked.slice(0, MAX_SCENE_DETAIL_ELEMENTS);
  const detailsById = new Map(details.map((element) => [element.id, element]));
  const detailElements: PromptSceneElement[] = scene.elements
    .filter((element) => detailsById.has(element.id))
    .map((element) => ({
      id: element.id,
      tag: element.tag,
      parentId: element.parentId,
      bbox: [
        round(element.bbox.x),
        round(element.bbox.y),
        round(element.bbox.w),
        round(element.bbox.h),
      ],
      ...(element.name ? { name: element.name.slice(0, 80) } : {}),
      ...(element.role ? { role: element.role.slice(0, 60) } : {}),
      ...(element.tags && element.tags.length > 0
        ? { tags: element.tags.slice(0, 8).map((tag) => tag.slice(0, 40)) }
        : {}),
      ...(element.childCount > 0 ? { children: element.childCount } : {}),
      ...(element.text ? { text: element.text.slice(0, 80) } : {}),
    }));

  const rankedIds = ranked.map((element) => element.id);
  const validIds = rankedIds.slice(0, MAX_PROMPT_TARGET_IDS);
  const warnings: string[] = [];
  if (details.length < scene.elements.length) {
    warnings.push(
      `Scene context abbreviated in the prompt: ${details.length} of ${scene.elements.length} elements detailed.`,
    );
  }
  if (validIds.length < scene.elements.length) {
    warnings.push(
      `Target list abbreviated in the prompt: ${validIds.length} of ${scene.elements.length} IDs shown.`,
    );
  }

  const payload = {
    assetId: scene.assetId,
    filename: scene.filename,
    viewBox: scene.viewBox,
    counts: {
      elements: scene.elementCount,
      animatable: scene.animatableCount,
      contextTruncated: scene.truncated,
    },
    elements: detailElements,
  };

  return { text: JSON.stringify(payload), validIds, warnings };
}

function compactCharacter(request: AnimationDirectionRequest): {
  text: string;
  validIds: string[];
  warnings: string[];
} {
  const character = request.character;
  if (!character) return { text: "none", validIds: [], warnings: [] };

  const warnings: string[] = [];
  const validIds: string[] = [];

  // Group bones by actor
  const bonesByActor = new Map<string, typeof character.bones>();
  for (const bone of character.bones) {
    const list = bonesByActor.get(bone.actorId) ?? [];
    list.push(bone);
    bonesByActor.set(bone.actorId, list);
    validIds.push(`${bone.actorId}:${bone.boneId}`);
  }

  const compactedActors = character.actors.map((actor) => {
    const allBones = bonesByActor.get(actor.id) ?? [];
    const keptBones = allBones.slice(0, MAX_BONES_PER_ACTOR);
    if (keptBones.length < allBones.length) {
      warnings.push(
        `Actor "${actor.id}" bones abbreviated: ${keptBones.length} of ${allBones.length} shown.`,
      );
    }
    return {
      id: actor.id,
      name: actor.name,
      species: actor.species,
      bodyPlan: actor.bodyPlan,
      summary: actor.summary,
      palette: actor.palette,
      accessories: actor.accessories,
      bones: keptBones.map((b) => ({
        id: b.boneId,
        role: b.role,
        parent: b.parent,
        rotLimit: [round(b.rotationLimit?.min ?? -180), round(b.rotationLimit?.max ?? 180)],
        scaleLimit: [round(b.scaleLimit?.min ?? 0.5), round(b.scaleLimit?.max ?? 1.5)],
        ...(b.note ? { note: b.note.slice(0, 100) } : {}),
      })),
    };
  });

  const objects = (character.objects ?? []).map((obj) => {
    validIds.push(obj.id);
    return {
      id: obj.id,
      kind: obj.kind,
      label: obj.label,
      stageCoords720: [round(obj.x), round(obj.y)],
      scale: obj.scale,
      rotation: obj.rotation,
    };
  });

  const payload = {
    styleId: character.styleId,
    world: character.world,
    actors: compactedActors,
    objects,
    notes: character.notes.slice(0, 8),
  };

  return {
    text: JSON.stringify(payload),
    validIds,
    warnings,
  };
}

function compactHistory(request: AnimationDirectionRequest): {
  text: string;
  used: number;
} {
  const messages = (request.history ?? []).slice(-MAX_HISTORY_MESSAGES);
  if (messages.length === 0) return { text: "none", used: 0 };

  const selected: string[] = [];
  let remaining = MAX_HISTORY_CHARS;

  for (let index = messages.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const message = messages[index];
    const label = message.role === "user" ? "USER" : "DIRECTOR";
    const content = message.content.trim().slice(0, MAX_HISTORY_MESSAGE_CHARS);
    const line = `${label}: ${content}`;
    if (line.length > remaining) {
      if (remaining > 40) selected.unshift(`${line.slice(0, remaining - 1)}…`);
      remaining = 0;
      break;
    }
    selected.unshift(line);
    remaining -= line.length + 1;
  }
  return { text: selected.join("\n"), used: selected.length };
}

function stripTrackForPrompt(track: MotionTrack): MotionTrack {
  return {
    ...track,
    ...(track.label ? { label: track.label.slice(0, 100) } : {}),
  };
}

export function trimDocumentForPrompt(
  document: MotionDocument,
  maxChars = DOCUMENT_BUDGET,
): { json: string; omittedTrackIds: string[]; truncated: boolean } {
  const summary =
    typeof document.meta?.summary === "string"
      ? document.meta.summary.slice(0, 240)
      : undefined;
  const core = {
    version: document.version,
    id: document.id,
    name: document.name.slice(0, 120),
    targetKind: document.targetKind,
    duration: document.duration,
    fps: document.fps,
    loop: document.loop,
    ...(summary ? { meta: { summary } } : {}),
  };

  const withMeta = { ...core, tracks: document.tracks.map(stripTrackForPrompt) };
  const full = JSON.stringify(withMeta);
  if (full.length <= maxChars && !document.groups?.length) {
    return { json: full, omittedTrackIds: [], truncated: false };
  }

  const kept: MotionTrack[] = [];
  const omittedTrackIds: string[] = [];
  for (const track of document.tracks) {
    const candidate = JSON.stringify({
      ...core,
      tracks: [...kept, stripTrackForPrompt(track)],
    });
    if (candidate.length <= maxChars) {
      kept.push(stripTrackForPrompt(track));
    } else {
      omittedTrackIds.push(track.id);
    }
  }

  const groups: NonNullable<MotionDocument["groups"]> = [];
  if (kept.length === 0 && document.groups && document.groups.length > 0) {
    for (const group of document.groups) {
      const candidate = JSON.stringify({ ...core, tracks: kept, groups: [...groups, group] });
      if (candidate.length <= maxChars) {
        groups.push(group);
      } else {
        break;
      }
    }
  }

  const json = JSON.stringify({
    ...core,
    tracks: kept,
    ...(groups.length > 0 ? { groups } : {}),
  });
  if (json.length <= maxChars) {
    return {
      json,
      omittedTrackIds,
      truncated: omittedTrackIds.length > 0,
    };
  }

  const minimal = {
    version: document.version,
    id: document.id,
    name: "ANI motion",
    targetKind: document.targetKind,
    duration: document.duration,
    fps: document.fps,
    loop: document.loop,
    tracks: [],
  };
  return {
    json: JSON.stringify(minimal),
    omittedTrackIds: document.tracks.map((track) => track.id),
    truncated: true,
  };
}

function formatStyle(request: AnimationDirectionRequest): string {
  const profile = request.styleProfile;
  if (!profile) return "none";
  const constraints = profile.constraints.slice(0, 8).join("; ");
  return `${profile.name} — ${profile.description.slice(0, 400)}${
    constraints ? ` Constraints: ${constraints}` : ""
  }`;
}

export type PromptBundle = {
  systemPrompt: string;
  userPrompt: string;
  warnings: string[];
};

/**
 * Compact system prompt for the local Gemini CLI. The full prompt is ~26KB and
 * takes minutes through a CLI wrapper. This keeps the same declarative
 * contract, validation rules and primitive language in a much smaller payload.
 * Hosted/gateway providers use MOTION_DSL_SYSTEM_PROMPT.
 */
export const COMPACT_MOTION_PROMPT = `You are ANI's motion director. Return ONE JSON object, no markdown, no commentary:
{"document": <MotionDocument>, "explanation": "<max 300 chars, factual>"}

MotionDocument:
{
 "version":1, "id":"anim_<slug>", "name":"<short title>",
 "targetKind":"character"|"svg", "duration":<1..8 seconds>, "fps":60,
 "loop":{"enabled":<bool>,"mode":"restart"},
 "tracks":[Track], "meta":{"summary":"<one sentence>"}
}

Track:
{
 "id":"<unique>",
 "target":{"kind":"character","actorId":"<real>","boneId":"<real>"}
        |{"kind":"object","objectId":"<real>"}
        |{"kind":"svg","elementId":"<real>"},
 "property":"<property>",
 "keyframes":[{"at":<0..1>,"value":<number|hex color>,"easing":"<optional>"}],
 "delay":<seconds optional>, "duration":<seconds optional>,
 "easing":"<optional>", "label":"start: ... -> end: ..."
}

CHARACTER PROPERTIES
- Bones: translateX, translateY (root bone ONLY), rotate (degrees), scale, scaleX, scaleY.
- Face properties target the actor's HEAD bone: faceBlink 0..1, faceLookX -1..1,
  faceLookY -1..1, faceMouth 0..1, faceWink 0..1, faceCheek 0..1,
  faceExpression integer 0 neutral, 1 happy, 2 surprised, 3 thinking, 4 shy,
  5 laugh, 6 sleepy, 7 wink.
- Root translateX/Y are skeleton units, +Y is DOWN. A humanoid is 120-180 units tall.
- scale values multiply 1; rotate is a LOCAL joint delta in degrees.
- Objects: translateX, translateY, rotate, scale, scaleX, scaleY, opacity, fill,
  stroke. Object units are 720x720 stage pixels, +Y DOWN.
- A character document may mix character + object tracks. Never emit SVG targets.
- Use only actorId/boneId/objectId values listed in the request context.

SVG PROPERTIES
- translateX, translateY (user units), rotate, scale/scaleX/scaleY, opacity,
  fill, stroke, strokeWidth, strokeDraw (0..1), motionPath (0..1 + path).
- Use only elementId values listed. Stagger groups are allowed for repeated
  leaves/petals/stars. Never target defs/gradients.

KEYFRAMES
- at is normalized 0..1 inside the track window, strictly ascending, first 0, last 1.
- delay + duration must fit inside document duration.
- Easings: linear, easeIn, easeOut, easeInOut, backIn, backOut, backInOut,
  spring, springSoft, springBouncy.
- Multiple tracks may target the same property; values compose deterministically.
  Prefer distinct time windows for sequential beats.

COMPOSE, DO NOT RECITE PRESETS
- anticipation (small opposite move) -> primary action -> overshoot -> settle.
- add follow-through on child joints and secondary motion on ears/tail/cloth.
- squash/stretch around impacts; keep the character grounded unless asked to jump.
- Revisions: return ONLY the tracks you add or modify (same target ids). The
  server automatically restores every unrelated baseline track. Do not repeat
  unchanged tracks and do not regenerate the whole performance.
- 6-20 tracks is typical; max 40. loop.enabled false unless explicitly asked.
- explanation must only describe the motion actually produced.

EXAMPLE (illustrative ids)
{"document":{"version":1,"id":"anim_astro_catch","name":"Astronaut catches a star","targetKind":"character","duration":4,"fps":60,"loop":{"enabled":false,"mode":"restart"},"tracks":[{"id":"look-up","target":{"kind":"character","actorId":"hero","boneId":"head"},"property":"rotate","delay":0,"duration":1.2,"easing":"easeInOut","keyframes":[{"at":0,"value":0},{"at":0.5,"value":-22},{"at":1,"value":-22}],"label":"start: look -> end: spot the star"},{"id":"surprise","target":{"kind":"character","actorId":"hero","boneId":"head"},"property":"faceExpression","delay":0.8,"duration":0.6,"keyframes":[{"at":0,"value":0},{"at":0.6,"value":2},{"at":1,"value":2}],"label":"surprise"},{"id":"jump","target":{"kind":"character","actorId":"hero","boneId":"root"},"property":"translateY","delay":1.2,"duration":1.4,"easing":"easeInOut","keyframes":[{"at":0,"value":0},{"at":0.15,"value":10},{"at":0.5,"value":-85,"easing":"quadOut"},{"at":0.85,"value":6},{"at":1,"value":0}],"label":"crouch -> jump -> land"},{"id":"squash","target":{"kind":"character","actorId":"hero","boneId":"root"},"property":"scaleY","delay":1.2,"duration":1.4,"easing":"easeInOut","keyframes":[{"at":0,"value":1},{"at":0.15,"value":0.92},{"at":0.5,"value":1.06},{"at":0.85,"value":0.96},{"at":1,"value":1}],"label":"squash and stretch"},{"id":"catch-star","target":{"kind":"object","objectId":"star"},"property":"translateY","delay":2.1,"duration":1.0,"easing":"easeIn","keyframes":[{"at":0,"value":0},{"at":1,"value":-90}],"label":"star drops into hand"},{"id":"wave","target":{"kind":"character","actorId":"hero","boneId":"armR"},"property":"rotate","delay":3.0,"duration":1.0,"easing":"easeInOut","keyframes":[{"at":0,"value":0},{"at":0.3,"value":-100},{"at":0.6,"value":-80},{"at":1,"value":0}],"label":"wave"}],"meta":{"summary":"Looks up, gasps, jumps, catches the star, lands and waves."}},"explanation":"Kiran looks up, reacts with surprise, jumps to catch the star with squash-and-stretch, then waves."}`;

function compactTrackSummary(document: MotionDocument): string {
  return document.tracks
    .map((track) => {
      const target =
        track.target.kind === "character"
          ? `${track.target.actorId}.${track.target.boneId}`
          : track.target.kind === "object"
            ? track.target.objectId
            : track.target.elementId;
      const delay = track.delay ?? 0;
      const duration = track.duration ?? Math.max(0, document.duration - delay);
      const values = track.keyframes
        .slice(0, 8)
        .map((keyframe) => `${keyframe.at}:${String(keyframe.value)}`)
        .join(",");
      return `- ${track.id} | ${target} | ${track.property} | ${delay.toFixed(2)}-${(delay + duration).toFixed(2)}s | ${values}`;
    })
    .join("\n");
}

export function buildPrompts(
  request: AnimationDirectionRequest,
  options?: { compact?: boolean },
): PromptBundle {
  const warnings: string[] = [];
  const targetKind = request.targetKind;
  const targetContext =
    targetKind === "svg" ? compactScene(request) : compactCharacter(request);
  warnings.push(...targetContext.warnings);

  const validIds = collectTargetIds(request);
  const shownIds = targetContext.validIds;
  if (shownIds.length < validIds.length) {
    warnings.push(
      `Valid target IDs shown: ${shownIds.length} of ${validIds.length}. Only listed IDs may be targeted.`,
    );
  }

  const history = compactHistory(request);
  const selectedElements = request.selectedElementIds ?? [];
  const selectedObjects = request.selectedObjectIds ?? [];
  const lines: string[] = [
    `ACTION: ${request.action}`,
    `TARGET KIND: ${targetKind}`,
    "INSTRUCTION:",
    request.instruction,
    "",
    `STYLE PROFILE: ${formatStyle(request)}`,
    "",
    `SELECTED ELEMENTS: ${selectedElements.length > 0 ? selectedElements.join(", ") : "none"}`,
    `SELECTED OBJECTS: ${selectedObjects.length > 0 ? selectedObjects.join(", ") : "none"}`,
    "",
    `${targetKind === "svg" ? "SCENE CONTEXT" : "CHARACTER CONTEXT"}:`,
    targetContext.text,
    "",
    `VALID TARGET IDS (only these may be used; ${shownIds.length} shown):`,
    shownIds.join(", "),
  ];

  if (request.action === "revise" && request.currentDocument) {
    if (options?.compact) {
      lines.push(
        "",
        `CURRENT TRACKS (${request.currentDocument.tracks.length}; id | target | property | window | at:value):`,
        compactTrackSummary(request.currentDocument),
        "",
        "REVISION OUTPUT: return a document containing ONLY the tracks you add or modify. The server restores all other tracks automatically.",
      );
    } else {
      const trimmed = trimDocumentForPrompt(request.currentDocument);
      lines.push(
        "",
        `CURRENT DOCUMENT (revision baseline; ${trimmed.truncated ? "prompt copy trimmed" : "complete"}):`,
        trimmed.json,
      );
    if (trimmed.omittedTrackIds.length > 0) {
      const listed = trimmed.omittedTrackIds.slice(0, 24).join(", ");
      lines.push(
        "",
        `BASELINE TRACKS OMITTED FROM THIS PROMPT (${trimmed.omittedTrackIds.length}): ${listed}${
          trimmed.omittedTrackIds.length > 24 ? ", …" : ""
        }`,
        "Preserve unrelated tracks even if they are not visible here. The server restores missing unrelated tracks after your response.",
      );
      warnings.push(
        `Current document prompt trimmed: ${trimmed.omittedTrackIds.length} track(s) omitted. The server preserves unrelated tracks.`,
      );
    }
      lines.push(
        "",
        "REVISION RULE: Return the full document. Preserve every track unrelated to this instruction with the same id, target, property and keyframes. Do not regenerate the whole animation unless the instruction explicitly asks to start over.",
      );
    }
  }

  lines.push(
    "",
    "RECENT HISTORY (oldest to newest):",
    history.text,
    "",
    "TASK:",
    request.action === "revise"
      ? "Apply exactly the requested revision while preserving unrelated tracks. Return the JSON envelope only."
      : "Create the animation described by the instruction. Return the JSON envelope only.",
  );

  return {
    systemPrompt: options?.compact ? COMPACT_MOTION_PROMPT : MOTION_DSL_SYSTEM_PROMPT,
    userPrompt: lines.join("\n"),
    warnings,
  };
}
