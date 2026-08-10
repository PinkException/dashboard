# base — Console direction, dashboard v1.2

Shared base sheet for the Console-direction views. Every fact below is stated
once here; screen and state files reference these tokens by name and never
restate a value or a raw hex.

Scope: the Console direction only (dark, monospace). The Product direction on
the same canvas is out of scope and not measured.

## Frame defaults

- **Reference frame:** 1360 au wide × height hugs content (variable per view/state).
- **Density:** 1× — the reference render is 1 au = 1 px.
- **Driving axis:** width. The sheet is a fixed-width column; all content stacks
  vertically and the sheet height hugs.
- **Screen-level default:** the sheet is **FIXED** at `{sheet-w}` au wide. Every
  element inside is FIXED unless its row says SCALES (a `minmax(...,1fr)` or
  `fr` column, or a `fill` width).
- **Safe area:** none — desktop web surface, no notch/inset assumptions.
- The sheet sits on the canvas page background (chrome, not part of any screen).

## Color tokens

Every colour in the cascade is one of these. No raw hex appears anywhere else.

| Token | Hex | Role |
| --- | --- | --- |
| transparent | transparent | absent fill / border (idle gutter, unselected tag/tab bg) |
| sheet | #0d0f12 | screen background & card surface |
| topbar | #0b0d10 | detail top bar background |
| row-you | #100e0a | To-do (You) row background |
| row-blocking | #130f0c | blocking row background |
| row-idle | #0b0c0e | idle row background |
| hover | #161a20 | row / button hover background |
| toggle-bg | #111418 | lens-toggle track background |
| inset | #20262e | active lens-tab fill · empty in-flight cell |
| banner-you | #151109 | detail state-banner bg — You |
| banner-blocking | #17110c | detail state-banner bg — blocking |
| banner-ready | #0a1416 | detail state-banner bg — Ready |
| banner-external | #0e1014 | detail state-banner bg — External |
| banner-idle | #0c0e11 | detail state-banner bg — Idle |
| blocked-bg | #1a1013 | detail "blocked" callout background |
| warn-bg | #151013 | worktree-warning row background |
| track | #1e2329 | progress-bar track · two-column grid gap |
| border | #1e2329 | primary divider / sheet border |
| border-soft | #14181d | inner row / section divider |
| border-faint | #101317 | queue item divider |
| border-strong | #2a323a | button / default chip border |
| border-dash | #2b333b | dashed placeholder border (activity tab) |
| toggle-border | #232a31 | lens-toggle track border |
| blocked-border | #3a1d22 | blocked-callout border |
| ok-border | #245040 | current / all-done chip border |
| dot-border | #3a4550 | hollow older-session dot border |
| gutter-ready | #2c4d50 | Ready state gutter |
| gutter-external | #333b45 | External state gutter |
| border-ready | #2f5e62 | Ready tag border |
| border-external | #39424e | External tag border |
| border-idle | #262d34 | Idle tag border |
| text | #d7dbe0 | base body text (sheet default) |
| text-white | #f2f4f7 | You-row action text (brightest) |
| text-hi | #eef1f4 | primary emphasis text |
| text-body | #dfe4e9 | running prose |
| text-bright | #c9d0d8 | secondary bright text |
| text-item | #aab2bc | list-item body text |
| text-subhead | #9aa2ac | column subheader · back button |
| text-muted | #8a929c | muted text |
| text-dim | #7c8590 | dim text · inactive tab |
| text-dim2 | #66707b | flight "light" word |
| text-dimmer | #6b7480 | dimmer text · DEFERRED spec |
| text-label | #5f6873 | mono labels & captions |
| text-faint | #4a535e | faint text · "clear" flight |
| text-faintest | #3d4550 | faintest text · empty-stage dash |
| green | #4cc38a | done · running dot · launch |
| blue | #4c9be8 | progress fill · in-progress spec |
| amber | #e6a94d | To-do (You) state · warning icon |
| amber-soft | #c79a5a | wait line (You) · "busy" flight word |
| amber-pale | #e0c48f | banner wait line (You) |
| ink-amber | #17120a | dark text on amber tag |
| teal | #46c6cf | Ready state |
| teal-bright | #5fd2da | Ready tag text |
| teal-pale | #cfe9ec | Ready-row action text |
| teal-dim | #4f8a8e | Ready stat label |
| slate | #8a94a3 | External state |
| slate-bright | #98a2b0 | External tag text |
| slate-pale | #9aa4b0 | External-row action text |
| slate-dim | #6b7684 | External wait dot |
| idle | #59636f | Idle state |
| idle-text | #5b6570 | Idle tag text |
| dot-off | #2f3841 | not-running / idle dot |
| red | #f0616f | blocking · high-severity bug |
| red-soft | #f2c2c8 | blocked-callout text |
| ink-red | #1a0d0f | dark text on red tag / bg |
| orange | #ef7a5b | "hot" in-flight |
| link | #6f9bd0 | branch · track label · toggles |
| link-hover | #8fb6e8 | link hover |
| link-dim | #5f7fa8 | older-session branch |
| purple | #b48ce8 | runbook workstream kind |
| draft | #8b93a0 | DRAFT spec |
| abandoned | #7a5560 | ABANDONED spec |
| stale | #8a6a3a | stale "what's next" age |
| warn-text | #e8cf9e | worktree-warning text |
| bug-low | #c9a15a | low-severity bug |
| shipped | #5c8a6f | "all items shipped" note |

## Type scale

Two families: **mono** = `IBM Plex Mono`, **sans** = `IBM Plex Sans`. Sizes,
line-heights and letter-spacing in au (letter-spacing authored as em; the au
value shown = em × the style's size). A per-element departure is written as an
override on the style name, e.g. `name (size=14)`.

| style | family | weight | size (au) | line-height | letter-spacing (au) | color |
| --- | --- | --- | --- | --- | --- | --- |
| display | mono | 600 | 32 | 1.0 | 0 | text-hi |
| title | sans | 600 | 21 | 1.2 | 0 | text-hi |
| stat | mono | 600 | 26 | 0.9 | 0 | (per state) |
| pct | mono | 500 | 16 | 1.2 | 0 | text-bright |
| name | mono | 600 | 15 | 1.3 | 0 | text-hi |
| action | sans | 400 | 14 | 1.35 | 0 | (per state) |
| lede | sans | 400 | 16 | 1.5 | 0 | text-body |
| body | sans | 400 | 14 | 1.5 | 0 | text-bright |
| item | sans | 400 | 13 | 1.4 | 0 | text-item |
| type | sans | 400 | 12.5 | 1.3 | 0 | text-muted |
| tag | mono | 600 | 10 | 1.0 | 1.0 (0.1em) | (per state) |
| chip | mono | 400 | 9.5 | 1.0 | 0.95 (0.1em, uppercase) | (per state) |
| label | mono | 400 | 10 | 1.0 | 1.2 (0.12em, uppercase) | text-label |
| caption | mono | 400 | 11 | 1.0 | 0.44 (0.04em) | text-label |
| meta | mono | 400 | 12 | 1.4 | 0 | text-label |
| waitline | mono | 400 | 11 | 1.0 | 0.33 (0.03em) | (per state) |
| micro | mono | 400 | 9.5 | 1.0 | 0.57 (0.06em) | text-faint |
| path | mono | 400 | 11 | 1.0 | 1.32 (0.12em) | text-label |

## Spacing scale

| step | au |
| --- | --- |
| 2xs | 4 |
| xs | 7 |
| sm | 8 |
| md | 12 |
| lg | 14 |
| xl | 16 |
| 2xl | 20 |
| 3xl | 26 |

`3xl` (26) is the standard horizontal sheet padding on every band and row.
Values off this scale (9, 11, 13, 18, 22, 24) appear occasionally and are
written as bare au numbers in the screen files.

## Common sizes

| name | au |
| --- | --- |
| sheet-w | 1360 |
| sheet-radius | 10 |
| row-min-h | 104 |
| gutter-w | 3 |
| gutter-h | 62 |
| gutter-h-sm | 34 |
| bar-w | 118 |
| bar-h | 4 |
| bar-w-lg | 200 |
| bar-h-lg | 5 |
| flight-cell | 11 × 5 |
| dot-sm | 6 |
| dot | 7 |
| dot-lg | 8 |
| dot-xl | 9 |
| proj-grid | cols: 3 · 248 · minmax(300,1fr) · 132 · 140 · 150 — gap 2xl |
| queue-grid | cols: 3 · 196 · minmax(260,1fr) · 120 · 96 — gap 18 |
| detail-grid | cols: 1.35fr · 1fr — gap 1 (on a `track` background) |
| specs-grid | cols: 40 · 1fr · auto · auto — gap lg |
| ws-item-grid | flex column, gap 8 per workstream |
| session-grid | cols: 18 · 1.3fr · 1.4fr · 1fr · auto — gap lg |
| bug-grid | cols: 80 · 1fr · auto · auto — gap lg |

## Per-target unit mapping

- Default: **1 au = 1 dp** (Android) = **1 pt** (iOS) = **1 px** at the reference
  width (web).
- Text au → **sp** (Android), **pt** (iOS), **rem = au ÷ 16** (web).
- Letter-spacing au → the same platform text unit; or re-derive from the em
  values in the type scale.
- No dp/sp/px/pt appears in any screen or state file — those units live only here.
