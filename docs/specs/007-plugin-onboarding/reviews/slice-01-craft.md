---
slice: 007-01 — graceful config-missing message
pass: craft
verdict: pass
reviewer: pr-review (fresh-context, Opus, installed skill rubric)
reviewed_at: 2026-08-04T20:51:22Z
prompt_source: review.py pr-review
---

Craft pass (pr-review) on slice 007-01 (fresh-context reviewer, Opus). Deliverables:
src/scan.mjs, scripts/snapshot.mjs, test/scan.test.mjs, test/snapshot.test.mjs.

VERDICT: pass. No blockers. Clean, well-scoped: the try wraps only readFileSync with
JSON.parse deliberately outside it, so an ENOENT can only mean the config path is
absent and malformed JSON surfaces as a distinct SyntaxError — the ENOENT catch
cannot swallow an unrelated failure. The typed error carries code +
configPath so callers discriminate without string-matching. The CLI --all branch
catches only CONFIG_MISSING and re-throws the rest. The "no stack trace" test is
non-vacuous (would fail on the pre-slice raw-ENOENT behaviour).

Nits (out of slice scope → deviation log / follow-up, non-blocking):
(1) a malformed (present) config at the --all CLI is re-thrown uncaught, so it still
prints a raw SyntaxError stack — acceptable per scope (AC3 requires only distinct
classification), candidate follow-up.
(2) server.mjs's pre-existing hand-rolled missing-config message now overlaps the new
typed error and points at dashboard.config.example.json rather than /dashboard:open —
the two user-facing pointers diverge; a consistency cleanup outside this slice.
