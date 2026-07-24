---
status: REPORTED
---
# Bug 002 — the snapshot writer is still active after the routine was paused

**Symptom.** The write path into surveyed projects' own
`docs/status/compass-history.jsonl` is still open after the `compass-snapshots`
scheduled task was disabled on 2026-07-22. The pause was believed to have closed
the channel; it closed only one of three writers. Two surveyed repos track that
file in git.

**Correction to an earlier version of this record (2026-07-24).** This bug first
claimed lines "are still being appended", citing file modification times. That was
overstated: re-checked, the five files were last modified 2026-07-22 12:03 — the
backup moment — and their entry counts still match the backup exactly
(13/14/13/8/16). **No append has occurred since.** The defect is a live *capability*,
not observed ongoing writes: the next `/compass:compass` run in any surveyed
project will append, because the write is a documented step in the skill's own
instructions (below). Severity is unchanged — the channel is open and fires on
next use — but the evidence is a code path, not a growing file.

**Root cause (proven).**
[ADR-0004](../decisions/adr-0004-dashboard-owned-snapshots.md) names three
writers. Only one was retired:

| Writer | Status on 2026-07-24 |
|---|---|
| the compass plugin skill (`compass/skills/compass/SKILL.md`) | **active** — appends after *every* briefing |
| `scripts/snapshot.mjs` | active |
| the `compass-snapshots` scheduled routine | paused 2026-07-22 |

The compass skill's own instructions make the append a documented step of each
run: it creates `docs/status/` if absent and appends one JSON line to
`docs/status/compass-history.jsonl` (its SKILL.md "Logging the run — the one
write" section). Pausing the routine therefore closed only the twice-daily path,
never the per-run one. `scripts/snapshot.mjs:63-65` is the second open path — it
hardcodes the in-repo `docs/status/` target.

Evidence is the two code paths, read on 2026-07-24 — not file growth. Compass's
past writes are independently confirmed in the data: 12 backed-up entries carry
compass's distinct schema (`recommendation`/`counts`, no `v`), 3 of them stamped
`source: "compass-skill"`.

**Why it matters.** Each line carries the surveyed project's own feature names,
roadmap state, spec counts and open-bug counts. Writing that into the project's
git-tracked `docs/` makes one project's internal state a committed artifact as a
side effect of running an unrelated tool — and vision principle 1 says the
dashboard is read-only over other repos.

**Fix.** Not a local patch. ADR-0004 §4/§7 decide the shape — the dashboard owns
the writing and compass returns to pure reporting. Retiring the compass skill's
write lives in the compass plugin, outside this repo.

**Both in-repo writers must stop together; nothing else gates it.** Per ADR-0004's
Sequencing section the fix is (1) retire the compass skill's append, and (2)
retarget `scripts/snapshot.mjs` at the dashboard-owned store. It is gated on
neither the history migration, nor its verification, nor any open question.

**Do not treat a manual `snapshot.mjs` run as the interim workaround.** As shipped
it hardcodes `path.join(root, 'docs', 'status')` (snapshot.mjs:63-65) — running it
against a surveyed project reproduces this exact bug. That is why the two writers
are one step, not two.

Three earlier readings of the gate were wrong and are recorded so the reasoning is
not re-derived: blocked on the open questions; then on the migration being verified
(the migration itself waits on an open question, so that parked the
highest-priority leak finding behind an unwritten spec); then "just a `mkdir`",
which ignored that `snapshot.mjs` still writes in-repo.

The asymmetry is the reason there is no gate: stopping the writes forgoes only
*future* entries — the existing history is backed up and nothing existing is
touched — whereas leaving them running keeps committing one project's internals
into another project's git history, undoable afterwards only by a history rewrite.
Retiring the compass append plausibly does cost the automatic narrative going
forward; that cost is accepted deliberately as bounded and recoverable.

**No data is deleted as part of this fix.** Per ADR-0004 §5 and §6 the existing
history is migrated into the new store and verified against the backup first;
removing the in-repo files is a later, separately approved step.

- [x] repro captured (both write paths read on 2026-07-24: the compass SKILL.md
      logging step, and `scripts/snapshot.mjs:63-65`'s hardcoded in-repo target)
- [x] root cause proven (the write is a documented step in the skill's own
      instructions; 12 backed-up entries carry compass's own schema)
- [ ] regression test red
- [ ] fix landed
