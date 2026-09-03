---
adr: 0007
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-02T23:31:23Z
prompt_source: review.py frame-critique (ADR, re-verified after needs-changes)
---

Pre-acceptance frame-critique of ADR-0007 (jig:reviewer, read-only). VERDICT: pass
(after one needs-changes round).

Blocker (resolved): the ADR claimed `deriveWaitingStages` "shells git" and therefore
"cannot be re-run in the browser," forcing a server-computed phase two. FALSE
mechanism — `src/lib.mjs` imports/shells nothing (grep for import/child_process/
execFile matches only comments; header: "Pure — no filesystem or git calls");
`deriveWaitingStages` reads only already-emitted `project.*` fields; the git-shelling
is in `src/scan.mjs` (`gitInfo`). The real barrier to a client-side phase two is
ADR-0001's *convention* (the page doesn't import scan-side lib.mjs), not an
impossibility. RESOLVED: the false claim is corrected throughout; the Recommended
Decision decides the two-phase non-blocking delivery and leaves the phase-two LOCUS
(server-recompute vs client-re-derive) explicitly open, with the real tradeoff as the
lead Open question and the single-source invariant (waitingOn === waitingStages[0])
flagged as a phase-two design constraint (client-re-derive preserves it by construction).

Confirmed grounded (no change): `gh` is the sole network/slow input in the scan
(buildGhContext is the only gh caller; git is local; everything else disk); disk-only
scanAll ≈1.38s cold / 0.72s warm vs ≈8.6s with gh (~6× first-paint win) — orchestrator-
probed; honest kill criteria (disk floor approaching enriched time; pop-in confusion →
Option C cache).

Reviewer prompt: review.py frame-critique docs/decisions/adr-0007-non-blocking-pr-enrichment.md
(+ ADR-0006, src/server.mjs, src/scan.mjs, src/lib.mjs, public/render.mjs).
