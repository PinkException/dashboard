---
slice: 005-01 — relocate the snapshot store
pass: craft
verdict: pass
reviewer: jig:reviewer (independent, multi-round)
reviewed_at: 2026-07-25T00:56:49Z
prompt_source: review.py craft docs/specs/005-snapshot-store/spec.md 005-01
---

Craft pass on slice 005-01. Final verdict: pass.

Strengths the reviewer called out: the two load-bearing guards in repoRootOf
(sub-directory, submodule) are correct and covered by tests that would fail on a
naive implementation; every suite pins DASHBOARD_SNAPSHOTS so the tests cannot
read the developer's real store; the worktree test asserts the exact parent-keyed
filename rather than a file count, with a comment explaining why a count would
not catch a fork.

Findings fixed after the pass:
- Batch writer resilience: mkdir/append sat outside the per-project error-return
  convention, so one EACCES/ENOTDIR would abort every remaining project in an
  --all run (the store is one shared directory, unlike the old per-project
  target). Now returns a structured error; regression test asserts a handled
  error rather than an unhandled stack trace.
- Tautological assertion in the laterSnapshot NaN test (same object both sides).
- Comment overstated determinism: keyCache is never invalidated, so a root that
  becomes a repo keeps its earlier key for the process lifetime. Comment now
  says so.
- Windows separator sensitivity in the realpath fallback comparison; both sides
  now path.resolve'd.
- `sources` comment did not match the code (counts sources with >=1 line).
- node:crypto import moved back into the builtins block.
- lib.mjs now states the unparseable-ts branches guard direct callers only.

Accepted as-is: bug 002 sits at REVIEWED rather than DONE, which BUG_CLOSED does
not treat as closed, so the dashboard still shows it open. Deliberate — the fix
is branch-only until the slice lands.
