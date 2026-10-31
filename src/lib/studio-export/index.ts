/**
 * Browser export helpers. The native project JSON is the canonical lossless
 * format; SVG/PNG/WebM are derivative outputs.
 */

import type { AniProject } from "@/lib/studio/contracts";
import { PROJECT_SCHEMA_VERSION } from "@/lib/studio/contracts";

export function safeFilename(name: string, fallback = "ani-project"): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return cleaned || fallback;
}

export function projectToJson(project: AniProject): string {
  return JSON.stringify(project, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parse a project file with a minimal shape check. Throws a readable error. */
export function parseProjectJson(text: string): AniProject {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  if (!isRecord(raw)) throw new Error("The project file must be a JSON object.");
  if (raw.schemaVersion !== PROJECT_SCHEMA_VERSION) {
    throw new Error(`Unsupported project schema version: ${String(raw.schemaVersion)}.`);
  }
  if (typeof raw.id !== "string" || typeof raw.name !== "string") {
    throw new Error("The project file is missing an id or name.");
  }
  if (!isRecord(raw.source) || !isRecord(raw.motion)) {
    throw new Error("The project file is missing its source or motion document.");
  }
  return raw as unknown as AniProject;
}

export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a turn to start the download before revoking.
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadText(text: string, filename: string, type = "application/json"): void {
  downloadBlob(new Blob([text], { type }), filename);
}

export function downloadProject(project: AniProject): void {
  downloadText(
    projectToJson(project),
    `${safeFilename(project.name)}.ani.json`,
    "application/json",
  );
}

/** Serialize a live stage SVG, preserving inline attributes and styles. */
export function serializeStageSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
}

function svgToDataUrl(markup: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

async function loadSvgImage(markup: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = "sync";
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("The SVG could not be rasterized."));
  });
  image.src = svgToDataUrl(markup);
  await loaded;
  return image;
}

export async function svgMarkupToPng(
  markup: string,
  width = 1080,
  height = 1080,
  background = "#FEFDF9",
): Promise<Blob> {
  if (typeof document === "undefined") throw new Error("PNG export runs in the browser.");
  const image = await loadSvgImage(markup);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable in this browser.");
  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(image, 0, 0, width, height);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The browser could not encode the PNG."));
    }, "image/png");
  });
}

export function downloadPng(blob: Blob, name: string): void {
  downloadBlob(blob, `${safeFilename(name)}.png`);
}

export function downloadSvgMarkup(markup: string, name: string): void {
  downloadText(markup, `${safeFilename(name)}.svg`, "image/svg+xml");
}

export type WebMFrameRenderer = (time: number) => SVGSVGElement | null;

export type WebMExportOptions = {
  duration: number;
  fps?: number;
  width?: number;
  height?: number;
  background?: string;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
};

/**
 * Rasterize deterministic frames and record them with MediaRecorder. This is
 * intentionally bounded (max 20s, max 30fps) so a demo export cannot freeze the
 * browser. Returns a WebM blob; callers must handle unsupported browsers.
 */
export async function renderWebM(
  renderFrame: WebMFrameRenderer,
  options: WebMExportOptions,
): Promise<Blob> {
  if (typeof document === "undefined") throw new Error("WebM export runs in the browser.");
  if (typeof MediaRecorder === "undefined") {
    throw new Error("This browser does not support WebM recording.");
  }
  const duration = Math.max(0.2, Math.min(20, options.duration));
  const fps = Math.max(12, Math.min(30, Math.round(options.fps ?? 30)));
  const width = options.width ?? 1080;
  const height = options.height ?? 1080;
  const background = options.background ?? "#FEFDF9";
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable in this browser.");

  const stream = canvas.captureStream(fps);
  const preferred = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ].find((type) => MediaRecorder.isTypeSupported(type));
  const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  recorder.start(120);
  const frames = Math.max(1, Math.round(duration * fps));
  try {
    for (let index = 0; index <= frames; index++) {
      if (options.signal?.aborted) throw new Error("Export cancelled.");
      const time = (index / frames) * duration;
      const svg = renderFrame(time);
      if (svg) {
        const markup = serializeStageSvg(svg);
        const image = await loadSvgImage(markup);
        context.fillStyle = background;
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
      }
      options.onProgress?.(index / frames);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  } finally {
    recorder.stop();
    await stopped;
  }

  return new Blob(chunks, { type: recorder.mimeType || "video/webm" });
}

export function downloadWebM(blob: Blob, name: string): void {
  downloadBlob(blob, `${safeFilename(name)}.webm`);
}
