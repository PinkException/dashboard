---
status: DONE
dependencies: [009-02, adr-0006]
last_verified: 2026-09-01
arch_review: true
frame_review: true
---

<!-- jig self-defining vocabulary (soft, forward-only). -->
<!-- jig grounding (spec 064-02 / ADR-0020): probe runnable-surface claims. -->

## Slice 009-04 — gh-optional PR enrichment (un-defers 003-03)

**Goal:** When the `gh` CLI is present and authenticated, fold each project's PR
state into the triage surface — an approved-and-ready PR becomes a **MERGE** (You)
action, a PR awaiting **your** review becomes a **REVIEW** (You) action, and a PR
out for **someone else's** review becomes an **External** item — in both the grid
(009-02) and the detail view (009-01); when `gh` is absent or unauthenticated, the
overview behaves **exactly as it does without this slice** — no error, no
missing-feature noise. This lands the PR-triage placement ADR-0006 committed to
and **un-defers slice 003-03 (pr-badges)**.

> **Frame-critique resolution (2026-09-01, pre-impl — see
> `reviews/slice-04-frame-critique.md`).** The original two-bucket framing
> (MERGE + External only) was falsified by a live `gh` probe: "out for another's
> review → External" is only correct when the PR is waiting on *someone else*. A
> PR where the **owner is the requested reviewer** is waiting on the owner — a
> REVIEW (You) case that the two-bucket rule would have mis-filed as External
> (rank 6 of 7, just above Idle), burying the exact "a PR needs YOU" signal
> ADR-0006's kill criteria name as the under-report failure. The taxonomy already
> owns a REVIEW (You) state (`deriveWaitingStages`, rank 2), so this is a
> **precise-mapping refinement within the spec's PR-folding mandate** (ADR-0006
> delegated "how PR states fold in" here), not new scope. External is now
> owner-conditional and the three-way split keys on the owner's `gh` login.

**DoR:**
- ✅ 009-02 DONE (the waiting-on states + External/MERGE slots exist to fill).
- ✅ [ADR-0006](../../decisions/adr-0006-overview-triage-surface.md) Accepted —
  `gh` is an optional enrichment of the same category as the existing `git`
  shell-out (`src/scan.mjs:87, 258`), governed by ADR-0001's npm-package scope,
  not banned by it.

**Acceptance Criteria:**

1. **Present + authenticated → PR state surfaces.** With `gh` installed and
   authenticated, each project's open PRs are read (via `gh` over
   `node:child_process`, mirroring the existing `git` invocation) and placed by
   the **owner-keyed three-way mapping** below. The read uses
   `gh pr list --state open --json number,title,url,author,isDraft,reviewDecision,mergeStateStatus,reviewRequests`
   (fields verified present, `reviews/` grounding); non-draft open PRs only.
   Placement:
   - **MERGE (You)** — a PR the owner can land now: `reviewDecision == "APPROVED"`
     **and** `mergeStateStatus == "CLEAN"` (mergeable; `BLOCKED`/`BEHIND`/`DIRTY`/
     `UNKNOWN` do **not** qualify). Author-agnostic — an approved, clean PR is the
     owner's to merge whoever opened it.
   - **REVIEW (You)** — a PR awaiting the **owner's** review: the owner's login
     appears in `reviewRequests[].login` (their move to review).
   - **External** — a PR out for **someone else's** review: `reviewRequests` is
     non-empty, the owner is **not** among them, and it is not MERGE-eligible
     (not the owner's move).
   - A PR matching none of the three contributes **no** waiting-on signal (it
     falls through to the disk-derived state) — never a fabricated bucket.

   The owner's `gh` login is captured **once per scan** (AC3) and passed into the
   pure derivation (`deriveWaitingStages` / its head `deriveWaitingOn`, `src/lib.mjs`)
   alongside the per-project PR list; MERGE/REVIEW slot into the existing
   rank-1/rank-2 You-states and External into the rank-6 slot 009-02 reserved.
   Reflected in the grid state (009-02), 009-03's cross-project action-queue, and
   the detail view's sessions/PR area (009-01). _(Post-rebase note: after sibling
   slice 009-03 landed, this folding is into `deriveWaitingStages`, not the
   pre-refactor single-return `deriveWaitingOn` — see the deviation log.)_
2. **Absent or unauthenticated → exact status-quo.** With `gh` missing, not on
   `PATH`, or not authenticated, the overview renders identically to a run
   without this slice: no thrown error, no 500, no "PR unavailable" noise on the
   card, and every other signal unaffected. The `git clone && node server.mjs`
   zero-install promise is preserved (A4).
3. **Detection is explicit and cheap, and captures owner identity.** `gh`
   availability + auth is probed **once per scan** (not per project); the same
   probe captures the **owner's login** (e.g. `gh api user --jq .login`, or the
   active-account login from `gh auth status`) — the identity AC1's REVIEW/External
   split keys on. Failures (missing binary, not on `PATH`, unauthenticated, no
   login resolvable) degrade to AC2, never crash the scan or block the rest of the
   payload. A slow/hanging `gh` is bounded (timeout) and treated as absent — for
   both the once-per-scan probe and each per-project `gh pr list` call.
4. **No new npm dependency.** PR reading shells out to the `gh` binary only; no
   package is added (ADR-0001 holds — the ADR-0006 ruling is that a shelled
   binary is not a bundled dependency).
5. **003-03 reconciled.** The slice 003-03 (pr-badges) record is updated to point
   here for its resolution (its placement moved from session rows to the glance
   triage state per ADR-0006) — transitioned out of DEFERRED via the lifecycle,
   not silently.

**DoD:**
- [x] All ACs pass; full suite green (341 tests).
- [x] Test coverage: the present-authenticated paths (fixture/mock `gh` output →
      **MERGE** placement on approved+CLEAN, **REVIEW** placement when the owner
      is in `reviewRequests`, **External** placement when a non-owner is, and the
      owner-is-reviewer-not-mis-filed-as-External regression), the absent path
      (status-quo render, no error), the unauthenticated path, the
      not-a-git-repo / no-GitHub-remote path (treated as no PRs, not a crash), and
      the timeout/hang-treated-as-absent path.
- [x] Each new test shown to fail when its feature is removed (mutation check).
- [x] Frame-critique pass (`frame_review: true` — the `gh` JSON-shape and
      detection assumptions, A4). `reviews/slice-04-frame-critique.md`.
- [x] Arch-review pass (`arch_review: true` — new external-binary boundary in the
      scanner). `reviews/slice-04-arch.md`.
- [x] Reviewed by `reviewer` subagent (compliance + craft).
- [x] Deviation log + reconciliation sweep produced.
- [x] Reconciliation review passed; 003-03 lifecycle updated (AC5).

**Anti-horizontal-phasing check:** After this slice, an owner with `gh` installed
sees "PR approved — ready to merge" surface as a MERGE action on the glance, and
an owner without `gh` sees no change at all — PR triage arrives as a graceful
bonus, and the base product's zero-install promise is intact.

### Grounding (probed 2026-09-01, this machine)

- `gh` present (`/opt/homebrew/bin/gh`, v2.96.0) and authenticated (account
  `Kyarha`, scopes incl. `repo`). One `gh pr list` call ≈0.47s wall.
- `gh pr list --json` accepts all fields AC1 names — `number, title, url, author,
  isDraft, reviewDecision, mergeStateStatus, reviewRequests` — verified against
  `gh`'s own field enumeration. Observed enums: `reviewDecision ∈ {APPROVED,
  CHANGES_REQUESTED, REVIEW_REQUIRED, ""}`; `mergeStateStatus ∈ {CLEAN, BLOCKED,
  BEHIND, DIRTY, UNKNOWN, …}`; `reviewRequests` is `[{login}]` (or `[]`).
- Running `gh pr list` from a non-git dir errors on **stderr** — the scanner must
  read `gh`'s own exit status (execFileSync throws on non-zero), not a piped one.
- The dashboard's own repo has **0 open PRs** today → the MERGE/REVIEW/External
  present-path tests are fixture/mock-driven, not live-repo-driven.

### Assumptions

- **A4′ (refined) — owner identity is resolvable and the three-way map is
  total-enough.** The once-per-scan probe can resolve the owner's `gh` login, and
  every open non-draft PR either lands in exactly one of MERGE / REVIEW / External
  or contributes no signal. _Grounded for the single-account case (probe above).
  Residual, non-blocking: a multi-account `gh` setup, or a PR whose review is
  requested from a **team** rather than a user (`reviewRequests` can carry a Team
  entry), may not key cleanly on a single login — treated as "no PR signal" (falls
  through to disk state), never mis-filed. Recorded, not solved here._
- **A4 (carried from spec) — `gh pr list` JSON maps onto the waiting-on states.**
  Now grounded by the probe above and the owner-keyed mapping in AC1; the
  frame-critique that falsified the original two-bucket framing is resolved in the
  Goal note.

### Deviation log (after reconciliation)

- **Frame-critique scope refinement (pre-impl).** The original AC1 two-bucket
  framing (MERGE + External) became a **three-way owner-keyed** split (MERGE /
  REVIEW / External), External made owner-conditional, keyed on the owner's `gh`
  login captured once per scan. Driven by the frame-critique blocker (a
  PR awaiting the owner's review would otherwise mis-file as External). Within
  ADR-0006's PR-folding mandate — REVIEW/rank-2 and External/rank-6 already
  existed in the 009-02 taxonomy. Recorded in the Goal note +
  `reviews/slice-04-frame-critique.md`.
- **Team-review-request → no signal (craft nit `[nit][spec]`).** Assumption A4′
  says a team-requested PR is treated as no signal, never mis-filed; the craft
  pass found the External branch would have filed a team-only request (no
  per-user login) as External. Reconciled the **code to match A4′**: the External
  branch now counts only User review-requests (those with a `.login`); a team-only
  request yields no PR signal (`src/lib.mjs`), with a named regression test
  (`test/lib.test.mjs`).
- **`--limit 100` on `gh pr list` (craft nit `[nit][impl]`).** `gh` defaults to 30
  open PRs; a busier repo would silently truncate. Added `--limit 100` so the
  REVIEW/External scan sees all open PRs, not just the lowest-numbered page
  (`src/scan.mjs`).
- **MERGE tiebreak — accepted as-is (craft `[nit]`, no change).** When a project
  has both a RECONCILED slice and an approved+CLEAN PR, the glance headline names
  the slice ("land N reconciled slices"); the PR still appears in the detail
  view's PR list, and the MERGE/You rank-1 state is unchanged. Deterministic and
  tested; the residual (a glance-only user could overlook the second merge-ready
  item) is accepted, not a lost signal.
- **Present-path network latency — accepted trade (arch + craft `[nit]`, no
  change).** `scanAll` now runs one `gh api user` probe + one `gh pr list` per
  jig project, serially, via synchronous `execFileSync`, with no per-request
  cache (`src/server.mjs` rescans per `/api/data`). Healthy ≈0.47s/call; worst
  case ≈(1+N)×`GH_TIMEOUT_MS` (5s) of event-loop-blocked wall time on a degraded
  network. Accepted for a single-user localhost dashboard; a short-TTL PR cache /
  aggregate scan budget is the noted follow-up if project counts grow (parked to
  the inbox, not built here).

- **Post-compliance polish (two low-severity compliance nits, both closed).**
  (1) Added a dedicated test for the authenticated-but-empty-login degradation
  branch (`buildGhContext` → unavailable when the probe resolves a blank login;
  `test/scan.test.mjs`). (2) `prStateHint` (`public/render.mjs`) no longer returns
  a blank hint — an approved-but-not-mergeable PR reads "approved · not
  mergeable", a changes-requested PR "changes requested", and any other open PR
  "open", so every listed PR carries a meaningful hint. Suite 310 green.
- **Rebase-onto-009-03 integration (the biggest deviation from the as-scoped
  plan).** This slice was built against a base that predated sibling slice 009-03,
  then rebased onto `origin/main` after 009-03 merged. 009-03 refactored the
  single `deriveWaitingOn` into a rank-ordered **`deriveWaitingStages`** list (so
  the new cross-project action-queue can show every open stage, not just the top
  one), leaving `deriveWaitingOn` as its head (`deriveWaitingStages(…)[0] ?? Idle`).
  Consequences folded in at merge: the PR stages (MERGE / REVIEW / External) are
  now pushed as **list entries in `deriveWaitingStages`** rather than early-returns
  in `deriveWaitingOn` as AC1 originally scoped — so PR work surfaces in **both**
  the grid headline *and* 009-03's action-queue lens (a strict improvement, and it
  answers the craft "second merge-ready item could be overlooked" nit — the queue
  now shows it). Within a rank the disk-derived stage is pushed **before** the PR
  stage, preserving the grid's pre-009-04 tiebreak. `ownerLogin` is threaded
  through both `deriveWaitingStages` and `deriveWaitingOn` (optional trailing arg;
  the 009-02 two-arg contract preserved). A new integration test
  (`test/lib.test.mjs`) pins that a MERGE slice + a REVIEW PR + an External PR all
  appear as distinct rank-ordered stages while the grid head stays the slice. Full
  merged suite: 341 green.

### Reconciliation sweep

- **Architecture impact — `updated`.** `docs/architecture.md`: the "Key external
  services" line (git-only → git + optional `gh`), the `src/lib.mjs` module entry
  (the load-bearing seam is **`deriveWaitingStages`** post-rebase — PR stages fold
  in as list-pushes; `deriveWaitingOn` is its head; both stay pure with the
  optional `ownerLogin` + `project.prs`), the `src/scan.mjs` entry (new optional
  `gh` read-boundary + `buildGhContext` seam; `ownerLogin` threaded into both
  derivations), and the `GET /api/data` contract surface (additive `prs[]` +
  `ownerLogin`, alongside 009-03's `waitingStages`).
- **Load-bearing decision / ADR trigger — `no-op` (satisfied by existing ADR).**
  003-03 parked "`gh` on scan-path vs the routine-snapshot bridge" as needing
  "likely a short ADR." No **new** ADR: **ADR-0006 already decided it** —
  "PR state is sourced via `gh` as an optional enrichment," the scanner reading
  `gh` directly (scan-path), degrading when absent. 009-04 implements that
  decision; it makes no new load-bearing choice.
- **AC5 / closed-spec lifecycle — `updated`.** Slice 003-03 (pr-badges)
  transitioned DEFERRED → DRAFT → **ABANDONED** via the lifecycle, with an
  abandonment reason pointing here + to ADR-0006 (the session-row placement was
  superseded; the capability ships in 009-04's glance state + detail view).
- **Contract surface — `updated`.** The additive `/api/data` fields (`prs[]`,
  `ownerLogin`) are documented; the page renders identically without them (no-`gh`
  run), preserving the graceful-degradation contract.
- **Leanness sweep — `no-op`.** No abstraction added beyond the ACs: two small
  pure helpers (`prIsMergeable`, `lowestPrNumber`), one injectable-runner seam
  (`buildGhContext`) that exists for testability, one pure detail block
  (`prsDetailBlock`). No config knobs or speculative extension points.
- **Inbox / memory — `deferred`.** The network-latency-cache follow-up and the
  A4′ multi-account residual are recorded here (deviation log + Assumptions);
  a memory note on the `waitingOn` PR extension is written at close-out.
- **Tests — `no-op` (green).** Full suite green (309 pass, 0 fail); the PR
  branches are mutation-checked (feature-off → reds).
