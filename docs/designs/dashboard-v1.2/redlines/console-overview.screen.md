---
base: base.md
---

# console-overview — screen

## 0. Meta

- **Screen:** all-projects Overview, Console direction.
- **Normal state:** the **projects lens** (measured here). The **action-queue
  lens** is a state delta — see `console-overview-queue.state.md`.
- **Frame:** `{sheet-w}` × hug, FIXED (width-driven). Reference render 1360×1029.
- Sheet: background `sheet`, 1 au `border`, radius `{sheet-radius}`, `overflow:hidden`.
- Element ids below are the join keys reused unchanged across this screen's states.

## 3. Elements

| id | size (au) | fixed/scales | position |
| --- | --- | --- | --- |
| sheet | {sheet-w} × hug | FIXED | root; the whole card. |
| summary-band | fill × hug (~88) | FIXED | top of sheet; padding 22 `{3xl}`; 1 au `border` on its bottom edge; space-between row, items centered. |
| summary-id | hug × hug | FIXED | left of summary-band; a 2-row stack (`{2xs}` gap) — path over title. |
| summary-stats | hug × hug | SCALES | right of summary-band; horizontal row of 4 stat cells + a running cell, no gap; each cell padded 0 22 with a right `border` divider (running cell has no divider, left pad 22). |
| lens-bar | fill × hug | FIXED | directly below summary-band; padding 14 `{3xl}`; bottom `border`; space-between, centered. |
| lens-toggle | hug × hug | FIXED | left of lens-bar; segmented control, `toggle-bg` fill, 1 au `toggle-border`, radius 7, pad `{2xs}`, `{2xs}` inner... inner gap 3. Two options: **projects** (active) + **action queue**. |
| lens-caption | hug × hug | FIXED | right of lens-bar; caption text, right-aligned. |
| col-header | fill × hug | FIXED | below lens-bar; `proj-grid`; padding 11 `{3xl}`; bottom `border`; cells vertically centered. |
| project-list | fill × hug | FIXED | fills remaining sheet height; a vertical stack of `project-row`. |
| project-row | fill × min `{row-min-h}` | SCALES | repeated (8 in data); `proj-grid`; padding 0 `{3xl}`; top `border-soft`; background per state (`sheet` / `row-you` / `row-blocking` / `row-idle`); `hover` on hover; idle rows at 0.62 opacity; cursor pointer. |
| row-gutter | `{gutter-w}` × `{gutter-h}` | FIXED | grid col 1; vertical bar, radius 2, fill = state gutter colour. |
| row-project | fill × hug | SCALES | grid col 2 (248); stack `{xs}` gap: name-line (running dot `{dot}` + `name`), then `type`, then `chip` (self-start). |
| row-nextmove | fill × hug | SCALES | grid col 3 (focal, `minmax(300,1fr)`); stack gap 9: tag-line (state `tag` + optional sub + optional BLOCKING chip), then `action`, then wait-line (`{dot-sm}` dot + `waitline`). |
| row-inflight | fill × hug | FIXED | grid col 4 (132); stack `{xs}` gap: `stat` number + word, then 6 flight cells (see §5), then "open fronts" `micro`. |
| row-progress | fill × hug | FIXED | grid col 5 (140); stack `{sm}` gap: `pct` + specs-count `caption`, then progress track (see §5). |
| row-activity | fill × hug | FIXED | grid col 6 (150); stack `{xs}` gap: running dot `{dot}` + active `meta`, then last-touched `meta`. |

Notes on state-driven fills (data-driven, not layout):
- `row-gutter` fill: You→amber, Ready→gutter-ready, External→gutter-external, Idle→transparent.
- state `tag`: You = solid `amber` bg / `ink-amber` text; Ready = transparent / `border-ready` / `teal-bright`; External = transparent / `border-external` / `slate-bright`; Idle = transparent / `border-idle` / `idle-text`.
- BLOCKING chip: `red` bg, `ink-red` text (shown only when blocking, e.g. Ledger).

## 4. Text elements

| id / part | style | content (this render) |
| --- | --- | --- |
| summary-path | path | `~/projects` |
| summary-title | title | `Overview` |
| stat count | display | `4` `2` `1` `1` — colours amber / teal / slate / idle |
| stat label | label (size=10, ls=1.3/0.13em) | `TO DO` `READY` `EXTERNAL` `IDLE` — colours amber-soft / teal-dim / text-label / text-faint |
| running count | display (weight=500) | `5`, text-hi (preceded by a green pulsing `{dot-lg}` dot) |
| running label | label (ls=1.3/0.13em) | `RUNNING NOW`, text-label |
| lens-toggle · projects | meta (size=12) | `projects` — active: `inset` bg, text-hi |
| lens-toggle · action queue | meta (size=12) | `action queue` — inactive: transparent, text-dim |
| lens-caption | caption | `ordered finish-first · nearly-done above just-started` |
| col-header | label (ls=1.2/0.12em) | `PROJECT` · `NEXT MOVE · WAITING ON` (text-subhead) · `IN FLIGHT` · `PROGRESS` · `ACTIVITY` |
| row-project · name | name | e.g. `Trailhead` |
| row-project · type | type | e.g. `hiking route planner` |
| row-project · chip | chip | e.g. `ACTIVE` (text-muted / border-strong) or `ALL SPECS DONE` (green / ok-border) |
| row-nextmove · tag | tag | state label, e.g. `DECIDE` / `REVIEW` / `EXTERNAL` / `READY` / `IDLE` |
| row-nextmove · action | action | the next move; You rows override `action (weight=500, size=15.5)`, idle rows `action (style=italic)`; colour: You→text-white, Ready→teal-pale, External→slate-pale, Idle→text-label |
| row-nextmove · wait | waitline | e.g. `waiting on you` (amber-soft) / `you can launch now` (text-dim) / `nothing waiting` (text-faint) |
| row-inflight · number | stat | e.g. `10`; colour orange(hot)/amber(busy)/text-faint(clear)/text-muted(light) |
| row-inflight · word | micro (size=10) | `hot` / `busy` / `clear` / `light` |
| row-inflight · caption | micro | `open fronts` |
| row-progress · pct | pct | e.g. `62%` |
| row-progress · specs | caption | e.g. `18/28` |
| row-activity · primary | meta (size=13) | `N active` (text-bright) or `idle` (text-label) |
| row-activity · last | meta (size=11.5) | e.g. `just now`, text-label |

## 5. Rings / arcs / curves

Non-text graphics (all rects/circles — no rings or arcs):

- **running dot** — `{dot}` circle, `green`, `cpulse` pulse (opacity 1→0.25→1, 1.8s ease-in-out infinite); when not running: `dot-off`, no animation.
- **summary running dot** — `{dot-lg}` circle, `green`, `cpulse`.
- **wait dot** — `{dot-sm}` circle; fill = state wait-dot (amber / teal / slate-dim / dot-off).
- **row-gutter** — `{gutter-w}` × `{gutter-h}` rect, radius 2, state-coloured (see §3).
- **flight cells** — 6× `{flight-cell}` rects, radius 1, gap 3; the first *n* filled with the flight colour, the rest `inset`.
- **progress track** — `{bar-w}` × `{bar-h}` rect, radius 2, `track` bg; fill rect width = pct%, colour `green` at 100% else `blue`.
- **chip / tag** — rounded rects (radius 3–4), 1 au border, see §3 fills.

## 6. Reference render

`console-overview.render.png` — projects lens, 1× (1 au = 1 px), unframed.
