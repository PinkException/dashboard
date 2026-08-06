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

**The sample content** — use the project's canonical working sample dataset at [`../sample-data.md`](../sample-data.md) (invented placeholder data; swap for real values at build time). It holds eight fictional projects, each with every card field: the **needs-you** signal, progress, the counts line, the full specs list, workstreams, sessions (running / older / overflow), worktree warnings, and the "what's next" note — plus the empty and edge states.

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

- **2026-08-06 — sample content converged to a shared file.** The inline
  project table was replaced by a pointer to the project's canonical working
  sample dataset, [`../sample-data.md`](../sample-data.md), so there is one
  source of truth for sample content across design briefs. The same eight
  projects and their range are preserved there, now with each project's full
  per-card detail (specs list, sessions, worktree warnings, "what's next").
