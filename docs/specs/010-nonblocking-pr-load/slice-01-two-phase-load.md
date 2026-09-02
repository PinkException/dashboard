---
status: RECONCILED
dependencies: [009-04, adr-0007]
last_verified: 2026-09-02
arch_review: true
frame_review: true
claimed_by: claude/009-04-full-jig-ceremony-7c2dbb
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
   PR state in the row and detail view. An open detail view re-resolves by
   `state.path` (existing `render()` behaviour), so folding PRs into an open detail
   updates it in place. **DOM-only state across the re-render (frame-critique
   residual):** the phase-two re-render is wholesale (`app.innerHTML`), matching the
   existing `setInterval(load)` behaviour, so it resets the active detail tab
   (Activity vs Overview) and scroll — acceptable because it is consistent with the
   current auto-refresh; **preserve the open detail's active tab across the
   phase-two re-render if cheap** (it fires inside the initial interaction window),
   else accept-and-note in the deviation log.
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
- [x] All ACs pass; full suite green (351 tests).
- [x] Test coverage: `/api/data` emits no `prs`/`ownerLogin` and spawns no `gh`
      (injected/spy gh context asserts `listPRs` never called on the `/api/data`
      path); `/api/prs` returns the delta shape and folds a fixture PR into
      MERGE/REVIEW/External; the client merge updates the model + re-sorts (render
      test over the merge function); the `gh`-absent path yields disk-equal deltas
      with no error; the `waitingOn === waitingStages[0]` invariant holds post-merge.
- [x] Each new test shown to fail when its feature is removed (mutation check).
- [x] Frame-critique pass (`frame_review: true`). `reviews/slice-01-frame-critique.md`.
- [x] Arch-review pass (`arch_review: true`). `reviews/slice-01-arch.md`.
- [x] Reviewed by `reviewer` subagent (compliance + craft).
- [x] Deviation log + reconciliation sweep produced (incl. `architecture.md`
      `GET /api/data` contract surface + the new `/api/prs` surface).
- [x] Reconciliation review passed.

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
  cross-request cache). Because the two scans read disk at different instants (T0
  for `/api/data`, T1 for `/api/prs`), a merged project's headline/stage (from T1)
  can momentarily reflect a slightly newer disk state than its detail body (from
  T0) — a transient cross-field inconsistency in the ~1–8 s enrichment window that
  self-heals on the next `setInterval(load)`. **Accepted** for a single-user
  localhost triage tool (it never breaks AC5: `waitingOn` and `waitingStages` come
  from the same delta). _Per ADR-0007; a cached-disk-scan optimization is the noted
  follow-up, not built here._

### Deviation log (after reconciliation)

- **Server-side deltas locus, as specced.** `/api/data` → `scanAll(cfg, { gh:
  DISABLED_GH })` (disk-only, reuses the proven 009-04 no-`gh` path); new `/api/prs`
  → real `scanAll` + a new pure `prDeltas(scanResult)` (`src/scan.mjs`) →
  `{ generatedAt, projects:[{path, ownerLogin?, prs?, waitingOn, waitingStages}] }`.
  Client: `mergePrDeltas` (pure, `public/render.mjs`) keyed field-swap + `render()`
  re-sort; `loadPrs()` fires non-blocking after phase-one render.
- **AC3 residual RESOLVED, not deferred.** The open detail's active tab
  (Activity/Overview) IS preserved across the phase-two wholesale re-render
  (`loadPrs` captures + restores it) — the "else accept-and-note" branch does not
  apply. Scroll position is **not** preserved (accepted, consistent with the
  existing `setInterval(load)` behaviour).
- **Craft nit FIXED: narrowed the phase-two swallow.** `loadPrs`'s try/catch now
  wraps only the fetch+json; `mergePrDeltas`/`render()` run after it, so a genuine
  merge/render bug reaches the console while a `gh`-absent/offline/timeout/non-ok
  `/api/prs` still degrades silently to the disk render (AC4).
- **Arch nit FIXED: atomic-swap guard in `mergePrDeltas`.** `waitingOn`/
  `waitingStages` are now swapped only when the delta carries BOTH (`in`-guard) and
  always together, making the single-source (AC5) intent explicit and preventing a
  future partial delta from wiping a phase-one headline.
- **Craft/compliance nits LOGGED (not fixed here):** the tab capture/restore
  duplicates the click-handler DOM-flip and currently guards the *inert* Activity
  placeholder (candidate for a shared `setActivityTab` helper when Activity carries
  real content); `activityTabWasActive` is captured before the `await` (a tab
  switch *during* the fetch is lost — low impact, short window, inert tab);
  `loadPrs`'s client-side AC3/AC4 behaviour is untested inline `index.html` glue,
  consistent with the repo's boundary (only `render.mjs` pure functions are
  unit-tested). Parked to inbox.
- **A5 transient accepted (unchanged):** `/api/prs` re-scans disk at T1 vs
  `/api/data`'s T0, so a merged headline can briefly lead its detail body; self-heals
  on next `setInterval(load)`; the cached-disk-scan optimization is the ADR-0007
  follow-up, not built here.
- **External-on-fixture test note:** on `proj-jig`, External (rank 6) can never be
  the head `waitingOn` (a rank-3 DECIDE is always present), so its presence is
  asserted in `waitingStages` with the correct action text rather than as
  `waitingOn` — accurate to the pinned precedence, not a scope change.

### Reconciliation sweep

- **Architecture impact — `updated`.** `docs/architecture.md`: the `src/server.mjs`
  module entry (two-phase `/api/data` disk-only + new `/api/prs` deltas), the
  `public/index.html` entry (two-phase load + `mergePrDeltas` keyed swap), the
  repo-structure `server.mjs` line, and — the load-bearing one — the `## Contract
  surfaces` block: `/api/data` marked disk-only with the **first non-additive**
  change (drops `prs`/`ownerLogin`) called out explicitly, plus a new `GET /api/prs`
  surface documenting the delta shape + degrade-to-disk-values contract.
- **Load-bearing decision / ADR — `no-op` (this slice IMPLEMENTS ADR-0007).** The
  decision (two-phase, non-blocking) is ADR-0007 (Accepted); the phase-two locus
  choice (server-side deltas over client-re-derive) is recorded in the spec's
  §Chosen phase-two design + the ADR's Open questions. No new ADR.
- **Contract-surface — `updated`.** The non-additive `/api/data` removal is
  documented as deliberate (single localhost consumer, lockstep, re-supplied by
  `/api/prs`) rather than left to inference.
- **Leanness sweep — `no-op`.** Two small pure functions (`prDeltas`,
  `mergePrDeltas`), one shared `DISABLED_GH` constant, one non-blocking `loadPrs`.
  The stateless double-scan deliberately avoids cross-request cache machinery
  (ADR-0007 Option-C cost). No speculative knobs.
- **Inbox — `updated`.** Parked the three logged client-glue nits (shared tab
  helper / capture-before-await / untested inline glue) and re-noted the
  cached-disk-scan follow-up.
- **Tests — `no-op` (green).** 351 pass; new tests mutation-checked (feature-off →
  reds; the disabled-gh spy fails if the `gh.available` guard is removed).
- **Memory-sync — deferred to close-out** (the two-phase-load pattern; primer
  active-specs gains 010 when the spec closes).
