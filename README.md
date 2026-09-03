# dashboard

One local page that answers **"where is every project and what's next"** by
reading the artifacts jig-managed projects already write. Read-only over
other repos, deterministic, zero dependencies (Node ≥ 18).

## Install as a Claude Code plugin

This repo is a Claude Code plugin (and its own marketplace). In Claude Code:

```
/plugin marketplace add PinkException/dashboard
/plugin install dashboard@dashboard
```

Then, from **any** project, ask Claude to open your dashboard (or run
`/dashboard:open`). On first use it helps you create your config at
`~/.claude/my-dashboard/config.json` — your project list lives only there, in
your home directory, never inside a repo.

**First-run order:**

1. **Install** the plugin (the two commands above).
2. **`/dashboard:open`** — creates `~/.claude/my-dashboard/config.json` on first
   use and serves the page. Do this before anything else: the config must exist
   before the dashboard or the snapshot routine can read it.
3. *(optional)* **Arm the automatic snapshot routine** — see
   [Automatic snapshots](#automatic-snapshots-optional) below — if you want the
   dashboard's history/"what's next" line to refresh on a schedule instead of only
   when you run it by hand.

If you run the snapshot routine before step 2, it stops with a one-line
`dashboard config not found at <path> — run /dashboard:open to create one`
message rather than a stack trace.

## Configure

Copy the shape of
[`dashboard.config.example.json`](dashboard.config.example.json) to
`~/.claude/my-dashboard/config.json` and point it at your own jig projects.
Every browser refresh rescans from disk — nothing to regenerate, nothing to
sync. `~` paths are allowed; per-project `pinnedWorkstreams` /
`hiddenWorkstreams` are repo-relative md paths. `DASHBOARD_CONFIG=<path>`
overrides the config location; `PORT=<n>` the port.

## Automatic snapshots (optional)

The [**Last snapshot**](#what-a-card-shows) line on each card comes from the
dashboard's own store. You can append entries by hand with `scripts/snapshot.mjs`,
or let a scheduled routine keep them fresh. The routine is **opt-in and
owner-gated**: it writes to your machine's live task scheduler, so nothing is armed
until you say so.

The routine's content is a version-controlled file in this repo
(`prompts/compass-snapshots/SKILL.md` — `compass-snapshots` is the name of the
scheduled task). A small installer copies it out to the scheduler; from the
plugin's repo:

```bash
node tools/install-routine.mjs check                      # read-only: does the live copy match the repo? (no writes)
node tools/install-routine.mjs install --approved-by-owner # copy it to the live scheduler (needs the explicit flag every run)
```

- `check` never writes and needs no approval — it just reports drift.
- `install` refuses without `--approved-by-owner`. It also refuses to overwrite a
  live file it can't prove it installed itself — an older/foreign routine already
  there, or one you hand-edited since — until you add `--force`, so you never
  clobber a file by accident.
- **Enabling the schedule is a separate step.** Installing the file does not start
  the twice-daily runs; enable (and schedule) the `compass-snapshots` task through
  your Claude Code scheduler when you want it live.

Once enabled, the routine runs `scripts/snapshot.mjs --all --auto --if-changed`: one
deterministic entry per configured project, but only when that project's progress
actually changed — so the history grows into an honest time series without daily
noise. It writes **only** to the dashboard's own store
(`~/.claude/my-dashboard/snapshots/`), never into any surveyed repo
([ADR-0005](docs/decisions/adr-0005-dashboard-owns-routine-install.md)).

## Run without Claude

```bash
node src/server.mjs        # → http://localhost:5111
```

## What a card shows

- **Spec progress** from `docs/specs/*/spec.md` + slice frontmatter —
  `DONE / (total − ABANDONED)`, DEFERRED reported separately.
- **Counts**: open bugs, deferred decisions, inbox items.
- **Workstreams**: `docs/releases/*.md` plans and pinned runbooks (checkbox
  progress, current phase, next step, `(you)`/`(Claude)` owner), plus
  discovered-but-unpinned checkbox docs.
- **Worktree-only docs**: warns when a doc exists only under
  `.claude/worktrees/` — one cleanup away from being lost.
- **Last snapshot**: the newest entry for a project, read from the
  dashboard's own store at `~/.claude/my-dashboard/snapshots/`
  ([ADR-0004](docs/decisions/adr-0004-dashboard-owned-snapshots.md)) — outside
  every repo, so surveying a project never writes to it. Append one with
  `scripts/snapshot.mjs`, or `--all --auto` for deterministic history points.
  See [docs/compass-integration.md](docs/compass-integration.md).

## Develop

```bash
npm test                   # node --test, fixtures under test/fixtures/
node src/scan.mjs          # scanner only, JSON to stdout
```

Spec-driven via jig: see [docs/specs/README.md](docs/specs/README.md) and
[docs/product-vision.md](docs/product-vision.md).

## Credits

Idea and original design by **[@PinkException](https://github.com/PinkException)** — built as
a personal tool for tracking many parallel [jig](https://github.com/ramboz/jig)
projects from one local page, and shared so others can reuse it for their own.
