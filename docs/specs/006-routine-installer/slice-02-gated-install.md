---
status: RECONCILED
dependencies: [006-01]
last_verified: 2026-08-04
frame_review: true
claimed_by: claude/006-02-jig-full-ceremony-5bb234
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first, else mark them as assumptions in the spec's
     `## Assumptions` section. -->

## Slice 006-02 — the owner-gated install path

**Goal:** a gated `install` command writes the version-controlled routine out to
the live scheduler — under an explicit per-run owner approval, with hand-edit
protection and byte-for-byte read-back — so the 005-04 routine finally lands from
a sanctioned path and `check` reports clean.

**DoR:**
- ✅ 006-01 DONE — the version-controlled source, the ADR, and the read-only
  `check` command exist.

**Acceptance Criteria:**

1. **Writes require an explicit per-run approval flag.**
   `node tools/install-routine.mjs install` refuses without `--approved-by-owner`:
   it writes nothing and exits with a distinct "not approved" code. The gate is a
   deliberate friction enforced in code — nothing installs incidentally (from a
   `check`, a scan, or any unflagged run); every write demands the flag, every run,
   not just the first. **What the code enforces is the presence of the explicit
   approval signal, not proof of the owner's identity.** A CLI flag is set by
   whoever composes the command (in this environment, often the agent, not the
   owner directly), so that the flag reflects the owner's real go-ahead rests on
   operator discipline — exactly as
   [ADR-0005](../../decisions/adr-0005-dashboard-owns-routine-install.md)
   Consequences state ("depends on operator discipline plus the in-code approval
   flag"). The slice does not over-claim a guarantee the mechanism cannot deliver;
   its enforceable promise is *no unflagged write*, every run.
2. **A clean install lands and is verified.** `install --approved-by-owner` copies
   `prompts/compass-snapshots/SKILL.md` to the live target, **reads it back and
   compares byte-for-byte** (a copy that did not land is a failure, not a
   success), sets a scheduler-readable file mode, and records a manifest
   (e.g. `~/.claude/scheduled-tasks/.dashboard-install.json`) with the installed
   file's hash.
3. **The write decision — refuse only what we cannot prove is safe to replace;
   `--force` overrides.** `install` computes its action from three facts: the live
   file, the source, and the manifest (which records the hash we last installed).
   The full rule:
   - **Live file absent** → **proceed**, no `--force` — there is nothing to
     overwrite (manifest presence is irrelevant; a manifest whose file was since
     removed simply re-lands).
   - **Live file present, byte-identical to source** → **no-op**: the content is
     already correct; record the manifest if it is missing/stale, print "already
     current", do not rewrite. No `--force`.
   - **Live file present, differs from source:**
     - manifest exists **and** the live hash == the manifest's recorded hash →
       **managed upgrade** (we own it, it is unchanged since our last install, and
       the source has since moved) → **proceed**, no `--force`. This is how routine
       updates land.
     - manifest exists **and** the live hash != the recorded hash → **hand-edited**
       (changed out from under us) → **refuse**, show the difference, leave
       untouched — unless `--force`.
     - **no manifest** → **unmanaged** (no record we wrote it — e.g. the stale
       pre-005-04 orphan the scheduler still holds, A2) → **refuse**, show the
       difference, leave untouched — unless `--force`.
   `--force` adopts either refuse case (overwrites and records the manifest). On
   the real system, therefore, the very first landing of the 005-04 content over
   the stale orphan is `install --approved-by-owner --force`.
4. **Idempotent + honest exit codes.** Distinct exit codes let a caller tell
   "installed" from "refused (not approved)" from "refused (hand-edited /
   unmanaged)" from "verify failed". Re-running a clean install is a no-op that
   says so.
5. **End state.** After a successful install (`--approved-by-owner`, plus `--force`
   on the real system where the stale orphan is present — see AC3), `check`
   (006-01) reports **match**, and the live routine is the 005-04 content (no
   `--commit`). No file inside any surveyed repo is touched; the only write is
   under `~/.claude/scheduled-tasks/`.
6. **Tested against a temp target, suite green.** Tests cover: refuse-without-flag;
   clean first install (no manifest, no live file) + manifest; **unmanaged
   pre-existing file refused without `--force` and adopted with it**; hand-edit
   refusal + `--force` override; **managed upgrade** (manifest matches live, source
   moved → proceeds without `--force`, live rewritten); **live file absent but
   manifest present → proceeds without `--force`**; the installed **file mode** is
   asserted (an untested `chmod` regresses silently under umask); read-back-verify-
   failure; and a **CLI integration test of the `--force` argv path** — all against
   a temp directory, never the real scheduler. `npm test` passes, including
   `test/no-leaks.test.mjs`.

**Notes / scope.**
- **No lock safeguard** (unlike the night-worker): the dashboard routine is a
  brief single-command run, not a long-held worker, so there is no in-progress run
  to swap out from under. If that ever changes, revisit.
- **Enabling the schedule is still out of scope.** This slice writes the SKILL.md;
  flipping the disabled `compass-snapshots` cron to enabled is a separate owner
  action via the scheduler.

**DoD:**
- [x] All ACs pass; full test suite green (no regressions). — 119/119.
- [x] Each new test shown to fail when its feature is removed (non-vacuous),
      including the approval-gate and hand-edit-refusal paths.
- [x] Compliance + craft review passed and recorded.
- [x] Frame-critique passed and recorded (`frame_review: true`).
- [x] Deviation log + reconciliation sweep produced under this slice heading.
- [x] Reconciliation review passed.

### Close-out (post-DONE)

- [x] `docs/specs/README.md` regenerated by `workflow.py status-board`.
- [x] `docs/architecture.md` documents the `install` path + manifest + safeguards.
- [x] Primer hygiene per spec 025-01: this slice closes spec 006 — compress the
      spec-006 active entry, and record the owner handoff (install is an
      owner-gated per-run step; enabling the cron is separate).
- [x] A lightweight decision or the ADR records the manifest filename + exit-code
      contract (recorded in `docs/decisions/lightweight-decisions.md`, 2026-08-04).

**Anti-horizontal-phasing check:** after this slice the owner can run the gated
installer and the live routine is updated to the 005-04 content — the orphaned
routine is finally owned and current.

### Deviation log (after reconciliation)

Acceptance criteria evolved during the ceremony (the ACs shown above are the
final/evolved versions; each change is described below). All changes were
review-driven, not scope drift:

- **AC1 reframed (pre-impl frame-critique).** Original wording claimed the install
  was "owner-gated, enforced in code." The frame-critique showed the mechanism is a
  `--approved-by-owner` CLI flag, and in this environment the agent composes the
  command — so a flag cannot prove *owner* identity, only the presence of a
  deliberate approval signal. Rewritten to the honest scope (no unflagged write,
  every run), aligned verbatim with ADR-0005 Consequences ("operator discipline
  plus the in-code approval flag"). No code consequence — a clarity fix to the frame.
- **AC3 expanded twice.** (a) Frame-critique caught that the original "first install
  = no manifest, no live file" ignored A2's grounded reality: the scheduler already
  holds the stale pre-005-04 orphan, so the real first install overwrites an
  unmanaged file. Added the unmanaged-file refuse case (adopt with `--force`).
  (b) The compliance review then found the two-case wording still too narrow and
  the *managed-upgrade* path (manifest matches live, source moved → proceed without
  `--force`) untested — that path is the whole point of an installer (delivering
  routine updates). AC3 was rewritten into the full write-decision table (live
  absent → proceed; live==source → no-op adopt; managed upgrade → proceed;
  hand-edited → refuse; unmanaged → refuse). Both reviewers independently confirmed
  "managed upgrade proceeds without `--force`" is the correct reading.
- **Exit-code contract.** Extended the 006-01 check-side `EXIT` map (0–4, unchanged)
  with `NOT_APPROVED=5`, `REFUSED=6`, `VERIFY_FAILED=7`. Recorded as a lightweight
  decision (2026-08-04) since ADR-0005 delegated the concrete contract to the spec.
- **Manifest.** Single JSON at the scheduler-dir *root*
  (`~/.claude/scheduled-tasks/.dashboard-install.json`), not inside
  `compass-snapshots/`, so the scheduler never mistakes it for a task. Stores the
  installed file's SHA-256 plus an informational `installedAt` timestamp (timestamp
  not required by any AC).
- **Test seam.** `install()` takes an injectable `readBack(path)` (default
  `fs.readFileSync`) so the byte-for-byte verify-failure path is tested
  deterministically without monkey-patching `fs`.
- **File-mode test hardening.** The naive "assert mode == 0o644" test was itself
  vacuous on this machine (default umask 022 already yields 0o644 without the
  `chmod`). The test forces `umask(0o077)` so a removed `chmodSync` lands 0o600 and
  fails — a sharper non-vacuity guard than the AC required.
- **006-01 test updated inline.** The existing `CLI rejects an unknown command` test
  used `install` as its "unknown" command and asserted it points to 006-02.
  `install` is now real, so it was changed to a genuinely unknown command
  (`frobnicate`) and the 006-02 pointer dropped. 006-01 is DONE, but the test file
  is live code (git is the audit trail), so this is an inline fix, not a record
  amendment (ADR-0010 records-vs-live-prose).
- **The "owner gate" is friction + operator discipline, not identity enforcement**
  (frame-critique reconciliation note) — consistent with ADR-0005 and A1.

Non-blocking items left open (from the review passes, judged not worth blocking):
- The idempotency no-rewrite test leans on `mtimeMs` equality; a same-millisecond
  rewrite could pass it falsely, but the parallel manifest-bytes assertion
  (`installedAt` would change) backs it up. Minor robustness note.
- The unmanaged + byte-identical + no-manifest noop-adopt nuance is asserted by a
  code comment and exercised indirectly, without a dedicated test. Not in AC6's
  required set.

### Reconciliation sweep

Drift-prone surfaces checked (`updated` / `no-op` / `deferred`):

- `docs/architecture.md` — **updated**: the `install-routine.mjs` entry now
  documents the `install` write path, the exit-code contract, the read-back verify,
  the manifest location, the refuse/`--force` rules, and the "cron enabling is a
  separate owner action" boundary; the file-tree comment de-scoped from "006-01
  ships read-only check" to both commands.
- `docs/decisions/lightweight-decisions.md` — **updated**: new entry recording the
  exit-code map + manifest filename/shape (the slice close-out item).
- `docs/decisions/adr-0005-*.md` — **no-op**: the decision (dashboard owns + gates
  its install) is unchanged; only the mechanical contract was pinned, which went to
  the lightweight-decisions log, not an ADR amendment.
- `CLAUDE.md` primer — **updated** (both surfaces): added a compact spec-006 DONE
  entry with the owner handoff in the Active-specs list, AND corrected the stale
  "external installer" phrasing in the always-loaded Current Sprint Focus block —
  it now names the dashboard-owned installer and reframes the remaining owner-gated
  step as running `install --approved-by-owner --force` + enabling the cron. (The
  reconciliation review caught the Current Sprint Focus occurrence on a first pass
  that fixed only the Active-specs entry.)
- `docs/inbox.md` — **updated**: the paused-orphaned-routine item (2026-07-22)
  annotated — rebuild + installer now exist at the code level; running the live
  install and enabling the cron remain owner-gated.
- `docs/specs/README.md` status board — **deferred** to the DONE close-out
  (regenerated by `workflow.py status-board` after the DONE transition).
- `tools/install-routine.mjs` header + usage — **updated** (by the implementer): no
  longer says install "lands in 006-02".
- The `expandHome`-placement nit (inbox, 2026-08-04, from the 006-01 arch-review) —
  **no-op / deferred**: 006-02 keeps the same `tools → src/scan` import; relocation
  is a future-spec trigger, unchanged by this slice.
