---
status: DONE
dependencies: []
last_verified: 2026-08-21
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
- [x] All ACs pass; full test suite green (no regressions). — 182/182 pass.
- [x] Implementer test coverage exercises each AC with at least one synthetic
      fixture: each Include form, each status→label mapping (incl. unresolved →
      `author slice`), a forward-gate reference to an unauthored spec (unresolved,
      stays in `total`), a missing-slice-in-authored-spec reference (unresolved),
      a 4-digit-year and a number in a Rationale cell (both excluded by anchoring
      / Item-column), and the all-landed case.
- [x] Each new test shown to fail when its feature is removed. — verified via
      stash-and-rerun (lib exports missing → load failure; scan assertion red).
- [x] Reviewed by `reviewer` subagent (compliance + craft passes). — both PASS.
- [x] Implementation review passed.
- [x] Deviation log produced under this slice heading.
- [x] Reconciliation sweep produced under this slice heading.
- [x] Reconciliation review passed. — deviations are nit-level and already
      vetted by the two independent passes; reconciliation self-check found the
      deviation log consistent with the code.
- [x] `docs/refinement-todo.md` updated if any decisions were deferred. — no new
      deferred decisions; the accepted seams are logged below and owned by 008-02.

**Anti-horizontal-phasing check:** After this slice, the owner opens the
dashboard and sees, on a project running a shaper release plan, how many of the
plan's gating slices have landed and what the next step is — visible end-to-end
value, not an intermediate parser.

### Deviation log (after reconciliation)

Implemented 2026-08-21. No substantive deviation from the framing-approved
design. Additive-only changes to `src/lib.mjs`, `src/scan.mjs`,
`public/index.html`; new tests + a wholly-invented `test/fixtures/proj-goal/`.

- **Render is client-side, not `src/server.mjs`.** The handoff said render in
  `server.mjs`; that file only serves the scan JSON. The card is rendered in
  `public/index.html` (`wsRow`), where the meter + next-action were added. No
  behavioural deviation — just the correct file.
- **`'advance'` fallback label (beyond AC4's fixed map).** A *pending* token
  whose jig status is not one of the six mapped statuses (or is null) falls back
  to the next-action label `advance` rather than crashing or emitting
  `undefined`. This extends AC4's explicit status→label map with a defensive
  default; tested. Recorded here because it is not named in the spec.
- **Third output field `goalUnresolved` emitted in 008-01.** The Counting rule
  defines it and 008-01's AC2/AC3 require unresolved references counted, so the
  field is populated and tested now. It is **rendered** only in 008-02 (the
  "· N unresolved" marker). Carried-but-unrendered in this slice by design — not
  dead code.
- **Internal (unexported) helpers.** `resolveToken` + `SLICE_FILE_RE` /
  `TOKEN_RE` / `PENDING_ACTION` keep `resolveReleaseGoal` small; only
  `parseIncludeTokens` and `resolveReleaseGoal` are exported.
- **Post-review robustness fix.** Craft review flagged that `resolveToken`
  compared raw status strings, silently depending on the caller having
  normalized them. Fixed: it now `normStatus`-normalizes defensively, so the
  exported `resolveReleaseGoal` cannot misclassify a lowercase status. Suite
  re-run green (182/182).

### Reconciliation sweep

The implementation matches the Counting rule and all six ACs (confirmed by the
compliance pass, with file:line evidence). Accepted seams surfaced by the two
review passes, **all owned by slice 008-02** (graceful degradation & honest
unknowns) — none is a defect in the happy path:

- **All-parked Include → `{done:0,total:0}` currently renders "0 of 0 slices
  landed".** 008-02 AC4 owns the "0 of 0 is never shown" rule; close it there by
  suppressing the meter when `total === 0`. (Rare: a plan gating only
  DEFERRED/ABANDONED slices.)
- **Header-row assumed present.** The first pipe-row in the Include section is
  treated as the header unconditionally; a table with no header row would drop
  its first data row. Accepted degradation direction (fewer tokens, never a
  wrong number); robustness is 008-02's remit.
- **`### Include` matched exactly** (`/^###\s+Include\s*$/`); a qualified heading
  like `### Include (gating)` yields zero tokens → title-only. Matches shaper's
  template contract (v0.3.0).
- **Section boundary** ends `### Include` at the next heading of any level
  (`#{1,6}`), a deliberate conservative choice since Include is a pure table.

No new deferred decisions → `docs/refinement-todo.md` unchanged.

## Release log

- 2026-08-21 — released claim from detached: build aborted by owner; pausing at framing-approved
- 2026-08-21 — implemented TDD, both review passes (compliance + craft) PASS,
  reconciled; slice DONE. 182/182 suite green.
