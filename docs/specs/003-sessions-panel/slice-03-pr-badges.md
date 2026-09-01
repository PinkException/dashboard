---
status: ABANDONED
dependencies: [003-01]
last_verified:
---

## Slice 003-03 — pr-badges

**Abandonment reason (2026-09-01):** Resolved by **[ADR-0006](../../decisions/adr-0006-overview-triage-surface.md)
+ spec [009-04](../009-overview-redesign/slice-04-gh-pr-enrichment.md)**, not by
building this slice as scoped. The capability 003-03 wanted — PR state visible in
the dashboard without leaving it — now ships, but its **placement moved** off the
individual session row into the glance-layer triage state (an approved-ready PR →
**MERGE**, a PR awaiting the owner's review → **REVIEW**, a PR out for someone
else → **External**) plus the detail view's PR list (009-04 AC1). The two open
questions this slice waited on are both settled: **`gh`-on-scan-path vs the
routine-snapshot bridge** was decided in favour of **`gh` on the scan path**
(ADR-0006 "PR state is sourced via `gh` as an optional enrichment" — the scanner
reads `gh` directly, degrading gracefully when absent), and the session-row
placement it originally scoped was superseded by that same ADR. The
session-row-badge *approach* is therefore deliberately dropped; nothing under
003-03 was built. See 009-04 for the shipped behaviour and its tests.

**Resolution trigger (historical — now satisfied):** when PR state is wanted on
session rows, AND the `gh`-subprocess-vs-bridge question below is decided (likely
via a short ADR).

**Goal (deferred):** On a session row whose branch has an associated GitHub
PR, show a small badge with the PR number and state (OPEN / MERGED / CLOSED),
so the owner can see at a glance which sessions are "in review" vs "still
working" without leaving the dashboard.

**Why deferred.** PR state is the one useful field that is **not on disk**
(spec `## Assumptions` A6). Surfacing it needs a `gh` call per candidate
branch. ADR-0001 explicitly sanctions `node:child_process` and the scanner
already spawns `git`, so `gh` is *permitted* — but it adds real cost the MVP
shouldn't pay yet:

- **Latency + rate:** a `gh pr view` per branch, on the rescan-on-every-
  request path, against the 30+ worktrees per project the vision calls out —
  needs caching/batching to not blow the perf budget.
- **Coupling + auth:** depends on `gh` being installed and authenticated;
  degrades to "no badge" when absent, which must be graceful.
- **Alternative not yet chosen:** a session-store *bridge* (a Claude session
  — e.g. the `snapshot.mjs --all --auto` routine — writes the fully-assembled
  session list, PR state included, into a `docs/status/` JSONL the scanner
  reads) would get correct PR/archived data without the scanner reverse-
  engineering or spawning `gh` on the hot path. That trade (freshness-on-scan
  vs freshness-on-Claude-run) is the decision this trigger waits on.

**Open questions to resolve at un-defer:**
- `gh` on the scan path (with a TTL cache) vs the routine-snapshot bridge?
- Which branches even get a lookup — only sessions shown, only non-running,
  only those ahead of `main`?
- Does resolving PR state re-open the true "archived" question (a merged PR
  is the strongest signal a session is done)?

### Deviation log

_(n/a while DEFERRED)_

> **Barred by ADR-0004 (added 2026-07-24).** Any option above that has the
> dashboard write a `docs/status/` file inside a surveyed project is no longer
> available: vision principle 1 (amended) says the dashboard never writes into a
> surveyed project, and [ADR-0004](../../decisions/adr-0004-dashboard-owned-snapshots.md)
> moved all dashboard state to `~/.claude/my-dashboard/`. If this slice is
> un-deferred, route any persistence through the dashboard-owned store instead —
> re-adding an in-project write recreates
> [bug 002](../../bugs/002-compass-writer-still-active.md).
