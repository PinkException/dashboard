// Pure parsing helpers — no filesystem access, fully unit-testable.
// Hand-rolled for the flat YAML subset jig emits (ADR-0001): do not
// replace with an npm parser.

export function parseFrontmatter(text) {
  const out = { data: {}, body: text };
  if (!text.startsWith('---')) return out;
  const lines = text.split('\n');
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { end = i; break; }
  }
  if (end === -1) return out;
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const raw = m[2].trim();
    let value;
    if (raw.startsWith('[') && raw.endsWith(']')) {
      const inner = raw.slice(1, -1).trim();
      value = inner ? inner.split(',').map((s) => stripQuotes(s.trim())) : [];
    } else {
      value = stripQuotes(raw);
      if (value === '') value = null;
    }
    out.data[key] = value;
  }
  out.body = lines.slice(end + 1).join('\n');
  return out;
}

function stripQuotes(s) {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

export function normStatus(s) {
  return typeof s === 'string' ? s.trim().toUpperCase() : null;
}

// Honest progress: ABANDONED leaves the denominator, DEFERRED stays in it
// but is reported separately (parked, not "not done").
export function progressOf(items) {
  const total = items.length;
  const by = {};
  for (const it of items) {
    const s = it.status || 'UNKNOWN';
    by[s] = (by[s] || 0) + 1;
  }
  const abandoned = by.ABANDONED || 0;
  const deferred = by.DEFERRED || 0;
  const done = by.DONE || 0;
  const denom = total - abandoned;
  const pct = denom > 0 ? Math.round((done / denom) * 100) : null;
  return { done, total, abandoned, deferred, denom, pct, by };
}

const BOX_RE = /^(\s*)(?:([-*])|(\d+)[.)])\s+\[([ xX])\]\s*(.*)$/;
const HEADING_RE = /^(#{2,4})\s+(.+)$/;

// Owner comes only from the bold tag convention: **(you)** / **(Claude)**,
// including suffixed forms like **BATCH RUN (you, cost)**.
// "(your choice)" or a plain un-bolded "(you)" must not match.
export function ownerOf(text) {
  const m = text.match(/\*\*[^*]*\((you|claude)\b[^)]*\)[^*]*\*\*/i);
  return m ? m[1].toLowerCase() : null;
}

export function cleanStepText(text) {
  return text
    .replace(/\*\*[^*]*\((?:you|claude)[^)]*\)[^*]*\*\*/gi, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Parses runbook/roadmap-shaped markdown. Steps = numbered checkboxes when
// any exist (jig runbook convention), else top-level bulleted checkboxes.
// A doc with no checkboxes at all still yields its phase headings.
export function parseRunbook(text) {
  const lines = text.split('\n');
  const titleLine = lines.find((l) => l.startsWith('# '));
  const title = titleLine ? titleLine.replace(/^#\s*/, '').trim() : null;
  const numbered = [];
  const bullets = [];
  const headings = [];
  let heading = null;
  for (const line of lines) {
    const h = line.match(HEADING_RE);
    if (h) {
      heading = h[2].trim();
      headings.push(heading);
      continue;
    }
    const b = line.match(BOX_RE);
    if (!b) continue;
    const item = {
      checked: b[4].toLowerCase() === 'x',
      text: cleanStepText(b[5]),
      owner: ownerOf(b[5]),
      phase: heading,
      topLevel: b[1].length === 0,
    };
    if (b[3] !== undefined) numbered.push(item);
    else bullets.push(item);
  }
  const steps = numbered.length ? numbered : bullets.filter((i) => i.topLevel);
  const done = steps.filter((s) => s.checked).length;
  const firstOpen = steps.find((s) => !s.checked) || null;
  const phases = steps.length
    ? [...new Set(steps.map((s) => s.phase).filter(Boolean))]
    : headings.slice(0, 12);
  return {
    title,
    steps: { done, total: steps.length },
    phases,
    currentPhase: firstOpen ? firstOpen.phase : null,
    next: firstOpen ? { text: firstOpen.text, owner: firstOpen.owner } : null,
    // Spec 009-01 AC5: the full step list (already computed above as `steps`),
    // widened out so a caller (the detail view's workstream block) can show
    // the next 1-3 UNCHECKED item texts, not just the single `next`. Kept as
    // {checked,text,owner} triples — the same shape `next` already exposes —
    // so no caller needs a second parsing path.
    items: steps.map(({ checked, text, owner }) => ({ checked, text, owner })),
  };
}

export function countCheckboxes(text) {
  let done = 0;
  let total = 0;
  for (const line of text.split('\n')) {
    const m = line.match(BOX_RE);
    if (!m) continue;
    total++;
    if (m[4].toLowerCase() === 'x') done++;
  }
  return { done, total };
}

export function countInboxItems(text) {
  return (text.match(/^- \[\d{4}-\d{2}-\d{2}\]/gm) || []).length;
}

// Approximate by design: a section is closed when its heading carries
// RESOLVED (and not PARTIALLY), or its body opens a **Resolved** field
// without a **Still deferred** remainder.
export function countRefinement(text) {
  const sections = text.split(/^###\s+/m).slice(1);
  let open = 0;
  for (const section of sections) {
    const head = section.split('\n')[0];
    const headResolved = /\bRESOLVED\b/.test(head) && !/PARTIALLY/i.test(head);
    const bodyResolved =
      /^\*\*Resolved\b/im.test(section) && !/^\*\*Still deferred\b/im.test(section);
    const headPartial = /PARTIALLY/i.test(head);
    if (!(headResolved || (bodyResolved && !headPartial))) open++;
  }
  return { open, total: sections.length };
}

export const BUG_CLOSED = new Set(['DONE', 'RESOLVED_ON_MAIN', 'CLOSED', 'WONT_FIX']);

// Last valid snapshot line wins; malformed lines are counted, never fatal.
// `latestNarrative` tracks the last valid line whose `source` is not `auto`
// (slice 005-04): a card prefers a human/skill prose headline over the routine's
// deterministic `auto:` counts, so the daily auto series can accumulate for the
// future evolution chart without ever burying a narrative headline on the card.
// A line with no `source` predates the tag (pre-005-03) and is treated as
// narrative — never hidden.
export function parseCompassHistory(text) {
  let latest = null;
  let latestNarrative = null;
  let malformed = 0;
  let count = 0;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    count++;
    try {
      const obj = JSON.parse(line);
      if (
        obj &&
        typeof obj.ts === 'string' &&
        !Number.isNaN(Date.parse(obj.ts)) &&
        typeof obj.headline === 'string'
      ) {
        latest = obj;
        if (obj.source !== 'auto') latestNarrative = obj;
      } else {
        malformed++;
      }
    } catch {
      malformed++;
    }
  }
  return { latest, latestNarrative, malformed, count };
}

// Spec 013-01: progress series for the Activity-tab chart, from ONE source's
// raw text (the store file only: the legacy in-repo file was removed under
// ADR-0004 s6). Entries without numeric specs.done/total (legacy shape) are
// counted in `noNumbers`; unparseable lines and entries with numbers but no
// usable ts are counted in `malformed`. Nothing is guessed. Oldest first,
// capped at the SERIES_CAP newest points (spec 013 A2).
export const SERIES_CAP = 200;
export function buildProgressSeries(text) {
  const points = [];
  let noNumbers = 0;
  let malformed = 0;
  for (const ln of String(text ?? '').split('\n')) {
    if (!ln.trim()) continue;
    let obj;
    try {
      obj = JSON.parse(ln);
    } catch {
      malformed++;
      continue;
    }
    if (!obj || typeof obj !== 'object') {
      malformed++;
      continue;
    }
    const s = obj.specs;
    if (!s || typeof s.done !== 'number' || typeof s.total !== 'number') {
      noNumbers++;
      continue;
    }
    if (typeof obj.ts !== 'string' || Number.isNaN(Date.parse(obj.ts))) {
      malformed++;
      continue;
    }
    const pt = { ts: obj.ts, done: s.done, total: s.total, source: obj.source ?? null };
    if (obj.source !== 'auto' && typeof obj.headline === 'string') pt.headline = obj.headline;
    points.push(pt);
  }
  points.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  return { points: points.slice(-SERIES_CAP), skipped: { noNumbers, malformed } };
}

// Pick the genuinely newer of two candidate snapshots (ADR-0004 §5: the reader
// reads both the dashboard-owned store and the project's legacy in-repo file
// during the migration window). Comparing by `ts` is deliberate — concatenating
// the two sources and re-parsing would let parseCompassHistory's last-line-wins
// rule decide by read order instead of by time. On an identical `ts` the store
// wins: it is the canonical source, the in-repo copy is the one being retired.
// The unparseable-`ts` branches guard direct callers only — parseCompassHistory
// already discards such lines, so scanCompass can never reach them.
export function laterSnapshot(inRepo, fromStore) {
  if (!fromStore) return inRepo ?? null;
  if (!inRepo) return fromStore;
  const a = Date.parse(inRepo.ts);
  const b = Date.parse(fromStore.ts);
  if (Number.isNaN(b)) return Number.isNaN(a) ? fromStore : inRepo;
  if (Number.isNaN(a)) return fromStore;
  return b >= a ? fromStore : inRepo;
}

// Writer-side validation of the full line schema — defined by ADR-0002 and
// inherited unchanged by ADR-0004, which moved only the file's location. The reader
// (parseCompassHistory) stays deliberately lenient — it only needs ts and
// headline to render — but nothing malformed should ever be written.
export function validateSnapshot(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object') return ['snapshot must be a JSON object'];
  if (typeof obj.v !== 'number') {
    errors.push('v (schema version) is required and must be a number');
  }
  if (typeof obj.ts !== 'string' || Number.isNaN(Date.parse(obj.ts))) {
    errors.push('ts must be an ISO-8601 string');
  }
  if (typeof obj.headline !== 'string' || !obj.headline.trim()) {
    errors.push('headline must be a non-empty string');
  }
  if (obj.next !== undefined && typeof obj.next !== 'string') {
    errors.push('next must be a string when present');
  }
  if (obj.blockers !== undefined && !Array.isArray(obj.blockers)) {
    errors.push('blockers must be an array when present');
  }
  if (obj.specs !== undefined) {
    if (
      !obj.specs ||
      typeof obj.specs !== 'object' ||
      typeof obj.specs.done !== 'number' ||
      typeof obj.specs.total !== 'number'
    ) {
      errors.push('specs must be {done: number, total: number} when present');
    }
  }
  return errors;
}

// Human age of a snapshot: "this morning" / "this afternoon" /
// "this evening" / "yesterday" / "N days ago"; null for unparseable ts.
export function ageLabel(ts, now = Date.now()) {
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  const n = new Date(now);
  if (d.toDateString() === n.toDateString()) {
    const h = d.getHours();
    if (h < 12) return 'this morning';
    if (h < 18) return 'this afternoon';
    return 'this evening';
  }
  const dayMs = 86400000;
  const days = Math.round(
    (new Date(now).setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / dayMs
  );
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

export function ageDays(ts, now = Date.now()) {
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return null;
  return Math.floor((now - t) / 86400000);
}

// --- Spec 003-01: session panel — pure helpers (attribution, title, ordering) ---
// Kept disk-free and unit-tested directly; the impure store reads (fs, mtimes,
// bounded transcript scans) live in scan.mjs and call into these.

// Claude Code's own `~/.claude/projects/<slug>` scheme: every non-alphanumeric
// char in the launch cwd becomes '-' (so '/.claude/' → '--claude'). Verified
// on disk 2026-07-13/2026-08-04 (spec 003 Assumptions A1-A3; A4 flags this as
// not a stable contract across versions).
export function encodeCwdSlug(p) {
  return p.replace(/[^A-Za-z0-9]/g, '-');
}

// Precise worktree extraction from a REAL path (has real '/' separators) — used
// in phase 2 (AC7) once a transcript body's own `cwd` is read, so it correctly
// handles nesting below the worktree root (`.../worktrees/<name>/.claude/skills/...`).
export function worktreeFromCwd(cwd) {
  if (!cwd) return null;
  const m = cwd.match(/\.claude\/worktrees\/([^/]+)/);
  return m ? m[1] : null;
}

// Approximate ("first cut") worktree extraction from a store DIRECTORY SLUG
// alone (phase 1, body-free — AC4). A slug collapses every separator to '-',
// so a literal dash inside a worktree name is indistinguishable from a
// path-separator dash once nesting goes deeper than the worktree root itself —
// this is exactly the ambiguity AC7 defers to the phase-2 refinement above
// (worktreeFromCwd), which reads the real cwd for the emitted/capped sessions
// only. This function just returns the whole slug remainder after the
// worktree-root prefix; it is correct for the common case (session launched
// at the worktree root) and imprecise, by design, for deeper nesting.
export function worktreeFromSlug(dirSlug, rootSlug) {
  const prefix = rootSlug + '--claude-worktrees-';
  if (!dirSlug.startsWith(prefix)) return null;
  const remainder = dirSlug.slice(prefix.length);
  return remainder || null;
}

// Attributes one `~/.claude/projects/<dirSlug>` directory to a configured
// project root, or null when no root claims it (AC4). Segment-anchored: a
// main-root match requires an EXACT slug match, and a worktree match requires
// the slug to start with `rootSlug + '--claude-worktrees-'` — never a bare
// string prefix, so a sibling root that shares a text prefix
// (`.../dashboard` vs `.../dashboard-plugin`) can never cross-attribute.
// `roots` is `[{ root, slug }]`; when more than one root matches (a rare
// nested-roots configuration), the longest root wins.
export function attributeSessionDir(dirSlug, roots) {
  const candidates = [];
  for (const { root, slug } of roots) {
    if (dirSlug === slug) {
      candidates.push({ root, worktree: null });
      continue;
    }
    const prefix = slug + '--claude-worktrees-';
    if (dirSlug.startsWith(prefix)) {
      candidates.push({ root, worktree: worktreeFromSlug(dirSlug, slug) });
    }
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.root.length - a.root.length);
  return candidates[0];
}

// Wrapper tags that surround non-prose scaffolding in a transcribed human
// turn — stripped whole (tag + contents), never treated as title material.
function stripWrapperBlocks(text) {
  let t = text
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
    .replace(/<command-[a-z-]+>[\s\S]*?<\/command-[a-z-]+>/gi, '');
  t = t.trim();
  if (!t) return '';
  const firstLine = t.split('\n')[0].trim();
  return firstLine.length > 80 ? firstLine.slice(0, 79) + '…' : firstLine;
}

// A turn counts as "human" title material only when it is a genuine typed
// user turn — not a meta/synthetic turn (`isMeta`) and not spawned-subagent
// scaffolding (`isSidechain`), per AC2.
function isHumanTurn(obj) {
  return obj.type === 'user' && !obj.isMeta && !obj.isSidechain;
}

// First TEXT block only — an `image`/`tool_use`/`tool_result` block is
// skipped so a pasted image (base64) or tool payload never becomes a title
// (AC2). Returns null when the turn carries no text block at all (e.g.
// image-only, tool-result-only).
function firstTextOf(content) {
  if (typeof content === 'string') {
    const s = stripWrapperBlocks(content);
    return s || null;
  }
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block && block.type === 'text' && typeof block.text === 'string') {
        const s = stripWrapperBlocks(block.text);
        if (s) return s;
      }
    }
  }
  return null;
}

// Folds one already-JSON-parsed transcript line into a running accumulator.
// Pure and order-dependent only on call order — scan.mjs's bounded/streamed
// reader calls this once per line, in file order, without holding the whole
// transcript in memory (AC7). `acc` starts as
// `{ customTitle: null, firstHumanText: null, lastGitBranch: null, lastCwd: null }`.
export function foldTranscriptLine(acc, obj) {
  if (!obj || typeof obj !== 'object') return acc;
  if (obj.type === 'custom-title' && typeof obj.customTitle === 'string') {
    acc.customTitle = obj.customTitle;
  }
  if (typeof obj.gitBranch === 'string' && obj.gitBranch) {
    acc.lastGitBranch = obj.gitBranch; // raw; HEAD/absent → null resolved by the caller
  }
  if (typeof obj.cwd === 'string' && obj.cwd) {
    acc.lastCwd = obj.cwd;
  }
  if (acc.firstHumanText === null && isHumanTurn(obj)) {
    const content = obj.message && obj.message.content !== undefined ? obj.message.content : obj.content;
    const text = firstTextOf(content);
    if (text !== null) acc.firstHumanText = text;
  }
  return acc;
}

// Title fallback chain (AC2): verbatim custom-title → first human text →
// sidecar `name` (only when its `nameSource` is a human source, i.e. not
// `"derived"`) → the session id itself.
export function resolveSessionTitle(acc, sidecar, id) {
  if (acc.customTitle) return acc.customTitle;
  if (acc.firstHumanText) return acc.firstHumanText;
  if (sidecar && sidecar.name && sidecar.nameSource && sidecar.nameSource !== 'derived') {
    return sidecar.name;
  }
  return id;
}

// Running-first, then most-recently-active first (AC5). `lastActivityMs` is
// the transcript file's mtime in epoch ms.
export function compareSessionOrder(a, b) {
  if (a.running !== b.running) return a.running ? -1 : 1;
  return b.lastActivityMs - a.lastActivityMs;
}

// Coarse "Nh ago" / "Nd ago" relative label for a session's last activity —
// deliberately finer-grained than `ageLabel` (which buckets by day for
// compass snapshots); a session refreshed 20 minutes ago should not read
// "this morning" (AC8).
export function relativeTime(ts, now = Date.now()) {
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return null;
  const diffMs = now - t;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

// --- Spec 003-02: recency-expand-toggle — header-count arithmetic (AC3/AC4/AC6) ---
// Pinned by frame-critique: N/activeCount and M/olderCount are counted over the
// EMITTED sessions array (post-cap), never the pre-cap total — the cap
// (SESSION_CAP=20, 003-01) can drop active sessions too, so "active" here means
// "active among what actually arrived". K/overflowCount is the gap between
// sessionsTotal (pre-cap) and the emitted length: sessions the cap dropped
// entirely, never revealable by the older-toggle (they aren't in the payload).
export function sessionCounts(project) {
  const sessions = project.sessions || [];
  const activeCount = sessions.filter((s) => s.active === true).length;
  const olderCount = sessions.length - activeCount;
  const total = project.sessionsTotal ?? sessions.length;
  const overflowCount = Math.max(0, total - sessions.length);
  return { activeCount, olderCount, overflowCount };
}

// --- Spec 008-01: release-goal view — Cutline "Include" join (Counting rule) ---

const INCLUDE_HEADING_RE = /^###\s+Include\s*$/;
const CUTLINE_HEADING_RE = /^#{1,6}\s/;
// Word-boundary-anchored so a 4-digit year (2020-01) can never match — a
// digit run longer than 3 has no internal word boundary to anchor on (spec
// 008 Counting rule / A2). Compressed runs (003-01/02/03) captured in group 3.
const TOKEN_RE = /\b(\d{3})-(\d{2})((?:\/\d{2})*)\b/g;
const SEPARATOR_CELL_RE = /^:?-{2,}:?$/;

// Extracts gating slice-ID tokens from ONLY the `### Include` section's table
// Item cells (first cell per data row) — Evidence/Rationale cells and every
// other Cutline heading (Defer/Split/Risk-First/...) are never read. Ordered,
// de-duplicated (first-seen order). Malformed rows (missing cells, stray
// pipes, blank lines) are skipped, never fatal — a section that fails to
// parse as a table simply yields fewer/zero tokens (spec 008 A2).
export function parseIncludeTokens(body) {
  const lines = body.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (INCLUDE_HEADING_RE.test(lines[i].trim())) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return [];
  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    if (CUTLINE_HEADING_RE.test(lines[i])) {
      end = i;
      break;
    }
  }
  const tokens = [];
  const seen = new Set();
  let pipeRowNum = 0;
  for (const line of lines.slice(start, end)) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes('|')) continue;
    pipeRowNum++;
    if (pipeRowNum === 1) continue; // header row
    const stripped = trimmed.replace(/^\|/, '').replace(/\|$/, '');
    const cells = stripped.split('|');
    if (pipeRowNum === 2 && cells.every((c) => SEPARATOR_CELL_RE.test(c.trim()))) {
      continue; // `|---|---|---|` separator row
    }
    const itemCell = (cells[0] || '').trim();
    if (!itemCell) continue;
    TOKEN_RE.lastIndex = 0;
    let m;
    while ((m = TOKEN_RE.exec(itemCell))) {
      const [, specDigits, sliceDigits, runs] = m;
      const emit = (nn) => {
        const id = `${specDigits}-${nn}`;
        if (!seen.has(id)) {
          seen.add(id);
          tokens.push(id);
        }
      };
      emit(sliceDigits);
      for (const run of runs.split('/').filter(Boolean)) emit(run);
    }
  }
  return tokens;
}

// Next-action label for a *pending* token (any live slice status that is
// neither DONE nor DEFERRED/ABANDONED), keyed by jig lifecycle status. An
// unmapped or null pending status falls back to 'advance' rather than
// crashing or guessing (spec 008-01 AC4).
const PENDING_ACTION = {
  DRAFT: 'draft',
  READY_FOR_REVIEW: 'review spec',
  READY_FOR_IMPLEMENTATION: 'implement',
  IN_PROGRESS: 'finish implementation',
  REVIEWED: 'reconcile',
  RECONCILED: 'land',
};

const SLICE_FILE_RE = /^slice-(\d+)(?:-(\d+))?-/;

// A1's identity rule: a token `NNN-MM` resolves via integer comparison
// against the scanned spec whose id begins `NNN` and, within it, the slice
// file whose own number is `MM` — handling both spec-relative
// (`slice-NN-*.md`) and spec-qualified (`slice-NNN-NN-*.md`) filenames.
function resolveToken(token, specs) {
  const [, specDigits, sliceDigits] = token.match(/^(\d{3})-(\d{2})$/) || [];
  const specNum = parseInt(specDigits, 10);
  const sliceNum = parseInt(sliceDigits, 10);
  const spec = specs.find((s) => {
    const m = s.id.match(/^(\d+)/);
    return m && parseInt(m[1], 10) === specNum;
  });
  // `spec` (when found) is carried on every branch below, even an unresolved
  // one (missing slice file) — spec 009-01's memberSpecIds (resolveReleaseGoal)
  // needs it to know which spec a token names even when its slice can't be
  // located, distinct from a forward gate to a spec that doesn't exist yet.
  if (!spec) return { cls: 'unresolved', spec: null };
  const slice = spec.slices.find((sl) => {
    const m = sl.file.match(SLICE_FILE_RE);
    if (!m) return false;
    if (m[2] === undefined) return parseInt(m[1], 10) === sliceNum;
    return parseInt(m[2], 10) === sliceNum && parseInt(m[1], 10) === specNum;
  });
  if (!slice) return { cls: 'unresolved', spec };
  // Normalize defensively: scanSpecs already stores normStatus'd values, but
  // resolveReleaseGoal is an exported helper — a caller passing a raw lowercase
  // status must not misclassify a landed slice as pending.
  const status = normStatus(slice.status);
  if (status === 'DONE') return { cls: 'landed', slice, spec };
  if (status === 'DEFERRED' || status === 'ABANDONED') return { cls: 'parked', slice, spec };
  return { cls: 'pending', slice, status, spec };
}

// Joins Include-extracted tokens to scanned spec/slice statuses (Counting
// rule): landed slices count as done, parked (DEFERRED/ABANDONED) slices are
// excluded from the denominator, and every unresolved token (missing slice
// file OR a not-yet-authored spec — a forward gate) stays in the total as
// honest not-yet-landed work. Pure — no filesystem or git calls.
export function resolveReleaseGoal(tokens, specs) {
  let done = 0;
  let total = 0;
  const goalUnresolved = [];
  let goalNext = null;
  // Spec 009-01: the release track's member spec IDs — every spec a token
  // names, in first-seen order, deduplicated. Included regardless of the
  // token's landed/pending/parked class (it is still literally named in the
  // Include table, so it is part of the track's scope) — excluded only when
  // no such spec exists on disk yet (a forward gate to an unauthored spec has
  // no id to add). Consumed by the detail view to default its spec list to
  // "the current track" (A-009-01) — the fallback-current-track rule itself
  // lives client-side (public/render.mjs), this only supplies the raw
  // membership a scan-time-only parse can resolve.
  const memberSpecIds = [];
  const seenSpecIds = new Set();
  for (const token of tokens) {
    const r = resolveToken(token, specs);
    if (r.spec && !seenSpecIds.has(r.spec.id)) {
      seenSpecIds.add(r.spec.id);
      memberSpecIds.push(r.spec.id);
    }
    if (r.cls === 'parked') continue;
    total++;
    if (r.cls === 'landed') {
      done++;
      continue;
    }
    if (r.cls === 'unresolved') goalUnresolved.push(token);
    if (!goalNext) {
      if (r.cls === 'unresolved') {
        goalNext = { id: token, action: 'author slice' };
      } else {
        goalNext = { id: token, action: PENDING_ACTION[r.status] || 'advance' };
      }
    }
  }
  return { goalProgress: { done, total }, goalNext, goalUnresolved, memberSpecIds };
}

// --- Spec 009-02: waiting-on state derivation (the triage signal) ---
// Pure and scan-side ONLY (this module is imported by src/scan.mjs, never by
// the browser — public/render.mjs may READ the emitted `waitingOn` field but
// must never import this file). See docs/specs/009-overview-redesign/
// slice-02-waiting-on-state-and-ordering.md "Taxonomy" for the pinned
// precedence and exact on-disk signal each state names — this function
// implements it as written, it does not reinterpret it.

// Only the three You-states forcedWaitingOn can normalize a marker to — the
// derived path below hardcodes its own verbs inline (Ready/'READY',
// Idle/'IDLE') since those states never flow through here. Keep this table
// scoped to what it's actually keyed with (arch/craft nit: no dead entries).
const WAITING_ON_VERB = { MERGE: 'MERGE', REVIEW: 'REVIEW', DECIDE: 'DECIDE' };
const FORCED_STATE_RANK = { MERGE: 1, REVIEW: 2, DECIDE: 3 };
// Default action text when a forced marker sets a state but no/blank action
// (craft fix): the badge must always render a real headline, never fall
// silently back to the compass line for a real owner-forced You-state.
const FORCED_DEFAULT_ACTION = { MERGE: 'land', REVIEW: 'review', DECIDE: 'decide' };

// Trims a next-action string to a handful of words (AC1: "a few-word named
// next action... never a hollow 'all calm'"), without cutting mid-word.
function fewWords(text, n = 10) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length <= n) return words.join(' ');
  return words.slice(0, n).join(' ') + '…';
}

// A slice's short, stable display token — "<spec-num>-<slice-num>" (e.g.
// "009-02") — reusing the exact spec/slice-number extraction resolveToken
// already performs, so a Ready action's "resume 009-02" names the same slice
// resolveToken would resolve back from that token.
function sliceToken(specId, sliceFile) {
  const specNum = (specId.match(/^(\d+)/) || [null, specId])[1];
  const m = sliceFile.match(SLICE_FILE_RE);
  if (!m) return specNum;
  const sliceNum = m[2] !== undefined ? m[2] : m[1];
  return `${specNum}-${sliceNum}`;
}

// Dependency gate for the Ready-start candidate: a dependency shaped like a
// slice token (NNN-MM) must resolve `landed` via resolveToken; anything else
// (an ADR reference, free-text) is not a slice-status claim this scanner can
// evaluate, so it does not block — the "else status-presence" fallback the
// taxonomy allows when resolveToken isn't cheaply applicable.
function depsSatisfied(dependencies, specs) {
  for (const dep of dependencies || []) {
    if (!/^\d{3}-\d{2}$/.test(dep)) continue;
    if (resolveToken(dep, specs).cls !== 'landed') return false;
  }
  return true;
}

// Finds the first you-tagged OPEN (unchecked) next step across a project's
// workstreams — reads only the `owner` field scan.mjs's parseRunbook already
// attached to each item/`next` (AC1: "via the emitted owner field... NOT by
// calling ownerOf in the browser"). Checks every workstream's cheap `next`
// pointer first, then falls back to scanning each workstream's full `items`
// list (a pinned workstream's `next` may be a Claude item while a later
// you-item still sits open beneath it).
function findYouNextStep(workstreams) {
  for (const w of workstreams || []) {
    if (w.next && w.next.owner === 'you' && w.next.text) return w.next.text;
  }
  for (const w of workstreams || []) {
    const item = (w.items || []).find((i) => !i.checked && i.owner === 'you');
    if (item) return item.text;
  }
  return null;
}

// AC3: the owner-settable home-folder marker backstop. `marker` is the
// project config's `needsYou` field — a string (forces DECIDE, the string is
// the action text) or `{ state?: 'DECIDE'|'REVIEW'|'MERGE', action }`. Forces
// a You-state regardless of the derived signal.
function forcedWaitingOn(marker) {
  const isObj = marker && typeof marker === 'object';
  const rawState = isObj ? marker.state : undefined;
  // An absent or unrecognized state (not one of the You-set) normalizes to
  // DECIDE, never surfaced verbatim — a raw unknown value here would desync
  // state/verb/rank (FORCED_STATE_RANK/WAITING_ON_VERB both key off the
  // SAME normalized state) and would emit an `rv-<unknown>` CSS class with
  // no matching style rule (compliance fix).
  const state = FORCED_STATE_RANK[rawState] !== undefined ? rawState : 'DECIDE';
  const rawAction = isObj ? marker.action : marker;
  // An empty/missing action (e.g. `{state:'MERGE'}` with no action string)
  // must NOT render as '' — nextMoveCell (public/render.mjs) treats a falsy
  // action as "no forced headline" and silently falls back to the compass
  // line, hiding a real owner-forced You-state (craft fix).
  const trimmed = rawAction ? String(rawAction).trim() : '';
  const action = trimmed ? fewWords(trimmed) : FORCED_DEFAULT_ACTION[state];
  return { state, verb: WAITING_ON_VERB[state], action, rank: FORCED_STATE_RANK[state] };
}

// spec 009-04: is a PR the owner's to merge right now? Author-agnostic — an
// approved, mergeable PR is the owner's to land whoever opened it. Requires no
// ownerLogin. (`BLOCKED`/`BEHIND`/`DIRTY`/`UNKNOWN` are NOT mergeable.)
function prIsMergeable(prObj) {
  return prObj.reviewDecision === 'APPROVED' && prObj.mergeStateStatus === 'CLEAN';
}

// The lowest PR number among a set — keeps the chosen PR deterministic when
// several qualify for the same bucket (009-04 AC1).
function lowestPrNumber(prs) {
  return prs.reduce((lo, p) => (p.number < lo ? p.number : lo), prs[0].number);
}

// The Idle sentinel (rank 7): not a "stage" (deriveWaitingStages never
// includes it in its list — Idle means the list is empty), but still
// deriveWaitingOn's fallback head when no stage is present (009-02 AC1).
const IDLE_WAITING_ON = { state: 'Idle', verb: 'IDLE', action: '', rank: 7 };

// The full rank-ordered list of a project's PRESENT non-Idle pipeline stages
// (009-03 AC2/AC3): every candidate the taxonomy recognizes, in the pinned
// total order MERGE > REVIEW > DECIDE > Ready(resume) > Ready(start) >
// External > Idle — not just the highest-precedence one. `deriveWaitingOn`
// (below) is this list's head; extracting the collection here is what lets
// the action-queue lens (public/render.mjs's actionQueue) surface every open
// stage instead of just the one the grid shows (single-source refactor, no
// parallel re-derivation — see slice-03-action-queue-lens.md's design frame).
// `project`/`marker` are shaped exactly as deriveWaitingOn documents them.
// `ownerLogin` (spec 009-04, OPTIONAL) is the owner's `gh` login captured once
// per scan — the identity the REVIEW-from-PR / External-from-PR split keys on.
// When it is null/empty those two PR branches are skipped (owner-identity
// guard); MERGE-from-PR is author-agnostic and needs no login. Each open PR
// (spec 009-04) is folded into the SAME list as a stage of its own, so the
// action-queue surfaces PR work cross-project exactly like slice work — within
// a rank, the disk-derived stage is pushed first, so the grid head (rank order)
// keeps its pre-009-04 tiebreak while the queue shows both.
export function deriveWaitingStages(project, marker, ownerLogin) {
  if (marker) return [forcedWaitingOn(marker)];

  const stages = [];
  const specs = project.specs || [];
  const allSlices = specs.flatMap((s) => (s.slices || []).map((sl) => ({ ...sl, specId: s.id })));
  const prs = project.prs || [];
  const hasOwner = typeof ownerLogin === 'string' && ownerLogin.length > 0;

  // MERGE (rank 1): reconciled slices to land, and/or an approved+CLEAN PR to
  // merge. The reconciled-slice stage is pushed first so the grid headline
  // keeps naming it over a PR when both qualify (deterministic tiebreak).
  const reconciled = allSlices.filter((sl) => sl.status === 'RECONCILED');
  if (reconciled.length) {
    stages.push({
      state: 'MERGE',
      verb: 'MERGE',
      action: `land ${reconciled.length} reconciled slice${reconciled.length === 1 ? '' : 's'}`,
      rank: 1,
    });
  }
  const mergeablePrs = prs.filter(prIsMergeable);
  if (mergeablePrs.length) {
    stages.push({ state: 'MERGE', verb: 'MERGE', action: `merge PR #${lowestPrNumber(mergeablePrs)}`, rank: 1 });
  }

  // REVIEW (rank 2): reviewed slices owed owner sign-off, and/or a PR awaiting
  // the OWNER's review (owner-identity guard — skipped without a known login;
  // a mergeable PR already fired MERGE, so it is excluded here to keep each PR
  // in one bucket).
  const reviewed = allSlices.filter((sl) => sl.status === 'REVIEWED');
  if (reviewed.length) {
    stages.push({
      state: 'REVIEW',
      verb: 'REVIEW',
      action: `review ${reviewed.length} finished slice${reviewed.length === 1 ? '' : 's'}`,
      rank: 2,
    });
  }
  if (hasOwner) {
    const reviewPrs = prs.filter(
      (p) => !prIsMergeable(p) && (p.reviewRequests || []).some((r) => r.login === ownerLogin),
    );
    if (reviewPrs.length) {
      stages.push({ state: 'REVIEW', verb: 'REVIEW', action: `review PR #${lowestPrNumber(reviewPrs)}`, rank: 2 });
    }
  }

  const youText = findYouNextStep(project.workstreams);
  // AC4 discrimination fix (2026-08-31 probe): a bare compass blocker is a
  // process/status note ("review not yet passed", "bug still REPORTED"), not
  // an owner decision — it must NOT fire DECIDE. Only a blocker that ITSELF
  // carries the **(you)** owner tag counts, same marker convention as
  // findYouNextStep above (ownerOf, not a plain non-empty check).
  const blockers = (project.compass && project.compass.blockers) || [];
  const youBlocker = blockers.find((b) => ownerOf(String(b)) === 'you');
  if (youText || youBlocker) {
    stages.push({ state: 'DECIDE', verb: 'DECIDE', action: fewWords(youText || cleanStepText(String(youBlocker))), rank: 3 });
  }

  const resumable = allSlices.find((sl) => sl.status === 'IN_PROGRESS');
  if (resumable) {
    stages.push({ state: 'Ready', verb: 'READY', action: `resume ${sliceToken(resumable.specId, resumable.file)}`, rank: 4 });
  }

  // AC4 taxonomy fix: READY_FOR_REVIEW (review passes not yet run) is
  // Claude-runnable, same as READY_FOR_IMPLEMENTATION/DRAFT — the taxonomy's
  // REVIEW bullet only covers a slice that has already cleared review
  // (status REVIEWED, handled above).
  const startable = allSlices.find(
    (sl) =>
      (sl.status === 'READY_FOR_REVIEW' || sl.status === 'READY_FOR_IMPLEMENTATION' || sl.status === 'DRAFT') &&
      depsSatisfied(sl.dependencies, specs)
  );
  if (startable) {
    stages.push({ state: 'Ready', verb: 'READY', action: `start ${sliceToken(startable.specId, startable.file)}`, rank: 5 });
  }

  // External (rank 6, spec 009-04) — now reachable: a PR out for SOMEONE ELSE's
  // review — a non-empty set of *user* reviewers with the owner NOT among them,
  // not MERGE-eligible. Owner-conditional: without a known ownerLogin we cannot
  // tell an owner-review PR from a someone-else PR, so the guard skips this
  // branch entirely (never mis-file an owner-review PR as External).
  if (hasOwner) {
    const externalPrs = prs.filter((p) => {
      // Only *User* review-requests (those carrying a `.login`) count. A review
      // requested from a **team** carries no login, so it cannot be keyed
      // against the owner — per assumption A4′ such a PR yields NO signal (falls
      // through to disk state) rather than a mis-filed External (craft-nit fix).
      const userReqs = (p.reviewRequests || []).filter((r) => r.login);
      if (!userReqs.length) return false;
      if (userReqs.some((r) => r.login === ownerLogin)) return false;
      return !prIsMergeable(p);
    });
    if (externalPrs.length) {
      stages.push({ state: 'External', verb: 'EXTERNAL', action: `PR #${lowestPrNumber(externalPrs)} out for review`, rank: 6 });
    }
  }

  return stages;
}

// The single derived waiting-on state for one scanned project (AC1/AC2): the
// highest-precedence candidate present, chosen from the pinned total order
// MERGE > REVIEW > DECIDE > Ready(resume) > Ready(start) > External > Idle.
// 009-03: re-expressed as deriveWaitingStages(...)[0] ?? Idle — the grid still
// gets exactly one state, byte-identical to the pre-refactor behaviour (a
// non-regression test pins this in test/lib.test.mjs). 009-04: threads the
// optional `ownerLogin` through; the two-arg contract 009-02 relied on is
// preserved (ownerLogin defaults to undefined).
export function deriveWaitingOn(project, marker, ownerLogin) {
  return deriveWaitingStages(project, marker, ownerLogin)[0] ?? IDLE_WAITING_ON;
}

// ===== Spec 012-01: roadmap tab — automatic order (pure, scanner-side) =====
// The page does no derivation (ADR-0001): everything below runs in the
// scanner and is emitted as `project.roadmap`. See docs/specs/012-project-
// roadmap-tab/spec.md "Automatic order (layer 1)".

// The current release track (A-009-01): the release-kind workstream whose
// goalProgress is incomplete, first in emitted order; null when none. Moved
// here from public/render.mjs (012-01 AC3) so the overview and the roadmap
// read ONE derivation — the scanner emits `currentReleasePath` from it.
export function currentReleaseTrack(p) {
  for (const w of (p && p.workstreams) || []) {
    if (w.kind === 'release' && w.goalProgress && w.goalProgress.done < w.goalProgress.total) return w;
  }
  return null;
}

// Slice name from the `## Slice NNN-NN — <name>` heading (A1); falls back to
// the filename stem so a hand-made slice still gets an honest label.
export function sliceNameFrom(body, file) {
  const m = String(body || '').match(/^##[ \t]+Slice[ \t]+\S+[ \t]*[—–-]+[ \t]*(.+?)[ \t]*$/m);
  if (m && m[1]) return m[1];
  return String(file || '').replace(/\.md$/, '');
}

const PROGRESS_RANK = {
  DRAFT: 0, READY_FOR_REVIEW: 1, READY_FOR_IMPLEMENTATION: 2,
  IN_PROGRESS: 3, REVIEWED: 4, RECONCILED: 5, DONE: 6,
};
const IN_FLIGHT = new Set(['IN_PROGRESS', 'REVIEWED', 'RECONCILED']);
const STARTED = new Set(['DONE', 'READY_FOR_REVIEW', 'READY_FOR_IMPLEMENTATION']);
const TIER_ORDER = { 'in-flight': 0, started: 1, 'not-started': 2 };

function chipFor(status) {
  if (status === 'DONE') return 'Done';
  if (IN_FLIGHT.has(status)) return 'In progress';
  if (status === 'DEFERRED') return 'Parked';
  return 'Planned';
}

function sliceNum(file) {
  const m = String(file).match(SLICE_FILE_RE);
  if (!m) return Infinity;
  return parseInt(m[2] !== undefined ? m[2] : m[1], 10);
}

function specNum(id) {
  const m = String(id).match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : Infinity;
}

// Real slices only: a `slice-*.md` without a `status:` is not a slice.
const realSlices = (spec) => (spec.slices || []).filter((s) => s.status);

function specTier(spec) {
  const ss = realSlices(spec);
  if (ss.some((s) => IN_FLIGHT.has(s.status))) return 'in-flight';
  if (ss.some((s) => STARTED.has(s.status))) return 'started';
  return 'not-started';
}

function isUnfinished(spec) {
  const ss = realSlices(spec);
  if (ss.length === 0) return spec.status !== 'DONE' && spec.status !== 'ABANDONED';
  return ss.some((s) => s.status !== 'DONE' && s.status !== 'DEFERRED' && s.status !== 'ABANDONED');
}

// Spec-id the slice belongs to is implied by the spec; a `NNN-MM` dependency
// is same-spec when NNN matches this spec's number.
function orderSlices(spec, slices) {
  const byNum = new Map(slices.map((s) => [sliceNum(s.file), s]));
  const myNum = specNum(spec.id);
  const depsOf = new Map(
    slices.map((s) => {
      const out = new Set();
      for (const d of s.dependencies || []) {
        const m = String(d).match(/^(\d{3})-(\d{2})$/);
        if (!m || parseInt(m[1], 10) !== myNum) continue;
        const t = byNum.get(parseInt(m[2], 10));
        if (t && t !== s) out.add(t);
      }
      return [s, out];
    }),
  );
  const byNumber = (a, b) => sliceNum(a.file) - sliceNum(b.file) || a.file.localeCompare(b.file);
  const remaining = [...slices].sort(byNumber);
  const placed = new Set();
  const out = [];
  while (remaining.length) {
    const i = remaining.findIndex((s) => [...depsOf.get(s)].every((d) => placed.has(d)));
    if (i === -1) return [...slices].sort(byNumber); // cycle → slice-number order
    const [s] = remaining.splice(i, 1);
    placed.add(s);
    out.push(s);
  }
  return out;
}

// ---- 012-02: slice goal / trigger text ----
// Fixed display cap (chars, ellipsis included) for both goal and trigger.
export const TEXT_CAP = 300;

// Markdown → plain text: links, emphasis, inline-code backticks removed.
function plainText(t) {
  // Code spans are lifted out first so their `_`/`*` survive emphasis stripping.
  const code = [];
  const out = String(t)
    .replace(/`+([^`]*)`+/g, (_, c) => `\u0000${code.push(c) - 1}\u0000`)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,;:!?]|$)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => code[+i]);
}

// The paragraph after a bold label: the label line's remainder plus following
// lines up to a blank line, heading, list item, code fence or next bold label.
function labelParagraph(body, labelRe) {
  const lines = String(body || '').split('\n');
  const i = lines.findIndex((l) => labelRe.test(l));
  if (i === -1) return null;
  const parts = [lines[i].replace(labelRe, '')];
  for (let j = i + 1; j < lines.length; j++) {
    const l = lines[j];
    if (/^\s*$/.test(l) || /^#{1,6}\s/.test(l) || /^\s*([-*+]|\d+[.)])\s/.test(l) || /^\s*```/.test(l) || /^\s*\*\*[^*]+:\*\*/.test(l)) break;
    parts.push(l);
  }
  const text = plainText(parts.join(' '));
  return text || null;
}

const ABBREV = /(?:^|[\s(])(?:e\.g|i\.e|etc|vs|cf|approx|incl|resp)\.$/i;

// First sentence: ends at . ! ? followed by whitespace and a non-lowercase
// start, unless the dot closes a known abbreviation. Dots inside filenames and
// versions are never followed by whitespace, so they never split.
function firstSentence(text) {
  const re = /[.!?]+(?=\s+[^a-z\s])/g;
  let m;
  while ((m = re.exec(text))) {
    const end = m.index + m[0].length;
    if (m[0] === '.' && ABBREV.test(text.slice(0, m.index + 1))) continue;
    return { sentence: text.slice(0, end), cut: true };
  }
  return { sentence: text, cut: false };
}

function capText(text, cut) {
  let t = text;
  if (t.length > TEXT_CAP) {
    t = t.slice(0, TEXT_CAP - 1);
    const sp = t.lastIndexOf(' ');
    if (sp > TEXT_CAP * 0.6) t = t.slice(0, sp);
    return t.replace(/[\s.,;:]+$/, '') + '…';
  }
  return cut ? t.replace(/[.\s]+$/, '') + '…' : t;
}

export function extractSliceGoal(body) {
  const t = labelParagraph(body, /^\s*\*\*Goal:\*\*[ \t]*/) ?? labelParagraph(body, /^\s*\*\*Goal\s*\([^)]*\):\*\*[ \t]*/);
  if (!t) return null;
  const { sentence, cut } = firstSentence(t);
  return capText(sentence, cut);
}

export function extractSliceTrigger(body) {
  const t = labelParagraph(body, /^\s*\*\*Resolution trigger:\*\*[ \t]*/);
  return t ? capText(t, false) : null;
}

const card = (spec, s) => ({
  id: sliceToken(spec.id, s.file),
  file: s.file,
  name: s.name || sliceNameFrom('', s.file),
  status: s.status,
  chip: chipFor(s.status),
  dependsOn: Array.isArray(s.dependencies) ? s.dependencies : [],
  goal: s.goal || null,
});

// Worktree hint (012-01 AC10). `rootSpecs`: scanned spec records; `worktrees`:
// one `[{id, slices:[{file,status}]}]` list per considered (non-root)
// worktree, read from disk. N = slices strictly further along than root plus
// slices only in a worktree inside a spec folder the root has; M = spec
// folders absent from the root. DEFERRED/ABANDONED never rank as further.
export function worktreeHint(rootSpecs, worktrees) {
  const rootById = new Map((rootSpecs || []).map((s) => [s.id, s]));
  const best = new Map(); // `${specId}/${file}` → highest eligible rank
  const onlySpecs = new Set();
  const seenNew = new Set();
  let further = 0;
  for (const wt of worktrees || []) {
    for (const ws of wt || []) {
      const rootSpec = rootById.get(ws.id);
      if (!rootSpec) {
        onlySpecs.add(ws.id);
        continue;
      }
      const rootSlices = new Map((rootSpec.slices || []).map((s) => [s.file, s]));
      for (const s of ws.slices || []) {
        if (!s.status || !(s.status in PROGRESS_RANK)) continue;
        const key = `${ws.id}/${s.file}`;
        const rank = PROGRESS_RANK[s.status];
        const rootSlice = rootSlices.get(s.file);
        if (!rootSlice) {
          if (!seenNew.has(key)) { seenNew.add(key); further++; }
          continue;
        }
        const rootRank = rootSlice.status in PROGRESS_RANK ? PROGRESS_RANK[rootSlice.status] : -1;
        if (rank > rootRank && rank > (best.get(key) ?? -1)) best.set(key, rank);
      }
    }
  }
  return { further: further + best.size, onlyInWorktrees: onlySpecs.size };
}

// Builds the roadmap model the tab renders. Inputs: `specs` (scanned records;
// each may carry `recency`, epoch seconds), `track` (the current release
// workstream or null; carries `includeTokens`), `branch` (root checkout's
// branch), `worktrees` (see worktreeHint).
export function deriveRoadmap({ specs = [], track = null, branch = null, worktrees = [] } = {}) {
  const includeTokens = (track && Array.isArray(track.includeTokens)) ? track.includeTokens : [];
  const inRelease = new Set();
  const releaseSlices = [];
  if (track) {
    for (const t of includeTokens) {
      const r = /^\d{3}-\d{2}$/.test(t) ? resolveToken(t, specs) : { cls: 'unresolved', spec: null };
      if (r.slice && r.spec) {
        inRelease.add(r.spec.id);
        releaseSlices.push(card(r.spec, r.slice));
      } else {
        releaseSlices.push({ id: t, file: null, name: 'not written yet', status: null, chip: 'Planned', dependsOn: [] });
      }
    }
  }

  const unfinished = specs.filter(isUnfinished);
  unfinished.sort((a, b) => {
    const ra = inRelease.has(a.id) ? 0 : 1;
    const rb = inRelease.has(b.id) ? 0 : 1;
    if (ra !== rb) return ra - rb;
    const ta = TIER_ORDER[specTier(a)];
    const tb = TIER_ORDER[specTier(b)];
    if (ta !== tb) return ta - tb;
    const ca = a.recency || 0;
    const cb = b.recency || 0;
    if (ca !== cb) return cb - ca;
    return specNum(a.id) - specNum(b.id) || a.id.localeCompare(b.id);
  });

  const groupOf = (spec) => {
    const shown = realSlices(spec).filter((s) => s.status !== 'DEFERRED' && s.status !== 'ABANDONED');
    return { id: spec.id, title: spec.title, tier: specTier(spec), slices: orderSlices(spec, shown).map((s) => card(spec, s)) };
  };
  const ordered = unfinished.map(groupOf);
  const done = specs
    .filter((s) => !isUnfinished(s) && s.status !== 'ABANDONED')
    .filter((s) => {
      const ss = realSlices(s);
      return ss.length === 0 || ss.some((x) => x.status !== 'ABANDONED');
    })
    .map(groupOf);

  // 012-02 AC3: one card per DEFERRED slice, every spec (finished ones too)
  // except those whose own status is ABANDONED; the count is its length.
  const parkedCards = [];
  const bySpec = [...specs].sort((a, b) => specNum(a.id) - specNum(b.id) || String(a.id).localeCompare(String(b.id)));
  for (const spec of bySpec) {
    if (spec.status === 'ABANDONED') continue;
    for (const s of orderSlices(spec, realSlices(spec).filter((x) => x.status === 'DEFERRED'))) {
      parkedCards.push({ ...card(spec, s), trigger: s.trigger || null });
    }
  }
  const parked = parkedCards.length;

  const sequence = [];
  if (track) {
    sequence.push({ kind: 'release', title: track.title, label: 'Now · We are here' });
    // Steps 2-3: the next ordered specs the release does NOT already cover.
    for (const g of ordered.filter((x) => !inRelease.has(x.id)).slice(0, 2)) {
      sequence.push({ kind: 'spec', id: g.id, title: g.title, label: 'Then' });
    }
  } else if (ordered.length) {
    const first = ordered[0];
    sequence.push({ kind: 'spec', id: first.id, title: first.title, label: first.tier === 'not-started' ? 'Next up' : 'Now · We are here' });
    for (const g of ordered.slice(1, 3)) sequence.push({ kind: 'spec', id: g.id, title: g.title, label: 'Then' });
  }
  if (parked > 0) sequence.push({ kind: 'parked', label: `${parked} parked` });

  const hint = worktreeHint(specs, worktrees);
  return {
    asOf: branch || null,
    worktreeHint: hint.further || hint.onlyInWorktrees ? hint : null,
    release: track ? { title: track.title, slices: releaseSlices } : null,
    sequence,
    specs: ordered,
    done,
    parked: parkedCards,
    parkedCount: parked,
    empty: specs.length === 0 ? 'no-specs' : ordered.length === 0 && !track ? 'nothing-planned' : null,
  };
}

// One `git log --format=%ct --name-only -- docs/specs` pass → Map<specDir,
// newest commit timestamp> (012-01 AC11: one git call per repo, not per spec).
export function parseRecencyLog(text) {
  const out = new Map();
  let ts = null;
  for (const line of String(text || '').split('\n')) {
    if (/^\d{9,}$/.test(line)) { ts = parseInt(line, 10); continue; }
    const m = line.match(/^docs\/specs\/([^/]+)\/./);
    if (!m || ts === null) continue;
    if (!(out.has(m[1]) && out.get(m[1]) >= ts)) out.set(m[1], ts);
  }
  return out;
}

// `git worktree list --porcelain` → the root checkout's branch (null when
// detached / the root is not listed), whether the root is itself a worktree
// top-level (a project in a repo SUBDIRECTORY is not), and every other path.
export function parseWorktreeList(text, root) {
  const norm = (p) => String(p).replace(/\/+$/, '');
  let branch = null;
  let rootListed = false;
  const others = [];
  for (const block of String(text || '').split(/\n\s*\n/)) {
    const lines = block.split('\n');
    const wt = lines.find((l) => l.startsWith('worktree '));
    if (!wt) continue;
    const p = norm(wt.slice('worktree '.length));
    if (lines.some((l) => l === 'bare')) continue;
    if (p === norm(root)) {
      rootListed = true;
      const b = lines.find((l) => l.startsWith('branch '));
      branch = b ? b.slice('branch '.length).replace(/^refs\/heads\//, '') : null;
    } else {
      others.push(p);
    }
  }
  return { branch, others, rootListed };
}
