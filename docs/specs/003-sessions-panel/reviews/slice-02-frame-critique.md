---
slice: 003-02 — recency-expand-toggle
pass: frame-critique
verdict: pass
reviewer: orchestrator (focused inline frame-critique)
reviewed_at: 2026-08-06T18:28:48Z
prompt_source: jig:spec-workflow frame_review (helper=true on spec assumptions A1–A6)
---

Focused inline frame-critique of slice 003-02 before implementation. The slice
is client-side arithmetic + a CSS layout fix over data 003-01 already emits and
verified — no session-store re-probe needed (the spec's A1–A6, which fire the
frame_review flag, were discharged in 003-01).

Verdict: FRAME-SOUND-WITH-NOTES.

Should-fix (resolved in AC3/AC4): N/M/K were undefined and the cap-overflow
"(+K not shown)" case was under-specified. Because SESSION_CAP (20) can drop
ACTIVE sessions too, "N active" must be emitted-active and "(+K not shown)"
must be able to appear with zero older sessions. Pinned: N = emitted active;
M = emitted non-active (toggle-revealable); K = sessionsTotal − emittedCount
(cap-dropped, not revealable). The +K segment is independent of the older
toggle.

Nits: the toggle reveals M, never K (made explicit); AC5's stacked layout adds
row height, interacting with the spec-012 card-height cap (acceptable, spec-012
reveal handles it); count arithmetic goes in a pure src/lib.mjs helper for
unit-testability (the page inline script has no test harness).
