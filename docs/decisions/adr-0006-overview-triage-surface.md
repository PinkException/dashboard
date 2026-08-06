---
status: Accepted
dependencies: [adr-0001]
last_verified: 2026-08-06
frame_review: true
---

# ADR-0006: Overview is a triage surface: glance/detail split, PR state via optional gh

## Status

Accepted (2026-08-06)

## Context

The dashboard's overview page renders every project as a card that prints
everything it knows — spec lists, session lists, workstreams, warnings, and
the narrative "what's next" — in one dense monospace layer at uniform visual
weight. A design review over a live screenshot (2026-08-06) found this reads
as a **report, not a dashboard**: cards have wildly unequal heights (a busy
project renders many times taller than an empty one), the highest-value line
on the whole page ("blocked — waiting on owner decision") sits buried at the
bottom of the tallest column styled like everything else, and answering the
core question requires reading each card top to bottom instead of glancing.

The core question a multi-project owner asks the overview is not "what is the
full status of everything?" but **"which project needs me, and for what?"** —
a triage question. The uniform-card / detail split (Option B) is justified by
the report-vs-dashboard problem **on its own**: equal-size cards kill the
unequal-column mess and give the eye an entry point whether or not any single
badge works. Within that split, the highest-value *and* riskiest element is
one signal — a per-project **"needs you"** indicator. It is not a field the
scanner emits; it must be **derived**, and the derivation is the hard part. It
carries its own failure modes and its own fallback (below); if it proves
underivable, the split still delivers — the design does not stand or fall on
this one field.

The trap has two symmetric sides. Lean only on the two intent-bearing but
*sparse* inputs — `**(you)**`-tagged next steps and compass `blockers` — and
the badge **under-reports**: a project that doesn't use the convention shows a
false "nothing needs you". React to that by counting the *high-coverage*
structural markers — total open bugs, any deferred slice, any worktree-stranded
doc — and the badge **saturates**: those flag "there is activity here," not
"the owner is blocked," and they are present in most or all projects (a local
probe found the stranded-doc and deferred-slice markers turn up almost
everywhere), so the badge lights on every card and discriminates nothing. A
signal that fires everywhere answers "which project needs me" no better than the dense
report it replaces.

The resolution this ADR commits to: **"needs you" is an _intent-scoped_
signal** — it counts only markers that specifically encode that *the owner* is
blocked, and it deliberately excludes generic activity counts. Owner-blocking
is inherently sparse, and that is correct: most projects, most days, genuinely
do not need the owner, so **"nothing needs you" is a valid and common state**,
not a failure to be papered over. The redesign spec pins the exact marker set
and must validate it on *both* sides (see Kill criteria): it must not saturate,
and it must not under-report where the owner truly is blocked. The catch on the
under-report side — surfaced in review — is that **recall cannot be measured
from disk**: a project where the owner is blocked but nobody wrote the
`**(you)**` tag or ran the narrative snapshot is, on disk, indistinguishable
from one that genuinely needs nothing. So the derivation is backstopped by an
**owner-settable "needs you" marker** — an explicit flag the owner can set on a
project — so the signal is never *only* an inference from conventions that may
not have been used. Derive-plus-owner-override makes the badge reliable for
**owner-declared** blocks; it is a floor, not a total recall guarantee (the
owner who never wrote the tag may also not set the flag), which is why recall
still needs the owner-ground-truth check at spec time (Kill criteria).

The project has already reached for the reveal-behind-a-click idea once, at a
smaller scale: spec 003-02 added a per-card "show older" toggle that hides
older sessions until asked. That treats the symptom (too much on the card) one
section at a time. This ADR generalizes it into a single rule for the whole
card — decide, once, **what belongs in the glance and what belongs behind a
click** — so the redesign spec and every card section built after it share
that rule instead of re-litigating placement per feature.

Two triage signals the owner wants are not yet sourceable on the card, and
each carries a dependency wrinkle this ADR must rule on:

- **PR state** (which PRs are open, need review, are approved, ready to
  merge). Not on disk; reading it needs a `gh` subprocess. Spec 003 already
  concluded this is "permitted by ADR-0001 but deferred" and parked it as the
  DEFERRED slice **003-03 (pr-badges)** — explicitly behind "the `gh`
  decision." This ADR is that decision.
- **Token usage.** A desired at-a-glance cost signal. **No token-counting
  machinery exists in this repo today** (verified: no token-analytics spec,
  no token code under `src/`). So token usage cannot be a settled card field
  here — only a reserved slot whose data source is a separate future spec.

## Decision Options Considered

### Option A: Keep the single-layer dense report (status quo)
- **Pros:** No work. Every datum is visible without a click. Already shipped.
- **Cons:** No triage — the owner reads five cards to find the one that needs
  them. Unequal card heights are structural (unequal content → unequal cards),
  not tunable away. The one action-demanding line has no more prominence than
  a spec count. Every new card section makes the glance worse.

### Option B: Uniform triage cards + click-through project detail view
- **Pros — two distinct wins.** *Legibility (independent of any badge):*
  fixed-size cards make a real grid possible, unequal columns disappear
  because their cause does, and moving full spec/session lists, workstreams,
  narrative history, warnings, and business/design/PM material one click into
  a per-project detail view stops the glance from drowning. *Triage (carried
  by the "needs you" badge):* once that badge discriminates, the glance answers
  "which project needs me" in ~5 seconds. The detail view also gives future
  content (§ business/design tabs) a home without touching the glance. The two
  wins are separable — the legibility win holds even if the badge is dropped.
- **Cons:** Two surfaces to build and keep coherent instead of one. A card no
  longer shows a datum without a click. Adds a detail-view navigation model to
  a page that is currently a single scroll.

### Option C: Two co-equal layouts — a "glance" mode and an "everything" mode
- **Pros:** Serves both the triage need and the audit-everything need as
  first-class views.
- **Cons:** Doubles the design surface — every future placement decision must
  be made twice, for both layouts, forever. Splits testing and maintenance.
  The "everything" mode is just the status quo, which the review found wanting.

## Recommended Decision

**Adopt Option B. The overview is a triage surface with two layers:**

1. **Glance layer — a uniform, fixed-size card per project.** It carries only
   what answers "which project needs me, and for what?": name + one-line
   description + status; a coarse progress signal (one big number, optionally
   a small trend mark); a **"needs you" count**; the first line of "what's
   next"; an active-session count with last-activity time; and a **reserved
   slot for token usage** (see below). All cards are the same size.

   The **"needs you" count is derived and intent-scoped** (see Context). It
   counts only markers that encode *the owner* is blocked — candidates for the
   redesign spec to pin: `**(you)**`-tagged next steps, compass `blockers` /
   the "blocked — waiting on owner decision" line, deferred slices whose
   resolution trigger is explicitly an owner decision, and work awaiting the
   owner's land/merge (review-ready/reviewed slices, and — when `gh` is
   present — approved PRs ready to merge). It deliberately **excludes** generic
   activity counts — total open bugs, any deferred slice, any worktree-stranded
   doc — which flag "there is work here", saturate the badge, and destroy its
   triage value. The count is expected to be sparse and often zero; that is the
   correct behaviour, not under-reporting. Because on-disk recall is
   structurally limited (Context, Kill criteria), the derived count is
   backstopped by an **owner-settable marker** so a real block is never missed
   just because a convention went unwritten. This ADR fixes the *principle*
   (intent-scoped, activity-excluded, sparse-by-design, owner-override
   backstop, dual-side validated); the exact marker set and its validation are
   the redesign spec's job (Open questions, Kill criteria).

2. **Detail layer — a per-project view reached by clicking a card.** It holds
   everything the card no longer shows: full spec list with per-spec state,
   individual sessions (branch, worktree, timestamps), workstreams and
   runbooks, the full "what's next" narrative and its history, worktree/doc
   warnings, deferred-decision and inbox counts, and — as its own later
   spec — Business / Design / project-management tabs. Nothing currently on
   the card is lost; it moves one click away.

**PR state is sourced via `gh` as an _optional enrichment_.** ADR-0001's
"zero runtime dependencies" governs **npm packages**; it already permits — and
the scanner already relies on — shelling out to an external binary (`git`) via
`node:child_process`. `gh` is the same category as `git`: a shelled-out
binary, not a bundled dependency. The one material difference is that `git` is
guaranteed present in a git project while `gh` is not. Therefore: **when `gh`
is present and authenticated, cards surface PR state as a triage signal; when
it is absent, the overview behaves exactly as it does today, with no error and
no missing-feature noise.** This preserves the `git clone && node server.mjs`
install promise for the base product and adds PR triage as a graceful bonus.
This decision **un-blocks 003-03 (pr-badges)** — with the placement updated:
PR state belongs in the glance layer's "needs you" signal, not (only) on
individual session rows as 003-03 originally scoped it.

**Token usage is a reserved glance slot, not a committed field.** Because no
counting machinery exists in this repo, this ADR only reserves its place in
the glance layer. *How* tokens are counted (correctly — resumed/forked
sessions must not be double-counted) is a separate spec and is **not** gated
by this ADR. The redesign can ship the triage card with the slot empty or
hidden until that spec lands.

**Charts stay zero-dep.** Any trend mark or sparkline is small inline SVG in
the existing self-contained page — no chart library (ADR-0001 holds).

Mockups of the card and detail view are **Claude Design's** deliverable, not
this repo's; the recorded analysis at
[docs/design/overview-redesign-analysis.md](../design/overview-redesign-analysis.md)
is their brief. This ADR fixes the information architecture the mockups and
the redesign spec build on.

## Consequences

**Becomes easier:**
- A real uniform grid, scannable at a glance — the unequal-column problem is
  designed out and the reader stops drowning (holds regardless of the badge).
- Answering "which project needs me?" in seconds — *once the "needs you" badge
  discriminates*; until then the grid still gives the legibility win above.
- Adding future card sections: the glance/detail rule decides placement once.
- Landing PR triage without breaking the zero-install promise.
- Giving business/design/PM material a home (detail tabs) without crowding the
  glance.

**Becomes harder:**
- Seeing a specific buried datum: it may now require a click into the detail
  view.
- Maintenance: two surfaces (glance + detail) instead of one dense page.
- The redesign is spec-shaped work (uniform card → detail view → "needs you"
  badge → token slot → PR enrichment), not a CSS tweak.

## Assumptions

- `gh` is an external binary invoked via `node:child_process`, the same
  category as `git`, which ADR-0001 already permits and `src/scan.mjs` already
  shells out to. Verified by reading [ADR-0001](adr-0001-runtime-zero-deps.md)
  (zero-dep scope is npm packages; `node:child_process` and git shell-out are
  explicit) and spec 003, which states the `gh` subprocess is "permitted by
  ADR-0001 but deferred."
- No token-counting machinery exists in this repo. Verified: `docs/specs/`
  contains 001–007 only (no token-analytics spec) and no `src/` file
  references tokens. Token usage is therefore a reserved slot, deferred.
- 003-03 (pr-badges) is DEFERRED specifically behind "the `gh` decision."
  Verified in [docs/specs/003-sessions-panel/spec.md](../specs/003-sessions-panel/spec.md).
- **"Needs you" must be validated for _discrimination_, not just presence.**
  Two facts bound the design. The intent-bearing inputs are sparse: the
  `**(you)**` owner tag appears in only a document or two per project and some
  projects use it not at all, and compass `blockers` are written only by the
  human-invoked narrative snapshot (005-03), never by the deterministic
  `--auto` routine (005-04). The generic activity markers, by contrast, are
  near-ubiquitous — worktree-stranded docs, deferred slices, and open bugs
  turn up in most or all projects. Presence data alone cannot confirm the
  signal *discriminates* owner-blocked projects from the rest — a marker
  present in every project discriminates nothing. That is exactly why the
  Recommended Decision scopes the count to intent markers and excludes the
  ubiquitous activity counts. Discrimination is disk-measurable (does the count
  separate projects?); **recall is not** — whether a "quiet" project genuinely
  needs nothing or just never got its block written down cannot be read from
  disk. So recall validation needs **owner-provided ground truth** (the owner
  says which projects actually need them), and the owner-settable marker is the
  standing backstop for the cases derivation misses. A disk-only grep re-probe
  would re-measure presence, not recall.
- **ESCALATED bugs are not a separate scanner field today.** `scanBugs`
  (`src/scan.mjs`) returns `{open, total}` only; an ESCALATED count would need
  added derivation. So any use of ESCALATED in the "needs you" signal is new
  work for the redesign spec, not a field already emitted. Verified by reading
  `scanBugs`.

## Kill criteria

The decision has two separable parts — the **split** and the **badge** — and
they fail independently. A badge failure does **not** revert the split (the
split earns its keep on legibility alone, per Context); it degrades the triage
signal down to the owner-settable marker.

**Kills the derived "needs you" _badge_ (not the split):**
- **Under-report:** if the pinned taxonomy routinely shows "nothing needs you"
  on projects where the owner *is* blocked (recall too low), the derived count
  can't be trusted. Recall is **not** disk-measurable — it must be checked
  against owner-provided ground truth; a grep-only "recall probe" that
  re-measures presence would mask this failure. Consequence: fall back to the
  owner-settable marker as the signal (drop the derived count), keep the grid.
- **Over-report / saturation:** if the badge lights on most or all cards
  (the taxonomy crept back toward ubiquitous activity markers), it
  discriminates nothing. Measure explicitly against the real project set — a
  badge on ≳ half of cards is the failure signature. Same consequence: strip
  the derived count back to the owner-settable marker; the grid stands.
- The local probe bounds the inputs but does not settle discrimination;
  that verdict is the redesign spec's to reach with a discrimination probe
  plus an owner-ground-truth recall check.

**Kills the _split_ itself:**
- If the detail view cannot be built without adding a routing/client
  framework, it collides with ADR-0001's single self-contained page; the split
  must then be reshaped (e.g. an in-page panel) rather than pursued as a route.
  This is the only failure that sends the design back toward the dense report.

## Open questions

- The exact **"needs you" taxonomy** — the boundary cases inside the
  intent-scoped set: does a review-ready/reviewed slice count as *owner*-blocking
  (the owner lands it) or Claude-blocking (a reviewer agent acts first)? How do
  PR states and a stale "what's next" fold in? Spec-level; the redesign spec
  pins the marker set and settles it with the discrimination+recall probe (Kill
  criteria), not a presence count.
- **The owner-settable marker's mechanics** — how the owner's flag and the
  derived signal combine on the card. It must live in the home-folder config
  (`~/.claude/my-dashboard/`), never in a surveyed repo (vision principles 1
  and 6), and it is legitimate as an *opt-in* backstop under principle 3 ("new
  user habits are opt-in"): the derived signal is the zero-ritual default, the
  marker the opt-in floor. This ADR commits to *having* the backstop; the
  redesign spec designs it.
- **Fate of the current dense view** — kept as a secondary "console" mode or
  dropped once the triage overview ships. Decide after the triage view is real
  and its coverage is known; do not build two co-equal layouts (Option C).
- **Detail-view mechanics** — a separate in-page view vs a large overlay
  panel, within the zero-dep single-page constraint. Spec-level.
