---
status: FIXING
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
| `scripts/snapshot.mjs` | active — hardcodes the in-repo target | **still open** — the remaining half |
| the `compass-snapshots` scheduled routine | paused 2026-07-22 | paused; to be rebuilt against the new writer |

Pausing the routine closed only the twice-daily path, never the per-run one.
`scripts/snapshot.mjs:63-65` is the second path — it hardcodes
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

**Remaining — `scripts/snapshot.mjs` still targets the in-repo path.** It only
fires when someone runs it, so the channel is dormant rather than active; severity
drops from *high* to *medium*. Until it is retargeted at the dashboard-owned
store, **no manual snapshot may be run against a surveyed project** — doing so
reproduces this bug.

**Consequence for the design.** With compass writing nothing, ADR-0004's Open
question 1 option (b) — a compass companion that records the headline compass
just produced — is off the table. The owner's direction: *"If we want dashboard to
write something, it will have to do it itself."* See the ADR's Amendments section.

## Fix

Retarget `scripts/snapshot.mjs` at `~/.claude/my-dashboard/snapshots/`, per
ADR-0004 §1 and the Sequencing section. Gated on nothing else — not the history
migration, not its verification, not any open question.

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
- [ ] `snapshot.mjs` retargeted
- [ ] regression test red
- [ ] fix landed
