---
base: base.md
---

# console-detail — screen

## 0. Meta

- **Screen:** single-project Detail, Console direction (second screen; reached by
  clicking a `project-row` on the Overview).
- **Normal state:** the **overview tab** (measured here; the **activity tab** is a
  reserved empty state, noted but not a separate file). Reference render is the
  `Trailhead` project (state You/decide, not blocking).
- **Frame:** `{sheet-w}` × hug, FIXED (width-driven). Reference render 1360×1365.
- Sheet: background `sheet`, 1 au `border`, radius `{sheet-radius}`, overflow hidden.

## 3. Elements

| id | size (au) | fixed/scales | position |
| --- | --- | --- | --- |
| sheet | {sheet-w} × hug | FIXED | root card. |
| topbar | fill × hug | FIXED | top of sheet; `topbar` bg; padding 13 `{3xl}`; bottom `border`; flex row, gap `{lg}`, centered. |
| back-btn | hug × hug | FIXED | left of topbar; pill, 1 au `border-strong`, radius 5, pad 5 11; `hover` on hover. |
| crumb | hug × hug | FIXED | right of back-btn; `~/projects/{id}`. |
| header | fill × hug | FIXED | below topbar; padding 24 `{3xl}` 0; bottom `border`; space-between, items flex-start. |
| header-id | hug × hug | SCALES | left of header; stack `{md}`+ gap: title-line, meta-line, then tabs. |
| detail-title-line | hug × hug | FIXED | dot `{dot-xl}` + name + type + chip, gap `{md}`, centered. |
| detail-meta | hug × hug | FIXED | below title-line (gap 9); one mono line. |
| tabs | hug × hug | FIXED | bottom of header-id; two tab labels, gap 2; each pad 9 `{xl}`, 2 au bottom border (active = amber, inactive = transparent). |
| progress-readout | ~200 × hug | FIXED | right of header; right-aligned stack, gap `{xs}`: readout text then bar. |
| state-banner | fill × hug | FIXED | below header; padding 18 `{3xl}`; bottom `border`; bg per state (banner-you here); flex row, gap `{xl}`. |
| banner-tag | hug × hug | FIXED | left of banner; state `tag`, self-start; `tag (size=10)`, pad 5 11, radius 5. |
| banner-body | hug × hug | SCALES | right of banner-tag; action-line (action + optional BLOCKING) over wait-line (`{dot-sm}` dot + text). |
| whats-next | fill × hug | FIXED | below banner; padding `{2xl}` `{3xl}`; bottom `border-soft`; label+age header, then body. |
| wn-header | fill × hug | FIXED | top of whats-next; space-between baseline; `WHAT'S NEXT` label + age. |
| wn-line | fill × hug | SCALES | the summary sentence, `lede`, max-width 960. |
| wn-next | fill × hug | SCALES | `NEXT` tab (`caption`, green, uppercase) + `body`. |
| wn-blocked | fill × hug | SCALES | callout: `blocked-bg`, 1 au `blocked-border`, radius 6, pad 11 14; `BLOCKED` label (red) + `body` in `red-soft`. |
| counts-line | fill × hug | FIXED | below whats-next; padding `{lg}` `{3xl}`; bottom `border-soft`; one `meta (size=12.5)` line, text-muted. |
| two-col | fill × hug | FIXED | below counts-line; `detail-grid` on a `track` bg (1 au gap reads as a divider); bottom `border`. |
| specs-panel | fill × hug | SCALES | left column of two-col; `sheet` bg; padding `{2xl}` `{3xl}`. |
| specs-header | fill × hug | FIXED | top of specs-panel; space-between: (`SPECS` label + track label `caption`, link) and specs toggle (link). |
| spec-row | fill × hug | FIXED | repeated; `specs-grid`; padding `{sm}` 0; number, name, slices, status (dot + word). |
| ws-panel | fill × hug | SCALES | right column of two-col; `sheet` bg; padding `{2xl}` `{3xl}`. |
| ws-block | fill × hug | FIXED | repeated per workstream; top `border-soft`, padding `{md}` 0; title-line (title + optional `CURRENT` chip + kind) then item list. |
| ws-item | fill × hug | FIXED | `☐` glyph + `item` text, gap 9 baseline. |
| discovered | fill × hug | FIXED | bottom of ws-panel; top `border-soft`, margin/pad-top `{md}`; label + plain lines. |
| sessions | fill × hug | FIXED | below two-col; padding `{2xl}` `{3xl}`; bottom `border-soft`; header then rows. |
| sessions-header | fill × hug | FIXED | space-between baseline; `SESSIONS` label + `N active · M older (+K not shown)` `meta`. |
| session-row | fill × hug | FIXED | repeated; `session-grid`, padding 9 0, top `border-soft`; running dot / title / branch (link) / worktree / last (right). Older rows: 0.72 opacity, hollow dot, dimmer branch. |
| sessions-toggle | hug × hug | FIXED | below rows; margin-top 11; `▾ show N older` (link). |
| warning | fill × hug | FIXED | below sessions (when a worktree warning exists); `warn-bg`; padding `{xl}` `{3xl}`; bottom `border-soft`; ⚠ icon + two-line text. |
| bugs | fill × hug | FIXED | below warning **when the project has open bugs** (hidden for Trailhead — 0 bugs — so absent in this render); padding `{2xl}` `{3xl}`; `OPEN BUGS` label + `bug-grid` rows. |

Activity tab (state, not shown here): overview-tab content is replaced by a
centered empty state — a 52×52 dashed-`border-dash` icon box, a "coming soon"
heading (`body`, size=16, text-bright), a description, and a reserved caption.

## 4. Text elements

| id / part | style | content (this render) |
| --- | --- | --- |
| back-btn | meta (size=12) | `← overview`, text-subhead |
| crumb | meta | `~/projects/trailhead` |
| detail-title | title (size=25) | `Trailhead` |
| detail-type | meta (size=11) | `hiking route planner`, text-muted |
| detail-chip | chip | `ACTIVE` |
| detail-meta | meta | `6 running now · 10 in flight · last touched just now` |
| tabs · overview | meta (size=12.5) | `overview` — active (text-hi, amber underline) |
| tabs · activity | meta (size=12.5) | `activity` — inactive (text-dimmer, no underline) |
| progress-readout · text | meta (size=13) | `62% — 18/28 specs`, text-bright |
| banner-tag | tag | `DECIDE` |
| banner action | lede (weight=600) | `decide the routing-engine approach`, text-hi |
| banner wait | meta (size=12.5) | `waiting on you`, amber-pale |
| wn-header · label | label (ls=1.4/0.14em) | `WHAT'S NEXT` |
| wn-header · age | caption | `40m ago` (stale → `stale` colour) |
| wn-line | lede | the summary sentence |
| wn-next · label | caption (uppercase, ls=0.08em) | `NEXT`, green |
| wn-next · text | body | the next-action sentence |
| wn-blocked · label | caption (uppercase, ls=0.08em) | `BLOCKED`, red |
| wn-blocked · text | body | the blocker sentence, red-soft |
| counts-line | meta (size=12.5) | `18 done · 3 in progress · 7 draft · 28 specs · 2 open bugs · 9 deferred · 14 inbox` |
| specs-header · label | label (ls=1.4/0.14em) | `SPECS` |
| specs-header · track | caption | `Public Beta (v0.9)`, link |
| specs-header · toggle | caption | `▾ show all 28 specs`, link |
| spec-row · n | meta (size=12.5) | e.g. `014`, text-label |
| spec-row · name | meta (size=13.5) | e.g. `elevation-profile`; DEFERRED/ABANDONED → text-dimmer |
| spec-row · slices | meta | e.g. `2/4`, text-muted |
| spec-row · status | caption | `IN_PROGRESS` (blue) / `DRAFT` (draft) / `DONE` (green) / `DEFERRED` (text-dimmer) / `ABANDONED` (abandoned) — with a `{dot-sm}` dot |
| ws-panel · label | label (ls=1.4/0.14em) | `WORKSTREAMS · RELEASE PLANS` |
| ws-block · title | body (size=14, weight=500) | e.g. `Public Beta (v0.9)`, text-body |
| ws-block · current | chip (size=9) | `CURRENT`, green / ok-border |
| ws-block · kind | meta (size=10.5, ls=0.03em) | `release` (link) or `runbook · N phases` (purple) |
| ws-item | item | e.g. `finalize elevation smoothing`, text-item (☐ glyph text-label) |
| discovered · label | label (size=10, ls=0.1em) | `DISCOVERED, NOT PINNED` |
| discovered · line | item | e.g. `Weather-overlay spike (2/6)`, text-muted |
| sessions · label | label (ls=1.4/0.14em) | `SESSIONS` |
| sessions-header · count | meta | `6 active · 14 older (+51 not shown)`, text-muted |
| session-row · title | body (size=13.5) | e.g. `Elevation profile smoothing`, text-hi |
| session-row · branch | meta | e.g. `claude/014-elevation-smoothing`, link |
| session-row · worktree | meta | e.g. `trailhead-elev-a1b2`, text-muted |
| session-row · last | meta | e.g. `just now`, text-label, right |
| sessions-toggle | meta | `▾ show 1 older`, link |
| warning · line1 | body (size=13.5) | `3 docs exist only in an un-merged worktree.`, warn-text |
| warning · line2 | meta | `e.g. docs/specs/019-offline-tiles/plan.md — trailhead-offline-c3d4` |

## 5. Rings / arcs / curves

No rings or arcs. Non-text graphics:

- **running / status dot** — `{dot-xl}` (detail title) and `{dot-lg}` (sessions) circles, `green` + `cpulse` when running; sessions older rows use a hollow `{dot}` circle, 1 au `dot-border`.
- **spec status dot** — `{dot-sm}` circle, status colour.
- **wait dot** — `{dot-sm}` circle, state colour.
- **progress bar (readout)** — `{bar-w-lg}` × `{bar-h-lg}` rect, radius 3, `track` bg; fill = pct%, `blue` (or `green` at 100%).
- **tab underline** — 2 au bottom border, amber on the active tab.
- **stage / warning glyphs** — `⚠` (amber, warning), `☐` (text-label, ws items), `✓` (`shipped`, shipped workstreams), `▾/▴` (link, toggles) — all type glyphs, not drawn.
- **activity-tab icon** (reserved state) — 52×52 rounded box, 1 au dashed `border-dash`, radius 12, with a small inline bar-chart SVG (4 bars, text-faint stroke 1.6).

## 6. Reference render

`console-detail.render.png` — overview tab, `Trailhead`, 1× (1 au = 1 px), unframed.
