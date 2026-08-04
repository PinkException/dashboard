---
slice: 006-01 — routine source, ADR, and read-only drift check
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (fresh-context, Opus)
reviewed_at: 2026-08-04T17:51:06Z
prompt_source: review.py frame-critique
---

Pre-implementation frame-critique on slice 006-01. Run twice.

Round 1 → needs-changes. A1 (guardrail matches only Write|Edit → Bash-run installer not intercepted; check writes nothing) verified sound. But AC1 required the repo source to be "byte-identical to the 005-04 rebuilt routine" — and that routine was NEVER committed: it exists only as prose in the 005-04 spec plus ephemeral staged content, while the live scheduler copy is the OLD orphaned routine (project-dashboard path, --commit, ADR-0002). So there was no canonical artifact to match; "byte-identical" was unfalsifiable, and 006-01 is actually the first durable, reviewed record of the routine text.

Fixed: AC1 now asserts falsifiable content requirements (invokes --all --auto --if-changed; no --commit; current paths; cites ADR-0004; never names project-dashboard/ADR-0002; passes no-leaks) rather than identity to a nonexistent copy, and states the SKILL.md is authored + reviewed here as the first durable record. DoR provenance corrected. Overview/Decomposition "Move"/"becomes" reworded to "author".

Round 2 → pass. Unfalsifiability resolved; provenance honestly stated; the permanent-drift signal during 006-01 is correct-and-intended (live is stale until 006-02 installs), not misleading. No other load-bearing assumption exposed. Note for reconciliation: the new ADR (AC2) will take the next free dashboard number.
