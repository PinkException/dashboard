---
slice: 006-02 — the owner-gated install path
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (fresh-context, Opus)
reviewed_at: 2026-08-04T19:17:39Z
prompt_source: review.py frame-critique
---

Pre-implementation frame-critique on slice 006-02. Run twice (fresh-context reviewer, Opus).

Round 1 → needs-changes. Two load-bearing findings, both confirmed against the real files:

1. AC1 over-claimed. It stated writes are "owner-gated, enforced in code," but the mechanism is a `--approved-by-owner` CLI flag. A1 (verified against `~/.claude/settings.json` + `guard-jig-prompts.py`) confirms the guardrail matches only Write|Edit, so this installer deliberately writes via Bash-run Node to avoid interception — meaning the flag is the *only* real protection on the armed scheduler, and the flag is set by whoever composes the command (the agent, not the owner directly). A flag cannot prove owner identity. ADR-0005 Consequences already scope it honestly ("operator discipline plus the in-code approval flag"); the slice had inflated that into a guarantee the design cannot deliver.

2. AC3's first-install exception contradicted A2. A2 (probed) establishes the `compass-snapshots` scheduler entry already exists with a stale pre-005-04 SKILL.md present. AC3 exempted only "no manifest, no live file" from hand-edit treatment — but the real first-install state is "no manifest, live file present, differs from source," which was left undefined. That undefined branch is the actual happy path (landing 005-04 content over the stale orphan).

Fixes applied to the slice:
- AC1 rewritten to scope the enforceable promise as "presence of an explicit approval signal, not proof of owner identity," aligned verbatim with ADR-0005 Consequences. Enforceable promise = no unflagged write, every run.
- AC3 rewritten to define two refuse cases (hand-edited managed file; unmanaged pre-existing file with no manifest) — both protected, both need `--force` to adopt. Only a true clean slate (no manifest AND no live file) is a free first install.
- AC5/AC6 made consistent: the real first landing is `install --approved-by-owner --force`; the unmanaged-file path is a named test case.

Round 2 → pass. Both findings resolved; the frame survives. Note for the deviation log: the "owner gate" is a friction / approval-signal plus operator discipline, not identity enforcement — consistent with ADR-0005 and A1.
