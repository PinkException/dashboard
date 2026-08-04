// Spec 003-01 (sessions-scan-and-render): integration tests for the local
// Claude Code session-store reader, against a fixture store under
// test/fixtures/session-store/ — never the developer's real ~/.claude.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readAllSessions, scanAll, SESSION_ACTIVE_DAYS, SESSION_CAP } from '../src/scan.mjs';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const STORE = path.join(FIXTURES, 'session-store');
const NOW = Date.parse('2026-08-04T12:00:00Z');
const DAY = 86400000;

// mtimes are checkout-dependent, not commit-dependent — pin the ones the
// active-window/ordering/cap test depends on, relative to a fixed NOW.
const capDir = path.join(STORE, 'projects', '-fixture-cap-proj');
fs.utimesSync(path.join(capDir, 'sess-run.jsonl'), new Date(NOW - 3600000), new Date(NOW - 3600000));
fs.utimesSync(path.join(capDir, 'sess-recent.jsonl'), new Date(NOW - 2 * 3600000), new Date(NOW - 2 * 3600000));
fs.utimesSync(path.join(capDir, 'sess-mid.jsonl'), new Date(NOW - 3 * DAY), new Date(NOW - 3 * DAY));
fs.utimesSync(path.join(capDir, 'sess-stale.jsonl'), new Date(NOW - 10 * DAY), new Date(NOW - 10 * DAY));

const PROJ_A = { path: '/fixture/proj-a' };
const PROJ_A_PLUGIN = { path: '/fixture/proj-a-plugin' };
const CAP_PROJ = { path: '/fixture/cap-proj' };
const BRANCH_PROJ = { path: '/fixture/branch-proj' };

test('module consts: default activeDays=7, cap=20 (003-01 AC5)', () => {
  assert.equal(SESSION_ACTIVE_DAYS, 7);
  assert.equal(SESSION_CAP, 20);
});

test('AC1/AC3: reader enumerates sessions from an overridable store dir, running resolved via sidecar match', () => {
  const result = readAllSessions([PROJ_A], { storeDir: STORE, now: NOW });
  const projA = result.get('/fixture/proj-a');
  const running = projA.sessions.find((s) => s.id === 'sess-running');
  const notRunning = projA.sessions.find((s) => s.id === 'sess-image-title');
  assert.equal(running.running, true);
  assert.equal(notRunning.running, false);
});

test('AC2: title resolution fallback chain end-to-end (custom-title / first-text-block / id)', () => {
  const result = readAllSessions([PROJ_A], { storeDir: STORE, now: NOW });
  const projA = result.get('/fixture/proj-a');
  assert.equal(projA.sessions.find((s) => s.id === 'sess-running').title, 'Ship the login flow');
  assert.equal(projA.sessions.find((s) => s.id === 'sess-image-title').title, 'Investigate flaky test');
  assert.equal(projA.sessions.find((s) => s.id === 'sess-empty-meta').title, 'sess-empty-meta');
});

test('AC4: main-root + worktree session both attributed; sibling-prefix root never cross-attributes; unmatched dir dropped', () => {
  const result = readAllSessions([PROJ_A, PROJ_A_PLUGIN], { storeDir: STORE, now: NOW });
  const projA = result.get('/fixture/proj-a');
  const plugin = result.get('/fixture/proj-a-plugin');
  assert.deepEqual(
    projA.sessions.map((s) => s.id).sort(),
    ['sess-empty-meta', 'sess-image-title', 'sess-running', 'sess-wt-nested'],
  );
  assert.deepEqual(plugin.sessions.map((s) => s.id), ['sess-plugin-own']);
  assert.ok(!projA.sessions.some((s) => s.id === 'sess-dropped'));
  assert.ok(!plugin.sessions.some((s) => s.id === 'sess-dropped'));
});

test('AC4: sibling directory dropped when only the shorter root is configured — no longest-root rescue (regression guard)', () => {
  // Only proj-a is configured here, NOT proj-a-plugin — unlike the AC4 test
  // above, so a regression from segment-anchored matching to a bare
  // `dirSlug.startsWith(slug)` has no longer configured root to be out-competed
  // by the tie-break, and would wrongly attribute sess-plugin-own to proj-a.
  const result = readAllSessions([PROJ_A], { storeDir: STORE, now: NOW });
  const projA = result.get('/fixture/proj-a');
  assert.ok(
    !projA.sessions.some((s) => s.id === 'sess-plugin-own'),
    'sibling proj-a-plugin session must not attribute to proj-a when proj-a-plugin is not configured',
  );
});

test('AC4/AC7: worktree refined from the real body cwd, even nested below the worktree root', () => {
  const result = readAllSessions([PROJ_A], { storeDir: STORE, now: NOW });
  const wt = result.get('/fixture/proj-a').sessions.find((s) => s.id === 'sess-wt-nested');
  assert.equal(wt.worktree, 'feature-x');
});

test('AC6: gitBranch HEAD resolves to null, not a stale earlier branch name', () => {
  const result = readAllSessions([BRANCH_PROJ], { storeDir: STORE, now: NOW });
  const session = result.get('/fixture/branch-proj').sessions.find((s) => s.id === 'sess-head-branch');
  assert.equal(session.branch, null);
});

test('AC5: active window + ordering (running-first, then mtime desc) + cap + sessionsTotal overflow', () => {
  const result = readAllSessions([CAP_PROJ], { storeDir: STORE, now: NOW, cap: 2 });
  const capProj = result.get('/fixture/cap-proj');
  assert.equal(capProj.sessionsTotal, 4);
  assert.deepEqual(capProj.sessions.map((s) => s.id), ['sess-run', 'sess-recent']);
  assert.equal(capProj.sessions[0].active, true);
  assert.equal(capProj.sessions[1].active, true);

  const uncapped = readAllSessions([CAP_PROJ], { storeDir: STORE, now: NOW });
  const stale = uncapped.get('/fixture/cap-proj').sessions.find((s) => s.id === 'sess-stale');
  assert.equal(stale.active, false);
});

test('AC6: missing/unreadable store degrades to [] + a warning, never throws', () => {
  const bogus = path.join(FIXTURES, 'does-not-exist-session-store');
  assert.doesNotThrow(() => {
    const result = readAllSessions([PROJ_A], { storeDir: bogus, now: NOW });
    const projA = result.get('/fixture/proj-a');
    assert.deepEqual(projA.sessions, []);
    assert.equal(projA.sessionsTotal, 0);
    assert.ok(projA.warning, 'a warning is set when the store cannot be read');
  });
});

test('AC9: reading the store writes nothing under it', () => {
  const dir = path.join(STORE, 'projects', '-fixture-proj-a');
  const before = fs.readdirSync(dir).sort();
  readAllSessions([PROJ_A], { storeDir: STORE, now: NOW });
  assert.deepEqual(fs.readdirSync(dir).sort(), before);
});

test('AC6 (JSON contract via scanAll): sessions + sessionsTotal attached, even to a project whose local path does not exist', () => {
  process.env.DASHBOARD_SESSION_STORE = STORE;
  try {
    const data = scanAll({ projects: [{ path: '/fixture/proj-a', pinnedWorkstreams: [], hiddenWorkstreams: [] }] });
    const p = data.projects[0];
    assert.ok(p.error); // the local checkout path is fake; unrelated to session attribution
    assert.ok(Array.isArray(p.sessions));
    assert.ok(p.sessions.some((s) => s.id === 'sess-running'));
    assert.equal(typeof p.sessionsTotal, 'number');
  } finally {
    delete process.env.DASHBOARD_SESSION_STORE;
  }
});
