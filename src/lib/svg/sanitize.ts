/**
 * Allowlist SVG sanitizer.
 *
 * The sanitizer mutates the parsed xmldom tree in place, assigns stable unique
 * ids, rewrites internal fragment references and finally serializes the safe
 * tree. It never evaluates SVG markup.
 */

import { XMLSerializer } from "@xmldom/xmldom";
import type { Element as XmlElement, Node as XmlNode } from "@xmldom/xmldom";

import { SUPPORTED_SVG_TAGS, type SupportedSvgTag } from "./types";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const CANONICAL_TAG_BY_LOWER = new Map<string, SupportedSvgTag>(
  SUPPORTED_SVG_TAGS.map((tag) => [tag.toLowerCase(), tag]),
);
const DEFINITION_TAGS = new Set<string>([
  "defs",
  "linearGradient",
  "radialGradient",
  "stop",
  "clipPath",
]);
const TEXT_CONTAINER_TAGS = new Set<string>(["text", "tspan"]);

const CORE_ATTRS = new Set<string>([
  "id",
  "transform",
  "d",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "width",
  "height",
  "points",
  "dx",
  "dy",
  "rotate",
  "viewBox",
  "preserveAspectRatio",
  "version",
  "pathLength",
  "gradientUnits",
  "gradientTransform",
  "spreadMethod",
  "fx",
  "fy",
  "fr",
  "offset",
  "clipPathUnits",
  "textLength",
  "lengthAdjust",
  "role",
  "aria-label",
  "data-name",
  "xml:space",
]);

const PRESENTATION_ATTRS = new Set<string>([
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-dasharray",
  "stroke-dashoffset",
  "opacity",
  "color",
  "display",
  "visibility",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "text-anchor",
  "dominant-baseline",
  "alignment-baseline",
  "baseline-shift",
  "letter-spacing",
  "word-spacing",
  "text-decoration",
  "font-variant",
  "font-stretch",
  "paint-order",
  "vector-effect",
  "shape-rendering",
  "text-rendering",
  "image-rendering",
  "color-rendering",
  "color-interpolation",
  "color-interpolation-filters",
  "pointer-events",
  "overflow",
  "clip-path",
  "clip-rule",
  "stop-color",
  "stop-opacity",
]);

const PAINT_ATTRS = new Set<string>(["fill", "stroke", "color", "stop-color"]);
const SAFE_STYLE_PROPERTIES = new Set<string>([
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "stroke-dashoffset",
  "opacity",
  "color",
  "display",
  "visibility",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "text-anchor",
  "dominant-baseline",
  "alignment-baseline",
  "baseline-shift",
  "letter-spacing",
  "word-spacing",
  "text-decoration",
  "font-variant",
  "font-stretch",
  "paint-order",
  "vector-effect",
  "shape-rendering",
  "text-rendering",
  "image-rendering",
  "color-rendering",
  "color-interpolation",
  "color-interpolation-filters",
  "pointer-events",
  "overflow",
  "clip-path",
  "clip-rule",
  "stop-color",
  "stop-opacity",
]);
const STYLE_PAINT_PROPERTIES = new Set<string>(["fill", "stroke", "color", "stop-color"]);

const SAFE_ID_RE = /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/;
const DATA_ATTRIBUTE_RE = /^data-[A-Za-z0-9_.:-]+$/;
const HREF_FRAGMENT_RE = /^#[^\s"'()<>]+$/;
const INTERNAL_URL_RE = /^url\(\s*['"]?#([^'"\s()<>]+)['"]?\s*\)$/i;
const URL_PREFIX_RE = /url\s*\(/i;

export type ElementMetadata = {
  authoredId?: string;
  originalId?: string;
  idAuthored: boolean;
  title?: string;
  ariaLabel?: string;
  dataName?: string;
  hints: Record<string, string>;
  isDefinition: boolean;
};

export type SanitizeResult = {
  root: XmlElement;
  metadata: WeakMap<XmlElement, ElementMetadata>;
  sanitizedSvg: string;
  warnings: string[];
  removedNodeCount: number;
  duplicateIdCount: number;
  title?: string;
};

type SanitizeStats = {
  removedNodes: number;
  removedNodeTags: Map<string, number>;
  removedAttributes: number;
  removedStyleDeclarations: number;
  unsafeIds: number;
};

export function isXmlElement(node: XmlNode | null | undefined): node is XmlElement {
  return Boolean(node && node.nodeType === 1);
}

export function rawTagName(element: XmlElement): string {
  const raw = element.localName ?? element.tagName ?? "";
  const colon = raw.indexOf(":");
  return (colon >= 0 ? raw.slice(colon + 1) : raw).toLowerCase();
}

export function canonicalSvgTag(element: XmlElement): SupportedSvgTag | null {
  return CANONICAL_TAG_BY_LOWER.get(rawTagName(element)) ?? null;
}

/**
 * xmldom 0.9 declares getAttributeNames() in its typings but does not implement
 * it at runtime, so read the attribute map directly.
 */
function attributeNames(element: XmlElement): string[] {
  const names: string[] = [];
  for (let index = 0; index < element.attributes.length; index += 1) {
    const attribute = element.attributes.item(index);
    if (attribute) names.push(attribute.name);
  }
  return names;
}

export function isDefinitionTag(tag: string | null): boolean {
  return tag !== null && DEFINITION_TAGS.has(tag);
}

/** Sanitize a complete parsed SVG tree and assign stable ids. */
export function sanitizeSvg(root: XmlElement): SanitizeResult {
  const metadata = new WeakMap<XmlElement, ElementMetadata>();
  const stats: SanitizeStats = {
    removedNodes: 0,
    removedNodeTags: new Map(),
    removedAttributes: 0,
    removedStyleDeclarations: 0,
    unsafeIds: 0,
  };

  cleanElement(root, true, false, metadata, stats);
  // The serialized document is always normalized into the SVG namespace.
  root.setAttribute("xmlns", SVG_NAMESPACE);

  const { duplicateIdCount, idMap } = assignStableIds(root, metadata, stats);
  rewriteFragmentReferences(root, idMap);

  const serializer = new XMLSerializer();
  const sanitizedSvg = serializer.serializeToString(root);
  const rootMetadata = metadata.get(root);

  return {
    root,
    metadata,
    sanitizedSvg,
    warnings: buildWarnings(stats, duplicateIdCount),
    removedNodeCount: stats.removedNodes,
    duplicateIdCount,
    title: rootMetadata?.title,
  };
}

function cleanElement(
  element: XmlElement,
  isRoot: boolean,
  isDefinition: boolean,
  metadata: WeakMap<XmlElement, ElementMetadata>,
  stats: SanitizeStats,
): void {
  captureMetadata(element, isDefinition, metadata);
  sanitizeAttributes(element, isRoot, stats);
  cleanChildren(element, isDefinition, metadata, stats);
}

function cleanChildren(
  container: XmlElement,
  isDefinition: boolean,
  metadata: WeakMap<XmlElement, ElementMetadata>,
  stats: SanitizeStats,
  textContainerOverride?: boolean,
): void {
  const containerTag = canonicalSvgTag(container);
  const isTextContainer =
    textContainerOverride ??
    (containerTag !== null && TEXT_CONTAINER_TAGS.has(containerTag));
  const children = Array.from(container.childNodes);

  for (const child of children) {
    if (isXmlElement(child)) {
      const tag = rawTagName(child);
      const canonical = canonicalSvgTag(child);

      if (!hasSvgNamespace(child)) {
        stats.removedNodes += countElementNodes(child);
        stats.removedNodeTags.set(tag, (stats.removedNodeTags.get(tag) ?? 0) + 1);
        container.removeChild(child);
        continue;
      }

      if (tag === "title" || tag === "desc" || tag === "metadata") {
        // Used as semantic input before this pass, never rendered.
        container.removeChild(child);
        continue;
      }

      if (canonical === null) {
        if (tag === "a") {
          unwrapAnchor(child, container, isDefinition, metadata, stats);
        } else {
          stats.removedNodes += countElementNodes(child);
          stats.removedNodeTags.set(tag, (stats.removedNodeTags.get(tag) ?? 0) + 1);
          container.removeChild(child);
        }
        continue;
      }

      const childIsDefinition = isDefinition || isDefinitionTag(canonical);
      cleanElement(child, false, childIsDefinition, metadata, stats);
      continue;
    }

    if (child.nodeType === 3) {
      if (!isTextContainer) container.removeChild(child);
      continue;
    }

    if (child.nodeType === 4) {
      if (!isTextContainer) {
        container.removeChild(child);
        continue;
      }
      const document = container.ownerDocument;
      if (document) {
        // Convert CDATA to an ordinary text node so the serializer escapes any
        // markup-looking text (`<script>`) instead of emitting it verbatim.
        const textNode = document.createTextNode(child.nodeValue ?? "");
        container.replaceChild(textNode, child);
      }
      continue;
    }

    // Comments, processing instructions and anything exotic are inert and are
    // removed from the render tree.
    container.removeChild(child);
  }
}

function unwrapAnchor(
  anchor: XmlElement,
  parent: XmlElement,
  isDefinition: boolean,
  metadata: WeakMap<XmlElement, ElementMetadata>,
  stats: SanitizeStats,
): void {
  const parentTag = canonicalSvgTag(parent);
  const parentIsTextContainer = parentTag !== null && TEXT_CONTAINER_TAGS.has(parentTag);
  cleanChildren(anchor, isDefinition, metadata, stats, parentIsTextContainer);
  const lifted = Array.from(anchor.childNodes);
  for (const child of lifted) {
    parent.insertBefore(child, anchor);
  }
  parent.removeChild(anchor);
  stats.removedNodes += 1;
  stats.removedNodeTags.set("a", (stats.removedNodeTags.get("a") ?? 0) + 1);
}

function hasSvgNamespace(element: XmlElement): boolean {
  const namespace = element.namespaceURI;
  return !namespace || namespace === SVG_NAMESPACE;
}

function countElementNodes(root: XmlElement): number {
  let count = 0;
  const stack: XmlElement[] = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) break;
    count += 1;
    for (let index = 0; index < current.childNodes.length; index += 1) {
      const child = current.childNodes.item(index);
      if (isXmlElement(child)) stack.push(child);
    }
  }
  return count;
}

function captureMetadata(
  element: XmlElement,
  isDefinition: boolean,
  metadata: WeakMap<XmlElement, ElementMetadata>,
): void {
  const rawId = element.getAttribute("id");
  const hints: Record<string, string> = {};
  let role: string | undefined;

  for (const name of attributeNames(element)) {
    const lower = name.toLowerCase();
    if (lower === "class") {
      const className = cleanLabel(element.getAttribute(name) ?? "", 120);
      if (className) hints.class = className;
      continue;
    }
    if (lower === "role") {
      role = cleanLabel(element.getAttribute(name) ?? "", 40);
      continue;
    }
    if (lower.startsWith("data-") && lower !== "data-name") {
      const value = cleanLabel(element.getAttribute(name) ?? "", 160);
      if (value) hints[name] = value;
    }
  }
  if (role) hints.role = role;

  metadata.set(element, {
    authoredId: rawId !== null && rawId !== "" ? rawId : undefined,
    idAuthored: false,
    title: directTitleText(element),
    ariaLabel: cleanLabel(element.getAttribute("aria-label") ?? "", 240),
    dataName: cleanLabel(element.getAttribute("data-name") ?? "", 160),
    hints,
    isDefinition,
  });
}

function directTitleText(element: XmlElement): string | undefined {
  for (let index = 0; index < element.childNodes.length; index += 1) {
    const child = element.childNodes.item(index);
    if (!isXmlElement(child)) continue;
    if (rawTagName(child) === "title") {
      const text = cleanLabel(child.textContent ?? "", 200);
      if (text) return text;
    }
  }
  return undefined;
}

function cleanLabel(value: string, maxLength: number): string | undefined {
  const cleaned = stripControlCharacters(value)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return cleaned === "" ? undefined : cleaned;
}

function stripControlCharacters(value: string): string {
  let result = "";
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code === 0x09 || code === 0x0a || code === 0x0d || code >= 0x20) {
      result += value[index];
    }
  }
  return result;
}

function sanitizeAttributes(element: XmlElement, isRoot: boolean, stats: SanitizeStats): void {
  let hrefValue: string | null = null;

  for (const name of attributeNames(element)) {
    const lower = name.toLowerCase();
    const value = element.getAttribute(name) ?? "";

    if (lower === "id") continue;

    if (lower === "style") {
      const result = sanitizeStyleAttribute(value);
      stats.removedStyleDeclarations += result.removed;
      if (result.value) element.setAttribute(name, result.value);
      else {
        element.removeAttribute(name);
        stats.removedAttributes += 1;
      }
      continue;
    }

    if (lower.startsWith("on")) {
      element.removeAttribute(name);
      stats.removedAttributes += 1;
      continue;
    }

    if (lower === "href" || lower === "xlink:href") {
      const safeHref = sanitizeHref(value);
      if (safeHref) hrefValue = safeHref;
      element.removeAttribute(name);
      if (!safeHref) stats.removedAttributes += 1;
      continue;
    }

    if (lower === "xmlns" || lower.startsWith("xmlns:")) {
      if (lower === "xmlns:xlink") {
        element.removeAttribute(name);
        continue;
      }
      if (lower !== "xmlns" && value.trim() === SVG_NAMESPACE) {
        // A prefixed SVG document needs its prefix binding to stay valid XML.
        continue;
      }
      if (!isRoot || lower !== "xmlns") {
        element.removeAttribute(name);
      }
      continue;
    }

    if (name === "xml:space") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "default" || normalized === "preserve") {
        element.setAttribute(name, normalized);
      } else {
        element.removeAttribute(name);
        stats.removedAttributes += 1;
      }
      continue;
    }

    if (lower.startsWith("data-")) {
      const safe = DATA_ATTRIBUTE_RE.test(name)
        ? cleanAttributeValue(value, 160)
        : null;
      if (safe === null) {
        element.removeAttribute(name);
        stats.removedAttributes += 1;
      } else {
        element.setAttribute(name, safe);
      }
      continue;
    }

    if (name === "aria-label" || name === "role" || name === "data-name") {
      const max = name === "aria-label" ? 240 : 160;
      const safe = cleanAttributeValue(value, max);
      if (safe === null) {
        element.removeAttribute(name);
        stats.removedAttributes += 1;
      } else {
        element.setAttribute(name, safe);
      }
      continue;
    }

    if (CORE_ATTRS.has(name) || PRESENTATION_ATTRS.has(name)) {
      let safe: string | null;
      if (PAINT_ATTRS.has(name)) {
        safe = sanitizePaintValue(value);
      } else if (name === "clip-path") {
        safe = sanitizeClipPathValue(value);
      } else {
        const max = name === "d" || name === "points" ? 2 * 1024 * 1024 : 4_096;
        safe = cleanAttributeValue(value, max);
        if (
          safe !== null &&
          PRESENTATION_ATTRS.has(name) &&
          /[<>{};`\\]/.test(safe)
        ) {
          safe = null;
        }
      }

      if (safe === null) {
        element.removeAttribute(name);
        stats.removedAttributes += 1;
      } else {
        element.setAttribute(name, safe);
      }
      continue;
    }

    // Everything else (filter, mask, marker-*, class, cursor, tabindex,
    // external namespaces, animation attributes, …) is stripped.
    element.removeAttribute(name);
    stats.removedAttributes += 1;
  }

  if (hrefValue) {
    element.setAttribute("href", hrefValue);
  }
}

function hasRiskyValue(value: string): boolean {
  const compact = value.replace(/\s+/g, "").toLowerCase();
  return (
    compact.includes("javascript:") ||
    compact.includes("vbscript:") ||
    compact.includes("expression(") ||
    compact.includes("@import") ||
    compact.includes("behavior:") ||
    compact.includes("-moz-binding") ||
    compact.includes("<script")
  );
}

function cleanAttributeValue(value: string, maxLength: number): string | null {
  const cleaned = stripControlCharacters(value).trim();
  if (cleaned.length > maxLength) return null;
  if (hasRiskyValue(cleaned)) return null;
  if (URL_PREFIX_RE.test(cleaned) && !INTERNAL_URL_RE.test(cleaned)) return null;
  return cleaned;
}

function sanitizeHref(value: string): string | null {
  const cleaned = stripControlCharacters(value).trim();
  if (cleaned.length > 512) return null;
  if (!HREF_FRAGMENT_RE.test(cleaned)) return null;
  return cleaned;
}

function sanitizePaintValue(value: string): string | null {
  const cleaned = stripControlCharacters(value).trim();
  if (cleaned === "") return "";
  if (cleaned.length > 160) return null;

  const internal = INTERNAL_URL_RE.exec(cleaned);
  if (internal) return `url(#${internal[1]})`;
  if (URL_PREFIX_RE.test(cleaned)) return null;

  const lower = cleaned.toLowerCase();
  if (
    lower === "none" ||
    lower === "transparent" ||
    lower === "inherit" ||
    lower === "initial" ||
    lower === "unset"
  ) {
    return lower;
  }
  if (lower === "currentcolor") return "currentColor";

  if (
    /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(cleaned) ||
    /^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\([^<>;]*\)$/i.test(cleaned) ||
    /^[a-z][a-z0-9-]*$/i.test(cleaned)
  ) {
    return cleaned;
  }
  return null;
}

function sanitizeClipPathValue(value: string): string | null {
  const cleaned = stripControlCharacters(value).trim();
  if (cleaned === "") return "";
  if (cleaned.length > 512) return null;
  const internal = INTERNAL_URL_RE.exec(cleaned);
  if (internal) return `url(#${internal[1]})`;
  const lower = cleaned.toLowerCase();
  if (lower === "none" || lower === "inherit") return lower;
  return null;
}

function sanitizeStyleAttribute(value: string): { value: string | null; removed: number } {
  const declarations = new Map<string, string>();
  let removed = 0;

  for (const chunk of value.split(";")) {
    const colon = chunk.indexOf(":");
    if (colon === -1) {
      if (chunk.trim() !== "") removed += 1;
      continue;
    }

    const property = chunk.slice(0, colon).trim().toLowerCase();
    const rawValue = chunk
      .slice(colon + 1)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/!important\s*$/i, "")
      .trim();

    if (!SAFE_STYLE_PROPERTIES.has(property) || rawValue === "") {
      removed += 1;
      continue;
    }

    if (URL_PREFIX_RE.test(rawValue) || hasRiskyValue(rawValue)) {
      removed += 1;
      continue;
    }
    if (/[<>{}`\\]/.test(rawValue) || rawValue.includes("var(")) {
      removed += 1;
      continue;
    }

    let safeValue: string | null = rawValue;
    if (STYLE_PAINT_PROPERTIES.has(property)) {
      safeValue = sanitizePaintValue(rawValue);
    } else if (property === "clip-path") {
      safeValue = sanitizeClipPathValue(rawValue);
    }

    if (safeValue === null || safeValue === "") {
      removed += 1;
      continue;
    }
    declarations.set(property, safeValue);
  }

  if (declarations.size === 0) return { value: null, removed };
  const serialized = Array.from(declarations.entries())
    .map(([property, declaration]) => `${property}: ${declaration}`)
    .join("; ");
  return { value: serialized, removed };
}

function isSafeId(id: string): boolean {
  if (!SAFE_ID_RE.test(id)) return false;
  // Avoid prototype pollution and confusing lookups on the elements record.
  return !Object.prototype.hasOwnProperty.call(Object.prototype, id);
}

function generatedBase(rawId: string | undefined, tag: string): string {
  if (!rawId) return tag;
  const cleaned = rawId
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  if (!cleaned) return tag;
  if (/^[0-9]/.test(cleaned)) return `${tag}-${cleaned}`;
  return cleaned;
}

function collectElements(root: XmlElement): XmlElement[] {
  const elements: XmlElement[] = [];
  const stack: XmlElement[] = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) break;
    elements.push(current);
    for (let index = current.childNodes.length - 1; index >= 0; index -= 1) {
      const child = current.childNodes.item(index);
      if (isXmlElement(child)) stack.push(child);
    }
  }
  return elements;
}

function assignStableIds(
  root: XmlElement,
  metadata: WeakMap<XmlElement, ElementMetadata>,
  stats: SanitizeStats,
): { duplicateIdCount: number; idMap: Map<string, string> } {
  const elements = collectElements(root);
  const rawCounts = new Map<string, number>();
  for (const element of elements) {
    const meta = metadata.get(element);
    const raw = meta?.authoredId;
    if (!raw) continue;
    rawCounts.set(raw, (rawCounts.get(raw) ?? 0) + 1);
    if (!isSafeId(raw)) stats.unsafeIds += 1;
  }

  let duplicateIdCount = 0;
  for (const count of rawCounts.values()) {
    if (count > 1) duplicateIdCount += count - 1;
  }

  const firstSafeOwner = new Map<string, XmlElement>();
  const reserved = new Set<string>();
  for (const element of elements) {
    const raw = metadata.get(element)?.authoredId;
    if (!raw || !isSafeId(raw)) continue;
    if (!firstSafeOwner.has(raw)) {
      firstSafeOwner.set(raw, element);
      reserved.add(raw);
    }
  }

  const used = new Set<string>();
  const counters = new Map<string, number>();
  const idMap = new Map<string, string>();

  for (const element of elements) {
    const meta = metadata.get(element);
    if (!meta) continue;
    const raw = meta.authoredId;
    const tag = canonicalSvgTag(element) ?? rawTagName(element);

    const canPreserve =
      raw !== undefined &&
      isSafeId(raw) &&
      firstSafeOwner.get(raw) === element &&
      !used.has(raw);

    if (canPreserve && raw) {
      used.add(raw);
      meta.idAuthored = true;
      meta.originalId = undefined;
      element.setAttribute("id", raw);
      if (!idMap.has(raw)) idMap.set(raw, raw);
      continue;
    }

    if (element === root) {
      element.removeAttribute("id");
      if (raw) {
        meta.originalId = raw;
        meta.idAuthored = false;
      }
      continue;
    }

    const base = generatedBase(raw, tag);
    let suffix = counters.get(base) ?? 0;
    let candidate = "";
    do {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    } while (used.has(candidate) || reserved.has(candidate) || !isSafeId(candidate));
    counters.set(base, suffix);
    used.add(candidate);

    if (raw) {
      meta.originalId = raw;
      if (!idMap.has(raw)) idMap.set(raw, candidate);
    }
    meta.idAuthored = false;
    element.setAttribute("id", candidate);
  }

  return { duplicateIdCount, idMap };
}

function rewriteFragmentReferences(root: XmlElement, idMap: Map<string, string>): void {
  const rewriteId = (id: string): string => idMap.get(id) ?? id;

  for (const element of collectElements(root)) {
    for (const name of attributeNames(element)) {
      if (
        name !== "href" &&
        name !== "fill" &&
        name !== "stroke" &&
        name !== "color" &&
        name !== "stop-color" &&
        name !== "clip-path"
      ) {
        continue;
      }
      const value = element.getAttribute(name);
      if (!value) continue;
      let rewritten = value;
      if (name === "href" && value.startsWith("#")) {
        rewritten = `#${rewriteId(value.slice(1))}`;
      } else {
        rewritten = value.replace(
          /url\(\s*['"]?#([^'"\s()<>]+)['"]?\s*\)/gi,
          (_match, id: string) => `url(#${rewriteId(id)})`,
        );
      }
      const compact = rewritten.replace(/\s+/g, "").toLowerCase();
      if (
        compact.includes("javascript:") ||
        compact.includes("vbscript:") ||
        compact.includes("data:")
      ) {
        element.removeAttribute(name);
        continue;
      }
      if (rewritten !== value) element.setAttribute(name, rewritten);
    }
  }
}

function buildWarnings(stats: SanitizeStats, duplicateIdCount: number): string[] {
  const warnings: string[] = [];

  if (stats.removedNodes > 0) {
    const details = Array.from(stats.removedNodeTags.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([tag, count]) => `${tag} (${count})`)
      .join(", ");
    warnings.push(
      `Removed ${stats.removedNodes} unsupported element(s)${details ? `: ${details}` : ""}.`,
    );
  }
  if (stats.removedAttributes > 0) {
    warnings.push(`Removed ${stats.removedAttributes} unsupported or unsafe attribute(s).`);
  }
  if (stats.removedStyleDeclarations > 0) {
    warnings.push(`Removed ${stats.removedStyleDeclarations} unsafe CSS declaration(s).`);
  }
  if (duplicateIdCount > 0) {
    warnings.push(`Rewrote ${duplicateIdCount} duplicate SVG id(s) to unique stable ids.`);
  }
  if (stats.unsafeIds > 0) {
    warnings.push(`Rewrote ${stats.unsafeIds} unsafe SVG id(s) to animation-safe ids.`);
  }

  return warnings;
}
