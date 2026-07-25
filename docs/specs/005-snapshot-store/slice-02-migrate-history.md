---
status: DRAFT
dependencies: [005-01, adr-0004]
last_verified: 2026-07-24
frame_review: true
---

## Slice 005-02 — migrate the existing history

**Goal:** every snapshot entry that exists anywhere on this machine ends up in
exactly one dashboard-owned history file per project, in time order, with a
written account of where each entry came from — and nothing is deleted.

This settles [ADR-0004](../../decisions/adr-0004-dashboard-owned-snapshots.md)
Open question 4 (the project-key mapping) and performs the §5 reconciliation.
It does **not** perform §6's deletion step: that stays a separate, later,
explicitly approved decision.

### Definition of Ready

- [x] ADR-0004 Accepted; 005-01 DONE — the store, `projectKey` and the dual read
      all exist and are tested
- [x] **OQ4 answered by the owner (2026-07-24): identity comes from an explicit,
      owner-confirmed alias list**, not from a derived identifier. See Notes —
      "Why not a derived identifier".
- [x] Load-bearing claims probed 2026-07-24 (see `### Probe results`)
- [x] ADR-0004's one untested merge assumption (`ts` + `headline` dedup) now
      tested against the real data — see Probe results, finding 4

### Scope

**In:** the retirement-time capture ADR-0004 §6 requires; the alias list and
where it lives; a migration tool that folds worktree copies into their parent
project, de-duplicates, orders by time and writes one file per project into the
store; the accounting report; tests.

**Out:** deleting or editing any in-repo `docs/status/compass-history.jsonl`
(ADR-0004 §6, later and separate); retiring the reader's dual read (same gate);
the narrative writer and the recurring routine (005-03); any change to the line
schema.

### Assumptions

- **A1 — the alias list is complete.** *Unverifiable by code, by construction.*
  Only the owner knows that a folder which no longer exists as a workplace is
  the same project as one that does. If a pairing is missed, that project's
  history splits into two files silently, and ADR-0004 §6's "every entry
  accounted for" check cannot catch it — every entry is still present
  *somewhere*. Mitigated by AC5: the report prints one line per resulting
  project file with its entry count and its source paths, so a split shows up as
  two rows the owner can recognise, and by the migration refusing to run when a
  source path resolves to a project the alias list has never seen.
- **A2 — nothing appends between the capture and the merge.** *Probed, with a
  residual risk.* Both writers were retired on 2026-07-24 and the newest entry
  anywhere on disk predates that retirement (Probe results, finding 5). The
  residual risk is a stale process holding an older copy of the retired skill.
  Mitigated by AC1: the capture is re-taken and compared immediately before the
  merge writes anything, and a difference aborts rather than merges.
- **A3 — the search root finds every history file.** *Unverified,
  load-bearing.* The probe walked one directory tree (`~/Documents/Claude`). A
  project kept outside it would be invisible, and its entries would be missing
  from the verification set without anything reporting a gap. The dashboard's
  own configured project list would be the authoritative root, but the owner has
  no `~/.claude/my-dashboard/config.json` yet, so it cannot be used. Mitigated
  by AC1: the report records the exact search root(s) used, so the claim is
  visible and can be re-run with a wider root rather than silently assumed.

### Probe results (2026-07-24)

These are measured, not assumed. The numbers matter because they change how
risky the merge is.

1. **The live set has drifted well past the 2026-07-22 backup.** 25 real history
   files on disk today (plus 9 of this repo's own test fixtures, excluded)
   against 23 in the backup, and the live files hold more entries. ADR-0004 §5's
   note that "nothing has drifted" checked five project-root files only; those
   five do still match, but every other category has moved.
2. **One backed-up worktree copy is already gone from disk** — exactly the
   pruning ADR-0004 §6 predicted when it insisted the verification set be a
   union rather than a snapshot. That file survives only because the 2026-07-22
   backup exists. **But it cost nothing:** measured against the capture taken on
   2026-07-24, the backup contributes **zero** entries that are not also live
   (66 distinct in the backup, 68 in the capture, 68 in the union). Every line in
   the pruned copy was a duplicate of its parent's. So the union is still the
   right rule — it is what makes that statement checkable rather than hoped — but
   the pruning risk has not yet destroyed a unique entry.
3. **The real corpus is far smaller than the file count suggests: 68 distinct
   entries across 7 projects.** Reading the backup and the live set together
   gives 451 lines, 0 malformed, collapsing to 68 once exact duplicates are
   removed. Per project: 16, 14, 13, 13, 8, 2, 2. No entry is claimed by more
   than one project.
4. **ADR-0004's untested dedup assumption holds.** De-duplicating on `ts` +
   `headline` and de-duplicating on full content give the *same* 68 entries —
   there is not one case where two entries share a timestamp and headline but
   differ in body. The weaker rule is safe here; the migration still uses the
   stricter one and refuses if that ever stops being true (AC4).
5. **No entry was written after the writers were retired.** The newest entry
   anywhere on disk predates the retirement of the compass write by roughly five
   hours. The leak closed by 005-01 has stayed closed.
6. **This project's own history is entirely under its old folder name** — 16
   entries there, none under the current one. Without an alias, migrating would
   leave this project with an empty history and a 16-entry orphan.

### Acceptance criteria

**AC1 — the verification set is a union, captured before anything is merged.**
A second dated capture is taken of every history file on disk, written to
`~/.claude/my-dashboard/_migration-capture-<date>/` in the same
one-flattened-file-per-source-path shape as the existing backup. The
verification set is that capture unioned with
`_migration-backup-2026-07-22/`. The capture is re-taken and compared
immediately before the merge writes anything; any difference aborts the run
instead of merging. The report records the search root(s) used (assumption A3).

**AC2 — project identity comes from an owner-confirmed alias list, stored
outside every repo.**
The list lives at `~/.claude/my-dashboard/snapshot-aliases.json`, next to the
store — not in this repo. Two reasons, both binding: it names real projects and
this repo ships publicly (the leak gate would reject it anyway), and vision
principle 6 keeps per-user state out of repos. Each entry pairs an old location
with the project it is today, plus a short reason and the date the owner
confirmed it. **Written 2026-07-25 with the one entry it needs** — this
project's pre-rename folder — confirmed by the owner on content rather than on
the folder name (all 16 entries name this project's own specs and its port; the
post-rename folder has no history of its own). The evidence is recorded in
ADR-0004's OQ4 amendment.
A source path that resolves to a project not covered by the list and not present
on disk stops the run with a message naming the path, rather than guessing.

**AC3 — worktree copies fold into their parent project.**
Every copy under a project's `.claude/worktrees/*` merges into that project's
single file, reusing 005-01's `repoRootOf` / `projectKey` (including its
sub-directory and submodule guards). A project that exists *only* as a worktree
copy is promoted to its own file under its parent project's key. A copy whose
worktree has since been pruned — finding 2 — folds to the parent by the same
rule, so it is recovered rather than lost. Reconstructing a source path from a
flattened backup filename is verified against disk, and an ambiguous
reconstruction stops the run.

**AC4 — the merge is exact, ordered, and refuses on ambiguity.**
Entries are de-duplicated on full canonical content (all keys, order-independent);
survivors are written in ascending `ts` order, one JSON object per line, schema
unchanged from ADR-0004 §3. If two entries share `ts` + `headline` but differ in
content, the run stops and lists them rather than choosing — finding 4 says this
does not happen today, and the criterion exists so a silent change is caught.
Writing is atomic per project (write a temporary file, then move it into place),
so an interrupted run never leaves a half-written history.

**AC5 — every entry is accounted for, in writing.**
The run produces a report at
`~/.claude/my-dashboard/_migration-report-<date>.md` stating: total entries in
the verification set; total written; and, for every entry not written, the
specific entry it duplicates. One line per resulting project file with its entry
count and the source paths it was built from. The counts must reconcile
exactly — inputs = written + accounted-for duplicates — and the run fails if
they do not.

**AC6 — nothing is deleted, and nothing is written without a preview first.**
The tool's default mode is a dry run that produces the full report and writes no
history file. Writing requires an explicit flag. No in-repo
`docs/status/compass-history.jsonl` is read-modified, moved or removed by this
slice, and neither backup directory is touched. Re-running the tool after a
successful run is safe: it recognises entries already in the store and adds
nothing.

**AC7 — the dashboard shows the migrated history, and the suite stays green.**
After the merge, each project card's latest headline (UC-3) comes from the store
and is the same headline as before the merge, or a later one. A project with no
entries at all still renders as it does today. `npm test` passes, including
`test/no-leaks.test.mjs`. New tests cover: fold-to-parent and the promoted
worktree-only project (AC3), alias resolution including the unknown-project
refusal (AC2), dedup and the differing-content refusal (AC4), the accounting
arithmetic (AC5), and re-run safety (AC6).

### Definition of Done

- [ ] All ACs met, tests green
- [ ] Compliance + craft review passed and recorded
- [ ] Frame-critique passed and recorded (`frame_review: true`)
- [ ] Deviation log written
- [ ] Reconciliation sweep written
- [ ] ADR-0004 amended: OQ4 recorded as resolved, with the alias-list answer and
      the reason a derived identifier was rejected
- [ ] `docs/architecture.md` updated — the alias list is a new persistent file
      with a contract
- [ ] Spec 005 `## Assumptions` A3 updated to point at the settled answer
- [ ] Status board regenerated

### Notes

**Why not a derived identifier.** The obvious alternative to a hand-written list
is to derive a project's identity from something inside the repository — the
first commit is the usual choice, since it survives moves and renames. It was
checked against the case that actually matters and it does not work: this
project's history was rewritten on 2026-07-24 before publication, so the old
folder and the current one now have different first commits. The one pairing the
migration needs is precisely the one the derived identifier gets wrong, and it
would get it wrong *silently* — two different values look exactly like two
different projects. A hybrid (derive where possible, list for exceptions) was
also rejected: it needs the list anyway, and it obscures which merges the owner
confirmed and which the tool inferred. The list is small — one entry — and it is
a readable record of why entries were merged.

**Why the capture was taken first — and what it found.** ADR-0004 §6 requires
the verification set to be captured at writer-retirement time, because that is
the last moment every entry is guaranteed to exist. Retirement happened on
2026-07-24 and the capture had not been taken; worktrees are pruned continuously
(finding 2), so this was the one part of the slice that got more expensive with
delay.

**Taken 2026-07-24, on owner approval, ahead of the rest of the slice:**
`~/.claude/my-dashboard/_migration-capture-2026-07-24/` — 25 files, 258 lines,
0 malformed, 68 distinct entries, with a `MANIFEST.md` recording the search root,
the per-file counts and the union arithmetic. Copies only; no source file was
read-modified, moved or removed. The verification set now exists, so AC1's
remaining obligation is the re-capture-and-compare immediately before the merge
writes anything — not the capture itself.

**Why this is a vertical slice, not a data-only step.** It ends at the project
card: after the merge, the headline that answers "what's next" is served from
the consolidated store rather than from a file inside the surveyed project, and
this project's card gains the 16 entries currently stranded under its old folder
name. The dual read stays in place, so the change is safe in both directions.

**What this slice deliberately leaves open.** ADR-0004 OQ3 (whether an entry
needs a `source` field) is untouched — the schema is inherited unchanged. §6's
deletion of the in-repo files remains gated on this merge verifying *and* an
explicit approval that this slice does not seek.
