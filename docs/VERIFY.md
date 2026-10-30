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
| V-14 | Remotion version compatibility with Node 24 on Windows dev and Linux worker image | Build | Checked locally in M0 | engineering | 2026-10-30 | local run |
