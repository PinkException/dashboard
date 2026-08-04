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
import { checkDrift, sourcePath, EXIT, formatDrift } from '../tools/install-routine.mjs';

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
    execFileSync(process.execPath, [TOOL, 'install'], { encoding: 'utf8' });
    code = 0;
  } catch (e) {
    code = e.status;
    assert.match((e.stdout || '') + (e.stderr || ''), /usage/i);
    assert.match((e.stdout || '') + (e.stderr || ''), /006-02/, 'points at the slice that adds install');
  }
  assert.equal(code, EXIT.USAGE, 'unknown/unimplemented command → usage exit');
});
