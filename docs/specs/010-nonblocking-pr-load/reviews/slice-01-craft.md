---
slice: 010-01 — two-phase load: disk-first render, gh PR states fold in
pass: craft
verdict: pass
reviewer: general-purpose (pr-review)
reviewed_at: 2026-09-02T23:48:58Z
prompt_source: review.py pr-review --richer-skill pr-review
substrate: shown
applied_skill: pr-review
shown_candidates: [pr-review:high-confidence, servo:agent-loop:high-confidence, servo:quality-gate:high-confidence, access:speculative, agent-development:speculative, agents-sdk:speculative, arch-review:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, build-to-redline:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, cloudflare:speculative, cloudflare-email-service:speculative, cloudflare-one:speculative, cloudflare-one-migrations:speculative, command-development:speculative, compass:speculative, configure:speculative, content-fidelity:speculative, cutline:speculative, design-brief:speculative, design-clinic:speculative, design-eval:speculative, design-jury:speculative, design-review:speculative, design-tweaks:speculative, durable-objects:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, feedback-mode:speculative, frontend-design:speculative, hook-development:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, new-project:speculative, next-piece:speculative, open:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, project-artifact:speculative, project-desk:speculative, ready-to-archive:speculative, receipts:speculative, redline-request:speculative, release-check:speculative, release-slate:speculative, sandbox-sdk:speculative, scope:speculative, scope-audit:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, skill-creator:speculative, skill-development:speculative, snapshot:speculative, turnstile-spin:speculative, web-perf:speculative, workers-best-practices:speculative, wrangler:speculative, writing-hookify-rules:speculative]
---

Craft pass (general-purpose, read-only, richer skill: pr-review). VERDICT: pass —
no blockers. Strengths: phase-two re-render routes through the module-level `state`,
so a navigation during the enrichment window re-renders the correct view (fire-and-
forget is navigation-safe); prDeltas/mergePrDeltas share one conditional-key contract
and carry waitingOn+waitingStages together (AC5 survives); the disabledGhSpy asserts
listPRs is NEVER called on the /api/data path (guards the "no gh cost on first paint"
claim, non-vacuous).

Nits — one fixed, two logged:
- [nit][impl] FIXED: the loadPrs try/catch spanned mergePrDeltas + render(), so it
  would swallow a genuine merge/render bug, not just a network failure. Narrowed the
  try to the fetch+json only; merge/render now run after it, so real programming
  errors reach the console while gh-absent/offline/timeout still degrade silently (AC4).
- [nit][impl] LOGGED: the active-tab capture/restore duplicates the click-handler's
  DOM-flip and currently preserves the *inert* Activity placeholder (reserved, empty).
  Candidate for a shared setActivityTab helper; kept as-is (forward-looking for when
  Activity carries content) — deviation-log item, not fixed here.
- [nit][impl] LOGGED: loadPrs's client-side AC3/AC4 behaviour is untested inline
  index.html glue — consistent with the repo's boundary (only render.mjs pure
  functions are unit-tested); note, not fix.
- [nit][impl] LOGGED: activityTabWasActive is captured before the await, so a tab
  switch *during* the fetch is lost — low impact (short window, inert tab).

Reviewer prompt: review.py pr-review --richer-skill pr-review over server/scan/render/index + tests.
