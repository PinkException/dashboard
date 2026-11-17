---
status: DONE
dependencies: []
last_verified: 2026-11-16
arch_review: true
frame_review: true
---

<!-- jig self-defining vocabulary (soft, forward-only). -->
<!-- jig grounding (spec 064-02 / ADR-0020): probe runnable-surface claims. -->

## Slice 012-01 — roadmap tab with automatic order

**Goal:** Open any project's detail view, click a new **roadmap** tab, and see
the road ahead in the automatic order: a sequence strip, the current release's
slices, and one group per unfinished spec with a card per slice (ID, name,
status chip, "depends on …"); DONE specs folded under "show N done".

**DoR:**
- ✅ Spec 012 decisions recorded (spec.md "Owner decisions").
- ✅ Detail-view tab bar exists (`public/render.mjs:537-538`).

**Acceptance Criteria:**

1. **Tab.** The detail view's tab bar reads `overview | roadmap | activity`;
   clicking `roadmap` shows the roadmap content and hides the overview
   content; switching back restores the overview; the open tab survives the
   `/api/prs` fold-in (same rule spec 010 set for the active tab).
2. **Slice names.** The scanner adds `name` to each slice record, read from
   the slice file's `## Slice NNN-NN — <name>` heading; when absent, `name`
   falls back to the filename stem (A1). The `/api/data` change is additive.
3. **Automatic order.** A pure function in `src/lib.mjs` (scanner-side, per
   ADR-0001 — the page does no derivation) returns the spec and slice order
   defined in spec.md "Automatic order (layer 1)", including the
   definitions (slice, unfinished, tier), in-spec dependency order and the
   cycle fallback. The scanner supplies each spec's recency (git commit
   timestamp of its directory, mtime fallback) as an input, so the function
   stays pure. `currentReleaseTrack` moves from `public/render.mjs` into
   `src/lib.mjs`; the scanner emits its result and both the overview and the
   roadmap read that one value (no second copy of the rule). Covered by
   fixture tests for each rule (release-first, tier, recency, number
   tie-break, status-less `slice-*.md` ignored, spec with no slices,
   cross-spec / `adr-*` dependencies, dependency order, cycle).
4. **Sequence strip.** Up to four steps: the first = the current release (or
   the first ordered spec when no release), the next two = the next two
   ordered specs, the last = "N parked" when any slice is DEFERRED. The first
   step reads "Now · We are here" only under spec.md's "We are here" rule,
   otherwise "Next up". Fewer steps render when fewer exist.
5. **Release block.** When a current release exists, a block lists its Include
   slices with chips, under "In front of it — <release title>".
6. **Spec groups.** One group per unfinished spec in order; each slice card
   shows ID, name, chip (spec.md "Status chips"), and "Depends on <ids>"
   listing every declared dependency (same-spec, cross-spec and `adr-*`). DEFERRED slices are excluded here (they
   land in Parked, slice 02); ABANDONED slices are not shown.
7. **Done fold.** DONE specs render inside a native `<details>` with summary
   "show N done", closed by default.
8. **Empty states.** A project with no specs shows one honest line ("No specs
   yet") instead of an empty frame; a project with only DONE specs shows
   "Nothing planned" above the fold.
9. **Look.** Reuses the dashboard's existing CSS tokens (no palette
   import); the four chips are visually distinct in light and dark mode;
   cards wrap to one column at phone width with no horizontal scroll.
   Attest-by-eyeball at review (low-stakes polish; no `design_review` gate).
10. **"As of main" label and worktree hint** (spec.md decision 7, A6). The
    tab header reads "as of main" (the root's current branch name when it is
    not `main`), plus a worktree hint computed as follows (no worktree status
    feeds the order):
    - **Worktrees considered:** every `git worktree list` entry except the
      root, read **from disk** (uncommitted edits count). No merged-branch
      skip: a fresh worktree at the root's HEAD lists as "merged" while
      holding live uncommitted work, and the strict rank below already keeps
      stale worktrees' older statuses out of N. Residual: a stale worktree's
      slices that were renamed or deleted on main may still count.
    - **Progress rank:** DRAFT < READY_FOR_REVIEW < READY_FOR_IMPLEMENTATION
      < IN_PROGRESS < REVIEWED < RECONCILED < DONE. DEFERRED and ABANDONED
      never count as "further along".
    - **"N slices further along in worktrees":** slices whose highest
      worktree status (across all considered worktrees, each slice counted
      once) ranks strictly above the root's; plus slices that exist only in
      worktrees **inside a spec folder the root has**.
    - **"M specs only in worktrees":** spec folders absent from the root,
      reported separately (a renamed folder lands here, not in N).
    - No cap on either count. Both zero → no hint.
    - Fixtures include: a worktree at the root's HEAD with an uncommitted
      IN_PROGRESS slice → N ≥ 1; a stale worktree holding DRAFT where the
      root has DONE → not counted.
    - This is a **new content read** of worktree slice frontmatter — a
      deliberate widening beyond 002-02 AC4's path-only worktree rule.
      `scanWorktreeOnlyDocs` (path-only, `.claude/worktrees` only, capped at
      40) is left unchanged; the hint uses its own enumeration. Its cost
      counts toward AC11's budget.
11. **Scan cost.** Recency for all specs of a project comes from **one** git
    call per repo (e.g. a single `git log --format=%ct --name-only --
    docs/specs` pass mapped to spec directories), not one call per spec.
    The disk-only `/api/data` scan (ADR-0007) over the configured projects
    grows by no more than 10% versus before this slice (measure before and
    after; record both numbers in the deviation log). An overrun is
    recorded and raised with the owner, never hidden.

**DoD:**
- [x] All ACs pass; full test suite green (no regressions).
- [x] Implementer test coverage exercises each AC with at least one
      fixture. Edge cases listed in the slice are covered explicitly.
- [x] Each new test has been shown to fail when its feature is removed —
      the test is capable of failing, not vacuously green (mutate the
      feature, watch the test go red, restore).
- [x] Reviewed by `reviewer` subagent. Reviewer prompt built by
      `review.py`.
- [x] Implementation review passed.
- [x] Deviation log produced under this slice heading.
- [x] Reconciliation sweep produced under this slice heading.
- [x] Reconciliation review passed.
- [x] `docs/refinement-todo.md` updated if any decisions were
      deferred during implementation.

### Close-out (post-DONE)

These items can only be ticked AFTER the final `RECONCILED → DONE`
transition. Slice-land's `check_dod` (slice 009-01) excludes them
from the count.

- [x] `docs/specs/README.md` regenerated by `workflow.py status-board`.
      Notes column receives any load-bearing per-slice invariant
      (it's preserved across regen).
- [x] Primer hygiene per spec 025-01 rule: **if this slice closes the
      spec** (all non-deferred slices DONE), check `CLAUDE.md`,
      `AGENTS.md`, and scaffold templates when present, then **compress**
      the spec's Active-specs entry — drop facts derivable from the
      spec dir + status board, migrate load-bearing per-slice
      invariants to the status board Notes column, keep at most a
      one-liner only for cross-cutting facts. If the spec is still
      in flight (other slices DRAFT / READY / IN_PROGRESS), leave
      the entry. If this slice introduces a new skill, add or
      update its row in the Skills table.

**Anti-horizontal-phasing check:** after this slice the owner opens any
project and sees its ordered roadmap — useful with zero setup and no skill.

### Deviation log (after reconciliation)

The original spec is preserved above. Implementation notes:

1. **AC11 scan cost: within budget, measured twice.** Method: `scanAll(config, { gh: disabled })`, the `/api/data` path, over the 8 configured projects. Original code (a `git archive` of the pre-slice HEAD) and new code alternated in one process, 15 runs each after warm-up, medians compared.
   - First build (straightforward version): **+28–30%**, over budget. Each git spawn costs ~19 ms on this machine. Not hidden; three changes brought it back (items 2–4).
   - Final build, unloaded machine: **1142–1210 ms → 1223–1237 ms, +2.2% and +2.3%** across two runs.
   - After review fixes: loaded machine **2443 → 2550 ms (+4.4%)**; quieter re-run **1352 → 1319 ms (−2.4%)**. All under +10%.
2. **`gitInfo` refactor (outside the slice's named surface).** Its three git spawns (`rev-list --count`, `log -1`, `log --reverse`) fold into one `git log --format=%cs`, to pay for the new recency call. Behaviour-preserving: output matched the old code on all 8 real projects, and a regression test guards count and first/last dates.
3. **Worktree enumeration reads git's on-disk layout.** `.git/HEAD` + `.git/worktrees/*/gitdir` are read without spawning git; relative `gitdir` pointers (`worktree.useRelativePaths`) resolve against the worktree's admin dir (round-1 craft nit, fixed + tested). Falls back to one `git worktree list --porcelain` when the root's `.git` is a file or any read fails. This couples the fast path to git internals behind the porcelain fallback.
4. **Worktree slice reads are frontmatter-only** (first 2 KB, whole-file fallback when the closing `---` is not within it), since only `status:` is needed. A spec folder that becomes unreadable mid-scan is skipped, not fatal (round-2 craft nit, fixed + tested).
5. **Recency uses `--relative` (and `--no-renames`, so a renamed spec folder's recency starts at the rename).** Round-1 craft **blocker**: `git log --name-only` prints repo-top-relative paths, so a project in a repo subdirectory silently fell back to mtime. Fixed; the subdirectory fixture now asserts a commit-time recency (red → green witnessed).
6. **mtime fallback also covers specs with no commit yet** (a new, uncommitted spec), not only "git unavailable". Such a spec ranks as recent, which matches intent; commit times and mtimes can mix in one sort.
7. **Sequence strip reading (AC4) — owner decision 2026-11-16.** "The next two ordered specs" after a release step now skip specs the release already covers, and steps 2–3 read "Then" on both paths (the first build repeated the release's spec and used "Next" after a release). Round-2 craft `[spec]` blocker; recorded in `docs/decisions/lightweight-decisions.md`. A shorter strip renders when fewer specs remain.
8. **`currentReleaseTrack` emission shape.** The rule lives in `src/lib.mjs`; the scanner emits `currentReleasePath` (a path), and `public/render.mjs`'s `currentReleaseTrack(p)` is now a lookup by that path. Release workstreams gain `includeTokens` (additive) so the roadmap can list Include slices; a token with no slice file shows as "Planned".
9. **Open tab is app state.** `state.tab`, applied by re-render through `detailView`, replaces the click-handler DOM flips and 010's capture/restore in `loadPrs`. The `/api/prs` fold-in, the auto-refresh and the "show all specs" toggle all keep the open tab; opening another project starts on overview. Resolves inbox items (a)/(b) of the 010-01 glue nits. The activity tab keeps its `disabled` placeholder style (dropped in the first build, restored in round 1).
10. **Interpretations not spelled out in the ACs.**
    - `asOf` is null for a detached HEAD, a non-git root, or a project in a repo subdirectory; the header reads "as of the working tree".
    - A project in a repo subdirectory gets **no worktree hint** (the enclosing repo's worktrees are not its own) — a deliberate narrowing of AC10.
    - DEFERRED/ABANDONED slices that exist only in a worktree do not count toward N ("never further along").
    - An ABANDONED spec, or one whose slices are all ABANDONED, is not shown; a spec whose only slices are DEFERRED counts as finished and folds under "show N done" (as an empty group until slice 02's Parked section).
11. **Cost not covered by AC11.** The phase-two `/api/prs` full `scanAll` also pays the recency call, worktree reads and roadmap derivation, which it does not need. Noted on the existing scan-caching inbox item.
12. **Known weak tests.** The "tab survives the `/api/prs` fold-in" guarantee holds by construction, but its tests are a pure-render check plus a regex over `index.html`; the page glue has no DOM harness (consistent with the repo's boundary).
13. **AC9 attested by eyeball (2026-11-16, in-app browser, real config):** dark and light mode render the four chips distinctly; at 375 px the roadmap cards wrap to one column; "show N done" is closed by default; the roadmap tab stays open after `/api/prs` lands. The page's sideways scroll at 375 px comes from the pre-existing header progress readout, not this slice — parked under the new "Phone layout" inbox heading (owner: desktop only for now).
14. **`scanProject` test seam.** `scanProject(projectCfg, gh, { onGit } = {})` gains an optional third argument, a git-spawn observer used only by the AC11 "one recency call per project" test. Additive; existing callers pass two arguments and are unaffected.
15. **Review history.** Compliance pass and arch pass on the first build; craft needs-changes (round 1: recency blocker), needs-changes (round 2: AC4 `[spec]` blocker → owner decision), pass (round 3). Remaining craft/arch nits parked in `docs/inbox.md` ("Small roadmap nits parked from 012-01").

### Reconciliation sweep

Record the drift-prone surfaces checked during reconciliation. The transition
gate only requires this subsection to exist; the reconciliation reviewer judges
whether coverage and rationales are honest.

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | The front door documents install and first run, not the detail view's tabs; checked, nothing describes the overview/activity tab set. |
| `docs/specs/README.md` | `updated` | Regenerated by `workflow.py status-board` at the RECONCILED → DONE transition (close-out); `check-board` clean. |
| `docs/specs/012-project-roadmap-tab/spec.md` + slices 02–04 | `no-op` | Checked: spec.md defines the first step's label rule but no rule for steps 2–3, so the owner's AC4 reading lives in lightweight-decisions (linked from deviation item 7) without contradicting spec.md. Slices 02–04 untouched; slice 02's "N parked" step is unchanged. |
| `docs/product-vision.md` | `no-op` | Checked: the roadmap tab serves the existing "where is every project and what's next" vision; no scope or principle change. |
| `docs/architecture.md` | `updated` | Module boundaries: `src/lib.mjs` roadmap derivations + `currentReleaseTrack` moved in; `src/scan.mjs` recency call, `gitInfo` fold, worktree frontmatter read + `.git` fast path; `public/index.html` tab-as-state; `public/render.mjs` lookup + `roadmapTabHtml`. Contract surfaces: additive `/api/data` fields listed. |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `updated` | `CLAUDE.md` Active specs gains an in-flight line for spec 012 (slice does not close the spec, so no compression). No `AGENTS.md`; no scaffold templates touched. |
| `docs/inbox.md` | `updated` | 010-01 glue nits (a)/(b) marked resolved; scan-caching item notes the new phase-two cost; new item for parked 012-01 craft nits; new "Phone layout" future-spec heading (owner, 2026-11-16). |
| `docs/refinement-todo.md` | `no-op` | No decision deferred during implementation; the one open reading (AC4) was settled by the owner and recorded as a lightweight decision. |
| `docs/memory/**` | `updated` | `/jig:memory-sync`: glossary gains "Roadmap tab", "Automatic order", "Sequence strip", "Worktree hint". |
| `docs/decisions/README.md` / ADR index | `no-op` | No ADR touched. One lightweight decision added (sequence strip reading), which is not an ADR-index entry. |
| Additional live prose / generated templates touched by this slice | `no-op` | None beyond the files above. The review tool's `reviews/.candidates/*.json` sidecars are scratch output, left untracked (no other spec commits them). |
