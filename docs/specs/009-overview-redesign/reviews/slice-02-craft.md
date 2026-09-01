---
slice: 009-02 — waiting-on state + finish-first ordering (the triage signal)
pass: craft
verdict: pass
reviewer: pr-review
reviewed_at: 2026-09-01T00:30:32Z
prompt_source: review.py pr-review --richer-skill pr-review (orchestrator-dispatched)
substrate: shown
applied_skill: pr-review
shown_candidates: [pr-review:high-confidence, servo:agent-loop:high-confidence, servo:quality-gate:high-confidence, access:speculative, agent-development:speculative, agents-sdk:speculative, arch-review:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, build-to-redline:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, cloudflare:speculative, cloudflare-email-service:speculative, cloudflare-one:speculative, cloudflare-one-migrations:speculative, command-development:speculative, compass:speculative, configure:speculative, content-fidelity:speculative, cutline:speculative, design-brief:speculative, design-clinic:speculative, design-eval:speculative, design-jury:speculative, design-review:speculative, design-tweaks:speculative, durable-objects:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, feedback-mode:speculative, frontend-design:speculative, hook-development:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, new-project:speculative, next-piece:speculative, open:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, project-artifact:speculative, project-desk:speculative, ready-to-archive:speculative, receipts:speculative, redline-request:speculative, release-check:speculative, release-slate:speculative, sandbox-sdk:speculative, scope:speculative, scope-audit:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, skill-creator:speculative, skill-development:speculative, snapshot:speculative, turnstile-spin:speculative, web-perf:speculative, workers-best-practices:speculative, wrangler:speculative, writing-hookify-rules:speculative]
---

Craft pass (pr-review rubric, read-only general-purpose reviewer). Verdict: PASS — no blockers. Suite green (282 after nit cleanup).

Implementation matches the slice's stated scope exactly: a scan-side pure derivation (deriveWaitingOn + helpers) emitting one waitingOn field, a browser-side headline render, finish-first ordering, and the owner-marker backstop, with the ADR-0001 browser/scan boundary preserved (render.mjs never imports src/lib.mjs). Precedence coded in the exact pinned total order; every payload-shape assumption traces to real scanProject output; robust to missing fields (early-return non-jig projects, absent waitingOn, non-string blockers). Anchored by a genuine end-to-end scan integration test (test/scan.test.mjs) asserting exact deriveWaitingOn output through the full pipeline — not vacuous.

Strengths: state-normalization guard in forcedWaitingOn (unknown marker.state → DECIDE, no unstyled CSS class); real-fixture end-to-end scan test; browser/scan boundary intact and commented; needsYou reaches scanProject via loadConfig's existing `...p` passthrough (AC3 needed no config-schema change).

Nits — all addressed post-review:
- forcedWaitingOn empty-action edge → FIXED: empty/missing action on a forced object marker now defaults per-state (land/review/decide) so the headline never silently drops.
- two redundant "mutation check" tests (lib.test.mjs) → REMOVED.
No blocker-tagged findings. Vacuous-test check: none remain.
