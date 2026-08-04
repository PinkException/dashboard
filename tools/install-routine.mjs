// The dashboard's routine installer (spec 006 / ADR-0005): this repo is the
// source of truth for the `compass-snapshots` scheduled routine, and a
// deliberate operator-run step copies it out to the live scheduler.
//
// Slice 006-01 ships the READ-ONLY `check` command only. The owner-gated
// `install` write path lands in 006-02.
//
//   node tools/install-routine.mjs check
//
// `check` compares the version-controlled source
// (prompts/compass-snapshots/SKILL.md) against the live scheduler copy at
// ~/.claude/scheduled-tasks/compass-snapshots/SKILL.md. It is read-only: it
// writes nothing, needs no approval (ADR-0005 draws the line at writes, not the
// directory), and exits non-zero on any drift so a caller can gate on it.
//
// The guardrail hook (~/.claude/hooks/guard-jig-prompts.py) denies the Write/Edit
// tools under ~/.claude/scheduled-tasks/ but not a Bash-run reader like this one
// (spec 006 A1) — and `check` reads only, so it is safe regardless.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expandHome } from '../src/scan.mjs';

const TASK_ID = 'compass-snapshots';
const SKILL_FILE = 'SKILL.md';

// Distinct exit codes so a caller can tell match from the kinds of drift, and
// drift from a tool misconfiguration (mirrors the night-worker installer's
// distinct-code discipline, ADR-0001 prior art).
export const EXIT = {
  MATCH: 0,
  DRIFT: 1, // live copy exists but differs from the repo source
  ABSENT: 2, // live copy is missing entirely
  SOURCE_MISSING: 3, // the repo source is missing — the tool is misconfigured
  USAGE: 4,
};

// tools/ sits directly under the repo root, so the source resolves from this
// file's own location — `check` works from any cwd.
function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

export function sourcePath() {
  return path.join(repoRoot(), 'prompts', TASK_ID, SKILL_FILE);
}

// The live scheduler dir: the real one by default, overridable via
// DASHBOARD_SCHEDULER_DIR so tests never touch it (mirrors DASHBOARD_SNAPSHOTS
// in scan.mjs — getting this wrong would read/compare the developer's live dir).
export function schedulerDir() {
  return expandHome(process.env.DASHBOARD_SCHEDULER_DIR || '~/.claude/scheduled-tasks');
}

export function livePath() {
  return path.join(schedulerDir(), TASK_ID, SKILL_FILE);
}

// Pure, read-only comparison. Returns a structured verdict and writes nothing.
// Exported so tests assert the decision directly rather than parsing stdout.
export function checkDrift({ source, live } = {}) {
  const src = source ?? sourcePath();
  const tgt = live ?? livePath();
  let sourceText;
  try {
    sourceText = fs.readFileSync(src, 'utf8');
  } catch {
    return { status: 'source-missing', source: src, target: tgt };
  }
  let liveText;
  try {
    liveText = fs.readFileSync(tgt, 'utf8');
  } catch {
    return { status: 'absent', source: src, target: tgt };
  }
  const status = sourceText === liveText ? 'match' : 'drift';
  return { status, source: src, target: tgt, sourceText, liveText };
}

// A minimal, dependency-free line diff for the drift report: the lines present
// in one side but not the other. Set-based rather than positional so a single
// insertion does not cascade into every following line reading as changed. Good
// enough to see *what* drifted; the installer is not a general diff tool.
export function formatDrift(sourceText, liveText) {
  const srcLines = new Set(sourceText.split('\n'));
  const liveLines = new Set(liveText.split('\n'));
  const out = [];
  for (const l of liveText.split('\n')) {
    if (!srcLines.has(l) && l.trim()) out.push(`  - ${l}`); // in live, not in source
  }
  for (const l of sourceText.split('\n')) {
    if (!liveLines.has(l) && l.trim()) out.push(`  + ${l}`); // in source, not in live
  }
  return out.length ? out.join('\n') : '  (no line-set difference — lines reordered or duplicated)';
}

function runCheck() {
  const r = checkDrift();
  if (r.status === 'source-missing') {
    console.error(`✗ routine source missing: ${r.source}`);
    return EXIT.SOURCE_MISSING;
  }
  if (r.status === 'absent') {
    console.error(`✗ live routine absent: ${r.target}`);
    console.error('  (no live copy yet — `install` lands it, slice 006-02)');
    return EXIT.ABSENT;
  }
  if (r.status === 'match') {
    console.log(`✓ live routine matches the repo source`);
    console.log(`  ${r.target}`);
    return EXIT.MATCH;
  }
  console.error('✗ drift: the live routine differs from the repo source');
  console.error(`  source: ${r.source}`);
  console.error(`  live:   ${r.target}`);
  console.error(formatDrift(r.sourceText, r.liveText));
  return EXIT.DRIFT;
}

// CLI entry (only when run directly, not when imported by tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cmd = process.argv[2];
  let code;
  if (cmd === 'check') {
    code = runCheck();
  } else {
    console.error('usage: node tools/install-routine.mjs check');
    console.error('  (the owner-gated `install` command lands in slice 006-02)');
    code = EXIT.USAGE;
  }
  process.exit(code);
}
