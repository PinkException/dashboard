---
status: RECONCILED
dependencies: [012-02, adr-0004]
last_verified: 2026-11-18
arch_review: true
frame_review: true
claimed_by: claude/slice-012-03-saved-order
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
- ✅ A3 probed first: every reader of the store (`src/lib.mjs` reader,
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
- [x] Implementation review passed.
- [ ] Deviation log produced under this slice heading.
- [ ] Reconciliation sweep produced under this slice heading.
- [x] Reconciliation review passed.
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

1. **A3 probe (DoR) — passed, with fixtures only.** Every store reader
   tolerates an extra nested `roadmap` field: `parseCompassHistory` (requires
   only `ts` + `headline`), `buildProgressSeries`, `validateSnapshot` (before
   this slice added its check) and `src/migrate.mjs` (carries the entry
   through unchanged). Tests: `012-03 A3` in `test/saved-order.test.mjs` and
   `test/migrate.test.mjs`. These are tolerance probes: they passed before
   the feature existed, so they guard against regressions rather than being
   mutation-testable. Known limit: `migrate.mjs` `canonical()` sorts only
   top-level keys (recorded in the ADR-0004 amendment; parked in the inbox).
2. **AC9 mechanism.** The `--if-changed` progress signature now also hashes
   `roadmap` (null when absent). `auto` entries never carry it, so the auto
   routine's cadence is unchanged. The test fails if the key is removed.
3. **AC1 contract record.** A dated amendment in ADR-0004 (2026-11-18), not a
   new ADR: ADR-0002's forward-compatibility rule (extra fields allowed,
   breaking changes bump `v`) already covers an optional field, and no
   alternative was rejected (arch review's call). `docs/architecture.md`
   documents the store field, the three writer modes and the new `/api/data`
   fields.
4. **Contract tightened beyond the AC text** (all logged in the amendment):
   - `validateSnapshot` now checks `roadmap` strictly when present
     (`validateRoadmapBlock`): `order` ids in `NNN-MM` form, `orderOrigin`
     **required**, ISO-string dates, `proposedAt` only with `"proposed"` and
     `correctedAt` only with `"corrected"`.
   - The reader uses only the newest narrative entry whose block passes the
     same check; a malformed block is ignored, so the tab falls back to the
     previous valid block or the automatic order and never crashes.
   - The `--roadmap` input file refuses unknown keys and an explicit `order`
     (the writer owns order; the skill sends `proposedOrder`).
5. **CLI refusals beyond AC2** (each writes nothing): a bare `--roadmap` or
   `--move`; `--before` without `--move`; `--roadmap` with `--auto`; `--move`
   with `--headline` / `--roadmap` / `--auto` / `--source` / `--next` /
   `--blockers` (AC2's "no other input"; `--move` always copies `source` from
   the newest narrative entry); `--print-order` with any write mode;
   `--move` or `--print-order` with `--all`; `--move X --before X`.
   Not refused (accepted and harmless): `--if-changed` and `--ts` alongside
   `--move` / `--print-order`.
6. **Nothing the automatic tab shows disappears in saved-order mode.**
   - Unfinished specs with no slices are appended to the flow as card-less
     runs (spec id + title).
   - DONE slices of unfinished specs go to the "show N done" fold
     (`roadmap.doneInFlight`), grouped by spec; the fold's N then counts those
     specs too. They never enter the order.
   - Slices whose token is not `NNN-MM` (e.g. a 2-digit spec id) or is a
     duplicate never enter `autoOrder` or a saved order; their cards are
     appended unplaced after the ordered flow. Without this, such a project
     could never save an order (every write would fail validation).
7. **Choices the ACs left open.**
   - AC7 "(older than latest changes)" compares each spec's `recency` (newest
     git commit in the spec folder, mtime fallback) with
     `proposedAt`/`correctedAt` — a proxy for slice-status change times.
   - The label shows the date only (`YYYY-MM-DD`), from one `orderLabel`
     helper shared by the tab and `--print-order`.
   - A slice listed in several groups takes its first group.
   - A `--roadmap` write takes `groups`/`layers`/`rule`/`locked` from the new
     file only (replace, not merge).
   - `--print-order` prints two lines: the arrow line and the `Order: …` line.
   - The card's `compass` payload strips `roadmap`; `autoOrder` is on
     `/api/data` because the writer reads it from the scan.
   - A `--move` entry copies `headline`/`next`/`blockers`/`source` and the
     block, but takes fresh `specs`/`slices`/`bugs`/`scanned` from the current
     scan.
   - New exports: `mergeSavedOrder`, `validateRoadmapInput`,
     `validateRoadmapBlock`, `orderLabel`, `SLICE_ID_RE` (lib) and
     `readSavedEntries` (scan).
8. **Review history.** Arch and craft passed on the first round. Compliance
   took four rounds: (1) bare `--roadmap` wrote a plain entry and the skill
   had a duplicated sentence; (2) `--move` silently dropped `--next` /
   `--blockers`, `--print-order` silently dropped writes, non-`NNN-MM` tokens
   could block writes or drop cards; (3) slice-less specs and DONE slices of
   in-progress specs vanished in saved-order mode, and `orderOrigin` was
   optional while the amendment declared it required; (4) pass. Craft and
   arch nits (reader trusting stored types, duplicated label wording, test
   gaps) were fixed in the same rounds. Every fix has a mutation-checked
   test. Craft and arch were **not re-run** on the final code; their verdict
   files say so, and the later fixes were verified by compliance rounds 2–4. Round 2's fixes were written together with their tests rather than
   test-first; the mutation checks are the evidence those tests can fail.
   Rounds 1 and 3 were test-first.
9. **Parked, not fixed** (`docs/inbox.md`, 2026-11-18): no CSS yet for the new
   roadmap pieces (014-03 restyles the tab); the double store read in
   `--move`; `Date.parse` accepting non-ISO strings; `--print-order` not
   listing unplaced cards; `canonical()` nested keys; the stale proxy.
10. **Integration.** Merged `origin/main` (spec 013-03, which also touched
    `scripts/snapshot.mjs`, `src/lib.mjs`, `docs/architecture.md`) before
    reconciliation. Conflicts were additive on both sides and kept both: the
    import list, the `progressSignature` comment (slice counts + roadmap), the
    `validateSnapshot` checks (`slices`/`bugs`/`scanned` + `roadmap`) and the
    architecture paragraphs. Suite green after the merge: 519/519.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | The README covers install and first run; the snapshot skill's new roadmap step is documented in the skill itself. |
| `docs/specs/README.md` | `deferred` | Regenerated by `workflow.py status-board` at the RECONCILED → DONE transition (close-out item); trigger: that transition. |
| `docs/product-vision.md` | `no-op` | Checked: scanner and page stay LLM-free (the skill composes the narrative, the writer stores it), read-only toward surveyed repos, zero-dep. |
| `docs/architecture.md` | `updated` | Snapshot-file contract (optional `roadmap`), `scripts/snapshot.mjs` modes, `/api/data` additions (`autoOrder`, `order`, `flow`, `doneInFlight`, `extras`; `compass` excludes `roadmap`). |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `updated` | Spec 012 still in flight (012-04 READY): Active-specs line and sprint state updated to show 012-03 done; entry kept. No `AGENTS.md`. |
| `docs/inbox.md` | `updated` | No existing item resolved; one parked item added for the review nits (deviation 9). |
| `docs/refinement-todo.md` | `no-op` | No decision deferred; open choices settled in this slice (deviation 7). |
| `docs/memory/**` | `no-op` | No new domain term; "saved order", "proposed"/"corrected" are defined in the slice and the ADR amendment. |
| `docs/decisions/adr-0004-dashboard-owned-snapshots.md` | `updated` | Dated amendment (2026-11-18) for the optional `roadmap` field (deviation 3). |
| `docs/decisions/README.md` / ADR index | `no-op` | No new ADR, so the index needs no new row. |
| `skills/snapshot/SKILL.md` | `updated` | AC8: narrative-only roadmap step, one `--move` per correction, end-of-day guardrail wording, `--print-order` summary line. |
| Files from the `origin/main` merge (`docs/specs/013-*`, `014-*`, designs, bugs, 013-03 code) | `no-op` | Arrived with the integration merge (deviation 10), not authored by this slice; reconciled in their own slices. |
| Additional live prose / generated templates touched by this slice | `no-op` | None beyond the above. |
