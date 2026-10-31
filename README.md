# Anitoon — Project One

**Describe a person. Watch them move.**

Anitoon is a human motion compiler and AI-directed vector animation studio. One sentence
becomes a **human genome** — presentation, hair, face, body, outfit — plus a performance
score. A local compiler builds the skeleton and performs every beat at 60fps. A second
studio mode animates imported SVGs with the same deterministic runtime.

- **Live:** https://pranavk429.github.io/ani-toon/
- **Repo:** https://github.com/pranavk429/ani-toon
- **Local:** http://localhost:3000

Built for the **Wispr No Hands Challenge** by WeMakeDevs — **Track 2: No-Code**, October 2026.

## The thesis

> **The AI is the art director. The compiler is the animator.**

The model writes a genome and a timed score. The compiler builds the skeleton, attaches
actors, and performs every frame. It is construction, not retrieval from a fixed gallery.

The human demo ships with:

- **16-bone human rig** shared by the whole cast
- **9 hair styles · 9 outfit shapes · 9 worlds**
- **12 readable human actions** — wave, point, think, shrug, clap, laugh, dance, bow,
  walk, jump, stretch, tennis swing
- **7-person cast** across masculine, feminine and androgynous presentations
- **hard-cel flat vector art** — solid masses, no outlines, flat fills, oversized eyes
- **offline fallback** — the keyword/edit grammar still works without a provider

Read `HANDOFF.md` for the architecture and `HUMAN-DEMO.md` for the human-demo scope.

## Routes

| Route | What it does |
|---|---|
| `/` | Landing page — “Describe a person. Watch them move.” |
| `/creature` | **Human compiler** — prompt or voice → genome + score → live 60fps stage, skeleton view, presets, edit, share, JSON export |
| `/studio` | **ANI Studio** — AI-directed character scenes and imported SVGs, timeline, track inspector, project storage, PNG/SVG/WebM/JSON export |
| `/toon` | Deterministic viewer for the original clip specs (`?spec=`, `?t=`, `?sheet=`) |

API routes (server builds only):

- `POST /api/direct` — character scene from a brief
- `POST /api/studio/character` — studio character generation
- `POST /api/animation/direct` — Motion DSL v1 direction and revision

## Architecture

```text
prompt / voice
      ↓
AI Director (server-side, structured JSON)
      ↓
human genome + score  ·  SVG scene graph
      ↓
deterministic compiler / Motion DSL v1
      ↓
validator + bounded repair
      ↓
live 60fps SVG preview ↔ natural-language revision
      ↓
share link · JSON · animated SVG · PNG · WebM
```

Key folders:

```text
src/app/                  Next.js routes and API handlers
src/components/anitoon/   Landing page, hero, brief library, voice section
src/components/ani-studio/ ANI Studio UI, stage, transport, timeline, chat
src/creature/             Human/creature genome, skeleton, renderer, actions, worlds
src/lib/animation/        Motion DSL v1, evaluator, validator, SMIL export
src/lib/svg/              Sanitized SVG import and scene graph
src/lib/ai/               Director contracts, provider abstraction, prompt, fallback
src/lib/project-store/    IndexedDB project persistence
src/lib/studio-export/    JSON / SVG / PNG / WebM export pipelines
src/toon/                 Original SVG motion engine
public/                   Specs, MP4s, posters and static assets
docs/                     Architecture, environment, art style and agent contract
```

## Run locally

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. Use `pnpm build && pnpm start` for a production server.

Checks:

```bash
pnpm typecheck
pnpm vitest run
pnpm lint
pnpm build
```

Current baseline (2026-10-31, `main`):

- `pnpm typecheck` — passes
- `pnpm vitest run` — 229 passed, 6 skipped
- `pnpm lint` — 0 errors (warnings only)
- `pnpm build` — passes
- static Pages build (`GITHUB_PAGES=true`) — passes

## Environment

Copy `.env.example` to `.env.local` (gitignored) and add a provider:

- `GEMINI_API_KEY` / `GEMINI_MODEL`
- `EXPLABS_API_KEY`
- `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` for an OpenAI-compatible gateway
- `ANIMATION_DIRECTOR_PROVIDER=gateway` (or `agy` for local Gemini CLI verification)

Never commit keys. See `docs/ENVIRONMENT.md` for the full matrix.

Without a provider, `/creature` runs the local deterministic grammar and labels the
result as fallback. `/studio` needs the server API routes for live generation.

## Deploy

**GitHub Pages** — push to `main`. `.github/workflows/pages.yml` removes `src/app/api`,
builds with `GITHUB_PAGES=true` and `basePath: /ani-toon`, then deploys `out/`.

> Pages is static: live AI generation is unavailable there. `/creature` falls back to the
> local grammar; `/studio` needs a server host.

**Vercel / any Next host** — import the repo, add the environment variables, and run
`pnpm build`. `vercel.json` is included. This is the deployment that enables the full AI
studio.

## Status

`main` is the source of truth. It contains the human compiler and ANI Studio. The old
three-clip motion library is preserved in history at commit `10bd736`.

Known limitations:

- The static GitHub Pages deployment cannot run `/api`, so live AI is only available on a
  server host such as Vercel.
- `/studio` and `/creature` share the Motion DSL runtime but have separate UI flows.
- The original `qa/` and `wip-snapshots/` folders are evidence from earlier iterations,
  not runtime code.

## Stack

- Next.js 16 (App Router, API routes, static export) · React 19 · TypeScript
- Tailwind CSS v4 with measured design tokens
- `next/font/local` for Switzer
- Hand-built SVG engine, Motion DSL v1, deterministic evaluator
- IndexedDB project storage; no database, no accounts, no analytics

## Credits

- **Challenge:** [Wispr Flow](https://wisprflow.ai/) × [WeMakeDevs](https://www.wemakedevs.org/wispr)
- **Design reference:** [Mobbin](https://mobbin.com/) — aesthetic study only
- **Typeface:** Switzer via Fontshare (ITF Free Font License)
- **Icons:** Lucide
- **Motion method:** inspired by [rossark0/rossark-motion-skill](https://github.com/rossark0/rossark-motion-skill) (MIT)

## License

MIT — see [LICENSE](LICENSE).
