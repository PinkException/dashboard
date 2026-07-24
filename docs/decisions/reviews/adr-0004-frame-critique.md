---
adr: 0004
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (8 independent rounds; round 7 pass)
reviewed_at: 2026-07-24T23:14:23Z
prompt_source: review.py frame-critique docs/decisions/adr-0004-dashboard-owned-snapshots.md
---

Adversarial frame-critique of ADR-0004, run 2026-07-24. Eight rounds, each by a
fresh independent reviewer with no prior context. Round 7 returned **pass**.

## Outcome

**pass** — the frame survives. The storage-and-ownership decision (dashboard-owned
store outside every repo, compass returns read-only, preserve-don't-discard,
supersede ADR-0002) was judged grounded from round 1 onward and was never the
thing under attack. What the rounds repeatedly caught was the *reasoning around*
it, and each finding was fixed against measured data rather than argued away.

## What the loop changed (each traced to evidence, not opinion)

1. **Rationale re-grounded.** The ADR justified itself with "statistics later".
   Sharpened to two claims of explicitly different strength: the *latest* entry
   answers "what's next" (grounded, shipped, owner-recorded), while a *growing*
   series for an evolution view is a deferred, unspecced candidate the ADR now
   declines to commit to. The leak driver was promoted to primary and evidenced.

2. **Scope cut back.** §7 no longer commits to rebuilding a recurring writer; the
   paused routine stays paused pending OQ2. Recorded that this deliberately
   overrides an earlier owner direction, so the implementing spec does not read it
   as contradiction.

3. **The leak fix was unchained — twice.** First it was gated on the open
   questions; then on "migration complete and verified", which is itself deferred
   behind OQ4 and an unwritten spec. Both would have parked the highest-priority
   leak finding indefinitely. The gate is now exactly two writers stopping
   together, and nothing else.

4. **A false safe-fallback removed.** The ADR twice offered manual `snapshot.mjs`
   runs as the interim narrative path. Verified against `snapshot.mjs:63-65`: it
   hardcodes the in-repo `docs/status/` target, so a manual run *is* the leak.
   Retargeting it is now part of the same retirement step.

5. **Producer attribution corrected by measurement.** An earlier draft inferred
   compass produced the narrative bulk. Compass writes a distinct schema
   (`recommendation`/`counts`, no `v`), so producers are separable by shape:
   compass ~12 of 193 (~6 %), the 153 `manual` entries are `snapshot.mjs` runs.
   The cost of retiring compass's append is therefore far smaller than assumed.

6. **Composition table made to sum.** 18 auto + 153 manual + 3 compass-skill + 19
   pre-`source` = 193; non-recomputable share corrected 172/193 (~89 %) →
   175/193 (~91 %) and propagated to all four places that cited the old figure.

7. **Reader cutover resolved.** Both single-source options break — switching with
   the writers blanks every card's headline, deferring the switch freezes it and
   makes the interim path invisible. §5 now reads both sources and prefers the
   later `ts`, needing no project-key mapping.

8. **Verification set moved earlier.** §6 captures at *writer-retirement* time,
   not merge time: 128 of 193 entries live in `.claude/worktrees/*` copies that
   are pruned when branches land, so a merge-time capture could silently miss
   entries. Kill criteria aligned to the same set.

9. **Bug 002's evidence corrected.** It claimed appends were ongoing, citing
   modification times. Re-checked: files last modified 2026-07-22 12:03, counts
   unchanged (13/14/13/8/16). The defect is an open *capability* that fires on the
   next run, not observed drift. Severity unchanged; evidence now honest.

10. **Vision principle 1 amended.** Its text sanctioned compass's external write as
    the one permitted exception — falsified by this ADR. Rewritten to "never writes
    into a surveyed project — no exceptions", and added to the rework list.

## Provenance and honest limits

Rounds 1-6 returned needs-changes; round 7 returned **pass**; round 8 raised four
further findings, all addressed above (items 5, 6, 7, 9 and the principle-1
amendment). **A ninth adversarial re-read of those last fixes was not run** — the
owner stopped the loop, which is a reasonable call after eight rounds. The final
edits are therefore fixes verified against the data and code they cite
(`snapshot.mjs:63-65`, the backup's entry counts and schemas, file mtimes,
compass's SKILL.md), but not themselves adversarially re-reviewed.

Reviewers: jig:reviewer, independent, no prior context, one per round.
Prompt source: review.py frame-critique docs/decisions/adr-0004-dashboard-owned-snapshots.md
