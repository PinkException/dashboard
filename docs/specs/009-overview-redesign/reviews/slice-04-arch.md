---
slice: 009-04 — gh-optional PR enrichment (un-defers 003-03)
pass: arch
verdict: pass
reviewer: general-purpose (arch-review)
reviewed_at: 2026-09-01T23:08:19Z
prompt_source: review.py arch-review --richer-skill arch-review
substrate: shown
applied_skill: arch-review
shown_candidates: [arch-review:high-confidence, design-jury:high-confidence, design-review:high-confidence, access:speculative, agent-development:speculative, agents-sdk:speculative, build-mcp-app:speculative, build-mcp-server:speculative, build-mcpb:speculative, build-to-redline:speculative, cardputer-buddy:speculative, claude-automation-recommender:speculative, claude-md-improver:speculative, claude-security:speculative, cloudflare:speculative, cloudflare-email-service:speculative, cloudflare-one:speculative, cloudflare-one-migrations:speculative, command-development:speculative, compass:speculative, configure:speculative, content-fidelity:speculative, cutline:speculative, design-brief:speculative, design-clinic:speculative, design-eval:speculative, design-tweaks:speculative, durable-objects:speculative, eval-authoring:speculative, example-command:speculative, example-skill:speculative, feedback-mode:speculative, frontend-design:speculative, hook-development:speculative, m5-onboard:speculative, math-olympiad:speculative, mcp-integration:speculative, new-project:speculative, next-piece:speculative, open:speculative, playground:speculative, plugin-settings:speculative, plugin-structure:speculative, pr-review:speculative, project-artifact:speculative, project-desk:speculative, ready-to-archive:speculative, receipts:speculative, redline-request:speculative, release-check:speculative, release-slate:speculative, sandbox-sdk:speculative, scope:speculative, scope-audit:speculative, servo:agent-loop:speculative, servo:edd-suitability:speculative, servo:execution-planner:speculative, servo:heartbeat:speculative, servo:oracle-hook:speculative, servo:quality-gate:speculative, servo:scaffold-init:speculative, servo:spec-oracle:speculative, session-report:speculative, shape-release:speculative, skill-creator:speculative, skill-development:speculative, snapshot:speculative, turnstile-spin:speculative, web-perf:speculative, workers-best-practices:speculative, wrangler:speculative, writing-hookify-rules:speculative]
---

Arch pass (general-purpose, read-only, richer skill: arch-review). VERDICT: pass.
The new `gh` external-binary boundary is architecturally clean: all I/O is
quarantined in `buildGhContext(run = execFileSync)` behind an injectable runner
seam; `deriveWaitingOn` stays pure (reads only `project.prs` + `ownerLogin`
params); every failure mode degrades to exact status-quo (AC2/AC3) uniformly;
the owner-identity guard skips REVIEW/External PR branches without a login, so
an owner-review PR is never mis-filed as External (the frame-critique failure
the slice was reframed to avoid). Two strengths called out: the testable seam
and the uniform degradation.

Neither issue blocks REVIEWED — both are `[nit][impl]` → reconciliation-sweep work:
- **[nit] docs/architecture.md stale.** `:51` "external services: none; only
  subprocess is git" is now false (gh is a second shelled binary + a network
  service); the src/scan.mjs module-boundary entry and the GET /api/data contract
  surface (new additive `prs` + `ownerLogin` fields) also lag. → architecture-impact
  gate in the sweep.
- **[nit] present-path network-latency envelope.** scanAll now runs 1 probe +
  N `gh pr list` calls via synchronous execFileSync, serialized on the node:http
  event loop, no per-request cache (src/scan.mjs + src/server.mjs:43). Healthy
  ~0.47s/call; worst case N×GH_TIMEOUT_MS (5s) of blocked wall time on a degraded
  network. Tolerable for a single-user localhost dashboard, but should be recorded
  as a conscious trade in the deviation log; revisit a short-TTL PR cache / scan
  budget if project counts grow.

Open questions (recorded, non-blocking): the availability probe is `gh api user`
(a GitHub API round-trip, required because AC1's REVIEW/External split needs the
owner login) not a local `gh --version` — its network cost is paid per page load;
worth a cross-request cache? Is there meant to be an aggregate scan-time budget
(each call bounded, the sum is not)?

Reviewer prompt: review.py arch-review (richer-skill arch-review) over
src/lib.mjs + src/scan.mjs + public/render.mjs + public/index.html + tests.
