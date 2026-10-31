import { describe, expect, it } from "vitest";

import { importSvg, looksLikeSvg } from "@/lib/svg";

describe("import limits and invalid input", () => {
  it("returns empty for blank input", () => {
    for (const source of ["", "   ", "\n\t", "\uFEFF   "]) {
      const result = importSvg(source);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("empty");
    }
  });

  it("rejects oversized input without throwing", () => {
    const source = `<svg><rect width="1" height="1"/></svg>`;
    const result = importSvg(source, { maxBytes: 10 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("too_large");
  });

  it("rejects too many elements", () => {
    const result = importSvg(
      `<svg><rect width="1" height="1"/><rect width="1" height="1"/><rect width="1" height="1"/></svg>`,
      { maxElements: 2 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("too_many_elements");

    const defaultLimit = importSvg(
      `<svg>${'<rect width="1" height="1"/>'.repeat(4_001)}</svg>`,
    );
    expect(defaultLimit.ok).toBe(false);
    if (!defaultLimit.ok) expect(defaultLimit.error.code).toBe("too_many_elements");
  });

  it("rejects excessive nesting", () => {
    const result = importSvg(
      `<svg><g><g><g><rect width="1" height="1"/></g></g></g></svg>`,
      { maxDepth: 2 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("too_deep");

    const defaultDepth = importSvg(
      `<svg>${"<g>".repeat(34)}<rect width="1" height="1"/>${"</g>".repeat(34)}</svg>`,
    );
    expect(defaultDepth.ok).toBe(false);
    if (!defaultDepth.ok) expect(defaultDepth.error.code).toBe("too_deep");
  });

  it("rejects invalid XML and non-SVG roots", () => {
    const malformed = importSvg(`<svg><g></svg>`);
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) expect(malformed.error.code).toBe("invalid_xml");

    const html = importSvg(`<html><body>no</body></html>`);
    expect(html.ok).toBe(false);
    if (!html.ok) expect(html.error.code).toBe("not_svg");

    const wrongNamespace = importSvg(
      `<svg xmlns="http://www.w3.org/1999/xhtml"><rect width="1" height="1"/></svg>`,
    );
    expect(wrongNamespace.ok).toBe(false);
    if (!wrongNamespace.ok) expect(wrongNamespace.error.code).toBe("not_svg");
  });

  it("rejects documents with no animatable elements", () => {
    for (const source of [
      `<svg xmlns="http://www.w3.org/2000/svg"></svg>`,
      `<svg xmlns="http://www.w3.org/2000/svg"><defs><path d="M0 0 L1 1"/></defs></svg>`,
      `<svg xmlns="http://www.w3.org/2000/svg"><linearGradient id="g"><stop/></linearGradient></svg>`,
    ]) {
      const result = importSvg(source);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("no_animatable_elements");
    }
  });

  it("never throws for hostile or malformed strings", () => {
    const samples = [
      "<",
      "<?xml version='1.0'?><svg>",
      "<svg><rect width='1' height='1'>",
      "<svg><path d='M0 0 L 1 1'/><script>alert(1)</script></svg>",
      "<svg><text>hello & goodbye</text></svg>",
      "<svg xmlns='http://www.w3.org/2000/svg'><rect width='1' height='1'/></svg>\u0000",
      "\u0000\u0001\u0002",
    ];
    for (const sample of samples) {
      expect(() => importSvg(sample)).not.toThrow();
    }
  });
});

describe("looksLikeSvg", () => {
  it("recognises a normal SVG with a declaration and comments", () => {
    expect(looksLikeSvg("<?xml version='1.0'?><!-- x --><svg viewBox='0 0 1 1'/>")).toBe(true);
    expect(looksLikeSvg("\uFEFF  <svg>")).toBe(true);
    expect(looksLikeSvg("<svg:svg xmlns:svg='http://www.w3.org/2000/svg'/>")).toBe(true);
  });

  it("rejects other roots and plain text", () => {
    expect(looksLikeSvg("<html></html>")).toBe(false);
    expect(looksLikeSvg("hello")).toBe(false);
    expect(looksLikeSvg("")).toBe(false);
  });
});
