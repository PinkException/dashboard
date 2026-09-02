# Decisions

> Status: Draft (wizard-generated)
>
> Architectural Decision Records for dashboard. Nygard convention: immutable
> after acceptance. New decisions supersede old ones — never edit an accepted ADR.

## Index

- [ADR-0001: Runtime: Node ≥ 18, ESM, zero runtime dependencies](adr-0001-runtime-zero-deps.md) — The dashboard is a local, single-user tool that must outlive framework churn and never block on a broken install. (2026-07-13, Accepted)
- [ADR-0002: Compass snapshot contract: docs/status/compass-history.jsonl](adr-0002-compass-snapshot-contract.md) — Compass is deliberately read-only: it reports in chat and persists nothing, so "what did compass say last" has no data source. (2026-07-24, Superseded)
- [ADR-0003: Distribution: Claude Code plugin, private state in user home](adr-0003-claude-plugin-distribution.md) — The dashboard was always meant to be shared publicly as a companion to jig, but the 2026-07-13 vision brief only recorded the personal-tool half. (Accepted)
- [ADR-0004: Dashboard owns one append-only snapshot history per project](adr-0004-dashboard-owned-snapshots.md) — Compass snapshots currently live inside every surveyed project and are written by compass itself, and that arrangement has become a source of repo pollution and repeated re-litigation. (2026-07-24, Accepted)
- [ADR-0005: The dashboard owns and installs its own automation](adr-0005-dashboard-owns-routine-install.md) — The dashboard's recurring snapshot routine (`compass-snapshots`) runs from the Claude Code scheduler at `~/.claude/scheduled-tasks/compass-snapshots/SKILL.md` — outside every repository. (Accepted)
- [ADR-0006: Overview is a triage surface: glance/detail split, PR state via optional gh](adr-0006-overview-triage-surface.md) — The dashboard's overview page renders every project as a card that prints everything it knows — spec lists, session lists, workstreams, warnings, and the narrative "what's next" — in one dense monospace layer at uniform visual weight. (2026-08-06, Accepted)
- [ADR-0007: PR enrichment is delivered non-blocking (two-phase load)](adr-0007-non-blocking-pr-enrichment.md) — Spec 009-04 (ADR-0006) added optional `gh`-sourced pull-request state to the overview: when `gh` is installed and authenticated, each project's open PRs are read and folded into its triage signal. (2026-09-02, Accepted)

## Format

Each ADR lives at `docs/decisions/adr-NNNN-<slug>.md`. Title: `# ADR-NNNN: <Title>`.

Required sections: Status, Context, Decision Options Considered, Recommended Decision, Consequences.

## When to write an ADR

- Hard-to-reverse decisions
- Decisions that affect multiple modules or the public API
- When a contract changes in a breaking way
- When the `architect` subagent produces a proposal that is accepted
