# MINKFLOW — APPROVED VISUAL IDENTITY (V4)

Status: founder approved. This document overrides earlier color suggestions, but does not delete or replace prior functional requirements.

## Core palette
| Token | Hex | Usage |
|---|---|---|
| `brand.primary` | `#635BFF` | Electric Indigo: primary CTA, active tabs, focus accents, progress |
| `brand.midnight` | `#0B1020` | Midnight Navy: video-editor canvas, dark shell |
| `brand.ice` | `#F7F9FC` | Ice White: marketing backgrounds, light app surfaces |
| `brand.cyan` | `#23D5E8` | Cyan: restrained creative accents, timeline selection, processing visuals |

## Product visual direction
- Marketing site predominantly light, spacious, premium, highly readable.
- Video editor dark by default, with legible panels and controls; allow future theme preference.
- Brand mark and wordmark: Minkflow; no finalized logo or font chosen yet. Do not invent trademark or domain clearance.
- Do not use gradients everywhere; keep Indigo as the clear action color and Cyan as a sparse supporting accent.
- Use neutral grayscale text and surfaces with accessible contrast. Indigo on white may require darker variants for small text; validate WCAG AA (4.5:1 normal text, 3:1 large text/UI).
- Never use Cyan as tiny text on white. Provide focus ring, hover, pressed, disabled, error, warning, success and loading states.
- Video preview content may have its own user-selected colors; application chrome uses the approved palette.
- Avoid hardcoding colors across components: use semantic CSS variables/design tokens, Tailwind theme mapping and documented variants.

## Example design tokens (initial defaults; adjust contrast-validated derivatives)
```css
:root {
  --brand-primary: #635BFF;
  --brand-midnight: #0B1020;
  --brand-ice: #F7F9FC;
  --brand-cyan: #23D5E8;
  --surface-page: #F7F9FC;
  --surface-card: #FFFFFF;
  --text-primary: #0B1020;
}
[data-studio-theme="dark"] {
  --surface-page: #0B1020;
  --surface-card: #171E32;
  --text-primary: #FFFFFF;
}
```

## Acceptance criteria
1. Public marketing pages use light surfaces and approved indigo CTAs.
2. Editor opens in dark theme and uses Cyan only for meaningful accents.
3. Color usage is centralized; no random AI-chosen brand colors.
4. Check keyboard focus, color contrast, disabled states and mobile layout.
5. Screenshot-test key pages: landing, dashboard, script editor, storyboard, render queue, export, billing.
6. Brand palette is reflected in design tokens, storybook/component previews (if present), emails and OG images, while keeping user-generated videos independently customizable.
