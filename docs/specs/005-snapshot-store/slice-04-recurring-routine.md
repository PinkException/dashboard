---
status: DONE
dependencies: [005-01, 005-03, adr-0004]
last_verified: 2026-08-03
frame_review: true
---

## Slice 005-04 — rebuild the recurring snapshot routine + choose its cadence

**Goal:** the paused twice-daily snapshot routine runs again, unattended, writing
one entry per configured project to the dashboard-owned store on a chosen
cadence — so the history grows into a time series the future evolution view can
chart — and it **never writes into any surveyed repo**.

This resolves [ADR-0004](../../decisions/adr-0004-dashboard-owned-snapshots.md)
OQ2 (the growing series is wanted; the routine is rebuilt against it). It does
**not** build the evolution/velocity chart itself — that is its own future spec.

### Definition of Ready

- [x] 005-01 DONE — the store and `snapshot.mjs` write outside every repo; no
      code path writes into a surveyed project.
- [x] 005-03 DONE — the `/dashboard:snapshot` narrative skill and the
      `--source dashboard` tag exist; `snapshot.mjs --all --auto` writes a
      deterministic entry per configured project (probed).
- [x] The paused routine's exact shape is known (probed 2026-08-01): it lives at
      `~/.claude/scheduled-tasks/compass-snapshots/SKILL.md`, disabled since
      2026-07-22. It is Claude-run, composes narrative per project, and writes
      with `snapshot.mjs --project … --commit`. **The `--commit` wrote into each
      project's own repo — that was the leak (bug 002).** It also points at the
      abandoned `~/Documents/Claude/project-dashboard` and the old
      `dashboard.config.json`, and cites the superseded ADR-0002 contract.
- [x] Cadence chosen (Open question 1) and the routine's repo-side deliverable
      settled (Open question 3). **Resolved 2026-08-01 (owner):** on-change-only
      cadence; deterministic `--auto` content; repo ships an `--if-changed`
      guard on the writer. See the resolution notes under Open questions.

### Scope

**In:** rebuilding the scheduled routine so it appends one entry per configured
project to the dashboard-owned store, unattended, on the chosen cadence; the
retarget off the abandoned path/config/contract onto the current ones
(`~/Documents/Claude/dashboard`, `~/.claude/my-dashboard/config.json`,
ADR-0004); **dropping `--commit` entirely**; and whatever small repo-side support
the cadence needs (Open question 3) with its tests.

**Out:** the evolution/velocity **chart** (OQ2's own future spec — this slice
only feeds it); the narrative composition itself (005-03, done); deleting or
editing any in-repo `docs/status/compass-history.jsonl` (§6, later and separate);
any change to the snapshot line schema.

### Assumptions

- **A1 — the scheduled-task mechanism can run this unattended.** *Grounded.* The
  old routine ran this way, and other scheduled tasks on this machine
  (`night-worker`, `morning-brief`) still do. The routine's definition lives
  per-user under `~/.claude/scheduled-tasks/` (outside every repo, vision
  principle 6), so enabling/scheduling it is a per-user action, not a repo change.
- **A2 — `snapshot.mjs --all --auto` already writes one deterministic entry per
  configured project to the store.** *Probed.* It reads the resolved config's
  project list and appends an `auto:` line per project, outside every repo, with
  no `--commit`. So the deterministic path needs little new code — mostly the
  cadence guard (Open question 1/3).
- **A3 — an unattended *narrative* run is viable and wanted.** *Unverified,
  load-bearing.* Running 005-03's Claude-run narrative skill on a schedule costs
  an LLM call per project per run and depends on judgment being reliable
  unattended. The deterministic `--auto` path has neither cost nor that risk, but
  produces counts, not prose. Which the routine writes is Open question 2 — and
  it is the load-bearing framing choice, so this slice carries `frame_review`.

### Open questions — RESOLVED 2026-08-01 (owner)

1. **Cadence (OQ2 — the headline decision). → On-change-only.** The routine runs
   daily but appends a line for a project **only when the computed deterministic
   progress differs from that project's most recent stored deterministic entry**;
   otherwise it writes nothing for that project and says so. This keeps the series
   lean and every point meaningful for the future chart, at the cost of even
   spacing (acceptable — a velocity chart plots real transitions, and gaps are
   honest). "Changed" is defined precisely as a **progress signature** — spec
   completion (`specs.done`/`specs.total`) plus which spec is active (`next`) —
   compared against the last stored entry **of the same `source`**. Two
   deliberate exclusions, both from the frame-critique (2026-08-03):
   - **Open-bug count is excluded.** It is not progress: a bug that opens and
     closes nets zero yet would otherwise write two series points — churn, not
     signal.
   - **Progress is measured at spec granularity**, so a multi-slice spec produces
     no auto point until a spec completes or the active spec changes. This is a
     known coarseness of the existing `auto` fingerprint (whose schema is out of
     scope here); enriching it to slice granularity is deferred to the future
     evolution-chart spec, noted in `docs/architecture.md`.

   Comparing within same-source isolates the deterministic series so an
   interleaved human narrative entry never forces a redundant auto point.
2. **Narrative (005-03 skill) vs deterministic (`--auto`). → Deterministic only.**
   The routine writes deterministic `--auto` entries (option (a)). The 005-03
   narrative skill stays human-invoked. Rationale: the routine's job is to feed
   the chartable series, which wants the deterministic progress numbers, not
   prose; and an unattended per-project LLM call twice a day carries cost and the
   risk A3 names (a wrong sentence landing with no reviewer). A human who wants
   fresh prose on a card runs `/dashboard:snapshot`. This **retires the A3 risk**
   for this slice.

   **Card-display consequence (frame-critique 2026-08-03, owner-confirmed).**
   Because a *daily* auto entry would be the newest line, and the card reader
   picked the latest entry purely by `ts`, unguarded this would bury 005-03's
   prose headline under terse `auto:` counts. The card reader is therefore
   changed to **prefer the latest narrative (non-`auto`) entry** for the card
   headline, falling back to the latest `auto` entry only when no prose exists.
   The auto series still accumulates in the store for the future chart; it just
   no longer takes over the card. A `source`-less legacy line counts as
   narrative (never hidden).
3. **Repo-side deliverable. → `--if-changed` guard on the writer.** This repo
   ships a new `--if-changed` flag on `snapshot.mjs` (composable with
   `--all --auto`) that skips a project whose computed state matches its last
   stored same-source entry, plus tests for the guard and the no-in-repo-write
   guarantee, plus the `docs/architecture.md` note and a lightweight decision
   recording the cadence. The scheduled routine itself is per-user config
   (`~/.claude/scheduled-tasks/compass-snapshots/`, outside the repo) — rebuilt
   as a documented per-user step, not shipped in the repo.

### Acceptance criteria

**AC1 — the routine writes to the store, never into a repo.** A scheduled run
appends deterministic `--auto` entries to
`~/.claude/my-dashboard/snapshots/<project-key>.jsonl` and makes **no commit and
no write inside any surveyed project**. `--commit` is gone. Re-running is safe
(no duplicate/never-ending growth — the `--if-changed` cadence rule bounds it).

**AC2 — the on-change cadence rule holds (`--if-changed`).** `snapshot.mjs
--if-changed` (composable with `--all --auto`) enforces the on-change rule and is
testable: a project whose **progress signature** matches its most recent stored
same-source entry gets **no new line** and a reported skip; a project whose
progress changed (or that has no prior same-source entry) gets a new line. The
signature is `specs.done` + `specs.total` + `next`, compared against the last
stored entry of the same `source`. Open-bug-count churn does **not** trigger a
write (it is excluded from the signature).

**AC3 — retargeted and contract-correct.** The routine reads the current config
(`~/.claude/my-dashboard/config.json`), targets the current repo, cites ADR-0004
(not ADR-0002), and never mentions the abandoned `project-dashboard` path.

**AC4 — the card reflects the series without burying prose (UC-3).** After a run,
each project card's headline is the **latest narrative (human/skill) entry** when
one exists, even if a newer deterministic `auto` entry was just written; the card
falls back to the latest `auto` entry only when no prose entry exists. The
growing auto history remains in the store for the future evolution view. This
protects 005-03's prose-on-cards value against the daily auto series
(frame-critique 2026-08-03).

**AC5 — nothing in a surveyed repo changes, and the suite stays green.** No
surveyed repo shows a changed file. `npm test` passes, including
`test/no-leaks.test.mjs`. New tests cover the cadence guard (AC2), the
progress-signature exclusions (bug churn; same-source baseline), the
narrative-preferred card display (AC4), and the no-in-repo-write guarantee (AC1).

### Definition of Done

- [x] Open questions 1–3 resolved and folded into the ACs
- [x] All ACs met, tests green (93/93)
- [x] Compliance + craft review passed and recorded
- [x] Frame-critique passed and recorded (`frame_review: true`)
- [x] Deviation log written
- [x] Reconciliation sweep written
- [x] Any new writer option (e.g. `--if-changed`) documented in
      `docs/architecture.md`; a lightweight decision records the cadence choice
- [~] The per-user routine at `~/.claude/scheduled-tasks/compass-snapshots/` is
      rebuilt (retargeted, `--commit` removed) — **content staged, install
      owner-gated.** The live dir is guardrail-protected (sanctioned external
      installer only, per-run owner go-ahead required); this is a per-user step
      outside the repo, handed off to the owner rather than done unattended.
- [x] Status board regenerated

### Notes

**The one non-negotiable: no `--commit`.** The paused routine's
`snapshot.mjs … --commit` wrote into each surveyed project's own git history —
exactly the leak ADR-0004 and 005-01 closed (bug 002). The rebuilt routine writes
only to the dashboard-owned store outside every repo. Re-adding an in-repo write
here recreates the bug; do not.

**Why this was split from 005-03.** 005-03 is the human-invoked narrative skill
and delivers value on its own. This slice is the automation and the cadence
decision — a separate, independently-testable concern (ADR-0004 OQ2). Sampling
matters here in a way it does not for a one-off human snapshot, because the
series feeds a chart: too-frequent points bloat it, too-sparse points blur the
trend.

**The chart is not in scope.** OQ2 confirmed the owner wants the evolution /
velocity view; that view reads this series and is its own future spec. This slice
only guarantees the series exists and grows honestly.

**Frame-critique outcome (2026-08-03).** The pre-implementation frame-critique
returned `needs-changes` and caught two real, code-grounded frame errors in the
owner's initial resolution, both folded in above before implementation:
1. A daily `auto` entry would have buried 005-03's prose headline on the card
   (the reader picked latest-by-`ts`, source-blind) → the reader now prefers the
   latest narrative entry; the auto series stays chart-only (AC4).
2. Defining "changed" over the full `auto` headline would have sampled open-bug
   churn (net-zero noise) while staying silent during real work → "changed" is a
   progress-only signature; spec-granularity coarseness documented as a deferred
   future-chart concern (AC2 / OQ1).

### Deviation log (after reconciliation)

Original ACs (above) preserved; this records what changed during implementation
and why.

- **Scope grew by two frame-critique-driven changes, both folded in before any
  code:** (a) a reader-side change — the card now prefers the latest narrative
  (non-`auto`) entry (`parseCompassHistory.latestNarrative`, narrative-preferred
  `scanCompass`), so the daily auto series feeds the chart without burying
  005-03's prose; (b) the on-change comparison uses a **progress signature**
  (`specs.done`/`specs.total` + `next`), not the full `auto` headline, excluding
  open-bug churn. AC2 and AC4 were refined accordingly; the initial draft's
  "headline + next" comparison and "newest entry wins" display were both wrong
  and would have regressed the series and the cards.
- **`auto` fingerprint left spec-granular.** Changing the snapshot line schema is
  out of scope; the series therefore samples at spec granularity (a point per
  spec-completion or active-spec change). A multi-slice spec yields no auto point
  until a spec completes. Recorded as a deferred concern for the future
  evolution-chart spec (docs/architecture.md).
- **Card freshness label now tracks displayed-narrative age**, not routine
  activity — an actively-sampled project can read "stale" if its prose is old.
  Intended (a nudge to refresh prose), documented in docs/architecture.md.
- **`next` in the signature marks lateral transitions** (active spec changes, a
  `total` bump from adding a spec) as well as forward completion. Defensible as a
  series marker; not load-bearing (frame-critique residual, non-blocking).
- **`--if-changed` composes with manual/narrative writes too**, not only
  `--auto`. It is documented and intended for the auto routine; same-source
  comparison makes stray use harmless. Deliberate, not a guarded combination.
- **Test hardening after compliance round 1:** a vacuous same-source test (the
  interleaved narrative shared the auto baseline's signature) was made
  discriminating with a differing `--next`; an explicit no-in-repo-write
  assertion and a cross-source card test were added (AC5).
- **The live per-user routine was NOT installed.** The rebuilt SKILL.md content
  is staged, but `~/.claude/scheduled-tasks/compass-snapshots/` is a
  guardrail-protected live automation directory whose only sanctioned writer is
  the external installer (`night-worker/tools/install_prompts.py`), and a live
  install needs the owner's explicit per-run go-ahead. Rebuilding/enabling the
  live routine remains an owner-gated per-user step — see the handoff at the end
  of this session.

### Reconciliation sweep

Drift-prone surfaces checked, with dispositions:

- **docs/architecture.md** — `updated`: added the "Recurring routine + cadence"
  subsection (on-change `--if-changed`, progress signature, narrative-preferred
  display, freshness-label consequence, deferred spec-granularity note).
- **docs/decisions/lightweight-decisions.md** — `updated`: recorded the
  on-change deterministic cadence choice (2026-08-03).
- **Snapshot line schema** — `no-op`: unchanged (explicitly out of scope); no new
  fields written. `validateSnapshot` untouched.
- **src/server.mjs / public/index.html** — `no-op` (verified): the client renders
  `compass.headline` as delivered; the display preference is resolved server-side
  in `scanCompass`, so no client change is needed. Note: the client's
  `source === 'auto'` → "snapshot (auto)" label is now reachable only for a
  project with no narrative entry anywhere (narrative-preferred selection means a
  card with prose labels "compass"). This is an intended AC4 consequence, not
  dead code.
- **docs/specs/README.md** — `updated`: status board regenerated on close-out so
  the 005-04 row and the spec-005 rollup reflect DONE.
- **test/no-leaks.test.mjs** — `no-op`: green; no surveyed-project names touched.
- **CLAUDE.md primer** — `updated`: spec 005 closes with this slice; the
  active-spec and sprint-focus entries are compressed to reflect 005-04 DONE and
  the routine-install handoff.
- **docs/refinement-todo.md / docs/inbox.md** — `no-op`: no parked item is
  resolved by this slice beyond ADR-0004 OQ2, which the slice itself records.
- **Per-user routine (`~/.claude/scheduled-tasks/compass-snapshots/`)** —
  `deferred`: owner-gated install (see deviation log); content staged.
