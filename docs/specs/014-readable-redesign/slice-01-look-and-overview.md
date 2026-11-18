---
status: DONE
dependencies: []
last_verified: 2026-11-18
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
   on any `/api/prs` failure the disk summary stands. (Round 2.) The swap
   replaces the four state tiles only; **Running now** keeps its `/api/data`
   value, so it always agrees with the rows' running dots (round 3).
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
   for Idle when `specs.done === specs.total > 0`, else "Nothing open"), in-flight count + heat word, progress bar
   (accent, ok-green at 100%) + "N of M specs", running count with dot, last
   touched. Row tint: owner states (MERGE/REVIEW/DECIDE, D7) `#FDF6EE`, Idle `#F7F3EA`
   — both as `:root` tokens with dark equivalents from the dark file (AC1).
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

**Anti-horizontal-phasing check:** After this lands the owner opens the
dashboard and reads every project's state in the new, readable look.

### Deviation log (after reconciliation)

The original spec is preserved above. Implementation notes (2026-11-18):

1. **Header ring value.** AC4 named the ring but not its value. It shows
   overall specs done across jig-managed projects: `summary.specsDone /
   summary.specsDenom` (new additive keys, same denominator as each row's
   "N of M specs"). The percentage is computed page-side in `headerHtml` — a
   small accepted exception to "the page does no derivation", recorded in
   `docs/architecture.md`.
2. **"All specs done" rule.** AC8 said `specs.done === specs.total > 0`; built
   as `progress.done === progress.denom > 0` (abandoned specs excluded) so it
   agrees with the 100 % bar and the "N of M specs" figure.
3. **Rows follow the mockup more closely than AC8 listed.** The old verb badge
   and gutter column are replaced by the chip; the in-flight cells SVG by
   number + heat word. The queue keeps `.row-verb`, restyled with chip tokens,
   until 014-02.
4. **"Need you" subtitle** reads "a decision, a review or a merge" (mockup: "a
   decision or a review") because Land counts there (D7).
5. **Header, tiles and legend render in the overview lens only.** The queue
   keeps its existing summary band with the new pill switch until 014-02.
6. **Tokens not listed in AC1/AC2** were taken from the mockups (inset dark
   `#232E48`, `--external`, chip bg/fg pairs, row tints `#1F2539` / `#161E31`
   dark). Dark `--danger` / `--warn` / `--blocked-bg` are mappings of our own;
   the Land chip in dark reuses the dark Ready ok pair (D7).
7. **Old token names kept as aliases** of the v1.3 palette so the queue,
   detail and roadmap views follow the new look before 014-02/03 (inbox note
   to remove them later).
8. **AC3 scope.** The 44 px / monospace-only rule is met on the overview
   surface. Detail-view tabs and toggles stay small monospace until 014-03
   (whose AC3 covers the tabs); the global `button` rule gives `.back-btn` the
   44 px height already.
9. **AC6 wording.** "Active pill = text colour on surface text" was read as a
   text-colour background with surface-colour foreground (`--lens-active-*`
   tokens), as in the mockup.
10. **Review fix (compliance + craft nit).** `running` first counted error rows
    with a running session, which show no running dot. Fixed in `f4277ec`:
    error rows are excluded, so the tile always agrees with the dots (AC5's
    round-3 promise). Also pinned the Idle fallback (no/unknown `waitingOn`
    state → Idle tile, chip and tint) with a test, and removed a duplicate
    `.chip-current` font size.
11. **Known benign edges (logged, not fixed).** The `/api/prs` summary comes
    from a later scan, so the four state tiles can briefly disagree with the
    rows if the configured project set changes between the two scans; the
    next refresh fixes it. The pre-existing stale-`/api/prs` overwrite race
    now also reaches the tiles — parked in the inbox.
12. **Fidelity (D5).** Eyeballed by the orchestrator against `Main.dc.html`
    and `Main-dark.dc.html` in the browser pane at 1360 px, light and dark.
    Palette, type, ring header, five tiles, pill switch, legend and rows match.
13. **Process.** Integrated `origin/main` (012-02 parked section, 013-01 chart)
    before reconciling; 471/471 tests green after the merge. jig's
    review-candidate sidecars (`reviews/.candidates/*.json`, which hold local
    paths) were caught by the leak gate before any push; they are now
    git-ignored and were never committed to the pushed history.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | No install, command or first-run change; the look is described by the page itself. |
| `docs/specs/README.md` | `updated` | Regenerated by `workflow.py status-board`. |
| `docs/product-vision.md` | `no-op` | Same promise (one page, what's next); no scope change. |
| `docs/architecture.md` | `updated` | `/api/data` and `/api/prs` gain the additive `summary`; ring % noted as a page-side exception; `running` vs `runningNowCount` difference noted. |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `updated` | `CLAUDE.md` had no spec 014 entry (it arrived on main via the merge, unchanged by this branch); added one Active-specs line. "Next pickable work: 012-03" is already current. No `AGENTS.md`. |
| `docs/inbox.md` | `updated` | Parked three 014-01 leftovers (stale `/api/prs` race, token aliases, inline style). No inbox item was resolved by this slice. |
| `docs/refinement-todo.md` | `no-op` | No decision deferred. |
| `docs/memory/**` | `no-op` | No new domain term; "Land / Need you" are spec vocabulary recorded in spec 014. |
| `docs/decisions/README.md` / ADR index | `no-op` | No ADR touched. ADR-0001/0007 respected (keyed swap, additive fields). UI copy choices are owner decisions D1–D11 in spec 014, so no lightweight-decision entry. |
| Merge-inherited and spec-authoring paths | `no-op` | `feedback-notes.md`, `docs/bugs/*`, spec 012/013 docs, the 014 spec/slice/frame-critique docs and `docs/designs/dashboard-v1.3/*` appear in `origin/main...HEAD` only through the merge or spec 014's authoring (PR #23); this slice did not edit them. Tile subtitles were checked against `Main.dc.html` and match except "Need you" (item 4). |
| `.gitignore` | `updated` | Ignores `docs/specs/*/reviews/.candidates/` (review sidecars hold local paths). |
