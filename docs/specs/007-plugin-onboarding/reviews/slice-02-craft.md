---
slice: 007-02 — README onboarding section
pass: craft
verdict: pass
reviewer: pr-review (fresh-context, Opus, installed skill rubric)
reviewed_at: 2026-08-04T20:58:13Z
prompt_source: review.py pr-review
---

Craft pass (pr-review) on slice 007-02 (fresh-context reviewer, Opus). Deliverable: README.md.

VERDICT: pass. No blockers. The new "First-run order" block and "Automatic snapshots
(optional)" section read in the README's terse, concrete voice; the
install → open → optional-routine ordering is explicit with the open-first rationale
stated; the owner-gated caveat is prominent; the fenced bash block is well-formed;
the anchor #automatic-snapshots-optional resolves correctly.

Strengths: the graceful-failure callout preempts the most likely newcomer mistake and
matches the 007-01 message; the check/install/--force/enable-schedule breakdown cleanly
separates read-only from owner-gated writes and flags that installing does not start runs.

Nits, all FIXED after the review: glossed "compass" ("compass-snapshots is the name of
the scheduled task"); made the snapshot.mjs path form consistent (scripts/snapshot.mjs);
removed the duplicated store-guarantee prose and the vague "below" by cross-referencing
the "Last snapshot" card bullet.
