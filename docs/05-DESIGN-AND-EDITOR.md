> **V3 ACTIVE BRAND DECISION (2026-10-30):** Founder has selected **Minkflow** as the product name. This supersedes all earlier naming-pending, neutral-brand, and Scenova instructions in this file. Keep all original product, engineering, security, and implementation requirements unchanged. Display brand **Minkflow** via central configuration; do not assume `minkflow.com` or any trademark is cleared, registered, or owned. Do not buy domains or register trademarks without founder authorization. See `14-MINKFLOW-BRAND-DECISION.md` and `15-CURSOR-V3-MASTER-PROMPT.md`.

# UX and editor specification

## Core screens
Landing + pricing; auth; dashboard/project library; create wizard; script review; storyboard editor; render/export; account/billing; admin diagnostics.

## Creation flow
Topic or script -> duration/style/voice -> cost estimate -> script review -> storyboard -> visual preview -> regenerate/edit individual scenes -> export confirmation -> background progress -> secure download.

## Editor layout
Left: ordered scene thumbnails with reorder. Center: video canvas with safe zones. Right: scene inspector (template, text, assets, colors, transitions, voice). Bottom: timeline with narration waveform and captions. Top: autosave state, undo/redo, preview and export.

## Essential interaction requirements
- Autosave debounced with revision conflict handling; show saved/unsaved state.
- Keyboard shortcuts, accessible contrast, focus states, screen-reader labels.
- Scene reorder, duplicate, delete, undo, redo; prevent deleting last scene without confirmation.
- Inline text and narration editing, asset replace, template switch, brand presets.
- Regenerate one scene with explicit cost estimate; never silently overwrite user edits.
- Error states: provider unavailable, credit insufficient, invalid prompt, failed render, unsupported upload, canceled job.
- Mobile: responsive dashboard and review; full editor optimized for desktop.

## Style system
Neutral dark/light UI; visual brand independent of product name. Video templates use preset palettes and readable typography. Avoid relying on tiny text or dense charts at 1080p. Provide caption-safe margins.

## UX metrics
Time to first successful export, edit count per video, percentage of scenes regenerated, generation abandonment, export success, user-rated visual quality.
