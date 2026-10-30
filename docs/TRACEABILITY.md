# Traceability: requirements → implementation → evidence

Source requirements: `docs/01-PRODUCT-PRD.md` (must-haves, definition of done), `docs/06-SECURITY-RELIABILITY.md`,
`docs/07-COSTS-BILLING.md`. "Evidence" lists automated tests or recorded manual checks; anything without evidence is
marked **gap**.

Test locations: contracts `packages/contracts/src/*.test.ts`; DB/RLS/ledger `packages/db/src/*.test.ts`; pipeline
`packages/pipeline/src/pipeline.integration.test.ts`; browser `apps/web/e2e/studio.e2e.ts`; render
`packages/render` (fixtures, QC, golden frames); real end-to-end render `packages/pipeline/scripts/e2e-local.ts`.

## MVP must-haves

| Requirement | Implementation | Evidence |
|---|---|---|
| Email login, single-owner workspace | Supabase magic link (`/login`, `/auth/callback`, `proxy.ts`); dev auth locally; workspace + 60-credit grant created by `handle_new_user` trigger | db tests (signup grant, workspace); e2e sign-in. Supabase magic link itself: **gap** until staging (V-12) |
| Project list and autosave | `/studio`, `PUT /api/projects/:id/document` (optimistic concurrency, ADR-018) | e2e "All changes saved" after edits; db tests (revision conflict) |
| Wizard: topic or pasted script, audience, tone, duration, en, 16:9 | `NewProjectForm`, `ProjectInputSchema` | contracts tests; e2e |
| Script generation + approval; explicit storyboard action | `script` / `storyboard` jobs; `/script/approve` requires claim acknowledgement (ADR-010) | pipeline test (approve gate); e2e |
| Typed scenes, reorder, scene-level regenerate, 8–12 templates | `SceneSchema` (10 templates, ADR-013); editor list reorder/duplicate/delete; `scene_regenerate` job | contracts tests (all templates have valid defaults); `lib/history.test.ts`; manual smoke 2026-10-30 (redesign kept narration + voice, 1 credit) |
| Voice selection, narration, word alignment | ElevenLabs with-timestamps adapter → word captions; voice allowlist `ELEVENLABS_VOICE_IDS` | ai tests (alignment conversion, mismatch → `ALIGNMENT_UNRELIABLE`); live API: **gap** (V-02, `pnpm verify:providers`) |
| Per-scene preview, low-res draft, 1080p final, secure download | In-browser Remotion Player (same composition as the render); `preview` job (1/3 scale); `render` job; signed short-lived download URLs | e2e-local report (1920×1080, 30 fps, h264/aac, QC pass); manual smoke 2026-10-30 (640×360 preview plays; MP4 download with range requests) |
| Credit estimate, reservation, settlement, usage ledger | Quotes in every action button; `create_job` reserves; `complete_job` settles (capped) + releases; `usage_events` | db tests (reserve/settle/release, idempotency); pipeline tests (refund on cancel/fail) |
| Jobs dashboard, actionable errors | `JobsPanel` (progress, cancel, retry), error envelope with user-facing messages | pipeline tests (cancel/retry); manual smoke |
| Brand kit: colours, fonts, logo, captions | `BrandPanel`; logo upload (PNG/JPEG/WebP ≤ 2 MB, magic-byte check, no SVG) | storage tests (magic bytes, SVG rejected); e2e logo upload |
| Admin diagnostics, abuse controls | `/studio/admin` (spend, failed/stuck jobs, webhooks, grants); rate limits; moderation; per-workspace + platform daily spend caps; max active jobs | e2e (admin grant, non-admin 404); pipeline test (spend cap) |

## Definition of done

| Item | Evidence |
|---|---|
| Coherent 60 s video from a topic without engineer help | Manual smoke 2026-10-30 with **mock** AI/voice (UI flow complete). With live providers: **gap** until staging + beta |
| 1–5 min renders: stable timing, no blank frames, correct aspect, captions | QC (`packages/render/src/node/qc.ts`) blocks publishing on failure; fixtures `finance60`, `longCaptions`, `tech5min` |
| Scene edits do not regenerate unaffected scenes | `mergeClientStoryboard` hash invalidation + narration cache; pipeline test (cache reuse); manual smoke (1 edited scene re-voiced for 0.78 credits vs 5.46 for all) |
| Every paid job: reservation, usage events, settlement, refund on failure | db + pipeline tests; billing page shows ledger |
| Users cannot access another user's project, object, render, usage | RLS (db tests with two users); asset/download routes load through RLS; storage keys prefixed by workspace and checked; e2e cross-user 404 |
| Failed job retryable without double charge or corrupt artifacts | Retry creates a new job/reservation after the old one was released; renders publish to immutable keys only after QC; pipeline tests |

## Security and reliability (doc 06)

| Requirement | Implementation | Evidence |
|---|---|---|
| AI output is untrusted data | JSON only, Zod-validated, ≤ 2 repairs; icons from allowlist; no code execution | ai tests (repair → `AI_OUTPUT_INVALID`) |
| CSRF / origin checks on mutations | `authed()` same-origin check against `ALLOWED_ORIGINS` | **gap**: no automated test |
| Rate limiting | `check_rate_limit` SQL function per user + key | db tests |
| Webhook authenticity + idempotency | HMAC-SHA512, `webhook_events` dedupe, server re-verification, amount/currency check | db tests (fulfil once, mismatch rejected). Live Paystack: **gap** (V-05, V-06, V-19) |
| Leases, heartbeats, stuck-job recovery | `claim_next_job`, `heartbeat_job`, `sweep_stuck_jobs`, `reconcileProjectStatuses` | db tests; worker lanes tests |
| Retention (ADR-011, ADR-019) | `runRetentionSweep` hourly | pipeline test (retention) |
| Secrets never committed | `.env.example` only; CI secret grep | CI |
| Error monitoring | Sentry in worker and web (no-op without DSN) | **gap** until a DSN exists (V-20) |
