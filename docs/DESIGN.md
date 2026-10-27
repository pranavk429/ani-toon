# Design language

Ani adapts the measured visual system of [yashb.xyz](https://yashb.xyz/) to a product studio. The reference was captured at 1440×900 with **DesignProbe**, then re-observed in **ego lite** for the final pass. No reference copy, photography, illustration or asset is reused.

## Tokens

| Role | Value |
|---|---|
| Paper | `#efece4` |
| Surface | `#fefdf9` |
| Surface elevated | `#e2d8c6` |
| Ink | `#111111` |
| Secondary ink | `#2c2823` |
| Muted ink | `#6a6253` |
| Accent | `#4b63ff` |
| Accent text (AA) | `#3548d8` / `#2f43cc` |
| Hairline | `#d7d4cb` |
| Display | Bagel Fat One |
| Hand / headings | Shantell Sans |
| Body / UI | Inter |
| Telemetry | Space Mono |
| Container | 1140px |
| Section rhythm | 108px |
| Radii | 3 / 13 / 15 / 17 / 18 / 24 / 28 / full |
| Base unit | 8px |

## Page structure

The landing is five sections, one narrative:

1. **Hero** — a 3D latex `ANI` wordmark drawn as inline SVG, two hand-drawn squiggles, a blue crown, a sparkle, a small bomb, a one-line intro, and four fanned character cards.
2. **Selected work** — section seal + 68px heading + lede + tactile tab toggle + two project rows (live vector panel left, title/description/chips/action right). The tabs switch between brand mascots and studio cuts.
3. **About the studio** — two-column story + rotated portrait card + a GitHub-style motion graph + a two-row motion-channel marquee.
4. **How it works** — a four-row process list (Brief → Director → Compiler → Renderer) with icon tiles, role, description, chips and a date/telemetry column.
5. **Contact** — centered 60px closing line, black pill CTA, four social tiles, a rotated blue “Thanks for scrolling!” sticker, and mono microcopy.

The studio is no longer a page section. It opens as a full-screen paper overlay from the nav CTA, any character card, or the closing CTA, so the landing keeps the reference's calm rhythm.

## What was carried over

- Warm bone canvas, charcoal text, **one** electric-blue accent.
- Puffy display lettering with a warm extrusion, soft floor shadow, clipped latex highlights and a blue crown.
- Floating pill navigation with a moving ink thumb and a compact black CTA.
- Pinned/fanned cards, hand-drawn underlines, seal-shaped section tags and small physical props.
- Editorial spacing, 1140px container, hairline borders, low-contrast shadows, 3px default radii.
- One dominant motion language: 450ms springy state changes, 700ms reveal, continuous idle float, reduced-motion support.

## What changed for the product

- The giant word is **ANI**, not a person's name; the fanned cards are generated mascots, not project screenshots.
- The project rows are live SVG performances, not static screenshots. The media panels have a live-vector chip, a beat/time chip and an “Open in studio” hover action.
- The contribution graph is a **motion graph**: 53 weeks × 7 days of generated beat activity, with a `60 fps` badge.
- The tech stack is a **motion stack**: 18 channel names in two marquee rows (lift, squash, lean, gaze, lid, breath, follow-through…), not a tool logo wall.
- The experience list becomes the product pipeline, with the same row rhythm and dates.
- The studio is a product surface inside an overlay: director chat, live stage, score/genome views, timeline, brand kit, image and logo ingest.

## Quality checks

- DesignProbe gate: **PASS** — structural **82.2/100** (budget 80).
- Contrast: **0 failures**.
- Tap targets: **0 under 24×24**.
- Focus visible: **100%** (24/24).
- Horizontal overflow at 390: **0px**.
- CLS: **0.000**.
- Transfer: **373KB** (production), 15 requests.
- Page height at 1440: **~5740px**; reference: 5782px.
- Section heights: hero 915, work 1565, about 1170, process 1269, contact 821.

The remaining gate suggestions are structural, not visual: the reference is a portfolio with 52 panels and 39 `<img>` photos, while Ani is an interactive studio with SVG characters and a real overlay product surface. No functional links, controls or content were deleted to chase those counts.
