> Status: Active (filled 2026-07-19 from audit reconciliation; draft — review welcome).
>
> Technical mechanics. Vision and design principles live in
> [product-vision.md](product-vision.md). Update via reconciliation after each
> spec slice completes.

# Architecture: dashboard

> For *what this project is*, *who it's for*, and *why*, see
> [product-vision.md](product-vision.md). This document covers the technical
> mechanics: repository structure, tech stack, decisions, modules, data.

## Repository structure

```
dashboard/
├── .claude-plugin/
│   ├── plugin.json      # Claude Code plugin manifest
│   └── marketplace.json # this repo is its own plugin marketplace
├── skills/
│   └── open/SKILL.md    # /dashboard:open — start the server from any project
├── src/
│   ├── lib.mjs          # pure parsing helpers — no filesystem access, fully unit-testable
│   ├── scan.mjs         # scanner over configured project roots (fs walk + git subprocess); CLI: node src/scan.mjs
│   └── server.mjs       # tiny node:http server; GET / → page, GET /api/data → fresh rescan JSON
├── public/
│   └── index.html       # the one self-contained page (inline CSS/JS, no build step)
├── scripts/
│   └── snapshot.mjs     # snapshot writer (ADR-0004): appends to the store outside every repo
├── test/                # node:test suites + fixture project trees under test/fixtures/
├── docs/                # jig-managed: specs, decisions, bugs, memory, vision, this file
└── dashboard.config.example.json  # shape of ~/.claude/my-dashboard/config.json — the real config never lives in a repo
```

## Tech stack

- **Runtime / language:** Node ≥ 18, ES modules, plain JavaScript — no
  TypeScript, no build step ([ADR-0001](decisions/adr-0001-runtime-zero-deps.md)).
- **Platform commitments:** local only (`localhost`); `node src/server.mjs`
  is the entire deployment. Distributed as a Claude Code plugin (this repo
  is plugin + marketplace); the installed copy runs from Claude's plugin
  cache via `${CLAUDE_PLUGIN_ROOT}`, which is why all state lives outside
  the package.
- **Package manager:** npm, dev-only; there are **zero runtime dependencies**.
- **Database / state:** none — rescan from disk on every request.
- **Key external services:** none. The only subprocess is `git` (read-only
  queries per scanned project).

## Core architecture decisions

### Zero runtime dependencies, hand-rolled parsers ([ADR-0001](decisions/adr-0001-runtime-zero-deps.md))

**Principle:** "Zero dependencies, one page — nothing to install, break, or
update" (vision principle 4).
**Mechanics:** `node:http`/`node:fs`/`node:child_process` only. Frontmatter
and checkbox parsing are hand-rolled in `src/lib.mjs` for the flat YAML
subset jig actually emits — do **not** replace with an npm parser; extend
the parsers instead. Tests use built-in `node:test`.

### Snapshot store ([ADR-0004](decisions/adr-0004-dashboard-owned-snapshots.md), supersedes ADR-0002)

**Principle:** read-only over other repos (vision principle 1, amended
2026-07-24) — the dashboard never writes *into a surveyed project*, no
exceptions. Its own state lives in the user's home data folder.
**Mechanics:** one append-only `<project-key>.jsonl` per project under
`~/.claude/my-dashboard/snapshots/`, resolved by `resolveSnapshotsDir()`
(`DASHBOARD_SNAPSHOTS` overrides; otherwise it sits beside the resolved
config, so an override cannot split the two apart). `projectKey()` folds a
linked worktree into its parent repo — one project, one history — while a
sub-directory of a repo keeps its own key so two configured projects never
merge. Compass writes nothing at all; `scripts/snapshot.mjs` is the writer.
The reader (`parseCompassHistory`) stays lenient — latest valid line wins,
malformed lines warn and never crash; the writer (`validateSnapshot`)
enforces the full versioned schema, which ADR-0004 inherits unchanged.

**Migration window (slice 005-01 → 005-02):** the reader reads *both* the
store and each project's legacy in-repo `docs/status/compass-history.jsonl`
and surfaces whichever carries the later `ts` (`laterSnapshot`) — comparing
timestamps, never concatenating, since `parseCompassHistory` picks the last
line in *file* order. The dual read retires once 005-02 has migrated and
verified the existing history.

## Module boundaries

One-directional, read-only coupling:

- **`src/lib.mjs`** — pure functions (parsing, progress math, age labels).
  No filesystem access; everything else imports from here.
- **`src/scan.mjs`** — the scanner: walks configured project roots
  (`docs/specs`, `docs/bugs`, `docs/releases`, worktrees, compass history),
  shells out to `git`, emits one JSON document. Imports lib; never writes
  outside this repo.
- **`src/server.mjs`** — thin `node:http` wrapper: serves
  `public/index.html` and `/api/data` (a fresh `scanAll` per request, no
  cache). Imports scan.
- **`scripts/snapshot.mjs`** — the one writer
  ([ADR-0004](decisions/adr-0004-dashboard-owned-snapshots.md)): validates a
  snapshot and appends it to the dashboard-owned store in the user's home data
  folder. It never writes into a surveyed project. Imports lib + scan.
- **`public/index.html`** — renders the `/api/data` JSON; all display
  logic is client-side in the single page.

## Data model

Stateless by design — same disk state → same page (vision principle 2):

- **`~/.claude/my-dashboard/config.json`** (user home, never in any repo;
  `DASHBOARD_CONFIG` overrides; example committed) — the only input state:
  project roots, labels, per-project `pinnedWorkstreams` /
  `hiddenWorkstreams`. Resolved by `resolveConfigPath()` in `src/scan.mjs`
  for server, scan CLI, and `snapshot.mjs` alike.
- **`~/.claude/my-dashboard/snapshots/<project-key>.jsonl`** — the only
  durable artifact this ecosystem appends, and it lives outside every repo
  (ADR-0004). The latest valid line is the current narrative, earlier lines
  are the time series. Each surveyed project's legacy in-repo
  `docs/status/compass-history.jsonl` is still *read* during the migration
  window and is never written to.
- **`~/.claude/my-dashboard/snapshot-aliases.json`** (user home, never in any
  repo) — the owner-confirmed identity map (ADR-0004 OQ4): each entry pairs a
  project's old location with the project it is today, plus a reason and the
  date the owner confirmed it. Consumed by the migration (`src/migrate.mjs`
  `loadAliases`/`applyAlias`) to fold a renamed project's history under one key.
  Identity is **declared here, not derived** — a derived identifier (first
  commit) was rejected because this repo's history was rewritten before
  publication, giving its old and new folders different first commits.
- Everything else is derived per request from the surveyed repos' own
  artifacts (spec/slice frontmatter, checkbox docs, bug files, git log).

## Contract surfaces

- **Snapshot file** — file contract at
  `~/.claude/my-dashboard/snapshots/<project-key>.jsonl`
  ([ADR-0004](decisions/adr-0004-dashboard-owned-snapshots.md), superseding
  ADR-0002's in-project location): versioned JSONL, append-only, written
  only by the dashboard. The line schema is inherited from ADR-0002
  unchanged, so existing entries migrate without transformation.
- **`~/.claude/my-dashboard/config.json`** — local config contract (see
  [dashboard.config.example.json](../dashboard.config.example.json));
  consumed by scanner, server, and `snapshot.mjs --all`.
- **`~/.claude/my-dashboard/snapshot-aliases.json`** — file contract for the
  identity map ([ADR-0004](decisions/adr-0004-dashboard-owned-snapshots.md)
  OQ4): `{ "v": 1, "aliases": [ { "from": <old-path>, "to": <project-path>,
  "reason": <string>, "confirmed": <date> } ] }`. Owner-authored, read by
  `src/migrate.mjs`; `~` is expanded on load. A missing file is tolerated (no
  aliases). Kept outside every repo — it names real projects and this repo
  ships publicly (vision principle 6, and the leak gate would reject it).
- **`GET /api/data`** — localhost-only JSON shape consumed by the page;
  additive evolution preferred (the page degrades gracefully on missing
  fields, per spec 003's plan).

## Open questions

> Deferred items live in [refinement-todo.md](refinement-todo.md).
