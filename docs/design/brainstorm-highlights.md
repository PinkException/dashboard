# Project dashboard — brainstorming highlights (developer view)

> Handoff notes for the **manager-view** sibling project. Two complementary
> views of the same idea: the **developer view** (this document — one person
> running several AI-assisted code projects, deciding where to spend their own
> attention) and the **manager view** (the overview of overviews — a person who
> needs to see across people/teams rather than act in the code themselves).
> Everything here is from the developer-view brainstorm; the last section
> collects the parts we think transfer.
>
> All project names in examples (Trailhead, Ledger, Verdant, Beacon,
> Cartographer, Almanac, Semaphore, Kestrel) are **invented sample data**.

## What the product is

One local, read-only page over all of a person's projects, built entirely from
artifacts the projects already produce on disk (spec files with lifecycle
states, git branches/worktrees, work-session logs, release plans, a "what's
next" note per project). No database, no manual status entry — if it isn't
derivable from what already exists, it isn't on the dashboard. This
"read, never ask" constraint shaped every decision below.

## Highlight 1 — a dashboard is a triage surface, not a report

The first version printed everything every project knew, at equal visual
weight. Diagnosis: that's a *report* — it must be read top to bottom. A
dashboard should answer its one question in ~5 seconds. The question, for the
developer view:

> **"Which project needs me right now, and for what?"**

Consequences:

- **Glance / click split.** The overview carries only what supports the triage
  decision; everything else (full spec lists, session details, warnings,
  histories) moves one click away into a per-project detail view. Nothing is
  deleted — it's re-homed.
- **Uniform entries.** Every project renders the same size, however busy it is
  — a busy project must never tower over a quiet one (unequal card heights were
  a symptom of "print everything").
- **Colour is spent on exactly one thing:** the needs-attention signal. Calm
  entries are monochrome. That's what makes the 5-second scan work.

## Highlight 2 — the "who acts next" model (our biggest reframe)

The first triage design had a binary: "needs you" vs "nothing needs you". The
owner's key observation: **"nothing needs you" never really happens** — for a
solo owner there is always a next prompt to launch or a decision to make. The
truer model: **every project has a next action; the question is who it's
waiting on.** Four states:

| State | Meaning | Example |
|---|---|---|
| 🔴 **You — decide/review/merge** | Blocked until the person acts | "decide the currency-rounding rule" |
| 🟢 **AI — ready to run** | The next work item is launchable right now | "slice 016 ready — launch it" |
| ⚪ **External** | Waiting on someone else | "PR awaiting review by a colleague" |
| ⚫ **Done / idle** | Genuinely nothing | shipped v1.0, no open work |

- Colour goes **only** on the 🔴 state, so triage survives.
- Every non-idle row shows its **actionable next item**, not a hollow "all
  calm". The 🟢 list doubles as "I have ten minutes — where can I usefully fire
  a prompt?"
- Open design question: should 🟢 rows show the *suggested prompt itself*
  (dashboard as launchpad) or just point at the item (pure status surface)?

## Highlight 3 — kanban as the ordering principle, not the layout

Borrowed from a colleague's team practice: *empty the pipeline before starting
anything new.* The work items already move through a pipeline (draft → ready →
in progress → reviewed → reconciled → done; unmerged branches/worktrees are
inventory in the pipe), so kanban maps cleanly:

- **Finish-first ordering.** When several things are actionable, rank by
  proximity to done: **land it → merge it → review it → finish it → start
  something new.** This ordering fixed real observed failures (finished work
  sitting unmerged on branches for days while new work started).
- **WIP made visible, not enforced.** A read-only surface can't enforce WIP
  limits, but it can show, per project, an "in flight" count (in-progress
  items + active sessions + unmerged worktrees) and render it hotter past a
  soft threshold. Note for AI-assisted work: the scarce resource isn't dev
  time (the AI parallelizes cheaply) — it's the **owner's attention and the
  merge debt** each open front creates. WIP should count "open fronts that
  will eventually need a human."
- **Deliberately NOT a kanban board layout.** Columns-by-stage would scatter
  one project's items across five columns and destroy project context. Keep
  one row per project; kanban governs *ordering*. A cross-project **action
  queue** (every actionable item, grouped land→merge→review→finish→start) is
  a good *second* lens, not the default.

## Highlight 4 — scope the detail to the current track

For a project with 100+ specs, the first 60 done specs are archaeology. The
detail view should default to **the specs in the current release/track** (what
the release plan is aiming at), with the full history one click deeper.
Data caveat: this needs a mapping from release plan → spec ids; where plans
don't name specs, fall back to "active + recently touched".

## Highlight 5 — plans should surface their next items

Showing *that* a release plan exists is context, not value. The row should
surface the **next 1–3 unchecked items** from the current plan. Generalized:
every artifact on the dashboard should answer "so what's next in you?" rather
than "here I am".

## Highlight 6 — the analytics layer (parked as its own track)

Wanted, real, but deliberately separated from triage so it doesn't dilute the
5-second scan. Lives in a detail-view "Activity" tab (plus at most one
sparkline on the glance row):

- **Token/cost breakdown** by activity type (planning / implementation /
  review), by model, and by skill — "which skills are eating tokens".
- **Velocity graph** — work completed over time per project (derivable from
  the snapshot history the dashboard already keeps).
- **Time per project** — derived by clustering session activity into work
  blocks; switchable day / working-week.
- Hard-won counting caveat: naive token summing over session logs massively
  overcounts (running totals repeat per record; resumed sessions replay
  history — measured up to ~3.4× off). Per-request grain + global dedup is
  required.

## What the developer view is concentrating on (current state)

So you can see concretely what our view is putting on screen, and where it is
in the design process.

**Where we are.** Two mockup rounds done with Claude Design. Round 1 produced
three visual directions; we kept two — **Console** (dark, monospace, dense — a
dev-tool triage board) and **Product** (light, cards, softer) — and are
developing **Console first**, holding Product for later as the second theme.
*Why Console first:* the primary user is the developer-owner checking in
between coding sessions — the dense dev-tool form matches how they already
read information, and its uniform table rows solve the equal-height
requirement for free. *Why keep Product at all:* it's the calmer everyday
skin; developing one direction at a time keeps each iteration cheap and
comparable. Round 2 (the current mockup) rebuilt Console around the triage
question and is close to right; round 3 will fold in the who-acts-next
reframe and the kanban ordering above.

**The overview screen today (Console, one row per project) — each element and
why it earned its place:**

- **Header stats, triage-first:** the biggest number on the page is
  **"N need you now"**, next to the project count. *Why:* the page should
  lead with the answer to its own question; round 1 got this wrong by making
  "open bugs" the biggest number, which is inventory, not triage.
- **Each row (uniform height):** project name + one-line description + a tiny
  status chip; then, as the row's focal point, the **needs-you cell** — a big
  count plus a labelled badge (BLOCKED / DECISION / REVIEW) and a few words
  naming the action ("decision waiting on you"). *Why focal:* "what's blocked
  on me" is the owner's #1 ranked pain and was the least visible thing in the
  old design — the redesign exists to invert that. Then **progress** (a bold %
  with a small trend sparkline) — *why coarse:* progress matters as one glance
  number, not a breakdown; the breakdown is archaeology that belongs in
  detail. Then the **"what's next" first line** — *why:* it's the owner's #3
  pain ("what's next?") and the projects already write this narrative, so the
  glance layer shows its first line and the full note lives in detail. Then
  **activity** ("6 active · just now" with a running dot, or "idle") —
  *why:* with AI doing the building, "is the AI working on this right now or
  has it stalled?" replaces the classic "is the team busy" signal; a
  timestamp alone doesn't answer it, the running state does. And a **reserved
  token column** ("tokens · soon"). *Why reserve rather than omit:* cost per
  project is a confirmed future signal with real data behind it — reserving
  the slot means adding it later won't force a layout redesign, and an
  honest "soon" beats a fake number.
- **Colour discipline:** calm rows are fully monochrome; only needs-you
  states get colour (red for blocked-on-owner, amber for decision/review),
  plus a left edge-stripe in the same colour. *Why:* colour is the fastest
  pre-attentive channel — spending it on exactly one meaning is what makes
  the 5-second scan work; spend it on everything (as the old design did) and
  it means nothing. The edge-stripe makes hot rows findable even in
  peripheral vision while scrolling.
- **Click a row → detail view, in place:** the full spec list with each
  spec's lifecycle state and slice counts, open bugs with severity, the
  individual work sessions (branch, worktree, running state, timestamps),
  workstreams/release plans, the full "what's next" note, and warnings (docs
  stranded in unmerged worktrees). *Why in-place rather than expanding rows:*
  in-place expansion reflows the grid and breaks the scan; a dedicated view
  gives the "zoom into one project" feeling and gives future content (the
  Activity tab, business/design tabs someday) a home. *Why nothing was
  deleted:* everything from the old print-everything design survives — it
  just moved one click down, so the glance layer could get ruthless without
  losing information.

**What round 3 (v1.2) will change, per this brainstorm:**

1. The needs-you cell generalizes to the **four-state who-acts-next cell** —
   every row gets an actionable next item with an owner (🔴 you / 🟢 AI-ready /
   ⚪ external / ⚫ idle), replacing the binary needs-you/calm.
2. Next actions get **kanban finish-first ordering** (land → merge → review →
   finish → start), both within a row and in an optional cross-project action
   queue lens.
3. A per-row **"in flight" WIP figure**, hotter past a soft threshold.
4. Detail view defaults to the **current track's specs** (release-plan scope),
   full history one click deeper.
5. Workstream rows surface their **next 1–3 unchecked plan items**.
6. The detail view reserves an **"Activity" tab** for the analytics layer
   (tokens by phase/model/skill, velocity, time per project) — home built now,
   data wired later.

**Deliberate exclusions from the overview:** bug counts (moved to detail — a
bug isn't a "you must act" signal), full spec lists, session lists, and
anything requiring manual status entry. The overview is ruthlessly "what needs
whom, right now".

## What we think transfers to the manager view

The manager view is the same shape one level up: **rows = people or projects
across the org, and the question shifts from "which project needs me" to
"which project/person needs a decision, is blocked, or is quietly stalling."**

- The **who-acts-next model transfers directly** — a manager triages by
  "waiting on me (decisions/approvals) / running fine / blocked on external /
  idle". Colour only on "waiting on me".
- **Finish-first ordering** transfers: surface nearly-done-but-stuck work
  (unreviewed, unmerged, unreleased) above shiny new starts. "What's been at
  99% for two weeks" is a manager's most valuable list.
- **WIP visibility** transfers as a health signal per team/project: too many
  open fronts = attention debt, even when everything looks "active".
- **Uniform entries + glance/detail** transfer as-is.
- The **"derive, never ask" principle** is worth keeping even at manager
  level: every status that must be manually reported will rot; every signal
  derived from real work artifacts stays honest.
- Divergence to expect: the manager view likely needs **people** as a
  first-class dimension (who is overloaded, who is blocked) and cares about
  **trend** (velocity, staleness) more than the developer view's "right now".

## Sample data

An 8-project invented sample set exists for design work (spans: a huge busy
project, a brand-new empty one, a finished one, a blocked one, a big review
queue, calm mid-flight ones). Ask and we'll share `sample-data.md` — useful
for keeping both views designed against the same fictional world.
