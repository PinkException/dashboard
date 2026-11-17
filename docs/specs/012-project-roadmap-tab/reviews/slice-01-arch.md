---
slice: 012-01 — roadmap tab with automatic order
pass: arch
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-11-16T23:30:30Z
prompt_source: review.py arch-review --richer-skill arch-review
substrate: non-interactive
---

VERDICT: pass

REASONING: ADR-0001 boundary intact: order, tiers, chips, labels and worktree hint derived in pure `src/lib.mjs`; `src/scan.mjs` supplies I/O inputs (git recency, worktree frontmatter) behind an `onGit` seam; `public/render.mjs` only renders `p.roadmap`. `currentReleaseTrack` single-sourced (rule in lib, scanner emits `currentReleasePath`, page looks it up). `/api/data` purely additive; `/api/prs` deltas untouched, ADR-0007 two-phase load unaffected. Suite 412/412.

SPECIFIC ISSUES:
- [strength] single-source release track; tab-as-state removes the loadPrs capture/restore hack; pure lib functions with injected inputs.
- [nit] specCommitTimes repo-top-relative paths → subdirectory projects fall back to mtime.
- [nit] listWorktrees fast path assumes absolute gitdir pointers (relative with worktree.useRelativePaths).
- [nit] scanWorktreeSpecs duplicates scanSpecs enumeration rules.
- [nit] /api/prs phase two re-runs full scanAll, paying new recency/worktree cost twice (pre-existing ADR-0007 design) — record.
- [nit] gitInfo 3→1 spawn fold outside stated scope — record.
- [nit] inline tab state transition vs setLens/openDetail helper convention.
- [nit] `currentReleaseTrack` name now used for both rule (lib) and lookup (render).

RECONCILIATION NOTES: update docs/architecture.md (render.mjs no longer derives release track; new /api/data fields; scan.mjs worktree frontmatter read wider than 002-02 AC4); deviation log entries as above.
