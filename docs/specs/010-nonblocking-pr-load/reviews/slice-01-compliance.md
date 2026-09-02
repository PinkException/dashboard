---
slice: 010-01 — two-phase load: disk-first render, gh PR states fold in
pass: compliance
verdict: pass
reviewer: general-purpose (implementation)
reviewed_at: 2026-09-02T23:46:51Z
prompt_source: review.py implementation
---

Compliance pass (general-purpose, read-only). VERDICT: pass. All five ACs met;
suite green (351 pass); matches ADR-0007's chosen server-side-deltas design.
- AC1: /api/data → scanAll(cfg, {gh: DISABLED_GH}); no gh subprocess; prs/ownerLogin omitted.
- AC2: /api/prs → real scanAll + prDeltas → { generatedAt, projects:[{path, ownerLogin?, prs?, waitingOn, waitingStages}] }.
- AC3: two-phase load; mergePrDeltas by path + re-sort; open detail re-resolves by path; active tab preserved.
- AC4: every gh/fetch failure swallowed in loadPrs → disk render stands, no error.
- AC5: waitingOn + waitingStages carried together in every delta → single-source survives the merge.
Tests non-vacuous: disabledGhSpy asserts listPRs.calls.length===0 (fails if the gh.available guard is removed); prDeltas/mergePrDeltas assert real shape/merge/re-sort.

Non-blocking items → reconciliation sweep (expected TBD at this gate):
- architecture.md `## Contract surfaces`: /api/data still documents prs/ownerLogin (009-04) — this slice moves them off; new /api/prs surface undocumented. Update at reconcile.
- server route glue + loadPrs DOM glue have no server/DOM-level test — consistent with the project's no-server-test / DOM-glue-over-tested-pure-functions convention; unit coverage satisfies the DoD's "listPRs never called on /api/data" via the injected spy.

Reviewer prompt: review.py implementation over server/scan/render/index + tests.
