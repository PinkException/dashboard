---
slice: 005-01 — relocate the snapshot store
pass: reconciliation
verdict: pass
reviewer: jig:reviewer (independent)
reviewed_at: 2026-07-25T01:02:52Z
prompt_source: review.py reconciliation docs/specs/005-snapshot-store/spec.md 005-01
---

Reconciliation review of slice 005-01. Final verdict: pass.

The reviewer corroborated every code-level claim in the deviation log against the
diff, and independently confirmed that AC3's narrowing was forced by the
frame-critique's path-identity finding plus ADR-0004's own 16-entry case — not
retrofitted to match the implementation. The write into the owner's real data
folder is disclosed plainly and matches the compliance record. No doc scope creep.

Its round-1 findings were all completeness gaps, since fixed:
- The spec status board was missing from the sweep table and still carried
  "contract = ADR-0002; compass-skill wiring pending on the user's side" — the
  same leak-restoring instruction scrubbed from CLAUDE.md. Repointed, with an
  explicit do-not-wire note, and the board regenerated (005-01 now REVIEWED).
- docs/product-vision.md was claimed no-op but still cited ADR-0002 as the live
  snapshot-schema contract. Repointed; row added to the sweep.
- CLAUDE.md was only half-reconciled: spec 005 missing from Active specs, and
  Current Sprint Focus still pointed at spec 003. Both updated.
- docs/inbox.md left untriaged the 2026-07-19 parked item this slice literally
  resolves (record the store location + contract pointer). Struck through with
  the resolution.
- The deviation-log preamble claimed "original acceptance criteria are preserved"
  while AC3 had been rewritten in place. Preamble corrected to say so.
- The sub-directory guard was disclosed only in passing while its sibling (the
  submodule guard) got its own item. Both now recorded symmetrically as item 2.
- DoD checkboxes were unticked despite the work being complete. Ticked.

Also verified after the fixes: no file in the repo still instructs a reader or a
future agent that the dashboard writes into a surveyed project, and no live prose
cites ADR-0002 as the current contract — remaining references are records
(the superseded ADR itself, closed spec 002, cross-references) or accurate
statements that the line schema is inherited from it unchanged.
