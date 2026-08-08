---
target: overview
scope: view
version: v1.2
base: v1.1
product: Local read-only dashboard over a person's jig-managed code projects
tool: Claude design
status: briefed
---

# Overview — design brief (v1.2)

Create a new folder `dashboard-v1.2/` by copying every file of your existing `dashboard-v1.1/` design into it as the starting base, then apply this brief. Begin each file with its version header on the first line: `<!-- dashboard v1.2 -->` for HTML files, `// dashboard v1.2` for the JavaScript file. Keep `dashboard-v1.1/` exactly as it is.

Keep the **Product** direction unchanged (we'll develop it later). Evolve **only the Console direction**.

**What to build** — The next iteration of the Console all-projects overview. v1.1 sorted projects into "needs you" vs "nothing needs you". That binary is wrong for this user: a solo owner running several AI-assisted projects **always** has a next move — there is rarely truly "nothing". So reframe the row's headline from *"does this need me?"* to **"what's this project's next action, and who is it waiting on?"** — and order the whole view so work that is nearly finished surfaces above work that is barely started.

**What it must contain**

- **Every project shows one "next action", tagged with who it's waiting on** — one of four states. This replaces v1.1's needs-you/calm split:
  - **You** — a decision, review, or merge is blocked on the person. (This stays the strongest-emphasis state — it's the whole reason to look.)
  - **Ready** — the next work item is launchable right now (the AI can run it). Clearly marked but calmer than *You*. This is the "I have ten minutes, where can I usefully start something" signal.
  - **External** — waiting on someone else (e.g. a PR out for a colleague's review or merge). Present but recessive — it's not the owner's move.
  - **Idle** — genuinely nothing open (finished, or shipped). The quietest state.
  Each non-idle row names its actual next action in a few words, not a hollow "all calm".

- **The real content — use the project set in [`../sample-data.md`](../sample-data.md)** (invented placeholder data — use these projects, not new ones). Apply the four states across them as follows (this is the new signal the file doesn't spell out yet; the what's-next text, sessions, and workstreams it does carry back each row):

  | Project | State | Next action shown on the row |
  |---|---|---|
  | Ledger | **You — decide** | "decide the currency-rounding rule — blocking" |
  | Cartographer | **You — review** | "review 2 finished slices" |
  | Almanac | **You — review** | "review 9 open drafts" |
  | Trailhead | **You — decide** | "decide the routing-engine approach" |
  | Semaphore | **External** | "PR out — awaiting a teammate's review" |
  | Kestrel | **Ready** | "launch: build the search index (spec 002)" |
  | Verdant | **Ready** | "launch: start the plant-list spec (spec 001)" |
  | Beacon | **Idle** | shipped v1.0 — nothing open |

- **Order the view finish-first (kanban "empty the pipeline before starting new").** When ranking projects (and when a project has more than one candidate action, when picking which to show), sort by nearness to done: **land → merge → review → finish/unblock → start new**, with idle last. So the default order puts *review* work (Cartographer, Almanac) above *decide-to-unblock* work (Ledger, Trailhead), above *ready-to-start* work (Kestrel, Verdant), with External (Semaphore) shown near the top of the pipe as informational and Idle (Beacon) at the bottom. The point the owner cares about: nearly-finished-but-stuck work must never sit below shiny new starts.

- **A small "in flight" figure per project** — a count of open fronts (specs in progress + active sessions + unmerged worktrees), carried more heat as it climbs past a handful. It makes "this project has a lot open at once" legible at a glance (Trailhead and Ledger run hot; Kestrel and Verdant run light). Derive it from the sessions, in-progress specs, and worktree warnings each project already carries in `sample-data.md`.

- **A second lens: the cross-project "action queue".** In addition to the projects-as-rows overview (which stays the default), a view that lists **every actionable item across all projects together, grouped by pipeline stage** (land → merge → review → finish → start). This is the purest "empty the pipeline" screen — the flat to-do list of everything waiting, finish-first. Reachable by a toggle from the overview.

- **In the project detail view (click a row), two changes:**
  - The spec list defaults to **the current release/track's specs only** (what the project's release plan is working toward), with a "show all N specs" control for the full history one level deeper. For a 28-spec project like Trailhead the row should open on its handful of current specs, not its dozen finished ones.
  - Workstream / release-plan entries show their **next 1–3 unchecked items**, not just the plan's title (e.g. Trailhead's Public Beta plan → "☐ finalize elevation smoothing · ☐ offline-tiles QA · ☐ store screenshots"). The title is context; the next items are the value.
  - Reserve a second tab labelled **"Activity"** (empty / "soon" for now) — the future home for cost-and-effort analytics; just reserve the slot so adding it later needs no layout redesign.

**Done when**

- Every project shows a next action and who it's waiting on; no project reads as a hollow "nothing".
- The four states are distinguishable at a glance, with *You* the most prominent and *Idle* the quietest.
- The default order surfaces nearly-finished work above barely-started work — a project stuck one step from done is visible above a fresh start.
- The "in flight" figure makes an over-loaded project (Trailhead, Ledger) obvious next to a light one (Kestrel).
- The action-queue lens lists every waiting item across all projects, grouped by stage, finish-first.
- A project detail opens on its current-track specs, with all specs one click deeper, and its plans show their next unchecked items.
- Everything uses the `sample-data.md` projects and their real values — real data throughout, no lorem, no extra invented projects.

**One functional constraint:** it stays a single self-contained page with lightweight inline graphics — the detail view and the action-queue lens both open within the same page.

You own the visual design — mood, colour, type, layout, imagery. Keep the Product direction unchanged; evolve the Console direction, and show me how the four states and the finish-first ordering read at a glance. Ask me if you'd like direction on any of it.

## Revisions

- **2026-08-07 — "You" state relabelled.** The umbrella "You" tag read as
  meaningless on the row and was redundant next to its own sub-verb
  ("YOU · REVIEW" says review twice). Change: on each row and in the action
  queue, an owner-action item is labelled by its **action verb** — DECIDE /
  REVIEW / MERGE — which becomes the label and keeps the state's prominence;
  the header count formerly "You" becomes **"To do"**. Ready / External / Idle
  unchanged. Colour, finish-first ordering, and layout unchanged.
