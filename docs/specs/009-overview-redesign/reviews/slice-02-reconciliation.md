---
slice: 009-02 — waiting-on state + finish-first ordering (the triage signal)
pass: reconciliation
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-01T00:34:36Z
prompt_source: orchestrator reconciliation-review prompt
---

Reconciliation review (jig:reviewer, read-only). Verdict: PASS.

The reconciliation artifacts are faithful, honest, and correctly scoped. The deviation log records the real implementation/review changes (DECIDE intent-scoping retighten, the four frame-critique fixes, scan-side boundary, the needsYou config key, the 6 removed test-hygiene cases) without overclaiming, and correctly parks the two out-of-scope findings (a config-path typo on one project; an owner-named project absent from the config) as owner follow-ups. Every spot-checked doc claim is backed by real code: deriveWaitingOn exists in src/lib.mjs and is called in scanProject; public/render.mjs imports nothing and only reads waitingOn (missing field → rank 7). architecture.md + lightweight-decisions edits are accurate. "No new ADR" defensible (ADR-0006 delegated the marker set + validation to this spec); no compress-on-close-out correct (009-03/04 still DRAFT).

Carry-forward: parked owner follow-ups (one project's config path had a typo so the dashboard couldn't survey it; one owner-named project is absent from the surveyed config). Empirical: no surveyed project uses the **(you)** tag today, so automatic DECIDE relies on the needsYou marker until the convention is adopted.
