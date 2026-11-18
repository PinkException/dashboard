---
slice: 013-03 — slice and bug counts in the series
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (independent, 2 rounds)
reviewed_at: 2026-11-18T22:23:17Z
prompt_source: review.py frame-critique docs/specs/013-evolution-graphs/spec.md 013-03 docs/specs/013-evolution-graphs/slice-03-richer-series.md
---

Frame-critique of slice 013-03 (slice and bug counts in the series). Two fresh jig:reviewer rounds, pre-implementation. Final verdict: pass.

Round 1, needs-changes. [blocker] Storing `slices` does not make multi-slice progress visible on its own: the auto routine is stopped, there is no back-fill, and AC6 needed 2 new points, so the slice line could stay hidden for months. Fixed: the owner chose slice 012-04 (end-of-day skill) as the cadence source (DoR, Assumption A1), the outcome is now conditional on it, and AC6 draws from 1 stored point (consistent with 013-01 AC5). [secondary] `sliceProgress` counts status-less `slice-*.md` files as UNKNOWN, inflating `total` and flipping the AC4 signature. Fixed: AC1 counts real slices only (the `realSlices` rule).

Round 2, pass. Residual risk noted in A1: end-of-day entries are still gated by the snapshot skill's thin-day bar, and slice progress counts only once merged to the scanned root; the stopped auto routine (already slice-aware via AC4) is the remaining lever. Ordering against the 012-02 → 012-03 → 012-04 chain stated in A1.
