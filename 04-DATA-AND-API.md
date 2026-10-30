> **V3 ACTIVE BRAND DECISION (2026-10-30):** Founder has selected **Minkflow** as the product name. This supersedes all earlier naming-pending, neutral-brand, and Scenova instructions in this file. Keep all original product, engineering, security, and implementation requirements unchanged. Display brand **Minkflow** via central configuration; do not assume `minkflow.com` or any trademark is cleared, registered, or owned. Do not buy domains or register trademarks without founder authorization. See `14-MINKFLOW-BRAND-DECISION.md` and `15-CURSOR-V3-MASTER-PROMPT.md`.

# Data model and API contracts

## Core tables
- `profiles(id, display_name, created_at)` linked to auth.
- `workspaces(id, owner_id, name)`; `workspace_members` optional future-ready.
- `projects(id, workspace_id, title, status, current_revision_id, created_at, updated_at)`.
- `project_revisions(id, project_id, version, input_json, script_json, storyboard_json, brand_json, created_at)` immutable after commit.
- `scenes(id, revision_id, position, template_id, scene_json, content_hash)`.
- `assets(id, workspace_id, kind, storage_key, mime, size, sha256, provenance_json, license_json, created_at)`.
- `jobs(id, workspace_id, project_id, revision_id, type, status, stage, progress, idempotency_key, attempt_count, error_code, created_at, finished_at)`.
- `job_artifacts(id, job_id, asset_id, role)`.
- `usage_events(id, workspace_id, job_id, provider, model, quantity, unit, estimated_usd, actual_usd, created_at)`.
- `credit_ledger(id, workspace_id, amount, currency_unit, kind, reference_type, reference_id, idempotency_key, created_at)` append-only; use integer microcredits.
- `payments(id, workspace_id, provider, external_id, status, amount_minor, currency, verified_at)`.
- `webhook_events(id, provider, external_event_id, payload_hash, processed_at)`.
- `audit_events(id, actor_id, workspace_id, action, target_id, metadata, created_at)`.

## Security
Enable RLS on all user-scoped tables. Derive workspace access from authenticated identity, never trust client-provided workspace IDs. Service-role key only in protected server/worker environment. Storage is private; signed URLs short lived. Enforce DB uniqueness on idempotency and external payment IDs.

## Representative routes
`POST /api/projects`, `GET /api/projects`, `GET /api/projects/:id`, `PATCH /api/projects/:id` (optimistic concurrency/version), `POST /api/projects/:id/script`, `POST /api/projects/:id/storyboard`, `POST /api/projects/:id/scenes/:sceneId/regenerate`, `POST /api/projects/:id/preview`, `POST /api/projects/:id/render`, `GET /api/jobs/:id`, `POST /api/jobs/:id/cancel`, `POST /api/assets/upload-url`, `GET /api/billing/usage`, `POST /api/billing/checkout`, `POST /api/webhooks/paystack`.

## API rules
- Auth, ownership, rate limits and Zod input/output validation on every endpoint.
- All costly POST operations require idempotency key and return job ID immediately.
- Consistent error envelope `{code,message,requestId,retryable,details?}`; no stack traces to clients.
- Use signed webhooks verified against provider docs, replay protection and transactional fulfillment.
- Use server-sent events or polling for job progress; polling is sufficient for MVP.
- Store provider credentials in secrets manager; never expose keys or service-role tokens to browser.
