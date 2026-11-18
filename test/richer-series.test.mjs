// Spec 013-03: slice and bug counts, provenance, and labels in the series.
// Fixtures use invented project names only (leak gate).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildProgressSeries, validateSnapshot, realSliceCounts } from '../src/lib.mjs';
import { scanProject, snapshotFileFor } from '../src/scan.mjs';
import { evolutionChartSvg } from '../public/render.mjs';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'snapshot.mjs');
const STORE = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-rich-store-'));
const dirs = [];
after(() => {
  fs.rmSync(STORE, { recursive: true, force: true });
  dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true }));
});
const run = (args) =>
  execFileSync(process.execPath, [SCRIPT, ...args], { env: { ...process.env, DASHBOARD_SNAPSHOTS: STORE }, stdio: 'pipe' });
process.env.DASHBOARD_SNAPSHOTS = STORE;

function project(specs) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dash-rich-proj-')));
  dirs.push(dir);
  for (const { id, status, slices = [] } of specs) {
    const d = path.join(dir, 'docs', 'specs', id);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'spec.md'), `---\nstatus: ${status}\n---\n# Spec ${id}\n`);
    slices.forEach((st, i) => {
      const body = st === null ? '# no frontmatter status\n' : `---\nstatus: ${st}\n---\n# s\n`;
      fs.writeFileSync(path.join(d, `slice-0${i + 1}-x.md`), body);
    });
  }
  return dir;
}
const lastLine = (dir) => {
  const l = fs.readFileSync(snapshotFileFor(dir), 'utf8').trim().split('\n');
  return JSON.parse(l[l.length - 1]);
};
const lines = (dir) => (fs.existsSync(snapshotFileFor(dir)) ? fs.readFileSync(snapshotFileFor(dir), 'utf8').trim().split('\n').length : 0);

// --- AC1 ---
test('013-03 AC1: realSliceCounts counts real slices only, ABANDONED out of total; null when none', () => {
  const specs = [
    { slices: [{ status: 'DONE' }, { status: 'ABANDONED' }, { status: 'READY_FOR_IMPLEMENTATION' }, { status: null }] },
    { slices: [{ status: 'DONE' }] },
  ];
  assert.deepEqual(realSliceCounts(specs), { done: 2, total: 3 });
  assert.equal(realSliceCounts([{ slices: [{ status: null }] }, { slices: [] }]), null);
});

test('013-03 AC1: writer stores slices (real only, ABANDONED excluded) and bugs on auto and narrative entries', () => {
  const dir = project([
    { id: '001-a', status: 'IN_PROGRESS', slices: ['DONE', 'IN_PROGRESS', 'ABANDONED', null] },
  ]);
  fs.mkdirSync(path.join(dir, 'docs', 'bugs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', 'bugs', '001-x.md'), '# Bug\nopen\n');
  run(['--project', dir, '--auto']);
  const a = lastLine(dir);
  assert.deepEqual(a.slices, { done: 1, total: 2 });
  assert.deepEqual(a.bugs, { open: 1 });
  run(['--project', dir, '--headline', 'prose']);
  const m = lastLine(dir);
  assert.deepEqual(m.slices, { done: 1, total: 2 });
  assert.deepEqual(m.bugs, { open: 1 });
});

test('013-03 AC1: slices omitted when the project has no real slices', () => {
  const dir = project([{ id: '001-a', status: 'DONE' }]);
  run(['--project', dir, '--auto']);
  const s = lastLine(dir);
  assert.equal('slices' in s, false);
  assert.deepEqual(s.bugs, { open: 0 });
});

// --- AC2 ---
test('013-03 AC2: scanned provenance: null branch outside git; branch name and worktree flag in a linked worktree', () => {
  const plain = project([{ id: '001-a', status: 'DONE' }]);
  run(['--project', plain, '--auto']);
  assert.deepEqual(lastLine(plain).scanned, { branch: null, worktree: false });

  const repo = project([{ id: '001-a', status: 'DONE' }]);
  const git = (...a) => execFileSync('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...a], { stdio: 'pipe' });
  git('init', '-b', 'trunk');
  git('add', '.');
  git('commit', '-m', 'init');
  run(['--project', repo, '--auto']);
  assert.deepEqual(lastLine(repo).scanned, { branch: 'trunk', worktree: false });
  const wt = path.join(repo, '..', path.basename(repo) + '-wt');
  dirs.push(wt);
  git('worktree', 'add', '-b', 'feature-x', wt);
  run(['--project', wt, '--auto']);
  // History is keyed on the parent repo (projectRootOf), so read it via the repo.
  assert.deepEqual(lastLine(repo).scanned, { branch: 'feature-x', worktree: true });
});

test('013-03 AC2: a project configured at a repo SUBDIRECTORY records branch null', () => {
  const repo = project([]);
  const git = (...a) => execFileSync('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...a], { stdio: 'pipe' });
  git('init', '-b', 'trunk');
  const sub = path.join(repo, 'pkg');
  const d = path.join(sub, 'docs', 'specs', '001-a');
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'spec.md'), '---\nstatus: DONE\n---\n# Spec\n');
  run(['--project', sub, '--auto']);
  assert.equal(lastLine(sub).scanned.branch, null);
});

// --- AC3 ---
const base = { v: 1, ts: '2026-01-01T00:00:00Z', headline: 'h' };
test('013-03 AC3: validator accepts well-formed new fields and old entries; rejects malformed ones', () => {
  assert.deepEqual(validateSnapshot(base), []);
  assert.deepEqual(
    validateSnapshot({ ...base, slices: { done: 1, total: 2 }, bugs: { open: 0 }, scanned: { branch: null, worktree: false } }),
    [],
  );
  assert.deepEqual(validateSnapshot({ ...base, scanned: { branch: 'main', worktree: true } }), []);
  for (const bad of [
    { slices: { done: 1 } },
    { slices: { done: 'a', total: 2 } },
    { slices: null },
    { bugs: {} },
    { bugs: { open: '1' } },
    { scanned: { branch: 5, worktree: false } },
    { scanned: { branch: 'm', worktree: 'yes' } },
    { scanned: null },
  ]) {
    assert.notDeepEqual(validateSnapshot({ ...base, ...bad }), [], JSON.stringify(bad));
  }
});

// --- AC4 ---
test('013-03 AC4: --if-changed writes on a slice-only change, ignores a bug-only change', () => {
  const dir = project([{ id: '001-a', status: 'IN_PROGRESS', slices: ['IN_PROGRESS', 'READY_FOR_IMPLEMENTATION'] }]);
  run(['--project', dir, '--auto', '--if-changed']);
  assert.equal(lines(dir), 1);
  fs.mkdirSync(path.join(dir, 'docs', 'bugs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', 'bugs', '001-x.md'), '# Bug\nopen\n');
  run(['--project', dir, '--auto', '--if-changed']);
  assert.equal(lines(dir), 1, 'bug-only change: no new entry');
  fs.writeFileSync(path.join(dir, 'docs', 'specs', '001-a', 'slice-01-x.md'), '---\nstatus: DONE\n---\n# s\n');
  run(['--project', dir, '--auto', '--if-changed']);
  assert.equal(lines(dir), 2, 'a slice finished: new entry');
  fs.writeFileSync(path.join(dir, 'docs', 'specs', '001-a', 'slice-03-y.md'), '---\nstatus: DRAFT\n---\n# s\n');
  run(['--project', dir, '--auto', '--if-changed']);
  assert.equal(lines(dir), 3, 'a slice added: new entry');
});

test('013-03 AC4: an old stored entry without slices vs a new one with them counts as changed once', () => {
  const dir = project([{ id: '001-a', status: 'IN_PROGRESS', slices: ['IN_PROGRESS'] }]);
  fs.mkdirSync(path.dirname(snapshotFileFor(dir)), { recursive: true });
  fs.writeFileSync(
    snapshotFileFor(dir),
    JSON.stringify({ v: 1, ts: '2026-01-01T00:00:00Z', headline: 'auto: old', source: 'auto', next: 'in progress: 001-a', specs: { done: 0, total: 1 } }) + '\n',
  );
  run(['--project', dir, '--auto', '--if-changed']);
  assert.equal(lines(dir), 2, 'first slice-carrying entry is written');
  run(['--project', dir, '--auto', '--if-changed']);
  assert.equal(lines(dir), 2, 'then unchanged');
});

// --- AC5 ---
test('013-03 AC5: series passes slices/bugs/scanned through when well-formed; drops malformed extras, keeps the point; mixed old/new', () => {
  const l = (o) => JSON.stringify({ v: 1, headline: 'h', specs: { done: 1, total: 2 }, source: 'auto', ...o });
  const text = [
    l({ ts: '2026-01-01T00:00:00Z' }), // old
    l({ ts: '2026-01-02T00:00:00Z', slices: { done: 2, total: 5 }, bugs: { open: 3 }, scanned: { branch: 'm', worktree: false } }),
    l({ ts: '2026-01-03T00:00:00Z', slices: { done: 'x', total: 5 }, bugs: { open: 'y' }, scanned: { branch: 7, worktree: 1 } }),
  ].join('\n');
  const { points } = buildProgressSeries(text);
  assert.equal(points.length, 3);
  assert.equal('slices' in points[0], false);
  assert.deepEqual(points[1].slices, { done: 2, total: 5 });
  assert.deepEqual(points[1].bugs, { open: 3 });
  assert.deepEqual(points[1].scanned, { branch: 'm', worktree: false });
  for (const k of ['slices', 'bugs', 'scanned']) assert.equal(k in points[2], false, k);
});

test('013-03 AC5: history.live carries slices from the current scan (real slices only); absent with none', () => {
  const dir = project([{ id: '001-a', status: 'IN_PROGRESS', slices: ['DONE', 'IN_PROGRESS', null] }]);
  const p = scanProject({ path: dir, pinnedWorkstreams: [], hiddenWorkstreams: [] });
  assert.deepEqual(p.history.live.slices, { done: 1, total: 2 });
  const q = scanProject({ path: project([{ id: '001-a', status: 'DONE' }]), pinnedWorkstreams: [], hiddenWorkstreams: [] });
  assert.equal('slices' in q.history.live, false);
});

// --- chart ---
const DAY = 86400000;
const T0 = Date.parse('2026-01-01T00:00:00Z');
const NOW = T0 + 20 * DAY;
const pt = (d, done, total, extra = {}) => ({ ts: new Date(T0 + d * DAY).toISOString(), done, total, source: 'auto', ...extra });
const hist = (points, live) => ({ points, live, skipped: { noNumbers: 0, malformed: 0 } });
const cls = (svg, c) => svg.match(new RegExp(`<path class="${c}"[^>]*>`));

test('013-03 AC6: slice lines drawn from 1 slice-carrying point (dashed only), absent at 0', () => {
  const none = evolutionChartSvg(hist([pt(0, 1, 3), pt(10, 2, 3)], { done: 2, total: 3 }), NOW);
  assert.doesNotMatch(none, /evo-slice/);
  const one = evolutionChartSvg(
    hist([pt(0, 1, 3), pt(10, 2, 3, { slices: { done: 4, total: 8 } })], { done: 2, total: 3, slices: { done: 6, total: 9 } }),
    NOW,
  );
  assert.match(one, /<path class="evo-slice-done-live"[^>]*stroke-dasharray/);
  assert.match(one, /<path class="evo-slice-total-live"/);
  assert.doesNotMatch(one, /<path class="evo-slice-done"[^>]*stroke-dasharray/);
  // spec lines untouched; slice scale is its own (max slice total 9 here, not 3)
  assert.ok(cls(one, 'evo-done') && cls(one, 'evo-total'));
  const d = one.match(/<path class="evo-slice-done-live"[^>]*? d="([^"]*)"/)[1];
  assert.match(d, /^M[\d.]+ [\d.]+H[\d.]+V[\d.]+$/);
  // Own y-scale: slice max is 9 (spec max 3), so the live slice-total ends at the
  // top (y=10) and the right-axis max label reads 9, independent of the spec scale.
  const tl = one.match(/<path class="evo-slice-total-live"[^>]*? d="([^"]*)"/)[1];
  assert.match(tl, /V10$/);
  assert.match(one, /text-anchor="start"[^>]*>9</);
  // slice-done is distinct from the (green) narrative dots
  assert.match(one, /<path class="evo-slice-done"[^>]*stroke="var\(--purple\)"/);
});

test('013-03 AC6: slice line starts at the first slice-carrying point and has a solid part from 2 points', () => {
  const two = evolutionChartSvg(
    hist(
      [pt(0, 1, 3), pt(5, 1, 3, { slices: { done: 1, total: 4 } }), pt(10, 2, 3, { slices: { done: 2, total: 4 } })],
      { done: 2, total: 3, slices: { done: 3, total: 4 } },
    ),
    NOW,
  );
  const d = two.match(/<path class="evo-slice-done"[^>]*? d="([^"]*)"/)[1];
  assert.equal(d.split('V').length, 2, 'one step between two points');
  const x0 = Number(d.match(/^M([\d.]+) /)[1]);
  assert.ok(x0 > 34, 'starts after the chart origin (first slice point is not the first point)');
});

test('013-03 AC7: y-axis label and key name each drawn line; slice entries only when shown', () => {
  const plain = evolutionChartSvg(hist([pt(0, 1, 3)], { done: 2, total: 3 }), NOW);
  assert.match(plain, />specs</);
  const key = plain.match(/<div class="evo-key">[\s\S]*?<\/div>/)[0];
  assert.match(key, /spec done/);
  assert.match(key, /spec total/);
  assert.doesNotMatch(key, /slice/);
  const rich = evolutionChartSvg(
    hist([pt(0, 1, 3, { slices: { done: 1, total: 2 } })], { done: 2, total: 3, slices: { done: 2, total: 2 } }),
    NOW,
  );
  assert.match(rich, />slices</);
  const k2 = rich.match(/<div class="evo-key">[\s\S]*?<\/div>/)[0];
  assert.match(k2, /slice done/);
  assert.match(k2, /slice total/);
  assert.doesNotMatch(rich, /#[0-9a-fA-F]{3,6}\b/);
});

test('013-03 AC8: precise down-step wording when both points carry scanned and differ; generic otherwise', () => {
  const sc = (branch, worktree) => ({ scanned: { branch, worktree } });
  const diff = evolutionChartSvg(hist([pt(0, 3, 4, sc('trunk', false)), pt(10, 2, 4, sc('feature-x', true))], { done: 2, total: 4 }), NOW);
  assert.match(diff, /counted on another branch or worktree: feature-x/);
  assert.doesNotMatch(diff, /a spec was reopened/);
  const old = evolutionChartSvg(hist([pt(0, 3, 4, sc('trunk', false)), pt(10, 2, 4)], { done: 2, total: 4 }), NOW);
  assert.match(old, /a spec was reopened or abandoned, the snapshot was taken on another branch or worktree, or the counting rule changed/);
  const same = evolutionChartSvg(hist([pt(0, 3, 4, sc('trunk', false)), pt(10, 2, 4, sc('trunk', false))], { done: 2, total: 4 }), NOW);
  // AC8 refinement (orchestrator, 2026-11-18): equal `scanned` rules out the branch cause.
  assert.match(same, /count went down: a spec was reopened or abandoned, or the counting rule changed</);
  assert.doesNotMatch(same, /another branch or worktree/);
  // Null branches (detached/unknown) cannot rule the branch cause out: generic wording.
  const nul = evolutionChartSvg(hist([pt(0, 3, 4, sc(null, false)), pt(10, 2, 4, sc(null, false))], { done: 2, total: 4 }), NOW);
  assert.match(nul, /a spec was reopened or abandoned, the snapshot was taken on another branch or worktree, or the counting rule changed/);
  const half = evolutionChartSvg(hist([pt(0, 3, 4, sc(null, false)), pt(10, 2, 4, sc('trunk', false))], { done: 2, total: 4 }), NOW);
  assert.match(half, /counted on another branch or worktree: trunk/);
});
