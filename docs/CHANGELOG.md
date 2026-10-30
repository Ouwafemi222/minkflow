# Changelog (implementation)

Documentation version history is preserved in `CHANGELOG-V2.md`, `CHANGELOG-V3.md`, `CHANGELOG-V4.md`.

## M0 — Discovery, docs and render prototype (2026-10-30)
- Initialized git; baseline commit of all founder docs unchanged.
- Moved active docs to `docs/`; root `original-v1-preserved/` (byte-identical to the archived copy) moved to `archive/original-v1-preserved-root-copy/`. `archive/v2-original-unchanged/` untouched.
- Added `docs/SETUP-ACCOUNTS.md`, `docs/DECISIONS.md` (ADR-001..017), `docs/VERIFY.md`, `docs/TRACEABILITY.md`, root `.env.example`.
- Monorepo root (pnpm 10 + Turborepo, TypeScript 5.9 strict, Vitest 3).
- `packages/brand`: palette, semantic tokens CSS (light + studio dark), WCAG contrast tests.
- `packages/shared`: error envelope + codes, stable hashing, retry/backoff/timeout, redacting JSON logger, deterministic tone-narration WAV synthesizer (mock TTS / fixtures).
- `packages/contracts`: scene schema (10 templates, discriminated union), icon allowlist, theme presets, timeline math, caption grouping, render manifest validation (no clipped speech, captions within audio), project/job state machines, AI script/storyboard schemas.
- `packages/render`: all 10 Remotion templates, composition with per-scene audio + word captions + watermark + logo, bundled fonts, render/still APIs, MP4 QC (ffprobe, blank frames, silence, levels/clipping) using Remotion's bundled ffmpeg.
- Verified: `finance60` and `longCaptions` fixtures render at 1920x1080 30fps h264/aac and pass QC; 38 golden frames generated and reproduced deterministically.
- Known limitations: fixture narration is synthetic tones (not speech); Remotion's bundled ffmpeg lacks `blackdetect`/`ebur128`, so blank-frame and level checks are implemented in Node (uniform-frame detection, RMS/peak dBFS) rather than LUFS.
