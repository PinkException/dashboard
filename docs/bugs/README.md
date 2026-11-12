# Bug Status Board

> Status: Draft (wizard-generated)
>
> Current state of tracked defects for dashboard. Related:
> [Spec Status Board](../specs/README.md). Check both boards before folding
> reported defects into spec acceptance criteria.

| ID | slug | severity | tier | status | reproduces? | regression test | claimed_by | escalated_to | Notes |
|----|------|----------|------|--------|-------------|-----------------|------------|--------------|-------|
| 002 | compass-writer-still-active | medium | standard | DONE | no | test/snapshot-store.test.mjs |  |  | Pausing the `compass-snapshots` routine retired only one of ADR-0004's three writers. Compass half fixed by the owner 2026-07-24; `snapshot.mjs` half fixed by slice 005-01. Closed 2026-11-11 after a fresh bug-review. |

## Terminal — closed (not fixed as bugs)

> Bugs in a terminal non-DONE state: **ESCALATED** (reclassified to a spec — see `escalated_to`) or **RESOLVED_ON_MAIN** (fixed by another session on trunk). These are closed, not unfinished — blank `reproduces?` / `regression test` columns are expected. Don't flag them stale or advance them to DONE.

| ID | slug | severity | tier | status | reproduces? | regression test | claimed_by | escalated_to | Notes |
|----|------|----------|------|--------|-------------|-----------------|------------|--------------|-------|
| 001 | gitignore-eats-worktree-fixture | medium | standard | RESOLVED_ON_MAIN | no | test/scan.test.mjs |  |  | Fixed 2026-07-22 with slice 004-01: `.gitignore` rule root-anchored to `/.claude/` and the worktree fixture committed; fresh clone now runs 29/29 (was 28/29, found by project audit 2026-07-19). |
