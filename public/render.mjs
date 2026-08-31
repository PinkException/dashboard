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
// Scope fence (AC7/AC8): nothing here derives a waiting-on state, reorders
// projects, or renders a state tag/header count/action-queue toggle — that
// is 009-02/009-03. Rows keep the project order they're given.

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
  const nextLine = (p.compass && (p.compass.headline || p.compass.next)) || 'no compass snapshot yet';
  const heat = inFlightCount(p);
  const bucket = heatBucket(heat);
  const specFraction = `${p.progress.done}/${p.progress.denom}`;
  return rowShell(p, {
    chip,
    nextmove: `<span class="row-action">${esc(shorten(nextLine, 140))}</span>`,
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
export const OVERVIEW_STATE = { view: 'overview', path: null, showAll: false };

export function openDetail(path) {
  return { view: 'detail', path, showAll: false };
}

export function closeDetail() {
  return { view: 'overview', path: null, showAll: false };
}

export function isDetailOpenFor(state, path) {
  return !!state && state.view === 'detail' && state.path === path;
}
