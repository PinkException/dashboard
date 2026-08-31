import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanProject, loadConfig, ConfigMissingError } from '../src/scan.mjs';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

// Slice 005-01: scanProject now also reads the dashboard-owned snapshot store.
// Pin it to an empty temp dir — a fixture scan must never reach into the
// developer's real ~/.claude/my-dashboard/, or the suite's result depends on
// whose machine it runs on.
const STORE = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-scan-store-'));
process.env.DASHBOARD_SNAPSHOTS = STORE;
after(() => fs.rmSync(STORE, { recursive: true, force: true }));

const jig = () =>
  scanProject({
    path: path.join(FIXTURES, 'proj-jig'),
    label: 'fixture project',
    pinnedWorkstreams: ['docs/runbook-widget.md'],
    hiddenWorkstreams: [],
  });

test('scanProject: spec statuses and honest progress (002-01 AC1+AC2)', () => {
  const p = jig();
  assert.equal(p.jigManaged, true);
  assert.equal(p.specs.length, 4);
  const s2 = p.specs.find((s) => s.id === '002-b');
  assert.equal(s2.status, 'IN_PROGRESS');
  assert.equal(s2.slices.length, 3);
  assert.deepEqual(s2.slices[1].dependencies, ['002-01']);
  // 2 DONE / (4 − 1 ABANDONED) = 67%
  assert.equal(p.progress.done, 2);
  assert.equal(p.progress.abandoned, 1);
  assert.equal(p.progress.pct, 67);
  // slices: DONE, DONE, IN_PROGRESS, DEFERRED → 2/4, deferred reported
  assert.equal(p.sliceProgress.done, 2);
  assert.equal(p.sliceProgress.deferred, 1);
});

test('scanProject: counts — bugs (README excluded), inbox, refinement, adrs (002-01 AC4)', () => {
  const p = jig();
  assert.deepEqual(p.counts.bugs, { open: 1, total: 2 });
  assert.equal(p.counts.inbox, 2);
  assert.deepEqual(p.counts.refinement, { open: 2, total: 3 });
  assert.equal(p.counts.adrs, 1);
});

test('scanProject: non-jig project degrades gracefully (002-01 AC3)', () => {
  const p = scanProject({ path: path.join(FIXTURES, 'proj-plain'), label: 'plain', pinnedWorkstreams: [], hiddenWorkstreams: [] });
  assert.equal(p.jigManaged, false);
  assert.equal(p.specs, undefined);
});

test('scanProject: missing path is an error entry, not a crash', () => {
  const p = scanProject({ path: path.join(FIXTURES, 'does-not-exist'), pinnedWorkstreams: [], hiddenWorkstreams: [] });
  assert.ok(p.error);
});

// --- spec 009-01: optional per-project description subtitle ---

test('scanProject: description is surfaced verbatim when present in config (009-01 AC2)', () => {
  const p = scanProject({
    path: path.join(FIXTURES, 'proj-jig'),
    label: 'fixture project',
    description: 'hiking route planner',
    pinnedWorkstreams: [],
    hiddenWorkstreams: [],
  });
  assert.equal(p.description, 'hiking route planner');
});

test('scanProject: description is omitted (not null/empty), no error, when absent (009-01 AC2)', () => {
  const p = jig();
  assert.equal(p.description, undefined);
  assert.ok(!('description' in p), 'absent description must be omitted, not a null/empty key');
});

test('scanProject: description surfaces even for a missing-path error entry (009-01 AC2)', () => {
  const p = scanProject({
    path: path.join(FIXTURES, 'does-not-exist'),
    description: 'still shown',
    pinnedWorkstreams: [],
    hiddenWorkstreams: [],
  });
  assert.ok(p.error);
  assert.equal(p.description, 'still shown');
});

test('workstreams: releases + pinned runbook parsed, README excluded (002-02 AC1+AC2)', () => {
  const p = jig();
  const release = p.workstreams.find((w) => w.kind === 'release');
  assert.equal(release.title, 'V1 launch plan');
  assert.deepEqual(release.steps, { done: 1, total: 3 });
  assert.equal(p.workstreams.filter((w) => w.kind === 'release').length, 1);
  const runbook = p.workstreams.find((w) => w.kind === 'runbook');
  assert.equal(runbook.steps.total, 3);
  assert.equal(runbook.next.owner, 'you');
  assert.match(runbook.currentPhase, /Phase A/);
});

test('workstreams: discovery excludes specs/releases/pinned (002-02 AC3)', () => {
  const p = jig();
  assert.equal(p.discovered.length, 0); // the only checkbox doc outside specs/releases is pinned
  const unpinned = scanProject({ path: path.join(FIXTURES, 'proj-jig'), pinnedWorkstreams: [], hiddenWorkstreams: [] });
  assert.equal(unpinned.discovered.length, 1);
  assert.equal(unpinned.discovered[0].path, path.join('docs', 'runbook-widget.md'));
  const hiddenCfg = scanProject({ path: path.join(FIXTURES, 'proj-jig'), pinnedWorkstreams: [], hiddenWorkstreams: [path.join('docs', 'runbook-widget.md')] });
  assert.equal(hiddenCfg.discovered.length, 0);
});

test('workstreams: discovery excludes docs/bugs even with checklists (002-02 AC3)', () => {
  const p = jig();
  assert.ok(!p.discovered.some((d) => d.path.includes('bugs')));
  assert.ok(!p.workstreams.some((w) => w.path.includes('bugs')));
});

test('worktree-only docs flagged by path comparison (002-02 AC4)', () => {
  const p = jig();
  assert.equal(p.worktreeOnlyDocs.length, 1);
  assert.equal(p.worktreeOnlyDocs[0].worktree, 'wt-lost');
  assert.equal(p.worktreeOnlyDocs[0].path, path.join('docs', 'notes', 'lost-doc.md'));
});

test('compass: latest valid snapshot surfaces, malformed line warns (002-03 AC2)', () => {
  const p = jig();
  assert.equal(p.compass.headline, 'beta is close');
  assert.equal(p.compass.next, 'finish slice 002-02');
  assert.ok(p.warnings.some((w) => w.includes('malformed')));
});

// --- slice 008-01: release-goal view (happy path) ---

test('workstreams: shaper release plan Include table yields goalProgress/goalNext/goalUnresolved (008-01 AC1-AC4)', () => {
  const p = scanProject({
    path: path.join(FIXTURES, 'proj-goal'),
    label: 'goal fixture',
    pinnedWorkstreams: [],
    hiddenWorkstreams: [],
  });
  const release = p.workstreams.find((w) => w.kind === 'release');
  assert.ok(release, 'release workstream present');
  assert.equal(release.title, 'Goal launch plan');
  // 002-01 landed, 002-02 pending, 002-05 unresolved (missing slice),
  // 003-01 parked (excluded), 005-01 unresolved (forward gate to unauthored spec)
  assert.deepEqual(release.goalProgress, { done: 1, total: 4 });
  assert.deepEqual(release.goalNext, { id: '002-02', action: 'draft' });
  assert.deepEqual(release.goalUnresolved, ['002-05', '005-01']);
});

test('workstreams: v1-launch.md checklist fixture is unchanged — zero Include tokens means no goal fields (regression)', () => {
  const p = jig();
  const release = p.workstreams.find((w) => w.kind === 'release');
  assert.deepEqual(release.steps, { done: 1, total: 3 }); // unchanged checklist path
  assert.equal(release.goalProgress, undefined);
  assert.equal(release.goalNext, undefined);
  assert.equal(release.goalUnresolved, undefined);
});

// --- slice 008-02: graceful degradation & honest unknowns ---

test('workstreams: ≥1 Include token but ALL references park → goal fields are NOT attached (title-only, "0 of 0" never shown) (008-02 AC4)', () => {
  const p = scanProject({
    path: path.join(FIXTURES, 'proj-goal-parked'),
    label: 'parked-goal fixture',
    pinnedWorkstreams: [],
    hiddenWorkstreams: [],
  });
  const release = p.workstreams.find((w) => w.kind === 'release');
  assert.ok(release, 'release workstream present');
  assert.equal(release.title, 'Parked launch plan');
  assert.equal(release.goalProgress, undefined, 'total===0 must degrade to title-only, never {done:0,total:0}');
  assert.equal(release.goalNext, undefined);
  assert.equal(release.goalUnresolved, undefined);
});

// --- slice 007-01: graceful config-missing message ---
// Always against a throwaway temp dir, never the developer's real
// ~/.claude/my-dashboard/config.json.
const CONFIG_TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-config-'));
after(() => fs.rmSync(CONFIG_TMP, { recursive: true, force: true }));

test('loadConfig: missing path throws a typed CONFIG_MISSING error naming the path + /dashboard:open (007-01 AC1)', () => {
  const missing = path.join(CONFIG_TMP, 'does-not-exist', 'config.json');
  assert.throws(
    () => loadConfig(missing),
    (err) => {
      assert.ok(err instanceof ConfigMissingError, 'error is the dedicated ConfigMissingError type');
      assert.equal(err.code, 'CONFIG_MISSING');
      assert.ok(err.message.includes(missing), 'message names the missing path');
      assert.ok(err.message.includes('/dashboard:open'), 'message points at /dashboard:open');
      return true;
    },
  );
});

test('loadConfig: a present-but-invalid-JSON file throws a DIFFERENT error, not CONFIG_MISSING (007-01 AC3)', () => {
  const bad = path.join(CONFIG_TMP, 'malformed.json');
  fs.writeFileSync(bad, '{ not valid json');
  assert.throws(
    () => loadConfig(bad),
    (err) => {
      assert.notEqual(err.code, 'CONFIG_MISSING', 'a malformed-but-present file must not be misreported as missing');
      assert.ok(!(err instanceof ConfigMissingError));
      return true;
    },
  );
});

test('loadConfig: a valid config still returns the expected projects unchanged (007-01 AC4 regression)', () => {
  const ok = path.join(CONFIG_TMP, 'valid.json');
  fs.writeFileSync(ok, JSON.stringify({ projects: [{ path: '/tmp/some-project', label: 'x' }] }));
  const cfg = loadConfig(ok);
  assert.equal(cfg.projects.length, 1);
  assert.equal(cfg.projects[0].path, '/tmp/some-project');
  assert.equal(cfg.projects[0].label, 'x');
  assert.deepEqual(cfg.projects[0].pinnedWorkstreams, []);
  assert.deepEqual(cfg.projects[0].hiddenWorkstreams, []);
});
