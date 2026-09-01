# Plan — spec 009 (overview redesign)

Living plan; slice 009-01 is in progress. Updated per slice.

## 009-01 — uniform triage rows + project detail view

**Shape of the change.** Mostly presentation, plus **three small additive backend
emissions** the frame critique found the redline needs (none is a triage signal):
1. **Description subtitle** — new optional `description` field in the project
   config, surfaced through `scanProject`; absent → omitted, no error.
2. **Workstream next 1–3 items** — widen `parseRunbook` (`src/lib.mjs`) to return
   the item-text list it already computes at `src/lib.mjs:113` (today it returns
   only `{done,total}` + a single `next`).
3. **Current-release-track membership** — widen `resolveReleaseGoal`
   (`src/lib.mjs:569`) to expose the member spec IDs `parseIncludeTokens` already
   finds, plus a **current-track** determination (probe shaper for an explicit
   marker; fallback = the release plan whose `goalProgress` is incomplete, first
   in file order; none determinable → detail shows the full spec list). Used to
   default the detail spec list to the current track with "show all N".

`src/server.mjs` stays untouched. The rest of the work is the client render
inlined in [`public/index.html`](../../../public/index.html), whose `card(p)`
dumps every field per project into a variable-height card — replaced by the row
table + detail view.

**Target (design authority):** the measured redline cascade at
`docs/designs/dashboard-v1.2/redlines/` — `base.md` (tokens), `console-overview`
(the uniform-row table), `console-detail` (the per-project view). Match its
`proj-grid` columns, `row-min-h`, colour/type/spacing tokens.

**Two surfaces to build (both in the one self-contained page):**
1. **Overview table** — one uniform-height row per project on the `proj-grid`
   columns: project (name · description · status chip) · next-move (compass
   "what's next" first line, **no** state badge) · in-flight heat figure ·
   progress (% + inline-SVG bar) · activity (active count + last activity).
   Header may carry existing-data totals (e.g. `RUNNING NOW`), not derived-state
   totals. Current project order; no reorder.
2. **Detail view** — hidden by default, shown when a row is clicked (in-page
   show/hide, no route/framework). Holds everything the row drops: header +
   full "what's next" + counts strip + spec list (default current release track,
   "show all N") + workstreams with next-unchecked items + full sessions list
   (existing older-toggle) + worktree warning + a disabled "activity" tab
   placeholder.

**Testability decision (the one non-obvious call).** The render is browser JS and
the project is zero-dep (no jsdom). To keep it TDD-able under `node:test`,
**extract the pure render helpers** — functions that take the project payload and
return HTML strings (row builder, detail builder, the in-flight/heat derivation,
the current-track spec filter) — into a browser-and-node shared ES module (e.g.
`public/render.mjs` served statically and imported by `index.html` via
`<script type="module">`, and imported directly by `test/*.mjs`). Tests assert on
the returned HTML strings / derived values (DOM-shape assertions), not a live DOM.
The interaction glue (click → toggle detail) stays in `index.html` and is covered
by a thin state-function test, not a browser driver.

**In-flight heat derivation** (client-side, from existing fields): open fronts =
in-progress specs + active sessions + worktree-only docs; buckets to
clear/light/busy/hot per the redline's treatment. Pure function → unit-tested.

**Order of work:** (1) extract/curate the shared render module + a red test per
AC; (2) build the row table + header to green; (3) build the detail view + the
click-to-open state to green; (4) wire tokens/layout to the redline; (5) design-
review pass (screenshot vs `console-overview`/`console-detail` render); (6)
compliance + craft review; (7) reconcile → DONE.

**Guardrails:** no new npm dependency (ADR-0001); charts are inline SVG; no
derived waiting-on state / reorder / header state-counts / action-queue toggle
(those are 009-02 / 009-03); full existing suite stays green.

## 009-03 — cross-project action-queue lens

**Shape of the change.** A single-source refactor on the scan side plus a new
pure render lens and a thin toggle in the page glue. No new data is scanned; the
one existing derived signal is widened from its collapsed head to the full list.

**Scan side (`src/lib.mjs` + `src/scan.mjs`).**
1. Extract the candidate-collection inside `deriveWaitingOn` (`src/lib.mjs:718`)
   into **`deriveWaitingStages(project, marker)`** → returns the rank-ordered
   `[{state, verb, action, rank}, …]` of the project's present **non-Idle**
   stages. The forced-marker path returns a single-element list (the forced
   You-state). The derived path collects every present candidate (MERGE, REVIEW,
   DECIDE, Ready-resume, Ready-start) instead of returning on the first match;
   External stays unreachable pre-009-04; Idle yields `[]`.
2. Re-express **`deriveWaitingOn`** as `deriveWaitingStages(…)[0] ?? IDLE` where
   `IDLE = {state:'Idle', verb:'IDLE', action:'', rank:7}`. Behaviour must be
   **byte-identical** to today for every 009-02 fixture — a regression test pins
   this (DoD).
3. `scanProject` (`src/scan.mjs:451`) emits **`result.waitingStages`** alongside
   the unchanged `result.waitingOn`.

**Render side (`public/render.mjs`, pure, node:test-imported).**
- **`actionQueue(projects, { capPerProject = 3 } = {})`** — flattens each
  project's `waitingStages` (capped to its top `capPerProject`, finish-first)
  into rows `{project, name, path, state, verb, action, rank}`, drops Idle/empty
  projects, and returns them grouped by the pinned stage map, groups ordered by
  rank, stable within a group. This is the one function the tests hammer for
  AC2/AC3/AC4/AC5.
- **`actionQueueRow(row)`** / **`actionQueueGroup(group)`** — HTML-string
  builders mirroring `overviewRow`'s shell discipline (uniform row shape).
- Extend the toggle-state helpers next to `OVERVIEW_STATE`: add a `lens`
  dimension (`'overview' | 'queue'`) with pure `setLens(state, lens)` so the
  page glue stays a thin dispatcher (AC1). Keep `view`/`path`/`showAll` intact —
  detail view still works from either lens's project rows if surfaced, but the
  queue's rows link to the same `openDetail(path)`.

**Page glue (`public/index.html`).** Add a lens toggle control in the
`summary-band` (overview ⇄ action queue). `render()` branches on `state.lens`:
`queue` → `R.actionQueueHtml(projects)` (a thin wrapper composing the groups
under a `sheet`), else the existing `overviewHtml()`. A queue row click reuses
the existing `openDetail` path dispatch. One thin state-function test covers the
lens flip; no browser driver.

**Consistency guarantee (AC5).** Because `waitingOn === waitingStages[0]` by
construction, a regression test builds a multi-stage fixture and asserts, per
project, that `deriveWaitingOn(p).state === actionQueue([p]) first row state`.

**Order of work:** (1) extract `deriveWaitingStages` + the no-regression test for
`deriveWaitingOn` (red→green); (2) emit `waitingStages` from `scanProject`;
(3) `actionQueue` pure builder + AC2–AC5 tests (red→green); (4) row/group HTML
builders + lens toggle state; (5) wire the page glue + toggle control; (6)
compliance + craft review; (7) reconcile → DONE.

**Guardrails:** no new npm dependency (ADR-0001); the grid/detail behaviour of
009-01/009-02 is unchanged (byte-identical `deriveWaitingOn`); `public/render.mjs`
never imports `src/lib.mjs` (scan-side derivation only, read the emitted field);
full existing suite stays green.
