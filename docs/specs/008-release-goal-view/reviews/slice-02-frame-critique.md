---
slice: 008-02 — graceful degradation & honest unknowns
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (frame-critique, adversarial)
reviewed_at: 2026-08-21T18:44:03Z
prompt_source: review.py frame-critique 008-02 (v2, structural rule)
---

Frame-critique verdict: PASS (final revision, 3rd pass).

The seam that degraded this slice twice — forward gates to unauthored specs
dropped as "noise", recreating a false "all complete" — is closed. The semantic
"does this spec exist?" filter is removed; extraction is structural
(Item-cell-only, `\b\d{3}-\d{2}\b` anchored, probed 2026-08-07), and every
unresolved token (missing slice OR unauthored spec) is counted in `total` and
surfaced in `goalUnresolved`.

Non-blocking residual (the mirror risk): a gate named ONLY in an Evidence/
Rationale cell — never in Item — would be under-counted. Ruled out as an
accepted tradeoff (prose-reading reintroduces cry-wolf) and now recorded
explicitly as a "Known limitation" in the spec's Counting rule, with the
degrade characterized as honest (fewer tokens / title-only, never a crash or an
invented number). Reviewer explicitly asked for this to be named rather than
left implicit — done.
