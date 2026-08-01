---
status: DRAFT
dependencies: [005-01, 005-03, adr-0004]
last_verified:
frame_review: true
---

## Slice 005-04 — rebuild the recurring snapshot routine + choose its cadence

**Goal:** the paused twice-daily snapshot routine runs again, unattended, writing
one entry per configured project to the dashboard-owned store on a chosen
cadence — so the history grows into a time series the future evolution view can
chart — and it **never writes into any surveyed repo**.

This resolves [ADR-0004](../../decisions/adr-0004-dashboard-owned-snapshots.md)
OQ2 (the growing series is wanted; the routine is rebuilt against it). It does
**not** build the evolution/velocity chart itself — that is its own future spec.

### Definition of Ready

- [x] 005-01 DONE — the store and `snapshot.mjs` write outside every repo; no
      code path writes into a surveyed project.
- [x] 005-03 DONE — the `/dashboard:snapshot` narrative skill and the
      `--source dashboard` tag exist; `snapshot.mjs --all --auto` writes a
      deterministic entry per configured project (probed).
- [x] The paused routine's exact shape is known (probed 2026-08-01): it lives at
      `~/.claude/scheduled-tasks/compass-snapshots/SKILL.md`, disabled since
      2026-07-22. It is Claude-run, composes narrative per project, and writes
      with `snapshot.mjs --project … --commit`. **The `--commit` wrote into each
      project's own repo — that was the leak (bug 002).** It also points at the
      abandoned `~/Documents/Claude/project-dashboard` and the old
      `dashboard.config.json`, and cites the superseded ADR-0002 contract.
- [ ] Cadence chosen (Open question 1) and the routine's repo-side deliverable
      settled (Open question 3).

### Scope

**In:** rebuilding the scheduled routine so it appends one entry per configured
project to the dashboard-owned store, unattended, on the chosen cadence; the
retarget off the abandoned path/config/contract onto the current ones
(`~/Documents/Claude/dashboard`, `~/.claude/my-dashboard/config.json`,
ADR-0004); **dropping `--commit` entirely**; and whatever small repo-side support
the cadence needs (Open question 3) with its tests.

**Out:** the evolution/velocity **chart** (OQ2's own future spec — this slice
only feeds it); the narrative composition itself (005-03, done); deleting or
editing any in-repo `docs/status/compass-history.jsonl` (§6, later and separate);
any change to the snapshot line schema.

### Assumptions

- **A1 — the scheduled-task mechanism can run this unattended.** *Grounded.* The
  old routine ran this way, and other scheduled tasks on this machine
  (`night-worker`, `morning-brief`) still do. The routine's definition lives
  per-user under `~/.claude/scheduled-tasks/` (outside every repo, vision
  principle 6), so enabling/scheduling it is a per-user action, not a repo change.
- **A2 — `snapshot.mjs --all --auto` already writes one deterministic entry per
  configured project to the store.** *Probed.* It reads the resolved config's
  project list and appends an `auto:` line per project, outside every repo, with
  no `--commit`. So the deterministic path needs little new code — mostly the
  cadence guard (Open question 1/3).
- **A3 — an unattended *narrative* run is viable and wanted.** *Unverified,
  load-bearing.* Running 005-03's Claude-run narrative skill on a schedule costs
  an LLM call per project per run and depends on judgment being reliable
  unattended. The deterministic `--auto` path has neither cost nor that risk, but
  produces counts, not prose. Which the routine writes is Open question 2 — and
  it is the load-bearing framing choice, so this slice carries `frame_review`.

### Open questions (resolve before READY_FOR_IMPLEMENTATION)

1. **Cadence (OQ2 — the headline decision).** The old routine appended
   twice-daily *always* (even "unchanged"). ADR-0004's OQ2 amendment reconsidered
   this: *"at most one automatic entry per project per day, or only when the
   computed state differs from the previous entry."* On-change-only keeps the
   series lean and every point meaningful for a chart; a fixed cadence keeps
   even spacing. Pick one, and if on-change, define "changed" (e.g. the
   deterministic `auto:` fields differ from the last stored entry).
2. **Narrative (005-03 skill) vs deterministic (`--auto`).** A chartable velocity
   series wants the deterministic progress numbers; a human reading a card wants
   prose. Options: (a) the routine writes deterministic `--auto` entries for the
   series and the narrative skill stays human-invoked; (b) the routine runs the
   005-03 skill per project for narrative entries; (c) both — deterministic on a
   frequent cadence for the chart, narrative less often. This is the frame
   decision A3 names.
3. **Repo-side deliverable.** The routine itself is a per-user scheduled task
   (outside the repo). What does *this repo* ship? Likely a small cadence guard
   on the writer — e.g. `snapshot.mjs --all --auto --if-changed` that skips a
   project whose computed state matches its last stored entry — plus a documented
   routine template. Settle what is code (tested) vs per-user config (not in the
   repo).

### Acceptance criteria (draft — refine once the open questions are settled)

**AC1 — the routine writes to the store, never into a repo.** A scheduled run
appends one entry per configured project to
`~/.claude/my-dashboard/snapshots/<project-key>.jsonl` and makes **no commit and
no write inside any surveyed project**. `--commit` is gone. Re-running is safe
(no duplicate/never-ending growth beyond the cadence rule).

**AC2 — the cadence rule holds.** Whatever cadence Open question 1 settles is
enforced and testable: a run that should skip a project (per-day cap already met,
or state unchanged if on-change) writes nothing for it and says so; a run that
should write does.

**AC3 — retargeted and contract-correct.** The routine reads the current config
(`~/.claude/my-dashboard/config.json`), targets the current repo, cites ADR-0004
(not ADR-0002), and never mentions the abandoned `project-dashboard` path.

**AC4 — the card reflects the series (UC-3).** After a run, each project card's
latest headline is the routine's newest entry (or a later human/skill one), and
the growing history is available for the future evolution view.

**AC5 — nothing in a surveyed repo changes, and the suite stays green.** No
surveyed repo shows a changed file. `npm test` passes, including
`test/no-leaks.test.mjs`. New tests cover the cadence guard (AC2) and the
no-in-repo-write guarantee (AC1).

### Definition of Done

- [ ] Open questions 1–3 resolved and folded into the ACs
- [ ] All ACs met, tests green
- [ ] Compliance + craft review passed and recorded
- [ ] Frame-critique passed and recorded (`frame_review: true`)
- [ ] Deviation log written
- [ ] Reconciliation sweep written
- [ ] Any new writer option (e.g. `--if-changed`) documented in
      `docs/architecture.md`; a lightweight decision records the cadence choice
- [ ] The per-user routine at `~/.claude/scheduled-tasks/compass-snapshots/` is
      rebuilt (retargeted, `--commit` removed) — noted as a per-user step, since
      it lives outside the repo
- [ ] Status board regenerated

### Notes

**The one non-negotiable: no `--commit`.** The paused routine's
`snapshot.mjs … --commit` wrote into each surveyed project's own git history —
exactly the leak ADR-0004 and 005-01 closed (bug 002). The rebuilt routine writes
only to the dashboard-owned store outside every repo. Re-adding an in-repo write
here recreates the bug; do not.

**Why this was split from 005-03.** 005-03 is the human-invoked narrative skill
and delivers value on its own. This slice is the automation and the cadence
decision — a separate, independently-testable concern (ADR-0004 OQ2). Sampling
matters here in a way it does not for a one-off human snapshot, because the
series feeds a chart: too-frequent points bloat it, too-sparse points blur the
trend.

**The chart is not in scope.** OQ2 confirmed the owner wants the evolution /
velocity view; that view reads this series and is its own future spec. This slice
only guarantees the series exists and grows honestly.
