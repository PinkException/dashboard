// Slice 005-02 — migrate the existing snapshot history into the store.
//
// Every fixture name here is invented (the leak gate scans this file).
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { projectKey } from '../src/scan.mjs';
import {
  flattenPath,
  loadAliases,
  applyAlias,
  collectSources,
  buildPlan,
  renderReport,
  writePlan,
  writeCapture,
} from '../src/migrate.mjs';

const git = (cwd, ...args) =>
  execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();

let tmp;
let workspace;
let store;
let archive;

const entry = (ts, headline, extra = {}) =>
  JSON.stringify({ v: 1, ts, headline, next: null, blockers: [], specs: {}, ...extra });

function writeHistory(dir, lines) {
  const target = path.join(dir, 'docs', 'status');
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'compass-history.jsonl'), `${lines.join('\n')}\n`);
}

function makeRepo(name) {
  const root = path.join(workspace, name);
  fs.mkdirSync(root, { recursive: true });
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'test@example.invalid');
  git(root, 'config', 'user.name', 'Test');
  fs.writeFileSync(path.join(root, 'README.md'), `# ${name}\n`);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'init');
  return root;
}

function makeWorktree(repoRoot, name) {
  const wt = path.join(repoRoot, '.claude', 'worktrees', name);
  fs.mkdirSync(path.dirname(wt), { recursive: true });
  git(repoRoot, 'worktree', 'add', '-q', '-b', `wt-${name}`, wt);
  return wt;
}

before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-migrate-'));
});

after(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

beforeEach(() => {
  workspace = fs.mkdtempSync(path.join(tmp, 'ws-'));
  store = path.join(workspace, '_store');
  archive = path.join(workspace, '_archive');
  fs.mkdirSync(archive, { recursive: true });
});

const plannerFor = (aliases = []) =>
  buildPlan({
    sources: collectSources({ searchRoots: [workspace], archiveDirs: [archive] }),
    aliases,
  });

// ---------------------------------------------------------------- AC3

test('AC3: a worktree copy folds into its parent project, not its own history', () => {
  const repo = makeRepo('quillstone');
  const wt = makeWorktree(repo, 'branch-one');
  writeHistory(repo, [entry('2026-01-01T00:00:00Z', 'root headline')]);
  writeHistory(wt, [entry('2026-01-02T00:00:00Z', 'worktree headline')]);

  const plan = plannerFor();

  assert.equal(plan.projects.length, 1, 'one project, not two');
  const only = plan.projects[0];
  assert.equal(only.key, projectKey(repo));
  assert.deepEqual(
    only.entries.map((e) => e.headline),
    ['root headline', 'worktree headline'],
  );
  assert.equal(only.sources.length, 2, 'both source files are named in the plan');
});

test('AC3: a project that exists only as a worktree copy is promoted to its parent key', () => {
  const repo = makeRepo('brambleforge');
  const wt = makeWorktree(repo, 'only-copy');
  writeHistory(wt, [entry('2026-01-03T00:00:00Z', 'worktree-only headline')]);

  const plan = plannerFor();

  assert.equal(plan.projects.length, 1);
  assert.equal(plan.projects[0].key, projectKey(repo));
  assert.equal(plan.projects[0].entries.length, 1);
});

test('AC3: an archived copy whose worktree was pruned still folds to the parent', () => {
  const repo = makeRepo('thistledown');
  writeHistory(repo, [entry('2026-01-01T00:00:00Z', 'live headline')]);
  // The worktree directory no longer exists; only the flattened archive copy does.
  const flat = flattenPath(
    path.join('thistledown', '.claude', 'worktrees', 'gone-away', 'docs', 'status', 'compass-history.jsonl'),
  );
  fs.writeFileSync(
    path.join(archive, flat),
    `${entry('2026-01-04T00:00:00Z', 'rescued from a pruned worktree')}\n`,
  );

  const plan = plannerFor();

  assert.equal(plan.problems.length, 0, plan.problems.join('; '));
  assert.equal(plan.projects.length, 1);
  assert.deepEqual(
    plan.projects[0].entries.map((e) => e.headline),
    ['live headline', 'rescued from a pruned worktree'],
  );
});

test('AC3: two projects sharing a basename do not merge', () => {
  const a = makeRepo(path.join('one', 'shared-name'));
  const b = makeRepo(path.join('two', 'shared-name'));
  writeHistory(a, [entry('2026-01-01T00:00:00Z', 'first')]);
  writeHistory(b, [entry('2026-01-01T00:00:00Z', 'second')]);

  const plan = plannerFor();

  assert.equal(plan.projects.length, 2);
});

// ---------------------------------------------------------------- AC2

test('AC2: an alias folds a renamed project into the project it is today', () => {
  const oldRoot = makeRepo('wintermoss');
  const newRoot = makeRepo('everbloom');
  writeHistory(oldRoot, [entry('2026-01-01T00:00:00Z', 'written before the rename')]);
  writeHistory(newRoot, [entry('2026-01-05T00:00:00Z', 'written after the rename')]);

  const plan = plannerFor([{ from: oldRoot, to: newRoot }]);

  assert.equal(plan.projects.length, 1, 'the two paths are one project');
  assert.equal(plan.projects[0].key, projectKey(newRoot), 'keyed on the project as it is today');
  assert.deepEqual(
    plan.projects[0].entries.map((e) => e.headline),
    ['written before the rename', 'written after the rename'],
  );
});

test('AC2: an alias also covers worktree copies under the old path', () => {
  const oldRoot = makeRepo('emberlark');
  const wt = makeWorktree(oldRoot, 'old-branch');
  const newRoot = makeRepo('sunderglass');
  writeHistory(wt, [entry('2026-01-02T00:00:00Z', 'from a worktree of the old name')]);
  writeHistory(newRoot, [entry('2026-01-06T00:00:00Z', 'current')]);

  const plan = plannerFor([{ from: oldRoot, to: newRoot }]);

  assert.equal(plan.projects.length, 1);
  assert.equal(plan.projects[0].key, projectKey(newRoot));
});

test('AC2: a source that cannot be attributed stops the run and names the path', () => {
  const repo = makeRepo('stonewick');
  writeHistory(repo, [entry('2026-01-01T00:00:00Z', 'fine')]);
  // An archived copy of a project that is gone entirely — no live directory, no alias.
  const flat = flattenPath(path.join('vanished-entirely', 'docs', 'status', 'compass-history.jsonl'));
  fs.writeFileSync(path.join(archive, flat), `${entry('2026-01-02T00:00:00Z', 'orphan')}\n`);

  const plan = plannerFor();

  assert.equal(plan.problems.length, 1);
  assert.match(plan.problems[0], /vanished-entirely/);
  assert.throws(() => writePlan(plan, { storeDir: store }), /refus/i);
});

test('AC2: loadAliases expands ~ and tolerates a missing file', () => {
  assert.deepEqual(loadAliases(path.join(workspace, 'nope.json')), []);
  const p = path.join(workspace, 'aliases.json');
  fs.writeFileSync(p, JSON.stringify({ v: 1, aliases: [{ from: '~/a', to: '~/b' }] }));
  const [alias] = loadAliases(p);
  assert.equal(alias.from, path.join(os.homedir(), 'a'));
  assert.equal(alias.to, path.join(os.homedir(), 'b'));
});

test('AC2: applyAlias rewrites only paths at or under the old root', () => {
  const aliases = [{ from: '/x/old', to: '/x/new' }];
  assert.equal(applyAlias('/x/old', aliases), '/x/new');
  assert.equal(applyAlias('/x/old/inner', aliases), '/x/new/inner');
  assert.equal(applyAlias('/x/older', aliases), '/x/older', 'prefix match must respect boundaries');
  assert.equal(applyAlias('/x/other', aliases), '/x/other');
});

// ---------------------------------------------------------------- AC4

test('AC4: identical entries collapse and survivors are ordered oldest first', () => {
  const repo = makeRepo('galewood');
  const wt = makeWorktree(repo, 'copy');
  const shared = entry('2026-02-02T00:00:00Z', 'shared line');
  writeHistory(repo, [entry('2026-03-03T00:00:00Z', 'later'), shared]);
  writeHistory(wt, [shared, entry('2026-01-01T00:00:00Z', 'earliest')]);

  const plan = plannerFor();
  const only = plan.projects[0];

  assert.deepEqual(
    only.entries.map((e) => e.headline),
    ['earliest', 'shared line', 'later'],
  );
  assert.equal(plan.accounting.duplicates.length, 1, 'the repeated line is accounted for, not lost');
});

test('AC4: key order in the stored JSON does not make two identical entries look different', () => {
  const repo = makeRepo('hollowmere');
  const wt = makeWorktree(repo, 'copy');
  writeHistory(repo, [JSON.stringify({ v: 1, ts: '2026-02-02T00:00:00Z', headline: 'same' })]);
  writeHistory(wt, [JSON.stringify({ headline: 'same', ts: '2026-02-02T00:00:00Z', v: 1 })]);

  const plan = plannerFor();

  assert.equal(plan.projects[0].entries.length, 1);
});

test('AC4: entries sharing ts and headline but differing in body stop the run', () => {
  const repo = makeRepo('ashenvale');
  const wt = makeWorktree(repo, 'diverged');
  writeHistory(repo, [entry('2026-02-02T00:00:00Z', 'same words', { next: 'one thing' })]);
  writeHistory(wt, [entry('2026-02-02T00:00:00Z', 'same words', { next: 'a different thing' })]);

  const plan = plannerFor();

  assert.equal(plan.problems.length, 1);
  assert.match(plan.problems[0], /2026-02-02T00:00:00Z/);
  assert.throws(() => writePlan(plan, { storeDir: store }), /refus/i);
});

test('AC4: a malformed line is reported, never silently dropped', () => {
  const repo = makeRepo('duskfen');
  writeHistory(repo, [entry('2026-01-01T00:00:00Z', 'good'), '{not json']);

  const plan = plannerFor();

  assert.equal(plan.accounting.malformed.length, 1);
  assert.match(plan.accounting.malformed[0], /duskfen/);
});

// ---------------------------------------------------------------- AC5

test('AC5: the accounting balances — every line read is written or attributed to a duplicate', () => {
  const repo = makeRepo('marrowlight');
  const wt = makeWorktree(repo, 'copy');
  const shared = entry('2026-02-02T00:00:00Z', 'shared');
  writeHistory(repo, [shared, entry('2026-03-03T00:00:00Z', 'unique to root')]);
  writeHistory(wt, [shared, entry('2026-01-01T00:00:00Z', 'unique to worktree')]);

  const plan = plannerFor();
  const { parsed, written, duplicates } = plan.accounting;

  assert.equal(parsed, 4);
  assert.equal(written, 3);
  assert.equal(duplicates.length, 1);
  assert.equal(written + duplicates.length, parsed, 'inputs must equal outputs plus duplicates');
  assert.equal(plan.accounting.balanced, true);
  // every duplicate names the entry it duplicates
  assert.match(duplicates[0].duplicateOf, /2026-02-02T00:00:00Z/);
});

test('AC5: the report names the search roots and one row per resulting project, listing the source paths', () => {
  const a = makeRepo('fernhollow');
  const b = makeRepo('gildergreen');
  writeHistory(a, [entry('2026-01-01T00:00:00Z', 'alpha')]);
  writeHistory(b, [entry('2026-01-02T00:00:00Z', 'beta')]);

  const report = renderReport(plannerFor());

  assert.match(report, new RegExp(workspace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(report, /fernhollow/);
  assert.match(report, /gildergreen/);
  // AC5 asks for the source paths each project file was built from, not a bare
  // count — the row must name the actual history file, so a missed alias is a
  // recognisable path rather than an opaque number.
  assert.match(report, /compass-history\.jsonl/, 'each project row lists its source paths');
});

// ---------------------------------------------------------------- AC6

test('AC6: building a plan writes nothing at all', () => {
  const repo = makeRepo('nettleburn');
  writeHistory(repo, [entry('2026-01-01T00:00:00Z', 'x')]);

  plannerFor();

  assert.equal(fs.existsSync(store), false, 'the store is untouched until asked to write');
});

test('AC6: writing leaves every source file byte-identical', () => {
  const repo = makeRepo('coldharrow');
  writeHistory(repo, [entry('2026-01-01T00:00:00Z', 'x')]);
  const source = path.join(repo, 'docs', 'status', 'compass-history.jsonl');
  const before = fs.readFileSync(source);
  const statusBefore = git(repo, 'status', '--porcelain');

  writePlan(plannerFor(), { storeDir: store });

  assert.deepEqual(fs.readFileSync(source), before, 'the source file is byte-identical');
  assert.equal(
    git(repo, 'status', '--porcelain'),
    statusBefore,
    'the surveyed repo sees no change at all',
  );
});

test('AC6: re-running after a successful write adds nothing', () => {
  const repo = makeRepo('windrow');
  writeHistory(repo, [entry('2026-01-01T00:00:00Z', 'x'), entry('2026-01-02T00:00:00Z', 'y')]);

  const first = writePlan(plannerFor(), { storeDir: store });
  const target = path.join(store, `${projectKey(repo)}.jsonl`);
  const afterFirst = fs.readFileSync(target, 'utf8');

  const second = writePlan(plannerFor(), { storeDir: store });

  assert.equal(first.appended, 2);
  assert.equal(second.appended, 0);
  assert.equal(fs.readFileSync(target, 'utf8'), afterFirst);
});

test('AC6: a second run appends only genuinely new entries, without reordering', () => {
  const repo = makeRepo('bellhollow');
  writeHistory(repo, [entry('2026-01-01T00:00:00Z', 'first')]);
  writePlan(plannerFor(), { storeDir: store });

  writeHistory(repo, [entry('2026-01-01T00:00:00Z', 'first'), entry('2026-01-09T00:00:00Z', 'later')]);
  const second = writePlan(plannerFor(), { storeDir: store });

  const lines = fs
    .readFileSync(path.join(store, `${projectKey(repo)}.jsonl`), 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l).headline);
  assert.equal(second.appended, 1);
  assert.deepEqual(lines, ['first', 'later']);
});

test("AC4: a project's first write leaves no leftover temp file (cleanup)", () => {
  // The first write of a project file is atomic (temp file, then rename into
  // place); this asserts only the cleanup half — the temp file is moved, never
  // left behind. It does not (and cannot without interrupting the process)
  // prove the rename itself is atomic. Re-run appends are intentionally not
  // atomic (ADR-0004 §2 append-only) and are covered by the AC6 re-run tests.
  const repo = makeRepo('thornquay');
  writeHistory(repo, [entry('2026-01-01T00:00:00Z', 'x')]);
  const plan = plannerFor();

  writePlan(plan, { storeDir: store });

  const leftovers = fs.readdirSync(store).filter((n) => !n.endsWith('.jsonl'));
  assert.deepEqual(leftovers, [], 'no temporary file is left behind');
});

// ---------------------------------------------------------------- AC1

test('AC1: a capture copies every live source and records where it looked', () => {
  const repo = makeRepo('lanternwood');
  const wt = makeWorktree(repo, 'a-branch');
  writeHistory(repo, [entry('2026-01-01T00:00:00Z', 'root')]);
  writeHistory(wt, [entry('2026-01-02T00:00:00Z', 'worktree')]);
  const dest = path.join(workspace, '_capture-test');

  const result = writeCapture(collectSources({ searchRoots: [workspace] }), {
    dir: dest,
    searchRoots: [workspace],
  });

  assert.equal(result.files, 2);
  assert.equal(result.lines, 2);
  const names = fs.readdirSync(dest);
  assert.equal(names.filter((n) => n.endsWith('.jsonl')).length, 2);
  const manifest = fs.readFileSync(path.join(dest, 'MANIFEST.md'), 'utf8');
  assert.match(manifest, new RegExp(workspace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(manifest, /lanternwood/);
});

test('AC1: a capture refuses to overwrite an existing one', () => {
  const repo = makeRepo('gravencourt');
  writeHistory(repo, [entry('2026-01-01T00:00:00Z', 'x')]);
  const dest = path.join(workspace, '_capture-twice');
  const sources = collectSources({ searchRoots: [workspace] });

  writeCapture(sources, { dir: dest, searchRoots: [workspace] });

  assert.throws(() => writeCapture(sources, { dir: dest, searchRoots: [workspace] }), /refus/i);
});

test('AC1: a source changing between planning and writing aborts instead of merging', () => {
  const repo = makeRepo('saltmarch');
  writeHistory(repo, [entry('2026-01-01T00:00:00Z', 'x')]);
  const plan = plannerFor();

  // Something appends after the plan was built.
  fs.appendFileSync(
    path.join(repo, 'docs', 'status', 'compass-history.jsonl'),
    `${entry('2026-01-02T00:00:00Z', 'appended behind our back')}\n`,
  );

  assert.throws(() => writePlan(plan, { storeDir: store }), /changed/i);
  assert.equal(fs.existsSync(store), false, 'nothing was written');
});
