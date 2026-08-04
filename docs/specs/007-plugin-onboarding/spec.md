---
status: DONE
skill:
use_cases: [UC-3]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 007: Plugin onboarding

## Overview

The dashboard is distributed as a public Claude Code plugin
([ADR-0003](../decisions/adr-0003-claude-plugin-distribution.md)). A person who
installs it starts with **no** `~/.claude/my-dashboard/config.json` (their private
project list lives only there, outside every repo — vision principle 6). Two
onboarding rough edges surfaced when the owner's own config went missing (dropped
in a data migration) and the snapshot routine ran against it:

1. **The routine fails ugly on a missing config.** `snapshot.mjs --all` calls
   `loadConfig` → a bare `fs.readFileSync` (`src/scan.mjs:127`) that throws a raw
   `ENOENT` stack trace. *Probed 2026-08-04:* `DASHBOARD_CONFIG=<empty>/config.json
   node scripts/snapshot.mjs --all --auto --if-changed` prints a `node:fs` stack
   trace (`Error: ENOENT: no such file or directory, open '…/config.json'`) and no
   next step. The `/dashboard:open` skill already handles the
   missing-config case gracefully (it offers to create one), but the routine and
   any other CLI caller do not — a fresh installer who arms the routine before ever
   running `/dashboard:open` gets a stack trace instead of a next step.
2. **The README does not document the automatic routine at all.** It covers install
   + config + manual snapshots, but says nothing about the owner-gated
   `install-routine.mjs` install and enabling the scheduled task (spec 006) — so a
   plugin user has no documented path to the automatic history feature, nor the
   correct first-run ordering (open first, arm the routine second).

This spec closes both so a new plugin user has a clean on-ramp to UC-3 (the compass
/ snapshot history the routine populates).

## Assumptions

None.

## Decomposition

SPIDR — split on **Interface**: the two onboarding surfaces are independent and
each delivers value alone. The **runtime behavior** (the routine/CLI's own error
output) is the first slice; the **documentation** (the README onboarding path) is
the second. Either can land without the other. No spike — the one factual claim
(A1) was resolved by probe, not research.

- **007-01 (Interface — the routine's failure UX).** When the config is absent,
  `loadConfig` raises a clear, typed error and the `snapshot.mjs` CLI catches it,
  prints a one-line "no config yet — run `/dashboard:open` to create one" pointing
  at the resolved path, and exits non-zero with **no stack trace**. Malformed JSON
  stays a distinct, honest error. Vertical: a fresh installer who runs the routine
  first now gets a next step instead of a crash.
- **007-02 (Interface — the onboarding docs).** The README gains a new-user
  walkthrough: install the plugin → `/dashboard:open` (creates the config) →
  *optionally* arm the automatic routine (`install-routine.mjs check`/`install
  --approved-by-owner` + enabling the scheduled task), with the owner-gated caveat
  and the open-first ordering called out. Vertical: a plugin user can follow a
  documented path all the way to automatic history.

## Slices

- [007-01 — graceful config-missing message](slice-01-graceful-config-missing.md)
- [007-02 — README onboarding section](slice-02-readme-onboarding.md)
