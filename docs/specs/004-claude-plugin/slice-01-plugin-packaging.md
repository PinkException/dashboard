---
status: DONE
dependencies: [002-01]
last_verified: 2026-07-22
---

## Slice 004-01 — plugin-packaging

**Goal:** Make this repo installable as a Claude Code plugin from GitHub,
usable from any project via one skill, with the user's private project list
living only in their home directory (ADR-0003; vision principle 6).

**DoR:**
- ✅ Plugin/marketplace mechanics verified against the current Claude Code
  docs (plugin.json + marketplace.json schema, `${CLAUDE_PLUGIN_ROOT}`,
  user-scope install, single repo as plugin + own marketplace).
- ✅ Confirmed nothing private was ever committed to this repo's history
  (full `git log --all` file listing reviewed).

**Acceptance Criteria:**

1. **Manifests.** `.claude-plugin/plugin.json` (name
   `project-dashboard`) and `.claude-plugin/marketplace.json` (source
   `./`) make the repo installable with
   `/plugin marketplace add Kyarha/project-dashboard` +
   `/plugin install project-dashboard@project-dashboard`.
2. **Skill.** `skills/open/SKILL.md` (`/project-dashboard:open`) starts
   `node "${CLAUDE_PLUGIN_ROOT}/src/server.mjs"`, reuses an already-running
   server, and on a missing config offers to create it instead of starting.
3. **Config resolution.** `resolveConfigPath()` in `src/scan.mjs`
   (env `DASHBOARD_CONFIG` override, else
   `~/.claude/project-dashboard/config.json`) is the single resolution used by
   server, scan CLI, and `scripts/snapshot.mjs`; no code path reads a
   config from inside a repo.
4. **Missing-config UX.** The server exits non-zero with a message naming
   the expected path, the committed example, and the env override.
5. **Docs.** README covers plugin install/configure and the non-Claude
   fallback; architecture.md reflects the plugin layout and config
   location.

**Deviation log:**

- Bug 001 fixed in the same commit (root-anchored `/.claude/` gitignore
  rule + committed worktree fixture): not an AC, but a fresh clone must be
  green once strangers install from this repo.
- Verified by `npm test` (29/29) plus a smoke run: missing-config error
  path, server + `/api/data` + page against a fixture config under a fake
  `$HOME`, and scan CLI — all through the home-dir resolution.

## Amendments

### 2026-07-22 — Renamed coordinates

Install strings and paths in this slice are the pre-rename ones. Current:
`/plugin marketplace add Kyarha/dashboard`, `/plugin install dashboard@dashboard`,
skill `/dashboard:open`, config at `~/.claude/my-dashboard/config.json`.
Recorded in the amendment on
[ADR-0003](../../decisions/adr-0003-claude-plugin-distribution.md);
original prose preserved because closed slices are records.
