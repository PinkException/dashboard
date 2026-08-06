---
adr: 0006
pass: frame-critique
verdict: pass
reviewer: jig:reviewer subagent (independent, read-only; 5 passes to convergence)
reviewed_at: 2026-08-06T21:56:10Z
prompt_source: review.py frame-critique docs/decisions/adr-0006-overview-triage-surface.md
---

Frame-critique on ADR-0006 (overview triage surface). Ran to convergence over
successive independent passes. The frame's structural core — the uniform-card
glance + click-through detail split (Option B), gh-as-optional-enrichment
(consistent with ADR-0001's npm-scoped zero-dep rule + existing git shell-out),
and the reserved/deferred token slot — was grounded and survived from early on.

The load-bearing risk was concentrated in the "needs you" badge. Successive
critiques drove three corrections, each verified: (1) the signal is intent-scoped
(counts only owner-blocking markers) and excludes ubiquitous activity counts
(open bugs, stranded docs, any deferred slice) that would saturate it — grounded
by a 2026-08-06 grep probe over the 8 configured projects; (2) recall is not
disk-measurable, so it is backstopped by an owner-settable marker (opt-in per
vision principle 3, home-folder config per principles 1/6) and validated against
owner ground truth, not a disk grep; (3) the split and the badge fail
independently — badge failure degrades to the marker and keeps the grid; only a
detail-view/framework collision with ADR-0001 reverts the split.

Final pass: PASS, frame internally consistent, no load-bearing issue surviving.
One wording overclaim ("reliable by construction") softened to
"reliable for owner-declared blocks; a floor, not a total recall guarantee."
