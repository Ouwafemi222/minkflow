# Security, reliability and operational controls

## Threat model
Unauthorized project access, storage leaks, prompt injection, malicious uploaded SVG/media, runaway API spend, payment webhook replay, queue overload, worker crashes, copyright abuse, credential leakage and denial of service.

## Controls
- Supabase RLS + ownership integration tests; deny by default.
- Signed private uploads/downloads, file size/type limits, MIME sniffing, malware scanning when applicable, SVG sanitization or rasterization; FFmpeg sandbox/limited privileges.
- LLM output treated as untrusted data; schema validation; no AI-generated executable code or shell commands.
- Prompt injection defense: user-supplied scripts/web content cannot override system rules, tools or budget limits.
- Per-user/workspace quotas, rate limits, concurrent job limits and spend caps.
- Payment webhook signature verification, event deduplication, server-side amount/currency validation.
- Secrets in environment vault; redact prompts with personal data and provider credentials from logs.
- Worker resource ceilings (CPU, memory, disk, duration), bounded retries, dead-letter queue and stuck-job sweeper.
- Postgres backups and restore drill, object lifecycle policies, retention/deletion workflows.
- User-facing privacy policy, terms, copyright policy, AI content policy and data deletion process before public launch.

## SLO candidates (validate during beta)
- API 99.9% monthly availability target excluding planned maintenance.
- >=95% successful exports for supported templates and valid inputs during beta.
- 95th percentile five-minute render completion target to be measured from actual infrastructure.
- Zero known cross-tenant data access; no double charging.

## Alerts and runbooks
Alert on queue age, failed job ratio, provider 429/5xx, unusual spend, render duration, disk saturation and payment reconciliation discrepancies. Runbooks for provider outage, worker restart, refund/credit restoration, corrupt output, leaked key, database rollback.

## Release discipline
Feature flags, staging smoke tests, migration backups, rollback plan, gradual rollout. Never assert production is bug-free; use measurable quality gates.
