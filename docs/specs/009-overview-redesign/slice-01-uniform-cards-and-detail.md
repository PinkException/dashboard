---
status: DRAFT
dependencies: [adr-0006]
last_verified:
design_review: true
frame_review: true
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on
     first use and link the term to docs/memory/glossary.md (or jig's lexicon). -->

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 009-01 — uniform triage cards + project detail view (the split)

**Goal:** Replace the variable-height dense report with a uniform, fixed-size
card per project in a real grid, and move everything a card no longer shows into
an in-page per-project detail view opened by clicking the card — delivering
ADR-0006's legibility win (report → dashboard) with **no data loss and no triage
derivation yet**.

**DoR:**
- ✅ [ADR-0006](../../decisions/adr-0006-overview-triage-surface.md) Accepted
  (the glance/detail information architecture is fixed).
- ✅ Claude Design mockup available as the visual reference
  ([overview-v1.2.md](../../design/overview/overview-v1.2.md); the built HTML
  mockups the owner transfers to the design-review step).
- ✅ The scan payload already carries every field the card + detail view render
  (verified in spec.md "Current state"): no `src/scan.mjs` change is required by
  this slice.

**Acceptance Criteria:**

Design values are extracted from the mockup into checkable ACs (per the
design-fidelity authoring rule); `design_review: true` wires the fidelity gate.

1. **Uniform cards in a grid.** Every project (including error and
   not-jig-managed projects) renders as a **fixed-size** card in a CSS grid —
   card height does not vary with project content. The unequal-column symptom is
   gone: two projects of very different busyness render cards of equal height.
2. **Glance card content.** Each card shows, and shows *only*: project name, the
   one-line description, status; one **big progress number** (the existing
   `progress` / `sliceProgress`) with a small **inline-SVG trend mark**; the
   **first line** of the compass "what's next" (`compass.headline`/`next`); an
   **active-session count + last-activity time**; and an **"in flight" heat
   figure** (a count of open fronts — in-progress specs + active sessions +
   worktree-only docs — carrying more visual heat as it climbs past a handful).
   No full spec list, session list, workstream list, or warning list appears on
   the card.
3. **Charts are zero-dep inline SVG.** The trend mark / any sparkline is inline
   SVG in `public/index.html` — no chart library, no new npm dependency
   (ADR-0001 holds).
4. **Click opens an in-page detail view.** Clicking a card opens a per-project
   detail view **within the same self-contained page** (no route, no framework,
   no build step; A3). It is dismissible back to the grid.
5. **Nothing is lost — the detail view holds the dropped content.** The detail
   view shows everything the card no longer does: full spec list with per-spec
   state, individual sessions (branch, worktree, timestamps), workstreams /
   runbooks with their **next 1–3 unchecked items** (not just the title), the
   full "what's next" narrative + history, worktree/doc warnings, and
   deferred-decision + inbox counts. Every datum visible on today's dense card is
   reachable in ≤1 click.
6. **Reserved Activity slot.** The detail view carries an **empty "Activity" tab
   placeholder** (labelled "soon" / disabled) so the future token-cost signal can
   be added with no layout redesign. It renders nothing and counts nothing (token
   counting is a non-goal here).
7. **No triage derivation, no reorder.** Cards render in the current project
   order; no waiting-on state, badge, or finish-first ordering appears (that is
   009-02). This slice adds no new field to the scan payload.

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
- [ ] Implementation review passed.
- [ ] Deviation log produced under this slice heading.
- [ ] Reconciliation sweep produced under this slice heading.
- [ ] Reconciliation review passed.
- [ ] `docs/refinement-todo.md` updated if any decisions were deferred.

**Anti-horizontal-phasing check:** After this slice, the owner opens the
overview and sees a scannable uniform grid instead of a wall of unequal reports,
and can click any project to drill into its full detail — the report → dashboard
legibility win is observable on its own, with no dependency on the later triage
signal.

### Deviation log (after reconciliation)

_TBD at implementation._

### Reconciliation sweep

_TBD at reconciliation._
