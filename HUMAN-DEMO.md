# HUMAN DEMO — next agent handoff

> **Paste this into the next chat:**
> “Read `app/HANDOFF.md` for the architecture and `app/HUMAN-DEMO.md` for the demo scope.
> The submission is now **human-focused**. Do not rebuild the scene graph, director,
> attachment math, share/export/voice, or the hard-cel renderer. Do not spend the remaining
> time on custom bones or wings. Build the human look system, the action library, the
> nature worlds, and the six-person cast — then verify the demo.”

---

## 1. The pivot

We are short on time. The demo is now **people**, not “any anatomy.”

The visual anchor is **`qa/style/ref-chef.png`** — the chunky chef with the big mustache,
puffy hat, cream coat, red neckerchief, navy trousers and brown shoes. The current
`qa/style/ref-cowboy-horse.png` is the other human reference. Both are flat, no outlines,
big glossy eyes, blush, soft rounded silhouettes. The new humans should feel like they
belong in the same cast as the chef.

The proof is:

- six distinct humans — male, female, androgynous, different skin tones, hair, outfits
- a library of readable human actions (wave, point, think, shrug, clap, laugh, dance, bow,
  walk, jump, stretch, tennis swing)
- nature worlds beyond day/night: meadow, forest, sunset, desert, winter, ocean, autumn
- the same hard-cel Duolingo/Kurzgesagt style as the existing cowboy/octopus/tennis scenes
- one live generated human from a prompt, one live edit, and a visible skeleton

The old octopus/cowboy scenes stay in the repo as a secondary “beyond humans” proof. They
are no longer the hero, the default, or the six cards.

**Do not turn this into the old 31-archetype gallery.** The six cast members are demo
fixtures. The product is the human **genome** (presentation, hair, face, body, outfit,
palette) plus the **action library** plus the **score**. The LLM must generate new
combinations, not retrieve fixed clips.

---

## 2. What is already done — do not rebuild

Read `HANDOFF.md`. In short:

- scene graph, skeleton grammar, procedural motion, rider attachment, stage fit
- hard-cel renderer: solid masses, no outlines, flat fills, clipped cel shadows, big eyes,
  blush, chunky limbs, flat backdrops
- **palette harmonisation** — every hosted genome is forced into the style
- edit guard, Copy spec, Download JSON, Share link, voice/Wispr, mobile QA
- tennis: `tennis-racket` + `swing` + `court` world (a human action/prop example)
- `pnpm typecheck` and `pnpm build` pass; production server is the demo target

The current biped is 16 bones: root, spine, neck, head, arm/forearm/hand L+R, thigh/shin/
foot L+R. It is enough for this demo. Do **not** add a new skeleton or rebuild the
transforms. Expressions and hair/outfit are renderer layers.

---

## 3. Human genome

Extend `Genome` with one optional `human` object, used only for `bodyPlan: 'biped'`.
The validator fills defaults; old genomes without it still render.

```ts
type Presentation = 'feminine' | 'masculine' | 'androgynous';
type HairStyle = 'short' | 'bob' | 'ponytail' | 'bun' | 'long' | 'curly' | 'afro' | 'braids' | 'bald';
type Fringe = 'none' | 'straight' | 'side' | 'curtain';
type FacialHair = 'none' | 'stubble' | 'mustache' | 'goatee' | 'beard';
type Top = 'tee' | 'hoodie' | 'shirt' | 'blouse' | 'dress' | 'suit' | 'apron' | 'coat' | 'sport';
type Bottom = 'jeans' | 'chinos' | 'shorts' | 'skirt' | 'leggings' | 'none';
type Shoes = 'sneakers' | 'boots' | 'flats' | 'barefoot';

type HumanLook = {
  presentation: Presentation;
  hair: { style: HairStyle; fringe: Fringe; volume: number };
  facialHair: FacialHair;
  body: { shoulders: number; hips: number; waist: number; height: number };
  outfit: { top: Top; bottom: Bottom; shoes: Shoes };
  face: { jaw: 'soft' | 'square'; lashes: boolean; brow: 'soft' | 'strong'; nose: 'small' | 'medium' | 'broad' };
};
```

Rules:

- Default `presentation: 'androgynous'`; infer `feminine` from woman/girl/lady/mother/
  grandmother, `masculine` from man/boy/guy/father/grandfather, when the model omits it.
- Presentation is **shape language**, not a costume code. A feminine character can wear a
  suit; a masculine character can wear an apron or a bright colour. Vary it.
- `body` multipliers are around 1.0: shoulders 0.85–1.2, hips 0.85–1.2, waist 0.85–1.1,
  height 0.9–1.1. Use them in the torso path and limb widths, not by changing the rig.
- Hair colour is `palette.hair`; skin is `palette.skin`; top is `palette.cloth`; bottom is
  `palette.pants`; collar/cuffs are `palette.trim`; accessories use `palette.accent`.
- The harmoniser already keeps skin saturated, detail dark, pupils dark, etc. Keep it.

---

## 4. Renderer work

### Hair

Implement 7 styles, enough for the cast + prompts:

- `short` — rounded cap with a side part
- `bob` — chin-length mass, center/side part
- `ponytail` — pulled-back cap + a 2-segment tail behind the head
- `bun` — pulled-back cap + a round bun
- `long` — a mass behind the shoulders
- `curly` / `afro` — a cloud of overlapping circles; big silhouette
- `braids` — two or more rounded segments down the back
- `bald` — none (keep the head shape)

Draw **back hair** in `BipedHead` before the head ellipse, and **fringe** in `FaceView`
after the face, above the brows. No outlines. Hair is `palette.hair` with one darker
inner shape for volume. A ponytail/bun can sway with the head; pass `t` into `ActorView`
if you add a subtle sine. Do not add hair bones unless the sway needs them.

### Face and facial hair

- `FaceView` already draws eyes, brows, blush, nose, mouth, hats, glasses.
- Add `lashes` (two small filled arcs at the outer eye corners) and `brow` thickness.
- Add `facialHair`: `stubble` (low-opacity lower-jaw tint), `mustache` (two rounded
  lobes under the nose), `goatee` (chin patch), `beard` (jaw band + chin). Use
  `palette.hair`; no strokes.
- Add a small expression state: `neutral | happy | surprised | thinking | shy | laugh |
  sleepy | wink`. `pose.ts` actions set it; `FaceView` adjusts brows, eye height, mouth.
  Keep the existing blink/gaze/blush.
- Eyelids/lashes must not turn into outlines. Use fills.

### Outfits

Keep the current `Torso` body path and add variants:

- `tee` — current tunic; short sleeve caps
- `hoodie` — wider torso, hood shape behind the neck, drawstrings
- `shirt` — collar, button strip, cuffs
- `blouse` — soft shoulders, V-neck, bracelet sleeves
- `dress` — torso extends into a skirt over the hips; legs visible below
- `suit` — lapels + tie; trousers
- `apron` — bib over a shirt; ties at the waist
- `coat` — long panels below the hip; scarf optional
- `sport` — jersey with a stripe/number, shorts or skirt
- Bottom: jeans/chinos (current leg capsules), shorts (shorter thigh), skirt (trapezoid
  over the hips), leggings (slimmer), none (shorts/underwear-level; avoid for the demo)
- Shoes: sneakers (rounded), boots (current), flats, barefoot

Do **not** create one preset per outfit. The `human.outfit` data chooses the shape.
The chef is `apron` + chef hat + mustache; the tennis player is `sport` + ponytail.

### Body and silhouette

Use `human.body` in `Torso`:
- shoulders widen/narrow the chest
- hips widen/narrow the tunic bottom/skirt
- waist narrows the middle
- height scales the legs slightly (or the whole actor via `place.scale`; prefer the
  skeleton `p.limbLength` so the stage fit remains correct)

The head is already big; keep it. The reference is chunky/soft, not realistic.

---

## 5. Action library

Add verbs to `types.ts`, `validate.ts`, `route.ts`, and `pose.ts`. Implement as
procedural actions using `addRot`/`chainOf`/`roleBone`; no keyframe clips.

### Must ship (readable in silhouette)

| Verb | What it does |
|---|---|
| `wave` / `greet` | arm up, hand wave, small head tilt (exists; improve hand) |
| `point` | arm forward, hand out, gaze follows |
| `think` | hand to chin, eyes up, head tilt, brow |
| `shrug` | both arms out/up, shoulders lift, head tilt |
| `clap` | forearms in, hands together, 2–3 claps |
| `laugh` | head back, mouth open, shoulders bounce |
| `dance` | hip sway, torso twist, alternating arm pumps, feet step |
| `bow` | spine forward, arms back, head down |
| `walk` | existing base walk; keep |
| `run` | faster walk + forward lean + bigger arm swing |
| `jump` / `celebrate` | existing; improve |
| `stretch` / `yawn` | arms up, head back, mouth open |
| `wink` | face-only; one eye closes, head tilt |

### If time

- `sit` / `stand` (needs a chair or ground contact; skip if no prop)
- `highfive`, `talk`, `listen`, `sleep`, `wake`
- `drink` / `hold-cup`, `type`, `read` (hand props)
- `flip` / `stir` for the chef (pan prop + pancake; this is a stretch, not required)
- `strum` for a guitar (needs a two-hand prop; skip for this demo)

The score sequences 4–5 actions in a 9 s loop. Each cast fixture has a different sequence.
The LLM may choose from the verbs; the validator adds the brief’s named action.

### Props

Do not build a general prop system now. The tennis racket is already done. A chef pan
is the only optional prop; if it risks the schedule, use `wave`/`laugh`/`stir` without a
pan and keep the chef’s silhouette (hat, mustache, apron). The demo is about people and
actions, not objects.

---

## 6. Nature worlds

Add flat, hard-cel backdrops. No gradients, no outlines, no blur. Use `t` for simple
particles.

| Preset | Flat ingredients |
|---|---|
| `meadow` | pale blue sky, sun, rolling green hills, tiny flowers, drifting clouds |
| `forest` | deep green layered trees, ferns, warm light shafts (flat shapes), fireflies |
| `sunset` | peach/coral bands, low sun, dark silhouette hills, birds |
| `desert` | sand dunes, cactus, warm sky, sun, rocks |
| `winter` | cool blue sky, snow hills, bare trees, falling snow, pine |
| `ocean` | horizon, flat waves, beach, palm/rock, gulls |
| `autumn` | orange/rust trees, falling leaves, warm cream sky |
| `rain` | grey-blue sky, clouds, rain lines, puddles |
| `sakura` | pink trees, petals, pale sky |

Prioritize **meadow, forest, sunset, desert, winter** for the cast. Keep `kitchen` and
`court` (chef, tennis). Add `ocean`, `autumn`, `rain`, `sakura` if time.

Update `WorldPreset`, the validator list, the route schema, and `SceneBackdrop`.

---

## 7. The cast (demo fixtures)

Add to `examples.ts`; use these for the home cards and preset pills. These are examples,
not the product.

| Name | Brief | Presentation | Hair | Outfit | World | Actions |
|---|---|---|---|---|---|---|
| **Marco** | A warm, proud chef with a thick brown mustache for a breakfast brand. He flips a pancake, laughs, and waves. | masculine | short, side part | chef hat + apron + coat | kitchen | wave, laugh, stir/flip* |
| **Mara** | A confident woman with a curly afro for a skincare brand. She waves, laughs, and points at the product. | feminine | afro | jacket + tee | meadow | wave, laugh, point |
| **Theo** | A shy baker with a short beard for a neighborhood bakery. He thinks, shrugs, and nods. | masculine | short + beard | hoodie + apron | forest | think, shrug, nod |
| **Jun** | An androgynous musician with a black bob for a synth brand. They look around, point, and bow. | androgynous | bob | shirt + trousers | sunset | look, point, bow |
| **Amara** | A joyful woman with long braids for a travel app. She dances, claps, and celebrates. | feminine | braids | dress | desert | dance, clap, celebrate |
| **Noah** | A sleepy man with a red beard for a winter lodge. He stretches, yawns, and waves. | masculine | short + beard + beanie | coat | winter | stretch, yawn, wave |
| **Sofia** | A focused tennis player with a high ponytail for a sportswear brand. She swings, celebrates, and waves. | feminine | ponytail | sport | court | swing, celebrate, wave |

\* Chef flip is a stretch. If no pan prop, use `stir` (hand circles) + `laugh` + `wave`.
Do not fake a pancake with a second actor.

The home hero should be **Marco in the kitchen** (closest to the reference chef) or **Mara
in the meadow** if the chef doesn’t land in time. The `/creature` default should be a human,
not the octopus or cowboy.

---

## 8. Page and copy

- `PRESETS` on `/creature`: the human cast (6 of the 7; keep Sofia/tennis if the racket
  is stable). The active chip should show `presentation · hair · world · action`.
- The brief textarea starts with a human brief. **New creature** / **Retry brief** stay.
- Home hero: human (chef or Mara), not the octopus. The hero proof line: “Same hand, any
  person, any action, any world.”
- `BriefLibrary` six cards: human prompts, not robot/fox/octopus. One card can be “Beyond
  humans: the octopus” if you want to keep the old proof, but it must not lead.
- The spec/trace chips should show `human.presentation`, `human.hair.style`,
  `human.outfit.top`, `world.preset`, and the action names. This is the visible proof that
  the character is data.
- Keep Copy/Download/Share/Voice. They already work.
- Do not add an archetype picker. The prompts generate the genome.

---

## 9. Implementation order (one focused session)

1. Read `HANDOFF.md`, this file, `render.tsx`, `pose.ts`, `validate.ts`, `types.ts`.
2. Run `pnpm typecheck && pnpm build` to confirm the baseline.
3. Add `human` to `types.ts` + `validate.ts` defaults/clamps + `route.ts` schema.
4. Add `HairBack`/`HairFront` and `FacialHair` in `render.tsx`; wire `palette.hair`.
5. Add outfit variants in `Torso` + legs/shoes; use `human.body`.
6. Add actions to `pose.ts` (batch 1) + `Verb`/`VALIDATE`/schema.
7. Add expression state to `pose.ts` + `FaceView`.
8. Add 5 nature worlds to `SceneBackdrop` + types/validator/schema.
9. Add the 6–7 cast fixtures; set `/creature` default + home hero/cards.
10. Add local fallback keywords (woman/man/beard/curly/chef/apron/tennis/winter…).
11. QA: typecheck, build, production server, screenshots, mobile, skeleton, share/edit.
12. Record a backup clip of the human cast.

Do **not** start with custom bones, wings, or a general prop system. The demo is human
variation + actions + nature.

---

## 10. 90-second demo

1. Open the home page / `/creature` on the human hero. *“This is the same flat-vector
   language — now people.”*
2. Generate Marco: **“A warm, proud chef with a thick brown mustache for a breakfast
   brand. He laughs, stirs, and waves.”** Show the trace, then the skeleton.
3. Edit: **“make it sunset and slower”** — same chef, same rig, new world/timing.
4. Click through **Mara** (afro, meadow, wave/laugh/point), **Theo** (beard, forest,
   think/shrug), **Jun** (bob, sunset, point/bow), **Amara** (braids, desert, dance/clap),
   **Noah** (beard, winter, stretch/yawn), **Sofia** (ponytail, court, swing).
5. Show the skeleton on one human; point at the same 16-bone rig under different hair,
   outfits, skin and worlds.
6. Close: *“Same hand, any person, any action, any world. The body is data, the performance
   is compiled.”*

---

## 11. Acceptance

> **Status: shipped on the production build, 2026-10-29.** Evidence is in
> `qa/live/human-summary.json`, `qa/live/human-trio.png`, `qa/live/54-cards.png`,
> `qa/live/52-mobile-human.png`, and `qa/video/human-cast-backup.mp4`.

- [x] `pnpm typecheck` and `pnpm build` pass.
- [x] Home hero is a human; six cards are human prompts; `/creature` defaults to a human.
- [x] Seven cast humans are visibly distinct in silhouette: 9 hair styles, 9 outfit
      shapes, 3 presentations, 7 skin tones.
- [x] At least 8 actions read in silhouette: wave, point, think, shrug, clap, laugh,
      dance, bow, run, stretch, yawn, wink.
- [x] At least 5 nature worlds: meadow, forest, sunset, desert, winter (plus ocean,
      autumn, rain, sakura, kitchen, court).
- [x] A hosted prompt for a new human returns a biped with the requested
      presentation/hair/outfit/action, not a horse or octopus.
- [x] Skeleton view still works; 16-bone rig.
- [x] Copy/Download/Share/Voice/Edit/Mobile still work.
- [x] Backup clip recorded: `qa/video/human-cast-backup.mp4` (13 s, 720×720).

---

## 12. Do not do

- Do not rebuild the scene graph, transforms, director, or hard-cel style.
- Do not add 31 archetypes or a character picker. The six cast members are fixtures.
- Do not make every woman a dress/pink or every man a suit/blue. Vary shape and colour.
- Do not make every human the same face/body. Hair, jaw, brows, shoulders, hips, outfits.
- Do not switch to a video/image model. The output is editable SVG.
- Do not use outlines/gradients on skin, hair, clothes or faces.
- Do not remove the octopus/cowboy/tennis code; demote them behind the human demo.
- Do not spend the remaining time on custom bones, wings, or a general prop system.
- Do not break the palette harmoniser or the P0 features.
- Do not print API keys.

---

## 13. Known traps

- `render.tsx` is large; add `Hair`/`Outfit`/`FacialHair` as components, not inline blobs.
- `FaceView` draws brows only for biped (good). Hair/beard must be fills, not strokes.
- The face frame is +x right, +y down; hair in `BipedHead` uses the head bone frame
  (+x up, +y left), so keep the two coordinate systems separate.
- The current head is an ellipse; a bob/afro/long mass must be drawn **behind** the head
  before the head fill; bangs/fringe after the face.
- The stage fit does not know about hair/outfits. Add a little top/side margin or keep
  the shapes within the head/torso bounds; check the hat/afro on the 560 stage.
- The palette harmoniser forces light-mane/dark-pupil rules; hair/outfit colours still
  come from the palette. Do not bypass it.
- The hosted model will forget `human` fields. Default them; add local keyword inference.
- The model may make a prop a second actor (it did with “guitar”). For humans, keep one
  actor unless the brief asks for a group; do not add a second actor for a prop.
- `pnpm dev` can loop in this environment; use `pnpm build && pnpm start` for QA/demo.
- Home reveals need a slow scroll for screenshots; not a product bug.

---

## 14. One-sentence summary

**Keep the hard-cel compiler; make the biped a real person (presentation, hair, face,
body, outfit), add a readable human action library and flat nature worlds, build the six-
person cast, and prove the same rig carries every human variation.**
