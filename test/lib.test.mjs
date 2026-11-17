import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFrontmatter,
  progressOf,
  parseRunbook,
  countCheckboxes,
  countInboxItems,
  countRefinement,
  parseCompassHistory,
  validateSnapshot,
  ownerOf,
  ageLabel,
  ageDays,
  encodeCwdSlug,
  worktreeFromCwd,
  worktreeFromSlug,
  attributeSessionDir,
  foldTranscriptLine,
  resolveSessionTitle,
  compareSessionOrder,
  relativeTime,
  sessionCounts,
  parseIncludeTokens,
  resolveReleaseGoal,
  deriveWaitingOn,
  deriveWaitingStages,
  extractSliceGoal,
  extractSliceTrigger,
  TEXT_CAP,
} from '../src/lib.mjs';

test('parseFrontmatter: flat keys, arrays, quotes, comments', () => {
  const { data, body } = parseFrontmatter(
    '---\nstatus: DONE\ndependencies: [002-01, 002-02]\n# a comment line\nlast_verified: 2026-07-13\ntitle: "quoted"\nempty:\n---\nbody here'
  );
  assert.equal(data.status, 'DONE');
  assert.deepEqual(data.dependencies, ['002-01', '002-02']);
  assert.equal(data.last_verified, '2026-07-13');
  assert.equal(data.title, 'quoted');
  assert.equal(data.empty, null);
  assert.equal(body.trim(), 'body here');
});

test('parseFrontmatter: no frontmatter → empty data, body untouched', () => {
  const { data, body } = parseFrontmatter('# just a doc');
  assert.deepEqual(data, {});
  assert.equal(body, '# just a doc');
});

test('progressOf: ABANDONED leaves denominator, DEFERRED reported separately (AC2)', () => {
  const items = [
    ...Array(27).fill({ status: 'DONE' }),
    { status: 'IN_PROGRESS' },
    { status: 'ABANDONED' },
    { status: 'ABANDONED' },
  ];
  const p = progressOf(items);
  assert.equal(p.total, 30);
  assert.equal(p.denom, 28);
  assert.equal(p.done, 27);
  assert.equal(p.pct, 96);

  const withDeferred = progressOf([{ status: 'DONE' }, { status: 'DEFERRED' }]);
  assert.equal(withDeferred.deferred, 1);
  assert.equal(withDeferred.pct, 50);
});

test('progressOf: empty and all-abandoned yield null pct, not NaN', () => {
  assert.equal(progressOf([]).pct, null);
  assert.equal(progressOf([{ status: 'ABANDONED' }]).pct, null);
});

test('parseRunbook: numbered steps win, sub-bullets ignored, owner tags parsed (002-02 AC2)', () => {
  const text = [
    '# Widget runbook',
    '## What finished means',
    '- [ ] loop closed',
    '- [ ] gaps fixed',
    '### Phase A — close the loop',
    '1. [ ] **(you)** First review round.',
    '### Phase B — fix it',
    '2. [ ] **(Claude)** New small spec.',
    '   - [ ] sub item ignored',
    '3. [x] **BATCH RUN (you, cost)** — fresh batch.',
  ].join('\n');
  const rb = parseRunbook(text);
  assert.equal(rb.title, 'Widget runbook');
  assert.deepEqual(rb.steps, { done: 1, total: 3 });
  assert.equal(rb.currentPhase, 'Phase A — close the loop');
  assert.equal(rb.next.owner, 'you');
  assert.match(rb.next.text, /First review round/);
  assert.deepEqual(rb.phases, ['Phase A — close the loop', 'Phase B — fix it']);
});

test('parseRunbook: bulleted fallback counts only top-level boxes', () => {
  const rb = parseRunbook('# Plan\n- [x] one\n- [ ] two\n  - [ ] nested ignored\n');
  assert.deepEqual(rb.steps, { done: 1, total: 2 });
  assert.equal(rb.next.text, 'two');
});

test('parseRunbook: no checkboxes → phases from headings, no next', () => {
  const rb = parseRunbook('# Roadmap\n## Phase 1 — beta\n## Phase 2 — GA\n');
  assert.equal(rb.steps.total, 0);
  assert.equal(rb.next, null);
  assert.deepEqual(rb.phases, ['Phase 1 — beta', 'Phase 2 — GA']);
});

// --- spec 009-01: parseRunbook widened to return the full item list ---

test('parseRunbook: items exposes the full step list (checked + unchecked) with text/owner (009-01 AC5)', () => {
  const text = [
    '# Widget runbook',
    '1. [x] first done step.',
    '2. [ ] **(you)** second step needs you.',
    '3. [ ] third step.',
  ].join('\n');
  const rb = parseRunbook(text);
  assert.deepEqual(rb.items, [
    { checked: true, text: 'first done step.', owner: null },
    { checked: false, text: 'second step needs you.', owner: 'you' },
    { checked: false, text: 'third step.', owner: null },
  ]);
});

test('mutation check: items must track steps.length exactly — a caller slicing to "next 3 unchecked" needs the full list, not just `next`', () => {
  const rb = parseRunbook('# Plan\n- [x] one\n- [ ] two\n- [ ] three\n- [ ] four\n');
  assert.equal(rb.items.length, rb.steps.total);
  assert.equal(rb.items.filter((i) => !i.checked).length, 3);
});

test('countCheckboxes counts all indent levels', () => {
  assert.deepEqual(countCheckboxes('- [x] a\n  - [ ] b\n1. [ ] c\n'), { done: 1, total: 3 });
});

test('countInboxItems counts only dated bullets', () => {
  assert.equal(countInboxItems('- [2026-07-01] a\n- [2026-07-02] b\n- plain\n'), 2);
});

test('countRefinement: RESOLVED heading closed, partial stays open', () => {
  const text = [
    '### Decision: One — RESOLVED',
    '**Resolved (2026-07-01):** yes.',
    '### Decision: Two',
    '**Deferred:** no signal.',
    '### Decision: Three (partially resolved)',
    '**Resolved:** part.',
    '**Still deferred:** rest.',
  ].join('\n');
  assert.deepEqual(countRefinement(text), { open: 2, total: 3 });
});

test('parseCompassHistory: last valid line wins, malformed skipped (002-03 AC2)', () => {
  const text =
    '{"v":1,"ts":"2026-07-10T08:00:00Z","headline":"old"}\n' +
    '{"v":1,"ts":"2026-07-12T20:00:00Z","headline":"newer","next":"do x"}\n' +
    'not json at all\n';
  const { latest, malformed, count } = parseCompassHistory(text);
  assert.equal(latest.headline, 'newer');
  assert.equal(malformed, 1);
  assert.equal(count, 3);
});

test('parseCompassHistory: empty text → no latest', () => {
  assert.equal(parseCompassHistory('').latest, null);
});

test('parseCompassHistory: latestNarrative prefers non-auto over a newer auto line (005-04)', () => {
  const text =
    '{"v":1,"ts":"2026-08-01T08:00:00Z","headline":"sessions panel ready","source":"dashboard"}\n' +
    '{"v":1,"ts":"2026-08-02T05:00:00Z","headline":"auto: 3/8 specs done","source":"auto"}\n';
  const { latest, latestNarrative } = parseCompassHistory(text);
  assert.equal(latest.source, 'auto', 'latest is still the newest line overall');
  assert.equal(latestNarrative.headline, 'sessions panel ready', 'narrative selection skips the auto line');
});

test('parseCompassHistory: a source-less line counts as narrative (pre-005-03 entries) (005-04)', () => {
  const text = '{"v":1,"ts":"2026-07-01T08:00:00Z","headline":"legacy prose"}\n';
  const { latestNarrative } = parseCompassHistory(text);
  assert.equal(latestNarrative.headline, 'legacy prose', 'missing source is treated as narrative, never hidden');
});

test('parseCompassHistory: only auto lines → latestNarrative is null (005-04)', () => {
  const text = '{"v":1,"ts":"2026-08-02T05:00:00Z","headline":"auto: 3/8 specs done","source":"auto"}\n';
  assert.equal(parseCompassHistory(text).latestNarrative, null);
});

test('parseCompassHistory: unparseable ts counts as malformed, never surfaces (review finding 5)', () => {
  const { latest, malformed } = parseCompassHistory('{"v":1,"ts":"garbage","headline":"x"}\n');
  assert.equal(latest, null);
  assert.equal(malformed, 1);
});

test('validateSnapshot enforces full ADR-0002 schema incl. v and specs (review finding 3)', () => {
  const ok = { v: 1, ts: '2026-07-13T08:00:00Z', headline: 'ok' };
  assert.equal(validateSnapshot(ok).length, 0);
  assert.equal(validateSnapshot({ ...ok, specs: { done: 1, total: 2 } }).length, 0);
  assert.ok(validateSnapshot({ ts: '2026-07-13T08:00:00Z', headline: 'no v' }).length > 0);
  assert.ok(validateSnapshot({ v: 1, headline: 'no ts' }).length > 0);
  assert.ok(validateSnapshot({ v: 1, ts: 'not-a-date', headline: 'x' }).length > 0);
  assert.ok(validateSnapshot({ ...ok, blockers: 'nope' }).length > 0);
  assert.ok(validateSnapshot({ ...ok, specs: { done: 'one' } }).length > 0);
});

test('ownerOf: only bold owner tags match (review finding 2)', () => {
  assert.equal(ownerOf('**(you)** First review round'), 'you');
  assert.equal(ownerOf('**(Claude)** New small spec'), 'claude');
  assert.equal(ownerOf('**BATCH RUN (you, cost)** — fresh batch'), 'you');
  assert.equal(ownerOf('pick whatever suits (your choice)'), null);
  assert.equal(ownerOf('**(your choice)** of options'), null);
  assert.equal(ownerOf('plain (you) without bold'), null);
});

test('ageLabel: morning/afternoon/evening/yesterday/N days, null on garbage (002-03 AC3+AC5)', () => {
  const now = new Date('2026-07-13T20:00:00').getTime();
  assert.equal(ageLabel('2026-07-13T09:00:00', now), 'this morning');
  assert.equal(ageLabel('2026-07-13T14:00:00', now), 'this afternoon');
  assert.equal(ageLabel('2026-07-13T19:00:00', now), 'this evening');
  assert.equal(ageLabel('2026-07-12T22:00:00', now), 'yesterday');
  assert.equal(ageLabel('2026-07-10T08:00:00', now), '3 days ago');
  assert.equal(ageLabel('garbage', now), null);
  assert.equal(ageDays('2026-07-10T20:00:00', now), 3);
  assert.equal(ageDays('garbage', now), null);
});

// --- Spec 003-01: session panel pure helpers ---

test('encodeCwdSlug: every non-alphanumeric char becomes a dash (003-01 AC1/AC4)', () => {
  assert.equal(encodeCwdSlug('/home/dev/.claude/worktrees/feature-x'), '-home-dev--claude-worktrees-feature-x');
});

test('worktreeFromCwd: extracts the segment immediately after .claude/worktrees/, even when nested deeper (003-01 AC4/AC7)', () => {
  assert.equal(worktreeFromCwd('/root/.claude/worktrees/feature-x/.claude/skills/interactive'), 'feature-x');
  assert.equal(worktreeFromCwd('/root/.claude/worktrees/feature-x'), 'feature-x');
  assert.equal(worktreeFromCwd('/root/main-checkout'), null);
  assert.equal(worktreeFromCwd(null), null);
});

test('worktreeFromSlug: phase-1 first-cut remainder after the root+worktrees prefix (003-01 AC4)', () => {
  const rootSlug = encodeCwdSlug('/root/proj-a');
  assert.equal(worktreeFromSlug(`${rootSlug}--claude-worktrees-feature-x`, rootSlug), 'feature-x');
  assert.equal(worktreeFromSlug(rootSlug, rootSlug), null); // main-root dir, no worktree
});

test('attributeSessionDir: main root (exact match) + worktree (anchored prefix), sibling-prefix root never cross-attributes (003-01 AC4)', () => {
  const rootA = '/root/proj-a';
  const rootAPlugin = '/root/proj-a-plugin';
  const roots = [
    { root: rootA, slug: encodeCwdSlug(rootA) },
    { root: rootAPlugin, slug: encodeCwdSlug(rootAPlugin) },
  ];
  // main-root session for proj-a
  assert.deepEqual(attributeSessionDir(encodeCwdSlug(rootA), roots), { root: rootA, worktree: null });
  // worktree session for proj-a
  assert.deepEqual(
    attributeSessionDir(`${encodeCwdSlug(rootA)}--claude-worktrees-feature-x`, roots),
    { root: rootA, worktree: 'feature-x' },
  );
  // proj-a-plugin's own main-root session must attribute to itself, not proj-a
  assert.deepEqual(attributeSessionDir(encodeCwdSlug(rootAPlugin), roots), { root: rootAPlugin, worktree: null });
  // an unrelated directory matches neither root → dropped
  assert.equal(attributeSessionDir(encodeCwdSlug('/root/unrelated'), roots), null);
});

test('attributeSessionDir: sibling directory is dropped when only the shorter root is configured — no longest-root rescue available (003-01 AC4 regression guard)', () => {
  // Deliberately configures ONLY the short root, not the sibling, so a
  // regression from segment-anchored matching to a bare `dirSlug.startsWith(slug)`
  // would wrongly attribute the sibling's sessions to rootA — with the sibling
  // root absent from `roots`, there is no longer-root candidate to rescue the
  // correct outcome via the tie-break, unlike the two-roots-configured test above.
  const rootA = '/root/proj-a';
  const roots = [{ root: rootA, slug: encodeCwdSlug(rootA) }];
  const siblingSlug = encodeCwdSlug('/root/proj-a-plugin');
  // sibling's own main-root session dir
  assert.equal(attributeSessionDir(siblingSlug, roots), null);
  // sibling's own worktree session dir
  assert.equal(attributeSessionDir(`${siblingSlug}--claude-worktrees-x`, roots), null);
});

test('attributeSessionDir: longest root wins when more than one configured root matches (003-01 AC4)', () => {
  const short = '/root/proj';
  const long = '/root/proj/nested';
  const roots = [
    { root: short, slug: encodeCwdSlug(short) },
    { root: long, slug: encodeCwdSlug(long) },
  ];
  assert.deepEqual(attributeSessionDir(encodeCwdSlug(long), roots), { root: long, worktree: null });
});

test('foldTranscriptLine + resolveSessionTitle: custom-title wins verbatim (003-01 AC2)', () => {
  const acc = { customTitle: null, firstHumanText: null, lastGitBranch: null, lastCwd: null };
  foldTranscriptLine(acc, { type: 'user', message: { content: 'ignored, a custom-title follows' } });
  foldTranscriptLine(acc, { type: 'custom-title', customTitle: 'Ship the login flow' });
  assert.equal(resolveSessionTitle(acc, null, 'sess-1'), 'Ship the login flow');
});

test('foldTranscriptLine + resolveSessionTitle: title-less session, first block an image, falls back to the first TEXT block not the base64 (003-01 AC2)', () => {
  const acc = { customTitle: null, firstHumanText: null, lastGitBranch: null, lastCwd: null };
  foldTranscriptLine(acc, {
    type: 'user',
    message: {
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'not-a-real-base64-blob' } },
        { type: 'text', text: 'Investigate flaky test' },
      ],
    },
  });
  assert.equal(resolveSessionTitle(acc, null, 'sess-2'), 'Investigate flaky test');
});

test('foldTranscriptLine + resolveSessionTitle: empty/meta-only transcript falls back to the id (003-01 AC2)', () => {
  const acc = { customTitle: null, firstHumanText: null, lastGitBranch: null, lastCwd: null };
  foldTranscriptLine(acc, { type: 'queue-operation', op: 'add' });
  foldTranscriptLine(acc, { type: 'user', isMeta: true, message: { content: 'synthetic meta content' } });
  assert.equal(resolveSessionTitle(acc, null, 'sess-3'), 'sess-3');
});

test('resolveSessionTitle: sidecar name only when nameSource is human, not "derived" (003-01 AC2)', () => {
  const acc = { customTitle: null, firstHumanText: null, lastGitBranch: null, lastCwd: null };
  assert.equal(resolveSessionTitle(acc, { name: 'auto-generated', nameSource: 'derived' }, 'sess-4'), 'sess-4');
  assert.equal(resolveSessionTitle(acc, { name: 'My real title', nameSource: 'custom-title' }, 'sess-4'), 'My real title');
});

test('foldTranscriptLine: gitBranch — last value wins, HEAD/absent resolves to null by the caller (003-01 AC6)', () => {
  const acc = { customTitle: null, firstHumanText: null, lastGitBranch: null, lastCwd: null };
  foldTranscriptLine(acc, { type: 'user', gitBranch: 'main' });
  foldTranscriptLine(acc, { type: 'user', gitBranch: 'claude/feature-x' });
  assert.equal(acc.lastGitBranch, 'claude/feature-x');
});

test('compareSessionOrder: running-first, then most-recent mtime first (003-01 AC5)', () => {
  const list = [
    { id: 'stale', running: false, lastActivityMs: 1000 },
    { id: 'running', running: true, lastActivityMs: 500 },
    { id: 'recent', running: false, lastActivityMs: 2000 },
  ];
  list.sort(compareSessionOrder);
  assert.deepEqual(list.map((s) => s.id), ['running', 'recent', 'stale']);
});

test('relativeTime: minutes/hours/days ago (003-01 AC8)', () => {
  const now = new Date('2026-08-04T12:00:00Z').getTime();
  assert.equal(relativeTime(new Date(now - 5 * 60000).toISOString(), now), '5m ago');
  assert.equal(relativeTime(new Date(now - 3 * 3600000).toISOString(), now), '3h ago');
  assert.equal(relativeTime(new Date(now - 2 * 86400000).toISOString(), now), '2d ago');
  assert.equal(relativeTime('garbage', now), null);
});

test('sessionCounts: all emitted sessions active — older=0, overflow=0 (003-02 AC1/AC4)', () => {
  const p = { sessions: [{ active: true }, { active: true }], sessionsTotal: 2 };
  assert.deepEqual(sessionCounts(p), { activeCount: 2, olderCount: 0, overflowCount: 0 });
});

test('sessionCounts: some non-active sessions in the emitted list — older>0 (003-02 AC3)', () => {
  const p = {
    sessions: [{ active: true }, { active: false }, { active: false }],
    sessionsTotal: 3,
  };
  assert.deepEqual(sessionCounts(p), { activeCount: 1, olderCount: 2, overflowCount: 0 });
});

test('sessionCounts: cap overflow with older present — overflow>0 and older>0 (003-02 AC3)', () => {
  const p = {
    sessions: [{ active: true }, { active: false }],
    sessionsTotal: 5,
  };
  assert.deepEqual(sessionCounts(p), { activeCount: 1, olderCount: 1, overflowCount: 3 });
});

test('sessionCounts: cap overflow with ALL-ACTIVE emitted (25-running case) — older=0, overflow>0 (003-02 AC3 frame-critique)', () => {
  const p = {
    sessions: Array(20).fill({ active: true }),
    sessionsTotal: 25,
  };
  assert.deepEqual(sessionCounts(p), { activeCount: 20, olderCount: 0, overflowCount: 5 });
});

test('sessionCounts: zero sessions — all counts zero (003-02 AC4)', () => {
  const p = { sessions: [], sessionsTotal: 0 };
  assert.deepEqual(sessionCounts(p), { activeCount: 0, olderCount: 0, overflowCount: 0 });
});

test('sessionCounts: missing sessionsTotal falls back to emitted length — overflow=0 (003-02 AC6)', () => {
  const p = { sessions: [{ active: true }, { active: false }] };
  assert.deepEqual(sessionCounts(p), { activeCount: 1, olderCount: 1, overflowCount: 0 });
});

// --- Spec 008-01: release-goal view — Include parse + join ---

test('parseIncludeTokens: comma list, id+name, and compressed runs all extracted from the Item cell (008-01 AC1)', () => {
  const body = [
    '## Cutline',
    '',
    '### Include',
    '',
    '| Item | Evidence | Rationale |',
    '|---|---|---|',
    '| 002-01, 002-02 | DONE | core |',
    '| 002-03 foo, 002-04 bar | READY | named form |',
    '| 003-01/02/03 | n/a | compressed run |',
    '| 004-01/02 | n/a | two-item compressed run |',
  ].join('\n');
  assert.deepEqual(parseIncludeTokens(body), [
    '002-01', '002-02', '002-03', '002-04', '003-01', '003-02', '003-03', '004-01', '004-02',
  ]);
});

test('parseIncludeTokens: de-duplicates preserving first-seen order (008-01 AC1)', () => {
  const body = [
    '### Include',
    '| Item | Evidence | Rationale |',
    '|---|---|---|',
    '| 002-01, 002-02 | n/a | n/a |',
    '| 002-01 | n/a | repeated |',
  ].join('\n');
  assert.deepEqual(parseIncludeTokens(body), ['002-01', '002-02']);
});

test('parseIncludeTokens: only the Include section is read — a Defer table and a Rationale cell are ignored (008-01 AC1)', () => {
  const body = [
    '### Include',
    '| Item | Evidence | Rationale |',
    '|---|---|---|',
    '| 002-01 | DONE | see 099-99 for context |',
    '',
    '### Defer',
    '| Item | Evidence | Rationale |',
    '|---|---|---|',
    '| 010-01 | n/a | deferred, not a gate |',
  ].join('\n');
  assert.deepEqual(parseIncludeTokens(body), ['002-01']);
});

test('parseIncludeTokens: a 4-digit year is not a token (word-boundary anchoring) (008-01 AC1)', () => {
  const body = [
    '### Include',
    '| Item | Evidence | Rationale |',
    '|---|---|---|',
    '| 2020-01, 002-05 | n/a | year fragment must not match |',
  ].join('\n');
  assert.deepEqual(parseIncludeTokens(body), ['002-05']);
});

test('parseIncludeTokens: no Include heading → zero tokens, no crash (008-01 AC1)', () => {
  assert.deepEqual(parseIncludeTokens('# Plan\n\n## Cutline\n\n### Defer\nsome text\n'), []);
});

test('parseIncludeTokens: malformed rows (stray pipes, blank lines, empty cell) are skipped, never fatal (008-01 AC1)', () => {
  const body = [
    '### Include',
    '| Item | Evidence | Rationale |',
    '|---|---|---|',
    '',
    '| |',
    'not a table row at all',
    '| 002-01 | DONE | fine |',
  ].join('\n');
  assert.deepEqual(parseIncludeTokens(body), ['002-01']);
});

// Synthetic specs shaped exactly like scanSpecs output — never real project data.
const GOAL_SPECS = [
  {
    id: '002-alpha',
    title: 'Alpha',
    status: 'IN_PROGRESS',
    slices: [
      { file: 'slice-01-a.md', status: 'DONE' },
      { file: 'slice-02-b.md', status: 'DRAFT' },
    ],
  },
  {
    id: '003-beta',
    title: 'Beta',
    status: 'DRAFT',
    slices: [
      { file: 'slice-003-01-c.md', status: 'DEFERRED' }, // spec-qualified filename convention
    ],
  },
];

test('resolveReleaseGoal: landed/pending/parked classification + honest total (008-01 AC2/AC3)', () => {
  // 002-01 landed, 002-02 pending, 003-01 parked (excluded), 002-05 unresolved (missing slice)
  const tokens = ['002-01', '002-02', '003-01', '002-05'];
  const r = resolveReleaseGoal(tokens, GOAL_SPECS);
  assert.deepEqual(r.goalProgress, { done: 1, total: 3 }); // parked excluded from total
  assert.deepEqual(r.goalUnresolved, ['002-05']);
});

// --- spec 009-01: resolveReleaseGoal widened to expose memberSpecIds ---

test('resolveReleaseGoal: memberSpecIds names every spec a token resolves to, deduped, first-seen order — landed/pending/parked all included (009-01 AC5)', () => {
  const tokens = ['002-01', '002-02', '003-01', '002-05'];
  const r = resolveReleaseGoal(tokens, GOAL_SPECS);
  assert.deepEqual(r.memberSpecIds, ['002-alpha', '003-beta']);
});

test('resolveReleaseGoal: a forward gate to an unauthored spec contributes no memberSpecIds entry (009-01 AC5)', () => {
  const r = resolveReleaseGoal(['010-01'], GOAL_SPECS); // spec 010 does not exist in GOAL_SPECS
  assert.deepEqual(r.memberSpecIds, []);
});

test('mutation check: removing the spec-found dedup would either miss repeats or admit forward-gate ghosts', () => {
  const tokens = ['002-01', '002-02']; // both resolve to the SAME spec (002-alpha)
  const r = resolveReleaseGoal(tokens, GOAL_SPECS);
  assert.equal(r.memberSpecIds.length, 1, 'two tokens on the same spec must not duplicate its id');
});

test('resolveReleaseGoal: missing-slice-in-authored-spec is unresolved and counted (008-01 AC2/AC3)', () => {
  const r = resolveReleaseGoal(['002-09'], GOAL_SPECS);
  assert.deepEqual(r.goalProgress, { done: 0, total: 1 });
  assert.deepEqual(r.goalUnresolved, ['002-09']);
  assert.deepEqual(r.goalNext, { id: '002-09', action: 'author slice' });
});

test('resolveReleaseGoal: forward gate to an unauthored spec is unresolved and counted (008-01 AC2/AC3)', () => {
  const r = resolveReleaseGoal(['010-01'], GOAL_SPECS);
  assert.deepEqual(r.goalProgress, { done: 0, total: 1 });
  assert.deepEqual(r.goalUnresolved, ['010-01']);
  assert.deepEqual(r.goalNext, { id: '010-01', action: 'author slice' });
});

test('resolveReleaseGoal: goalNext is the first non-landed, non-parked token in Include order (008-01 AC4)', () => {
  const r = resolveReleaseGoal(['002-01', '003-01', '002-02'], GOAL_SPECS);
  assert.deepEqual(r.goalNext, { id: '002-02', action: 'draft' });
});

test('resolveReleaseGoal: all-landed → goalNext is null, done === total (008-01 AC4)', () => {
  const specs = [
    { id: '002-alpha', title: 'Alpha', status: 'DONE', slices: [{ file: 'slice-01-a.md', status: 'DONE' }] },
  ];
  const r = resolveReleaseGoal(['002-01'], specs);
  assert.equal(r.goalNext, null);
  assert.deepEqual(r.goalProgress, { done: 1, total: 1 });
});

test('resolveReleaseGoal: all-landed-plus-parked also yields goalNext null (parked excluded from the finish line) (008-01 AC4)', () => {
  const r = resolveReleaseGoal(['002-01', '003-01'], GOAL_SPECS);
  assert.equal(r.goalNext, null);
  assert.deepEqual(r.goalProgress, { done: 1, total: 1 });
});

test('resolveReleaseGoal: every pending status maps to its next-action label; unmapped/null falls back to advance (008-01 AC4)', () => {
  const cases = [
    ['DRAFT', 'draft'],
    ['READY_FOR_REVIEW', 'review spec'],
    ['READY_FOR_IMPLEMENTATION', 'implement'],
    ['IN_PROGRESS', 'finish implementation'],
    ['REVIEWED', 'reconcile'],
    ['RECONCILED', 'land'],
    ['SOME_UNKNOWN_STATUS', 'advance'],
    [null, 'advance'],
  ];
  for (const [status, action] of cases) {
    const specs = [{ id: '002-x', title: 'X', status: 'IN_PROGRESS', slices: [{ file: 'slice-01-a.md', status }] }];
    const r = resolveReleaseGoal(['002-01'], specs);
    assert.deepEqual(r.goalNext, { id: '002-01', action }, `status ${status}`);
  }
});

test('resolveReleaseGoal: spec-qualified slice filename convention (slice-NNN-NN-*.md) resolves correctly (A1)', () => {
  const r = resolveReleaseGoal(['003-01'], GOAL_SPECS);
  assert.deepEqual(r.goalProgress, { done: 0, total: 0 }); // parked, excluded entirely
});

// --- Spec 008-02: graceful degradation & honest unknowns ---

test('parseIncludeTokens: Include heading present but table has zero data rows → [] (008-02 AC2)', () => {
  const body = ['### Include', '| Item | Evidence | Rationale |', '|---|---|---|'].join('\n');
  assert.deepEqual(parseIncludeTokens(body), []);
});

test('parseIncludeTokens: Include restyled as a bullet list (no pipes) is unreadable as a table → [] (008-02 AC2)', () => {
  const body = ['### Include', '', '- 002-01 core gate', '- 002-02 second gate', ''].join('\n');
  assert.deepEqual(parseIncludeTokens(body), []);
});

test('parseIncludeTokens: Item cells with no ID-shaped token yield [] (008-02 AC2)', () => {
  const body = [
    '### Include',
    '| Item | Evidence | Rationale |',
    '|---|---|---|',
    '| TBD | n/a | not yet named |',
    '| see notes | n/a | prose only |',
  ].join('\n');
  assert.deepEqual(parseIncludeTokens(body), []);
});

test('parseIncludeTokens: a number in a Rationale cell inside Include itself is never read as a token (008-02 AC2)', () => {
  const body = [
    '### Include',
    '| Item | Evidence | Rationale |',
    '|---|---|---|',
    '| TBD | n/a | mentions 002-01 only in passing |',
  ].join('\n');
  assert.deepEqual(parseIncludeTokens(body), []);
});

test('parseIncludeTokens: a 4-digit year inside Include (not just at top level) still yields no token (008-02 AC2)', () => {
  const body = [
    '### Include',
    '| Item | Evidence | Rationale |',
    '|---|---|---|',
    '| 2031-07 | n/a | version-looking fragment, not a slice id |',
  ].join('\n');
  assert.deepEqual(parseIncludeTokens(body), []);
});

test('parseIncludeTokens: extraction is purely structural — an ID-shaped token embedded in Item-cell prose, referencing an unauthored spec, is never dropped as "noise" (008-02 AC2)', () => {
  const body = [
    '### Include',
    '| Item | Evidence | Rationale |',
    '|---|---|---|',
    '| spec 099-99 (not authored yet, looks unlikely) | n/a | still a genuine gate |',
  ].join('\n');
  // The parser never judges plausibility — it extracts by structural position only.
  assert.deepEqual(parseIncludeTokens(body), ['099-99']);
});

test('resolveReleaseGoal: all references unresolved → meter still shows "0 of N", never suppressed (008-02 AC4)', () => {
  const r = resolveReleaseGoal(['010-01', '011-01', '002-09'], GOAL_SPECS);
  assert.deepEqual(r.goalProgress, { done: 0, total: 3 });
  assert.deepEqual(r.goalUnresolved, ['010-01', '011-01', '002-09']);
  assert.deepEqual(r.goalNext, { id: '010-01', action: 'author slice' });
});

test('resolveReleaseGoal: all references parked → {done:0,total:0} is the honest data result ("0 of 0" suppression is scan.mjs\'s job, not this pure helper) (008-02 AC4)', () => {
  const r = resolveReleaseGoal(['003-01'], GOAL_SPECS); // 003-01 is DEFERRED in GOAL_SPECS
  assert.deepEqual(r.goalProgress, { done: 0, total: 0 });
});

test('parseIncludeTokens: malformed rows (missing leading pipe, doubled trailing pipe, empty Item cell, header/separator rows) are skipped without aborting the remaining valid rows (008-02 AC5)', () => {
  const body = [
    '### Include',
    '| Item | Evidence | Rationale |', // header, skipped
    '|---|---|---|', // separator, skipped
    '002-01 | DONE | missing leading pipe, still readable |',
    '| 002-02 | DONE | doubled trailing pipe |extra||',
    '|  | n/a | empty Item cell, skipped |',
    '',
    'not a table row at all',
    '| 002-03 | DONE | fine |',
  ].join('\n');
  assert.deepEqual(parseIncludeTokens(body), ['002-01', '002-02', '002-03']);
});

// --- spec 009-02: deriveWaitingOn — the waiting-on state + finish-first rank ---
// Taxonomy pinned by docs/specs/009-overview-redesign/
// slice-02-waiting-on-state-and-ordering.md; fixtures below shape the payload
// exactly as scanProject emits it (specs[].slices[].{status,dependencies,file},
// workstreams[].{items,next}, compass.blockers) so this exercises the real
// on-disk signals, not a reinterpretation of them.

function proj({ specs = [], workstreams = [], compass = null, counts, worktreeOnlyDocs } = {}) {
  return { specs, workstreams, compass, counts, worktreeOnlyDocs };
}

function slice(file, status, dependencies = []) {
  return { file, status, dependencies, lastVerified: null };
}

test('deriveWaitingOn: MERGE — any RECONCILED slice, action names the count (009-02 taxonomy)', () => {
  const p = proj({
    specs: [{ id: '011-owner-queue', title: 'X', status: 'IN_PROGRESS', slices: [slice('slice-01-a.md', 'RECONCILED')] }],
  });
  const w = deriveWaitingOn(p);
  assert.deepEqual(w, { state: 'MERGE', verb: 'MERGE', action: 'land 1 reconciled slice', rank: 1 });
});

test('deriveWaitingOn: MERGE — two RECONCILED slices collapse to ONE state, action pluralizes (009-02 taxonomy)', () => {
  const p = proj({
    specs: [{ id: '011-x', title: 'X', status: 'IN_PROGRESS', slices: [slice('slice-01-a.md', 'RECONCILED'), slice('slice-02-b.md', 'RECONCILED')] }],
  });
  const w = deriveWaitingOn(p);
  assert.equal(w.state, 'MERGE');
  assert.equal(w.action, 'land 2 reconciled slices');
});

test('deriveWaitingOn: REVIEW — any REVIEWED slice (owner sign-off owed, not READY_FOR_REVIEW) (009-02 taxonomy)', () => {
  const p = proj({
    specs: [{ id: '012-x', title: 'X', status: 'IN_PROGRESS', slices: [slice('slice-01-a.md', 'REVIEWED')] }],
  });
  const w = deriveWaitingOn(p);
  assert.deepEqual(w, { state: 'REVIEW', verb: 'REVIEW', action: 'review 1 finished slice', rank: 2 });
});

test('deriveWaitingOn: READY_FOR_REVIEW (passes not yet run) is Claude-runnable, NOT REVIEW (009-02 taxonomy distinction)', () => {
  const p = proj({
    specs: [{ id: '012-x', title: 'X', status: 'IN_PROGRESS', slices: [slice('slice-01-a.md', 'READY_FOR_REVIEW')] }],
  });
  assert.notEqual(deriveWaitingOn(p).state, 'REVIEW');
});

test('deriveWaitingOn: DECIDE — an open **(you)** next step (owner field, not ownerOf) names the action (009-02 taxonomy)', () => {
  const p = proj({
    specs: [{ id: '013-x', title: 'X', status: 'DRAFT', slices: [slice('slice-01-a.md', 'DRAFT')] }],
    workstreams: [{
      kind: 'runbook',
      items: [{ checked: false, text: 'decide the currency-rounding rule', owner: 'you' }],
      next: { text: 'decide the currency-rounding rule', owner: 'you' },
    }],
  });
  const w = deriveWaitingOn(p);
  assert.deepEqual(w, { state: 'DECIDE', verb: 'DECIDE', action: 'decide the currency-rounding rule', rank: 3 });
});

test('deriveWaitingOn: DECIDE — a compass blocker that ITSELF carries the **(you)** tag also triggers it (009-02 taxonomy, AC4 retightening)', () => {
  const p = proj({
    specs: [{ id: '013-x', title: 'X', status: 'DRAFT', slices: [slice('slice-01-a.md', 'DRAFT')] }],
    compass: { headline: 'stuck', blockers: ['**(you)** routing approach parked on your call'] },
  });
  const w = deriveWaitingOn(p);
  assert.equal(w.state, 'DECIDE');
  assert.equal(w.action, 'routing approach parked on your call', 'the owner tag itself is stripped from the shown action, same as a workstream next-step');
});

test('deriveWaitingOn: a BARE, untagged compass blocker does NOT fire DECIDE — it is a process/status note, not an owner decision (009-02 AC4 discrimination fix)', () => {
  const p = proj({
    // Real data shape from the AC4 probe: process/status notes, not owner
    // decisions — no **(you)** tag anywhere on them.
    specs: [{ id: '018-x', title: 'X', status: 'DONE', slices: [slice('slice-01-a.md', 'DONE')] }],
    compass: {
      headline: 'stuck',
      blockers: ['002-02 reconciliation review not yet passed', 'bug 008 still REPORTED — undiagnosed flaky guard'],
    },
  });
  const w = deriveWaitingOn(p);
  assert.notEqual(w.state, 'DECIDE');
  assert.equal(w.state, 'Idle', 'no other candidate exists either, so it falls all the way through to Idle');
});

test('deriveWaitingOn: Ready(resume) — any IN_PROGRESS slice, no owner tag (009-02 taxonomy)', () => {
  const p = proj({
    specs: [{ id: '014-x', title: 'X', status: 'IN_PROGRESS', slices: [slice('slice-02-b.md', 'IN_PROGRESS')] }],
  });
  const w = deriveWaitingOn(p);
  assert.deepEqual(w, { state: 'Ready', verb: 'READY', action: 'resume 014-02', rank: 4 });
});

test('deriveWaitingOn: Ready(start) — READY_FOR_IMPLEMENTATION with satisfied dependencies (009-02 taxonomy)', () => {
  const p = proj({
    specs: [
      { id: '014-x', title: 'X', status: 'DONE', slices: [slice('slice-01-a.md', 'DONE')] },
      { id: '015-y', title: 'Y', status: 'DRAFT', slices: [slice('slice-02-b.md', 'READY_FOR_IMPLEMENTATION', ['014-01'])] },
    ],
  });
  const w = deriveWaitingOn(p);
  assert.deepEqual(w, { state: 'Ready', verb: 'READY', action: 'start 015-02', rank: 5 });
});

test('deriveWaitingOn: Ready(start) — a DRAFT slice with no dependencies also qualifies (009-02 taxonomy)', () => {
  const p = proj({
    specs: [{ id: '016-z', title: 'Z', status: 'DRAFT', slices: [slice('slice-01-a.md', 'DRAFT')] }],
  });
  const w = deriveWaitingOn(p);
  assert.equal(w.state, 'Ready');
  assert.equal(w.action, 'start 016-01');
  assert.equal(w.rank, 5);
});

test('deriveWaitingOn: Ready(start) is withheld when its dependency has not landed (dependency gate)', () => {
  const p = proj({
    specs: [
      // DEFERRED is parked (excluded), never a candidate on its own, and
      // (not DONE) leaves 015-02's dependency unresolved ("parked" !== "landed").
      { id: '014-x', title: 'X', status: 'DEFERRED', slices: [slice('slice-01-a.md', 'DEFERRED')] },
      { id: '015-y', title: 'Y', status: 'DRAFT', slices: [slice('slice-02-b.md', 'READY_FOR_IMPLEMENTATION', ['014-01'])] },
    ],
  });
  const w = deriveWaitingOn(p);
  assert.equal(w.state, 'Idle', 'the only candidate slice is gated by its unlanded dependency');
});

test('deriveWaitingOn: Ready(start) — READY_FOR_REVIEW (review passes not yet run) with no owner tag also qualifies (009-02 taxonomy fix)', () => {
  const p = proj({
    specs: [{ id: '024-r', title: 'R', status: 'READY_FOR_REVIEW', slices: [slice('slice-01-a.md', 'READY_FOR_REVIEW')] }],
  });
  const w = deriveWaitingOn(p);
  assert.deepEqual(w, { state: 'Ready', verb: 'READY', action: 'start 024-01', rank: 5 }, 'READY_FOR_REVIEW is Claude-runnable — Ready, not Idle and not REVIEW');
});

test('deriveWaitingOn: Idle — every slice DONE/DEFERRED/ABANDONED, no owner tag, no blocker (009-02 taxonomy)', () => {
  const p = proj({
    specs: [{ id: '017-x', title: 'X', status: 'DONE', slices: [slice('slice-01-a.md', 'DONE'), slice('slice-02-b.md', 'DEFERRED'), slice('slice-03-c.md', 'ABANDONED')] }],
    compass: { headline: 'all shipped', blockers: [] },
  });
  const w = deriveWaitingOn(p);
  assert.deepEqual(w, { state: 'Idle', verb: 'IDLE', action: '', rank: 7 });
});

test('deriveWaitingOn: excluded-activity marker — open bugs, a deferred slice, and a worktree-only doc do NOT change the state (activity-excluded rule)', () => {
  const p = proj({
    specs: [{ id: '018-x', title: 'X', status: 'DONE', slices: [slice('slice-01-a.md', 'DONE'), slice('slice-02-b.md', 'DEFERRED')] }],
    counts: { bugs: { open: 6, total: 9 }, refinement: { open: 3, total: 3 }, inbox: 12, adrs: 2 },
    worktreeOnlyDocs: [{ path: 'docs/specs/018/plan.md', worktree: 'wt-a' }],
  });
  assert.equal(deriveWaitingOn(p).state, 'Idle', 'activity counts must never leak into the waiting-on state');
});

test('deriveWaitingOn: false-Idle regression — an IN_PROGRESS project with NO owner tag derives Ready(resume), never Idle (009-02 regression AC)', () => {
  const p = proj({
    specs: [{ id: '019-x', title: 'X', status: 'IN_PROGRESS', slices: [slice('slice-01-a.md', 'IN_PROGRESS')] }],
  });
  const w = deriveWaitingOn(p);
  assert.notEqual(w.state, 'Idle');
  assert.equal(w.state, 'Ready');
  assert.equal(w.rank, 4);
});

test('deriveWaitingOn: precedence — MERGE beats a simultaneous DECIDE candidate (finish-first total order, AC2)', () => {
  const p = proj({
    specs: [{ id: '020-x', title: 'X', status: 'IN_PROGRESS', slices: [slice('slice-01-a.md', 'RECONCILED')] }],
    workstreams: [{ kind: 'runbook', items: [{ checked: false, text: 'decide something', owner: 'you' }], next: { text: 'decide something', owner: 'you' } }],
  });
  assert.equal(deriveWaitingOn(p).state, 'MERGE', 'a nearly-done You item outranks an earlier-pipeline one');
});

test('deriveWaitingOn: precedence — Ready(resume) outranks Ready(start) when both are candidates (AC2)', () => {
  const p = proj({
    specs: [
      { id: '021-a', title: 'A', status: 'IN_PROGRESS', slices: [slice('slice-01-a.md', 'IN_PROGRESS')] },
      { id: '021-b', title: 'B', status: 'DRAFT', slices: [slice('slice-01-a.md', 'DRAFT')] },
    ],
  });
  const w = deriveWaitingOn(p);
  assert.equal(w.state, 'Ready');
  assert.equal(w.rank, 4, 'resume must sort above start even though both are the "Ready" state label');
  assert.match(w.action, /^resume /);
});

// --- 009-02 AC3: owner-settable marker backstop (config `needsYou`) ---

test('deriveWaitingOn: owner marker (string) forces DECIDE over a would-be Ready derivation (AC3)', () => {
  const p = proj({
    specs: [{ id: '022-x', title: 'X', status: 'IN_PROGRESS', slices: [slice('slice-01-a.md', 'IN_PROGRESS')] }],
  });
  const w = deriveWaitingOn(p, 'waiting on the vendor contract to be signed');
  assert.deepEqual(w, { state: 'DECIDE', verb: 'DECIDE', action: 'waiting on the vendor contract to be signed', rank: 3 });
});

test('deriveWaitingOn: owner marker (object) can force MERGE/REVIEW, not just DECIDE (AC3)', () => {
  const p = proj({ specs: [] }); // would derive Idle unforced
  const w = deriveWaitingOn(p, { state: 'MERGE', action: 'approved externally, land by hand' });
  assert.deepEqual(w, { state: 'MERGE', verb: 'MERGE', action: 'approved externally, land by hand', rank: 1 });
});

test('deriveWaitingOn: owner marker (object) with a bogus/unknown state normalizes to DECIDE — state/verb/rank never desync (compliance fix)', () => {
  const p = proj({ specs: [] });
  const w = deriveWaitingOn(p, { state: 'BOGUS', action: 'something is set but the state name is garbage' });
  assert.deepEqual(w, { state: 'DECIDE', verb: 'DECIDE', action: 'something is set but the state name is garbage', rank: 3 });
});

test('deriveWaitingOn: owner marker (object) with NO action still yields a non-empty headline — never silently drops back to Idle-quiet rendering (craft fix)', () => {
  const p = proj({ specs: [] });
  const w = deriveWaitingOn(p, { state: 'MERGE' });
  assert.equal(w.state, 'MERGE');
  assert.equal(w.verb, 'MERGE');
  assert.ok(w.action && w.action.trim().length > 0, 'action must be non-empty so the render layer never falls back to the compass line');
});

test('deriveWaitingOn: owner marker overrides even a real MERGE derivation (the marker is a forcing backstop, not a tiebreak) (AC3)', () => {
  const p = proj({
    specs: [{ id: '023-x', title: 'X', status: 'IN_PROGRESS', slices: [slice('slice-01-a.md', 'RECONCILED')] }],
  });
  const w = deriveWaitingOn(p, { state: 'REVIEW', action: 'owner override text' });
  assert.equal(w.state, 'REVIEW');
  assert.equal(w.action, 'owner override text');
});

test('mutation check: absent the marker, the same project derives its own signal unchanged (zero-config default) (AC3)', () => {
  const p = proj({
    specs: [{ id: '022-x', title: 'X', status: 'IN_PROGRESS', slices: [slice('slice-01-a.md', 'IN_PROGRESS')] }],
  });
  assert.equal(deriveWaitingOn(p).state, 'Ready', 'no marker present — falls through to the derived signal, not DECIDE');
});

// --- spec 009-04: gh-optional PR enrichment folded into deriveWaitingOn ---
// The pure function gains an OPTIONAL third arg (ownerLogin) and reads
// project.prs (drafts already filtered upstream in scanProject). PR signals
// fold into the existing precedence without reordering it. ownerLogin is the
// owner-identity guard: the REVIEW-from-PR and External-from-PR branches only
// fire when it is a non-empty string.

const OWNER = 'owner-login';

// A PR object shaped as scanProject attaches it (post-draft-filter).
function pr(number, { reviewDecision = '', mergeStateStatus = '', reviewRequests = [] } = {}) {
  return {
    number,
    title: `PR ${number}`,
    url: `https://example.test/pull/${number}`,
    author: { login: 'someone-else' },
    isDraft: false,
    reviewDecision,
    mergeStateStatus,
    reviewRequests,
  };
}

// Only PRs (no disk You-signal) so the PR branch is what's under test.
function prProj(prs) {
  return { specs: [{ id: '030-x', title: 'X', status: 'DRAFT', slices: [slice('slice-01-a.md', 'DONE')] }], prs };
}

test('deriveWaitingOn: MERGE from PR — approved + CLEAN fires rank-1 MERGE, action names the PR (009-04 AC1)', () => {
  const p = prProj([pr(7, { reviewDecision: 'APPROVED', mergeStateStatus: 'CLEAN' })]);
  const w = deriveWaitingOn(p, undefined, OWNER);
  assert.deepEqual(w, { state: 'MERGE', verb: 'MERGE', action: 'merge PR #7', rank: 1 });
});

test('deriveWaitingOn: MERGE from PR is author-agnostic — fires even with ownerLogin null (009-04 AC1)', () => {
  const p = prProj([pr(7, { reviewDecision: 'APPROVED', mergeStateStatus: 'CLEAN' })]);
  const w = deriveWaitingOn(p, undefined, null);
  assert.equal(w.state, 'MERGE');
  assert.equal(w.action, 'merge PR #7');
});

test('deriveWaitingOn: MERGE from PR — approved but BLOCKED/BEHIND/DIRTY/UNKNOWN does NOT qualify (009-04 AC1)', () => {
  for (const m of ['BLOCKED', 'BEHIND', 'DIRTY', 'UNKNOWN']) {
    const p = prProj([pr(7, { reviewDecision: 'APPROVED', mergeStateStatus: m })]);
    assert.notEqual(deriveWaitingOn(p, undefined, OWNER).state, 'MERGE', `${m} is not mergeable`);
  }
});

test('deriveWaitingOn: MERGE from PR — lowest-numbered qualifying PR chosen, deterministic (009-04 AC1)', () => {
  const p = prProj([
    pr(9, { reviewDecision: 'APPROVED', mergeStateStatus: 'CLEAN' }),
    pr(4, { reviewDecision: 'APPROVED', mergeStateStatus: 'CLEAN' }),
  ]);
  assert.equal(deriveWaitingOn(p, undefined, OWNER).action, 'merge PR #4');
});

test('deriveWaitingOn: a reconciled slice still wins MERGE deterministically when an approved PR also qualifies (009-04)', () => {
  const p = {
    specs: [{ id: '031-x', title: 'X', status: 'IN_PROGRESS', slices: [slice('slice-01-a.md', 'RECONCILED')] }],
    prs: [pr(7, { reviewDecision: 'APPROVED', mergeStateStatus: 'CLEAN' })],
  };
  const w = deriveWaitingOn(p, undefined, OWNER);
  assert.equal(w.state, 'MERGE');
  assert.equal(w.action, 'land 1 reconciled slice', 'reconciled-slice action is the deterministic winner');
});

test('deriveWaitingOn: REVIEW from PR — owner in reviewRequests fires rank-2 REVIEW, action names the PR (009-04 AC1)', () => {
  const p = prProj([pr(12, { reviewRequests: [{ login: OWNER }] })]);
  const w = deriveWaitingOn(p, undefined, OWNER);
  assert.deepEqual(w, { state: 'REVIEW', verb: 'REVIEW', action: 'review PR #12', rank: 2 });
});

test('deriveWaitingOn: REVIEW from PR — lowest-numbered owner-requested PR chosen (009-04)', () => {
  const p = prProj([
    pr(20, { reviewRequests: [{ login: OWNER }] }),
    pr(11, { reviewRequests: [{ login: OWNER }] }),
  ]);
  assert.equal(deriveWaitingOn(p, undefined, OWNER).action, 'review PR #11');
});

test('deriveWaitingOn: External — a non-owner reviewer, owner not among them, not MERGE-eligible → rank-6 External (009-04 AC1)', () => {
  const p = prProj([pr(5, { reviewRequests: [{ login: 'someone-else' }] })]);
  const w = deriveWaitingOn(p, undefined, OWNER);
  assert.deepEqual(w, { state: 'External', verb: 'EXTERNAL', action: 'PR #5 out for review', rank: 6 });
});

test('deriveWaitingOn: a TEAM-requested review (no login) yields NO External signal, falls through to disk state (009-04 A4′)', () => {
  // A review requested from a team carries no `.login`, so it cannot be keyed
  // to the owner — per assumption A4′ it must produce no PR signal rather than
  // a mis-filed External. Here the disk side is Idle, so the whole project is
  // Idle (not External).
  const p = prProj([pr(7, { reviewRequests: [{ __typename: 'Team', slug: 'reviewers' }] })]);
  const w = deriveWaitingOn(p, undefined, OWNER);
  assert.equal(w.state, 'Idle', 'a team-only review request is not filed as External (A4′)');
});

test('deriveWaitingOn: REGRESSION — owner IS the requested reviewer is REVIEW (You), never mis-filed as External (009-04 frame-critique blocker)', () => {
  // Both the owner and someone else are requested — the owner-present case
  // must resolve to REVIEW (rank 2), not External (rank 6).
  const p = prProj([pr(5, { reviewRequests: [{ login: 'someone-else' }, { login: OWNER }] })]);
  const w = deriveWaitingOn(p, undefined, OWNER);
  assert.equal(w.state, 'REVIEW');
  assert.equal(w.rank, 2);
});

test('deriveWaitingOn: owner-identity guard — ownerLogin null skips REVIEW-from-PR and External-from-PR, falls through to disk state (009-04)', () => {
  // An owner-review PR with no known owner login must NOT become External and
  // must NOT become REVIEW — it falls through to the disk-derived state.
  const p = {
    specs: [{ id: '032-x', title: 'X', status: 'DRAFT', slices: [slice('slice-01-a.md', 'DRAFT')] }],
    prs: [pr(5, { reviewRequests: [{ login: 'someone-else' }] })],
  };
  const w = deriveWaitingOn(p, undefined, null);
  assert.equal(w.state, 'Ready', 'falls through to the disk-derived Ready(start), never External/REVIEW without an owner login');
});

test('deriveWaitingOn: a PR matching none of the three contributes no signal — falls through to disk state (009-04 AC1)', () => {
  const p = {
    specs: [{ id: '033-x', title: 'X', status: 'IN_PROGRESS', slices: [slice('slice-01-a.md', 'IN_PROGRESS')] }],
    prs: [pr(5, { reviewDecision: 'CHANGES_REQUESTED', mergeStateStatus: 'DIRTY', reviewRequests: [] })],
  };
  assert.equal(deriveWaitingOn(p, undefined, OWNER).state, 'Ready', 'no PR bucket matches — disk Ready(resume) stands');
});

test('deriveWaitingOn: missing/empty project.prs is treated as no PR signal (009-04 backward-compat)', () => {
  const p = { specs: [{ id: '034-x', title: 'X', status: 'IN_PROGRESS', slices: [slice('slice-01-a.md', 'IN_PROGRESS')] }] };
  assert.equal(deriveWaitingOn(p, undefined, OWNER).state, 'Ready', 'no prs field — status quo');
  const p2 = { ...p, prs: [] };
  assert.equal(deriveWaitingOn(p2, undefined, OWNER).state, 'Ready');
});

test('deriveWaitingOn: two-arg call is still valid (backward-compatible signature) (009-04)', () => {
  const p = prProj([pr(7, { reviewDecision: 'APPROVED', mergeStateStatus: 'CLEAN' })]);
  // Without ownerLogin the third arg is undefined — MERGE (author-agnostic)
  // still fires; the two-arg contract 009-02 relied on is preserved.
  assert.equal(deriveWaitingOn(p, undefined).state, 'MERGE');
});

// --- spec 009-03: deriveWaitingStages — the full rank-ordered candidate list ---
// deriveWaitingOn is re-expressed as deriveWaitingStages(...)[0] ?? IDLE, so
// the tests below both exercise the new list AND pin non-regression: every
// 009-02 fixture above must still see deriveWaitingOn produce the SAME head.

test('deriveWaitingStages: a project with every candidate present returns them ALL, rank-ordered, not just the highest-precedence one (009-03 AC2/AC3)', () => {
  const p = proj({
    specs: [
      { id: '040-a', title: 'A', status: 'IN_PROGRESS', slices: [slice('slice-01-a.md', 'RECONCILED')] },
      { id: '041-b', title: 'B', status: 'IN_PROGRESS', slices: [slice('slice-01-a.md', 'REVIEWED')] },
      { id: '042-c', title: 'C', status: 'IN_PROGRESS', slices: [slice('slice-01-a.md', 'IN_PROGRESS')] },
      { id: '043-d', title: 'D', status: 'DRAFT', slices: [slice('slice-01-a.md', 'DRAFT')] },
    ],
    workstreams: [{ kind: 'runbook', items: [{ checked: false, text: 'decide something', owner: 'you' }], next: { text: 'decide something', owner: 'you' } }],
  });
  const stages = deriveWaitingStages(p);
  assert.deepEqual(stages, [
    { state: 'MERGE', verb: 'MERGE', action: 'land 1 reconciled slice', rank: 1 },
    { state: 'REVIEW', verb: 'REVIEW', action: 'review 1 finished slice', rank: 2 },
    { state: 'DECIDE', verb: 'DECIDE', action: 'decide something', rank: 3 },
    { state: 'Ready', verb: 'READY', action: 'resume 042-01', rank: 4 },
    { state: 'Ready', verb: 'READY', action: 'start 043-01', rank: 5 },
  ]);
});

test('deriveWaitingStages: a forced marker returns a SINGLE-element list, the forced state (009-03 AC1)', () => {
  const p = proj({ specs: [{ id: '044-x', title: 'X', status: 'IN_PROGRESS', slices: [slice('slice-01-a.md', 'RECONCILED')] }] });
  const stages = deriveWaitingStages(p, 'waiting on the vendor contract to be signed');
  assert.deepEqual(stages, [{ state: 'DECIDE', verb: 'DECIDE', action: 'waiting on the vendor contract to be signed', rank: 3 }]);
});

test('deriveWaitingStages: Idle (no candidate present) yields an empty list, not [Idle] (009-03 AC4)', () => {
  const p = proj({
    specs: [{ id: '045-x', title: 'X', status: 'DONE', slices: [slice('slice-01-a.md', 'DONE')] }],
    compass: { headline: 'all shipped', blockers: [] },
  });
  assert.deepEqual(deriveWaitingStages(p), []);
});

test('mutation check: dropping the "collect every candidate" refactor (returning on first match) would truncate the multi-stage list above to just [MERGE]', () => {
  const p = proj({
    specs: [
      { id: '040-a', title: 'A', status: 'IN_PROGRESS', slices: [slice('slice-01-a.md', 'RECONCILED')] },
      { id: '041-b', title: 'B', status: 'IN_PROGRESS', slices: [slice('slice-01-a.md', 'REVIEWED')] },
    ],
  });
  const stages = deriveWaitingStages(p);
  assert.equal(stages.length, 2, 'both MERGE and REVIEW candidates must be present, not just the first-found MERGE');
});

test('deriveWaitingStages: PR-derived stages fold into the full list so the action-queue surfaces them, not just the grid head (009-04 × 009-03)', () => {
  // A reconciled slice (MERGE), a PR the owner must review (REVIEW), and a PR
  // out for someone else (External) — all three PR/slice signals must appear as
  // distinct stages in the rank-ordered list, so 009-03's cross-project
  // action-queue shows PR work exactly like slice work. The grid head stays the
  // reconciled slice (deterministic rank-1 tiebreak).
  const p = {
    specs: [{ id: '046-x', title: 'X', status: 'IN_PROGRESS', slices: [slice('slice-01-a.md', 'RECONCILED')] }],
    prs: [
      pr(3, { reviewRequests: [{ login: OWNER }] }),
      pr(8, { reviewRequests: [{ login: 'someone-else' }] }),
    ],
  };
  const stages = deriveWaitingStages(p, undefined, OWNER);
  assert.deepEqual(stages, [
    { state: 'MERGE', verb: 'MERGE', action: 'land 1 reconciled slice', rank: 1 },
    { state: 'REVIEW', verb: 'REVIEW', action: 'review PR #3', rank: 2 },
    { state: 'External', verb: 'EXTERNAL', action: 'PR #8 out for review', rank: 6 },
  ]);
  // The grid still collapses to the head — the reconciled slice.
  assert.deepEqual(deriveWaitingOn(p, undefined, OWNER), stages[0]);
});

// Non-regression (DoD): deriveWaitingOn must be byte-identical to its
// pre-refactor output for every 009-02 state — re-run each fixture above
// through deriveWaitingStages(...)[0] and assert it deepEquals deriveWaitingOn's
// own return for the SAME payload.
const IDLE_STAGE = { state: 'Idle', verb: 'IDLE', action: '', rank: 7 };

function assertHeadMatchesDeriveWaitingOn(p, marker) {
  const stages = deriveWaitingStages(p, marker);
  assert.deepEqual(stages[0] ?? IDLE_STAGE, deriveWaitingOn(p, marker));
}

test('deriveWaitingOn non-regression: MERGE fixture head is byte-identical via deriveWaitingStages (009-03 DoD)', () => {
  const p = proj({ specs: [{ id: '011-owner-queue', title: 'X', status: 'IN_PROGRESS', slices: [slice('slice-01-a.md', 'RECONCILED')] }] });
  assertHeadMatchesDeriveWaitingOn(p);
});

test('deriveWaitingOn non-regression: REVIEW fixture head is byte-identical via deriveWaitingStages (009-03 DoD)', () => {
  const p = proj({ specs: [{ id: '012-x', title: 'X', status: 'IN_PROGRESS', slices: [slice('slice-01-a.md', 'REVIEWED')] }] });
  assertHeadMatchesDeriveWaitingOn(p);
});

test('deriveWaitingOn non-regression: DECIDE fixture head is byte-identical via deriveWaitingStages (009-03 DoD)', () => {
  const p = proj({
    specs: [{ id: '013-x', title: 'X', status: 'DRAFT', slices: [slice('slice-01-a.md', 'DRAFT')] }],
    workstreams: [{ kind: 'runbook', items: [{ checked: false, text: 'decide the currency-rounding rule', owner: 'you' }], next: { text: 'decide the currency-rounding rule', owner: 'you' } }],
  });
  assertHeadMatchesDeriveWaitingOn(p);
});

test('deriveWaitingOn non-regression: Ready(resume) fixture head is byte-identical via deriveWaitingStages (009-03 DoD)', () => {
  const p = proj({ specs: [{ id: '014-x', title: 'X', status: 'IN_PROGRESS', slices: [slice('slice-02-b.md', 'IN_PROGRESS')] }] });
  assertHeadMatchesDeriveWaitingOn(p);
});

test('deriveWaitingOn non-regression: Ready(start) fixture head is byte-identical via deriveWaitingStages (009-03 DoD)', () => {
  const p = proj({ specs: [{ id: '016-z', title: 'Z', status: 'DRAFT', slices: [slice('slice-01-a.md', 'DRAFT')] }] });
  assertHeadMatchesDeriveWaitingOn(p);
});

test('deriveWaitingOn non-regression: Idle fixture head is byte-identical via deriveWaitingStages (009-03 DoD)', () => {
  const p = proj({
    specs: [{ id: '017-x', title: 'X', status: 'DONE', slices: [slice('slice-01-a.md', 'DONE'), slice('slice-02-b.md', 'DEFERRED'), slice('slice-03-c.md', 'ABANDONED')] }],
    compass: { headline: 'all shipped', blockers: [] },
  });
  assertHeadMatchesDeriveWaitingOn(p);
});

test('deriveWaitingOn non-regression: forced marker head is byte-identical via deriveWaitingStages (009-03 DoD)', () => {
  const p = proj({ specs: [{ id: '022-x', title: 'X', status: 'IN_PROGRESS', slices: [slice('slice-01-a.md', 'IN_PROGRESS')] }] });
  assertHeadMatchesDeriveWaitingOn(p, 'waiting on the vendor contract to be signed');
});

// ===== Spec 012-01: roadmap tab — automatic order (scanner-side, pure) =====
import {
  currentReleaseTrack as libCurrentReleaseTrack,
  sliceNameFrom,
  deriveRoadmap,
  worktreeHint,
  parseRecencyLog,
  parseWorktreeList,
} from '../src/lib.mjs';

const sl = (file, status, deps = []) => ({ file, status, dependencies: deps });
const sp = (id, status, slices, recency = 0) => ({ id, title: id, status, slices, recency });
const ids = (r) => r.specs.map((s) => s.id);

test('012-01 AC3: currentReleaseTrack lives in lib — first release workstream with an incomplete goal, else null', () => {
  const p = {
    workstreams: [
      { kind: 'release', title: 'Old', goalProgress: { done: 3, total: 3 } },
      { kind: 'release', title: 'Current', goalProgress: { done: 1, total: 4 } },
    ],
  };
  assert.equal(libCurrentReleaseTrack(p).title, 'Current');
  assert.equal(libCurrentReleaseTrack({ workstreams: [{ kind: 'runbook' }] }), null);
  assert.equal(libCurrentReleaseTrack({}), null);
});

test('012-01 AC2: sliceNameFrom reads the "## Slice NNN-NN — name" heading, falls back to the filename stem (A1)', () => {
  assert.equal(sliceNameFrom('# x\n\n## Slice 012-01 — roadmap tab with automatic order\n\nbody', 'slice-01-roadmap.md'), 'roadmap tab with automatic order');
  assert.equal(sliceNameFrom('## Slice 3 - hyphen name  \n', 'slice-03-x.md'), 'hyphen name');
  assert.equal(sliceNameFrom('no heading here', 'slice-02-thing-one.md'), 'slice-02-thing-one');
  assert.equal(sliceNameFrom('', 'slice-02-thing-one.md'), 'slice-02-thing-one');
});

test('012-01 AC3 rule: status-less slice-*.md is ignored (no card, no effect on order)', () => {
  const r = deriveRoadmap({ specs: [sp('001-a', 'DONE', [sl('slice-01-a.md', 'DONE'), sl('slice-02-evidence.md', null)])] });
  assert.equal(r.specs.length, 0);
  assert.equal(r.done.length, 1, 'the evidence note must not make a finished spec look unfinished');
});

test('012-01 AC3 rule: unfinished = any slice not DONE/DEFERRED/ABANDONED; spec with no slices unfinished unless DONE/ABANDONED', () => {
  const r = deriveRoadmap({
    specs: [
      sp('001-a', 'IN_PROGRESS', [sl('slice-01-a.md', 'DONE'), sl('slice-02-b.md', 'DEFERRED'), sl('slice-03-c.md', 'ABANDONED')]),
      sp('002-b', 'DRAFT', []),
      sp('003-c', 'DONE', []),
      sp('004-d', 'ABANDONED', []),
      sp('005-e', 'DRAFT', [sl('slice-01-x.md', 'DRAFT')]),
    ],
  });
  assert.deepEqual(ids(r), ['002-b', '005-e']);
  assert.deepEqual(r.done.map((s) => s.id), ['001-a', '003-c'], 'deferred tail folds as done; ABANDONED spec is not shown');
});

test('012-01 AC3 rule: release-first, then tier (in flight > started > not started), then recency, then number', () => {
  const specs = [
    sp('001-draft-old', 'DRAFT', [sl('slice-01-a.md', 'DRAFT')], 100),
    sp('002-draft-new', 'DRAFT', [sl('slice-01-a.md', 'DRAFT')], 900),
    sp('003-started', 'IN_PROGRESS', [sl('slice-01-a.md', 'DONE'), sl('slice-02-b.md', 'READY_FOR_REVIEW')], 50),
    sp('004-flight', 'IN_PROGRESS', [sl('slice-01-a.md', 'REVIEWED')], 10),
    sp('005-release', 'DRAFT', [sl('slice-01-a.md', 'DRAFT')], 1),
    sp('006-tie-a', 'DRAFT', [sl('slice-01-a.md', 'DRAFT')], 900),
  ];
  const track = { title: 'R1', kind: 'release', includeTokens: ['005-01'], goalProgress: { done: 0, total: 1 } };
  const r = deriveRoadmap({ specs, track });
  // release spec first; in flight; started; then drafts newest-first, equal recency by number
  assert.deepEqual(ids(r), ['005-release', '004-flight', '003-started', '002-draft-new', '006-tie-a', '001-draft-old']);
});

test('012-01 AC3 rule: no release → tier/recency alone; missing recency sorts last', () => {
  const r = deriveRoadmap({
    specs: [
      sp('001-a', 'DRAFT', [sl('slice-01-a.md', 'DRAFT')], null),
      sp('002-b', 'DRAFT', [sl('slice-01-a.md', 'DRAFT')], 5),
    ],
  });
  assert.deepEqual(ids(r), ['002-b', '001-a']);
});

test('012-01 AC3 rule: tier boundaries — RECONCILED is in flight, READY_FOR_IMPLEMENTATION is started', () => {
  const r = deriveRoadmap({
    specs: [
      sp('001-a', 'DRAFT', [sl('slice-01-a.md', 'READY_FOR_IMPLEMENTATION')], 999),
      sp('002-b', 'DRAFT', [sl('slice-01-a.md', 'RECONCILED')], 1),
    ],
  });
  assert.deepEqual(r.specs.map((s) => [s.id, s.tier]), [['002-b', 'in-flight'], ['001-a', 'started']]);
});

test('012-01 AC3 rule: in-spec dependency order, ties by slice number; DEFERRED/ABANDONED slices excluded from the cards', () => {
  const r = deriveRoadmap({
    specs: [
      sp('010-x', 'IN_PROGRESS', [
        sl('slice-01-a.md', 'DRAFT', ['010-03']),
        sl('slice-02-b.md', 'DRAFT'),
        sl('slice-03-c.md', 'DRAFT'),
        sl('slice-04-d.md', 'DEFERRED'),
        sl('slice-05-e.md', 'ABANDONED'),
      ]),
    ],
  });
  assert.deepEqual(r.specs[0].slices.map((c) => c.id), ['010-02', '010-03', '010-01']);
});

test('012-01 AC3 rule: dependency cycle falls back to slice number', () => {
  const r = deriveRoadmap({
    specs: [
      sp('010-x', 'IN_PROGRESS', [
        sl('slice-01-a.md', 'DRAFT', ['010-02']),
        sl('slice-02-b.md', 'DRAFT', ['010-01']),
        sl('slice-03-c.md', 'DRAFT'),
      ]),
    ],
  });
  assert.deepEqual(r.specs[0].slices.map((c) => c.id), ['010-01', '010-02', '010-03']);
});

test('012-01 AC3/AC6 rule: cross-spec and adr-* dependencies do not affect order but are listed in dependsOn', () => {
  const r = deriveRoadmap({
    specs: [
      sp('010-x', 'IN_PROGRESS', [
        sl('slice-01-a.md', 'DRAFT', ['011-01', 'adr-0004', '010-02']),
        sl('slice-02-b.md', 'DRAFT'),
      ]),
      sp('011-y', 'DRAFT', [sl('slice-01-a.md', 'DRAFT')]),
    ],
  });
  const x = r.specs.find((s) => s.id === '010-x');
  assert.deepEqual(x.slices.map((c) => c.id), ['010-02', '010-01']);
  assert.deepEqual(x.slices.find((c) => c.id === '010-01').dependsOn, ['011-01', 'adr-0004', '010-02']);
});

test('012-01 AC6: cards carry id, name, status and chip per the chip table', () => {
  const statuses = ['DONE', 'IN_PROGRESS', 'REVIEWED', 'RECONCILED', 'DRAFT', 'READY_FOR_REVIEW', 'READY_FOR_IMPLEMENTATION'];
  const want = ['Done', 'In progress', 'In progress', 'In progress', 'Planned', 'Planned', 'Planned'];
  const slices = statuses.map((s, i) => ({ ...sl(`slice-0${i + 1}-s.md`, s), name: `name ${i + 1}` }));
  const r = deriveRoadmap({ specs: [sp('020-z', 'IN_PROGRESS', slices)] });
  const cards = r.specs[0].slices;
  assert.deepEqual(cards.map((c) => c.chip), want);
  assert.equal(cards[0].name, 'name 1');
  assert.equal(cards[0].id, '020-01');
  assert.equal(cards[0].status, 'DONE');
});

test('012-01 AC3/AC5: release block lists Include slices with chips (incl. parked and unwritten tokens)', () => {
  const specs = [
    sp('005-a', 'IN_PROGRESS', [
      { ...sl('slice-01-a.md', 'DONE'), name: 'first' },
      { ...sl('slice-02-b.md', 'DEFERRED'), name: 'second' },
    ]),
  ];
  const track = { title: 'Ship it', kind: 'release', includeTokens: ['005-01', '005-02', '005-09'], goalProgress: { done: 1, total: 2 } };
  const r = deriveRoadmap({ specs, track });
  assert.equal(r.release.title, 'Ship it');
  assert.deepEqual(r.release.slices.map((c) => [c.id, c.chip]), [['005-01', 'Done'], ['005-02', 'Parked'], ['005-09', 'Planned']]);
  assert.equal(r.release.slices[2].name, 'not written yet');
  assert.equal(deriveRoadmap({ specs }).release, null);
});

test('012-01 AC4: sequence strip — release first, next two ordered specs, "N parked" last; We-are-here only for release/in-flight/started', () => {
  const specs = [
    sp('001-a', 'DRAFT', [sl('slice-01-a.md', 'IN_PROGRESS'), sl('slice-02-b.md', 'DEFERRED')], 9),
    sp('002-b', 'DRAFT', [sl('slice-01-a.md', 'DRAFT')], 8),
    sp('003-c', 'DRAFT', [sl('slice-01-a.md', 'DRAFT')], 7),
    sp('004-d', 'DRAFT', [sl('slice-01-a.md', 'DRAFT')], 6),
  ];
  const r = deriveRoadmap({ specs });
  assert.deepEqual(r.sequence.map((s) => s.kind), ['spec', 'spec', 'spec', 'parked']);
  assert.equal(r.sequence[0].label, 'Now · We are here');
  assert.equal(r.sequence[0].id, '001-a');
  assert.equal(r.sequence[3].label, '1 parked');
  assert.equal(r.sequence.length, 4);

  const withRelease = deriveRoadmap({ specs, track: { title: 'R', kind: 'release', includeTokens: ['003-01'], goalProgress: { done: 0, total: 1 } } });
  assert.deepEqual(withRelease.sequence.map((s) => s.kind), ['release', 'spec', 'spec', 'parked']);
  assert.equal(withRelease.sequence[0].label, 'Now · We are here');
  // steps 2-3 skip every spec the release covers (003-c), labelled "Then"
  assert.deepEqual(withRelease.sequence.map((s) => s.id), [undefined, '001-a', '002-b', undefined]);
  assert.deepEqual(withRelease.sequence.map((s) => s.label), ['Now · We are here', 'Then', 'Then', '1 parked']);
  assert.deepEqual(r.sequence.map((s) => s.label), ['Now · We are here', 'Then', 'Then', '1 parked'], 'no-release path labels steps 2-3 "Then" too');
});

test('012-01 AC4: with a release, fewer than two specs outside it → a shorter strip; every release-covered spec is skipped', () => {
  const specs = [
    sp('001-a', 'DRAFT', [sl('slice-01-a.md', 'DRAFT')], 9),
    sp('002-b', 'DRAFT', [sl('slice-01-a.md', 'DRAFT')], 8),
    sp('003-c', 'DRAFT', [sl('slice-01-a.md', 'DRAFT')], 7),
  ];
  const track = { title: 'R', kind: 'release', includeTokens: ['001-01', '003-01'], goalProgress: { done: 0, total: 2 } };
  const r = deriveRoadmap({ specs, track });
  assert.deepEqual(r.sequence.map((s) => [s.kind, s.id]), [['release', undefined], ['spec', '002-b']]);
  const all = deriveRoadmap({ specs, track: { ...track, includeTokens: ['001-01', '002-01', '003-01'] } });
  assert.deepEqual(all.sequence.map((s) => s.kind), ['release']);
});

test('012-01 AC4: first step is "Next up" when the first spec is not started; fewer steps when fewer exist', () => {
  const r = deriveRoadmap({ specs: [sp('001-a', 'DRAFT', [sl('slice-01-a.md', 'DRAFT')])] });
  assert.equal(r.sequence.length, 1);
  assert.equal(r.sequence[0].label, 'Next up');
  assert.deepEqual(deriveRoadmap({ specs: [] }).sequence, []);
});

test('012-01 AC8: empty states — no specs vs only DONE specs', () => {
  assert.equal(deriveRoadmap({ specs: [] }).empty, 'no-specs');
  assert.equal(deriveRoadmap({ specs: [sp('001-a', 'DONE', [sl('slice-01-a.md', 'DONE')])] }).empty, 'nothing-planned');
  assert.equal(deriveRoadmap({ specs: [sp('001-a', 'DRAFT', [sl('slice-01-a.md', 'DRAFT')])] }).empty, null);
});

test('012-01 AC7: DONE specs are listed separately for the fold', () => {
  const r = deriveRoadmap({ specs: [sp('001-a', 'DONE', [sl('slice-01-a.md', 'DONE')]), sp('002-b', 'DRAFT', [sl('slice-01-a.md', 'DRAFT')])] });
  assert.deepEqual(r.done.map((s) => s.id), ['001-a']);
  assert.deepEqual(ids(r), ['002-b']);
});

test('012-01 AC10: asOf reports the root branch', () => {
  assert.equal(deriveRoadmap({ specs: [], branch: 'main' }).asOf, 'main');
  assert.equal(deriveRoadmap({ specs: [], branch: 'feature-x' }).asOf, 'feature-x');
  assert.equal(deriveRoadmap({ specs: [] }).asOf, null);
});

// --- AC10 worktree hint ---
const wtSpec = (id, slices) => ({ id, slices });
const root10 = [sp('001-a', 'IN_PROGRESS', [sl('slice-01-a.md', 'DONE'), sl('slice-02-b.md', 'DRAFT'), sl('slice-03-c.md', 'DRAFT')])];

test('012-01 AC10: worktree at root HEAD with an uncommitted IN_PROGRESS slice → N >= 1', () => {
  const h = worktreeHint(root10, [[wtSpec('001-a', [sl('slice-01-a.md', 'DONE'), sl('slice-02-b.md', 'IN_PROGRESS'), sl('slice-03-c.md', 'DRAFT')])]]);
  assert.deepEqual(h, { further: 1, onlyInWorktrees: 0 });
});

test('012-01 AC10: stale worktree holding DRAFT where root has DONE is not counted', () => {
  const h = worktreeHint(root10, [[wtSpec('001-a', [sl('slice-01-a.md', 'DRAFT')])]]);
  assert.deepEqual(h, { further: 0, onlyInWorktrees: 0 });
});

test('012-01 AC10: highest worktree status wins, each slice counted once across worktrees', () => {
  const a = [wtSpec('001-a', [sl('slice-02-b.md', 'READY_FOR_REVIEW')])];
  const b = [wtSpec('001-a', [sl('slice-02-b.md', 'REVIEWED')])];
  assert.deepEqual(worktreeHint(root10, [a, b]).further, 1);
  // equal rank is not "further along"
  assert.equal(worktreeHint(root10, [[wtSpec('001-a', [sl('slice-02-b.md', 'DRAFT')])]]).further, 0);
});

test('012-01 AC10: DEFERRED and ABANDONED never count as further along', () => {
  const h = worktreeHint(root10, [[wtSpec('001-a', [sl('slice-02-b.md', 'DEFERRED'), sl('slice-03-c.md', 'ABANDONED')])]]);
  assert.equal(h.further, 0);
});

test('012-01 AC10: slices only in a worktree inside a root spec folder add to N; spec folders absent from root go to M', () => {
  const h = worktreeHint(root10, [
    [wtSpec('001-a', [sl('slice-09-new.md', 'DRAFT')]), wtSpec('002-new', [sl('slice-01-x.md', 'DRAFT')])],
    [wtSpec('002-new', [sl('slice-01-x.md', 'DRAFT')]), wtSpec('003-newer', [])],
  ]);
  assert.deepEqual(h, { further: 1, onlyInWorktrees: 2 });
});

test('012-01 AC10: a DEFERRED/ABANDONED slice that exists only in a worktree is not "further along" either; a new slice in two worktrees counts once', () => {
  const onlyParked = worktreeHint(root10, [[wtSpec('001-a', [sl('slice-09-n.md', 'DEFERRED'), sl('slice-10-n.md', 'ABANDONED')])]]);
  assert.equal(onlyParked.further, 0);
  const dup = [wtSpec('001-a', [sl('slice-09-n.md', 'DRAFT')])];
  assert.equal(worktreeHint(root10, [dup, dup]).further, 1);
});

test('012-01 AC10: status-less worktree slice files are ignored; no cap on counts', () => {
  assert.deepEqual(worktreeHint(root10, [[wtSpec('001-a', [sl('slice-09-evidence.md', null)])]]), { further: 0, onlyInWorktrees: 0 });
  const many = Array.from({ length: 60 }, (_, i) => sl(`slice-${String(i + 10).padStart(2, '0')}-n.md`, 'DRAFT'));
  assert.equal(worktreeHint(root10, [[wtSpec('001-a', many)]]).further, 60);
});

test('012-01 AC10: deriveRoadmap carries the hint', () => {
  const r = deriveRoadmap({ specs: root10, worktrees: [[wtSpec('001-a', [sl('slice-02-b.md', 'IN_PROGRESS')])]] });
  assert.deepEqual(r.worktreeHint, { further: 1, onlyInWorktrees: 0 });
  assert.equal(deriveRoadmap({ specs: root10 }).worktreeHint, null, 'both zero → no hint');
});

// --- AC11 helpers: one-pass recency parse, worktree list parse ---
test('012-01 AC11: parseRecencyLog maps one `git log --name-only` pass to per-spec-directory newest timestamps', () => {
  const out = '1700000300\n\ndocs/specs/001-a/spec.md\ndocs/specs/002-b/slice-01-x.md\n\n1700000200\n\ndocs/specs/001-a/slice-01-x.md\ndocs/specs/README.md\n\n1700000100\n\ndocs/specs/003-c/spec.md\n';
  const m = parseRecencyLog(out);
  assert.equal(m.get('001-a'), 1700000300);
  assert.equal(m.get('002-b'), 1700000300);
  assert.equal(m.get('003-c'), 1700000100);
  assert.equal(m.has('README.md'), false);
});

test('012-01 AC10: parseWorktreeList finds the root branch and the non-root worktree paths', () => {
  const out = 'worktree /r/main\nHEAD abc\nbranch refs/heads/main\n\nworktree /r/main/.claude/worktrees/w1\nHEAD def\nbranch refs/heads/feat\n\nworktree /r/other\nHEAD 123\ndetached\n\n';
  const r = parseWorktreeList(out, '/r/main');
  assert.equal(r.branch, 'main');
  assert.deepEqual(r.others, ['/r/main/.claude/worktrees/w1', '/r/other']);
  assert.equal(r.rootListed, true);
  const other = parseWorktreeList(out, '/elsewhere');
  assert.equal(other.branch, null);
  assert.equal(other.rootListed, false);
});

// ===== Spec 012-02: slice goal / trigger extraction + parked list =====
test('012-02 AC1: goal = first sentence of the **Goal:** paragraph, plain text', () => {
  const body = '## Slice 001-01 — x\n\n**Goal:** Add the **fast** path via [the docs](http://x.test) and `render()`. Then do more.\n\n**DoR:**\n';
  assert.equal(extractSliceGoal(body), 'Add the fast path via the docs and render()…');
});

test('012-02 AC1: a single-sentence goal keeps its full text, no ellipsis', () => {
  assert.equal(extractSliceGoal('**Goal:** Ship it.\n\nnext'), 'Ship it.');
});

test('012-02 AC1: **Goal (…):** is the fallback; plain **Goal:** wins when both exist', () => {
  assert.equal(extractSliceGoal('**Goal (deferred):** Park the idea.\n'), 'Park the idea.');
  assert.equal(extractSliceGoal('**Goal (deferred):** Wrong one.\n\n**Goal:** Right one.\n'), 'Right one.');
});

test('012-02 AC1: goal spanning wrapped lines is joined; absent goal -> null', () => {
  assert.equal(extractSliceGoal('**Goal:** First half\nsecond half.\n\nx'), 'First half second half.');
  assert.equal(extractSliceGoal('## Slice 1 — x\n\nno goal here\n'), null);
  assert.equal(extractSliceGoal(''), null);
  assert.equal(extractSliceGoal(undefined), null);
});

test('012-02 AC2: sentence split ignores abbreviations, filenames and versions', () => {
  assert.equal(
    extractSliceGoal('**Goal:** Handle inputs, e.g. a name, i.e. a label, in `server.mjs` for v0.6.0 users. Second sentence.'),
    'Handle inputs, e.g. a name, i.e. a label, in server.mjs for v0.6.0 users…',
  );
});

test('012-02 AC2: an abbreviation dot followed by a capital still does not split', () => {
  assert.equal(extractSliceGoal('**Goal:** Support e.g. Alpha and i.e. Beta inputs. Extra.'), 'Support e.g. Alpha and i.e. Beta inputs…');
});

test('012-02 AC2: trigger = whole paragraph up to blank line, wraps joined, never cut to one sentence', () => {
  const body = '**Resolution trigger:** Revisit when A lands. Or when B\nlands too.\n\n**Goal:** g\n';
  assert.equal(extractSliceTrigger(body), 'Revisit when A lands. Or when B lands too.');
});

test('012-02 AC2: trigger paragraph stops at heading, list item, or next bold label', () => {
  assert.equal(extractSliceTrigger('**Resolution trigger:** one\n## Heading\nmore'), 'one');
  assert.equal(extractSliceTrigger('**Resolution trigger:** one\n- item\n'), 'one');
  assert.equal(extractSliceTrigger('**Resolution trigger:** one\n1. item\n'), 'one');
  assert.equal(extractSliceTrigger('**Resolution trigger:** one\n**DoR:** other\n'), 'one');
  assert.equal(extractSliceTrigger('**Resolution trigger:**\ntwo lines\nhere\n\nx'), 'two lines here');
});

test('012-02 AC2: absent trigger -> null (never guessed)', () => {
  assert.equal(extractSliceTrigger('**Goal:** g\n'), null);
  assert.equal(extractSliceTrigger('**Resolution trigger:**\n\nx'), null);
});

test('012-02 AC2: over-cap text is cut with an ellipsis within the cap; under-cap is untouched', () => {
  const long = 'word '.repeat(400).trim();
  const g = extractSliceGoal(`**Goal:** ${long}.`);
  assert.ok(g.length <= TEXT_CAP, `goal length ${g.length}`);
  assert.ok(g.endsWith('…'));
  const t = extractSliceTrigger(`**Resolution trigger:** ${long}`);
  assert.ok(t.length <= TEXT_CAP);
  assert.ok(t.endsWith('…'));
  const exact = 'x'.repeat(TEXT_CAP - 10);
  assert.equal(extractSliceTrigger(`**Resolution trigger:** ${exact}`), exact);
});

test('012-02 AC3: roadmap.parked lists every DEFERRED slice across specs (done specs too), skips ABANDONED specs; parkedCount equals its length', () => {
  const sp = (id, status, slices) => ({ id, title: id, status, recency: 1, slices });
  const sl = (file, status, extra = {}) => ({ file, status, name: file, dependencies: [], ...extra });
  const r = deriveRoadmap({
    specs: [
      sp('001-a', 'IN_PROGRESS', [sl('slice-01-x.md', 'IN_PROGRESS'), sl('slice-02-y.md', 'DEFERRED', { goal: 'G', trigger: 'T' })]),
      sp('002-b', 'DONE', [sl('slice-01-x.md', 'DONE'), sl('slice-03-z.md', 'DEFERRED')]),
      sp('003-c', 'ABANDONED', [sl('slice-01-x.md', 'DEFERRED')]),
      sp('004-d', 'DRAFT', [sl('slice-01-x.md', 'ABANDONED'), sl('slice-02-n.md', null)]),
    ],
  });
  assert.deepEqual(r.parked.map((c) => c.id), ['001-02', '002-03']);
  assert.equal(r.parked[0].chip, 'Parked');
  assert.equal(r.parked[0].goal, 'G');
  assert.equal(r.parked[0].trigger, 'T');
  assert.equal(r.parkedCount, r.parked.length);
  assert.ok(r.sequence.some((s) => s.kind === 'parked' && s.label === '2 parked'));
});

test('012-02 AC1: cards carry goal (null when absent); only parked cards carry trigger', () => {
  const r = deriveRoadmap({
    specs: [{ id: '001-a', title: 'a', status: 'IN_PROGRESS', recency: 1, slices: [{ file: 'slice-01-x.md', status: 'IN_PROGRESS', name: 'x', dependencies: [], goal: 'Do it.' }, { file: 'slice-02-y.md', status: 'DRAFT', name: 'y', dependencies: [] }] }],
  });
  assert.equal(r.specs[0].slices[0].goal, 'Do it.');
  assert.equal(r.specs[0].slices[1].goal, null);
  assert.ok(!('trigger' in r.specs[0].slices[0]), 'non-parked cards carry no trigger');
});

test('012-02 AC2: a wrapped line starting with bold emphasis (no label colon) continues the paragraph', () => {
  assert.equal(extractSliceGoal('**Goal:** Add the\n**fast** path.\n\nx'), 'Add the fast path.');
  assert.equal(extractSliceTrigger('**Resolution trigger:** Wait for\n**X** to land.\n'), 'Wait for X to land.');
  assert.equal(extractSliceTrigger('**Resolution trigger:** one\n**Goal (deferred):** other\n'), 'one');
});

test('012-02 AC2: a cut sentence ending in ? or ! keeps it, only a trailing "." is dropped before the ellipsis', () => {
  assert.equal(extractSliceGoal('**Goal:** Why wait? Because.'), 'Why wait?…');
  assert.equal(extractSliceGoal('**Goal:** Ship now! Then rest.'), 'Ship now!…');
  assert.equal(extractSliceGoal('**Goal:** Do it. Then rest.'), 'Do it…');
});

test('012-02 AC3: parked cards are ordered by spec number then in-spec order, whatever order specs arrive in', () => {
  const sl = (file) => ({ file, status: 'DEFERRED', name: file, dependencies: [] });
  const sp = (id, slices) => ({ id, title: id, status: 'DONE', recency: 1, slices });
  const r = deriveRoadmap({ specs: [sp('010-z', [sl('slice-01-a.md')]), sp('002-b', [sl('slice-02-b.md'), sl('slice-01-a.md')]), sp('003-c', [sl('slice-01-a.md')])] });
  assert.deepEqual(r.parked.map((c) => c.id), ['002-01', '002-02', '003-01', '010-01']);
});

test('012-02 AC1: code spans keep their underscores and asterisks', () => {
  assert.equal(extractSliceGoal('**Goal:** Rename `__init__` and `a*b*c` safely.'), 'Rename __init__ and a*b*c safely.');
});
