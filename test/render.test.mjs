// Spec 008-02: graceful degradation & honest unknowns — render assertions.
//
// public/index.html's <script> is a plain (non-module) inline script, so
// `wsRow` isn't importable. It is extracted and evaluated in a fresh vm
// context — the same source the browser runs, not a duplicated copy — with
// `document`/`fetch`/`setInterval` stubbed just enough that the trailing
// top-level `load(); setInterval(load, ...)` calls don't throw. This lets the
// marker/meter string be asserted structurally (AC3's "verified structurally"
// option) against the real render function, not a paraphrase of it.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { scanProject } from '../src/scan.mjs';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const HTML_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'index.html');

// Same guard as scan.test.mjs: pin the snapshot store to a throwaway temp dir
// so an integration-style scanProject() call here never reaches into the
// developer's real ~/.claude/my-dashboard/snapshots/.
const STORE = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-render-store-'));
process.env.DASHBOARD_SNAPSHOTS = STORE;
after(() => fs.rmSync(STORE, { recursive: true, force: true }));

function loadPageScript() {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(m, 'public/index.html must contain an inline <script> block');
  const sandbox = {
    document: { getElementById: () => ({ innerHTML: '', textContent: '' }) },
    fetch: async () => ({ json: async () => ({ error: 'render-test-stub' }) }),
    setInterval: () => {},
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(m[1], sandbox, { filename: 'public/index.html<script>' });
  assert.equal(typeof sandbox.wsRow, 'function', 'wsRow must be defined by the page script');
  return sandbox;
}

test('wsRow: no goalUnresolved (or empty) → meter reads exactly "N of M slices landed", no marker (008-02 AC1/AC2 regression)', () => {
  const { wsRow } = loadPageScript();
  const noField = wsRow({ kind: 'release', title: 'Plan A', goalProgress: { done: 2, total: 5 } });
  assert.match(noField, /2 of 5 slices landed<\/span>/);
  assert.ok(!noField.includes('unresolved'));

  const emptyArray = wsRow({ kind: 'release', title: 'Plan A', goalProgress: { done: 2, total: 5 }, goalUnresolved: [] });
  assert.match(emptyArray, /2 of 5 slices landed<\/span>/);
  assert.ok(!emptyArray.includes('unresolved'));
});

test('wsRow: goalUnresolved with entries appends "· K unresolved" without shrinking the denominator (008-02 AC3)', () => {
  const { wsRow } = loadPageScript();
  const out = wsRow({
    kind: 'release',
    title: 'Plan B',
    goalProgress: { done: 1, total: 4 },
    goalUnresolved: ['002-05', '005-01'],
    goalNext: { id: '002-02', action: 'draft' },
  });
  assert.match(out, /1 of 4 slices landed · 2 unresolved<\/span>/);
  // the "4" (declared total) must still be present verbatim — never re-derived as 4-2=2
  assert.ok(out.includes('of 4 slices landed'));
});

test('wsRow: all-unresolved meter reads "0 of N landed · N unresolved", never "0 of 0" (008-02 AC4)', () => {
  const { wsRow } = loadPageScript();
  const out = wsRow({
    kind: 'release',
    title: 'Plan C',
    goalProgress: { done: 0, total: 3 },
    goalUnresolved: ['010-01', '011-01', '002-09'],
    goalNext: { id: '010-01', action: 'author slice' },
  });
  assert.match(out, /0 of 3 slices landed · 3 unresolved<\/span>/);
  assert.ok(!out.includes('0 of 0'));
});

test('wsRow: a checklist (non-goal) workstream renders exactly as before — no goal wording, no marker (008-02 AC6 regression)', () => {
  const { wsRow } = loadPageScript();
  const out = wsRow({
    kind: 'runbook',
    title: 'Widget runbook',
    steps: { done: 1, total: 3 },
    currentPhase: 'Phase A',
    next: { text: 'do the next thing', owner: 'you' },
  });
  assert.ok(!out.includes('slices landed'));
  assert.ok(!out.includes('unresolved'));
  assert.match(out, /1\/3/);
});

test('integration: proj-goal fixture scanned end-to-end through wsRow shows the unresolved marker on the real card string (008-02 AC3)', () => {
  const { wsRow } = loadPageScript();
  const p = scanProject({
    path: path.join(FIXTURES, 'proj-goal'),
    label: 'goal fixture',
    pinnedWorkstreams: [],
    hiddenWorkstreams: [],
  });
  const release = p.workstreams.find((w) => w.kind === 'release');
  const out = wsRow(release);
  // 002-01 landed, 002-02 pending, 002-05 + 005-01 unresolved (see scan.test.mjs 008-01 AC1-AC4)
  assert.match(out, /1 of 4 slices landed · 2 unresolved<\/span>/);
});

test('integration: proj-goal-parked fixture (all-parked, total===0) never reaches wsRow with goal fields — title-only (008-02 AC4)', () => {
  const { wsRow } = loadPageScript();
  const p = scanProject({
    path: path.join(FIXTURES, 'proj-goal-parked'),
    label: 'parked-goal fixture',
    pinnedWorkstreams: [],
    hiddenWorkstreams: [],
  });
  const release = p.workstreams.find((w) => w.kind === 'release');
  const out = wsRow(release);
  // Positive anchor: the card still renders (title-only), so a wsRow that
  // regressed into an empty/garbled string can't vacuously pass the negatives.
  assert.match(out, /Parked launch plan/);
  assert.ok(!out.includes('slices landed'));
  assert.ok(!out.includes('unresolved'));
  assert.ok(!out.includes('0 of 0'));
});
