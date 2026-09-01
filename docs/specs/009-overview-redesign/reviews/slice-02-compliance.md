---
slice: 009-02 — waiting-on state + finish-first ordering (the triage signal)
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-01T00:24:38Z
prompt_source: review.py implementation (orchestrator-dispatched)
---

Compliance pass (jig:independent-review, read-only general-purpose reviewer). Verdict: PASS. Full suite 286 → 283 green (after vacuous-test cleanup). All five ACs met and exercised by non-vacuous tests (deepEqual/notEqual on real deriveWaitingOn output).

- AC1/AC2: deriveWaitingOn (src/lib.mjs) implements the pinned total order MERGE>REVIEW>DECIDE>Ready-resume>Ready-start>External(deferred)>Idle exactly (ranks 1-5,7); one-state-per-project headline with verb + named action rendered in public/render.mjs.
- AC3: owner-marker `needsYou` backstop forces You-states in both string and object shapes; hardened post-review so a malformed marker normalizes to DECIDE (state/verb/rank/CSS never desync).
- AC4: intent-scoped DECIDE — fires only on a **(you)**-tagged next step or an ownerOf-tagged blocker; discrimination probe 2/7 = 29% (PASS), recorded in reviews/slice-02-discrimination-recall.md.
- AC5: recall evidence recorded (owner ground truth vs derived; no taxonomy miss on investigation).
- Browser boundary holds: public/render.mjs imports nothing, only reads p.waitingOn.
- false-Idle IN_PROGRESS case caught; activity-excluded boundary held.

Findings (both addressed post-review): 4 vacuous "mutation check" tests deleted (real coverage in adjacent tests); forcedWaitingOn hardened against malformed markers. Reconciliation notes: External rank 6 deliberately unreachable pending 009-04; waitingOn intentionally absent for error/non-jig projects (render defaults them to Idle-equivalent rank 7) — to be recorded in the deviation log.
