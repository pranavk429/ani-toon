/**
 * Safe SVG source parsing.
 *
 * Everything in this module treats the uploaded document as hostile. Limits are
 * checked before the XML parser runs where possible, and failures are returned
 * as data instead of thrown exceptions.
 */

import { DOMParser } from "@xmldom/xmldom";
import type { Document as XmlDocument, Element as XmlElement } from "@xmldom/xmldom";

import type { ImportFailure, ImportOptions } from "./types";

export const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
export const DEFAULT_MAX_ELEMENTS = 4_000;
export const DEFAULT_MAX_DEPTH = 32;

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export type ImportFailureResult = ImportFailure;

export type ParsedSvg = {
  ok: true;
  document: XmlDocument;
  root: XmlElement;
  bytes: number;
  warnings: string[];
};

export type ParseSvgResult = ParsedSvg | ImportFailureResult;

export type NormalizedLimits = {
  maxBytes: number;
  maxElements: number;
  maxDepth: number;
};

export function normalizeLimits(options: ImportOptions | undefined): NormalizedLimits {
  return {
    maxBytes: positiveInteger(options?.maxBytes, DEFAULT_MAX_BYTES),
    maxElements: positiveInteger(options?.maxElements, DEFAULT_MAX_ELEMENTS),
    maxDepth: positiveInteger(options?.maxDepth, DEFAULT_MAX_DEPTH),
  };
}

function positiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return fallback;
  return Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value)));
}

export function byteLength(source: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(source).length;
  }
  return source.length;
}

/**
 * Cheap UI hint. This is not a security decision: importSvg always sanitizes.
 * It also tolerates an XML declaration, BOM, comments and processing
 * instructions before the root element.
 */
export function looksLikeSvg(source: string): boolean {
  if (typeof source !== "string") return false;
  let cursor = 0;
  if (source.charCodeAt(0) === 0xfeff) cursor = 1;
  for (;;) {
    while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
    if (source.startsWith("<!--", cursor)) {
      const end = source.indexOf("-->", cursor + 4);
      if (end === -1) return false;
      cursor = end + 3;
      continue;
    }
    if (source.startsWith("<?", cursor)) {
      const end = source.indexOf("?>", cursor + 2);
      if (end === -1) return false;
      cursor = end + 2;
      continue;
    }
    break;
  }
  return /^<(?:[A-Za-z_][\w.-]*:)?svg(?:\s|>|\/)/i.test(source.slice(cursor));
}

function stripNonMarkup(source: string): string {
  // Comments and CDATA sections are inert. Removing them prevents harmless
  // text like "<!-- <!DOCTYPE -->" from being treated as a declaration.
  return source
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!--[\s\S]*$/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "")
    .replace(/<!\[CDATA\[[\s\S]*$/g, "")
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<\?[\s\S]*$/g, "");
}

function containsUnsafeDeclaration(source: string): boolean {
  const probe = stripNonMarkup(source);
  return /<!DOCTYPE\b|<!ENTITY\b/i.test(probe);
}

function normalizeTagName(element: XmlElement): string {
  const raw = element.localName ?? element.tagName ?? "";
  const colon = raw.indexOf(":");
  return (colon >= 0 ? raw.slice(colon + 1) : raw).toLowerCase();
}

type LexicalScan = {
  elementCount: number;
  maxDepth: number;
};

/**
 * Count start tags and maximum nesting without a DOM. This is a resource guard
 * that runs before xmldom can recurse into a hostile tree.
 */
function scanMarkupDepth(source: string): LexicalScan {
  let index = 0;
  let depth = 0;
  let maxDepth = 0;
  let elementCount = 0;

  while (index < source.length) {
    const open = source.indexOf("<", index);
    if (open === -1) break;

    if (source.startsWith("<!--", open)) {
      const end = source.indexOf("-->", open + 4);
      if (end === -1) break;
      index = end + 3;
      continue;
    }
    if (source.startsWith("<![CDATA[", open)) {
      const end = source.indexOf("]]>", open + 9);
      if (end === -1) break;
      index = end + 3;
      continue;
    }
    if (source.startsWith("<?", open)) {
      const end = source.indexOf("?>", open + 2);
      if (end === -1) break;
      index = end + 2;
      continue;
    }
    if (source.startsWith("<!", open)) {
      const end = source.indexOf(">", open + 2);
      if (end === -1) break;
      index = end + 1;
      continue;
    }

    // Find the closing angle bracket, ignoring ">" inside quoted values.
    let cursor = open + 1;
    let quote: string | null = null;
    let closed = -1;
    for (; cursor < source.length; cursor += 1) {
      const character = source[cursor];
      if (quote) {
        if (character === quote) quote = null;
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === ">") {
        closed = cursor;
        break;
      }
    }
    if (closed === -1) break;

    if (source[open + 1] === "/") {
      depth = Math.max(0, depth - 1);
      index = closed + 1;
      continue;
    }

    const selfClosing = source[closed - 1] === "/";
    elementCount += 1;
    if (!selfClosing) {
      depth += 1;
      if (depth > maxDepth) maxDepth = depth;
    }
    index = closed + 1;
  }

  return { elementCount, maxDepth };
}

function failure(
  code: ImportFailure["error"]["code"],
  message: string,
  warnings: string[] = [],
): ImportFailureResult {
  return { ok: false, error: { code, message }, warnings };
}

function shorten(message: string, maxLength = 240): string {
  const singleLine = message.replace(/\s+/g, " ").trim();
  return singleLine.length > maxLength ? `${singleLine.slice(0, maxLength - 1)}…` : singleLine;
}

/** Parse an SVG string under the frozen import limits. Never throws for input. */
export function parseSvgSource(source: string, options?: ImportOptions): ParseSvgResult {
  if (typeof source !== "string") {
    return failure("empty", "The SVG source is empty.");
  }

  const withoutBom = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  if (withoutBom.trim() === "") {
    return failure("empty", "The SVG source is empty.");
  }

  const limits = normalizeLimits(options);
  const bytes = byteLength(source);
  if (bytes > limits.maxBytes) {
    return failure(
      "too_large",
      `SVG is larger than the ${limits.maxBytes} byte import limit.`,
    );
  }

  if (containsUnsafeDeclaration(withoutBom)) {
    return failure(
      "unsafe_markup",
      "DOCTYPE and entity declarations are not allowed in imported SVG.",
    );
  }

  const lexical = scanMarkupDepth(withoutBom);
  if (lexical.elementCount > limits.maxElements) {
    return failure(
      "too_many_elements",
      `SVG contains more than ${limits.maxElements} elements.`,
    );
  }
  if (lexical.maxDepth > limits.maxDepth + 1) {
    return failure("too_deep", `SVG nesting exceeds ${limits.maxDepth} levels.`);
  }

  const parseMessages: string[] = [];
  let document: XmlDocument;
  try {
    const parser = new DOMParser({
      onError(level, message) {
        if (level !== "warning") {
          parseMessages.push(shorten(message, 160));
        }
      },
    });
    document = parser.parseFromString(withoutBom, "image/svg+xml");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown XML parse error";
    return failure("invalid_xml", "The SVG is not well-formed XML.", [shorten(message)]);
  }

  const root = document.documentElement;
  if (!root) {
    return failure("invalid_xml", "The SVG has no root element.", parseMessages);
  }

  if (normalizeTagName(root) !== "svg") {
    return failure("not_svg", "The root element is not <svg>.", parseMessages);
  }

  const namespace = root.namespaceURI;
  if (namespace && namespace !== SVG_NAMESPACE) {
    return failure("not_svg", "The root element is not in the SVG namespace.", parseMessages);
  }

  // Re-count on the real tree in case the lexical scan was fooled by malformed
  // markup that the parser recovered from.
  const counted = countElementsAndDepth(root);
  if (counted.count > limits.maxElements) {
    return failure(
      "too_many_elements",
      `SVG contains more than ${limits.maxElements} elements.`,
      parseMessages,
    );
  }
  if (counted.maxDepth > limits.maxDepth) {
    return failure("too_deep", `SVG nesting exceeds ${limits.maxDepth} levels.`, parseMessages);
  }

  if (parseMessages.length > 0) {
    return failure("invalid_xml", "The SVG contains malformed XML.", parseMessages);
  }

  return { ok: true, document, root, bytes, warnings: [] };
}

function countElementsAndDepth(root: XmlElement): { count: number; maxDepth: number } {
  let count = 0;
  let maxDepth = 0;
  const stack: Array<{ element: XmlElement; depth: number }> = [{ element: root, depth: 0 }];

  while (stack.length > 0) {
    const item = stack.pop();
    if (!item) break;
    count += 1;
    if (item.depth > maxDepth) maxDepth = item.depth;

    for (let index = item.element.childNodes.length - 1; index >= 0; index -= 1) {
      const child = item.element.childNodes.item(index);
      if (child && child.nodeType === 1) {
        stack.push({ element: child as XmlElement, depth: item.depth + 1 });
      }
    }
  }

  return { count, maxDepth };
}
