# Brief — Anitoon × Mobbin design language

Reference: <https://mobbin.com/> (snapshot `.designprobe/reference`, hash `3d5b4bc3b0c42fa2`)
Local translation reference: `~/audiotestsonline-redesign` (same measured system)
Project: `/Users/pranav1296/Ani-toon/app`
Product: **Anitoon** — a small library of 60fps, code-rendered motion clips.
Context: solo entry for the **Wispr “No Hands” Challenge** (WeMakeDevs), Track 2: No-Code. Deadline 31 Oct 2026.

## Intent

Aesthetic replication, not an app-state clone. Rebuild Mobbin's measured visual system —
white canvas, Switzer/Saans-class neo-grotesque, 1045px container, 4px grid, 30px cards,
black pills, oversized headline with inline rounded media chips, quiet 150ms state motion
and 800ms staggered entrances — then replace every identity asset and all copy with Anitoon's.

## The signature move

The hero headline runs through **real clip thumbnails** in rounded squares. The product frame
below is a working library preview: the selected clip autoplays at 60fps, the side list switches
the featured clip, and "Play clip" opens the full viewer with the MP4, the real spec JSON, and
the live SVG render. No mascots, no stock screenshots, no fake counts.

## Must replicate

- [x] Token discipline from `.designprobe/reference/tokens.css` / `DESIGN.md`
- [x] White `#ffffff` canvas, `#141414` ink, `#707070` secondary, `#adadad` muted, `#f0f0f0` tile
- [x] 80/56/44/24/20/16/14/12 type ramp, exact Mobbin weights and tracking
- [x] 1045px container, 88px nav, 80/120/160/200 section rhythm
- [x] Black pill buttons + light pill buttons, 150ms `cubic-bezier(0,0,.2,1)` states
- [x] 30px cards, hairline borders, soft hover lift
- [x] Inline rounded hero chips, centered H1, centered subhead + paired CTAs
- [x] Six-tile bento, large quote band, black rounded footer
- [x] Hover + focus-visible on every interactive element
- [x] Responsive 390 / 768 / 1024 / 1440, no horizontal overflow

## Must not carry over

- [x] Mobbin logo, bird mark, social icons, copy, screenshots, client logos, people
- [x] Saans font files (replaced with self-hosted Switzer variable, 42KB)
- [x] Mobbin's MCP / pricing / login / "Join for free" surfaces
- [x] Mascot studio, MCP server, fake “trusted by”, fake case studies, fake counts

## Product truth (no fake SaaS claims)

- Anitoon is a hackathon project, **not** a company, subscription or SaaS product.
- The first drop is exactly **3 clips**, each 60fps, 1080×1080, with a working spec and live SVG render.
- Real capabilities: autoplay preview, full MP4, real spec JSON, live SVG render, copy spec, download MP4.
- No fake logos, no invented testimonials, no “100,000+”, no “used by”, no analytics, no account.
- Voice is real in the build story: the challenge asked for no typing; the page says so once.

## Build order

1. Foundation — Switzer variable, tokens, shell, type ramp, focus states, motion primitives.
2. Shell — nav, hero, product frame, footer.
3. Product frame — selected clip, autoplay preview, side list, about, metadata.
4. Narrative — statement, six-tile bento, library cards, three steps, Wispr story, honest band, CTA.
5. Viewer — MP4, spec JSON, live SVG, download/copy actions.
6. QA — ego-browser at 1440/1024/768/390, fix, then designprobe gate.

## Acceptance

- [ ] Every color/radius/space/type value comes from the token layer or the measured system.
- [ ] No Annie2, MCP, pricing, login, fake logos, fake testimonials or fake counts in `src/`.
- [ ] The 60fps preview autoplays and the selected clip changes the frame.
- [ ] Every library card opens the correct clip; Spec and Live SVG load real data.
- [ ] Mobile: no overflow, readable headline, tap targets ≥ 44px, nav and viewer usable.
- [ ] Gate passes at ≥ 80. Report inferred values and substitutions honestly.
