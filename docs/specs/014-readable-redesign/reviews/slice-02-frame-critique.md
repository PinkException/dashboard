---
slice: 014-02 — action queue in the new look
pass: frame-critique
verdict: needs-changes
reviewer: jig:reviewer
reviewed_at: 2026-11-18T04:35:26Z
prompt_source: review.py frame-critique
---

Round 1 (2026-11-17). Load-bearing assumption attacked: the six v1.3 step names map 1:1 onto today's queue. Today's QUEUE_GROUPS (public/render.mjs:657-663) has five rank groups; rank 4 (resume IN_PROGRESS) has no v1.3 step and AC2 would drop it into "Start new", breaking finish-first. External (rank 6) and Idle are dropped by actionQueue today (render.mjs:668, QUEUE_RANKS stops at 5); the Idle section needs a named source (waitingOn) and External only appears after the /api/prs fold-in. Secondary: per-project cap of 3 (render.mjs:672,675) vs "every waiting item".
