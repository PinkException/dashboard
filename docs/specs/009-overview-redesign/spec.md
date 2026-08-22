---
status: DRAFT
skill:
use_cases: [UC-1, UC-2, UC-3, UC-4, UC-5]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 009: Overview redesign

> Turn the overview from a **report** (every card prints everything it knows, at
> uniform weight, in wildly unequal heights) into a **triage surface** (a
> uniform grid where each project shows one next action and who it is waiting on,
> ordered finish-first, with everything else one click away in a per-project
> detail view). Implements the information architecture fixed by
> [ADR-0006](../../decisions/adr-0006-overview-triage-surface.md) and the card
> taxonomy the ADR delegated to this spec, pinned by Claude Design's mockups
> ([v1.2](../../design/overview/overview-v1.2.md)).

## Overview

The overview page ([`public/index.html`](../../../public/index.html)) renders
every project as a variable-height card that prints its full spec list, session
list, workstreams, warnings, and the narrative "what's next" in one dense
monospace layer at uniform visual weight. A design review over a live screenshot
(2026-08-06, recorded in
[docs/design/overview-redesign-analysis.md](../../design/overview-redesign-analysis.md))
found this reads as a report, not a dashboard: cards have wildly unequal heights
(a busy project renders many times taller than an empty one), the highest-value
line on the page ("blocked — waiting on owner decision") sits buried at the
bottom of the tallest column styled like everything else, and answering the core
question requires reading each card top to bottom instead of glancing.

The question a multi-project owner actually asks the overview is not "what is the
full status of everything?" but **"which project needs me, and for what?"** —
a triage question. [ADR-0006](../../decisions/adr-0006-overview-triage-surface.md)
(Accepted 2026-08-06) fixes the answer as a two-layer information architecture:

1. **Glance layer** — a uniform, fixed-size card per project carrying only what
   answers the triage question.
2. **Detail layer** — a per-project view, reached by clicking a card, holding
   everything the card no longer shows. Nothing is lost; it moves one click away.

This spec builds that architecture. It is **read-only presentation over the
existing scan payload** — `scanAll` / `scanProject`
([`src/scan.mjs`](../../../src/scan.mjs)) already emit the specs, slices,
workstreams, sessions, compass narrative, and warnings each card needs; the
redesign changes how they are shown and adds one derived signal, not what is
scanned.

### The card taxonomy — from ADR's "needs you count" to the four-state model

ADR-0006 fixed the *principle* of the glance layer's triage signal — it is
**intent-scoped** (counts only markers that encode *the owner* is blocked),
**activity-excluded** (generic counts like total open bugs or any deferred slice
are deliberately not counted, because they are near-ubiquitous and would saturate
the badge), **sparse-by-design** ("nothing needs you" is a valid, common state,
not a failure), and **owner-override backstopped** (a home-folder marker the
owner can set, because on-disk recall is structurally limited). The ADR
explicitly delegated *the exact marker set and its validation* to this spec, and
named Claude Design's mockups the authority for the card's shape (ADR-0006 §
"Recommended Decision", "Open questions").

Claude Design's mockup evolved the ADR's binary "needs you" count into a
concrete **four-state _waiting-on_ model** — one next-action state per project
([overview-v1.2.md](../../design/overview/overview-v1.2.md)):

- **You** — a decision, review, or merge is blocked on the owner. Strongest
  emphasis (it is the whole reason to look). Labelled on the row by its **action
  verb** — **DECIDE / REVIEW / MERGE** — not the umbrella word "You"
  (v1.2 revision 2026-08-07). This *is* the ADR's intent-scoped "needs you".
- **Ready** — the next work item is launchable now (Claude can run it). Marked,
  but calmer than You. The "I have ten minutes, where can I start" signal.
- **External** — waiting on someone else (e.g. a PR out for a teammate's
  review). Present but recessive — not the owner's move.
- **Idle** — genuinely nothing open (finished or shipped). Quietest state.

This is a **refinement of the ADR's principle, not a contradiction of it**: the
*You* state is exactly the ADR's intent-scoped "owner is blocked" signal, and the
model generalises "who is blocked?" to "who is this waiting on?" — which is what
the ADR's Open question ("does a review-ready slice count as owner-blocking or
Claude-blocking?") asked this spec to settle. The `Ready` / `External` / `Idle`
states carry no owner-blocking claim, so they cannot saturate the You signal;
activity volume is surfaced *separately* as a non-triage "in flight" heat figure
(below), never as a waiting-on state — honouring the ADR's activity-excluded
rule.

Each project resolves to **exactly one** waiting-on state (the most
finish-advanced open action), and the grid is ordered **finish-first**: land →
merge → review → finish/unblock → start-new, with Idle last. Nearly-finished
work that is stuck one step from done must never sit below a shiny new start.

### Current state (verified 2026-08-22)

Probed this repo directly:

- **All rendering is client-side.** `src/server.mjs` serves the static
  [`public/index.html`](../../../public/index.html) plus a `/api/data` JSON
  payload; the page's `load()` sets `#grid.innerHTML = data.projects.map(card)`
  (`public/index.html:244–252`), and `card(p)` (`public/index.html:195`) builds
  each card's HTML from the payload. The card layer this spec reshapes is
  `public/index.html`; the data layer is untouched. (258 lines; zero-dep, single
  self-contained page.)
- **The payload already carries what the glance + detail need.**
  `scanProject` (`src/scan.mjs:391`) returns per project: `specs` (each with
  `slices: [{ file, status, dependencies, lastVerified }]`), `progress`,
  `sliceProgress`, workstreams (via `scanWorkstreams`, including the release
  `goalProgress`/`goalNext` added by spec 008), `counts` (`bugs {open,total}`,
  `refinement`, `inbox`, `adrs`), `worktreeOnlyDocs`, `compass`
  (`{ headline, next, blockers?, ageLabel, ageDays, stale }`), and `warnings`;
  sessions come from `readAllSessions` (capped at `SESSION_CAP = 20`, "active"
  iff running or within `SESSION_ACTIVE_DAYS = 7`).
- **The two intent-bearing inputs for the You state already exist.**
  `ownerOf(text)` (`src/lib.mjs:69`) matches the bold `**(you)**` / `**(Claude)**`
  tag convention and returns `you`/`claude`; `validateSnapshot`
  (`src/lib.mjs:235`) treats compass `blockers` as an optional array, so a
  project's latest compass entry may carry `blockers`. These are the sparse
  intent markers ADR-0006 names.
- **`gh` is invoked nowhere; `git` already is.** No `src/` file references `gh`
  (grep, this turn); `gitInfo` / repo-root detection shell out to `git` via
  `execFileSync('git', …)` (`src/scan.mjs:87, 258`). So PR enrichment via `gh`
  is genuinely new work, of the same category ADR-0006 approved (a shelled-out
  binary, not a bundled dependency).
- **`scanBugs` returns `{open, total}` only** (`src/scan.mjs:242`) — no
  ESCALATED field. Any use of ESCALATED in the taxonomy is new derivation, not a
  field already emitted (ADR-0006 Assumptions).

## Assumptions

Load-bearing, unverified-across-the-real-project-set claims. The derivation
slice (009-02) and the enrichment slice (009-04) carry the risk; 009-01 and
009-03 are presentation over grounded fields.

- **A1 — the pinned taxonomy discriminates and recalls (009-02).** The mockup's
  candidate marker set (You/DECIDE from `**(you)**`-tagged next steps and compass
  `blockers`; You/REVIEW from review-ready/reviewed slices; You/MERGE from
  land-ready work and — when `gh` is present — approved PRs; Ready from a
  launchable next slice; External from PRs out for others; Idle from no open
  work) is **assumed** to (a) *discriminate* — light the You state on a minority
  of cards, not most — and (b) *recall* — not show Idle/Ready on a project where
  the owner truly is blocked. ADR-0006 Kill criteria make this two-sided
  validation the gate: **discrimination is disk-measurable** (does the state
  separate the real project set?) but **recall is not** — a project where the
  owner is blocked but nobody wrote the `**(you)**` tag or ran the narrative
  snapshot is, on disk, indistinguishable from one that needs nothing. Recall is
  therefore validated against **owner-provided ground truth**, and the derived
  signal is backstopped by an owner-settable marker (below). _Unverified until
  009-02 runs the discrimination probe + owner-ground-truth recall check; a
  disk-only re-grep would re-measure presence, not recall._
- **A2 — the owner-settable marker lives in home-folder config.** The backstop
  flag lives in `~/.claude/my-dashboard/config.json` (or a sibling under
  `~/.claude/my-dashboard/`), **never** in a surveyed repo (vision principles 1
  and 6; ADR-0004). It is an opt-in floor (vision principle 3), not a required
  ritual: the derived signal is the zero-config default. The exact config shape
  is 009-02's to design. _Config schema unverified — no `needs-you`/marker field
  exists in the config today (to be probed against `loadConfig`)._
- **A3 — the detail view fits the zero-dep single page.** ADR-0006's only
  split-killing criterion is the detail view needing a routing/client framework.
  It is **assumed** buildable as an in-page view/overlay in the existing
  self-contained `public/index.html` with no framework and no build step
  (ADR-0001). _Unverified until 009-01 builds it; if it cannot be done without a
  framework, reshape per ADR-0006 Kill criteria, do not add a dependency._
- **A4 — `gh` PR state maps cleanly onto the waiting-on states (009-04).**
  `gh pr list --json …` is **assumed** to yield, per repo, the PR fields needed
  to place a PR into You/MERGE (approved, ready to merge — owner's move) vs
  External (out for someone else's review). Exact JSON fields and the
  authenticated/absent detection are 009-04's to probe. _Unverified — `gh` is
  invoked nowhere today._

## Non-goals

- **Token usage counting.** ADR-0006 reserves a glance/detail slot for a
  token-cost signal but commits no field, because **no token-counting machinery
  exists in this repo** (verified: no token-analytics spec, no `src/` token
  code). This spec **reserves the slot only** — the detail view carries an empty
  "Activity" tab placeholder (mockup v1.2) so adding it later needs no layout
  redesign — and does **not** build token counting. That is its own later spec.
- **Business / Design / project-management tabs.** ADR-0006 and the analysis
  (§6) park these as future detail-view tabs. Out of scope here; the detail view
  only reserves that they *could* be added.
- **Dropping the current dense view.** ADR-0006 Open question leaves the fate of
  today's dense layout (keep as a secondary "console" mode vs delete) to be
  decided after the triage view is real and its coverage is known. This spec
  ships the triage overview as the default and does **not** decide that fate.
- **A routing/client framework.** The split stays within ADR-0001's zero-dep,
  single self-contained page (in-page detail view, inline-SVG charts).

## Decomposition

SPIDR — split on the **Interface** and **Path** axes. Every slice touches the
card / page (the user-facing layer) and delivers end-to-end value; none is
horizontal phasing.

- **Rejected — Spike first.** The taxonomy is *not* an open research question:
  Claude Design's mockup already pins a candidate four-state marker set, and
  ADR-0006 defines the exact fallback if it fails to discriminate/recall (drop
  the derived signal to the owner-settable marker; keep the grid). So the
  unknown is *validation of a named design*, which lives as an AC + a DoR gate
  inside 009-02 — not a standalone spike. (Resist the eager-spike default.)
- **Rejected — Interface split that ships uniform cards without the detail
  view.** Uniform fixed-size cards drop the full spec/session/workstream lists;
  without the detail view to catch them, that is data loss, and the parser-only
  half shows the user a regression, not value. So the minimal vertical unit is
  card **and** detail view together (009-01).
- **009-01 (Interface — minimal legible surface):** the glance/detail split.
  Uniform fixed-size cards in a real grid (name, description, status, one big
  progress number + inline-SVG trend mark, first "what's next" line,
  active-session count + last activity, an "in flight" heat figure) + an in-page
  per-project detail view holding everything the card dropped (full spec list,
  sessions, workstreams, full narrative + history, warnings, deferred/inbox
  counts, reserved empty "Activity" tab). **No triage derivation** — cards keep
  today's order. Delivers ADR-0006's legibility win, which the ADR says stands
  on its own regardless of the badge. Reads only fields already in the payload.
- **009-02 (Path — the triage signal):** derive each project's single
  **waiting-on state** (DECIDE / REVIEW / MERGE / Ready / External / Idle),
  intent-scoped per ADR-0006, render it as the card's headline with its named
  next-action text, order the grid **finish-first**, and add the owner-settable
  home-folder marker backstop. Carries the derivation risk (A1, A2) → validated
  two-sided (discrimination probe + owner-ground-truth recall) → `frame_review`.
- **009-03 (Interface — second view):** the cross-project **action-queue lens** —
  a flat list of every actionable item across all projects, grouped by pipeline
  stage (land → merge → review → finish → start), finish-first, reached by a
  toggle from the overview. Re-projects 009-02's per-item derivation
  cross-project.
- **009-04 (Path — optional enrichment):** **`gh`-optional PR state**. When `gh`
  is present and authenticated, fold PR state into the waiting-on states
  (You/MERGE for approved-ready, External for out-for-review) and the detail
  view; when absent, the overview behaves exactly as today — no error, no
  missing-feature noise. Un-defers and absorbs the placement of 003-03
  (pr-badges) per ADR-0006. Carries the `gh` assumption (A4) → `frame_review`.

## Slices

- [009-01 — uniform triage cards + project detail view (the split)](slice-01-uniform-cards-and-detail.md)
- [009-02 — waiting-on state + finish-first ordering (the triage signal)](slice-02-waiting-on-state-and-ordering.md)
- [009-03 — cross-project action-queue lens](slice-03-action-queue-lens.md)
- [009-04 — gh-optional PR enrichment (un-defers 003-03)](slice-04-gh-pr-enrichment.md)
