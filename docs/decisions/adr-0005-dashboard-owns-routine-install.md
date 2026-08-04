---
status: Accepted
dependencies: [adr-0004]
last_verified: 2026-08-04
frame_review: true
---

# ADR-0005: The dashboard owns and installs its own automation

## Status

Accepted (2026-08-04, by the owner)

The owner chose this direction explicitly on 2026-08-04 when asked how the
dashboard's snapshot routine should live now that the night-worker no longer owns
it ("Dashboard owns its own install"). Recorded here as the decision spec 006
implements.

## Context

The dashboard's recurring snapshot routine (`compass-snapshots`) runs from the
Claude Code scheduler at `~/.claude/scheduled-tasks/compass-snapshots/SKILL.md` —
outside every repository. Two facts converged to strand it:

1. **The live directory is guarded.** `~/.claude/hooks/guard-jig-prompts.py`
   denies any `Write`/`Edit` under `~/.claude/scheduled-tasks/` (matcher
   `Write|Edit`, verified), so no session can hand-edit what actually runs. The
   guard's stated sanctioned writer is "`tools/install_prompts.py`."
2. **That installer belongs to a different project, which dropped us.** The only
   `install_prompts.py` is the **night-worker's**, and its 2026-08-03 rework put
   the dashboard explicitly out of scope ("The dashboard repos — neither is in the
   rotation"). Its installer manages only the night-worker's own two prompts.

So after [005-04](../specs/005-snapshot-store/slice-04-recurring-routine.md)
rebuilt the routine's content, the rebuilt SKILL.md had **no sanctioned path to
reach the live scheduler**: a guardrail with no writer that manages it. The
routine's content, meanwhile, lived only as prose in the 005-04 spec — never a
durable, version-controlled artifact.

The night-worker already solved the general shape of this problem for itself in
its [ADR-0001](../../../night-worker/docs/decisions/adr-0001-prompts-live-in-this-repo.md):
the repo is the source of truth for the prompts it runs, and a deliberate,
operator-run step copies them out, gated so that **writing to the armed scheduler
needs the owner's explicit go-ahead every time; reading (a drift check) needs
none**.

## Decision Options Considered

1. **Fold the routine back into the night-worker.** Add `compass-snapshots` as a
   night-worker prompt so its installer manages it. *Rejected:* it directly
   contradicts the night-worker's new vision, which puts the dashboard out of
   scope; it couples two projects that were deliberately separated.
2. **Retire the automated routine.** Drop the scheduled task; snapshots run only
   on demand. *Rejected:* the owner wants the growing time series for the future
   evolution view ([ADR-0004](./adr-0004-dashboard-owned-snapshots.md) OQ2). No
   automation means no series unless the owner remembers to run it.
3. **Leave it orphaned.** *Rejected:* a guardrail with no writer is a dead end —
   the routine can never be updated to the 005-04 content.
4. **The dashboard owns and installs its own automation.** This repo becomes the
   source of truth for the routine's SKILL.md, and the dashboard ships its own
   small, tested, zero-dependency installer that copies it out under an
   owner-gated write. *Chosen.*

## Recommended Decision

**Option 4.** The dashboard owns its automation the same way the night-worker
owns its own:

- The routine's SKILL.md is a **version-controlled artifact** in this repo at
  `prompts/compass-snapshots/SKILL.md` — the single source of truth, reviewed and
  changed only through the spec workflow.
- A **dashboard-owned installer** (`tools/install-routine.mjs`, Node, zero
  runtime deps per [ADR-0001](./adr-0001-runtime-zero-deps.md)) copies it out.
- **The line is drawn at writes, not the directory** (inheriting the night-worker
  ADR-0001 condition): `check` (read-only drift) runs freely and needs no
  approval; `install` writes to the armed scheduler and requires the owner's
  explicit per-run go-ahead, every time — enforced in code, not prose.
- This needs **no change to the guardrail**: the hook matches only the
  `Write`/`Edit` tools, so an installer run from the terminal (Node `fs` via Bash)
  is not intercepted. The guard still blocks ad-hoc hand-edits, which is its job.

## Consequences

- The rebuilt routine finally has a sanctioned path to the live scheduler, and its
  content is durably recorded and reviewable instead of living as spec prose.
- Two projects (dashboard, night-worker) now each carry their own installer of the
  same shape. That is duplication, accepted deliberately: the alternative couples
  projects the owner separated, and the installer is small and per-project by
  nature (it knows its own prompt and manifest).
- The write gate depends on operator discipline plus the in-code approval flag,
  not on the guardrail (which only stops the Write/Edit tools). If the guardrail
  were ever widened to Bash, the installer would need its own carve-out.
- Enabling/scheduling the cron remains a separate owner action, distinct from
  writing the file — the installer only manages the SKILL.md content.
- Spec 006 implements this: 006-01 (source + this ADR + read-only `check`),
  006-02 (the owner-gated `install`).
