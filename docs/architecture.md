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
│   └── snapshot.mjs     # compass-snapshot writer (ADR-0002): manual and --auto/--all routine mode
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

### Compass snapshot contract ([ADR-0002](decisions/adr-0002-compass-snapshot-contract.md))

**Principle:** read-only over other repos (vision principle 1) — the
dashboard never writes lifecycle state anywhere.
**Mechanics:** each surveyed project gets an append-only
`docs/status/compass-history.jsonl`; writers are compass or
`scripts/snapshot.mjs`, never the dashboard. The reader
(`parseCompassHistory`) is deliberately lenient — latest valid line wins,
malformed lines warn and never crash; the writer (`validateSnapshot`)
enforces the full versioned schema.

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
- **`scripts/snapshot.mjs`** — the one sanctioned writer (ADR-0002):
  validates and appends snapshots into *surveyed* projects. Imports lib +
  scan.
- **`public/index.html`** — renders the `/api/data` JSON; all display
  logic is client-side in the single page.

## Data model

Stateless by design — same disk state → same page (vision principle 2):

- **`~/.claude/my-dashboard/config.json`** (user home, never in any repo;
  `DASHBOARD_CONFIG` overrides; example committed) — the only input state:
  project roots, labels, per-project `pinnedWorkstreams` /
  `hiddenWorkstreams`. Resolved by `resolveConfigPath()` in `src/scan.mjs`
  for server, scan CLI, and `snapshot.mjs` alike.
- **`docs/status/compass-history.jsonl`** in each *surveyed* project — the
  only durable artifact this ecosystem appends (via compass or
  `snapshot.mjs`, never the dashboard/scanner itself); the latest valid
  line is the current narrative, earlier lines are the time series.
- Everything else is derived per request from the surveyed repos' own
  artifacts (spec/slice frontmatter, checkbox docs, bug files, git log).

## Contract surfaces

- **Compass snapshot file** — file contract at
  `<project>/docs/status/compass-history.jsonl`
  ([ADR-0002](decisions/adr-0002-compass-snapshot-contract.md)): versioned
  JSONL, append-only, shared with compass (writer) and potentially jig
  upstream.
- **`~/.claude/my-dashboard/config.json`** — local config contract (see
  [dashboard.config.example.json](../dashboard.config.example.json));
  consumed by scanner, server, and `snapshot.mjs --all`.
- **`GET /api/data`** — localhost-only JSON shape consumed by the page;
  additive evolution preferred (the page degrades gracefully on missing
  fields, per spec 003's plan).

## Open questions

> Deferred items live in [refinement-todo.md](refinement-todo.md).
