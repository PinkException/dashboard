---
status: Proposed
dependencies: []
last_verified: 2026-07-22
frame_review: true
---

# ADR-0004: Dashboard owns one append-only snapshot history per project

## Status

Proposed (2026-07-22)

## Context

Compass snapshots currently live inside every surveyed project and are written
by compass itself, and that arrangement has become a source of repo pollution
and repeated re-litigation. The contract behind it is
[ADR-0002](./adr-0002-compass-snapshot-contract.md), which put an append-only
`docs/status/compass-history.jsonl` in each project and made compass its writer.
Use since 2026-07-13 has made three problems concrete.

**1. It pollutes every repo it touches.** A scan of the owner's machine on
2026-07-22 found **23 real history files holding 193 entries** (excluding this
repo's synthetic test fixtures), spread across **7 projects**:

| Location | Files | Entries |
|---|---|---|
| Project roots (`project-a` … `project-f`) | 6 | 65 |
| `.claude/worktrees/*` copies (incl. `project-g`, which has *only* a worktree copy) | 17 | 128 |

Each project root file is handled differently — five of the six commit it, one
git-ignores it. The per-repo decision has been re-litigated in session after
session, which is the pain that triggered this ADR.

> Surveyed projects are referred to as `project-a` … `project-g` throughout. The
> real names are deliberately not recorded here: this repo ships publicly as a
> plugin, `docs/` is part of the package, and the surveyed projects are private.
> The unredacted survey is machine-local and git-ignored.

**2. Worktrees multiply and fork it.** Because the file lives in the repo, every
worktree gets its own copy that then drifts independently — 17 divergent copies
against 6 project roots. Nothing merges them; nothing says which is current.
This is the *fragmentation* problem: the history exists, but not in one place
per project.

**3. Compass is supposed to be read-only.** The owner's requirement, stated
directly: *"When I run compass I just want to know where we are at. The writing
of a file should come from the dashboard plugin."* ADR-0002 made a reporting
skill into a writer, and that write is the sole exception punched through vision
principle 1 ("read-only over other repos").

**What the history is for (owner-stated, load-bearing).** The accumulated
entries are the *product*, not a byproduct: they exist to **track work over time
so the owner can get statistics later**. Any design that overwrites, truncates,
or discards entries defeats the purpose of the change. The problem being solved
is *fragmentation and repo pollution* — never the existence of history.

Two constraints frame the replacement. Vision **principle 6** — private state
never lives in a repo — already forced the user's config out to
`~/.claude/my-dashboard/config.json`; snapshots are the same kind of per-user
state and belong in the same place. And the **development folder is not the data
folder**: `~/Documents/Claude/dashboard` holds source only, so the installed
plugin must write to the user's home data folder, never next to its own code.

### Operational state at the time of writing

- **The twice-daily writer is paused.** Scheduled task `compass-snapshots`
  (cron `0 5,12 * * *`, last fired 2026-07-22T19:02Z) was **disabled on
  2026-07-22** on owner instruction, because it appends *and commits* snapshots
  into each surveyed project's own repo and would keep re-creating the files
  during migration. It is paused, not deleted: the owner's direction is to
  **rebuild an equivalent routine once the skills are clean** so the twice-daily
  cadence — and therefore the time series — resumes.
- **A pre-migration backup exists.** All 23 files (193 entries) were copied to
  `~/.claude/my-dashboard/_migration-backup-2026-07-22/`, one flattened file per
  source path, taken *after* the 19:02 run. This is the safety net for the
  reconciliation and must be retained until the merged history is verified.

## Decision Options Considered

### Option A: Keep ADR-0002 — per-project append-only JSONL inside each repo, written by compass
- **Pros:** already built and shipped (`scan.mjs` reads it, `snapshot.mjs`
  writes it); the time series accumulates.
- **Cons:** every problem above stands — 23 files, per-repo git decisions
  re-litigated each session, worktree forks, and compass keeps writing.

### Option B: Central append-only history, one file per project, still written by compass
- **Pros:** removes repo pollution and worktree forking; keeps the time series.
- **Cons:** compass remains a writer, which the owner explicitly rejected; a
  reporting skill would still need to know the dashboard's private data layout.

### Option C (recommended): Dashboard owns one append-only history per project, in the user's data folder
- **Pros:** satisfies both owner requirements at once — compass writes nothing,
  the dashboard writes everything; one file per project makes add/remove a
  single-file operation; zero bytes land in any surveyed repo, so principle 1
  becomes absolute and principle 6 is applied consistently; **the time series is
  preserved and consolidated**, so work-over-time statistics become possible for
  the first time (today they are scattered across 23 forked files).
- **Cons:** requires a reconciliation step to merge the existing 193 entries;
  requires a new writer to replace compass's write (see Recommended Decision §6).

### Option D: One central file holding all projects
- **Pros:** a single file to back up or track in git.
- **Cons:** rejected against the owner's stated requirement — adding or removing
  a project means rewriting a shared file, and one corrupt write risks every
  project's history at once.

### Option E: Current-state-only snapshot, overwritten on each scan
- **Pros:** trivially small; no growth management.
- **Cons:** **rejected outright.** It destroys the time series and with it the
  entire purpose of the change (work-over-time statistics). Recorded here only
  because an earlier draft of this ADR mistakenly proposed it.

## Recommended Decision

Adopt **Option C**.

1. **Location.** One file per project at
   `~/.claude/my-dashboard/snapshots/<project-key>.jsonl`, alongside the existing
   `config.json`. The folder is created by the installed plugin on first use. It
   is the user's own directory, so she may put it under git for backup — but
   nothing in the product requires or assumes that.
2. **Append-only. Never overwritten.** Each new snapshot appends one line.
   Existing lines are never rewritten, reordered, or truncated. The accumulated
   series is the asset; retention is unbounded until an explicit later decision
   says otherwise.
3. **Line schema is inherited unchanged from ADR-0002** (`v`, `ts`, `headline`,
   `next`, `blockers`, `specs`), so existing entries migrate without
   transformation and existing readers keep working. What changes is *where* the
   file lives and *who* writes it — not what a line looks like.
4. **The dashboard plugin is the only writer.** Compass returns to pure
   reporting and writes nothing at all.
5. **The existing history is reconciled, not discarded.** All 193 entries from
   the 23 files are merged into the per-project files: worktree copies fold into
   their parent project, entries are de-duplicated (identical `ts` + `headline`),
   and the result is ordered chronologically. `project-g`, which exists only as a
   worktree copy, becomes a project file of its own.
6. **Nothing is deleted until the merged history is verified.** Removal of the
   in-repo `docs/status/compass-history.jsonl` files is a **separate, later
   step**, gated on: merged entry counts reconciling against the backup,
   per-project spot-checks, and the dashboard reading the new location
   correctly. The backup at
   `~/.claude/my-dashboard/_migration-backup-2026-07-22/` is retained until then.
7. **The writer is a dashboard-owned skill.** Compass is replaced as writer, not
   extended — see Open question 1 for the two candidate shapes, which the
   implementing spec must settle. The paused `compass-snapshots` routine is
   rebuilt against that skill so the twice-daily cadence resumes.
8. **ADR-0002 is superseded** once this ADR is accepted.

## Consequences

**Becomes easier:**
- No surveyed repo carries dashboard state. Principle 1 stops needing an
  exception, and the recurring "commit it or ignore it?" question disappears.
- Worktrees stop forking the data — one project, one history, one truth.
- **Statistics become possible.** A single chronological series per project is
  what a stats or evolution view needs; the current 23 forked files cannot
  support one.
- Compass becomes a clean read-only reporter again, with no knowledge of the
  dashboard's storage.
- Per-user state is consistently one folder: config and snapshots together in
  `~/.claude/my-dashboard/`, structurally uncommittable to any project repo.

**Becomes harder:**
- **The reconciliation is the risky step.** Merging 23 forked files means
  deciding what counts as a duplicate across copies that diverged. It must be
  verified against the backup before any source file is touched.
- **Three existing writers must be retired, two outside this repo.** Probed on
  2026-07-22: (a) the **compass plugin skill**
  (`…/marketplaces/local-desktop-app-uploads/compass/skills/compass/SKILL.md`),
  which appends after every briefing; (b) this repo's `scripts/snapshot.mjs`;
  (c) the **scheduled routine** — now paused, to be rebuilt against the new
  writer. Until (a) is changed, any compass run re-creates an in-repo file.
- **Growth needs a rule.** Append-only plus a dashboard that writes on every
  scan would flood the history with near-identical lines. The cadence must be
  deliberate (see Open question 2) — this is the one place where "append
  always" needs a guard, and it is about *write frequency*, never about
  discarding what was written.
- **Rework in this repo.** `scan.mjs` (reader), `scripts/snapshot.mjs` (writer
  and its `--all --auto` mode), the snapshot tests, and
  `docs/compass-integration.md` all encode ADR-0002 and must change.
- **The abandoned folder is in scope.** 16 of the 193 entries live under
  `~/Documents/Claude/project-dashboard`, which is no longer a workplace but
  holds real history that belongs to this project's series.

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

**Verified by probe on 2026-07-22** (not assumptions):

- File inventory, entry counts, and git status — `find` + `git ls-files` /
  `git check-ignore` across `~/Documents/Claude`: 6 project-root files (65
  entries) and 17 worktree copies (128 entries), 193 total; one root
  git-ignores its file, the other five commit it.
- Scheduled task `compass-snapshots`: cron `0 5,12 * * *`, last fired
  2026-07-22T19:02:16Z, now `enabled: false`.
- Backup: 23 files / 193 entries copied to
  `~/.claude/my-dashboard/_migration-backup-2026-07-22/` after that run.
- Reader: [`src/scan.mjs:215`](../../src/scan.mjs) reads
  `docs/status/compass-history.jsonl` per project.
- Writer: [`scripts/snapshot.mjs:65`](../../scripts/snapshot.mjs) appends to it.
- Config path precedent: [`src/scan.mjs:31`](../../src/scan.mjs) resolves
  `~/.claude/my-dashboard/config.json`.
- The three writers named in Consequences — each read from its own file on disk.

**Genuine assumptions:**

- That entries across forked worktree copies can be de-duplicated reliably by
  `ts` + `headline`. Not yet tested against the real data; if copies diverged in
  ways that collide, the merge rule needs revisiting before any deletion.
- That the compass plugin's write can be removed — it is a separate plugin under
  the owner's control, but its removal has not been attempted.

## Kill criteria

This decision should be reversed or reshaped if:

- The reconciliation cannot be verified — if merged output cannot be shown to
  account for all 193 backed-up entries, the in-repo files stay where they are
  until it can.
- The compass plugin's snapshot write turns out not to be removable (e.g. it is
  upstream and not hers to change). The cleanup would be permanently undone, and
  a different boundary would be needed.
- A dashboard-written entry proves too thin to be worth appending — if it cannot
  carry the narrative headline that makes an entry readable months later, the
  writer design (not the storage decision) needs rework.

## Open questions

1. **What replaces compass as the writer — a companion skill or a replacement?**
   The owner's instruction is to find a solution; two shapes are on the table,
   and the implementing spec must choose:
   (a) **a dashboard-owned `snapshot` skill** the user (or a rebuilt routine)
   runs, which composes the narrative entry itself and appends it — compass is
   untouched except for deleting its write; or
   (b) **a compass companion** that runs after a compass briefing and records
   the headline compass just produced — better narrative fidelity, but couples
   the two plugins.
   Both keep writing inside the dashboard plugin, as required.
2. **What cadence does the dashboard write at?** Appending on every page scan
   would flood the series. Candidates: at most one automatic entry per project
   per day; or only when the computed state differs from the previous entry;
   or only on explicit snapshot runs. Affects data quality for statistics.
3. **Does an entry need a `source` field** distinguishing a narrative snapshot
   from an automatic one? ADR-0002's `--auto` mode used one; with a single
   writer it may still be worth keeping for later filtering.
