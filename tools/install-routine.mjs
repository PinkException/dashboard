// The dashboard's routine installer (spec 006 / ADR-0005): this repo is the
// source of truth for the `compass-snapshots` scheduled routine, and a
// deliberate operator-run step copies it out to the live scheduler.
//
//   node tools/install-routine.mjs check
//   node tools/install-routine.mjs install --approved-by-owner [--force]
//
// `check` compares the version-controlled source
// (prompts/compass-snapshots/SKILL.md) against the live scheduler copy at
// ~/.claude/scheduled-tasks/compass-snapshots/SKILL.md. It is read-only: it
// writes nothing, needs no approval (ADR-0005 draws the line at writes, not the
// directory), and exits non-zero on any drift so a caller can gate on it.
//
// `install` (006-02) is the owner-gated write path: it copies the source over
// the live target, verifies the copy byte-for-byte by reading it back, and
// records a manifest (sha256 of the installed content) at
// `<schedulerDir>/.dashboard-install.json` so a later run can tell "our own
// prior install" from a hand-edit or a pre-existing unmanaged file. Writing
// always requires `--approved-by-owner`, every run — the gate enforces the
// presence of the approval flag, not the owner's identity (ADR-0005
// Consequences: "depends on operator discipline plus the in-code approval
// flag"). A hand-edited or unmanaged live file is refused unless `--force`.
//
// The guardrail hook (~/.claude/hooks/guard-jig-prompts.py) denies the Write/Edit
// tools under ~/.claude/scheduled-tasks/ but not a Bash-run writer like this one
// (spec 006 A1) — the ADR draws the write gate in code instead.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
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
  NOT_APPROVED: 5, // install invoked without --approved-by-owner
  REFUSED: 6, // hand-edited or unmanaged live file, and --force was not given
  VERIFY_FAILED: 7, // the byte-for-byte read-back after copying did not match
};

// The manifest name, kept at the root of the scheduler dir (not inside
// compass-snapshots/) so it never collides with, or gets mistaken for, the
// routine content itself.
const MANIFEST_FILE = '.dashboard-install.json';

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

export function manifestPath() {
  return path.join(schedulerDir(), MANIFEST_FILE);
}

export function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

// A missing/corrupt/unreadable manifest is treated as "no manifest" — the
// expected first-run state, never a crash.
export function readManifest(mPath = manifestPath()) {
  try {
    const data = JSON.parse(fs.readFileSync(mPath, 'utf8'));
    return data && typeof data.sha256 === 'string' ? data : null;
  } catch {
    return null;
  }
}

export function writeManifest(hash, mPath = manifestPath()) {
  fs.mkdirSync(path.dirname(mPath), { recursive: true });
  fs.writeFileSync(
    mPath,
    JSON.stringify({ sha256: hash, installedAt: new Date().toISOString() }, null, 2) + '\n',
  );
}

// Pure decision function for AC3: given the state of the live file and the
// manifest, decide whether a write may proceed. Exported so the refuse logic
// can be reasoned about (and tested) independently of any filesystem I/O.
//   - no live file at all              -> proceed (clean slate, or manifest
//                                          points at a file since removed)
//   - live content already == source   -> noop (idempotent)
//   - manifest recorded hash != live   -> refuse: hand-edited
//   - no manifest, live differs        -> refuse: unmanaged
//   - manifest recorded hash == live,
//     but source has since changed     -> proceed (we own this file; upgrade)
export function planInstall({ liveExists, sourceText, liveText, manifest } = {}) {
  if (!liveExists) return { action: 'proceed' };
  if (sourceText === liveText) return { action: 'noop' };
  if (manifest) {
    if (sha256(liveText) !== manifest.sha256) return { action: 'refuse', reason: 'hand-edited' };
    return { action: 'proceed' };
  }
  return { action: 'refuse', reason: 'unmanaged' };
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

// The owner-gated write path (006-02 / ADR-0005). `approved` must be true
// (set only from the `--approved-by-owner` CLI flag) or nothing is written —
// every run, not just the first. `force` overrides a refusal for a
// hand-edited or unmanaged live file (AC3).
//
// `readBack` is a seam for the post-write byte-for-byte verification step
// only (AC2/AC5): it defaults to a real read of the just-written file, but a
// test can inject a function that returns different content to exercise the
// VERIFY_FAILED path without monkey-patching node:fs.
export function install({
  approved = false,
  force = false,
  sourcePath: srcP = sourcePath(),
  livePath: liveP = livePath(),
  manifestPath: mP = manifestPath(),
  readBack = (p) => fs.readFileSync(p, 'utf8'),
} = {}) {
  if (!approved) {
    console.error('✗ install not approved: rerun with --approved-by-owner (see ADR-0005)');
    console.error('  nothing was written');
    return EXIT.NOT_APPROVED;
  }

  let sourceText;
  try {
    sourceText = fs.readFileSync(srcP, 'utf8');
  } catch {
    console.error(`✗ routine source missing: ${srcP}`);
    return EXIT.SOURCE_MISSING;
  }

  let liveExists = true;
  let liveText;
  try {
    liveText = fs.readFileSync(liveP, 'utf8');
  } catch {
    liveExists = false;
  }

  const manifest = readManifest(mP);
  const plan = planInstall({ liveExists, sourceText, liveText, manifest });

  if (plan.action === 'noop') {
    // Includes the unmanaged-but-byte-identical case: no manifest, but the
    // live file already matches the source exactly. This is adopted (the
    // manifest is recorded) without requiring --force, because nothing is
    // actually overwritten — AC3 only gates *replacing* content we can't
    // prove is safe to lose, and there is no loss here.
    console.log('✓ already current — no write needed');
    console.log(`  ${liveP}`);
    const hash = sha256(sourceText);
    if (!manifest || manifest.sha256 !== hash) writeManifest(hash, mP);
    return EXIT.MATCH;
  }

  if (plan.action === 'refuse' && !force) {
    const why =
      plan.reason === 'hand-edited'
        ? 'the live file has been hand-edited since the last install'
        : 'an unmanaged file already exists at the live path (no install manifest)';
    console.error(`✗ install refused: ${why}`);
    console.error(`  ${liveP}`);
    if (liveExists) console.error(formatDrift(sourceText, liveText));
    console.error('  use --force to override');
    return EXIT.REFUSED;
  }

  // Proceed: either the plan said so outright, or a refusal was overridden
  // with --force.
  fs.mkdirSync(path.dirname(liveP), { recursive: true });
  fs.writeFileSync(liveP, sourceText);
  fs.chmodSync(liveP, 0o644); // scheduler-readable

  const readBackText = readBack(liveP);
  if (readBackText !== sourceText) {
    console.error('✗ verify failed: the read-back after copying did not match the source');
    console.error(`  ${liveP}`);
    return EXIT.VERIFY_FAILED;
  }

  writeManifest(sha256(sourceText), mP);
  console.log('✓ installed');
  console.log(`  ${liveP}`);
  return EXIT.MATCH;
}

// CLI entry (only when run directly, not when imported by tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cmd = process.argv[2];
  let code;
  if (cmd === 'check') {
    code = runCheck();
  } else if (cmd === 'install') {
    const approved = process.argv.includes('--approved-by-owner');
    const force = process.argv.includes('--force');
    code = install({ approved, force });
  } else {
    console.error('usage: node tools/install-routine.mjs check');
    console.error('       node tools/install-routine.mjs install --approved-by-owner [--force]');
    code = EXIT.USAGE;
  }
  process.exit(code);
}
