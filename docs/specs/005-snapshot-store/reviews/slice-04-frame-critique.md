---
slice: 005-04 — rebuild the recurring snapshot routine + choose its cadence
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (fresh-context, Opus)
reviewed_at: 2026-08-03T14:12:19Z
prompt_source: review.py frame-critique
---

Pre-implementation frame-critique on slice 005-04 (frame_review: true). Run twice.

Round 1 → needs-changes. Caught two code-grounded frame errors in the owner's initial resolution:
1. A daily deterministic `auto` entry would bury 005-03's narrative headline on the card, because the reader (parseCompassHistory + laterSnapshot + scanCompass) selected the latest entry by `ts`, source-blind — reversing 005-03's delivered value.
2. Defining "changed" over the full `auto` headline would sample open-bug-count churn (net-zero noise) while staying silent during real slice work, because the auto fingerprint is spec-level and flat within a multi-slice spec.

Both folded into the design before implementation:
1. The reader now prefers the latest non-`auto` entry for the card headline (parseCompassHistory.latestNarrative + narrative-preferred scanCompass.latest); the auto series stays chart-only.
2. "Changed" is a progress-only signature (specs.done/specs.total/next), bug count excluded; spec-granularity coarseness documented as a deferred future-chart concern.

Round 2 → pass. Both fixes verified code-grounded, not merely asserted. Frame survives adversarial re-read. Two non-blocking residuals to record in the deviation log / architecture note:
- The card freshness/stale label now derives from the narrative-preferred entry, so it tracks prose age, not routine activity (deliberate per AC4 — a nudge to refresh prose, not a bug).
- `next` in the signature captures lateral active-spec changes / total bumps, so a point can be written on a transition that is not strictly forward progress — defensible as a series marker, not load-bearing.
