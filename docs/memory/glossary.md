# Glossary

> Status: Draft (wizard-generated)
>
> Domain terms and project-specific vocabulary for dashboard. Loaded on demand
> when the hot cache (CLAUDE.md) misses. Update via `/jig:memory-sync` or when
> `jig-memory-scan` surfaces an unknown reference.
>
> When `jig-memory-scan` flags an unrecognized capitalized reference, the user
> provides the definition once and `memory-sync` writes it here. High-frequency
> terms (referenced ≥3 times in a session) are promoted to the CLAUDE.md hot cache.

<!-- Terms below, alphabetical. Format: ## TERM, followed by definition prose. -->

## Automatic order
Spec 012's layer-1 order for the roadmap: current release first, then by tier (in flight / started / not started), then recency (git commit time of the spec dir, mtime fallback), then spec number; slices within a spec follow their in-spec dependencies, with a number-order fallback on a cycle. No owner input needed. See spec.md 'Automatic order (layer 1)'.

## Roadmap tab
The detail view's middle tab (overview | roadmap | activity), spec 012. Shows a project's road ahead read from its own specs: a sequence strip, the current release's slices, one group per unfinished spec with a card per slice, and DONE specs folded under 'show N done'. Derived scanner-side (deriveRoadmap in src/lib.mjs), rendered by roadmapTabHtml.

## Sequence strip
The row of up to four steps at the top of the roadmap tab: step 1 is the current release or first ordered spec ('Now · We are here' only when the artifacts show it, else 'Next up'); steps 2-3 are the next ordered specs not covered by the release, labelled 'Then'; the last is 'N parked' when any slice is DEFERRED. Owner decision 2026-11-16 in lightweight-decisions.md.

## Worktree hint
The roadmap header's note next to 'as of main': 'N slices further along in worktrees' (slices whose highest worktree status ranks strictly above main's, plus worktree-only slices in a spec folder main has) and 'M specs only in worktrees'. Read from worktree slice frontmatter on disk; never changes the order. Spec 012-01 AC10.
