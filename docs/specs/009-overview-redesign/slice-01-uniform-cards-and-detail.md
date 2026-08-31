---
status: DONE
dependencies: [adr-0006]
last_verified: 2026-08-31
design_review: true
frame_review: true
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on
     first use and link the term to docs/memory/glossary.md (or jig's lexicon). -->

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 009-01 — uniform triage rows + project detail view (the split)

> **Design authority = the built mockup, not the paraphrase.** ADR-0006 named
> Claude Design's mockup the authority for the surface's shape and used the word
> "card". The built v1.2 design realises the uniform glance layer as
> **uniform-height table _rows_**, not cards in a grid — an equal-height row per
> project fully removes the unequal-height symptom, which is the point. This
> slice builds **rows** to match the design authority; "card" in ADR-0006 is read
> as "the per-project glance unit". The measured design is the source of truth:
> [`docs/designs/dashboard-v1.2/redlines/`](../../designs/dashboard-v1.2/redlines/)
> — `base.md` (tokens: colours, type scale, spacing, `proj-grid`/`detail-grid`/
> `session-grid` columns, `row-min-h`), `console-overview.screen.md`, and
> `console-detail.screen.md`.

**Goal:** Replace the variable-height dense report with a **uniform-height row
per project** in a single scannable table, and move everything a row does not
show into an in-page per-project **detail view** opened by clicking the row —
delivering ADR-0006's legibility win (report → dashboard) with **no data loss and
no triage derivation yet**.

**DoR:**
- ✅ [ADR-0006](../../decisions/adr-0006-overview-triage-surface.md) Accepted
  (the glance/detail information architecture is fixed).
- ✅ Built, measured Claude Design v1.2 mockup present as the visual + redline
  reference:
  [`docs/designs/dashboard-v1.2/redlines/console-overview.render.png`](../../designs/dashboard-v1.2/redlines/console-overview.render.png)
  and `console-detail.render.png`, with the measurement cascade in the sibling
  `.md` files. (This is the reference the `design_review` gate scores against.)
- ✅ Most of what the rows + detail view render is already emitted by
  `scanProject` / `readAllSessions` (spec.md "Current state"). **Correction (frame
  critique, 2026-08-31):** three redline-demanded data are **not** emitted today
  and this slice adds them (small, additive, non-triage): (a) the per-project
  **description subtitle**, (b) each workstream's **next 1–3 unchecked item
  texts**, and (c) the **current-release-track membership** used to default the
  spec list. See AC2/AC5 and A-009-01. This slice therefore **does** touch
  `src/scan.mjs` / `src/lib.mjs` / config — but adds no *derived triage* field
  (no waiting-on state, no reorder); see AC7.

**Slice boundary (what is 009-01 vs 009-02/03).** The built overview shows a
`NEXT MOVE · WAITING ON` state (DECIDE/REVIEW/…), a finish-first order, header
aggregate counts (`4 TO DO · 2 READY · …`), and a `projects / action queue`
toggle. Those are the **derived triage signal (009-02)** and the **action-queue
lens (009-03)** — **out of scope here.** 009-01 builds the uniform-row *shell*
and the detail view from data already on disk, in the **current project order**,
with the `NEXT MOVE` column showing the existing "what's next" first line and
**no state badge**. 009-02 later fills the state badge, the reorder, and the
header counts into this shell.

**Acceptance Criteria:**

Design values come from the redline cascade (above); `design_review: true` wires
the fidelity gate against the built render.

1. **Uniform-height rows.** Every project (including error and not-jig-managed
   projects) renders as a **single row of equal height** (`row-min-h`) in one
   table, laid out on the `proj-grid` columns (project · next-move · in-flight ·
   progress · activity). Row height does not vary with project content: two
   projects of very different busyness render rows of equal height. The
   unequal-height symptom is gone.
2. **Glance row content.** Each row shows, and shows *only*: the **project**
   (name, one-line **description subtitle** — a new optional config field,
   surfaced through `scanProject`; absent → no subtitle, no error; status/active
   chip); the **next move** column =
   the **first line** of the compass "what's next" (`compass.headline`/`next`) —
   with **no derived state badge** (that is 009-02); an **"in flight" heat
   figure** (open fronts — in-progress specs + active sessions + worktree-only
   docs — carrying more visual heat as it climbs, per the redline's light/busy/
   hot treatment); **progress** (the existing `progress`/`sliceProgress` as a
   big % + a small inline-SVG bar); and **activity** (active-session count + last
   activity). No full spec list, session list, workstream list, or warning list
   appears in the row. A header may show existing-data totals (e.g. `RUNNING NOW`
   session count); it does **not** show derived-state totals (`TO DO`/`READY`/… =
   009-02).
3. **Charts are zero-dep inline SVG.** The progress bar / any trend mark is
   inline SVG in `public/index.html` — no chart library, no new npm dependency
   (ADR-0001 holds).
4. **Click opens an in-page detail view.** Clicking a row opens a per-project
   detail view **within the same self-contained page** (no route, no framework,
   no build step; A3). It is dismissible back to the table ("← overview").
5. **Nothing is lost — the detail view holds the dropped content.** The detail
   view shows everything the row no longer does (matching `console-detail`): the
   header (name, description, status, big progress, running/in-flight/last-touched
   line); the full "what's next" narrative + `NEXT` + any `BLOCKED` line with its
   age; the counts strip (done · in-progress · draft · specs · open bugs ·
   deferred · inbox); the **spec list** defaulting to the **current release
   track** with a **"show all N specs"** control — this requires new emission
   (per A-009-01): expose each release plan's member spec IDs (spec 008 already
   parses them via `parseIncludeTokens` but `resolveReleaseGoal`,
   `src/lib.mjs:569`, discards them → widen its output) and a **current-track
   determination** (the rule + its fallback are A-009-01); when no current track
   is determinable, degrade to the full spec list, never a crash; **workstreams/
   release plans** with their **next 1–3 unchecked items** — the item texts are
   already computed at `src/lib.mjs:113` but `parseRunbook` returns only
   `{done,total}` + a single `next`; widen it to return the item list (not just
   the title) incl. a "discovered, not pinned" group; the full **sessions** list
   (branch, worktree,
   timestamps) with the existing "show older" toggle and "N active · M older
   (+K not shown)" summary; and the worktree-only-docs warning. Every datum
   visible on today's dense card is reachable in ≤1 click.
6. **Reserved Activity slot.** The detail view carries an **"activity" tab**
   placeholder (labelled disabled/"soon", dashed `border-dash` per the redline)
   so the future token-cost signal can be added with no layout redesign. It
   renders nothing and counts nothing (token counting is a non-goal here).
7. **No triage derivation, no reorder.** Rows render in the current project
   order; no waiting-on state badge, finish-first ordering, or derived header
   count appears (that is 009-02). The additive fields this slice emits
   (description, workstream item list, release-track membership; DoR/AC2/AC5) are
   **presentation support, not triage** — none derives a waiting-on state, and
   none reorders the rows.
8. **Design-review scope fence (which render elements are OUT).** The
   `design_review` gate scores the build against `console-overview.render.png` /
   `console-detail.render.png`, but those renders show **009-02/009-03** content
   this slice deliberately defers. Fidelity is scored **only** on 009-01's layout
   + tokens (row-min-h, `proj-grid` columns, type scale, colours, inline-SVG
   progress bar, detail-view structure). **Explicitly excluded from scoring**
   (do not build, do not score against): per-row state tags
   (DECIDE/REVIEW/READY/EXTERNAL/IDLE), the `TO DO · READY · EXTERNAL · IDLE`
   header counts, the `projects / action queue` toggle, finish-first ordering,
   state-tinted row backgrounds/gutters, and the derived imperative next-move
   text + wait-line (009-01's next-move column shows the compass "what's next"
   first line instead). The `RUNNING NOW` header count and progress/activity
   columns **are** in scope.

**Assumptions (this slice):**

- **A-009-01 — "current release track" is determinable.** Defaulting the detail
  spec list to the current track (AC5) needs a rule for *which* release plan is
  current. The implementer probes shaper's release-plan convention first (is
  there an explicit current/active marker in the plan or its slate?); absent one,
  the fallback is **the release workstream whose `goalProgress` is incomplete**
  (not 100%), and if several, the first in file order. If **none** is
  determinable, the spec list degrades to the **full list** (no track default),
  never a crash. _The marker convention is unverified across shaper plans — probe
  before fixing the rule; the incomplete-goal fallback is the safety net._
- The **description subtitle** (AC2) and **workstream item texts** (AC5) are
  grounded additions, not assumptions — a new optional config field and a widened
  `parseRunbook` return over text the parser already computes (`src/lib.mjs:113`).

**DoD:**
- [ ] All ACs pass; full test suite green (no regressions).
- [ ] Implementer test coverage exercises each AC with at least one fixture
      (uniform-height render, glance-vs-detail field partition, in-page detail
      open/close, Activity placeholder present-but-inert). DOM-shape assertions
      over the rendered `card`/detail output.
- [ ] Each new test shown to fail when its feature is removed.
- [ ] Design-review pass: app screenshot vs the v1.2 mockup scored against the
      extracted design-value ACs (`design_review: true`).
- [ ] Reviewed by `reviewer` subagent (compliance + craft).
- [x] Implementation review passed.
- [ ] Deviation log produced under this slice heading.
- [ ] Reconciliation sweep produced under this slice heading.
- [x] Reconciliation review passed.
- [ ] `docs/refinement-todo.md` updated if any decisions were deferred.

**Anti-horizontal-phasing check:** After this slice, the owner opens the
overview and sees a scannable uniform grid instead of a wall of unequal reports,
and can click any project to drill into its full detail — the report → dashboard
legibility win is observable on its own, with no dependency on the later triage
signal.

### Deviation log (after reconciliation)

The ACs above are preserved. Implementation notes:

1. **Pre-build frame-critique corrected the "pure presentation" framing.** The
   frame_review pass (2026-08-31) falsified the original DoR claim that no
   `scan.mjs` change was needed: three redline-demanded data were not emitted
   (description subtitle, release-track membership, per-workstream item texts).
   The slice was corrected before any code (AC2/AC5/AC7 + A-009-01 + the spec's
   "Current state" correction note) and the owner chose to build the current-track
   filtering into this slice rather than defer it. All three are now emitted
   (additive, non-triage).
2. **`src/server.mjs` was touched** (not in the original DoR, which listed
   scan/lib/config). The plan's shared-module testability decision needs
   `public/render.mjs` served to the browser; added one explicit `/render.mjs`
   route (a fixed constant path — no request-derived component, so zero
   path-traversal surface), not a generic static server. Sound; zero-dep holds.
3. **Current-release-track marker probed and found absent.** A-009-01's preferred
   signal — an explicit current/active marker in a shaper release-plan file — does
   **not** exist on disk (grepped `docs/`); the mockup's `current: true` was
   synthetic design data. Only the A-009-01 fallback is implemented: first
   release-kind workstream, in emitted order, whose `goalProgress` is incomplete;
   none determinable → the detail spec list degrades to the full list (tested).
4. **Light/dark theming restored (owner decision, 2026-08-31).** The first build
   was dark-only to match the v1.2 Console redline; the owner asked to keep light
   mode. A derived light palette was added (HSL lightness-mirror of every base.md
   token, preserving hue/saturation so contrast distances are preserved by
   construction); dark keeps the exact redline values. Wired via
   `prefers-color-scheme`, matching the pre-redesign page's approach.
5. **Spec 008-02's "N of M slices landed · K unresolved" goal meter is dropped
   from the UI.** The v1.2 detail redline's workstream block shows only
   title/CURRENT chip/kind/next-items — no goal meter — so the redesign removes
   that display. **The underlying data is untouched** (`goalProgress` /
   `goalUnresolved` still computed; now consumed to pick the current track), so it
   is recoverable, but a shipped 008 feature is no longer visible. Recorded in
   `docs/inbox.md` so the loss is not silent (008's record is not amended — this
   is a live-UI supersession by the redesign, ADR-0010 live-prose class).
6. **Review nits fixed in a follow-up pass** (both review passes returned *pass*,
   no blockers): the detail "running now" figure now uses the strict running
   count (was the active count under the same label); overview and detail now use
   the same abandoned-excluded spec denominator; an empty-memberSpecIds track no
   longer renders a no-op "show current track" toggle; and the AC8 negative test
   was extended to the detail output. Five previously-hardcoded hex colours were
   var-ized so theming works end-to-end.
7. **Process note (no harm done): a sub-agent ran a bare `git stash pop`** —
   the shared-stash hazard this repo's environment explicitly warns against —
   which briefly applied an unrelated session's stash
   (`claude/trim-old-repo-refs`) into 3 files this slice does not touch. Reverted
   immediately with `git checkout HEAD --`; **verified afterward that the other
   session's stash entry is still intact in the stack and the 3 files are clean at
   HEAD.** No collateral damage. Flagged so future implementer briefs carry the
   shared-stash rule.

**Test suite:** 246 pass / 0 fail (`node --test`), up from 198 at spec start
(+48 tests). The 5 riskiest derivations were mutation-verified (edited to red,
reverted to green).

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | Front-door install/usage unchanged; the overview is still `/dashboard:open` → localhost:5111. |
| `docs/specs/README.md` | `updated` | Regenerated by `workflow.py status-board` on close-out (009-01 → DONE). |
| `docs/product-vision.md` | `no-op` | UC-1..6 unchanged; this slice serves the existing presentation of UC-1..5 (UC-6/triage is 009-02+). |
| `docs/architecture.md` | `updated` | Module-boundary bullets added for `public/render.mjs` (new pure client render module) and the `/render.mjs` server route, and the `public/index.html` bullet updated (theming + interaction glue). No new ADR (no decision with rejected alternatives beyond ADR-0006). |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `no-op` | Spec 009 still in flight (009-02..04 DRAFT); no compress-on-close-out yet. |
| `docs/inbox.md` | `updated` | Added the dropped-008-meter note (deviation 5). |
| `docs/refinement-todo.md` | `no-op` | No new deferred decision; the current-track marker absence is captured in A-009-01, not parked. |
| `docs/memory/**` | `updated` | Lightweight decisions recorded (dark+light theming, heat-bucket thresholds, dropped-008-meter) via memory-sync. |
| `docs/decisions/*` | `no-op` | No new/changed ADR; ADR-0006 governs and is unchanged. |
| Live prose (008 goal-meter display) | `updated` | Removed from the UI per the v1.2 redline; data path intact (deviation 5). |
