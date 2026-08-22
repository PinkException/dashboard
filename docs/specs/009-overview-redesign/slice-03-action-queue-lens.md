---
status: DRAFT
dependencies: [009-02]
last_verified:
frame_review: true
---

<!-- jig self-defining vocabulary (soft, forward-only). -->
<!-- jig grounding (spec 064-02 / ADR-0020): probe runnable-surface claims. -->

## Slice 009-03 — cross-project action-queue lens

**Goal:** Add a second lens to the overview — a flat, cross-project **action
queue** listing every actionable item across all projects together, grouped by
pipeline stage (land → merge → review → finish → start) and ordered finish-first
— reachable by a toggle from the projects-as-rows grid. This is the purest
"empty the pipeline" screen: the owner's whole to-do list across projects, in one
place.

**DoR:**
- ✅ 009-02 DONE (the per-project waiting-on state + named next action exist to
  re-project cross-project).

**Acceptance Criteria:**

1. **A toggle exposes the queue.** From the default projects grid, a control
   switches to the action-queue lens and back. Both lenses live within the same
   self-contained page (no route, no framework; ADR-0001).
2. **Every actionable item, across all projects.** The queue lists each open
   actionable item from every project — not one row per project, but one row per
   *action* — carrying the project name, the pipeline stage, and the few-word
   next-action text derived in 009-02.
3. **Grouped by pipeline stage, finish-first.** Items are grouped/ordered land →
   merge → review → finish/unblock → start, matching 009-02's ordering, so the
   nearest-to-done work is at the top of the queue.
4. **Idle projects contribute nothing.** A project in the Idle state adds no row
   (there is no open action). The queue shows work, not a project census.
5. **Consistent with the grid.** An item's stage/verb in the queue matches the
   same project's waiting-on state in the grid — the two lenses cannot disagree
   about what a project is waiting on (both derive from 009-02's single source).

**DoD:**
- [ ] All ACs pass; full suite green.
- [ ] Test coverage: the toggle, the cross-project flattening (N projects → the
      right item rows), stage grouping/order, Idle contributes nothing, and
      grid/queue consistency.
- [ ] Each new test shown to fail when its feature is removed.
- [ ] Reviewed by `reviewer` subagent (compliance + craft).
- [ ] Deviation log + reconciliation sweep produced.
- [ ] Reconciliation review passed.

**Anti-horizontal-phasing check:** After this slice, the owner can flip from
"which project needs me" to "show me everything waiting, nearest-to-done first"
and work the cross-project pipeline top to bottom — a usable second view, not
scaffolding.

### Deviation log (after reconciliation)

_TBD at implementation._

### Reconciliation sweep

_TBD at reconciliation._
