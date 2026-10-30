# Step 0 — Accounts, platforms and secrets (founder checklist)

Status: **founder action required**. The code runs locally without any of these accounts
(`AUTH_DRIVER=dev`, `AI_PROVIDER_MODE=mock`, `STORAGE_DRIVER=local`, `QUEUE_DRIVER=postgres`, local Postgres via
`pnpm db:local`). Real staging needs the items below. Local quick start: see `docs/RUNBOOKS.md#local-development`.

Never paste secrets into chat, git, screenshots or issues. Put them only in the platform's environment settings
or in your local, git-ignored `.env.local` files.

## 1. Local machine (Windows)
| Tool | Status on this machine (2026-10-30) | Action |
|---|---|---|
| Node.js 22+ | v24 installed | none |
| pnpm 10 | installed globally via npm | none |
| Git | installed | none |
| Docker Desktop + WSL2 | missing | Optional. Not needed for local dev (PGlite + Postgres-polling queue). Useful to test BullMQ locally (`docker compose up -d redis`) or to build the worker image |
| Supabase CLI | missing | `pnpm dlx supabase --version` works without install; or `scoop install supabase` |
| FFmpeg | not required | Remotion v4 ships its own ffmpeg/ffprobe binaries |

## 2. Platforms, in order
| # | Platform | What to create | Variables produced | Where they go |
|---|---|---|---|---|
| 1 | GitHub (or Cursor Origin) | Private repo `minkflow`; push this folder | — | — |
| 2 | Supabase | Projects `minkflow-staging`, `minkflow-prod` (region close to users) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` | Vercel + Railway (service role: server/worker only) |
| 3 | Resend | Account + verified sending domain (after domain is owned) | `RESEND_API_KEY` → entered as SMTP in Supabase Auth settings | Supabase dashboard only |
| 4 | OpenAI | API key + monthly spend limit in billing settings | `OPENAI_API_KEY`, `OPENAI_MODEL_SCRIPT`, `OPENAI_MODEL_STORYBOARD` | Railway (worker) |
| 5 | ElevenLabs | Paid plan with commercial license; pick 4–6 default voices | `ELEVENLABS_API_KEY`, `ELEVENLABS_MODEL_ID`, `ELEVENLABS_VOICE_IDS` | Railway (worker) |
| 6 | Cloudflare R2 | Buckets `minkflow-dev`, `minkflow-staging`, `minkflow-prod` (private); API token scoped to them; CORS allowing `APP_BASE_URL` PUT/GET | `S3_ENDPOINT`, `S3_REGION=auto`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Vercel + Railway |
| 7 | Railway | Project with environments `staging`/`production`; services: `worker` (Dockerfile `apps/worker/Dockerfile`) and `redis` | `REDIS_URL` | Vercel + Railway |
| 8 | Vercel | Project linked to repo, root `apps/web`; Preview = staging vars, Production = prod vars | `APP_BASE_URL`, `ALLOWED_ORIGINS` | Vercel |
| 9 | Paystack | Business verification + request **USD settlement** | `PAYSTACK_SECRET_KEY`, `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`; webhook URL `${APP_BASE_URL}/api/webhooks/paystack` | Vercel |
| 10 | Sentry | Projects `minkflow-web`, `minkflow-worker` | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` (CI only) | Vercel + Railway |
| 11 | Remotion | Purchase Company License at remotion.pro | `REMOTION_LICENSE_KEY` (TO VERIFY whether required at runtime) | Railway |
| 12 | Domain | **Not yet** — wait for trademark/domain checks (doc 14) | — | — |

## 3. Variable placement summary
- **Browser (public):** only `NEXT_PUBLIC_*`.
- **Vercel (web server):** `DATABASE_URL` (pooled), Supabase URL/anon key (Auth only), `AUTH_DRIVER=supabase`, `QUEUE_DRIVER` + `REDIS_URL` (publish only), S3 (URL signing only), Paystack secret, Sentry, `APP_BASE_URL`, `ALLOWED_ORIGINS`, `ADMIN_EMAILS`. The web app does **not** need OpenAI/ElevenLabs keys.
- **Railway (worker):** `DATABASE_URL`, `QUEUE_DRIVER` + `REDIS_URL`, S3, OpenAI, ElevenLabs, Sentry, render limits, spend caps, `JOB_LEASE_SECONDS`.
- `SUPABASE_SERVICE_ROLE_KEY` is currently unused by code (all DB access is via `DATABASE_URL`, see ADR-017); do not deploy it until something needs it.
- **Supabase Edge Functions:** not used by this architecture.

## 4. After accounts exist
1. Locally: copy `.env.example` → `.env.local` at the repository root (web and worker both read it) and fill values. On Vercel/Railway, set the same names in each platform's environment settings.
2. `pnpm dlx supabase link --project-ref <staging-ref>` then `pnpm dlx supabase db push` (applies `supabase/migrations`).
3. Set `APP_ENV=staging`, `AUTH_DRIVER=supabase`, `AI_PROVIDER_MODE=live`, `STORAGE_DRIVER=s3`, `QUEUE_DRIVER=bullmq`.
4. Run `pnpm verify:providers` to check OpenAI/ElevenLabs keys, model names and voice ids (well under US$0.05).
5. In Supabase Auth settings: Site URL = `APP_BASE_URL`; redirect URL `${APP_BASE_URL}/auth/callback`; custom SMTP (Resend).
6. Follow `docs/RUNBOOKS.md#staging-deploy` and then `docs/BETA-CHECKLIST.md`.
