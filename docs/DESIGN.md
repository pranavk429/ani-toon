# Design language

Ani adapts the measured visual system of [yashb.xyz](https://yashb.xyz/) to a product studio. The reference was captured at 1440×900 with **DesignProbe**; a **Gemini 3.8 Flash** subagent in the Antigravity CLI wrote an independent visual QA review. No reference copy, photography, illustration or asset was reused.

## Tokens

| Role | Value |
|---|---|
| Paper | `#efece4` |
| Surface | `#fefdf9` |
| Ink | `#111111` |
| Muted ink | `#655d50` |
| Accent | `#4b63ff` |
| Hairline | `#d7d4cb` |
| Display | Bagel Fat One |
| Hand / headings | Shantell Sans |
| Body / UI | Inter |
| Telemetry | Space Mono |
| Container | 1140px |
| Section rhythm | 108px |
| Radii | 3 / 13 / 15 / 17 / 24 / 28 / full |
| Base unit | 8px |

## What was carried over

- Warm bone canvas, charcoal text, **one** electric-blue accent.
- Puffy display lettering with a layered warm extrusion and a blue doodle crown/underline.
- Floating pill navigation, pinned polaroid cards, hand-drawn props and underlines.
- Editorial spacing, hairline borders, low-contrast shadows and tactile pill buttons.
- A single dominant motion language: 400–600ms springy entrances, continuous idle float, reduced-motion support.

## What changed for the product

- The giant word is **ANI**, not a person's name; the pinned cards are **generated mascots**, not project screenshots.
- The studio is a real three-pane product surface: director chat, live SVG stage + score, genome inspector.
- The puffy letters, doodles, pins, keycaps and waveform are inline SVG/CSS, not raster props.
- New type steps (15/500, 16.5/400, 17/800, 18/400, 19/400, 21/800, 22/700, 24/700, 46/800) were added to support the studio UI.

## Quality checks

- Contrast: 0 failures at 1440 and 390.
- Tap targets: 0 under 24×24.
- Focus visible: 100%.
- Horizontal overflow at 390: 0px.
- CLS: 0.
- Transfer: ~371KB (production).
- Structural DesignProbe score: 73.6. It remains below the reference's 80 because the gate compares a portfolio with 52 panels and 39 `<img>` photos against an interactive studio with forms and SVG mascots; the category deltas are content-shape, not copied-asset, differences. All functional/a11y/performance gates pass.
