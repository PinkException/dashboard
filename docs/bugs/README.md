# Bug Status Board

> Status: Draft (wizard-generated)
>
> Current state of tracked defects for dashboard. Related:
> [Spec Status Board](../specs/README.md). Check both boards before folding
> reported defects into spec acceptance criteria.

| ID | slug | severity | tier | status | reproduces? | regression test | claimed_by | escalated_to | Notes |
|----|------|----------|------|--------|-------------|-----------------|------------|--------------|-------|
| 001 | [gitignore-eats-worktree-fixture](001-gitignore-eats-worktree-fixture.md) | medium | — | RESOLVED_ON_MAIN | no (fixed) | test/scan.test.mjs:81 (green) | — | — | Fixed 2026-07-22 with slice 004-01: `.gitignore` rule root-anchored to `/.claude/` and the worktree fixture committed; fresh clone now runs 29/29 (was 28/29, found by project audit 2026-07-19). |
| 002 | [compass-writer-still-active](002-compass-writer-still-active.md) | medium | — | REVIEWED | no (fixed) | test/snapshot-store.test.mjs (green) | — | — | Pausing the `compass-snapshots` routine retired only one of ADR-0004's three writers. Compass half fixed by the owner 2026-07-24; `snapshot.mjs` half fixed by slice 005-01, which retargets it at the dashboard-owned store. No code path now writes into a surveyed project. |

<!-- Regenerate with `bug.py status-board`. Add rows as bugs are reported. -->
