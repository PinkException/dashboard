---
name: open
description: Start the project dashboard and give the user the URL. Use when the user wants to see their project dashboard, check where their jig projects stand, get an overview of spec progress / open bugs / workstreams across projects, or says things like "open my dashboard" or "where are my projects at".
---

# Open the project dashboard

The dashboard is a zero-dependency local Node server. It reads the user's
project list from `~/.claude/my-dashboard/config.json` (never from inside a
repo) and serves one page at `http://localhost:5111`.

## Steps

1. **Check the config exists**: `~/.claude/my-dashboard/config.json`.
   - If it is missing, do NOT start the server. Offer to create it: ask the
     user which project directories they want on the dashboard (absolute
     paths or `~` paths), then write the file following the shape of
     `${CLAUDE_PLUGIN_ROOT}/dashboard.config.example.json` — a `port`
     (default 5111) and a `projects` array of `{ "path", "label" }` entries.
     Optional per-project keys: `pinnedWorkstreams`, `hiddenWorkstreams`
     (repo-relative `.md` paths).
2. **Check whether the server is already running**: request
   `http://localhost:5111/api/data` (or the configured port). If it
   responds, just give the user the URL — the page rescans from disk on
   every refresh, so there is nothing to restart.
3. **Start it** if not running, as a background process:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/src/server.mjs"
   ```

   Wait for it to come up, verify `/api/data` returns JSON, then tell the
   user to open `http://localhost:5111`.
4. **On errors**, relay the server's message — it explains missing/invalid
   config. `DASHBOARD_CONFIG=<path>` overrides the config location and
   `PORT=<n>` the port, but only mention these if the user needs them.

## Related

- Append a status snapshot for every configured project (for the "last
  snapshot" line on each card). Snapshots are written to the dashboard's own
  store under `~/.claude/my-dashboard/snapshots/` — never into the surveyed
  projects themselves:

  ```bash
  node "${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.mjs" --all --auto
  ```
