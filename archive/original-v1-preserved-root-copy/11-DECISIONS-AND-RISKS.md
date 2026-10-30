# Decisions, assumptions and risk register

## Decisions to confirm before implementation
1. Final brand after trademark/domain checks (Scenova is provisional).
2. Primary buyer: YouTube automation solo creator vs educator vs agency.
3. First style: clean 2D motion graphics with limited reusable characters.
4. English-only initial release; 16:9; max 5 minutes.
5. Voice provider and commercial rights; speech alignment approach.
6. Illustration policy: licensed icon library first, generative assets optional.
7. Remotion license applicability and cost.
8. Paystack-supported merchant entity/currency and taxes.
9. Retention and deletion periods for projects, audio and exports.
10. Whether script claims require citations/fact-check workflow.

## High-priority risks and mitigations
- **Weak output quality:** curated templates, reference videos, creator review, scene-level editing.
- **AI hallucinations:** editable script, factual claim warnings, optional research sources, no unverified claims presented as fact.
- **Cost overruns:** budgets, credit reservation, image caps, caching, provider spend alarms.
- **Render crashes:** isolated workers, resource ceilings, retries, artifact validation, dead-letter queue.
- **Sync drift:** forced alignment, frame-level timing, golden fixtures.
- **IP and copyright:** licensed assets, provenance, takedown flow, rights confirmations.
- **Provider lock-in:** adapters and fallback paths, version pinning.
- **Brand collision:** legal clearance before launch.
- **Payment fraud:** signed webhooks, dedupe, reconciliation.
- **Poor adoption:** interviews and paid beta before feature expansion.

## Assumption register
Every unverified external fact (pricing, limits, terms, licenses, API model availability) must be marked `TO VERIFY` in issue tracker with owner, source and check date. Cursor must not fabricate API names or vendor capabilities.
