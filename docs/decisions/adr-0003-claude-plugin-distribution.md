---
status: Accepted
dependencies: []
last_verified: 2026-07-22
---

# ADR-0003: Distribution: Claude Code plugin, private state in user home

## Status

Accepted (2026-07-22) — amended 2026-07-22 (rename, see below)

## Amendment (2026-07-22): everything is named `dashboard`; data folder is `my-dashboard`

Owner directive ("no more confusion"): one name across the board, and a
*deliberately different* name for the user's private data folder. This
amends the coordinates below; the decision itself is unchanged.

- **GitHub repo renamed** `Kyarha/project-dashboard` → **`Kyarha/dashboard`**
  (GitHub redirects the old URL).
- **Plugin + marketplace renamed** `project-dashboard` → **`dashboard`**
  (v0.2.0). Install is now `/plugin marketplace add Kyarha/dashboard`,
  then `/plugin install dashboard@dashboard`; the skill is `/dashboard:open`.
- **User data folder renamed** `~/.claude/project-dashboard/` →
  **`~/.claude/my-dashboard/`** (config at
  `~/.claude/my-dashboard/config.json`). Owner picked `my-dashboard` over
  `dashboard-data`, `dashboard-config`, and keeping `dashboard`, precisely
  so the data folder can never be confused with the dev clone at
  `~/Documents/Claude/dashboard` — the "mine, not the engine" reading is
  the point. No install existed yet, so nothing migrates.
- Everywhere the old strings appear in this ADR's body below, read the new
  names; the body is preserved as written for the record.
- **Resolves:** the undocumented public-plugin identity (parked in
  inbox 2026-07-19, never promoted) after a first public/private split
  attempt leaked private files into the public repo.

## Context

The dashboard was always meant to be shared publicly as a companion to jig,
but the 2026-07-13 vision brief only recorded the personal-tool half. With
no written distribution story, the config defaulted to the repo root and
the engine/private-data boundary was never designed — which is how private
files ended up in a public repo. The audience already lives in Claude Code
(jig is a Claude workflow), so a distribution channel native to it fits.

## Decision

- **This repo is a Claude Code plugin and its own marketplace**:
  `.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json`. Install:
  `/plugin marketplace add Kyarha/project-dashboard`, then
  `/plugin install project-dashboard@project-dashboard`.
- **One skill**, `skills/open/SKILL.md` (`/project-dashboard:open`): starts
  the bundled server via `${CLAUDE_PLUGIN_ROOT}` from any project, and helps
  create the config on first use.
- **Private state lives in the user's home, never in a repo** (vision
  principle 6): config is resolved by `resolveConfigPath()` in
  `src/scan.mjs` — `DASHBOARD_CONFIG` env override, else
  `~/.claude/project-dashboard/config.json`. Server, scan CLI, and `snapshot.mjs`
  all share this resolution; the server exits with a pointed message when
  the config is missing.
- **A named folder, not a loose file**: everything machine-local the
  dashboard owns lives under `~/.claude/project-dashboard/` — the config
  today, and any future machine-local state (dogfood snapshot history,
  caches, hours-layer data). One self-explaining folder instead of
  orphan files accumulating in `~/.claude/`. Snapshots of *surveyed*
  projects are unaffected: those stay in each project's own
  `docs/status/` per ADR-0002.
- **The owner is user zero, not a special case**: she installs and uses the
  plugin exactly like everyone else. No private companion repo is required;
  one is optional only as a backup of the config file.

## Consequences

- The installed copy runs from Claude's plugin cache
  (`~/.claude/plugins/…`), so nothing inside the package may be treated as
  writable or user-specific — all state stays in the user's home or in the
  surveyed projects' own artifacts (ADR-0002).
- Config in a repo root is no longer read. Existing users (the owner) move
  it once: `mkdir -p ~/.claude/project-dashboard &&
  mv dashboard.config.json ~/.claude/project-dashboard/config.json`.
- Dev flow uses the env override (`DASHBOARD_CONFIG=… node src/server.mjs`
  or a fixture config in tests); `claude --plugin-dir .` tests the plugin
  from a checkout.
- Future agents: never introduce a path where user-specific data is read
  from or written to a location inside a git repository.

## Alternatives considered

- **Public engine repo + private consumer repo** (the first attempt):
  rejected — the boundary depends on discipline instead of structure, and
  it already failed once (private files leaked into the public repo).
- **npm package**: viable, but registry ceremony for an audience that
  already has a plugin channel inside Claude Code; also invites the
  dependency-tree culture ADR-0001 avoids. Can be added later without
  breaking the plugin shape.
- **Manual zip / git-clone install**: works (and still does for
  non-Claude users via `node src/server.mjs`), but has no update story and
  no discoverability alongside jig.

## Amendments

- **2026-09-02 — account/repo rename `Kyarha` → `PinkException`.** The GitHub
  account `Kyarha` was renamed to **`PinkException`** — a rename, single identity,
  not a new account or a re-fork. The repo is therefore now
  **`PinkException/dashboard`** and the install line is
  `/plugin marketplace add PinkException/dashboard` (then
  `/plugin install dashboard@dashboard`, unchanged). The `Kyarha/*` references in
  the body above are **preserved** per jig's records-vs-live-prose rule (this ADR
  is a record); GitHub redirects the old URLs. Live prose (`CLAUDE.md`), the
  `README`, and the plugin/marketplace manifests
  (`.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`) are updated
  inline to the new name.
