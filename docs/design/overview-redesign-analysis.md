# Overview redesign — design analysis

> Status: Analysis (recorded 2026-08-06, owner-requested)
>
> Source: owner design-review session over a live screenshot of the current
> dashboard. This is an *analysis*, not a decision record — the decisions it
> calls for go through an ADR and a spec before any build. Visual mockups are
> **Claude Design's work**, not this repo's; this document is the brief they
> start from.

## 1. How the current design feels

The current page is a **report, not a dashboard**. Every card prints
everything it knows — spec lists, session lists, workstreams, warnings,
narrative — in the same small monospace text at the same visual weight.

Three observed problems:

1. **No entry point for the eye.** Cards have wildly unequal heights (one
   busy project renders ~10× taller than an empty one). The uneven columns
   are not a layout choice; they are a symptom of unequal card content.
2. **The most valuable signal is buried.** A "Blocked: waiting on owner
   decision" line — the one line that means *the owner personally must act* —
   renders at the very bottom of the tallest column, styled like everything
   else.
3. **It must be read, not glanced at.** A dashboard should answer its core
   question in ~5 seconds; the current page requires reading every card top
   to bottom.

## 2. The first screen's real question

For someone running several Claude-managed projects in parallel, the glance
question is not "what is the status of everything?" but
**"which project needs me, and for what?"** — a triage view.

Owner pain points, in priority order:

1. **What's blocked on me?** Owner decisions, approvals, reviews, PR merges.
   Highest-value signal; currently least visible.
2. **What's in flight right now?** Active sessions — is Claude busy on this
   project or idle?
3. **What's next?** The one-line narrative (already exists via the snapshot
   store; currently rendered last instead of first).
4. **Is anything rotting?** Stale branches, docs stranded in worktrees, a
   stale "what's next".
5. **What is it costing?** Token usage. The data and the correct counting
   rules already exist (token-analytics spec work: per-request grain,
   project-global dedup).

Progress percentage matters as a *coarse* signal — one big number plus a
trend, not a breakdown.

## 3. Proposed glance / click split

| At a glance (uniform card) | After a click (project detail view) |
|---|---|
| Name, one-line description, status | Full spec list with per-spec state |
| Big progress % + small trend sparkline | Individual sessions (branch, worktree, timestamps) |
| **"Needs you" badge** — count of blockers (decisions, reviews, PRs) | Workstreams and runbooks |
| "What's next" — first line only | Full "what's next" narrative + history |
| Active-session count + last-activity time | Worktree/doc warnings, deferred decisions, inbox count |
| Small token-usage sparkline (e.g. 7 days) | Token breakdown |

Everything on today's card survives — it moves one click away. The card
becomes a fixed-size, number-forward tile.

Prior art inside this repo already circles this conclusion: spec 012 capped
card height (max-height + reveal) and spec 011 added collapsible cards. The
uniform triage card is the logical end point of both.

## 4. Layout recommendations

- **Uniform cards in a real grid — yes.** Same size for every project;
  unequal columns disappear because the cause (unequal content) disappears.
- **Expansion = a dedicated detail view**, not in-place expansion. In-place
  expansion reflows grid neighbors and gets janky; a detail view gives the
  "zoom into the project" feeling and gives future content (see §6) a home.
- **One first-class layout, not two.** Do not design a "glance mode" and an
  "everything mode" as equals — that doubles every future design decision.
  Ship the triage overview as the default; the current dense view may be
  kept as a secondary "console" mode since it already exists and costs
  nothing. If unused, delete it later.
- **Charts stay zero-dep.** Sparklines and trend marks are small inline SVG;
  no chart library (ADR-0001 holds).

## 5. PR visibility (known blocker)

Open PRs — needing review, approved, ready to merge — are a top triage
signal. Spec 003 already has the deferred slice **003-03 (pr-badges)**,
parked behind one decision: PR state lives on GitHub, so reading it needs
the `gh` CLI, which collides with the zero-dependency rule.

**Recommendation:** treat `gh` as an *optional enrichment* — if installed,
cards show PR states; if absent, the dashboard behaves exactly as today.
Zero-dep stays true for the base product. This needs an ADR before 003-03
un-defers.

## 6. Design / business / project-management info

Keep it off the overview; the glance layer stays ruthlessly about "what
needs me." Natural home: tabs or sections inside the project detail view —
Build (today's content), Releases, Business/Design. This matches how the
studio tooling already docks a business track onto code projects. Whether
and when to build it is its own later spec; nothing in the overview redesign
should depend on it.

## 7. Proposed path (not yet started)

1. **ADR**: the glance/click information split (glance = triage, click =
   detail) and the `gh`-as-optional-enrichment decision — both are hard to
   reverse cheaply.
2. **Spec**: overview redesign, sliced roughly as uniform triage card →
   project detail view → "needs you" badge → token sparkline → PR
   enrichment (the last gated on the ADR).
3. **Mockups**: Claude Design produces the visual mockups from this brief;
   the spec consumes them.
