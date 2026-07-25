---
status: DRAFT
skill:
use_cases: [UC-3]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 005: Dashboard-owned snapshot store

## Overview

Implements [ADR-0004](../../decisions/adr-0004-dashboard-owned-snapshots.md)
(Accepted 2026-07-24, supersedes ADR-0002): compass snapshots stop living inside
every surveyed project and move to one dashboard-owned store per project at
`~/.claude/my-dashboard/snapshots/`, outside every repo.

The driver is a leak, not tidiness. Each snapshot line records a surveyed
project's real feature names, roadmap state and bug counts; writing it into that
project's git-tracked `docs/status/` makes one project's internal state a
committed artifact in its own repo as a side effect of running the dashboard.
Vision principle 1 (amended 2026-07-24) says the dashboard never writes into a
surveyed project. Two surveyed repos have that history committed today.

**Scope boundary.** This spec relocates and preserves. It does not decide what a
growing history is *for* beyond UC-3 — the owner has confirmed they want the
evolution / velocity view (ADR-0004 Amendment, OQ2), and that view is its own
future spec.

**Nothing is deleted by this spec.** The existing in-repo files and the dated
backup at `~/.claude/my-dashboard/_migration-backup-2026-07-22/` are both
retained throughout. Removing the in-repo files is a separate, later, explicitly
approved step gated on ADR-0004 §6.

## Assumptions

- **A1 — nothing outside this repo reads a surveyed project's
  `docs/status/compass-history.jsonl`.** *Unverified, load-bearing.* Inside this
  repo the only reader is `scan.mjs:215` (probed). Compass no longer reads or
  writes it (probed: its SKILL.md now states it "reports in chat and writes
  nothing"). But a surveyed project could have its own tooling reading that file,
  which this spec cannot see. If one does, relocating the writer starves it. The
  slice mitigates by leaving the in-repo files in place and readable — nothing is
  removed — so a hidden consumer degrades to "stops receiving new entries" rather
  than breaking outright.
- **A2 — reading two candidate sources per project does not materially slow a
  scan.** *Unverified.* Each project already reads many files per scan; this adds
  one file read per project. Asserted, not measured. If a scan visibly slows on
  the owner's real config, the store read can be cached across projects.

Probe-verified (not assumptions):

- `git rev-parse --git-common-dir` resolves both a linked worktree and a primary
  worktree to the same parent repository (probed on this repo, both cases).
- `parseCompassHistory` ([lib.mjs:164](../../../src/lib.mjs)) selects the **last
  valid line in file order**, not the latest `ts`.
- The reader reads only `<root>/docs/status/compass-history.jsonl`
  ([scan.mjs:215](../../../src/scan.mjs)).
- The writer appends only to `<root>/docs/status/`
  ([snapshot.mjs:63-65](../../../scripts/snapshot.mjs)).
- `resolveConfigPath` ([scan.mjs:29](../../../src/scan.mjs)) already establishes
  `~/.claude/my-dashboard/` as the per-user data folder, with a
  `DASHBOARD_CONFIG` override.

## Decomposition

SPIDR — split on **Path** then **Data** then **Interface**. No spike: every
unknown that mattered was resolved by probe (above), and ADR-0004 already decided
the shape.

- **005-01 (Path)** — relocate the live path. New writes go to the store; the
  reader reads both sources and prefers the later `ts`. Closes the remaining half
  of [bug 002](../../bugs/002-compass-writer-still-active.md). Vertical: writer →
  store → reader → the project card still answers UC-3.
- **005-02 (Data)** — migrate the existing history. Settles ADR-0004 OQ4's full
  mapping (folding the 17 worktree copies into their parents, promoting the
  worktree-only project), merges the 193 backed-up entries, verifies against a
  retirement-time capture. Deliberately **not drafted yet**.
- **005-03 (Interface)** — the dashboard-owned skill that composes narrative
  entries, plus rebuilding the paused twice-daily routine and choosing its cadence
  (ADR-0004 OQ1 option (a), OQ2). Deliberately **not drafted yet**.

Why 005-01 first: it is the only slice that closes an open leak path, and it
depends on nothing. 005-02 and 005-03 both build on the store it creates.

## Slices

- [005-01 — relocate the snapshot store](slice-01-relocate-store.md)
- 005-02 — migrate the existing history *(not drafted)*
- 005-03 — dashboard-owned narrative writer *(not drafted)*
