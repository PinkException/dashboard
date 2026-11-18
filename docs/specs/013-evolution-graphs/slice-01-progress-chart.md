---
status: READY_FOR_IMPLEMENTATION
dependencies: []
last_verified:
frame_review: true
arch_review: true
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on
     first use and link the term to docs/memory/glossary.md (or jig's lexicon).
     See docs/workflow.md "Self-defining vocabulary". -->

## Slice 013-01 — progress-over-time chart in the Activity tab

**Goal:** opening a project's **Activity** tab shows a step chart of specs done
(and specs total) over time, built from that project's snapshot history.

`arch_review: true` because this slice adds a field to the `/api/data`
contract (`project.history`) and a second reader over the store.

**DoR:**
- ✅ Placement in the Activity tab confirmed by the owner (2026-11-17; the
  Overview tab was the rejected alternative, because it is already full).
- ✅ Approved by the owner for implementation (2026-11-17), after the
  frame-critique passed.
- ✅ Snapshot store and schema stable (ADR-0004, spec 005 DONE).
- ⬜ If spec 012-03 has landed by then, merge `origin/main` first: both edit
  `parseCompassHistory` (spec Assumption A3).

**Acceptance Criteria:**

1. **Series reader (pure).** A new pure function in `src/lib.mjs` turns a
   project's **store** lines into a series
   `[{ts, done, total, source, headline?}]`, sorted oldest first. It is given
   only the store-file lines (`fromStore` in `scanCompass`), never the legacy
   in-repo `docs/status/compass-history.jsonl`. Those files were removed under
   ADR-0004 §6, and the store holds their history. `project.compass` keeps
   reading both sources exactly as today. It keeps only entries that carry a
   numeric `specs.done` and `specs.total`. Entries without `specs` (legacy
   compass shape) and malformed lines are **skipped and counted separately**
   (`noNumbers`, `malformed`), never guessed. An entry with numbers but a
   missing or unparseable `ts` counts as `malformed`. `headline` is included
   only for narrative entries (`source` is not `auto`). The reader itself caps
   the output at the **200 newest** points (spec Assumption A2).
2. **Payload.** `scanCompass` is widened to also return its store-file lines.
   This is a contract change inside `src/scan.mjs`, and it touches the same
   function as 012-03 (spec A3). `scanProject`, which holds both those lines and
   the live `progress`, attaches
   `project.history = {points, live, skipped: {noNumbers, malformed}}` to the
   `/api/data` payload. `live = {done, total}` is the current scan's
   `progress.done` / `progress.denom`, the same values the writer stores as
   `specs` (`scripts/snapshot.mjs:121`). `project.compass` is unchanged, and so
   is every existing field (an additive contract change).
3. **Activity tab enabled.** The Activity tab is no longer `disabled`. Its panel
   shows the chart first, then whatever "coming soon" line the Activity panel
   carries when this slice is built. Today that is the token-usage line; the
   v1.3 design (spec 014) words it as "specs shipped, slices reviewed, bugs
   found". The chart does not depend on which wording is there.
4. **Chart shape.** `evolutionChartSvg(history, now)` in `public/render.mjs`
   returns inline SVG with no dependencies:
   - **done** is drawn as a **solid** step line through the stored points (it
     holds its value until the next point).
   - **From the last stored point to `now`** the line is **dashed**, and it ends
     at the live value. So progress since the last snapshot shows up as a dashed
     step at "now" instead of a false flat run. A caption reads "last snapshot N
     days ago" (spec Assumption A1).
   - **total** is drawn as a fainter step line on the same axes, following the
     same solid-then-dashed rule.
   - the x-axis is time, labelled with the first date and "now". The y-axis
     runs from 0 to the maximum `total` seen, live value included.
   - narrative points are drawn as dots. Each dot has an SVG `<title>` holding
     its date and headline, so hovering a dot shows it.
   - a **downward step in `done` or `total`** (including the dashed stretch to
     the live value) gets a marker. Its `<title>` reads "count went down: a spec
     was reopened or abandoned, the snapshot was taken on another branch or
     worktree, or the counting rule changed". It is never smoothed away
     (measured: 3 such steps in 92 stored points, spec A1).
   - colours come from the existing CSS tokens (`--blue`, `--green`, `--track`),
     never hard-coded hex values, so light and dark themes both work. If the
     v1.3 redesign (spec 014) gives those tokens new values, the chart follows
     automatically. If it renames them, the chart moves to the new names in the
     same change.
5. **Honest empty states.**
   - **0 stored points:** no chart. The panel says "No progress history yet.
     Today: N of M specs done." and names `/dashboard:snapshot` as the way to
     start one.
   - **1 or more stored points:** the chart is drawn. With a single stored point
     it is just the dashed stretch from that point to the live value.
   - **skipped:** one neutral line, shown only when non-zero: "Not shown: K
     entries without progress numbers, J unreadable lines." Either part is
     omitted when it is zero.
6. **Tests.** Unit tests cover:
   - the series reader: legacy and malformed skips counted separately, sorting,
     the 200 cap, headline only on narrative entries, store-only input.
   - `evolutionChartSvg`: the solid step path for a known series, the dashed
     stretch ending at the live value, the "last snapshot N days ago" caption,
     dots carrying `<title>`, the downward-step marker, and the 0-point empty
     state.

   Fixtures use invented project names only (leak gate).

**Anti-horizontal-phasing check:** after this slice, the owner opens any
project, clicks Activity, and sees how it moved between snapshots, plus how much
has changed since the last one (the dashed stretch to today). A flat solid run
means "recorded as unchanged"; a long dashed run means "not recorded lately".

**DoD:**
- [ ] All ACs pass; full test suite green (`npm test`), no regressions.
- [ ] Each new test shown to fail when its feature is removed.
- [ ] Compliance, craft and arch reviews passed (`review.py`).
- [ ] Live check: `/dashboard:open`, Activity tab shows a chart for a project
      with stored points and the empty state for one with 0, in both themes.
- [ ] Owner looks at the live chart and confirms it is useful at spec-level
      granularity. This gates 013-02 (sparkline) and prioritises 013-03
      (frame-critique round 3).
- [ ] Deviation log and reconciliation sweep produced; reconciliation review
      passed.
- [ ] `docs/architecture.md` updated for `project.history`.

### Deviation log (after reconciliation)

_Filled at reconciliation._

### Reconciliation sweep

_Filled at reconciliation._
