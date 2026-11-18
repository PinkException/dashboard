---
slice: 014-01 — new look + overview by project
pass: arch
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-11-18T22:26:27Z
prompt_source: review.py arch-review
substrate: non-interactive
---

PASS (2026-11-18), richer skill arch-review. Counting in one pure scanner function; additive summary on /api/data + recomputed on /api/prs; keyed swap respects ADR-0001 and ADR-0007; chip mapping presentation-only; no boundary crossed. Nits: architecture.md API section must list summary on both endpoints (sweep row → updated); header ring % computed page-side from specsDone/specsDenom — log as accepted exception or move scanner-side; /api/prs summary can briefly disagree with rows if config's project set changes between scans (self-heals); runningNowCount (sessions) vs summary.running (projects) intentionally differ.
