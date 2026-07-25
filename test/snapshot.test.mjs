// Integration tests for scripts/snapshot.mjs (slice 002-03 AC5) against a
// throwaway project in a temp dir — fixtures stay pristine.
//
// Slice 005-01 (ADR-0004) moved the write target out of the surveyed project
// and into the dashboard-owned store. The behaviours asserted here — schema,
// append-only, auto mode, refuse-and-write-nothing, and the reader surfacing
// the newest entry — are unchanged; only the location moved, so these tests
// now point at the store instead of <project>/docs/status/.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { scanProject, snapshotFileFor } from '../src/scan.mjs';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'snapshot.mjs');
let tmp;
let store;

before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-snap-'));
  // Isolate the store so these tests never touch the real one.
  store = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-snap-store-'));
  process.env.DASHBOARD_SNAPSHOTS = store;
  fs.mkdirSync(path.join(tmp, 'docs', 'specs', '001-a'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'docs', 'specs', '001-a', 'spec.md'), '---\nstatus: DONE\n---\n# Spec 001: A\n');
});

after(() => {
  delete process.env.DASHBOARD_SNAPSHOTS;
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(store, { recursive: true, force: true });
});

// Pass the store explicitly rather than relying on inherited process.env —
// getting this wrong writes into the developer's real data folder.
const run = (args, opts = {}) =>
  execFileSync(process.execPath, args, {
    env: { ...process.env, DASHBOARD_SNAPSHOTS: store },
    ...opts,
  });

const cfg = () => ({ path: tmp, pinnedWorkstreams: [], hiddenWorkstreams: [] });
const historyFile = () => snapshotFileFor(tmp);

test('missing history file → compass null, no warnings (002-03 AC2)', () => {
  const p = scanProject(cfg());
  assert.equal(p.compass, null);
  assert.deepEqual(p.warnings, []);
});

test('snapshot.mjs appends a valid line with auto-filled specs (002-03 AC4+AC5)', () => {
  run([SCRIPT, '--project', tmp, '--headline', 'first', '--next', 'do x', '--blockers', 'a; b']);
  const lines = fs.readFileSync(historyFile(), 'utf8').trim().split('\n');
  assert.equal(lines.length, 1);
  const snap = JSON.parse(lines[0]);
  assert.equal(snap.v, 1);
  assert.equal(snap.headline, 'first');
  assert.deepEqual(snap.blockers, ['a', 'b']);
  assert.deepEqual(snap.specs, { done: 1, total: 1 });

  run([SCRIPT, '--project', tmp, '--headline', 'second']);
  const after2 = fs.readFileSync(historyFile(), 'utf8').trim().split('\n');
  assert.equal(after2.length, 2, 'append-only: second run adds a line');

  const p = scanProject(cfg());
  assert.equal(p.compass.headline, 'second');
  assert.equal(typeof p.compass.ageLabel, 'string');
  assert.equal(p.compass.stale, false);
});

test('snapshot.mjs --auto builds a deterministic headline and tags source (routine mode)', () => {
  run([SCRIPT, '--project', tmp, '--auto']);
  const lines = fs.readFileSync(historyFile(), 'utf8').trim().split('\n');
  const snap = JSON.parse(lines[lines.length - 1]);
  assert.equal(snap.source, 'auto');
  assert.match(snap.headline, /^auto: 1\/1 specs done/);
  assert.deepEqual(snap.specs, { done: 1, total: 1 });
});

test('snapshot.mjs refuses invalid input and writes nothing (002-03 AC4)', () => {
  const beforeText = fs.readFileSync(historyFile(), 'utf8');
  assert.throws(() => run([SCRIPT, '--project', tmp], { stdio: 'pipe' }));
  assert.throws(
    () => run([SCRIPT, '--project', tmp, '--headline', 'x', '--ts', 'garbage'], { stdio: 'pipe' })
  );
  assert.equal(fs.readFileSync(historyFile(), 'utf8'), beforeText, 'file unchanged after refusals');
});
