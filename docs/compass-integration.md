# Snapshots: how the dashboard records "what's next"

> **Rewritten 2026-07-24 for [ADR-0004](decisions/adr-0004-dashboard-owned-snapshots.md)**
> (Accepted; supersedes ADR-0002). This document previously told you to teach
> compass to append a snapshot into each surveyed project. **Do not do that.**
> That write is what put one project's feature names and roadmap state into
> another project's git history — see
> [bug 002](bugs/002-compass-writer-still-active.md). Compass is now read-only
> and writes nothing at all; the dashboard owns the writing.

The dashboard reads one append-only file per project at
`~/.claude/my-dashboard/snapshots/<project-key>.jsonl` — outside every repo, so
no surveyed project can ever accumulate the dashboard's state.

`<project-key>` is derived by `projectKey()` in [`src/scan.mjs`](../src/scan.mjs):
a linked worktree folds into its parent repo (one project, one history), while a
sub-directory of a repo keeps its own key so two configured projects never merge.
The store location follows the resolved config — `DASHBOARD_SNAPSHOTS` overrides,
otherwise it sits beside `config.json`.

## Writing a snapshot

```bash
node scripts/snapshot.mjs --project ~/code/project-a \
  --headline "002 mid-flight, the rest still drafted" \
  --next "finish slice 002-02" \
  --blockers "waiting on a design decision"
```

`--project` may be `~`-relative; `--blockers` is `;`-separated; `specs` counts
are filled in automatically from the project's spec tree. The script validates
the versioned schema (inherited unchanged from ADR-0002) and refuses malformed
snapshots. It prints the file it wrote to.

## Deterministic snapshots, no narrative

```bash
node scripts/snapshot.mjs --all --auto
```

appends one snapshot for **every** project in the resolved config, with a
headline built from scan data (e.g. `auto: 47/62 specs done · 6 in progress`)
and `"source": "auto"`, so the dashboard labels it "last snapshot (auto)".

These are deterministic and cheap, but thin: the scanner cannot author prose
(vision principle 2). Rich narrative headlines come from a run where a human or
Claude composes them — which is what ADR-0004 Open question 1 is about, and what
slice 005-03 will build as a dashboard-owned skill.

## The migration window

Until [slice 005-02](specs/005-snapshot-store/spec.md) migrates the existing
history, the reader reads **both** the store and each project's legacy in-repo
`docs/status/compass-history.jsonl`, and surfaces whichever line carries the
later `ts`. Nothing is written to the in-repo file, and nothing is deleted from
it. Once the migration is verified, the dual read retires.

## Scheduling

The twice-daily `compass-snapshots` routine is **paused** and is not being
rebuilt yet — whether a recurring writer returns, and at what cadence, is
ADR-0004 Open question 2. Nothing is lost meanwhile: existing history is intact
and manual snapshots still work.
