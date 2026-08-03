---
status: DONE
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
- **A2 — resolving the store per project does not materially slow a scan.**
  *Unverified.* The read path adds one file read **and one `git rev-parse`
  subprocess** per project (`snapshotFileFor` → `projectKey` → `repoRootOf`), on
  top of the two git calls `gitInfo` already makes — and `server.mjs` re-scans on
  every request. Mitigated, not measured: `projectKey` memoizes per root, so the
  subprocess cost is paid once per root per process rather than per request. If a
  scan still visibly slows on the owner's real config, the store read itself can
  be cached too.

- **A3 — a project's resolved filesystem path is NOT a durable identity, and
  `projectKey` does not pretend otherwise.** *Declared, with a known
  falsification.* The key is `sha256(realpath(repo root))`, so a project that is
  moved or renamed gets a **new** key and starts a new history file. This is not
  hypothetical: ADR-0004 records that 16 of the 193 backed-up entries live under
  the old `project-dashboard` path and "belong to this project's series" — one
  project, two paths, and by construction two keys.
  **Consequence, scoped deliberately:** for the *writer* (this slice) the cost is
  bounded — a moved project starts a fresh series and its card falls back to the
  in-repo headline, which is indistinguishable on disk from the benign day-one
  case. For the *migration* (005-02) it is not acceptable: folding on path alone
  would split one project's history in two, recreating the fragmentation ADR-0004
  exists to remove, and §6's "every entry accounted for" check cannot catch it
  (every entry is present *somewhere*). **005-02 therefore requires an explicit
  alias/rekey mechanism** — an owner-supplied map from old path to project, or a
  stable identifier such as the root-commit SHA — and must not simply reuse
  `projectKey` over historical paths. Recorded as the top input to ADR-0004 OQ4.

  **Resolved 2026-07-24 (owner).** Identity comes from an explicit,
  owner-confirmed alias list at `~/.claude/my-dashboard/snapshot-aliases.json`,
  not from a derived identifier. A derived identifier was checked and rejected on
  evidence: the obvious candidate — the repository's first commit — gives
  *different* values for this project's old and current folders, because the
  history was rewritten on 2026-07-24 before publication. It fails silently on
  exactly the pairing the migration needs. See
  [005-02](slice-02-migrate-history.md) "Why not a derived identifier"; recorded
  in ADR-0004's 2026-07-24 OQ4 amendment.

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
  mapping (folding worktree copies into their parents, promoting the
  worktree-only project), merges the backed-up entries, verifies against a
  retirement-time capture. Solves the identity problem A3 names with an
  owner-confirmed alias list — see A3's 2026-07-24 resolution note. **Drafted
  2026-07-24.**
- **005-03 (Interface)** — the dashboard-owned skill that composes narrative
  entries (ADR-0004 OQ1 option (a)). Vertical: run the skill → a narrative entry
  lands in the store → the project card answers UC-3 in prose. **Drafted
  2026-07-31.** The routine was split out (below) because a scheduled-task rebuild
  and a human-invoked skill are two independently-testable deliverables.
- **005-04 (Interface)** — rebuild the paused twice-daily `compass-snapshots`
  routine against 005-03's skill and the new store, and choose its cadence
  (ADR-0004 OQ2: at most one entry per project per day, or only on a changed
  computed state — sampling matters because the series feeds a chart). **Drafted
  2026-08-01.** The one non-negotiable: the rebuilt routine drops the old
  `--commit` that wrote into each repo (the bug-002 leak); it writes only to the
  store. Cadence and narrative-vs-deterministic are its open questions.

Why 005-01 first: it is the only slice that closes an open leak path, and it
depends on nothing. 005-02 and 005-03 both build on the store it creates.

## Slices

- [005-01 — relocate the snapshot store](slice-01-relocate-store.md)
- [005-02 — migrate the existing history](slice-02-migrate-history.md)
- [005-03 — dashboard-owned narrative snapshot skill](slice-03-narrative-writer.md)
- [005-04 — rebuild the recurring routine + choose cadence](slice-04-recurring-routine.md)
