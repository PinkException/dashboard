---
slice: 014-02 — action queue in the new look
pass: frame-critique
verdict: needs-changes
reviewer: jig:reviewer
reviewed_at: 2026-11-18T04:39:08Z
prompt_source: review.py frame-critique
---

Round 2 (2026-11-17). Round-1 mapping gap resolved (D8, D9). New load-bearing gap: the per-project cap of 3 (render.mjs:675) hides the lowest ranks first, so the Merge (rank 6) step can count an item (AC2) yet show the empty box (AC3) — "vanishes silently" at section level. Rule for cap vs counts vs empty state is unstated. Note: actionQueue rows must carry project fields (type, wait, in-flight) — allow explicitly.
