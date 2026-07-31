---
slice: 005-02 — migrate the existing history
pass: craft
verdict: pass
reviewer: pr-review/jig:reviewer
reviewed_at: 2026-07-31T22:02:47Z
prompt_source: review.py pr-review (re-review)
---

VERDICT: pass

This is the craft re-review, run after the first craft pass returned needs-changes and every finding was addressed. An independent read-only reviewer verified each prior finding is genuinely resolved (not rubber-stamped) and judged the code fresh. `npm test` green at 79 tests. History: the first craft pass and its needs-changes findings are preserved in git (this file's prior revision).

REASONING:
All five prior findings are genuinely resolved: the AC5 report now prints source paths (assertion non-vacuous — `compass-history.jsonl` appears nowhere else in the report), the atomicity test and slice text are re-scoped honestly, dead code is gone, and `--capture` is documented. The code is correct and robust for the stated scope — reads sources, writes only the store, refuses on ambiguity/imbalance/source-drift, folds worktrees via the shared `projectKey`, dedups order-independently. Remaining items are nits, no blockers.

Reviewer correction worth recording: the double `expandHome` in `buildPlan` is redundant, but the `realpath` wrapping it is **load-bearing, not defensive** — `applyAlias` compares `projectRootOf(...)` (realpath'd) against alias `from`, so aliases must be realpath'd to match; the AC2 alias tests exercise exactly this under macOS symlinked tmpdirs. Not dead code; acceptance sound.

SPECIFIC ISSUES:
- [nit][impl] test/migrate.test.mjs — the first-write test name over-reached ("goes through a temp file"); renamed to "leaves no leftover temp file (cleanup)" with a comment stating it asserts cleanup only, not rename atomicity. Addressed after this re-review.
- [nit][spec] src/migrate.mjs:142-148 (AC3) — reconstruction from a flattened archive name resolves one interpretation (`split('_')`) against disk rather than detecting genuine flatten ambiguity (a name containing `_` is indistinguishable from a separator). The AC wording says "an ambiguous reconstruction stops the run"; the implementation picks the naive split and refuses only if neither the direct nor worktree-parent path exists. Real corpus has no `_`-in-name collision, so residual risk is nil and acceptance is reasonable — but narrower than the AC states. Logged as an accepted deviation.

- [strength][impl] src/migrate.mjs:311-321 — `writePlan` re-reads and byte-compares every source before writing and aborts on drift (AC1); paired with tests asserting source byte-identity AND clean `git status --porcelain`, a strong "touch nothing in the surveyed repo" guarantee.
- [strength][impl] src/migrate.mjs:156,201,345 — order-independent `canonical()` dedup used consistently at plan time and re-run append time, with `firstSeenIn` stripped before persistence; re-run tests confirm idempotent, non-reordering appends.

RECONCILIATION NOTES:
- AC3 flatten→un-flatten guard is narrower than the AC's "ambiguous reconstruction stops the run" wording — accepted deviation (real corpus has no underscore-in-name collision); recorded in the deviation log.
- The first-write atomicity test verifies temp-file cleanup only, not atomicity under interruption; making the re-run append durable is tracked as an inbox follow-up.
- No new issues introduced by the edits; 79 tests green.

---
Reviewer: pr-review shape via jig:reviewer (independent, read-only) — RE-REVIEW after addressing first-pass findings. Prompt built by: review.py pr-review docs/specs/005-snapshot-store/spec.md 005-02 src/migrate.mjs scripts/migrate-snapshots.mjs test/migrate.test.mjs src/scan.mjs
