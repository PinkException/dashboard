# Learnings

> Status: Draft (wizard-generated)
>
> Dead ends, failed approaches, and "we tried X and here's why it didn't work."
> The institutional memory that ADRs don't capture — these are not decisions,
> they're anti-patterns and gotchas discovered in practice.
>
> Update via `/jig:memory-sync` during reconciliation.

<!-- Learnings below. Format: ## Title, followed by what happened and what to do instead. -->

## Pausing one writer is not closing the channel (bug 002, compass-writer-still-active)

When the scheduled `compass-snapshots` routine was paused (2026-07-22), the
write path into surveyed repos was believed closed. It was not: ADR-0004 named
**three** writers (the compass skill, `scripts/snapshot.mjs`, the routine) and
only one had been stopped. **Do instead:** before declaring a data channel
closed, enumerate every writer of that path (grep the target path and the
filename across code, skills and scheduled tasks) and close or retarget each
one. Prove it with a test that asserts the surveyed repo's `git status` is
unchanged after a write (`test/snapshot-store.test.mjs`).
