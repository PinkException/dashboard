---
slice: 013-01 — progress-over-time chart in the Activity tab
pass: arch
verdict: pass
reviewer: jig:reviewer (independent, arch-review skill)
reviewed_at: 2026-11-18T04:50:57Z
prompt_source: review.py arch-review docs/specs/013-evolution-graphs/spec.md 013-01 --richer-skill arch-review
substrate: non-interactive
---

Arch pass on slice 013-01 (fresh jig:reviewer, richer skill: arch-review). Verdict: pass.

Strengths: the change is additive and keeps the layering. A pure buildProgressSeries in src/lib.mjs; scan.mjs wires the store-only raw text into project.history; render.mjs only presents it. The store is read once, and that text feeds both compass (unchanged) and history. storeText is never serialized. mergePrDeltas leaves history alone, so ADR-0007's two-phase load holds. The scan test redirects the store via DASHBOARD_SNAPSHOTS.

Nits (reconciliation items, non-blocking):
- The render.mjs comment says "no derivation beyond layout", but the page computes the down-step markers and the days-ago caption itself (the spec's signature requires this). Fix the comment and log the deviation.
- The dot filter repeats the narrative rule that buildProgressSeries already applies.
- history is attached only to jig-managed projects; architecture.md should say so.
- The .tab.disabled CSS rule is now unused.
