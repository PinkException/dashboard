---
slice: 012-01 — roadmap tab with automatic order
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-11-16T16:33:54Z
prompt_source: frame-critique round 5 (orchestrator-built prompt mirroring review.py frame-critique)
---

VERDICT: pass (round 5)

REASONING:
Round-4 issue fixed: AC10 drops the merged-branch skip, reads worktrees from disk, states the renamed/deleted residual, and carries both fixtures. Attacked release-first move, unfinished/tier definitions, recency from root git, and scan budget; none concretely wrong — each is an owner decision, an assumption with evidence + kill criterion (A5, A6), or supported by existing code (currentReleaseTrack reads only workstreams[].goalProgress, public/render.mjs:144-152, computed at src/scan.mjs:317; parked tokens leave the goal count, src/lib.mjs:601).

SPECIFIC ISSUES:
- None blocking.
- Note: unresolved Include tokens stay pending (src/lib.mjs:607-613) → a release can stay "current" indefinitely; shared with A-009-01.
- Note: "started" tier includes READY_FOR_* → mild "We are here" overclaim; under A5's kill criterion.
- Note: AC11's 10% budget unprobed; worktree enumeration is the new cost; overruns must be recorded, not hidden.

RECONCILIATION NOTES:
A6 "main" = local root checkout; a root lagging origin inflates the hint.

ORCHESTRATOR FOLLOW-UP: all four notes recorded as one-line residuals (A5, A6) and an overrun rule on AC11.
