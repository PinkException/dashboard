---
slice: 005-03 — dashboard-owned narrative snapshot skill
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-01T15:57:36Z
prompt_source: review.py frame-critique (pre-implementation)
---

VERDICT: pass

Pre-implementation frame-critique (frame_review: true), run before any code was written. The frame survives; two wording sharpenings were applied in response (below).

REASONING:
The single load-bearing unverified assumption is A3 — that a Claude-run skill reliably produces *substantive* narrative rather than prose-shaped filler no richer than the deterministic `auto:` line. The frame survives its strongest attack because that assumption's deepest support is demonstrated, not asserted: the ADR records that ~91% (175/193) of existing history entries are non-recomputable prose composed by exactly this kind of Claude-run skill (compass), so "a skill can author substantive what's-next prose from jig artifacts" is proven by the corpus this ADR preserves. The other three probed claims hold: reusing `snapshot.mjs` with `--source` is a one-line writer change that smuggles in no validation/schema change (verified `validateSnapshot` ignores `source`), the determinism split is real (the skill is the sole judgment layer; scanner/server/page stay LLM-free), and the 005-04 split is a clean vertical slice (a human runs it, the card updates end-to-end via AC3). The frame is honest that A3 rests on judgment rather than a guarantee.

SPECIFIC ISSUES (both addressed):
- slice-03 AC2 — the kill-criterion-3 guard was described as a runtime mechanism ("writes nothing") but no such mechanism exists: `snapshot.mjs` always writes what it is handed, and the literal `auto:` string is a strawman nobody would emit. The real failure mode is grammatical prose that names the in-progress slice yet carries no more information than the auto line, which passed AC2 as originally worded. **ADDRESSED**: AC2 reworded to state plainly that it is a judgment gate inside the skill (not a mechanical guard), that the honest failure mode is prose merely restating the counts, and that the skill must carry information the `auto:` line lacks or abort. Quality routed to craft + frame-critique review per AC6 / kill criterion 3.
- slice-03 decision 2 / DoD — `source: "dashboard"` grows the *documented* contract by one enumerated value even though the *validation* contract (`validateSnapshot`) is unchanged. **NOTED**: the slice's DoD already scopes this as an architecture.md note, not a validateSnapshot change; wording is precise that only the documented contract grows.

No reconciliation notes: pre-implementation frame pass, nothing to reconcile.

---
Reviewer: jig:reviewer (independent, read-only, adversarial pre-implementation frame-critique). Prompt built by: review.py frame-critique docs/specs/005-snapshot-store/spec.md 005-03 docs/specs/005-snapshot-store/slice-03-narrative-writer.md
