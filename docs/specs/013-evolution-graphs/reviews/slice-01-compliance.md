---
slice: 013-01 — progress-over-time chart in the Activity tab
pass: compliance
verdict: pass
reviewer: jig:reviewer (independent)
reviewed_at: 2026-11-18T04:51:04Z
prompt_source: review.py implementation docs/specs/013-evolution-graphs/spec.md 013-01
---

Compliance pass on slice 013-01 (fresh jig:reviewer). Verdict: pass. All six ACs met.

- AC1: buildProgressSeries is store-only. It counts noNumbers and malformed separately, sorts oldest first, caps at 200, and adds a headline only to non-auto entries.
- AC2: scanProject attaches history additively (live = progress.done/denom); compass is unchanged.
- AC3: the Activity tab is enabled, with the chart before the coming-soon line.
- AC4: solid steps then a dashed stretch to live, token-only colours, dots with <title>, down-step markers including on the dashed stretch.
- AC5: the empty state and the skipped line.
- AC6: the tests are not vacuous. They use exact path strings and marker counts, check ordering, and would fail on a legacy read via deepEqual.

Low findings (reconciliation items):
- A dot needs a string headline, so a narrative entry without one gets no dot.
- The caption refines "N days ago" to "today" / "1 day ago" (untested beyond the 10-day case).
- A point without a source omits source in JSON.
- No tests for the skipped line in the 0-point state, or for a single point at now.
- The 012-01 "activity disabled" test was rewritten (superseded by AC3).
- The chart geometry (560x160) and the .evo-* CSS classes are not in the spec.
