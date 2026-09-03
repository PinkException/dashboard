---
slice: 009-04 — gh-optional PR enrichment (un-defers 003-03)
pass: craft
verdict: pass
reviewer: general-purpose (pr-review)
reviewed_at: 2026-09-01T23:14:51Z
prompt_source: review.py pr-review --richer-skill pr-review
substrate: shown
applied_skill: pr-review
shown_candidates: [pr-review:high-confidence, servo:agent-loop:high-confidence, servo:quality-gate:high-confidence, access:speculative, agent-development:speculative, agents-sdk:speculative, arch-review:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, build-to-redline:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, cloudflare:speculative, cloudflare-email-service:speculative, cloudflare-one:speculative, cloudflare-one-migrations:speculative, command-development:speculative, compass:speculative, configure:speculative, content-fidelity:speculative, cutline:speculative, design-brief:speculative, design-clinic:speculative, design-eval:speculative, design-jury:speculative, design-review:speculative, design-tweaks:speculative, durable-objects:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, feedback-mode:speculative, frontend-design:speculative, hook-development:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, new-project:speculative, next-piece:speculative, open:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, project-artifact:speculative, project-desk:speculative, ready-to-archive:speculative, receipts:speculative, redline-request:speculative, release-check:speculative, release-slate:speculative, sandbox-sdk:speculative, scope:speculative, scope-audit:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, skill-creator:speculative, skill-development:speculative, snapshot:speculative, turnstile-spin:speculative, web-perf:speculative, workers-best-practices:speculative, wrangler:speculative, writing-hookify-rules:speculative]
---

Craft pass (general-purpose, read-only, richer skill: pr-review). VERDICT: pass —
no blockers. Four strengths: the injectable `buildGhContext` DI seam (hermetic
tests, no host-gh dependence); genuinely total graceful degradation (missing
binary / unauth / unresolvable login / timeout / bad JSON / non-git dir all → no
PR signal; arg-array execFileSync = no shell-injection surface; non-jig early
return = no gh call); `deriveWaitingOn` stays pure with an OPTIONAL 3rd arg
(2-arg contract preserved + tested), owner-identity guard encoded as a named
regression test; new `.rv-External`/`.pr-*` CSS reuses existing light+dark tokens
and is correctly recessive.

Nits — two fixed at reconciliation, two accepted:
- **[nit][spec] A4′ team-review contradiction — FIXED.** A4′ says a team-requested
  PR is no-signal/never-mis-filed, but the External branch would have filed a
  team-only request (no per-user login) as External. Reconciled code→assumption:
  the External branch now counts only User review-requests (a `.login`); a
  team-only request yields no signal. Named regression test added.
- **[nit][impl] `gh pr list` had no `--limit` — FIXED.** gh caps at 30; added
  `--limit 100` so the REVIEW/External scan isn't silently truncated.
- **[nit][impl] MERGE tiebreak — accepted (no change).** RECONCILED slice wins the
  headline over an approved PR; the PR still shows in the detail view, rank-1
  MERGE/You preserved, deterministic + tested.
- **[nit][impl] present-path network latency — accepted trade (no change).**
  N+1 serial synchronous gh calls, no per-request cache; bounded per-call at
  GH_TIMEOUT_MS. Recorded in the deviation log + parked to inbox as a
  cache/budget follow-up.

Coverage note (not a defect): the detailView→prsDetailBlock "awaiting your review"
hint threading is unit-tested via direct prsDetailBlock calls; the whole-view
integration test exercises the APPROVED (login-independent) hint. No new test is
vacuous (several assert the whole waitingOn object via deepEqual).

Reviewer prompt: review.py pr-review --richer-skill pr-review over src/lib.mjs +
src/scan.mjs + public/render.mjs + public/index.html + tests.
