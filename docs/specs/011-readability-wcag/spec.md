---
status: DRAFT
skill:
use_cases: [UC-1, UC-6]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 011: Readability (WCAG AA text contrast + type floor)

> Reserved on 2026-11-11 via `workflow.py new --no-push` (local provisional number, not yet on origin/main).

## Overview

**What changes:** the dashboard page becomes comfortable to read. Every piece of
text meets the WCAG 2.1 AA (Web Content Accessibility Guidelines, level AA)
contrast minimum of **4.5:1** in **both** light and dark mode. No text is smaller
than **12px**. Small labels use the sans-serif font instead of monospace.

**Why it matters:** the owner reported on 2026-11-11 that the font and colours are
hard to read. A measurement the same day confirmed it. The page is the owner's
daily triage surface (UC-1, UC-6), so anything hard to read defeats its purpose.

**Main tradeoff:** the dark theme was shipped as the v1.2 redline's tokens
*verbatim* (lightweight decision 2026-08-31). Passing AA means some dark tokens
must change, so dark mode will deviate from the redline. The light palette was
derived by mirroring each token's HSL lightness, which was assumed to "preserve
contrast by construction". The measurement shows it does not, because HSL
lightness is not WCAG relative luminance. That recorded decision is therefore
**revised**, and the reconciliation must route that revision (update the entry,
or promote it to an ADR).

**Second tradeoff (type):** the redline is the "Console direction (dark,
monospace)" (`docs/designs/dashboard-v1.2/redlines/base.md:7`). Its type table
sets chip, tag, label, caption, micro, path, meta and waitline in mono at
9.5-11px (`base.md:124-131`). Slice 02 overrides that table on both size and
font family, so the page will look less "console-like". This is a deliberate
departure, routed the same way as the colour change.

**Out of scope:** phone-width layout. The overview grid is fixed at roughly
1125px minimum (`public/index.html:98,102`), `.sheet` clips overflow, and the
redline is desktop-only (`base.md:16-19`). That is a separate follow-up.

### Current state (measured 2026-11-11, probe in this session)

Contrast of text tokens against `--sheet` (the card surface), computed with the
WCAG 2.1 relative-luminance formula from the token values in
`public/index.html:18-53`. The page is byte-identical to the installed 0.6.0
plugin.

| Token | Light | Dark |
|---|---|---|
| `--text`, `--text-muted`, `--link`, `--draft` | pass | pass |
| `--text-dim` | 3.89 ❌ | 5.13 |
| `--text-dimmer` | 3.12 ❌ | 4.05 ❌ |
| `--text-label` (12 uses) | 2.63 ❌ | 3.39 ❌ |
| `--text-faint` | 2.04 ❌ | 2.46 ❌ |
| `--green` | 2.30 ❌ | 8.66 |
| `--amber` | 3.34 ❌ | 9.27 |
| `--stale` | 2.02 ❌ | 3.84 ❌ |
| `--abandoned` | 2.82 ❌ | 3.01 ❌ |

Type: body text is 14px. Grepping `public/index.html` for `font:` and
`font-size:` (including shorthands that put a weight before the size) finds 22
declarations below 12px: 9px ×1, 9.5px ×2, 10px ×5, 10.5px ×3, 11px ×9,
11.5px ×2. A first count of 20 missed weight-first shorthands; frame-critique
round 1 caught it. 41 rules
use `var(--mono)` and 17 use `var(--sans)`. IBM Plex is named first in both font
stacks but is deliberately never loaded (header comment, `public/index.html:14-16`,
ADR-0001 zero-dep, offline-safe), so the system font renders. That stays.

**Text-colour set (enumerated):** `color: var(--…)` in `public/index.html` uses
26 distinct tokens. `public/render.mjs` has exactly one inline style
(`render.mjs:660`, `--text-muted`). A search for literal `#hex`, `rgb()`,
`hsl()`, `color-mix()`, `filter:` and `mix-blend` outside the token blocks
(`:root` and the dark `@media` block) returns nothing. The search is exhaustive
because colour can only reach text through these CSS syntaxes in these two
files: the page has no other stylesheet and no script that sets `style.color`
other than the one inline string. Two opacity rules lower effective contrast:
`.session-row.older { opacity: 0.72 }` (line 221) and the `cpulse` animation
(line 96, running-badge pulse).

## Assumptions

- **A1 — the owner's "hard to read" is fully explained by contrast, size and
  monospace labels.** Not verified. Line-height, letter-spacing
  (`.pr-hint` uses uppercase + 0.06em tracking) or density may also contribute.
  Mitigation: each slice ends with the owner reading the page in both modes (an
  AC), and anything left over becomes a follow-up instead of growing this spec.
- **A2 — the text-bearing surfaces are `--canvas`, `--sheet`, `--topbar`,
  `--hover`, `--blocked-bg` and `--warn-bg`.** Derived from the `background:`
  declarations in `public/index.html`, minus fills that carry no text. `--inset`
  is used only as the heat meter's empty-cell fill (`render.mjs:106`). `--track`
  sits behind `--sheet` panels. `--green` and `--dot-off` are dot/bar fills. The
  pairing of each text token to its surfaces is not derived from the DOM, so the
  test checks every text token against all six. That over-approximates, but
  without `--inset` it no longer forces the grey ramp to collapse
  (frame-critique round 1).

## Decomposition

SPIDR (Spike, Paths, Interfaces, Data, Rules), split along **Rules**, by which
legibility rule a slice enforces. Each slice changes what the owner sees on the
real page, in both modes:

- **011-01 — contrast:** every text colour passes 4.5:1 in light and dark mode,
  locked in by an automated contrast test over the token blocks.
- **011-02 — type:** a 12px floor on every text size, and sans-serif for labels
  and metadata, with monospace kept only for literal code-like strings.

Contrast goes first because it is the larger, measurable failure and is
independent of type. Spike: not needed, since the gaps are already measured.
Splitting by mode (light, then dark) was rejected: both modes share one token
file and one test, so splitting them would mean touching the same lines twice.

## Slices

- [011-01 — contrast](slice-01-contrast.md)
- [011-02 — type](slice-02-type.md)
