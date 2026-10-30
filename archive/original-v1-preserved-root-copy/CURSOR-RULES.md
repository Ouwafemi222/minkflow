# Persistent engineering instructions for Cursor

1. Read `docs/00-START-HERE.md` and the relevant design doc before coding. If docs are at repository root, use that location until moved.
2. State assumptions and list files to change. Implement one milestone/vertical slice at a time; wait for review on architecture-changing choices.
3. Strict TypeScript; no `any` without documented reason; Zod schemas for all external/AI data.
4. Server-authoritative auth, ownership, credits, state transitions and job scheduling.
5. AI output is untrusted structured data, never executable code.
6. Use immutable revisions, idempotent jobs, private storage and signed URLs.
7. Avoid expensive generation until user approval and credit reservation.
8. No hardcoded API keys, payment secrets or fake production credentials; provide `.env.example` only.
9. Never invent SDK methods or provider model names. Check installed SDK types and official documentation; flag unknowns.
10. Write tests for all changed behavior, including failures and edge cases. Run relevant tests and report exact commands/results.
11. Never say 'bug-free', 'fully secure', or 'production ready' without evidence. Report known limitations.
12. Keep changes focused, update docs and migrations, and include rollback notes.
13. Use accessible UI, loading/error/empty states and optimistic concurrency for edits.
14. Ensure credit ledger cannot double-charge; test duplicate webhooks and retries.
15. Treat copyrighted assets, consent, voice rights and AI disclosures as product requirements.
