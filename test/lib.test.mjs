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
