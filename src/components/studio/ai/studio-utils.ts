/**
 * Pure helpers for the generative studio UI.
 *
 * Kept free of React and DOM access at module scope so they can be unit tested
 * in the node environment (`tests/ui/studio-utils.test.ts`).
 */

import type { MotionDocument, MotionSource } from "@/lib/animation/types";
import type { TrackChangeSet } from "@/lib/ai/contracts";
import type { BBox, ViewBox } from "@/lib/svg/types";

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Compact clock used in the transport and timeline: `0:03.2`. */
export function formatClock(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const whole = Math.floor(safe);
  const tenths = Math.floor((safe - whole) * 10 + 1e-6);
  const minutes = Math.floor(whole / 60);
  const remainder = whole % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}.${tenths}`;
}

/** Seconds rounded to one decimal, used in labels. */
export function formatSeconds(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  return `${safe.toFixed(1)}s`;
}

export function formatBytesShort(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const TICK_STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60] as const;

/** Pick a readable ruler step for roughly five labels across the duration. */
export function chooseTickSeconds(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 1;
  const target = duration / 5;
  for (const step of TICK_STEPS) {
    if (step >= target) return step;
  }
  return 60;
}

function tickLabel(seconds: number, step: number): string {
  if (step < 1) return `${seconds.toFixed(1)}s`;
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.round(seconds % 60);
    return `${minutes}:${String(remainder).padStart(2, "0")}`;
  }
  return `${Math.round(seconds)}s`;
}

export type TimeTick = { time: number; label: string };

export function buildTimeTicks(duration: number): TimeTick[] {
  if (!Number.isFinite(duration) || duration <= 0) return [];
  const step = chooseTickSeconds(duration);
  const ticks: TimeTick[] = [];
  for (let time = 0, guard = 0; time <= duration + 1e-9 && guard < 200; time += step) {
    ticks.push({ time, label: tickLabel(time, step) });
    guard += 1;
  }
  return ticks;
}

export function timePercent(seconds: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return clamp(seconds / duration, 0, 1) * 100;
}

/** Absolute time of a normalized keyframe inside a track window. */
export function absoluteKeyframeSeconds(
  window: { start: number; duration: number },
  at: number,
): number {
  const safeStart = Number.isFinite(window.start) ? window.start : 0;
  const safeDuration =
    Number.isFinite(window.duration) && window.duration > 0 ? window.duration : 0;
  return safeStart + clamp(at, 0, 1) * safeDuration;
}

export function changedTrackCount(changes: TrackChangeSet): number {
  return changes.added.length + changes.removed.length + changes.modified.length;
}

export function summarizeChanges(changes: TrackChangeSet): string {
  const parts: string[] = [];
  if (changes.added.length) {
    parts.push(`${changes.added.length} added`);
  }
  if (changes.removed.length) {
    parts.push(`${changes.removed.length} removed`);
  }
  if (changes.modified.length) {
    parts.push(`${changes.modified.length} modified`);
  }
  return parts.length ? parts.join(" · ") : "No track changes";
}

export function revisionSourceLabel(source: MotionSource): string {
  switch (source) {
    case "ai":
      return "Hosted AI";
    case "fallback":
      return "Local fallback";
    case "preset":
      return "Preset";
    case "manual":
      return "Manual";
    default:
      return "Unknown source";
  }
}

/** Drop hidden tracks for consumers (mascot adapter) that cannot mute in place. */
export function filterDocumentTracks(
  document: MotionDocument,
  hiddenTrackIds: Iterable<string>,
): MotionDocument {
  const hidden = new Set(hiddenTrackIds);
  if (!hidden.size) return document;
  const tracks = document.tracks.filter((track) => !hidden.has(track.id));
  if (tracks.length === document.tracks.length) return document;
  return { ...document, tracks };
}

export function safeFilename(name: string, fallback = "animation"): string {
  const cleaned = (name || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80);
  return cleaned || fallback;
}

export function formatBbox(bbox: BBox): string {
  const number = (value: number) =>
    Number.isFinite(value) ? value.toFixed(1) : "?";
  return `${number(bbox.x)}, ${number(bbox.y)} · ${number(bbox.w)}×${number(bbox.h)}`;
}

export function formatViewBox(viewBox: ViewBox): string {
  const number = (value: number) =>
    Number.isFinite(value) ? Number(value.toFixed(2)) : 0;
  return `${number(viewBox.minX)} ${number(viewBox.minY)} ${number(
    viewBox.width,
  )} ${number(viewBox.height)}`;
}

export type TreeGraphLike = {
  rootIds: readonly string[];
  elements: Record<string, { id: string; childIds: readonly string[] }>;
};

export type FlatTreeRow = { id: string; depth: number; zIndex: number };

/**
 * Flatten the scene graph in paint order, stopping at collapsed groups.
 * `zIndex` is the sibling position (paint order), not the global pre-order.
 */
export function flattenVisibleElements(
  graph: TreeGraphLike,
  expanded: ReadonlySet<string>,
): FlatTreeRow[] {
  const rows: FlatTreeRow[] = [];
  const visited = new Set<string>();

  const visit = (id: string, depth: number, zIndex: number) => {
    if (visited.has(id)) return;
    const element = graph.elements[id];
    if (!element) return;
    visited.add(id);
    rows.push({ id, depth, zIndex });
    if (!expanded.has(id)) return;
    element.childIds.forEach((childId, index) => {
      visit(childId, depth + 1, index);
    });
  };

  graph.rootIds.forEach((id, index) => visit(id, 0, index));
  return rows;
}

export function downloadTextFile(
  filename: string,
  contents: string,
  mimeType: string,
): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
