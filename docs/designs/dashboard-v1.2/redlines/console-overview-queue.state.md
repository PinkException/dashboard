---
screen: console-overview.screen.md
---

# console-overview · action-queue lens — state

## 0. Meta

- **State of:** `console-overview.screen.md` (the all-projects Overview).
- **Trigger:** the **action queue** option in `lens-toggle` is selected.
- Same sheet, summary-band and lens-bar as normal. The change is confined to the
  toggle's active option, the caption, and the body below the lens-bar: the
  columnar `col-header` + `project-list` are replaced by grouped stage sections.
- Reference render: `console-overview-queue.render.png`.

## State deltas

| element | op | value |
| --- | --- | --- |
| lens-toggle | set | active option = **action queue** (`inset` bg, text-hi); **projects** goes inactive (transparent, text-dim) |
| lens-caption | set | text = `every waiting item across all projects · land → start` |
| col-header | hide | no column header in this lens |
| project-list | replace-content | project rows → a vertical list of **stage groups** (see structure below), padded 8 top / 4 bottom |

### Replacement structure (project-list → stage groups)

Six stage groups render in fixed order; each is `top: 1 au border-soft`:
`Land · Merge · Review · Finish & unblock · Start new · Idle`.

**stage-header** — flex baseline row, gap `{md}`, padding 16 `{3xl}` 10:
- square dot `{dot-xl}` (radius 2), stage colour — Land `green` · Merge `slate` · Review `amber` · Finish `amber` · Start `teal` · Idle `dot-border`.
- stage label — `meta (size=13, weight=600, ls=0.04em)`, stage label colour (a lighter tint per stage).
- count — `caption`, text-label, e.g. `2 items`.
- description — `type`, text-dimmer, e.g. `finished work waiting on your review`.

**empty stage** (Land here) — replaces items with a single `— clear` line,
`meta (size=12)`, text-faintest, padded 2 `{3xl}` 16 / left-inset 47.

**queue-item** (per project in a stage) — `queue-grid`, padding 11 `{3xl}`,
top `border-faint`, `hover` on hover, cursor pointer:
- col 1: gutter `{gutter-w}` × `{gutter-h-sm}` rect, radius 2, state colour.
- col 2 (196): name (`name (size=14)`) over type (`type (size=11.5)`, text-dim).
- col 3 (`minmax(260,1fr)`): state `tag` + action (`body (size=13.5)`; text-bright, idle→text-label), ellipsis.
- col 4 (120): wait dot `{dot-sm}` + `waitline`, e.g. `you` / `a teammate` / `launchable` / `—`, ellipsis.
- col 5 (96, right-aligned): flight number (`name (size=15, weight=600)`, flight colour) + `in flight` (`micro (size=10)`, text-faint).

Everything not listed is unchanged from the screen (summary-band, its stats,
sheet chrome).
