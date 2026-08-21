---
status: IN_PROGRESS
skill:
use_cases: [UC-1, UC-2]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 008: Release-goal view

> Give a release-plan workstream a real finish-line: a goal-scoped progress
> meter and a next-action, derived by joining the plan's declared gating
> slices to their already-scanned jig statuses. Reads a shaper release plan's
> existing output only — no shaper change.

## Overview

The dashboard already reads every `docs/releases/*.md` plan as a `release`
workstream and shows spec/slice progress for the whole project (UC-1) and a
next-unchecked-step for checklist-style workstreams (UC-2). A **shaper release
plan is prose and tables, not a checklist**, so `parseRunbook` extracts no
steps from it: the card shows the plan's title but no progress and no next
action. The plan *does*, however, name its finish line in machine-readable
form — the `### Include` section of its Cutline names the slices that gate the
release.

The `## Cutline → ### Include` table is a **shaper template contract** — shaper's
`templates/release-plan.md` (v0.3.0) always scaffolds it — so *locating* the
gating list is safe. What is author-driven, and therefore hedged, is only how
slice IDs are written inside the table's cells (see A2 and the Counting rule).

This spec teaches the scanner to **join** those declared gating slices to the
slice statuses it already scans, and to emit, per release workstream:

- `goalProgress` — `{ done, total }`, counting the plan's gating slices that
  have landed.
- `goalNext` — the first gating slice not yet landed, with a next-action label
  derived from its jig status (e.g. `002-03 — review spec`).

The card renders these on the release row, turning today's title-only display
into a scoped finish-line view. It extends UC-2 (next step + owner) to release
workstreams, which currently show neither.

### Current state (verified 2026-08-07)

- `scanSpecs(root)` returns `[{ id, title, status, slices: [{ file, status,
  dependencies, lastVerified }] }]` — every slice's normalized status is
  already in hand (probed: `src/scan.mjs`). No new spec reading is needed; this
  spec only adds a **join**.
- `scanWorkstreams` already emits each release plan as
  `{ kind: 'release', path, ...parseRunbook(body) }` (`src/scan.mjs:278–285`).
- Running the scanner against a real shaper plan yields `steps: {done:0,
  total:0}`, `next: null`, and a `phases` array that is just a dump of every
  `##` heading — confirming the gap this spec closes (probed 2026-08-07 via
  `scanProject`).
- The join is **read-only and dependency-free** — pure parsing over data
  already on disk. It honors principles 1 (read-only), 2 (deterministic),
  3 (zero new rituals — reads shaper's existing table), and 4 (zero deps).

### Counting rule (honest denominator)

> Three frame-critiques (2026-08-07) converged on one seam: a gating reference
> that does not resolve to a landed slice must neither be invented from stray
> text (cry-wolf) nor silently dropped into a false "all complete." The fix is
> to make the qualifying decision **structural and decidable**, never semantic.
> We do **not** ask "does this spec exist?" — that is undecidable, because a
> release plan legitimately gates specs that are not authored yet. This rule is
> the single source of truth both slices implement; ACs reference it by name.

**Extraction is structural.** The `## Cutline → ### Include` table is a shaper
template contract with columns `| Item | Evidence | Rationale |`. Gating
references are read **only from each data row's Item cell** (the first cell) —
never from Evidence/Rationale prose. Within an Item cell, slice IDs are matched
as **word-boundary-anchored** `\b\d{3}-\d{2}\b` tokens (compressed runs like
`003-01/02/03` expanded to `003-01,003-02,003-03`), then de-duplicated.
Anchoring means a 4-digit year (`2020-01`) or a version fragment yields no
token; the Item-cell restriction means a number in a Rationale sentence is never
read. **Every extracted token is therefore a genuine gating reference** —
structural position, not spec existence, is what qualifies it.

**Column semantics — grounded, not assumed (2026-08-07).** Probed against a real
shaper release plan: the **Item** cell carries the slice-ID references (Item
cells matched `002-01, 002-02` / `002-03 <name>, 002-04 <name>` / compressed
`003-01/02/03`), while the **Evidence** cell carries a human-authored status
string (`DONE`, `READY_FOR_REVIEW`) and yielded **zero** ID tokens. So reading
Item, not Evidence, is correct — and the join **deliberately ignores** the
Evidence-cell status in favor of the scanned jig status, since a hand-typed
status can be stale. (Also probed: shaper's template v0.3.0 puts Item first;
`/\b\d{3}-\d{2}\b/` rejects `2020-01`.)

**Known limitation (accepted tradeoff).** Because extraction is Item-cell-only,
a gate that an author names *solely* in an Evidence/Rationale cell or in prose —
never repeated in the Item cell — is not tokenized, so it is not counted. On the
plans probed, every gate appears in Item and this case did not arise, but it is
not structurally impossible. We accept it deliberately: reading prose to catch
such a gate reintroduces the cry-wolf false-positives this rule exists to kill.
The failure mode is bounded and honest — an uncounted Item-absent gate yields
*fewer* tokens or a title-only render, never a crash and never an invented
number. If real plans ever surface Evidence-only gates, revisit by reading the
Item-cell markdown *link target* (the `../specs/NNN-…` path) as a second signal,
not by reading free prose.

**Classification is by resolution — every unresolved reference is honest, never
dropped:**

- **landed** — resolves to a slice with status `DONE`.
- **parked** — resolves to `DEFERRED` / `ABANDONED` → excluded from the finish
  line (principle 5).
- **pending** — resolves to a slice with any other live status
  (`DRAFT` … `RECONCILED`) → not-yet-landed.
- **unresolved** — does not resolve to a slice, because either the spec is
  authored but the slice file is missing, **or the referenced spec is not
  authored yet** (a forward gate, e.g. `010-01` before `docs/specs/010/`
  exists). Both are genuine not-yet-landed work → counted in `total` *and*
  surfaced in `goalUnresolved`. A forward gate is never mistaken for noise
  because it was never guessed from prose — it sat in an Item cell.

From that classification:

- `goalProgress.total` = landed + pending + unresolved.
- `goalProgress.done` = landed.
- `goalUnresolved` = the unresolved references.
- `goalNext` = the first non-landed reference in Include order.

A meter is shown **iff ≥1 token is extracted from an Item cell**. Zero tokens
(no `### Include`, no readable table rows, or no ID-shaped tokens in any Item
cell) → today's title-only render. Because *unresolved* (missing-slice **and**
unauthored-spec) stays in `total`, a plan gating six real slices with three not
yet built honestly reads "3 of 6 landed · 3 unresolved" — never
"3 of 3 · complete."

## Assumptions

- **A1 — slice-file identity.** A plan reference like `002-03` maps to the
  scanned spec whose `id` begins `002-` and the slice file whose own number is
  `03`. The `workflow.py new` convention is spec-relative `slice-NN-<slug>.md`
  (probed: this repo's own `slice-01-tbd.md`), but spec-*qualified*
  `slice-NNN-NN-<slug>.md` filenames also occur in the wild. The resolver must
  handle both; the implementer probes real target repos before fixing the
  rule. _Unverified across all target repos — load-bearing for the join._
- **A2 — Include *ID spelling* (structure & column are grounded).** The section
  structure and the column that carries the IDs are **grounded, not assumed**:
  the `## Cutline → ### Include` `| Item | Evidence | Rationale |` table is a
  shaper template contract (verified: `shaper/templates/release-plan.md`,
  v0.3.0), and the **Item** cell was probed to carry the IDs while **Evidence**
  carries only a status string (see the Counting rule's *Column semantics*
  block). The one *remaining* variable is how authors spell IDs inside the Item
  cell — observed forms `002-01, 002-02`, `002-03 <name>, 002-04 <name>`,
  compressed `003-01/02/03` / `004-01/02` — which the structural extractor (Item
  cell + `\b\d{3}-\d{2}\b` + run-expansion) absorbs, degrading to fewer/zero
  tokens on an unrecognized spelling, never to a wrong number. _An Include the
  parser cannot read as a table yields zero tokens → title-only (slice 008-02)._
  The residual risk of a gate named *only* outside the Item cell is the accepted
  Known-limitation tradeoff recorded in the Counting rule.

## Decomposition

SPIDR — split on the **Path** axis (happy path first, edge paths later). Both
slices touch the card (the user-facing layer); neither is horizontal phasing.

- **Rejected — Interface split** (parser slice, then render slice): the parser
  alone shows the user nothing — that is horizontal phasing. Each slice must
  reach the card.
- **008-01 (Path — happy path):** a release plan whose `### Include` list parses
  and whose gating slices resolve gets a scoped progress meter + next-action on
  its card, end-to-end (locate → parse → join → render).
- **008-02 (Path — edge paths + Rules):** messy or absent Include input degrades
  safely (no `### Include`, unparseable table, or a referenced slice that
  resolves to nothing) — never a crash, and unknowns are surfaced honestly
  (principle 5), not silently dropped or guessed.

## Slices

- [008-01 — goal progress & next-action (happy path)](slice-01-goal-progress-and-next.md)
- [008-02 — graceful degradation & honest unknowns](slice-02-graceful-degradation.md)
