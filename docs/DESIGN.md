# Design language

Anitoon adapts the measured visual system of [Mobbin](https://mobbin.com/) to a small motion library. The reference was captured with **DesignProbe** at 1440×900, then re-observed in **ego lite** at 1440, 768 and 390 for the final pass. No Mobbin copy, screenshots, logo, client mark or font file is reused.

## Tokens

| Role | Value |
|---|---|
| Canvas | `#ffffff` |
| Ink | `#141414` |
| Secondary text | `#707070` |
| Muted / decorative | `#adadad` |
| Tile | `#f2f2f2` |
| Large surface | `#f5f5f5` |
| Hairline | `rgba(20, 20, 20, 0.10)` |
| Strong hairline | `rgba(20, 20, 20, 0.18)` |
| Display / UI | Switzer variable |
| Container | 1045px |
| Navigation | 88px |
| Body copy | 16px / 1.5 |
| Radius | 12 / 18 / 20 / 24 / 30 / 999px |
| Base unit | 4px |
| Dominant easing | `cubic-bezier(0, 0, 0.2, 1)` |

No UI accent. Colour belongs to the clips; the chrome stays monochrome.

## Type

Switzer variable is the closest free metric match to Saans (90.8/100 in the reference matcher). It is self-hosted through `next/font/local`.

| Role | Size | Weight | Line height | Tracking |
|---|---|---|---|---|
| Display | 80px → 56 → 40 | 650 | 1.0 | -0.6px at 80 |
| Heading | 44 / 32 | 650 | 1.09 | -0.4px |
| Large CTA | 56 / 40 | 650 | 1.0 | -0.6px |
| Title | 24 | 600 | 1.2 | -0.015em |
| Lede | 20 | 400 | 1.3 | 0 |
| Body | 16 | 450 | 1.5 | 0 |
| Small | 14 | 450 | 1.45 | 0 |
| Caption | 12 | 500 | 1.35 | 0.2px |
| Nav / buttons | 16 | 600 | 1.0 | 0.2px |

The reference uses Saans at weight 652, 80px/80px, tracking -0.6px. Switzer is set to 650 with the same optical tracking so the headings feel like the reference rather than a generic grotesque.

## Page structure

The landing is nine sections, one narrative:

1. **Hero** — oversized headline with three real clip thumbnails, paired black/light pills, challenge note.
2. **Library frame** — a working product preview: autoplaying 60fps clip, selectable side list, about panel, metadata, play action.
3. **Statement** — “Stock footage gives you pixels. Anitoon gives you motion.”
4. **Bento** — six product truths: 60fps, frame-accurate, spec included, live render, 1080 × 1080, take it out.
5. **The first drop** — three real clip cards with posters, metadata and specs.
6. **Play. Inspect. Take it.** — three-step workflow.
7. **No hands. No filler.** — the Wispr Flow build story.
8. **Honest band** — quote, 3 / 60 / 0 facts, no fake social proof.
9. **Final CTA** — “Take the first drop for a spin.”

A black footer with a rounded top and oversized wordmark closes the page.

## Motion

- State changes: 150ms `cubic-bezier(0, 0, 0.2, 1)`.
- Entrance: 800ms `cubic-bezier(0.19, 1, 0.22, 1)`, 80ms stagger.
- Hero chips: 440ms scale 0.72 → 1.02 → 1 with blur 7px.
- 60fps preview: autoplays only while the library frame is in view; pauses offscreen.
- Reduced motion: previews fall back to posters; the live SVG render freezes on a representative frame; CSS animations/transitions are disabled.

## Brand substitutions

| Reference | Anitoon |
|---|---|
| Mobbin bird mark / wordmark | Original play mark + “anitoon” wordmark |
| Saans | Switzer variable, self-hosted |
| App-icon hero chips | Real Anitoon clip thumbnails |
| Product screenshots | Working library frame with a 60fps preview |
| Client logos, testimonials, MCP, pricing, login | Removed entirely |

## Quality checks

Measured in a production build with **DesignProbe**, then re-observed in **ego lite** at 1440, 768 and 390.

| Check | Result |
|---|---|
| Structural | **88.8 / 100 — PASS** (budget 80) |
| Contrast | 0 failures |
| Tap targets | 0 under 24×24 |
| Focus visible | 100% (32/32) |
| Horizontal overflow @390 | 0px |
| CLS | 0.000 |
| Transfer | 420KB / 600KB |
| Requests | 18 |
| Page height @1440 | ~7148px |

The remaining gate suggestions are component-count deltas. Mobbin is a large design library with 261 images; Anitoon is a deliberate three-clip drop. Adding filler would violate the product’s no-fake-content rule, so the count is left honest.

## Accessibility

- Every interactive element has hover and `:focus-visible` states.
- The viewer closes on Escape and returns focus to the trigger.
- The viewer locks background scroll.
- The preview pauses offscreen and respects `prefers-reduced-motion`.
- Body copy and captions meet 4.5:1 contrast; decorative muted text is not used for meaning.
- Mobile tap targets are at least 24×24px; primary actions are 44px.

## What the design is not

No gradients, glassmorphism, purple SaaS glow, mascot library, or invented social proof. The colour in the page comes from the clips; the system around them stays quiet.
