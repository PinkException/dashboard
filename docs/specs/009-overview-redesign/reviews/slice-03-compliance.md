---
slice: 009-03 — cross-project action-queue lens
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-01T18:35:43Z
prompt_source: review.py implementation
---

Compliance pass on slice 009-03 (read-only, saw work fresh). VERDICT: pass.

All five ACs met by a clean single-source refactor:
- AC1: pure `setLens` toggle; both lenses in the one self-contained page (ADR-0001).
- AC2: one row per open STAGE from `waitingStages`, capped top-3 per project; cap is a tested pure fn.
- AC3: grouped/ordered Land→Review→Decide→Finish→Start (ascending rank) per the pinned map; stable within group.
- AC4: Idle/empty/missing-field projects contribute no row; External unreachable pre-009-04.
- AC5 (load-bearing): `deriveWaitingStages` is the source, `deriveWaitingOn` is re-expressed as its head, so grid and queue cannot disagree by construction. The concrete-value 009-02 fixtures (test/lib.test.mjs) still run against the refactored `deriveWaitingOn` and are the substantive byte-identical guard.
`public/render.mjs` imports nothing from `src/lib.mjs` (scan-side rule respected). 009-01/009-02 grid/detail behaviour preserved.

Reconciliation notes (non-blocking): the DoD "byte-identical" guarantee is carried by the retained concrete 009-02 fixtures, not by the self-referential head-equality tests; the queue→detail→back lens behaviour was noted (fixed in the craft round).
