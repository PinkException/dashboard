---
status: REPORTED
tier:
severity:
claimed_by: claude/bug-003-rename-splits-history
regression_test:
main_repro_checked_at:
main_repro_ref:
main_repro_result:
red_confirmed_at:
green_confirmed_at:
fix_class:
security_surface: false
escalated_to:
closure_schema: 1
---

# Bug 003: folder-rename-splits-history

## Symptom

Renaming or moving a surveyed project's folder silently splits its snapshot
history. The store file is keyed on the folder path (`projectKey` in
`src/scan.mjs`: basename plus a hash of the resolved root), so after a rename
new snapshots go to a fresh file, and every reader (compass card, the 013-01
Activity chart) sees only the post-rename entries. Nothing warns the owner.

Seen on 2026-11-18: the Activity chart for this project covered 7 days, while
17 older entries (2026-07-13 to 2026-08-08) sat under the pre-rename key. The
owner judged the chart "not useful" partly because of this.

## Repro

1. A project configured at `<parent>/dashboard` has snapshots in
   `<store>/dashboard-<hashA>.jsonl`.
2. Rename the folder (here: an emoji prefix was added) and update the config
   path.
3. The next snapshot writes `<store>/dashboard-<hashB>.jsonl`; the dashboard
   reads only `<hashB>`. The `<hashA>` entries are orphaned.

## Evidence

- The old key's hash equals the hash of the pre-rename path; the new key's
  equals the current path (checked 2026-11-18).
- The owner-confirmed alias list (`snapshot-aliases.json`, ADR-0004 OQ4
  amendment) already held one rename of this same project, but only the one-off
  migration (`scripts/migrate-snapshots.mjs`, slice 005-02) reads it. The live
  writer and readers ignore it.
- Local mitigation, 2026-11-18 (owner-approved): the two files were merged into
  the current key (19 entries, duplicates dropped), the originals kept in a
  dated backup beside the store, and a second alias recorded. The underlying
  defect is unchanged: the next rename splits again.

## Hypotheses

<!-- Anti-anchoring: >=2 candidates, mark the leading one. Any Markdown
     list works (-, *, +, or 1.); the gate counts top-level items only
     (indented sub-bullets are notes, not hypotheses). -->
- [ ] H1: the alias list is meant to be consulted only at migration time, and
  the gap is a missing owner-facing warning (an orphaned store file with no
  configured project), not a reader change; falsify by re-reading ADR-0004's
  OQ4 amendment for whether live resolution was scoped out.
- [x] H2 (leading): identity is path-derived at write and read time, and the
  declared alias list (ADR-0004) is never applied live, so any rename forks the
  history; confirm with a test that renames a fixture project root and asserts
  the reader still returns the pre-rename entries.

## Root cause

## Repository closure inventory

<!-- Spec 091 / ADR-0037: pre-fix repository closure. Standard & gnarly
     bugs gate ROOT_CAUSED -> FIXING on substantive answers below. This
     is an effort-and-protocol standard, NOT a completeness proof: show
     the search you actually ran. A bare "none found" fails; record
     residual uncertainty as an assumption WITH the protocol behind it,
     applying the same enumeration standard as `## Root cause` (ADR-0052).
     Prefer a configured semantic index; the portable floor is targeted
     search + `git log`/`git blame`. -->

**Equivalent / convergent logic searched:**

**Relevant history inspected:**

**Affected call sites:**

**Reuse decision:**

## Fix class

## Fix

## Call-site closure

<!-- Spec 091 / ADR-0037: before REVIEWED, account for every site named
     in the inventory above as changed, tested, or intentionally left
     alone. Accounting, not mandatory widening. -->

**Disposition per affected site:**

## Already tried

## Regression test

## Proof

## Learning
