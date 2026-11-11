---
slice: 011-01 — contrast: every text colour passes WCAG AA in both modes
pass: frame-critique
verdict: needs-changes
reviewer: jig:reviewer
reviewed_at: 2026-11-11T19:17:24Z
prompt_source: review.py frame-critique (round 2)
---

needs-changes (round 2). Round-1 inset flaw fixed, and a passing palette is shown achievable in both modes by arithmetic. New findings, folded in: (1) --heat-* also colour text (render.mjs:307 -> index.html:144-147), so AC4b now splits them into text tokens (4.5:1) and fill tokens, and AC4c makes the test resolve var() aliases per mode; (2) grey merging is required, not optional (the light band is ~#1f-#65); (3) opacity in older rows must be replaced, since sRGB blending would force near-black greys; (4) every compliant light amber is a dark ochre (~#915800 on --hover), so the "brown amber" kill-criterion is replaced by an owner-approved swatch. Outstanding before READY: the owner's swatch decision.
