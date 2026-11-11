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
   `public/render.mjs`) reaches ≥ 4.5:1 against each **text-bearing surface**:
   `--canvas`, `--sheet`, `--topbar`, `--hover`, `--blocked-bg`, `--warn-bg`
   (spec A2). This holds in the light `:root` block and in the dark
   `@media (prefers-color-scheme: dark)` block. `--inset` and other pure fills
   are excluded because no text sits on them.
2. **A contrast test guards it.** A new test in `test/` parses both token
   blocks of `public/index.html`, computes WCAG 2.1 relative-luminance contrast
   for every (text token × text-bearing surface) pair in each mode, and fails
   naming the pair and its ratio when any pair is below 4.5:1. The surface list
   lives in the test with a comment stating the rule ("a surface is listed if text
   can sit on it"). The test also fails if a `color:` declaration uses a literal
   colour instead of a token, so a new colour cannot slip past it. Run with
   `npm test`.
3. **Opacity no longer hides text.** Text in `.session-row.older` (opacity
   0.72) still meets 4.5:1. The opacity is replaced: older rows are dimmed with
   a passing text token, not with `opacity`. Blending at 0.72 would force those
   greys to near-black, because browsers blend in gamma-encoded sRGB. The
   running-badge pulse (`cpulse`, opacity down to 0.25) is a decorative
   indicator, not text. It stays, as long as the badge's text label itself passes.
4. **Meaning and hue stay.** Each status colour keeps its role and stays
   recognisably the same hue: green = done/ok, amber = busy/warn, red =
   blocked, orange = hot, blue, purple, stale, abandoned. Only lightness and
   chroma move. Amber and stale stay visibly distinct from each other.
   **The grey ramp may shrink.** AA leaves only a narrow band for secondary text.
   In light mode, `--hover` (`#dfe3e9`) is the darkest text-bearing surface, and
   even today's `--text-muted` reaches only 4.19:1 on it (probe 2026-11-11). In
   light mode, every grey text token must fit between about `#1f1f1f` and
   `#656565` (frame-critique round 2 arithmetic), so:
   (a) lightening text-bearing surfaces (for example `--hover`) is allowed, to
   widen the band;
   (b) merging grey steps is **required**: faint/label/dimmer/dim collapse onto
   fewer values, and secondary hierarchy is carried by weight or size instead of
   ever-fainter grey. `--stale` must stay distinguishable from the merged greys
   (lower-chroma brown versus neutral grey) and from amber.
   **Light amber is a dark ochre.** No amber at hue ~36° passes 4.5:1 on the
   light text-bearing surfaces without darkening to about `#915800`. The owner
   approves the light amber and stale swatches before implementation. The
   approved values are recorded here and replace any "too brown" judgement call.
4b. **Heat tokens split into text and fill.** `--heat-*` colour both text (the
   in-flight number and bucket word: `render.mjs:307` → `.heat-*` at
   `index.html:144-147`) and the meter cells (`render.mjs:106`). They split into
   text tokens, held to 4.5:1 like any text, and separate fill tokens for the
   meter cells, which are not held to 4.5:1. That way the meter keeps its look
   while the number stays readable.
4c. **The test resolves aliases per mode.** Tokens declared as `var(--other)`
   (e.g. `--heat-*`, declared only in the light `:root`) are resolved against each
   mode's values before contrast is computed.
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

- **A1 (inherits spec A2):** checking every text token against all six
  text-bearing surfaces over-approximates the real pairings. With `--inset`
  excluded and AC4's moves applied, a passing palette exists in both modes
  (frame-critique round 2 arithmetic). The only judgement call, light amber,
  is settled up front by the owner-approved swatch in AC4.
- **A2:** only the colour tokens and the one inline style colour text. Grounded
  by the enumeration in spec 011 § Current state. Re-run that grep at
  implementation start, since main may have moved.
