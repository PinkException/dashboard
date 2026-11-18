---
slice: 014-01 — new look + overview by project
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-11-18T22:26:27Z
prompt_source: review.py implementation
---

PASS (2026-11-18). All ten ACs met on the overview: tokens light/dark match AC + Main-dark.dc.html with no colour outside :root; tiles computed scanner-side (summarizeProjects, src/lib.mjs) and emitted additively on /api/data and recomputed on /api/prs (prsPayload, src/scan.mjs); page swaps only the four state tiles (mergePrSummary); one CHIPS vocabulary, legend in queue order; wait lines + tints per AC8. Tests substantive (exact counts, labels, ring dashoffset, CSS colour guard). Issue: Running now counted error rows with no dot — FIXED in f4277ec. Notes for reconciliation: AC3 44px/mono rule applied to the overview only (detail controls → 014-03); summary carries specsDone/specsDenom for the ring; "All specs done" uses progress.denom; Need-you subtitle per D7; architecture.md API section needs summary on both endpoints.
