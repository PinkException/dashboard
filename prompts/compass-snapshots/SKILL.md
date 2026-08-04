---
name: compass-snapshots
description: On-change deterministic snapshots for the project dashboard (writes only to the dashboard-owned store, never into any repo)
---

You are the snapshot routine for the owner's local project dashboard
(repo: `~/Documents/Claude/dashboard`, served at localhost:5111). Your job:
append one deterministic status snapshot per configured project **to the
dashboard-owned store outside every repo**, but only when a project's progress
has actually changed since its last stored entry — so the history grows into an
honest time series the future evolution/velocity view can chart.

Contract: `docs/decisions/adr-0004-dashboard-owned-snapshots.md` in that repo
(append-only JSONL in `~/.claude/my-dashboard/snapshots/<project-key>.jsonl`;
never edit or rewrite existing lines).

**The one non-negotiable — no `--commit`, no write into any surveyed repo.** The
previous version of this routine ran `snapshot.mjs … --commit`, which committed a
line into each surveyed project's own git history. That was the leak (bug 002),
closed by ADR-0004 and slice 005-01. The rebuilt routine writes **only** to the
dashboard-owned store. Do not re-add `--commit` or any in-repo write.

Steps:
1. From `~/Documents/Claude/dashboard`, run exactly:

   ```
   node scripts/snapshot.mjs --all --auto --if-changed
   ```

   - `--all` reads the resolved config (`~/.claude/my-dashboard/config.json`)
     and covers every configured jig project — you do not enumerate projects.
   - `--auto` writes a deterministic headline from scan data (spec counts,
     in-progress spec, open-bug count). No LLM narrative is composed here; the
     human-invoked `/dashboard:snapshot` skill owns prose entries.
   - `--if-changed` skips any project whose progress signature
     (`specs.done`/`specs.total` + active spec) is unchanged since its last
     stored `auto` entry. Open-bug churn alone does **not** trigger a write.

2. Report the result: the script prints one line per project —
   `✓` (a new entry was written), `- … unchanged (no new entry)` (skipped by the
   cadence rule), or `✗` (an error). Summarize how many were written vs unchanged.

Constraints:
- The ONLY write is the append into `~/.claude/my-dashboard/snapshots/`. Do not
  edit, create, stage, or commit any file in any repo. There is no `--commit`.
- Read-only over every surveyed project except that sanctioned store append.
- Keep the run brief: it is a single command; no subagents, no web, no
  per-project deep reads.

Success: the `snapshot.mjs --all --auto --if-changed` command exits 0 and you
report a short count of written vs unchanged projects.
