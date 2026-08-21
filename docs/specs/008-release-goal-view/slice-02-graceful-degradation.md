---
status: READY_FOR_IMPLEMENTATION
dependencies: [008-01]
last_verified:
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
- [ ] All ACs pass; full test suite green (no regressions).
- [ ] Implementer test coverage exercises each failure mode with a synthetic
      fixture: no-Include, zero-token degrade (empty/restyled table; a number in
      a Rationale cell; a 4-digit year — none produce a token), an unauthored-spec
      forward gate (surfaced + counted), a missing-slice-in-authored-spec
      reference (surfaced + counted), all-unresolved ("0 of N"), and a
      malformed / header-separator row skipped.
- [ ] Each new test shown to fail when its guard is removed.
- [ ] Reviewed by `reviewer` subagent (compliance + craft passes).
- [ ] Implementation review passed.
- [ ] Deviation log produced under this slice heading.
- [ ] Reconciliation sweep produced under this slice heading.
- [ ] Reconciliation review passed.
- [ ] `docs/refinement-todo.md` updated if any decisions were deferred.

**Anti-horizontal-phasing check:** After this slice, the owner never sees a
broken card or a misleading number from a messy or restyled plan — a real,
observable robustness guarantee on the same card 008-01 built.

### Deviation log (after reconciliation)

_TBD at implementation._

### Reconciliation sweep

_TBD at reconciliation._
