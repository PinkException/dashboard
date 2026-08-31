---
slice: 009-01 — uniform triage rows + project detail view (the split)
pass: frame-critique
verdict: needs-changes
reviewer: jig:reviewer
reviewed_at: 2026-08-31T18:41:18Z
prompt_source: orchestrator frame-critique (pre-impl)
---

Pre-implementation frame-critique of slice 009-01 (jig:reviewer, read-only). Verdict: needs-changes — all findings addressed before code.

Findings (all resolved):
- The DoR claim "scan payload already carries every field / no scan.mjs change required" was falsified: three redline-demanded data are not emitted today — (a) per-project description subtitle (loadConfig has only path/label/pinnedWorkstreams/hiddenWorkstreams); (b) release-track member spec IDs + a "current" flag (resolveReleaseGoal discards the IDs parseIncludeTokens finds); (c) per-workstream next 1–3 item texts (parseRunbook computes them at lib.mjs:113 but returns only {done,total}+next). RESOLVED: slice corrected (AC2/AC5/AC7 + A-009-01 + spec "Current state" correction note); owner chose to build all three into 009-01.
- design_review scope ambiguity: console-overview.render.png shows 009-02/03 content (state tags, TO DO/READY counts, action-queue toggle, finish-first order, tinted rows). RESOLVED: AC8 scope-fence enumerates the excluded elements so fidelity scores only 009-01's layout/tokens.

Confirmed sound (no change): the glance/detail architecture, the 009-01↔009-02/03 boundary (removing the badge does not empty the next-move column — compass.headline fills it), and A3 (in-page detail view needs no router/framework).

Reviewer prompt: orchestrator-authored adversarial frame-critique (spec + slice + ADR-0006 + redline cascade + scan.mjs/index.html).
