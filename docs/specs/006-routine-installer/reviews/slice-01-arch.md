---
slice: 006-01 — routine source, ADR, and read-only drift check
pass: arch
verdict: pass
reviewer: jig:reviewer (fresh-context, Opus)
reviewed_at: 2026-08-04T18:01:05Z
prompt_source: review.py arch-review
---

Arch pass on 006-01 → pass. The repo→scheduler boundary is well-designed and faithfully realized as check-only: checkDrift is pure and writes nothing, the live dir is gated behind DASHBOARD_SCHEDULER_DIR (mirrors DASHBOARD_SNAPSHOTS), distinct exit codes, and the CLI hard-refuses any command but check (the write path genuinely does not exist yet). The tools/ -> src/scan.mjs (expandHome) dependency follows the scripts/snapshot.mjs precedent. ADR-0005 is sound, weighs four alternatives honestly, and flags the load-bearing guardrail-matches-Write|Edit fragility. Zero-dep principle honored. Reconciliation items: (a) update docs/architecture.md with the prompts/ source dir + tools/install-routine.mjs boundary; (b) note the deliberate Node re-expression of the night-worker's Python installer (accepted duplication per ADR-0005); (c) nit — expandHome fits lib.mjs's pure/no-fs charter better than scan.mjs, but relocating it is pre-existing and out of scope here (inbox note).
