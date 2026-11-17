---
status: DRAFT
dependencies: [013-01]
last_verified:
frame_review: true
arch_review: true
---

## Slice 013-03 — slice and bug counts in the series

**Goal:** the chart can show progress at **slice** level (and open bugs), not
only at spec level, so a multi-slice spec stops looking frozen until it fully
finishes.

The writer explicitly hands this to "the future evolution-chart spec"
(`scripts/snapshot.mjs:53-55`, `docs/architecture.md:103-106`).

**DoR:**
- ⬜ 013-01 DONE.
- ⬜ Owner decision: should the auto guard (`--if-changed`) also fire when the
  slice count changes? Firing makes the data denser, but adds more auto entries.

**Acceptance Criteria (draft, to sharpen after 013-01):**

1. The writer adds optional numeric fields `slices: {done, total}` and
   `bugs: {open}` to new entries. This is an additive change to the ADR-0002
   contract; old entries stay valid.
2. If the owner agrees (DoR), the `--if-changed` signature includes
   `slices.done`. The bug count stays excluded, per the 005-04 rationale.
3. The series reader passes these fields through when present. The chart draws
   a slice-level done line when at least 2 points carry `slices`, and otherwise
   falls back to spec level without comment.
4. Tests cover old and new entries mixed in one series.

**Anti-horizontal-phasing check:** after this slice, a project finishing slices
inside one long spec shows a rising line instead of a flat one.

### Deviation log (after reconciliation)

_Filled at reconciliation._

### Reconciliation sweep

_Filled at reconciliation._
