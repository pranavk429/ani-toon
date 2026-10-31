/**
 * Public SVG intelligence API.
 *
 * `importSvg` is total for user input: it returns an ImportFailure instead of
 * throwing. The sanitized serialization is the only SVG that should ever be
 * rendered by the studio.
 */

import { parseTransform } from "./geometry";
import { looksLikeSvg, parseSvgSource } from "./parse";
import { sanitizeSvg } from "./sanitize";
import { buildSceneGraph, sceneToContext } from "./scene";
import { getSceneAncestors, getSceneChildren, getSceneElement } from "./scene";
import type { ImportOptions, ImportResult, SceneGraph } from "./types";

export * from "./types";

export { parseTransform };
export { looksLikeSvg };
export { getSceneAncestors, getSceneChildren, getSceneElement, sceneToContext };

function now(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function failure(message: string, warnings: string[] = []): ImportResult {
  return {
    ok: false,
    error: { code: "invalid_xml", message },
    warnings,
  };
}

/**
 * Import, sanitize and analyze an uploaded SVG.
 *
 * Security limits are enforced before parsing (doctype/entity rejection, byte
 * count, element count and nesting depth). All failures are returned as data.
 */
export function importSvg(source: string, options?: ImportOptions): ImportResult {
  const started = now();

  try {
    const parsed = parseSvgSource(source, options);
    if (!parsed.ok) return parsed;

    const sanitized = sanitizeSvg(parsed.root);
    const result = buildSceneGraph({
      sanitized,
      sourceBytes: parsed.bytes,
      durationMs: now() - started,
      filename: options?.filename,
    });

    if (result.ok) {
      result.graph.stats.durationMs = Math.round((now() - started) * 100) / 100;
    }
    return result;
  } catch {
    // User-controlled input must never surface as a thrown exception. The
    // specific parser/sanitizer reason is intentionally not echoed here.
    return failure("The SVG could not be imported safely.");
  }
}

/**
 * Serialize a scene graph's safe SVG, or sanitize a raw SVG string.
 * Returns undefined when a raw string cannot be imported.
 */
export function serializeSvg(graph: SceneGraph): string;
export function serializeSvg(source: string, options?: ImportOptions): string | undefined;
export function serializeSvg(
  input: SceneGraph | string,
  options?: ImportOptions,
): string | undefined {
  if (typeof input !== "string") return input.sanitizedSvg;
  const result = importSvg(input, options);
  return result.ok ? result.graph.sanitizedSvg : undefined;
}
