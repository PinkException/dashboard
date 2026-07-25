# Bug Status Board

> Status: Draft (wizard-generated)
>
> Current state of tracked defects for dashboard. Related:
> [Spec Status Board](../specs/README.md). Check both boards before folding
> reported defects into spec acceptance criteria.

| ID | slug | severity | tier | status | reproduces? | regression test | claimed_by | escalated_to | Notes |
|----|------|----------|------|--------|-------------|-----------------|------------|--------------|-------|
| 001 | [gitignore-eats-worktree-fixture](001-gitignore-eats-worktree-fixture.md) | medium | — | RESOLVED_ON_MAIN | no (fixed) | test/scan.test.mjs:81 (green) | — | — | Fixed 2026-07-22 with slice 004-01: `.gitignore` rule root-anchored to `/.claude/` and the worktree fixture committed; fresh clone now runs 29/29 (was 28/29, found by project audit 2026-07-19). |
| 002 | [compass-writer-still-active](002-compass-writer-still-active.md) | medium | — | FIXING | yes | — | — | — | Pausing the `compass-snapshots` routine on 2026-07-22 retired only one of ADR-0004's three writers. **Compass half FIXED by the owner 2026-07-24** (its skill now writes nothing — verified), so no automatic writer into any surveyed project remains; severity high→medium. Remaining: `scripts/snapshot.mjs:63-65` still hardcodes the in-repo target, so no manual snapshot may be run against a surveyed project until retargeted. Found by the pre-publication leak audit 2026-07-24. Fix = retire the compass append AND retarget `snapshot.mjs` (as shipped it also writes in-repo, so a manual run is NOT a workaround); gated on nothing else — not the migration, its verification, or any open question (ADR-0004 Sequencing). No data is deleted as part of the fix. |

<!-- Regenerate with `bug.py status-board`. Add rows as bugs are reported. -->
