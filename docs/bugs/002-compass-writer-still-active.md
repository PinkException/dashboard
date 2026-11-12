---
severity: medium
tier: standard
regression_test: test/snapshot-store.test.mjs
status: DONE
---
# Bug 002 — the snapshot writer is still active after the routine was paused

**Symptom.** The write path into surveyed projects' own
`docs/status/compass-history.jsonl` remained open after the `compass-snapshots`
scheduled task was disabled on 2026-07-22. The pause was believed to have closed
the channel; it closed only one of three writers. Two surveyed repos track that
file in git.

**Root cause (proven).**
[ADR-0004](../decisions/adr-0004-dashboard-owned-snapshots.md) names three
writers. On discovery only one had been retired:

| Writer | On discovery (2026-07-24) | Now |
|---|---|---|
| the compass plugin skill (`compass/skills/compass/SKILL.md`) | active — appended after *every* briefing | **RETIRED by the owner, 2026-07-24** |
| `scripts/snapshot.mjs` | active — hardcoded the in-repo target | **FIXED in [slice 005-01](../specs/005-snapshot-store/slice-01-relocate-store.md)** — now writes to the dashboard-owned store |
| the `compass-snapshots` scheduled routine | paused 2026-07-22 | rebuilt against the new writer (slice 005-04), installed via spec 006, now intentionally stopped by the owner — it shells out to `snapshot.mjs`, so the 005-01 retarget covers it too |

Pausing the routine closed only the twice-daily path, never the per-run one.
`scripts/snapshot.mjs:63-65` (pre-fix line numbers) is the second path — it hardcodes
`path.join(root, 'docs', 'status')`.

Compass's past writes are independently confirmed in the data: 12 backed-up
entries carry compass's distinct schema (`recommendation`/`counts`, no `v`), 3 of
them stamped `source: "compass-skill"`.

**Why it matters.** Each line carries the surveyed project's own feature names,
roadmap state, spec counts and open-bug counts. Writing that into the project's
git-tracked `docs/` makes one project's internal state a committed artifact as a
side effect of running an unrelated tool — and vision principle 1 (amended
2026-07-24) says the dashboard never writes into a surveyed project.

## Progress

**Half fixed — the automatic path is closed (owner, 2026-07-24).** The owner
edited the compass plugin directly: it now states *"Compass reports in chat and
writes nothing — no files, no lifecycle"*, and no `compass-history` /
`docs/status` write path remains in its SKILL.md. Verified by reading the file.
Combined with the paused routine, **no automatic writer into any surveyed project
remains.**

**Second half fixed — `scripts/snapshot.mjs` retargeted (slice 005-01).** It now
appends to `~/.claude/my-dashboard/snapshots/<project-key>.jsonl` and creates no
`docs/status/` anywhere. The earlier warning against running a manual snapshot
against a surveyed project **no longer applies**. Regression coverage:
`test/snapshot-store.test.mjs` asserts the write lands in the store, that no
`docs/status/` is created, and that the surveyed repo's `git status --porcelain`
is byte-identical before and after.

**With both halves closed, no code path writes into a surveyed project.**

**Consequence for the design.** With compass writing nothing, ADR-0004's Open
question 1 option (b) — a compass companion that records the headline compass
just produced — is off the table. The owner's direction: *"If we want dashboard to
write something, it will have to do it itself."* See the ADR's Amendments section.

## Fix

Retarget `scripts/snapshot.mjs` at `~/.claude/my-dashboard/snapshots/`, per
ADR-0004 §1 and the Sequencing section. Gated on nothing else — not the history
migration, not its verification, not any open question.

**Owned by [slice 005-01](../specs/005-snapshot-store/slice-01-relocate-store.md)**
(AC1 is this fix). The acceptance criteria live there rather than being duplicated
here, so there is one owner for the change.

Three earlier readings of the gate were wrong and are recorded so the reasoning is
not re-derived: blocked on the open questions; then on the migration being verified
(the migration itself waits on an open question, so that parked the
highest-priority leak finding behind an unwritten spec); then "just a `mkdir`",
which ignored that `snapshot.mjs` still writes in-repo.

**A correction to this record's own evidence (2026-07-24).** It first claimed lines
"are still being appended", citing file modification times. That was overstated:
the five files were last modified 2026-07-22 12:03 — the backup moment — and their
entry counts still match the backup exactly (13/14/13/8/16). No append had occurred
since. The defect was a live *capability*, not observed drift.

**No data is deleted as part of this fix.** Per ADR-0004 §5 and §6 the existing
history is migrated into the new store and verified first; removing the in-repo
files is a later, separately approved step.

- [x] repro captured (both write paths read on 2026-07-24: the compass SKILL.md
      logging step, and `scripts/snapshot.mjs:63-65`'s hardcoded in-repo target)
- [x] root cause proven (the write was a documented step in the skill's own
      instructions; 12 backed-up entries carry compass's own schema)
- [x] compass half fixed (owner, 2026-07-24 — verified: no write path in SKILL.md)
- [x] `snapshot.mjs` retargeted (slice 005-01)
- [x] regression test written and witnessed red before the fix
- [x] fix landed on `claude/spec-005-snapshot-store`

## Closure (2026-11-11)

- **Legacy record.** Written before the repository-closure schema existed, so it
  has no closure-inventory sections. The writer enumeration lives in slice
  005-01's reconciliation sweep, and the 2026-11-11 bug-review re-ran it
  (`docs/status`, `writeFileSync`, `appendFileSync` across `scripts/`, `src/`,
  `tools/`, `skills/`, `prompts/`, `public/`): the only `docs/status` reference
  left is a read in `src/scan.mjs`.
- **Red-before-fix** was asserted at the time, not captured. The test would fail
  on the pre-fix code, because the old writer created the `docs/status/`
  directory that it asserts is absent.
- **Reviews:** [bug-review](reviews/bug-002-bug-review.md) (fresh, pass) and
  [craft](reviews/bug-002-craft.md) (carried over from slice 005-01).
- §6 in-repo cleanup was done by the owner on 2026-10-05.
