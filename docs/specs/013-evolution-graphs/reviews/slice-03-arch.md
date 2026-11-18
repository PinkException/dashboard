---
slice: 013-03 — slice and bug counts in the series
pass: arch
verdict: pass
reviewer: arch-review (general-purpose)
reviewed_at: 2026-11-18T22:32:29Z
prompt_source: review.py arch-review --richer-skill arch-review docs/specs/013-evolution-graphs/spec.md 013-03 <deliverables>
substrate: not-shown
applied_skill: none
---

Arch review of slice 013-03 (general-purpose reviewer with the arch-review skill rubric: Technical Soundness, Reliability, AI-Native Maintainability). Verdict: pass.

Additive optional entry fields (`slices`, `bugs`, `scanned`) stay within ADR-0002 ("unknown extra fields are allowed"); architecture.md updated in the same change. Layering intact: writer writes, lib holds pure shape checks and counting, scan holds git/filesystem provenance, render only reads. Strengths: shared shape checks between validator and reader; `scannedProvenance` is writer-only so `/api/data` pays no extra git cost; null-vs-number signature writes the first slice-carrying entry once; `realSliceCounts` deliberately avoids `sliceProgress`'s UNKNOWN inflation.

Nits: (1) equal `scanned` with `branch: null` on both sides (subdirectory project, non-git, detached HEAD) wrongly rules out the branch cause — keep the generic wording when either branch is null; (2) `realSliceCounts` re-inlines the real-slice filter instead of reusing `realSlices`; (3) asymmetric live slice fallback in render.mjs; (4) `realSliceCounts(specs)` computed twice in scan.mjs. Reconciliation notes: record the null-branch caveat or fix in deviation 3b; note writer-only cost of `scannedProvenance`; architecture.md can say subdirectory projects always have `branch: null`.
