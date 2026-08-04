---
slice: 003-01 — sessions-scan-and-render
pass: frame-critique
verdict: pass
reviewer: general-purpose subagent (adversarial frame-critique)
reviewed_at: 2026-08-04T21:37:23Z
prompt_source: jig:spec-workflow frame_review — slice carries real ## Assumptions (A4)
---

Adversarial frame-critique of slice 003-01 before implementation, run against
live on-disk data (Claude Code v2.1.219; 8 running sidecars; 406 sampled
transcripts; current 8-project config).

Verdict: FRAME-SOUND-WITH-NOTES — buildable after resolving one blocker in the
slice text (resolved 2026-08-04; see slice ### Frame-critique).

Blocker (resolved): AC4 (attribute by cwd) and AC7 (don't read bodies) were
mutually unsatisfiable — a non-running session's live cwd is only in its body,
and the directory slug ≠ encode(cwd) for ~8% of sampled sessions. Resolution:
AC4 attributes body-free by directory slug (segment-anchored, longest-root-
wins); AC7 is now explicitly two-phase (body-free triage + cap, then bounded
body reads for the emitted set only) and refines worktree/branch from the body
there.

Should-fixes (resolved in AC4/AC2): worktree segment nests below the worktree
root (take the segment after .claude/worktrees/, any depth); title fallback
must use the first TEXT block (not a leading image → base64), strip
system-reminder/command wrappers, skip meta/tool-result/spawned-agent turns,
and gate the sidecar-name fallback on nameSource != "derived".

Nits folded: segment vs string-prefix matching; "presence == running" phrasing
(no ps/subprocess); AC6 'HEAD'→null is defensive not verified; enumerate
*.jsonl only (dirs may hold a memory/ subdir); reuse public/index.html esc()
for XSS.

Grounding A1–A3 independently re-verified on disk 2026-08-04.
