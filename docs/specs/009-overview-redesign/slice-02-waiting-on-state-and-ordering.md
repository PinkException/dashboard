---
status: DONE
dependencies: [009-01, adr-0006]
last_verified: 2026-08-31
arch_review: true
frame_review: true
---

<!-- jig self-defining vocabulary (soft, forward-only). -->
<!-- jig grounding (spec 064-02 / ADR-0020): probe runnable-surface claims. -->

## Slice 009-02 — waiting-on state + finish-first ordering (the triage signal)

**Goal:** Give each project a single derived **waiting-on state** (DECIDE /
REVIEW / MERGE / Ready / External / Idle) rendered as the card's headline with
its named next-action text, order the grid **finish-first**, and add the
owner-settable home-folder marker backstop — turning the legible-but-flat grid
from 009-01 into a triage surface that answers "which project needs me, and for
what?" at a glance.

**DoR:**
- ✅ 009-01 DONE (uniform grid + payload wiring in place).
- ✅ Owner-provided **ground-truth list** available for the recall check — the
  owner names which of the real surveyed projects genuinely need them right now.
  (This is the DoR gate ADR-0006 Kill criteria require; recall is not
  disk-measurable. If the owner is unavailable, the slice may ship the derived
  state **with the owner-settable marker as the standing floor** and record the
  recall check as a deferred follow-up — but it may not claim validated recall.)

**Acceptance Criteria — all reference the taxonomy pinned here (single source):**

**Taxonomy (intent-scoped, activity-excluded — ADR-0006). Status signals pinned
by the 2026-08-31 frame-critique** — each state names the exact on-disk signal it
derives from, so no state is left to implementer guesswork. Each project resolves
to exactly one state, chosen as the most finish-advanced open action (precedence
in AC2).

- **DECIDE** (You) — an owner decision is open: a `**(you)**`-tagged open next
  step (`ownerOf` returns `you`, `src/lib.mjs:69`) or a compass `blocker` that
  **itself carries the `**(you)**` owner tag** (`ownerOf(blocker) === 'you'`;
  `compass.blockers`, validated at `src/lib.mjs:241`, carried into the payload via
  `src/scan.mjs:433`, read today at `public/render.mjs:380`). **A bare, untagged
  blocker does NOT fire DECIDE** — it is a process/status note (a pending review,
  an undiagnosed bug, a dependency or hardware wait), not an owner decision.
  _(Retightened by the AC4 discrimination probe, 2026-08-31: treating every
  blocker as DECIDE lit You on 5 of 7 projects — over the saturation line — driven
  by 3 untagged process-note blockers; intent-scoping requires an explicit owner
  marker, honouring ADR-0006's "counts only markers that encode the owner is
  blocked".)_
- **REVIEW** (You) — a slice sits at status **`REVIEWED`** (the automated review
  passes are done; the owner's acceptance/reconcile is the next move). This
  settles the ADR Open question ("is a review-ready slice owner- or
  Claude-blocking?") **owner-blocking**: the review *passes* are Claude-runnable,
  but a slice that has cleared them and awaits the owner's sign-off is the
  owner's move. `READY_FOR_REVIEW` (passes not yet run) is Claude-runnable →
  Ready, not REVIEW.
- **MERGE** (You) — a slice sits at status **`RECONCILED`** (jig's awaiting-land
  status: `PENDING_ACTION` maps `RECONCILED → land`, `src/lib.mjs:537`); the
  owner lands/merges it. 009-04 refines this with an approved-PR-ready signal
  when `gh` is present; pre-009-04, `RECONCILED` is the MERGE signal.
- **Ready** (Claude) — a launchable **or resumable** work item Claude can act on
  now, with no owner action open: a slice at **`IN_PROGRESS`** (resume) or
  **`READY_FOR_REVIEW`** / **`READY_FOR_IMPLEMENTATION`** / **`DRAFT`** with
  dependencies satisfied (start). `READY_FOR_REVIEW` belongs here (the review
  *passes* are Claude-runnable), consistent with the REVIEW bullet. "Launchable" =
  deps resolve DONE/accepted via the existing resolver (`resolveToken`,
  `src/lib.mjs:545`) where cheap; otherwise status-presence. This closes the
  false-Idle gap: an `IN_PROGRESS` project with no owner tag is Ready (resume),
  never Idle.
- **External** — waiting on someone else (via 009-04: a PR out for another's
  review). No `gh` ⇒ unreachable until 009-04 unless a non-PR external marker
  exists; deferred like its fixture.
- **Idle** — no open work: every slice `DONE`/`DEFERRED`/`ABANDONED`, no owner
  tag, no blocker.

**Derivation location (settles frame-critique nit 7 / the arch question):** the
waiting-on state is derived **scan-side** (in `src/scan.mjs`/`src/lib.mjs`, where
`ownerOf`, slice `status`, and `resolveToken` live) and emitted as a new payload
field `waitingOn: { state, verb, action, rank }`. `public/render.mjs` (browser,
cannot import `src/lib.mjs`) only *reads* that field. This makes 009-02 a
scan-layer change (a new derived field), which is why the slice carries
`arch_review: true`; the arch pass validates the boundary.

Activity counts (total open bugs, any deferred slice, any worktree-only doc, the
*number* of in-flight items) are **excluded** from state derivation — they may
inform 009-01's "in flight" heat figure, never the waiting-on state. Using the
*existence* of a resumable/launchable slice to pick Ready is an intent signal
(Claude can act), not an activity volume, and does not breach this rule.

1. **One state per project, rendered as the headline.** Each card shows its
   single waiting-on state as its most prominent line, with the DECIDE/REVIEW/
   MERGE verb (not the umbrella "You"), plus a **few-word named next action**
   (e.g. "decide the currency-rounding rule", "review 2 finished slices") — never
   a hollow "all calm". Idle renders quietest, You-states strongest.
2. **Finish-first ordering (total precedence over the pinned states).** Both the
   single-state choice (AC1) and the grid order use one total order, most
   finish-advanced first:
   **MERGE > REVIEW > DECIDE > Ready(resume, `IN_PROGRESS`) > Ready(start,
   `READY_FOR_IMPLEMENTATION`/`DRAFT`) > External > Idle.**
   You-states (MERGE/REVIEW/DECIDE) outrank Claude-states, and a nearly-done You
   item outranks an earlier-pipeline one (land/merge before review before an open
   decision). Within Ready, a resumable in-progress item sorts above a fresh
   start. A project stuck one step from done therefore sorts above a fresh start;
   Idle sorts last. When a project has several candidate actions, its single
   shown state is the highest in this order (AC1) — e.g. a project with both a
   `RECONCILED` slice and a `**(you)**` tag shows **MERGE** as the headline, with
   the open decision one click away in the detail view.
3. **Owner-settable marker backstop.** An owner-set flag in
   `~/.claude/my-dashboard/` config (never in a surveyed repo; A2) forces a
   project's state to a You-state (or a chosen verb) regardless of derivation, so
   a real block is never missed because a convention went unwritten. Absent the
   flag, the derived signal is used unchanged (zero-config default).
4. **Discrimination probe (disk-measurable) passes.** Run the derivation across
   the real configured project set; the You-states must light on a **minority**
   of cards, not most (ADR-0006 failure signature: You on ≳ half of cards =
   saturation). Record the per-project result. On saturation, the taxonomy is
   retightened (or, per Kill criteria, the derived signal is dropped to the
   owner-marker floor and the grid — 009-01 — stands).
5. **Recall check (owner ground truth) recorded.** Compare the derived states
   against the owner's ground-truth list (DoR): no project the owner named as
   needing them reads as Ready/Idle. Any miss is either fixed in the taxonomy or
   covered by the owner-settable marker; the check and its disposition are
   recorded. A disk-only re-grep does not satisfy this AC (it re-measures
   presence, not recall).

**DoD:**
- [x] All ACs pass; full suite green. (282 tests, 0 fail.)
- [x] Test coverage: one fixture per state (DECIDE/REVIEW/MERGE/Ready/Idle;
      External deferred to 009-04), the finish-first ordering (incl. Ready-resume
      sorting above Ready-start), the owner-marker override, the "excluded
      activity marker does not change state" case, and the **false-Idle
      regression**: an `IN_PROGRESS` project with no owner tag derives
      Ready(resume), never Idle.
- [x] Each new test shown to fail when its feature is removed. (Red-before-green
      confirmed per feature via targeted mutation, each restored.)
- [x] Frame-critique pass (this slice declares `frame_review: true`).
      (`reviews/slice-02-frame-critique.md` — needs-changes; 4 blockers resolved
      in slice text before code.)
- [x] Arch-review pass (this slice adds a derivation module / new payload field —
      `arch_review: true`). (`reviews/slice-02-arch.md` — pass, boundary held.)
- [x] Reviewed by `reviewer` subagent (compliance + craft).
      (`reviews/slice-02-compliance.md`, `slice-02-craft.md` — both pass.)
- [x] Discrimination + recall results recorded (ACs 4–5) as review evidence.
      (`reviews/slice-02-discrimination-recall.md` — 29% You (PASS); no taxonomy
      recall miss on investigation.)
- [x] Deviation log + reconciliation sweep produced. (Below.)
- [x] Reconciliation review passed. (`reviews/slice-02-reconciliation.md`.)

**Anti-horizontal-phasing check:** After this slice, the owner opens the grid
and reads, in seconds, which project is waiting on *them* and for what — the
triage question ADR-0006 exists to answer — with nearly-finished work surfaced
above fresh starts.

### Deviation log (after reconciliation)

Original ACs preserved above; these are the deviations that arose during
implementation and review.

1. **DECIDE retightened intent-scoped (AC4 discrimination loop fired).** The
   first derivation lit You on 5 of 7 real projects (63% — saturation FAIL)
   because DECIDE triggered on *any* compass blocker. Retightened so a blocker
   fires DECIDE only when it itself carries the `**(you)**` tag
   (`ownerOf(blocker) === 'you'`); bare/process-note blockers no longer fire it.
   Re-probe → 2 of 7 (29%, PASS). The taxonomy text (DECIDE bullet) was updated
   to record this. Empirical finding: **no surveyed project currently uses the
   `**(you)**` tag convention**, so automatic DECIDE has nothing to grab today —
   owner decisions surface via the marker backstop (ADR-0006's "recall is not
   disk-measurable" premise, confirmed on real data).
2. **`READY_FOR_REVIEW` → Ready** added to the derivation (taxonomy conformance —
   the REVIEW bullet already scoped it to Ready; the first cut omitted it).
3. **MERGE pinned to `RECONCILED`; REVIEW pinned to `REVIEWED`** (frame-critique
   b1/b2) — the loose "landed/reviewed work" and "review-ready slice" wording was
   replaced with exact jig statuses so every state has an authorable fixture.
4. **False-Idle closed** (frame-critique b3): `IN_PROGRESS` with no owner tag →
   Ready(resume), never Idle. Regression test added.
5. **Total precedence order** (frame-critique b4): AC2's loose verbs replaced with
   MERGE>REVIEW>DECIDE>Ready-resume>Ready-start>External>Idle.
6. **Derivation location = scan-side** (frame-critique n7 / the arch question):
   new payload field `waitingOn:{state,verb,action,rank}` emitted by `scanProject`
   (via `deriveWaitingOn` in `src/lib.mjs`); `public/render.mjs` only reads it and
   imports nothing (browser boundary held — arch pass confirmed).
7. **Config marker key = `needsYou`** (AC3, A2) — per-project in
   `~/.claude/my-dashboard/config.json`; a string (forces DECIDE, string is the
   action) or `{state?, action}`. No `loadConfig` change (existing `...p`
   passthrough). A malformed marker (unknown `state`) normalizes to DECIDE, and an
   empty `action` on a forced marker defaults per-state (land/review/decide) so the
   forced headline never silently drops (compliance + craft robustness fixes).
   Recorded in `docs/decisions/lightweight-decisions.md`.
8. **Post-review test-hygiene:** 6 "mutation check" tests that asserted on
   hand-reconstructed pre-fix logic (vacuous) or duplicated an adjacent positive
   test (redundant) were removed across the compliance/craft cleanups; genuine
   coverage remains in the sibling tests + the end-to-end scan integration test.
9. **External (rank 6) left deliberately unreachable** — no on-disk signal exists
   pre-009-04; the branch is present but never emitted, per the taxonomy note.
   `waitingOn` is intentionally **not emitted** for error / non-jig projects
   (`scanProject` early-returns); `render.mjs` degrades those to the compass line
   and `waitingOnRank` treats a missing field as rank 7 (sorts last).

**Out-of-scope findings surfaced (recorded, not fixed here):**
- One surveyed project's live config path had a typo (a character dropped from the
  folder name), so the dashboard couldn't survey it. One-line owner config fix;
  flagged to owner (fixed post-slice with an owner-approved edit).
- One project the owner named as needing them is not in the surveyed config at all
  — add it if it should appear. Both logged for the owner; neither is 009-02 work.
  (Real project names are kept out of this public repo per vision principle 6 /
  the leak gate; specifics live outside the repo.)

### Reconciliation sweep

Drift-prone surfaces checked, with dispositions:

- **`docs/architecture.md`** — **updated**: `src/lib.mjs`, `src/scan.mjs`, and
  `public/render.mjs` module notes now mention the `deriveWaitingOn` derivation,
  the emitted `waitingOn` field, and the new render helpers (`nextMoveCell`,
  `sortProjectsByWaitingOn`, `waitingOnRank`); the `GET /api/data` contract-surface
  bullet notes the additive `waitingOn:{state,verb,action,rank}` derived field.
- **`docs/decisions/lightweight-decisions.md`** — **updated**: recorded the
  `needsYou` marker config key/shape and the DECIDE intent-scoping rule (blocker
  must carry the `**(you)**` tag) as scoped, settled, non-ADR decisions.
- **ADR trigger (load-bearing decision?)** — **no-op**: the taxonomy status-map,
  the DECIDE retightening, and the scan-side derivation location are all *within*
  ADR-0006's delegated scope (it explicitly handed the exact marker set + its
  validation to this spec) and the pinned slice text; no new load-bearing decision
  with rejected alternatives beyond what ADR-0006 already frames. No new ADR.
- **`docs/conventions.md`** — **no-op**: no new coding rule introduced.
- **`docs/inbox.md` / primer (`CLAUDE.md`)** — **no-op** for closure: spec 009 is
  not yet complete (009-03, 009-04 remain DRAFT), so no compress-on-close-out.
  Status-board Notes updated for 009-02.
- **Bugs board** — **no-op**: no tracked bug folded or created (the two
  out-of-scope config findings are owner follow-ups, logged in the deviation log,
  not defects).
