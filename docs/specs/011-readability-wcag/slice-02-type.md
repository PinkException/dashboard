---
status: DEFERRED
dependencies: [011-01]
last_verified:
frame_review: true
---

<!-- jig self-defining vocabulary (soft, forward-only). -->
<!-- jig grounding (spec 064-02 / ADR-0020): probe runnable-surface claims. -->

## Slice 011-02 — type: 12px floor, sans-serif labels

**Resolution trigger:** paused 2026-11-17 by the owner — a new dashboard design is being built in another session. When it lands, apply this slice's rules (12px floor, sans labels, fixed-width digits) to the new design if it still needs them.

**Goal:** the owner can read labels and metadata without squinting. No text is
smaller than 12px, and labels use the sans-serif font. Monospace stays only
where the text is literally code-like.

**DoR:**
- ⬜ 011-01 DONE. Colours settle first, so this slice's read-check judges type alone.

**Acceptance Criteria:**

1. **12px floor.** Every `font-size` and `font:` shorthand in `public/index.html`
   (and any inline size in `public/render.mjs`) is ≥ 12px. Today there are 22
   declarations below 12px, from 9px to 11.5px (spec 011 § Current state). Body
   stays 14px. Any visual hierarchy that relied on tiny sizes is carried by
   weight or colour instead.
2. **Sans-serif for labels and metadata.** Text that is prose, a label, a count,
   a timestamp or a status word uses `var(--sans)`. `var(--mono)` is kept only for
   literal code-like strings: file paths, branch names, slice/spec ids (`009-04`),
   commit hashes and command snippets. Large numerals (`.stat-count`,
   `.if-num`, `.pct`) either stay mono or switch to sans with
   the CSS numeric-variant setting for fixed-width digits, so digits stay aligned. Where one
   selector wraps both kinds of text (e.g. `.pr-row` holds a PR number and a
   prose `.pr-title`, `render.mjs:446-447`), the split is done on child elements.
   Labels moved to sans may also lose their wide letter-spacing and uppercase
   (`.label`, `.col-header`, `.stat-label`, `.chip`; 0.1-0.14em), since tracking
   is one of spec A1's suspects. The deviation log lists, per element, what
   stayed mono and what tracking or case changed.
3. **A type test guards it.** The test from 011-01, or a sibling, fails if any
   size declaration is below 12px, naming the selector and size.
4. **No new clipping.** At a 1280px-wide window, and at the overview grid's own
   minimum width (about 1180px; `index.html:98,102`), overview rows, the detail
   view and the action queue show no clipped or overlapping text that was not
   already clipped before this slice. Before/after screenshots at both widths
   are kept as evidence. Phone width is out of scope: the layout is fixed-width
   and already clips there (spec § Out of scope).
5. **Owner read-check.** The owner looks at the running page in both modes and
   confirms labels are readable. Anything left over becomes a recorded follow-up.

**DoD:**
- [ ] All ACs pass; full test suite green (`npm test`), no regressions.
- [ ] Reviewed by `reviewer` subagent (compliance + craft).
- [ ] Deviation log produced under this slice heading.
- [ ] The departure from the redline's mono 9.5-11px type table (`base.md:124-131`)
      is recorded as a decision (lightweight decision, or an ADR alongside 011-01's
      colour revision), not only listed per rule.
- [ ] Reconciliation review passed; plugin version bump + release noted for the
      owner. Publishing stays owner-gated.

**Anti-horizontal-phasing check:** the owner sees larger, sans-serif labels on the
real page, and the test keeps the floor.

### Assumptions

- **A1 (inherits spec A1):** monospace labels are part of what makes the page
  hard to read. Not verified. AC5's read-check is the probe. If the owner prefers
  some labels in mono, that is a recorded lightweight decision, not a failure.
- **A2:** raising labels to 12px fits the current row layout at desktop widths
  without a redesign. Not verified; AC4 checks it against the pre-change
  baseline. If new clipping appears, stop and surface it rather than redesigning
  the layout inside this slice.
