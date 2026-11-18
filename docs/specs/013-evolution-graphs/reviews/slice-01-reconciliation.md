---
slice: 013-01 — progress-over-time chart in the Activity tab
pass: reconciliation
verdict: pass
reviewer: jig:reviewer (independent, 2 rounds)
reviewed_at: 2026-11-18T04:53:54Z
prompt_source: review.py reconciliation docs/specs/013-evolution-graphs/spec.md 013-01
---

Reconciliation pass on slice 013-01 (fresh jig:reviewer, 2 rounds). Final verdict: pass.

Round 1, needs-changes (docs only):
- The sweep claimed docs/specs/README.md was regenerated, but it had not been.
- Four framing-phase files and the review-candidates sidecars were missing from the sweep.
- The DoR line about 012-03 did not say whether it had been checked.
- Two unlogged changes: detailView's opts.now, and the scanCompass readIf refactor.

All fixed:
- The board is regenerated.
- Sweep rows added for the framing-phase files (changed in PRs #19 and #20) and for the deleted .candidates sidecars.
- The DoR is ticked with evidence: 012-03 had not landed on main e1e4393.
- Deviations 8 and 9 added.

Round 2, pass:
- All 9 deviations match the code.
- The arch.md and inbox.md edits describe what was built.
- No over-build. The additive /api/data change is documented.
- DoD honesty is good: the 0-point empty state is marked unit-test-only, and the owner usefulness gate is left open.
