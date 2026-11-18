---
slice: 014-01 — new look + overview by project
pass: frame-critique
verdict: needs-changes
reviewer: jig:reviewer
reviewed_at: 2026-11-18T04:39:08Z
prompt_source: review.py frame-critique
---

Round 2 (2026-11-17). Round-1 MERGE gap resolved. New load-bearing gap: AC5's summary counts emitted on /api/data go stale after the /api/prs fold-in (ADR-0007: /api/data is disk-only, src/server.mjs:25; prDeltas carries only per-project fields, src/scan.mjs:938-945; page refreshes only projects, public/index.html:399-400). Waiting on others is always 0; PR-driven MERGE/REVIEW are missed. Secondary: rank-4 Ready (resume) gets "You can start it now" and the "Ready to start" tile, contradicting D8.
