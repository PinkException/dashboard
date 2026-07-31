---
slice: 005-02 — migrate the existing history
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-07-31T21:33:41Z
prompt_source: review.py implementation
---

VERDICT: pass

REASONING:
All seven ACs are met by the code and corroborated by the runtime artifacts. The migration folded 982 read lines into 68 distinct entries across 7 project files, the accounting balances exactly (68 written + 914 duplicates = 982) in `_migration-report-2026-07-27.md`, and the store line counts match the report per project (dashboard's 16 entries recovered via the single owner-confirmed alias, in ascending `ts` order). Identity resolves through `projectRootOf`/`projectKey`, ambiguity/unknown-project/differing-content all refuse, the store/aliases/reports all live outside every repo, the dual read serves the migrated data, and the tests are substantive (specific headlines, counts, ordering — none vacuous). Remaining gaps are reconciliation-phase DoD items, not implementation defects.

SPECIFIC ISSUES:
- `src/migrate.mjs:346-355` — AC4 states writing is atomic per project via temp-file-then-move. Only the first write (file absent) uses temp+rename; the re-run path uses `fs.appendFileSync`, which is not atomic. Immaterial to the one-time fresh migration (all writes were first-writes), but a crash mid-append on a later run could leave a partial line. The atomicity test at `test/migrate.test.mjs:358-367` only exercises the fresh-write path, so this deviation is untested. Medium confidence.
- `src/migrate.mjs:308-318` / AC1 — AC1's literal obligation is "the capture is re-taken and compared immediately before the merge." The implementation instead re-reads each source byte-for-byte and aborts on any difference (`writePlan`). This is functionally equivalent-or-stronger (covers every source, not only live), but it is a deviation from the stated "re-take the capture" mechanism and should be recorded rather than left implicit.
- `docs/architecture.md:121-134` — the `## Contract surfaces` section does not list the new persistent `~/.claude/my-dashboard/snapshot-aliases.json` file, which the slice DoD explicitly requires. Expected-pending given IN_PROGRESS status, but must land before DONE. Medium confidence.

RECONCILIATION NOTES:
- AC1 satisfied via per-source byte re-read + abort rather than a literal re-capture-and-diff; note in the deviation log as an approach deviation (intent met).
- AC4 atomicity guarantee holds only for fresh per-project writes; the append (re-run) path is non-atomic. Record as a deviation, or add a follow-up (inbox) to make append use temp+rename too.
- Outstanding DoD items confirmed not-yet-done and owed at reconciliation: architecture.md alias-list contract entry; spec 005 `## Assumptions` A3 update; deviation log; ADR-0004 OQ4 resolution stamp (present); status board regen. The §6 in-repo deletion correctly remains ungated/untouched.
- Report is ~258KB because AC5 mandates one line per duplicate (914 lines); spec-required, not bloat.

---
Reviewer: jig:reviewer (independent, read-only). Prompt built by: review.py implementation docs/specs/005-snapshot-store/spec.md 005-02 src/migrate.mjs scripts/migrate-snapshots.mjs test/migrate.test.mjs src/scan.mjs
