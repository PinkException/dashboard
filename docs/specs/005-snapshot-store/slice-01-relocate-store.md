---
status: DRAFT
dependencies: [adr-0004]
last_verified:
frame_review: true
---

## Slice 005-01 — relocate the snapshot store

**Goal:** a snapshot written today lands in the dashboard-owned store outside
every repo, and the project card still shows the latest headline (UC-3) whether
that headline came from the store or from the project's existing in-repo file.

This closes the remaining half of
[bug 002](../../bugs/002-compass-writer-still-active.md): `scripts/snapshot.mjs`
is the last code path that writes into a surveyed project. (The compass half was
retired by the owner on 2026-07-24.)

### Definition of Ready

- [x] ADR-0004 Accepted — the storage decision is settled, not being re-litigated
- [x] Load-bearing claims probed (see spec `## Assumptions`)
- [x] Bug 002 cross-checked: this slice owns the fix; the bug record points here
      rather than duplicating acceptance criteria
- [x] No dependency on ADR-0004 OQ2/OQ3 (both out of scope here)

### Scope

**In:** the store layout and its path; a worktree-aware project key for the
*writer*; retargeting `scripts/snapshot.mjs`; the reader reading both sources and
preferring the later `ts`; tests.

**Out:** migrating the 193 existing entries (005-02); the full reconciliation
mapping that folds worktree copies into parents (005-02); any narrative-composing
skill or recurring routine (005-03); deleting anything at all.

### Acceptance criteria

**AC1 — the writer never writes inside a surveyed project.**
`scripts/snapshot.mjs` appends to
`~/.claude/my-dashboard/snapshots/<project-key>.jsonl` and creates no
`docs/status/` directory anywhere. Running it against a git repo leaves that
repo's working tree untouched (`git status --porcelain` unchanged).

**AC2 — the store path is overridable and consistent with existing precedent.**
The store root resolves as: `DASHBOARD_SNAPSHOTS` if set, else
`<dirname of resolveConfigPath()>/snapshots/`. Deriving it from the *config
path* — not a second hard-coded `~/.claude/my-dashboard` literal — means a
`DASHBOARD_CONFIG` override (already used by tests and by the owner's
global-vs-worktree config workaround) keeps config and snapshots together
instead of silently splitting them.

**AC3 — the project key is worktree-aware and collision-free.**
A new exported `projectKey(root)`:
- resolves a linked worktree to its parent repository, so a worktree and its
  parent write to the **same** file — verified by probe that
  `git rev-parse --git-common-dir` yields the parent's `.git` for both;
- yields a key that cannot collide between two different projects that share a
  basename (two `docs` folders in different parents must not merge);
- falls back to a path-derived key for a non-git directory rather than throwing,
  since `scanProject` already tolerates non-git projects;
- is **pure with respect to its inputs** and exported, so 005-02 can reuse the
  same function for the migration mapping rather than inventing a second one.

**AC4 — the reader prefers the genuinely newer entry, by timestamp.**
`scanCompass(root)` reads *both* the store file and the project's in-repo
`docs/status/compass-history.jsonl`, and surfaces whichever candidate has the
later `ts`. Concatenating the two sources is **not** acceptable:
`parseCompassHistory` selects the last valid line in *file order* (probed,
[lib.mjs:164](../../../src/lib.mjs)), so concatenation would make the answer
depend on read order rather than time. Malformed-line warnings from both sources
are summed, so a corrupt line in either is still surfaced.

**AC5 — UC-3 never regresses, including on a project with no store file yet.**
A project whose history exists only in-repo (every project, on day one) still
shows its latest headline, age label and staleness exactly as before. A project
with neither source shows no compass block and emits no warning — the current
behaviour for a missing file.

**AC6 — the leak gate and the existing suite stay green.**
`npm test` passes, including `test/no-leaks.test.mjs`. New tests cover: writer
target (AC1), key resolution for worktree/parent/non-git (AC3), ts-preference
across the two sources including the equal-`ts` and store-older cases (AC4), and
the no-store-yet path (AC5).

### Definition of Done

- [ ] All ACs met, tests green
- [ ] Compliance + craft review passed and recorded
- [ ] Frame-critique passed and recorded (`frame_review: true`)
- [ ] Deviation log written
- [ ] Reconciliation sweep written
- [ ] `docs/architecture.md` updated — the store is a new module boundary and a
      new persistent location
- [ ] `docs/compass-integration.md` reconciled — it documents the ADR-0002 shape
      and tells the reader to run a writer that this slice retargets
- [ ] Bug 002 updated: remaining half closed, status moved on
- [ ] Status board regenerated

### Notes

**Why the reader still reads the in-repo file.** ADR-0004 §5's reader note: a
single-source cutover breaks either way. Switching the reader with the writer
blanks every card until 005-02 migrates; deferring the switch entirely freezes
every headline at retirement time and makes new writes invisible. Reading both
and preferring the later `ts` avoids both, costs one file read, and needs no
project-key mapping on the read path. The dual read retires once 005-02 has
migrated and verified and the in-repo files are removed.

**Why the writer needs a key now.** ADR-0004 defers the full project-key mapping
to OQ4, but a writer cannot write without *some* key. This slice settles the
writer-side key only, and exports it so 005-02's migration reuses it. The
worktree-awareness is not optional even here: ADR-0004's problem #2 is that
worktrees fork the history, so a naive per-directory key would recreate the
fragmentation inside the new store on day one.
