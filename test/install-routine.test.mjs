// Tests for tools/install-routine.mjs `check` (slice 006-01). The command is
// read-only: it compares the version-controlled routine source against the live
// scheduler copy and reports match / drift / absent, writing nothing. Every test
// points the scheduler dir at a temp directory so the developer's real
// ~/.claude/scheduled-tasks is never read or touched.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  checkDrift,
  sourcePath,
  EXIT,
  formatDrift,
  install,
  manifestPath,
  readManifest,
  sha256,
} from '../tools/install-routine.mjs';

const TOOL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'tools', 'install-routine.mjs');
const tmps = [];
function tempSchedulerDir(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-sched-'));
  tmps.push(dir);
  if (content !== undefined) {
    const d = path.join(dir, 'compass-snapshots');
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'SKILL.md'), content);
  }
  return dir;
}
after(() => tmps.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

const SRC = () => fs.readFileSync(sourcePath(), 'utf8');

test('the routine source states the 005-04 behaviour and drops the leak (006-01 AC1)', () => {
  const text = SRC();
  assert.match(text, /node scripts\/snapshot\.mjs --all --auto --if-changed/, 'invokes the on-change auto routine');
  // The prose may name --commit to prohibit it; what must not exist is an actual
  // `node scripts/... --commit` invocation (the bug-002 in-repo write).
  assert.doesNotMatch(text, /node scripts\/snapshot\.mjs[^\n]*--commit/, 'no live --commit invocation');
  assert.match(text, /adr-0004/i, 'cites ADR-0004 as the contract');
  assert.doesNotMatch(text, /adr-0002/i, 'does not name the superseded ADR-0002');
  assert.doesNotMatch(text, /project-dashboard/, 'never names the abandoned path');
  assert.doesNotMatch(text, /\/Users\//, 'no literal home-directory path (leak gate)');
});

test('checkDrift → match when the live copy equals the source (006-01 AC3)', () => {
  const dir = tempSchedulerDir(SRC());
  const r = checkDrift({ live: path.join(dir, 'compass-snapshots', 'SKILL.md') });
  assert.equal(r.status, 'match');
});

test('checkDrift → drift when the live copy differs (006-01 AC3)', () => {
  const dir = tempSchedulerDir(SRC() + '\nHAND EDITED LINE\n');
  const r = checkDrift({ live: path.join(dir, 'compass-snapshots', 'SKILL.md') });
  assert.equal(r.status, 'drift');
  assert.match(formatDrift(r.sourceText, r.liveText), /HAND EDITED LINE/, 'the diff shows what differs');
});

test('checkDrift → absent when the live copy is missing (006-01 AC3)', () => {
  const dir = tempSchedulerDir(); // no file written
  const r = checkDrift({ live: path.join(dir, 'compass-snapshots', 'SKILL.md') });
  assert.equal(r.status, 'absent');
});

test('checkDrift → source-missing when the repo source path is wrong', () => {
  const dir = tempSchedulerDir(SRC());
  const r = checkDrift({
    source: path.join(dir, 'does-not-exist.md'),
    live: path.join(dir, 'compass-snapshots', 'SKILL.md'),
  });
  assert.equal(r.status, 'source-missing');
});

test('check writes nothing — the live copy is byte-for-byte unchanged (006-01 AC3)', () => {
  const dir = tempSchedulerDir(SRC() + '\nDRIFTED\n');
  const target = path.join(dir, 'compass-snapshots', 'SKILL.md');
  const before = fs.readFileSync(target);
  checkDrift({ live: target });
  assert.deepEqual(fs.readFileSync(target), before, 'read-only: target untouched');
  // And no stray files were created anywhere under the temp scheduler dir.
  assert.deepEqual(fs.readdirSync(path.join(dir, 'compass-snapshots')), ['SKILL.md']);
});

// CLI integration: exit codes are the contract a scheduler/caller gates on.
const runCli = (schedulerDir) => {
  try {
    const stdout = execFileSync(process.execPath, [TOOL, 'check'], {
      env: { ...process.env, DASHBOARD_SCHEDULER_DIR: schedulerDir },
      encoding: 'utf8',
    });
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.status, stdout: (e.stdout || '') + (e.stderr || '') };
  }
};

test('CLI `check` exits 0 and says match when live equals source (006-01 AC3/AC4)', () => {
  const dir = tempSchedulerDir(SRC());
  const { code, stdout } = runCli(dir);
  assert.equal(code, EXIT.MATCH);
  assert.match(stdout, /matches the repo source/);
});

test('CLI `check` exits non-zero on drift and shows the difference (006-01 AC3)', () => {
  const dir = tempSchedulerDir(SRC() + '\nHAND EDITED\n');
  const { code, stdout } = runCli(dir);
  assert.equal(code, EXIT.DRIFT);
  assert.match(stdout, /drift/);
  assert.match(stdout, /HAND EDITED/);
});

test('CLI `check` exits with the absent code when the live copy is missing (006-01 AC3)', () => {
  const dir = tempSchedulerDir();
  const { code, stdout } = runCli(dir);
  assert.equal(code, EXIT.ABSENT);
  assert.match(stdout, /absent/);
});

test('CLI runs `check` with no approval flag, non-interactively (006-01 AC4)', () => {
  // AC4: reads are free — no owner-approval flag, no prompt. The command above
  // is invoked with only `check` (no --approved-by-owner) and never blocks.
  const dir = tempSchedulerDir(SRC());
  const { code } = runCli(dir);
  assert.equal(code, EXIT.MATCH, 'check needs no approval and does not prompt');
});

test('CLI rejects an unknown command with the usage exit code', () => {
  let code;
  try {
    execFileSync(process.execPath, [TOOL, 'frobnicate'], { encoding: 'utf8' });
    code = 0;
  } catch (e) {
    code = e.status;
    assert.match((e.stdout || '') + (e.stderr || ''), /usage/i);
  }
  assert.equal(code, EXIT.USAGE, 'unknown command → usage exit');
});

// ---------------------------------------------------------------------------
// `install` (006-02): the owner-gated write path. Every test below drives the
// exported `install()` function directly (not the CLI subprocess) with
// explicit source/live/manifest paths under a fresh temp dir, so the
// developer's real ~/.claude/scheduled-tasks is never at risk even if a test
// is wrong.
// ---------------------------------------------------------------------------

function tempInstallPaths(opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-install-'));
  tmps.push(dir);
  const live = path.join(dir, 'compass-snapshots', 'SKILL.md');
  const manifest = path.join(dir, '.dashboard-install.json');
  if (opts.liveContent !== undefined) {
    fs.mkdirSync(path.dirname(live), { recursive: true });
    fs.writeFileSync(live, opts.liveContent);
  }
  if (opts.manifestHash !== undefined) {
    fs.writeFileSync(manifest, JSON.stringify({ sha256: opts.manifestHash }));
  }
  return { dir, live, manifest };
}

test('install refuses without --approved-by-owner: writes nothing (006-02 AC1)', () => {
  const { live, manifest } = tempInstallPaths();
  const code = install({ approved: false, livePath: live, manifestPath: manifest });
  assert.equal(code, EXIT.NOT_APPROVED);
  assert.equal(fs.existsSync(live), false, 'no live file written');
  assert.equal(fs.existsSync(manifest), false, 'no manifest written');
});

test('install --approved-by-owner: clean first install lands the file + manifest (006-02 AC2)', () => {
  const { live, manifest } = tempInstallPaths();
  const code = install({ approved: true, livePath: live, manifestPath: manifest });
  assert.equal(code, EXIT.MATCH);
  assert.equal(fs.readFileSync(live, 'utf8'), fs.readFileSync(sourcePath(), 'utf8'), 'live == source');
  const m = readManifest(manifest);
  assert.equal(m.sha256, sha256(fs.readFileSync(sourcePath(), 'utf8')), 'manifest records the installed hash');
});

test('install refuses an unmanaged pre-existing file without --force (006-02 AC3)', () => {
  const { live, manifest } = tempInstallPaths({ liveContent: 'unmanaged stray content\n' });
  const code = install({ approved: true, livePath: live, manifestPath: manifest });
  assert.equal(code, EXIT.REFUSED);
  assert.equal(fs.readFileSync(live, 'utf8'), 'unmanaged stray content\n', 'live untouched');
  assert.equal(fs.existsSync(manifest), false, 'no manifest written on refusal');
});

test('install --force adopts an unmanaged pre-existing file (006-02 AC3)', () => {
  const { live, manifest } = tempInstallPaths({ liveContent: 'unmanaged stray content\n' });
  const code = install({ approved: true, force: true, livePath: live, manifestPath: manifest });
  assert.equal(code, EXIT.MATCH);
  assert.equal(fs.readFileSync(live, 'utf8'), fs.readFileSync(sourcePath(), 'utf8'));
  assert.ok(readManifest(manifest), 'manifest now recorded');
});

test('install refuses a hand-edited file without --force (006-02 AC3)', () => {
  const srcText = fs.readFileSync(sourcePath(), 'utf8');
  const installedHash = sha256(srcText);
  const { live, manifest } = tempInstallPaths({
    liveContent: srcText + '\nHAND EDITED\n',
    manifestHash: installedHash,
  });
  const code = install({ approved: true, livePath: live, manifestPath: manifest });
  assert.equal(code, EXIT.REFUSED);
  assert.match(fs.readFileSync(live, 'utf8'), /HAND EDITED/, 'live untouched');
});

test('install --force overrides a hand-edited refusal (006-02 AC3)', () => {
  const srcText = fs.readFileSync(sourcePath(), 'utf8');
  const installedHash = sha256(srcText);
  const { live, manifest } = tempInstallPaths({
    liveContent: srcText + '\nHAND EDITED\n',
    manifestHash: installedHash,
  });
  const code = install({ approved: true, force: true, livePath: live, manifestPath: manifest });
  assert.equal(code, EXIT.MATCH);
  assert.equal(fs.readFileSync(live, 'utf8'), srcText, 'live now matches source');
});

test('install exits VERIFY_FAILED when the post-write read-back does not match (006-02 AC2)', () => {
  const { live, manifest } = tempInstallPaths();
  const code = install({
    approved: true,
    livePath: live,
    manifestPath: manifest,
    // Seam: the read-back step uses this instead of fs.readFileSync, so a test
    // can force a mismatch without monkey-patching the real fs module.
    readBack: () => 'corrupted-on-the-way-in\n',
  });
  assert.equal(code, EXIT.VERIFY_FAILED);
});

test('install is idempotent: re-running a clean install is a no-op, no rewrite (006-02 AC4)', () => {
  const { live, manifest } = tempInstallPaths();
  const first = install({ approved: true, livePath: live, manifestPath: manifest });
  assert.equal(first, EXIT.MATCH);
  const liveContentAfterFirst = fs.readFileSync(live);
  const manifestContentAfterFirst = fs.readFileSync(manifest, 'utf8');
  const liveMtimeAfterFirst = fs.statSync(live).mtimeMs;

  const second = install({ approved: true, livePath: live, manifestPath: manifest });
  assert.equal(second, EXIT.MATCH);
  assert.deepEqual(fs.readFileSync(live), liveContentAfterFirst, 'live unchanged');
  assert.equal(fs.statSync(live).mtimeMs, liveMtimeAfterFirst, 'live not rewritten (mtime stable)');
  assert.equal(fs.readFileSync(manifest, 'utf8'), manifestContentAfterFirst, 'manifest not churned');
});

test('install exits SOURCE_MISSING when the repo source path is wrong, writes nothing (006-02 AC2)', () => {
  const { dir, live, manifest } = tempInstallPaths();
  const code = install({
    approved: true,
    sourcePath: path.join(dir, 'does-not-exist.md'),
    livePath: live,
    manifestPath: manifest,
  });
  assert.equal(code, EXIT.SOURCE_MISSING);
  assert.equal(fs.existsSync(live), false);
});

// CLI wiring: the install command dispatches to the same logic via argv flags.
test('CLI `install` refuses without --approved-by-owner and exits NOT_APPROVED (006-02 AC1)', () => {
  const dir = tempSchedulerDir(); // no live file
  let code;
  let output = '';
  try {
    execFileSync(process.execPath, [TOOL, 'install'], {
      env: { ...process.env, DASHBOARD_SCHEDULER_DIR: dir },
      encoding: 'utf8',
    });
    code = 0;
  } catch (e) {
    code = e.status;
    output = (e.stdout || '') + (e.stderr || '');
  }
  assert.equal(code, EXIT.NOT_APPROVED);
  assert.match(output, /not approved/i);
  assert.equal(fs.existsSync(path.join(dir, 'compass-snapshots', 'SKILL.md')), false);
});

test('CLI `install --approved-by-owner` lands a clean install (006-02 AC2/AC5)', () => {
  const dir = tempSchedulerDir(); // no live file
  const { code } = (() => {
    try {
      const stdout = execFileSync(process.execPath, [TOOL, 'install', '--approved-by-owner'], {
        env: { ...process.env, DASHBOARD_SCHEDULER_DIR: dir },
        encoding: 'utf8',
      });
      return { code: 0, stdout };
    } catch (e) {
      return { code: e.status, stdout: (e.stdout || '') + (e.stderr || '') };
    }
  })();
  assert.equal(code, EXIT.MATCH);
  assert.equal(
    fs.readFileSync(path.join(dir, 'compass-snapshots', 'SKILL.md'), 'utf8'),
    SRC(),
  );
});

// ---------------------------------------------------------------------------
// Coverage added after compliance/craft review (post-006-02 first pass): file
// mode, the managed-upgrade write path, live-absent-with-manifest, and the
// CLI --force argv path. planInstall()'s decision logic is unchanged — these
// close gaps in what was tested, per the refined AC3/AC6 write-decision table.
// ---------------------------------------------------------------------------

test('install sets a scheduler-readable file mode, 0o644, even under a restrictive umask (006-02 AC2/AC6)', () => {
  const { live, manifest } = tempInstallPaths();
  // Force a strict umask so a plain writeFileSync (no explicit chmod) would
  // land at 0o600, not 0o644 — otherwise this assertion is vacuous on any dev
  // machine whose default umask already happens to produce 0o644.
  const prevUmask = process.umask(0o077);
  try {
    const code = install({ approved: true, livePath: live, manifestPath: manifest });
    assert.equal(code, EXIT.MATCH);
    const mode = fs.statSync(live).mode & 0o777;
    assert.equal(mode, 0o644, 'installed file is scheduler-readable (0o644) regardless of umask');
  } finally {
    process.umask(prevUmask);
  }
});

test('install proceeds without --force on a managed upgrade: manifest matches live, but the current source has moved (006-02 AC3)', () => {
  const { dir, live, manifest } = tempInstallPaths();
  const oldContent = 'OLD ROUTINE CONTENT v1\n';
  const newContent = 'NEW ROUTINE CONTENT v2\n';
  fs.mkdirSync(path.dirname(live), { recursive: true });
  fs.writeFileSync(live, oldContent);
  fs.writeFileSync(manifest, JSON.stringify({ sha256: sha256(oldContent) }));
  const srcFile = path.join(dir, 'source.md');
  fs.writeFileSync(srcFile, newContent);

  const code = install({ approved: true, sourcePath: srcFile, livePath: live, manifestPath: manifest });
  assert.equal(code, EXIT.MATCH, 'managed upgrade proceeds without --force');
  assert.equal(fs.readFileSync(live, 'utf8'), newContent, 'live rewritten to the new source');
  assert.equal(readManifest(manifest).sha256, sha256(newContent), 'manifest updated to the new hash');
});

test('install proceeds without --force when the live file is absent but a manifest still exists (006-02 AC3)', () => {
  const { live, manifest } = tempInstallPaths({ manifestHash: sha256('whatever was last installed\n') });
  // live intentionally not created — a manifest pointing at a since-removed file.
  assert.equal(fs.existsSync(live), false);
  const code = install({ approved: true, livePath: live, manifestPath: manifest });
  assert.equal(code, EXIT.MATCH, 'proceeds — nothing to overwrite');
  assert.equal(fs.readFileSync(live, 'utf8'), fs.readFileSync(sourcePath(), 'utf8'), 'file re-landed');
});

test('CLI `install --approved-by-owner --force` adopts an unmanaged stray file (006-02 AC3/AC6)', () => {
  const dir = tempSchedulerDir('unmanaged stray content\n');
  const { code } = (() => {
    try {
      const stdout = execFileSync(process.execPath, [TOOL, 'install', '--approved-by-owner', '--force'], {
        env: { ...process.env, DASHBOARD_SCHEDULER_DIR: dir },
        encoding: 'utf8',
      });
      return { code: 0, stdout };
    } catch (e) {
      return { code: e.status, stdout: (e.stdout || '') + (e.stderr || '') };
    }
  })();
  assert.equal(code, EXIT.MATCH);
  assert.equal(fs.readFileSync(path.join(dir, 'compass-snapshots', 'SKILL.md'), 'utf8'), SRC());
});
