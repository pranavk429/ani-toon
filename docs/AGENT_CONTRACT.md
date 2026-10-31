# ANI Studio — Agent Integration Contract

Read this before touching code. Repo: `/Users/pranav1296/Ani-toon/app`.
Branch: `feat/ani-ai-studio`. Do not commit, push, reset, or delete user files.

## Product

ANI is an AI-directed, deterministic vector animation studio. A prompt creates a
character scene or imports an SVG. A server-side Director emits a declarative
MotionPlan (Motion DSL v1). A deterministic runtime evaluates it at any timestamp.
Users revise in natural language, inspect a real timeline, edit keyframes, save
projects and export.

Two scene sources share one runtime:

1. **Character scene** (`src/creature/*`): procedural storybook characters with a
   generated skeleton, plus free-standing `SceneObject` props.
2. **Imported SVG** (`src/lib/svg/*`): sanitized scene graph; elements are animated
   by stable element ID.

## Frozen contracts (do not redefine)

- `src/lib/animation/types.ts` — MotionDocument / MotionTrack / targets / properties.
  Target kinds: `{kind:"svg",elementId}`, `{kind:"character",actorId,boneId}`,
  `{kind:"object",objectId}`. Document `targetKind` is `"svg" | "character"`.
  Character documents may mix bone, face and object tracks.
- `src/lib/animation/targets.ts` — target keys/labels.
- `src/lib/ai/contracts.ts` — Director request/response/provider types.
- `src/lib/studio/contracts.ts` — IllustrationStyle, CharacterGenome, AniProject.
- `src/creature/types.ts` — Scene, Actor, Genome, SceneObject.
- `src/creature/motion.ts` — `characterContextForScene`, `validationContextForScene`,
  `applyMotionToScene` (renderer already calls it).
- `src/lib/svg/types.ts` — SceneGraph.
- `src/creature/objects.ts` + `objectLayer.tsx` — object geometry/renderer.
- `src/lib/animation/evaluate.ts` — `evaluateDocument(doc, seconds)`.
- `src/lib/animation/validate.ts` — `validateMotionDocument(raw, context)`.

## Verified baseline

```bash
pnpm typecheck                 # passes
pnpm vitest run tests/animation tests/svg tests/ui  # 148 passing
```

`pnpm lint` currently has 5 pre-existing errors in user work (creature page,
BriefLibrary, ScenePlayer). Fix only if your task owns QA/lint.

## Commands

```bash
pnpm typecheck
pnpm vitest run <paths>
pnpm lint
pnpm build
```

No new dependencies. Do not edit `package.json`, `pnpm-lock.yaml`, `next.config.ts`,
`README.md`, or `src/lib/animation/**` unless your task explicitly owns it.

## API contract (backend workstream)

`POST /api/animation/direct`
Input: `AnimationDirectionRequest` (`version:1`, `action:"generate"|"revise"`,
`instruction`, `targetKind`, `scene?` or `character?`, `currentDocument?`,
`selectedElementIds?`, `selectedObjectIds?`, `history?`).
Output: `AnimationDirectionResponse`.

`POST /api/studio/character`
Input: `{ prompt: string, previous?: Scene, mode?: "new"|"edit"|"studio" }`.
Output: `{ scene: Scene, meta: { source: "ai"|"local", provider?, model?, ms } }`.
For `mode:"studio"`, force `studioScene(scene, 8000)` so only the base idle layer
runs; the motion plan owns the action.

Provider env: `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` (future deployed gateway),
`EXPLABS_API_KEY`, `ANIMATION_DIRECTOR_MODEL` / `CREATURE_MODEL`,
`GEMINI_API_KEY`, `ANIMATION_DIRECTOR_PROVIDER`, and the local-only
`AGY_BIN` / `AGY_MODEL` Gemini-subagent provider (`agy`, disabled on Vercel).
Never expose keys. Never return a canned performance labelled as AI. Local
fallback must be labelled `source:"fallback"` (motion) or `source:"local"`
(character). The `agy` provider is real AI output for local verification, not a
fallback; it is not available in production.

## Reports

Every worker writes `agent-reports/<workstream>.md` with: files inspected, files
changed, features, interfaces, dependencies, tests run and results, limitations,
integration instructions. Keep the report factual. Do not claim untested features.

## File ownership

Only edit files inside your workstream. If you need a change elsewhere, write the
exact request in your report; do not edit another worker's files.
