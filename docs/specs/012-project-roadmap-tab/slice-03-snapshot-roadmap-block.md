---
status: READY_FOR_IMPLEMENTATION
dependencies: [012-02, adr-0004]
last_verified:
arch_review: true
frame_review: true
---

<!-- jig self-defining vocabulary (soft, forward-only). -->
<!-- jig grounding (spec 064-02 / ADR-0020): probe runnable-surface claims. -->

## Slice 012-03 — saved order and narrative extras from snapshots

**Goal:** Run `/dashboard:snapshot` on a project and its roadmap tab switches
from the automatic order to the skill's proposed order, with the narrative
extras (named groups, layers, "the rule", locked decisions) shown — and a label
saying which order is in effect.

**DoR:**
- ✅ 012-02 DONE.
- ✅ ADR-0004 (snapshot store contract) accepted.
- ⬜ A3 probed first: every reader of the store (`src/lib.mjs` reader,
  `scripts/snapshot.mjs --if-changed`, `src/migrate.mjs`) tolerates an extra
  nested `roadmap` field. Result recorded in the deviation log.

**Acceptance Criteria:**

1. **Entry shape.** A snapshot entry may carry an optional `roadmap` object:
   `order` (slice IDs, e.g. `"012-01"`), optional `groups`
   (`[{ label, slices: [ids] }]`), `layers` (`[{ name, title, text }]`),
   `rule` (string), `locked` (strings), `orderOrigin`: `"proposed"` (the
   skill's own proposal) or `"corrected"` (the owner changed it, or it
   carries forward an earlier correction), `correctedAt` (ISO time of the
   owner's last correction; present only when `"corrected"`) and `proposedAt`
   (ISO time of the last proposal; present only when `"proposed"`). Neither
   date is ever moved by a mechanical carry-forward. Documented as an additive amendment to
   the ADR-0004 contract (record or ADR per the reconciliation trigger).
2. **Writer owns every order computation.** `scripts/snapshot.mjs` (which
   already scans a project for `--auto`) gains three roadmap modes, so no
   order is ever computed by hand in a skill:
   - `--roadmap <file.json>` (with `--headline`): the file holds the
     narrative block (`groups`, `layers`, `rule`, `locked`) and, optionally,
     `proposedOrder`. The **writer** sets `order`: no saved roadmap for the
     project → `proposedOrder` (else the automatic order), `orderOrigin:
     "proposed"`; a saved roadmap exists → `mergeSavedOrder(saved,
     autoOrder)` (AC4), keeping `orderOrigin` and its date. While the origin
     is still `"proposed"`, a new `proposedOrder` **replaces** it (fresh
     `proposedAt`) — the skill keeps proposing until the owner corrects. Once
     `"corrected"`, `proposedOrder` is ignored (printed as a suggestion only).
   - `--move <id> --before <id>` (no other input): an owner correction. The
     writer loads the latest narrative entry and the latest roadmap entry,
     applies the move to the merged order, and appends a new entry copying
     `headline`/`next`/`blockers`/`source` and the full block, with
     `orderOrigin: "corrected"` and `correctedAt` = now. Unknown IDs or no saved roadmap → refused, nothing
     written.
   - `--print-order` (read-only): prints the order the tab would show, as one
     line (`007-01 → 007-03 → 007-02`) plus its origin — used by the skills'
     summaries.
   An invalid file (bad JSON, wrong types, unknown slice-ID format) is refused
   with a clear message and **nothing is written**. The temp file lives
   outside the surveyed repo. Entries without roadmap modes are
   byte-identical to today's. Every entry still carries a `headline` — the
   existing contract (`validateSnapshot`, `src/lib.mjs:235-237`;
   `parseCompassHistory` requires it, `src/lib.mjs:186-196`; migration dedups
   on `ts`+`headline`) is unchanged, so `roadmap` stays a purely **additive**
   field. Headline-less entries were considered and rejected (frame-critique
   round 2): they would count as malformed and warn on the card forever.
3. **Reader.** The scan exposes the newest narrative entry that carries a
   `roadmap`, tracked alongside today's `latest`/`latestNarrative` in the same
   parse. Each roadmap entry carries the **full** block (order, groups,
   layers, rule, locked) — a correction copies the previous block and changes
   only the order — so the newest one is always complete. AC7's dates use
   `correctedAt` or `proposedAt`, never the entry's `ts`. After a `--move`, the card's
   "when it ran" shows the correction time, because the copied entry is the
   newest narrative one — accepted: the owner re-confirmed that headline, and
   the copied `source` keeps its provenance.
4. **Override with drift safety — one merge function.** A single pure
   function `mergeSavedOrder(saved, autoOrder)` in `src/lib.mjs` is used
   **both** by the tab at read time and by `snapshot.mjs` when it carries an
   order forward or applies a correction (AC2), so the order never shifts on its own between runs:
   - IDs that no longer exist, or whose slice is now DONE / DEFERRED /
     ABANDONED, are dropped (DEFERRED slices show in Parked regardless);
   - unfinished slices missing from the saved order are **appended** at the
     end, in automatic order (new work never vanishes, and never jumps
     position later);
   - appended slices sit at the end, labelled per AC5.
5. **Groups label, `order` places.** Position comes **only** from `order`
   (after AC4's merge); `groups` never move a card. Walking the order, each
   maximal run of consecutive slices sharing a group gets that group's label;
   a slice in no group gets its spec's title as label. A group whose slices
   are not consecutive simply labels each run. So a freshly composed `groups`
   on a later run can relabel cards but can never undo an owner correction.
6. **Extras.** `layers`, `rule` and `locked` render (escaped) only when
   present; absent → nothing, no empty boxes.
7. **Which-order label.** The tab states "Order: automatic", "Order:
   proposed · <proposedAt>" or "Order: yours · <correctedAt>". "(older than
   latest changes)" compares the slice-status changes against that same date
   (so a mechanical carry-forward never clears it).
8. **Snapshot skill — corrections persist.** `skills/snapshot/SKILL.md`
   composes only the **narrative** part of the block (groups, layers, rule,
   locked) and, while the order is not yet `"corrected"`, a `proposedOrder`,
   from the
   project's own artifacts. It **never writes `order` itself**: the writer
   (AC2) proposes, carries forward or corrects it. So:
   - a `"corrected"` order is never replaced by a fresh proposal (the writer
     ignores `proposedOrder` once the order is `"corrected"`; the skill may *suggest* a
     change in its summary, applied only on the owner's say via `--move`);
   - an owner correction ("move 007-03 before 007-02") is one `--move` call;
   - **thin day** (no headline worth writing, per the skill's existing bar)
     → nothing is written; new slices still appear via AC4's read-time merge;
   - **one project per run** stays the skill's rule; the "cross-project sweep
     is the scheduled routine's job" guardrail (`skills/snapshot/SKILL.md:74-75`)
     is reworded to also allow `/dashboard:end-of-day` (012-04) to invoke it
     once per project.
   Its summary shows `--print-order`'s line; it never writes into the
   surveyed repo.
9. **Roadmap changes are written.** A `dashboard`-source entry whose only
   change is the roadmap block is never skipped by the `--if-changed` guard
   (same-source `auto` comparison only, `scripts/snapshot.mjs:15-20,65,138`;
   confirm in the A3 probe and cover with a test).

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

**Anti-horizontal-phasing check:** after this slice the owner runs one
command on a project and its roadmap shows Claude's proposed order and the
reference-page-style narrative.

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
