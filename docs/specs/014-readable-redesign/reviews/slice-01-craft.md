---
slice: 014-01 — new look + overview by project
pass: craft
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-11-18T22:26:27Z
prompt_source: review.py pr-review
substrate: non-interactive
---

PASS (2026-11-18), richer skill pr-review. In scope; additive contracts; pure keyed swap; one chip mapping with Idle fallback; failable tests. Nits: [spec] error-row running count vs no dot — FIXED f4277ec; [impl] stale /api/prs overwrite race (pre-existing, now also tiles) — park in inbox; [impl] Idle fallback untested — test added f4277ec; [impl] inline style on empty-state paragraph — deferred to 014-02 cleanup; [impl] duplicate .chip-current font-size — removed f4277ec. Strengths: mergePrSummary guards partial deltas; colour guard test; old token aliases bridge 014-02/03.
