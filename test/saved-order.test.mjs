// Slice 012-03: saved order and narrative extras from snapshots.
// Every project/slice name is invented (the leak gate scans this file).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  parseCompassHistory,
  mergeSavedOrder,
  deriveRoadmap,
  validateSnapshot,
  validateRoadmapInput,
  validateRoadmapBlock,
  orderLabel,
} from '../src/lib.mjs';
import { scanProject, snapshotFileFor } from '../src/scan.mjs';
import { roadmapTabHtml } from '../public/render.mjs';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'snapshot.mjs');
const sl = (file, status, deps = []) => ({ file, status, dependencies: deps });
const sp = (id, status, slices, recency = 0) => ({ id, title: `Title ${id}`, status, slices, recency });
const specs3 = () => [
  sp('007-alpha', 'IN_PROGRESS', [sl('slice-01-a.md', 'IN_PROGRESS'), sl('slice-02-b.md', 'DRAFT'), sl('slice-03-c.md', 'DRAFT')], 100),
];
const entry = (extra = {}) => JSON.stringify({ v: 1, ts: '2026-05-01T10:00:00.000Z', headline: 'h', source: 'dashboard', ...extra });

// ---- AC3 reader
test('012-03 AC3: parseCompassHistory exposes the newest narrative entry carrying a roadmap', () => {
  const rm1 = { order: ['007-01'], orderOrigin: 'proposed', proposedAt: '2026-05-01T00:00:00Z' };
  const rm2 = { order: ['007-02'], orderOrigin: 'proposed', proposedAt: '2026-05-02T00:00:00Z' };
  const text = [
    entry({ ts: '2026-05-01T00:00:00Z', headline: 'one', roadmap: rm1 }),
    entry({ ts: '2026-05-02T00:00:00Z', headline: 'two', roadmap: rm2 }),
    entry({ ts: '2026-05-03T00:00:00Z', headline: 'plain narrative' }),
    entry({ ts: '2026-05-04T00:00:00Z', headline: 'auto: x', source: 'auto', roadmap: { order: ['007-03'] } }),
  ].join('\n');
  const r = parseCompassHistory(text);
  assert.equal(r.latestRoadmap.headline, 'two');
  assert.equal(r.latestNarrative.headline, 'plain narrative');
  assert.equal(parseCompassHistory(entry()).latestRoadmap, null);
});

// ---- AC4 merge
test('012-03 AC4: mergeSavedOrder drops dead IDs, appends new ones in automatic order, dedupes', () => {
  assert.deepEqual(mergeSavedOrder(['007-03', '007-09', '007-01', '007-03'], ['007-01', '007-02', '007-03', '007-04']), ['007-03', '007-01', '007-02', '007-04']);
  assert.deepEqual(mergeSavedOrder(null, ['a', 'b']), ['a', 'b']);
  assert.deepEqual(mergeSavedOrder(['x'], []), []);
});

// ---- deriveRoadmap with a saved entry
const saved = (rm, ts = '2026-05-01T10:00:00.000Z') => ({ ts, headline: 'h', source: 'dashboard', roadmap: rm });

test('012-03 AC3/AC4: no saved entry → automatic order, "automatic" origin, no flow', () => {
  const r = deriveRoadmap({ specs: specs3() });
  assert.deepEqual(r.autoOrder, ['007-01', '007-02', '007-03']);
  assert.equal(r.order.origin, 'automatic');
  assert.equal(r.flow, null);
  assert.equal(r.extras, null);
});

test('012-03 AC4: the saved order wins; DONE slices drop; new slices append (drift safety)', () => {
  const s = [sp('007-alpha', 'IN_PROGRESS', [sl('slice-01-a.md', 'DONE'), sl('slice-02-b.md', 'DRAFT'), sl('slice-03-c.md', 'DRAFT'), sl('slice-04-d.md', 'DRAFT')])];
  const r = deriveRoadmap({ specs: s, saved: saved({ order: ['007-03', '007-01', '007-02', '007-99'], orderOrigin: 'proposed', proposedAt: '2026-05-01T10:00:00.000Z' }) });
  assert.deepEqual(r.order.ids, ['007-03', '007-02', '007-04']);
  assert.deepEqual(r.flow.flatMap((g) => g.cards.map((c) => c.id)), ['007-03', '007-02', '007-04']);
});

test('012-03 AC5: groups label runs but never move cards; ungrouped slices take the spec title; split groups label each run', () => {
  const r = deriveRoadmap({
    specs: specs3(),
    saved: saved({
      order: ['007-01', '007-03', '007-02'],
      groups: [{ label: 'Core', slices: ['007-01', '007-02'] }],
      orderOrigin: 'corrected', correctedAt: '2026-05-01T10:00:00.000Z',
    }),
  });
  assert.deepEqual(r.flow.map((g) => [g.label, g.cards.map((c) => c.id)]), [
    ['Core', ['007-01']],
    ['Title 007-alpha', ['007-03']],
    ['Core', ['007-02']],
  ]);
});

test('012-03 AC6: extras present only when supplied', () => {
  const none = deriveRoadmap({ specs: specs3(), saved: saved({ order: ['007-01'], orderOrigin: 'proposed', proposedAt: '2026-05-01T10:00:00Z' }) });
  assert.equal(none.extras, null);
  const some = deriveRoadmap({ specs: specs3(), saved: saved({ order: ['007-01'], rule: 'Ship small.', locked: ['No new deps'], orderOrigin: 'proposed', proposedAt: '2026-05-01T10:00:00Z' }) });
  assert.deepEqual(some.extras, { rule: 'Ship small.', locked: ['No new deps'] });
});

test('012-03 AC7: origin/date come from proposedAt / correctedAt (never ts); stale compares spec recency to that date', () => {
  const t = Date.parse('2026-05-01T10:00:00Z') / 1000;
  const base = { order: ['007-01'] };
  const prop = deriveRoadmap({ specs: [sp('007-alpha', 'IN_PROGRESS', [sl('slice-01-a.md', 'DRAFT')], t - 10)], saved: saved({ ...base, orderOrigin: 'proposed', proposedAt: '2026-05-01T10:00:00Z' }, '2026-09-09T00:00:00Z') });
  assert.equal(prop.order.origin, 'proposed');
  assert.equal(prop.order.at, '2026-05-01T10:00:00Z');
  assert.equal(prop.order.stale, false);
  const cor = deriveRoadmap({ specs: [sp('007-alpha', 'IN_PROGRESS', [sl('slice-01-a.md', 'DRAFT')], t + 10)], saved: saved({ ...base, orderOrigin: 'corrected', correctedAt: '2026-05-01T10:00:00Z', proposedAt: '2020-01-01T00:00:00Z' }, '2026-09-09T00:00:00Z') });
  assert.equal(cor.order.origin, 'corrected');
  assert.equal(cor.order.at, '2026-05-01T10:00:00Z');
  assert.equal(cor.order.stale, true);
});

// ---- render
const html = (r) => roadmapTabHtml(r);
test('012-03 AC5-7 render: label, group headings, extras; all escaped', () => {
  const r = deriveRoadmap({
    specs: specs3(),
    saved: saved({
      order: ['007-02', '007-01', '007-03'],
      groups: [{ label: 'G<b>one', slices: ['007-02'] }],
      layers: [{ name: 'L1', title: 'T<i>', text: 'Body & more' }],
      rule: 'Rule <script>', locked: ['Lock <u>'],
      orderOrigin: 'corrected', correctedAt: '2026-05-01T10:00:00.000Z',
    }),
  });
  const h = html(r);
  assert.match(h, /Order: yours · 2026-05-01/);
  assert.match(h, /G&lt;b&gt;one/);
  assert.match(h, /T&lt;i&gt;/);
  assert.match(h, /Rule &lt;script&gt;/);
  assert.match(h, /Lock &lt;u&gt;/);
  assert.doesNotMatch(h, /<script>|<b>|<i>|<u>/);
  assert.ok(h.indexOf('007-02') < h.indexOf('007-01'), 'cards follow the saved order');
});

test('012-03 AC6/7 render: automatic label, no extras boxes when absent, stale suffix', () => {
  const a = html(deriveRoadmap({ specs: specs3() }));
  assert.match(a, /Order: automatic/);
  assert.doesNotMatch(a, /rm-extras|rm-rule|rm-layer|rm-locked/);
  const t = Date.parse('2026-05-01T10:00:00Z') / 1000;
  const s = html(deriveRoadmap({ specs: [sp('007-alpha', 'IN_PROGRESS', [sl('slice-01-a.md', 'DRAFT')], t + 99)], saved: saved({ order: ['007-01'], orderOrigin: 'proposed', proposedAt: '2026-05-01T10:00:00Z' }) }));
  assert.match(s, /Order: proposed · 2026-05-01/);
  assert.match(s, /\(older than latest changes\)/);
});

// ---- validation
test('012-03 AC2: validateRoadmapInput refuses bad types and unknown slice-ID formats', () => {
  assert.deepEqual(validateRoadmapInput({ groups: [{ label: 'a', slices: ['007-01'] }], layers: [{ name: 'n', title: 't', text: 'x' }], rule: 'r', locked: ['l'], proposedOrder: ['007-01'] }), []);
  assert.ok(validateRoadmapInput(null).length);
  assert.ok(validateRoadmapInput({ proposedOrder: ['7-1'] }).length);
  assert.ok(validateRoadmapInput({ groups: [{ label: 1, slices: [] }] }).length);
  assert.ok(validateRoadmapInput({ layers: [{ name: 'n' }] }).length);
  assert.ok(validateRoadmapInput({ rule: 3 }).length);
  assert.ok(validateRoadmapInput({ locked: 'x' }).length);
  assert.deepEqual(validateSnapshot({ v: 1, ts: '2026-05-01T00:00:00Z', headline: 'h', roadmap: { order: ['007-01'], orderOrigin: 'proposed', proposedAt: '2026-05-01T00:00:00Z' } }), []);
  assert.ok(validateSnapshot({ v: 1, ts: '2026-05-01T00:00:00Z', headline: 'h', roadmap: { order: ['007-01'] } }).length, 'orderOrigin is required');
  assert.ok(validateSnapshot({ v: 1, ts: '2026-05-01T00:00:00Z', headline: 'h', roadmap: { order: 'x' } }).length);
});

// ---- CLI
const dirs = [];
after(() => dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));
function mkProj() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-so-proj-'));
  const store = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-so-store-'));
  dirs.push(dir, store);
  const d = path.join(dir, 'docs', 'specs', '007-alpha');
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'spec.md'), '---\nstatus: IN_PROGRESS\n---\n# Spec 007: Alpha\n');
  for (const [n, st] of [['01', 'IN_PROGRESS'], ['02', 'DRAFT'], ['03', 'DRAFT']]) {
    fs.writeFileSync(path.join(d, `slice-${n}-x${n}.md`), `---\nstatus: ${st}\n---\n## Slice 007-${n} — thing ${n}\n`);
  }
  return { dir, store, env: { ...process.env, DASHBOARD_SNAPSHOTS: store } };
}
const cli = (p, args) => {
  try {
    return { code: 0, out: execFileSync(process.execPath, [SCRIPT, ...args], { env: p.env, stdio: ['ignore', 'pipe', 'pipe'] }).toString() };
  } catch (e) {
    return { code: e.status, out: String(e.stdout), err: String(e.stderr) };
  }
};
const withStore = (p, fn) => {
  const old = process.env.DASHBOARD_SNAPSHOTS;
  process.env.DASHBOARD_SNAPSHOTS = p.store;
  try { return fn(); } finally { if (old === undefined) delete process.env.DASHBOARD_SNAPSHOTS; else process.env.DASHBOARD_SNAPSHOTS = old; }
};
const lines = (p) => {
  const f = withStore(p, () => snapshotFileFor(p.dir));
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
};
const rmFile = (p, obj, name = 'rm.json') => {
  const f = path.join(p.store, name);
  fs.writeFileSync(f, typeof obj === 'string' ? obj : JSON.stringify(obj));
  return f;
};
const W = (p, f, extra = []) => cli(p, ['--project', p.dir, '--headline', 'next up', '--source', 'dashboard', '--roadmap', f, ...extra]);

test('012-03 AC2: first --roadmap writes proposed order; entry shape; non-roadmap entries unchanged', () => {
  const p = mkProj();
  const r = W(p, rmFile(p, { proposedOrder: ['007-03', '007-01'], rule: 'Ship small.', locked: ['x'], groups: [{ label: 'G', slices: ['007-03'] }], layers: [{ name: 'n', title: 't', text: 'x' }] }), ['--ts', '2026-05-01T10:00:00.000Z']);
  assert.equal(r.code, 0, r.err);
  const [e] = lines(p);
  assert.deepEqual(e.roadmap, {
    order: ['007-03', '007-01', '007-02'],
    groups: [{ label: 'G', slices: ['007-03'] }],
    layers: [{ name: 'n', title: 't', text: 'x' }],
    rule: 'Ship small.', locked: ['x'],
    orderOrigin: 'proposed', proposedAt: '2026-05-01T10:00:00.000Z',
  });
  assert.equal(e.source, 'dashboard');
  const q = mkProj();
  cli(q, ['--project', q.dir, '--headline', 'plain']);
  assert.equal('roadmap' in lines(q)[0], false);
});

test('012-03 AC2: no proposedOrder and no saved → automatic order', () => {
  const p = mkProj();
  W(p, rmFile(p, { rule: 'r' }));
  assert.deepEqual(lines(p)[0].roadmap.order, ['007-01', '007-02', '007-03']);
});

test('012-03 AC2: while proposed, a new proposedOrder replaces it with a fresh proposedAt; carry-forward without one keeps the date', () => {
  const p = mkProj();
  W(p, rmFile(p, { proposedOrder: ['007-02'] }), ['--ts', '2026-05-01T00:00:00.000Z']);
  W(p, rmFile(p, { rule: 'r' }), ['--ts', '2026-05-02T00:00:00.000Z']);
  let e = lines(p)[1];
  assert.deepEqual(e.roadmap.order, ['007-02', '007-01', '007-03']);
  assert.equal(e.roadmap.proposedAt, '2026-05-01T00:00:00.000Z', 'carry-forward never moves the date');
  W(p, rmFile(p, { proposedOrder: ['007-03'] }), ['--ts', '2026-05-03T00:00:00.000Z']);
  e = lines(p)[2];
  assert.deepEqual(e.roadmap.order, ['007-03', '007-01', '007-02']);
  assert.equal(e.roadmap.proposedAt, '2026-05-03T00:00:00.000Z');
});

test('012-03 AC2/AC8: --move corrects; corrected order ignores later proposedOrder; carry-forward keeps correctedAt', () => {
  const p = mkProj();
  W(p, rmFile(p, { proposedOrder: ['007-01', '007-02', '007-03'], rule: 'keep me' }), ['--ts', '2026-05-01T00:00:00.000Z']);
  const m = cli(p, ['--project', p.dir, '--move', '007-03', '--before', '007-02', '--ts', '2026-05-02T00:00:00.000Z']);
  assert.equal(m.code, 0, m.err);
  let e = lines(p)[1];
  assert.deepEqual(e.roadmap.order, ['007-01', '007-03', '007-02']);
  assert.equal(e.roadmap.orderOrigin, 'corrected');
  assert.equal(e.roadmap.correctedAt, '2026-05-02T00:00:00.000Z');
  assert.equal('proposedAt' in e.roadmap, false);
  assert.equal(e.roadmap.rule, 'keep me', 'block copied, only the order changes');
  assert.equal(e.headline, 'next up');
  assert.equal(e.source, 'dashboard');
  const w = W(p, rmFile(p, { proposedOrder: ['007-02', '007-03', '007-01'], rule: 'new rule' }), ['--ts', '2026-05-09T00:00:00.000Z']);
  assert.match(w.out, /suggest/i);
  e = lines(p)[2];
  assert.deepEqual(e.roadmap.order, ['007-01', '007-03', '007-02'], 'proposal ignored once corrected');
  assert.equal(e.roadmap.correctedAt, '2026-05-02T00:00:00.000Z');
  assert.equal(e.roadmap.rule, 'new rule', 'narrative still refreshes');
});

test('012-03 AC2: --move refuses unknown IDs / no saved roadmap, writing nothing', () => {
  const p = mkProj();
  assert.notEqual(cli(p, ['--project', p.dir, '--move', '007-01', '--before', '007-02']).code, 0);
  assert.equal(lines(p).length, 0);
  W(p, rmFile(p, { rule: 'r' }));
  assert.notEqual(cli(p, ['--project', p.dir, '--move', '007-01', '--before', '007-77']).code, 0);
  assert.notEqual(cli(p, ['--project', p.dir, '--move', '007-77', '--before', '007-01']).code, 0);
  assert.equal(lines(p).length, 1);
});

test('012-03 AC2: invalid roadmap file is refused with a message, nothing written', () => {
  const p = mkProj();
  for (const bad of ['{not json', { proposedOrder: ['bad'] }, { rule: 5 }]) {
    const r = W(p, rmFile(p, bad));
    assert.notEqual(r.code, 0);
    assert.match(r.err, /roadmap/i);
  }
  assert.equal(lines(p).length, 0);
  assert.notEqual(W(p, path.join(p.store, 'missing.json')).code, 0);
});

test('012-03 AC2: --print-order prints the arrow line and origin, writes nothing', () => {
  const p = mkProj();
  let r = cli(p, ['--project', p.dir, '--print-order']);
  assert.match(r.out, /007-01 → 007-02 → 007-03/);
  assert.match(r.out, /automatic/);
  W(p, rmFile(p, { proposedOrder: ['007-03'] }), ['--ts', '2026-05-01T00:00:00.000Z']);
  const n = lines(p).length;
  r = cli(p, ['--project', p.dir, '--print-order']);
  assert.match(r.out, /007-03 → 007-01 → 007-02/);
  assert.match(r.out, /proposed/);
  assert.equal(lines(p).length, n);
});

test('012-03 AC3: the scan exposes the saved roadmap; tab data carries flow + order', () => {
  const p = mkProj();
  W(p, rmFile(p, { proposedOrder: ['007-02'], rule: 'r' }));
  const proj = withStore(p, () => scanProject({ path: p.dir, pinnedWorkstreams: [], hiddenWorkstreams: [] }));
  assert.deepEqual(proj.roadmap.order.ids, ['007-02', '007-01', '007-03']);
  assert.equal(proj.roadmap.order.origin, 'proposed');
  assert.equal(proj.roadmap.extras.rule, 'r');
});

test('012-03 AC9: a dashboard entry whose only change is the roadmap block is not skipped by --if-changed', () => {
  const p = mkProj();
  W(p, rmFile(p, { proposedOrder: ['007-01'] }), ['--if-changed', '--ts', '2026-05-01T00:00:00.000Z']);
  // same headline/next/specs; only the roadmap differs
  const r = W(p, rmFile(p, { proposedOrder: ['007-03'] }), ['--if-changed', '--ts', '2026-05-02T00:00:00.000Z']);
  assert.doesNotMatch(r.out, /unchanged/);
  assert.equal(lines(p).length, 2);
});

// ---- A3 probe: every store reader tolerates the nested roadmap field
test('012-03 A3: reader, series builder and validateSnapshot tolerate a nested roadmap', async () => {
  const { buildProgressSeries } = await import('../src/lib.mjs');
  const text = entry({ roadmap: { order: ['007-01'], groups: [{ label: 'g', slices: ['007-01'] }] }, specs: { done: 1, total: 2 } });
  const r = parseCompassHistory(text);
  assert.equal(r.malformed, 0);
  assert.equal(r.latest.headline, 'h');
  assert.equal(buildProgressSeries(text).points.length, 1);
});

// ---- review follow-up
test('012-03 follow-up 1: bare --roadmap and conflicting mode combinations are refused, nothing written', () => {
  const p = mkProj();
  const f = rmFile(p, { rule: 'r' });
  const cases = [
    ['--project', p.dir, '--headline', 'h', '--roadmap'],
    ['--project', p.dir, '--headline', 'h', '--roadmap', '--source', 'dashboard'],
    ['--project', p.dir, '--auto', '--roadmap', f],
    ['--project', p.dir, '--move', '007-01', '--before', '007-02', '--headline', 'h'],
    ['--project', p.dir, '--move', '007-01', '--before', '007-02', '--roadmap', f],
    ['--project', p.dir, '--move', '007-01', '--before', '007-02', '--auto'],
    ['--project', p.dir, '--move', '007-01', '--before', '007-02', '--source', 'manual'],
    ['--all', '--move', '007-01', '--before', '007-02'],
    ['--all', '--print-order'],
  ];
  for (const c of cases) {
    const r = cli(p, c);
    assert.notEqual(r.code, 0, c.join(' '));
    assert.match(r.err, /--roadmap|--move|--print-order|--source/, c.join(' '));
  }
  assert.equal(lines(p).length, 0);
  for (const c of [['--all', '--move', '007-01', '--before', '007-02'], ['--all', '--print-order']]) {
    assert.match(cli(p, c).err, /one --project, not --all/, c.join(' '));
  }
});

test('012-03 follow-up 1: --move copies source from the latest narrative entry', () => {
  const p = mkProj();
  W(p, rmFile(p, { rule: 'r' }));
  cli(p, ['--project', p.dir, '--move', '007-03', '--before', '007-01']);
  assert.equal(lines(p)[1].source, 'dashboard');
});

test('012-03 follow-up 3: a malformed roadmap block never becomes latestRoadmap, never crashes scan/render', () => {
  const good = { order: ['007-01'], orderOrigin: 'proposed', proposedAt: '2026-05-01T00:00:00Z' };
  const bads = [
    { ...good, layers: [null] },
    { ...good, proposedAt: 2026 },
    { ...good, orderOrigin: 'corrected', correctedAt: 'not a date' },
    { ...good, correctedAt: '2026-05-02T00:00:00Z' }, // proposed + correctedAt
    { order: ['007-01'], orderOrigin: 'corrected', proposedAt: '2026-05-01T00:00:00Z' }, // corrected + proposedAt
  ];
  for (const bad of bads) {
    const r = parseCompassHistory([entry({ ts: '2026-05-01T00:00:00Z', headline: 'ok', roadmap: good }), entry({ ts: '2026-05-02T00:00:00Z', headline: 'bad', roadmap: bad })].join('\n'));
    assert.equal(r.latestRoadmap.headline, 'ok', JSON.stringify(bad));
    assert.equal(r.latest.headline, 'bad', 'the headline itself still shows');
  }
  assert.deepEqual(validateRoadmapBlock({ ...good, orderOrigin: 'corrected', proposedAt: undefined, correctedAt: '2026-05-02T00:00:00Z' }), []);
  // end to end: scan + render survive a hand-edited bad line
  const p = mkProj();
  fs.mkdirSync(path.dirname(withStore(p, () => snapshotFileFor(p.dir))), { recursive: true });
  fs.writeFileSync(withStore(p, () => snapshotFileFor(p.dir)), entry({ roadmap: { ...good, layers: [null], proposedAt: 2026 } }) + '\n');
  const proj = withStore(p, () => scanProject({ path: p.dir, pinnedWorkstreams: [], hiddenWorkstreams: [] }));
  assert.equal(proj.roadmap.order.origin, 'automatic');
  assert.doesNotThrow(() => roadmapTabHtml(proj.roadmap));
});

test('012-03 follow-up 4: one orderLabel helper feeds the tab data, the render and --print-order', () => {
  assert.equal(orderLabel({ origin: 'automatic' }), 'Order: automatic');
  assert.equal(orderLabel({ origin: 'proposed', atLabel: '2026-05-01' }), 'Order: proposed · 2026-05-01');
  assert.equal(orderLabel({ origin: 'corrected', atLabel: '2026-05-02' }), 'Order: yours · 2026-05-02');
  const r = deriveRoadmap({ specs: specs3(), saved: saved({ order: ['007-01'], orderOrigin: 'corrected', correctedAt: '2026-05-02T00:00:00Z' }) });
  assert.equal(r.order.label, 'Order: yours · 2026-05-02');
  assert.ok(html(r).includes('Order: yours · 2026-05-02'));
  // render prints exactly what the scanner supplied
  assert.ok(roadmapTabHtml({ ...r, order: { ...r.order, label: 'Order: SENTINEL' } }).includes('Order: SENTINEL'));
  const p = mkProj();
  W(p, rmFile(p, { rule: 'r' }));
  cli(p, ['--project', p.dir, '--move', '007-03', '--before', '007-01', '--ts', '2026-05-02T00:00:00.000Z']);
  const out = cli(p, ['--project', p.dir, '--print-order']).out;
  assert.match(out, /007-03 → 007-01 → 007-02/);
  assert.match(out, /Order: yours · 2026-05-02/); // follow-up 9
});

test('012-03 follow-up 6/8: missing file writes nothing; --move refuses missing --before and same id', () => {
  const p = mkProj();
  assert.notEqual(W(p, path.join(p.store, 'missing.json')).code, 0);
  assert.equal(lines(p).length, 0);
  W(p, rmFile(p, { rule: 'r' }));
  assert.notEqual(cli(p, ['--project', p.dir, '--move', '007-01']).code, 0);
  assert.notEqual(cli(p, ['--project', p.dir, '--move', '007-01', '--before', '007-01']).code, 0);
  assert.equal(lines(p).length, 1);
});

test('012-03 follow-up 7: the card compass payload has no roadmap key', () => {
  const p = mkProj();
  W(p, rmFile(p, { rule: 'r' }));
  const proj = withStore(p, () => scanProject({ path: p.dir, pinnedWorkstreams: [], hiddenWorkstreams: [] }));
  assert.ok(proj.compass);
  assert.equal('roadmap' in proj.compass, false);
});

// ---- second follow-up round
test('012-03 round2 item 1/2/3: more refused combinations; explicit `order` in the file is refused', () => {
  const p = mkProj();
  const f = rmFile(p, { rule: 'r' });
  W(p, f);
  const n = lines(p).length;
  const mv = ['--project', p.dir, '--move', '007-01', '--before', '007-02'];
  for (const extra of [['--next', 'x'], ['--blockers', 'a']]) {
    assert.match(cli(p, [...mv, ...extra]).err, new RegExp(`--move cannot be combined with ${extra[0]}`));
  }
  const po = ['--project', p.dir, '--print-order'];
  for (const extra of [['--move', '007-01', '--before', '007-02'], ['--headline', 'h'], ['--roadmap', f]]) {
    const r = cli(p, [...po, ...extra]);
    assert.notEqual(r.code, 0, extra.join(' '));
    assert.match(r.err, /--print-order is read-only/, extra.join(' '));
  }
  const bad = W(p, rmFile(p, { order: ['007-02'], rule: 'r' }, 'withorder.json'));
  assert.notEqual(bad.code, 0);
  assert.match(bad.err, /writer owns.*proposedOrder|proposedOrder.*writer owns/s);
  assert.equal(lines(p).length, n, 'nothing written by any refusal');
});

test('012-03 round2 item 4: non-NNN-MM slice tokens never enter the saved order and never vanish from the flow', () => {
  const s = [
    sp('007-alpha', 'IN_PROGRESS', [sl('slice-01-a.md', 'DRAFT'), sl('slice-01-dup.md', 'DRAFT'), sl('slice-02-b.md', 'DRAFT')], 100),
    sp('12-short', 'IN_PROGRESS', [sl('slice-01-x.md', 'DRAFT'), sl('slice-02-y.md', 'DRAFT')], 50),
  ];
  const plain = deriveRoadmap({ specs: s });
  assert.deepEqual(plain.autoOrder, ['007-01', '007-02'], 'only conforming, unique ids');
  const r = deriveRoadmap({ specs: s, saved: saved({ order: ['007-02', '007-01'], orderOrigin: 'proposed', proposedAt: '2026-05-01T00:00:00Z' }) });
  const shown = r.flow.flatMap((g) => g.cards.map((c) => c.file));
  assert.deepEqual(shown.slice(0, 2), ['slice-02-b.md', 'slice-01-a.md']);
  assert.equal(shown.length, 5, 'every unfinished card still shown');
  assert.ok(shown.includes('slice-01-dup.md') && shown.includes('slice-01-x.md') && shown.includes('slice-02-y.md'));
  assert.ok(r.flow.slice(-1)[0].cards.length >= 1);
});

test('012-03 round2 item 4 (CLI): a project with a non-conforming spec id can still be written to', () => {
  const p = mkProj();
  const d = path.join(p.dir, 'docs', 'specs', '12-short');
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'spec.md'), '---\nstatus: IN_PROGRESS\n---\n# Spec 12: Short\n');
  fs.writeFileSync(path.join(d, 'slice-01-q.md'), '---\nstatus: DRAFT\n---\n## Slice 12-01 — q\n');
  const r = W(p, rmFile(p, { rule: 'r' }));
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(lines(p)[0].roadmap.order, ['007-01', '007-02', '007-03']);
});

// ---- third follow-up round
const proposedRm = (extra = {}) => saved({ order: ['007-01'], orderOrigin: 'proposed', proposedAt: '2026-05-01T00:00:00Z', ...extra });

test('012-03 round3 item 1: an unfinished spec with no slices still shows in saved-order mode', () => {
  const s = [...specs3(), sp('008-fresh', 'DRAFT', [], 1)];
  assert.ok(html(deriveRoadmap({ specs: s })).includes('Title 008-fresh'), 'automatic mode shows it');
  const r = deriveRoadmap({ specs: s, saved: proposedRm() });
  assert.deepEqual(r.flow.slice(-1)[0].cards, []);
  assert.equal(r.flow.slice(-1)[0].label, 'Title 008-fresh');
  const h = html(r);
  assert.ok(h.includes('Title 008-fresh'));
  assert.ok(h.includes('rm-group-id">008-fresh<'), 'rendered like an empty spec group, with its id');
});

test('012-03 round3 item 2: DONE slices of an in-progress spec stay visible in the done fold, outside the order', () => {
  const s = [sp('007-alpha', 'IN_PROGRESS', [sl('slice-01-a.md', 'DONE'), sl('slice-02-b.md', 'DRAFT')], 5), sp('002-old', 'DONE', [sl('slice-01-a.md', 'DONE')])];
  const names = { 'slice-01-a.md': 'finishedthing' };
  s.forEach((x) => x.slices.forEach((y) => { if (names[y.file] && x.id === '007-alpha') y.name = names[y.file]; }));
  const auto = html(deriveRoadmap({ specs: s }));
  assert.match(auto, /show 1 done/, 'automatic fold unchanged');
  const r = deriveRoadmap({ specs: s, saved: saved({ order: ['007-02'], orderOrigin: 'proposed', proposedAt: '2026-05-01T00:00:00Z' }) });
  assert.deepEqual(r.order.ids, ['007-02'], 'DONE never enters the order');
  const h = html(r);
  assert.ok(h.includes('finishedthing'), 'the DONE slice is rendered somewhere');
  assert.match(h, /show 2 done/, 'the fold counts spec groups: the finished spec plus the in-progress spec holding done slices');
  assert.equal(r.done.length, 1, 'r.done itself is untouched');
});

test('012-03 round3 item 3: orderOrigin is required; an origin-less stored block is ignored by the reader', () => {
  assert.ok(validateRoadmapBlock({ order: ['007-01'] }).some((e) => /orderOrigin/.test(e)));
  const r = parseCompassHistory(entry({ roadmap: { order: ['007-01'] } }));
  assert.equal(r.latestRoadmap, null);
});

test('012-03 round3 item 4: unknown top-level keys in the --roadmap file are refused, nothing written', () => {
  const p = mkProj();
  const r = W(p, rmFile(p, { rule: 'r', colour: 'red' }));
  assert.notEqual(r.code, 0);
  assert.match(r.err, /colour/);
  assert.equal(lines(p).length, 0);
});
