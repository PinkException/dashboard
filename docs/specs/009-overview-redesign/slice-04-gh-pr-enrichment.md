---
status: DRAFT
dependencies: [009-02, adr-0006]
last_verified:
arch_review: true
frame_review: true
---

<!-- jig self-defining vocabulary (soft, forward-only). -->
<!-- jig grounding (spec 064-02 / ADR-0020): probe runnable-surface claims. -->

## Slice 009-04 — gh-optional PR enrichment (un-defers 003-03)

**Goal:** When the `gh` CLI is present and authenticated, fold each project's PR
state into the triage surface — an approved-and-ready PR becomes a **MERGE** (You)
action, a PR out for someone else's review becomes an **External** item — in both
the grid (009-02) and the detail view (009-01); when `gh` is absent or
unauthenticated, the overview behaves **exactly as it does without this slice** —
no error, no missing-feature noise. This lands the PR-triage placement ADR-0006
committed to and **un-defers slice 003-03 (pr-badges)**.

**DoR:**
- ✅ 009-02 DONE (the waiting-on states + External/MERGE slots exist to fill).
- ✅ [ADR-0006](../../decisions/adr-0006-overview-triage-surface.md) Accepted —
  `gh` is an optional enrichment of the same category as the existing `git`
  shell-out (`src/scan.mjs:87, 258`), governed by ADR-0001's npm-package scope,
  not banned by it.

**Acceptance Criteria:**

1. **Present + authenticated → PR state surfaces.** With `gh` installed and
   authenticated, each project's open PRs are read (via `gh` over
   `node:child_process`, mirroring the existing `git` invocation) and placed:
   approved & ready-to-merge → the project's **MERGE** (You) action; out for
   another's review → an **External** item. Reflected in the grid state (009-02)
   and the detail view's sessions/PR area (009-01).
2. **Absent or unauthenticated → exact status-quo.** With `gh` missing, not on
   `PATH`, or not authenticated, the overview renders identically to a run
   without this slice: no thrown error, no 500, no "PR unavailable" noise on the
   card, and every other signal unaffected. The `git clone && node server.mjs`
   zero-install promise is preserved (A4).
3. **Detection is explicit and cheap.** `gh` availability + auth is probed once
   per scan (not per project) and failures degrade to AC2, never crash the scan
   or block the rest of the payload. A slow/hanging `gh` is bounded (timeout) and
   treated as absent.
4. **No new npm dependency.** PR reading shells out to the `gh` binary only; no
   package is added (ADR-0001 holds — the ADR-0006 ruling is that a shelled
   binary is not a bundled dependency).
5. **003-03 reconciled.** The slice 003-03 (pr-badges) record is updated to point
   here for its resolution (its placement moved from session rows to the glance
   triage state per ADR-0006) — transitioned out of DEFERRED via the lifecycle,
   not silently.

**DoD:**
- [ ] All ACs pass; full suite green.
- [ ] Test coverage: the present-authenticated path (fixture/mock `gh` output →
      MERGE/External placement), the absent path (status-quo render, no error),
      the unauthenticated path, and the timeout/hang-treated-as-absent path.
- [ ] Each new test shown to fail when its feature is removed.
- [ ] Frame-critique pass (`frame_review: true` — the `gh` JSON-shape and
      detection assumptions, A4).
- [ ] Arch-review pass (`arch_review: true` — new external-binary boundary in the
      scanner).
- [ ] Reviewed by `reviewer` subagent (compliance + craft).
- [ ] Deviation log + reconciliation sweep produced.
- [ ] Reconciliation review passed; 003-03 lifecycle updated (AC5).

**Anti-horizontal-phasing check:** After this slice, an owner with `gh` installed
sees "PR approved — ready to merge" surface as a MERGE action on the glance, and
an owner without `gh` sees no change at all — PR triage arrives as a graceful
bonus, and the base product's zero-install promise is intact.

### Deviation log (after reconciliation)

_TBD at implementation._

### Reconciliation sweep

_TBD at reconciliation._
