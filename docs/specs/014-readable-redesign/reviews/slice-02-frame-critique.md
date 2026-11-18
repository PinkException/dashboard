---
slice: 014-02 — action queue in the new look
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-11-18T04:47:19Z
prompt_source: review.py frame-critique
---

Round 3 (2026-11-17): PASS. Round-2 finding resolved by D11 + AC6 (cap per project per step). Attacked assumption — emitted waitingStages + waitingOn fill all six steps without new page derivation — holds: deriveWaitingStages emits ranks 1-6 only, never Idle (src/lib.mjs:725-728, 747-847); prDeltas swaps both together (src/scan.mjs:936-944); forced markers resolve to owner states only (src/lib.mjs:693-710). Notes folded: wait line is per card from its own stage; "+N more" is a future-proofing guard (no step emits >2 per project today).
