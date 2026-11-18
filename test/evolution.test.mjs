// Spec 013-01: progress-over-time chart. Series reader (lib), payload
// (scan), chart + Activity tab (render). Fixtures use invented names only.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProgressSeries } from '../src/lib.mjs';
import { scanProject, snapshotFileFor } from '../src/scan.mjs';
import { evolutionChartSvg, detailView } from '../public/render.mjs';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const STORE = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-evo-store-'));
process.env.DASHBOARD_SNAPSHOTS = STORE;
after(() => fs.rmSync(STORE, { recursive: true, force: true }));

const line = (o) => JSON.stringify({ v: 1, headline: 'h', ...o });
const DAY = 86400000;
const T0 = Date.parse('2026-01-01T00:00:00Z');
const iso = (d) => new Date(T0 + d * DAY).toISOString();

// --- AC1: series reader ---

test('013-01 AC1: keeps only entries with numeric specs; skips counted separately', () => {
  const text = [
    line({ ts: iso(0), specs: { done: 1, total: 3 }, source: 'auto' }),
    line({ ts: iso(1) }), // legacy shape, no specs
    'not json',
    line({ ts: 'garbage', specs: { done: 1, total: 2 } }), // numbers but bad ts
    line({ specs: { done: 1, total: 2 } }), // numbers but no ts
    line({ ts: iso(2), specs: { done: 'x', total: 2 } }), // non-numeric
  ].join('\n');
  const r = buildProgressSeries(text);
  assert.equal(r.points.length, 1);
  assert.equal(r.skipped.noNumbers, 2);
  assert.equal(r.skipped.malformed, 3);
});

test('013-01 AC1: sorted oldest first; shape {ts,done,total,source}', () => {
  const text = [
    line({ ts: iso(5), specs: { done: 3, total: 4 }, source: 'auto' }),
    line({ ts: iso(1), specs: { done: 1, total: 4 }, source: 'auto' }),
  ].join('\n');
  const { points } = buildProgressSeries(text);
  assert.deepEqual(points.map((p) => p.done), [1, 3]);
  assert.deepEqual(points[0], { ts: iso(1), done: 1, total: 4, source: 'auto' });
});

test('013-01 AC1: headline only on narrative entries (source not auto)', () => {
  const text = [
    line({ ts: iso(0), specs: { done: 1, total: 2 }, source: 'auto', headline: 'auto: 1/2' }),
    line({ ts: iso(1), specs: { done: 2, total: 2 }, source: 'dashboard', headline: 'prose here' }),
    line({ ts: iso(2), specs: { done: 2, total: 2 }, headline: 'untagged' }),
  ].join('\n');
  const { points } = buildProgressSeries(text);
  assert.equal('headline' in points[0], false);
  assert.equal(points[1].headline, 'prose here');
  assert.equal(points[2].headline, 'untagged');
});

test('013-01 AC1: caps at the 200 newest points', () => {
  const text = Array.from({ length: 250 }, (_, i) =>
    line({ ts: iso(i), specs: { done: i, total: 300 }, source: 'auto' }),
  ).join('\n');
  const { points } = buildProgressSeries(text);
  assert.equal(points.length, 200);
  assert.equal(points[0].done, 50);
  assert.equal(points[199].done, 249);
});

// --- AC2: payload; store-only ---

test('013-01 AC2: scanProject attaches history from the STORE only (legacy in-repo file ignored); compass unchanged', () => {
  const root = path.join(FIXTURES, 'proj-jig');
  // The legacy in-repo file has entries without specs; put one numeric entry
  // in the store and confirm only it appears.
  fs.writeFileSync(
    snapshotFileFor(root),
    line({ ts: '2026-07-01T00:00:00Z', specs: { done: 2, total: 3 }, source: 'auto' }) + '\n',
  );
  const p = scanProject({ path: root, label: 'x', pinnedWorkstreams: [], hiddenWorkstreams: [] });
  assert.equal(p.history.points.length, 1);
  assert.deepEqual(p.history.skipped, { noNumbers: 0, malformed: 0 });
  // 013-03 AC5 widened `live` with `slices`; the 013-01 fields are unchanged.
  assert.equal(p.history.live.done, p.progress.done);
  assert.equal(p.history.live.total, p.progress.denom);
  assert.equal(p.history.live.total, 3); // denom excludes ABANDONED (4 specs - 1)
  assert.equal(p.compass.headline, 'beta is close'); // legacy file still read
  fs.rmSync(snapshotFileFor(root));
  const q = scanProject({ path: root, label: 'x', pinnedWorkstreams: [], hiddenWorkstreams: [] });
  assert.deepEqual(q.history.points, []);
});

// --- chart ---

const pt = (d, done, total, extra = {}) => ({ ts: iso(d), done, total, source: 'auto', ...extra });
const NOW = T0 + 20 * DAY;
const hist = (points, live, skipped = { noNumbers: 0, malformed: 0 }) => ({ points, live, skipped });
const attr = (svg, cls, name) => {
  const m = svg.match(new RegExp(`<path class="${cls}"[^>]*? ${name}="([^"]*)"`));
  return m && m[1];
};

test('013-01 AC4: solid step path for known series; dashed stretch ends at live value', () => {
  const svg = evolutionChartSvg(hist([pt(0, 1, 3), pt(10, 2, 3)], { done: 2, total: 4 }), NOW);
  assert.equal(attr(svg, 'evo-done', 'd'), 'M34 104.5H292V73');
  assert.equal(attr(svg, 'evo-done-live', 'd'), 'M292 73H550V73');
  assert.match(svg, /<path class="evo-done-live"[^>]*stroke-dasharray/);
  assert.doesNotMatch(svg, /<path class="evo-done"[^>]*stroke-dasharray/);
  assert.equal(attr(svg, 'evo-total', 'd'), 'M34 41.5H292V41.5');
  assert.equal(attr(svg, 'evo-total-live', 'd'), 'M292 41.5H550V10');
});

test('013-01 AC4: caption says "today" and "1 day ago" for recent snapshots', () => {
  assert.match(evolutionChartSvg(hist([pt(0, 1, 3), pt(20, 2, 3)], { done: 2, total: 3 }), NOW), /last snapshot today/);
  assert.match(evolutionChartSvg(hist([pt(0, 1, 3), pt(19, 2, 3)], { done: 2, total: 3 }), NOW), /last snapshot 1 day ago/);
});

test('013-01 AC1: an entry without source keeps an explicit null source', () => {
  const line = JSON.stringify({ v: 1, ts: '2026-01-01T00:00:00Z', headline: 'h', specs: { done: 1, total: 2 } });
  const { points } = buildProgressSeries(line + '\n');
  assert.equal(points[0].source, null);
  assert.ok(Object.hasOwn(JSON.parse(JSON.stringify(points[0])), 'source'));
});

test('013-01 AC4: caption, axis labels, tokens only', () => {
  const svg = evolutionChartSvg(hist([pt(0, 1, 3), pt(10, 2, 3)], { done: 2, total: 4 }), NOW);
  assert.match(svg, /last snapshot 10 days ago/);
  assert.match(svg, />2026-01-01</);
  assert.match(svg, />now</);
  assert.match(svg, /var\(--blue\)/);
  assert.match(svg, /var\(--track\)/);
  assert.doesNotMatch(svg, /#[0-9a-fA-F]{3,6}\b/);
});

test('013-01 AC4: narrative points are dots with <title> date + escaped headline; auto points are not', () => {
  const svg = evolutionChartSvg(
    hist([pt(0, 1, 3), pt(10, 2, 3, { source: 'dashboard', headline: 'ship <b>it</b>' })], { done: 2, total: 3 }),
    NOW,
  );
  const dots = [...svg.matchAll(/<circle class="evo-dot"[^>]*><title>([^<]*)<\/title><\/circle>/g)];
  assert.equal(dots.length, 1);
  assert.match(dots[0][1], /2026-01-11/);
  assert.match(dots[0][1], /ship &lt;b&gt;it&lt;\/b&gt;/);
});

test('013-01 AC4: downward step in done or total (incl. the dashed stretch) gets a marker with the explanation', () => {
  const flat = evolutionChartSvg(hist([pt(0, 1, 3), pt(10, 2, 3)], { done: 2, total: 3 }), NOW);
  assert.doesNotMatch(flat, /evo-down/);
  const stored = evolutionChartSvg(hist([pt(0, 3, 4), pt(10, 2, 4)], { done: 2, total: 4 }), NOW);
  assert.equal([...stored.matchAll(/class="evo-down"/g)].length, 1);
  assert.match(stored, /count went down: a spec was reopened or abandoned, the snapshot was taken on another branch or worktree, or the counting rule changed/);
  const live = evolutionChartSvg(hist([pt(0, 2, 4)], { done: 2, total: 3 }), NOW);
  assert.equal([...live.matchAll(/class="evo-down"/g)].length, 1);
});

test('013-01 AC5: 0 points => no chart, honest sentence naming the snapshot skill', () => {
  const html = evolutionChartSvg(hist([], { done: 2, total: 5 }), NOW);
  assert.doesNotMatch(html, /<svg/);
  assert.match(html, /No progress history yet\. Today: 2 of 5 specs done\./);
  assert.match(html, /\/dashboard:snapshot/);
});

test('013-01 AC5: single point draws the dashed stretch only; skipped line only when non-zero, parts omitted at zero', () => {
  const one = evolutionChartSvg(hist([pt(0, 1, 3)], { done: 2, total: 3 }), NOW);
  assert.match(one, /<svg/);
  assert.match(one, /evo-done-live/);
  assert.doesNotMatch(one, /Not shown/);
  const both = evolutionChartSvg(hist([pt(0, 1, 3)], { done: 2, total: 3 }, { noNumbers: 4, malformed: 2 }), NOW);
  assert.match(both, /Not shown: 4 entries without progress numbers, 2 unreadable lines\./);
  const onlyBad = evolutionChartSvg(hist([pt(0, 1, 3)], { done: 2, total: 3 }, { noNumbers: 0, malformed: 2 }), NOW);
  assert.match(onlyBad, /Not shown: 2 unreadable lines\./);
  assert.doesNotMatch(onlyBad, /without progress numbers/);
});

// --- AC3: tab ---

test('013-01 AC3: Activity tab enabled; panel shows chart before the coming-soon line', () => {
  const p = {
    name: 'Alpha', path: '/projects/alpha', jigManaged: true, git: null, specs: [],
    progress: { done: 1, total: 2, denom: 2, abandoned: 0, pct: 50, by: {} },
    sliceProgress: null,
    counts: { bugs: { open: 0, total: 0 }, refinement: { open: 0, total: 0 }, inbox: 0, adrs: 0 },
    workstreams: [], discovered: [], worktreeOnlyDocs: [], compass: null, warnings: [],
    sessions: [], sessionsTotal: 0, roadmap: null,
    history: hist([pt(0, 1, 2)], { done: 1, total: 2 }),
  };
  const html = detailView(p, { tab: 'activity' });
  assert.doesNotMatch(html, /class="tab[^"]*disabled[^"]*" data-action="show-activity-tab"/);
  const panel = html.slice(html.indexOf('activity-tab-content'));
  assert.ok(panel.indexOf('<svg') > -1 && panel.indexOf('<svg') < panel.indexOf('coming soon'));
});
