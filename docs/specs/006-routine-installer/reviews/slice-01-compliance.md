---
slice: 006-01 — routine source, ADR, and read-only drift check
pass: compliance
verdict: pass
reviewer: jig:reviewer (fresh-context, Opus)
reviewed_at: 2026-08-04T18:01:04Z
prompt_source: review.py implementation
---

Compliance pass on 006-01 → pass. All five ACs met: routine source expresses the 005-04 behaviour (node scripts/snapshot.mjs --all --auto --if-changed; no --commit invocation; cites ADR-0004; tilde paths only; no project-dashboard/ADR-0002); ADR-0005 Accepted + indexed with three rejected alternatives; `check` is genuinely read-only (only fs.readFileSync, no write path) with distinct exit codes; tests non-vacuous, temp-dir-scoped, assert the target byte-for-byte unchanged. Two nits, both addressed post-review: formatDrift's fallback label (reworded to name reorder/duplicate) and the untested USAGE/AC4 CLI paths (dedicated CLI tests added). check-only scope (install deferred to 006-02) is per spec.
