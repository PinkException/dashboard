---
name: snapshot
description: Compose and record a narrative "what's next" snapshot for one project on the dashboard. Use when the user wants to capture where a project stands, update its dashboard headline, write a fresh "what's next" line, or says things like "snapshot this project", "record where <project> is at", or "update the dashboard note for one of my projects". Writes one entry to the dashboard-owned store outside every repo — never into the surveyed project.
---

# Write a narrative snapshot for a project

The dashboard reads a short "what's next" headline for each project from its
own store at `~/.claude/my-dashboard/snapshots/<project-key>.jsonl` (outside
every repo, ADR-0004). The scanner and page are deterministic and make no LLM
calls; **this skill is the one place narrative prose is composed** — exactly as
the compass skill composed its headlines. You read a project's own artifacts,
judge what actually comes next, and record one line.

This writes **one project per run**. An automatic, scheduled sweep across every
project is a separate routine (spec 005-04), not this skill.

## Steps

1. **Resolve the project.** Accept an absolute or `~` path, or a label from
   `~/.claude/my-dashboard/config.json`'s `projects` array (match `label`, use
   its `path`). If you cannot resolve it to a real jig project directory, stop
   and say so — never guess a path.

2. **Gather the signals** from the project's own artifacts. Read what actually
   tells you what is next:
   - `docs/specs/README.md` — the spec status board (what is DONE, IN_PROGRESS,
     READY_FOR_IMPLEMENTATION, DEFERRED).
   - the in-progress slice(s) — the concrete next step and any open decisions.
   - `docs/bugs/README.md` — open/escalated bugs.
   - `docs/releases/README.md` — any `Next:` marker on the release slate.
   - `docs/inbox.md` / `docs/refinement-todo.md` — parked decisions that block.
   If the project has its own `/compass` or `/jig:orient`, running it is a fast
   way to get the same picture — but you still write the entry here.

3. **Compose the entry — and clear the bar.** Write a `headline` that names a
   **concrete next action, decision, or blocker**, carrying information the
   deterministic `auto: N/M specs done · …` line does not. Optionally add a
   `next` (the single most likely next step) and `blockers` (what is waiting on
   a person).
   - Good: `"003 sessions-panel ready to implement; 003-03 deferred on the gh decision"`.
   - Too thin (do **not** record): `"005 is in progress"`, `"2 specs done"` —
     these only restate the counts the `auto:` line already gives.
   - **The bar is a judgment call and it is the point of this skill.** If the
     best you can honestly write merely restates progress counts, **stop and
     tell the user — write nothing.** A bland entry is worse than none; kill
     criterion 3 says a thin snapshot is a failure, not a fallback.

4. **Write it** through the dashboard's writer (it validates, appends to the
   store outside every repo, and never touches the surveyed project):

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.mjs" \
     --project "<resolved-path>" \
     --headline "<your narrative headline>" \
     --next "<optional next step>" \
     --blockers "<optional; semicolon-separated>" \
     --source dashboard
   ```

   `--source dashboard` tags the entry as dashboard-authored, distinct from a
   human `manual` headline and the deterministic `auto` line. Drop `--next` /
   `--blockers` when you have none. The writer refuses a missing or non-jig
   project and writes nothing — surface its message rather than retrying.

5. **Roadmap block (optional, narrative only).** When you can say more than a
   headline, also compose the project's roadmap narrative from its own artifacts
   into a JSON file in a **temp directory outside the surveyed repo**:
   `groups` (`[{label, slices: ["NNN-MM"]}]`), `layers` (`[{name, title, text}]`),
   `rule` (string), `locked` (strings), and — only while the order is not yet
   corrected — `proposedOrder` (slice IDs). Pass it with `--roadmap <file>` on the
   step-4 command.
   - **Never write `order` yourself, and never compute one by hand.** The writer
     proposes, carries forward or corrects it. Once the owner has corrected the
     order, the writer ignores `proposedOrder` (it prints it as a suggestion;
     mention it in your summary, apply it only if the owner says so).
   - **Owner correction** ("move 007-03 before 007-02") is exactly one call:
     `node "${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.mjs" --project "<path>" --move 007-03 --before 007-02`.
   - **Thin day** (no headline worth writing, per step 3): write nothing; new
     slices still appear via the tab's read-time merge.

6. **Confirm.** Run
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/snapshot.mjs" --project "<path>" --print-order`
   and show its output (the `a → b → c` line plus which order is in effect) in
   your summary. Report the headline you recorded and where it landed. If the
   dashboard server is running (`/dashboard:open`), the project card shows it on
   the next refresh — there is nothing to restart.

## Guardrails

- **Never write into the surveyed project.** The writer targets the store
  outside every repo; do not create or edit any `docs/status/compass-history.jsonl`.
- **One project per run.** A cross-project sweep is the scheduled routine's job
  (005-04), or `/dashboard:end-of-day` (012-04), which runs this skill once per
  project in its own subagent.
- **Keep the scanner and page out of it.** They stay deterministic and
  LLM-free; the judgment lives only here.
- **Do not invent state.** Every claim in the headline must trace to something
  you read in the project's artifacts.
