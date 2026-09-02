---
status: Accepted
dependencies: [adr-0006]
last_verified: 2026-09-02
frame_review: true
---

# ADR-0007: PR enrichment is delivered non-blocking (two-phase load)

## Status

Accepted (2026-09-02)

## Context

Spec 009-04 (ADR-0006) added optional `gh`-sourced pull-request state to the
overview: when `gh` is installed and authenticated, each project's open PRs are
read and folded into its triage signal. It ships this on the **synchronous scan
path** — `src/server.mjs` answers every `GET /api/data` with one blocking
`scanAll(config)` that now performs, in-line, a once-per-scan `gh api user` probe
plus one `gh pr list` per jig-managed project.

Observed live (2026-09-02, this machine, 8 configured projects, 6 with open PRs):
first paint took **~8.6 s**, during which the localhost server served nothing and
the page showed only "scanning…". Every other signal on the page — specs, slice
statuses, sessions, progress, workstreams, compass — comes from **local disk
reads** (and fast local `git` sub-processes) that were near-instant before 009-04.
**PR state is the only network-sourced, only slow input in the scan.** Bundling it
into the one blocking response makes the whole dashboard wait on the one part that
is both optional and slow — the opposite of the "one page, nothing to wait on"
promise (vision principle 4).

This is the latency envelope the 009-04 arch + craft reviews flagged and parked to
the inbox; the owner, on seeing it live, ruled it a design flaw to fix now, and
chose the two-phase delivery below over a server-side cache.

## Decision Options Considered

### Option A: Keep PR enrichment on the synchronous scan path (009-04 status quo)
- **Pros:** simplest; one request, one payload; the derivation stays entirely
  server-side; no client merge.
- **Cons:** first paint blocks on N+1 `gh` **network** calls (measured ~8.6 s,
  worst case ≈(1+N)×5 s on a degraded network); the fast disk dashboard is held
  hostage by the one slow, optional input. Rejected — this is the flaw.

### Option B: Two-phase load — disk data first, PR enrichment folds in after (CHOSEN)
- **Pros:** first paint is instant and independent of `gh`; the disk dashboard is
  never blocked by a slow/absent/hanging `gh`; PR freshness is visually honest
  (states arrive when ready); preserves the exact no-`gh` behaviour (phase two
  simply never resolves useful data). Smallest change that removes the blocking.
- **Cons:** the client now does two fetches and a merge; PR-derived states visibly
  "pop in" a moment after first paint; the phase-two computation locus is a real
  sub-choice (see Open questions) — the `gh`-enriched stages can be recomputed
  **server-side** (a second server pass / cache) OR **re-derived client-side** from
  raw PR JSON. Both are technically open: `deriveWaitingStages` is a *pure* function
  (it reads only fields already on `project` — no git, no I/O), so nothing prevents
  a browser-safe fold; the only barrier to the client path is ADR-0001's
  **convention** that the page reads emitted fields and does not import scan-side
  `src/lib.mjs` — a deliberate boundary, not an impossibility.

### Option C: Server-side background PR cache, always-instant reads
- **Pros:** every load is instant *and* already carries PR states
  (eventually-consistent); no visible pop-in after the first populate.
- **Cons:** more machinery in a zero-dep single-process `node:http` server —
  a background refresh task, cache lifecycle, and staleness semantics; on a
  localhost dashboard typically opened fresh, the cache is **cold on every server
  start**, so the first load has no PR data anyway and the steady-state win is
  smaller than it appears. More surface for less marginal benefit than Option B.
  Rejected for now; recorded as the natural supersessor if pop-in proves annoying.

## Recommended Decision

**PR enrichment is delivered non-blocking, off the synchronous scan/render path,
as a two-phase load (Option B).** The page renders immediately from a **disk-only**
scan (no `gh`); the `gh`-sourced PR data is fetched **separately** and folded into
the already-rendered rows when it arrives. `GET /api/data` therefore returns the
disk-only dashboard (its waiting-on states derived from disk signals alone) and
never blocks on `gh`; a **second phase** supplies the `gh`-enriched PR states.
Whether that second phase is **server-recomputed** (a second server pass returns the
enriched view) or **client-re-derived** (phase two returns raw per-project PR JSON and
the page folds it in via a browser-safe function), and the exact endpoint shape, are
the implementing spec's to settle — both are viable (see Open questions). Every `gh` failure
still degrades to the exact no-`gh` behaviour — phase two simply yields nothing and
the disk-only page stands. This **refines the delivery mechanism of ADR-0006's
`gh`-optional enrichment; it does not change the decision** that PR state is an
optional, scan-path-sourced, gracefully-degrading enrichment.

## Consequences

**Becomes easier:**
- First paint is instant and never regresses with project count or a slow network.
- A hanging / very slow `gh` can no longer stall the whole dashboard.
- PR freshness is explicit — the page is honest that PR state arrives after the
  disk data, rather than pretending the whole view is one atomic snapshot.

**Becomes harder:**
- The client gains a two-request lifecycle and a merge step (previously one fetch).
- PR-derived states appear a beat after first paint (a deliberate, visible latency).
- The `waitingOn` / `waitingStages` contract must tolerate a **disk-only value that
  is later replaced by an enriched one** — whichever phase-two locus is chosen. The
  single-source invariant 009-03 established (`waitingOn === waitingStages[0]`) must
  survive that replacement: a client re-derivation preserves it by construction (it
  recomputes both from one function), whereas a server-delta swap must replace both
  fields atomically. This is a design constraint on phase two, not a blocker.

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

- **The disk-only scan is much faster than the `gh`-enriched one, but not
  instant.** _Measured (2026-09-02, this machine, 8 projects): disk-only
  `scanAll` (gh disabled) ≈**1.38 s cold / 0.72 s warm**, vs ≈8.6 s with the live
  `gh` calls — a ~6× first-paint win._ So two-phase removes the dominant blocking
  cost. The residual ~0.7–1.4 s is the local session-store walk over `~/.claude`
  transcripts (no network), **not** `gh`; shrinking it is a separate concern
  (out of scope here — noted as a kill-criterion input if it ever dominates)._
- **`gh` is the only network-sourced / slow input in the scan.** `git` calls are
  local (`-C <root>`, no network) and were always present; every other input is a
  local disk read. _Grounded by reading `src/scan.mjs` (only `gh` reaches the
  network); the implementing spec re-verifies before splitting the payload._
- **`deriveWaitingStages` is a pure function; the browser boundary is a
  *convention*, not an impossibility.** _Corrected by frame-critique (2026-09-02)._
  `src/lib.mjs` imports nothing and shells nothing — its header says "Pure — no
  filesystem or git calls" and `deriveWaitingStages(project, marker, ownerLogin)`
  reads only already-emitted `project.*` fields. The git-shelling lives in
  `src/scan.mjs` (`gitInfo`), not here. So a browser-safe PR fold is technically
  possible; the only barrier to a client-side phase two is ADR-0001's deliberate
  convention that the page reads emitted fields and does not import scan-side
  `src/lib.mjs`. Both phase-two loci (server-recompute, client-re-derive) are
  therefore genuinely open — the implementing spec chooses. _Grounded: `grep` of
  `src/lib.mjs` for `import`/`child_process`/`execFile` matches only comments._

## Kill criteria

- If the **disk-only** scan stops being materially faster than the enriched one
  (e.g. the `~/.claude` session-store walk grows until the ~1.4 s disk floor
  approaches the enriched time), two-phase no longer solves the blocking and the
  real cost is elsewhere — reopen and attack the disk scan instead.
- If the visible "pop-in" of PR states proves more confusing than the wait it
  replaces, supersede with Option C (a background-refreshed cache).

## Open questions

- **Phase-two computation locus** (the frame-critique's live sub-choice):
  **server-recompute** (phase two returns the `gh`-enriched view; derivation stays
  server-side, honouring ADR-0001's browser/scan boundary, but the server must
  reconstruct or cache each project's full context — specs/workstreams/compass — to
  re-fold PRs) **vs client-re-derive** (phase two returns only raw per-project PR
  JSON + `ownerLogin`; the page folds the PR stages into the disk `waitingStages`
  it already holds, via a small browser-safe merge — cheaper, preserves the
  single-source invariant by construction, but introduces browser-side derivation
  the current architecture deliberately avoids). The implementing spec picks and
  grounds the trade.
- Phase-two endpoint shape: a dedicated `GET /api/prs` (per-project PR data /
  enriched deltas) vs `GET /api/data?enriched=1` (full merged payload). Follows
  from the locus choice above.
- Whether phase two also needs a subtle in-flight affordance (e.g. a quiet
  "checking PRs…" hint) so the pop-in reads as intentional. (Spec / design.)
