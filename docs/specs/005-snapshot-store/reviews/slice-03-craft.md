---
slice: 005-03 — dashboard-owned narrative snapshot skill
pass: craft
verdict: pass
reviewer: pr-review/jig:reviewer
reviewed_at: 2026-08-01T16:05:05Z
prompt_source: review.py pr-review
---

VERDICT: pass

REASONING:
The `--source` flag is implemented cleanly and its guard is sound: `typeof args.source === 'string' && args.source` (snapshot.mjs) correctly rejects both a bare `--source` (parsed to boolean `true`) and an empty-string value, so the default provenance tag stands in both cases. The two new tests are non-vacuous. The SKILL.md matches the `open` skill's voice and structure, its guardrails (never write into the surveyed repo, one project per run, don't invent state, keep scanner LLM-free) are complete and sound, and it sets the KC3 "no bland filler" bar honestly with concrete good/too-thin examples plus an explicit abort-and-write-nothing instruction.

SPECIFIC ISSUES:
- [strength][impl] scripts/snapshot.mjs — the override guard defends the bare-`--source` and empty-string cases without a separate branch, and the inline comment documents that intent.
- [strength][impl] test/snapshot.test.mjs — both provenance tests earn their place; the override case additionally re-runs `validateSnapshot` on the tagged line, proving the unconstrained-`source` claim the slice rests on.
- [strength][impl] skills/snapshot/SKILL.md — Step 3 sets the kill-criterion-3 bar honestly: concrete "good" vs "too thin" examples plus an explicit stop-and-write-nothing instruction, matching AC2's judgment-gate framing.
- [nit][impl] test/snapshot.test.mjs — the bare-`--source` edge had no test. ADDRESSED after this review: added a test asserting `--source` as the last arg leaves `source: manual`.
- [nit][impl] scripts/snapshot.mjs — the override runs unconditionally, so `--auto --source dashboard` would tag a thin `auto:` headline as `source:dashboard`, mislabeling it for the future evolution view. Spec-sanctioned (Resolved design decision 1: `--source` overrides "`auto` under `--auto`"), and the skill only ever uses the manual path, so not a defect. Logged as an accepted, spec-sanctioned observation; 005-04 can tighten to manual-only if it never needs the auto override.

RECONCILIATION NOTES:
- No scope creep: the change touches only snapshot.mjs (one new flag), its tests, and the new skill; scanner/server/page untouched (AC4).
- Bare-`--source` test added; `--auto`+`--source` override interaction logged as accepted/spec-sanctioned. Neither blocks REVIEWED.
- Confirm the architecture.md `source` note landed (it did).

---
Reviewer: pr-review shape via jig:reviewer (independent, read-only). Prompt built by: review.py pr-review docs/specs/005-snapshot-store/spec.md 005-03 scripts/snapshot.mjs test/snapshot.test.mjs skills/snapshot/SKILL.md
