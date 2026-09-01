---
slice: 009-04 — gh-optional PR enrichment (un-defers 003-03)
pass: reconciliation
verdict: pass
reviewer: general-purpose (reconciliation)
reviewed_at: 2026-09-01T23:34:26Z
prompt_source: review.py reconciliation (re-verified after needs-changes)
---

Reconciliation review (general-purpose, read-only). VERDICT: pass (after one
needs-changes round, all four items addressed + verified).

Verified faithful and honest:
- Every deviation-log entry matches the code (`--limit 100`, team-request
  `.login` filter, `GH_TIMEOUT_MS=5000`, empty-login degradation, non-blank
  `prStateHint`, disk-stage-first MERGE tiebreak, and — added this round — the
  rebase-onto-009-03 integration: PR stages fold into `deriveWaitingStages` as
  list-pushes surfacing in both grid and action-queue, `deriveWaitingOn` its head,
  `ownerLogin` threaded through both).
- Reconciliation sweep names `deriveWaitingStages` as the load-bearing seam;
  architecture.md (external services, lib/scan module entries, GET /api/data
  contract) matches reality and documents both 009-03 and 009-04 accurately.
- AC5: 003-03 is ABANDONED with an abandonment reason pointing at ADR-0006 +
  009-04 (both the slice file and the regenerated status board carry the full,
  balanced reason).
- Leanness sweep accurate: four helpers (`prIsMergeable`, `lowestPrNumber`,
  `buildGhContext`, `prsDetailBlock`), each with a live caller; no speculative
  knobs. No scope creep in docs.
- 341 tests green via `npm test`.

needs-changes round (all fixed): (1) deviation log missing the 009-03 rebase
entry → added; (2) sweep named the superseded `deriveWaitingOn` → now names
`deriveWaitingStages`; (3) blank abandoned-reason cell in README → label
canonicalized + first-line summary reflowed so the generator captures it whole
and balanced; (4) stale `src/lib.mjs` line refs → replaced with function names.

Reviewer prompt: review.py reconciliation over slice-04 + 003-03 + architecture.md
+ inbox + README + src/lib.mjs + src/scan.mjs (deviation log + sweep faithfulness,
doc scope, AC5, and the 009-03 integration).
