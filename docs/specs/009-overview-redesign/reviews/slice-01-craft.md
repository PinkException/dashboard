---
slice: 009-01 — uniform triage rows + project detail view (the split)
pass: craft
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-31T18:41:18Z
prompt_source: review.py pr-review (orchestrated)
substrate: not-shown
applied_skill: none
---

Independent craft / code-quality review of slice 009-01 (jig:reviewer, read-only, "pr-review" pass). Verdict: PASS (no blockers).

render.mjs is clean, pure, testable. Every interpolated project/session/spec string routes through esc (attributes double-quoted, so esc not escaping ' is safe) — no unescaped sink found. Null/empty/error/not-jig/absent-compass paths branch safely. Current-track fallback degrades correctly. Heat thresholds reasonable with a mutation-test guard. The three backend widenings are additive + backward-compatible (008's release-goal render unaffected), each unit+integration tested.

Nits — all fixed in the follow-up pass:
- render.mjs detail meta "running now" used activeCount (running-or-≤7d) under the same "RUNNING NOW" label the overview uses for strict running → FIXED to strict runningNowCount.
- overview showed done/denom (abandoned excluded), detail showed done/total (included) → FIXED to one abandoned-excluded denominator, with an abandoned-spec fixture test.
- empty-memberSpecIds rendered a no-op "show current track" toggle → FIXED (empty → no toggle, full list).
- AC8 detail-output negative test added.
Non-blocking/accepted: relativeTime/sessionCounts duplicated in render.mjs vs lib.mjs (justified — browser can't import src/lib.mjs — documented; no shared test pins them equal, flagged for a future build step); index.html click/tab glue not unit-tested (accepted plan.md limitation; pure state helpers ARE tested).

Strengths: /render.mjs route reads a fixed constant path (zero path-traversal surface), correct ES-module content-type; tests use specific assertions + genuine mutation checks.

Deviations judged sound: server.mjs touched (necessary for the shared-module testability decision); dark→light-restored (owner decision); 008-02 goal-meter dropped from UI (matches redline authority; data intact; recorded in inbox + deviation log).

Reviewer: jig:reviewer. Prompt-source: orchestrator-authored craft/pr-review prompt.
