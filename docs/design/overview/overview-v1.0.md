---
target: overview
scope: view
version: v1.0
base: scratch
product: Local read-only dashboard over a person's jig-managed code projects
tool: Claude design
status: briefed
---

# Overview — design brief (v1.0)

Create a folder `design/overview/overview-v1.0/` and build every file of this design inside it — the JavaScript file and each HTML page. Begin each file with a version header on its first line: `<!-- overview v1.0 -->` for HTML files, `// overview v1.0` for the JavaScript file. Keep any existing `design/overview/overview-v*` folders as they are.

**What to build** — The main screen of a personal project dashboard: a scannable grid of same-size project cards that answers, at a glance, *"which of my projects needs me right now, and for what?"* — with a click on any card opening that project's full detail view. It's for one developer running several code projects in parallel, checking in to decide where to spend attention.

**What it must contain**

The screen is a grid of equal-size cards, one per project, all visible together without opening any of them. Each **card (the glance)** carries only what supports the triage decision:

- Project name + a one-line description + a status.
- A single big progress figure (percent of specs done).
- A **"needs you" indicator** — the headline signal. It shows what genuinely needs *this person's* action (a decision to make, work awaiting their review, something they must merge), as a small count with a word or two on what it is. Crucially it is **usually empty** — most projects, most days, need nothing from them — so the calm "nothing needs you" state is a first-class state to design well.
- The first line of a "what's next" note.
- How active the project is: a count of running/recent work sessions and when it was last touched.
- A small spot reserved for a token-usage figure (may be empty for now).

Clicking a card opens that project's **detail view** (in place, within the same page), holding everything the card leaves off: the full list of specs with each one's state; the individual work sessions with their branch, worktree, and timestamps; the workstreams and runbooks; the full "what's next" note and its history; warnings (e.g. documents that exist only in an unmerged worktree); counts of parked decisions and inbox items; a token-usage breakdown; and room to grow later into Business / Design / project-management tabs.

**The sample content — use this fictional project set** (invented placeholder data; swap for real values at build time):

| Project | Description | Progress | Needs you | Activity signal |
|---|---|---|---|---|
| Trailhead | hiking route planner | 62% (18 of 28 done) | a decision parked on you | 6 sessions, active now |
| Verdant | plant-care reminders | 8% (1 of 12 done) | nothing needs you | quiet, last touched last week |
| Beacon | status-page generator | 100% (11 of 11 done) | nothing needs you | shipped, idle |
| Ledger | personal finance tracker | 45% (9 of 20 done) | 1 decision waiting on you | 4 sessions, active today |
| Cartographer | map-notes tool | 78% (14 of 18 done) | 2 reviews waiting on you | 3 sessions, active now |
| Almanac | habit tracker | 30% (3 of 10 done) | 9 specs awaiting your review | 2 worktrees |
| Semaphore | deploy notifier | 55% (6 of 11 done) | nothing needs you | 4 worktrees |
| Kestrel | note-taking app | 50% (1 of 2 done) | nothing needs you | 2 worktrees, new |

The set deliberately spans the range the design must hold: a calm finished project with nothing outstanding (Beacon), a barely-started one with a big review queue (Almanac), busy in-flight ones (Trailhead, Cartographer), and a brand-new sparse one (Kestrel). The cards are all the same size regardless of how much each project has going on.

**Done when**

- All projects show as equal-size cards, readable together in one view without opening any card.
- A person can find "which projects need me" in a few seconds — the "needs you" projects stand out from the calm ones.
- A card that needs nothing reads as calm and settled, not empty-looking or broken.
- Clicking a card opens that project's full detail, and returning to the grid is obvious.
- Each card shows the project's numbers as above.

**One functional constraint:** it ships as a single self-contained page with lightweight inline graphics, so the detail view opens within the same page and any progress bar or small chart is drawn inline.

You own the visual design — mood, colour, type, layout, imagery. Show me 3 distinct directions, and ask me if you'd like any direction.

## Revisions

_(none yet — design-tweaks adds change rounds here, editing the current version's files in place)_
