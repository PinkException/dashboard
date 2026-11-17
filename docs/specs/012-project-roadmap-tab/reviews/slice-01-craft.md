---
slice: 012-01 — roadmap tab with automatic order
pass: craft
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-11-16T23:59:01Z
prompt_source: review.py pr-review --richer-skill pr-review (round 3)
substrate: non-interactive
---

VERDICT: pass (round 3)

REASONING: Ordering, status and release logic stay scanner-side in pure `src/lib.mjs` functions (ADR-0001); the page only presents. The sequence strip matches the owner's 2026-11-16 lightweight decision: after a release, steps 2-3 skip specs the release covers, are labelled "Then" on both paths, and the strip shortens when fewer specs remain — tested, including shortened and release-only strips. `npm test` 416/416. No correctness or security defects; remaining items are polish and two weak tests.

SPECIFIC ISSUES:
- [strength] deriveRoadmap sequence block matches the decision; dedicated tests.
- [strength] open tab as app state (`state.tab`) replaces DOM flips and the loadPrs capture/restore.
- [strength] worktreeHint keeps "highest status, counted once" and the new-slice set separate; de-dup and DEFERRED/ABANDONED tested.
- [strength] readHead / listWorktrees fast path / gitInfo fold: AC11 cost work with safe fallbacks; relative gitdir and subdirectory cases tested.
- [nit] tab-survives-fold-in test near-vacuous (render-only) + regex glue test.
- [nit] DEFERRED-only specs fold under "show N done" as empty groups — note for slice 02.
- [nit] "as of the working tree" fallback for null asOf — record.
- [nit] listWorktrees couples to git's on-disk layout — record.
- [nit] gitInfo 3→1 fold outside named surface — record with AC11 numbers.
- [nit] Include token resolving to a status-less slice-*.md still gets a "Planned" card.
