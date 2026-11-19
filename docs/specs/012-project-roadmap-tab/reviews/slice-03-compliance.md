---
slice: 012-03 — saved order and narrative extras from snapshots
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-11-18T22:56:23Z
prompt_source: review.py implementation (round 4; diff via scratchpad)
---

VERDICT: pass (round 4)

REASONING:
All nine ACs met. The writer alone computes `order` (explicit `order` in the input file refused); one shared `mergeSavedOrder` for tab and writer. Nothing the automatic tab shows is lost in saved-order mode: slice-less specs appended as empty runs, DONE slices of unfinished specs in the done fold, non-NNN-MM/duplicate ids appended unplaced. Every CLI refusal returns before appendFileSync. A malformed stored block is rejected by validateRoadmapBlock inside parseCompassHistory. AC9 test non-vacuous.

HISTORY:
Round 1 needs-changes: bare `--roadmap` wrote a plain entry (AC2); duplicated SKILL.md sentence. Round 2 needs-changes: `--move` silently dropped `--next`/`--blockers`; `--print-order` silently dropped writes; non-NNN-MM tokens could block writes/drop cards. Round 3 needs-changes: slice-less specs and DONE slices of in-progress specs vanished in saved-order mode; `orderOrigin` optional vs ADR amendment. All fixed with tests, mutation-checked.

SPECIFIC ISSUES (suggestions only):
- validateRoadmapBlock ISO check uses Date.parse (accepts non-ISO strings; cosmetic, hand-edited lines only).
- architecture.md flow shape lacked `specId?` — fixed.
- `--print-order` prints only ordered ids, not unplaced cards.
- stale uses spec git recency as proxy for slice-status changes — logged.

RECONCILIATION NOTES:
A3 probe result; strict writer-side roadmap validation; required orderOrigin; stricter input-file and CLI refusals; done-fold count includes doneInFlight; unplaced tokens; compass payload strip; sweep rows for architecture.md + ADR are `updated`.
