---
status: DRAFT
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
- ✅ Spec 013 approved by the owner (placement in the Activity tab confirmed).
- ✅ Snapshot store and schema stable (ADR-0004, spec 005 DONE).
- ⬜ If spec 012-03 has landed by then, merge `origin/main` first: both edit
  `parseCompassHistory` (spec Assumption A3).

**Acceptance Criteria:**

1. **Series reader (pure).** A new pure function in `src/lib.mjs` turns a
   project's store lines into a series
   `[{ts, done, total, source, headline?}]`, sorted oldest first. It keeps only
   entries that carry a numeric `specs.done` and `specs.total`. Entries without
   `specs` (legacy compass shape) and malformed lines are **skipped and
   counted**, never guessed. `headline` is included only for narrative entries
   (`source` is not `auto`).
2. **Payload.** `scanCompass` attaches `project.history = {points, skipped}` to
   the `/api/data` payload. `points` holds at most the **200 newest** points
   (spec Assumption A2). `project.compass` is unchanged, and so is every
   existing field (an additive contract change).
3. **Activity tab enabled.** The Activity tab is no longer `disabled`. Its panel
   shows the chart first, then the existing token-usage "coming soon" line
   below it.
4. **Chart shape.** `evolutionChartSvg(points, now)` in `public/render.mjs`
   returns inline SVG with no dependencies:
   - **done** is drawn as a step line (it holds its value until the next point)
     and is extended to `now`.
   - **total** is drawn as a fainter step line on the same axes.
   - the x-axis is time, labelled with the first date and "now". The y-axis
     runs from 0 to the maximum `total` seen.
   - narrative points are drawn as dots. Each dot has an SVG `<title>` holding
     its date and headline, so hovering a dot shows it.
   - colours come from the existing CSS tokens (`--blue`, `--green`, `--track`),
     so light and dark themes both work.
5. **Honest empty states.**
   - **0 points:** the panel says "No progress history yet." and names
     `/dashboard:snapshot` as the way to start one.
   - **1 point:** the panel says "One snapshot so far (<date>): N of M specs
     done. The chart needs two." No chart is drawn.
   - **skipped > 0:** a one-line note says "K older entries have no progress
     numbers and are not shown."
6. **Tests.** Unit tests cover the series reader (legacy and malformed skips,
   sorting, the 200 cap, headline only on narrative entries) and
   `evolutionChartSvg` (the step-path points for a known series, extension to
   `now`, dots carrying `<title>`, and both empty states). Fixtures use invented
   project names only (leak gate).

**Anti-horizontal-phasing check:** after this slice, the owner opens any
project, clicks Activity, and sees whether it has been moving or stalled, and
for how long.

**DoD:**
- [ ] All ACs pass; full test suite green (`npm test`), no regressions.
- [ ] Each new test shown to fail when its feature is removed.
- [ ] Compliance, craft and arch reviews passed (`review.py`).
- [ ] Live check: `/dashboard:open`, Activity tab shows a chart for a project
      with 2+ points and an empty state for one with 0 or 1, in both themes.
- [ ] Deviation log and reconciliation sweep produced; reconciliation review
      passed.
- [ ] `docs/architecture.md` updated for `project.history`.

### Deviation log (after reconciliation)

_Filled at reconciliation._

### Reconciliation sweep

_Filled at reconciliation._
