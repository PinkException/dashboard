import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanProject, scanAll, buildGhContext, prDeltas, loadConfig, ConfigMissingError, ConfigMalformedError } from '../src/scan.mjs';

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

// --- spec 010-01: two-phase load — disabled-gh disk scan + prDeltas ---

// Shape-matches the server's DISABLED_GH constant — a spy so the test can
// assert listPRs is never invoked, not just that prs is absent.
function disabledGhSpy() {
  const calls = [];
  return {
    available: false,
    ownerLogin: null,
    listPRs(root) {
      calls.push(root);
      return [];
    },
    calls,
  };
}

test('scanAll: a disabled gh context emits no prs/ownerLogin on any project and never calls listPRs (010-01 AC1)', () => {
  const gh = disabledGhSpy();
  const data = scanAll({ projects: [jigCfg()] }, { gh });
  assert.equal(data.projects[0].prs, undefined);
  assert.equal(data.projects[0].ownerLogin, undefined);
  assert.equal(gh.calls.length, 0, 'a disabled gh context must never be asked to list PRs');
});

test('prDeltas: maps a scanAll result to the {path,ownerLogin,prs,waitingOn,waitingStages} delta shape (010-01 AC2)', () => {
  const gh = fakeGh({
    prs: [
      { number: 7, title: 'ready one', url: 'u', author: { login: 'someone-else' }, isDraft: false, reviewDecision: 'APPROVED', mergeStateStatus: 'CLEAN', reviewRequests: [] },
    ],
  });
  const data = scanAll({ projects: [jigCfg()] }, { gh });
  const deltas = prDeltas(data);
  assert.equal(deltas.length, 1);
  const d = deltas[0];
  assert.equal(d.path, path.join(FIXTURES, 'proj-jig'));
  assert.equal(d.ownerLogin, 'owner-login');
  assert.equal(d.prs.length, 1);
  assert.deepEqual(d.waitingOn, { state: 'MERGE', verb: 'MERGE', action: 'merge PR #7', rank: 1 }, 'an approved+CLEAN PR carries the MERGE stage');
});

test('prDeltas: an owner-review PR carries the REVIEW stage (outranks the fixture DECIDE) (010-01 AC2)', () => {
  const reviewGh = fakeGh({
    prs: [
      { number: 3, title: 'needs my review', url: 'u', author: { login: 'someone-else' }, isDraft: false, reviewDecision: '', mergeStateStatus: '', reviewRequests: [{ login: 'owner-login' }] },
    ],
  });
  const reviewDelta = prDeltas(scanAll({ projects: [jigCfg()] }, { gh: reviewGh }))[0];
  assert.equal(reviewDelta.waitingOn.state, 'REVIEW');
});

test('prDeltas: a non-owner-review PR carries an External stage in waitingStages (010-01 AC2)', () => {
  // External is the lowest-ranked stage (rank 6, deriveWaitingStages), so on
  // the fixture (which also has a rank-3 DECIDE) it surfaces in the full
  // stage list, not as the head waitingOn — asserting on waitingStages, not
  // waitingOn, is the accurate check for this fixture (a fixture with no
  // higher-ranked candidate would be needed for External to be waitingOn).
  const externalGh = fakeGh({
    prs: [
      { number: 4, title: 'someone else is reviewing', url: 'u', author: { login: 'someone-else' }, isDraft: false, reviewDecision: '', mergeStateStatus: '', reviewRequests: [{ login: 'a-different-reviewer' }] },
    ],
  });
  const externalDelta = prDeltas(scanAll({ projects: [jigCfg()] }, { gh: externalGh }))[0];
  const external = externalDelta.waitingStages.find((s) => s.state === 'External');
  assert.ok(external, 'the External stage must be present in the delta stage list');
  assert.equal(external.action, 'PR #4 out for review');
});

test('prDeltas: with gh disabled, deltas equal the disk-only scan\'s waitingOn/waitingStages and omit ownerLogin/prs (010-01 AC4)', () => {
  const disabled = disabledGhSpy();
  const diskOnly = scanAll({ projects: [jigCfg()] }, { gh: disabled });
  const deltas = prDeltas(diskOnly);
  assert.equal(deltas[0].ownerLogin, undefined);
  assert.equal(deltas[0].prs, undefined);
  assert.deepEqual(deltas[0].waitingOn, diskOnly.projects[0].waitingOn);
  assert.deepEqual(deltas[0].waitingStages, diskOnly.projects[0].waitingStages);
});

test('prDeltas: waitingOn === waitingStages[0] in every delta (010-01 AC5)', () => {
  const gh = fakeGh({
    prs: [
      { number: 7, title: 'ready one', url: 'u', author: { login: 'someone-else' }, isDraft: false, reviewDecision: 'APPROVED', mergeStateStatus: 'CLEAN', reviewRequests: [] },
    ],
  });
  const deltas = prDeltas(scanAll({ projects: [jigCfg()] }, { gh }));
  for (const d of deltas) {
    assert.deepEqual(d.waitingOn, d.waitingStages[0]);
  }
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

test('loadConfig: invalid JSON throws a typed CONFIG_MALFORMED error naming the path and the parser detail', () => {
  const bad = path.join(CONFIG_TMP, 'malformed-typed.json');
  fs.writeFileSync(bad, '{ not valid json');
  assert.throws(
    () => loadConfig(bad),
    (err) => {
      assert.ok(err instanceof ConfigMalformedError);
      assert.equal(err.code, 'CONFIG_MALFORMED');
      assert.ok(err.message.includes(bad), 'message names the malformed path');
      assert.match(err.message, /not valid JSON \(.+\)/, 'parser detail is kept');
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

// ===== Spec 012-01: roadmap data emitted by the scanner =====
import { execFileSync } from 'node:child_process';

const RM_TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-roadmap-'));
after(() => fs.rmSync(RM_TMP, { recursive: true, force: true }));
const git = (cwd, ...args) =>
  execFileSync('git', ['-C', cwd, '-c', 'user.email=t@example.test', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...args], { stdio: 'ignore' });
const write = (p, text) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
const sliceMd = (status, heading, deps = '') => `---\nstatus: ${status}\ndependencies: [${deps}]\n---\n${heading ? `\n## Slice ${heading}\n` : ''}\nbody\n`;
const specMd = (title) => `---\nstatus: IN_PROGRESS\n---\n# Spec: ${title}\n`;
const cfgFor = (root) => ({ path: root, label: 'p', pinnedWorkstreams: [], hiddenWorkstreams: [] });
let rmN = 0;
const mkRepo = () => {
  const root = path.join(RM_TMP, `repo-${++rmN}`);
  fs.mkdirSync(root, { recursive: true });
  git(root, 'init', '-q', '-b', 'main');
  return root;
};

test('012-01 AC2: scanner adds slice `name` from the heading, falling back to the filename stem (additive)', () => {
  const root = mkRepo();
  write(path.join(root, 'docs/specs/001-a/spec.md'), specMd('A'));
  write(path.join(root, 'docs/specs/001-a/slice-01-named.md'), sliceMd('DRAFT', '001-01 — the real name'));
  write(path.join(root, 'docs/specs/001-a/slice-02-plain.md'), sliceMd('DRAFT', ''));
  const p = scanProject(cfgFor(root));
  const [s1, s2] = p.specs[0].slices;
  assert.equal(s1.name, 'the real name');
  assert.equal(s2.name, 'slice-02-plain');
  assert.equal(s1.status, 'DRAFT', 'existing fields untouched');
  assert.deepEqual(s1.dependencies, []);
});

test('012-01 AC3: scanner emits currentReleasePath (the one value) and release includeTokens', () => {
  const p = scanProject({ path: path.join(FIXTURES, 'proj-goal'), label: 'g', pinnedWorkstreams: [], hiddenWorkstreams: [] });
  const release = p.workstreams.find((w) => w.kind === 'release');
  assert.equal(p.currentReleasePath, release.path);
  assert.deepEqual(release.includeTokens.slice(0, 2), ['002-01', '002-02']);
  assert.equal(p.roadmap.release.title, 'Goal launch plan');
  assert.equal(scanProject(cfgFor(path.join(FIXTURES, 'proj-plain'))).currentReleasePath, undefined);
  assert.equal(jig().currentReleasePath, null, 'no incomplete goal → null, not missing');
});

test('012-01 AC3/AC11: spec recency comes from the git commit time of the spec directory (one pass), mtime fallback without git', () => {
  const root = mkRepo();
  write(path.join(root, 'docs/specs/001-old/spec.md'), specMd('old'));
  write(path.join(root, 'docs/specs/002-new/spec.md'), specMd('new'));
  git(root, 'add', '-A');
  execFileSync('git', ['-C', root, '-c', 'user.email=t@example.test', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'one', '--date=2020-01-01T00:00:00Z'], { stdio: 'ignore', env: { ...process.env, GIT_COMMITTER_DATE: '2020-01-01T00:00:00Z' } });
  write(path.join(root, 'docs/specs/002-new/slice-01-x.md'), sliceMd('DRAFT', '002-01 — x'));
  git(root, 'add', '-A');
  execFileSync('git', ['-C', root, '-c', 'user.email=t@example.test', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'two'], { stdio: 'ignore', env: { ...process.env, GIT_COMMITTER_DATE: '2024-06-01T00:00:00Z' } });
  const p = scanProject(cfgFor(root));
  const byId = Object.fromEntries(p.specs.map((s) => [s.id, s.recency]));
  assert.equal(byId['001-old'], Math.floor(Date.parse('2020-01-01T00:00:00Z') / 1000));
  assert.equal(byId['002-new'], Math.floor(Date.parse('2024-06-01T00:00:00Z') / 1000));

  const plain = path.join(RM_TMP, 'nogit');
  write(path.join(plain, 'docs/specs/001-a/spec.md'), specMd('a'));
  const q = scanProject(cfgFor(plain));
  assert.ok(Math.abs(q.specs[0].recency - Date.now() / 1000) < 3600, 'mtime fallback');
});

test('012-01 AC11: recency costs ONE git log call per scan, not one per spec', () => {
  const root = mkRepo();
  for (const n of ['001-a', '002-b', '003-c']) write(path.join(root, `docs/specs/${n}/spec.md`), specMd(n));
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'x');
  const calls = [];
  scanProject(cfgFor(root), undefined, { onGit: (args) => calls.push(args) });
  const logCalls = calls.filter((a) => a.includes('log') && a.includes('--name-only'));
  assert.equal(logCalls.length, 1);
});

test('012-01 AC10: asOf is the root branch; a worktree at root HEAD with an uncommitted IN_PROGRESS slice yields N >= 1', () => {
  const root = mkRepo();
  write(path.join(root, 'docs/specs/001-a/spec.md'), specMd('a'));
  write(path.join(root, 'docs/specs/001-a/slice-01-x.md'), sliceMd('DRAFT', '001-01 — x'));
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'x');
  const wt = path.join(RM_TMP, 'wt-fresh');
  git(root, 'worktree', 'add', '-q', '-b', 'feat', wt);
  write(path.join(wt, 'docs/specs/001-a/slice-01-x.md'), sliceMd('IN_PROGRESS', '001-01 — x'));
  const p = scanProject(cfgFor(root));
  assert.equal(p.roadmap.asOf, 'main');
  assert.deepEqual(p.roadmap.worktreeHint, { further: 1, onlyInWorktrees: 0 });
});

test('012-01 AC10: stale worktree (DRAFT) where root has DONE is not counted; spec folder only in a worktree → M', () => {
  const root = mkRepo();
  write(path.join(root, 'docs/specs/001-a/spec.md'), specMd('a'));
  write(path.join(root, 'docs/specs/001-a/slice-01-x.md'), sliceMd('DRAFT', '001-01 — x'));
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'x');
  const wt = path.join(RM_TMP, 'wt-stale');
  git(root, 'worktree', 'add', '-q', '-b', 'old', wt);
  write(path.join(root, 'docs/specs/001-a/slice-01-x.md'), sliceMd('DONE', '001-01 — x'));
  write(path.join(wt, 'docs/specs/002-new/spec.md'), specMd('new'));
  const p = scanProject(cfgFor(root));
  assert.deepEqual(p.roadmap.worktreeHint, { further: 0, onlyInWorktrees: 1 });
});

test('012-01 AC10: scanWorktreeOnlyDocs is unchanged — path-only, `.claude/worktrees` only', () => {
  const p = scanProject({ path: path.join(FIXTURES, 'proj-jig'), label: 'x', pinnedWorkstreams: [], hiddenWorkstreams: [] });
  assert.ok(Array.isArray(p.worktreeOnlyDocs));
});

test('012-01 AC10: a non-git project degrades — no hint, asOf null, never crashes', () => {
  const plain = path.join(RM_TMP, 'nogit2');
  write(path.join(plain, 'docs/specs/001-a/spec.md'), specMd('a'));
  const p = scanProject(cfgFor(plain));
  assert.equal(p.roadmap.asOf, null);
  assert.equal(p.roadmap.worktreeHint, null);
});

test('012-01 AC8: a jig project with an empty docs/specs gets the no-specs empty state', () => {
  const root = path.join(RM_TMP, 'empty-specs');
  fs.mkdirSync(path.join(root, 'docs', 'specs'), { recursive: true });
  const p = scanProject(cfgFor(root));
  assert.equal(p.jigManaged, true);
  assert.equal(p.roadmap.empty, 'no-specs');
});

test('012-01 AC10: a project in a repo SUBDIRECTORY does not inherit the enclosing repo\'s worktrees', () => {
  const root = mkRepo();
  write(path.join(root, 'sub/docs/specs/001-a/spec.md'), specMd('a'));
  write(path.join(root, 'sub/docs/specs/001-a/slice-01-x.md'), sliceMd('DRAFT', '001-01 — x'));
  git(root, 'add', '-A');
  execFileSync('git', ['-C', root, '-c', 'user.email=t@example.test', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'x'], { stdio: 'ignore', env: { ...process.env, GIT_COMMITTER_DATE: '2020-01-01T00:00:00Z' } });
  const wt = path.join(RM_TMP, 'wt-sub');
  git(root, 'worktree', 'add', '-q', '-b', 'subfeat', wt);
  write(path.join(wt, 'sub/docs/specs/001-a/slice-01-x.md'), sliceMd('IN_PROGRESS', '001-01 — x'));
  // a docs/specs at the worktree's own top level would be misread as the subdir project's worktree content
  write(path.join(wt, 'docs/specs/001-a/spec.md'), specMd('a'));
  write(path.join(wt, 'docs/specs/001-a/slice-01-x.md'), sliceMd('IN_PROGRESS', '001-01 — x'));
  const p = scanProject(cfgFor(path.join(root, 'sub')));
  assert.equal(p.roadmap.worktreeHint, null);
  // recency must come from git (paths are repo-relative), not the mtime fallback
  assert.equal(p.specs[0].recency, Math.floor(Date.parse('2020-01-01T00:00:00Z') / 1000));
});

test('012-01 AC10: a worktree spec directory that becomes unreadable mid-scan cannot fail the scan', { skip: process.getuid && process.getuid() === 0 }, () => {
  const root = mkRepo();
  write(path.join(root, 'docs/specs/001-a/spec.md'), specMd('a'));
  write(path.join(root, 'docs/specs/001-a/slice-01-x.md'), sliceMd('DRAFT', '001-01 — x'));
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'x');
  const wt = path.join(RM_TMP, 'wt-unreadable');
  git(root, 'worktree', 'add', '-q', '-b', 'unread', wt);
  const bad = path.join(wt, 'docs/specs/001-a');
  fs.chmodSync(bad, 0o100); // searchable (spec.md "exists") but not listable → readdirSync throws
  try {
    const p = scanProject(cfgFor(root));
    assert.ok(p.roadmap, 'scan completes');
  } finally {
    fs.chmodSync(bad, 0o755);
  }
});

test('012-01 AC10: a RELATIVE .git/worktrees/*/gitdir pointer (worktree.useRelativePaths) is resolved against its own folder, independent of cwd', () => {
  const root = mkRepo();
  write(path.join(root, 'docs/specs/001-a/spec.md'), specMd('a'));
  write(path.join(root, 'docs/specs/001-a/slice-01-x.md'), sliceMd('DRAFT', '001-01 — x'));
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'x');
  const wt = path.join(RM_TMP, 'wt-rel');
  git(root, 'worktree', 'add', '-q', '-b', 'relfeat', wt);
  write(path.join(wt, 'docs/specs/001-a/slice-01-x.md'), sliceMd('IN_PROGRESS', '001-01 — x'));
  const meta = path.join(root, '.git', 'worktrees');
  const name = fs.readdirSync(meta)[0];
  fs.writeFileSync(path.join(meta, name, 'gitdir'), path.relative(path.join(meta, name), path.join(wt, '.git')) + '\n');
  const cwd = process.cwd();
  process.chdir(os.tmpdir());
  try {
    const p = scanProject(cfgFor(root));
    assert.deepEqual(p.roadmap.worktreeHint, { further: 1, onlyInWorktrees: 0 });
  } finally {
    process.chdir(cwd);
  }
});

test('012-01 AC11: git info (commit count, first/last commit date) is unchanged after folding three spawns into one', () => {
  const root = mkRepo();
  write(path.join(root, 'docs/specs/001-a/spec.md'), specMd('a'));
  git(root, 'add', '-A');
  const commit = (msg, iso) =>
    execFileSync('git', ['-C', root, '-c', 'user.email=t@example.test', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', 'commit', '-q', '--allow-empty', '-m', msg], {
      stdio: 'ignore',
      env: { ...process.env, GIT_COMMITTER_DATE: iso, GIT_AUTHOR_DATE: iso },
    });
  commit('one', '2021-03-04T12:00:00Z');
  commit('two', '2022-05-06T12:00:00Z');
  commit('three', '2023-07-08T12:00:00Z');
  const p = scanProject(cfgFor(root));
  assert.deepEqual(p.git, { firstCommit: '2021-03-04', lastCommit: '2023-07-08', commits: 3 });
  assert.equal(scanProject(cfgFor(path.join(RM_TMP, 'nogit'))).git, null);
});
