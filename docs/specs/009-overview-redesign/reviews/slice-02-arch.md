---
slice: 009-02 — waiting-on state + finish-first ordering (the triage signal)
pass: arch
verdict: pass
reviewer: arch-review
reviewed_at: 2026-09-01T00:26:57Z
prompt_source: review.py arch-review --richer-skill arch-review (orchestrator-dispatched)
substrate: shown
applied_skill: arch-review
shown_candidates: [arch-review:high-confidence, design-jury:high-confidence, design-review:high-confidence, access:speculative, agent-development:speculative, agents-sdk:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, build-to-redline:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, cloudflare:speculative, cloudflare-email-service:speculative, cloudflare-one:speculative, cloudflare-one-migrations:speculative, command-development:speculative, compass:speculative, configure:speculative, content-fidelity:speculative, cutline:speculative, design-brief:speculative, design-clinic:speculative, design-eval:speculative, design-tweaks:speculative, durable-objects:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, feedback-mode:speculative, frontend-design:speculative, hook-development:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, new-project:speculative, next-piece:speculative, open:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, pr-review:speculative, project-artifact:speculative, project-desk:speculative, ready-to-archive:speculative, receipts:speculative, redline-request:speculative, release-check:speculative, release-slate:speculative, sandbox-sdk:speculative, scope:speculative, scope-audit:speculative, servo:agent-loop:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:quality-gate:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, skill-creator:speculative, skill-development:speculative, snapshot:speculative, turnstile-spin:speculative, web-perf:speculative, workers-best-practices:speculative, wrangler:speculative, writing-hookify-rules:speculative]
---

Arch pass (arch-review rubric, read-only general-purpose reviewer). Verdict: PASS — no blockers. 283/283 tests green.

The scan-side/browser boundary the slice declares is genuinely held: all derivation lives in src/lib.mjs (deriveWaitingOn); src/scan.mjs emits waitingOn: {state,verb,action,rank}; public/render.mjs imports nothing and only reads the field. verb/rank are front-loaded scan-side so the browser stays purely presentational — the correct seam for the zero-dep architecture (ADR-0001). Missing/absent waitingOn (error/non-jig projects) handled symmetrically both sides (scanProject omits it; render degrades to the compass line and waitingOnRank returns 7/Idle-equivalent).

Strengths: boundary held for real not just by comment; single priority-cascade matching the pinned total order, no browser-side state→rank/verb table; absent-field contract coherent both sides; External rank 6 a documented unreachable placeholder (no fabricated signal), appropriate for 009-04.

Nits (all non-blocking → reconciliation log):
- [nit][impl] src/lib.mjs:627 — WAITING_ON_VERB has Ready/External/Idle entries never read (forcedWaitingOn normalizes to a You-state; derived path hardcodes verbs inline). Dead — trim for leanness.
- [nit][impl] public/index.html:105-108 / render.mjs:191 — emitted `state` doubles as CSS class fragment (rv-${state}), coupling payload contract to stylesheet selectors. Safe today; worth a one-line note.
- [nit][spec] docs/architecture.md:172-180,214-238 — Contract surfaces (GET /api/data) + render.mjs module list not yet updated for waitingOn or the new helpers (nextMoveCell, sortProjectsByWaitingOn, waitingOnRank). Consistent with 009-01's treatment; close at reconciliation.
