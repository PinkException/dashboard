# Spec Status Board

> Status: Draft (wizard-generated)
>
> Current state of all specs for dashboard. Update after each slice transition.
>
> A leading 🔬 in the Slice column flags slices marked `kind: spike` in
> their frontmatter — timeboxed investigation, not feature work. The
> marker is recomputed from each slice's `kind:` field on every regen
> by `workflow.py status-board`; it is never stored separately in this
> file.
>
> Related: [Bug Status Board](../bugs/README.md). Check both boards before
> folding reported defects into spec acceptance criteria.

| Spec | Slice | Status | Notes |
|------|-------|--------|-------|
| [001-adopt-jig](001-adopt-jig/spec.md) | 001-01 — bootstrap | **DONE** | worked example; review boxes satisfied by deterministic completion check |
| [002-dashboard-mvp](002-dashboard-mvp/spec.md) | 002-01 — scan-and-serve | **DONE** | scanner + server + cards page; independent review passed 2026-07-13 |
| [002-dashboard-mvp](002-dashboard-mvp/spec.md) | 002-02 — workstreams | **DONE** | releases + runbooks + pin registry + worktree-only warning |
| [002-dashboard-mvp](002-dashboard-mvp/spec.md) | 002-03 — compass-snapshot | **DONE** | contract superseded by ADR-0004 (store moved out of surveyed projects, slice 005-01). Do NOT wire compass to write — it is read-only by design |
| [003-sessions-panel](003-sessions-panel/spec.md) | 003-01 — sessions-scan-and-render | **DONE** | per-project sessions read from `~/.claude` store; running badge + title + branch + worktree |
| [003-sessions-panel](003-sessions-panel/spec.md) | 003-02 — recency-expand-toggle | **DONE** | client-side "show older" + "N active · M older" summary |
| [003-sessions-panel](003-sessions-panel/spec.md) | 003-03 — pr-badges | DEFERRED | needs `gh`; trigger = decide gh-on-scan vs routine-snapshot bridge |
| [004-claude-plugin](004-claude-plugin/spec.md) | 004-01 — plugin-packaging | **DONE** | retroactive spec (owner-approved); ADR-0003; config moved to `~/.claude/my-dashboard/config.json`; fixed bug 001 en route |
| [005-snapshot-store](005-snapshot-store/spec.md) | 005-01 — relocate the snapshot store | **DONE** |  |
| [005-snapshot-store](005-snapshot-store/spec.md) | 005-02 — migrate the existing history | **DONE** |  |
| [005-snapshot-store](005-snapshot-store/spec.md) | 005-03 — dashboard-owned narrative snapshot skill | **DONE** |  |
| [005-snapshot-store](005-snapshot-store/spec.md) | 005-04 — rebuild the recurring snapshot routine + choose its cadence | **DONE** |  |
| [006-routine-installer](006-routine-installer/spec.md) | 006-01 — routine source, ADR, and read-only drift check | **DONE** |  |
| [006-routine-installer](006-routine-installer/spec.md) | 006-02 — the owner-gated install path | **DONE** |  |
| [007-plugin-onboarding](007-plugin-onboarding/spec.md) | 007-01 — graceful config-missing message | **DONE** |  |
| [007-plugin-onboarding](007-plugin-onboarding/spec.md) | 007-02 — README onboarding section | **DONE** |  |
| [008-release-goal-view](008-release-goal-view/spec.md) | 008-01 — goal progress & next-action (happy path) | **DONE** |  |
| [008-release-goal-view](008-release-goal-view/spec.md) | 008-02 — graceful degradation & honest unknowns | **DONE** |  |
| [009-overview-redesign](009-overview-redesign/spec.md) | 009-01 — uniform triage rows + project detail view (the split) | **DONE** |  |
| [009-overview-redesign](009-overview-redesign/spec.md) | 009-02 — waiting-on state + finish-first ordering (the triage signal) | **DONE** |  |
| [009-overview-redesign](009-overview-redesign/spec.md) | 009-03 — cross-project action-queue lens | **DONE** |  |
| [009-overview-redesign](009-overview-redesign/spec.md) | 009-04 — gh-optional PR enrichment (un-defers 003-03) | DRAFT |  |

## Deferred slices

> Slices parked with a stated resolution trigger. Re-open by transitioning to DRAFT.

| Spec | Slice | Resolution trigger |
|------|-------|--------------------|
| [003-sessions-panel](003-sessions-panel/spec.md) | 003-03 — pr-badges | when PR state is wanted on session rows, AND the |

## Richer-skill selection audit (spec 096-05)

Advisory (ADR-0040 auditability — never blocks). Regenerated from `reviews/slice-*.md` `substrate:` fields.

- **1** pass(es) recorded `not-shown` (selection step did not run — the kill-criterion-1 defect signal).
- **0** pass(es) recorded `non-interactive` (declared no-orchestrator / CI).
- **1** shown-and-declined anomaly(ies) (a high-confidence richer skill was shown and not applied):
  - `009-overview-redesign/slice-02-arch.md` — applied `arch-review`; declined: design-jury, design-review
