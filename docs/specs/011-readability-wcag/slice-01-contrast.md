---
status: IN_PROGRESS
dependencies: []
last_verified:
frame_review: true
claimed_by: claude/011-readability-wcag
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
   colour instead of a token, so a new colour cannot slip past it. Alongside that
   grid, the test checks **explicit chip pairs** in each mode: each chip fill
   token against its own text token (`--on-chip-amber` on `--chip-amber-bg`).
   Chip fills are not added to the surface list, and chip text tokens are not
   checked against it. Run with `npm test`.
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
   **Amber becomes a chip (owner decision, 2026-11-11).** No amber at hue ~36°
   passes 4.5:1 as text on the light surfaces without darkening to a dark ochre
   (about `#915800`). Of the two options shown as swatches, the owner chose
   **B, the amber chip**, over A, dark ochre text. Every element that today
   colours text with `--amber`/`--heat-busy` (`.rv-REVIEW` at `index.html:126`
   and the busy bucket word at `:146`; `.tab.active` uses amber only as a border)
   renders as a chip. The chip uses two **new, mode-invariant tokens**, declared
   once and not overridden in the dark block: `--chip-amber-bg` (around
   `#e6a94d`) and `--on-chip-amber` (around `#1f2328`), which measure 7.63:1.
   The chip looks the same in both modes. It must not use `--text`, which turns
   light in dark mode and would measure about 1.5:1 on the fill
   (frame-critique round 3).
   `--stale` stays as text, moved to a passing low-chroma brown (about
   `#7a6040`, 4.56:1 on light `--hover`). Since amber is no longer a text colour,
   stale cannot be confused with it.
4b. **Heat tokens split into text and fill.** `--heat-*` colour both text (the
   in-flight number and bucket word: `render.mjs:307` → `.heat-*` at
   `index.html:144-147`) and the meter cells (`render.mjs:106`). They split:
   - **Meter cells:** separate fill tokens, not held to 4.5:1, so the meter keeps
     its look.
   - **Bucket word:** carries the bucket's colour, using a heat text token held to
     4.5:1, or the amber chip for `busy`.
   - **In-flight number:** uses the normal text colour for every bucket. That is a
     markup change: today `.if-num` shares the `heat-${bucket}` class, which
     `render.mjs:307` must drop from the number.
4c. **The test resolves aliases per mode.** Tokens declared as `var(--other)`
   (e.g. `--heat-*`, declared only in the light `:root`) are resolved against each
   mode's values before contrast is computed.
5. **Owner read-check.** The owner looks at the running page in light and in dark
   mode and confirms the text is readable. Anything still hard to read is
   recorded in the deviation log as a follow-up, not fixed by expanding this slice.

**DoD:**
- [ ] All ACs pass; full test suite green (`npm test`), no regressions.
- [ ] Reviewed by `reviewer` subagent (compliance + craft).
- [x] Deviation log produced under this slice heading, including the before/after
      ratio table for each changed token.
- [ ] Lightweight decision of 2026-08-31 ("light derived by HSL-mirror … contrast
      preserved by construction"; "dark uses the redline tokens verbatim")
      **revised**. Routed via `decisions.py update` or promoted to an ADR per the
      reconciliation checklist. The revision records that dark mode now deviates
      from the v1.2 redline for accessibility.
- [ ] Reconciliation review passed.

**Anti-horizontal-phasing check:** the owner sees readable colours on the real
page in both modes, and the test is the guard that keeps it so.

### Implementation notes (frame-critique round 4, non-blocking)

- Inline `color:var(--text-muted)` also appears at `index.html:246,281`, with no
  space after the colon. The AC2 literal-colour guard must match `color:` with
  or without a space, and should also scan `render.mjs` inline styles.
- `.rv-REVIEW` inherits `--blocked-bg` and `--blocked-border` from the shared
  rule at `index.html:125`. The chip overrides both, not only `color`.
- AC3: older rows map **each child down one step** (title, branch link,
  worktree, last-activity), keeping the link colour and hierarchy. They do not
  share one dim token.
- Stale at about 4.56:1 on light `--hover` has very little margin. The deviation
  log records the final measured value, and lightening `--hover` (AC4 (a)) is
  the preferred way to gain room.
- Light `--green` must darken a lot (2.30 → ≥ 4.5), and it also fills the
  running dots and the 100% bar (`render.mjs:87`). Expect those to darken too.
  If the owner objects at the read-check, split green into text and fill tokens,
  as AC4b does for heat.

### Assumptions

- **A1 (inherits spec A2):** checking every text token against all six
  text-bearing surfaces over-approximates the real pairings. With `--inset`
  excluded and AC4's moves applied, a passing palette exists in both modes
  (frame-critique round 2 arithmetic). The amber chip is checked separately as an
  explicit pair (AC2), not through the grid. The only judgement call, amber, is
  settled by the owner's chip decision in AC4.
- **A2:** only the colour tokens and the one inline style colour text. Grounded
  by the enumeration in spec 011 § Current state. Re-run that grep at
  implementation start, since main may have moved.

### Deviation log (after reconciliation)

**Red → green.** `test/contrast.test.mjs` was written first and run against the
unchanged tokens: **101 failing pairs** (65 light, 36 dark), plus the chip-pair,
mode-invariance, opacity and REVIEW-chip checks failing. After the token, CSS and
markup changes: 10/10 contrast tests pass and the full suite is green
(`npm test`: 426 tests, 0 failures).

**Changed tokens** (worst ratio = lowest over the six text-bearing surfaces; in
light mode that is `--hover`, in dark mode `--hover` too):

| Token | Light before → after | Light worst | Dark before → after | Dark worst |
|---|---|---|---|---|
| `--hover` (surface) | `#dfe3e9` → `#e3e6eb` | n/a (vs `--sheet` 1.118 → 1.086) | unchanged `#161a20` | n/a |
| `--text-muted` | `#636b75` (4.19) → `#59616b` | 5.01 | unchanged `#8a929c` | 5.55 |
| `--text-dim` | `#6f7883` (3.48) → `#5f6771` | 4.58 | unchanged `#7c8590` | 4.67 |
| `--text-dimmer` | `#7f8894` (2.79) → `var(--text-dim)` | 4.58 | `#6b7480` (3.69) → (override removed, aliases `--text-dim`) | 4.67 |
| `--text-label` | `#8c95a0` (2.36) → `var(--text-dim)` | 4.58 | `#5f6873` (3.09) → (override removed) | 4.67 |
| `--text-faint` | `#a1aab5` (1.82) → `var(--text-dim)` | 4.58 | `#4a535e` (2.24) → (override removed) | 4.67 |
| `--green` | `#3cb37a` (2.06) → `#176e45` | 5.01 | unchanged `#4cc38a` | 7.88 |
| `--abandoned` | `#aa8590` (2.52) → `#875866` | 4.64 | `#7a5560` (2.74) → `#a37d89` | 4.87 |
| `--stale` | `#c5a575` (1.81) → `#7a6040` | **4.70** | `#8a6a3a` (3.49) → `#a3865e` | 5.10 |
| `--heat-clear` | alias of `--text-faint` (1.82) | 4.58 | alias (2.24) | 4.67 |
| `--heat-light` | alias of `--text-muted` (4.19) | 5.01 | alias | 5.55 |
| `--heat-busy` | `var(--amber)` (2.99) → **removed** (busy word is the amber chip) | n/a | n/a | n/a |
| `--heat-fill-clear/-light/-busy/-hot` | **new** fill tokens: `#a1aab5`, `#636b75`, `var(--amber)`, `var(--orange)` (the old meter look) | not text | `#4a535e`, `#8a929c` (dark overrides) | not text |
| `--chip-amber-bg` / `--on-chip-amber` | **new**, mode-invariant: `#e6a94d` / `#1f2328` | chip pair 7.63 | same tokens (not overridden) | 7.63 |

Unchanged text tokens that already passed (e.g. `--draft` light now 4.56 on the
lighter `--hover`, `--blue` 4.68) were not touched. No other dark token changed.
`--text-dim2` and `--text-faintest` are not used as text anywhere, so they were
left as-is.

**Final stale:** light `#7a6040` at 4.70:1 worst (on `--hover`, gained from 4.56
by lightening `--hover` per AC4 (a)); dark `#a3865e` at 5.10:1.

**Markup/CSS changes:** `.rv-REVIEW` overrides colour, background and border to
the amber chip; `.heat-busy` (the busy bucket word) renders as the amber chip;
`.if-num` drops the `heat-${bucket}` class and uses `--text-hi`; the meter cells
use `--heat-fill-${bucket}`; `.session-row.older` opacity removed — title →
`--text-body`, worktree → `--text-dim`; last-activity is not restyled (see item 3).

**Deviations and judgement calls:**

1. **Roadmap tab put text on `--inset`** (added to main after the spec was
   written): `.rm-step` (step label + title) and `.chip-progress` used
   `background: var(--inset)`, which breaks the spec's premise that no text sits
   on `--inset`. Rather than add `--inset` to the surface list (it is darker than
   `--hover` in light mode and would push every grey and stale below the band),
   both now use `--hover`, a listed text-bearing surface. `--inset` stays a pure
   fill (meter empty cells). The step boxes are a little lighter in light mode.
2. **Roadmap step label was amber text** (`.rm-step-label`, also new): rendered as
   the amber chip, like the other amber text; the parked variant drops the chip
   fill and stays `--text-dimmer`.
3. **AC3 branch link:** "keeping the link colour" was read as the branch staying
   on `--link` in older rows (not stepped to `--link-dim`, which fails AA in
   light mode). `--text-label`, `--text-faint` and `--text-dimmer` alias
   `--text-dim` in BOTH modes, so older last-activity (`--text-label`) cannot be
   stepped separately: its `.sr-last` override was a no-op and was removed.
   The title steps one level (`--text-hi` -> `--text-body`, passing AA in both
   modes via the AC1 grid) and the worktree goes to `--text-dim`.
   The AC4c test is a unit test of the resolver helper on synthetic input; real
   per-mode resolution of the shipped tokens is covered by the AC1 grid in the
   dark mode run.
4. **Grey merge is via aliases:** `--text-dimmer`, `--text-label` and
   `--text-faint` alias `--text-dim` in `:root`, and their dark overrides were
   removed, so they follow dark `--text-dim`. The remaining light grey band is
   three values (`--text-subhead` `#535b65`, `--text-muted` `#59616b`,
   `--text-dim` `#5f6771`); the heat `clear` and `light` words are now near-equal
   greys and differ by label only.
5. **`--green` darkened as a fill too** (running dots, 100% bar), as the
   implementation notes predicted. Not split; revisit at the owner read-check.
7. **Chip width fix (review round):** the busy-bucket chip (`.heat-busy`) sat in
   a flex column and stretched across the in-flight cell; it now has
   `width: fit-content` like `.rm-step-label`. Guards added: every rule with the
   amber chip fill constrains its width, and `--on-chip-amber` text only appears
   with the chip fill. The AC2 no-space assertion now tests the parser on a
   literal input.
6. **Literal-colour guard scope:** a `color:` value passes if it is a
   `var(--token)` or a non-colour keyword (`inherit`, `currentColor`,
   `transparent`, `initial`, `unset`).

**AC5 (owner read-check): not yet done** — pending the owner looking at both
modes. Anything still hard to read goes here as a follow-up.
