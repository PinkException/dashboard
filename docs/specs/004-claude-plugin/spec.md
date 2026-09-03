---
status: DONE
use_cases: [UC-1, UC-2, UC-3, UC-4]
---

# Spec 004: Claude Code plugin packaging

## Overview

Package the shipped MVP as a publicly installable Claude Code plugin — the
distribution identity the original vision brief dropped and ADR-0003 now
records. The engine (scanner, server, page, snapshot writer) is unchanged;
this spec adds the plugin/marketplace manifests, the `open` skill, and
moves the only private input — the user's project list — out of every repo
to `~/.claude/project-dashboard/config.json`.

> **Retroactive spec.** The implementation landed 2026-07-22 on
> `claude/dashboard-plugin-architecture-ourwus` during the restart after
> the public/private-split leak, before this spec was written. Recorded
> after the fact with owner approval so the docs and the code agree; the
> acceptance criteria below were verified against the landed code, not
> written ahead of it.

## Decomposition

Single slice — the packaging is one thin vertical (manifests + skill +
config relocation) over an already-shipped engine; there is no independent
intermediate that ships value on its own.

### Slices

1. **`004-01 plugin-packaging`** — manifests, `open` skill, home-dir config
   resolution, README/architecture updates.
   *(See [slice-01-plugin-packaging.md](slice-01-plugin-packaging.md).)*

## Amendments

### 2026-07-22 — Renamed coordinates

This spec cites the pre-rename names (`project-dashboard`,
`~/.claude/project-dashboard/config.json`). Same-day rename: repo
`Kyarha/dashboard`, plugin `dashboard@dashboard`, skill `/dashboard:open`,
user config `~/.claude/my-dashboard/config.json`. Recorded in the amendment
on [ADR-0003](../../decisions/adr-0003-claude-plugin-distribution.md);
original prose preserved because closed specs are records.

- **2026-09-02 — second rename `Kyarha` → `PinkException`.** The account/repo owner
  `Kyarha` was later renamed to `PinkException` (single identity); the repo is now
  `PinkException/dashboard` and install is
  `/plugin marketplace add PinkException/dashboard`. Recorded in the second
  amendment on [ADR-0003](../../decisions/adr-0003-claude-plugin-distribution.md);
  original prose preserved. Read `PinkException/dashboard` wherever this spec (and
  its slice) say `Kyarha/dashboard` or `Kyarha/project-dashboard`.
