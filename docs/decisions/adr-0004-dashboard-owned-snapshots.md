---
status: Accepted
dependencies: []
last_verified: 2026-07-24
frame_review: true
---

# ADR-0004: Dashboard owns one append-only snapshot history per project

## Status

Accepted (2026-07-24)
Supersedes ADR-0002

## Context

Compass snapshots currently live inside every surveyed project and are written
by compass itself, and that arrangement has become a source of repo pollution
and repeated re-litigation. The contract behind it is
[ADR-0002](./adr-0002-compass-snapshot-contract.md), which put an append-only
`docs/status/compass-history.jsonl` in each project and made compass its writer.
Use since 2026-07-13 has made three problems concrete.

**1. It pollutes every repo it touches.** A scan of the owner's machine on
2026-07-22 found **23 real history files holding 193 entries** (excluding this
repo's synthetic test fixtures), spread across **7 projects**:

| Location | Files | Entries |
|---|---|---|
| Project roots (`project-a` … `project-f`) | 6 | 65 |
| `.claude/worktrees/*` copies (incl. `project-g`, which has *only* a worktree copy) | 17 | 128 |

Each project root file is handled differently — five of the six commit it, one
git-ignores it. The per-repo decision has been re-litigated in session after
session, which is the pain that triggered this ADR.

> Surveyed projects are referred to as `project-a` … `project-g` throughout. The
> real names are deliberately not recorded here: this repo ships publicly as a
> plugin, `docs/` is part of the package, and the surveyed projects are private.
> The unredacted survey is machine-local and git-ignored.

**2. Worktrees multiply and fork it.** Because the file lives in the repo, every
worktree gets its own copy that then drifts independently — 17 divergent copies
against 6 project roots. Nothing merges them; nothing says which is current.
This is the *fragmentation* problem: the history exists, but not in one place
per project.

**3. Compass is supposed to be read-only.** The owner's requirement, stated
directly: *"When I run compass I just want to know where we are at. The writing
of a file should come from the dashboard plugin."* ADR-0002 made a reporting
skill into a writer, and that write is the sole exception punched through vision
principle 1 ("read-only over other repos").

**Why move at all (primary, now evidenced).** The snapshot files sit inside each
surveyed project's own git-tracked `docs/status/`, and each line records that
project's real feature names, roadmap state, and bug counts. The pre-publication
leak audit (2026-07-24; see [inbox](../inbox.md) and
[bug 002](../bugs/002-compass-writer-still-active.md)) confirmed this is not
hypothetical: two surveyed repos have that history committed, and the write path
is still open — the next compass run in any surveyed project appends again. One
project's internal state must not become a committed artifact in that project's
repo as a side effect of running the dashboard — vision
**principle 1** says the dashboard is read-only over other repos, and ADR-0002's
write is the sole exception punched through it. That is the driver, and it stands
on its own regardless of what the history is later used for.

**What the history is for — two claims of different strength.** These are kept
separate deliberately, because only the first is grounded and this ADR decides
only what the first supports.

*Grounded (decided here).* The **latest** entry per project answers "what's
next" — vision feature 3 / UC-3, already shipped and read by
[`scan.mjs`](../../src/scan.mjs). Owner-recorded, 2026-07-24: *"narrative
headlines stay — they are what answers 'what's next'."* And the **existing** 193
entries are worth preserving rather than discarding, because they are
measurably non-recomputable: 175 of 193 (~91 %) are prose headlines, and the
deterministic scanner (principle 2) can recompute a project's *current*
done/total but never its *past*. Preserving what already exists is low-regret
and cheap; discarding it is irreversible.

*Not yet grounded (explicitly deferred).* That a **growing** series is a wanted
product — the *evolution / velocity view* — is a **deferred, unspecced** vision
candidate, not settled ground. Measuring that the narrative *cannot be
regenerated* does not establish that a full time series *is wanted*; those are
different questions. **This ADR therefore does not commit to it**, and nothing
here should be read as authorising the work it would imply. See Open question 2.

**Sequencing (the leak fix is gated on the two writers, nothing else).** Both
in-repo writers stop as one step:

1. **retire the compass skill's append** (it writes nothing at all, per §4 — no
   store or directory need exist for this), and
2. **retarget `scripts/snapshot.mjs`** at the new store. Today it hardcodes
   `path.join(root, 'docs', 'status')` ([snapshot.mjs:63-65](../../scripts/snapshot.mjs))
   — a manual run *is* the leak, so it is not a safe fallback until retargeted.

That pair is the whole gate. It is *not* gated on the migration, nor on its
verification, nor on Open question 4 (the project-key mapping), nor on who writes
narrative prose in future (OQ1), nor on whether a growing series is wanted (OQ2).

Two earlier drafts got this wrong and are recorded so the reasoning is not
re-derived. The first gated retirement on "migration complete and verified" — but
§5 defers the migration behind OQ4 and an unwritten spec, so the highest-priority
leak fix inherited a multi-step blocker for no benefit. The second called the gate
"a `mkdir`" and offered manual `snapshot.mjs` runs as the interim narrative path —
but that path writes into the surveyed repo, i.e. it reproduces the very leak this
ADR exists to close. **Until `snapshot.mjs` is retargeted, no manual snapshot may
be run against a surveyed project.**

The two sides are not symmetric, and an earlier draft of this ADR got this
backwards. Stopping the write forgoes only *future* entries — the existing 193 are
backed up and preserved by §5/§6. Leaving the paths open means the next run appends, and in
two repos *commits*, one project's feature names and roadmap state into another
project's git history, removable afterwards only by a history rewrite. Since the
leak is this ADR's primary driver, any gate on the fix runs the wrong way round.

**What retiring compass's write actually costs — measured, and smaller than
assumed.** Compass writes a *different schema* from `snapshot.mjs` (no `v`, no
`specs`; adds `recommendation`/`counts`), so producers are distinguishable by
shape. On that basis compass produced ~12 of the 193 entries (~6 %); the 153
`source: manual` bulk came from `snapshot.mjs` runs, not compass. An earlier draft
of this ADR inferred the opposite and treated the whole narrative corpus as
compass output — that inference is withdrawn.

So the cost of retiring compass's append is small and bounded: future compass-run
entries only, ~6 % of historical volume, with nothing existing touched and OQ1
able to restore a narrative path later. Set against an active cross-repo leak that
is otherwise removable only by rewriting another project's git history, the
trade is clear.

Removing the in-repo files is a later step again (§6). Nothing is deleted until
the merge verifies.

Two constraints frame the replacement. Vision **principle 6** — private state
never lives in a repo — already forced the user's config out to
`~/.claude/my-dashboard/config.json`; snapshots are the same kind of per-user
state and belong in the same place. And the **development folder is not the data
folder**: `~/Documents/Claude/dashboard` holds source only, so the installed
plugin must write to the user's home data folder, never next to its own code.

### Operational state at the time of writing

- **The twice-daily writer is paused.** Scheduled task `compass-snapshots`
  (cron `0 5,12 * * *`, last fired 2026-07-22T19:02Z) was **disabled on
  2026-07-22** on owner instruction, because it appends *and commits* snapshots
  into each surveyed project's own repo and would keep re-creating the files
  during migration. It is paused, not deleted: the owner's direction is to
  **rebuild an equivalent routine once the skills are clean** so the twice-daily
  cadence — and therefore the time series — resumes.
- **A pre-migration backup exists.** All 23 files (193 entries) were copied to
  `~/.claude/my-dashboard/_migration-backup-2026-07-22/`, one flattened file per
  source path, taken *after* the 19:02 run. This is the safety net for the
  reconciliation and must be retained until the merged history is verified.

## Decision Options Considered

### Option A: Keep ADR-0002 — per-project append-only JSONL inside each repo, written by compass
- **Pros:** already built and shipped (`scan.mjs` reads it, `snapshot.mjs`
  writes it); the time series accumulates.
- **Cons:** every problem above stands — 23 files, per-repo git decisions
  re-litigated each session, worktree forks, and compass keeps writing.

### Option B: Central append-only history, one file per project, still written by compass
- **Pros:** removes repo pollution and worktree forking; keeps the time series.
- **Cons:** compass remains a writer, which the owner explicitly rejected; a
  reporting skill would still need to know the dashboard's private data layout.

### Option C (recommended): Dashboard owns one append-only history per project, in the user's data folder
- **Pros:** satisfies both owner requirements at once — compass writes nothing,
  the dashboard writes everything; one file per project makes add/remove a
  single-file operation; zero bytes land in any surveyed repo, so principle 1
  becomes absolute and principle 6 is applied consistently; **the time series is
  preserved and consolidated**, so work-over-time statistics become possible for
  the first time (today they are scattered across 23 forked files).
- **Cons:** requires a reconciliation step to merge the existing 193 entries;
  requires a new writer to replace compass's write (see Recommended Decision §6).

### Option D: One central file holding all projects
- **Pros:** a single file to back up or track in git.
- **Cons:** rejected against the owner's stated requirement — adding or removing
  a project means rewriting a shared file, and one corrupt write risks every
  project's history at once.

### Option E: Current-state-only snapshot, overwritten on each scan
- **Pros:** trivially small; no growth management.
- **Cons:** **rejected.** It destroys the existing 193 entries — 175 of them
  non-recomputable prose — to save a trivial amount of disk. That is an
  irreversible loss for no benefit, and it is the rejection this ADR's
  grounded half supports. (It would *also* foreclose the evolution view, but
  that view is a deferred candidate, not the reason for rejecting here.)
  Recorded because an earlier draft of this ADR mistakenly proposed it.

## Recommended Decision

Adopt **Option C**.

1. **Location.** One file per project at
   `~/.claude/my-dashboard/snapshots/<project-key>.jsonl`, alongside the existing
   `config.json`. The folder is created by the installed plugin on first use. It
   is the user's own directory, so she may put it under git for backup — but
   nothing in the product requires or assumes that.
2. **Append-only. Never overwritten.** Each new snapshot appends one line.
   Existing lines are never rewritten, reordered, or truncated. The accumulated
   series is the asset; retention is unbounded until an explicit later decision
   says otherwise.
3. **Line schema is inherited unchanged from ADR-0002** (`v`, `ts`, `headline`,
   `next`, `blockers`, `specs`), so existing entries migrate without
   transformation and existing readers keep working. What changes is *where* the
   file lives and *who* writes it — not what a line looks like.
4. **The dashboard plugin is the only writer.** Compass returns to pure
   reporting and writes nothing at all.
5. **The existing history is never discarded; the full merge is a separate,
   later step.** Two things that an earlier draft ran together:

   *Decided now — preservation.* The dated backup of all 23 files / 193 entries is
   retained indefinitely and is never deleted (§6). This is what the measured
   175/193 non-recomputable figure grounds, and what Option E's rejection is about.
   **Caveat: the backup is a 2026-07-22 point-in-time copy, not a live mirror.**
   Any entry appended between then and the writers being retired exists only in the
   in-repo file. As of 2026-07-24 nothing has drifted: the live files and the
   backup match exactly (13/14/13/8/16 entries), last modified 2026-07-22 12:03 —
   no append has occurred since the backup. But preservation is "already achieved"
   only up to the backup date, and the write paths are open, so §6's verification
   set must be a **retirement-time capture**, not the frozen 193.

   *Deferred — reconciliation.* Merging the 23 forked files into one series per
   project (worktree copies folded into their parent, dedup on identical
   `ts` + `headline`, chronological order, `project-g` promoted to its own key) is
   what Consequences calls "the risky step". It **cannot begin until Open question
   4 (the project-key mapping) is settled** by the implementing spec — that mapping
   is the correctness criterion for the fold, and the `ts`+`headline` dedup does
   not catch a mis-keyed merge. Nothing depends on it in the meantime: the new
   store may start empty and accumulate forward, with the backup as the archive of
   record. The dashboard's grounded consumer is the *latest* entry per project,
   which the merge is not needed to serve.

   *Reader behaviour during the interim — read both, prefer the newer.* The reader
   ([scan.mjs:215](../../src/scan.mjs)) reads **both** the new store and the
   project's in-repo file, and surfaces whichever carries the later `ts`. A
   single-source cutover would break either way: switching with the writers leaves
   every card's "what's next" headline — vision feature 3 / UC-3, already shipped —
   blank until the OQ4-deferred merge lands, while deferring the switch entirely
   would freeze the headline at retirement time and make the interim narrative path
   (a retargeted `snapshot.mjs`, §7/OQ1) invisible to the product. Reading both
   costs nothing: it needs no project-key mapping (the reader already keys off the
   on-disk root), and read-only access to the in-repo files leaks nothing — it is
   the *writing* that leaks. The dual read retires once the merge has verified and
   the in-repo files are removed (§6).
6. **Nothing is deleted, ever, until the merge is done and verified.** Removal of
   the in-repo `docs/status/compass-history.jsonl` files is the **last** step —
   after §5's deferred reconciliation, never alongside it — and is gated on: the
   project-key mapping being settled (so "which entry belongs to which project" is
   well-defined), and **every entry in the verification set being accounted for** —
   each either present in the merged output or attributed to a specific dedup
   match. Plus per-project spot-checks and the dashboard reading the new location
   correctly.

   **The verification set is captured at writer-retirement time, not merge time.**
   A second dated backup is taken at the moment the writers are retired, and the
   verification set is that capture unioned with the 2026-07-22 backup. Two reasons
   it cannot be deferred to the merge: the frozen 193 would silently pass a merge
   that dropped anything appended after 2026-07-22; and 128 of the 193 entries live
   in `.claude/worktrees/*` copies, which are pruned when their branches land — an
   entry in a worktree removed between retirement and the (OQ4-deferred, unbounded)
   merge would be gone from the live set and its loss invisible. Retirement is the
   last moment every entry is guaranteed to still exist.

   The merged total will legitimately be *fewer* than the input count, since 17 of
   the 23 files are worktree copies. The backup at
   `~/.claude/my-dashboard/_migration-backup-2026-07-22/` is retained
   indefinitely — its deletion is not authorised by this ADR at all.
   Note the ordering: retiring the write (Sequencing) needs none of this. Deletion
   is the only thing behind this gate.
7. **Writing moves inside the dashboard; how it keeps growing is deferred.**
   What this ADR decides: compass stops writing, and any write that happens is
   the dashboard's. What it does **not** decide: whether an automatic recurring
   writer is rebuilt at all. The paused `compass-snapshots` routine **stays
   paused** — resuming a twice-daily cadence presupposes the growing-series value
   claim this ADR explicitly declines to settle, and it collides with a real
   constraint (Open question 1). Once retargeted (Sequencing), manual
   `snapshot.mjs` runs write to the new store and remain available; until then no
   manual run may target a surveyed project.

   **This deliberately overrides an earlier owner direction** (2026-07-22:
   *"rebuild an equivalent routine once the skills are clean, so the twice-daily
   cadence resumes"*). The pause holds pending OQ2, so the implementing spec should
   not read §7 as contradicting the owner — it is a deferral, and the owner can
   lift it by answering OQ2. The asymmetry in evidentiary standard is intentional:
   *"narrative headlines stay"* grounds keeping what exists (cheap, reversible),
   while rebuilding a recurring writer is new build work resting on an unsettled
   value claim.
8. **ADR-0002 is superseded** once this ADR is accepted.

## Consequences

**Becomes easier:**
- No surveyed repo carries dashboard state. Principle 1 stops needing an
  exception, and the recurring "commit it or ignore it?" question disappears.
- Worktrees stop forking the data — one project, one history, one truth.
- **The evolution view becomes possible.** A single chronological series per
  project is what a velocity / evolution view needs — the *trajectory* of
  done/total over time, which the scanner cannot recompute from current state,
  plus the headline read back as a changelog. The current 23 forked files cannot
  support one; their cadence and sourcing are also uneven (see Open questions 2
  and 4), so the series' quality is a design input, not a given.
- Compass becomes a clean read-only reporter again, with no knowledge of the
  dashboard's storage.
- Per-user state is consistently one folder: config and snapshots together in
  `~/.claude/my-dashboard/`, structurally uncommittable to any project repo.

**Becomes harder:**
- **The reconciliation is the risky step.** Merging 23 forked files means
  deciding what counts as a duplicate across copies that diverged. It must be
  verified against the backup before any source file is touched.
- **Three existing writers must stop writing into surveyed repos** — two retired,
  one retargeted. Probed on 2026-07-22: (a) the **compass plugin skill**
  (`…/marketplaces/local-desktop-app-uploads/compass/skills/compass/SKILL.md`),
  which appends after every briefing — *retired*; (b) this repo's
  `scripts/snapshot.mjs` — *retargeted* at the new store, not retired;
  (c) the **scheduled routine** — now paused, and it **stays paused** (§7);
  whether it is ever rebuilt depends on Open questions 1 and 2. Until (a) is
  changed, any compass run re-creates an in-repo file.
- **Growth needs a rule.** Append-only plus a dashboard that writes on every
  scan would flood the history with near-identical lines. The cadence must be
  deliberate (see Open question 2) — this is the one place where "append
  always" needs a guard, and it is about *write frequency*, never about
  discarding what was written.
- **Rework in this repo.** `scan.mjs` (reader — but see §5's reader-cutover note:
  it moves *last*, not with the writers), `scripts/snapshot.mjs` (writer and its
  `--all --auto` mode), the snapshot tests, and `docs/compass-integration.md` all
  encode ADR-0002 and must change. **`docs/product-vision.md` principle 1** also
  needed amending — its previous wording sanctioned compass's external write as
  the one permitted exception; amended 2026-07-24 to "never writes into a surveyed
  project — no exceptions".
- **The abandoned folder is in scope.** 16 of the 193 entries live under
  `~/Documents/Claude/project-dashboard`, which is no longer a workplace but
  holds real history that belongs to this project's series.

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

**Verified by probe on 2026-07-22** (not assumptions):

- File inventory, entry counts, and git status — `find` + `git ls-files` /
  `git check-ignore` across `~/Documents/Claude`: 6 project-root files (65
  entries) and 17 worktree copies (128 entries), 193 total; one root
  git-ignores its file, the other five commit it.
- Scheduled task `compass-snapshots`: cron `0 5,12 * * *`, last fired
  2026-07-22T19:02:16Z, now `enabled: false`.
- Backup: 23 files / 193 entries copied to
  `~/.claude/my-dashboard/_migration-backup-2026-07-22/` after that run.
- **Entry composition (measured from the backup, 2026-07-24).** The 193 entries
  partition exactly:

  | `source` | count | kind |
  |---|---:|---|
  | `auto` | 18 | recomputable `auto: N/M specs done …` strings |
  | `manual` | 153 | prose headline — writer not distinguishable (see below) |
  | `compass-skill` | 3 | prose headline — **written by compass, self-identified** |
  | *(absent)* | 19 | prose headline, predates the `source` field |
  | **total** | **193** | |

  So **175 of 193 (~91 %) are non-recomputable prose.** This is the figure that
  grounds §5's preserve-don't-discard over a clean start: the 18 auto lines could
  be regenerated, the rest cannot.
- **Producer attribution is measurable after all, via schema shape.** Compass
  appends its *own* schema — `ts`, `project`, `headline`, `recommendation`,
  `blockers`, `counts` — with **no `v` and no `specs`**, per its SKILL.md logging
  section. `snapshot.mjs` writes `v`, `ts`, `headline`, `next`, `specs`, `source`.
  The two are therefore distinguishable by keys, not by the `source` field:

  | producer | count | identified by |
  |---|---:|---|
  | compass skill | 12 | has `recommendation`/`counts`, no `v` (3 of these also stamp `source: "compass-skill"`) |
  | `snapshot.mjs` | 184 | has `"v":1` + `specs` |

  (12 + 184 = 196 > 193 because a few lines carry both markers; the split is
  indicative, not a partition.) **This corrects an earlier inference in this ADR**:
  the 153 `manual` bulk is *not* compass output — `source: 'manual'` is stamped by
  `snapshot.mjs` on any `--headline` run ([snapshot.mjs:56](../../scripts/snapshot.mjs)),
  so those are hand-runs and routine runs. Compass wrote roughly 12 of 193 (~6 %).
- Reader: [`src/scan.mjs:215`](../../src/scan.mjs) reads
  `docs/status/compass-history.jsonl` per project.
- Writer: [`scripts/snapshot.mjs:65`](../../scripts/snapshot.mjs) appends to it.
- Config path precedent: [`src/scan.mjs:31`](../../src/scan.mjs) resolves
  `~/.claude/my-dashboard/config.json`.
- The three writers named in Consequences — each read from its own file on disk.

**Genuine assumptions:**

- That entries across forked worktree copies can be de-duplicated reliably by
  `ts` + `headline`. Not yet tested against the real data; if copies diverged in
  ways that collide, the merge rule needs revisiting before any deletion.
- That the compass plugin's write can be removed — it is a separate plugin under
  the owner's control, but its removal has not been attempted.

## Kill criteria

This decision should be reversed or reshaped if:

- The reconciliation cannot be verified — if merged output cannot be shown to
  account for every entry in §6's verification set (the retirement-time capture
  unioned with the dated backup — *not* the frozen 193), the in-repo files stay
  where they are until it can.
- The compass plugin's snapshot write turns out not to be removable (e.g. it is
  upstream and not hers to change). The cleanup would be permanently undone, and
  a different boundary would be needed.
- A dashboard-written entry proves too thin to be worth appending — if it cannot
  carry the narrative headline that makes an entry readable months later, the
  writer design (not the storage decision) needs rework.

## Open questions

1. **Who produces the narrative prose going forward?** This is a harder question
   than it first appears, and it is the reason §7 defers the writer rebuild.
   **Constraint:** the dashboard is deterministic and makes no LLM calls (vision
   principle 2), so a dashboard-owned writer can emit only the mechanical
   `auto: N/M specs done …` line — the kind that is just 18 of the 193 existing
   entries. It **cannot** author the prose headline that is the other ~91 %.
   That rules option (a) out as a like-for-like replacement, leaving:
   (b) **a compass companion** that records the headline compass just produced —
   preserves narrative fidelity, but couples the two plugins; or
   (c) **accept the asymmetry** — automatic entries are thin `auto:` lines, and
   rich narrative arrives only when a human runs a manual snapshot.
   This question does **not** gate retiring compass's write — see Sequencing in
   Context. The interim narrative path is a *retargeted* `snapshot.mjs` (part of
   the same retirement step); the un-retargeted script writes in-repo and must not
   be used against a surveyed project.
2. **Is a growing time series actually wanted — and at what cadence?** The
   *evolution / velocity view* is a deferred vision candidate, not a committed
   feature, and this ADR does not assume it. Settle whether it is wanted **before**
   building any recurring writer; only then does cadence follow (at most one entry
   per project per day; only on state change; or only on explicit runs). If the
   answer is no, the latest-headline use is already served and the existing 193
   entries simply remain as preserved history.
3. **Does an entry need a `source` field** distinguishing a narrative snapshot
   from an automatic one? ADR-0002's `--auto` mode used one; with a single
   writer it may still be worth keeping for later filtering.
4. **How does a surveyed project map to one stable `<project-key>`?** The reader
   currently keys off the on-disk project root while config identifies projects
   by `path`; the new store keys by `<project-key>`. The implementing spec must
   define that mapping for both the one-time reconciliation — which folds each
   worktree copy into its parent project and promotes the worktree-only project
   to its own key — and the ongoing writer, so histories cannot split or
   cross-contaminate on basename collisions or ambiguous worktree-to-parent
   resolution. The `ts`+`headline` dedup does not catch a mis-keyed merge.

## Amendment (2026-07-24): Open questions 1 and 2 resolved by the owner

Two of the four open questions are settled. The decision body above is unchanged;
this records what the owner answered and what it implies.

**OQ2 — is a growing time series wanted? YES.** The owner wants the
**evolution / velocity view**. This is the claim the ADR deliberately declined to
settle, so answering it changes what follows:

- §7's *"the paused `compass-snapshots` routine stays paused"* is **lifted**, by
  §7's own terms (*"the owner can lift it by answering OQ2"*). A recurring writer
  is back in scope, and the routine is rebuilt against it.
- The growing series is now a committed product goal, not a deferred candidate.
  Cadence — still genuinely open — is the implementing spec's call: at most one
  automatic entry per project per day, or only when the computed state differs
  from the previous entry. Even sampling matters more now, since the series feeds
  a chart.
- §5's deferred reconciliation gains a real consumer: a per-project chart wants
  one continuous history, so the merge is worth doing rather than optional. It
  still waits on OQ4.

**OQ1 — who writes the narrative prose? The dashboard, via its own skill.**
The owner retired the compass write directly (verified 2026-07-24: compass's
SKILL.md now says it *"reports in chat and writes nothing — no files"*), and
directed: *"If we want dashboard to write something, it will have to do it
itself."* Therefore:

- Option **(b)** (a compass companion recording compass's headline) is **dead** —
  there is no compass write to companion, and coupling the plugins was its only
  advantage.
- Option **(a)** — a dashboard-owned snapshot skill — is the answer, and the
  body's stated objection to it needs correcting. OQ1 above says principle 2's
  determinism rules option (a) out because the dashboard "makes no LLM calls".
  That conflates two different things: **vision principle 2 binds the scanner and
  the rendered page** (same disk state → same page), not a skill. A dashboard-owned
  *skill* is Claude-run — exactly how compass composed its headlines — so it can
  author narrative prose without touching the scanner's determinism. The
  scanner/server stays deterministic and LLM-free; the skill is where prose comes
  from.
- Kill criterion 3 (a dashboard-written entry may be "too thin") is therefore
  **less likely to fire** than the body assumed: the thin `auto:` line was only
  forced under the mistaken reading. It stays a kill criterion — a skill that
  produces bland headlines is still a failure — but it is no longer near-certain.

**Still open:** OQ3 (does an entry need a `source` field) and OQ4 (the
project-key mapping — which still gates the §5 reconciliation and, through it,
§6's deletion step).

**Unchanged by this amendment:** nothing is deleted; the existing history is
preserved and migrated, not discarded; §6's verification set is still captured at
writer-retirement time; and the leak fix is still gated only on the two writers
stopping. Half of that has now happened — see
[bug 002](../bugs/002-compass-writer-still-active.md): compass is retired, and
`scripts/snapshot.mjs` is the remaining in-repo writer.
