---
status: DRAFT
dependencies: [007-01]
last_verified:
---

## Slice 007-03 — converge the missing-config message

**Idea (from inbox triage 2026-11-16; originally a 007-01 craft nit, 2026-08-04):**
`src/server.mjs` has a hand-rolled missing-config message pointing at
`dashboard.config.example.json`, while `ConfigMissingError` (007-01) points at
`/dashboard:open` — two user-facing remedies for the same condition. Converge
them: the server catches `CONFIG_MISSING` and reuses the typed message, or both
point at the same remedy.

_Not yet planned — no acceptance criteria beyond the idea above._
