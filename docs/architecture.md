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
│   ├── open/SKILL.md    # /dashboard:open — start the server from any project
│   └── snapshot/SKILL.md # /dashboard:snapshot — compose a narrative "what's next" entry (005-03)
├── src/
│   ├── lib.mjs          # pure parsing helpers — no filesystem access, fully unit-testable
│   ├── scan.mjs         # scanner over configured project roots (fs walk + git subprocess); CLI: node src/scan.mjs
│   └── server.mjs       # tiny node:http server; GET / → page, GET /api/data → disk-only rescan, GET /api/prs → gh-enriched deltas (010-01)
├── public/
│   └── index.html       # the one self-contained page (inline CSS/JS, no build step)
├── scripts/
│   └── snapshot.mjs     # snapshot writer (ADR-0004): appends to the store outside every repo
├── prompts/
│   └── compass-snapshots/SKILL.md # version-controlled source of truth for the scheduled routine (ADR-0005)
├── tools/
│   └── install-routine.mjs # routine installer (ADR-0005): read-only `check` (006-01) + owner-gated `install` (006-02)
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
- **Key external services:** GitHub, reached **only** through the optional `gh`
  CLI (spec 009-04) — a graceful enrichment, never required. Subprocesses are
  `git` (read-only queries per scanned project, always) and `gh` (read-only PR
  queries, **only when installed + authenticated**; every failure — absent,
  unauthenticated, offline, timeout — degrades to the exact no-`gh` behavior, so
  the `git clone && node server.mjs` install promise is preserved).

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

**Recurring routine + cadence (slice 005-04, resolves ADR-0004 OQ2):** the
unattended twice-daily routine is rebuilt to write only deterministic
`snapshot.mjs --all --auto` entries to the store (the narrative
`/dashboard:snapshot` skill stays human-invoked). It drops the retired
`--commit` flag entirely — that write into each surveyed repo was the leak
(bug 002). Cadence is **on-change-only**, enforced by the new `--if-changed`
flag: a project is skipped unless its **progress signature** —
`specs.done` + `specs.total` + `slices.done` + `slices.total` + `next` — differs from its most recent stored
entry *of the same `source`*. Two deliberate properties:
- **Bug-count churn and `scanned` provenance are excluded** from the signature
  (a bug opening then closing is net-zero progress, not a series point).
- **Slice-granular since spec 013-03** (owner decision 2026-11-18): a slice
  finishing or being added writes an auto point. An older stored entry without
  `slices` compared with a new one that has them counts as changed once.

Because the routine now adds a fresh `auto` line potentially every day, the
card reader **prefers the latest narrative (non-`auto`) entry** for the card
headline (`parseCompassHistory` exposes `latestNarrative`; `scanCompass`
selects it, falling back to the latest entry overall only when no prose
exists). A `source`-less legacy line counts as narrative. The `auto` series
still accumulates in the store for the chart; it just never takes over the
card. **Consequence:** the card's freshness label (`stale`/`ageDays`) now
tracks the displayed *narrative* entry's age, not routine activity — an
actively-sampled project can still read "stale" if its prose is old. This is
intended (a nudge to refresh prose), not a bug.

## Module boundaries

One-directional, read-only coupling:

- **`src/lib.mjs`** — pure functions (parsing, progress math, age labels).
  No filesystem access; everything else imports from here. Includes
  `deriveWaitingStages` (spec 009-03): the single triage derivation — it returns
  a project's **rank-ordered list** of open pipeline stages
  (`[{ state, verb, action, rank }, …]`) from its slice statuses, owner
  (`**(you)**`) tags, compass blockers, and an optional owner-set `needsYou`
  marker. `deriveWaitingOn` (spec 009-02) is re-expressed as its head
  (`deriveWaitingStages(…)[0] ?? Idle`) — the one collapsed `waitingOn` state the
  grid shows — so the grid headline and the action-queue rows read from one
  source and cannot disagree. **Both stay pure** across the spec 009-04 PR
  enrichment: they gain an optional trailing `ownerLogin` arg and read a
  `project.prs` array, but perform no I/O — the `gh` calls that populate those
  inputs live in `src/scan.mjs`. PR signals fold into the same rank-ordered list
  (approved+CLEAN → MERGE; owner in `reviewRequests` → REVIEW; a non-owner
  reviewer → the previously-reserved External slot), owner-conditional so an
  owner-review PR is never mis-filed as External — so PR work surfaces in both the
  grid head and the action-queue. **Spec 012-01** adds the roadmap derivations,
  all pure with injected inputs: `deriveRoadmap` (the automatic spec/slice order,
  sequence strip, release block, spec groups and done fold — spec 012 "Automatic
  order (layer 1)"), `worktreeHint` (the "N slices further along / M specs only in
  worktrees" counts), `sliceNameFrom`, and the parsers `parseRecencyLog` /
  `parseWorktreeList`. `currentReleaseTrack` (the overview's default release
  track rule) **moved here from `public/render.mjs`**, so the overview and the
  roadmap read one scanner-emitted value.
- **`src/scan.mjs`** — the scanner: walks configured project roots
  (`docs/specs`, `docs/bugs`, `docs/releases`, worktrees, compass history),
  shells out to `git`, emits one JSON document. Imports lib; never writes
  outside this repo. **Named read-boundary extension (spec 003-01):** the
  scanner also makes a **read-only** pass over the *global* Claude Code
  session store — running sidecars at `~/.claude/sessions/*.json` and
  transcripts at `~/.claude/projects/<slug>/<uuid>.jsonl` — attributing each
  session back to a configured project by directory slug and emitting a
  per-project `sessions` array + `sessionsTotal`. This is the first read
  outside a configured project root; it is snapshot-from-disk (not a live
  session client), spawns no subprocess for sessions, and writes nothing under
  `~/.claude`. The store layout is **not a stable public contract** (spec 003
  A4): the reader is lenient — malformed/absent data degrades to `[]` + a
  `warnings` entry, never a throw. Attribution + emit are batched in
  `readAllSessions` (called from `scanAll`), not `scanProject`, because the
  longest-root tie-break needs every configured root at once. Each scanned
  project also carries the derived `waitingOn` field (spec 009-02, via
  `deriveWaitingOn`) and the full `waitingStages` list (spec 009-03, via
  `deriveWaitingStages`); both are omitted for error / non-jig payloads (the page
  treats an absent field as Idle-equivalent). **Optional `gh` read-boundary (spec
  009-04):** when `gh` is installed + authenticated, `scanAll` builds a
  once-per-scan `gh` context (`buildGhContext`, an injectable-runner seam that
  captures the owner login) and each jig-managed project gets a bounded,
  read-only `gh pr list` (placed *after* the non-jig early return, so non-jig
  projects make no call); the resulting non-draft `prs` feed both derivations.
  Like the session-store read, it is snapshot-from-disk-category (no live
  client) and lenient — any `gh` failure yields no `prs`, never a throw.
  **Roadmap inputs (spec 012-01):** spec recency comes from **one**
  `git log --format=%ct --name-only --no-renames --relative -- docs/specs` per project (mtime
  fallback when git is unavailable or a spec has no commit yet), and `gitInfo`
  folds its former three git spawns into one `git log` to pay for it (AC11 scan
  budget). The worktree hint is a **new content read** of worktree slice
  frontmatter (first 2 KB; whole-file fallback when the frontmatter runs past 2 KB) — deliberately wider than 002-02 AC4's path-only
  worktree rule; `scanWorktreeOnlyDocs` is unchanged. Worktrees are enumerated
  from `.git/HEAD` + `.git/worktrees/*/gitdir` without spawning git (relative
  pointers resolved against the worktree's admin dir), falling back to one
  `git worktree list --porcelain` when the root's `.git` is a file or a read
  fails. A project in a repo subdirectory gets no worktree hint. This couples the
  fast path to git's on-disk layout, behind the porcelain fallback.
- **`src/server.mjs`** — thin `node:http` wrapper: serves
  `public/index.html`, `/render.mjs` (the client render module, one explicit
  fixed-path route — no static-file server, no path-traversal surface; spec
  009-01), and the **two-phase data routes** (spec 010-01 / ADR-0007):
  `/api/data` is a **disk-only** `scanAll` (run with a disabled `gh` context, so
  first paint never blocks on `gh`), and `/api/prs` is the enrichment phase — a
  full `scanAll` with the real `gh` context, returned as per-project deltas via
  `prDeltas`. Both are a fresh scan per request, no cache. Imports scan.
- **`scripts/snapshot.mjs`** — the one writer
  ([ADR-0004](decisions/adr-0004-dashboard-owned-snapshots.md)): validates a
  snapshot and appends it to the dashboard-owned store in the user's home data
  folder. It never writes into a surveyed project. Imports lib + scan.
- **`prompts/compass-snapshots/SKILL.md`** — the version-controlled **source of
  truth** for the scheduled snapshot routine
  ([ADR-0005](decisions/adr-0005-dashboard-owns-routine-install.md)). Changed only
  through the spec workflow; copied to the live scheduler by the installer.
- **`tools/install-routine.mjs`** — the dashboard's own routine installer
  ([ADR-0005](decisions/adr-0005-dashboard-owns-routine-install.md)). **The line is
  at writes, not the directory:**
  - `check` (slice 006-01) is read-only, needs no approval, and exits non-zero on
    any drift between the repo source and the live copy.
  - `install` (slice 006-02) is the **owner-gated write path**. It refuses without
    `--approved-by-owner` (exit `NOT_APPROVED`); its enforceable promise is *no
    unflagged write*, every run — the flag signals a deliberate approval, not proof
    of owner identity (that rests on operator discipline, per ADR-0005). On a
    sanctioned run it copies the source out, **reads it back byte-for-byte** (a copy
    that did not land exits `VERIFY_FAILED`), sets file mode `0o644`, and records a
    manifest at `~/.claude/scheduled-tasks/.dashboard-install.json` holding the
    installed file's SHA-256. It **refuses** (exit `REFUSED`) to clobber a live file
    it cannot prove is safe — one hand-edited since our last install (live hash ≠
    manifest hash) or an unmanaged pre-existing file (no manifest) — unless
    `--force` adopts it; a *managed upgrade* (manifest matches live, source moved)
    proceeds without `--force`. Exit codes are distinct (`NOT_APPROVED` /
    `REFUSED` / `VERIFY_FAILED` / `MATCH`) so a caller can tell the outcomes apart.
  Imports `expandHome` from scan (same `tools/scripts → src` coupling as
  `snapshot.mjs`). Run via Bash, so the Write/Edit-only guardrail does not
  intercept it (spec 006 A1). **Enabling/scheduling the cron stays a separate owner
  action** — the installer only manages the SKILL.md content.
- **`public/index.html`** — the single page: **two-phase load** (spec 010-01) —
  fetches `/api/data` and renders immediately, then fires a non-blocking
  `/api/prs` fetch and folds the PR deltas into the rendered model via the pure
  `mergePrDeltas` (a keyed field-swap, no client derivation — ADR-0001 holds); any
  `/api/prs` failure is swallowed so the disk render stands. Owns the theming
  (light default + dark via `prefers-color-scheme`) and the thin click/tab
  interaction glue; imports the render module. Since spec 012-01 the open
  detail tab is app state (`state.tab`) applied by re-render through
  `detailView`, replacing 010's DOM capture/restore in `loadPrs` — so the
  `/api/prs` fold-in and the auto-refresh keep the open tab by construction.
- **`public/render.mjs`** — pure client render helpers (spec 009-01): row +
  detail-view HTML builders and derivations (`overviewRow`, `detailView`,
  `inFlightCount`/`heatBucket`, `progressBarSvg`, `currentReleaseTrack` (since
  spec 012-01 a lookup of the scanner-emitted `currentReleasePath`, not a
  derivation), `detailSpecList`, `sessionsDetailBlock`, `roadmapTabHtml` (spec
  012-01, renders the scan-derived `roadmap`), plus the spec 009-02 triage-headline +
  ordering helpers `nextMoveCell`, `sortProjectsByWaitingOn`, `waitingOnRank`)
  returning strings/values with no DOM dependency, so `node:test` imports them
  directly (browser-and-node shared ES module). It **reads** the scan-derived
  `waitingOn` field (grid) and the `waitingStages` list (the cross-project
  action-queue lens, spec 009-03 — `actionQueue`, `actionQueueHtml`, `setLens`)
  but performs no derivation itself and imports nothing — keeping all domain
  logic scan-side (the 009-02 boundary). No filesystem/network access; charts are
  inline SVG (ADR-0001).

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
- **`~/.claude/sessions/*.json` + `~/.claude/projects/<slug>/<uuid>.jsonl`**
  (Claude Code's own global session store; **read-only input**, never written
  by the dashboard — spec 003-01) — running-process sidecars and session
  transcripts. Read per request to compute each project's `sessions` list.
  Overridable via a `sessionStore` path (default `~/.claude`) so tests point at
  a fixture store. Treated as an unstable layout (spec 003 A4), read leniently.
- Everything else is derived per request from the surveyed repos' own
  artifacts (spec/slice frontmatter, checkbox docs, bug files, git log).

## Contract surfaces

- **Snapshot file** — file contract at
  `~/.claude/my-dashboard/snapshots/<project-key>.jsonl`
  ([ADR-0004](decisions/adr-0004-dashboard-owned-snapshots.md), superseding
  ADR-0002's in-project location): versioned JSONL, append-only, written
  only by the dashboard. The line schema is inherited from ADR-0002
  unchanged, so existing entries migrate without transformation. The `source`
  field records provenance: `manual` (a human headline), `auto` (the
  deterministic `snapshot.mjs --auto` line), or `dashboard` (the narrative
  `/dashboard:snapshot` skill, slice 005-03). `validateSnapshot` does not
  constrain the value — this is a documented convention, not a validated enum.
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
  fields, per spec 003's plan). Spec 009-02 adds a per-project derived
  `waitingOn: { state, verb, action, rank }` (state ∈ DECIDE/REVIEW/MERGE/Ready/
  External/Idle; the triage headline + finish-first sort key); omitted for
  error / non-jig projects, which the page treats as Idle-equivalent. Spec 009-03
  adds the sibling `waitingStages: [{ state, verb, action, rank }, …]` — the
  rank-ordered list of all open stages (`waitingOn === waitingStages[0]`), read by
  the cross-project action-queue lens; an empty list is Idle.
  Spec 013-01 adds, for jig-managed projects only,
  `history: { points: [{ ts, done, total, source, headline?, slices?, bugs?,
  scanned? }], live: { done, total, slices? }, skipped: { noNumbers, malformed } }`, the progress-over-time series
  drawn in the Activity tab. `points` is built by `buildProgressSeries`
  (`src/lib.mjs`) from the **store file only**, never the legacy in-repo
  history. It is oldest first, capped at the 200 newest, and only entries
  carrying numeric `specs` are kept. `source` is `null` for untagged entries,
  which count as narrative. The page computes only two things itself: the
  down-step markers and the "last snapshot N days ago" caption. `live` is the
  current scan's
  `progress.done` / `progress.denom`, the same values the writer stores as
  `specs`. This is an additive change; `compass` is unchanged.
  **Spec 013-03** adds three optional entry fields, written by every new
  snapshot (`scripts/snapshot.mjs`) and passed through on each point when
  well-formed (malformed extras are dropped, the point is kept):
  `slices: {done, total}` (real slices only, i.e. with a `status:`; ABANDONED
  out of `total`; omitted when the project has none; counted by
  `realSliceCounts` in `src/lib.mjs`, not by `sliceProgress`), `bugs: {open}`,
  and `scanned: {branch, worktree}` (the branch checked out at the scanned root,
  `null` if detached or unknown; `worktree: true` when that root is a linked
  worktree). `live.slices` is the current scan's real-slice count, absent when
  there are none. `validateSnapshot` checks all three. Old entries stay valid;
  the chart's slice lines, y-axis labels, key and the "counted on another
  branch or worktree" down-step wording read these fields.
  **Spec 010-01 (ADR-0007) makes `/api/data` disk-only:** it is now a scan run
  with a disabled `gh` context, so its `waitingOn`/`waitingStages` are derived from
  disk signals alone and it **no longer carries** `prs`/`ownerLogin` (those moved
  to `/api/prs`, below). This is the **first deliberately non-additive** change to
  this surface (its documented policy is "additive evolution preferred"); it is
  acceptable because the sole consumer is `public/index.html`, updated in lockstep,
  and the removed fields are re-supplied by the phase-two surface.
  **Spec 012-01 adds (additively):** `specs[].slices[].name` (from the slice's
  `## Slice NNN-NN — <name>` heading, filename-stem fallback),
  `specs[].recency`, `workstreams[].includeTokens` (release Include tokens, on
  releases with a resolvable goal — the same releases `currentReleaseTrack` can pick),
  `projects[].currentReleasePath` (the default release track, derived
  scanner-side), and `projects[].roadmap` (the ordered roadmap model plus its
  `asOf` branch and worktree hint).
- **`GET /api/prs`** — the phase-two enrichment surface (spec 010-01 / ADR-0007):
  a full `scanAll` with the real `gh` context, returned as **per-project deltas**
  `{ generatedAt, projects: [{ path, ownerLogin?, prs?, waitingOn, waitingStages }] }`,
  keyed on `path`. `prs` (the 009-04 open-non-draft-PR array
  `{ number, title, url, author, reviewDecision, mergeStateStatus, reviewRequests }`)
  and `ownerLogin` are present **only when `gh` is available**; `waitingOn`/
  `waitingStages` are the `gh`-enriched recomputation and are always carried
  together. On any `gh` failure the deltas equal the disk values (empty/absent
  `prs`), so the page — which folds these in via `mergePrDeltas` — renders
  identically to a no-`gh` run.

## Open questions

> Deferred items live in [refinement-todo.md](refinement-todo.md).
