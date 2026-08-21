---
status: DONE
dependencies: [008-01]
last_verified: 2026-08-21
frame_review: true
# arch_review: true  # set to true when this slice changes module
#                    # boundaries, public contracts, or architecture-
#                    # shaped concerns (triggers arch-review pass).
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation,
     else mark them as assumptions in the spec's `## Assumptions` section. -->

## Slice 008-02 — graceful degradation & honest unknowns

**Goal:** When a release plan's Include input is absent, unparseable, or names
slices that don't resolve, the card renders safely — falling back to today's
title-only display and surfacing unknowns honestly — never a crash and never a
guessed number.

**DoR:**
- ✅ 008-01 DONE (the happy-path join and render exist to degrade *from*).
- ✅ Invented fixtures only — synthetic plans exercising each failure mode.

The degrade paths and the unknown-marker are governed by the spec's **Counting
rule**: extraction is structural (Item cell + `\b\d{3}-\d{2}\b` anchor), every
extracted token is a genuine gating reference, and every unresolved reference
(missing slice **or** unauthored spec) is surfaced — never dropped. "A meter is
shown iff ≥1 token is extracted from an Item cell."

**Acceptance Criteria:**

1. **No Include section.** A release plan with no `### Include` heading yields no
   `goalProgress` / `goalNext` / `goalUnresolved`; the card renders exactly as
   today (title + existing fields). No error, no empty "0 of 0" meter.
2. **No extractable tokens → title-only.** An `### Include` present but yielding
   **zero** Item-cell tokens — an empty table, a restyle the parser can't read as
   a table, or Item cells with no `\b\d{3}-\d{2}\b` match — degrades identically
   to "no Include": no meter, no marker, no crash. Because extraction is
   structural (Item cell only, word-boundary anchored), a number in a Rationale
   sentence or a 4-digit year never produces a token, so there is nothing to
   misread as an unknown. There is **no semantic "noise" drop** — the parser
   never discards an ID-shaped Item-cell token as "not a real spec".
3. **Unresolved surfaced, and counted.** Any extracted token that does not
   resolve to a slice — an authored spec with a missing slice file, **or a
   reference to a not-yet-authored spec** (forward gate) — is listed in
   `goalUnresolved` and counted in `goalProgress.total` as not-yet-landed. The
   card shows an honest marker — e.g. "2 of 5 landed · 1 unresolved" — and never
   silently shrinks the denominator (principle 5). Surfacing forward gates rather
   than dropping them is the specific hole the third frame-critique caught.
4. **All references unresolved.** If ≥1 token is extracted but none resolve to a
   slice, the meter still shows — "0 of N landed · N unresolved" — because the
   work is real but unbuilt. Only the **zero-token** case (AC2) degrades to
   title-only; "0 of 0" is never shown.
5. **Robust extraction.** Malformed rows in an otherwise-readable Include table
   (missing cells, stray pipes, blank lines, the header/separator rows) are
   skipped without aborting the parse of the remaining rows; the Item cell is
   located by column position, tolerating leading/trailing pipes and whitespace.
6. **No regression.** Projects with no release plans, and checklist workstreams,
   render exactly as before; the full suite stays green.

**DoD:**
- [x] All ACs pass; full test suite green (no regressions). — 198/198 pass.
- [x] Implementer test coverage exercises each failure mode with a synthetic
      fixture: no-Include, zero-token degrade (empty/restyled table; a number in
      a Rationale cell; a 4-digit year — none produce a token), an unauthored-spec
      forward gate (surfaced + counted), a missing-slice-in-authored-spec
      reference (surfaced + counted), all-unresolved ("0 of N"), and a
      malformed / header-separator row skipped.
- [x] Each new test shown to fail when its guard is removed. — both new guards
      verified via stash-and-rerun (marker regex red pre-`wsRow` edit; parked
      fixture attached `{done:0,total:0}` red pre-`scan` guard).
- [x] Reviewed by `reviewer` subagent (compliance + craft passes). — both PASS.
- [x] Implementation review passed.
- [x] Deviation log produced under this slice heading.
- [x] Reconciliation sweep produced under this slice heading.
- [x] Reconciliation review passed. — nit-level findings only; both folded
      (positive test anchor + dead-computation tidy), suite re-run green.
- [x] `docs/refinement-todo.md` updated if any decisions were deferred. — no new
      deferred decisions.

**Anti-horizontal-phasing check:** After this slice, the owner never sees a
broken card or a misleading number from a messy or restyled plan — a real,
observable robustness guarantee on the same card 008-01 built.

### Deviation log (after reconciliation)

Implemented 2026-08-21. Small slice on top of a DONE 008-01: two code guards +
tests. No substantive deviation from the framing-approved design.

- **Render is client-side (`public/index.html`), not `src/server.mjs`** — same
  as 008-01; `server.mjs` only serves the scan JSON. The "· K unresolved" marker
  was added in `wsRow`.
- **The scan attach-condition now has two clauses.** 008-01 attached the goal
  fields when `tokens.length >= 1`; 008-02 tightens it to
  `tokens.length >= 1 && goalProgress.total >= 1`. The second clause is AC4's
  "0 of 0 is never shown": an Include whose references are **all parked**
  (DEFERRED/ABANDONED) extracts tokens but resolves to `total === 0`, so it
  degrades to title-only. The all-*unresolved* case is unaffected (those count in
  `total`, so the meter still shows "0 of N landed · N unresolved"). The
  suppression lives in `src/scan.mjs`, not in the pure `resolveReleaseGoal`
  helper, keeping the helper's counting honest and the display decision in the
  render/scan layer.
- **New test file `test/render.test.mjs`.** The marker needed to be verified
  against the *real* `wsRow`, so the test extracts it from `public/index.html`'s
  inline `<script>` via `node:vm` (asserting both the `<script>` match and
  `typeof wsRow === 'function'`, so a broken extraction fails loudly, never
  false-greens). Not named in the spec; it is the honest way to test the render.
- **Meter wording "slices landed" retained.** The ACs illustrate "N of M landed"
  as "e.g."; the mandated wording is 008-01 AC5's "slices landed" (distinct from
  the checklist "steps"). Kept "slices landed".
- **Post-review fixes (craft pass, both folded).** Added a positive anchor
  (`/Parked launch plan/`) to the all-parked render test so it cannot vacuously
  pass on an empty/garbled string; and inlined the `unresolvedCount` computation
  into the `goalProgress` branch so it is no longer computed on the checklist
  path. Suite re-run green (198/198).

### Reconciliation sweep

Implementation matches the Counting rule and all six ACs — confirmed by the
compliance pass with file:line evidence, craft pass PASS. Key seams verified:

- **"0 of 0" is structurally unreachable** — the meter renders only when
  `goalProgress.total >= 1`; the all-parked corner (the seam 008-01's
  reconciliation flagged) is closed here.
- **Marker never appears on a fully-landed plan** — appended only when
  `goalUnresolved.length >= 1`; the declared `total` is printed verbatim, never
  re-derived, so the denominator is never silently shrunk.
- **All-parked vs all-unresolved** are distinct fixtures with value-based
  (`deepEqual` / regex-on-real-output) assertions, not truthiness.
- **Red→green** demonstrated for both new guards (stash-and-rerun).

No new deferred decisions → `docs/refinement-todo.md` unchanged. **Spec 008 is
now fully implemented** (both slices DONE).
