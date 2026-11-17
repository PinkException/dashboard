---
slice: 013-01 — progress-over-time chart in the Activity tab
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (independent, 3 rounds)
reviewed_at: 2026-11-17T18:20:16Z
prompt_source: review.py frame-critique docs/specs/013-evolution-graphs/spec.md 013-01
---

Frame-critique of slice 013-01 (progress-over-time chart). Three fresh jig:reviewer rounds, pre-implementation. Final verdict: pass.

Round 1, needs-changes. [blocker] A1/AC4 extended the last stored value flat to "now". With the snapshot routine stopped, a long flat run would mean "not recorded", not "stalled". Fixed: the stretch after the last snapshot is drawn dashed, ends at the live count, and carries a "last snapshot N days ago" caption. Grounded: the live count uses the same rule the writer stores (scripts/snapshot.mjs:121). Also fixed: store-only input stated, and skipped entries split into noNumbers and malformed with neutral wording.

Round 2, needs-changes. [blocker] A worktree-taken snapshot is stored under the main project key but counts that branch's specs, so a down-step can be misattributed. Fixed: measured the store (aggregate only): 2 of 12 series, 3 down-steps in 92 points. The marker now names every cause (reopen/abandon, other branch or worktree, counting rule) and covers total as well as done. Recording the scanned branch/worktree is parked in 013-03. Also fixed: AC2 reworded (scanProject attaches; scanCompass passes the store lines).

Round 3, pass. Nits folded in: DoD empty state is "0 points"; the 200 cap lives in the pure reader; an entry with a bad ts counts as malformed; the scanCompass widening is named for the arch review (A3, overlaps 012-03); an owner live-check of usefulness at spec granularity is added to the DoD and gates 013-02.
