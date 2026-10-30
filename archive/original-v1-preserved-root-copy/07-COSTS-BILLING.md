# Cost model, metering and billing

## Important caveat
All numbers are planning assumptions until verified against current provider pricing and measured with real renders. Provider terms, model availability and licensing can change. Check official price pages before selecting vendors.

## Illustrative variable cost per 5-minute template-based video
LLM script/storyboard $0.01–$0.08; TTS $0.08–$0.35; optional generated images $0–$0.60; alignment $0.01–$0.08; compute $0.05–$0.30; storage/egress $0.01–$0.05. Total $0.16–$1.46 before retries, fixed infrastructure, licenses, payment fees, taxes, support and acquisition. **Do not use as an invoice or guaranteed margin.**

## Credit design
- Define credits as integer microcredits; version credit prices by service, quality and duration.
- Quote max estimated credits before execution; reserve atomically in DB.
- Record each provider operation and actual cost in usage ledger; reconcile with provider invoices.
- On success, settle reservation; on failed/canceled work, release unused credits according to policy.
- Never let retries charge for the same logical action twice; distinct external consumption may still incur cost internally.
- Enforce per-account spending limits and platform global daily cap; fail closed when quota exhausted.

## Trial pricing hypotheses
Free: 1-minute watermarked preview; Starter $9/15 minutes; Creator $19/40 minutes; Pro $39/100 minutes. These are **hypotheses**, not validated price points. Premium images, voices and additional regeneration may consume extra credits. Set usage caps to protect gross margin.

## Financial dashboard
Track `cost_per_rendered_minute`, `cost_per_successful_video`, retries per video, average regeneration count, revenue per paid account, gross contribution after variable costs, churn and support burden.

## Provider evaluation
Compare model quality, unit price, latency, uptime, output rights, regional availability, data retention, rate limits and future deprecation. Keep vendor adapters replaceable.
