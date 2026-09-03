---
slice: 010-01 — two-phase load: disk-first render, gh PR states fold in
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-02T23:37:56Z
prompt_source: orchestrator frame-critique (pre-impl)
---

Pre-implementation frame-critique of slice 010-01 (jig:reviewer, read-only).
VERDICT: pass. The load-bearing assumption A4 (the client already holds everything
the keyed merge needs; the delta is a field-swap + re-sort, no browser derivation)
survives attack against the real renderer: public/render.mjs reads exactly the four
PR-derived fields — waitingOn, waitingStages, prs, ownerLogin — which are precisely
the AC2 delta; render() (index.html) re-resolves an open detail by state.path, so
folding PRs into an open detail is the desired behaviour, not a break. A3
(disabled-gh-context reuse) checks out against scanProject's `if (gh && gh.available)`
guard and the `gh && gh.ownerLogin → null` fallthrough.

Residuals (non-blocking, folded into the slice before impl):
- A5 transient cross-field inconsistency: /api/prs recomputes waitingStages from a
  later disk state (T1) than the specs/compass/sessions the client rendered from
  /api/data (T0), so a merged headline can briefly lead its detail body in the
  ~1–8 s window. Self-heals next interval; never breaks AC5. Accepted + noted in A5.
- Phase-two wholesale re-render (app.innerHTML) discards DOM-only state (active
  detail tab, scroll) — consistent with the existing setInterval(load) re-render,
  but fires inside the initial interaction window. Folded into AC3: preserve the
  open detail's active tab if cheap, else accept-and-note. Craft-pass concern.
- Re-sort "pop-in" already named + accepted in ADR-0007.

Reviewer prompt: review.py frame-critique docs/specs/010-nonblocking-pr-load/spec.md
010-01 (+ ADR-0007, src/server.mjs, src/scan.mjs, src/lib.mjs, public/index.html,
public/render.mjs).
