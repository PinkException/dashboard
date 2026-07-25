---
status: RESOLVED_ON_MAIN
---
# Bug 001 — .gitignore's `.claude/` rule excludes the worktree test fixture

**Symptom.** On a fresh clone, `npm test` fails 1 of 29 tests:
"worktree-only docs flagged by path comparison (002-02 AC4)" at
`test/scan.test.mjs:81` — `worktreeOnlyDocs` comes back empty (0 !== 1).
The suite passes on the machine where the fixture was authored, which is
why this went unnoticed until the 2026-07-19 project audit.

**Root cause (proven).** `.gitignore:6`'s bare `.claude/` pattern matches
at any depth, so it also covers the test fixture
`test/fixtures/proj-jig/.claude/worktrees/wt-lost/docs/notes/lost-doc.md`.
The file was never committed — it exists only untracked where it was
created. Verified with:

```
$ git check-ignore -v test/fixtures/proj-jig/.claude/worktrees/wt-lost/docs/notes/lost-doc.md
.gitignore:6:.claude/	test/fixtures/proj-jig/.claude/worktrees/wt-lost/docs/notes/lost-doc.md
```

**Fix idea.** Add a negation for fixtures (`!test/fixtures/**/.claude/`
plus the files beneath, or scope the ignore rule to the repo root as
`/.claude/`), then commit the missing fixture file. Two-line change; the
existing test is already the regression test.

- [x] repro captured (fresh-clone `npm test`, 28/29)
- [x] root cause proven (`git check-ignore -v` above)
- [x] regression test red (the existing 002-02 AC4 test *is* the red test)
- [x] fix landed; suite green on a fresh clone (root-anchored `/.claude/`
  in `.gitignore`, fixture file committed — 2026-07-22)
