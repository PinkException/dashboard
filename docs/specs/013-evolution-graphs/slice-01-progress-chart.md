---
status: RECONCILED
dependencies: []
last_verified: 2026-11-17
frame_review: true
arch_review: true
claimed_by: claude/slice-013-01-progress-chart
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
- ✅ If spec 012-03 has landed by then, merge `origin/main` first: both edit
  `parseCompassHistory` (spec Assumption A3). Checked at pickup (2026-11-17):
  012-03 was still READY_FOR_IMPLEMENTATION on main (`e1e4393`), so there was
  nothing to merge.

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
- [x] All ACs pass; full test suite green (`npm test`: 430/430), no regressions.
- [x] Each new test shown to fail when its feature is removed. The implementer
      ran 10 mutations, cumulatively, with two inferred rather than isolated
      (deviation 4). The null-source test was witnessed red before its fix.
- [x] Compliance, craft and arch reviews passed (`review.py`; `reviews/`).
- [x] Live check (2026-11-17, this branch's server on a side port): the
      Activity tab draws the chart for a real project with 11 stored points,
      in both dark and light themes. The empty state for 0 points was **not**
      seen live, because every configured project has at least 2 points; it is
      covered by unit test only.
- [ ] Owner looks at the live chart and confirms it is useful at spec-level
      granularity. This gates 013-02 (sparkline) and prioritises 013-03
      (frame-critique round 3). **Open, and handed to the owner.**
- [x] Deviation log and reconciliation sweep produced; reconciliation review
      passed.
- [x] `docs/architecture.md` updated for `project.history`.

### Deviation log (after reconciliation)

The ACs above are preserved as written. Deviations:

1. **The reader takes raw text.** `buildProgressSeries(text)` takes the store
   file's raw text, not a list of lines. To feed it, `scanCompass` returns an
   internal `storeText` (never serialized). The store text is therefore parsed
   twice per scan, once for `compass` and once for `history`. This is
   accepted at the current size; merging the two is a candidate when 012-03
   widens `parseCompassHistory` (spec A3).
2. **Caption wording.** AC4 says "last snapshot N days ago". The build says
   "today" for under a day and "1 day ago" for exactly one, with tests added
   during review.
3. **The page computes two things.** Down-step markers and the caption are
   computed in `public/render.mjs`, as the spec's
   `evolutionChartSvg(history, now)` signature requires. This is the one
   exception to "scanner derives, page presents". It is named in a code comment
   and in `docs/architecture.md`.
4. **Mutation evidence.** The implementer's 10 mutations ran cumulatively after
   a backup step failed. Two (empty state, dot filter) added no separate
   failures and are inferred. All were reverted, and the final run is green.
5. **Review fixes folded in.** Untagged entries now carry `source: null`
   (previously `undefined`, which dropped the key from the JSON). The dead
   `.tab.disabled` CSS was removed. The render comment that claimed "no
   derivation" was corrected.
6. **Test superseded.** A 012-01 test asserting that the Activity tab is
   `disabled` was rewritten in place and labelled as superseded by 013-01 AC3.
7. **Not in the spec, chosen in the build:** a fixed 560x160 viewBox, and the
   `.evo-*` CSS classes. A dot needs a string headline; a narrative entry
   without one gets no dot. That is harmless today, because narrative writers
   always set a headline.
8. **Signature widening.** `detailView` gained an optional `opts.now`, so the
   chart can be tested with a fixed clock. Callers that omit it get the real
   time.
9. **Store read refactor.** `scanCompass` now reads the store with `readIf`
   and calls `parseCompassHistory` inline, instead of using `readSource`, so the
   same text can also feed `history`. Behaviour of `compass` is unchanged.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | The front door describes the dashboard generally; the Activity tab is a detail-view feature. |
| `docs/specs/README.md` | `updated` | Regenerated by `workflow.py status-board`. |
| `docs/product-vision.md` | `no-op` | Served under UC-1/UC-3 as the spec declares; no scope change. |
| `docs/architecture.md` | `updated` | `/api/data` contract: `history` (jig-managed only, store-only, `source` may be `null`, the page's two computed annotations). |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` | `deferred` | Spec 013 is not closed (013-02 and 013-03 are DRAFT). The Active-specs line is added when the PR lands, so the primer is not edited on a feature branch that may change. |
| `docs/inbox.md` | `updated` | Added the follow-ups: double parse (merge with 012-03), dots needing a headline, duplicate down-marker titles. |
| `docs/refinement-todo.md` | `no-op` | No deferred decision; the owner's usefulness check is tracked in the DoD. |
| `docs/memory/**` | `no-op` | Nothing new worth persisting; the existing memories (npm test, leak gate, integrate before reconcile) were applied. |
| `docs/decisions/README.md` / ADR index | `no-op` | No ADR touched. The additive contract change sits within ADR-0001 and ADR-0006 (inline-SVG charts). |
| `.claude/launch.json` | `no-op` | A local preview config created for the live check. Git-ignored (root `/.claude/`), so not committed. |
| `reviews/.candidates/*.json` | `no-op` | Tool sidecars from `review.py candidates` (run metadata only). Deleted, not committed: no other spec commits them. |
| Framing-phase files: `spec.md`, `slice-02-*.md`, `slice-03-*.md`, `reviews/slice-01-frame-critique.md` | `no-op` | Changed in earlier PRs (#19 draft and frame-critique, #20 v1.3 fit), before implementation. This slice did not touch them. |
