---
slice: 012-03 — saved order and narrative extras from snapshots
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-11-16T19:15:32Z
prompt_source: frame-critique round 6 (orchestrator-built prompt mirroring review.py frame-critique)
---

VERDICT: pass (round 6)

REASONING:
Round 5 fixed: position comes only from `order`; groups label consecutive runs; --move copies source and no longer joins groups, so a recomposed groups block can relabel but never undo a correction. No new misdirecting premise. Checked: --if-changed same-source only and only when passed (scripts/snapshot.mjs:68-86,138-143); "narrative" = source !== 'auto' (src/lib.mjs:170-193); writer already calls scanProject (scripts/snapshot.mjs:101).

SPECIFIC ISSUES:
- Note (fix before implementation): a "proposed" order's AC7 date was the carry-forward entry ts, so daily runs cleared the staleness flag. Add proposedAt (never moved by carry-forward) or keep the first proposal's ts.
- Note: a first proposal froze until corrected; consider re-proposing while origin is still "proposed".
- Note: card shows copied headline at correction time — explicitly accepted.

ORCHESTRATOR FOLLOW-UP: proposedAt added (AC1) and used by AC3/AC7; while origin is "proposed" a new proposedOrder replaces it (AC2, AC8); once "corrected", proposals are suggestions only.
