---
status: DONE
dependencies: [003-01]
last_verified: 2026-08-06
frame_review: true
---

## Slice 003-02 — recency-expand-toggle

**Goal:** Keep the default Sessions view tight — just the running and
recently-active sessions — but let the owner reveal the older ones on a
project when she wants them, with an honest count of how many are hidden.
This is the "active-only by default, with a way to see more" interaction,
built entirely on the page from data 003-01 already emits.

**DoR:**
- ✅ 003-01 done: each session carries an `active` flag and each project a
  `sessionsTotal`, so active vs older is a client-side split with no rescan.

**Acceptance Criteria:**

1. **Default = active only.** Each card's Sessions section renders only
   `active` sessions by default (running or within the recency window),
   exactly as 003-01 ships.
2. **Show-older control.** When a project has ≥1 non-active session in the
   emitted list, a "show older" control appears; activating it reveals the
   remaining (non-active) sessions in the same section, ordered by
   last-activity descending. The control toggles back to hidden. No network
   request — purely client-side over the already-loaded data.
3. **Count summary.** The section header shows "N active · M older", where
   (pinned by frame-critique): **N** = number of `active` sessions in the
   *emitted* list; **M** = number of non-active sessions in the *emitted* list
   (the ones the toggle reveals); **K** = `sessionsTotal − emittedCount` (the
   sessions the 003-01 cap dropped from the payload entirely — **not**
   revealable by the toggle). When `K > 0`, a trailing "(+K not shown)" makes
   the truncation honest. The "(+K not shown)" segment is **independent of the
   older toggle**: it appears whether or not there are older sessions (e.g. a
   project with 25 running sessions → N=20 active, M=0 older, "(+5 not shown)"),
   and the toggle never reveals the +K set.
4. **No-older case.** When every emitted session is active (M = 0), no
   show-older control and no "· M older" segment appear — just "N active"
   (still followed by "(+K not shown)" if the cap dropped any, per AC3). When
   the project has zero sessions the whole section is omitted (003-01 AC8).
5. **Session-row layout — title must stay legible (folded in from 003-01's
   live check).** In 003-01 the row is a single flex line (`title` |
   `branch · worktree · time`) with the metadata `white-space: nowrap`; a long
   metadata string squeezes the title column so narrow it wraps one word per
   line. Fix the layout so the title reads on a normal line (e.g. stack the
   secondary metadata beneath the title, or give the title the row's width and
   let the metadata wrap/ellipsize) — the title is never compressed to
   one-word-per-line. Running badge, branch, worktree, and relative time all
   remain visible. Applies to both the active rows and the revealed older rows.
6. **Tests.** Coverage for the header-count logic (active/older/overflow
   arithmetic) at whatever unit the page logic is testable at — extract the
   arithmetic into a pure helper in `src/lib.mjs` so it is unit-tested there
   (the page's inline script has no test harness, per 003-01's deviation log);
   manual/browser verification of the toggle interaction and the row-layout fix
   noted in the deviation log.

**DoD:**
- [x] All ACs pass; full test suite green (no regressions).
- [x] Reviewed against spec — independent reviewer subagent; conditions
      closed. (frame-critique + compliance + craft + reconciliation all `pass`;
      predicate unified post-review; a reconciliation-caught real-project-name
      leak in the deviation log redacted, suite re-verified 154 green.)
- [x] Deviation log produced under this slice heading.

**Anti-horizontal-phasing check:** after this slice the owner can, per
project, expand past the recent set to the full recent-cap history and see
exactly how much is hidden — a complete, observable interaction on top of
003-01.

### Frame-critique (2026-08-04, pre-implementation)

Focused inline frame-critique (the surface is client-side arithmetic over data
003-01 already emits and verified; no store re-probe needed). Verdict:
**FRAME-SOUND-WITH-NOTES** — one real ambiguity pinned in the ACs before code:

- **[should-fix] N/M/K were undefined; the "+K not shown" case was
  under-specified.** The cap (SESSION_CAP=20, 003-01) can drop *active*
  sessions, not just older ones, so "N active" must mean *emitted* active and
  the "(+K not shown)" overflow must be able to appear with **no** older
  sessions present. **Resolved:** AC3 now pins N = emitted active, M = emitted
  non-active (toggle-revealable), K = `sessionsTotal − emittedCount`
  (cap-dropped, **not** revealable); AC4 clarifies "(+K not shown)" is
  independent of the older segment.
- **[nit] the toggle reveals M, never K** — the +K set isn't in the payload,
  so the control cannot show it; AC3 wording makes this explicit so the UI
  doesn't imply otherwise.
- **[nit] AC5 layout fix adds row height** — stacking the metadata beneath the
  title turns a 1-line row into 2 lines, which interacts with the spec-012
  uniform-card-height cap (busier cards hit the max-height/"show more" sooner).
  Acceptable — spec 012's reveal already handles overflow; noted, not blocking.
- **[build note] arithmetic → pure helper in `src/lib.mjs`** (AC6) so it is
  unit-testable; the page's inline script has no test harness (003-01 deviation).

### Deviation log

- **AC6 helper (`sessionCounts` in `src/lib.mjs`):** built TDD — 6 unit tests
  written first against a not-yet-exported name (confirmed red: "does not
  provide an export named 'sessionCounts'"), then the function added.
  `activeCount`/`olderCount` are counted over the emitted `sessions` array
  (post-cap); `overflowCount = max(0, (sessionsTotal ?? sessions.length) -
  sessions.length)`. Covers: all-active, some-older, cap-overflow-with-older,
  cap-overflow-all-active (the frame-critique's 25-running case),
  zero-sessions, and missing-`sessionsTotal`.
- **Toggle mechanism (AC2):** this codebase has no custom delegated-click
  toggle infrastructure to reuse — the task brief's references to a
  007-02/011-02 delegated-click idiom and a spec-012 "show more" reveal
  describe specs that do not exist on this repo's history (this repo's own
  spec 007 is plugin-onboarding, unrelated). The only existing toggle pattern
  in `public/index.html` is the native `<details>/<summary>` element already
  used for the per-card specs list. Reused that exact idiom for "show older":
  `<details class="sessions-older"><summary>show older (M)</summary>...older
  rows...</details>`. Zero new JS — native open/close toggle behavior,
  purely client-side, satisfies "toggles back to hidden" for free. One
  known, accepted side effect shared with the pre-existing specs `<details>`:
  the 120s `load()` poll replaces each card's innerHTML, so an opened toggle
  collapses back on the next refresh — this is pre-existing behavior of the
  page's only other `<details>`, not a regression introduced here.
- **Count summary (AC3/AC4) placement:** rendered as `sessions — N active[
  · M older][ (+K not shown)]` inside the existing `.sect .lbl` block-level
  label (same element the "sessions" caption used before), rather than a
  separate line, to stay inside the page's existing type scale without new
  CSS classes. The "· M older" segment is present only when M>0; "(+K not
  shown)" is appended independently whenever K>0, verified with the
  25-running case (`activeCount:20, olderCount:0, overflowCount:5` →
  `"20 active (+5 not shown)"`, no "older" segment).
- **AC5 layout fix:** chose the "stack" option named in the AC over
  wrap/ellipsize. `.session` changed from a flex row (`title` | `meta2`,
  `white-space: nowrap`) to block children: `.session .title { display:
  block }` and `.session .meta2 { display: block; margin-top: 1px }` (dropped
  `white-space: nowrap` — metadata is on its own full-width line now, so it
  can wrap normally without ever affecting title width). The running badge
  stays inline within the title line via the existing `<span class="running">`.
  Applied identically to both active and older rows since both now go through
  one shared `sessionRow(s)` helper (previously duplicated inline in
  `sessionsSection`).
- **Client-side mirror duplication:** `sessionCounts` is duplicated verbatim
  (not imported) into the inline `<script>` in `public/index.html`, following
  the same "inline-mirror" precedent 003-01 already established for
  `relativeTime` (the page's script is not a module and the server serves no
  static path for `src/lib.mjs`) — noted there and continued here rather than
  re-opened as a new deviation.
- **Verification without a page test harness:** per 003-01's precedent, the
  inline script has no test runner. Verified by (a) a Node syntax check
  extracting and `new Function()`-parsing the `<script>` body, and (b) a
  scratch harness exporting `sessionsSection`/`sessionCounts` from the parsed
  script and rendering four representative payloads (25-running-capped,
  mixed-active-with-overflow, active-only-no-overflow, zero-sessions),
  inspecting the emitted HTML string by eye against AC1–AC4 and AC5 markup
  shape. All four matched expectations exactly (see slice's implementation
  session for the exact outputs).
- Full suite: 148 → 154 tests (6 new `sessionCounts` unit tests), all green,
  no regressions.
- **Post-review (2026-08-04): active-predicate unified.** Both reviewer passes
  flagged that `sessionsSection` partitioned rows with truthy `s.active` /
  `!s.active` while `sessionCounts` (lib + inline mirror) counts with strict
  `s.active === true`. Harmless today (the scanner always emits a boolean), but
  two idioms for one predicate risked a header-count vs rendered-row divergence
  if `active` ever became non-boolean. Aligned the row filters to
  `s.active === true` / `s.active !== true` (public/index.html), matching the
  helper exactly. Suite still 154 green; live browser recheck unchanged.
- **Live verification (2026-08-04):** ran the server on the real store and
  confirmed all six ACs on screen — titles now read on their own line (AC5
  fixed, no one-word-per-line), headers show "N active · M older (+K not shown)"
  incl. the overflow (a busy project → "15 active · 5 older (+63 not shown)"), and the
  native "show older" toggle reveals the older rows (dashboard "show older (5)"
  → an 11-day-old session).

### Reconciliation sweep

Drift-prone surfaces checked at reconciliation (2026-08-04):

- **`docs/architecture.md`** — *no-op.* Pure client-side rendering + one pure
  helper (`sessionCounts`) in `src/lib.mjs`; no module boundary, data source, or
  contract changed. The `/api/data` shape is unchanged (003-02 consumes 003-01's
  `sessions`/`sessionsTotal`, adds no field).
- **`## Contract surfaces`** — *no-op.* No new/changed surface.
- **ADR trigger** — *no-op.* No load-bearing decision with rejected
  alternatives; an interface-polish slice over existing data.
- **`docs/conventions.md`** — *no-op.* No new rule.
- **CLAUDE.md primer** — *deferred to close-out.* Spec 003 closes when 003-02 is
  DONE (003-03 is DEFERRED, excluded from rollup) — the primer's active-spec
  section is refreshed then.
- **`docs/inbox.md`** — *updated.* The title-wrap item is now resolved by this
  slice (AC5); struck through. No new follow-ups.
- **Memory** — *updated.* 003-02 DONE recorded on the current-repo 003 memory.
