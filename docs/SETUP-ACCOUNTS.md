# Step 0 — Accounts, platforms and secrets (founder checklist)

Status: **founder action required**. The code runs locally in mock mode without any of these accounts
(`AI_PROVIDER_MODE=mock`, `STORAGE_DRIVER=local`, `QUEUE_DRIVER=inline`). Real staging needs the items below.

Never paste secrets into chat, git, screenshots or issues. Put them only in the platform's environment settings
or in your local, git-ignored `.env.local` files.

## 1. Local machine (Windows)
| Tool | Status on this machine (2026-10-30) | Action |
|---|---|---|
| Node.js 22+ | v24 installed | none |
| pnpm 10 | installed globally via npm | none |
| Git | installed | none |
| Docker Desktop + WSL2 | **missing** | Install from docker.com; required for local Supabase (`supabase start`) and Redis |
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
- **Vercel (web server):** Supabase URL/anon/service-role, `REDIS_URL` (enqueue only), S3 (signing only), Paystack secret, Sentry, `APP_BASE_URL`, `ALLOWED_ORIGINS`, `ADMIN_EMAILS`.
- **Railway (worker):** Supabase service-role, `REDIS_URL`, S3, OpenAI, ElevenLabs, Sentry, render limits, spend caps.
- **Supabase Edge Functions:** not used by this architecture.

## 4. After accounts exist
1. Copy `.env.example` → `apps/web/.env.local` and `apps/worker/.env` and fill values.
2. `pnpm dlx supabase link --project-ref <staging-ref>` then `pnpm dlx supabase db push`.
3. Set `AI_PROVIDER_MODE=live`, `STORAGE_DRIVER=s3`, `QUEUE_DRIVER=bullmq`.
4. Run `pnpm verify:providers` (worker) to check keys without spending more than a few cents.
