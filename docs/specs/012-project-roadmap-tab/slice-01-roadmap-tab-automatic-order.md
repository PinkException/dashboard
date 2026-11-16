---
status: DRAFT
dependencies: []
last_verified:
arch_review: true
frame_review: true
---

<!-- jig self-defining vocabulary (soft, forward-only). -->
<!-- jig grounding (spec 064-02 / ADR-0020): probe runnable-surface claims. -->

## Slice 012-01 — roadmap tab with automatic order

**Goal:** Open any project's detail view, click a new **roadmap** tab, and see
the road ahead in the automatic order: a sequence strip, the current release's
slices, and one group per unfinished spec with a card per slice (ID, name,
status chip, "depends on …"); DONE specs folded under "show N done".

**DoR:**
- ✅ Spec 012 decisions recorded (spec.md "Owner decisions").
- ✅ Detail-view tab bar exists (`public/render.mjs:537-538`).

**Acceptance Criteria:**

1. **Tab.** The detail view's tab bar reads `overview | roadmap | activity`;
   clicking `roadmap` shows the roadmap content and hides the overview
   content; switching back restores the overview; the open tab survives the
   `/api/prs` fold-in (same rule spec 010 set for the active tab).
2. **Slice names.** The scanner adds `name` to each slice record, read from
   the slice file's `## Slice NNN-NN — <name>` heading; when absent, `name`
   falls back to the filename stem (A1). The `/api/data` change is additive.
3. **Automatic order.** A pure function in `src/lib.mjs` (scanner-side, per
   ADR-0001 — the page does no derivation) returns the spec and slice order
   defined in spec.md "Automatic order (layer 1)", including the
   definitions (slice, unfinished, tier), in-spec dependency order and the
   cycle fallback. The scanner supplies each spec's recency (git commit
   timestamp of its directory, mtime fallback) as an input, so the function
   stays pure. `currentReleaseTrack` moves from `public/render.mjs` into
   `src/lib.mjs`; the scanner emits its result and both the overview and the
   roadmap read that one value (no second copy of the rule). Covered by
   fixture tests for each rule (release-first, tier, recency, number
   tie-break, status-less `slice-*.md` ignored, spec with no slices,
   cross-spec / `adr-*` dependencies, dependency order, cycle).
4. **Sequence strip.** Up to four steps: the first = the current release (or
   the first ordered spec when no release), the next two = the next two
   ordered specs, the last = "N parked" when any slice is DEFERRED. The first
   step reads "Now · We are here" only under spec.md's "We are here" rule,
   otherwise "Next up". Fewer steps render when fewer exist.
5. **Release block.** When a current release exists, a block lists its Include
   slices with chips, under "In front of it — <release title>".
6. **Spec groups.** One group per unfinished spec in order; each slice card
   shows ID, name, chip (spec.md "Status chips"), and "Depends on <ids>"
   listing every declared dependency (same-spec, cross-spec and `adr-*`). DEFERRED slices are excluded here (they
   land in Parked, slice 02); ABANDONED slices are not shown.
7. **Done fold.** DONE specs render inside a native `<details>` with summary
   "show N done", closed by default.
8. **Empty states.** A project with no specs shows one honest line ("No specs
   yet") instead of an empty frame; a project with only DONE specs shows
   "Nothing planned" above the fold.
9. **Look.** Reuses the dashboard's existing CSS tokens (no palette
   import); the four chips are visually distinct in light and dark mode;
   cards wrap to one column at phone width with no horizontal scroll.
   Attest-by-eyeball at review (low-stakes polish; no `design_review` gate).
10. **"As of main" label and worktree hint** (spec.md decision 7, A6). The
    tab header reads "as of main" (the root's current branch name when it is
    not `main`), plus a worktree hint computed as follows (no worktree status
    feeds the order):
    - **Worktrees considered:** every `git worktree list` entry except the
      root, read **from disk** (uncommitted edits count). No merged-branch
      skip: a fresh worktree at the root's HEAD lists as "merged" while
      holding live uncommitted work, and the strict rank below already keeps
      stale worktrees' older statuses out of N. Residual: a stale worktree's
      slices that were renamed or deleted on main may still count.
    - **Progress rank:** DRAFT < READY_FOR_REVIEW < READY_FOR_IMPLEMENTATION
      < IN_PROGRESS < REVIEWED < RECONCILED < DONE. DEFERRED and ABANDONED
      never count as "further along".
    - **"N slices further along in worktrees":** slices whose highest
      worktree status (across all considered worktrees, each slice counted
      once) ranks strictly above the root's; plus slices that exist only in
      worktrees **inside a spec folder the root has**.
    - **"M specs only in worktrees":** spec folders absent from the root,
      reported separately (a renamed folder lands here, not in N).
    - No cap on either count. Both zero → no hint.
    - Fixtures include: a worktree at the root's HEAD with an uncommitted
      IN_PROGRESS slice → N ≥ 1; a stale worktree holding DRAFT where the
      root has DONE → not counted.
    - This is a **new content read** of worktree slice frontmatter — a
      deliberate widening beyond 002-02 AC4's path-only worktree rule.
      `scanWorktreeOnlyDocs` (path-only, `.claude/worktrees` only, capped at
      40) is left unchanged; the hint uses its own enumeration. Its cost
      counts toward AC11's budget.
11. **Scan cost.** Recency for all specs of a project comes from **one** git
    call per repo (e.g. a single `git log --format=%ct --name-only --
    docs/specs` pass mapped to spec directories), not one call per spec.
    The disk-only `/api/data` scan (ADR-0007) over the configured projects
    grows by no more than 10% versus before this slice (measure before and
    after; record both numbers in the deviation log). An overrun is
    recorded and raised with the owner, never hidden.

**DoD:**
- [ ] All ACs pass; full test suite green (no regressions).
- [ ] Implementer test coverage exercises each AC with at least one
      fixture. Edge cases listed in the slice are covered explicitly.
- [ ] Each new test has been shown to fail when its feature is removed —
      the test is capable of failing, not vacuously green (mutate the
      feature, watch the test go red, restore).
- [ ] Reviewed by `reviewer` subagent. Reviewer prompt built by
      `review.py`.
- [ ] Implementation review passed.
- [ ] Deviation log produced under this slice heading.
- [ ] Reconciliation sweep produced under this slice heading.
- [ ] Reconciliation review passed.
- [ ] `docs/refinement-todo.md` updated if any decisions were
      deferred during implementation.

### Close-out (post-DONE)

These items can only be ticked AFTER the final `RECONCILED → DONE`
transition. Slice-land's `check_dod` (slice 009-01) excludes them
from the count.

- [ ] `docs/specs/README.md` regenerated by `workflow.py status-board`.
      Notes column receives any load-bearing per-slice invariant
      (it's preserved across regen).
- [ ] Primer hygiene per spec 025-01 rule: **if this slice closes the
      spec** (all non-deferred slices DONE), check `CLAUDE.md`,
      `AGENTS.md`, and scaffold templates when present, then **compress**
      the spec's Active-specs entry — drop facts derivable from the
      spec dir + status board, migrate load-bearing per-slice
      invariants to the status board Notes column, keep at most a
      one-liner only for cross-cutting facts. If the spec is still
      in flight (other slices DRAFT / READY / IN_PROGRESS), leave
      the entry. If this slice introduces a new skill, add or
      update its row in the Skills table.

**Anti-horizontal-phasing check:** after this slice the owner opens any
project and sees its ordered roadmap — useful with zero setup and no skill.

### Deviation log (after reconciliation)

The original spec is preserved above. Implementation notes:

_TODO: numbered sections covering deviations from the planned shape,
reviewer findings folded back in, doc updates, plan adherence._

### Reconciliation sweep

Record the drift-prone surfaces checked during reconciliation. The transition
gate only requires this subsection to exist; the reconciliation reviewer judges
whether coverage and rationales are honest.

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | _TODO: why this slice did not affect the project front door, or summarize the update._ |
| `docs/specs/README.md` | `updated` | _TODO: regenerated by `workflow.py status-board`, or explain why deferred._ |
| `docs/product-vision.md` | `no-op` | _TODO: checked for behavior / scope drift._ |
| `docs/architecture.md` | `no-op` | _TODO: checked for module-boundary / public-contract drift._ |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `no-op` | _TODO: primer hygiene checked; note compression or template updates if any._ |
| `docs/inbox.md` | `no-op` | _TODO: checked for items resolved by this slice._ |
| `docs/refinement-todo.md` | `no-op` | _TODO: checked for resolved items or new deferred decisions._ |
| `docs/memory/**` | `no-op` | _TODO: note memory-sync result or why nothing was worth capturing._ |
| `docs/decisions/README.md` / ADR index | `no-op` | _TODO: use `updated` when the slice touched ADRs; otherwise mark checked._ |
| Additional live prose / generated templates touched by this slice | `deferred` | _TODO: name owner or trigger when real cleanup remains; otherwise replace with `no-op`._ |
