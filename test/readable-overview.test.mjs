// Spec 014-01: readable overview — summary tiles, chip vocabulary, rows,
// tokens. Sample names are invented (public repo; leak gate).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { summarizeProjects } from '../src/lib.mjs';
import { scanAll, prsPayload } from '../src/scan.mjs';
import {
  CHIPS,
  chipFor,
  chipLegendHtml,
  waitLine,
  summaryTilesHtml,
  headerHtml,
  mergePrSummary,
  overviewRow,
  lensToggleHtml,
} from '../public/render.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INDEX = fs.readFileSync(path.join(HERE, '..', 'public', 'index.html'), 'utf8');
const FIXTURES = path.join(HERE, 'fixtures');

const wo = (state, rank, action = 'do a thing') => ({ state, verb: state.toUpperCase(), action, rank });
function proj(name, waitingOn, extra = {}) {
  return {
    name,
    path: `/p/${name}`,
    jigManaged: true,
    specs: [],
    progress: { done: 1, total: 2, denom: 2, abandoned: 0, pct: 50, by: {} },
    compass: null,
    sessions: [],
    waitingOn,
    ...extra,
  };
}
const run = (running) => ({ active: true, running, lastActivity: new Date().toISOString() });

// ---------- AC5: scanner-side summary ----------
test('AC5 summarizeProjects: partitions jig-managed error-free projects by head state; running is independent', () => {
  const ps = [
    proj('a', wo('MERGE', 1), { sessions: [run(true)] }),
    proj('b', wo('REVIEW', 2)),
    proj('c', wo('DECIDE', 3)),
    proj('d', wo('Ready', 4)),
    proj('e', wo('Ready', 5), { sessions: [run(true), run(true)] }),
    proj('f', wo('External', 6)),
    proj('g', wo('Idle', 7)),
    proj('h', wo('Idle', 7)),
    { name: 'err', path: '/p/err', error: 'boom', sessions: [run(true)] },
    { name: 'plain', path: '/p/plain', jigManaged: false, sessions: [] },
  ];
  const s = summarizeProjects(ps);
  assert.equal(s.needYou, 3);
  assert.equal(s.ready, 2);
  assert.equal(s.external, 1);
  assert.equal(s.idle, 2);
  assert.equal(s.needYou + s.ready + s.external + s.idle, 8, 'partition sums to jig-managed error-free count');
  assert.equal(s.running, 2, 'projects with >=1 running session (a, e), not session count; error rows excluded — they show no running dot');
});

test('AC5 summarizeProjects: a jig-managed project with no or unknown waitingOn state counts as Idle (agrees with chip + tint fallback)', () => {
  const s = summarizeProjects([proj('a', undefined), proj('b', wo('Weird', 9))]);
  assert.equal(s.idle, 2);
  assert.equal(s.needYou + s.ready + s.external, 0);
});

test('AC5 summarizeProjects: empty input is all zeros; a non-running active session does not count', () => {
  const z = summarizeProjects([]);
  assert.deepEqual([z.needYou, z.ready, z.external, z.idle, z.running], [0, 0, 0, 0, 0]);
  assert.equal(summarizeProjects([proj('a', wo('Idle', 7), { sessions: [run(false)] })]).running, 0);
});

test('AC5 summarizeProjects: carries overall spec progress for the header ring', () => {
  const s = summarizeProjects([proj('a', wo('Idle', 7)), proj('b', wo('Idle', 7))]);
  assert.equal(s.specsDone, 2);
  assert.equal(s.specsDenom, 4);
});

test('AC5 scanAll emits an additive summary; prsPayload carries the recomputed summary alongside deltas', () => {
  const cfg = { projects: [{ path: path.join(FIXTURES, 'proj-jig'), label: 'x', pinnedWorkstreams: [], hiddenWorkstreams: [] }] };
  const gh = { available: false, ownerLogin: null, listPRs: () => [] };
  const data = scanAll(cfg, { gh });
  assert.deepEqual(data.summary, summarizeProjects(data.projects));
  assert.equal(data.summary.needYou + data.summary.ready + data.summary.external + data.summary.idle, 1);
  const payload = prsPayload(data);
  assert.deepEqual(payload.summary, data.summary);
  assert.ok(Array.isArray(payload.projects) && payload.generatedAt, 'existing /api/prs fields unchanged');
});

test('AC5 mergePrSummary: swaps the four state tiles only; running keeps the /api/data value; failure keeps base', () => {
  const base = { needYou: 1, ready: 1, external: 0, idle: 5, running: 4, specsDone: 3, specsDenom: 9 };
  const delta = { needYou: 2, ready: 0, external: 1, idle: 4, running: 99, specsDone: 0, specsDenom: 0 };
  const m = mergePrSummary(base, delta);
  assert.deepEqual([m.needYou, m.ready, m.external, m.idle], [2, 0, 1, 4]);
  assert.equal(m.running, 4);
  assert.equal(m.specsDone, 3);
  assert.deepEqual(mergePrSummary(base, undefined), base);
  assert.deepEqual(mergePrSummary(base, { needYou: 2 }), base, 'partial delta ignored');
  assert.equal(base.needYou, 1, 'input not mutated');
  assert.equal(mergePrSummary(undefined, delta), undefined);
});

test('AC5 summaryTilesHtml: five tiles with labels, counts, and the "nothing blocking them" subtitle', () => {
  const html = summaryTilesHtml({ needYou: 4, ready: 2, external: 1, idle: 1, running: 5 });
  for (const l of ['Need you', 'Ready to start', 'Waiting on others', 'Idle', 'Running now']) assert.ok(html.includes(l), l);
  assert.equal((html.match(/class="tile"/g) || []).length, 5);
  assert.ok(html.includes('nothing blocking them'));
  assert.match(html, /tile-num[^>]*>4</);
  assert.match(html, /tile-num[^>]*><span class="tile-dot"><\/span>5</);
  assert.equal(summaryTilesHtml(undefined), '', 'no summary (older server) renders no tiles, no crash');
});

// ---------- AC4: header ----------
test('AC4 headerHtml: ring, eyebrow, h1, tagline', () => {
  const html = headerHtml({ specsDone: 1, specsDenom: 4 });
  assert.match(html, /<svg[^>]*width="66"[^>]*height="66"/);
  assert.match(html, />Dashboard</);
  assert.ok(!html.includes('RosieBits'), 'D6: eyebrow is just Dashboard');
  assert.match(html, /<h1[^>]*>Every project&#39;s next move<\/h1>|<h1[^>]*>Every project's next move<\/h1>/);
  assert.ok(html.includes('Nearly-done work sits above just-started work, so you finish before you start.'));
  // 25% -> dashoffset = 170 * 0.75
  assert.match(html, /stroke-dashoffset="127\.5"/);
  assert.match(headerHtml(undefined), /stroke-dashoffset="170"/, 'no summary -> empty ring, no crash');
});

// ---------- AC7: chip vocabulary ----------
test('AC7 CHIPS: one state -> label mapping', () => {
  const label = (s) => chipFor(s).label;
  assert.equal(label('DECIDE'), 'Your call');
  assert.equal(label('REVIEW'), 'Your review');
  assert.equal(label('MERGE'), 'Land');
  assert.equal(label('Ready'), 'Ready');
  assert.equal(label('External'), 'Waiting on others');
  assert.equal(label('Idle'), 'Idle');
  assert.equal(chipFor('nonsense').label, 'Idle', 'unknown degrades to Idle');
  assert.equal(chipFor(undefined).label, 'Idle');
  assert.equal(CHIPS.MERGE.cls === CHIPS.Ready.cls, false, 'Land has its own class (ok-green token pair), distinct from Ready');
});

test('AC7 chipLegendHtml: legend lists every chip in queue order', () => {
  const html = chipLegendHtml();
  const labels = [...html.matchAll(/class="chip [\w-]+">([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(labels, ['Land', 'Your review', 'Your call', 'Ready', 'Waiting on others', 'Idle']);
});

// ---------- AC6: lens switch ----------
test('AC6 lensToggleHtml: pill nav "By project | Action queue", behaviour hooks unchanged', () => {
  const html = lensToggleHtml('overview');
  assert.match(html, /<nav[^>]*class="lens-pills"/);
  assert.match(html, /class="lens-btn active"[^>]*data-action="set-lens-overview"[^>]*>By project</);
  assert.match(html, /data-action="set-lens-queue"[^>]*>Action queue</);
  assert.match(lensToggleHtml('queue'), /class="lens-btn active"[^>]*data-action="set-lens-queue"/);
});

// ---------- AC8: wait line + rows ----------
test('AC8 waitLine: every state sentence', () => {
  assert.equal(waitLine(proj('a', wo('MERGE', 1))), 'Ready to land');
  assert.equal(waitLine(proj('a', wo('DECIDE', 3))), 'Waiting on you');
  assert.equal(waitLine(proj('a', wo('REVIEW', 2))), 'Waiting on you');
  assert.equal(waitLine(proj('a', wo('Ready', 4))), 'Started — you can pick it back up');
  assert.equal(waitLine(proj('a', wo('Ready', 5))), 'You can start it now');
  assert.equal(waitLine(proj('a', wo('External', 6))), 'Waiting on others');
  const done = { done: 3, total: 3, denom: 3, abandoned: 0, pct: 100, by: {} };
  assert.equal(waitLine(proj('a', wo('Idle', 7), { progress: done })), 'All specs done');
  assert.equal(waitLine(proj('a', wo('Idle', 7))), 'Nothing open');
  assert.equal(waitLine(proj('a', wo('Idle', 7), { progress: { done: 0, total: 0, denom: 0, abandoned: 0, pct: null, by: {} } })), 'Nothing open', '0/0 is not "all done"');
  assert.equal(waitLine(proj('a', undefined)), 'Nothing open', 'no waitingOn degrades to Idle');
});

test('AC8 overviewRow: chip, capitalised action, wait line, spec count, running dot, touched', () => {
  const p = proj('Kestrel', wo('REVIEW', 2, 'review 2 finished slices'), {
    description: 'note-taking app',
    progress: { done: 14, total: 18, denom: 18, abandoned: 0, pct: 78, by: {} },
    sessions: [run(true), run(true)],
  });
  const html = overviewRow(p);
  assert.match(html, /class="project-row row-owner"/);
  assert.match(html, /class="chip chip-you">Your review</);
  assert.match(html, /class="row-action">Review 2 finished slices</);
  assert.match(html, /class="row-wait">Waiting on you</);
  assert.ok(html.includes('14 of 18 specs'));
  assert.ok(html.includes('78%'));
  assert.match(html, /2 running/);
  assert.match(html, /touched just now/);
  assert.match(html, /pbar-fill" style="width:78%"/);
});

test('AC8 overviewRow: 100% bar is ok-green; Idle row tinted and action muted; Ready rows untinted', () => {
  const done = proj('Beacon', wo('Idle', 7), { progress: { done: 11, total: 11, denom: 11, abandoned: 0, pct: 100, by: {} }, compass: { headline: 'Shipped v1.0 — nothing open' } });
  const html = overviewRow(done);
  assert.match(html, /pbar-fill full"/);
  assert.match(html, /class="project-row row-idle"/);
  assert.match(html, /class="row-action muted">Shipped v1.0/);
  assert.match(html, /All specs done/);
  assert.doesNotMatch(overviewRow(proj('R', wo('Ready', 5))), /row-owner|row-idle/);
  assert.match(overviewRow(proj('M', wo('MERGE', 1))), /row-owner/, 'D7: Land is an owner state');
  assert.match(overviewRow(proj('M', wo('MERGE', 1))), /Ready to land/);
});

test('AC8 overviewRow: in-flight count + heat word; no running -> Idle text', () => {
  const p = proj('H', wo('DECIDE', 3), { specs: [1, 2, 3, 4, 5, 6].map((i) => ({ id: `0${i}`, status: 'IN_PROGRESS', slices: [] })) });
  const html = overviewRow(p);
  assert.match(html, /heat-hot">6</);
  assert.ok(html.includes('a lot open'));
  assert.match(overviewRow(proj('Q', wo('Ready', 5))), /class="row-run-text">Idle</);
});

test('AC9 error and not-jig rows still render in the shell with the new chip class', () => {
  const err = overviewRow({ name: 'Broken', path: '/x', error: 'path does not exist' });
  assert.match(err, /class="project-row"/);
  assert.match(err, /chip chip-error/);
  assert.ok(err.includes('path does not exist'));
  const plain = overviewRow({ name: 'Plain', path: '/y', jigManaged: false, sessions: [] });
  assert.match(plain, /chip chip-muted/);
});

// ---------- AC1-3: tokens + type (page CSS) ----------
const rootBlock = INDEX.match(/:root\s*{([^}]*)}/)[1];
const darkBlock = INDEX.match(/prefers-color-scheme: dark\)\s*{\s*:root\s*{([^}]*)}/)[1];

test('AC1 light tokens carry the v1.3 palette', () => {
  for (const hex of ['#F4EFE4', '#FBF8F1', '#EFE7D6', '#E4DAC7', '#1C2A47', '#4E5A7C', '#E16B43', '#B04A24', '#2F8A63', '#23704F', '#625C4E', '#FDF6EE', '#F7F3EA']) {
    assert.ok(rootBlock.toUpperCase().includes(hex), `light :root has ${hex}`);
  }
});

test('AC2 dark override maps the dark-file values', () => {
  for (const hex of ['#121A2B', '#1A2338', '#2C374F', '#EFE9DC', '#A9B3CA', '#F08A63', '#EE7E56', '#5BBB8D', '#7DD3A8', '#1F2539', '#161E31', '#232E48', '#4A2618', '#FFB497', '#1B3830', '#26314C', '#B4C3E6', '#2A303E', '#C9C2B2']) {
    assert.ok(darkBlock.toUpperCase().includes(hex), `dark :root has ${hex}`);
  }
});

test('AC1 no hard-coded colour outside :root and its dark override', () => {
  const stripped = INDEX.replace(/:root\s*{[^}]*}/g, '');
  const style = stripped.match(/<style>([\s\S]*?)<\/style>/)[1].replace(/\/\*[\s\S]*?\*\//g, '');
  assert.deepEqual(style.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g) || [], []);
});

test('AC3 Nunito loads via Google Fonts link; font stack; sizes; 44px controls', () => {
  assert.match(INDEX, /<link[^>]+fonts\.googleapis\.com\/css2\?family=Nunito:wght@400;600;700;800/);
  assert.match(INDEX, /font-family:\s*'Nunito', ui-rounded, system-ui, sans-serif/);
  assert.match(INDEX, /\.hdr-title\s*{[^}]*36px[^}]*800/);
  assert.match(INDEX, /\.hdr-tagline\s*{[^}]*17px/);
  assert.match(INDEX, /\.chip\s*{[^}]*800 13px[^}]*\.04em[^}]*uppercase/);
  assert.match(INDEX, /\.tile-num\s*{[^}]*38px[^}]*800/);
  assert.match(INDEX, /\.row-action\s*{[^}]*700 17px/);
  assert.match(INDEX, /\.lens-btn\s*{[^}]*min-height:\s*44px/);
  assert.match(INDEX, /button\s*{[^}]*min-height:\s*44px/);
});
