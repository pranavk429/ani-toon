# HANDOFF — Anitoon Creature Compiler

> **MAIN IS CURRENT — 2026-10-31.** `main` now contains the human compiler landing
> (“Describe a person. Watch them move.”), `/creature`, and the ANI Studio. The old
> three-clip library is history at `10bd736`. Start with `README.md`.

> **Paste this file into the next agent's first message, or tell it:**
> “Read `app/HANDOFF.md` before touching anything. P0 is done. Continue with P1. Do not rebuild the scene graph, renderer, skeleton grammar, director, or `/creature`.”

> **DEMO PIVOT — 2026-10-29.** The submission is now **human-focused**. Read
> **`HUMAN-DEMO.md`** before starting. The remaining work is the human genome
> (presentation/hair/face/body/outfit), the human action library, nature worlds, and the
> six-person cast. Do **not** spend the remaining time on custom bones, wings, horns or a
> general prop system. The octopus/cowboy/tennis scenes stay as secondary proof; humans
> are the demo.

> **HUMAN DEMO SHIPPED — 2026-10-29.** The human genome, 9 hair styles, 9 outfits,
> 12-action library, 9 nature worlds, 7-person cast, human hero/cards, and the offline
> keyword/edit fallback are implemented and verified on the production build. P0 still
> passes (octopus 50 bones, cowboy 16 + 23 attached to `biscuit.back`, blob 10). Evidence:
> `qa/live/human-summary.json`, `qa/live/human-trio.png`, `qa/video/human-cast-backup.mp4`.
> Acceptance is checked in `HUMAN-DEMO.md` §11.

---

## 1. The mission

Anitoon is a hackathon entry for **Track 2 (designers / founders)**. The old build was a deterministic director that picked from **31 regex archetypes on one humanoid rig**. It returned results instantly, looked like a gallery, and turned “an octopus” into a person with bear ears. The user hated it — correctly.

The rebuild’s thesis:

> **The AI is the art director. The compiler is the animator.**
> The model writes a **genome** (body plan, proportions, face, palette) and a **score** (timed beats). A local compiler builds the **skeleton**, attaches actors, and performs every frame in one consistent brand style.

The demo proves construction, not retrieval:

- an octopus with 8 generated tentacle chains
- a cowboy **attached** to a horse’s `back` bone
- a visible skeleton view
- a live edit
- the same style across bodies

Do **not** regress to “more preset characters,” instant cached results, or a video-model wrapper. The skeleton is generated and editable. That is the moat.

---

## 2. The art direction is now hard-cel flat vector

This was the last major failure and it is fixed. The old renderer drew every bone as a
tapered noodle with a dark outline, tiny eyes and no body mass. It looked like a rig
wearing skin. The new look is the **Duolingo / Kurzgesagt flat-vector mascot** language:

- **Solid masses first.** A horse is a barrel, a neck and a muzzle. An octopus is a dome
  with thick legs. A blob is one squishy mass.
- **Zero outlines.** No strokes on skin, cloth, eyes or mouths. Edges come from value
  contrast and overlapping fills. The only strokes are the skeleton overlay and tiny
  face marks.
- **Flat fills, no gradients** on characters or backdrops.
- **One clipped hard cel shadow** per mass (a shape, not a blur), plus a flat contact
  shadow on the ground.
- **Oversized glossy eyes**: white sclera, big dark pupil, one large highlight and one
  tiny sparkle. Blush is a saturated coral ellipse, not a 12% tint.
- **Chunky toy limbs**: constant width to the wrist/hoof, round caps, mitten hands,
  rounded boots/hooves. Taper only the last tentacle/tail segment.
- **Warm palette discipline**: saturated skin, cream/light underside, dark detail,
  dark pupil, readable mouth; one cheerful garment colour on bipeds.

The rules are written down in **`docs/ART-STYLE.md`**. The shared tokens and helpers are
in **`src/creature/style.ts`**. Reference sheets generated with **Gemini 3.8 Flash via
the Antigravity CLI (`agy`)** live in **`qa/style/`**:

- `qa/style/test-octopus.png` — mass, eyes, blush, tentacle rhythm
- `qa/style/ref-cowboy-horse.png` — chunky horse, rider silhouette, clothes as blocks
- `qa/style/ref-forest-spirit.png` — blob mass, oversized eyes, stub limbs, flat shadow
- `qa/style/ref-chef.png` — the human anchor: chunky body, big head, mustache, chef hat,
  coat, neckerchief, flat kitchen

These are **style targets**, not shipped animation frames. The product is still 100%
procedural SVG; do not swap the compiler for generated stills.

### The model cannot be trusted with the palette

A raw hosted octopus returned `eye:#ffffff` (invisible pupils), `mouth:none`,
`limbWidth:0.7`, `limbLength:1.5`, a muddy dark palette and a dark monochrome cowboy.
`palettesFor` in `validate.ts` now runs **`harmonisePalette`** and tightened clamps:

- eye forced dark; mouth forced dark; `none` becomes `smile` on octopus/blob
- belly forced lighter than skin; detail forced darker; skin gets a small HSL vibrance
- chunky limb floors (`limbWidth >= 1`, octopod `limbLength <= 1.15`)
- eye size/spacing floors so the face stays oversized
- biped garment: muddy/black shirts become the reference denim blue; dark cowboy hats
  are warmed toward straw; a red scarf is added to a cowboy hat if missing; pants become
  dark denim when the model supplies mud
- quadruped mane/tail forced light (`hair`), saddle blanket forced terracotta when it
  matches the leather
- quadruped eyes are forced to **one near eye** for the side-view camera

Do not bypass this pass. It is the difference between the preset and the generated scene
looking like the same product. Evidence: `qa/live/10-octopus.png` and
`qa/live/20-cowboy-final.png` were both live hosted calls, not presets.

---

## 3. What is built and working

### Scene system

- **Scene graph:** `{ title, world, actors[], score }`.
- **Actor:** `{ genome, skeleton, attach?, pose, depth }`.
- **Genome:** body plan, palette, proportions, face, surface, accessories.
- **Skeleton:** role-tagged bones (`head`, `handR`, `footL`, `footBL`, `tentacle`, `tail`,
  `back`, …), rest transforms and draw depth.
- **Attachment:** a rider samples the mount’s `back` bone position and the mount’s
  **body** rotation. The rider is seated at the saddle, not standing on the ground.
- **Body plans:** `biped`, `quadruped`, `octopod`, `blob`, `custom` (types support custom;
  the validator still maps `custom` to the closest buildable plan — see P1.1).
- **Motion:** procedural, not keyframe playback. Idle breathing/blinks, quadruped gait,
  tentacle drift, greet/hide/peek/rear/celebrate, rider pose, chain follow-through.
- **Renderer:** square 720×720 stage, flat stage-aware backdrop, solid masses, tapered
  tentacles/tails, blob heads, shared face rig scaled to head width, cowboy hat, saddle,
  mane, vest/scarf, skeleton overlay.
- **Base coverage:** `ensureScore` and `localEdit` fill base-beat gaps and extend the last
  base to the full duration, so a slowed edit never freezes the performance.

### Director

- **Hosted:** `claude-haiku-4.5` via Experiential Labs, ~5–10 s, JSON scene output.
- **Offline:** `localScene(prompt)` — a compositional grammar, not an archetype lookup.
- **Edit fallback:** `localEdit(previous, prompt)` keeps the cast and patches world,
  timing and colour. It rebuilds skeletons from the compact previous payload.
- **Edit guard:** `src/creature/edit.ts`. A world/time/mood edit keeps the previous actors
  and attachments and only takes the hosted look/title; a structural edit is allowed to
  change the cast but restores a dropped rider unless the brief explicitly removes them.
- **Validator:** clamps proportions/faces, harmonises palettes, resolves shortened parent
  IDs (`horse` vs `horse-01`), drops props-as-actors, adds brief-mandated actions.
- **API:** `POST /api/direct` with `{ prompt, previous? }` → `{ scene, meta }`.

### Pages

- **`/creature`** — opens on the **octopus preset** (not the horse), with a live stage,
  brief textarea, generation trace, spec view, skeleton toggle, preset scenes,
  **New creature**, **Retry brief**, edit mode, **Copy spec**, **Download JSON**,
  **Share link**, **Speak** (browser `SpeechRecognition`) and a **Wispr Flow ready** pill.
- **New idea vs edit:** a brief is only treated as an edit when it **starts** with an edit
  verb (`make`, `change`, `turn`, `add`, `remove`, `slower`, `faster`, …) and is short.
  A new idea starting with “A/An” always generates fresh. **New creature** clears the
  brief and forces the next direction to start from scratch; **Retry brief** repeats the
  same idea (it is not a new creature).
- **`/`** — home page leads with the creature compiler: live octopus hero, six starter
  cards, updated Statement / HowItWorks / HonestBand copy. The old humanoid studio is not
  on the demo path.
- **Nav/footer/final CTA** point to `/creature`.

### Tennis (first prop + action pair)

A tennis/racket brief stays a **biped**. The validator attaches a `tennis-racket`
accessory to `handR`, forces the **`court`** world, and adds one clean 2 s `swing` beat at
2.2 s instead of the model's short flicks. The renderer draws the racket in the hand; the
court backdrop has a flat net, lines and a ball. Tested live: **“a girl playing tennis” →
Maya, biped, 16 bones, court, racket, swing.** This is the template for P1.2 props; wings,
horns and general props are still open.

### Export / share / voice
- `src/creature/share.ts` encodes a compact `{ title, world, actors(genome/attach/pose), score }`
  as base64url in `#s=…`; the skeleton is rebuilt on load. A hosted cowboy share is ~2.7 KB.
- `Copy spec` copies a readable skeleton-free JSON; `Download JSON` saves it; the toast is
  `role="status"`.
- Share links replay in a fresh page and show a “shared link” trace.
- Voice uses `window.SpeechRecognition || webkitSpeechRecognition`; unsupported/permission
  denied shows a clear toast and leaves Wispr Flow as the OS-level path.
- The form is disabled until React hydration (`data-ready`), so a fast click cannot submit
  the server-rendered form and reload the page.

---

## 4. Verified on the production build

Run `pnpm typecheck` and `pnpm build` before claiming anything. Last verified on
**2026-10-29** with the production server (`pnpm start`):

- `pnpm typecheck` passes.
- `pnpm build` passes.
- `/`, `/creature`, `/creature?skeleton=1` return 200.
- Octopus prompt → `octopod`, **50 bones**, `hide`/`peek`, 9.0 s.
- Cowboy prompt → 2 actors; rider attaches to the mount’s `back`; 23 + 16 bones.
- Forest-spirit prompt → **one blob**, 10 bones (no prop-as-second-actor).
- Hosted edit `make it night and slower` → hosted response, `world.preset=night`,
  11.7 s, rider still on `Dusty.back`, same octopod/cast, no reset.
- Copy spec = 3.8 KB JSON with actors + score; Download JSON saves; Share link replays in a
  fresh page with the “shared link” trace.
- Skeleton toggle shows 39 rig lines on the cowboy; `?skeleton=1` opens with the badge
  `skeleton`; the octopus shows 50-bone chains.
- Voice click degrades to a readable toast in headless Chromium; Wispr Flow pill visible.
- 390 / 768 / 1024 / 1440: **zero horizontal overflow**; stage is square at every width
  (350 / 560 / 498 / 560); every primary control is **44 px** tall.
- Home: 45 SVGs, **six** `/creature?prompt=` cards, zero overflow. The reveal observer needs
  a real scroll; with a slow pass all **38/38** `[data-reveal]` nodes get `.is-in`.
- Backup clip: `qa/video/anitoon-backup.mp4` (10 s, 720×720, octopus → skeleton → cowboy).

Evidence:

- `qa/live/01-studio.png`, `02-cowboy.png`, `03-edit.png`, `04-shared.png`
- `qa/live/10-octopus.png`, `11-octopus-skeleton.png`, `12-octopus-edit.png`
- `qa/live/13-forest.png`, `14-skeleton-query.png`, `20-cowboy-final.png`
- `qa/live/mobile.png`, `tablet.png`, `laptop.png`, `desktop.png`
- `qa/live/08-home-slow-scroll.png`, `qa/live/summary.json`
- `qa/style-sheet/final.png`, `qa/style-sheet/detail-final.png`
- `qa/video/anitoon-backup.mp4`

---

## 5. File map

| Path | What it is |
|---|---|
| `app/src/creature/types.ts` | Scene graph, genome, palette, bone, score, attachment types |
| `app/src/creature/skeleton.ts` | `buildSkeleton`: biped, quadruped, octopod, blob, custom |
| `app/src/creature/examples.ts` | Curated octopus, cowboy-on-horse, blob scenes |
| `app/src/creature/local.ts` | Offline generative director + `localEdit` |
| `app/src/creature/validate.ts` | LLM JSON → `Scene`; clamps, **palette harmonisation**, parent resolution, brief actions, base coverage |
| `app/src/creature/edit.ts` | Edit safety: preserve cast for world/timing edits, restore a dropped rider |
| `app/src/creature/pose.ts` | Procedural motion: idle, gait, greet/hide/peek/rear, rider pose |
| `app/src/creature/transforms.ts` | Scene-graph matrices, rider attachment, stage fit |
| `app/src/creature/style.ts` | Art tokens + palette helpers (cloth, trim, hair, muzzle, shadow) |
| `app/src/creature/render.tsx` | Square SVG stage, flat backdrop, solid masses, face rig, hats, saddle, skeleton overlay |
| `app/src/creature/ScenePlayer.tsx` | Client-only RAF loop (mounts after hydration) |
| `app/src/creature/share.ts` | Compact `#s=` encoder/decoder + readable spec |
| `app/src/creature/smoke.ts` | Bone-count smoke test |
| `app/src/app/api/direct/route.ts` | Hosted director + edit prompt + local fallback |
| `app/src/app/creature/page.tsx` | The studio UI, edit loop, export/share, voice, toasts |
| `app/docs/ART-STYLE.md` | The hard-cel art direction and body-plan recipes |
| `app/src/components/anitoon/Hero.tsx` | Home hero with live octopus |
| `app/src/components/anitoon/BriefLibrary.tsx` | Six starter cards → `/creature?prompt=` |
| `app/src/components/anitoon/*` | Statement / HowItWorks / HonestBand / nav / footer / CTA |
| `app/qa/render-sheet.tsx` | SSR contact sheet for the three presets (`pnpm dlx tsx qa/render-sheet.tsx`) |
| `app/qa/human-sheet.tsx` | SSR cast + local-grammar + extra-world contact sheet |
| `app/qa/look-sheet.tsx` | Hair / outfit / face / body look matrix |
| `app/qa/action-sheet.tsx`, `qa/face-sheet.tsx` | Human action silhouettes and expression close-ups |
| `app/qa/runner/e2e.mjs` | Production Playwright QA (requires `playwright-core` in `qa/runner`) |
| `app/qa/runner/humans.mjs` | Human production QA: cast, skeleton, hosted chef, edit, share, mobile, home |
| `app/qa/runner/human-video.mjs` | 720×720 backup clip of the human cast |
| `app/qa/runner/octo.mjs`, `video.mjs` | Octopus/skeleton/edit proof + backup recording |

**Legacy, not on the demo path:** `app/src/components/studio/*`, `app/src/toon/director.ts`,
`Kid.tsx`, `compile.ts`, `app/src/toon/page.tsx` (old clip viewer), `app/src/toon/share.ts`.
Do not restore the old studio to `/` or the nav. Do not reuse the old humanoid `share.ts`.

---

## 6. Run it

```bash
cd /Users/pranav1296/Ani-toon/app

pnpm typecheck
pnpm build
pnpm start            # use the production server for the demo and QA
```

`pnpm dev` is fine for editing, but during the last QA session Turbopack/Fast Refresh
entered a rebuild/reload loop. If that happens, kill the dev server and use
`pnpm build && pnpm start`; do not chase it during the demo.

Smoke:

```bash
pnpm dlx tsx src/creature/smoke.ts
# Muddle — deep-sea podcast :: muddle:octopod 50 bones :: 5 beats
# Cass & Biscuit — trail ride :: biscuit:quadruped 23 bones | cass:biped 16 bones -> biscuit.back
# Jelly — playful mascot :: jelly:blob 10 bones :: 4 beats
```

API:

```bash
curl -sS -X POST http://localhost:3000/api/direct \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"A shy octopus for a deep-sea podcast. It peeks out, waves with three tentacles, then hides behind one."}' \
  | python3 -m json.tool | head -60
```

### Env / model

- Working provider: **Experiential Labs**, `EXPLABS_API_KEY`, base
  `https://api.experientiallabs.ai/v1/chat/completions`, model `claude-haiku-4.5`
  (override with `CREATURE_MODEL`).
- The key is now in `app/.env.local` (gitignored) and in the shell environment.
- `GEMINI_API_KEY` in `.env.local` is out of credits (HTTP 402). Do not switch back until
  billing is fixed.
- Never print keys in the UI, logs, or this file.
- The style references were generated with the **Antigravity CLI** (`agy`, not in OpenCode):
  `agy -p "…" --model gemini-3.8-flash-high --dangerously-skip-permissions`.
  The generated stills are in `qa/style/`; they are references, not runtime assets.

---

## 7. What is left — P1 (the “any creature” proof)

> **Paused for the submission.** The demo scope is in `HUMAN-DEMO.md`: human
> presentation/hair/outfit, a human action library, nature worlds, and the cast. Do not
> start P1.1/P1.2 now. P1 remains the post-demo “any creature” roadmap.

P0 is complete. Do not redo it.

### P1.1 True custom body plans

`customBones` exists in the types and `buildSkeleton('custom')`, but `normalisePlan` still
maps `custom` to the closest buildable plan. Wire the escape hatch: add `customBones` to
the LLM schema (hierarchical bones with roles), validate/clamp the tree (cap ~80 bones),
build/render it, and test a centaur, mermaid, two-headed mushroom and rider-on-dragon.
This is the strongest answer to “what if the judge invents something no archetype covers.”

### P1.2 Wings, horns and props

Quadruped has ears, mane, tail, hooves; no wings/horns. A dragon should grow wings/horns;
a forest spirit should hide in a mushroom/rock/box. Add optional `wings`/`horns` chains and
a simple `props` array to `Scene`. This also fixes “hides in a mushroom” without a second
actor. The `leaf-ears` accessory and the **tennis-racket + swing + court** pair are the
patterns to follow; a racket is currently a hand accessory, not yet a general prop system.

### P1.3 Genome editor

Sliders for limb count, limb length, head size, eye count/size, palette, torso. Rebuild the
skeleton and replay the **same score**. Put it behind a “Genome” tab next to the spec.
This is the designer-control proof: the body is data.

### P1.4 Chat history

The page shows a technical trace, not a conversation. Add a compact message list: user
brief, director note (title, mood, body plan, beats), edit, “Retry brief.” The `previous`
path already supports edits.

### P1.5 Share link — done in P0

`src/creature/share.ts` encodes the compact scene in `#s=…` and rebuilds the skeleton on
load. Do not reuse the old humanoid `share.ts`.

---

## 8. The 90-second demo

> **The submission demo is the human demo in `HUMAN-DEMO.md` §10.** The octopus/cowboy
> steps below are the P0 proof, kept for history; do not open on the octopus. `/creature`
> now defaults to Marco, and the home hero/cards are humans.

1. Open `/creature` on a clean production build (`pnpm start`).
2. Say or type: **“A shy octopus for a deep-sea podcast. It peeks out, waves with three
   tentacles, then hides behind one.”**
3. While it generates (~5–8 s), point at the trace: *“Claude Haiku writes a genome and a
   score. It is not retrieving a clip.”*
4. When it renders, click **Show skeleton**: *“Here is the 50-bone octopus rig. Eight
   tentacle chains. The compiler built this.”*
5. Type **“make it night and slower”**; show the edit: same octopus, same 50 bones,
   longer loop, night world.
6. Run the cowboy preset: **“A confident cowboy riding a horse for a sneaker brand. He
   tips his hat and the horse rears.”** Show the chips: *“Two actors. The rider is
   attached to the horse’s back bone.”* Point at the straw hat, red scarf, cream mane and
   red saddle blanket: *“Same hand, same flat-vector style, different anatomy.”*
7. Close: *“A video model gives you pixels. We generate a genome, a skeleton and a score —
   same style, any body, editable, 60 fps.”*

Do not lead with a humanoid. Lead with the octopus and the skeleton. The backup clip is
`qa/video/anitoon-backup.mp4` if the venue network dies.

---

## 9. Known traps (these bit us)

1. **Raw LLM palettes are not the style.** A hosted octopus shipped white pupils,
   `mouth:none`, 0.7-wide tentacles and a 1.5-long limb. The harmoniser in
   `validate.ts` is mandatory; do not bypass it or “simplify” it into a pass-through.
2. **`next.config.ts` uses `cacheComponents: true`.** Route segment configs `runtime` and
   `dynamic` are rejected. Do not add them to `route.ts`.
3. **Global CSS `a { color: inherit }` and `button { color: inherit }` are unlayered** and
   override Tailwind `text-white`. White text on `<a>`/`<button>` needs an inline
   `style={{ color: '#fff' }}` or `!text-white`. The “Open studio,” “Direct it,” and active
   preset pills were invisible because of this.
4. **Rider attachment must use the mount’s BODY rotation**, not the `back` marker
   rotation. `back` is a point marker with `rot: 90`; using its full matrix lays the rider
   sideways. `transforms.ts` resolves the parent’s `spine` body angle; keep that.
5. **`hides` must be in the brief-action regex.** `/\bhide\b/` does not match “hides”; the
   octopus prompt silently missed the hide. It is fixed in `validate.ts` and `local.ts`;
   keep both.
6. **LLM actor IDs can be shortened** (`horse` vs `horse-01`). `validate.ts` resolves by
   suffix and then by the only mountable actor; keep that.
7. **Props become actors.** The model may output a mushroom as a second blob. The
   validator drops extra actors unless the brief says rider/mount/two/and; the system
   prompt says environment is not an actor. If you add a prop system, adjust this.
8. **Edits can silently replace the scene.** “Make it night and slower” once turned the
   horse into a biped and dropped the rider. `edit.ts` now keeps the previous cast for
   world/timing edits and restores a dropped rider for structural edits. Keep it.
9. **Edits can leave base beats short.** The model stretched `score.duration` but left
   `idle` at 8 s. `ensureScore`/`localEdit` fill gaps and extend the last base. Keep it.
10. **Hydration can reload the form.** A submit click before hydration fires a native GET.
    The form is disabled until `ready` (`data-ready`), and the QA waits for
    `form[data-ready="true"]`. Keep the guard.
11. **Stage text on a light world is unreadable.** The scene title now sits on a
    `bg-black/35` scrim. Keep the scrim; white-on-light-green was invisible.
12. **Hydration float diffs / extension noise.** `ScenePlayer` and `BriefLibrary` previews
    mount after hydration. Keep the mounted guards. The dev overlay’s “client/server diff”
    from a browser extension injecting `bis_skin_checked` is not in the production build.
13. **Dev HMR loop.** During QA, `next dev` rebuilt/reloaded continuously (Fast Refresh).
    Use the production build for the demo and Playwright. If dev loops, kill it; don’t
    chase it.
14. **Home reveals need a scroll.** The full-page screenshot without scrolling looks blank
    because `[data-reveal]` is opacity 0 until IntersectionObserver fires. Scroll slowly
    before screenshotting; 38/38 reveal.
15. **The old studio is still in the repo but unlinked.** Do not put it back on `/` or the
    nav. `/toon` is the old clip viewer. Leave it alone.
16. **The old `share.ts` is for the old `SceneSpec`.** Do not reuse it for the new `Scene`.
17. **A new brief is not an edit.** The old edit regex matched `more`, `day`, `color`,
    `make`, etc. anywhere in a short brief, so a new idea was sent as “edit this horse” and
    came back as a horse. Edit detection is now **prefix-based** (`make/change/turn/add/…`)
    and **New creature** forces a fresh scene. Do not broaden it back to a word-anywhere
    regex, and do not start `/creature` on the cowboy again; it opens on the octopus.
    `Retry brief` repeats the same idea, it is not a new creature.
18. **“Swing” alone is not tennis.** The racket/court/swing enrichment is scoped to
    `tennis|racket|forehand|backhand|serve`. A “swing dancing” brief gets the swing action
    but **no racket and no court**. Do not broaden it to `swing` alone.

---

## 10. Acceptance criteria

- [x] `pnpm typecheck` passes.
- [x] `pnpm build` passes.
- [x] `/` and `/creature` return 200.
- [x] Home hero shows the octopus; six cards link to `/creature?prompt=…`.
- [x] Octopus prompt → octopod, ~50 bones, `hide`/`peek`.
- [x] Cowboy prompt → rider attached to `mount.back`, not standing beside it.
- [x] Forest-spirit prompt → one creature, not two blobs.
- [x] `Show skeleton` visibly shows the rig.
- [x] `?skeleton=1` opens with the skeleton on.
- [x] Edit loop: “make it night and slower” updates the current scene without breaking the
      attachment.
- [x] Copy/download/share works on `/creature`.
- [x] Mic/Wispr affordance is visible and degrades gracefully.
- [x] 390 px mobile has no overflow; 44 px controls.
- [x] The demo runs from a clean production server with `EXPLABS_API_KEY` set.
- [x] The preset and hosted characters share the hard-cel flat-vector style.
- [x] A new idea starting with “A/An” generates fresh; **New creature** clears the brief
      and forces a fresh scene; **Retry brief** repeats the same idea.
- [x] `/creature` opens on the octopus, not the horse.
- [x] “A girl playing tennis” → biped, tennis racket on `handR`, `court` world, net, ball,
      and a visible `swing` beat.
- [ ] P1.1 true custom bones.
- [ ] P1.2 wings/horns/props.
- [ ] P1.3 genome editor.
- [ ] P1.4 chat history.

---

## 11. Do not do these

- Do not restore the old tapered-noodle, outlined, tiny-eyed renderer. The hard-cel style
  is the product.
- Do not let raw LLM palettes bypass `harmonisePalette`.
- Do not add more archetypes or preset character cards. That is the old product.
- Do not restore the old humanoid studio to the home page or nav.
- Do not switch to a text-to-video / text-to-3D model for the final animation. Style drift,
  latency, no editability, wrapper perception. The compiler is the moat.
- Do not ship the generated Gemini reference images as animation frames. They are style
  references in `qa/style/`.
- Do not fake latency or cache the demo as if it were live.
- Do not claim “any creature” beyond what is real. Four body plans + compound scenes + the
  custom path (P1) are the honest claim.
- Do not print API keys in the UI, logs, or this file.
- Do not revert the pre-existing working-tree changes in `app/`; the repo was already dirty.

---

## 12. One-sentence summary for the next agent

**The hard-cel art direction, scene graph, skeleton grammar, renderer, hosted director,
offline fallback, edit guard, export/share/voice, and new `/creature` studio are done and
verified. For the submission, pivot to `HUMAN-DEMO.md`: the human genome, action library,
nature worlds and six-person cast. P1 custom bones/wings are paused.**
