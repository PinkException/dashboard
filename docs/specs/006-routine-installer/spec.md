---
status: DRAFT
skill:
use_cases: [UC-3]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 006: Dashboard-owned routine installer

## Overview

The dashboard's recurring snapshot routine (`compass-snapshots`) is **orphaned**.
Spec 005-04 rebuilt its content (deterministic, on-change, no `--commit`), but the
live copy at `~/.claude/scheduled-tasks/compass-snapshots/SKILL.md` was never
updated: that directory is guarded (`~/.claude/hooks/guard-jig-prompts.py` denies
hand-edits), and the only tool that writes there — the **night-worker's**
`tools/install_prompts.py` — installs only the night-worker's own two prompts and,
after its 2026-08-03 rework, explicitly excludes the dashboard from scope.

So the routine has a guardrail but no installer that manages it. This spec gives
the **dashboard** its own routine-install path: the routine's SKILL.md becomes a
version-controlled artifact in this repo, and a small, tested, zero-dependency
installer copies it out to the live scheduler under an owner-gated write — the
same shape the night-worker proved in its
[ADR-0001](../../../night-worker/docs/decisions/adr-0001-prompts-live-in-this-repo.md)
and slice 001-06.

**The decision this spec records (an ADR, 006-01):** *the dashboard owns and
installs its own automation; this repo is the source of truth for the routine it
runs.* Rejected alternatives: fold the routine into the night-worker (contradicts
the night-worker's new "dashboards are out of scope" vision); retire the automated
routine (the owner wants the growing series — ADR-0004 OQ2); leave it orphaned
(a guardrail with no writer is a dead end).

**Scope boundary.** This spec installs and drift-checks the routine's SKILL.md. It
does **not** change what the routine writes (005-04, done), does **not** build the
evolution chart (a future spec), and does **not** enable/schedule the cron itself
— arming the schedule stays a separate owner action via the scheduler, distinct
from writing the file.

## Assumptions

- **A1 — the guardrail hook guards the Write/Edit tools, not a Bash-run
  installer.** *Probed, load-bearing.* `guard-jig-prompts.py` is registered in
  `~/.claude/settings.json` with `matcher: "Write|Edit"` (verified) and denies
  any Write/Edit whose `file_path` is under `~/.claude/scheduled-tasks/`. It has
  no identity check on *which* installer runs — the night-worker's tool is not
  "recognised"; it simply writes with standard-library file I/O run through Bash,
  which never triggers a Write/Edit PreToolUse. A dashboard installer run the same
  way (Node `fs`, invoked via Bash) is therefore not intercepted. **The whole
  approach rests on this**; if the hook were widened to Bash, or keyed on a
  specific installer path, the installer would be blocked and the plan would need
  to change (e.g. modify the guardrail, which is itself owner-gated).
- **A2 — the `compass-snapshots` scheduler entry already exists (disabled), so
  the installer replaces its SKILL.md rather than registering a new task.**
  *Probed.* `list_scheduled_tasks` shows `compass-snapshots` present, `enabled:
  false`, cron `0 5,12 * * *`, last run 2026-07-22. Writing the SKILL.md updates
  its content; flipping `enabled` to true is a separate owner action (out of
  scope, per the scope boundary).
- **A3 — the night-worker's installer contract is transferable to the
  dashboard.** *Grounded.* Its `tools/install_prompts.py` (standard-library only)
  implements exactly the shape this spec needs — `check` (read-only drift,
  non-zero on mismatch) and `install` (copy, read-back byte-for-byte, manifest),
  with an owner-approval gate on writes, hand-edit refusal, and lock handling. It
  is proven and tested (`tools/test_install_prompts.py`). The dashboard's version
  re-expresses the same contract in Node to match this repo's zero-dependency
  stack ([ADR-0001 dashboard](../decisions/adr-0001-runtime-zero-deps.md)).

## Decomposition

SPIDR — split on **Path**: the read-only path (source in the repo + a drift check
that never writes) first, then the write path (the owner-gated install) second.
This mirrors the ADR's own read/write line — reading is free and safe, writing is
gated — and lets the safe half land and deliver value (drift visibility) before
any code writes into the armed scheduler. No spike: every unknown that mattered
(the guardrail's matcher, the existing scheduler entry, the transferable
contract) was resolved by probe above.

- **006-01 (Path — the read-only half + the decision).** Move the routine's
  SKILL.md into `prompts/compass-snapshots/SKILL.md` (version-controlled source of
  truth), write the ADR recording dashboard-owned install, and ship the
  installer's `check` command: a read-only drift report comparing the repo source
  against the live copy, non-zero exit on drift, **no writes at all**. Vertical:
  the routine source lives in the repo → `check` tells you whether the live copy
  matches → the owner can see the drift that exists today.
- **006-02 (Path — the owner-gated write half).** Add the installer's `install`
  command: refuse without an explicit owner-approval flag; refuse (and show the
  diff) when the live file was hand-edited since the last install; copy, read back
  byte-for-byte, and record a manifest. Vertical: run the gated installer → the
  005-04 routine lands live from the sanctioned path → `check` now reports clean.

Why 006-01 first: it is entirely read-only (no risk to the armed scheduler),
delivers drift visibility on its own, and creates the version-controlled source
and the ADR that 006-02's write path depends on.

## Slices

- [006-01 — routine source, ADR, and read-only drift check](slice-01-source-and-check.md)
- [006-02 — the owner-gated install path](slice-02-gated-install.md)
