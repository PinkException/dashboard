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
