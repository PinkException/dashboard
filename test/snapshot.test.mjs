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
import { validateSnapshot } from '../src/lib.mjs';

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

test('snapshot.mjs tags a manual entry source:manual by default (005-03 AC1)', () => {
  run([SCRIPT, '--project', tmp, '--headline', 'plain manual']);
  const lines = fs.readFileSync(historyFile(), 'utf8').trim().split('\n');
  const snap = JSON.parse(lines[lines.length - 1]);
  assert.equal(snap.headline, 'plain manual');
  assert.equal(snap.source, 'manual', 'default provenance unchanged when --source absent');
});

test('snapshot.mjs --source overrides the provenance tag (005-03 AC1)', () => {
  run([SCRIPT, '--project', tmp, '--headline', 'sessions-panel 003 ready to implement', '--source', 'dashboard']);
  const lines = fs.readFileSync(historyFile(), 'utf8').trim().split('\n');
  const snap = JSON.parse(lines[lines.length - 1]);
  assert.equal(snap.source, 'dashboard', 'skill-authored entries are tagged source:dashboard');
  assert.equal(snap.headline, 'sessions-panel 003 ready to implement');
  assert.deepEqual(validateSnapshot(snap), [], 'the tagged line still validates');
});

test('snapshot.mjs ignores a bare --source with no value (005-03 AC1)', () => {
  // `--source` as the last arg parses to boolean true; the guard must reject it
  // and leave the default provenance tag standing, not write `source: true`.
  run([SCRIPT, '--project', tmp, '--headline', 'bare source flag', '--source']);
  const lines = fs.readFileSync(historyFile(), 'utf8').trim().split('\n');
  const snap = JSON.parse(lines[lines.length - 1]);
  assert.equal(snap.headline, 'bare source flag');
  assert.equal(snap.source, 'manual', 'bare --source is ignored; default tag stands');
});

test('snapshot.mjs refuses invalid input and writes nothing (002-03 AC4)', () => {
  const beforeText = fs.readFileSync(historyFile(), 'utf8');
  assert.throws(() => run([SCRIPT, '--project', tmp], { stdio: 'pipe' }));
  assert.throws(
    () => run([SCRIPT, '--project', tmp, '--headline', 'x', '--ts', 'garbage'], { stdio: 'pipe' })
  );
  assert.equal(fs.readFileSync(historyFile(), 'utf8'), beforeText, 'file unchanged after refusals');
});

// --- slice 005-04: on-change cadence (--if-changed) ---
// Each test builds its own project dir so its store file (keyed by path) is
// isolated from the shared-project tests above; the store dir itself is reused.
const projects = [];
function freshProject(specs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-snap-proj-'));
  projects.push(dir);
  specs.forEach(({ id, status }, i) => {
    const d = path.join(dir, 'docs', 'specs', id);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'spec.md'), `---\nstatus: ${status}\n---\n# Spec ${i}\n`);
  });
  return dir;
}
after(() => projects.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));
const lineCount = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).length : 0);

test('--if-changed writes the first entry when the store is empty (005-04 AC2)', () => {
  const proj = freshProject([{ id: '001-a', status: 'DONE' }]);
  const store = snapshotFileFor(proj);
  const out = run([SCRIPT, '--project', proj, '--auto', '--if-changed']).toString();
  assert.equal(lineCount(store), 1, 'no baseline → writes');
  assert.match(out, /✓/);
});

test('--if-changed skips when the progress signature is unchanged (005-04 AC2)', () => {
  const proj = freshProject([{ id: '001-a', status: 'DONE' }]);
  const store = snapshotFileFor(proj);
  run([SCRIPT, '--project', proj, '--auto', '--if-changed']);
  const out = run([SCRIPT, '--project', proj, '--auto', '--if-changed']).toString();
  assert.equal(lineCount(store), 1, 'unchanged progress → no second line');
  assert.match(out, /unchanged \(no new entry\)/);
});

test('--if-changed writes when spec progress actually changes (005-04 AC2)', () => {
  const proj = freshProject([{ id: '001-a', status: 'DONE' }]);
  const store = snapshotFileFor(proj);
  run([SCRIPT, '--project', proj, '--auto', '--if-changed']); // 1/1
  // A new IN_PROGRESS spec moves done/total and adds an active spec → changed.
  const d = path.join(proj, 'docs', 'specs', '002-b');
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'spec.md'), '---\nstatus: IN_PROGRESS\n---\n# Spec 002\n');
  run([SCRIPT, '--project', proj, '--auto', '--if-changed']);
  assert.equal(lineCount(store), 2, 'progress changed → second line written');
});

test('--if-changed ignores open-bug churn (progress signature excludes bugs) (005-04 AC2)', () => {
  const proj = freshProject([{ id: '001-a', status: 'DONE' }]);
  const store = snapshotFileFor(proj);
  run([SCRIPT, '--project', proj, '--auto', '--if-changed']);
  // Open a bug: the auto headline would now read "… · 1 open bug(s)", but the
  // change signature is progress-only, so this must NOT create a new point.
  const bugs = path.join(proj, 'docs', 'bugs');
  fs.mkdirSync(bugs, { recursive: true });
  fs.writeFileSync(path.join(bugs, '001-x.md'), '# Bug\nno closed status → open\n');
  const out = run([SCRIPT, '--project', proj, '--auto', '--if-changed']).toString();
  assert.equal(lineCount(store), 1, 'a bug wiggle is not a progress change');
  assert.match(out, /unchanged/);
});

test('--if-changed compares within the same source; a narrative entry does not reset the auto baseline (005-04 AC2)', () => {
  const proj = freshProject([{ id: '001-a', status: 'DONE' }]);
  const store = snapshotFileFor(proj);
  run([SCRIPT, '--project', proj, '--auto', '--if-changed']); // auto baseline: next=null
  // The interleaved narrative carries a DIFFERENT progress signature (its own
  // `next`), so a source-BLIND implementation — comparing the third auto run
  // against the newest line regardless of source — would see a difference and
  // wrongly write a third line. Only same-source comparison (auto-vs-auto,
  // next=null both sides) correctly skips. This makes the test non-vacuous.
  run([SCRIPT, '--project', proj, '--headline', 'human prose', '--next', 'refresh the narrative', '--source', 'dashboard']);
  const out = run([SCRIPT, '--project', proj, '--auto', '--if-changed']).toString();
  assert.equal(lineCount(store), 2, 'the auto run still skips — it compares to the last auto entry, not the narrative one');
  assert.match(out, /unchanged/);
});

test('an auto run writes only to the store, never into the surveyed repo (005-04 AC1)', () => {
  const proj = freshProject([{ id: '001-a', status: 'DONE' }]);
  run([SCRIPT, '--project', proj, '--auto', '--if-changed']);
  // The one non-negotiable: no `--commit`, no in-repo write. The legacy in-repo
  // path must not be created by a routine run.
  assert.equal(fs.existsSync(path.join(proj, 'docs', 'status')), false, 'no docs/status/ written into the surveyed project');
  assert.equal(lineCount(snapshotFileFor(proj)), 1, 'the entry lands in the dashboard-owned store instead');
});

test('the card prefers a legacy in-repo narrative over a newer store auto entry (005-04 AC4, cross-source)', () => {
  const proj = freshProject([{ id: '001-a', status: 'DONE' }]);
  // Simulate an un-migrated legacy in-repo narrative (older) alongside a newer
  // store auto entry — exercises laterSnapshot over the two sources' narrative
  // selections, not just the single-source path.
  const inRepo = path.join(proj, 'docs', 'status', 'compass-history.jsonl');
  fs.mkdirSync(path.dirname(inRepo), { recursive: true });
  fs.writeFileSync(inRepo, JSON.stringify({ v: 1, ts: '2026-08-01T08:00:00Z', headline: 'legacy prose from the repo', specs: { done: 1, total: 1 } }) + '\n');
  run([SCRIPT, '--project', proj, '--auto', '--ts', '2026-08-02T05:00:00Z']);
  const p = scanProject({ path: proj, pinnedWorkstreams: [], hiddenWorkstreams: [] });
  assert.equal(p.compass.headline, 'legacy prose from the repo', 'a newer store auto entry does not bury the in-repo narrative');
});

test('the card shows the narrative headline even when a newer auto entry exists (005-04 AC4)', () => {
  const proj = freshProject([{ id: '001-a', status: 'DONE' }]);
  // Narrative first (older ts), then a newer deterministic auto entry.
  run([SCRIPT, '--project', proj, '--headline', 'sessions panel ready to implement', '--source', 'dashboard', '--ts', '2026-08-01T08:00:00Z']);
  run([SCRIPT, '--project', proj, '--auto', '--ts', '2026-08-02T05:00:00Z']);
  const p = scanProject({ path: proj, pinnedWorkstreams: [], hiddenWorkstreams: [] });
  assert.equal(p.compass.headline, 'sessions panel ready to implement', 'auto series does not bury the prose headline');
  assert.equal(p.compass.source, 'dashboard');
});

// --- slice 007-01: graceful config-missing message ---
// A fresh plugin install has run the routine before ever creating a config.
// DASHBOARD_CONFIG always points at a throwaway temp path here, never the
// developer's real ~/.claude/my-dashboard/config.json.
test('snapshot.mjs --all --auto --if-changed with no config: clean non-zero exit, friendly pointer, no fs stack trace (007-01 AC2)', () => {
  const missingConfig = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dash-noconfig-')), 'config.json');
  let threw = false;
  let stderr = '';
  try {
    run([SCRIPT, '--all', '--auto', '--if-changed'], {
      env: { ...process.env, DASHBOARD_SNAPSHOTS: store, DASHBOARD_CONFIG: missingConfig },
      stdio: 'pipe',
    });
  } catch (err) {
    threw = true;
    stderr = err.stderr.toString();
  }
  assert.ok(threw, 'exits non-zero when the config is missing');
  assert.match(stderr, /config not found/i);
  assert.match(stderr, /\/dashboard:open/, 'friendly message points at /dashboard:open');
  assert.ok(stderr.includes(missingConfig), 'message names the resolved missing path');
  assert.ok(!/at Object\.readFileSync/.test(stderr), 'no node:fs stack frame leaked');
  assert.ok(!/node:fs/.test(stderr), 'no node:fs stack frame leaked');
  assert.ok(!/ENOENT/.test(stderr), 'raw ENOENT is not the primary signal');
});

test('snapshot.mjs --all --auto with a present, valid config still works (007-01 AC4)', () => {
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-hasconfig-'));
  const configPath = path.join(configDir, 'config.json');
  const proj = freshProject([{ id: '001-a', status: 'DONE' }]);
  fs.writeFileSync(configPath, JSON.stringify({ projects: [{ path: proj }] }));
  const out = run([SCRIPT, '--all', '--auto', '--if-changed'], {
    env: { ...process.env, DASHBOARD_SNAPSHOTS: store, DASHBOARD_CONFIG: configPath },
  }).toString();
  assert.match(out, /✓/);
  assert.equal(lineCount(snapshotFileFor(proj)), 1);
});
