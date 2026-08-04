---
slice: 007-02 — README onboarding section
pass: compliance
verdict: pass
reviewer: jig:reviewer (fresh-context, Opus)
reviewed_at: 2026-08-04T20:58:13Z
prompt_source: review.py implementation
---

Compliance pass on slice 007-02 (fresh-context reviewer, Opus). Deliverable: README.md.

VERDICT: pass. All four ACs met. AC1: explicit ordered first-run walkthrough with
open-first ordering stated. AC2: routine documented as opt-in/owner-gated, `check`
read-only, `install --approved-by-owner` + `--force`, schedule-enable as a separate
step, store-only writes. AC3: command names/flags/paths match install-routine.mjs and
ADR-0005, and the README correctly states the installer does NOT start the schedule.
AC4: only placeholder/home paths — no surveyed-project names.

Two non-blocking accuracy nits, both FIXED after the review:
(1) the config-missing pointer was paraphrased — aligned to the verbatim string
("dashboard config not found at <path> — run /dashboard:open to create one").
(2) the --force explanation covered only the unmanaged case — extended to also name
the hand-edited case (a file changed since we installed it). "twice-daily runs" is
consistent with architecture.md; scheduling cadence is a separate owner step.
