---
slice: 005-02 — migrate the existing history
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-07-31T21:33:41Z
prompt_source: review.py frame-critique
---

VERDICT: pass

REASONING:
The single load-bearing assumption is A3 — that a walk of one hard-coded tree (`~/Documents/Claude`) finds every history file, so "every entry that exists anywhere on this machine" is captured. The goal statement is universal but the method cannot prove universality: the search root was never cross-checked against the dashboard's authoritative project list (the spec dismisses that list because no `~/.claude/my-dashboard/config.json` exists, but a canonical project list plausibly lives elsewhere). The frame nonetheless survives, because the load-bearing risk is quarantined behind the reversible half of the work: this slice only writes to the store (additive, idempotent, re-runnable with a wider root), records the exact search root in the report, and explicitly defers §6's irreversible deletion to a separately-gated later step. A wrong A3 therefore costs a cheap re-run, not a rebuild — the mark of a frame that survives, and the runtime evidence confirms the mechanism working (the 07-26 re-capture caught real post-backup drift — a newly-created worktree under one surveyed project and 2 net-new entries — exactly as A2's union+recapture rule intends).

SPECIFIC ISSUES:
- **Primary (A3 — the search root finds every history file):** The migration substitutes a filesystem walk of `~/Documents/Claude` for the authoritative "which projects does the owner track" list, and never cross-checks the two. If the owner tracks a project outside that tree, its history is silently absent from the store and the accounting cannot reveal the gap — it only reconciles what the walk found (982 read → 68 written balances *within* the walk's inputs, proving nothing about what the walk missed). One surveyed project's copy is nested two directory levels below the search root rather than directly under it, which shows the layout is not flat and weakens "one tree covers everything." This does not misdirect the slice — deletion is deferred and the root is on the record — but it is a live handoff hazard for §6: the verification set that §6's "every entry accounted for" gate trusts is itself A3-limited. Whoever builds §6 must delete per-file (only files whose entries the store confirms), never via a blanket walk, and should first reconcile the search root against the dashboard's real configured project list. (`docs/specs/005-snapshot-store/slice-02-migrate-history.md:60-67`; report search root `_migration-report-2026-07-27.md:5`.)
- **Secondary (A1 mitigation is overstated relative to the build):** The spec claims A1 is mitigated "by the migration refusing to run when a source path resolves to a project the alias list has never seen" (slice-02:52-53). The code does not do this: `applyAlias` returns the root unchanged for any unaliased project (`migrate.mjs:61-67`), and the only refusal is an *unattributable* path (`migrate.mjs:174-178`). So a silently-renamed second project would not be refused — it would be keyed by its own root and split into two files with no automated signal. A1's real and only safeguard is AC5's human eyeballing of per-project report rows. That is thinner than the spec asserts, and it is the one place the frame leans on owner recollection rather than a check. It is an accepted residual of the "declared, not derived" decision (ADR-0004 OQ4), not a wrong frame — but the mitigation prose should be corrected to match what actually guards it.

---
Reviewer: jig:reviewer (independent, read-only, adversarial frame-critique). Prompt built by: review.py frame-critique docs/specs/005-snapshot-store/spec.md 005-02 src/migrate.mjs
