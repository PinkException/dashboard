# dashboard

One local page that answers **"where is every project and what's next"** by
reading the artifacts jig-managed projects already write. Read-only over
other repos, deterministic, zero dependencies (Node ≥ 18).

## Install as a Claude Code plugin

This repo is a Claude Code plugin (and its own marketplace). In Claude Code:

```
/plugin marketplace add Kyarha/dashboard
/plugin install dashboard@dashboard
```

Then, from **any** project, ask Claude to open your dashboard (or run
`/dashboard:open`). On first use it helps you create your config at
`~/.claude/my-dashboard/config.json` — your project list lives only there, in
your home directory, never inside a repo.

## Configure

Copy the shape of
[`dashboard.config.example.json`](dashboard.config.example.json) to
`~/.claude/my-dashboard/config.json` and point it at your own jig projects.
Every browser refresh rescans from disk — nothing to regenerate, nothing to
sync. `~` paths are allowed; per-project `pinnedWorkstreams` /
`hiddenWorkstreams` are repo-relative md paths. `DASHBOARD_CONFIG=<path>`
overrides the config location; `PORT=<n>` the port.

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

Idea and original design by **[@Kyarha](https://github.com/Kyarha)** — built as
a personal tool for tracking many parallel [jig](https://github.com/ramboz/jig)
projects from one local page, and shared so others can reuse it for their own.
