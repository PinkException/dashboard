> Status: Active (filled 2026-07-13 from the design-session brief; amended
> 2026-07-22 with owner approval to record the public-plugin identity the
> original brief dropped — see ADR-0003).
>
> Captures *why* this project exists, *for whom*, and *with what
> principles*. Architectural mechanics live in [architecture.md](architecture.md).

# Vision: dashboard

## Identity

- **Vision statement:** One local page that answers "where is every project
  and what's next" by reading the artifacts jig-managed projects already
  write — no new rituals, no manual updates.
- **Tagline:** dashboard (noun): compass, rendered persistent and
  cross-project.
- **Distribution:** publicly shared as a **Claude Code plugin**, a companion
  to jig — any developer installs it from this repo and invokes it from any
  of their projects. The owner uses it the exact same way every other user
  does; there is no special private wiring
  ([ADR-0003](decisions/adr-0003-claude-plugin-distribution.md)).

## Target users

- **For:** a solo builder running several jig-managed projects in parallel
  who loses track of progress, sub-projects, and next actions across long
  Claude sessions with generated names — the owner first, and any other
  developer in the same situation who installs the plugin.
- **Not for:** teams, remote/hosted use, or projects with no on-disk
  workflow artifacts (those render as "not jig-managed", nothing more).

## Core problem

Progress lives scattered across spec frontmatter, runbooks, release plans,
and chat transcripts. Claude reports a lot, all at once, per project — but
nothing aggregates across projects, and sub-project roadmaps (a runbook in a
worktree, five release plans) exceed what human memory can track.

- **Today's paths and where they fall short:**
  - Run `/compass` per project — accurate but ephemeral (chat-only) and
    single-project.
  - Re-open old sessions to remember state — session names are opaque;
    reading takes longer than the work.
  - Keep a manual board (Notion, paper) — rots immediately because it
    duplicates what the repo already knows.

## Competitive landscape

| Option | What it does | Where it falls short for this gap |
|---|---|---|
| `/compass` | honest per-project briefing | ephemeral, one project at a time |
| GitHub Projects | boards, issues | remote, manual sync, ignores jig artifacts |
| Notion/manual board | free-form | duplicates disk state, always stale |

**Where this project fits:** the only view fed 100% from artifacts that
already exist on disk, so it is never stale and costs zero upkeep.

## Scope

### Core features (prioritized)

1. Project cards: spec/slice progress, bug and todo counts, git dates.
2. Workstreams: runbooks and release plans per project, with next step and owner.
3. Compass narrative: last snapshot headline + next action per project.
4. Worktree-only-doc warning (docs at risk of silent loss).

### MVP scope

Features 1–4 = spec 002. Deferred to later specs: hours-worked estimation
from session files, evolution graphs from snapshot history, cross-project
"waiting on you / ready for Claude" queue, upstreaming into jig.

### Out of scope (deliberately)

- Any lifecycle mutation — read-only over other repos, like compass.
- LLM calls in the scanner — parsing only.
- Multi-user, auth, hosting.

## Use cases

- UC-1: the owner can see every project's spec/slice progress on one page.
- UC-2: the owner can see each project's workstreams with their next
  unchecked step and who owns it (her or Claude).
- UC-3: the owner can see each project's last compass headline, next
  action, and when it ran.
- UC-4: the owner is warned when a doc exists only in a worktree.
- UC-5: the owner can see, per project, which Claude Code sessions are
  recently active (and which are running now) and what each is about — so she
  knows where she is working on what, without re-opening opaquely-named
  sessions (spec 003).
- UC-6: the owner can triage across all projects at once — see which project
  is waiting on them and for what, ordered nearest-to-done first — to decide
  where to act next, instead of reading each project's card in full (spec 009).

## Stack

- **Runtime / language:** Node ≥ 18, ESM, **zero runtime dependencies**.
- **Platform commitments:**
  - Cloud target: none — local only (`localhost`).
  - Deployment shape: `node src/server.mjs`, no build step.
  - Distribution shape: Claude Code plugin; this repo is the plugin and its
    own marketplace ([ADR-0003](decisions/adr-0003-claude-plugin-distribution.md)).
  - Package manager: npm (dev only; `node:test` for tests).
  - Database: none — rescan on every request.
  - Key external services: none.
- **Locked-in vs. still open:** zero-deps and local-only are locked
  (principles below); snapshot schema is versioned and open to extension
  ([ADR-0004](decisions/adr-0004-dashboard-owned-snapshots.md), which inherits
  ADR-0002's schema unchanged and moves the store out of surveyed projects).

## Design principles & constraints

1. **Read-only over other repos.** The dashboard never writes into a surveyed
   project — no exceptions. Its own state (config, snapshots) lives in the
   user's home data folder, `~/.claude/my-dashboard/`, outside every repo
   including this one. *(Amended 2026-07-24 by
   [ADR-0004](decisions/adr-0004-dashboard-owned-snapshots.md): the previous
   wording sanctioned one external write — compass appending a snapshot into
   the surveyed project — which ADR-0004 removes as a leak of one project's
   internals into another project's git history.)*
2. **Deterministic.** Everything is parsed; same disk state → same page.
3. **Zero new rituals.** Every feature must work from artifacts that
   already exist; anything requiring new user habits is opt-in.
4. **Zero dependencies, one page.** Nothing to install, break, or update.
5. **Honest numbers.** ABANDONED is excluded from denominators, DEFERRED is
   shown as parked, unknown states are surfaced rather than guessed.
6. **Private state never lives in a repo.** The public repo carries only
   the engine, its docs, and synthetic fixtures. The user's project list —
   the private part — lives at `~/.claude/my-dashboard/config.json` in their
   home directory, so it structurally cannot be committed or pushed. Any
   feature that needs per-user state must keep it outside every repo.

**Non-obvious constraints:** scanning ~30 worktrees per project must stay
fast (path comparison only, never content diff); the page must render
acceptably with a project that has 70+ specs.

## How new work enters

- **Prioritization model:** pain-driven, single stakeholder.
- **Spec-triggering rules:** a layer proves insufficient during the daily
  morning/evening compass ritual; or the jig-upstream PR conversation
  requires a contract change.

## Open questions

- Hours-worked estimation: session-file clustering threshold and privacy
  flag (deferred to a later spec; spec 003 became the sessions panel, which
  reads the same session store and can host the hours layer later).
- Pin-registry location if upstreamed into jig (central config vs per-doc
  frontmatter).
