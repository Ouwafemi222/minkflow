# Closed beta (10–20 creators) — checklist and cost measurement

Owner: founder (recruiting, interviews, legal), engineering (deploy, monitoring, measurement).
Nothing here is complete until checked off on **staging with live providers**. Local mock-mode runs do not count.

## 1. Gates before inviting anyone

- [ ] Accounts and variables from `docs/SETUP-ACCOUNTS.md` exist; `pnpm verify:providers` passes on staging.
- [ ] Remotion Company License purchased (ADR-007, V-04). ElevenLabs plan allows commercial use (V-03).
- [ ] `docs/RUNBOOKS.md#staging-deploy` completed; V-15 (RLS role switching on Supabase) confirmed.
- [ ] Linux worker image builds and renders a 5-minute video within memory limits (V-08, V-14); record peak RSS
      and render time in `docs/CHANGELOG.md`.
- [ ] Backup and restore drill done once (`docs/RUNBOOKS.md#backup-and-restore-drill`).
- [ ] Sentry receives a test error from web and worker (V-20).
- [ ] Spend caps set conservatively: `PLATFORM_DAILY_SPEND_CAP_USD` (e.g. 25) and `WORKSPACE_DAILY_SPEND_CAP_USD`
      (e.g. 3); provider-side monthly limits set in OpenAI and ElevenLabs dashboards.
- [ ] Legal pages reviewed by counsel and placeholders filled (V-21). Support email monitored.
- [ ] `PAYMENTS_ENABLED=false` unless Paystack USD settlement is approved (ADR-008); beta credits granted from
      `/studio/admin` with a reason.
- [ ] CI green on `main` (typecheck, tests, web build, Playwright functional run).

## 2. Running the beta

- Invite in waves of 5. Grant each tester enough credits for ~3 finished 60-second videos
  (≈ 3 × (2 + 3 + ~6 voice + 3 preview + 30 render) ≈ 130 credits) — adjust after the first wave.
- Ask each tester to make one video on a topic they actually publish about, then a second one a few days later.
- Watch daily: `/studio/admin` (failed jobs, stuck jobs, spend), Sentry, provider dashboards.
- Founder runs the interviews (not an engineering dependency). Capture: time to first video, where they got
  stuck, script quality, voice quality, whether they would publish the result, price sensitivity.

## 3. Cost measurement (V-11)

Goal: replace the provisional prices in `packages/contracts/src/pricing.ts` with measured ones.

Data already recorded per job:
- `usage_events`: provider, model, operation, quantity (tokens / characters / calls), `estimated_usd`, `cached`.
- `jobs`: type, `reserved_credits`, timings (`created_at`, `started_at`, `finished_at`), attempts.
- `credit_ledger`: per job a `reserve` row and, if anything was returned, a `release` row; the credits actually
  charged are `-(reserve + release)`.

Per finished video, compute:
1. LLM cost: sum of `estimated_usd` for `chat` usage (script + storyboard + redesigns + repairs).
2. TTS cost: sum for `tts` where `cached = false`; also record the cache hit rate (cached characters / total).
3. Render compute: worker seconds for `preview` + `render` jobs × Railway cost per instance-second (from the
   Railway bill for the beta period divided by total busy seconds; measure busy time from job timings).
4. Storage + egress: R2 bill for the period ÷ videos delivered (small at beta scale; record anyway).
5. Compare with credits charged at the provisional prices and with the pack price per credit
   (starter $9 / 650 ≈ $0.0138 per credit; creator ≈ $0.0115; pro ≈ $0.0095).

Example query (staging database, read-only role):

```sql
with charged as (
  select reference_id::uuid as job_id, -sum(amount) as micro
  from public.credit_ledger
  where reference_type = 'job' and kind in ('reserve', 'release')
  group by reference_id
), cost as (
  select job_id, sum(estimated_usd) as usd from public.usage_events where not cached group by job_id
)
select j.type,
       count(*)                                                        as jobs,
       round(avg(coalesce(c.micro, 0)) / 1e6, 2)                       as avg_credits_charged,
       round(avg(coalesce(u.usd, 0))::numeric, 4)                      as avg_provider_usd,
       round(avg(extract(epoch from (j.finished_at - j.started_at)))::numeric, 1) as avg_seconds
from public.jobs j
left join charged c on c.job_id = j.id
left join cost u on u.job_id = j.id
where j.status = 'completed' and j.created_at > now() - interval '30 days'
group by j.type order by j.type;
```

Decision rule: target gross margin ≥ 60% on the cheapest pack after provider and compute costs. If a step is below
target, raise its credit price or lower its cost (model choice, preview scale, caching) before public launch.
Record results and the new prices as an ADR amendment (ADR-016) and in `docs/CHANGELOG.md`.

## 4. Exit criteria for the beta

- ≥ 70% of testers finish a video without help; median time from topic to downloaded MP4 recorded.
- Zero cross-tenant data access incidents; zero double charges (ledger reconciliation: for every completed job,
  `-(reserve + release)` never exceeds the reservation, and failed/canceled jobs net to their consumed usage only).
- Render failure rate after automatic retries < 2%; no published video failed QC.
- Measured unit costs documented and prices updated.
