# Milestone-by-milestone implementation plan

## Method
Work in small vertical slices with code review, tests, local demo and commit after each. Cursor must inspect current code before changing it. No large unverified all-at-once generation.

### M0 — Discovery and ADRs (1–2 days)
Confirm MVP scope, provider choices, Remotion licensing, pricing, region/payment constraints, storage retention and brand. Write ADRs. Prototype a 60-second video from static JSON to validate rendering.
**Exit:** 1080p MP4 with sound and captions, render reproducible locally.

### M1 — Repository and infrastructure (2–4 days)
Monorepo, lint/typecheck/test, env validation, Supabase migrations/RLS, auth, CI, Redis queue, object storage, local Docker compose, staging deployment.
**Exit:** login + project CRUD + one queued no-op job end-to-end.

### M2 — Deterministic renderer (4–7 days)
Typed scene registry, 10 templates, transitions, brand tokens, audio and caption synchronization, render worker, ffprobe verification.
**Exit:** sample 1–5-minute video rendered from fixture; golden-frame tests.

### M3 — AI planning and voice (4–7 days)
Provider adapters, script generation, scene JSON validation/repair, TTS, alignment, asset resolver, usage events and caching.
**Exit:** user topic -> approved script -> storyboard -> narrated preview.

### M4 — Storyboard editor (5–8 days)
Scene list/reorder, inspector, autosave/revisions, individual regeneration, preview, asset uploads, undo/redo.
**Exit:** edit one scene without rebuilding unchanged assets; no lost edits.

### M5 — Credits and reliability (4–6 days)
Quotes/reservations/settlements, Paystack verified webhook, quotas, cancellation, retries, dead-letter queue, logs/alerts, abuse policy.
**Exit:** billing and failure-injection tests pass; no duplicate credits.

### M6 — Beta and hardening (7–14 days)
10–20 beta users, fix rendering glitches, optimize cost/latency, legal docs, onboarding, accessibility, backup/restore and staged launch.
**Exit:** at least 10 successful creator exports and defined SLO measurements.

## Dependencies
M2 precedes M3 integration; M1 queue/storage precedes production render; M4 depends on typed scene contracts; billing before paid beta. Parallelize design and user interviews, not tightly coupled backend contracts.

## Acceptance checklist per milestone
Code builds; strict TypeScript passes; unit/integration/e2e tests for touched features pass; migrations reversible or rollback documented; logging and errors implemented; docs updated; staging demo recorded; unresolved risks noted.

## Explicit non-goals for first release
No custom video diffusion pipeline, no live multiplayer editing, no multi-region infra, no full YouTube publishing integration, no unbounded free trials.
