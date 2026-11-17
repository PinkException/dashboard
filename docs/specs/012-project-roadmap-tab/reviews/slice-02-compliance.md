---
slice: 012-02 — parked section and slice goals
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-11-17T17:52:46Z
prompt_source: review.py implementation (diff supplied via scratchpad file)
---

VERDICT: pass

REASONING:
All five ACs implemented: goal = first sentence of **Goal:** (fallback **Goal (…):**), markdown stripped, capped with "…" on any drop; trigger = whole wrapped **Resolution trigger:** paragraph, capped; Parked section lists every DEFERRED slice except ABANDONED specs, count equals the strip's "N parked"; extraction reuses scanSpecs' parsed body (no new walk); goal/trigger escaped via esc. Tests use concrete fixtures and would fail if the feature were removed.

SPECIFIC ISSUES (all addressed before REVIEWED, see deviation log):
- src/lib.mjs labelParagraph stop regex ended a paragraph at any wrapped line starting with bold emphasis, silently dropping text without "…" — FIXED (label colon required; test added, mutation-checked).
- src/lib.mjs capText: "?"/"!" ending + "…" — test added (behaviour already correct).
- Strip count "N parked" now excludes ABANDONED specs' deferred slices — amends 012-01 AC4; logged.
- docs/architecture.md contract block should list new /api/data fields — handled at reconciliation.
- Cap measurement + AC4 timings must be in the deviation log — handled at reconciliation.

RECONCILIATION NOTES:
Record P3 length measurement + cap rationale, before/after scan timings, 012-01 amendment, trigger-key shape (absent on non-DEFERRED), no "Depends on" on parked cards, known extraction limits.
