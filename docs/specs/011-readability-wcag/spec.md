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
`font-size:` finds 50 size declarations: 9px ×1, 9.5px ×1, 10px ×5, 10.5px ×2,
11px ×9, 11.5px ×2, 12px ×11, 12.5px ×6, and 13px and up for the rest. 41 rules
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
- **A2 — measuring each text token against the five surface tokens covers what
  is actually rendered.** The pairing of each text token to the surfaces it can
  sit on is not derived from the DOM. Checking every text token against every
  surface is the conservative over-approximation used by the test (slice 01
  AC2), so A2 only risks over-constraining, never under-constraining.

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
