---
slice: 005-01 — relocate the snapshot store
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (independent, multi-round)
reviewed_at: 2026-07-25T00:56:49Z
prompt_source: review.py frame-critique docs/specs/005-snapshot-store/spec.md 005-01
---

Frame-critique pass on slice 005-01 (declared frame_review: true).

The reviewer conceded location, dual-read and worktree-fold: A1's mitigation
(nothing removed, so a hidden consumer degrades to stale rather than breaking)
holds, A2's memoization bounds the added subprocess cost, and laterSnapshot
resolves the read-order problem correctly.

It found one undeclared load-bearing assumption, which was verified and is real:
**a project's filesystem path is not a durable identity.** projectKey is
sha256(realpath(repo root)), so a moved or renamed project gets a new key. This
is falsified by a case ADR-0004 records about this very repo — 16 of the 193
backed-up entries live under the old project-dashboard path and "belong to this
project's series". Folding on path alone in 005-02 would split one project's
history in two, recreating the fragmentation the store exists to remove, and
ADR-0004 §6's "every entry accounted for" check cannot catch it because every
entry is present somewhere.

Resolved by scoping honestly rather than by widening this slice:
- Declared as spec assumption A3, with the writer-side cost (bounded) separated
  from the migration-side cost (not acceptable).
- AC3 renamed to "free of *path* collisions" and explicitly disclaims stability
  across moves.
- AC3's fourth bullet no longer claims projectKey is the 005-02 migration
  mapping; 005-02 must add an alias/rekey step, recorded as the top input to
  ADR-0004 OQ4.

Its secondary finding — two submodules of one superproject collapsing to
<super>/.git/modules and sharing a key — was probe-confirmed against real
submodules and fixed in code, with a regression test.
