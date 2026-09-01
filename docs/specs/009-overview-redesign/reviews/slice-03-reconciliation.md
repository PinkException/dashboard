---
slice: 009-03 — cross-project action-queue lens
pass: reconciliation
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-01T18:40:11Z
prompt_source: review.py reconciliation
---

Reconciliation review on slice 009-03 (read-only). VERDICT: pass. No issues.

Every deviation-log claim matches reality. The single-source refactor is real:
`deriveWaitingStages` (src/lib.mjs:726) is the source; `deriveWaitingOn`
(src/lib.mjs:799-801) is literally its head (`deriveWaitingStages(…)[0] ?? IDLE`).
scan.mjs emits both fields; render.mjs carries lens through openDetail/closeDetail
and index.html passes state.lens in both the open and back handlers. The
actionQueue shape, rank-keyed QUEUE_GROUPS, lensToggleHtml single-sourcing, and
both deferred nits are accurately described.

All four claimed doc updates present and correct: architecture.md (incl. the
Contract-surfaces GET /api/data entry documenting the additive waitingStages
field in prose per this project's convention), lightweight-decisions.md (with two
rejected alternatives), inbox.md (two deferred nits), spec.md decomposition
reframe. plan.md 009-03 section also present.

Leanness sweep clean: no routing framework, no deps, no config knobs beyond
capPerProject (default 3), which AC2 explicitly requires as a unit-tested pure
cap. Both parked nits are genuinely real (verified), not overstated.
