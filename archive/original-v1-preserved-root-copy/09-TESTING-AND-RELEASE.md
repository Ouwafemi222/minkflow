# Quality assurance and release gates

## Test pyramid
- Unit: scene schema, frame calculations, credit arithmetic, template registry, provider adapters (mocked), transition state machine.
- Integration: Supabase RLS, storage signing, queues, job idempotency, payment webhook deduplication, revision conflicts.
- E2E: sign up -> create project -> script -> storyboard -> edit -> preview -> export -> download.
- Visual regression: golden-frame screenshots for every template at intro/middle/outro and multiple fonts/text lengths.
- Media validation: ffprobe dimensions/codec/audio/duration, silence/clipping checks, missing assets, caption timing.
- Load/fault injection: provider 429, timeout, worker killed mid-render, Redis restart, disk full, canceled job, repeated webhook, duplicate button click.
- Security: cross-tenant access denied, malicious SVG, large upload, prompt injection, unauthenticated job polling.

## Golden fixtures
1. 60s finance explainer with charts.
2. 5min technology explainer with 20+ scenes.
3. Long captions and punctuation.
4. Empty/invalid prompt, failed provider, corrupted image.
5. Scene edits while preview/render is queued.
6. Same render requested twice with same idempotency key.

## Release gates
No high-severity security issues; 100% RLS ownership tests; zero known double charges; export success target met on fixture batch; acceptable render cost and latency; staging smoke test; migration and rollback plan; support/contact route available.

## CI suggested commands
`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm build`, `pnpm render:fixtures` (scripts must be implemented, not assumed to exist).
