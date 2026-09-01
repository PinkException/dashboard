---
status: RECONCILED
dependencies: [009-02]
last_verified: 2026-09-01
frame_review: true
claimed_by: claude/jig-orient-b70f85
---

<!-- jig self-defining vocabulary (soft, forward-only). -->
<!-- jig grounding (spec 064-02 / ADR-0020): probe runnable-surface claims. -->

## Slice 009-03 — cross-project action-queue lens

**Goal:** Add a second lens to the overview — a flat, cross-project **action
queue** that lists each project's open pipeline stages (land → review → decide →
finish → start), pooled across all projects and ordered finish-first, reachable
by a toggle from the projects-as-rows grid. This is the "empty the pipeline"
screen: instead of one row per project (the grid), one row per *open stage* — so
a project that has work to land **and** a decision waiting **and** a slice to
start contributes up to three rows, each landing in its stage group. It answers
"show me everything waiting, nearest-to-done first" across the whole portfolio.

**Design frame (resolved by the 2026-09-01 frame-critique — see
`reviews/slice-03-frame-critique.md`).** 009-02 does **not** emit a per-item
action list; `deriveWaitingOn` (`src/lib.mjs:718`) collapses each project to
**exactly one** highest-precedence `waitingOn: {state, verb, action, rank}` and
suppresses the rest. Re-projecting "every action" therefore needs a source that
009-02 does not provide today. This slice resolves that by a **single-source
refactor**, not a parallel re-derivation:

- Extract the candidate-collection already inside `deriveWaitingOn` into
  `deriveWaitingStages(project, marker)` — returns the **full rank-ordered list**
  of the project's present non-Idle stages (`[{state, verb, action, rank}, …]`).
- `deriveWaitingOn` becomes `deriveWaitingStages(…)[0] ?? Idle` — **identical
  behaviour** to today (the grid still gets exactly one state; no 009-01/009-02
  regression).
- `scanProject` emits the new list as `waitingStages` alongside the unchanged
  `waitingOn` field.

Because `waitingOn === waitingStages[0]` **by construction**, the grid's single
state and the queue's rows for a project come from one source and cannot
disagree (AC5). The queue simply also surfaces the lower-ranked stages the grid
hides.

**Bounded, not a flood.** 009-02 already aggregates within a stage (multiple
reconciled slices → one `land N reconciled slices` action), so the natural
enumeration is **one row per stage**, not per slice — at most five stages exist
(MERGE, REVIEW, DECIDE, Ready-resume, Ready-start), realistically one or two per
project. The queue caps each project at its **top 3** stages (finish-first) as an
explicit anti-saturation floor honouring ADR-0006's activity-excluded principle.

**DoR:**
- ✅ 009-02 DONE (the per-project waiting-on precedence + named next-action text
  exist; this slice widens their single emitted head into the full ranked list).
- ✅ Frame-critique passed (`reviews/slice-03-frame-critique.md`).

**Pinned stage → emitted-state map (AC3).** The five queue groups, finish-first,
each mapping to exactly one emitted `waitingOn.state`/`rank`:

| # | Queue group | Emitted `state` | `verb` | `rank` |
|---|---|---|---|---|
| 1 | **Land** | `MERGE` | MERGE | 1 |
| 2 | **Review** | `REVIEW` | REVIEW | 2 |
| 3 | **Decide** | `DECIDE` | DECIDE | 3 |
| 4 | **Finish** | `Ready` (resume, `IN_PROGRESS`) | READY | 4 |
| 5 | **Start** | `Ready` (start, launchable) | READY | 5 |

`External` (rank 6) has no on-disk signal until 009-04 and never appears; `Idle`
(rank 7) is not a stage and contributes no row. "Land" and "merge" are the *same*
emitted state (its verb is `MERGE`, its action text is `land …`); the original
draft's separate "merge" stage was a vocabulary artifact and is folded into Land.

**Acceptance Criteria:**

1. **A toggle exposes the queue.** From the default projects grid, a control
   switches to the action-queue lens and back. Both lenses live within the same
   self-contained page (no route, no framework; ADR-0001), and the toggle state
   is a pure, unit-testable function (mirroring 009-01's `OVERVIEW_STATE`).
2. **One row per open stage, across all projects.** The queue lists each
   project's present pipeline stages from `waitingStages` — **one row per stage**,
   not per project — each row carrying the project name, the stage/verb, and the
   few-word next-action text 009-02 derived. A project contributes as many rows as
   it has open stages, **capped at its top 3** (finish-first); the cap is a pure
   function and is unit-tested.
3. **Grouped by pipeline stage, finish-first.** Rows are grouped and ordered
   Land → Review → Decide → Finish → Start per the pinned map above (ascending
   `rank`), so the nearest-to-done work sits at the top of the queue. Within a
   group, project order is stable.
4. **Idle projects contribute nothing.** A project whose `waitingStages` is empty
   (its `waitingOn` is `Idle`) adds no row. The queue shows work, not a project
   census. An `External`-only project likewise adds nothing pre-009-04.
5. **Consistent with the grid, by construction.** A project's **top** queue row
   (its lowest-`rank` stage) is exactly the `waitingOn` state the grid shows for
   it — because both read `waitingStages` from the one scan-side derivation
   (`waitingOn === waitingStages[0]`). The two lenses cannot disagree about a
   project's most-urgent action. A regression test asserts, over a multi-stage
   fixture, that each project's grid state equals its first queue row.

**DoD:**
- [x] All ACs pass; full suite green (312 tests).
- [x] `deriveWaitingStages` extracted; `deriveWaitingOn` re-expressed as its head
      with a test proving the grid state is byte-identical to pre-refactor for
      every 009-02 state fixture (no regression).
- [x] Test coverage: the toggle, cross-project flattening (N projects → the right
      stage rows), the top-3 per-project cap, stage grouping/order, Idle/External
      contribute nothing, and grid/queue head-consistency.
- [x] Each new test shown to fail when its feature is removed (implementer
      mutation-checked; the two vacuous companion tests were rewritten to real
      `actionQueue` assertions post-craft-review).
- [x] Reviewed by `reviewer` subagent (compliance + craft).
- [x] Deviation log + reconciliation sweep produced.
- [x] Reconciliation review passed.

**Anti-horizontal-phasing check:** After this slice, the owner can flip from
"which project needs me" (grid) to "show me everything waiting, nearest-to-done
first" (queue) and work the cross-project pipeline top to bottom — a usable
second view, not scaffolding.

## Assumptions

- **A1 — the stage set is naturally bounded per project (no flood).** Because
  009-02 aggregates multiple items within one stage into a single action, a
  project emits at most one row per stage (≤5), so the top-3 cap is a safety
  floor that rarely binds rather than the primary defence. _Grounded by reading
  `deriveWaitingOn` (`src/lib.mjs:718–779`): each state branch returns one object;
  MERGE/REVIEW aggregate counts inline. If a future stage emitted per-slice rows,
  the cap becomes load-bearing — re-check then._

### Deviation log (after reconciliation)

Original ACs preserved above; these are the implementation departures and why.

- **Frame resolved pre-code (frame-critique, 2026-09-01).** The drafted "one row
  per action, every open item" was unbuildable from 009-02's collapsed
  single-state emission. Reframed to the **capped-rich single-source** design:
  `deriveWaitingStages` is the source, `deriveWaitingOn` its head. Owner chose
  this middle path over per-slice enumeration and the lean one-per-project view.
  Recorded in `reviews/slice-03-frame-critique.md` and lightweight-decisions.
- **`actionQueue` return shape** is `[{ rank, label, verb, rows:[…] }]`, keyed by
  `rank` rather than `state`, because Ready-resume (rank 4) and Ready-start
  (rank 5) share the state label `Ready` but occupy two distinct queue groups
  (Finish vs Start). Row shape is `{name, path, state, verb, action, rank}` (no
  separate `project` key — `name`/`path` identify the project).
- **`lensToggleHtml`** was added (not named in the plan) so the toggle markup has
  one source reused by both lenses rather than a hand-duplicated copy that could
  skew between them. A `.summary-right` flex wrapper keeps the summary-band's
  two-child `space-between` layout intact.
- **Lens preserved across the detail round-trip.** A project opened *from* the
  queue returns to the queue on "back", not the grid. The implementer's first
  wiring left this as dead glue (`openDetail` dropped `state.lens`); the craft
  pass caught it as a `[blocker]`. Fixed by threading the lens through the pure
  layer — `openDetail(path, lens='overview')` / `closeDetail(lens='overview')` —
  with a round-trip test; the DOM handler passes `state.lens` into both.
- **Two companion "mutation-check" tests were rewritten** (post-craft-review)
  from assertions on hand-built local constants (vacuous) into real assertions on
  `actionQueue` output (flatten-includes-every-project; groups rank-ascending
  under reversed input), satisfying the DoD "each test fails when its feature is
  removed."
- **Deferred nits (accepted, non-blocking).** (a) `src/scan.mjs` derives the
  stage list twice per project (`deriveWaitingOn` calls `deriveWaitingStages`
  internally, then it is called again for the list) — cheap, correctness-neutral,
  collapsing it needs the Idle sentinel exported from `lib.mjs`. (b) Emitted queue
  groups carry an unused `verb` field (rows render their own verb) — dead field.
  Both parked to `docs/inbox.md`.

### Reconciliation sweep

Drift-prone surfaces checked, with dispositions:

- `docs/architecture.md` — **updated.** Module boundaries now name
  `deriveWaitingStages` as the single derivation (with `deriveWaitingOn` as its
  head), record `waitingStages` emission from `scanProject`, and note
  `public/render.mjs` reads it for the queue lens; the Contract-surfaces
  `GET /api/data` entry documents the additive `waitingStages` field.
- `docs/decisions/lightweight-decisions.md` — **updated.** The capped-rich shape
  + single-source refactor recorded, with the two rejected alternatives.
- `docs/specs/009-overview-redesign/spec.md` — **updated.** The 009-03
  decomposition line reframed from "per-item derivation" to the resolved
  single-source design.
- `docs/specs/009-overview-redesign/plan.md` — **updated.** The 009-03
  implementation plan section added.
- `docs/inbox.md` — **updated.** The two deferred nits parked.
- `CLAUDE.md` primer / Active-specs — **no-op.** Spec 009 is not closed
  (009-04 still DRAFT); the compress-on-close-out rule does not fire yet.
- `docs/bugs/README.md`, `docs/conventions.md`, `docs/memory/glossary.md` —
  **no-op.** No defect, no new rule, no new domain term this slice introduces
  (the "action queue" / "waiting stages" vocabulary is self-describing).
