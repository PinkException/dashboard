---
status: DRAFT
dependencies: []
last_verified:
arch_review: true
frame_review: true
---

<!-- jig self-defining vocabulary (soft, forward-only). -->
<!-- jig grounding (spec 064-02 / ADR-0020): probe runnable-surface claims. -->

## Slice 014-01 — new look + overview by project

**Goal:** Open the dashboard and see the overview in the v1.3 look: warm
palette (light + dark from the OS setting), Nunito, large plain-language
type, five summary tiles, a "By project | Action queue" switch, a chip
legend, and one row per project with a friendly state chip, the next action
and a one-line "wait" sentence.

**Authority:** `docs/designs/dashboard-v1.3/Main.dc.html` and
`Main-dark.dc.html` (v1.3, 2026-11-17). Where an AC and the mockup disagree,
the AC wins and the gap is logged in the deviation log.

**DoR:**
- ✅ Design v1.3 committed under `docs/designs/dashboard-v1.3/`.
- ✅ D1 (font) settled.
- ✅ D3 (queue order) settled — the chip legend follows today's order.
- ✅ D6 (header eyebrow) and D7 (Land) settled.

**Acceptance Criteria:**

1. **Tokens — light.** `:root` in `public/index.html` carries the v1.3
   palette: canvas `#F4EFE4`, surface `#FBF8F1`, inset `#EFE7D6`, border
   `#E4DAC7`, text `#1C2A47`, muted text `#4E5A7C`, accent `#E16B43`,
   accent-strong `#B04A24`, ok `#2F8A63` / `#23704F`, idle `#625C4E`.
   Old token names may be kept or renamed; no hard-coded colour outside
   `:root` and its dark override.
2. **Tokens — dark.** The existing `@media (prefers-color-scheme: dark)`
   block maps the same tokens to the `Main-dark.dc.html` values: canvas
   `#121A2B`, surface `#1A2338`, border `#2C374F`, text `#EFE9DC`, muted
   `#A9B3CA`, accent `#F08A63` / `#EE7E56`, ok `#5BBB8D` / `#7DD3A8`
   (full set extracted from the dark file; spec A1).
3. **Type.** Nunito (400/600/700/800) loads via a Google Fonts `<link>`;
   `font-family: 'Nunito', ui-rounded, system-ui, sans-serif`. Sizes: h1
   36px/800, tagline 17px, body ≥ 15px, chips 13px/800 uppercase
   letter-spacing .04em. Monospace remains only for IDs/paths. Every
   clickable control is ≥ 44px tall.
4. **Header.** Progress ring (66px, accent arc on border track), eyebrow
   "Dashboard" (D6), h1 "Every project's next move", tagline "Nearly-done work
   sits above just-started work, so you finish before you start."
5. **Summary tiles.** Five tiles — **Need you** (MERGE + REVIEW + DECIDE, D7),
   **Ready to start** (Ready — both rank 4 resume and rank 5 start; the
   tile subtitle reads "nothing blocking them"), **Waiting on others** (External), **Idle**,
   **Running now** (projects with ≥ 1 running session, green dot). Counts are
   computed **scanner-side** (`src/lib.mjs`, pure, fixture-tested) and emitted
   as an additive `/api/data` field (ADR-0001: the page does no derivation).
   Because `/api/data` is disk-only (ADR-0007), `/api/prs` also returns the
   summary recomputed over the `gh`-enriched projects, and the page swaps it
   in alongside the project deltas (same keyed-swap rule as `mergePrDeltas`);
   on any `/api/prs` failure the disk summary stands. (Round 2.)
   Tile: surface, border, radius 16px, number 38px/800 in the state colour.
   The first four tiles partition the jig-managed, error-free projects by
   their head state (`waitingOn.state`), so they sum to that count; error
   rows and not-jig-managed rows are counted in no tile. "Running now" is an
   independent count and overlaps the others. (Frame-critique round 1.)
6. **Lens switch.** A pill nav "By project | Action queue" (inset track,
   active pill = text colour on surface text) replaces today's lens control;
   behaviour unchanged.
7. **Chip vocabulary.** One mapping, in one place, from waiting-on state to
   chip label + colours: DECIDE → "Your call", REVIEW → "Your review", MERGE
   → "Land" (ok-green: `#23704F` on a light green tint; dark from the dark
   file's ok values — not in the mockup, D7), Ready → "Ready", External → "Waiting on others", Idle → "Idle".
   A chip legend renders beside the lens switch.
8. **Rows.** Each project row shows: name + type (description), chip, next
   action (17px/700), wait line ("Ready to land" for MERGE (D7), "Waiting on you" for DECIDE/REVIEW, "Started — you
   can pick it back up" for rank-4 Ready (resume, D8), "You can start it now"
   for rank-5 Ready, "Waiting on others" for External, "All specs done"
   / "Nothing open" for Idle), in-flight count + heat word, progress bar
   (accent, ok-green at 100%) + "N of M specs", running count with dot, last
   touched. Row tint: owner states (MERGE/REVIEW/DECIDE, D7) `#FDF6EE`, Idle `#F7F3EA`
   (dark equivalents from the dark file).
9. **Unchanged states.** Error rows and not-jig-managed rows still render,
   using the new tokens and type (not designed in v1.3; layout kept).
10. **No regression.** Existing render tests pass (updated for new labels);
    `/api/data` and `/api/prs` changes are additive.

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

**Anti-horizontal-phasing check:** After this lands the owner opens the
dashboard and reads every project's state in the new, readable look.

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
