---
status: DRAFT
skill:
use_cases: [UC-1, UC-3, UC-5, UC-6]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 014: Readable redesign (design v1.3)

> Reserved on 2026-11-17 via `workflow.py new` (local, provisional — not yet
> pushed to origin/main). Drafted 2026-11-17.

## Overview

**What changes.** The page takes the look and wording of the owner's Claude
design **v1.3 — "readable redesign"**
([`docs/designs/dashboard-v1.3/`](../../designs/dashboard-v1.3/): Main,
Queue, Detail, each light + dark). The current look (spec 009, design v1.2)
is a dense monospace "ops console"; v1.3 is a warm, large-type,
plain-language page: cream / navy / terracotta palette, a rounded font, much
bigger text, friendly state chips ("Your call", "Your review", "Ready",
"Waiting on others", "Idle") with a one-line "wait" sentence.

**Why it matters.** The owner reads the page to decide what to do next. The
v1.2 page is accurate but hard to scan; v1.3 is designed to be read at a
glance (vision: one page answering "where is every project and what's next").

**Main tradeoff.** Mostly render/CSS work over data the scanner already
provides — but a few things in the mockup are **new behaviour**, not paint:
a queue re-order, a "blocking" flag and a "which spec this decision blocks"
link. Those are open owner decisions (below); the restyle can ship without
them. The mockup also omits spec 012's roadmap tab — kept and restyled (D2).

## Current state (verified 2026-11-17)

- Tokens live in `public/index.html` `:root` (lines 19-31) with a
  `@media (prefers-color-scheme: dark)` override (line 37). The page loads no
  web font (no `@import` / `fonts.googleapis` in `public/index.html`).
- Queue order is the rank in `deriveWaitingStages` (`src/lib.mjs`): MERGE 1,
  REVIEW 2, DECIDE 3, Ready 4/5, External 6, Idle 7 (`src/lib.mjs:756-842`,
  `728`). ADR-0006 records the finish-first order.
- DECIDE comes from a compass blocker owned by "you" (`src/lib.mjs:801-804`);
  the blocker is free text with no spec id.
- The detail view's tabs are `overview | roadmap | activity` (spec 012-01).
- Mockup queue stages (`Queue.dc.html:95-108`): **Land** ("finished work
  ready to go into main") → **Merge** ("out for someone else to review and
  merge" — today's External) → **Review** → **Finish & unblock** (DECIDE) →
  **Start new** (Ready) → **Idle**.

## Owner decisions (settled)

- **D1 — Font (2026-11-17).** Load **Nunito from Google Fonts**, exactly as
  the mockup does (`Main.dc.html` helmet `<link>`), with the mockup's fallback
  stack `'Nunito', ui-rounded, system-ui, sans-serif`. Owner: "to use Claude I
  need internet. This is not a problem." A stylesheet `<link>` is not a
  runtime dependency (ADR-0001 is about npm packages); offline, the fallback
  stack renders.
- **D2 — Roadmap tab (2026-11-17).** Keep spec 012's roadmap tab and **rebuild
  it from the v1.3 parts** (cards, pill chips, section headings, the queue's
  numbered step strip for the sequence strip). Detail tabs read
  `Overview | Roadmap | Activity`. Owner: "just reuse the designs for the
  roadmap." Lands in 014-03.

## Owner decisions (open — answer before READY_FOR_IMPLEMENTATION)

Asked one at a time. Each has a recommendation.

- **OQ2 — Queue order.** The mockup moves "out for someone else's review"
  (External) from last-before-Idle up to step 2. That changes ADR-0006's
  finish-first order. Options: (a) keep today's order, use only the new names;
  (b) adopt the mockup order (needs a superseding/amending ADR).
  **Recommend (a)**: External needs nothing from the owner, so putting it
  above "Your review" pushes owner work down — against the page's purpose.
- **OQ3 — "Blocking" flag + blocked-spec link.** The mockup marks items whose
  delay holds other work ("Blocking") and names the spec a decision holds
  ("Spec 021 can't move until you choose"). Neither is read today. Options:
  (a) build it in slice 014-04, rule to be defined there; (b) drop both from
  this spec (park in the inbox). **Recommend (b) for now**: the restyle stands
  without it, and "blocking" needs a rule we haven't designed.
- **OQ6 — Header eyebrow.** The mockup reads "RosieBits · Dashboard". The
  plugin ships publicly, so a hard-coded org name would show on every
  user's page. Options: (a) "Dashboard" only; (b) an optional `title` in
  `~/.claude/my-dashboard/config.json`, default "Dashboard". **Recommend (a)**
  now; (b) is a small follow-up if wanted.
- **OQ5 — Fidelity gate.** Design values go into ACs (always). Should fidelity
  also be a hard gate (servo `design-eval`, `design_review: true`)?
  **Recommend no**: eyeball attestation at review is enough for a personal
  tool.

## Assumptions

- **A1 — Dark mapping.** The `*-dark.dc.html` files use hard-coded colours, no
  `prefers-color-scheme`. Assumed: every dark value maps onto the existing
  `:root` token names, so one stylesheet + the existing media query serves
  both. To verify in 014-01 by extracting both palettes.
- **A3 — Summary counts.** The five Main tiles (Need you / Ready / Waiting on
  others / Idle / Running now) can be computed from fields the scanner already
  emits (`waitingOn.state`, session `running`). Per ADR-0001 the counting
  happens scanner-side, emitted as an additive `/api/data` field.
- **A4 — Design values extractable.** The mockup's inline styles give exact
  sizes/colours; assumed stable enough to copy into ACs (the designer may
  iterate — a v1.4 would amend the ACs).

## Decomposition

SPIDR, **Interface** axis first (one screen per slice — each slice ships a
screen the owner can see), **Rules/Data** last for the new behaviour:

- **Spike** — not needed; the design is concrete.
- **Paths** — error / not-jig-managed rows are not designed; covered in each
  slice by "existing state keeps rendering, in v1.3 tokens".
- **Interface** — 014-01 overview-by-project (carries the shared token +
  font + chip system); 014-02 action queue; 014-03 project detail.
- **Data/Rules** — 014-04 blocking flag + blocked-spec link (OQ3-gated).

The tokens land in 014-01, so 014-02/03 screens get the new palette at once
but keep their v1.2 layout until their slice ships. That interim is readable
(same tokens, same contrast), not broken.

## Slices

- [014-01 — new look + overview by project](slice-01-look-and-overview.md)
- [014-02 — action queue in the new look](slice-02-action-queue.md)
- [014-03 — project detail in the new look](slice-03-project-detail.md)
- [014-04 — blocking flag and blocked-spec link](slice-04-blocking-flag.md)

## Non-goals

- Phone layout (desktop-first; a reduced phone view is a later design).
- A light/dark toggle in the page (the OS setting decides, as today).
- Changing what the scanner reads, beyond the additive summary counts (014-01)
  and 014-04.
