---
status: DRAFT
skill:
use_cases: [UC-1, UC-3]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 011: Project-roadmap tab

> Give each project a **roadmap tab** in its detail view: the road ahead in
> order — current release, unfinished specs as slice cards, parked work with
> its "revisit when" trigger — in the shape of a hand-made roadmap page (owner-built, outside this repo)
> the owner liked. The order is **automatic by default** and **overridden by a
> saved order** that a new `/dashboard:end-of-day` skill proposes each evening.

**What changes:** a third tab (`overview | roadmap | activity`) in every
project's detail view; the scanner reads slice names, goals and resolution
triggers; the snapshot store can carry an optional roadmap block (order +
narrative extras); a new end-of-day skill writes that block for every project
touched today.

**Why it matters:** the overview answers "what's waiting on me"; nothing today
answers "what's the whole road for this project, in what order, and what did we
park and why". The owner currently gets that only by asking Claude to hand-build
an HTML page.

**Main tradeoff:** a saved order lives in the dashboard's snapshot store
(outside the repo, ADR-0004), so compass and jig don't see it. Accepted by the
owner (2026-11-14) in exchange for zero repo edits and a working default with no
setup.

## Overview

### Owner decisions (brainstorm, 2026-11-14)

1. **Placement:** a new `roadmap` tab in the per-project detail view — not a new
   page, not a replacement for the overview tab. A cross-project roadmap lens is
   a later idea.
2. **Scope:** all unfinished specs; DONE specs folded under "show N done"
   (the native `<details>` pattern spec 003-02 uses for older sessions).
3. **Order, two layers:** (a) an automatic order derived from artifacts; (b) a
   saved order from the snapshot store, used when present.
4. **Narrative extras** (the reference page's "layers", "the rule tying them together",
   "decisions locked in", named groups like "Core") render **only** when a
   snapshot provides them. The scanner and page stay LLM-free (vision
   principle 2).
5. **Skills:** `/dashboard:snapshot` is extended to also write the roadmap
   block for one project; a new `/dashboard:end-of-day` runs it on every
   project touched today, one subagent per project.
6. **Who orders:** the skill **proposes and saves** the order; the owner only
   corrects it.

### Current state (verified 2026-11-14)

- `scanSpecs` emits `slices: [{ file, status, dependencies, lastVerified }]` —
  status and dependencies are read, **slice name, goal and resolution trigger
  are not** (`src/scan.mjs:245-256`).
- The detail view has a tab bar with `overview` (active) and a disabled
  `activity` placeholder (`public/render.mjs:537-538`).
- The detail view already picks a "current release" — the release workstream
  whose `goalProgress` is incomplete (`public/render.mjs:139-150`); spec 008's
  `resolveReleaseGoal` provides the plan's Include slice set.
- The snapshot card reader already prefers the latest **narrative**
  (non-`auto`) entry (`src/lib.mjs:170-201`, `src/scan.mjs:394-402`).
- `scripts/snapshot.mjs` writes one JSONL entry per call with `headline`,
  `next`, `blockers`, `ts`, `source` (`scripts/snapshot.mjs:4-20,105-120`).
- jig slice files carry a `## Slice NNN-NN — <name>` heading and a `**Goal:**`
  line by template; DEFERRED slices carry a `**Resolution trigger:**` line by
  convention (spec-workflow SKILL.md; example
  `docs/specs/003-sessions-panel/slice-03-pr-badges.md:26`).

### Automatic order (layer 1)

Specs, top to bottom:

1. Specs with any slice in the **current release's** Include set.
2. Then by most-advanced slice status, finish-first:
   RECONCILED > REVIEWED > IN_PROGRESS > READY_FOR_IMPLEMENTATION >
   READY_FOR_REVIEW > DRAFT (same finish-first spirit as `deriveWaitingStages`,
   spec 009).
3. Ties by spec number, ascending.

Slices inside a spec: dependency order (a slice after the in-spec slices it
depends on), ties by slice number; a dependency cycle falls back to slice
number. DEFERRED slices go to the **Parked** section; ABANDONED slices are not
shown. A spec whose every non-DONE slice is DEFERRED sits in Parked.

### Status chips

| Chip | Slice statuses |
|---|---|
| Done | DONE |
| In progress | IN_PROGRESS, REVIEWED, RECONCILED |
| Planned | DRAFT, READY_FOR_REVIEW, READY_FOR_IMPLEMENTATION |
| Parked | DEFERRED |

## Assumptions

- **A1 — slice headings/goals are present enough to be useful.** Template
  slices have `## Slice … — name` and `**Goal:**`; legacy or hand-made slices
  may not. Mitigation: fall back to the slice filename; never fail the scan.
  Not yet measured across the surveyed projects.
- **A2 — `**Resolution trigger:**` is a convention, not enforced.** A DEFERRED
  slice without it renders with no trigger line (honest absence, not a guess).
- **A3 — snapshot readers tolerate an extra `roadmap` field.** The reader
  parses each JSONL line as an object and keeps it (`src/lib.mjs:178-193`);
  not yet verified that no consumer (migrate, `--if-changed` signature) chokes
  on a large nested field. Slice 03 probes this first.
- **A4 — a skill can list "projects touched today".** The sessions reader
  (spec 003) runs inside the server scan; whether it is callable from a
  skill/CLI entry point without the server is unverified. Slice 04 probes this
  first; fallback is the projects whose snapshot or git activity changed today.

## Decomposition

SPIDR analysis:

- **Data** — split the data the tab needs: slice names/goals/triggers
  (deterministic, scanned) before the snapshot-sourced order and extras.
- **Rules** — automatic order (simple, always works) before the saved-order
  override (an edge layer on top).
- **Interface** — the tab first; the skills that feed it after.
- **Paths** — no-snapshot path first (every plugin user has it); snapshot path
  after.
- **Spike** — not needed: A3/A4 are probe-first checks inside their slices.

Each slice ends in something the owner can see in the dashboard or run.

## Slices

- [011-01 — roadmap tab with automatic order](slice-01-roadmap-tab-automatic-order.md)
- [011-02 — parked section and slice goals](slice-02-parked-and-goals.md)
- [011-03 — saved order and narrative extras from snapshots](slice-03-snapshot-roadmap-block.md)
- [011-04 — end-of-day skill](slice-04-end-of-day-skill.md)
