---
slice: 012-01 — roadmap tab with automatic order
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-11-16T23:30:30Z
prompt_source: review.py implementation
---

VERDICT: pass

REASONING: All 11 ACs met by the working-tree diff; `npm test` 412/412 green. Every AC has fixture tests asserting concrete values (no vacuous tests; all test-quality signals false). Ordering rules, tiers, "unfinished", chip table, "We are here", dependency/cycle order and worktree-hint ranking match spec.md "Automatic order (layer 1)" and AC10. `currentReleaseTrack` moved to `src/lib.mjs`; scanner emits `currentReleasePath`; render.mjs only looks it up (ADR-0001 holds). `/api/data` changes additive.

SPECIFIC ISSUES (suggestions, non-blocking):
- src/scan.mjs specCommitTimes: `git log --name-only` paths are repo-top-relative; subdirectory projects silently fall back to mtime recency (also raised as the craft blocker).
- src/scan.mjs: mtime fallback also used for specs with no commit yet (mixed commit-time/mtime sort) — record.
- src/lib.mjs sequence strip: with a release, steps 2-3 = ordered.slice(0,2) can repeat the release's spec; "Next" vs "Then" labels differ — owner question.
- public/render.mjs: activity tab lost its `disabled` class.
- public/render.mjs: detached HEAD / subdirectory project renders "as of the working tree" — record.
- docs/architecture.md contract surfaces: new additive /api/data fields not listed.

RECONCILIATION NOTES: AC11 before/after numbers; gitInfo 3→1 spawn fold; .git fast path + 2 KB frontmatter read; subdirectory project gets no worktree hint; tab state moved to state.tab; AC9 eyeball still to attest.
