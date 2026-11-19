---
slice: 012-03 — saved order and narrative extras from snapshots
pass: craft
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-11-18T22:56:23Z
prompt_source: review.py pr-review --richer-skill pr-review
substrate: shown
applied_skill: pr-review
shown_candidates: [pr-review:high-confidence, servo:agent-loop:high-confidence, servo:autonomy-readiness:high-confidence, servo:quality-gate:high-confidence, access:speculative, agent-development:speculative, agents-sdk:speculative, arch-review:speculative, breakdown-diagnosis:speculative, breakdown-to-next-report:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, build-to-redline:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, climb:speculative, cloudflare:speculative, cloudflare-email-service:speculative, cloudflare-one:speculative, cloudflare-one-migrations:speculative, codex-cli-runtime:speculative, codex-result-handling:speculative, command-development:speculative, compass:speculative, configure:speculative, content-fidelity:speculative, custom-connector:speculative, customer-inquiry-intake:speculative, cutline:speculative, daily-production-report:speculative, data-consolidate:speculative, design-brief:speculative, design-clinic:speculative, design-consistency-pass:speculative, design-eval:speculative, design-jury:speculative, design-review:speculative, design-space-explore:speculative, design-tweaks:speculative, durable-objects:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, faq:speculative, feedback-mode:speculative, frontend-design:speculative, gpt-5-4-prompting:speculative, hackathon:speculative, hook-development:speculative, inbox-triage:speculative, inspection-to-capa:speculative, m5-onboard:speculative, math-olympiad:speculative, maturity:speculative, mcp-integration:speculative, morning-plant-pulse:speculative, ncr-writeup:speculative, new-project:speculative, next-piece:speculative, office-hours:speculative, onboarding:speculative, open:speculative, patterns:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, project-artifact:speculative, project-desk:speculative, quote-build:speculative, ready-to-archive:speculative, receipts:speculative, redline-request:speculative, release-check:speculative, release-slate:speculative, rfq-to-quote:speculative, root-cause-capa:speculative, routines:speculative, sandbox-sdk:speculative, scope:speculative, scope-audit:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, siege:speculative, simple-list:speculative, skill-creator:speculative, skill-development:speculative, snapshot:speculative, solo:speculative, supplier-escape-to-alternate-source:speculative, supplier-quote-request:speculative, trade-study-report:speculative, turnstile-spin:speculative, web-perf:speculative, workers-best-practices:speculative, wrangler:speculative, writing-hookify-rules:speculative]
---

VERDICT: pass (on round-1 code)

REASONING:
No blockers. The writer validates before its single appendFileSync, all new render text goes through esc (tested), tests isolate stores via DASHBOARD_SNAPSHOTS + mkdtemp and never touch ~/.claude.

SPECIFIC ISSUES:
- [nit][impl] reader trusted stored block types (numeric dates, layers:[null]) — FIXED: parseCompassHistory accepts only blocks passing validateRoadmapBlock; ISO-string dates required.
- [nit][impl] duplicated SKILL.md sentence — FIXED.
- [nit][impl] no CSS for rm-order / rm-extras / rm-layers / rm-locked — deferred to 014-03 (roadmap restyle); logged.
- [nit][impl] order-label wording built twice — FIXED: single `orderLabel` helper.
- [nit][impl] `--move` silently ignored other modes; `--source` overrode copied source; `--all` accepted with `--move`/`--print-order` — FIXED: argConflict refusals.
- [nit][impl] readSavedEntries re-reads the store — left; logged.
- [nit][spec] DONE slices of in-progress specs hidden in flow mode; spec id missing from flow titles — FIXED (done fold via doneInFlight; slice-less spec runs keep id).
- [nit][impl] test gaps (compass strip, --move refusals, --print-order "yours") — FIXED with mutation-checked tests.
- [nit][impl] A3 tests are tolerance probes, not mutation-testable — noted.
- [strength][impl] single pure mergeSavedOrder for tab + writer.
- [strength][impl] writer alone decides order/orderOrigin/dates.
- [strength][impl] CLI tests run the real script against temp project + store dirs with invented names.

RECONCILIATION NOTES:
Stale proxy; CLI refusal set; missing CSS deferred to 014-03; tolerance-probe tests.

PROVENANCE (orchestrator note): this verdict was given on the round-1 code. Items marked FIXED were fixed afterwards in compliance rounds 2-3 and verified by the compliance re-reviews (round 4 pass); this pass was not re-run on the final code. The ADR-0004 amendment was written after this review.
