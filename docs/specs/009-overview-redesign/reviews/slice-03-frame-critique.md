---
slice: 009-03 — cross-project action-queue lens
pass: frame-critique
verdict: needs-changes
reviewer: jig:reviewer
reviewed_at: 2026-09-01T18:13:53Z
prompt_source: orchestrator frame-critique (pre-impl)
---

Pre-implementation frame-critique of slice 009-03 (jig:reviewer, read-only).
Verdict: needs-changes — the primary blocker was resolved in the slice text
before any code, and the resolution turns the flagged weakness into the design's
strongest property.

Primary blocker (RESOLVED in `slice-03-action-queue-lens.md`):
- **The slice assumed 009-02 emits a per-item action list to flatten
  cross-project; it does not.** `deriveWaitingOn` (`src/lib.mjs:718`) collapses
  each project to exactly ONE highest-precedence `waitingOn` state and suppresses
  the rest, so the drafted AC2 ("one row per action, every open item") was
  unbuildable from its declared source, and AC5 ("the two lenses cannot disagree")
  could only hold trivially. RESOLVED: a **single-source refactor** — extract
  `deriveWaitingStages(project, marker)` returning the full rank-ordered list of
  present non-Idle stages; re-express `deriveWaitingOn` as `stages[0] ?? Idle`
  (behaviour-identical, no grid regression); emit `waitingStages` alongside
  `waitingOn`. The queue reads the list; the grid reads the head. Because
  `waitingOn === waitingStages[0]` by construction, AC5 becomes airtight rather
  than trivial. AC2 rewritten to "one row per open *stage*, capped top-3."

Secondary (RESOLVED):
- **AC5 consistency contract restated** as head-equality (`waitingOn ===
  waitingStages[0]`), with a regression test over a multi-stage fixture asserting
  each project's grid state equals its first queue row.
- **Stage→state map pinned.** The drafted "land → merge → review → finish →
  start" listed land+merge as two stages when the emitted MERGE state's verb is
  MERGE and its action text is `land …` (one state). Folded into a single "Land"
  group; a pinned 5-row table maps each queue group to exactly one emitted
  `state`/`rank`. External (rank 6) deferred to 009-04; Idle contributes no row.

Owner design call (2026-09-01): chose the capped-rich shape (up to 3 stages per
project) over both the unbuildable per-slice enumeration and the lean
one-per-project view. Frame is now buildable from a single grounded source.
