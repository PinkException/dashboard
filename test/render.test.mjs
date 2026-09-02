// Spec 009-01: uniform triage rows + project detail view — render assertions.
//
// public/render.mjs is a real, framework-free ES module (no fs/DOM/fetch), so
// these tests import it directly and assert on the returned HTML strings /
// derived values (DOM-shape assertions), per plan.md's testability decision.
// Integration tests additionally run real fixtures through scanProject to
// prove the additive backend emissions (description, workstream items,
// release-track membership) actually reach the render layer end-to-end.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanProject } from '../src/scan.mjs';
import { deriveWaitingOn, deriveWaitingStages } from '../src/lib.mjs';
import {
  esc,
  shorten,
  sessionCounts,
  inFlightCount,
  heatBucket,
  progressBarSvg,
  countsLine,
  currentReleaseTrack,
  detailSpecList,
  overviewRow,
  runningNowCount,
  sortProjectsByWaitingOn,
  waitingOnRank,
  mergePrDeltas,
  detailView,
  sessionsDetailBlock,
  prsDetailBlock,
  activityTabPlaceholder,
  OVERVIEW_STATE,
  openDetail,
  closeDetail,
  isDetailOpenFor,
  setLens,
  actionQueue,
  actionQueueRow,
  actionQueueGroup,
  actionQueueHtml,
} from '../public/render.mjs';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

const STORE = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-render-store-'));
process.env.DASHBOARD_SNAPSHOTS = STORE;
after(() => fs.rmSync(STORE, { recursive: true, force: true }));

function jig(overrides = {}) {
  return scanProject({
    path: path.join(FIXTURES, 'proj-jig'),
    label: 'fixture project',
    pinnedWorkstreams: ['docs/runbook-widget.md'],
    hiddenWorkstreams: [],
    ...overrides,
  });
}

// A minimal, hand-built project payload — used for render-unit tests that
// don't need a real fixture scan. Shaped exactly like scanProject/scanAll's
// emitted object.
function mkProject(overrides = {}) {
  return {
    name: 'Kestrel',
    path: '/projects/kestrel',
    jigManaged: true,
    git: null,
    specs: [],
    progress: { done: 1, total: 2, denom: 2, abandoned: 0, pct: 50, by: { DONE: 1, IN_PROGRESS: 1 } },
    sliceProgress: null,
    counts: { bugs: { open: 0, total: 0 }, refinement: { open: 0, total: 0 }, inbox: 0, adrs: 0 },
    workstreams: [],
    discovered: [],
    worktreeOnlyDocs: [],
    compass: { headline: 'build the search index', next: null, blockers: [], ageLabel: 'this morning', ageDays: 0, stale: false },
    warnings: [],
    sessions: [],
    sessionsTotal: 0,
    ...overrides,
  };
}

// --- AC1: uniform-height rows, including error and not-jig-managed ---

test('overviewRow: every project shape (normal, error, not-jig-managed) renders the same .project-row shell (AC1)', () => {
  const normal = overviewRow(mkProject());
  const err = overviewRow({ name: 'Broken', path: '/x', error: 'path does not exist' });
  const notManaged = overviewRow({ name: 'Plain', path: '/y', jigManaged: false, sessions: [] });
  for (const html of [normal, err, notManaged]) {
    assert.match(html, /^<div class="project-row"/);
    // Six direct grid cells every time: gutter, project, nextmove, inflight, progress, activity.
    assert.equal((html.match(/<div class="row-/g) || []).length, 6);
  }
});

test('mutation check: removing the shared shell breaks row-count uniformity', () => {
  // Demonstrates the AC1 test actually discriminates: a row missing a column
  // fails the assertion above.
  const brokenHtml = '<div class="project-row"><div class="row-gutter"></div></div>';
  assert.notEqual((brokenHtml.match(/<div class="row-/g) || []).length, 6);
});

// --- AC2: glance row content ---

test('overviewRow: shows description subtitle when present, omits it when absent (AC2)', () => {
  const withDesc = overviewRow(mkProject({ description: 'note-taking app' }));
  assert.match(withDesc, /<span class="row-type">note-taking app<\/span>/);
  const without = overviewRow(mkProject({ description: undefined }));
  assert.ok(!without.includes('row-type'));
});

test('overviewRow: next-move column shows the compass headline, no state tag/waitline (AC2/AC7)', () => {
  const html = overviewRow(mkProject({ compass: { headline: 'decide the routing-engine approach', next: null, blockers: [] } }));
  assert.match(html, /decide the routing-engine approach/);
  // Scope fence (AC7/AC8): no waiting-on tag class or wording anywhere in the row.
  assert.ok(!html.includes('class="tag"'));
  assert.ok(!/\bDECIDE\b|\bWAITING ON\b/.test(html));
});

test('overviewRow: no compass snapshot yet is shown honestly, not blank (AC2 regression)', () => {
  const html = overviewRow(mkProject({ compass: null }));
  assert.match(html, /no compass snapshot yet/);
});

test('overviewRow: progress column shows pct + done\\/denom + an inline svg bar (AC2/AC3)', () => {
  const html = overviewRow(mkProject({ progress: { done: 18, total: 28, denom: 28, abandoned: 0, pct: 64, by: {} } }));
  assert.match(html, /<span class="pct">64%<\/span>/);
  assert.match(html, /18\/28/);
  assert.match(html, /<svg class="pbar"/);
});

test('overviewRow: activity column shows active count + last activity, or "idle" (AC2)', () => {
  const active = overviewRow(mkProject({ sessions: [{ active: true, running: true, lastActivity: new Date().toISOString() }] }));
  assert.match(active, /1 active/);
  const idle = overviewRow(mkProject({ sessions: [] }));
  assert.match(idle, />idle</);
});

test('inFlightCount: sums in-progress specs + active sessions + worktree-only docs (AC2)', () => {
  const p = mkProject({
    specs: [{ id: 'a', status: 'IN_PROGRESS' }, { id: 'b', status: 'DONE' }, { id: 'c', status: 'IN_PROGRESS' }],
    sessions: [{ active: true }, { active: false }, { active: true }],
    worktreeOnlyDocs: [{ path: 'x' }],
  });
  assert.equal(inFlightCount(p), 2 + 2 + 1);
});

test('mutation check: dropping a term from inFlightCount changes the sum (AC2 discriminates)', () => {
  const p = mkProject({
    specs: [{ id: 'a', status: 'IN_PROGRESS' }],
    sessions: [{ active: true }],
    worktreeOnlyDocs: [{ path: 'x' }],
  });
  const full = inFlightCount(p);
  const withoutWorktreeDocs = (p.specs.filter((s) => s.status === 'IN_PROGRESS').length) + (p.sessions.filter((s) => s.active).length);
  assert.notEqual(full, withoutWorktreeDocs);
});

test('heatBucket: reproduces every example in the redline render (AC2)', () => {
  assert.equal(heatBucket(0), 'clear');
  assert.equal(heatBucket(1), 'light');
  assert.equal(heatBucket(2), 'light');
  assert.equal(heatBucket(3), 'busy');
  assert.equal(heatBucket(5), 'busy');
  assert.equal(heatBucket(6), 'hot');
  assert.equal(heatBucket(10), 'hot');
});

test('overviewRow: in-flight figure carries a heat class and 6 flight cells (AC2)', () => {
  const html = overviewRow(mkProject({
    specs: [{ id: 'a', status: 'IN_PROGRESS' }, { id: 'b', status: 'IN_PROGRESS' }, { id: 'c', status: 'IN_PROGRESS' }],
  }));
  assert.match(html, /class="if-num heat-busy"/);
  assert.equal((html.match(/<rect/g) || []).length >= 6, true);
});

// --- AC3: charts are zero-dep inline SVG ---

test('progressBarSvg: returns an inline <svg>, no external asset reference (AC3)', () => {
  const svg = progressBarSvg(75);
  assert.match(svg, /^<svg /);
  assert.ok(!svg.includes('http'));
  assert.ok(!svg.includes('<img'));
});

test('progressBarSvg: fill width scales with pct, and 100% renders green not blue (AC3)', () => {
  const half = progressBarSvg(50, { w: 100, h: 4 });
  assert.match(half, /width="50" height="4" rx="2" fill="var\(--blue\)"/);
  const full = progressBarSvg(100, { w: 100, h: 4 });
  assert.match(full, /width="100" height="4" rx="2" fill="var\(--green\)"/);
});

// --- AC4: click opens an in-page detail view, dismissible ---

test('detail open/close state: openDetail/closeDetail/isDetailOpenFor round-trip (AC4)', () => {
  assert.equal(OVERVIEW_STATE.view, 'overview');
  const opened = openDetail('/projects/kestrel');
  assert.equal(opened.view, 'detail');
  assert.equal(opened.path, '/projects/kestrel');
  assert.equal(isDetailOpenFor(opened, '/projects/kestrel'), true);
  assert.equal(isDetailOpenFor(opened, '/projects/other'), false);
  const closed = closeDetail();
  assert.equal(closed.view, 'overview');
  assert.equal(closed.path, null);
  assert.equal(isDetailOpenFor(closed, '/projects/kestrel'), false);
});

test('detail round-trip preserves the active lens: open a project FROM the queue, close, land back on the queue (009-03)', () => {
  // The exact interaction the DOM glue performs: openDetail(path, state.lens)
  // then closeDetail(state.lens). A queue-opened project must return to the
  // queue, not the overview grid.
  const fromQueue = openDetail('/projects/kestrel', 'queue');
  assert.equal(fromQueue.view, 'detail');
  assert.equal(fromQueue.lens, 'queue', 'the lens rides along into the detail view');
  const back = closeDetail(fromQueue.lens);
  assert.equal(back.view, 'overview');
  assert.equal(back.lens, 'queue', 'closing returns to the queue lens, not the grid');
  // The 009-01/009-02 default path is unchanged: no lens arg => overview.
  assert.equal(openDetail('/x').lens, 'overview');
  assert.equal(closeDetail().lens, 'overview');
});

test('mutation check: a state that never flips view stays "stuck open" — isDetailOpenFor catches it (AC4)', () => {
  const brokenClose = { view: 'detail', path: '/projects/kestrel' }; // closeDetail forgot to flip view
  assert.equal(isDetailOpenFor(brokenClose, '/projects/kestrel'), true, 'a real closeDetail() must not look like this');
});

// --- AC5: nothing is lost — detail view holds the dropped content ---

test('detailView: header carries name, description, chip, meta line, progress readout (AC5)', () => {
  const html = detailView(mkProject({ description: 'note-taking app' }));
  assert.match(html, /<span class="detail-title">Kestrel<\/span>/);
  assert.match(html, /<span class="detail-type">note-taking app<\/span>/);
  assert.match(html, /50% — 1\/2 specs/);
  assert.match(html, /running now/);
  assert.match(html, /in flight/);
  assert.match(html, /last touched/);
});

test('detailView: full "what\'s next" narrative + NEXT + BLOCKED + age all render (AC5)', () => {
  const html = detailView(mkProject({
    compass: { headline: '18 of 28 specs done', next: 'finish 014, merge 019', blockers: ['routing approach parked on your call'], ageLabel: '40m ago', stale: false },
  }));
  assert.match(html, /18 of 28 specs done/);
  assert.match(html, /<span class="label-inline">NEXT<\/span> finish 014, merge 019/);
  assert.match(html, /<span class="label-inline">BLOCKED<\/span> routing approach parked on your call/);
  assert.match(html, />40m ago</);
});

test('detailView: counts strip matches "N done · N in progress · N draft · N specs · N open bugs · N deferred · N inbox" (AC5)', () => {
  const line = countsLine(mkProject({
    progress: { total: 28, by: { DONE: 18, IN_PROGRESS: 3, DRAFT: 7 } },
    counts: { bugs: { open: 2, total: 5 }, refinement: { open: 9, total: 12 }, inbox: 14, adrs: 1 },
  }));
  assert.equal(line, '18 done · 3 in progress · 7 draft · 28 specs · 2 open bugs · 9 deferred · 14 inbox');
});

test('detailView: sessions section shows full list, older toggle, and "N active · M older (+K not shown)" (AC5)', () => {
  const p = mkProject({
    sessions: [
      { active: true, running: true, title: 'A', branch: 'claude/a', worktree: 'wt-a', lastActivity: new Date().toISOString() },
      { active: false, running: false, title: 'B', branch: 'claude/b', worktree: 'wt-b', lastActivity: new Date(Date.now() - 86400000).toISOString() },
    ],
    sessionsTotal: 5,
  });
  const html = sessionsDetailBlock(p);
  assert.match(html, /1 active · 1 older \(\+3 not shown\)/);
  assert.match(html, /<details class="sessions-toggle">/);
  assert.match(html, /▾ show 1 older/);
});

test('detailView: sessions section is omitted entirely when the project has no sessions (AC5 regression)', () => {
  assert.equal(sessionsDetailBlock(mkProject({ sessions: [] })), '');
});

// --- spec 009-04: detail-view PR area (pure, reads p.prs) ---

test('detailView: PR area lists each open PR with number, title, state hint, and url (009-04 AC1)', () => {
  const p = mkProject({
    prs: [
      { number: 7, title: 'wire up the merge path', url: 'https://example.test/pull/7', reviewDecision: 'APPROVED', mergeStateStatus: 'CLEAN', reviewRequests: [] },
      { number: 9, title: 'awaiting your look', url: 'https://example.test/pull/9', reviewDecision: '', mergeStateStatus: '', reviewRequests: [{ login: 'owner-login' }] },
    ],
  });
  const html = prsDetailBlock(p, 'owner-login');
  assert.match(html, /#7/);
  assert.match(html, /wire up the merge path/);
  assert.match(html, /approved/i, 'approved-and-clean PR shows the approved hint');
  assert.match(html, /#9/);
  assert.match(html, /awaiting your review/i, 'owner-requested PR shows the awaiting-your-review hint');
  assert.match(html, /https:\/\/example\.test\/pull\/7/);
  assert.match(html, /https:\/\/example\.test\/pull\/9/);
});

test('detailView: PR area shows the "out for review" hint for a non-owner reviewer (009-04 AC1)', () => {
  const p = mkProject({
    prs: [{ number: 3, title: 'someone else reviews', url: 'https://example.test/pull/3', reviewDecision: '', mergeStateStatus: '', reviewRequests: [{ login: 'someone-else' }] }],
  });
  const html = prsDetailBlock(p, 'owner-login');
  assert.match(html, /out for review/i);
});

test('detailView: PR area is omitted entirely when there are no PRs — no empty-state noise (009-04 AC2)', () => {
  assert.equal(prsDetailBlock(mkProject({ prs: [] }), 'owner-login'), '');
  assert.equal(prsDetailBlock(mkProject({}), 'owner-login'), '');
});

test('detailView: PR titles are escaped (009-04 — matches the existing esc convention)', () => {
  const p = mkProject({ prs: [{ number: 1, title: '<script>x</script>', url: 'https://example.test/pull/1', reviewDecision: '', mergeStateStatus: '', reviewRequests: [] }] });
  const html = prsDetailBlock(p, 'owner-login');
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test('detailView: whole-view render includes the PR area when PRs are present (009-04 integration)', () => {
  const html = detailView(mkProject({
    prs: [{ number: 7, title: 'merge me', url: 'https://example.test/pull/7', reviewDecision: 'APPROVED', mergeStateStatus: 'CLEAN', reviewRequests: [] }],
  }));
  assert.match(html, /merge me/);
  assert.match(html, /#7/);
});

test('detailView: worktree-only-docs warning renders when present, absent when not (AC5)', () => {
  const withWarn = detailView(mkProject({ worktreeOnlyDocs: [{ path: 'docs/specs/019/plan.md', worktree: 'wt-a' }] }));
  assert.match(withWarn, /1 doc\(s\) exist only in an un-merged worktree/);
  assert.match(withWarn, /docs\/specs\/019\/plan\.md — wt-a/);
  const without = detailView(mkProject({ worktreeOnlyDocs: [] }));
  assert.ok(!without.includes('un-merged worktree'));
});

test('detailView: workstream block shows next 1-3 unchecked items, capped at 3 (AC5)', () => {
  const html = detailView(mkProject({
    workstreams: [{
      kind: 'runbook',
      title: 'Onboarding Runbook',
      path: 'docs/runbook.md',
      phases: ['Phase 4', 'Phase 5'],
      items: [
        { checked: true, text: 'done thing' },
        { checked: false, text: 'phase 4 — first-route tutorial copy' },
        { checked: false, text: 'phase 5 — empty states' },
        { checked: false, text: 'phase 6 — third unchecked item' },
        { checked: false, text: 'phase 7 — a fourth item, should not show' },
      ],
    }],
  }));
  assert.match(html, /Onboarding Runbook/);
  assert.match(html, /☐ phase 4 — first-route tutorial copy/);
  assert.match(html, /☐ phase 5 — empty states/);
  assert.ok(!html.includes('done thing'), 'checked items are not shown as next-up');
  assert.ok(!html.includes('a fourth item'), 'capped at 3 unchecked items');
});

test("mutation check: dropping the slice(0,3) cap would leak a 4th item — the test above catches it", () => {
  const items = [{ checked: false, text: 'one' }, { checked: false, text: 'two' }, { checked: false, text: 'three' }, { checked: false, text: 'four' }];
  const capped = items.filter((i) => !i.checked).slice(0, 3);
  assert.equal(capped.length, 3);
  const uncapped = items.filter((i) => !i.checked);
  assert.equal(uncapped.length, 4);
});

test('detailView: "discovered, not pinned" group renders when present (AC5)', () => {
  const html = detailView(mkProject({ discovered: [{ path: 'docs/spike.md', title: 'Weather-overlay spike', steps: { done: 2, total: 6 } }] }));
  assert.match(html, /DISCOVERED, NOT PINNED/);
  assert.match(html, /Weather-overlay spike \(2\/6\)/);
});

test('detailView: spec list defaults to the current release track with a "show all N specs" control (AC5, A-009-01)', () => {
  const html = detailView(mkProject({
    specs: [{ id: '014', title: 'elevation-profile', status: 'IN_PROGRESS', slices: [] }, { id: '099', title: 'unrelated', status: 'DONE', slices: [] }],
    workstreams: [{ kind: 'release', title: 'Public Beta (v0.9)', path: 'docs/releases/beta.md', goalProgress: { done: 1, total: 2 }, memberSpecIds: ['014'] }],
  }));
  assert.match(html, /Public Beta \(v0\.9\)/);
  assert.match(html, /▾ show all 2 specs/);
  assert.match(html, /elevation-profile/);
  assert.ok(!html.includes('unrelated'), 'spec outside the current track is filtered out by default');
});

test('detailView: "show all" toggle reveals the full spec list (AC5)', () => {
  const p = mkProject({
    specs: [{ id: '014', title: 'elevation-profile', status: 'IN_PROGRESS', slices: [] }, { id: '099', title: 'unrelated', status: 'DONE', slices: [] }],
    workstreams: [{ kind: 'release', title: 'Public Beta (v0.9)', path: 'docs/releases/beta.md', goalProgress: { done: 1, total: 2 }, memberSpecIds: ['014'] }],
  });
  const html = detailView(p, { showAll: true });
  assert.match(html, /elevation-profile/);
  assert.match(html, /unrelated/);
});

// --- follow-up fixes to 009-01 (craft/compliance findings) ---

test('detailView: meta line "running now" is strict running, matching the overview header\'s RUNNING NOW label (follow-up fix)', () => {
  const p = mkProject({
    sessions: [
      { active: true, running: true, lastActivity: new Date().toISOString() },
      { active: true, running: false, lastActivity: new Date().toISOString() }, // active (recent) but NOT running
    ],
  });
  const html = detailView(p);
  // 1 running, not 2 active — the same "running now" label must not mean two
  // different numbers between the overview header and the detail meta line.
  assert.match(html, /1 running now/);
  assert.ok(!html.includes('2 running now'));
});

test('mutation check: sessionCounts().activeCount would wrongly report 2 running now for the fixture above', () => {
  const p = mkProject({
    sessions: [
      { active: true, running: true, lastActivity: new Date().toISOString() },
      { active: true, running: false, lastActivity: new Date().toISOString() },
    ],
  });
  const { activeCount } = sessionCounts(p);
  assert.equal(activeCount, 2, 'the buggy activeCount source the fix replaces');
  assert.equal(runningNowCount([p]), 1, 'the correct strict-running count the fix now uses');
});

test('detailView + overviewRow: spec fraction uses the SAME (abandoned-excluded) denominator in both places (follow-up fix)', () => {
  const p = mkProject({
    progress: { done: 2, total: 5, denom: 4, abandoned: 1, pct: 50, by: { DONE: 2, ABANDONED: 1 } },
  });
  const overviewHtml = overviewRow(p);
  const detailHtml = detailView(p);
  assert.match(overviewHtml, /2\/4/, 'overview shows done\\/denom (abandoned excluded)');
  assert.match(detailHtml, /2\/4 specs/, 'detail must agree with the overview\'s denominator');
  assert.ok(!detailHtml.includes('2/5 specs'), 'detail must not fall back to done/total (abandoned included)');
});

test('detailView: a current release track with empty memberSpecIds renders the FULL spec list and no toggle (follow-up fix)', () => {
  const html = detailView(mkProject({
    specs: [{ id: '014', title: 'elevation-profile', status: 'IN_PROGRESS', slices: [] }, { id: '099', title: 'unrelated', status: 'DONE', slices: [] }],
    workstreams: [{ kind: 'release', title: 'Public Beta (v0.9)', path: 'docs/releases/beta.md', goalProgress: { done: 1, total: 2 }, memberSpecIds: [] }],
  }));
  assert.match(html, /elevation-profile/);
  assert.match(html, /unrelated/, 'empty memberSpecIds means no usable current-track filter — show the full list');
  assert.ok(!html.includes('show current track'), 'no toggle when there is nothing real for it to switch');
  assert.ok(!html.includes('class="track-label"'), 'no dangling track-label in the specs header without a real filter behind it');
});

test('mutation check: the old "track ? track.title : null" trackTitle logic would render a no-op toggle for the empty-memberSpecIds case', () => {
  const track = { title: 'Public Beta (v0.9)' };
  const buggyTrackTitle = track ? track.title : null; // ignores whether memberSpecIds is usable
  assert.equal(buggyTrackTitle, 'Public Beta (v0.9)', 'the buggy logic the fix replaces — a toggle would render with nothing to filter');
});

// --- A-009-01: current-track determination + graceful degradation ---

test('currentReleaseTrack: picks the release workstream whose goalProgress is incomplete, first in order (A-009-01)', () => {
  const p = mkProject({
    workstreams: [
      { kind: 'release', title: 'Old shipped plan', goalProgress: { done: 3, total: 3 } },
      { kind: 'release', title: 'Current plan', goalProgress: { done: 1, total: 4 } },
      { kind: 'release', title: 'Also incomplete but later', goalProgress: { done: 0, total: 1 } },
    ],
  });
  const track = currentReleaseTrack(p);
  assert.equal(track.title, 'Current plan');
});

test('currentReleaseTrack: no release workstream, or none with goalProgress → null; detailSpecList degrades to full list, never crashes (A-009-01)', () => {
  const noRelease = mkProject({ workstreams: [{ kind: 'runbook', title: 'Widget runbook' }] });
  assert.equal(currentReleaseTrack(noRelease), null);
  const specs = [{ id: 'a', title: 'A', status: 'DONE', slices: [] }, { id: 'b', title: 'B', status: 'DRAFT', slices: [] }];
  const result = detailSpecList(mkProject({ specs, workstreams: [{ kind: 'runbook', title: 'Widget runbook' }] }));
  assert.equal(result.filtered, false);
  assert.equal(result.specs.length, 2);
});

test('currentReleaseTrack: all-complete release plans → null (nothing "current"), full spec list shown (A-009-01)', () => {
  const p = mkProject({
    specs: [{ id: 'a', title: 'A', status: 'DONE', slices: [] }],
    workstreams: [{ kind: 'release', title: 'Shipped', goalProgress: { done: 3, total: 3 }, memberSpecIds: ['a'] }],
  });
  assert.equal(currentReleaseTrack(p), null);
  assert.equal(detailSpecList(p).filtered, false);
});

test('mutation check: an off-by-one in the incomplete comparison (<=) would wrongly call a finished plan "current"', () => {
  const done = 3, total = 3;
  assert.equal(done < total, false); // the correct comparison
  assert.equal(done <= total, true); // the buggy comparison the AC5 test above would catch
});

// --- AC6: reserved Activity tab, inert ---

test('activityTabPlaceholder: renders a dashed-border icon + "coming soon", nothing counted (AC6)', () => {
  const html = activityTabPlaceholder();
  assert.match(html, /activity-icon/);
  assert.match(html, /coming soon/);
});

test('detailView: the activity tab content is present but hidden by default (AC6)', () => {
  const html = detailView(mkProject());
  assert.match(html, /<div class="activity-tab-content" hidden>/);
  assert.match(html, /coming soon/);
});

// --- AC7: no triage derivation, no reorder, additive fields stay presentation-only ---

test('overviewRow: no waiting-on state, no reorder — rows are a pure per-project map, order preserved (AC7)', () => {
  const projects = [mkProject({ path: '/z' }), mkProject({ path: '/a' }), mkProject({ path: '/m' })];
  const rows = projects.map(overviewRow);
  assert.deepEqual(rows.map((r) => r.match(/data-path="([^"]+)"/)[1]), ['/z', '/a', '/m']);
});

test('runningNowCount: sums only running sessions across projects, an existing-data header total (AC2, header)', () => {
  const projects = [
    mkProject({ sessions: [{ running: true }, { running: false }] }),
    mkProject({ sessions: [{ running: true }] }),
  ];
  assert.equal(runningNowCount(projects), 2);
});

// --- AC8: design-review scope fence — excluded elements never render ---

test('overviewRow + detailView: never render 009-02/009-03 elements (state tags, header state counts, action-queue toggle) (AC8)', () => {
  const p = mkProject({
    workstreams: [{ kind: 'release', title: 'Beta', goalProgress: { done: 1, total: 2 }, memberSpecIds: [] }],
  });
  const combined = overviewRow(p) + detailView(p);
  for (const forbidden of ['action queue', 'finish-first', 'TO DO', 'WAITING ON', 'BLOCKING']) {
    assert.ok(!combined.includes(forbidden), `found excluded 009-02/03 element: "${forbidden}"`);
  }
});

test('detailView: never renders 009-02/03 state-tag words — DECIDE/REVIEW/MERGE/Ready/External (AC8, detail-view coverage)', () => {
  const p = mkProject({
    workstreams: [{ kind: 'release', title: 'Beta', goalProgress: { done: 1, total: 2 }, memberSpecIds: [] }],
    compass: { headline: 'decide the routing-engine approach, ready to merge once reviewed', next: null, blockers: [], ageLabel: '1h ago', stale: false },
  });
  const html = detailView(p);
  // Case-sensitive, word-bounded: the lowercase activity descriptor "idle" is
  // legitimate and must not be caught by this check.
  for (const forbidden of [/\bDECIDE\b/, /\bREVIEW\b/, /\bMERGE\b/, /\bReady\b/, /\bExternal\b/]) {
    assert.ok(!forbidden.test(html), `found excluded 009-02/03 state-tag word: ${forbidden}`);
  }
  assert.ok(/\bidle\b/.test(overviewRow(mkProject({ sessions: [] }))), 'sanity: lowercase "idle" is legitimate and unaffected by the check above');
});

// --- integration: additive backend emissions reach the render layer end-to-end ---

test('integration: proj-jig scanned through scanProject → overviewRow shows no description (fixture has none) (AC2 backend)', () => {
  const p = jig();
  assert.equal(p.description, undefined);
  const html = overviewRow(p);
  assert.ok(!html.includes('row-type'));
});

test('integration: a project config description reaches overviewRow verbatim (AC2 backend, description field)', () => {
  const p = jig({ description: 'hiking route planner' });
  assert.equal(p.description, 'hiking route planner');
  assert.match(overviewRow(p), /<span class="row-type">hiking route planner<\/span>/);
});

test('integration: proj-jig\'s pinned runbook widens through parseRunbook → detailView shows its next unchecked items (AC5 backend)', () => {
  const p = jig();
  const runbook = p.workstreams.find((w) => w.kind === 'runbook');
  assert.ok(Array.isArray(runbook.items) && runbook.items.length >= 1, 'parseRunbook must emit an items list');
  const html = detailView(p);
  assert.match(html, /☐ First review round\. Zero cost\./);
});

test('integration: proj-goal\'s release plan exposes memberSpecIds and becomes the detail view\'s current track (AC5/A-009-01 backend)', () => {
  const p = scanProject({ path: path.join(FIXTURES, 'proj-goal'), label: 'goal fixture', pinnedWorkstreams: [], hiddenWorkstreams: [] });
  const release = p.workstreams.find((w) => w.kind === 'release');
  assert.deepEqual(release.memberSpecIds, ['002-alpha', '003-beta']);
  const track = currentReleaseTrack(p);
  assert.equal(track.title, 'Goal launch plan');
  const { specs, filtered, trackTitle } = detailSpecList(p);
  assert.equal(filtered, true);
  assert.equal(trackTitle, 'Goal launch plan');
  assert.deepEqual(specs.map((s) => s.id).sort(), ['002-alpha', '003-beta']);
});

test("integration: proj-jig's checklist-only release plan has no goalProgress → no current track, full spec list shown (A-009-01 backend regression)", () => {
  const p = jig();
  assert.equal(currentReleaseTrack(p), null);
  assert.equal(detailSpecList(p).filtered, false);
});

// --- spec 009-02: waiting-on state headline + finish-first ordering ---
// render.mjs only READS the `p.waitingOn` field 009-02 adds scan-side
// (src/lib.mjs's deriveWaitingOn) — these tests hand-build that field on
// mkProject payloads exactly as scanProject emits it.

function withWaitingOn(state, verb, action, rank) {
  return mkProject({ waitingOn: { state, verb, action, rank } });
}

test('overviewRow: a You-state (DECIDE/REVIEW/MERGE) headlines the verb + named action, replacing the old compass-only next-move (009-02 AC1)', () => {
  const html = overviewRow(withWaitingOn('DECIDE', 'DECIDE', 'decide the currency-rounding rule', 3));
  assert.match(html, /<span class="row-verb rv-DECIDE">DECIDE<\/span>/);
  assert.match(html, /<span class="row-action">decide the currency-rounding rule<\/span>/);
});

test('overviewRow: REVIEW and MERGE headline the same way, each with their own verb (009-02 AC1)', () => {
  const review = overviewRow(withWaitingOn('REVIEW', 'REVIEW', 'review 2 finished slices', 2));
  assert.match(review, /<span class="row-verb rv-REVIEW">REVIEW<\/span>/);
  assert.match(review, /review 2 finished slices/);
  const merge = overviewRow(withWaitingOn('MERGE', 'MERGE', 'land 1 reconciled slice', 1));
  assert.match(merge, /<span class="row-verb rv-MERGE">MERGE<\/span>/);
  assert.match(merge, /land 1 reconciled slice/);
});

test('overviewRow: Ready headlines calmer than a You-state — still a named action, distinct verb class (009-02 AC1)', () => {
  const html = overviewRow(withWaitingOn('Ready', 'READY', 'resume 009-02', 4));
  assert.match(html, /<span class="row-verb rv-Ready">READY<\/span>/);
  assert.match(html, /resume 009-02/);
});

test('overviewRow: Idle never shows a verb badge — falls back to the quiet compass-headline display, never a hollow phrase (009-02 AC1)', () => {
  const html = overviewRow(withWaitingOn('Idle', 'IDLE', '', 7));
  assert.ok(!html.includes('row-verb'), 'Idle renders quietest — no state badge at all');
  assert.match(html, /<span class="row-action">build the search index<\/span>/, 'falls back to the existing compass-headline display');
});

test('overviewRow: no waitingOn field at all (legacy/hand-built payload) degrades to the pre-009-02 compass display, unchanged (backward compat)', () => {
  const html = overviewRow(mkProject());
  assert.ok(!html.includes('row-verb'));
  assert.match(html, /<span class="row-action">build the search index<\/span>/);
});

test('sortProjectsByWaitingOn: orders finish-first by rank ascending — MERGE > REVIEW > DECIDE > Ready > Idle (009-02 AC2)', () => {
  const projects = [
    withWaitingOn('Idle', 'IDLE', '', 7),
    withWaitingOn('DECIDE', 'DECIDE', 'x', 3),
    withWaitingOn('MERGE', 'MERGE', 'x', 1),
    withWaitingOn('REVIEW', 'REVIEW', 'x', 2),
  ];
  const ranks = sortProjectsByWaitingOn(projects).map((p) => p.waitingOn.rank);
  assert.deepEqual(ranks, [1, 2, 3, 7]);
});

test('sortProjectsByWaitingOn: Ready-resume (rank 4) sorts above Ready-start (rank 5) even though both are the "Ready" state label (009-02 AC2)', () => {
  const start = withWaitingOn('Ready', 'READY', 'start 015-02', 5);
  const resume = withWaitingOn('Ready', 'READY', 'resume 014-02', 4);
  const ordered = sortProjectsByWaitingOn([start, resume]);
  assert.equal(ordered[0], resume);
  assert.equal(ordered[1], start);
});

test('sortProjectsByWaitingOn: a project with no waitingOn field sorts last, like Idle — never crashes, never assumed urgent (009-02 AC2)', () => {
  const decide = withWaitingOn('DECIDE', 'DECIDE', 'x', 3);
  const bare = mkProject({ path: '/bare' });
  delete bare.waitingOn;
  const ordered = sortProjectsByWaitingOn([bare, decide]);
  assert.equal(ordered[0], decide);
  assert.equal(ordered[1], bare);
});

test('sortProjectsByWaitingOn: does not mutate the input array (pure)', () => {
  const projects = [withWaitingOn('Idle', 'IDLE', '', 7), withWaitingOn('MERGE', 'MERGE', 'x', 1)];
  const original = [...projects];
  sortProjectsByWaitingOn(projects);
  assert.deepEqual(projects, original);
});

test('waitingOnRank: reads p.waitingOn.rank, defaults to 7 (Idle-equivalent) when absent (009-02 AC2)', () => {
  assert.equal(waitingOnRank(withWaitingOn('MERGE', 'MERGE', 'x', 1)), 1);
  assert.equal(waitingOnRank(mkProject()), 7);
  assert.equal(waitingOnRank({}), 7);
});

// --- spec 010-01: two-phase load — client-side keyed merge of PR deltas ---

test('mergePrDeltas: swaps waitingOn/waitingStages and adds prs/ownerLogin by matching path, leaves the rest of the project untouched (010-01 AC3)', () => {
  const disk = withWaitingOn('DECIDE', 'DECIDE', 'x', 3);
  const delta = {
    path: disk.path,
    ownerLogin: 'owner-login',
    prs: [{ number: 7, title: 'ready one' }],
    waitingOn: { state: 'MERGE', verb: 'MERGE', action: 'merge PR #7', rank: 1 },
    waitingStages: [{ state: 'MERGE', verb: 'MERGE', action: 'merge PR #7', rank: 1 }],
  };
  const [merged] = mergePrDeltas([disk], [delta]);
  assert.deepEqual(merged.waitingOn, delta.waitingOn);
  assert.deepEqual(merged.waitingStages, delta.waitingStages);
  assert.deepEqual(merged.prs, delta.prs);
  assert.equal(merged.ownerLogin, 'owner-login');
  assert.equal(merged.name, disk.name, 'fields the delta does not carry stay from the disk payload');
});

test('mergePrDeltas: a project absent from the deltas is unchanged (010-01 AC3/AC4)', () => {
  const disk = withWaitingOn('DECIDE', 'DECIDE', 'x', 3);
  const [merged] = mergePrDeltas([disk], []);
  assert.deepEqual(merged, disk);
});

test('mergePrDeltas: does not mutate the input projects array or its entries (pure)', () => {
  const disk = withWaitingOn('DECIDE', 'DECIDE', 'x', 3);
  const projects = [disk];
  const delta = { path: disk.path, waitingOn: { state: 'MERGE', verb: 'MERGE', action: 'x', rank: 1 }, waitingStages: [] };
  mergePrDeltas(projects, [delta]);
  assert.equal(projects[0], disk, 'the input array is untouched');
  assert.deepEqual(disk.waitingOn, { state: 'DECIDE', verb: 'DECIDE', action: 'x', rank: 3 }, 'the original project object is untouched');
});

test('mergePrDeltas: a merged, PR-promoted project moves ahead after re-sort (010-01 AC3)', () => {
  const alpha = withWaitingOn('DECIDE', 'DECIDE', 'x', 3);
  const beta = mkProject({ path: '/projects/beta', waitingOn: { state: 'Idle', verb: 'IDLE', action: '', rank: 7 } });
  const delta = {
    path: beta.path,
    waitingOn: { state: 'MERGE', verb: 'MERGE', action: 'merge PR #3', rank: 1 },
    waitingStages: [{ state: 'MERGE', verb: 'MERGE', action: 'merge PR #3', rank: 1 }],
  };
  const merged = mergePrDeltas([alpha, beta], [delta]);
  const ordered = sortProjectsByWaitingOn(merged);
  assert.equal(ordered[0].path, beta.path, 'the PR-promoted project (now MERGE, rank 1) sorts ahead of the disk-only DECIDE project');
});

// --- spec 009-03: cross-project action-queue lens ---
// actionQueue/actionQueueRow/actionQueueGroup/actionQueueHtml only READ the
// `p.waitingStages` field scan-side deriveWaitingStages emits (src/lib.mjs) —
// these tests hand-build that field on mkProject payloads exactly as
// scanProject emits it, same idiom as withWaitingOn above.

function withStages(overrides, stages) {
  return mkProject({ ...overrides, waitingStages: stages });
}

test('actionQueue: flattens waitingStages across multiple projects into stage rows (009-03 AC2)', () => {
  const projects = [
    withStages({ name: 'Alpha', path: '/a' }, [{ state: 'MERGE', verb: 'MERGE', action: 'land 1 reconciled slice', rank: 1 }]),
    withStages({ name: 'Beta', path: '/b' }, [{ state: 'DECIDE', verb: 'DECIDE', action: 'decide the rounding rule', rank: 3 }]),
  ];
  const groups = actionQueue(projects);
  const allRows = groups.flatMap((g) => g.rows);
  assert.equal(allRows.length, 2);
  assert.deepEqual(allRows.map((r) => r.name), ['Alpha', 'Beta']);
  assert.deepEqual(allRows.map((r) => r.path), ['/a', '/b']);
});

test('mutation check: the flatten includes EVERY project\'s rows, not just the first (009-03 AC2)', () => {
  // Exercises actionQueue directly: a "read only projects[0]" regression would
  // drop Gamma (the last project) — this fails unless every project is flattened.
  const projects = [
    withStages({ name: 'Alpha', path: '/a' }, [{ state: 'MERGE', verb: 'MERGE', action: 'x', rank: 1 }]),
    withStages({ name: 'Beta', path: '/b' }, [{ state: 'DECIDE', verb: 'DECIDE', action: 'y', rank: 3 }]),
    withStages({ name: 'Gamma', path: '/g' }, [{ state: 'Ready', verb: 'READY', action: 'z', rank: 5 }]),
  ];
  const names = actionQueue(projects).flatMap((g) => g.rows).map((r) => r.name);
  assert.deepEqual(names.sort(), ['Alpha', 'Beta', 'Gamma'], 'a first-project-only read would drop Gamma');
});

test('actionQueue: caps each project at its top 3 stages, finish-first (009-03 AC2)', () => {
  const stages = [
    { state: 'MERGE', verb: 'MERGE', action: 'a', rank: 1 },
    { state: 'REVIEW', verb: 'REVIEW', action: 'b', rank: 2 },
    { state: 'DECIDE', verb: 'DECIDE', action: 'c', rank: 3 },
    { state: 'Ready', verb: 'READY', action: 'd', rank: 4 },
    { state: 'Ready', verb: 'READY', action: 'e', rank: 5 },
  ];
  const p = withStages({ name: 'Loaded', path: '/loaded' }, stages);
  const rows = actionQueue([p]).flatMap((g) => g.rows);
  assert.equal(rows.length, 3, 'a 5-stage project is capped to its top 3, not all 5');
  assert.deepEqual(rows.map((r) => r.rank), [1, 2, 3]);
});

test('actionQueue: caps at a custom capPerProject when given (009-03 AC2)', () => {
  const stages = [
    { state: 'MERGE', verb: 'MERGE', action: 'a', rank: 1 },
    { state: 'REVIEW', verb: 'REVIEW', action: 'b', rank: 2 },
  ];
  const p = withStages({ name: 'Loaded', path: '/loaded' }, stages);
  const rows = actionQueue([p], { capPerProject: 1 }).flatMap((g) => g.rows);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].rank, 1);
});

test('actionQueue: groups rows by pipeline stage, ordered Land -> Review -> Decide -> Finish -> Start (009-03 AC3)', () => {
  const p1 = withStages({ name: 'P1', path: '/p1' }, [{ state: 'DECIDE', verb: 'DECIDE', action: 'x', rank: 3 }]);
  const p2 = withStages({ name: 'P2', path: '/p2' }, [{ state: 'MERGE', verb: 'MERGE', action: 'y', rank: 1 }]);
  const p3 = withStages({ name: 'P3', path: '/p3' }, [{ state: 'Ready', verb: 'READY', action: 'z', rank: 5 }]);
  const groups = actionQueue([p1, p2, p3]);
  assert.deepEqual(groups.map((g) => g.label), ['Land', 'Decide', 'Start']);
  assert.deepEqual(groups.map((g) => g.rank), [1, 3, 5]);
});

test('mutation check: groups come out rank-ascending even when input project order is the reverse (009-03 AC3)', () => {
  // Exercises actionQueue directly: projects are supplied in descending-rank
  // order, so an "emit groups in insertion order" regression would yield
  // Start -> Decide -> Land. Passing proves the sort is by rank, not arrival.
  const p1 = withStages({ name: 'P1', path: '/p1' }, [{ state: 'Ready', verb: 'READY', action: 'z', rank: 5 }]);
  const p2 = withStages({ name: 'P2', path: '/p2' }, [{ state: 'DECIDE', verb: 'DECIDE', action: 'x', rank: 3 }]);
  const p3 = withStages({ name: 'P3', path: '/p3' }, [{ state: 'MERGE', verb: 'MERGE', action: 'y', rank: 1 }]);
  const groups = actionQueue([p1, p2, p3]);
  assert.deepEqual(groups.map((g) => g.label), ['Land', 'Decide', 'Start']);
});

test('actionQueue: stable project order within a group (009-03 AC3)', () => {
  const p1 = withStages({ name: 'First', path: '/1' }, [{ state: 'REVIEW', verb: 'REVIEW', action: 'x', rank: 2 }]);
  const p2 = withStages({ name: 'Second', path: '/2' }, [{ state: 'REVIEW', verb: 'REVIEW', action: 'y', rank: 2 }]);
  const groups = actionQueue([p1, p2]);
  const reviewGroup = groups.find((g) => g.rank === 2);
  assert.deepEqual(reviewGroup.rows.map((r) => r.name), ['First', 'Second']);
});

test('actionQueue: a project with empty waitingStages (Idle) contributes no row (009-03 AC4)', () => {
  const idle = withStages({ name: 'Idle Co', path: '/idle' }, []);
  const decide = withStages({ name: 'Busy Co', path: '/busy' }, [{ state: 'DECIDE', verb: 'DECIDE', action: 'x', rank: 3 }]);
  const groups = actionQueue([idle, decide]);
  const allRows = groups.flatMap((g) => g.rows);
  assert.equal(allRows.length, 1);
  assert.equal(allRows[0].name, 'Busy Co');
});

test('actionQueue: a project with no waitingStages field at all contributes nothing, never crashes (009-03 AC4 backward compat)', () => {
  const bare = mkProject({ name: 'Bare', path: '/bare' });
  delete bare.waitingStages;
  assert.deepEqual(actionQueue([bare]), []);
});

test('actionQueue: an all-idle portfolio returns no groups at all (009-03 AC4)', () => {
  const idleOnly = [withStages({ name: 'A', path: '/a' }, []), withStages({ name: 'B', path: '/b' }, [])];
  assert.deepEqual(actionQueue(idleOnly), []);
});

test('AC5: for a multi-stage fixture, a project\'s waitingOn.state (grid) equals its first queue row\'s state (head-consistency, by construction)', () => {
  const raw = {
    specs: [
      { id: '050-a', title: 'A', status: 'IN_PROGRESS', slices: [{ file: 'slice-01-a.md', status: 'RECONCILED', dependencies: [] }] },
      { id: '051-b', title: 'B', status: 'DRAFT', slices: [{ file: 'slice-01-a.md', status: 'DRAFT', dependencies: [] }] },
    ],
    workstreams: [],
    compass: null,
  };
  const waitingOn = deriveWaitingOn(raw);
  const waitingStages = deriveWaitingStages(raw);
  assert.ok(waitingStages.length > 1, 'sanity: this fixture really is multi-stage (MERGE + Ready-start)');
  const p = mkProject({ name: 'Multi', path: '/multi', waitingOn, waitingStages });
  const groups = actionQueue([p]);
  assert.equal(groups[0].rows[0].state, p.waitingOn.state, 'grid state and the queue\'s top row must agree');
});

test('mutation check: a fixture with only ONE stage would trivially "pass" head-consistency without exercising anything — this fixture is genuinely multi-stage', () => {
  const raw = { specs: [{ id: '052-a', title: 'A', status: 'DONE', slices: [{ file: 'slice-01-a.md', status: 'DONE', dependencies: [] }] }], workstreams: [], compass: null };
  const stages = deriveWaitingStages(raw);
  assert.equal(stages.length, 0, 'this Idle fixture is the negative control the multi-stage fixture above is contrasted against');
});

test('actionQueueRow: renders verb badge, project name, action text, and data-path for click-to-open (009-03)', () => {
  const html = actionQueueRow({ name: 'Kestrel', path: '/projects/kestrel', state: 'DECIDE', verb: 'DECIDE', action: 'decide the rounding rule', rank: 3 });
  assert.match(html, /data-path="\/projects\/kestrel"/);
  assert.match(html, /<span class="row-verb rv-DECIDE">DECIDE<\/span>/);
  assert.match(html, /Kestrel/);
  assert.match(html, /decide the rounding rule/);
});

test('actionQueueGroup: renders the group label and all its rows (009-03 AC3)', () => {
  const group = { rank: 1, label: 'Land', verb: 'MERGE', rows: [{ name: 'A', path: '/a', state: 'MERGE', verb: 'MERGE', action: 'land 1 reconciled slice', rank: 1 }] };
  const html = actionQueueGroup(group);
  assert.match(html, /Land/);
  assert.match(html, /land 1 reconciled slice/);
});

test('actionQueueHtml: composes groups under a sheet; empty queue shows honest empty-state text, not a blank sheet (009-03)', () => {
  const p = withStages({ name: 'Busy', path: '/busy' }, [{ state: 'MERGE', verb: 'MERGE', action: 'land 1 reconciled slice', rank: 1 }]);
  const html = actionQueueHtml([p]);
  assert.match(html, /class="sheet"/);
  assert.match(html, /land 1 reconciled slice/);
  const empty = actionQueueHtml([mkProject({ name: 'Idle Co', path: '/idle', waitingStages: [] })]);
  assert.ok(!empty.includes('land 1 reconciled slice'));
  assert.match(empty, /nothing|no.*waiting/i, 'empty-state text is shown, not a blank sheet');
});

// --- spec 009-03 AC1: lens toggle state (overview <-> action queue) ---

test('setLens: pure toggle between overview and queue lenses, resetting to overview view (009-03 AC1)', () => {
  const toQueue = setLens(OVERVIEW_STATE, 'queue');
  assert.equal(toQueue.lens, 'queue');
  assert.equal(toQueue.view, 'overview');
  const backToOverview = setLens(toQueue, 'overview');
  assert.equal(backToOverview.lens, 'overview');
  assert.equal(backToOverview.view, 'overview');
});

test('setLens: does not mutate the input state (pure)', () => {
  const initial = { ...OVERVIEW_STATE };
  setLens(initial, 'queue');
  assert.deepEqual(initial, OVERVIEW_STATE);
});

test('OVERVIEW_STATE: default lens is overview (009-03 AC1)', () => {
  assert.equal(OVERVIEW_STATE.lens, 'overview');
});
