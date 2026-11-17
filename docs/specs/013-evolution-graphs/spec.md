---
status: DRAFT
skill:
use_cases: [UC-1, UC-3]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 013: Evolution graphs

> Show how each project's progress changed over time: a chart drawn from the
> snapshot history the dashboard already keeps in
> `~/.claude/my-dashboard/snapshots/` (ADR-0004), instead of only the latest
> entry.

**What changes:** the scanner stops throwing away every snapshot line except
the latest. It passes a small per-project progress series to the page. The
detail view's **Activity** tab, a disabled placeholder today, goes live with a
"progress over time" chart: specs done against specs total, drawn as a step line
in zero-dependency inline SVG (ADR-0001, ADR-0006). Later slices add a small
trend sparkline on the overview row and richer data (slice and bug counts).

**Why it matters:** the owner asked for this view (ADR-0004 OQ2, resolved YES on
2026-07-24). Today the page answers "where is it now", but not "is it moving".
A project that has been stuck for three weeks looks the same as one that
finished four specs this week.

**Main tradeoff:** the history is **thin and step-shaped**. The automatic
routine writes only when progress changes (slice 005-04's `--if-changed`), and
that routine is currently stopped by the owner. The only stored numbers are
`specs.done` and `specs.total`. So slice 01 charts honestly what exists: a
staircase with few steps. Better granularity (slice and bug counts) needs a
writer change, which is parked in slice 03 rather than blocking the first chart.

## Current state (verified 2026-11-17)

- **Entry schema.** The writer builds `{v:1, ts, specs:{done,total}, headline,
  next?, blockers?, source}` (`scripts/snapshot.mjs:88-121`), and
  `validateSnapshot` checks it (`src/lib.mjs:225-255`). The only numeric,
  chartable fields are `specs.done` and `specs.total`. The bug count exists only
  inside the auto `headline` string.
- **Legacy entries.** Older compass-written entries have no `v`, no `specs` and
  no `source`. Their `counts` object has keys that vary from entry to entry, so
  it is not a usable series. In the live store, 5 of 97 entries have this shape
  and 92 carry `specs` (aggregate count only, taken 2026-11-17).
- **Reader.** `parseCompassHistory` (`src/lib.mjs:176-202`) returns only
  `{latest, latestNarrative, malformed, count}`. `scanCompass`
  (`src/scan.mjs:562-584`) puts one entry on `project.compass`. **No history
  reaches the client, and nothing returns a time series today.**
- **Volume.** 12 store files, 97 lines in total. Lines per file: min 1,
  median about 5, max 17. Timestamps run from 2026-07 to 2026-11.
- **Cadence.** The auto guard's signature is `{done, total, next}`, compared
  only with the newest same-source entry; the bug count is excluded
  (`scripts/snapshot.mjs:47-62`). A gap in the series therefore means "no
  change", not "no data" (slice 005-04).
- **UI slot.** `detailView` (`public/render.mjs:532-616`) has
  `TAB_NAMES = ['overview','roadmap','activity']`. Activity is rendered
  `disabled`, with `activityTabPlaceholder()` reading "coming soon … Token usage
  will show here" (`public/render.mjs:458-468`). The existing inline-SVG
  helpers are `progressBarSvg` (:84-95) and `flightCellsSvg` (:97-111).

## Assumptions

- **A1 — Sparse data still makes a useful chart.** With a median of about 5
  points per project, and the routine stopped, a chart may look nearly flat. We
  assume a step line extended to "now" still reads as real information (the
  length of a flat run *is* the signal). If the owner finds the first chart
  uninformative, the answer is slice 03 plus re-enabling the routine, not a
  denser fake series.
- **A2 — Payload size is negligible.** At about 100 entries in total, sending a
  per-project series in `/api/data` adds only a few KB. It is not measured;
  slice 01 caps the series length (AC2) so this holds even if history grows.
- **A3 — Spec 012-03 also edits `parseCompassHistory`.** Both specs add a reader
  to the same parser. Whichever lands second must merge `origin/main` before
  reconciling (memory: integrate before reconcile).

## Decomposition

SPIDR analysis (Spike is the last resort; none needed: the data shape is known).

- **Data (D):** chart only what is stored today (`specs.done/total`) first
  (slice 01). Add richer fields (slice-level counts, open bugs) later, because
  they need a writer change (slice 03).
- **Interface (I):** the full chart in the detail view first (slice 01). The
  glance-row sparkline on the overview is an interface extension (slice 02).
- **Rules (R):** legacy entries without `specs` are skipped and counted, not
  guessed (slice 01). Where narrative entries sit on the chart is a rule in
  slice 01.
- **Path (P):** the empty / one-point / many-point paths all live in slice 01,
  because each is a few lines of rendering.

Every slice touches the page, so none is horizontal.

## Slices

- [013-01 — progress-over-time chart in the Activity tab](slice-01-progress-chart.md)
- [013-02 — trend sparkline on the overview row](slice-02-glance-sparkline.md)
- [013-03 — slice and bug counts in the series](slice-03-richer-series.md)

## Non-goals

- Token usage, time spent or hours (the other reserved Activity content). Those
  stay their own later specs, and the Activity tab keeps a placeholder line for
  them.
- Back-filling past progress from git history. ADR-0004 rejected derived
  history; past values come only from the store.
- Re-enabling the `compass-snapshots` routine. That is the owner's call, not
  this spec's.
- Cross-project comparison charts.
