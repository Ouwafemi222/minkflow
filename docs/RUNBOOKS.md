# Runbooks

Operational procedures for Minkflow. Commands are for PowerShell on Windows unless noted. Never paste secrets
into tickets or chat; reference the platform's environment settings instead.

## Local development

Prerequisites: Node 22+, pnpm 10 (`corepack` is optional; a global pnpm works). No Docker needed.

1. `pnpm install`
2. Copy `.env.example` to `.env.local` at the repository root. Set `DEV_AUTH_SECRET` and `LOCAL_STORAGE_SECRET`
   to random strings (16+ characters). Add your email to `ADMIN_EMAILS` to see `/studio/admin`.
3. Three terminals:
   - `pnpm db:local` — PGlite Postgres on `127.0.0.1:54329`, data in `.data/pglite`, migrations applied on start.
   - `pnpm dev:worker` — job worker (mock AI/TTS, local storage, Postgres polling). Health: `http://localhost:8081/readyz`.
   - `pnpm dev:web` — Next.js on `http://localhost:3000`.
4. Sign in at `/login` with any email (dev auth; no email is sent). New accounts get the 60-credit signup grant.

Reset local data: stop all three processes, then delete the `.data` folder in File Explorer (it holds only local
database files, storage objects and e2e output).

Useful checks:

| Command | What it does |
|---|---|
| `pnpm typecheck` / `pnpm test` | All packages (DB tests use in-process PGlite with the real migrations and RLS). |
| `pnpm --filter @minkflow/web test:e2e` | Playwright browser tests + screenshots on an isolated stack (ports 3100/8091/54339). First run: `pnpm --filter @minkflow/web exec playwright install chromium`. |
| `pnpm e2e:local` | Full pipeline with the real Remotion renderer (script → storyboard → voice → preview → render + QC). ~3–4 minutes. |
| `pnpm render:fixtures` | Renders golden fixture videos and runs MP4 QC. |
| `pnpm --filter @minkflow/render test:golden` | Golden-frame comparison (per-platform baselines). |

## Staging deploy

Prerequisites: accounts from `docs/SETUP-ACCOUNTS.md`, Remotion Company License purchased (ADR-007).

1. Database: `pnpm dlx supabase link --project-ref <staging-ref>`, then `pnpm dlx supabase db push`.
   Verify V-15 (role switching) by signing in on staging and loading `/studio` (a failure shows as HTTP 500 on
   every studio page with a Postgres permission error in the web logs).
2. Storage: create private R2 bucket; CORS: allow `GET, PUT` from `APP_BASE_URL`; add lifecycle rules as defence in
   depth for ADR-011 (prefix `ws/` objects older than 31 days). The retention sweep remains the primary mechanism.
3. Worker (Railway): service from `apps/worker/Dockerfile` (build context = repository root), add a Redis service,
   set worker variables (see SETUP-ACCOUNTS §3), health check path `/healthz`, readiness `/readyz`.
   Start with `RENDER_CONCURRENCY=1` and measure memory (V-08).
4. Web (Vercel): root directory `apps/web`, framework Next.js, set web variables. `APP_ENV=staging`.
5. `pnpm verify:providers` from a machine with the staging worker variables.
6. Smoke test: sign in, create a 60-second video from a topic, approve, build storyboard, generate voice, preview,
   render, download. Check `/studio/admin` for spend and failed jobs.

## Rolling back the web app

Vercel → Deployments → previous deployment → "Promote to Production". The web app is stateless.

## Rolling back the worker

Railway → worker service → Deployments → redeploy the previous image. Running jobs on the stopped instance stop
heartbeating; after `JOB_LEASE_SECONDS` the maintenance loop (`sweep_stuck_jobs`) re-queues them (or fails them
with a refund once attempts are exhausted). No manual action is needed unless jobs remain `running` with an
expired lease for more than 5 minutes — then check `/studio/admin` "Stuck running jobs" and the worker logs.

## Database rollback

Migrations are forward-only SQL files in `supabase/migrations`. To undo a bad migration:

1. Stop the worker (scale to 0) so no jobs are claimed mid-change. The web app can stay up (writes may fail briefly).
2. Write a new migration that reverses the change (e.g. re-create the old function body, drop the new column).
   Never edit or delete an already-applied migration file.
3. Test it locally: `pnpm db:local` against a copy of the data, then `pnpm test`.
4. `pnpm dlx supabase db push` to staging, smoke test, then production.
5. If data was corrupted: restore with Supabase point-in-time recovery to a **new** project (see the backup
   drill), verify, then switch `DATABASE_URL`/Supabase keys. Credit ledger rows are append-only; corrections are
   made with `adjustment` entries via `grant_credits`, never by updating or deleting rows.

## Backup and restore drill

Run before the beta and then monthly. Record date, duration and result in `docs/CHANGELOG.md`.

1. Supabase dashboard → Database → Backups: confirm daily backups exist (PITR if on a plan that includes it).
2. Restore the latest backup into a **new** staging project (never over production).
3. Point a local checkout at it (`DATABASE_URL` in `.env.local`, `AUTH_DRIVER=supabase` with that project's keys)
   and check: a known user can sign in; their projects list matches; `select sum(amount) from credit_ledger group by
   workspace_id` matches the source for 3 sampled workspaces; RLS still isolates users (sign in as a second user).
4. R2 objects are not included in database backups. Confirm a sampled final render's `storage_key` still exists in
   the bucket; expired objects are expected to be missing (ADR-011).
5. Delete the restored project. Target restore time: under 60 minutes.

## Stuck or failing jobs

- `/studio/admin` lists failed jobs (dead-letter) with error codes and stuck running jobs.
- Users can retry failed jobs from the studio; retries never double-charge (the failed job's reservation was
  already released, and the retry creates a new reservation).
- `SPEND_CAP_REACHED`: the platform or workspace daily cap (`PLATFORM_DAILY_SPEND_CAP_USD`,
  `WORKSPACE_DAILY_SPEND_CAP_USD`) was hit; jobs back off for 15 minutes. Raise the cap only after checking
  `/studio/admin` "Top spend today" for abuse.
- `PROVIDER_RATE_LIMITED` / `PROVIDER_UNAVAILABLE`: provider-side; retried automatically with backoff.
- `ALIGNMENT_UNRELIABLE`: ElevenLabs returned timings that do not match the text; retry, or change the narration.
- `RENDER_QC_FAILED`: the MP4 failed checks (duration, resolution, blank frames, silence, clipping); nothing was
  published and credits were returned. Inspect worker logs for the failure list.

## Granting beta credits

`/studio/admin` → "Grant beta credits" (admins = `ADMIN_EMAILS`). Each grant needs a reason, is written to
`audit_events`, and is idempotent per form submission.

## Payment incident (Paystack)

- Webhooks are verified (HMAC-SHA512) and deduplicated; fulfilment also re-verifies the transaction with the
  Paystack API outside local. A missed webhook can be replayed from the Paystack dashboard safely.
- To disable purchases immediately: set `PAYMENTS_ENABLED=false` on Vercel and redeploy.
- Refund: issue in the Paystack dashboard, then record an `adjustment` removing the unused credits. Negative
  amounts are not exposed in the admin UI; use a reviewed SQL call:
  `select public.grant_credits('<workspace_id>', -<microcredits>, 'adjustment', 'refund', '<paystack_ref>', 'refund:<paystack_ref>');`
  and add an `audit_events` row describing who approved it.

## Account deletion

Requests appear on `/studio/admin` → "Account deletion requests", including the reason the user chose (users can cancel by signing back in). Complete
within 30 days. A one-step purge is **not built yet** (V-25: it needs a decision on how long ledger/payment rows are
kept). Do **not** delete the user from Supabase → Authentication → Users: the cascade fails on the append-only
credit ledger. Interim manual procedure in the SQL Editor, for `<user id>` from the admin table:

1. `select id from public.workspaces where owner_id = '<user id>';` → `<ws>`.
2. Delete the files under `ws/<ws>/` in the R2 bucket (dashboard or `rclone purge`).
3. `delete from public.youtube_connections where workspace_id = '<ws>';` (also ask the user to remove Minkflow at
   myaccount.google.com/permissions, since the stored token cannot be decrypted in SQL).
4. `update public.projects set deleted_at = now() where workspace_id = '<ws>';` and
   `update public.assets set deleted_at = now() where workspace_id = '<ws>';`
5. `update public.profiles set display_name = null, avatar_mode = 'none', avatar_asset_id = null where id = '<user id>';`
6. `update public.workspaces set suspended_at = now() where id = '<ws>';` then ban the user in Supabase → Users.
7. Record what you did with `insert into public.audit_events (workspace_id, action) values ('<ws>', 'account.deleted_manually');`

## Secret rotation

Rotate in the provider dashboard, update Vercel/Railway variables, redeploy both services, then revoke the old
key. `DEV_AUTH_SECRET` and `LOCAL_STORAGE_SECRET` are local-only and must not be set on staging/production.
