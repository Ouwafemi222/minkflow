# Scenova — Project documentation

**Status:** Working name; brand/domain/trademark not verified. **Product:** AI-assisted 2D animated explainer video studio. **Primary users:** faceless YouTube creators, educators, agencies, and businesses. **Initial niche:** English-language educational explainers. **MVP output:** 16:9, 1080p, 30fps, 1–5 minutes, MP4.

## Non-negotiable product promise
Turn a topic or user script into a coherent, editable, narrated animated explainer with reliable rendering and transparent costs. **Do not promise error-free deployment**; design for observability, recovery and safe releases.

## Recommended reading order
1. `01-PRODUCT-PRD.md` — problem, users, scope, acceptance criteria.
2. `02-ARCHITECTURE.md` — services, data flow and boundaries.
3. `03-PRODUCTION-PIPELINE.md` — deterministic render workflow.
4. `04-DATA-AND-API.md` — database and API contracts.
5. `05-DESIGN-AND-EDITOR.md` — user experience and editing model.
6. `06-SECURITY-RELIABILITY.md` — production safety.
7. `07-COSTS-BILLING.md` — metering and unit economics.
8. `08-IMPLEMENTATION-PLAN.md` — milestone-by-milestone build.
9. `09-TESTING-AND-RELEASE.md` — verification gates.
10. `10-LAUNCH-AND-GROWTH.md` — beta, research, metrics.
11. `11-DECISIONS-AND-RISKS.md` — open questions and tradeoffs.
12. `CURSOR-MASTER-PROMPT.md` — paste into Cursor at repository root.
13. `CURSOR-RULES.md` — persistent engineering conventions.

## Product boundaries
MVP uses deterministic animation components (SVG, CSS/Remotion, charts, Lottie if licensed), AI script/storyboard and TTS. No text-to-video diffusion, no autonomous web scraping, no cloned celebrity voices, no automatic YouTube publishing, no 4K, no multi-user collaboration in v1.

## First action
Read all docs, inspect repository, propose implementation sequence and identify unknowns before coding. Use small verified vertical slices; never scaffold every subsystem at once.


---
## V2 OVERRIDE — BRAND NOT SELECTED (2026-10-30)
The prior reference to **Scenova** is a historical placeholder ONLY, not an approved product name, domain, legal entity, package namespace, or design direction. The founder explicitly rejected selecting a name without research and approval. All prior functional and technical requirements remain intact. In all new code, UI, configuration, schemas, prompts and documentation, use neutral placeholder **Animated Explainer Studio** and configurable `PRODUCT_NAME`/`NEXT_PUBLIC_PRODUCT_NAME` until the founder approves a verified name. Never silently replace the founder's naming decision. Never register, purchase, or deploy a domain without explicit approval. Read `12-BRAND-RESEARCH-AND-NAMING.md` before coding. Preserve prior requirements and add versioned changes, not destructive rewrites.
