# Architecture decision records (ADRs)

Format: ID — title — status — date. Decisions are additive; superseded ADRs stay listed.

## ADR-001 Brand: Minkflow (accepted, 2026-10-30)
Display name `Minkflow` from `packages/brand` / `PRODUCT_NAME`. Domain and trademark not verified (doc 14). No domain hardcoded; all URLs from `APP_BASE_URL`.

## ADR-002 Visual identity V4 (accepted, 2026-10-30)
Indigo `#635BFF`, Midnight `#0B1020`, Ice `#F7F9FC`, Cyan `#23D5E8`. Semantic CSS variables in `packages/brand/tokens.css`; marketing light, studio `data-studio-theme="dark"` default. Small indigo text on white uses darker derivative `#4B44E0` (contrast-checked in tests).

## ADR-003 Monorepo (accepted)
pnpm workspaces + Turborepo, TypeScript strict, Vitest. Apps: `web`, `worker`. Packages: `brand`, `contracts`, `shared`, `render`, `ai`, `db`, `storage`, `queue`, `pipeline` (job processors shared by the worker and integration tests).

## ADR-004 LLM provider: OpenAI (accepted, model TO VERIFY)
Behind `LlmProvider` interface in `packages/ai`. Structured JSON output validated with Zod; max 2 repair attempts. Mock provider used in CI and local dev (`AI_PROVIDER_MODE=mock`).

## ADR-005 TTS: ElevenLabs with timestamps (accepted, endpoint TO VERIFY)
Use the "with timestamps" synthesis endpoint, which returns character-level alignment; convert to word caption tokens. No separate forced aligner in MVP. If alignment is missing or inconsistent with text, the stage fails with `ALIGNMENT_UNRELIABLE` (no silent fallback).

## ADR-006 Hosting (accepted)
Web: Vercel. Worker + Redis: Railway (Docker). Storage: Cloudflare R2. DB/Auth: Supabase. No Supabase Edge Functions. Rendering never runs in serverless functions.

## ADR-007 Remotion Company License (accepted, price TO VERIFY)
Founder confirmed team > 3 people; Company License must be purchased before staging renders for customers.

## ADR-008 Payments: Paystack USD (accepted, eligibility TO VERIFY)
Credits purchased in USD packs; webhook HMAC-SHA512 verification with secret key; dedupe by `webhook_events.external_event_id` and `payments.external_id`. Until USD settlement is approved, beta credits are admin-granted (`kind = 'grant'`).

## ADR-009 Persona: solo faceless YouTube creator (accepted)
Default tone presets, onboarding copy and landing page target this persona.

## ADR-010 Claim review (accepted)
Script generation returns `claims[]` flagged `needs_review`. Script approval requires the user to acknowledge claims (`claimsAcknowledged = true`). No citation engine in MVP.

## ADR-011 Retention (accepted)
Final MP4: 30 days. Drafts/previews: 7 days. Narration audio: 30 days after last use (see ADR-019). Projects: until user deletes. Enforced by `retention_sweep` worker job + R2 lifecycle rules (defence in depth).

## ADR-012 Assets: icon libraries only (accepted)
Lucide (ISC) as the bundled icon set, referenced by name from an allowlist. No AI image generation in MVP. Tabler (MIT) may be added later. User uploads: PNG/JPEG/WebP only (SVG uploads rejected in MVP to avoid script injection; see doc 06).

## ADR-013 Templates (accepted)
10 templates: `title_reveal`, `stat_comparison`, `timeline`, `process_steps`, `icon_grid`, `quote_focus`, `bar_chart`, `line_chart`, `before_after`, `closing_cta`. Deferred: `character_explains`, `map_callout`.

## ADR-014 Fonts (accepted)
UI: Inter. Video: Inter or Poppins (OFL). Fonts bundled locally in the render package (no runtime network in compositions).

## ADR-015 Local development without Docker (accepted; amended M1)
Drivers selectable by env: `QUEUE_DRIVER=postgres|bullmq`, `STORAGE_DRIVER=local|s3`, `AI_PROVIDER_MODE=mock|live`, `AUTH_DRIVER=dev|supabase`. Postgres is the source of truth for jobs; the queue is only a wake-up signal, so `postgres` (workers poll `claim_next_job`) is functionally complete and `bullmq` only lowers pickup latency. Local Postgres is PGlite served over the wire protocol (`pnpm db:local`); migrations, RLS and ledger SQL are tested against PGlite in CI. Outside `APP_ENV=local`, env validation refuses `local` storage, `mock` AI and `dev` auth.

## ADR-016 Credits (accepted; amended M5)
Integer microcredits (1 credit = 1,000,000 microcredits). Ledger is append-only. Creating a job writes a `reserve` row (negative, the quote). On completion the actual charge (capped at the reservation) is kept and the remainder is returned as a `release` row; on failure/cancel the whole reservation (minus any charge already incurred) is released. Balance = sum(amount). Provisional prices live in `packages/contracts/src/pricing.ts` (render 0.5 credit/s, preview 0.05 credit/s, voice 8 credits / 1,000 uncached characters, script 2, storyboard 3, scene redesign 1; signup grant 60). TO MEASURE (V-11).

## ADR-017 Database access (accepted; amended M1)
Both web and worker connect with the `pg` driver (`DATABASE_URL`). User-facing reads/writes run inside `withUser()`, which opens a transaction, switches to role `authenticated` and sets `request.jwt.claims` so Supabase RLS policies and `auth.uid()` apply exactly as they would for PostgREST. Privileged operations (ledger, job transitions, webhooks, grants) are `SECURITY DEFINER` SQL functions. The Supabase JS client is used only for Auth (magic-link sign-in, session cookies). TO VERIFY (V-15): the Supabase pooled connection role may `set role authenticated`.

## ADR-018 Revision document (accepted, M1)
A project's editable state is one JSON document per revision: `{ input, script, storyboard, brand }`, validated by `ProjectDocument`. Every save creates a new revision with optimistic concurrency on `projects.version` (`REVISION_CONFLICT` on mismatch). Scenes are also mirrored to `scenes` rows with a `content_hash`. Timing, captions and `voiceAssetId` are server-owned: the editor sends only id/template/narration/visual/transition and `mergeClientStoryboard` keeps a scene's voice only if its narration is unchanged (hash invalidation). Preview/render jobs pin the revision they were started from.

## ADR-019 Narration cache (accepted, M3)
Narration audio is cached per workspace by `sha256(provider, model, voice, text)`. Unchanged scenes reuse cached audio for free (no provider call, no credits). Cached narration expires 30 days after last use (extended on every reuse), which amends ADR-011's 7-day rule for intermediate audio: a 7-day expiry would force paid re-synthesis of untouched scenes for projects that stay open longer than a week.
