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
