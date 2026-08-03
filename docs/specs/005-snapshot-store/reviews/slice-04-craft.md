---
slice: 005-04 — rebuild the recurring snapshot routine + choose its cadence
pass: craft
verdict: pass
reviewer: jig:reviewer (fresh-context, Opus)
reviewed_at: 2026-08-03T14:20:55Z
prompt_source: review.py pr-review
---

Craft pass on slice 005-04 → pass. No blockers.

Strengths called out: `progressSignature` uses JSON.stringify with fixed key order for a deterministic order-independent compare, with a comment precisely justifying the bug-count exclusion and spec-granularity coarseness; `lastEntryOfSource` mirrors the reader's malformed-line leniency; the architecture note proactively documents the freshness-label second-order consequence; comments tie each decision to its ADR/bug/frame-critique rationale. The reviewer independently verified `autoFields` picks the IN_PROGRESS spec off a sorted list so `next` is stable across runs (no false churn).

Two non-blocking nits, both since addressed in the test-hardening round: an explicit no-in-repo-write negative assertion (added), and a cross-source narrative-vs-auto card test (added, exercising laterSnapshot over both sources' narrative selections).

Reconciliation note (non-blocking): `--if-changed` composes with manual/narrative writes too; it is documented and intended for the auto routine, and same-source comparison makes stray use harmless — deliberate, not a guarded combination.
