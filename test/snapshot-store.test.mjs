// Slice 005-01 — the snapshot store lives outside every surveyed repo.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { laterSnapshot } from '../src/lib.mjs';
import { projectKey, resolveSnapshotsDir, scanProject } from '../src/scan.mjs';

const SCRIPT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'scripts',
  'snapshot.mjs',
);

const git = (cwd, ...args) =>
  execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();

let tmp;
let store;

before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-store-'));
  store = path.join(tmp, 'snapshots');
  process.env.DASHBOARD_SNAPSHOTS = store;
});

after(() => {
  delete process.env.DASHBOARD_SNAPSHOTS;
  fs.rmSync(tmp, { recursive: true, force: true });
});

// Minimal jig-managed project so scanProject treats it as real.
function makeProject(name) {
  const root = path.join(tmp, name);
  fs.mkdirSync(path.join(root, 'docs', 'specs', '001-a'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'docs', 'specs', '001-a', 'spec.md'),
    '---\nstatus: DONE\n---\n# Spec 001: A\n',
  );
  return root;
}

function makeRepo(name) {
  const root = makeProject(name);
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'test@example.invalid');
  git(root, 'config', 'user.name', 'Test');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'init');
  return root;
}

// ---------------------------------------------------------------- AC2

test('AC2: the store honours DASHBOARD_SNAPSHOTS', () => {
  assert.equal(resolveSnapshotsDir(), store);
});

test('AC2: the default store sits beside the resolved config, not a second literal', () => {
  const saved = process.env.DASHBOARD_SNAPSHOTS;
  const savedCfg = process.env.DASHBOARD_CONFIG;
  delete process.env.DASHBOARD_SNAPSHOTS;
  try {
    process.env.DASHBOARD_CONFIG = path.join(tmp, 'elsewhere', 'config.json');
    // Snapshots follow the config, so an override cannot split the two apart.
    assert.equal(resolveSnapshotsDir(), path.join(tmp, 'elsewhere', 'snapshots'));

    delete process.env.DASHBOARD_CONFIG;
    assert.equal(
      resolveSnapshotsDir(),
      path.join(os.homedir(), '.claude', 'my-dashboard', 'snapshots'),
    );
  } finally {
    process.env.DASHBOARD_SNAPSHOTS = saved;
    if (savedCfg === undefined) delete process.env.DASHBOARD_CONFIG;
    else process.env.DASHBOARD_CONFIG = savedCfg;
  }
});

// ---------------------------------------------------------------- AC3

test('AC3: a worktree and its parent repo resolve to the same key', () => {
  const parent = makeRepo('keyed-parent');
  const wt = path.join(tmp, 'keyed-parent-wt');
  git(parent, 'worktree', 'add', '-q', '-b', 'side', wt);
  assert.equal(projectKey(wt), projectKey(parent));
});

test('AC3: same basename in different parents does not collide', () => {
  const a = makeRepo(path.join('nest-a', 'shared-name').replace(/\\/g, '/'));
  const b = makeRepo(path.join('nest-b', 'shared-name').replace(/\\/g, '/'));
  assert.equal(path.basename(a), path.basename(b));
  assert.notEqual(projectKey(a), projectKey(b));
});

test('AC3: a non-git directory still gets a key instead of throwing', () => {
  const plain = makeProject('not-a-repo');
  const key = projectKey(plain);
  assert.match(key, /^[A-Za-z0-9._-]+$/);
  assert.equal(projectKey(plain), key, 'key is stable across calls');
});

test('AC3: keys are filename-safe', () => {
  const odd = makeProject('has spaces & symbols!');
  assert.match(projectKey(odd), /^[A-Za-z0-9._-]+$/);
});

// ---------------------------------------------------------------- AC4

test('AC4: laterSnapshot prefers the later ts, whichever side it is on', () => {
  const older = { ts: '2026-07-01T00:00:00Z', headline: 'older' };
  const newer = { ts: '2026-07-20T00:00:00Z', headline: 'newer' };
  assert.equal(laterSnapshot(older, newer).headline, 'newer');
  assert.equal(laterSnapshot(newer, older).headline, 'newer');
});

test('AC4: laterSnapshot handles either side missing', () => {
  const one = { ts: '2026-07-01T00:00:00Z', headline: 'one' };
  assert.equal(laterSnapshot(null, one).headline, 'one');
  assert.equal(laterSnapshot(one, null).headline, 'one');
  assert.equal(laterSnapshot(null, null), null);
});

test('AC4: on an identical ts the store wins (it is the canonical source)', () => {
  const inRepo = { ts: '2026-07-10T00:00:00Z', headline: 'from repo' };
  const fromStore = { ts: '2026-07-10T00:00:00Z', headline: 'from store' };
  assert.equal(laterSnapshot(inRepo, fromStore).headline, 'from store');
});

test('AC4: the reader surfaces the newer entry across the two sources', () => {
  const root = makeProject('dual-read');
  fs.mkdirSync(path.join(root, 'docs', 'status'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'docs', 'status', 'compass-history.jsonl'),
    JSON.stringify({ v: 1, ts: '2026-07-01T00:00:00Z', headline: 'old in-repo line' }) + '\n',
  );
  fs.mkdirSync(store, { recursive: true });
  fs.writeFileSync(
    path.join(store, `${projectKey(root)}.jsonl`),
    JSON.stringify({ v: 1, ts: '2026-07-20T00:00:00Z', headline: 'new store line' }) + '\n',
  );
  const p = scanProject({ path: root, pinnedWorkstreams: [], hiddenWorkstreams: [] });
  assert.equal(p.compass.headline, 'new store line');
});

test('AC4: a stale store entry does not mask a newer in-repo entry', () => {
  const root = makeProject('store-is-older');
  fs.mkdirSync(path.join(root, 'docs', 'status'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'docs', 'status', 'compass-history.jsonl'),
    JSON.stringify({ v: 1, ts: '2026-07-22T00:00:00Z', headline: 'recent in-repo line' }) + '\n',
  );
  fs.mkdirSync(store, { recursive: true });
  fs.writeFileSync(
    path.join(store, `${projectKey(root)}.jsonl`),
    JSON.stringify({ v: 1, ts: '2026-07-02T00:00:00Z', headline: 'stale store line' }) + '\n',
  );
  const p = scanProject({ path: root, pinnedWorkstreams: [], hiddenWorkstreams: [] });
  assert.equal(p.compass.headline, 'recent in-repo line');
});

test('AC4: malformed lines in either source are counted once, together', () => {
  const root = makeProject('malformed-both');
  fs.mkdirSync(path.join(root, 'docs', 'status'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'docs', 'status', 'compass-history.jsonl'),
    'not json\n' + JSON.stringify({ v: 1, ts: '2026-07-01T00:00:00Z', headline: 'ok' }) + '\n',
  );
  fs.mkdirSync(store, { recursive: true });
  fs.writeFileSync(path.join(store, `${projectKey(root)}.jsonl`), 'also not json\n');
  const p = scanProject({ path: root, pinnedWorkstreams: [], hiddenWorkstreams: [] });
  assert.match(p.warnings.join(' '), /2 malformed line\(s\)/);
});

// ---------------------------------------------------------------- AC5

test('AC5: a project with only in-repo history is unchanged (day-one behaviour)', () => {
  const root = makeProject('in-repo-only');
  fs.mkdirSync(path.join(root, 'docs', 'status'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'docs', 'status', 'compass-history.jsonl'),
    JSON.stringify({ v: 1, ts: '2026-07-05T00:00:00Z', headline: 'only source' }) + '\n',
  );
  const p = scanProject({ path: root, pinnedWorkstreams: [], hiddenWorkstreams: [] });
  assert.equal(p.compass.headline, 'only source');
  assert.ok(p.compass.ageLabel, 'age label still computed');
});

test('AC5: a project with neither source reports no compass and no warning', () => {
  const root = makeProject('no-history-at-all');
  const p = scanProject({ path: root, pinnedWorkstreams: [], hiddenWorkstreams: [] });
  assert.equal(p.compass, null);
  assert.equal(p.warnings.length, 0);
});

// ---------------------------------------------------------------- AC1

test('AC1: the writer appends to the store and never touches the surveyed repo', () => {
  const root = makeRepo('writer-target');
  const before = git(root, 'status', '--porcelain');

  execFileSync(process.execPath, [SCRIPT, '--project', root, '--headline', 'written by test'], {
    env: { ...process.env, DASHBOARD_SNAPSHOTS: store },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const written = path.join(store, `${projectKey(root)}.jsonl`);
  assert.ok(fs.existsSync(written), 'snapshot landed in the store');
  const line = JSON.parse(fs.readFileSync(written, 'utf8').trim().split('\n').pop());
  assert.equal(line.headline, 'written by test');

  assert.equal(
    fs.existsSync(path.join(root, 'docs', 'status')),
    false,
    'no docs/status/ was created inside the surveyed project',
  );
  assert.equal(git(root, 'status', '--porcelain'), before, 'surveyed repo working tree untouched');
});

test('AC1: a worktree snapshot lands in its parent project file, not a forked one', () => {
  const parent = makeRepo('forkcheck');
  const wt = path.join(tmp, 'forkcheck-wt');
  git(parent, 'worktree', 'add', '-q', '-b', 'wt-branch', wt);
  fs.mkdirSync(path.join(wt, 'docs', 'specs', '001-a'), { recursive: true });
  fs.writeFileSync(
    path.join(wt, 'docs', 'specs', '001-a', 'spec.md'),
    '---\nstatus: DONE\n---\n# Spec 001: A\n',
  );

  execFileSync(process.execPath, [SCRIPT, '--project', wt, '--headline', 'from the worktree'], {
    env: { ...process.env, DASHBOARD_SNAPSHOTS: store },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Assert the exact parent-keyed filename: a prefix count would also pass if the
  // worktree had forked its own `forkcheck-wt-<hash>.jsonl`, since only one write
  // happened either way.
  const expected = `${projectKey(parent)}.jsonl`;
  assert.ok(fs.existsSync(path.join(store, expected)), `wrote to the parent key ${expected}`);
  const line = JSON.parse(fs.readFileSync(path.join(store, expected), 'utf8').trim());
  assert.equal(line.headline, 'from the worktree');
  const forked = fs.readdirSync(store).filter((f) => f.includes('forkcheck') && f !== expected);
  assert.deepEqual(forked, [], 'no separate per-worktree file');
});

test('AC3: a project inside another repo keeps its own key (no cross-contamination)', () => {
  const parent = makeRepo('outer-repo');
  const inner = path.join(parent, 'packages', 'inner-project');
  fs.mkdirSync(path.join(inner, 'docs', 'specs', '001-a'), { recursive: true });
  fs.writeFileSync(
    path.join(inner, 'docs', 'specs', '001-a', 'spec.md'),
    '---\nstatus: DONE\n---\n# Spec 001: A\n',
  );
  // A sub-directory is a different project from the repo that contains it —
  // sharing a key would merge two projects' histories (ADR-0004 OQ4).
  assert.notEqual(projectKey(inner), projectKey(parent));
});

test('AC4: laterSnapshot tolerates an unparseable ts on either side', () => {
  const good = { ts: '2026-07-10T00:00:00Z', headline: 'good' };
  const bad = { ts: 'not-a-date', headline: 'bad' };
  assert.equal(laterSnapshot(bad, good).headline, 'good');
  assert.equal(laterSnapshot(good, bad).headline, 'good');
  const bad2 = { ts: 'also-not-a-date', headline: 'bad-store-side' };
  assert.equal(laterSnapshot(bad, bad2).headline, 'bad-store-side', 'both unparseable → store');
});

test('AC3: two submodules of one superproject do not share a key', () => {
  // A submodule's --git-common-dir is <super>/.git/modules/<name>, whose dirname
  // is shared by every submodule of that superproject. Folding on it would merge
  // unrelated projects into one history.
  const superRoot = makeRepo('super-project');
  const modA = makeRepo('module-a');
  const modB = makeRepo('module-b');
  const opts = { cwd: superRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
  try {
    execFileSync(
      'git',
      ['-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', modA, 'subA'],
      opts,
    );
    execFileSync(
      'git',
      ['-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', modB, 'subB'],
      opts,
    );
  } catch {
    return; // this git build refuses local submodules; nothing to assert
  }
  const a = path.join(superRoot, 'subA');
  const b = path.join(superRoot, 'subB');
  assert.notEqual(projectKey(a), projectKey(b), 'submodules must not collide');
  assert.notEqual(projectKey(a), projectKey(superRoot), 'submodule is not its superproject');
});

test('AC5: day-one in-repo-only history still reports staleness, not just a headline', () => {
  const root = makeProject('staleness-day-one');
  fs.mkdirSync(path.join(root, 'docs', 'status'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'docs', 'status', 'compass-history.jsonl'),
    JSON.stringify({ v: 1, ts: '2020-01-01T00:00:00Z', headline: 'ancient' }) + '\n',
  );
  const p = scanProject({ path: root, pinnedWorkstreams: [], hiddenWorkstreams: [] });
  assert.equal(p.compass.stale, true, 'an old entry is still flagged stale');
  assert.equal(typeof p.compass.ageDays, 'number');
});

test('AC4: an equal ts across the two real sources resolves to the store', () => {
  const root = makeProject('equal-ts-integration');
  const ts = '2026-07-15T12:00:00Z';
  fs.mkdirSync(path.join(root, 'docs', 'status'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'docs', 'status', 'compass-history.jsonl'),
    JSON.stringify({ v: 1, ts, headline: 'in-repo at the same instant' }) + '\n',
  );
  fs.mkdirSync(store, { recursive: true });
  fs.writeFileSync(
    path.join(store, `${projectKey(root)}.jsonl`),
    JSON.stringify({ v: 1, ts, headline: 'store at the same instant' }) + '\n',
  );
  const p = scanProject({ path: root, pinnedWorkstreams: [], hiddenWorkstreams: [] });
  assert.equal(p.compass.headline, 'store at the same instant');
});

test('AC1: an unwritable store is reported, not thrown as an unhandled crash', () => {
  const root = makeProject('io-failure');
  // A file where the store directory should be: mkdirSync raises ENOTDIR.
  const blocked = path.join(tmp, 'blocked-store');
  fs.writeFileSync(blocked, 'not a directory\n');

  let stderr = '';
  let threw = false;
  try {
    execFileSync(process.execPath, [SCRIPT, '--project', root, '--headline', 'x'], {
      env: { ...process.env, DASHBOARD_SNAPSHOTS: blocked },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    threw = true;
    stderr = err.stderr || '';
  }
  assert.equal(threw, true, 'exits non-zero so a caller can detect the failure');
  // The structured per-project error, not a raw stack trace — that is what lets
  // an --all run report this project and carry on to the next.
  assert.match(stderr, /^✗ .*could not write/m);
  assert.doesNotMatch(stderr, /at Object\.<anonymous>|ENOTDIR\n\s+at /);
});
