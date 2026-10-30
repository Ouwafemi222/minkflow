# Production pipeline and render semantics

## Job state machine
`draft -> script_pending -> script_ready -> storyboard_pending -> storyboard_ready -> media_pending -> media_ready -> preview_ready -> render_queued -> rendering -> completed`; any async stage may enter `failed`, `canceled` or `retry_pending` with recorded reason. Define valid transitions explicitly in code.

## Stages
1. **Input:** user topic/script, language, duration, audience, style; sanitize and moderate.
2. **Script:** LLM returns sections + claims flagged for review; user approves; track revision.
3. **Storyboard:** LLM outputs JSON against Zod schema; enforce duration range, scene count, template IDs, safe text lengths and visual semantics. Repair at most twice then fail gracefully.
4. **Assets:** use licensed local icon/shape library by default; custom generated illustration only when needed; preserve provenance and license. Image moderation and sanitization.
5. **Narration:** TTS per scene/segment; store audio, sample rate, duration, provider metadata. Use forced alignment or timestamp-capable TTS; fail gracefully if alignment unreliable.
6. **Timeline:** compute actual scene duration = narration duration + safe padding; reconcile requested total; ensure no clipped speech, overlapping text or negative frames.
7. **Preview:** low-res/low-fps or browser playback from same scene renderer; preview must closely match final output.
8. **Render:** queue immutable manifest; Remotion render -> validate MP4 with ffprobe (codec, dimensions, audio, duration, nonzero size), optional black-frame/audio-silence checks; publish atomically.
9. **Delivery:** signed URL, expiration and download; retention policy and deletion.

## Initial scene template registry
`title_reveal`, `stat_comparison`, `timeline`, `process_steps`, `icon_grid`, `quote_focus`, `bar_chart`, `line_chart`, `character_explains`, `before_after`, `map_callout` (schematic, not geographic claims), `closing_cta`.

## Scene contract sketch
```
Scene = {
 id: UUID, template: TemplateId, narration: string,
 durationFrames: integer, visual: discriminatedUnion(template),
 captions: CaptionToken[], transition: AllowedTransition,
 assets: AssetRef[], voiceAssetId?: UUID
}
```
Validate text bounds, aspect ratio, color contrast, asset ownership, total duration, scene count and frame bounds. Captions derive from alignment. Use deterministic seeded animation; no runtime network calls in compositions.

## Partial regeneration
On narration change: invalidate TTS, alignment, affected scene render and final export. On color change: invalidate previews/final export, not TTS. On unrelated scene change: reuse other scene assets. Use dependency graph and hashes.

## Failure handling
Store stage error codes, provider request IDs (nonsecret), retry count and cost events. Cancel must stop queued work; running external requests may not be cancellable, so settlement reflects actual consumed resources under a published policy. Never charge twice for retries.
