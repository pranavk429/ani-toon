# Environment Variables Guide

This document catalogs every environment variable recognized by ANI and Anitoon, detailing its purpose, expected format, default values, sensitivity, and troubleshooting steps.

---

## Variable Registry

| Variable Name | Scope | Required / Optional | Default Value | Description |
|---|---|---|---|---|
| `AI_BASE_URL` | Server-only | Optional* | None | Base URL of the deployed OpenAI-compatible API gateway (for example `https://gateway.example.com/v1`). This is the intended production path. |
| `AI_API_KEY` | Server-only | Optional* | None | Bearer token for the API gateway. Never expose to the browser. |
| `AI_MODEL` | Server-only | Optional* | `gemini-3.8-flash` | Model name sent to the API gateway. |
| `AGY_BIN` | Server-only | Optional | `/Applications/cmux.app/Contents/Resources/bin/agy` | Path to the local Gemini subagent CLI. Used only by `ANIMATION_DIRECTOR_PROVIDER=agy` for local verification; disabled on Vercel. |
| `AGY_MODEL` | Server-only | Optional | `gemini-3.8-flash-low` | Model passed to the local Gemini CLI. |
| `AGY_TIMEOUT_MS` | Server-only | Optional | `180000` | Bounded timeout for one local Gemini CLI generation. |
| `EXPLABS_API_KEY` | Server-only | Optional* | None | API key for Experiential Labs (OpenAI-compatible) endpoint for AI character direction. |
| `GEMINI_API_KEY` | Server-only | Optional* | None | API key for Google Gemini model inference for director and character generation. |
| `ANIMATION_DIRECTOR_PROVIDER` | Server-only | Optional | `gateway` if configured, else `agy` locally, else first configured key | Explicit provider selection: `"gateway"`, `"agy"`, `"experiential"`, or `"gemini"`. |
| `ANIMATION_DIRECTOR_MODEL` | Server-only | Optional | `claude-haiku-4.5` (Experiential) | Specific LLM model identifier for animation motion plan direction. |
| `CREATURE_MODEL` | Server-only | Optional | `claude-haiku-4.5` | Specific LLM model identifier for creature character scene generation. |
| `GEMINI_MODEL` | Server-only | Optional | `gemini-2.5-flash` | Specific Gemini model identifier when using Gemini as provider. |
| `NEXT_PUBLIC_APP_URL` | Client & Server | Optional | `http://localhost:3000` | Canonical origin URL of the running application. |
| `NEXT_PUBLIC_SITE_URL` | Client & Server | Optional | `https://pranavk429.github.io` | Base URL used for OpenGraph metadata and canonical links. |
| `NEXT_PUBLIC_DIRECTOR_ENDPOINT` | Client & Server | Optional | `/api/animation/direct` | Custom endpoint URL for motion direction requests if proxied or external. |
| `NEXT_PUBLIC_BASE_PATH` | Client & Server | Optional | `""` (empty) | Subpath prefix for static hosting (automatically set to `"/ani-toon"` by Pages build). |
| `GITHUB_PAGES` | Build-time only | Optional | None | When set to `"true"`, configures Next.js for static HTML export (`out/`). **Breaks server API routes**. |

*\*Note: If no gateway, key, or local Gemini CLI is available, the application operates strictly in local deterministic fallback mode. It will never fail to boot, but responses will be labeled `source: "fallback"` or `source: "local"` and must not be presented as AI-generated. The `agy` provider is real local AI output for verification, but is disabled on Vercel and must not be used in production.*

---

## Security & Secrets Warning

> [!CAUTION]
> **Server-Only Variables Must Never Be Exposed to the Client!**
> 
> Variables without the `NEXT_PUBLIC_` prefix (such as `EXPLABS_API_KEY` and `GEMINI_API_KEY`) are server-only. They are read exclusively within Next.js API route handlers (`src/app/api/**`) and server-side utilities.
> 
> - Never prefix API keys with `NEXT_PUBLIC_`.
> - Never reference `process.env.EXPLABS_API_KEY` or `process.env.GEMINI_API_KEY` in client components (`"use client"`), hooks, or canvas/SVG renderers.
> - Never commit `.env`, `.env.local`, or any file containing real credentials to version control.
> - Health check endpoints (such as `GET /api/animation/direct`) must only report provider status/availability and must never return secret keys.

---

## Safe Configuration Examples

### Local Development (`.env.local`)

```bash
# Minimal local setup with Experiential Labs
EXPLABS_API_KEY=sk-exp-sample-key-1234567890abcdef
ANIMATION_DIRECTOR_PROVIDER=experiential
ANIMATION_DIRECTOR_MODEL=claude-haiku-4.5
CREATURE_MODEL=claude-haiku-4.5

# Public URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### API Gateway (intended deployment path)

```bash
AI_BASE_URL=https://gateway.example.com/v1
AI_API_KEY=replace-with-gateway-token
AI_MODEL=gemini-3.8-flash
ANIMATION_DIRECTOR_PROVIDER=gateway

NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
```

### Local Verification Without an API Key (Gemini subagent CLI)

```bash
ANIMATION_DIRECTOR_PROVIDER=agy
AGY_MODEL=gemini-3.8-flash-low
AGY_TIMEOUT_MS=180000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

The server spawns the installed `agy` CLI, which uses the signed-in Gemini
account. It returns real model JSON, so the studio can be tested end-to-end
without placing a key in the app. This provider is unavailable when `VERCEL` is
set.

### Alternative: Google Gemini Provider

```bash
# Minimal setup using Google Gemini
GEMINI_API_KEY=AIzaSySampleKeyPlaceholder123456789
ANIMATION_DIRECTOR_PROVIDER=gemini
GEMINI_MODEL=gemini-2.5-flash

# Public URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Offline / Fallback-Only Mode

To run the application entirely offline without third-party LLM dependencies, leave the provider keys empty or undefined. The studio will automatically engage local deterministic fallback synthesis:

```bash
# No API keys defined
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

## Troubleshooting Missing or Malformed Configurations

### 1. Studio Reports `source: "fallback"` or `source: "local"`
- **Cause**: No active provider API key was detected in the runtime environment, or the selected provider encountered a credential/rate error.
- **Resolution**:
  - Verify that `.env.local` exists in `/Users/pranav1296/Ani-toon/app/` (or the repository root in production).
  - Check that the key name is spelled exactly `EXPLABS_API_KEY` or `GEMINI_API_KEY`.
  - Restart the development server (`pnpm dev`) so Next.js reloads the environment file.

### 2. HTTP 402 or 429 Quota / Rate-Limit Errors
- **Cause**: The API key has exhausted its credit quota or hit a requests-per-minute ceiling.
- **Resolution**:
  - Check the provider dashboard balance.
  - If using Gemini and quota is exhausted, switch `ANIMATION_DIRECTOR_PROVIDER=experiential` with an active Experiential Labs key.
  - In automated CI or smoke environments, verify the app gracefully reverts to local fallback instead of crashing.

### 3. API Routes Return 404 on Deployment
- **Cause**: The application was built with `GITHUB_PAGES=true` or deployed to a static file host (like GitHub Pages). Static exports do not support Next.js dynamic API routes.
- **Resolution**:
  - Deploy to Vercel or a Node.js server container.
  - Ensure `GITHUB_PAGES` is unset or `false` in the deployment environment.

### 4. Client Cannot Reach Director Endpoint
- **Cause**: `NEXT_PUBLIC_APP_URL` or `NEXT_PUBLIC_DIRECTOR_ENDPOINT` is misconfigured or points to an origin with CORS restrictions.
- **Resolution**:
  - Leave `NEXT_PUBLIC_DIRECTOR_ENDPOINT` blank to use the relative `/api/animation/direct` path on the same origin.
  - Ensure `NEXT_PUBLIC_APP_URL` matches the deployed hostname.
