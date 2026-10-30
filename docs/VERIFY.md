# TO VERIFY register

Every unverified external fact must be checked against official sources before use in production.
Owner: founder unless stated. Update `Checked on` + `Source` when verified.

| ID | Item | Why it matters | Status | Owner | Checked on | Source |
|---|---|---|---|---|---|---|
| V-01 | Current OpenAI model names for script/storyboard and JSON-schema structured output support | Pinned in `OPENAI_MODEL_*` | TO VERIFY | engineering | — | platform.openai.com/docs |
| V-02 | ElevenLabs "text-to-speech with timestamps" endpoint shape (`alignment.characters`, `character_start_times_seconds`) | Caption sync (ADR-005) | TO VERIFY (adapter written to documented shape; must be confirmed with live call) | engineering | — | elevenlabs.io/docs |
| V-03 | ElevenLabs plan permitting commercial use of generated audio; per-character price | Output rights, cost | TO VERIFY | founder | — | elevenlabs.io/pricing |
| V-04 | Remotion Company License price, seat model, whether a runtime license key is needed | Legal to render for customers | TO VERIFY | founder | — | remotion.pro |
| V-05 | Paystack USD settlement eligibility for founder's merchant entity; fees | Payments | TO VERIFY | founder | — | paystack.com/docs |
| V-06 | Paystack webhook signature = HMAC-SHA512 of raw body with secret key, header `x-paystack-signature` | Webhook security | TO VERIFY (implemented to this spec) | engineering | — | paystack.com/docs/payments/webhooks |
| V-07 | Cloudflare R2 pricing, lifecycle rules, presigned URL support via S3 API | Storage/retention | TO VERIFY | engineering | — | developers.cloudflare.com/r2 |
| V-08 | Railway instance memory/CPU adequate for headless Chrome renders of 5-min 1080p | Render reliability | TO MEASURE in M2/M6 | engineering | — | measured |
| V-09 | Lucide icon license (ISC) permits use in rendered commercial video | Asset rights | TO VERIFY | founder | — | lucide.dev/license |
| V-10 | Inter and Poppins OFL permits embedding in rendered video | Font rights | TO VERIFY | founder | — | OFL text |
| V-11 | Credit prices per minute | Margin | TO MEASURE in M3/M6 (doc 07 numbers are hypotheses) | founder | — | measured |
| V-12 | Supabase built-in SMTP rate limits; Resend SMTP setup | Auth email deliverability | TO VERIFY | engineering | — | supabase.com/docs |
| V-13 | Domain + trademark for "Minkflow" | Launch | TO VERIFY (doc 14) | founder | — | registrar/RDAP, WIPO, NG/US/UK registries |
| V-14 | Remotion version compatibility with Node 24 on Windows dev and Linux worker image; Chrome Headless Shell system libraries in `apps/worker/Dockerfile` and CI render job | Build | Windows checked locally (M0, M1 e2e); Linux image NOT yet built | engineering | 2026-10-30 | local run |
| V-15 | Supabase pooled Postgres connection (`DATABASE_URL`) may `set local role authenticated` and `set_config('request.jwt.claims', …)` so RLS applies (ADR-017) | User data isolation | VERIFIED 2026-10-30 on Supabase (Postgres 17.11, transaction pooler 6543) via `pnpm verify:supabase` | engineering | — | supabase.com/docs/guides/database/postgres/roles |
| V-16 | OpenAI moderation model name `omni-moderation-latest` and response shape (`results[0].flagged`, `categories`) | Content safety | TO VERIFY (adapter written to documented shape) | engineering | — | platform.openai.com/docs/api-reference/moderations |
| V-17 | ElevenLabs `output_format=mp3_44100_128` available on the chosen plan | Audio quality / cost | TO VERIFY | engineering | — | elevenlabs.io/docs |
| V-18 | OpenAI `/chat/completions` with `response_format: {type: "json_object"}` and `max_completion_tokens` for the pinned models | Script/storyboard generation | TO VERIFY (adapter written to documented shape) | engineering | — | platform.openai.com/docs |
| V-19 | Paystack `POST /transaction/initialize` (amount in minor units, `currency: "USD"`, `reference`, `callback_url`, `metadata`) and `GET /transaction/verify/:reference` response fields used (`status`, `amount`, `currency`) | Payments | TO VERIFY with a test-mode key | engineering | — | paystack.com/docs/api/transaction |
| V-20 | `@sentry/nextjs` 11 `init` + `captureRequestError` via `instrumentation.ts` / `instrumentation-client.ts` report errors without `withSentryConfig` (no source-map upload) | Observability | TO VERIFY with a real DSN on staging | engineering | — | docs.sentry.io/platforms/javascript/guides/nextjs |
| V-21 | Legal pages (`/legal/*`) are beta drafts with bracketed placeholders | Launch | TO REVIEW by counsel before public launch | founder | — | — |
| V-22 | `supabase_migrations.schema_migrations (version, statements, name)` written by `pnpm db:migrate` matches what the Supabase CLI reads, and the dashboard role may create the `on_auth_user_created` trigger on `auth.users` | Migrations | PARTLY VERIFIED 2026-10-30: migrations applied via the SQL Editor (trigger on `auth.users` created fine), history recorded, `pnpm db:migrate` reports up to date; Supabase CLI reading the history still unchecked | engineering | — | supabase.com/docs/guides/deployment/database-migrations |
| V-23 | Email templates with `{{ .TokenHash }}` / `{{ .Token }}` + `verifyOtp({ token_hash, type: 'email' })` sign in both new and returning users; built-in SMTP is team-only and rate limited | Sign-in | TO VERIFY on staging | engineering | — | supabase.com/docs/guides/auth/auth-email-passwordless |
