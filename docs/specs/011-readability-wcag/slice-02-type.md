---
status: DRAFT
dependencies: [011-01]
last_verified:
frame_review: true
---

<!-- jig self-defining vocabulary (soft, forward-only). -->
<!-- jig grounding (spec 064-02 / ADR-0020): probe runnable-surface claims. -->

## Slice 011-02 — type: 12px floor, sans-serif labels

**Goal:** the owner can read labels and metadata without squinting. No text is
smaller than 12px, and labels use the sans-serif font. Monospace stays only
where the text is literally code-like.

**DoR:**
- ⬜ 011-01 DONE. Colours settle first, so this slice's read-check judges type alone.

**Acceptance Criteria:**

1. **12px floor.** Every `font-size` and `font:` shorthand in `public/index.html`
   (and any inline size in `public/render.mjs`) is ≥ 12px. Today there are 20
   declarations below 12px, from 9px to 11.5px (spec 011 § Current state). Body
   stays 14px. Any visual hierarchy that relied on tiny sizes is carried by
   weight or colour instead.
2. **Sans-serif for labels and metadata.** Text that is prose, a label, a count,
   a timestamp or a status word uses `var(--sans)`. `var(--mono)` is kept only for
   literal code-like strings: file paths, branch names, slice/spec ids (`009-04`),
   commit hashes and command snippets. The deviation log lists each rule that
   stayed mono, with the reason.
3. **A type test guards it.** The test from 011-01, or a sibling, fails if any
   size declaration is below 12px, naming the selector and size.
4. **Nothing breaks at 12px.** Overview rows, the detail view and the action
   queue still lay out without clipped or overlapping text at a 1280px-wide
   window and at phone width (375px). Checked in the running page.
5. **Owner read-check.** The owner looks at the running page in both modes and
   confirms labels are readable. Anything left over becomes a recorded follow-up.

**DoD:**
- [ ] All ACs pass; full test suite green (`npm test`), no regressions.
- [ ] Reviewed by `reviewer` subagent (compliance + craft).
- [ ] Deviation log produced under this slice heading.
- [ ] Reconciliation review passed; plugin version bump + release noted for the
      owner. Publishing stays owner-gated.

**Anti-horizontal-phasing check:** the owner sees larger, sans-serif labels on the
real page, and the test keeps the floor.

### Assumptions

- **A1 (inherits spec A1):** monospace labels are part of what makes the page
  hard to read. Not verified. AC5's read-check is the probe. If the owner prefers
  some labels in mono, that is a recorded lightweight decision, not a failure.
- **A2:** raising labels to 12px fits the current row layout without a redesign.
  Not verified; AC4 checks it. If it doesn't fit, stop and surface it rather than
  redesigning the layout inside this slice.
