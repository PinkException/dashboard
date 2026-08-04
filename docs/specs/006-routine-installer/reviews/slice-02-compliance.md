---
slice: 006-02 — the owner-gated install path
pass: compliance
verdict: pass
reviewer: jig:reviewer (fresh-context, Opus)
reviewed_at: 2026-08-04T19:31:05Z
prompt_source: review.py implementation
---

Compliance pass on slice 006-02 (fresh-context reviewer, Opus). Deliverables:
tools/install-routine.mjs, test/install-routine.test.mjs.

Round 1 → needs-changes. Implementation correct, well-structured, and safe (approval
gate, both refuse cases, --force adopt, byte-for-byte read-back, idempotent no-op,
distinct exit codes all present; no code/test path can reach the real
~/.claude/scheduled-tasks/). Three coverage/wording gaps blocked a clean pass:
(1) AC2's file mode (chmod 0o644) set but no test asserted it — vacuous for that
element; (2) the source-changed managed-upgrade path (the update path the slice
exists to deliver) had no test; (3) planInstall granted a free install on any
live-absent state, broader than AC3's literal "no manifest AND no live file".
The reviewer confirmed the implementer's inference (managed upgrade proceeds
without --force) is the CORRECT reading.

Resolution: AC3 rewritten into the full write-decision table (live absent → proceed;
live==source → no-op adopt; live≠source with manifest-hash-match → managed upgrade
proceeds; manifest-hash-mismatch → hand-edited refuse; no manifest → unmanaged
refuse; --force adopts either refuse). AC6 extended. Implementer added 4 tests
(file-mode with a umask(0o077) override so a missing chmod fails; managed upgrade;
live-absent-with-manifest; CLI --force argv), all confirmed non-vacuous. Suite
119/119 green including test/no-leaks.test.mjs.

Round 2 → pass. All six ACs implemented and each AC3 branch non-vacuously tested.
The two hardest cases done right: file-mode test forces umask so a missing chmod
lands 0o600 and fails; read-back-verify injects a corrupting readBack seam so
removing the verify returns MATCH and fails. No unit or CLI path can touch the real
scheduler dir. Non-blocking notes carried to the deviation log: the idempotency
no-rewrite check leans on mtimeMs (backed by the manifest-bytes assertion, so not a
defect); the unmanaged+byte-identical+no-manifest noop-adopt nuance is asserted by
code comment, not a dedicated test (not in AC6's required list, exercised
elsewhere).
