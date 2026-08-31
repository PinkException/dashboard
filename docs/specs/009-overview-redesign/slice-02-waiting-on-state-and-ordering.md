---
status: DRAFT
dependencies: [009-01, adr-0006]
last_verified:
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

**Taxonomy (intent-scoped, activity-excluded — ADR-0006).** Each project
resolves to exactly one state, chosen as the most finish-advanced open action:

- **DECIDE** (You) — an owner decision is open: a `**(you)**`-tagged next step
  (`ownerOf`, `src/lib.mjs:69`) or a compass `blocker`
  (`compass.blockers`, `src/lib.mjs:235`) that names an owner decision.
- **REVIEW** (You) — a slice awaits the owner's review (a `REVIEWED`-ready /
  review-ready slice status the owner acts on). The ADR Open question — is a
  review-ready slice owner- or Claude-blocking? — is settled **owner-blocking**
  here and this AC records why.
- **MERGE** (You) — landed/reviewed work awaits the owner's merge, and (via
  009-04, when present) an approved PR ready to merge.
- **Ready** (Claude) — a launchable next slice exists (Claude can run it now); no
  owner action open.
- **External** — waiting on someone else (via 009-04: a PR out for another's
  review). No `gh` ⇒ this state is only reachable if a non-PR external marker
  exists; otherwise unused until 009-04.
- **Idle** — no open work (finished or shipped).

Activity counts (total open bugs, any deferred slice, any worktree-only doc) are
**excluded** from state derivation — they may inform 009-01's "in flight" heat
figure, never the waiting-on state.

1. **One state per project, rendered as the headline.** Each card shows its
   single waiting-on state as its most prominent line, with the DECIDE/REVIEW/
   MERGE verb (not the umbrella "You"), plus a **few-word named next action**
   (e.g. "decide the currency-rounding rule", "review 2 finished slices") — never
   a hollow "all calm". Idle renders quietest, You-states strongest.
2. **Finish-first ordering.** The grid orders projects land → merge → review →
   finish/unblock → start-new, Idle last. A project stuck one step from done
   sorts above a fresh start. Within a project, when several candidate actions
   exist, the most finish-advanced is the one shown (AC1).
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
- [ ] All ACs pass; full suite green.
- [ ] Test coverage: one fixture per state (DECIDE/REVIEW/MERGE/Ready/Idle;
      External deferred to 009-04), the finish-first ordering, the owner-marker
      override, and the "excluded activity marker does not change state" case.
- [ ] Each new test shown to fail when its feature is removed.
- [ ] Frame-critique pass (this slice declares `frame_review: true`).
- [ ] Arch-review pass (this slice adds a derivation module / new payload field —
      `arch_review: true`).
- [ ] Reviewed by `reviewer` subagent (compliance + craft).
- [ ] Discrimination + recall results recorded (ACs 4–5) as review evidence.
- [ ] Deviation log + reconciliation sweep produced.
- [ ] Reconciliation review passed.

**Anti-horizontal-phasing check:** After this slice, the owner opens the grid
and reads, in seconds, which project is waiting on *them* and for what — the
triage question ADR-0006 exists to answer — with nearly-finished work surfaced
above fresh starts.

### Deviation log (after reconciliation)

_TBD at implementation._

### Reconciliation sweep

_TBD at reconciliation._
