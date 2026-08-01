---
status: RECONCILED
dependencies: [005-01, adr-0004]
last_verified: 2026-08-01
frame_review: true
claimed_by: claude/dashboard-status-caa399
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
- [x] Write path decided (2026-07-31): the skill shells out to the existing,
      tested `snapshot.mjs` manual writer — no new writer. A small `--source`
      flag lets the skill tag its entries `source: "dashboard"`. `validateSnapshot`
      already accepts any `source` (probed: it does not constrain the field), so
      no schema/contract change is needed. See Resolved design decisions.

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
  skill.** *Probed.* `snapshot.mjs --project <p> --headline "…" [--next]
  [--blockers]` already validates and appends one line to the store, refuses a
  non-jig or missing project, and never writes into the surveyed repo
  (`scripts/snapshot.mjs`, tested). The only gap — a way to tag the provenance —
  is closed by the small `--source` flag (Resolved design decisions); no new
  writer is needed.
- **A3 — a skill reliably produces *substantive* narrative, not bland filler.**
  *Unverified, load-bearing — this is OQ1's kill criterion 3.* A skill that emits
  headlines no richer than the `auto:` line is a failure: it adds an LLM call for
  no gain over the deterministic writer. Mitigated by AC2 (the entry must name
  what is actually next, in prose, drawn from the same signals `compass`/`orient`
  read) and by the frame-critique pass this slice carries.

### Acceptance criteria

**AC1 — one valid narrative entry, in the store, for the named project.** Running
the skill for a project composes a headline (plus optional `next`/`blockers`) and
appends exactly one line to that project's `<project-key>.jsonl` in the
dashboard-owned store, tagged `source: "dashboard"`. The line passes
`validateSnapshot` unchanged; `specs` reflects the project's current progress.
Nothing is written into the surveyed repo.

**AC2 — the entry carries what's-next information, not filler (OQ1 kill
criterion 3).** This is a **judgment gate enforced inside the skill, not a
mechanical check** — `snapshot.mjs` writes whatever it is handed, so the guard
is the skill's own self-assessment, and the honest failure mode is not the
literal `auto:` string (nobody would emit that) but *grammatical prose that
merely restates the progress counts* (e.g. "005 is in progress" adds nothing the
`auto: N/M specs done` line lacks). The skill must compose a headline that names
a concrete next action, decision, or blocker carrying information the `auto:`
line does not (e.g. "sessions-panel 003 ready to implement; 003-03 deferred on
the `gh` decision"), and is instructed to **abort and report — writing nothing —
if the best it can produce only restates the counts.** Because this rests on
judgment, prose quality is judged by the craft + frame-critique review (AC6);
kill criterion 3 stands — a skill that yields thin headlines is cut, not shipped
thin.

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
including `test/no-leaks.test.mjs`. New tests cover the `--source` flag:
`snapshot.mjs --source dashboard` writes `source: "dashboard"`, and the default
provenance (`auto`/`manual`) is unchanged when the flag is absent. The skill's
prose quality is judged by the craft + frame-critique review, not by unit tests.

### Definition of Done

- [x] All ACs met, tests green (82 tests, `test/no-leaks.test.mjs` included)
- [x] Compliance + craft review passed and recorded (`reviews/slice-03-compliance.md`,
      `reviews/slice-03-craft.md` — both pass)
- [x] Frame-critique passed and recorded (`frame_review: true`) —
      `reviews/slice-03-frame-critique.md` (pre-implementation)
- [x] Deviation log written (below)
- [x] Reconciliation sweep written (below)
- [x] `source: "dashboard"` recorded as a lightweight decision, and
      `docs/architecture.md`'s snapshot-line note names the value (no
      `validateSnapshot` change — the field is unconstrained)
- [x] Status board regenerated (on the DONE transition)

### Resolved design decisions (2026-07-31)

1. **Write path — reuse `snapshot.mjs`, add `--source`.** The skill composes prose
   (its judgment) and writes through the existing manual writer:
   `node scripts/snapshot.mjs --project <path> --headline "…" [--next "…"]
   [--blockers "a;b"] --source dashboard`. No new writer, no duplicated
   validation or store-path logic. The writer gains one small option, `--source
   <value>`, which overrides the default provenance tag (`auto` under `--auto`,
   otherwise `manual`); everything else is unchanged. The signal-gathering the
   skill needs (progress, in-progress slice, open bugs, `Next:` marker) is what
   the dashboard's own `scanProject` already computes and what a project's
   `compass`/`orient` surface — the skill reads those, it does not add a helper.
2. **`source` value — `"dashboard"`.** Skill-authored entries are tagged
   `source: "dashboard"`, distinct from a human's `manual` headline and the
   deterministic `auto` line, so the future evolution view (OQ2) can tell the
   three apart. `validateSnapshot` does not constrain `source` (probed), so this
   is not a schema change; it is recorded as a lightweight decision, and
   `docs/architecture.md`'s snapshot-line note gains the value for the record.
3. **Invocation — one project per run.** `/dashboard:snapshot <project-path>`
   (or a config label resolved to a path). An `--all` narrative sweep is the
   routine's job and belongs to 005-04; this slice is the single-project,
   human-invoked path.

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

### Deviation log (after reconciliation)

The implementation followed the Resolved design decisions exactly — the skill
shells out to the existing `snapshot.mjs` with `--source dashboard`; no new
writer, no schema change (compliance review: "no deviation observed"). The
record below is the review-driven refinements and one accepted narrowing.

- **AC2 wording sharpened (pre-implementation frame-critique).** The frame pass
  caught that AC2 read as if a *mechanical* "writes nothing" guard existed. It
  does not — `snapshot.mjs` writes whatever it is handed, so the guard is the
  skill's own judgment. AC2 was reworded before any code was written to say this
  plainly and to name the honest failure mode (prose that restates the counts),
  and the SKILL.md instructs the skill to abort and write nothing in that case.
- **Bare `--source` test added (craft nit).** The craft pass noted the
  bare-`--source` edge (flag with no value → parsed to boolean `true`) was
  handled by the guard but untested. A test was added asserting `--source` as the
  last arg leaves `source: manual`.
- **`--auto --source dashboard` override — accepted, spec-sanctioned (craft
  nit).** The `--source` override runs unconditionally, so pairing it with
  `--auto` would tag a deterministic `auto:` headline as `source: "dashboard"`,
  mislabeling it for the future evolution view. This matches Resolved design
  decision 1 (`--source` overrides "`auto` under `--auto`"), and the skill only
  ever uses the manual path, so it is not a defect. Left as-is; **005-04 can
  tighten `--source` to the manual path** if it never needs the auto override.
- **Plugin version bumped 0.2.1 → 0.3.0** (`.claude-plugin/plugin.json` and
  `package.json`). A new skill does not reach an installed plugin without a
  version bump; this is packaging that ships the slice, recorded as a lightweight
  decision.

### Reconciliation sweep (after reconciliation)

- `docs/architecture.md` — **updated**: the snapshot-line Contract-surfaces note
  now enumerates the `source` provenance values (`manual`/`auto`/`dashboard`) and
  states `validateSnapshot` does not constrain the field (documented convention,
  not a validated enum); the source-tree diagram also gains
  `skills/snapshot/SKILL.md` alongside `skills/open/` (reconciliation-review catch).
- `docs/decisions/lightweight-decisions.md` — **updated**: `source: "dashboard"`
  provenance value and the 0.3.0 version bump recorded.
- `.claude-plugin/plugin.json` / `package.json` — **updated**: version 0.3.0.
- Skill registration — **no-op**: skills are auto-discovered from `skills/`
  (the existing `open` skill is not manifest-listed either); no manifest change
  is needed for `/dashboard:snapshot` to be exposed.
- `docs/specs/README.md` status board — **updated on the DONE transition**.
- `CLAUDE.md` primer — **updated at close-out**: 005-03 moves to DONE; 005-04
  (routine + cadence) is the remaining snapshot-store work. Spec 005 stays open.
- `docs/conventions.md` — **no-op**: no new convention.
- `docs/inbox.md` — **no-op**: 005-04 is already carried in the spec decomposition
  and Slices list; no new parked item.
