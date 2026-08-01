---
status: DRAFT
dependencies: [005-01, adr-0004]
last_verified:
frame_review: true
---

## Slice 005-03 — dashboard-owned narrative snapshot skill

**Goal:** a user can run the dashboard's own snapshot skill for a project and get
a genuine narrative "what's next" entry appended to the store (outside every
repo), which the project card then shows as its latest headline (UC-3) — and the
scanner, server and page stay deterministic and LLM-free while it happens.

This resolves [ADR-0004](../../decisions/adr-0004-dashboard-owned-snapshots.md)
OQ1 (*who writes the narrative prose? the dashboard, via its own skill*). It does
**not** build the recurring routine or choose its cadence — that is 005-04 (OQ2)
— and it does **not** build the evolution/velocity chart, which is its own future
spec (OQ2).

### Definition of Ready

- [x] 005-01 DONE — the store, the writer path (`snapshot.mjs`), `projectKey`,
      and the dual read all exist and are tested.
- [x] OQ1 answered by the owner (2026-07-24): the dashboard writes narrative via
      its **own Claude-run skill**; the compass-companion option is dead. Vision
      principle 2's determinism binds the scanner and page, **not** a skill — so a
      skill can author prose without breaking it (ADR-0004 OQ1 amendment).
- [ ] Decide the write path: does the skill shell out to the existing
      `snapshot.mjs --project … --headline … --next … --blockers …` (manual
      mode, already tested), or does it need a new `source` value distinguishing
      skill-authored entries from `manual`/`auto`? (Open design question below.)

### Scope

**In:** a dashboard-owned skill (`skills/snapshot/SKILL.md`, invoked as
`/dashboard:snapshot [project]`) that (1) reads the named project's own jig
artifacts — spec status board, the in-progress slice, open bugs, release slate,
any `Next:` marker — to compose a narrative headline plus optional `next` and
`blockers`; (2) writes exactly one valid snapshot line to the dashboard-owned
store for that project via the existing writer; (3) leaves the surveyed repo
byte-identical. The kill-criterion guard from OQ1 (the entry must be genuine
narrative, not the thin deterministic `auto:` line).

**Out:** the recurring/automated routine and its cadence (**005-04**); the
evolution/velocity view (OQ2's own future spec); any change to the snapshot line
schema (`validateSnapshot` is inherited unchanged); deleting or editing any
in-repo `docs/status/compass-history.jsonl` (§6, later and separate); back-filling
history (005-02 already did the one-time migration).

### Assumptions

- **A1 — a Claude-run skill can author narrative prose without breaking the
  dashboard's determinism.** *Grounded (ADR-0004 OQ1 amendment), owner-confirmed.*
  Vision principle 2 (same disk state → same page) binds the scanner and the
  rendered page, which stay LLM-free; the skill is Claude-run, exactly as compass
  composed its headlines. The risk is not determinism but discipline: nothing
  stops a future edit from moving prose composition into `scan.mjs`. Mitigated by
  AC4, which asserts the scanner/server/page are unchanged.
- **A2 — the existing `snapshot.mjs` manual write path is sufficient for the
  skill.** *Partly probed.* `snapshot.mjs --project <p> --headline "…" [--next]
  [--blockers]` already validates and appends one line to the store, refuses a
  non-jig or missing project, and never writes into the surveyed repo
  (`scripts/snapshot.mjs`, tested). Open: whether skill-authored entries need
  their own `source` value (they would land as `source: manual` today) — see Open
  questions.
- **A3 — a skill reliably produces *substantive* narrative, not bland filler.**
  *Unverified, load-bearing — this is OQ1's kill criterion 3.* A skill that emits
  headlines no richer than the `auto:` line is a failure: it adds an LLM call for
  no gain over the deterministic writer. Mitigated by AC2 (the entry must name
  what is actually next, in prose, drawn from the same signals `compass`/`orient`
  read) and by the frame-critique pass this slice carries.

### Acceptance criteria (draft — refine at READY_FOR_REVIEW)

**AC1 — one valid narrative entry, in the store, for the named project.** Running
the skill for a project composes a headline (plus optional `next`/`blockers`) and
appends exactly one line to that project's `<project-key>.jsonl` in the
dashboard-owned store. The line passes `validateSnapshot` unchanged; `specs`
reflects the project's current progress. Nothing is written into the surveyed
repo.

**AC2 — the entry is narrative, not the `auto:` line (OQ1 kill criterion 3).**
The headline names what is actually next for the project in prose, composed from
the project's own artifacts (in-progress slice, open bugs, release `Next:`
marker), not the deterministic `auto: N/M specs done · …` string. A run that can
only produce the `auto:` line reports that and writes nothing, rather than
recording filler.

**AC3 — the card reflects it (UC-3, end-to-end).** After the write, the project
card's latest headline is the new entry (via the dual read / later-`ts` rule). A
project with no prior history renders the new entry; a project with a later
in-repo entry still resolves correctly.

**AC4 — the scanner, server and page stay deterministic and LLM-free.** The skill
is the only Claude-run part; `scan.mjs`, `server.mjs`, `lib.mjs` and the page make
no LLM calls and are unchanged in their determinism (same disk state → same
page). The skill lives at `skills/snapshot/` and is invoked `/dashboard:snapshot`.

**AC5 — it refuses safely.** A missing, non-jig, or unresolvable project is
reported and nothing is written (reuse the existing `snapshot.mjs` guards). The
skill never guesses a project path.

**AC6 — nothing in a surveyed repo changes, and the suite stays green.** No
surveyed repo shows a changed file (git status clean). `npm test` passes,
including `test/no-leaks.test.mjs`. New tests cover any new code introduced (e.g.
a signal-gathering helper or a new `source` value); the skill's prose quality is
judged by the craft + frame-critique review, not by unit tests.

### Definition of Done

- [ ] All ACs met, tests green
- [ ] Compliance + craft review passed and recorded
- [ ] Frame-critique passed and recorded (`frame_review: true`)
- [ ] Deviation log written
- [ ] Reconciliation sweep written
- [ ] If a new `source` value is introduced, `validateSnapshot` and
      `docs/architecture.md`'s snapshot-line contract updated, and the choice
      recorded (lightweight decision or ADR as warranted)
- [ ] Status board regenerated

### Open questions (resolve before READY_FOR_IMPLEMENTATION)

1. **Write path.** Skill shells out to `snapshot.mjs` manual mode (no new code,
   thinnest slice), or a small helper gathers the narrative signals for the skill
   to compose from? Probe what `compass`/`orient` already surface before adding
   anything — the signal-gathering may already exist.
2. **`source` value.** Do skill-authored entries need to be distinguishable from
   `manual` and `auto` (e.g. `source: "dashboard"`)? The evolution view (OQ2) may
   want to weight or filter by producer. If yes, it is a schema-adjacent decision
   for `validateSnapshot`.
3. **Invocation surface.** One project per run (`/dashboard:snapshot <path>`) vs
   an `--all` equivalent. `--all` narrative is really the routine's job (005-04);
   keep this slice to the single-project, human-invoked path.

### Notes

**Why this is split from the routine (005-04).** The narrative skill delivers
end-to-end value on its own — a person runs it and the card gains a real "what's
next" line. The recurring routine is automation layered on top, and its **cadence
is genuinely open** (ADR-0004 OQ2: at most one automatic entry per project per
day, or only when the computed state differs from the previous entry — sampling
matters because the series feeds a chart). Bundling a scheduled-task rebuild with
the skill would make one slice carry two independently-testable deliverables.
005-04 rebuilds the paused twice-daily `compass-snapshots` routine (disabled
2026-07-22, and it must be retargeted off the abandoned `project-dashboard` path
and away from its old `--commit`-into-the-repo behaviour) against this skill and
the new store, and picks the cadence.

**What stays deterministic.** The scanner and page never gain an LLM call; the
skill is the sole judgment layer, exactly as compass was. Kill criterion 3 stays
live: a skill that produces bland headlines is a failure and should be cut rather
than shipped thin.
