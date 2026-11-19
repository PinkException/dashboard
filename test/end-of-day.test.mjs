// Slice 012-04: end-of-day selection + run-state. Names are invented
// (the leak gate scans this file); everything lives under a tmp dir.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { encodeCwdSlug } from '../src/lib.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'scripts', 'end-of-day.mjs');
const NOW = Date.parse('2026-06-10T22:00:00Z');
const H = 3600000;
const tmps = [];
after(() => tmps.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

// A sandbox: data folder (config + state), session store, and N projects.
function sandbox(names, { extraConfig = [] } = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'eod-'));
  tmps.push(base);
  const data = path.join(base, 'data');
  const store = path.join(base, 'store');
  fs.mkdirSync(data, { recursive: true });
  fs.mkdirSync(path.join(store, 'projects'), { recursive: true });
  const projects = {};
  for (const n of names) {
    projects[n] = path.join(base, 'repos', n);
    fs.mkdirSync(projects[n], { recursive: true });
  }
  const cfgProjects = [...names.map((n) => ({ label: n, path: projects[n] })), ...extraConfig];
  fs.writeFileSync(path.join(data, 'config.json'), JSON.stringify({ projects: cfgProjects }));
  return { base, data, store, projects };
}
// A transcript in the store for `cwd` (project root or a worktree path), mtime = ageHours before NOW.
function session(sb, cwd, ageHours, id = 's' + Math.random().toString(16).slice(2)) {
  const dir = path.join(sb.store, 'projects', encodeCwdSlug(cwd));
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, id + '.jsonl');
  fs.writeFileSync(f, '{}\n');
  const t = (NOW - ageHours * H) / 1000;
  fs.utimesSync(f, t, t);
}
const wt = (root, name) => path.join(root, '.claude', 'worktrees', name);
const state = (sb, obj) => fs.writeFileSync(path.join(sb.data, 'end-of-day.json'), typeof obj === 'string' ? obj : JSON.stringify(obj));
function run(sb, args, { useEnvStore = true } = {}) {
  const env = { ...process.env, DASHBOARD_CONFIG: path.join(sb.data, 'config.json'), DASHBOARD_SESSION_STORE: sb.store };
  if (!useEnvStore) delete env.DASHBOARD_SESSION_STORE;
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', env });
  return { code: r.status, out: r.stdout, err: r.stderr, json: r.stdout.trim().startsWith('{') ? JSON.parse(r.stdout) : null };
}
const select = (sb) => run(sb, ['--select', '--now', new Date(NOW).toISOString()]);
const labels = (r) => r.json.projects.map((p) => p.label).sort();

test('AC2: first run (no state file) looks back 24 hours', () => {
  const sb = sandbox(['alpha', 'beta']);
  session(sb, sb.projects.alpha, 23);
  session(sb, sb.projects.beta, 25);
  const r = select(sb);
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(labels(r), ['alpha']);
  assert.equal(r.json.since, new Date(NOW - 24 * H).toISOString());
  assert.equal(r.json.firstRun, true);
  assert.equal(r.json.capped, false);
});

test('AC2: window starts at the last run start, not midnight', () => {
  const sb = sandbox(['alpha', 'beta']);
  state(sb, { v: 1, lastRunStarted: new Date(NOW - 30 * H).toISOString(), failed: [] });
  session(sb, sb.projects.alpha, 29); // before midnight-ish, after last run
  session(sb, sb.projects.beta, 31); // before last run
  const r = select(sb);
  assert.deepEqual(labels(r), ['alpha']);
  assert.equal(r.json.since, new Date(NOW - 30 * H).toISOString());
  assert.equal(r.json.firstRun, false);
});

test('AC2: lookback is capped at 7 days and says so', () => {
  const sb = sandbox(['alpha', 'beta']);
  state(sb, { v: 1, lastRunStarted: new Date(NOW - 20 * 24 * H).toISOString(), failed: [] });
  session(sb, sb.projects.alpha, 6 * 24);
  session(sb, sb.projects.beta, 8 * 24);
  const r = select(sb);
  assert.deepEqual(labels(r), ['alpha']);
  assert.equal(r.json.capped, true);
  assert.equal(r.json.since, new Date(NOW - 7 * 24 * H).toISOString());
});

test('AC2: a corrupt state file is treated like a missing one (24h)', () => {
  const sb = sandbox(['alpha']);
  state(sb, '{not json');
  session(sb, sb.projects.alpha, 2);
  const r = select(sb);
  assert.equal(r.code, 0, r.err);
  assert.equal(r.json.firstRun, true);
  assert.deepEqual(labels(r), ['alpha']);
});

test('AC2: a failed project is re-selected with no activity; failed-but-removed is dropped quietly', () => {
  const sb = sandbox(['alpha', 'beta']);
  state(sb, {
    v: 1,
    lastRunStarted: new Date(NOW - 2 * H).toISOString(),
    failed: [sb.projects.alpha, path.join(sb.base, 'repos', 'gone')],
  });
  session(sb, sb.projects.beta, 1);
  const r = select(sb);
  assert.deepEqual(labels(r), ['alpha', 'beta']);
  const a = r.json.projects.find((p) => p.label === 'alpha');
  assert.equal(a.retry, true);
  assert.equal(r.json.projects.find((p) => p.label === 'beta').retry, false);
  assert.ok(!r.json.projects.some((p) => p.path.endsWith('gone')));
  assert.equal(r.err, '');
});

test('AC2: no activity and nothing failed selects nothing', () => {
  const sb = sandbox(['alpha']);
  session(sb, sb.projects.alpha, 40);
  const r = select(sb);
  assert.deepEqual(r.json.projects, []);
});

test('AC2: worktree sessions count and a worktree-only day is flagged', () => {
  const sb = sandbox(['alpha', 'beta', 'gamma']);
  session(sb, wt(sb.projects.alpha, 'feat-x'), 2); // worktree only
  session(sb, sb.projects.beta, 2);
  session(sb, wt(sb.projects.beta, 'feat-y'), 2); // main + worktree
  session(sb, sb.projects.gamma, 2);
  const r = select(sb);
  const by = Object.fromEntries(r.json.projects.map((p) => [p.label, p]));
  assert.equal(by.alpha.worktreeOnly, true);
  assert.equal(by.beta.worktreeOnly, false);
  assert.equal(by.gamma.worktreeOnly, false);
});

test('AC2: a session outside any configured root selects nothing (known gap)', () => {
  const sb = sandbox(['alpha']);
  session(sb, path.join(sb.base, 'elsewhere'), 1);
  assert.deepEqual(select(sb).json.projects, []);
});

test('AC2: a session of a similarly named sibling project is not attributed to the shorter-named one', () => {
  const sb = sandbox(['alpha', 'alpha-extra']);
  session(sb, sb.projects['alpha-extra'], 1);
  assert.deepEqual(labels(select(sb)), ['alpha-extra']);
});

test('AC2: a missing session store selects only failed projects, no crash', () => {
  const sb = sandbox(['alpha', 'beta']);
  fs.rmSync(sb.store, { recursive: true });
  state(sb, { v: 1, lastRunStarted: new Date(NOW - H).toISOString(), failed: [sb.projects.beta] });
  const r = select(sb);
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(labels(r), ['beta']);
});

test('AC2: --record writes the run START time and the failed list; next select uses them', () => {
  const sb = sandbox(['alpha', 'beta']);
  const started = new Date(NOW - 10 * H).toISOString();
  const rec = run(sb, ['--record', '--started', started, '--failed', sb.projects.alpha]);
  assert.equal(rec.code, 0, rec.err);
  const st = JSON.parse(fs.readFileSync(path.join(sb.data, 'end-of-day.json'), 'utf8'));
  assert.equal(st.lastRunStarted, started);
  assert.deepEqual(st.failed, [sb.projects.alpha]);
  const r = select(sb);
  assert.equal(r.json.since, started);
  assert.deepEqual(labels(r), ['alpha']);
});

test('AC2: --record with no failures writes an empty list; bad --started is refused and writes nothing', () => {
  const sb = sandbox(['alpha']);
  assert.equal(run(sb, ['--record', '--started', new Date(NOW).toISOString()]).code, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(sb.data, 'end-of-day.json'), 'utf8')).failed, []);
  fs.rmSync(path.join(sb.data, 'end-of-day.json'));
  const bad = run(sb, ['--record', '--started', 'yesterday-ish']);
  assert.notEqual(bad.code, 0);
  assert.equal(fs.existsSync(path.join(sb.data, 'end-of-day.json')), false);
});

test('AC6: select and record write nothing into surveyed repos', () => {
  const sb = sandbox(['alpha']);
  session(sb, sb.projects.alpha, 1);
  select(sb);
  run(sb, ['--record', '--started', new Date(NOW).toISOString()]);
  assert.deepEqual(fs.readdirSync(sb.projects.alpha), []);
});

test('AC2: missing config stops with a one-line pointer to /dashboard:open', () => {
  const sb = sandbox(['alpha']);
  fs.rmSync(path.join(sb.data, 'config.json'));
  const r = select(sb);
  assert.notEqual(r.code, 0);
  assert.match(r.err, /\/dashboard:open/);
});

test('AC1/AC3/AC5/AC6/AC7: skill + README ship with the required content', () => {
  const skill = fs.readFileSync(path.join(ROOT, 'skills', 'end-of-day', 'SKILL.md'), 'utf8');
  assert.match(skill, /^name: end-of-day$/m);
  for (const phrase of ['end of day', 'wrap up my day', 'snapshot everything I touched today']) {
    assert.ok(skill.includes(phrase), phrase);
  }
  assert.match(skill, /skills\/snapshot\/SKILL\.md/);
  assert.match(skill, /--print-order/);
  assert.match(skill, /--move/);
  assert.match(skill, /--record/);
  assert.match(skill, /--select/);
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  assert.match(readme, /\/dashboard:end-of-day/);
  const snap = fs.readFileSync(path.join(ROOT, 'skills', 'snapshot', 'SKILL.md'), 'utf8');
  assert.doesNotMatch(snap, /end-of-day.*may invoke this skill/);
});

test('AC2: valid JSON with an unusable lastRunStarted is treated like a missing file (24h)', () => {
  const sb = sandbox(['alpha']);
  state(sb, { v: 1, lastRunStarted: 'whenever', failed: [] });
  session(sb, sb.projects.alpha, 2);
  const r = select(sb);
  assert.equal(r.json.firstRun, true);
  assert.equal(r.json.since, new Date(NOW - 24 * H).toISOString());
});

test('AC2: config.sessionStore is honoured when DASHBOARD_SESSION_STORE is unset', () => {
  const sb = sandbox(['alpha']);
  const cfg = JSON.parse(fs.readFileSync(path.join(sb.data, 'config.json'), 'utf8'));
  cfg.sessionStore = sb.store;
  fs.writeFileSync(path.join(sb.data, 'config.json'), JSON.stringify(cfg));
  session(sb, sb.projects.alpha, 2);
  const r = run(sb, ['--select', '--now', new Date(NOW).toISOString()], { useEnvStore: false });
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(labels(r), ['alpha']);
});

test('AC2: a lastRunStarted in the future (clock skew) is treated like a missing file (24h)', () => {
  const sb = sandbox(['alpha']);
  state(sb, { v: 1, lastRunStarted: new Date(NOW + 5 * H).toISOString(), failed: [] });
  session(sb, sb.projects.alpha, 2);
  const r = select(sb);
  assert.equal(r.json.firstRun, true);
  assert.equal(r.json.since, new Date(NOW - 24 * H).toISOString());
  assert.deepEqual(labels(r), ['alpha']);
});
