// Spec 009-01: pure render helpers for the overview triage rows + per-project
// detail view. Shared, unmodified, between the browser (public/index.html
// imports this via <script type="module">, served by src/server.mjs at
// /render.mjs) and node:test (test/render.test.mjs imports it directly).
//
// Every function here is pure: it takes already-scanned project payload
// shapes (the objects scanProject/scanAll emit) and returns HTML strings or
// derived values. No DOM, no fetch, no fs — that is what makes this testable
// under plain node:test with no jsdom (ADR-0001; plan.md "Testability
// decision").
//
// Scope note (009-02): this file now READS the `waitingOn` field 009-02 adds
// to the payload (computed scan-side by src/lib.mjs's deriveWaitingOn — see
// the taxonomy pinned in docs/specs/009-overview-redesign/
// slice-02-waiting-on-state-and-ordering.md) and renders it as the row
// headline (overviewRow) plus orders the grid by its rank
// (sortProjectsByWaitingOn). It still never DERIVES the state itself and
// still never imports src/lib.mjs — the browser has no route there; that
// boundary is the reason 009-02 carries `arch_review: true`.
// 009-03 (cross-project action-queue lens) widens the same discipline: it
// READS the sibling `waitingStages` field (the full rank-ordered list
// `waitingOn` collapses to its head) and renders the grouped queue
// (actionQueue/actionQueueRow/actionQueueGroup/actionQueueHtml) plus the
// lens-toggle state (setLens) — still never deriving, still never importing
// src/lib.mjs.

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function shorten(s, n) {
  s = String(s ?? '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// Mirrors src/lib.mjs's relativeTime (spec 003-01 AC8) — duplicated rather
// than imported because the browser has no route to src/lib.mjs (only
// public/ is served); see the same precedent/comment this file replaces in
// index.html's previous inline script.
export function relativeTime(ts, now = Date.now()) {
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return null;
  const diffMs = now - t;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

// Mirrors src/lib.mjs's sessionCounts (003-02 AC3/AC4/AC6) — same duplication
// rationale as relativeTime above.
export function sessionCounts(p) {
  const sessions = p.sessions || [];
  const activeCount = sessions.filter((s) => s.active === true).length;
  const olderCount = sessions.length - activeCount;
  const total = p.sessionsTotal ?? sessions.length;
  const overflowCount = Math.max(0, total - sessions.length);
  return { activeCount, olderCount, overflowCount };
}

// --- "in flight" heat figure (AC2) ---
// Open fronts = in-progress specs + active sessions + worktree-only docs.
// A presentation-only figure — carries no waiting-on/triage meaning (AC7).
export function inFlightCount(p) {
  const inProgressSpecs = (p.specs || []).filter((s) => s.status === 'IN_PROGRESS').length;
  const activeSessions = (p.sessions || []).filter((s) => s.active === true).length;
  const worktreeDocs = (p.worktreeOnlyDocs || []).length;
  return inProgressSpecs + activeSessions + worktreeDocs;
}

// Bucket thresholds are an implementer judgment call — the redline names the
// four buckets (clear/light/busy/hot) and shows sparse examples (0→clear,
// 1-2→light, 5→busy, 6 and 10→hot) but states no exact cutoffs. These
// thresholds reproduce every example in console-overview.render.png exactly;
// flag for the design-review pass if a finer cutline is wanted.
export function heatBucket(count) {
  if (count <= 0) return 'clear';
  if (count <= 2) return 'light';
  if (count <= 5) return 'busy';
  return 'hot';
}

// --- inline-SVG charts (AC3 — zero-dep, no chart library) ---
export function progressBarSvg(pct, { w = 118, h = 4 } = {}) {
  const p = Math.max(0, Math.min(100, pct ?? 0));
  const fillColor = p >= 100 ? 'var(--green)' : 'var(--blue)';
  const fillW = Math.round((w * p) / 100);
  return (
    `<svg class="pbar" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${p}%">` +
    `<rect x="0" y="0" width="${w}" height="${h}" rx="2" fill="var(--track)"></rect>` +
    `<rect x="0" y="0" width="${fillW}" height="${h}" rx="2" fill="${fillColor}"></rect>` +
    `</svg>`
  );
}

function flightCellsSvg(count) {
  const bucket = heatBucket(count);
  const filled = Math.max(0, Math.min(6, count));
  const cellW = 11;
  const cellH = 5;
  const gap = 3;
  let cells = '';
  for (let i = 0; i < 6; i++) {
    const x = i * (cellW + gap);
    const fill = i < filled ? `var(--heat-${bucket})` : 'var(--inset)';
    cells += `<rect x="${x}" y="0" width="${cellW}" height="${cellH}" rx="1" fill="${fill}"></rect>`;
  }
  const totalW = 6 * cellW + 5 * gap;
  return `<svg class="flight-cells" width="${totalW}" height="${cellH}" viewBox="0 0 ${totalW} ${cellH}" aria-hidden="true">${cells}</svg>`;
}

// --- counts-line (detail view) ---
export function countsLine(p) {
  const by = (p.progress && p.progress.by) || {};
  const done = by.DONE || 0;
  const inProgress = by.IN_PROGRESS || 0;
  const draft = by.DRAFT || 0;
  const total = p.progress ? p.progress.total : 0;
  const bugs = (p.counts && p.counts.bugs && p.counts.bugs.open) || 0;
  const deferred = (p.counts && p.counts.refinement && p.counts.refinement.open) || 0;
  const inbox = (p.counts && p.counts.inbox) || 0;
  return [
    `${done} done`,
    `${inProgress} in progress`,
    `${draft} draft`,
    `${total} spec${total === 1 ? '' : 's'}`,
    `${bugs} open bug${bugs === 1 ? '' : 's'}`,
    `${deferred} deferred`,
    `${inbox} inbox`,
  ].join(' · ');
}

// --- current-release-track determination (A-009-01) ---
// Probed this repo for an explicit current/active marker convention inside a
// real shaper release-plan markdown file: none exists on disk (grep across
// docs/, 2026-08-31) — the mockup's `current: true` is synthetic design data,
// not a markdown-authoring convention. So this implements ONLY the A-009-01
// fallback: the release-kind workstream whose goalProgress is incomplete,
// first in file (i.e. emitted workstreams array) order. No release
// workstream, no goalProgress anywhere, or all goals already 100% →
// null (no current track determinable) — callers must degrade to the full
// spec list, never crash.
export function currentReleaseTrack(p) {
  const workstreams = p.workstreams || [];
  for (const w of workstreams) {
    if (w.kind === 'release' && w.goalProgress && w.goalProgress.done < w.goalProgress.total) {
      return w;
    }
  }
  return null;
}

function currentTrackSpecIds(p) {
  const track = currentReleaseTrack(p);
  if (!track || !Array.isArray(track.memberSpecIds) || !track.memberSpecIds.length) return null;
  return track.memberSpecIds;
}

// Spec list for the detail view (AC5): defaults to the current release
// track's member specs; `showAll` (the "show all N specs" control) or "no
// track determinable" both degrade to the full list — never a crash, never
// an empty list standing in for "no track".
//
// A release track with an empty/missing memberSpecIds is treated as "no
// current-track filtering available" (trackTitle null, no toggle rendered) —
// distinct from a real track whose member list is just temporarily fully
// shown via `showAll` (trackTitle stays set there, so the toggle can flip
// back). Conflating the two used to render a "show current track" toggle
// whose click was a no-op (follow-up fix to 009-01).
export function detailSpecList(p, { showAll = false } = {}) {
  const all = p.specs || [];
  const track = currentReleaseTrack(p);
  const trackIds = currentTrackSpecIds(p);
  if (!trackIds) {
    return { specs: all, filtered: false, trackTitle: null, total: all.length };
  }
  if (showAll) {
    return { specs: all, filtered: false, trackTitle: track.title, total: all.length };
  }
  const idSet = new Set(trackIds);
  return { specs: all.filter((s) => idSet.has(s.id)), filtered: true, trackTitle: track.title, total: all.length };
}

// --- 009-02 AC1: waiting-on headline (the next-move column's new content) ---
// A non-Idle waiting-on state with a real action REPLACES the plain compass
// line with "<VERB> <action>" — the card's headline (AC1). Idle, or a
// project with no `waitingOn` at all (a hand-built/legacy payload — real
// scanProject output always carries it), degrades to the exact pre-009-02
// compass-headline display: Idle is deliberately the quiet, badge-free state
// (AC1 "Idle renders quietest"), not a hollow phrase to suppress.
function nextMoveCell(p) {
  const w = p.waitingOn;
  if (w && w.state !== 'Idle' && w.action) {
    return (
      // `w.state` doubles as the CSS class suffix here (`rv-${state}`) —
      // renaming a state (e.g. deriveWaitingOn's 'Ready') must stay in sync
      // with the matching `.rv-*` selectors in public/index.html.
      `<span class="row-verb rv-${esc(w.state)}">${esc(w.verb)}</span>` +
      `<span class="row-action">${esc(w.action)}</span>`
    );
  }
  const nextLine = (p.compass && (p.compass.headline || p.compass.next)) || 'no compass snapshot yet';
  return `<span class="row-action">${esc(shorten(nextLine, 140))}</span>`;
}

// --- 009-02 AC2: finish-first grid ordering ---
// Ascending by `waitingOn.rank` (MERGE=1 ... Idle=7 — see deriveWaitingOn,
// src/lib.mjs). A payload with no `waitingOn` at all sorts as Idle-equivalent
// (last) rather than crashing or being assumed urgent.
export function waitingOnRank(p) {
  return p && p.waitingOn && typeof p.waitingOn.rank === 'number' ? p.waitingOn.rank : 7;
}

// Pure (does not mutate its input) — Array.prototype.sort in Node is a
// stable sort, so projects sharing a rank keep their original relative order.
export function sortProjectsByWaitingOn(projects) {
  return [...(projects || [])].sort((a, b) => waitingOnRank(a) - waitingOnRank(b));
}

// Spec 010-01 (ADR-0007): phase-two client merge — a pure, keyed field-swap,
// no derivation. Each project matched by `path` gets `waitingOn`/
// `waitingStages` replaced and `prs`/`ownerLogin` added from its delta (both
// atomically, from the same delta object, so the single-source invariant
// waitingOn === waitingStages[0] survives the fold — AC5); a project absent
// from `deltas` is returned unchanged. Pure — neither input is mutated.
export function mergePrDeltas(projects, deltas) {
  const byPath = new Map((deltas || []).map((d) => [d.path, d]));
  return (projects || []).map((p) => {
    const d = byPath.get(p.path);
    if (!d) return p;
    const merged = { ...p };
    // Swap the waiting-on pair only when the delta carries it, and always
    // TOGETHER (never one without the other) so the single-source invariant
    // waitingOn === waitingStages[0] cannot desync (AC5). prDeltas always emits
    // both; the `in`-guard makes the only-when-present intent explicit and stops
    // a future partial delta from wiping a phase-one headline (arch nit).
    if ('waitingOn' in d && 'waitingStages' in d) {
      merged.waitingOn = d.waitingOn;
      merged.waitingStages = d.waitingStages;
    }
    if ('ownerLogin' in d) merged.ownerLogin = d.ownerLogin;
    if ('prs' in d) merged.prs = d.prs;
    return merged;
  });
}

// --- overview row (AC1/AC2/AC3/AC7) ---
function activityCell(p) {
  const { activeCount } = sessionCounts(p);
  const last = (p.sessions || []).length ? relativeTime(p.sessions[0].lastActivity) : null;
  const primary = activeCount > 0 ? `${activeCount} active` : 'idle';
  return (
    `<span class="act-primary">${esc(primary)}</span>` +
    `<span class="act-last">${esc(last || '')}</span>`
  );
}

function rowShell(p, { chip, nextmove, inflight, progress, activity }) {
  return (
    `<div class="project-row" data-path="${esc(p.path)}">` +
    `<div class="row-gutter"></div>` +
    `<div class="row-project"><span class="row-name">${esc(p.name)}</span>` +
    `${p.description ? `<span class="row-type">${esc(p.description)}</span>` : ''}` +
    `${chip}</div>` +
    `<div class="row-nextmove">${nextmove}</div>` +
    `<div class="row-inflight">${inflight}</div>` +
    `<div class="row-progress">${progress}</div>` +
    `<div class="row-activity">${activity}</div>` +
    `</div>`
  );
}

// Every project — including error and not-jig-managed ones (AC1) — renders
// through this one shell so row height/columns never vary with content.
export function overviewRow(p) {
  if (p.error) {
    return rowShell(p, {
      chip: '<span class="chip chip-error">ERROR</span>',
      nextmove: `<span class="row-action muted">${esc(p.error)}</span>`,
      inflight: '',
      progress: '',
      activity: '',
    });
  }
  if (!p.jigManaged) {
    return rowShell(p, {
      chip: '<span class="chip chip-muted">NOT JIG-MANAGED</span>',
      nextmove: '<span class="row-action muted">no docs/specs found</span>',
      inflight: '',
      progress: '',
      activity: activityCell(p),
    });
  }
  const pct = p.progress.pct;
  const chip =
    pct === 100
      ? '<span class="chip chip-done">ALL SPECS DONE</span>'
      : '<span class="chip chip-active">ACTIVE</span>';
  const heat = inFlightCount(p);
  const bucket = heatBucket(heat);
  const specFraction = `${p.progress.done}/${p.progress.denom}`;
  return rowShell(p, {
    chip,
    nextmove: nextMoveCell(p),
    inflight:
      `<span class="if-num heat-${bucket}">${heat}</span><span class="if-word heat-${bucket}">${bucket}</span>` +
      flightCellsSvg(heat) +
      `<span class="if-caption">open fronts</span>`,
    progress:
      `<span class="pct">${pct === null ? '—' : pct + '%'}</span>` +
      `<span class="caption">${esc(specFraction)}</span>` +
      progressBarSvg(pct),
    activity: activityCell(p),
  });
}

export function runningNowCount(projects) {
  return (projects || []).reduce((sum, p) => sum + (p.sessions || []).filter((s) => s.running).length, 0);
}

// --- detail view (AC5/AC6) ---
function specRow(s) {
  const doneSlices = (s.slices || []).filter((sl) => sl.status === 'DONE').length;
  const sliceLabel = s.slices && s.slices.length ? `${doneSlices}/${s.slices.length}` : '';
  const dim = s.status === 'DEFERRED' || s.status === 'ABANDONED' ? ' dim' : '';
  return (
    `<div class="spec-row"><span class="spec-n">${esc(s.id)}</span>` +
    `<span class="spec-name${dim}">${esc(s.title || s.id)}</span>` +
    `<span class="spec-slices">${esc(sliceLabel)}</span>` +
    `<span class="spec-status st-${esc(s.status || '')}">${esc(s.status || '?')}</span></div>`
  );
}

function wsItemsHtml(w) {
  const items = (w.items || []).filter((i) => !i.checked).slice(0, 3);
  return items.map((i) => `<div class="ws-item">☐ ${esc(i.text)}</div>`).join('');
}

function wsBlockHtml(w, isCurrent) {
  const kindLabel =
    w.kind === 'release'
      ? 'release'
      : `runbook${w.phases && w.phases.length ? ' · ' + w.phases.length + ' phases' : ''}`;
  const currentChip = isCurrent ? '<span class="chip chip-current">CURRENT</span>' : '';
  return (
    `<div class="ws-block"><div class="ws-title-line">` +
    `<span class="ws-title">${esc(w.title || w.path)}</span>${currentChip}` +
    `<span class="ws-kind">${esc(kindLabel)}</span></div>` +
    `<div class="ws-items">${wsItemsHtml(w)}</div></div>`
  );
}

function discoveredBlock(p) {
  const disc = p.discovered || [];
  if (!disc.length) return '';
  const lines = disc
    .map((d) => `<div class="discovered-line">${esc(shorten(d.title || d.path, 60))} (${d.steps.done}/${d.steps.total})</div>`)
    .join('');
  return `<div class="discovered"><div class="label">DISCOVERED, NOT PINNED</div>${lines}</div>`;
}

function sessionRowDetail(s) {
  const older = s.active !== true;
  const dotCls = s.running ? 'dot-run' : older ? 'dot-hollow' : 'dot-idle';
  return (
    `<div class="session-row${older ? ' older' : ''}"><span class="dot ${dotCls}"></span>` +
    `<span class="sr-title">${esc(s.title)}</span>` +
    `<span class="sr-branch">${esc(s.branch || '')}</span>` +
    `<span class="sr-worktree">${esc(s.worktree || '')}</span>` +
    `<span class="sr-last">${esc(relativeTime(s.lastActivity) || '')}</span></div>`
  );
}

// Sessions section (AC5): full list, existing "show older" idiom, and the
// "N active · M older (+K not shown)" summary (003-02).
export function sessionsDetailBlock(p) {
  const all = p.sessions || [];
  if (!all.length) return '';
  const { activeCount, olderCount, overflowCount } = sessionCounts(p);
  const header =
    `${activeCount} active` +
    (olderCount > 0 ? ` · ${olderCount} older` : '') +
    (overflowCount > 0 ? ` (+${overflowCount} not shown)` : '');
  const activeRows = all.filter((s) => s.active === true).map(sessionRowDetail).join('');
  const olderRows = all.filter((s) => s.active !== true).map(sessionRowDetail).join('');
  const toggle =
    olderCount > 0
      ? `<details class="sessions-toggle"><summary>▾ show ${olderCount} older</summary>${olderRows}</details>`
      : '';
  return (
    `<div class="sessions"><div class="sessions-header"><span class="label">SESSIONS</span>` +
    `<span class="meta">${esc(header)}</span></div>${activeRows}${toggle}</div>`
  );
}

// --- spec 009-04: detail-view PR area (pure, reads p.prs) ---
// A small list of the project's open PRs (drafts already filtered scan-side),
// each as "#<number> <title>" with a one-word state hint and its url. Keyed on
// `ownerLogin` (the same owner identity deriveWaitingOn uses) to tell an
// "awaiting your review" PR from an "out for review" one. Omitted entirely when
// there are no PRs — no empty-state noise (AC2).
function prStateHint(pr, ownerLogin) {
  if (pr.reviewDecision === 'APPROVED') {
    // Approved but not mergeable (BLOCKED/BEHIND/DIRTY) still reads as approved,
    // qualified — so it never lists with a blank hint (compliance nit).
    return pr.mergeStateStatus === 'CLEAN' ? 'approved' : 'approved · not mergeable';
  }
  const reqs = pr.reviewRequests || [];
  if (ownerLogin && reqs.some((r) => r.login === ownerLogin)) return 'awaiting your review';
  if (reqs.length) return 'out for review';
  if (pr.reviewDecision === 'CHANGES_REQUESTED') return 'changes requested';
  return 'open';
}

export function prsDetailBlock(p, ownerLogin) {
  const prs = p.prs || [];
  if (!prs.length) return '';
  const rows = prs
    .map((pr) => {
      const hint = prStateHint(pr, ownerLogin);
      return (
        `<div class="pr-row"><a class="pr-link" href="${esc(pr.url)}">#${esc(pr.number)}</a>` +
        `<span class="pr-title">${esc(pr.title)}</span>` +
        `${hint ? `<span class="pr-hint">${esc(hint)}</span>` : ''}</div>`
      );
    })
    .join('');
  return `<div class="prs"><div class="label">OPEN PRs</div>${rows}</div>`;
}

function warningBlock(p) {
  const docs = p.worktreeOnlyDocs || [];
  if (!docs.length) return '';
  const first = docs[0];
  return (
    `<div class="warning">⚠ ${docs.length} doc(s) exist only in an un-merged worktree.` +
    `<div class="warning-eg">e.g. ${esc(first.path)} — ${esc(first.worktree)}</div></div>`
  );
}

// Reserved Activity tab (AC6): inert, dashed-border placeholder. Rendered
// into the page but hidden by default — index.html's glue toggles it in when
// the (disabled) activity tab is clicked; it renders nothing else and counts
// nothing (token counting is a non-goal here).
export function activityTabPlaceholder() {
  return (
    `<div class="activity-tab"><div class="activity-icon" aria-hidden="true"></div>` +
    `<div class="activity-heading">coming soon</div>` +
    `<div class="activity-desc">Token usage will show here once counting lands.</div></div>`
  );
}

export function detailView(p, opts = {}) {
  const showAll = !!opts.showAll;
  if (p.error || !p.jigManaged) {
    return (
      `<div class="detail" data-path="${esc(p.path)}">` +
      `<div class="topbar"><button class="back-btn" data-action="back">← overview</button>` +
      `<span class="crumb">${esc(p.path)}</span></div>` +
      `<div class="header"><span class="detail-title">${esc(p.name)}</span>` +
      `${p.description ? `<span class="detail-type">${esc(p.description)}</span>` : ''}</div>` +
      `<div class="whats-next"><div class="wn-line">${esc(p.error || 'not a jig-managed project — no docs/specs found')}</div></div>` +
      `</div>`
    );
  }
  const pct = p.progress.pct;
  const c = p.compass;
  // Strict running-only count — matches the overview header's "RUNNING NOW"
  // stat (runningNowCount), which is running sessions, not the broader
  // "active" (running OR within 7 days) count sessionCounts tracks. Reusing
  // runningNowCount with a single-project array keeps both call sites
  // computing the identical number under the identical label (follow-up fix
  // to 009-01 — this used to double as sessionCounts().activeCount).
  const running = runningNowCount([p]);
  const heat = inFlightCount(p);
  const lastSession = (p.sessions || [])[0];
  const metaLine =
    `${running} running now · ${heat} in flight · ` +
    `last touched ${esc(relativeTime(lastSession && lastSession.lastActivity) || 'unknown')}`;
  const chip = pct === 100 ? 'ALL SPECS DONE' : 'ACTIVE';

  const whatsNext = c
    ? `<div class="whats-next"><div class="wn-header"><span class="label">WHAT'S NEXT</span>` +
      `<span class="age${c.stale ? ' stale' : ''}">${esc(c.ageLabel || '')}</span></div>` +
      `<div class="wn-line">${esc(c.headline)}</div>` +
      `${c.next ? `<div class="wn-next"><span class="label-inline">NEXT</span> ${esc(c.next)}</div>` : ''}` +
      `${(c.blockers || []).length ? `<div class="wn-blocked"><span class="label-inline">BLOCKED</span> ${esc(c.blockers.join('; '))}</div>` : ''}` +
      `</div>`
    : `<div class="whats-next"><div class="wn-header"><span class="label">WHAT'S NEXT</span></div>` +
      `<div class="wn-line muted">no compass snapshot yet</div></div>`;

  const { specs, filtered, trackTitle, total } = detailSpecList(p, { showAll });
  const specsHeader =
    `<div class="specs-header"><span class="label">SPECS</span>` +
    `${filtered && trackTitle ? ` <span class="track-label">${esc(trackTitle)}</span>` : ''}` +
    `<span class="specs-toggle" data-action="${filtered ? 'show-all-specs' : 'show-track-specs'}">` +
    `${filtered ? `▾ show all ${total} specs` : (trackTitle ? '▴ show current track' : '')}</span></div>`;
  const specRows = specs.map(specRow).join('');

  const track = currentReleaseTrack(p);
  const wsBlocks = (p.workstreams || []).map((w) => wsBlockHtml(w, !!track && w === track)).join('');

  return (
    `<div class="detail" data-path="${esc(p.path)}">` +
    `<div class="topbar"><button class="back-btn" data-action="back">← overview</button>` +
    `<span class="crumb">${esc(p.path)}</span></div>` +
    `<div class="header">` +
    `<div class="header-id">` +
    `<div class="detail-title-line"><span class="detail-title">${esc(p.name)}</span>` +
    `${p.description ? `<span class="detail-type">${esc(p.description)}</span>` : ''}` +
    `<span class="chip">${chip}</span></div>` +
    `<div class="detail-meta">${metaLine}</div>` +
    `<div class="tabs"><span class="tab active" data-action="show-overview-tab">overview</span>` +
    `<span class="tab disabled" data-action="show-activity-tab">activity</span></div>` +
    `</div>` +
    `<div class="progress-readout"><span class="readout-text">${pct === null ? '—' : pct + '%'} — ${p.progress.done}/${p.progress.denom} specs</span>` +
    progressBarSvg(pct, { w: 200, h: 5 }) +
    `</div>` +
    `</div>` +
    `<div class="overview-tab-content">` +
    whatsNext +
    `<div class="counts-line">${esc(countsLine(p))}</div>` +
    `<div class="two-col">` +
    `<div class="specs-panel">${specsHeader}${specRows}</div>` +
    `<div class="ws-panel"><div class="label">WORKSTREAMS · RELEASE PLANS</div>${wsBlocks}${discoveredBlock(p)}</div>` +
    `</div>` +
    prsDetailBlock(p, p.ownerLogin) +
    sessionsDetailBlock(p) +
    warningBlock(p) +
    `</div>` +
    `<div class="activity-tab-content" hidden>${activityTabPlaceholder()}</div>` +
    `</div>`
  );
}

// --- click→toggle glue state (AC4) ---
// A thin, pure state machine — the interaction glue itself (attaching DOM
// listeners) stays in index.html; this is what makes the open/close
// transitions unit-testable without a browser driver (plan.md).
export const OVERVIEW_STATE = { view: 'overview', path: null, showAll: false, lens: 'overview' };

// `lens` is carried through the open/close round-trip (009-03) so a project
// opened FROM the action-queue lens returns to the queue on close, not to the
// overview grid. Defaults to 'overview' so 009-01/009-02 callers are unchanged.
export function openDetail(path, lens = 'overview') {
  return { view: 'detail', path, showAll: false, lens };
}

export function closeDetail(lens = 'overview') {
  return { view: 'overview', path: null, showAll: false, lens };
}

export function isDetailOpenFor(state, path) {
  return !!state && state.view === 'detail' && state.path === path;
}

// --- 009-03: lens toggle (overview grid <-> cross-project action queue) ---
// A pure sibling to openDetail/closeDetail (AC1) — the page glue stays a thin
// dispatcher over tested state transitions, not ad hoc DOM bookkeeping.
export function setLens(state, lens) {
  return { ...state, lens, view: 'overview' };
}

// --- 009-03: cross-project action-queue lens ---
// Reads ONLY the `waitingStages` field scan-side deriveWaitingStages
// (src/lib.mjs) emits — this module never imports src/lib.mjs (the browser
// has no route there; ADR-0001/plan.md). Because a project's `waitingOn`
// (the grid's headline) is BY CONSTRUCTION `waitingStages[0]`, the queue's
// top row for a project always agrees with the grid (AC5) — there is no
// second derivation to disagree with the first.

// Pinned stage -> emitted-state map (slice-03-action-queue-lens.md AC3),
// keyed by `rank` since Ready(resume) and Ready(start) share the state label
// "Ready" but occupy two distinct queue groups (Finish vs Start).
const QUEUE_GROUPS = {
  1: { label: 'Land', verb: 'MERGE' },
  2: { label: 'Review', verb: 'REVIEW' },
  3: { label: 'Decide', verb: 'DECIDE' },
  4: { label: 'Finish', verb: 'READY' },
  5: { label: 'Start', verb: 'READY' },
};
const QUEUE_RANKS = Object.keys(QUEUE_GROUPS).map(Number).sort((a, b) => a - b);

// Flattens each project's `waitingStages` (capped to its top `capPerProject`,
// already rank-ordered so slice(0,cap) is finish-first) into stage rows,
// drops Idle/empty/missing-field projects (AC4), and groups the remaining
// rows by the pinned stage map, groups ordered ascending rank (AC3). Stable
// within a group because Array.prototype.filter preserves the row-build
// order, which itself follows the input `projects` array order (AC3).
export function actionQueue(projects, { capPerProject = 3 } = {}) {
  const rows = [];
  for (const p of projects || []) {
    const stages = (p.waitingStages || []).slice(0, capPerProject);
    for (const s of stages) {
      rows.push({ name: p.name, path: p.path, state: s.state, verb: s.verb, action: s.action, rank: s.rank });
    }
  }
  const groups = [];
  for (const rank of QUEUE_RANKS) {
    const groupRows = rows.filter((r) => r.rank === rank);
    if (!groupRows.length) continue;
    groups.push({ rank, label: QUEUE_GROUPS[rank].label, verb: QUEUE_GROUPS[rank].verb, rows: groupRows });
  }
  return groups;
}

// Mirrors overviewRow's uniform-shell discipline (esc() everywhere) and
// carries data-path so a click reuses the existing openDetail(path) glue —
// the queue's rows open the same detail view as a grid row.
export function actionQueueRow(row) {
  return (
    `<div class="queue-row" data-path="${esc(row.path)}">` +
    `<span class="row-verb rv-${esc(row.state)}">${esc(row.verb)}</span>` +
    `<span class="queue-project">${esc(row.name)}</span>` +
    `<span class="queue-action">${esc(row.action)}</span>` +
    `</div>`
  );
}

export function actionQueueGroup(group) {
  return (
    `<div class="queue-group">` +
    `<div class="queue-group-header">${esc(group.label)}</div>` +
    `${group.rows.map(actionQueueRow).join('')}` +
    `</div>`
  );
}

// Composes the groups under a `sheet` header, mirroring overviewHtml's shell
// (index.html); an honest empty-state string when nothing is waiting,
// never a blank sheet.
export function actionQueueHtml(projects) {
  const groups = actionQueue(projects);
  const body = groups.length
    ? groups.map(actionQueueGroup).join('')
    : '<p style="padding:20px 26px;color:var(--text-muted)">Nothing waiting — the queue is empty.</p>';
  return (
    `<div class="sheet">` +
    `<div class="summary-band"><div>` +
    `<div class="summary-path">~/projects</div>` +
    `<div class="summary-title">Action queue</div>` +
    `</div><div class="summary-right">${lensToggleHtml('queue')}</div></div>` +
    `<div class="queue-list">${body}</div>` +
    `</div>`
  );
}

// AC1: the toggle itself, mirrored into both lenses' own summary-band (this
// function's caller is only ever invoked while its own lens is active, so
// the "active" class here is static per call site, not state-derived).
// Exported so index.html's overviewHtml() reuses the identical markup for
// the overview lens rather than a hand-duplicated copy.
export function lensToggleHtml(activeLens) {
  const cls = (l) => `lens-btn${activeLens === l ? ' active' : ''}`;
  return (
    `<div class="lens-toggle">` +
    `<button class="${cls('overview')}" data-action="set-lens-overview">overview</button>` +
    `<button class="${cls('queue')}" data-action="set-lens-queue">action queue</button>` +
    `</div>`
  );
}
