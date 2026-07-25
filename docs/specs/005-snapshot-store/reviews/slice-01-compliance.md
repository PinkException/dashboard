---
slice: 005-01 — relocate the snapshot store
pass: compliance
verdict: pass
reviewer: jig:reviewer (independent, multi-round)
reviewed_at: 2026-07-25T00:56:49Z
prompt_source: review.py compliance docs/specs/005-snapshot-store/spec.md 005-01
---

Compliance pass on slice 005-01, three independent rounds (fresh reviewer each).

All six acceptance criteria met, with evidence:
- AC1 writer targets snapshotFileFor() only; asserted by a git status --porcelain
  before/after comparison plus a "no docs/status/ created" check.
- AC2 resolveSnapshotsDir() derives from resolveConfigPath(); both branches tested.
- AC3 (as narrowed) worktree folds into parent; sub-directory, submodule and
  same-basename cases all kept distinct and tested.
- AC4 dual-source read picks by ts via laterSnapshot, never concatenation;
  malformed counts summed. Equal-ts covered at unit and integration level.
- AC5 day-one in-repo-only path unchanged, including staleness; neither-source
  path yields no compass and no warning.
- AC6 56/56 green, hermetic — every suite touching scanProject pins
  DASHBOARD_SNAPSHOTS to a temp dir.

Rounds 1 and 2 returned needs-changes and found real defects, all fixed:
1. test/scan.test.mjs read the developer's real home store (blocker, found
   independently by both the compliance and craft reviewers). A test run had
   already written into the live store; that residue was moved out.
2. projectKey merged a sub-directory of a repo into that repo's key —
   cross-contamination ADR-0004 OQ4 names. Fixed with a --show-toplevel guard.
3. Stale prose contradicting the shipped behaviour in architecture.md (module
   boundary + file tree), skills/open/SKILL.md (shipped plugin text), README.md,
   docs/inbox.md, and — most seriously — CLAUDE.md, whose always-loaded primer
   still instructed a future session to add the snapshot write back to compass.
   All corrected.
4. Weaker-than-criterion tests (worktree fork asserted a count not a filename;
   AC5 omitted staleness; equal-ts untested at integration level). All tightened.

No scope creep: nothing migrated, nothing deleted.
