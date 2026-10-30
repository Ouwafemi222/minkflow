# Changelog (implementation)

Documentation version history is preserved in `CHANGELOG-V2.md`, `CHANGELOG-V3.md`, `CHANGELOG-V4.md`.

## M0 — Discovery, docs and render prototype (2026-10-30)
- Initialized git; baseline commit of all founder docs unchanged.
- Moved active docs to `docs/`; root `original-v1-preserved/` (byte-identical to the archived copy) moved to `archive/original-v1-preserved-root-copy/`. `archive/v2-original-unchanged/` untouched.
- Added `docs/SETUP-ACCOUNTS.md`, `docs/DECISIONS.md` (ADR-001..017), `docs/VERIFY.md`, `docs/TRACEABILITY.md`, root `.env.example`.
- Monorepo root (pnpm 10 + Turborepo, TypeScript 5.9 strict, Vitest 3).
- `packages/brand`: palette, semantic tokens CSS (light + studio dark), WCAG contrast tests.
- `packages/shared`: error envelope + codes, stable hashing, retry/backoff/timeout, redacting JSON logger, deterministic tone-narration WAV synthesizer (mock TTS / fixtures).
- `packages/contracts`: scene schema (10 templates, discriminated union), icon allowlist, theme presets, timeline math, caption grouping, render manifest validation (no clipped speech, captions within audio), project/job state machines, AI script/storyboard schemas.
- `packages/render`: all 10 Remotion templates, composition with per-scene audio + word captions + watermark + logo, bundled fonts, render/still APIs, MP4 QC (ffprobe, blank frames, silence, levels/clipping) using Remotion's bundled ffmpeg.
- Verified: `finance60` and `longCaptions` fixtures render at 1920x1080 30fps h264/aac and pass QC; 38 golden frames generated and reproduced deterministically.
- Known limitations: fixture narration is synthetic tones (not speech); Remotion's bundled ffmpeg lacks `blackdetect`/`ebur128`, so blank-frame and level checks are implemented in Node (uniform-frame detection, RMS/peak dBFS) rather than LUFS.

## M1–M6 — Platform, pipeline, studio, billing, beta readiness (2026-10-30)

Committed together because the packages are interdependent (each milestone's code only builds with the others).
All runs below are local (Windows, Node 24) with **mock AI/TTS and local storage**; nothing has been deployed and
no live provider has been called.

### M1 — Platform
- `supabase/migrations`: schema (workspaces, projects, immutable revisions, scenes, assets, jobs, ledger, usage,
  payments, webhooks, rate limits, audit) with RLS; `SECURITY DEFINER` functions for jobs, ledger, grants, webhooks.
- `packages/db`: `pg` access with `withUser()` role switching (ADR-017), repositories, revision documents
  (ADR-018), PGlite test harness, `pnpm db:local` (PGlite over the wire protocol; `LOCAL_DB_DIR=memory` for e2e).
- `packages/storage` (local signed URLs / S3-compatible R2), `packages/queue` (BullMQ wake-up signals; Postgres
  polling fallback, ADR-015).
- `apps/web` (Next.js 16): auth (dev + Supabase magic link), project CRUD, job APIs with idempotency keys, rate
  limits, same-origin checks, signed downloads, security headers/CSP.
- CI (`.github/workflows/ci.yml`), optional `docker-compose.yml` (Redis), root scripts.

### M2 — Rendering in the worker
- `apps/worker`: lanes (AI / render concurrency), leases + heartbeats, maintenance (stuck-job sweep, project
  status reconciliation), retention sweep, health endpoints, graceful shutdown, Dockerfile (Linux image not yet
  built, V-14).
- Preview (1/3 scale) and final render jobs; QC must pass before publishing to an immutable key; watermark until the
  first successful payment.

### M3 — AI and voice
- `packages/ai`: OpenAI JSON adapter + moderation, ElevenLabs with-timestamps adapter → word captions, mocks.
- `packages/pipeline`: script, storyboard, scene redesign, media (per-workspace narration cache, ADR-019), preview,
  render processors; usage events; daily spend caps.
- `pnpm verify:providers` for live key/model/voice checks (not yet run: no keys).

### M4 — Studio editor
- Script review with claim acknowledgement; storyboard editor (scene list, reorder/duplicate/delete/add, template
  switch with valid defaults, generic visual editor, live Remotion Player preview with signed narration audio,
  timeline, debounced autosave with conflict detection, bounded undo/redo, single-scene AI redesign).
- Brand kit panel (colour preset, video font, captions, logo upload).

### M5 — Billing, reliability, admin
- Credits page (balance, ledger, usage, packs), Paystack checkout + webhook (off until `PAYMENTS_ENABLED=true`),
  admin diagnostics + audited beta credit grants, cancel/retry, Sentry for worker and web (no-op without DSN).

### M6 — Beta readiness
- Draft legal pages (`/legal/terms|privacy|acceptable-use|refunds`, counsel review pending, V-21).
- Onboarding empty state; accessibility pass on studio forms (labels, live regions, keyboard undo/redo).
- Playwright e2e + screenshot tests; `docs/RUNBOOKS.md` (incl. database rollback, backup/restore drill),
  `docs/BETA-CHECKLIST.md` (gates, cost measurement query), `docs/TRACEABILITY.md`; ADR-015..019 updated/added;
  VERIFY V-15..V-21 added.

### Commands run and results (2026-10-30)
| Command | Result |
|---|---|
| `pnpm typecheck` | 11/11 packages pass |
| `pnpm test` | 76 tests pass (ai 10, brand 4, contracts 17, db 17, pipeline 8, render 4, shared 8, storage 3, web 3, worker 2) |
| `pnpm --filter @minkflow/web build` | Production build succeeds (re-run after the final edits) |
| `pnpm --filter @minkflow/web test:e2e` | 7/7 pass (4 marketing screenshots, creator flow to voiced storyboard + logo upload + editor screenshot, cross-user isolation, admin grant); re-run without updating snapshots also 7/7 |
| `node --import tsx scripts/e2e-local.ts` (packages/pipeline) | Real Remotion: preview 98 s, render 90 s for a 59.8 s video; QC pass (1920×1080, 30 fps, h264/aac, peak −15 dBFS, no clipping) |
| Manual browser smoke (`pnpm db:local`, `pnpm dev:worker`, `pnpm dev:web`) | Sign-in → script (2 cr) → approve → storyboard (3 cr) → edit/template switch/undo autosaved → voice (5.46 cr) → edit one scene → re-voice only that scene (0.78 cr) → preview 640×360 plays (2.44 cr) → final render downloads as MP4 with range support (24.43 cr) → scene redesign kept narration + voice (1 cr) |
| Admin grant and logo upload from the automation browser | Not run manually (blocked by tool policy); covered by the Playwright suite instead |

### Known gaps
- Nothing verified against live OpenAI, ElevenLabs, Supabase Auth/Postgres, R2, Paystack or Sentry (see VERIFY).
- Linux worker image and Linux screenshot baselines not yet produced; CI runs Playwright with `--ignore-snapshots`.
- No automated test for the same-origin (CSRF) check.
- After a final render, further storyboard edits keep the project status "Video ready" until the next render;
  the studio always shows the latest completed render.
