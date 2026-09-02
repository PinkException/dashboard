---
slice: 010-01 — two-phase load: disk-first render, gh PR states fold in
pass: arch
verdict: pass
reviewer: general-purpose (arch-review)
reviewed_at: 2026-09-02T23:48:58Z
prompt_source: review.py arch-review --richer-skill arch-review
substrate: shown
applied_skill: arch-review
shown_candidates: [arch-review:high-confidence, design-jury:high-confidence, design-review:high-confidence, access:speculative, agent-development:speculative, agents-sdk:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, build-to-redline:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, cloudflare:speculative, cloudflare-email-service:speculative, cloudflare-one:speculative, cloudflare-one-migrations:speculative, command-development:speculative, compass:speculative, configure:speculative, content-fidelity:speculative, cutline:speculative, design-brief:speculative, design-clinic:speculative, design-eval:speculative, design-tweaks:speculative, durable-objects:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, feedback-mode:speculative, frontend-design:speculative, hook-development:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, new-project:speculative, next-piece:speculative, open:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, pr-review:speculative, project-artifact:speculative, project-desk:speculative, ready-to-archive:speculative, receipts:speculative, redline-request:speculative, release-check:speculative, release-slate:speculative, sandbox-sdk:speculative, scope:speculative, scope-audit:speculative, servo:agent-loop:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:quality-gate:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, skill-creator:speculative, skill-development:speculative, snapshot:speculative, turnstile-spin:speculative, web-perf:speculative, workers-best-practices:speculative, wrangler:speculative, writing-hookify-rules:speculative]
---

Arch pass (general-purpose, read-only, richer skill: arch-review). VERDICT: pass —
no blockers. The transport split honours the load-bearing boundaries: derivation stays
server-side (prDeltas + phase-two scanAll run deriveWaitingStages on the server; the
browser's mergePrDeltas is a pure keyed field-swap, NOT derivation), so ADR-0001's
"browser never derives / never imports lib.mjs" holds. /api/data's contract change
(drops prs/ownerLogin) + the new /api/prs delta endpoint have exactly one consumer
(public/index.html), updated in lockstep — no external break. Matches ADR-0007's chosen
server-side-deltas locus + accepted A5 double-scan; reuses DISABLED_GH, no new branch.
Strengths: mergePrDeltas swaps opaque server objects (computes nothing); waitingOn +
waitingStages swapped atomically from one delta (AC5); the stateless double-scan is the
right leanness call (no cross-request cache/staleness machinery).

- [nit][impl] FIXED: mergePrDeltas overwrote waitingOn/waitingStages unconditionally
  while guarding prs/ownerLogin — safe today but a latent footgun (a future partial
  delta could wipe a phase-one headline). Guarded the pair with `in` (swap only when
  BOTH present, together) + a comment making the atomic-swap intent explicit.

RECONCILIATION (architecture.md — the big sweep item, both compliance + arch flagged):
- Update `## Contract surfaces`: /api/data is now disk-only (no prs/ownerLogin); add the
  new /api/prs surface `{ generatedAt, projects:[{path, ownerLogin?, prs?, waitingOn,
  waitingStages}] }` keyed on path + its degrade-to-disk-values-on-gh-failure contract.
- Update the tech-stack/module lines that still say "/api/data → fresh rescan" and
  "index.html fetches only /api/data".
- Contract-evolution note: dropping prs/ownerLogin from /api/data is the first
  NON-additive change to a surface whose policy is "additive evolution preferred" —
  acceptable (single localhost consumer, lockstep) but must be stated, not inferred.

Reviewer prompt: review.py arch-review --richer-skill arch-review over server/scan/render/index + tests.
