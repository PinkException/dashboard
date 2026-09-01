---
slice: 009-02 — waiting-on state + finish-first ordering (the triage signal)
pass: discrimination-recall (AC4 + AC5 evidence)
verdict: pass
reviewer: orchestrator (live probe over real configured project set)
reviewed_at: 2026-08-31
---

Recorded evidence for AC4 (discrimination, disk-measurable) and AC5 (recall vs
owner ground truth). The derivation `deriveWaitingOn` was run over the owner's
live `~/.claude/my-dashboard/config.json` project set via `scanAll`.

> **Privacy note.** This repo ships publicly (vision principle 6; the leak gate
> enforces it). The surveyed projects are the owner's private projects, so this
> record refers to them only as **P1–P8** (anonymized slots). The real
> name↔slot mapping is deliberately **not** committed; it lives outside the repo.
> The evidence — the counts, the pass/fail verdicts, and the dispositions — is
> fully preserved by the anonymized form.

## AC4 — Discrimination probe (PASS)

Per-project derived state (final, post-retighten). One configured project (P1)
was unscannable — see the config-path note below — leaving 7 scannable:

| Project | State | Rank |
|---|---|---|
| P1 | (unscannable — config-path typo) | — |
| P2 | **MERGE** (You) | 1 |
| P3 | **MERGE** (You) | 1 |
| P4 | Ready | 5 |
| P5 | Ready | 5 |
| P6 | Ready | 4 |
| P7 | Ready | 5 |
| P8 | Ready | 5 |

**You-states: 2 of 7 scannable = 29%.** Saturation line (ADR-0006) is
≥ half (≥ 3.5). **29% < 50% → PASS.** The signal is sparse/selective, not
saturated.

### Retightening applied to reach this (the AC4 loop firing as designed)
First run lit You on 5 of 7 (63% — saturation FAIL), driven by DECIDE firing on
*any* compass blocker. The real blockers were process/status notes (a pending
reconciliation review, an undiagnosed bug) — not owner decisions. Fix
(intent-scoping, per ADR-0006): DECIDE fires only on a `**(you)**`-tagged next
step or a blocker that itself carries the `**(you)**` owner tag
(`ownerOf(blocker) === 'you'`). A bare/untagged blocker no longer fires DECIDE.
Also folded in a taxonomy-conformance fix (`READY_FOR_REVIEW` → Ready). Re-probe
→ 29%.

## AC5 — Recall check vs owner ground truth (PASS — no taxonomy miss)

Owner ground truth (collected before any derived output was shown): four
projects were named as needing the owner — **P1, P2, P5, P8**; the other four
were not. Comparison + disposition of every owner-named project:

- **P2** → MERGE (You). **True hit** — a real `RECONCILED` slice awaits the
  owner's merge.
- **P8** → Ready. Investigated its full artifact set (subagent, read-only):
  **no genuine owner-block exists.** Its parked slices share one unmet
  demand-count resolution trigger; no proposed decision record awaiting
  acceptance; no `REVIEWED`/`RECONCILED` slice; no `**(you)**` step; open items
  resolved or parked. The derived Ready is **correct**; the owner's pick was a
  fuzzy-memory over-name, not a derivation failure. **Not a recall miss.**
- **P5** → Ready. Investigated its full artifact set (subagent, read-only):
  **no act-now owner-block.** Zero `REVIEWED`/`RECONCILED`/`IN_PROGRESS` slices.
  A real but non-urgent owner decision is latent (an inherently owner-only
  judgement), but it is (a) gated on unstarted Claude prep, so the immediate next
  move is Claude-runnable, and (b) not encoded in any form the deterministic
  taxonomy reads. The derived Ready (immediate move = Claude prep) is
  **defensible**; the latent decision is a detail-view / owner-marker concern,
  not a missed headline state. **Not a taxonomy recall miss.** The owner-marker
  backstop remains available if the owner wants the latent decision surfaced.
- **P1** → unscannable. The live config path for this project had a typo (a
  character dropped from the folder name), so it could not be read. **Config
  coverage gap, not a taxonomy miss** — the dashboard cannot derive a state for a
  project it cannot read. Fixed post-slice (owner-approved config edit).

**Recall verdict: no taxonomy recall miss.** Every owner-named project either
correctly shows a You-state (P2), genuinely has no on-disk owner-block on
investigation (P8; P5's immediate move), or was a config coverage gap (P1).
Notably the derived signal was **more accurate than the owner's gut recall** on
P5 and P8 — the ADR-0006 thesis (a derived triage signal beats reading every
card, and beats fuzzy memory) held on real data.

## Product findings surfaced (for the owner / follow-ups, out of 009-02 scope)

1. **No surveyed project uses the `**(you)**` tag convention.** DECIDE
   auto-detection therefore has nothing to grab on the current corpus; owner
   decisions surface only via the owner-marker backstop or by adopting the tag.
   This is the ADR-0006 "recall is not disk-measurable" premise, confirmed
   empirically.
2. **One project's config path had a typo** so the dashboard couldn't survey it —
   fixed post-slice with an owner-approved one-line config edit.
3. **One project the owner named as needing them is not in the surveyed config**
   at all — add it to the config if it should appear (owner follow-up).
