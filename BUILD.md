# Build plan — Anitoon × Mobbin design language

| | |
|---|---|
| Reference | https://mobbin.com/ |
| Snapshot | `/Users/pranav1296/Ani-toon/app/.designprobe/reference` (hash `3d5b4bc3b0c42fa2`) |
| Local translation | `~/audiotestsonline-redesign` (same measured system, working reference) |
| Project | `/Users/pranav1296/Ani-toon/app` |
| Mode | refine an existing project |
| Stack | Next.js 16 · Tailwind CSS v4 · TypeScript |
| Entry | `src/app/page.tsx` |
| Dev URL | http://localhost:3000 |
| Product | **Anitoon** — a 60fps, code-rendered motion clip library (3 clips, 3 specs) |

## Build order

1. **Foundation** — Switzer variable, token layer in `globals.css`, shell, type ramp,
   focus-visible ring, reveal primitives, reduced-motion rules.
2. **Shell** — sticky nav, hero with inline clip thumbnails, black rounded footer.
3. **Product frame** — library preview with autoplaying 60fps clip, selectable side list,
   about, metadata, open actions.
4. **Narrative** — statement, six-tile bento, three-card library, three steps, Wispr story,
   honest quote band, final CTA.
5. **Viewer** — full MP4, real spec JSON, live SVG render, copy spec, download MP4.
6. **QA + gate** — ego-browser 1440 / 1024 / 768 / 390, then `designprobe-plugin gate`.

## Token contract (from measured system)

### Color

| Token | Value | Role |
|---|---|---|
| `paper` | `#ffffff` | page canvas |
| `ink` | `#141414` | primary text, solid pills, footer |
| `body` | `#707070` | supporting copy (4.95:1) |
| `muted` | `#adadad` | decorative only |
| `tile` | `#f2f2f2` | bento cards |
| `paper-2` | `#f5f5f5` | large surfaces |
| `line` | `rgba(20,20,20,0.10)` | hairlines |
| `line-strong` | `rgba(20,20,20,0.18)` | card borders on hover |

No UI accent. Colour belongs to the clips; chrome stays monochrome.

### Type — Switzer variable (Saans substitute, 90.8/100)

| Role | Size | Weight | Line-height | Tracking |
|---|---|---|---|---|
| display | 80 / 56 / 40 | 650 | 1.0 | -0.6px at 80 (-0.0075em) |
| h2 | 44 / 32 | 650 | 1.09 | -0.4px (-0.009em) |
| h2-lg | 56 / 40 | 650 | 1.0 | -0.6px (-0.0107em) |
| h3 | 24 | 600 | 1.2 | -0.015em |
| lede | 20 | 400 | 1.3 | 0 |
| body | 16 | 450 | 1.5 | 0 |
| small | 14 | 450 | 1.45 | 0 |
| caption | 12 | 500 | 1.35 | 0.2px |
| nav / buttons | 16 | 600 | 1 | 0.2px |

The reference is Saans 652 at 80px with -0.6px tracking, 80px leading. Switzer variable is
the closest free metric match; the weight is set to 650 and the exact tracking to match.

### Space / shape / motion

- Base unit 4px; container **1045px**; section rhythm 80 / 120 / 160 / 200.
- Radius: 12, 18, 20, 24, 30, 999. Cards use 30; pills use 999.
- Dominant state motion: 150ms `cubic-bezier(0, 0, 0.2, 1)`.
- Entrance: 800ms `cubic-bezier(0.19, 1, 0.22, 1)`, 70–100ms stagger.
- Hero chips: 440ms scale 0.72→1.02→1 with blur 7px.
- Respect `prefers-reduced-motion: reduce` everywhere.

## Section manifest (measured at 1440)

| # | Section | Height | Background | Done |
|---|---|---|---|---|
| 1 | Hero — “Clips that feel alive — at sixty frames a second.” | 677 | #ffffff | [x] |
| 2 | The library preview | 804 | #ffffff | [x] |
| 3 | Stock footage gives you pixels. Anitoon gives you motion. | 345 | #ffffff | [x] |
| 4 | One library for all your motion needs (6 tiles) | 1002 | #ffffff | [x] |
| 5 | The first drop (3 clip cards) | 990 | #ffffff | [x] |
| 6 | Play. Inspect. Take it. (3 steps) | 694 | #ffffff | [x] |
| 7 | No hands. No filler. (Wispr story) | 681 | #ffffff | [x] |
| 8 | No stock footage. No 100,000-clip promise. (quote + specs) | 738 | #f5f5f5 | [x] |
| 9 | Take the first drop for a spin. | 611 | #ffffff | [x] |
| — | Footer | 520 | #141414, 30px top radius | [x] |

## Component manifest

| Family | Instances | Variants | Hover | Focus-visible |
|---|---|---|---|---|
| Button (dark/light/outline) | 8+ | 3 | yes | ring |
| Nav link / ghost | 5 | 2 | tile bg | ring |
| Clip chip (hero) | 3 | 1 | — | — |
| Product frame row | 3 | selected/default | tile bg | ring |
| Clip card | 3 | 1 | lift + scale | ring |
| Bento tile | 6 | 1 | lift | (contains no link) |
| Step card | 3 | 1 | — | — |
| Viewer tab | 3 | 2 | tile bg | ring |
| Tag / badge | 20+ | 2 | — | — |
| Footer link | 9 | 1 | opacity | ring |

## Capability tasks

| Module | Task | Done |
|---|---|---|
| `dom-css` | Tokens, type ramp, container, section rhythm | [x] |
| `responsive` | 390 / 768 / 1024 / 1440 probes | [x] |
| `fonts-icons` | Switzer variable self-hosted; Lucide icons at 1.8px stroke | [x] |
| `images-assets` | Real clip posters, chips and 3 MP4s; no reference imagery | [x] |
| `components` | Every family above with hover + focus | [x] |
| `motion` | Hero entrance, chip pop, hover states, 60fps autoplay | [x] |
| `lottie` | Not applicable — product is SVG/60fps MP4 | skipped |
| `video` | Real 60fps clips with preview + full MP4 + live SVG | [x] |
| `a11y-seo` | Landmarks, labels, reduced motion, metadata | [x] |
| `performance` | One 154KB preview, 42KB font, no image payload | [x] |

## Brand substitutions

- Mobbin mark → original Anitoon play mark (black rounded square).
- Saans → Switzer variable (self-hosted woff2). No Mobbin font files.
- App-icon hero chips → real Anitoon clip thumbnails.
- Product screenshots → a working Anitoon library frame with a live 60fps preview.
- Client logos / testimonials / MCP / pricing / login → removed entirely.
- All copy rewritten for Anitoon and the Wispr No Hands Challenge.

## QA commands

```bash
pnpm run dev
designprobe-plugin gate --project /Users/pranav1296/Ani-toon/app --url http://localhost:3000
designprobe-plugin status --project /Users/pranav1296/Ani-toon/app
```

## Definition of done

- [ ] No `Annie2`, `MCP`, `pricing`, `login`, fake logos, fake testimonials or fake counts.
- [ ] The 60fps preview autoplays; selecting a row changes the featured clip.
- [ ] All 3 cards open the correct viewer; Spec and Live SVG load real data.
- [ ] Every interactive element has hover + focus-visible.
- [ ] 390px: no overflow, nav usable, tap targets ≥ 44px.
- [ ] Gate ≥ 80; remaining deltas reported honestly.
