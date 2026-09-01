---
slice: 009-04 — gh-optional PR enrichment (un-defers 003-03)
pass: frame-critique
verdict: needs-changes
reviewer: jig:reviewer
reviewed_at: 2026-09-01T22:52:20Z
prompt_source: orchestrator frame-critique (pre-impl) + live gh probe
---

Pre-implementation frame-critique of slice 009-04 (jig:reviewer, read-only),
armed with an orchestrator live `gh` probe as A4 ground truth.
Verdict: needs-changes — the primary blocker resolved in the slice text before code.

**Blocker (resolved in `slice-04-gh-pr-enrichment.md`):**
The original AC1 two-bucket framing ("approved → MERGE (You)" / "out for
another's review → External") is falsified by the live probe: "out for another's
review" is only External when the PR waits on *someone else*. A PR where the
**owner is the requested reviewer** waits on the owner — a REVIEW (You) case the
two-bucket rule would mis-file as External (rank 6/7, just above Idle), burying
the exact "a PR needs YOU" signal ADR-0006's kill criteria name as the
under-report failure. Distinguishing the two requires the owner's `gh` login,
which the slice never acquired or plumbed.
RESOLVED: Goal + AC1 rewritten to an **owner-keyed three-way mapping** — MERGE
(approved & `mergeStateStatus==CLEAN`, author-agnostic), REVIEW (owner ∈
`reviewRequests`), External (non-owner ∈ `reviewRequests`, not MERGE-eligible);
none-of-three → no PR signal (falls through to disk state). AC3 now captures the
owner login in the once-per-scan probe; the login is passed into the pure
`deriveWaitingOn` alongside the per-project PR list. REVIEW already owns rank 2
(`src/lib.mjs:734`) and External the reserved rank-6 slot (`src/lib.mjs:774`), so
this is a precise-mapping refinement within ADR-0006's PR-folding mandate, not new
scope.

**Secondary (resolved — was under-documented, not wrong):**
"approved & ready-to-merge" now pins the exact `gh` fields (`reviewDecision:
APPROVED` + `mergeStateStatus: CLEAN`, excluding BLOCKED/BEHIND/DIRTY/UNKNOWN),
grounded by the probe. AC1 lists the exact `--json` field set.

**Residuals recorded in `## Assumptions` (A4′), non-blocking:** multi-account `gh`
and team-review-request (`reviewRequests` Team entries) don't key on a single
login — both degrade to "no PR signal", never a mis-file.

Confirmed sound (no change): the pure/impure boundary (gh shell-out in scan.mjs
mirroring git at `src/scan.mjs:88,259`; `deriveWaitingOn` stays pure reading
`project.prs` + owner login); once-per-scan detection with timeout bound;
absent/unauth → exact status-quo (AC2); not-a-git-repo degrades to no-PRs via
gh's own non-zero exit (execFileSync throws), added as a DoD test.

Reviewer prompt: orchestrator-authored adversarial frame-critique
(review.py frame-critique + live gh grounding evidence + slice + spec + ADR-0006
+ src/lib.mjs deriveWaitingOn + src/scan.mjs git shell-out).
