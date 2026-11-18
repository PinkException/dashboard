---
slice: 013-03 — slice and bug counts in the series
pass: craft
verdict: pass
reviewer: pr-review (general-purpose)
reviewed_at: 2026-11-18T22:32:29Z
prompt_source: review.py pr-review --richer-skill pr-review docs/specs/013-evolution-graphs/spec.md 013-03 <deliverables>
substrate: not-shown
applied_skill: none
---

Craft review of slice 013-03 (general-purpose reviewer with the pr-review skill rubric). Verdict: pass. `npm test` 443/443 on ff83127.

Strengths: shared shape predicates for validator and reader (Number.isFinite rejects NaN/Infinity); writer-only provenance export keeps the scan payload and hot path unchanged; small, commented signature change with a dedicated old-to-new transition test; `stepLine` generalises one drawing path for spec and slice lines; behavioural CLI tests over temp repos with invented names; branch names escaped into `<title>`.

Should-fix (non-blocking): provenance records `branch: null` for a project in a repo subdirectory (verified in a scratch repo), and the 3b wording treats null == null as "branch cause ruled out". Minimal fix: use the ruled-out wording only when both branches are non-null; add a subdirectory test. Nits: reuse `realSlices` in `realSliceCounts`; hoist the duplicate `realSliceCounts(specs)` call; simplify the asymmetric live slice fallback; note that a live-segment down-step always gets the generic wording.
