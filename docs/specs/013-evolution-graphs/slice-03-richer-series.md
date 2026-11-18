---
status: IN_PROGRESS
dependencies: [013-01]
last_verified: 2026-11-18
frame_review: true
arch_review: true
claimed_by: claude/slice-013-03-richer-series
---

## Slice 013-03 — slice and bug counts in the series

**Goal:** the chart can show progress at **slice** level (and open bugs), not
only at spec level, so a multi-slice spec stops looking frozen until it fully
finishes.

The writer explicitly hands this to "the future evolution-chart spec"
(`scripts/snapshot.mjs:53-55`, `docs/architecture.md:103-106`).

**DoR:**
- ✅ 013-01 DONE. Owner verdict 2026-11-18 ("needs more info") makes this
  slice the next priority in spec 013.
- ✅ Owner decision (2026-11-18): **yes**, the auto guard (`--if-changed`) also
  fires when the slice count changes. Denser data is the point of this slice;
  it affects only `auto` entries, and the auto routine is currently stopped.
- ✅ Owner decision (2026-11-18): the **cadence source** for new entries is
  slice 012-04 (`/dashboard:end-of-day`, one snapshot per project worked on,
  run each evening). Not chosen: restarting the stopped auto routine, or a
  manual-snapshot habit. See Assumption A1.
- ✅ Frame-critique passed (2 rounds, `reviews/slice-03-frame-critique.md`);
  approved by the owner for implementation (2026-11-18).

**Assumptions:**
- **A1 — the richer series fills only as new entries are written.** No
  back-fill (spec 013 non-goal, ADR-0004), so all existing entries lack
  `slices`, and the auto routine is stopped. The slice line therefore appears
  once 012-04 is built and run (or a manual `/dashboard:snapshot` is taken);
  until then the visible gain of this slice is AC7 (labels and key). Building
  013-03 **before** 012-04 is deliberate: every end-of-day snapshot then
  carries `slices` from its first run (frame-critique 2026-11-18, round 1).
  **Residual risk (round 2):** an end-of-day entry is still gated by the
  snapshot skill's thin-day bar (`skills/snapshot/SKILL.md` step 3), and slice
  progress counts only once merged to the scanned root, so the line may stay
  step-shaped. If it does, the remaining lever is the stopped auto routine,
  which AC4 already makes slice-aware. **Ordering:** this relies on 013-03
  landing before 012-04 (chain 012-02 → 012-03 → 012-04); if 012-04 lands
  first, its entries simply lack `slices` until 013-03 ships.

**Current state (verified 2026-11-18 on `main`):**
- The scanner already computes slice progress: `result.sliceProgress =
  progressOf(allSlices)` (`src/scan.mjs`), shape `{done, denom, ...}` with
  ABANDONED excluded from `denom`, the same rule as `specs`. Open bugs are
  `result.counts.bugs.open`. The branch is known to `scanWorktreeSpecs`.
- The writer (`scripts/snapshot.mjs` `writeSnapshot`) stores only `specs`.
  `progressSignature` hashes `specs.done`, `specs.total` and `next`.
- `validateSnapshot` (`src/lib.mjs`) checks only `v`, `ts`, `headline`,
  `next`, `blockers`, `specs`.
- The 013-01 chart has no axis label and no key; the owner could not tell what
  the vertical axis measured (inbox, 2026-11-18).

**Acceptance Criteria:**

1. **Writer: new optional fields.** Every new entry (auto and narrative) also
   carries `slices: {done, total}` and `bugs: {open}`. Slices are counted over
   **real slices only** (a `slice-*.md` with a `status:`; the `realSlices` rule,
   `src/lib.mjs`), not `sliceProgress`, which also counts status-less files as
   UNKNOWN and would inflate `total` (frame-critique 2026-11-18). `total`
   excludes ABANDONED, as `specs.total` does. `slices` is omitted when the
   project has no real slices. This is an
   additive change to the ADR-0002/ADR-0004 entry contract: old entries stay
   valid, and readers ignore fields they do not know.
2. **Writer: provenance.** Every new entry carries `scanned: {branch,
   worktree}`: the branch checked out at the scanned root (`null` if detached
   or unknown) and `worktree: true` when the scanned root is a linked worktree
   (it differs from `projectRootOf(root)`).
3. **Validator.** `validateSnapshot` accepts the three fields when well-formed
   and rejects malformed ones (`slices` without numeric `done`/`total`, `bugs`
   without numeric `open`, `scanned` with a non-string-non-null `branch` or a
   non-boolean `worktree`). Entries without them stay valid.
4. **Cadence (owner decision).** `progressSignature` also includes
   `slices.done` and `slices.total`, so `--if-changed` writes an auto entry when
   a slice finishes or is added. `bugs` and `scanned` stay out of the signature
   (005-04 rationale: churn, not progress). An older stored entry without
   `slices` compared against a new one with them counts as **changed** once, so
   the first slice-carrying auto entry is always written.
5. **Reader.** `buildProgressSeries` passes `slices`, `bugs` and `scanned`
   through on each point when present and well-formed; `history.live` gains
   `slices` from the current scan. Malformed extra fields are dropped from the
   point (the point itself is kept, since `specs` is valid).
6. **Chart: slice line.** When at least 1 stored point carries `slices`, the
   chart draws a **slice done** line from the first such point (solid stored
   part, dashed to the live value, same rules as 013-01 AC4 and AC5, so one
   stored point gives just the dashed stretch) and a fainter slice-total line,
   on their own y-scale (0 to max slice total, live included). The spec lines
   stay as they are. With no such point, the chart is the 013-01 chart plus
   AC7's labels and key.
7. **Chart: labels and key.** The chart says what it measures: a y-axis label
   ("specs", or "slices" for the slice scale) and a small key naming each line
   drawn (spec done, spec total, and the slice lines when shown). Colours come
   from CSS tokens only, as in 013-01.
8. **Chart: precise down-steps.** A down-step marker whose two points carry
   `scanned` and differ in branch or worktree says so ("counted on another
   branch or worktree: <branch>"). Without `scanned` on both sides it keeps the
   013-01 wording listing every cause.
9. **Tests.** Mixed old and new entries in one series; validator accept and
   reject cases; signature change on a slice-only change and no change on a
   bug-only change; the old-entry-vs-new-entry first write; slice line drawn from
   1 point and absent at 0; labels and key present; the precise down-step
   wording. Fixtures use invented project names (leak gate).

**Anti-horizontal-phasing check:** after this slice, the owner can read what
each line and axis means without asking (AC7), and every new snapshot carries
slice counts. Once 012-04's end-of-day snapshots run (A1), a project finishing
slices inside one long spec shows a rising line instead of a flat one.

**DoD:**
- [x] ACs 1-9 pass; full suite green (`npm test`: 443/443, baseline 430; 13 new
      tests in `test/richer-series.test.mjs`).
- [x] Each new test shown to fail when its feature is removed: 19 isolated
      mutations (real-only slice filter, null-when-none, `bugs`, `scanned`, each
      of the 3 validator branches, signature without slices, signature with
      bugs, malformed-slices drop, scanned passthrough, `live.slices`, slice
      lines, first-slice-point start, key, y label, slice key entries, precise
      down-step wording, equal-scanned wording). All killed by a 013-03 test.
- [x] `docs/architecture.md` updated (entry fields, `history` point and `live`
      fields, signature and the retired spec-granular note).
- [ ] Compliance, craft and arch reviews recorded (post-implementation review).

### Deviation log (after reconciliation)

1. **Test superseded.** 013-01 AC2's test asserted `history.live` deep-equals
   `{done, total}`; its fixture has slices, so `live` now also carries
   `slices`. The assertion was narrowed to the two 013-01 fields (labelled in
   the test).
2. **Provenance helper.** `scannedProvenance(root)` is a new export of
   `src/scan.mjs` (wraps `listWorktrees`), so the payload from `scanProject` is
   unchanged; only the writer calls it.
3. **Chart choices not fixed by the ACs:** with slice lines shown, the right
   margin widens (10 to 34) for a slice scale; slice lines use `--green` (done)
   and `--text-muted` at 50% opacity (total); no down-step markers for the
   slice lines (AC8 speaks of spec steps only); the key is an HTML row under the
   SVG. When both points carry equal `scanned`, the generic 013-01 wording is
   kept, as AC8 only specifies the differing and missing cases.
4. **Number check.** The shared shape checks require finite numbers (`NaN` and
   `Infinity` rejected), slightly stricter than `typeof === 'number'`.

### Reconciliation sweep

_Filled at reconciliation._
