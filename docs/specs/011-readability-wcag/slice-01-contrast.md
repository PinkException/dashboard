---
status: DRAFT
dependencies: []
last_verified:
frame_review: true
---

<!-- jig self-defining vocabulary (soft, forward-only). -->
<!-- jig grounding (spec 064-02 / ADR-0020): probe runnable-surface claims. -->

## Slice 011-01 — contrast: every text colour passes WCAG AA in both modes

**Goal:** the owner can read every piece of text on the overview and detail views
in light and in dark mode. Every text colour meets WCAG 2.1 AA, a contrast ratio of
at least 4.5:1, and a test keeps it that way.

**DoR:**
- ✅ Gaps measured (spec 011 § Current state).
- ✅ Text-colour set enumerated (spec 011 § Current state).

**Acceptance Criteria:**

1. **Every text token passes in both modes.** Each token used as a text colour
   (`color: var(--x)` in `public/index.html`, plus the one inline style in
   `public/render.mjs`) reaches ≥ 4.5:1 against each surface token
   (`--canvas`, `--sheet`, `--topbar`, `--hover`, `--inset`). This holds in the
   light `:root` block and in the dark `@media (prefers-color-scheme: dark)`
   block. The same applies to text on the tinted surfaces it sits on: text on
   `--blocked-bg` and `--warn-bg`, as styled today.
2. **A contrast test guards it.** A new test in `test/` parses both token
   blocks of `public/index.html`, computes WCAG 2.1 relative-luminance contrast
   for every (text token × surface token) pair in each mode, and fails naming the
   pair and its ratio when any pair is below 4.5:1. The test also fails if a
   `color:` declaration uses a literal colour instead of a token, so a new colour
   cannot slip past it. Run with `npm test`.
3. **Opacity no longer hides text.** Text in `.session-row.older` (opacity
   0.72) still meets 4.5:1 when blended at that opacity. Either the opacity is
   replaced by a token that passes on its own, or the test accounts for it. The
   running-badge pulse (`cpulse`, opacity down to 0.25) is a decorative
   indicator, not text. It stays, as long as the badge's text label itself passes.
4. **Meaning and hue stay.** Each status colour keeps its role and stays
   recognisably the same hue: green = done/ok, amber = busy/warn, red =
   blocked, orange = hot, blue, purple, stale, abandoned. Only lightness and
   chroma move. The faint/dim/label ramp keeps a visible order (faint is lighter
   than label, which is lighter than muted, in light mode; the reverse in dark),
   now within the passing range.
5. **Owner read-check.** The owner looks at the running page in light and in dark
   mode and confirms the text is readable. Anything still hard to read is
   recorded in the deviation log as a follow-up, not fixed by expanding this slice.

**DoD:**
- [ ] All ACs pass; full test suite green (`npm test`), no regressions.
- [ ] Reviewed by `reviewer` subagent (compliance + craft).
- [ ] Deviation log produced under this slice heading, including the before/after
      ratio table for each changed token.
- [ ] Lightweight decision of 2026-08-31 ("light derived by HSL-mirror … contrast
      preserved by construction"; "dark uses the redline tokens verbatim")
      **revised**. Routed via `decisions.py update` or promoted to an ADR per the
      reconciliation checklist. The revision records that dark mode now deviates
      from the v1.2 redline for accessibility.
- [ ] Reconciliation review passed.

**Anti-horizontal-phasing check:** the owner sees readable colours on the real
page in both modes, and the test is the guard that keeps it so.

### Assumptions

- **A1 (inherits spec A2):** checking every text token against every surface
  over-approximates the real pairings. If that forces a token change that the
  real DOM didn't need, accept it. Readability wins over redline fidelity.
- **A2:** only the colour tokens and the one inline style colour text. Grounded
  by the enumeration in spec 011 § Current state. Re-run that grep at
  implementation start, since main may have moved.
