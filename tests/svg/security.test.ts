import { describe, expect, it } from "vitest";

import { importSvg, type ImportResult, type SceneGraph } from "@/lib/svg";

function expectOk(result: ImportResult): SceneGraph {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.graph;
}

const MALICIOUS = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" onload="alert(1)">
  <style>@import url(https://evil.example/style.css); .x { fill: red }</style>
  <script>alert(document.cookie)</script>
  <foreignObject width="10" height="10">
    <div xmlns="http://www.w3.org/1999/xhtml">owned</div>
  </foreignObject>
  <image href="data:image/png;base64,AAAA" width="10" height="10"/>
  <a href="https://evil.example/malware" onclick="alert(2)">
    <rect id="linked" x="1" y="2" width="3" height="4" fill="url(https://evil.example/paint)"/>
  </a>
  <animate attributeName="opacity" from="0" to="1" dur="1s"/>
  <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="1s"/>
  <set attributeName="fill" to="red"/>
  <filter id="blur"><feGaussianBlur stdDeviation="2"/></filter>
  <mask id="mask"><rect width="10" height="10"/></mask>
  <pattern id="pattern"><rect width="4" height="4"/></pattern>
  <rect id="kept" x="20" y="20" width="10" height="10" fill="url(#grad)" clip-path="url(#clip)"/>
  <linearGradient id="grad">
    <stop offset="0" stop-color="red"/>
    <stop offset="1" stop-color="blue"/>
  </linearGradient>
  <clipPath id="clip"><rect width="10" height="10"/></clipPath>
</svg>`;

describe("sanitizer security", () => {
  it("removes scripts, event handlers, foreign content, styles and animation elements", () => {
    const graph = expectOk(importSvg(MALICIOUS));
    const svg = graph.sanitizedSvg;

    for (const forbidden of [
      "<script",
      "<style",
      "onload",
      "onclick",
      "<foreignObject",
      "<iframe",
      "<object",
      "<embed",
      "<image",
      "<animate",
      "<set",
      "<filter",
      "<mask",
      "<pattern",
      "javascript:",
      "https://evil.example",
      "data:image",
      "expression(",
      "@import",
    ]) {
      expect(svg.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }

    expect(svg).toContain('id="linked"');
    expect(svg).toContain('id="kept"');
    expect(svg).toContain('fill="url(#grad)"');
    expect(svg).toContain('clip-path="url(#clip)"');
    expect(svg).toContain("<linearGradient");
    expect(svg).toContain("<clipPath");
    expect(graph.stats.removedNodeCount).toBeGreaterThan(0);
    expect(graph.warnings.length).toBeGreaterThan(0);
  });

  it("keeps only internal fragment references", () => {
    const graph = expectOk(
      importSvg(`
        <svg viewBox="0 0 10 10">
          <linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient>
          <rect id="r" width="5" height="5" fill="url(#g)" stroke="#000"/>
          <rect id="external" width="5" height="5" fill="url(http://example.com/x.svg#p)"/>
          <rect id="bad" width="5" height="5" fill="javascript:alert(1)"/>
        </svg>`),
    );
    expect(graph.sanitizedSvg).toContain('fill="url(#g)"');
    expect(graph.sanitizedSvg).not.toContain("example.com");
    expect(graph.sanitizedSvg).not.toContain("javascript");
    const external = graph.elements.external;
    const bad = graph.elements.bad;
    expect(external.style.fill).toBeUndefined();
    expect(bad.style.fill).toBeUndefined();
  });

  it("normalizes internal xlink gradients and drops the xlink namespace", () => {
    const graph = expectOk(
      importSvg(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
          <defs>
            <linearGradient id="base"><stop offset="0" stop-color="red"/></linearGradient>
            <linearGradient id="derived" xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#base"/>
          </defs>
          <rect width="10" height="10" fill="url(#derived)"/>
        </svg>`),
    );
    expect(graph.sanitizedSvg).toContain('href="#base"');
    expect(graph.sanitizedSvg).toContain('fill="url(#derived)"');
    expect(graph.sanitizedSvg).not.toContain("xlink");
  });

  it("unwraps links inside text without dropping the visible label", () => {
    const graph = expectOk(
      importSvg(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
          <text id="label"><a href="https://evil.example">Hello</a></text>
        </svg>`),
    );
    expect(graph.sanitizedSvg).not.toContain("<a");
    expect(graph.sanitizedSvg).not.toContain("evil.example");
    expect(graph.sanitizedSvg).toContain("Hello");
    expect(graph.elements.label.text).toBe("Hello");
  });

  it("escapes markup-looking CDATA in text nodes", () => {
    const graph = expectOk(
      importSvg(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
          <text id="label"><![CDATA[<script>alert(1)</script>]]></text>
        </svg>`),
    );
    expect(graph.sanitizedSvg).not.toContain("<script");
    expect(graph.sanitizedSvg).toContain("&lt;script&gt;");
  });

  it("rejects doctype and entity declarations before parsing", () => {
    const doctype = importSvg(
      `<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
       <svg xmlns="http://www.w3.org/2000/svg"><text>&xxe;</text></svg>`,
    );
    expect(doctype.ok).toBe(false);
    if (!doctype.ok) expect(doctype.error.code).toBe("unsafe_markup");

    const bareDoctype = importSvg(
      `<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
       <svg><rect width="1" height="1"/></svg>`,
    );
    expect(bareDoctype.ok).toBe(false);
    if (!bareDoctype.ok) expect(bareDoctype.error.code).toBe("unsafe_markup");
  });

  it("does not treat a doctype mentioned inside a comment as a declaration", () => {
    const graph = expectOk(
      importSvg(`
        <svg viewBox="0 0 10 10">
          <!-- <!DOCTYPE svg> is only text here -->
          <rect width="5" height="5"/>
        </svg>`),
    );
    expect(graph.rootIds).toHaveLength(1);
  });

  it("removes foreign-namespace elements from the SVG tree", () => {
    const graph = expectOk(
      importSvg(`
        <svg xmlns="http://www.w3.org/2000/svg" xmlns:h="http://www.w3.org/1999/xhtml" viewBox="0 0 10 10">
          <h:rect width="10" height="10"/>
          <rect id="kept" width="5" height="5"/>
        </svg>`),
    );
    expect(graph.rootIds).toEqual(["kept"]);
    expect(graph.warnings.some((warning) => /removed/i.test(warning))).toBe(true);
  });

  it("rejects entity references without a declaration as invalid XML", () => {
    const result = importSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><text>&xxe;</text></svg>',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_xml");
  });

  it("sanitizes inline styles and keeps safe presentation declarations", () => {
    const graph = expectOk(
      importSvg(`
        <svg viewBox="0 0 10 10">
          <rect id="styled" width="5" height="5"
            style="fill: #ff0000; stroke: url(#evil); opacity: 0.5;
                   background-image: url(https://evil.example/x.png);
                   behavior: url(#default#time2); position: absolute;"/>
        </svg>`),
    );
    expect(graph.sanitizedSvg).toContain("fill: #ff0000");
    expect(graph.sanitizedSvg).toContain("opacity: 0.5");
    expect(graph.sanitizedSvg).not.toContain("url(");
    expect(graph.sanitizedSvg).not.toContain("behavior");
    expect(graph.sanitizedSvg).not.toContain("position");
    expect(graph.elements.styled.style.fill).toBe("#ff0000");
  });
});
