---
slice: 012-03 — saved order and narrative extras from snapshots
pass: arch
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-11-18T22:56:23Z
prompt_source: review.py arch-review --richer-skill arch-review
substrate: shown
applied_skill: arch-review
shown_candidates: [arch-review:high-confidence, design-jury:high-confidence, design-review:high-confidence, access:speculative, agent-development:speculative, agents-sdk:speculative, breakdown-diagnosis:speculative, breakdown-to-next-report:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, build-to-redline:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, climb:speculative, cloudflare:speculative, cloudflare-email-service:speculative, cloudflare-one:speculative, cloudflare-one-migrations:speculative, codex-cli-runtime:speculative, codex-result-handling:speculative, command-development:speculative, compass:speculative, configure:speculative, content-fidelity:speculative, custom-connector:speculative, customer-inquiry-intake:speculative, cutline:speculative, daily-production-report:speculative, data-consolidate:speculative, design-brief:speculative, design-clinic:speculative, design-consistency-pass:speculative, design-eval:speculative, design-space-explore:speculative, design-tweaks:speculative, durable-objects:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, faq:speculative, feedback-mode:speculative, frontend-design:speculative, gpt-5-4-prompting:speculative, hackathon:speculative, hook-development:speculative, inbox-triage:speculative, inspection-to-capa:speculative, m5-onboard:speculative, math-olympiad:speculative, maturity:speculative, mcp-integration:speculative, morning-plant-pulse:speculative, ncr-writeup:speculative, new-project:speculative, next-piece:speculative, office-hours:speculative, onboarding:speculative, open:speculative, patterns:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, pr-review:speculative, project-artifact:speculative, project-desk:speculative, quote-build:speculative, ready-to-archive:speculative, receipts:speculative, redline-request:speculative, release-check:speculative, release-slate:speculative, rfq-to-quote:speculative, root-cause-capa:speculative, routines:speculative, sandbox-sdk:speculative, scope:speculative, scope-audit:speculative, servo:agent-loop:speculative, servo:autonomy-readiness:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:quality-gate:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, siege:speculative, simple-list:speculative, skill-creator:speculative, skill-development:speculative, snapshot:speculative, solo:speculative, supplier-escape-to-alternate-source:speculative, supplier-quote-request:speculative, trade-study-report:speculative, turnstile-spin:speculative, web-perf:speculative, workers-best-practices:speculative, wrangler:speculative, writing-hookify-rules:speculative]
---

VERDICT: pass (on round-1 code)

REASONING:
Boundaries in docs/architecture.md intact: snapshot.mjs stays the only writer; order logic in one pure mergeSavedOrder (src/lib.mjs) used by tab and writer; page renders scanner output only (ADR-0001); no new deps. `roadmap` is a true additive line-format change (v stays 1, headline still required, auto entries never carry it).

SPECIFIC ISSUES:
- [strength][impl] deriveSavedPart layers on the automatic order; no saved entry → 012-01/02 behaviour unchanged.
- [strength][impl] writer is the only place order/orderOrigin is decided; LLM proposal cannot overwrite a correction.
- [strength][impl] roadmap stripped from card compass payload.
- [strength][impl] progressSignature + roadmap leaves the auto routine unchanged.
- [nit][impl] reader passed layers/locked unchecked — FIXED (validateRoadmapBlock gate in parseCompassHistory).
- [nit][impl] autoOrder exposed on /api/data — kept; documented in architecture.md.
- [nit][impl] order wording built twice — FIXED (orderLabel).
- [nit][impl] --move second read path via readSavedEntries — left; logged.

RECONCILIATION NOTES:
ADR-0004 needs a dated amendment, not a new ADR (ADR-0002's forward-compat rule covers it) — done 2026-11-18. architecture.md snapshot file contract, /api/data, snapshot.mjs module line updated.

PROVENANCE (orchestrator note): this verdict was given on the round-1 code. Items marked FIXED were fixed afterwards in compliance rounds 2-3 and verified by the compliance re-reviews (round 4 pass); this pass was not re-run on the final code. The ADR-0004 amendment was written after this review.
