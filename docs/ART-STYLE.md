# Anitoon character style

The reference is the flat-vector mascot language used by Duolingo character
animation and Kurzgesagt explainers: **hard cel, toy-like, geometric, warm.**
It is not a rendered skeleton with a texture on it. The skeleton is invisible;
what the audience sees is a solid toy.

Reference sheets live in `qa/style/`:

- `test-octopus.png` — mass, eyes, blush, tentacle rhythm
- `ref-cowboy-horse.png` — chunky horse, rider silhouette, clothes as blocks
- `ref-forest-spirit.png` — blob mass, oversized eyes, stub limbs, flat shadow
- `ref-chef.png` — the human anchor: chunky body, big head, mustache, chef hat,
  coat, neckerchief, flat kitchen

## The rules

1. **Silhouette first.** Every body plan reads as one solid mass plus a few
   chunky appendages. If the bone lines are visible through the skin, it is
   wrong. A horse is a barrel, a neck and a muzzle — not four tubes.
2. **Zero outlines.** No `stroke` on skin, cloth, eyes or mouths. Edges come
   from value contrast and flat shape overlap. The only strokes in a scene are
   the skeleton overlay and tiny facial marks.
3. **Flat fills only.** No gradients on characters, no inner glows, no
   airbrush. Backgrounds are flat planes too.
4. **Hard cel shadow.** One darker shape per mass, offset down/right, clipped
   to the mass. It is a shape, not a blur. Keep it subtle (10–18% darker).
5. **Chunky geometry.** Rounded rectangles, capsules, circles and teardrops.
   Limbs keep their width to the wrist/hoof and end in a round cap. Taper only
   the last segment of a tail or tentacle.
6. **Head is a mass, not a dot.** Head width is roughly 0.9–1.1× shoulder
   width. Cheeks are wide, the jaw is rounded, the muzzle is a separate light
   mass on quadrupeds.
7. **Eyes carry the character.** Two large white ovals close together, a big
   dark pupil (≈55% of the eye), one big highlight and one tiny sparkle. The
   eye white has no outline. Blink squashes the whole eye.
8. **Face marks are solid.** Blush is a saturated coral ellipse, not a 12%
   tint. Brows are thick rounded bars. The mouth is a thick curve or a filled
   shape.
9. **Hands and feet are mittens.** Round hands, rounded boots/hooves with a
   dark sole. No fingers, no toes, no claws unless the genome asks for them.
10. **Warm ground.** Cream `#FBE9C8`, soft blue sky, moss green garden. The
    character's palette must sit against it, not fight it.

## Palette discipline

Each genome has six required colors and three optional ones:

| token | job |
|---|---|
| `skin` | main body mass |
| `belly` | light underside / muzzle / belly patch |
| `accent` | brand color, scarf, saddle blanket |
| `detail` | hooves, boots, hair, deep shadow |
| `eye` | pupil |
| `mouth` | mouth interior / smile |
| `cloth` | shirt / garment (falls back to `accent`) |
| `trim` | collar, cuffs (falls back to `belly`) |
| `hair` | mane, forelock, fringe (falls back to `detail`) |

`skin` and `detail` should be the same hue family. `belly` is `skin` mixed
toward cream. `accent` is the one saturated complementary note.

## Body-plan recipes

### Biped

- Torso: rounded tunic, wider at the shoulders than the hips, collar V,
  optional scarf/bandana at the neck.
- Arms: one thick capsule per segment in cloth, mitten hands in skin.
- Legs: thick capsules in `detail` (pants), boots as rounded blocks.
- Head: wide oval, ears, hair fringe, small nose, big eyes.
- Hat: brim ≈ 1.5× head width, rounded crown, band.

### Quadruped

- Barrel: overlapping rump and chest circles joined by a belly slab; light
  belly patch clipped to the silhouette.
- Neck: thick capsule; mane is a row of overlapping rounded scallops in `hair`.
- Head: cheek mass + long light muzzle; dark nose, smile, one or two big eyes.
- Legs: thick capsules; dark rounded hooves.
- Tail: thick chain, light tuft.
- Saddle: pad on the back, girth band around the barrel.

### Octopod

- Mantle: near-circular dome, light belly patch under the face, top highlight.
- Tentacles: 8 thick chains, constant width until the last segment; rounded
  tips; light suckers on the front chains.
- Face sits low on the mantle; eyes almost touch.

### Blob

- One squishy mass, light belly, top highlight, stub arms and feet.
- Face large and low; squash and stretch does the acting.

## Backdrops

Flat horizon, flat ground, flat clouds/hills. No vignette, no gradient, no
blur. A single flat contact shadow grounds the actor.

## Do not

- Do not draw bones as visible tapered lines.
- Do not use black outlines or thin strokes to define a body.
- Do not use gradients, glows, or soft airbrush shadows on characters.
- Do not shrink the eyes to make room for the rig.
- Do not put a human face on the side of an animal's cheek and call it a day;
  build the muzzle and the eye line for that anatomy.
