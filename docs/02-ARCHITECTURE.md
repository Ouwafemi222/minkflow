> **V3 ACTIVE BRAND DECISION (2026-10-30):** Founder has selected **Minkflow** as the product name. This supersedes all earlier naming-pending, neutral-brand, and Scenova instructions in this file. Keep all original product, engineering, security, and implementation requirements unchanged. Display brand **Minkflow** via central configuration; do not assume `minkflow.com` or any trademark is cleared, registered, or owned. Do not buy domains or register trademarks without founder authorization. See `14-MINKFLOW-BRAND-DECISION.md` and `15-CURSOR-V3-MASTER-PROMPT.md`.

# System architecture

## Stack (proposed, verify current support and terms)
- Monorepo: pnpm workspaces + Turborepo; TypeScript strict.
- Web: Next.js App Router, Tailwind, accessible component system.
- Database/auth: Supabase Postgres/Auth with RLS; migrations tracked in repo.
- API: Next.js server routes for interactive operations; Zod contracts.
- Jobs: Redis + BullMQ; dedicated Node workers (never serverless request render).
- Rendering: Remotion compositions + FFmpeg for media probes/muxing; commercial license review required.
- Storage: private S3-compatible buckets (e.g. R2); signed upload/download URLs.
- AI adapters: provider-independent LLM, TTS, image interfaces; never couple scenes to one provider.
- Payments: Paystack first, webhook-driven credit issuance; separate payment reconciliation.
- Observability: structured logs, Sentry-equivalent error tracking, metrics/traces, health checks.

## Service boundaries
`apps/web`: UI and authenticated API; `apps/worker`: queues, media processing and render; `packages/contracts`: schemas; `packages/render`: deterministic compositions/templates; `packages/ai`: provider adapters; `packages/db`: query helpers/migrations; `packages/shared`: utilities.

## Flow
User -> web API -> Postgres project revision -> queue job -> worker loads immutable revision -> AI/media provider -> storage artifacts -> validated storyboard -> preview/render worker -> output object -> signed URL.

## Design constraints
- Every job references immutable project revision + render manifest; edits create new revisions.
- Idempotency keys for all billable operations; database transactions for credit ledger.
- State transitions enforced server-side; retries use bounded exponential backoff.
- Use immutable object paths (`user/project/revision/job/artifact`) and lifecycle cleanup.
- Cache AI/TTS/assets by input hash + provider model version + relevant settings.
- Use render concurrency limits, provider budgets, queue backpressure and timeouts.
- Precompute durations from actual audio and alignment, not estimated word count.
- Never execute arbitrary AI-authored JavaScript, HTML or SVG scripts. Only allowlisted scene primitives.

## Suggested repo tree
```
apps/web/
apps/worker/
packages/contracts/
packages/render/
packages/ai/
packages/db/
packages/shared/
supabase/migrations/
docs/
infra/
tests/e2e/
```

## Environments
Local, staging and production use isolated database, storage, API keys, queue and webhook endpoints. CI deploys staging first. Database changes backward compatible during rollout.
