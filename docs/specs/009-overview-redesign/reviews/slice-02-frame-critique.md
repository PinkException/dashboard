---
slice: 009-02 — waiting-on state + finish-first ordering (the triage signal)
pass: frame-critique
verdict: needs-changes
reviewer: jig:reviewer
reviewed_at: 2026-08-31T23:43:47Z
prompt_source: orchestrator frame-critique (pre-impl)
---

Pre-implementation frame-critique of slice 009-02 (jig:reviewer, read-only).
Verdict: needs-changes — all four blockers resolved in the slice text before code.
The data inputs largely exist in the emitted payload (slice is buildable); the
gaps were under-pinned on-disk→state mappings that would have forced arbitrary
implementation choices and risked the recall/saturation failure the ADR guards.

Blockers (all resolved in `slice-02-waiting-on-state-and-ordering.md`):
- **[b1] MERGE had no named on-disk signal but a MERGE fixture was required.**
  RESOLVED: MERGE pinned to a slice at status `RECONCILED` (jig's awaiting-land
  status; `PENDING_ACTION: RECONCILED → land`, `src/lib.mjs:537`). 009-04 refines
  it with an approved-PR signal; pre-009-04 `RECONCILED` is the signal. Fixture is
  now authorable; no defer needed.
- **[b2] REVIEW's slice-status class was unpinned** (`READY_FOR_REVIEW` vs
  `REVIEWED` conflated). RESOLVED: REVIEW pinned to status `REVIEWED` (passes
  done, owner sign-off next); `READY_FOR_REVIEW` reassigned to Ready
  (Claude-runnable). Status space now partitioned.
- **[b3] In-progress work mapped to no state → false-Idle** (the exact recall
  failure the ADR exists to prevent; common in this repo). RESOLVED: Ready widened
  to "launchable OR resumable"; `IN_PROGRESS` with no owner tag → Ready(resume).
  Added as an explicit DoD regression test.
- **[b4] Ordering verbs didn't map onto the six states; DECIDE-vs-finish and
  DECIDE-vs-Ready tiebreaks undefined.** RESOLVED: AC2 replaced with one total
  order over the actual states — MERGE > REVIEW > DECIDE > Ready(resume) >
  Ready(start) > External > Idle.

Nits (resolved):
- [n5] Ready "launchable" pinned to deps-satisfied via existing `resolveToken`
  (`src/lib.mjs:545`) where cheap, else status-presence.
- [n6] Citation fixed: `compass.blockers` validated at `src/lib.mjs:241` (not
  :235), reaches payload via `src/scan.mjs:433`, read at `public/render.mjs:380`.
- [n7 / arch] Derivation location settled: **scan-side**, emitting a new payload
  field `waitingOn: { state, verb, action, rank }`; `public/render.mjs` only reads
  it. This is the scan-layer change that `arch_review: true` covers; the arch pass
  validates the boundary.

Confirmed sound (verified, no change): DECIDE via `**(you)**`/`ownerOf`;
per-project `compass.blockers` reachable today (though sparse — the auto routine
never writes them); A2 config schema has no marker field today and `loadConfig`
passes `...p` through, so a home-folder marker adds with no `loadConfig` change
and no collision; slice `status` emitted per slice across the full lifecycle set;
activity-excluded boundary clean (`inFlightCount` is presentation-only); `scanBugs`
returns `{open,total}` only; `public/render.mjs` is pure and node:test-imported, so
the derivation ships as pure functions with one fixture per state.

Reviewer prompt: orchestrator-authored adversarial frame-critique (spec + slice +
ADR-0006 + design v1.2 + src/lib.mjs/scan.mjs + public/render.mjs/index.html + test/).
