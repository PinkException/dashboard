import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanProject, scanAll, buildGhContext, loadConfig, ConfigMissingError } from '../src/scan.mjs';

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

// --- spec 009-02: waiting-on state emission (deriveWaitingOn wired into scanProject) ---

test('scanProject: emits the waiting-on state derived from the real fixture end-to-end (009-02 integration)', () => {
  const p = jig();
  // proj-jig's pinned runbook-widget.md opens on a **(you)**-tagged step
  // ("First review round. Zero cost.") — DECIDE outranks the fixture's other
  // candidates (compass blocker, an IN_PROGRESS slice).
  assert.deepEqual(p.waitingOn, { state: 'DECIDE', verb: 'DECIDE', action: 'First review round. Zero cost.', rank: 3 });
});

test("scanProject: config needsYou marker overrides the fixture's derived state (009-02 AC3 integration)", () => {
  const p = scanProject({
    path: path.join(FIXTURES, 'proj-jig'),
    pinnedWorkstreams: [],
    hiddenWorkstreams: [],
    needsYou: 'waiting on a vendor contract',
  });
  assert.deepEqual(p.waitingOn, { state: 'DECIDE', verb: 'DECIDE', action: 'waiting on a vendor contract', rank: 3 });
});

test('scanProject: no waitingOn field for non-jig-managed or error projects (009-02 scope)', () => {
  const plain = scanProject({ path: path.join(FIXTURES, 'proj-plain'), label: 'plain', pinnedWorkstreams: [], hiddenWorkstreams: [] });
  assert.equal(plain.waitingOn, undefined);
  const missing = scanProject({ path: path.join(FIXTURES, 'does-not-exist'), pinnedWorkstreams: [], hiddenWorkstreams: [] });
  assert.equal(missing.waitingOn, undefined);
});

test('scanProject: missing path is an error entry, not a crash', () => {
  const p = scanProject({ path: path.join(FIXTURES, 'does-not-exist'), pinnedWorkstreams: [], hiddenWorkstreams: [] });
  assert.ok(p.error);
});

// --- spec 009-04: gh-optional PR enrichment (scan integration, injected gh) ---
// The gh context is injected so tests never depend on the host's gh binary.
// Shape: { available, ownerLogin, listPRs(root) } — listPRs returns an array
// or throws to simulate a failure/timeout.
function fakeGh({ available = true, ownerLogin = 'owner-login', prs = [], throwErr = false } = {}) {
  const calls = [];
  return {
    available,
    ownerLogin,
    calls,
    listPRs(root) {
      calls.push(root);
      if (throwErr) throw new Error('simulated gh failure/timeout');
      return prs;
    },
  };
}

const jigCfg = () => ({
  path: path.join(FIXTURES, 'proj-jig'),
  label: 'fixture project',
  pinnedWorkstreams: ['docs/runbook-widget.md'],
  hiddenWorkstreams: [],
});

test('scanProject: gh available + PRs → result.prs attached (drafts filtered) and waitingOn reflects them (009-04 AC1)', () => {
  const gh = fakeGh({
    prs: [
      { number: 7, title: 'ready one', url: 'u', author: { login: 'someone-else' }, isDraft: false, reviewDecision: 'APPROVED', mergeStateStatus: 'CLEAN', reviewRequests: [] },
      { number: 8, title: 'a draft', url: 'u', author: { login: 'someone-else' }, isDraft: true, reviewDecision: '', mergeStateStatus: '', reviewRequests: [] },
    ],
  });
  const p = scanProject(jigCfg(), gh);
  assert.equal(p.prs.length, 1, 'the draft PR is filtered out before attach');
  assert.equal(p.prs[0].number, 7);
  assert.deepEqual(p.waitingOn, { state: 'MERGE', verb: 'MERGE', action: 'merge PR #7', rank: 1 }, 'approved PR MERGE outranks the fixture DECIDE');
  assert.deepEqual(gh.calls, [path.join(FIXTURES, 'proj-jig')], 'listPRs called once with the project root');
});

test('scanProject: gh unavailable → no prs, waitingOn identical to a no-gh run (009-04 AC2 status-quo)', () => {
  const base = jig();
  const gh = fakeGh({ available: false, ownerLogin: null });
  const p = scanProject(jigCfg(), gh);
  assert.equal(p.prs, undefined, 'no prs field when gh is unavailable');
  assert.deepEqual(p.waitingOn, base.waitingOn, 'identical to the no-gh derivation');
  assert.equal(gh.calls.length, 0, 'no listPRs call when unavailable');
});

test('scanProject: gh listPRs throws → no prs, no exception, rest of payload intact (009-04 AC2/AC3)', () => {
  const gh = fakeGh({ throwErr: true });
  const p = scanProject(jigCfg(), gh);
  assert.equal(p.prs, undefined, 'a listPRs failure degrades to no PR signal, never a crash');
  assert.ok(p.specs.length > 0, 'the rest of the payload is intact');
  assert.deepEqual(p.waitingOn, jig().waitingOn, 'waitingOn falls back to the disk-derived state');
});

test('scanProject: a non-jig-managed project triggers NO gh call (009-04 — reads live past the early return)', () => {
  const gh = fakeGh({ prs: [{ number: 1, title: 't', url: 'u', author: { login: 'x' }, isDraft: false, reviewDecision: '', mergeStateStatus: '', reviewRequests: [] }] });
  const p = scanProject({ path: path.join(FIXTURES, 'proj-plain'), label: 'plain', pinnedWorkstreams: [], hiddenWorkstreams: [] }, gh);
  assert.equal(p.jigManaged, false);
  assert.equal(gh.calls.length, 0, 'a non-jig project makes no gh PR read');
});

test('scanProject: bare scanProject(cfg) with no gh context is unchanged status quo (009-04 back-compat)', () => {
  const p = scanProject(jigCfg());
  assert.equal(p.prs, undefined);
  assert.deepEqual(p.waitingOn, jig().waitingOn);
});

test('scanAll: an injected gh context threads through to each scanned project (009-04 seam)', () => {
  const gh = fakeGh({
    prs: [{ number: 7, title: 't', url: 'u', author: { login: 'x' }, isDraft: false, reviewDecision: 'APPROVED', mergeStateStatus: 'CLEAN', reviewRequests: [] }],
  });
  const data = scanAll({ projects: [jigCfg()] }, { gh });
  assert.equal(data.projects[0].prs.length, 1);
  assert.equal(data.projects[0].waitingOn.state, 'MERGE');
});

test('buildGhContext: the real read path passes a bounded timeout + cwd to both probe and pr-list (009-04 AC3)', () => {
  const seen = [];
  const run = (bin, args, opts) => {
    seen.push({ bin, args, opts });
    return args[0] === 'api' ? 'owner-login\n' : '[]';
  };
  const gh = buildGhContext(run);
  assert.equal(gh.available, true);
  assert.equal(gh.ownerLogin, 'owner-login');
  gh.listPRs('/tmp/fixture-proj');
  const probe = seen.find((c) => c.args[0] === 'api');
  const list = seen.find((c) => c.args[0] === 'pr');
  assert.equal(probe.bin, 'gh');
  assert.ok(typeof probe.opts.timeout === 'number' && probe.opts.timeout > 0, 'probe is time-bounded');
  assert.ok(typeof list.opts.timeout === 'number' && list.opts.timeout > 0, 'pr-list is time-bounded');
  assert.equal(list.opts.cwd, '/tmp/fixture-proj', 'pr-list runs in the project root');
});

test('buildGhContext: any throw in the probe degrades to unavailable, ownerLogin null (009-04 AC3)', () => {
  const gh = buildGhContext(() => {
    throw new Error('ENOENT: gh not on PATH');
  });
  assert.equal(gh.available, false);
  assert.equal(gh.ownerLogin, null);
  assert.deepEqual(gh.listPRs('/tmp/fixture-proj'), [], 'the degraded context yields no PRs');
});

test('buildGhContext: authenticated but a blank/empty login degrades to unavailable (009-04 AC3)', () => {
  // gh present + the probe succeeds but resolves no login (e.g. an odd auth
  // state) — the owner identity the REVIEW/External split needs is absent, so
  // the whole context degrades to unavailable rather than running PR reads with
  // a null owner. (compliance-nit coverage: the authenticated-empty-login branch.)
  const gh = buildGhContext((bin, args) => (args[0] === 'api' ? '\n' : '[]'));
  assert.equal(gh.available, false);
  assert.equal(gh.ownerLogin, null);
  assert.deepEqual(gh.listPRs('/tmp/fixture-proj'), [], 'no login → no PR reads');
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
