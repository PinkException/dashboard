---
slice: 009-04 — gh-optional PR enrichment (un-defers 003-03)
pass: compliance
verdict: pass
reviewer: general-purpose (implementation)
reviewed_at: 2026-09-01T23:18:42Z
prompt_source: review.py implementation (re-run post-reconciliation)
---

Compliance pass — RE-RUN against the completed state (general-purpose, read-only).
VERDICT: pass. All five ACs + the DoD verified; suite green (310 pass, 0 fail).

- AC1 present-authenticated: owner-keyed three-way MERGE/REVIEW/External mapping in
  the pure `deriveWaitingOn` (src/lib.mjs); once-per-scan probe + owner-login
  capture + per-project read in `buildGhContext`/`scanProject` (src/scan.mjs) with
  bounded timeouts.
- AC2 absent/unauth → exact status quo; AC3 cheap once-per-scan detection + owner
  identity + timeout bound; AC4 no npm dep (shells `gh` only).
- AC5 satisfied: 003-03 is status ABANDONED with an abandonment reason pointing at
  009-04 + ADR-0006 (transitioned DEFERRED→DRAFT→ABANDONED via the lifecycle).
- DoD: deviation log + reconciliation sweep filled; architecture.md + inbox
  updated; every PR branch mutation-checked; the gh/non-gh, MERGE/REVIEW/External,
  owner-is-reviewer regression, team-request-no-signal, and timeout/throw
  degradations all covered by non-vacuous tests.

Two low-severity items the re-run flagged — BOTH closed as post-compliance polish
(no behaviour regression, suite 309→310):
- authenticated-but-empty-login degradation branch had no dedicated test → added
  (`test/scan.test.mjs`).
- an APPROVED-but-not-CLEAN PR with no reviewRequests listed with a blank hint →
  `prStateHint` now returns a meaningful hint for every PR (`public/render.mjs`).

Recorded note (no action): AC3 permits the cheaper local `gh auth status` probe;
the impl uses `gh api user` (network) — AC-compliant, latency parked to inbox.

First compliance run returned needs-changes ONLY on reconciliation-phase items
(AC5 + deviation log/sweep, correctly sequenced after this gate); all resolved
before this re-run. Reviewer prompt: review.py implementation over src + tests +
003-03 slice + architecture.md.
