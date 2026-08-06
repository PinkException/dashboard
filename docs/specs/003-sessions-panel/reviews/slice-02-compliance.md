---
slice: 003-02 — recency-expand-toggle
pass: compliance
verdict: pass
reviewer: general-purpose subagent (independent, no impl context)
reviewed_at: 2026-08-06T18:39:22Z
prompt_source: review.py implementation
---

Independent compliance review of slice 003-02. VERDICT: pass. All 6 ACs met,
verified file:line. sessionCounts (src/lib.mjs) computes N=emitted active,
M=emitted non-active, K=max(0, sessionsTotal−emitted) per the frame-critique's
pinned definitions; sessionsSection renders active-only by default, gates the
"· M older" segment and the <details> control on M>0, appends "(+K not shown)"
independently on K>0. Emitted array is sorted then capped in scan.mjs so the
filter(!active) reveal is genuinely lastActivity-desc. Tests non-vacuous
(deepEqual exact triples incl. the 25-running case → {20,0,5}); suite green.
All interpolated fields escaped via esc(). No regression to 003-01 active rows.
Reconciliation note (addressed): render site used truthy s.active while the
helper used strict === true — agreed today because the scanner emits boolean;
unified to strict === true / !== true post-review to remove the latent
divergence. Suite 154 green after the change.
