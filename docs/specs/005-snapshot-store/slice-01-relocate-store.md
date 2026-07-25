---
status: DONE
dependencies: [adr-0004]
last_verified: 2026-07-24
frame_review: true
---

## Slice 005-01 — relocate the snapshot store

**Goal:** a snapshot written today lands in the dashboard-owned store outside
every repo, and the project card still shows the latest headline (UC-3) whether
that headline came from the store or from the project's existing in-repo file.

This closes the remaining half of
[bug 002](../../bugs/002-compass-writer-still-active.md): `scripts/snapshot.mjs`
is the last code path that writes into a surveyed project. (The compass half was
retired by the owner on 2026-07-24.)

### Definition of Ready

- [x] ADR-0004 Accepted — the storage decision is settled, not being re-litigated
- [x] Load-bearing claims probed (see spec `## Assumptions`)
- [x] Bug 002 cross-checked: this slice owns the fix; the bug record points here
      rather than duplicating acceptance criteria
- [x] No dependency on ADR-0004 OQ2/OQ3 (both out of scope here)

### Scope

**In:** the store layout and its path; a worktree-aware project key for the
*writer*; retargeting `scripts/snapshot.mjs`; the reader reading both sources and
preferring the later `ts`; tests.

**Out:** migrating the 193 existing entries (005-02); the full reconciliation
mapping that folds worktree copies into parents (005-02); any narrative-composing
skill or recurring routine (005-03); deleting anything at all.

### Acceptance criteria

**AC1 — the writer never writes inside a surveyed project.**
`scripts/snapshot.mjs` appends to
`~/.claude/my-dashboard/snapshots/<project-key>.jsonl` and creates no
`docs/status/` directory anywhere. Running it against a git repo leaves that
repo's working tree untouched (`git status --porcelain` unchanged).

**AC2 — the store path is overridable and consistent with existing precedent.**
The store root resolves as: `DASHBOARD_SNAPSHOTS` if set, else
`<dirname of resolveConfigPath()>/snapshots/`. Deriving it from the *config
path* — not a second hard-coded `~/.claude/my-dashboard` literal — means a
`DASHBOARD_CONFIG` override (already used by tests and by the owner's
global-vs-worktree config workaround) keeps config and snapshots together
instead of silently splitting them.

**AC3 — the project key is worktree-aware and free of *path* collisions.**
(Not "stable across moves" — see spec assumption A3 for what this key does not
promise, and what 005-02 must add.)
A new exported `projectKey(root)`:
- resolves a linked worktree to its parent repository, so a worktree and its
  parent write to the **same** file — verified by probe that
  `git rev-parse --git-common-dir` yields the parent's `.git` for both;
- yields a key that cannot collide between two different projects that share a
  basename (two `docs` folders in different parents must not merge);
- falls back to a path-derived key for a non-git directory rather than throwing,
  since `scanProject` already tolerates non-git projects;
- is exported and deterministic given disk state, so 005-02 can reuse it **for
  paths that still exist**. It is explicitly *not* a complete migration mapping:
  the key is path-derived, so a project that moved has two keys (spec assumption
  A3). 005-02 must add an alias/rekey step on top rather than folding on this
  function alone.

**AC4 — the reader prefers the genuinely newer entry, by timestamp.**
`scanCompass(root)` reads *both* the store file and the project's in-repo
`docs/status/compass-history.jsonl`, and surfaces whichever candidate has the
later `ts`. Concatenating the two sources is **not** acceptable:
`parseCompassHistory` selects the last valid line in *file order* (probed,
[lib.mjs:164](../../../src/lib.mjs)), so concatenation would make the answer
depend on read order rather than time. Malformed-line warnings from both sources
are summed, so a corrupt line in either is still surfaced.

**AC5 — UC-3 never regresses, including on a project with no store file yet.**
A project whose history exists only in-repo (every project, on day one) still
shows its latest headline, age label and staleness exactly as before. A project
with neither source shows no compass block and emits no warning — the current
behaviour for a missing file.

**AC6 — the leak gate and the existing suite stay green.**
`npm test` passes, including `test/no-leaks.test.mjs`. New tests cover: writer
target (AC1), key resolution for worktree/parent/non-git (AC3), ts-preference
across the two sources including the equal-`ts` and store-older cases (AC4), and
the no-store-yet path (AC5).

### Definition of Done

- [x] All ACs met, tests green (56/56)
- [x] Compliance + craft review passed and recorded
- [x] Frame-critique passed and recorded (`frame_review: true`)
- [x] Deviation log written
- [x] Reconciliation sweep written
- [x] `docs/architecture.md` updated — the store is a new module boundary and a
      new persistent location
- [x] `docs/compass-integration.md` reconciled — rewritten; it previously told the
      reader to make compass write into surveyed projects
- [x] Bug 002 updated: remaining half closed, status moved to REVIEWED
- [x] Status board regenerated

### Notes

**Why the reader still reads the in-repo file.** ADR-0004 §5's reader note: a
single-source cutover breaks either way. Switching the reader with the writer
blanks every card until 005-02 migrates; deferring the switch entirely freezes
every headline at retirement time and makes new writes invisible. Reading both
and preferring the later `ts` avoids both, costs one file read, and needs no
project-key mapping on the read path. The dual read retires once 005-02 has
migrated and verified and the in-repo files are removed.

**Why the writer needs a key now.** ADR-0004 defers the full project-key mapping
to OQ4, but a writer cannot write without *some* key. This slice settles the
writer-side key only, and exports it so 005-02's migration reuses it. The
worktree-awareness is not optional even here: ADR-0004's problem #2 is that
worktrees fork the history, so a naive per-directory key would recreate the
fragmentation inside the new store on day one.

### Deviation log (after reconciliation)

These are the decisions made during implementation that the criteria did not
specify. **AC3 was amended in place** (item 1) rather than preserved — the
original wording made a promise the design cannot keep, and leaving it standing
would have misled 005-02. Every other criterion is unchanged.

1. **AC3 was narrowed mid-slice, on frame-critique evidence.** It originally said
   "worktree-aware and collision-free" and claimed `projectKey` would serve as
   005-02's migration mapping. The frame-critique showed the key is
   `sha256(realpath(repo root))`, so a *moved* project gets a new key — and
   ADR-0004 itself records 16 entries under this project's old path. AC3 now
   promises freedom from *path* collisions only, spec assumption **A3** records
   the limitation, and 005-02 is required to add an alias/rekey step. Nothing
   was weakened to fit the implementation; the claim was corrected to the truth.
2. **Two identity guards were added to `repoRootOf`, both beyond what AC3 named.**
   AC3 asked only for worktree folding and basename collisions.
   *(a) A sub-directory of a repo keeps its own key.* Without this, any project
   configured below another repo — including this repo's own test fixtures —
   inherits that repo's key, and two configured projects silently merge. Caught
   as a round-2 compliance defect.
   *(b) Submodules are not folded into their superproject.* Probe-confirmed against real submodules: `--git-common-dir`
   returns `<super>/.git/modules/<name>`, whose dirname is shared by *every*
   submodule, so folding on it merged unrelated projects. `repoRootOf` now only
   folds when the resolved common dir is literally named `.git`. Both guards have
   regression tests, and both are inputs to ADR-0004 OQ4 alongside A3.
3. **Equal-`ts` ties resolve to the store.** AC4 says "whichever has the later
   `ts`" and is silent on ties. The store is the canonical source and the in-repo
   copy is being retired, so the store wins. Tested at unit and integration level.
4. **`<project-key>` format settled here:** `<sanitised-basename>-<sha256(realpath)[0:8]>`,
   with `project` as the fallback for an empty basename. ADR-0004 §1 specified
   only `<project-key>.jsonl`. 005-02 must map onto this exact shape.
5. **`projectKey` memoizes per root with no invalidation.** Justified by A2 (it
   spawns `git rev-parse`, and the server re-scans per request). Consequence not
   anticipated by A2: within a long-lived server, a root that later *becomes* a
   repo keeps its earlier key until restart. Acceptable for a writer key; flagged
   for 005-02.
6. **The malformed-line warning text changed** from `compass-history.jsonl: N
   malformed…` to `compass history (N source(s)): N malformed…`. Unavoidable once
   two sources are summed — naming one filename would have sent a user chasing a
   corrupt line in the wrong file. Not covered by any AC.
7. **Writer I/O now returns a structured error instead of throwing.** The store is
   one shared directory (the old target was per-project), so an unhandled
   `EACCES`/`ENOTDIR` would have aborted every remaining project in an `--all`
   run. Regression test asserts a handled error, not a stack trace.
8. **`test/snapshot.test.mjs` was repointed, not rewritten.** Its behaviours
   (schema, append-only, auto mode, refuse-and-write-nothing) are unchanged by
   ADR-0004; only the location moved.

**A defect this slice caused and fixed:** an early run of the retargeted writer,
before test isolation was added, appended two entries into the owner's real store
at `~/.claude/my-dashboard/snapshots/`. The file was identified by its temp-dir
key and literal test headlines, and moved out of the store (not deleted) to the
session scratchpad. Every suite that touches `scanProject` now pins
`DASHBOARD_SNAPSHOTS` to a temp directory.

### Reconciliation sweep

| Surface | Disposition |
|---|---|
| `docs/architecture.md` | **updated** — the ADR-0002 "compass snapshot contract" section replaced by the ADR-0004 snapshot store (location, key rules, migration-window dual read); module-boundary entry and file-tree comment for `snapshot.mjs` corrected; durable-state and contract-surface entries repointed. |
| `docs/compass-integration.md` | **updated** — rewritten. It previously instructed the reader to teach compass to append into each surveyed project, i.e. to recreate the leak. Now opens with an explicit "do not do that", documents the store, the key rules and the migration window. |
| `CLAUDE.md` | **updated** — the always-loaded primer said "compass snapshot contract ADR-0002" and carried a pending action to *add* the snapshot write to the compass skill. That would have restored bug 002. Repointed to ADR-0004 and replaced with an explicit do-not-re-add warning. |
| `README.md` | **updated** — "Last compass" section repointed from `docs/status/compass-history.jsonl` / ADR-0002 to the store / ADR-0004. |
| `skills/open/SKILL.md` | **updated** — shipped plugin prose claimed the tool appends "to every configured project". Corrected; this text reaches installed users. |
| `docs/bugs/002-*` + board | **updated** — second half closed, status `FIXING → REVIEWED`, regression test named, obsolete "do not run a manual snapshot" warning removed. |
| `docs/inbox.md` | **updated** — leak-audit finding (a) marked closed; the "still open" list corrected. |
| `docs/specs/003-sessions-panel/slice-03-pr-badges.md` | **updated (guard only)** — that DEFERRED slice still proposes writing a `docs/status/` file inside a surveyed project. Body preserved; a dated note records that ADR-0004 and the amended principle 1 bar that option, so un-deferring cannot silently resurrect the leak. |
| `docs/decisions/adr-0002-*` | **no-op** — already `Superseded` by ADR-0004; records are not edited. |
| `docs/product-vision.md` | **no-op** — principle 1 was already amended when ADR-0004 was accepted. |
| `docs/conventions.md` | **no-op** — no new convention introduced. |
| `.gitignore` `/docs/status/` | **deferred** — this repo no longer writes there, so the rule is now belt-and-braces. Harmless; removing it is a judgement call for 005-02 when the in-repo files are retired. |
| `docs/specs/README.md` (status board) | **updated** — its Notes for 002-03 still said "contract = ADR-0002; compass-skill wiring pending on the user's side", the same leak-restoring instruction scrubbed from CLAUDE.md. Repointed to ADR-0004 with an explicit do-not-wire note; board regenerated. |
| `docs/product-vision.md` | **updated** — principle 1 was already amended when ADR-0004 was accepted, but the Stack section still cited ADR-0002 as the live snapshot-schema contract. Repointed. |
| `docs/memory/*` | **no-op** — no new domain term; the store contract lives in the ADR and architecture doc. |
| Lightweight decisions | **no-op** — the settled calls here are load-bearing and recorded in this deviation log, not UI/string choices. |
