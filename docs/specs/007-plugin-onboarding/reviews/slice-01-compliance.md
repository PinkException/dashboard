---
slice: 007-01 — graceful config-missing message
pass: compliance
verdict: pass
reviewer: jig:reviewer (fresh-context, Opus)
reviewed_at: 2026-08-04T20:51:22Z
prompt_source: review.py implementation
---

Compliance pass on slice 007-01 (fresh-context reviewer, Opus). Deliverables:
src/scan.mjs, scripts/snapshot.mjs, test/scan.test.mjs, test/snapshot.test.mjs.

VERDICT: pass. All five ACs met. loadConfig narrowly catches ENOENT and throws a
typed ConfigMissingError (code 'CONFIG_MISSING', message names the path +
/dashboard:open); malformed JSON falls through to a distinct SyntaxError (AC3); any
other I/O error re-throws honestly. The CLI catch prints only err.message and exits
1 for the missing case, re-throwing everything else, so no stack trace leaks (AC2).
Tests non-vacuous and isolated to temp paths via DASHBOARD_CONFIG — the CLI test
asserts absence of node:fs/ENOENT/readFileSync frames, so a regression to raw ENOENT
fails it; no path can touch the real config. server.mjs (caller) unaffected — it
catches loadConfig errors generically via err.message (AC4). No issues.

Reconciliation note: EACCES on the config read is re-thrown raw (with stack) by the
CLI — within spec (only the missing-config case is in scope), a deliberate boundary
of the friendly-message behaviour; recorded in the deviation log.
