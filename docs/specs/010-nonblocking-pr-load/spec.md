---
status: IN_PROGRESS
skill:
use_cases: []
---

<!-- jig self-defining vocabulary (soft, forward-only). -->

# Spec 010: Non-blocking PR load (two-phase)

> Implements [ADR-0007](../../decisions/adr-0007-non-blocking-pr-enrichment.md):
> the overview must render immediately from disk data and never block on the
> optional, network-sourced `gh` PR enrichment. Fixes the ~8.6 s first paint that
> spec 009-04 introduced by bundling `gh` into the one synchronous `/api/data`
> scan.

## Overview

Spec 009-04 folded `gh`-sourced pull-request state into the overview's triage
signal, on the **synchronous scan path**: `src/server.mjs` answers every
`GET /api/data` with one blocking `scanAll(config)` that now runs a `gh api user`
probe plus one `gh pr list` per jig project. Measured live (2026-09-02, 8
projects, 6 with PRs) first paint took **~8.6 s**; the disk-only scan (everything
except PRs) is **~1.38 s cold / 0.72 s warm** — `gh` is the only network-sourced,
only slow input. ADR-0007 (Accepted) fixes this: **two-phase load** — the page
renders from a disk-only scan immediately, and the `gh`-sourced PR states are
fetched separately and folded into the already-rendered rows when they arrive.

This spec is **presentation-and-transport plumbing over the existing scan**: the
derivation (`deriveWaitingStages` / `deriveWaitingOn` in `src/lib.mjs`) and the
`gh` reader (`buildGhContext` in `src/scan.mjs`) are unchanged; what changes is
*when* the `gh` part runs and *how* the page assembles the two halves.

### Chosen phase-two design (resolving ADR-0007's open question)

ADR-0007 left the phase-two **computation locus** open (server-recompute vs
client-re-derive). This spec chooses **server-recompute returning lean deltas**,
because it keeps derivation server-side (honouring ADR-0001's convention that the
page performs no derivation and never imports `src/lib.mjs`) and needs no new
browser-side taxonomy logic:

- **`GET /api/data`** → a **disk-only** scan: `scanAll(config)` run with a
  disabled `gh` context, so **zero** `gh` calls. Same payload shape as today; the
  `waitingOn`/`waitingStages` are derived from disk signals alone, and `prs`/
  `ownerLogin` are absent. Fast (~disk-only time).
- **`GET /api/prs`** → the enrichment phase: a full `scanAll(config)` with the
  real `gh` context, returning only the **per-project deltas** the first payload
  lacked — `{ path, ownerLogin, prs, waitingOn, waitingStages }` per project.
  Stateless (it re-runs the disk scan too; the redundant ~1 s is off the critical
  path). Every `gh` failure degrades to deltas that equal the disk values (empty
  `prs`), so the page simply does not change.
- **The page** (`public/index.html`) fetches `/api/data`, renders the grid, then
  fetches `/api/prs` and merges each delta into its in-memory model by `path`,
  re-sorts finish-first, and re-renders — PR-promoted projects move up and gain
  their PR badge/detail as the enrichment lands.

## Assumptions

- **A1 — disk-only is much faster than enriched (carried from ADR-0007,
  grounded).** Disk-only `scanAll` ≈1.38 s cold / 0.72 s warm vs ≈8.6 s enriched
  (measured 2026-09-02). Two-phase removes the dominant blocking cost. _Re-timed
  at implementation with the actual `/api/data` disabled-`gh` path._
- **A2 — `gh` is the only network/slow input (carried, grounded).**
  `buildGhContext` is the sole `gh` caller (`src/scan.mjs`); `git` is local;
  everything else is disk. So a disabled-`gh` scan has no network I/O. _Re-verified
  by enumerating scan.mjs's sub-process calls before splitting._
- **A3 — a disabled `gh` context yields the exact status-quo disk scan.** Passing
  `scanAll` a `{ available:false, listPRs:()=>[] }` context already makes
  `scanProject` skip all PR reads (009-04), so `/api/data` reuses the proven
  no-`gh` path rather than a new code branch. _Grounded in the 009-04 tests
  (absent-path → status-quo); re-asserted by a `/api/data`-emits-no-`prs` test._
- **A4 — the client already holds everything the merge needs.** The disk `/api/data`
  payload already carries per-project `specs`/`workstreams`/`compass`/`sessions`
  and a disk `waitingStages`; the delta only replaces `waitingOn`/`waitingStages`
  and adds `prs`/`ownerLogin`, so the merge is a keyed field-swap + re-sort, no
  client-side derivation. _Unverified across the render path until 010-01 wires
  it; the finish-first re-sort already exists (`sortProjectsByWaitingOn`,
  `public/render.mjs`)._

## Decomposition

SPIDR — this is **one vertical slice**. It splits cleanly on no axis: the value
(instant paint + PR states folding in) requires the server split **and** the
client two-phase assembly together; a server-only or client-only half delivers no
user-visible change and risks a regression (a disk-only `/api/data` with no client
phase two would silently drop PR state). The `gh`-absent path is not a separate
slice — it falls out of the disabled-context reuse (A3) and is covered as an AC.

- **Rejected — split by Path (gh-present vs gh-absent).** The absent path is the
  status-quo disk render with an empty phase two; it carries no independent
  implementation, only a test. Not a slice.
- **Rejected — client-re-derive locus (ADR-0007 Option).** Viable but adds
  browser-side taxonomy logic the architecture deliberately avoids; server-side
  deltas are the leaner fit. Recorded in the ADR as the alternative.

## Slices

- [010-01 — two-phase load: disk-first render, gh PR states fold in](slice-01-two-phase-load.md)
