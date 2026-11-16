> Status: Draft (wizard-generated)
>
> Decisions the initial setup explicitly deferred. Each item has a resolution trigger.
> Resolve by writing an ADR and linking it here.

# Refinement Todo: dashboard

## Architecture

### Decision: Tech stack
**RESOLVED (2026-07-13):** Node ≥ 18, ESM, zero runtime dependencies —
see [ADR-0001](decisions/adr-0001-runtime-zero-deps.md).

### Decision: Module boundaries
**RESOLVED (2026-07-19):** trigger fired at slice 002-03 (the first contract,
ADR-0002); boundaries documented in
[architecture.md → Module boundaries](architecture.md#module-boundaries).

## Conventions

### Decision: Code style and linting
**Deferred:** No signal from the initial pitch.
**Resolution trigger:** First spec that produces non-trivial code, or first time inconsistency causes friction.

### Decision: Testing framework
**RESOLVED (2026-07-13):** built-in `node:test` with fixture trees under
`test/fixtures/` — see [ADR-0001](decisions/adr-0001-runtime-zero-deps.md).

## Operations

### Decision: CI/CD setup
**Deferred:** No signal that CI is set up.
**Resolution trigger:** First spec that crosses a deploy boundary.

## Process

### Decision: Directive-compliance recovery (Phases A–F)
**Deferred:** a two-round, read-only audit (2026-07-22/24) found why sessions
drift from the owner's workflow: rules are recorded but not *delivered* to the
sessions that need them, invisible autonomy framing conflicts with the
stop-at-gates workflow, and a residue of plain non-compliance that only
verification-shaped gates catch. The full report and staged recovery plan are
machine-local at `~/Documents/Claude/directive-compliance-audit-2026-07-22.md`
(kept out of this repo because it details other local projects). The report
still says recovery Phases A–F are **not executed — owner deciding**; the
overnight worker automation stays paused until recovery is done and verified.
Items in that plan that touch this repo: gate rules inlined into `CLAUDE.md`;
ADR-0004 naming the old ADR-0009 as superseded (it does not today); disposition
of the `claude/trim-old-repo-refs` uncommitted files; an explicit push-policy
record. (Moved here from `docs/inbox.md` by the 2026-11-16 inbox triage; first
logged 2026-07-24.)
**Resolution trigger:** the owner decides on the recovery plan (run it, trim
it, or drop it).
