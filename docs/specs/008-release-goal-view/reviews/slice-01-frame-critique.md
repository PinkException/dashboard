---
slice: 008-01 — goal progress & next-action (happy path)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (frame-critique, adversarial)
reviewed_at: 2026-08-21T18:45:55Z
prompt_source: review.py frame-critique 008-01 (v3, grounded column semantics)
---

Frame-critique verdict: PASS (grounded revision).

The load-bearing assumption — a shaper Include table exposes gating slice IDs in
the Item (first) cell, joinable to scanned statuses — is now grounded two
reinforcing ways: structurally (shaper template contract v0.3.0 scaffolds
`| Item | Evidence | Rationale |`, Item first) and empirically (probe 2026-08-07:
Item cells carried every ID incl. compressed runs; Evidence yielded zero ID
tokens, only status strings). The prior block (Item-vs-Evidence column
semantics) is closed. Residual: grounding leans on an external template contract
+ an n=1 probe — accepted as context-to-reconcile, and the extractor degrades
honestly (reordered/absent IDs → title-only, never wrong counts). No change
required.
