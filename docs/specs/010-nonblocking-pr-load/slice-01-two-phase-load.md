---
status: DRAFT
dependencies: [009-04, adr-0007]
last_verified:
arch_review: true
frame_review: true
---

<!-- jig self-defining vocabulary (soft, forward-only). -->
<!-- jig grounding (spec 064-02 / ADR-0020): probe runnable-surface claims. -->

## Slice 010-01 — two-phase load: disk-first render, gh PR states fold in

**Goal:** The overview renders immediately from a disk-only scan and never blocks
on `gh`; the `gh`-sourced PR states are fetched in a second request and folded into
the already-rendered rows when they arrive. Implements [ADR-0007](../../decisions/adr-0007-non-blocking-pr-enrichment.md)
via server-side deltas (the chosen phase-two locus).

**DoR:**
- ✅ 009-04 DONE (the `gh` reader `buildGhContext` + the `prs`/`ownerLogin` fields
  + PR-folded `deriveWaitingStages` exist to split).
- ✅ [ADR-0007](../../decisions/adr-0007-non-blocking-pr-enrichment.md) Accepted —
  two-phase, non-blocking; server-recompute-with-deltas locus chosen (spec §Chosen
  phase-two design).

**Acceptance Criteria:**

1. **`GET /api/data` is disk-only and never calls `gh`.** It runs `scanAll` with a
   disabled `gh` context (`{ available:false, ownerLogin:null, listPRs:()=>[] }`),
   so no `gh` sub-process is spawned; the payload carries `waitingOn`/`waitingStages`
   derived from disk signals alone and **omits** `prs`/`ownerLogin`. First paint no
   longer pays the `gh` cost (re-timed: on the order of the disk-only scan, not the
   enriched ~8.6 s).
2. **`GET /api/prs` supplies the enrichment as per-project deltas.** It runs a full
   `scanAll(config)` with the real `gh` context and returns
   `{ generatedAt, projects: [{ path, ownerLogin, prs, waitingOn, waitingStages }] }`
   — only the fields the disk payload lacked or that PRs change — keyed on `path`.
3. **The page loads in two phases and folds the enrichment in.** `public/index.html`
   fetches `/api/data`, renders the grid, then fetches `/api/prs`; on arrival it
   merges each delta into its in-memory project model by `path` (replacing
   `waitingOn`/`waitingStages`, adding `prs`/`ownerLogin`), re-applies the
   finish-first sort, and re-renders — a PR-promoted project (e.g. an approved PR →
   MERGE, an owner-review PR → REVIEW) moves to its enriched position and shows its
   PR state in the row and detail view.
4. **`gh`-absent / failure → exact status-quo, no error.** With `gh` missing,
   unauthenticated, offline, or hanging, `/api/prs` returns deltas whose
   `waitingOn`/`waitingStages` equal the disk values and whose `prs` is empty (or
   `/api/prs` fails and the page keeps the disk render) — no thrown error, no 500,
   no PR noise, and the disk-only page stands unchanged. The `git clone && node
   server.mjs` zero-install promise holds.
5. **The single-source invariant survives the merge.** After the fold, each
   project's `waitingOn` still equals `waitingStages[0]` (`?? Idle`) — the server
   recomputes both in phase two, so the client swaps them together as one delta,
   never desyncing the grid headline from the action-queue (009-03 AC5).

**DoD:**
- [ ] All ACs pass; full suite green.
- [ ] Test coverage: `/api/data` emits no `prs`/`ownerLogin` and spawns no `gh`
      (injected/spy gh context asserts `listPRs` never called on the `/api/data`
      path); `/api/prs` returns the delta shape and folds a fixture PR into
      MERGE/REVIEW/External; the client merge updates the model + re-sorts (render
      test over the merge function); the `gh`-absent path yields disk-equal deltas
      with no error; the `waitingOn === waitingStages[0]` invariant holds post-merge.
- [ ] Each new test shown to fail when its feature is removed.
- [ ] Frame-critique pass (`frame_review: true` — the two-scan transport split and
      the client keyed-merge/re-sort assumptions, A3/A4).
- [ ] Arch-review pass (`arch_review: true` — the `/api/data` contract change +
      new `/api/prs` endpoint; the disk/enriched scan split in `server.mjs`).
- [ ] Reviewed by `reviewer` subagent (compliance + craft).
- [ ] Deviation log + reconciliation sweep produced (incl. `architecture.md`
      `GET /api/data` contract surface + the new `/api/prs` surface).
- [ ] Reconciliation review passed.

**Anti-horizontal-phasing check:** After this slice, opening the dashboard paints
the full disk overview in ~1 s instead of waiting ~8 s on `gh`, and the PR states
(MERGE / REVIEW / External) fold in a moment later — the exact behaviour the owner
asked for. An owner without `gh` sees the same instant page and no change after,
identical to today minus the wait.

### Assumptions

- **A3 (from spec) — a disabled `gh` context reuses the proven 009-04 no-`gh`
  path**, so `/api/data` adds no new derivation branch. _Grounded in the 009-04
  absent-path tests; re-asserted by an `/api/data`-emits-no-`prs` test._
- **A4 (from spec) — the client already holds everything the merge needs** (the
  disk payload carries specs/workstreams/compass + disk `waitingStages`; the delta
  is a keyed field-swap + re-sort, no client derivation). _Unverified across the
  render wiring until built; `sortProjectsByWaitingOn` already exists in
  `public/render.mjs`._
- **A5 — the redundant disk re-scan in `/api/prs` is acceptable off the critical
  path.** `/api/prs` re-runs the disk scan (~1 s) plus `gh`; it is stateless (no
  cross-request cache). _Accepted per ADR-0007; a cached-disk-scan optimization is
  the noted follow-up, not built here._

### Deviation log (after reconciliation)

_TBD at implementation._

### Reconciliation sweep

_TBD at reconciliation._
