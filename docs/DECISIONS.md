# Architecture decision records (ADRs)

Format: ID — title — status — date. Decisions are additive; superseded ADRs stay listed.

## ADR-001 Brand: Minkflow (accepted, 2026-10-30)
Display name `Minkflow` from `packages/brand` / `PRODUCT_NAME`. Domain and trademark not verified (doc 14). No domain hardcoded; all URLs from `APP_BASE_URL`.

## ADR-002 Visual identity V4 (accepted, 2026-10-30)
Indigo `#635BFF`, Midnight `#0B1020`, Ice `#F7F9FC`, Cyan `#23D5E8`. Semantic CSS variables in `packages/brand/tokens.css`; marketing light, studio `data-studio-theme="dark"` default. Small indigo text on white uses darker derivative `#4B44E0` (contrast-checked in tests).

## ADR-003 Monorepo (accepted)
pnpm workspaces + Turborepo, TypeScript strict, Vitest. Apps: `web`, `worker`. Packages: `brand`, `contracts`, `shared`, `render`, `ai`, `db`.

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
Final MP4: 30 days. Drafts/previews/intermediate audio: 7 days. Projects: until user deletes. Enforced by `retention_sweep` worker job + R2 lifecycle rules (defence in depth).

## ADR-012 Assets: icon libraries only (accepted)
Lucide (ISC) as the bundled icon set, referenced by name from an allowlist. No AI image generation in MVP. Tabler (MIT) may be added later. User uploads: PNG/JPEG/WebP only (SVG uploads rejected in MVP to avoid script injection; see doc 06).

## ADR-013 Templates (accepted)
10 templates: `title_reveal`, `stat_comparison`, `timeline`, `process_steps`, `icon_grid`, `quote_focus`, `bar_chart`, `line_chart`, `before_after`, `closing_cta`. Deferred: `character_explains`, `map_callout`.

## ADR-014 Fonts (accepted)
UI: Inter. Video: Inter or Poppins (OFL). Fonts bundled locally in the render package (no runtime network in compositions).

## ADR-015 Local development without Docker (accepted)
Drivers selectable by env: `QUEUE_DRIVER=inline|bullmq`, `STORAGE_DRIVER=local|s3`, `AI_PROVIDER_MODE=mock|live`. Migrations and ledger SQL are tested against PGlite (embedded Postgres) in CI so DB logic is exercised without Docker. Staging/production always use bullmq + s3 + live; env validation refuses `inline`/`local`/`mock` when `APP_ENV=production`.

## ADR-016 Credits (accepted)
Integer microcredits (1 credit = 1,000,000 microcredits). 1 credit ≈ 1 second of final rendered video (provisional; set from measured costs). Ledger is append-only; reservations are ledger rows of kind `reserve`, settled by `settle` + `release` rows in one transaction via SQL functions. Balance = sum(amount).

## ADR-017 Database access (accepted)
Web uses Supabase client with user session (RLS enforced). Privileged operations (ledger, job transitions, webhooks) go through `SECURITY DEFINER` SQL functions executable only by `service_role`. Worker uses service role.
