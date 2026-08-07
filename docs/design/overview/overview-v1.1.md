---
target: overview
scope: view
version: v1.1
base: v1.0
product: Local read-only dashboard over a person's jig-managed code projects
tool: Claude design
status: briefed
---

# Overview — design brief (v1.1)

Create a new folder `dashboard-v1.1/` by copying every file of your existing `dashboard-v1.0/` design into it as the starting base, then apply this brief. Begin each file with its version header on the first line: `<!-- dashboard v1.1 -->` for HTML files, `// dashboard v1.1` for the JavaScript file. Keep `dashboard-v1.0/` exactly as it is.

We are keeping both the **Console** (dark) and **Product** (light) directions. In this version, **keep the Product direction unchanged** — we'll develop it later. Evolve **only the Console direction** (the dark, monospace, dev-tool one) per this brief. (You can drop the Editorial direction; we're carrying forward Console and Product only.)

**What to build** — The everyday all-projects overview in the **Console direction**, reworked so it answers, at a glance, *"which project needs me, and for what?"* — for one person running several Claude-managed code projects in parallel and checking in to decide where to spend attention.

**What it must contain**

- One scannable view of **all projects together**, each project as a **single uniform entry** (a row or tile) — the same size regardless of how much it has going on, so a busy project never towers over a quiet one and the whole set reads at a glance. The full depth stays one click away in the **detail view you already built in v1.0** (keep it).
- Each project entry carries the following, with the **"needs you" signal as its focal point** — the first thing the eye lands on, and the strongest signal in the whole view:
  1. **Needs you** — a count plus a few words naming what needs *this person's* action right now: a decision to make, work awaiting their review, a PR to merge. It is **usually empty** — most projects, most days, need nothing — so the "nothing needs you" state must read as a finished, settled state rather than an empty or broken one.
  2. **Progress** — one coarse figure (share of specs done), with room for a small trend mark.
  3. **What's next** — the first line of the project's current narrative (one line only).
  4. **Active now** — whether Claude is working on the project *right now* (a running indicator plus a count of active sessions), and when it was last touched.
  5. A reserved spot for a **token-usage** trend (may be empty for now).
- At the top of the overview, a short summary of the whole set: how many projects, and — most importantly — how many need the person right now.
- Clicking a project opens its full **detail view** in place (keep the v1.0 Console detail: the full spec list with each spec's state, the individual sessions with branch/worktree/timestamps, workstreams and runbooks, the full "what's next" note, open bugs, and warnings such as documents that live only in an unmerged worktree).

**The real content** — Use the project set in [`../sample-data.md`](../sample-data.md) (the project's canonical sample; invented placeholder data — use these projects and their real values, not newly invented ones). Design against it because it spans the range the view must hold: most projects need nothing (Verdant, Beacon, Semaphore, Kestrel), a few genuinely need action (Trailhead — a decision parked on the owner; Cartographer — two reviews waiting; Almanac — a nine-item review queue), and one is blocked on an owner decision (Ledger — which currency-rounding rule to use). Put the calm entries and the needs-you entries in the same view so the difference is obvious at a glance. Each project in that file already carries its needs-you signal, progress, what's-next line, and session activity.

**Done when**

- All projects are visible together in one view, each a uniform entry the same size regardless of content.
- In a few seconds the person can pick out which projects need them — the needs-you entries stand out from the calm ones.
- An entry that needs nothing reads as settled and intentional, not empty or broken.
- Each entry shows, at minimum: needs-you, progress, the what's-next first line, and whether Claude is active right now.
- The blocked-on-owner project (Ledger's decision) is unmistakable at a glance.
- Clicking a project opens its full detail, and returning to the overview is obvious.
- Every entry uses the `sample-data.md` projects and their real numbers — real data throughout, no placeholder lorem and no extra invented projects.

**One functional constraint:** it stays a single self-contained page with lightweight inline graphics — the detail view opens within the same page, and any progress figure or small trend mark is drawn inline.

You own the visual design — mood, colour, type, layout, imagery. Keep the Product direction unchanged; evolve the Console direction to carry this information, and show me how you make **"needs you"** the focal point of the view. Ask me if you'd like direction on any of it.

## Revisions

_(none yet — design-tweaks adds change rounds here, editing the current version's files in place)_
