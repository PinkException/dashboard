---
status: DRAFT
dependencies: [013-01]
last_verified:
frame_review: true
---

## Slice 013-02 — trend sparkline on the overview row

**Goal:** each project's row on the overview shows a tiny trend sparkline, so
"moving vs stalled" is visible without opening the detail view.

**DoR:**
- ⬜ 013-01 DONE (reuses `project.history`).
- ⬜ Owner has seen 013-01 live and still wants a glance-level signal. The
  design notes allow at most one sparkline per glance row
  (`docs/design/brainstorm-highlights.md`).

**Acceptance Criteria (draft, to sharpen after 013-01):**

1. A row with 2+ points shows a sparkline of the done-ratio (done ÷ total) over
   the last 30 days, extended to now. It has no axes and is at most row height.
2. A row with fewer than 2 points in that window shows nothing, not an empty
   box.
3. The sparkline sits **inside the Progress cell**, under the percentage and
   bar. That cell is 180px wide in the v1.3 design (spec 014), and there is
   room for it there. It must fit within the height the row already has. v1.3
   rows grow to fit their content (the "Next move" cell sets the height), so the
   sparkline must never be what makes a row taller (uniform rows, ADR-0006).
4. Tests cover the 30-day window, the "fewer than 2 points" rule, and the fixed
   size.

**Anti-horizontal-phasing check:** the owner scans the overview and spots a
stalled project in one glance.

### Deviation log (after reconciliation)

_Filled at reconciliation._

### Reconciliation sweep

_Filled at reconciliation._
