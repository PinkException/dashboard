---
status: DONE
dependencies: [002-01]
last_verified: 2026-08-04
frame_review: true
---

## Slice 003-01 — sessions-scan-and-render

**Goal:** On each project card, see a **Sessions** section: the Claude Code
sessions for that project, running-first, each showing its human title with
the worktree, branch, and relative last-activity as context, and a clear
badge on the ones running right now — all recomputed from the local session
store on every refresh, read-only and zero-dep. After this slice the owner
opens the dashboard and knows, per project, where she is working on what.

**DoR:**
- ✅ Store layout verified on disk (2026-07-13, Claude Code v2.1.205):
  running sidecars at `~/.claude/sessions/*.json` (`sessionId`+`cwd`);
  transcripts at `~/.claude/projects/<slug>/<uuid>.jsonl` with per-line
  `cwd`/`gitBranch` and a last `custom-title`→`customTitle`; last-activity
  from mtime. See spec `## Assumptions` A1–A3.
- ✅ Data-source decision recorded: snapshot-from-disk, not live/`gh`/archived
  flag (spec Overview + A4–A6).
- ✅ Existing scanner/server/page pipeline in place (002-01) to extend.

**Acceptance Criteria:**

1. **Session reader.** A reader enumerates sessions from the local session
   store — default `path.join(os.homedir(), '.claude')`, **overridable** (a
   `sessionStore` config field and/or an injectable path) so tests point at a
   fixture store. For each session it resolves `{ id, title, branch,
   worktree, running, lastActivity, active }`. Uses only `node:fs`/`node:os`
   (zero deps, per ADR-0001).
2. **Title resolution + fallback.** `title` = the last
   `{"type":"custom-title","customTitle":…}` line's value. When absent (the
   common case), the first **human** `user` message's first text: if `content`
   is a string, use it; if an array of blocks, use the first `text` block only
   (skip `image`/`tool_use`/`tool_result` blocks so a pasted image never
   becomes a base64 title); strip any `<system-reminder>`/`<command-*>`
   wrapper; skip synthetic/meta turns (`isMeta`, tool-result-only, spawned-
   agent scaffolding). Then the first line, trimmed (~80 chars). When no human
   text exists, fall back to the sidecar `name` **only if** `nameSource` is a
   human source (not `"derived"`), else the session `id`. Fixtures: a
   `custom-title` yields it verbatim; a title-less session whose first block is
   an image falls back to the first *text* block, not the base64; an
   empty/meta-only transcript falls back to the id.
   *(Amended 2026-08-04 by frame-critique — see ### Frame-critique.)*
3. **Running detection.** `running` is true **iff** a sidecar in
   `<store>/sessions/*.json` has a matching `sessionId`. Fixture: a session
   with a sidecar → `running:true`; one without → `running:false`.
4. **Project attribution + worktree (body-free).** Attribution is resolved
   from the transcript *directory name* alone — no transcript body is read to
   attribute (see AC7). For each configured project, expand its `path` and
   compute its store slug `encode(path)` (every non-alphanumeric char → `-`,
   matching Claude Code's `~/.claude/projects/<slug>` scheme, so `/.claude/` →
   `--claude`). A session directory attributes to that project iff its name
   **equals** `encode(root)` (a main-root session) or **starts with**
   `encode(root) + '--claude-worktrees-'` (a worktree session). Matching is
   segment-anchored, not a bare string prefix, so sibling roots that share a
   prefix (`.../dashboard` vs `.../dashboard-plugin`) never cross-attribute;
   when two configured roots both match, the **longest** root wins. `worktree`
   = the path segment immediately after `.claude/worktrees/` (regardless of any
   deeper nesting like `.../worktrees/<name>/.claude/skills/...`), else `null`
   for a main-root session; for emitted sessions it is refined from the
   transcript's own `cwd` when the body is read (AC7). Directories matching no
   configured root are dropped. Enumerate `*.jsonl` files only (a transcript
   dir may also hold non-session entries, e.g. a `memory/` subdir). Fixture
   covers a main-root session and a worktree session under the same project,
   plus a sibling-prefix root that must NOT capture the other's sessions.
   *(Amended 2026-08-04 by frame-critique — see ### Frame-critique.)*
5. **Active window + ordering + cap.** `active` = `running || (now −
   lastActivity ≤ SESSION_ACTIVE_DAYS)` (module const, default 7). Sessions
   are ordered running-first, then `lastActivity` descending, and the emitted
   list is capped at `SESSION_CAP` (default 20) per project; `sessionsTotal`
   records the pre-cap count so the page can show a "+N" overflow. Fixture:
   one running + one recent + one stale session order and flag correctly.
6. **JSON contract.** Each project result (jig-managed or not) gains
   `sessions: [{ id, title, branch, worktree, running, lastActivity, active }]`
   (branch `null` when `gitBranch` is absent/`HEAD`), plus `sessionsTotal`
   (number). Empty array when the project has no attributed sessions; a
   missing/unreadable store yields `[]` + a `warnings` entry, never a throw
   (A4 leniency).
7. **Performance — two-phase, body-free triage then bounded reads.** The
   reader must not read transcript bodies to attribute or to decide what to
   emit. **Phase 1 (body-free):** enumerate session directories, attribute by
   directory name (AC4), enumerate `*.jsonl`, and for each session derive `id`
   (file basename = sessionId), `running` (a sidecar in
   `<store>/sessions/*.json` carries this sessionId — AC3), and `lastActivity`
   (file mtime); compute `active` and `sessionsTotal`, order running-first then
   mtime desc, and **cap to `SESSION_CAP` per project**. **Phase 2 (bounded):**
   only for the capped, emitted sessions, read the transcript to resolve
   `title` (AC2), `branch` (last `gitBranch`), and refine `worktree` from the
   body `cwd`. Bodies are read with a bounded/streamed scan (line stream or
   bounded tail+head — core `node:fs`/`node:readline` only, no npm dep), never
   by loading a whole multi-MB transcript into memory. No unbounded read of all
   transcript dirs' bodies. This resolves the AC4/AC7 tension the frame-
   critique surfaced: a non-running session's live `cwd` lives only in its
   body, so exact-`cwd` attribution would force a full-corpus body scan —
   instead attribution is by launch directory (the slug), which for ~8% of
   sessions reflects the launch dir rather than a later `cd` into a worktree,
   and the emitted set's bounded body read refines worktree/branch.
8. **Rendering.** Each card shows a **Sessions** section: one row per
   **active** session (running-first), with the title prominent, a `●`
   running badge when `running`, and `branch` · `worktree` · relative
   last-activity ("3h ago") as secondary text. The section is omitted when a
   project has zero sessions. Rendering degrades gracefully when
   `sessions`/`sessionsTotal` are absent (older snapshot / non-updated page).
9. **Read-only + scope.** The feature writes nothing under `~/.claude`, spawns
   no subprocess (no `git`/`gh` for sessions), and renders titles + metadata
   only — never transcript body content beyond the first-line title fallback.
10. **Tests.** `node --test` green with a fixture session store under
    `test/fixtures/`: title resolution (all three fallbacks), running match,
    cwd attribution (main root + worktree + unmatched-dropped), active-window
    flag, cap + `sessionsTotal` overflow, and missing-store leniency.

**DoD:**
- [x] All ACs pass; full test suite green (no regressions to 002's tests).
- [x] Implementer test coverage exercises each AC with at least one fixture.
- [x] Reviewed against spec — independent reviewer subagent; conditions
      closed. (compliance + craft passes both `pass`; two regression-guard
      tests added post-review; reconciliation review `pass`.)
- [x] Frame-review pass run (spec carries real `## Assumptions`, A4 in
      particular — the store is not a stable contract).
- [x] Deviation log produced under this slice heading.

**Anti-horizontal-phasing check:** after this slice alone, the owner opens
the one dashboard URL and sees, per project, which sessions are running now
and what each is about — the whole "where am I working on what" value,
before the older-toggle or PR badges exist.

### Frame-critique (2026-08-04, pre-implementation)

An adversarial frame-critique ran against live on-disk data (Claude Code
v2.1.219; 8 running sidecars; 406 sampled transcripts; the current 8-project
config). Verdict: **FRAME-SOUND-WITH-NOTES** — buildable once the blocker was
resolved in the slice text (done below).

- **[blocker] AC4×AC7 attribution contradiction** — a non-running session's
  live `cwd` is only in its body, and the directory slug ≠ `encode(cwd)` for
  ~8% of sampled sessions (measured), so "attribute by exact cwd" and "don't
  read bodies" were mutually unsatisfiable. **Resolved:** AC4 now attributes
  body-free by directory slug (segment-anchored); AC7 now reads bodies only for
  the capped emitted set and refines worktree/branch there.
- **[should-fix] worktree extraction assumed `cwd` == worktree root** — real
  cwds nest below it (`.../worktrees/<name>/.claude/skills/...`). **Resolved:**
  AC4 takes the segment immediately after `.claude/worktrees/`, any depth.
- **[should-fix] AC2 title fallback undefined vs real message shapes** — a
  user `content` array can lead with an image block (→ base64 title) or be a
  meta/tool-result/spawned-agent turn; title-less is the common case.
  **Resolved:** AC2 now specifies first *text* block, wrapper-stripping, meta
  skipping, and a `nameSource`-gated sidecar fallback.
- **[nit] segment vs string prefix** — folded into AC4 (segment-anchored,
  longest-root-wins).
- **[nit] "presence == running"** — keep, but phrased as "a sidecar carries
  this sessionId," not "process alive"; no `ps`/subprocess (AC9).
- **[nit] AC6 `'HEAD'`→null is defensive, not verified** — across 406 samples
  `gitBranch` was always a real name; keep the guard, don't record it as
  verified.
- **[nit] enumerate `*.jsonl` only** — folded into AC4 (dirs may hold a
  `memory/` subdir).
- **[build note] XSS already handled** — reuse `public/index.html`'s `esc()`
  (do not interpolate a raw title).

### Deviation log

Written by the implementer at the end of the implementation pass (2026-08-04).

- **Bounded body read implemented as synchronous chunked `fs.readSync`, not
  `node:readline`.** AC7 names `node:readline` as an allowed option
  ("line stream ... core `node:fs`/`node:readline` only"). `node:readline`'s
  stream/event API is asynchronous, and the entire scan pipeline
  (`scanProject`/`scanAll`/`server.mjs`) is synchronous end-to-end — every
  other reader in `scan.mjs` uses `fs.readFileSync`. Introducing one async
  reader would either force `scanAll` async (a pipeline-wide change out of
  this slice's scope) or require a sync-over-async shim. Instead
  `readLinesSync` chunks the file with `fs.openSync`/`fs.readSync` (64KB
  buffer) and yields complete `\n`-delimited lines from a `Buffer` accumulator
  (never a partial multi-byte UTF-8 decode), closing the fd when done. This
  satisfies the actual requirement — bounded memory, never loading a whole
  multi-MB transcript at once — via a synchronous streamed scan instead of
  `readline`'s async one. Test coverage: `AC9: reading the store writes
  nothing under it` exercises the reader end-to-end; correctness of chunk
  boundaries wasn't separately fuzzed (all fixture transcripts are single-
  chunk in practice) — a residual risk worth a follow-up fixture with a
  transcript > 64KB with a multi-byte character straddling a chunk boundary,
  if this ever needs hardening.
- **Post-review: two regression-guard tests added (2026-08-04)** — both
  independent reviewer passes flagged the same class of gap: a correct
  implementation with no test that would fail if it regressed.
  (1) **AC4 sibling-prefix non-capture** was previously only tested with both
  the short root and its sibling configured, so longest-root-wins rescued
  correct attribution even if segment-anchoring regressed to a bare
  `dirSlug.startsWith(slug)` — the old assertion would still have passed
  under that regression. Added `attributeSessionDir: sibling directory is
  dropped when only the shorter root is configured` (unit, in
  `test/lib.test.mjs`) and its integration counterpart in
  `test/sessions.test.mjs`, each configuring ONLY the short root so there is
  no longer-root candidate available to rescue a regression. Verified red
  against a hand-regressed bare-`startsWith` matcher (temporarily edited,
  confirmed red, then reverted — never committed in the regressed state) and
  green against the real code.
  (2) **AC6 `gitBranch: 'HEAD'` → `null`** had no fixture exercising it. Added
  an isolated fixture project (`-fixture-branch-proj` /
  `/fixture/branch-proj`, session `sess-head-branch`, whose last `gitBranch`
  is `"HEAD"` after an earlier real branch value) and a matching test in
  `test/sessions.test.mjs`. Verified red against a hand-regressed
  `acc.lastGitBranch || null` (no HEAD guard) and green against the real
  code. Suite grew 145 → 148 tests, still fully green; no production code was
  changed.
- **Session attribution computed once in `scanAll`, not inside `scanProject`.**
  AC4's "longest root wins when two configured roots both match" tie-break
  needs visibility into every configured project's root at once;
  `scanProject(projectCfg)` only ever sees one project and has no such
  visibility, and its call signature is exercised directly by ~15 existing
  tests across 4 files that pass a single project object. Rather than thread
  a second `allRoots` parameter through `scanProject` (touching those call
  sites), `readAllSessions(projects, opts)` is a new batch function called
  once from `scanAll`, and its per-project `sessions`/`sessionsTotal`
  (+ `warnings` on a store-read failure) are merged into each project result
  after the fact. Consequence: calling `scanProject` directly (as the
  existing test suite does) does **not** attach `sessions`/`sessionsTotal` —
  only `scanAll`'s output (the actual `/api/data` JSON contract, AC6) does.
  This was a deliberate choice to keep the blast radius to `scanAll` + new
  code, and is covered by a dedicated test (`AC6 (JSON contract via
  scanAll)`).
- **Phase-1 ("first cut") worktree extraction from a store directory slug
  takes the whole remainder after the `--claude-worktrees-` prefix, not a
  split on the next dash.** A slug collapses every path separator (and every
  other non-alphanumeric character) to `-`, so a literal dash inside a real
  worktree folder name is indistinguishable, from the slug alone, from a
  path-separator dash introduced by deeper nesting. AC4/AC7's own resolution
  text acknowledges this is a body-free approximation ("first cut"),
  correctly refined once the emitted, capped set's transcript body is read
  (`worktreeFromCwd`, which uses the real, unambiguous `cwd` path). Taking the
  whole remainder is correct for the common case (session launched at the
  worktree root, matching the codebase's own worktree convention) and is
  never load-bearing beyond that first cut — every emitted session's
  worktree is refined by the real `cwd` in phase 2 when a body is present.
  Test coverage: the fixture worktree session's launch directory is nested
  three levels below the worktree root
  (`.claude/worktrees/feature-x/.claude/skills/interactive`); the phase-2
  test asserts the *refined* value (`feature-x`), which is what the emitted
  JSON actually carries — the phase-1 approximation's intermediate value is
  exercised only implicitly (it must not throw or crash attribution) and
  isn't asserted on directly, since it's overwritten before emission.
- **`gitBranch` resolution tracks the true *last* occurrence (any value),
  then maps `HEAD`/absent to `null` once at the end** — not "the last
  *non-HEAD* value ever seen." A session that goes into a detached-HEAD
  state near its most recent activity should read as `branch: null`, not
  fall back to a stale earlier branch name. This reading of AC6/AC7 ("last
  gitBranch... null when absent/HEAD") is the literal one but worth flagging
  since an alternative implementation (last *valid* value) was also
  plausible.
  Directly unit-tested (`foldTranscriptLine: gitBranch — last value wins...`).
- **Client-side rendering (AC8) duplicates a small `relativeTime` helper in
  `public/index.html`'s inline script rather than importing
  `src/lib.mjs`.** The page's `<script>` is not an ES module and
  `server.mjs` serves no static route for `src/`, so importing isn't
  possible without a bigger, out-of-scope change to the serving/bundling
  setup. This mirrors the existing pattern in the same file (`esc`,
  `shorten`, `gitLine` are all small helpers reimplemented client-side, not
  imported). Not unit-tested — `public/index.html`'s inline script has no
  existing test harness in this codebase (002/other slices don't test it
  either); verified instead by a Node `new Function()` syntax check and
  manual review that `sessions`/`sessionsTotal` absence degrades to an
  omitted section (AC8's graceful-degradation requirement), never a throw.
- **The Sessions section was added to the `error` (missing local path)
  card branch was left out** — only the jig-managed and not-jig-managed
  branches render it. `scanAll` still attaches `sessions`/`sessionsTotal`
  uniformly to every project result including the error case (so the data
  contract, AC6, is uniform), but the error card's markup wasn't extended
  since a project whose configured local path doesn't exist is an edge case
  the existing card design doesn't allocate space for; sessions data for
  such an entry is rendered as "no card section" rather than added UI. Flagged
  here rather than silently decided.
- **Pure helpers (`encodeCwdSlug`, `worktreeFromCwd`/`worktreeFromSlug`,
  `attributeSessionDir`, `foldTranscriptLine`, `resolveSessionTitle`,
  `compareSessionOrder`, `relativeTime`) were written together with their
  unit tests rather than strictly test-first**, unlike the impure
  `readAllSessions` integration layer (built genuinely test-first against
  the `test/fixtures/session-store/` fixture — the 9 integration tests in
  `test/sessions.test.mjs` were committed to disk and confirmed red
  (`readAllSessions` not yet exported) before the reader was implemented).
  Given the effort budget, the pure-helper layer was developed test-alongside
  as a documented, deliberate deviation from strict red-first TDD for that
  layer only.

### Reconciliation sweep

Drift-prone surfaces checked at reconciliation (2026-08-04):

- **`docs/architecture.md`** — *updated.* Added the named read-boundary
  extension to the `src/scan.mjs` module bullet (the scanner's first read
  outside a configured project root: the global `~/.claude` session store,
  read-only, lenient, attribution + emit batched in `readAllSessions`), and a
  Data-model entry for `~/.claude/sessions/*.json` + `~/.claude/projects/…` as
  a read-only input.
- **`## Contract surfaces` → `GET /api/data`** — *no-op.* Already states
  "additive evolution preferred (the page degrades gracefully on missing
  fields, per spec 003's plan)"; the new additive `sessions`/`sessionsTotal`
  fields fall under that existing policy — no schema artifact required.
- **ADR trigger** — *no-op.* The data-source decision (snapshot-from-disk,
  read-only; rejected: a live session client, a `gh` subprocess, the app's
  archived flag) is already recorded with its rejected alternatives in spec
  003's `## Overview` and cites ADR-0001; architecture.md now documents the
  boundary. No separate ADR minted — the decision is recorded and traceable
  (engineering-practices check accepts "spec rationale").
- **`docs/conventions.md`** — *no-op.* No new authoring/coding rule introduced.
- **CLAUDE.md primer** — *deferred to close-out.* Spec 003 is not fully DONE
  (003-02 still DRAFT, 003-03 DEFERRED), so the primer's active-spec section
  stays; it is refreshed when the spec closes.
- **`docs/inbox.md`** — *updated.* Parked three non-blocking follow-ups: the
  session-row title-wrap CSS polish (→ 003-02), the >64KB multi-byte
  chunk-boundary fixture for `readLinesSync`, and realpath-canonicalizing the
  configured path before slugging for attribution (symlinked-config edge).
- **`docs/specs/README.md` status board** — *deferred to close-out.*
  Regenerated by `workflow.py status-board` after the `DONE` transition, which
  flips the 003-01 row from its pickup state — same close-out timing as the
  CLAUDE.md primer.
- **Memory** — *updated.* New on-disk findings persisted via memory-sync (the
  sidecar `name`/`nameSource` field; the ~8% `slug ≠ encode(cwd)` reality that
  drove the two-phase design; 003-01 landed).
