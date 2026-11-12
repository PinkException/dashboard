---
bug: 002
pass: bug-review
verdict: pass
reviewer: jig:reviewer (independent, fresh)
reviewed_at: 2026-11-12T01:06:48Z
prompt_source: review.py bug-review docs/bugs/002-compass-writer-still-active.md scripts/snapshot.mjs test/snapshot-store.test.mjs
---

Bug-review pass on bug 002 (fresh independent jig:reviewer, 2026-11-11). Verdict: pass.

- Root cause, not symptom: the hardcoded in-repo target is gone. scripts/snapshot.mjs
  writes only to snapshotFileFor(root) in the dashboard-owned store. The compass half
  was retired by the owner (verified against its SKILL.md). The routine shells out to
  the same script, so it is covered as well.
- Regression test: test/snapshot-store.test.mjs AC1 runs the real script as a subprocess
  against a real git repo and asserts three things: the write lands in the store, no
  docs/status/ is created, and git status --porcelain is unchanged. It also covers the
  worktree case and an unwritable store. The test would fail on the old code. The
  red-before-fix run was asserted at the time but not captured.
- Blast radius: searched scripts/ src/ tools/ skills/ prompts/ public/ for docs/status,
  writeFileSync and appendFileSync. The only remaining docs/status reference is a read
  in src/scan.mjs. No other writer touches a surveyed project.
- Scope: narrow. Blockers: none.
- Non-blocking record nits, fixed in the record: the routine row was stale, the
  :63-65 line refs are pre-fix, and closure provenance (legacy, pre-schema) was
  added under a Closure section.
