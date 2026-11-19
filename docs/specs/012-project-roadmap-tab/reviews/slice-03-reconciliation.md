---
slice: 012-03 — saved order and narrative extras from snapshots
pass: reconciliation
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-11-18T22:59:46Z
prompt_source: review.py reconciliation
---

VERDICT: pass

REASONING:
Every deviation-log claim (1–10) verified against the code: A3 tolerance tests exist; roadmap in progressSignature is load-bearing; validateRoadmapBlock requires orderOrigin and ties dates to origin; argConflict refusals match; deriveSavedPart keeps slice-less specs, DONE-in-flight slices and unplaced tokens visible; exports and first-group rule match; the origin/main merge kept both sides. ADR-0004 amendment, architecture.md and inbox entry match the code. No over-build; no principle broken.

SPECIFIC ISSUES (all fixed before RECONCILED):
- Sweep row for docs/specs/README.md said `updated` before regen — now `deferred` with the DONE transition as trigger.
- ADR index row said `updated` — split into ADR-0004 (`updated`) and index (`no-op`).
- Sweep omitted files from the origin/main merge — exclusion row added, pointing at deviation 10.
- Craft/arch verdict files overstated coverage (listed later fixes as FIXED, same timestamp) — both now marked "pass (on round-1 code)" with a provenance note; deviation 8 says they were not re-run.
- CLAUDE.md marks 012-03 DONE while slice is REVIEWED — acceptable because DONE lands in the same change.

RECONCILIATION NOTES:
Added to the deviation log: `--move` takes fresh specs/slices/bugs/scanned from the scan; `--if-changed`/`--ts` are accepted (not refused) alongside `--move`/`--print-order`.
