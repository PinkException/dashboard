---
slice: 009-03 — cross-project action-queue lens
pass: craft
verdict: pass
reviewer: general-purpose (pr-review rubric)
reviewed_at: 2026-09-01T18:35:43Z
prompt_source: review.py pr-review --richer-skill pr-review
substrate: shown
applied_skill: pr-review
shown_candidates: [pr-review:high-confidence, servo:agent-loop:high-confidence, servo:quality-gate:high-confidence, access:speculative, agent-development:speculative, agents-sdk:speculative, arch-review:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, build-to-redline:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, cloudflare:speculative, cloudflare-email-service:speculative, cloudflare-one:speculative, cloudflare-one-migrations:speculative, command-development:speculative, compass:speculative, configure:speculative, content-fidelity:speculative, cutline:speculative, design-brief:speculative, design-clinic:speculative, design-eval:speculative, design-jury:speculative, design-review:speculative, design-tweaks:speculative, durable-objects:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, feedback-mode:speculative, frontend-design:speculative, hook-development:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, new-project:speculative, next-piece:speculative, open:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, project-artifact:speculative, project-desk:speculative, ready-to-archive:speculative, receipts:speculative, redline-request:speculative, release-check:speculative, release-slate:speculative, sandbox-sdk:speculative, scope:speculative, scope-audit:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, skill-creator:speculative, skill-development:speculative, snapshot:speculative, turnstile-spin:speculative, web-perf:speculative, workers-best-practices:speculative, wrangler:speculative, writing-hookify-rules:speculative]
---

Craft pass (pr-review rubric) on slice 009-03 (read-only). VERDICT: pass (after one fix round).

First pass raised ONE [blocker][impl]: the lens-preservation glue was dead — `openDetail` dropped `state.lens`, so opening a project from the queue then pressing "← overview" landed on the grid, not the queue. RESOLVED: `openDetail(path, lens='overview')` / `closeDetail(lens='overview')` now carry the lens through the pure, tested layer; the DOM handler passes `state.lens` into both call sites (open, back, and the not-found fallback). A new round-trip test (test/render.test.mjs) covers it. Re-review confirmed the fix holds and the 009-01/009-02 default path (no lens arg → 'overview') is unchanged.

Two [nit] companion tests that asserted on hand-built local constants (vacuous) were rewritten to call `actionQueue` directly (flatten-includes-every-project; groups rank-ascending under reversed input) — now genuine mutation guards.

Strengths: the collect-all-candidates / head-is-`deriveWaitingOn` single-source refactor with per-state non-regression tests is textbook (grid and queue cannot disagree); `lensToggleHtml` shares one markup source across both lenses; `actionQueueHtml` renders an honest empty state and holds the file's uniform-shell / esc() / no-src-import discipline.

Reconciliation-log items (non-blocking, deferred): (1) `src/scan.mjs` derives the stage list twice per project (deriveWaitingOn internally calls deriveWaitingStages, then it's called again) — cheap, correctness-neutral; (2) emitted queue groups carry an unused `verb` field (rows render their own verb) — dead field.
