import { NextResponse } from 'next/server';

import { guardEdit } from '@/creature/edit';
import { localEdit, localScene } from '@/creature/local';
import { sceneFromUnknown } from '@/creature/validate';

const SYSTEM = `You are the art director for a 2D vector motion compiler. Return ONLY a JSON object, no markdown, no commentary.

Schema:
{
  "title": string,
  "world": {"preset": "sky"|"garden"|"kitchen"|"night"|"studio"|"court"|"meadow"|"forest"|"sunset"|"desert"|"winter"|"ocean"|"autumn"|"rain"|"sakura", "accent": "#RRGGBB"},
  "actors": [{
    "id": string, "name": string, "species": string,
    "bodyPlan": "biped"|"quadruped"|"octopod"|"blob"|"custom",
    "role": string,
    "palette": {"skin":"#RRGGBB","belly":"#RRGGBB","accent":"#RRGGBB","detail":"#RRGGBB","eye":"#RRGGBB","mouth":"#RRGGBB","cloth"?: "#RRGGBB","trim"?: "#RRGGBB","hair"?: "#RRGGBB","pants"?: "#RRGGBB"},
    "proportions": {"head":number,"torso":number,"limbLength":number,"limbWidth":number,"limbCount":number,"taper":number,"neck":number},
    "face": {"eyes":number,"eyeSize":number,"eyeSpacing":number,"pupil":"round"|"slit"|"star","mouth":"smile"|"grin"|"fang"|"beak"|"none","brows":boolean},
    "human": {
      "presentation": "feminine"|"masculine"|"androgynous",
      "hair": {"style":"short"|"bob"|"ponytail"|"bun"|"long"|"curly"|"afro"|"braids"|"bald","fringe":"none"|"straight"|"side"|"curtain","volume":number},
      "facialHair": "none"|"stubble"|"mustache"|"goatee"|"beard",
      "body": {"shoulders":number,"hips":number,"waist":number,"height":number},
      "outfit": {"top":"tee"|"hoodie"|"shirt"|"blouse"|"dress"|"suit"|"apron"|"coat"|"sport","bottom":"jeans"|"chinos"|"shorts"|"skirt"|"leggings"|"none","shoes":"sneakers"|"boots"|"flats"|"barefoot"},
      "face": {"jaw":"soft"|"square","lashes":boolean,"brow":"soft"|"strong","nose":"small"|"medium"|"broad"}
    },
    "surface": {"kind":"fur"|"feathers"|"scales"|"skin"|"metal"|"goo","pattern":"none"|"spots"|"stripes"|"plates"},
    "accessories": [{"kind":"cowboy-hat"|"chef-hat"|"beanie"|"cap"|"glasses"|"scarf"|"saddle"|"reins"|"leaf-ears"|"tennis-racket"|"none","color":"#RRGGBB","attach":string}],
    "attach": {"actor":string,"bone":string,"x":number,"y":number,"rot":number,"scale":number}
  }],
  "score": {"duration":number,"mood":string,"beats":[{"actor":string,"verb":"idle"|"look"|"greet"|"move"|"reach"|"celebrate"|"hide"|"interact"|"emote"|"walk"|"trot"|"gallop"|"rear"|"peek"|"wave"|"nod"|"shake"|"jump"|"swing"|"point"|"think"|"shrug"|"clap"|"laugh"|"dance"|"bow"|"run"|"stretch"|"yawn"|"wink"|"stir","at":number,"dur":number,"target":"viewer"|"left"|"right"|"up"|"down"|"prop"|"self","intensity":number,"layer":"base"|"action"}]}
}

Rules:
- A person is ALWAYS a biped with a "human" look. Fill every human field. Presentation is shape language, not a costume code: a feminine character can wear a suit or apron; a masculine character can wear a bright coat. Vary hair, jaw, brows, shoulders, hips, outfits and palettes across people. Never default every woman to a dress or every man to a suit.
- Body multipliers are around 1.0: shoulders 0.85-1.2, hips 0.85-1.2, waist 0.85-1.1, height 0.9-1.1. Hair volume 0.7-1.5.
- Hair color is palette.hair; skin is palette.skin; top is palette.cloth; bottom is palette.pants; collar/cuffs are palette.trim; accessories use palette.accent. Keep skin saturated and hair clearly darker or lighter than skin.
- A chef/cook/baker gets a "chef-hat", an apron top, and usually a scarf/neckerchief. A winter brief gets a beanie and a coat. A tennis brief is a biped with a "tennis-racket" on handR, a "swing" beat, and world "court".
- If the brief names an animal, the bodyPlan must match its anatomy. Never put an animal on a biped.
- A rider is a separate biped actor attached to the mount's back bone. The mount needs {"kind":"saddle","attach":"back"}.
- Proportions are multipliers around 1. Limb counts: quadruped 4, octopod 8, biped 2, blob 2.
- Duration 8000-10000ms. Use 4-6 beats. Base beats (idle/walk/trot) use layer "base" and may run under actions. Human actions include wave, point, think, shrug, clap, laugh, dance, bow, run, stretch, yawn, wink, stir, nod, jump, look. Do not overlap two action beats on the same actor.
- The palette must be harmonious. The world accent can be the brand color.
- Art direction is chunky flat vector: one solid body mass, rounded limbs, no outlines, no gradients, oversized eyes, solid blush. Pick a saturated skin colour and a cream/light belly in the same hue family; detail is a much darker version of skin.
- Use ONE actor unless the brief explicitly asks for a rider/mount or multiple characters. A mushroom, rock, plant, box or building is environment, not an actor; do not give it a face or a body plan.
- If the creature hides behind/in something, keep one actor and use hide then peek; the world suggests the object.
- Invent an original character. Do not reference an existing mascot or celebrity.`;

type Body = {
  prompt?: unknown;
  previous?: unknown;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';

  if (!prompt) {
    return NextResponse.json({ error: 'prompt required' }, { status: 400 });
  }

  const key = process.env.EXPLABS_API_KEY;
  const started = Date.now();
  const previous =
    body.previous && typeof body.previous === 'object' ? body.previous : undefined;

  if (key) {
    try {
      const model = process.env.CREATURE_MODEL || 'claude-haiku-4.5';
      const editBlock = previous
        ? `\n\nEDIT MODE. The current scene is below. Do not start over and do not change the cast unless the brief explicitly asks. Keep every actor id, bodyPlan, genome and attachment (a rider must stay attached to the mount's back bone). Keep the same art direction. Return the FULL updated scene JSON.
- "slower" / "faster": change score.duration and scale every beat's at/dur. Keep the same beats, and keep each actor's base beat running from 0 to the new duration.
- "night" / "day" / "garden" / "studio" / "meadow" / "forest" / "sunset" / "desert" / "winter": change world.preset only.
- "colour" / "color": change world.accent and/or the named actor's palette.
- A human note (hair, beard, outfit, presentation, body) changes human.* only; keep the same skeleton, palette, score and world.
- A small visual note (hat, scarf, glasses) changes the relevant genome/accessory only.
Current scene:\n${JSON.stringify(previous).slice(0, 7000)}`
        : '';

      const res = await fetch('https://api.experientiallabs.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM },
            {
              role: 'user',
              content: previous ? `Edit brief: ${prompt}${editBlock}` : `Brief: ${prompt}`,
            },
          ],
          temperature: previous ? 0.35 : 0.8,
          max_tokens: 1800,
        }),
        signal: AbortSignal.timeout(45_000),
      });

      if (!res.ok) throw new Error(`director ${res.status}`);
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) throw new Error('empty direction');

      const cleaned = content
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
      const parsed = JSON.parse(cleaned);
      const scene = guardEdit(previous, sceneFromUnknown(parsed, prompt), prompt);

      return NextResponse.json({
        scene,
        meta: {
          source: 'experiential',
          model,
          ms: Date.now() - started,
        },
      });
    } catch (error) {
      // Fall through to the local grammar. A dead API must never kill the demo.
      console.warn('hosted director failed', error);
    }
  }

  const scene = previous
    ? localEdit(previous, prompt) ?? localScene(prompt)
    : localScene(prompt);
  return NextResponse.json({
    scene,
    meta: {
      source: previous ? 'local-edit' : 'local',
      model: 'local-grammar',
      ms: Date.now() - started,
    },
  });
}
