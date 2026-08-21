---
status: READY_FOR_IMPLEMENTATION
dependencies: []
last_verified:
frame_review: true
# arch_review: true  # set to true when this slice changes module
#                    # boundaries, public contracts, or architecture-
#                    # shaped concerns (triggers arch-review pass).
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation,
     else mark them as assumptions in the spec's `## Assumptions` section. -->

## Slice 008-01 — goal progress & next-action (happy path)

**Goal:** For a release plan whose Cutline `### Include` section parses and whose
gating slices resolve against the scanned specs, the project card's release row
shows a goal-scoped progress meter ("N of M slices landed") and a next-action
("next: 002-03 — review spec"), computed end-to-end from data already on disk.

**DoR:**
- ✅ `scanSpecs` slice-status shape confirmed (`{id, slices:[{file, status}]}`,
  probed in `src/scan.mjs`).
- ✅ Release plans already emitted as `{kind:'release', path, ...}` workstreams.
- ✅ Observed `### Include` slice-ID forms catalogued (spec `## Assumptions` A2).
- ✅ Invented fixtures only — a synthetic project tree under the test dir with a
  fake release plan + fake specs. No real project names or content (leak-guard).

**Acceptance Criteria:**

1. **Include parse (structural).** A pure helper extracts gating slice IDs from
   the `### Include` table only (not Defer / Split / Risk-First), reading the
   **Item cell** (first cell) of each data row and matching word-boundary-anchored
   `\b\d{3}-\d{2}\b` tokens. It handles all catalogued forms — comma lists
   (`002-01, 002-02`), id-plus-name (`002-03 foo, 002-04 bar`), and compressed
   runs (`003-01/02/03` → `003-01,003-02,003-03`; `004-01/02` → `004-01,004-02`)
   — de-duplicates, and reads nothing from Evidence/Rationale cells or other
   Cutline headings.
2. **Classification by resolution.** Every extracted token is a genuine gating
   reference (Counting rule — structural position qualifies it, not spec
   existence). Each resolves against the scanned specs via A1's identity rule
   (spec-dir number + slice-file number, both `slice-NN-*.md` and
   `slice-NNN-NN-*.md` conventions) into one of: **landed** / **parked** /
   **pending** / **unresolved**. *Unresolved* covers both an authored spec with a
   missing slice file **and** a reference to a **not-yet-authored spec** (a
   forward gate) — neither is dropped.
3. **Honest progress meter.** The release workstream gains `goalProgress =
   {done, total}` per the Counting rule: `total` = landed + pending + unresolved;
   `done` = landed (status `DONE`). `DEFERRED` / `ABANDONED` (parked) are excluded
   (principle 5). **Unresolved references — including forward gates to unauthored
   specs — remain in `total` as not-yet-landed**, so a plan gating six slices
   with three unbuilt reads "3 of 6", never "3 of 3 complete".
4. **Next-action.** The release workstream gains `goalNext` = the first
   non-landed reference in Include order, carrying its slice ID and a next-action
   label: for a *pending* token, mapped from its jig status —
   `DRAFT → draft`, `READY_FOR_REVIEW → review spec`,
   `READY_FOR_IMPLEMENTATION → implement`, `IN_PROGRESS → finish implementation`,
   `REVIEWED → reconcile`, `RECONCILED → land`; for an *unresolved* token,
   `author slice`. When every reference is landed, `goalNext` is `null` and the
   meter reads complete.
5. **Render.** For a release workstream carrying `goalProgress`, the card shows
   the meter and (when present) the next-action line. A release with a goal view
   is visually distinguishable from a checklist workstream — the meter reads
   "slices landed", not "steps".
6. **Determinism & isolation.** Same disk state → identical `goalProgress` /
   `goalNext` (principle 2). The helper is pure (body + scanned specs in, object
   out); no filesystem or git calls inside it.

**DoD:**
- [ ] All ACs pass; full test suite green (no regressions).
- [ ] Implementer test coverage exercises each AC with at least one synthetic
      fixture: each Include form, each status→label mapping (incl. unresolved →
      `author slice`), a forward-gate reference to an unauthored spec (unresolved,
      stays in `total`), a missing-slice-in-authored-spec reference (unresolved),
      a 4-digit-year and a number in a Rationale cell (both excluded by anchoring
      / Item-column), and the all-landed case.
- [ ] Each new test shown to fail when its feature is removed.
- [ ] Reviewed by `reviewer` subagent (compliance + craft passes).
- [ ] Implementation review passed.
- [ ] Deviation log produced under this slice heading.
- [ ] Reconciliation sweep produced under this slice heading.
- [ ] Reconciliation review passed.
- [ ] `docs/refinement-todo.md` updated if any decisions were deferred.

**Anti-horizontal-phasing check:** After this slice, the owner opens the
dashboard and sees, on a project running a shaper release plan, how many of the
plan's gating slices have landed and what the next step is — visible end-to-end
value, not an intermediate parser.

### Deviation log (after reconciliation)

_TBD at implementation._

### Reconciliation sweep

_TBD at reconciliation._

## Release log

- 2026-08-21 — released claim from detached: build aborted by owner; pausing at framing-approved
