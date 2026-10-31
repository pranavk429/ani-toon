import { NextResponse } from "next/server";

import { guardEdit } from "@/creature/edit";
import { localEdit, localScene } from "@/creature/local";
import { sceneFromUnknown, studioScene } from "@/creature/validate";
import type { Scene } from "@/creature/types";
import { getConfiguredProvider, stripCodeFences } from "@/lib/ai/provider";

export const maxDuration = 60;

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
  "objects": [{
    "id": string,
    "kind": "ball"|"star"|"plant"|"flower"|"cup"|"gift"|"heart"|"watering-can"|"pancake"|"racket"|"sparkle"|"cloud"|"orb"|"flower-pot"|"rocket"|"note",
    "label"?: string,
    "color": "#RRGGBB",
    "x": number,
    "y": number,
    "scale"?: number,
    "rotation"?: number,
    "layer"?: "back"|"front"
  }],
  "score": {"duration":number,"mood":string,"beats":[{"actor":string,"verb":"idle"|"look"|"greet"|"move"|"reach"|"celebrate"|"hide"|"interact"|"emote"|"walk"|"trot"|"gallop"|"rear"|"peek"|"wave"|"nod"|"shake"|"jump"|"swing"|"point"|"think"|"shrug"|"clap"|"laugh"|"dance"|"bow"|"run"|"stretch"|"yawn"|"wink"|"stir","at":number,"dur":number,"target":"viewer"|"left"|"right"|"up"|"down"|"prop"|"self","intensity":number,"layer":"base"|"action"}]}
}

Rules:
- A person is ALWAYS a biped with a "human" look. Fill every human field. Presentation is shape language, not a costume code: a feminine character can wear a suit or apron; a masculine character can wear a bright coat. Vary hair, jaw, brows, shoulders, hips, outfits and palettes across people. Never default every woman to a dress or every man to a suit.
- Body multipliers are around 1.0: shoulders 0.85-1.2, hips 0.85-1.2, waist 0.85-1.1, height 0.9-1.1. Hair volume 0.7-1.5.
- Hair color is palette.hair; skin is palette.skin; top is palette.cloth; bottom is palette.pants; collar/cuffs are palette.trim; accessories use palette.accent. Keep skin saturated and hair clearly darker or lighter than skin.
- A chef/cook/baker gets a "chef-hat", an apron top, and usually a scarf/neckerchief. A winter brief gets a beanie and a coat. A tennis brief is a biped with a "tennis-racket" on handR, a "swing" beat, and world "court". A footballer wears sport top, shorts, sneakers, and a "ball" object on the ground.
- If the brief names an animal, the bodyPlan must match its anatomy. Never put an animal on a biped.
- A rider is a separate biped actor attached to the mount's back bone. The mount needs {"kind":"saddle","attach":"back"}.
- Proportions are multipliers around 1. Limb counts: quadruped 4, octopod 8, biped 2, blob 2.
- Objects: Stage is 720x720, +Y is down. Ground is y: 520-580. Sky is y: 100-240. Place props naturally: e.g. a soccer ball on the ground next to a footballer {"id":"soccer-ball","kind":"ball","color":"#FFFFFF","x":520,"y":548,"scale":1,"layer":"front"}. Only add props if requested or suggested by the brief.
- Studio Rule: Characters are persistent. In edit mode, preserve actor ids, genomes, attachments, and objects unless explicitly requested to change or remove them.
- Duration 8000-10000ms. Use 4-6 beats. Base beats (idle/walk/trot) use layer "base" and may run under actions. Human actions include wave, point, think, shrug, clap, laugh, dance, bow, run, stretch, yawn, wink, stir, nod, jump, look. Do not overlap two action beats on the same actor.
- The palette must be harmonious. The world accent can be the brand color.
- Art direction is chunky flat vector: one solid body mass, rounded limbs, no outlines, no gradients, oversized eyes, solid blush. Pick a saturated skin colour and a cream/light belly in the same hue family; detail is a much darker version of skin.
- Use ONE actor unless the brief explicitly asks for a rider/mount or multiple characters.
- Invent an original character. Do not reference an existing mascot or celebrity.`;

/**
 * Compact studio prompt: only the persistent character genome, world and props.
 * The procedural score is replaced by studioScene(), so asking the model for
 * action beats here wastes latency and tokens.
 */
const STUDIO_SYSTEM = `You are ANI's character art director. Return ONLY one JSON object, no markdown, no commentary.

Schema:
{
  "title": string,
  "world": {"preset": "sky"|"garden"|"kitchen"|"night"|"studio"|"court"|"meadow"|"forest"|"sunset"|"desert"|"winter"|"ocean"|"autumn"|"rain"|"sakura", "accent": "#RRGGBB"},
  "actors": [{
    "id": string, "name": string, "species": string,
    "bodyPlan": "biped"|"quadruped"|"octopod"|"blob"|"custom",
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
    "accessories": [{"kind":"cowboy-hat"|"chef-hat"|"beanie"|"cap"|"glasses"|"scarf"|"saddle"|"reins"|"leaf-ears"|"tennis-racket"|"none","color":"#RRGGBB","attach":string}]
  }],
  "objects": [{"id":string,"kind":"ball"|"star"|"plant"|"flower"|"cup"|"gift"|"heart"|"watering-can"|"pancake"|"racket"|"sparkle"|"cloud"|"orb"|"flower-pot"|"rocket"|"note","label"?:string,"color":"#RRGGBB","x":number,"y":number,"scale"?:number,"rotation"?:number,"layer"?: "back"|"front"}]
}

Rules:
- A person is ALWAYS a biped with a complete "human" look. Fill every human field. Vary hair, jaw, brows, shoulders, hips, outfit and palette across prompts. Presentation is shape language, not a costume code.
- Palette: skin saturated; belly lighter than skin; detail much darker; eye and mouth dark; cloth/pants/trim coordinated. Hair uses palette.hair.
- Body multipliers near 1.0: shoulders/hips 0.85-1.2, waist 0.85-1.1, height 0.9-1.1. Hair volume 0.7-1.5.
- Accessories only when the prompt implies them (chef hat, beanie, cap, glasses, scarf, tennis racket). A helmet/space suit is expressed through palette + outfit ("suit"/"coat") and a round white cap/beanie, not a new rig.
- Stage is 720x720, +Y down. Ground y=520-580, sky y=100-240. Add requested props as objects with natural placement; a floating star is {"kind":"star","x":540,"y":230,"layer":"front"}.
- Use ONE actor unless the brief explicitly asks for a rider/mount or multiple characters.
- Invent an original character. No existing mascots or celebrities.`;

type Body = {
  prompt?: unknown;
  previous?: unknown;
  mode?: "new" | "edit" | "studio";
};

function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first >= 0 && last > first) {
      return JSON.parse(trimmed.slice(first, last + 1));
    }
    throw new Error("The character response was not valid JSON.");
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

  if (!prompt) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }

  const started = Date.now();
  const previous =
    body.previous && typeof body.previous === "object"
      ? (body.previous as Scene)
      : undefined;

  const mode = body.mode ?? (previous ? "edit" : "studio");
  const provider = getConfiguredProvider();

  if (provider) {
    try {
      const editBlock = previous
        ? `\n\nEDIT MODE. The current scene is below. Do not start over and do not change the cast unless the brief explicitly asks. Keep every actor id, bodyPlan, genome, attachment, and existing objects. Keep the same art direction. Return the FULL updated scene JSON.
- "slower" / "faster": change score.duration and scale every beat's at/dur. Keep the same beats, and keep each actor's base beat running from 0 to the new duration.
- "night" / "day" / "garden" / "studio" / "meadow" / "forest" / "sunset" / "desert" / "winter": change world.preset only.
- "colour" / "color": change world.accent and/or the named actor's palette.
- A human note (hair, beard, outfit, presentation, body) changes human.* only; keep the same skeleton, palette, score and world.
- A small visual note (hat, scarf, glasses, prop) changes the relevant genome/accessory/object only.
Current scene:\n${JSON.stringify(previous).slice(0, 7000)}`
        : "";

      const userPrompt = previous
        ? `Edit brief: ${prompt}${editBlock}`
        : `Brief: ${prompt}`;

      const output = await provider.generate({
        systemPrompt: mode === "studio" ? STUDIO_SYSTEM : SYSTEM,
        userPrompt,
        temperature: previous ? 0.35 : 0.8,
        maxOutputTokens: mode === "studio" ? 1800 : 2500,
      });

      const cleaned = stripCodeFences(output.text);
      const parsed = parseJsonLoose(cleaned);
      let scene = sceneFromUnknown(parsed, prompt);
      if (previous) {
        scene = guardEdit(previous, scene, prompt);
      }
      if (mode === "studio") {
        scene = studioScene(scene, 8000);
      }

      return NextResponse.json({
        scene,
        meta: {
          source: "ai",
          provider: output.provider.id,
          model: output.provider.model,
          ms: Date.now() - started,
        },
      });
    } catch (error) {
      console.warn("studio character hosted generation failed", error);
      // Fall through to deterministic local generation
    }
  }

  let scene: Scene = previous
    ? localEdit(previous, prompt) ?? localScene(prompt)
    : localScene(prompt);

  if (mode === "studio") {
    scene = studioScene(scene, 8000);
  }

  return NextResponse.json({
    scene,
    meta: {
      source: "local",
      model: "local-grammar",
      ms: Date.now() - started,
    },
  });
}
