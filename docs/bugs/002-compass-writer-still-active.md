---
status: REPORTED
---
# Bug 002 — the snapshot writer is still active after the routine was paused

**Symptom.** Snapshot lines are still being appended into surveyed projects' own
`docs/status/compass-history.jsonl` after the `compass-snapshots` scheduled task
was disabled on 2026-07-22. Five surveyed projects have that file modified since
that date; two of them track it in git. The pause was believed to have closed the
channel — it did not.

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
`docs/status/compass-history.jsonl`. Pausing the routine therefore closed only
the twice-daily path, never the per-run one. Verified by file modification times
across the surveyed set on 2026-07-24.

**Why it matters.** Each line carries the surveyed project's own feature names,
roadmap state, spec counts and open-bug counts. Writing that into the project's
git-tracked `docs/` makes one project's internal state a committed artifact as a
side effect of running an unrelated tool — and vision principle 1 says the
dashboard is read-only over other repos.

**Fix.** Not a local patch. ADR-0004 §4/§7 already decide the shape — the
dashboard owns the writer and compass returns to pure reporting. Retiring the
compass skill's write lives in the compass plugin, outside this repo. Blocked on
ADR-0004 moving to Accepted and its two open questions (who replaces compass as
writer; write cadence) being settled.

**No data is deleted as part of this fix.** Per ADR-0004 §5 and §6 the existing
history is migrated into the new store and verified against the backup first;
removing the in-repo files is a later, separately approved step.

- [x] repro captured (file modification times across the surveyed set, 2026-07-24)
- [x] root cause proven (the write is a documented step in the skill's own instructions)
- [ ] regression test red
- [ ] fix landed
