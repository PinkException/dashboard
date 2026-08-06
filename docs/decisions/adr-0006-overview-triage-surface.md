---
status: Proposed
dependencies: [adr-0001]
last_verified:
frame_review: true
---

# ADR-0006: Overview is a triage surface: glance/detail split, PR state via optional gh

## Status

Proposed (2026-08-06)

## Context

The dashboard's overview page renders every project as a card that prints
everything it knows — spec lists, session lists, workstreams, warnings, and
the narrative "what's next" — in one dense monospace layer at uniform visual
weight. A design review over a live screenshot (2026-08-06) found this reads
as a **report, not a dashboard**: cards have wildly unequal heights (a busy
project renders many times taller than an empty one), the highest-value line
on the whole page ("blocked — waiting on owner decision") sits buried at the
bottom of the tallest column styled like everything else, and answering the
core question requires reading each card top to bottom instead of glancing.

The core question a multi-project owner asks the overview is not "what is the
full status of everything?" but **"which project needs me, and for what?"** —
a triage question. The information to answer it already exists on the card; it
is drowned by everything else.

The project has already reached for the reveal-behind-a-click idea once, at a
smaller scale: spec 003-02 added a per-card "show older" toggle that hides
older sessions until asked. That treats the symptom (too much on the card) one
section at a time. This ADR generalizes it into a single rule for the whole
card — decide, once, **what belongs in the glance and what belongs behind a
click** — so the redesign spec and every card section built after it share
that rule instead of re-litigating placement per feature.

Two triage signals the owner wants are not yet sourceable on the card, and
each carries a dependency wrinkle this ADR must rule on:

- **PR state** (which PRs are open, need review, are approved, ready to
  merge). Not on disk; reading it needs a `gh` subprocess. Spec 003 already
  concluded this is "permitted by ADR-0001 but deferred" and parked it as the
  DEFERRED slice **003-03 (pr-badges)** — explicitly behind "the `gh`
  decision." This ADR is that decision.
- **Token usage.** A desired at-a-glance cost signal. **No token-counting
  machinery exists in this repo today** (verified: no token-analytics spec,
  no token code under `src/`). So token usage cannot be a settled card field
  here — only a reserved slot whose data source is a separate future spec.

## Decision Options Considered

### Option A: Keep the single-layer dense report (status quo)
- **Pros:** No work. Every datum is visible without a click. Already shipped.
- **Cons:** No triage — the owner reads five cards to find the one that needs
  them. Unequal card heights are structural (unequal content → unequal cards),
  not tunable away. The one action-demanding line has no more prominence than
  a spec count. Every new card section makes the glance worse.

### Option B: Uniform triage cards + click-through project detail view
- **Pros:** The glance layer answers "which project needs me" in ~5 seconds:
  fixed-size, number- and badge-forward cards showing status, coarse progress,
  a "needs you" blocker count, active-session count, and the first line of
  "what's next". Everything else — full spec/session lists, workstreams,
  narrative history, warnings, business/design/PM material — moves one click
  into a per-project detail view. Uniform cards make a real grid possible;
  unequal columns disappear because their cause does. A detail view gives
  future content (§ business/design tabs) a home without touching the glance.
- **Cons:** Two surfaces to build and keep coherent instead of one. A card no
  longer shows a datum without a click. Adds a detail-view navigation model to
  a page that is currently a single scroll.

### Option C: Two co-equal layouts — a "glance" mode and an "everything" mode
- **Pros:** Serves both the triage need and the audit-everything need as
  first-class views.
- **Cons:** Doubles the design surface — every future placement decision must
  be made twice, for both layouts, forever. Splits testing and maintenance.
  The "everything" mode is just the status quo, which the review found wanting.

## Recommended Decision

**Adopt Option B. The overview is a triage surface with two layers:**

1. **Glance layer — a uniform, fixed-size card per project.** It carries only
   what answers "which project needs me, and for what?": name + one-line
   description + status; a coarse progress signal (one big number, optionally
   a small trend mark); a **"needs you" blocker count** (owner decisions,
   pending reviews, PRs awaiting the owner); the first line of "what's next";
   an active-session count with last-activity time; and a **reserved slot for
   token usage** (see below). All cards are the same size.

2. **Detail layer — a per-project view reached by clicking a card.** It holds
   everything the card no longer shows: full spec list with per-spec state,
   individual sessions (branch, worktree, timestamps), workstreams and
   runbooks, the full "what's next" narrative and its history, worktree/doc
   warnings, deferred-decision and inbox counts, and — as its own later
   spec — Business / Design / project-management tabs. Nothing currently on
   the card is lost; it moves one click away.

**PR state is sourced via `gh` as an _optional enrichment_.** ADR-0001's
"zero runtime dependencies" governs **npm packages**; it already permits — and
the scanner already relies on — shelling out to an external binary (`git`) via
`node:child_process`. `gh` is the same category as `git`: a shelled-out
binary, not a bundled dependency. The one material difference is that `git` is
guaranteed present in a git project while `gh` is not. Therefore: **when `gh`
is present and authenticated, cards surface PR state as a triage signal; when
it is absent, the overview behaves exactly as it does today, with no error and
no missing-feature noise.** This preserves the `git clone && node server.mjs`
install promise for the base product and adds PR triage as a graceful bonus.
This decision **un-blocks 003-03 (pr-badges)** — with the placement updated:
PR state belongs in the glance layer's "needs you" signal, not (only) on
individual session rows as 003-03 originally scoped it.

**Token usage is a reserved glance slot, not a committed field.** Because no
counting machinery exists in this repo, this ADR only reserves its place in
the glance layer. *How* tokens are counted (correctly — resumed/forked
sessions must not be double-counted) is a separate spec and is **not** gated
by this ADR. The redesign can ship the triage card with the slot empty or
hidden until that spec lands.

**Charts stay zero-dep.** Any trend mark or sparkline is small inline SVG in
the existing self-contained page — no chart library (ADR-0001 holds).

Mockups of the card and detail view are **Claude Design's** deliverable, not
this repo's; the recorded analysis at
[docs/design/overview-redesign-analysis.md](../design/overview-redesign-analysis.md)
is their brief. This ADR fixes the information architecture the mockups and
the redesign spec build on.

## Consequences

**Becomes easier:**
- Answering "which project needs me?" at a glance, in seconds, without reading.
- A real uniform grid — the unequal-column problem is designed out.
- Adding future card sections: the glance/detail rule decides placement once.
- Landing PR triage without breaking the zero-install promise.
- Giving business/design/PM material a home (detail tabs) without crowding the
  glance.

**Becomes harder:**
- Seeing a specific buried datum: it may now require a click into the detail
  view.
- Maintenance: two surfaces (glance + detail) instead of one dense page.
- The redesign is spec-shaped work (uniform card → detail view → "needs you"
  badge → token slot → PR enrichment), not a CSS tweak.

## Assumptions

- `gh` is an external binary invoked via `node:child_process`, the same
  category as `git`, which ADR-0001 already permits and `src/scan.mjs` already
  shells out to. Verified by reading [ADR-0001](adr-0001-runtime-zero-deps.md)
  (zero-dep scope is npm packages; `node:child_process` and git shell-out are
  explicit) and spec 003, which states the `gh` subprocess is "permitted by
  ADR-0001 but deferred."
- No token-counting machinery exists in this repo. Verified: `docs/specs/`
  contains 001–007 only (no token-analytics spec) and no `src/` file
  references tokens. Token usage is therefore a reserved slot, deferred.
- 003-03 (pr-badges) is DEFERRED specifically behind "the `gh` decision."
  Verified in [docs/specs/003-sessions-panel/spec.md](../specs/003-sessions-panel/spec.md).

## Kill criteria

- If the triage signals ("needs you" blockers, active-session state, coarse
  progress) turn out not to be computable from the on-disk artifacts, the
  glance card cannot answer its question without a click and the split fails —
  the dense report would then be the honest design.
- If the detail view cannot be built without adding a routing/client
  framework, it collides with ADR-0001's single self-contained page; the split
  must then be reshaped (e.g. an in-page panel) rather than pursued as a route.

## Open questions

- The exact **"needs you" taxonomy** — which signals count as blocking the
  owner (owner decisions, review-ready slices, PR states, stale "what's next").
  Spec-level; the redesign spec pins it.
- **Fate of the current dense view** — kept as a secondary "console" mode or
  dropped once the triage overview ships. Decide after the triage view is real
  and its coverage is known; do not build two co-equal layouts (Option C).
- **Detail-view mechanics** — a separate in-page view vs a large overlay
  panel, within the zero-dep single-page constraint. Spec-level.
