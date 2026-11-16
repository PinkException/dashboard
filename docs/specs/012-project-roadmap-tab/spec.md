---
status: IN_PROGRESS
skill:
use_cases: [UC-1, UC-3]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 012: Project-roadmap tab

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
7. **Main only, labelled (2026-11-16, after the 012-01 frame-critique round
   2):** the roadmap reads the configured root (normally the main checkout)
   and says so — "as of main" — plus a hint counting slices that are further
   along, or only exist, in the project's worktrees. Reading worktree
   *statuses* into the order was considered and declined for now (bigger
   scanner change; abandoned worktrees would need filtering). See A6.

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
  convention (jig spec-workflow SKILL.md, "DEFERRED state"; jig's own
  extractor matches the exact single-line label, `workflow.py`
  `**Resolution trigger:**` regex). Measured in probe P3 (A1/A2).

### Automatic order (layer 1)

Revised 2026-11-16 after the 012-01 frame-critique and probe P1 (see A5).

**Definitions.**
- A **slice** is a `slice-*.md` file whose frontmatter has a `status:`. A
  `slice-*.md` without one (e.g. a device-test evidence note) is not a slice
  for the roadmap: no card, no effect on order (P1 found these in 2 of 7
  projects, where they made a finished spec look unfinished). Legacy slices
  that carry status only as a prose `**STATUS:**` line are equally invisible —
  the same as every existing dashboard count today.
- A spec is **unfinished** when at least one of its slices is not DONE,
  DEFERRED or ABANDONED — judged from slice statuses, not the spec's
  frontmatter. A spec with no slices yet is unfinished unless its own status
  is DONE or ABANDONED.
- A spec's **tier**: **in flight** (any slice IN_PROGRESS / REVIEWED /
  RECONCILED) > **started** (any slice DONE or READY_FOR_*) > **not started**
  (only DRAFT slices, or no slices).

Specs, top to bottom:

1. Specs with any slice in the **current release's** Include set (current
   release = today's `currentReleaseTrack` rule, moved scanner-side — see
   012-01 AC3).
2. Then by tier, in flight first.
3. Then by **recency**: the newest git commit touching the spec's directory
   (commit timestamp, not day); when git is unavailable, the newest file
   mtime in the directory.
4. Ties by spec number, ascending.

Slices inside a spec: dependency order (a slice after the slices **of the same
spec** it depends on; cross-spec IDs and `adr-*` tokens do not affect order
but are still shown as "Depends on"), ties by slice number; a dependency cycle
falls back to slice number. DEFERRED slices go to the **Parked** section;
ABANDONED slices are not shown. A spec whose every other slice is DONE (a
"deferred tail") is finished: it folds under "show N done", and its DEFERRED
slices still appear in Parked (P3 found 16 such specs).

**"We are here".** The first sequence step carries "We are here" only when it
is a current release or a spec in the in-flight or started tier. Otherwise
the step is labelled "Next up" — the tab never claims a position the
artifacts don't show.

### Status chips

| Chip | Slice statuses |
|---|---|
| Done | DONE |
| In progress | IN_PROGRESS, REVIEWED, RECONCILED |
| Planned | DRAFT, READY_FOR_REVIEW, READY_FOR_IMPLEMENTATION |
| Parked | DEFERRED |

## Assumptions

- **A5 — the automatic order puts the real next work first.** Probed
  2026-11-16 (P1): the original rules (status rank → spec number) and the
  revised rules (tier → recency → number) were run over the 8 configured
  projects with the real scanner (one had no unfinished spec). Results,
  anonymized:
  - Against the owner's hand-made reference roadmap (project B): original
    rules put an old, side-lined spec first and the actual "Now" spec 4th;
    revised rules put the actual "Now" spec 1st. The reference's "Then"
    spec came 3rd behind another started spec — an owner priority no
    artifact records, which is what the saved order (012-03) is for.
  - Project A (has a release plan): unchanged top spec (the in-flight one).
  - Project C (two in-flight specs): unchanged top two.
  - Projects D–G: revised order differs only in tie-breaks among drafts,
    now newest-first instead of oldest-first.
  - **Kill criterion:** if, after 012-01 ships, the owner reports the
    automatic "Now" step wrong on most projects, drop the "We are here"
    marker entirely and label every first step "Next up".
  - **Known residuals (frame-critique round 5):** a release whose Include
    names a never-written slice stays "current" indefinitely (shared with the
    overview's default track, A-009-01); the "started" tier counts
    READY_FOR_* slices, so an approved-but-unbegun spec can read "We are
    here". Both fall under the kill criterion above.
- **A6 — "as of main" is an acceptable view.** The scanner reads only
  `<root>/docs/specs` (`src/scan.mjs:231-259`); worktree awareness today is
  path-existence only (`src/scan.mjs:358-378`). Probe P2 (2026-11-16) over the
  8 configured projects: 7 have worktrees whose slice files differ from the
  root — up to 20 slices with a *different* status (direction not measured;
  stale worktrees can hold older statuses) and up to 58 slices that
  exist only in worktrees per project (some may be stale). So the automatic order may lag
  the owner's live work. Accepted by the owner (decision 7) with an honest
  label and a worktree hint; the saved order (012-03) can encode live
  priorities. Reading worktree slice frontmatter for the hint (012-01 AC10)
  widens 002-02 AC4's path-only worktree rule on purpose. **Kill criterion:** if the owner finds the lag makes the tab
  misleading in practice, open a follow-up slice that folds worktree slice
  statuses into tier/recency (ignoring worktrees idle 14+ days).
  Residual: "main" means the **local** root checkout; if it lags
  origin/main, worktrees branched from the newer origin inflate the hint.

- **A1 — slice headings/goals are present enough to be useful.** Template
  slices have `## Slice … — name` and `**Goal:**`; legacy or hand-made slices
  may not. Mitigation: fall back to the slice filename; never fail the scan.
- **A2 — `**Resolution trigger:**` is a convention, not enforced.** A DEFERRED
  slice without it renders with no trigger line (honest absence, not a guess).
- **A1/A2 evidence — probe P3 (2026-11-16)** over the 8 configured projects:
  42 DEFERRED slices in 5 projects. 40/42 carry an exact
  `**Resolution trigger:**` line; 13 of those wrap onto following lines.
  Goal: 37/42 exact `**Goal:**`, 4 more as `**Goal (…):**` (e.g. "Goal (when
  un-deferred)"), 1 none. 16 finished specs have a deferred tail. Hence
  012-02 accepts the `**Goal (…):**` variant and reads wrapped triggers.
  **Kill criterion:** if the Parked section shows no trigger for more than a
  quarter of parked slices across projects, revisit label tolerance.
- **A3 — snapshot readers tolerate an extra `roadmap` field.** The reader
  parses each JSONL line as an object and keeps it (`src/lib.mjs:178-193`);
  not yet verified that no consumer (migrate, `--if-changed` signature) chokes
  on a large nested field. Slice 03 probes this first.
- **A4 — a skill can list projects active since its last run.** The sessions
  reader `readAllSessions` is exported and reads transcript mtimes without the
  server (`src/scan.mjs:656-701`, per the 012-04 frame-critique); Slice 04
  confirms it first. Fallback: projects
  whose git activity changed in the window. "Today" means "since the last
  end-of-day run" (012-04 AC2), not since midnight.

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

- [012-01 — roadmap tab with automatic order](slice-01-roadmap-tab-automatic-order.md)
- [012-02 — parked section and slice goals](slice-02-parked-and-goals.md)
- [012-03 — saved order and narrative extras from snapshots](slice-03-snapshot-roadmap-block.md)
- [012-04 — end-of-day skill](slice-04-end-of-day-skill.md)
