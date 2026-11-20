---
name: end-of-day
description: End-of-day wrap-up for the dashboard — snapshot every project worked on since the last end-of-day run and show one summary with each project's proposed roadmap order. Use when the user says "end of day", "wrap up my day", "snapshot everything I touched today", or asks to record today's progress across all projects. Writes only to the dashboard-owned store outside every repo — never into a surveyed project, never a git operation.
---

# End of day

One command at the end of the day: every configured project you worked on gets
a fresh snapshot (headline + roadmap block), and you get one short summary to
correct. The deterministic parts (which projects, which time window, the run
state) live in `scripts/end-of-day.mjs`; the narrative judgment stays in the
snapshot skill. Do not re-derive either here.

## Steps

1. **Note the start time.** Run `date -u +%Y-%m-%dT%H:%M:%SZ` once and keep it as
   `STARTED`. That is the value saved at the end, so work done while this run is
   in progress belongs to the next window.

2. **Select the projects.**

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/end-of-day.mjs" --select
   ```

   It prints JSON: `since`, `firstRun`, `capped`, and `projects` (each with
   `label`, `path`, `retry`, `worktreeOnly`). The window is "since the last
   completed run" (first run: the last 24 hours; never more than 7 days back).
   - `capped: true` -> say in the summary that the 7-day cap applied.
   - `projects` empty -> say "no project activity since <since>", write nothing,
     and stop (do not run step 5).
   - If it exits non-zero (for example no config), show its one-line message and
     stop. Nothing is written.
   - Do **not** exclude the current session: this wrap-up may be the session you
     used all day. A project selected only because of it simply gets a
     "nothing new" line (step 3).

3. **One subagent per project.** Start one subagent per selected project (run
   them in parallel where you can). Each follows
   `${CLAUDE_PLUGIN_ROOT}/skills/snapshot/SKILL.md` (single source of the composition
   rules — do not restate them in the prompt) for its project `path`, including
   the "too thin: write nothing" bar, and returns only: the headline written (or
   "nothing new — not written"), the `--print-order` output, any suggested
   change to an owner-corrected order, and any error. Keep just that result.
   A failure in one subagent never stops the others; record it and carry on.

4. **Summary.** One line per project, in this shape:

   `<name> — <headline | nothing new — not written> — a → b → c (yours|proposed)`

   - "yours" means the owner corrected the order; "proposed" means the writer
     computed it. Take the order and its origin from
     `node "${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.mjs" --project "<path>" --print-order`.
   - If a "yours" order has a suggested change, add it on the line — it is **not
     applied**.
   - A project with `worktreeOnly: true`: add "work is in worktrees" — the
     roadmap reflects main only, so it carries forward main's roadmap rather
     than today's unmerged work.
   - A project with `retry: true` (it failed last run): add "retried from
     last run".
   - A project that failed: name it and say why.
   - Finish with how to correct: "move 007-03 before 007-02 in <project>".

5. **Save the run state** (also when some projects failed):

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/end-of-day.mjs" --record --started "<STARTED>" --failed "<path>,<path>"
   ```

   `--failed` lists the paths of projects that failed (omit it when none).
   Failed projects are selected again next run whatever their activity, so a
   failure never silently uses up its window.

## Corrections

When the owner says "move X before Y in <project>", apply it in this same
conversation with exactly one call for that project:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.mjs" --project "<path>" --move X --before Y
```

The corrected order is saved as the owner's, so it survives every later
end-of-day run. Show the new `--print-order` line.

## Known gaps

- A session started outside every configured project root (or its worktrees)
  does not select that project.
- A project path containing a comma cannot be carried in `--failed`, so it is
  not retried automatically (known limit, not fixed).
- Two overlapping runs can overwrite each other's run state; unlikely for a
  nightly ritual.
- A run state dated in the future (clock skew) counts as a first run, which
  also drops its list of failed projects, so those are not retried once.

## Guardrails

- **Writes only to the dashboard store** (`~/.claude/my-dashboard/`). Never
  create or edit a file in a surveyed project; run no git command.
- The subagents write snapshots through `snapshot.mjs` only.
- Keep the scanner and page out of it; they stay deterministic and LLM-free.
