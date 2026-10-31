# Deployment Guide

This guide covers production deployment of ANI and Anitoon to **Vercel** (for full dynamic capabilities including API routes) and clarifies the boundary with **GitHub Pages** (the static clip-library showcase).

---

## 1. Architecture & Platform Requirements

The repository contains two distinct deployment profiles:

1. **Vercel (Recommended for ANI Studio & API Routes)**:
   - Full Next.js Node.js serverless runtime.
   - Required to run `POST /api/animation/direct`, `POST /api/studio/character`, and `POST /api/direct`.
   - Supports background evaluation, streaming, and provider key protection.
2. **GitHub Pages (Static Showcase Only)**:
   - Deploys static HTML export to `https://pranavk429.github.io/ani-toon/`.
   - Built with `GITHUB_PAGES=true` which invokes `next build` with `output: "export"`.
   - **Does not run API routes** and cannot host the server AI director.

---

## 2. Deploying to Vercel

### Option A: Vercel Dashboard (Recommended)

1. **Import the Repository**:
   - Log in to your [Vercel Dashboard](https://vercel.com/dashboard).
   - Click **Add New...** → **Project**.
   - Select your Git provider (GitHub) and choose the `ani-toon` repository.
2. **Configure the Project**:
   - **Framework Preset**: Next.js
   - **Root Directory**: `app` (if in a monorepo setup) or `./` (repository root).
   - **Build Command**: `pnpm build`
   - **Output Directory**: Automatically determined (`.next`).
   - **Install Command**: `pnpm install`
3. **Set Environment Variables**:
   Under **Environment Variables**, configure the OpenAI-compatible gateway used for submission:
   - `AI_BASE_URL`: Gateway base URL (for example `https://gateway.example.com/v1`).
   - `AI_API_KEY`: Gateway bearer token. Server-only; never expose it to the client.
   - `AI_MODEL`: Gateway model name (for example `gemini-3.8-flash`).
   - `ANIMATION_DIRECTOR_PROVIDER`: `gateway`.
   - `NEXT_PUBLIC_APP_URL`: Set to your production domain (e.g., `https://anitoon.vercel.app`).
   - `NEXT_PUBLIC_SITE_URL`: Set to your production domain.

   The direct `EXPLABS_API_KEY` / `GEMINI_API_KEY` providers remain supported as alternatives. The local `agy` provider is disabled automatically on Vercel.
4. **Deploy**:
   - Click **Deploy**. Vercel will build and deploy the application.

---

### Option B: Vercel CLI

1. **Install Vercel CLI**:
   ```bash
   pnpm add -g vercel
   ```
2. **Log In**:
   ```bash
   vercel login
   ```
3. **Link & Deploy Preview**:
   ```bash
   vercel
   ```
   Follow the prompts to link the project and set build settings.
4. **Add Secrets & Environment Variables**:
   ```bash
   vercel env add AI_BASE_URL production
   vercel env add AI_API_KEY production
   vercel env add AI_MODEL production
   vercel env add ANIMATION_DIRECTOR_PROVIDER production
   vercel env add NEXT_PUBLIC_APP_URL production
   vercel env add NEXT_PUBLIC_SITE_URL production
   ```
   Set `ANIMATION_DIRECTOR_PROVIDER=gateway` when prompted.
5. **Deploy to Production**:
   ```bash
   vercel --prod
   ```

---

## 3. Serverless Functions Configuration

`vercel.json` is intentionally minimal and valid:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs"
}
```

The two generation routes set their own execution budget with route segment config:

- `src/app/api/animation/direct/route.ts` — `export const maxDuration = 60`
- `src/app/api/studio/character/route.ts` — `export const maxDuration = 60`

*Note: A duration of up to 60 seconds is permitted on Vercel Pro accounts to comfortably accommodate LLM synthesis and single-repair passes without client timeouts.*

---

## 4. Verification Checklist for a Deployed URL

After deployment completes, perform these checks against your live URL (e.g., `https://<your-project>.vercel.app`):

- [ ] **HTTP 200 on Landing Page**: Open `https://<your-project>.vercel.app` and confirm the clip showcase loads.
- [ ] **Studio Page Accessible**: Open `https://<your-project>.vercel.app/studio` (or `/creature`) and verify the studio canvas mounts cleanly.
- [ ] **API Health Endpoint**:
  ```bash
  curl -s https://<your-project>.vercel.app/api/animation/direct
  ```
  Expected response (the model value must match `AI_MODEL`):
  ```json
  {"ok":true,"provider":{"configured":true,"provider":"gateway","model":"gemini-3.8-flash"}}
  ```
- [ ] **Direct Generation Test**:
  ```bash
  curl -X POST https://<your-project>.vercel.app/api/animation/direct \
    -H "Content-Type: application/json" \
    -d '{"version":1,"action":"generate","instruction":"Wave hand","targetKind":"character","character":{"styleId":"anitoon-storybook-v1","actors":[],"bones":[],"objects":[],"world":{"preset":"studio","accent":"#FFD45E"},"notes":[]}}'
  ```
- [ ] **Fallback Verification (If Credentials Missing)**:
  If no API keys are provided in the environment, the endpoint must return a valid document with `source: "fallback"`, never failing or throwing a 500 error.
- [ ] **Export Verification**:
  In the browser, click export to verify `.ani.json`, SVG, and PNG generation without client-side console errors.

---

## 5. Preview Environments & Custom Domains

- **Preview Deployments**: Every pull request automatically generates an isolated preview URL on Vercel. Ensure environment variables are assigned to `Preview` as well as `Production` in the Vercel dashboard if you want PRs to test live AI calls.
- **Custom Domain**: In Vercel Project Settings → **Domains**, add your domain (e.g. `studio.example.com`). Add the recommended CNAME or A records to your DNS provider. Once issued, update `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_SITE_URL` to match.

---

## 6. Honest Fallback Notice

> [!NOTE]
> If third-party AI provider credentials are unavailable or rate-limited, ANI operates gracefully using local deterministic generation. The UI and API responses will explicitly indicate `source: "fallback"` or `source: "local"`. Never misrepresent fallback animations as AI-generated performances.
