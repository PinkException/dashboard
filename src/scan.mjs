// Deterministic scanner over configured jig project roots (spec 002).
// Read-only over other repos; the only writes anywhere are in this repo.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
  parseFrontmatter,
  normStatus,
  progressOf,
  parseRunbook,
  countCheckboxes,
  countInboxItems,
  countRefinement,
  parseCompassHistory,
  laterSnapshot,
  ageLabel,
  ageDays,
  BUG_CLOSED,
  encodeCwdSlug,
  attributeSessionDir,
  worktreeFromCwd,
  foldTranscriptLine,
  resolveSessionTitle,
  compareSessionOrder,
  parseIncludeTokens,
  resolveReleaseGoal,
  deriveWaitingOn,
  deriveWaitingStages,
} from './lib.mjs';

export function expandHome(p) {
  return p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
}

// The config lives outside every repo (the installed plugin runs from
// Claude's plugin cache, and project lists are private): DASHBOARD_CONFIG
// overrides, otherwise ~/.claude/my-dashboard/config.json.
export function resolveConfigPath() {
  if (process.env.DASHBOARD_CONFIG) return expandHome(process.env.DASHBOARD_CONFIG);
  return path.join(os.homedir(), '.claude', 'my-dashboard', 'config.json');
}

// Snapshots are per-user state and live beside the config, never in a repo
// (ADR-0004 §1, vision principle 1+6). Derived from the *resolved config path*
// rather than a second hard-coded literal, so a DASHBOARD_CONFIG override moves
// config and snapshots together instead of silently splitting them.
export function resolveSnapshotsDir() {
  if (process.env.DASHBOARD_SNAPSHOTS) return expandHome(process.env.DASHBOARD_SNAPSHOTS);
  return path.join(path.dirname(resolveConfigPath()), 'snapshots');
}

// The local Claude Code session store (spec 003, Assumptions A1-A3): running
// sidecars + transcripts. Read-only, never written to (AC9). Overridable —
// DASHBOARD_SESSION_STORE for tests/dev, then a `sessionStore` config field,
// else the real default — mirroring the DASHBOARD_CONFIG/DASHBOARD_SNAPSHOTS
// override pattern above (AC1).
export function resolveSessionStore(config) {
  if (process.env.DASHBOARD_SESSION_STORE) return expandHome(process.env.DASHBOARD_SESSION_STORE);
  if (config && config.sessionStore) return expandHome(config.sessionStore);
  return path.join(os.homedir(), '.claude');
}

const realpath = (p) => {
  try {
    return fs.realpathSync(p);
  } catch {
    return p;
  }
};

// The identity a project's history is keyed on.
//
// A linked worktree resolves to its parent repo, so a project and its worktrees
// share one history instead of forking it — the fragmentation ADR-0004 exists to
// remove. But a project configured at a *subdirectory* of some repo (a package in
// a monorepo, or a fixture tree inside this repo) is its own project and must NOT
// inherit that repo's key, or two configured projects would silently merge
// histories — the cross-contamination ADR-0004 OQ4 names.
//
// Distinguishing the two: `--show-toplevel` is the working tree the path sits in.
// For a worktree root or a repo root it equals the path itself, so the shared
// parent key is correct. For a subdirectory it does not, so we key on the path.
// Null for a non-git directory.
function repoRootOf(root) {
  const git = (args) =>
    execFileSync('git', ['-C', root, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  try {
    const toplevel = git(['rev-parse', '--show-toplevel']);
    // path.resolve both sides: git emits forward slashes even on Windows.
    if (!toplevel || path.resolve(realpath(toplevel)) !== path.resolve(realpath(root))) return null;
    const common = git(['rev-parse', '--git-common-dir']);
    if (!common) return toplevel;
    // git prints '.git' relative to the repo for a primary worktree and an
    // absolute path for a linked one; resolving against root handles both.
    const resolved = path.resolve(root, common);
    // Only a directory literally named `.git` points at a parent working tree.
    // A submodule's common dir is `<superproject>/.git/modules/<name>`, whose
    // dirname is shared by *every* submodule of that superproject — folding on
    // it would merge unrelated projects into one history. A submodule is its
    // own project, so key it on its own root.
    if (path.basename(resolved) !== '.git') return toplevel;
    return path.dirname(resolved);
  } catch {
    return null;
  }
}

// The canonical directory a project's history is keyed on: a linked worktree
// folds to its parent repo, a subdirectory or submodule keeps its own root.
// Exported so 005-02's migration resolves identity through exactly this rule —
// and can apply an owner-confirmed alias to the *resolved root* rather than to
// a raw file path (ADR-0004 OQ4).
export function projectRootOf(root) {
  return realpath(repoRootOf(root) ?? path.resolve(root));
}

// Resolving the key shells out to git, and the server re-scans on every request,
// so memoize per root (spec assumption A2). Note the cache is never invalidated:
// within a long-lived server a root that *becomes* a repo keeps its earlier key
// until restart. Acceptable for the writer; flagged as an input to 005-02.
const keyCache = new Map();

// Stable, filename-safe, collision-free key for one project's snapshot file.
// The basename keeps it recognisable; the path digest keeps two projects that
// merely share a basename apart. Exported so 005-02's migration reuses exactly
// this mapping rather than inventing a second one.
export function projectKey(root) {
  const cached = keyCache.get(root);
  if (cached) return cached;
  const base = projectRootOf(root);
  const name =
    path.basename(base).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'project';
  const key = `${name}-${createHash('sha256').update(base).digest('hex').slice(0, 8)}`;
  keyCache.set(root, key);
  return key;
}

export function snapshotFileFor(root) {
  return path.join(resolveSnapshotsDir(), `${projectKey(root)}.jsonl`);
}

// Thrown by loadConfig when the resolved config path does not exist — the
// fresh-install case (slice 007-01). `code: 'CONFIG_MISSING'` lets callers
// (the CLI, the server) distinguish this from a malformed-JSON or other I/O
// failure without string-matching the message.
export class ConfigMissingError extends Error {
  constructor(configPath) {
    super(`dashboard config not found at ${configPath} — run /dashboard:open to create one`);
    this.name = 'ConfigMissingError';
    this.code = 'CONFIG_MISSING';
    this.configPath = configPath;
  }
}

export function loadConfig(configPath) {
  let raw;
  try {
    raw = fs.readFileSync(configPath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') throw new ConfigMissingError(configPath);
    throw err;
  }
  const cfg = JSON.parse(raw);
  cfg.projects = (cfg.projects || []).map((p) => ({
    pinnedWorkstreams: [],
    hiddenWorkstreams: [],
    ...p,
    path: expandHome(p.path),
  }));
  return cfg;
}

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function readIf(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build']);

function* walkMd(dir, base) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) yield* walkMd(path.join(dir, e.name), base);
    } else if (e.name.endsWith('.md')) {
      yield path.relative(base, path.join(dir, e.name));
    }
  }
}

function scanSpecs(root) {
  const specsDir = path.join(root, 'docs', 'specs');
  if (!isDir(specsDir)) return null;
  const specs = [];
  for (const entry of fs.readdirSync(specsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(specsDir, entry.name);
    const raw = readIf(path.join(dir, 'spec.md'));
    if (raw === null) continue;
    const { data, body } = parseFrontmatter(raw);
    const titleMatch = body.match(/^#\s+(.+)$/m);
    const title = titleMatch
      ? titleMatch[1].replace(/^Spec\s+\d+\s*[:—-]\s*/i, '').trim()
      : entry.name;
    const slices = [];
    for (const f of fs.readdirSync(dir).sort()) {
      if (!/^slice-.*\.md$/.test(f)) continue;
      const fm = parseFrontmatter(readIf(path.join(dir, f)) || '').data;
      slices.push({
        file: f,
        status: normStatus(fm.status),
        dependencies: Array.isArray(fm.dependencies) ? fm.dependencies : [],
        lastVerified: fm.last_verified || null,
      });
    }
    specs.push({ id: entry.name, title, status: normStatus(data.status), slices });
  }
  specs.sort((a, b) => a.id.localeCompare(b.id));
  return specs;
}

function scanBugs(root) {
  const dir = path.join(root, 'docs', 'bugs');
  if (!isDir(dir)) return { open: 0, total: 0 };
  let open = 0;
  let total = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.md') || f.toLowerCase() === 'readme.md') continue;
    total++;
    const status = normStatus(parseFrontmatter(readIf(path.join(dir, f)) || '').data.status);
    if (!status || !BUG_CLOSED.has(status)) open++;
  }
  return { open, total };
}

function gitInfo(root) {
  const run = (args) =>
    execFileSync('git', ['-C', root, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  try {
    const commits = parseInt(run(['rev-list', '--count', 'HEAD']), 10);
    const lastCommit = run(['log', '-1', '--format=%cs']);
    const firstCommit = run(['log', '--reverse', '--format=%cs']).split('\n')[0];
    return { firstCommit, lastCommit, commits };
  } catch {
    return null;
  }
}

function scanWorkstreams(root, projectCfg, specs) {
  const workstreams = [];
  const discovered = [];
  const pinned = new Set(projectCfg.pinnedWorkstreams);
  const hidden = new Set(projectCfg.hiddenWorkstreams);
  const docsDir = path.join(root, 'docs');

  const releasesDir = path.join(docsDir, 'releases');
  if (isDir(releasesDir)) {
    for (const f of fs.readdirSync(releasesDir).sort()) {
      if (!f.endsWith('.md') || f.toLowerCase() === 'readme.md') continue;
      const rel = path.join('docs', 'releases', f);
      if (hidden.has(rel)) continue;
      const body = readIf(path.join(releasesDir, f)) || '';
      const rb = parseRunbook(body);
      const ws = { kind: 'release', path: rel, ...rb };
      // Spec 008-01: a shaper release plan's Cutline `### Include` names its
      // gating slices — a meter is shown iff at least one token is extracted
      // (Counting rule); zero tokens leaves today's title-only render intact.
      // Spec 008-02 AC4: tokens can still resolve to an honest total of zero
      // when every reference is parked (DEFERRED/ABANDONED, excluded from the
      // Counting rule's denominator) — that must ALSO degrade to title-only,
      // since "0 of 0 landed" is never a meaningful meter to show.
      const tokens = parseIncludeTokens(body);
      if (tokens.length >= 1) {
        const goal = resolveReleaseGoal(tokens, specs || []);
        if (goal.goalProgress.total >= 1) {
          Object.assign(ws, goal);
        }
      }
      workstreams.push(ws);
    }
  }

  for (const rel of projectCfg.pinnedWorkstreams) {
    // Release plans render unconditionally above — a pin there would duplicate the row.
    if (rel.startsWith(path.join('docs', 'releases') + path.sep)) continue;
    const abs = path.join(root, rel);
    const raw = readIf(abs);
    if (raw === null) continue; // missing pin → the worktree scan may explain why
    workstreams.push({ kind: 'runbook', path: rel, ...parseRunbook(raw) });
  }

  if (isDir(docsDir)) {
    for (const rel of walkMd(docsDir, root)) {
      if (rel.startsWith(path.join('docs', 'specs') + path.sep)) continue;
      if (rel.startsWith(path.join('docs', 'releases') + path.sep)) continue;
      // Bugs have their own counter; their DoD checklists are not workstreams.
      if (rel.startsWith(path.join('docs', 'bugs') + path.sep)) continue;
      // Scaffold boilerplate, identical in every jig project — pin explicitly if wanted.
      if (rel === path.join('docs', 'adoption-readiness.md')) continue;
      if (pinned.has(rel) || hidden.has(rel)) continue;
      const raw = readIf(path.join(root, rel));
      if (raw === null) continue;
      const boxes = countCheckboxes(raw);
      if (boxes.total >= 3) {
        const rb = parseRunbook(raw);
        discovered.push({ path: rel, title: rb.title, steps: boxes });
      }
    }
  }
  return { workstreams, discovered };
}

const WORKTREE_DOC_CAP = 40;

function scanWorktreeOnlyDocs(root) {
  const wtRoot = path.join(root, '.claude', 'worktrees');
  if (!isDir(wtRoot)) return [];
  const out = [];
  const seen = new Set();
  for (const wt of fs.readdirSync(wtRoot, { withFileTypes: true })) {
    if (!wt.isDirectory()) continue;
    const wtBase = path.join(wtRoot, wt.name);
    const wtDocs = path.join(wtBase, 'docs');
    if (!isDir(wtDocs)) continue;
    for (const rel of walkMd(wtDocs, wtBase)) {
      if (seen.has(rel)) continue;
      seen.add(rel);
      // Path-existence comparison only, never content diffing (slice 002-02 AC4).
      if (!fs.existsSync(path.join(root, rel))) {
        out.push({ worktree: wt.name, path: rel });
        if (out.length >= WORKTREE_DOC_CAP) return out;
      }
    }
  }
  return out;
}

const EMPTY_COMPASS = { latest: null, latestNarrative: null, malformed: 0, count: 0 };

// Reads both sources during the migration window (ADR-0004 §5): the
// dashboard-owned store, and the project's legacy in-repo file that 005-02 has
// not yet migrated. Whichever carries the later `ts` wins — see laterSnapshot
// for why comparing timestamps beats concatenating the two files.
function scanCompass(root) {
  const readSource = (p) => {
    const raw = readIf(p);
    return raw === null ? EMPTY_COMPASS : parseCompassHistory(raw);
  };
  const inRepo = readSource(path.join(root, 'docs', 'status', 'compass-history.jsonl'));
  const fromStore = readSource(snapshotFileFor(root));
  // The card displays the latest narrative (human/skill) entry across both
  // sources, falling back to the latest entry overall only when no prose entry
  // exists anywhere (slice 005-04). This keeps the routine's deterministic
  // `auto` series — which feeds the future evolution chart — from taking over
  // the card headline, which is 005-03's delivered value.
  const narrative = laterSnapshot(inRepo.latestNarrative, fromStore.latestNarrative);
  const overall = laterSnapshot(inRepo.latest, fromStore.latest);
  return {
    latest: narrative ?? overall,
    malformed: inRepo.malformed + fromStore.malformed,
    count: inRepo.count + fromStore.count,
    // How many of the two sources held at least one line — the warning names
    // this rather than one filename, since a malformed line may be from either.
    sources: (inRepo.count > 0 ? 1 : 0) + (fromStore.count > 0 ? 1 : 0),
  };
}

// spec 009-04: gh-optional PR enrichment. `gh` is an optional external binary
// of the same category as the existing `git` shell-out (ADR-0006 / ADR-0001 —
// a shelled binary is not a bundled npm dependency). All gh access degrades to
// no-PR on ANY failure (missing binary, unauthenticated, timeout, bad JSON),
// never crashing the scan (AC2/AC3).
const GH_TIMEOUT_MS = 5000;

// Builds the once-per-scan gh context. `run` is injectable (defaults to
// execFileSync) so tests exercise the real probe/read logic with a fake runner
// and never depend on the host's gh binary. Returns
// `{ available, ownerLogin, listPRs(root) }`. The owner login is captured once
// (AC3) — the identity deriveWaitingOn's REVIEW/External split keys on. On any
// probe failure the context degrades to unavailable with a no-op listPRs.
export function buildGhContext(run = execFileSync) {
  const opts = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: GH_TIMEOUT_MS, killSignal: 'SIGKILL' };
  let ownerLogin = null;
  try {
    const login = run('gh', ['api', 'user', '--jq', '.login'], opts).trim();
    if (login) ownerLogin = login;
  } catch {
    return { available: false, ownerLogin: null, listPRs: () => [] };
  }
  if (!ownerLogin) return { available: false, ownerLogin: null, listPRs: () => [] };
  return {
    available: true,
    ownerLogin,
    listPRs(root) {
      const out = run(
        'gh',
        // `--limit 100` overrides gh's default cap of 30, so a repo with many
        // open PRs isn't silently truncated (craft-nit fix); the derivation
        // scans all of them, not just the lowest-numbered page.
        ['pr', 'list', '--state', 'open', '--limit', '100', '--json', 'number,title,url,author,isDraft,reviewDecision,mergeStateStatus,reviewRequests'],
        { ...opts, cwd: root },
      );
      return JSON.parse(out);
    },
  };
}

export function scanProject(projectCfg, gh) {
  const root = projectCfg.path;
  const name = projectCfg.label || path.basename(root);
  // Spec 009-01 AC2: an optional one-line project description, surfaced
  // unchanged from config — omitted (not `null`) when absent, no error.
  const description = projectCfg.description || null;
  if (!isDir(root)) {
    return {
      name,
      path: root,
      error: 'path does not exist',
      ...(description ? { description } : {}),
    };
  }
  const specs = scanSpecs(root);
  const jigManaged = specs !== null;
  const result = {
    name,
    path: root,
    jigManaged,
    git: gitInfo(root),
    ...(description ? { description } : {}),
  };
  if (!jigManaged) return result;

  const allSlices = specs.flatMap((s) => s.slices);
  result.specs = specs;
  result.progress = progressOf(specs);
  result.sliceProgress = allSlices.length ? progressOf(allSlices) : null;
  result.counts = {
    bugs: scanBugs(root),
    refinement: countRefinement(readIf(path.join(root, 'docs', 'refinement-todo.md')) || ''),
    inbox: countInboxItems(readIf(path.join(root, 'docs', 'inbox.md')) || ''),
    adrs: isDir(path.join(root, 'docs', 'decisions'))
      ? fs.readdirSync(path.join(root, 'docs', 'decisions')).filter((f) => /^adr-\d+.*\.md$/.test(f)).length
      : 0,
  };
  Object.assign(result, scanWorkstreams(root, projectCfg, specs));
  result.worktreeOnlyDocs = scanWorktreeOnlyDocs(root);
  const compass = scanCompass(root);
  result.compass = compass.latest
    ? {
        ...compass.latest,
        ageLabel: ageLabel(compass.latest.ts),
        ageDays: ageDays(compass.latest.ts),
        stale: (ageDays(compass.latest.ts) ?? 0) > 7,
      }
    : null;
  result.warnings = [];
  if (compass.malformed > 0) {
    result.warnings.push(
      `compass history (${compass.sources} source(s)): ${compass.malformed} malformed line(s) skipped`,
    );
  }
  // Spec 009-02: the single derived waiting-on state, scan-side (deriveWaitingOn
  // lives in src/lib.mjs, never imported by the browser). `projectCfg.needsYou`
  // is the AC3 owner-settable marker backstop — loadConfig already spreads
  // arbitrary config keys through onto projectCfg, so no config-schema change
  // was needed to read it here.
  // spec 009-04: fold the project's open PRs into the triage signal, gated on
  // an available gh context. Placed AFTER the `if (!jigManaged) return` above,
  // so non-jig projects make no gh call. Drafts are filtered before attach; any
  // failure degrades to no `prs` (never crashes the scan). The owner login is
  // attached so the pure detail-view renderer can key each PR's hint on it.
  if (gh && gh.available) {
    result.ownerLogin = gh.ownerLogin;
    try {
      const prs = gh.listPRs(root);
      if (Array.isArray(prs)) result.prs = prs.filter((p) => !p.isDraft);
    } catch {
      // not-a-git-repo, no GitHub remote, timeout, bad JSON → no PR signal.
    }
  }
  const ownerLogin = gh && gh.ownerLogin;
  result.waitingOn = deriveWaitingOn(result, projectCfg.needsYou, ownerLogin);
  // Spec 009-03: the full rank-ordered stage list `waitingOn` collapses to
  // its head — the action-queue lens (public/render.mjs's actionQueue) reads
  // this instead of re-deriving, so the two lenses cannot disagree (AC5:
  // waitingOn === waitingStages[0] by construction). Spec 009-04 threads the
  // owner login through so PR stages surface in the queue too.
  result.waitingStages = deriveWaitingStages(result, projectCfg.needsYou, ownerLogin);
  return result;
}

// Sessions "active" iff running or within this many days of last activity
// (AC5). The emitted list per project is capped, with the pre-cap count
// recorded separately so the page can show a "+N" overflow.
export const SESSION_ACTIVE_DAYS = 7;
export const SESSION_CAP = 20;

// Running sidecars: `<store>/sessions/*.json`, one per live process, keyed by
// PID filename, carrying `sessionId` (+ `cwd`, `name`, `nameSource`). Presence
// of a sessionId here == running (AC3). Lenient per A4: a malformed sidecar
// is skipped, never fatal; a missing `sessions/` dir (no sessions running
// right now) is a normal, silent empty result — not the same as an
// unreadable *store* (AC6), which is signalled by listSessionDirs below.
function readRunningSidecars(storeDir) {
  const out = new Map();
  let entries;
  try {
    entries = fs.readdirSync(path.join(storeDir, 'sessions'), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith('.json')) continue;
    let obj;
    try {
      obj = JSON.parse(fs.readFileSync(path.join(storeDir, 'sessions', e.name), 'utf8'));
    } catch {
      continue;
    }
    if (obj && typeof obj.sessionId === 'string') {
      out.set(obj.sessionId, { name: obj.name ?? null, nameSource: obj.nameSource ?? null });
    }
  }
  return out;
}

// Lists `<store>/projects/` directory names — null signals the store itself
// is missing/unreadable (AC6), distinct from "readable but empty."
function listSessionDirs(storeDir) {
  try {
    return fs
      .readdirSync(path.join(storeDir, 'projects'), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return null;
  }
}

// Bounded/streamed line reader over a transcript file (AC7): reads in fixed-
// size chunks via synchronous core `fs` calls (no npm dep, no readline —
// readline's stream/event API doesn't fit this codebase's fully-synchronous
// scan pipeline, see the slice's deviation log) and yields complete lines as
// they're found. Memory is bounded to one chunk + one in-flight line, never
// the whole file. Lines are decoded from complete byte spans only (buffered
// as a Buffer, split on the raw '\n' byte), so a multi-byte UTF-8 character
// split across a chunk boundary is never mis-decoded.
const READ_CHUNK_BYTES = 64 * 1024;

function* readLinesSync(filePath) {
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
  } catch {
    return;
  }
  try {
    const chunk = Buffer.alloc(READ_CHUNK_BYTES);
    let leftover = Buffer.alloc(0);
    for (;;) {
      let n;
      try {
        n = fs.readSync(fd, chunk, 0, READ_CHUNK_BYTES, null);
      } catch {
        break;
      }
      if (n === 0) break;
      leftover = Buffer.concat([leftover, chunk.subarray(0, n)]);
      let idx;
      while ((idx = leftover.indexOf(10)) !== -1) {
        yield leftover.subarray(0, idx).toString('utf8');
        leftover = leftover.subarray(idx + 1);
      }
    }
    if (leftover.length) yield leftover.toString('utf8');
  } finally {
    try {
      fs.closeSync(fd);
    } catch {
      // already closed or never opened — nothing to do
    }
  }
}

// Phase 2 (AC7): bounded read of ONE emitted transcript, resolving title
// (AC2), branch (AC6), and a refined worktree from the body's own `cwd`.
// Malformed JSON lines are skipped, never fatal (A4 leniency).
function readTranscriptBody(filePath) {
  const acc = { customTitle: null, firstHumanText: null, lastGitBranch: null, lastCwd: null };
  for (const line of readLinesSync(filePath)) {
    if (!line.trim()) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    foldTranscriptLine(acc, obj);
  }
  return {
    acc,
    branch: acc.lastGitBranch && acc.lastGitBranch !== 'HEAD' ? acc.lastGitBranch : null,
    worktree: worktreeFromCwd(acc.lastCwd),
  };
}

// The full two-phase reader (AC1, AC4, AC5, AC7): body-free triage over every
// configured project's attributed session directories, then a bounded body
// read for only the capped, emitted set. Returns a Map keyed by project path
// -> `{ sessions, sessionsTotal, warning? }`. Never throws — a missing or
// unreadable store degrades every project to `{ sessions: [], sessionsTotal: 0,
// warning }` (AC6).
export function readAllSessions(projects, opts = {}) {
  const { storeDir = resolveSessionStore(), now = Date.now(), cap = SESSION_CAP, activeDays = SESSION_ACTIVE_DAYS } = opts;
  const result = new Map(projects.map((p) => [p.path, { sessions: [], sessionsTotal: 0 }]));

  const dirNames = listSessionDirs(storeDir);
  if (dirNames === null) {
    for (const p of projects) {
      result.set(p.path, {
        sessions: [],
        sessionsTotal: 0,
        warning: `session store unreadable at ${storeDir}`,
      });
    }
    return result;
  }

  const running = readRunningSidecars(storeDir);
  const roots = projects.map((p) => ({ root: p.path, slug: encodeCwdSlug(p.path) }));
  const byRoot = new Map(projects.map((p) => [p.path, []]));

  for (const dirName of dirNames) {
    const attribution = attributeSessionDir(dirName, roots);
    if (!attribution) continue; // no configured root claims this directory (AC4)
    const dirPath = path.join(storeDir, 'projects', dirName);
    let files;
    try {
      files = fs.readdirSync(dirPath);
    } catch {
      continue;
    }
    for (const f of files) {
      if (!f.endsWith('.jsonl')) continue; // a transcript dir may hold non-session entries (e.g. memory/)
      const id = f.slice(0, -'.jsonl'.length);
      let mtimeMs;
      try {
        mtimeMs = fs.statSync(path.join(dirPath, f)).mtimeMs;
      } catch {
        continue;
      }
      const isRunning = running.has(id);
      byRoot.get(attribution.root).push({
        id,
        filePath: path.join(dirPath, f),
        running: isRunning,
        lastActivityMs: mtimeMs,
        active: isRunning || now - mtimeMs <= activeDays * 86400000,
        worktree: attribution.worktree,
        sidecar: running.get(id) || null,
      });
    }
  }

  for (const p of projects) {
    const list = byRoot.get(p.path) || [];
    const sessionsTotal = list.length;
    list.sort(compareSessionOrder);
    const capped = list.slice(0, cap);
    const sessions = capped.map((s) => {
      const body = readTranscriptBody(s.filePath); // phase 2: bounded, only for the emitted set
      return {
        id: s.id,
        title: resolveSessionTitle(body.acc, s.sidecar, s.id),
        branch: body.branch,
        worktree: body.worktree ?? s.worktree,
        running: s.running,
        lastActivity: new Date(s.lastActivityMs).toISOString(),
        active: s.active,
      };
    });
    result.set(p.path, { sessions, sessionsTotal });
  }
  return result;
}

export function scanAll(config, { gh } = {}) {
  // spec 009-04: build the gh context ONCE per scan (AC3), or use an injected
  // one (tests / callers that already probed). When gh is absent/unavailable,
  // scanProject makes no PR reads — exact status quo (AC2).
  const ghCtx = gh || buildGhContext();
  const projects = config.projects.map((cfgProj) => scanProject(cfgProj, ghCtx));
  const sessionsByRoot = readAllSessions(config.projects, { storeDir: resolveSessionStore(config) });
  config.projects.forEach((cfgProj, i) => {
    const s = sessionsByRoot.get(cfgProj.path) || { sessions: [], sessionsTotal: 0 };
    projects[i].sessions = s.sessions;
    projects[i].sessionsTotal = s.sessionsTotal;
    if (s.warning) {
      projects[i].warnings = [...(projects[i].warnings || []), s.warning];
    }
  });
  return {
    generatedAt: new Date().toISOString(),
    projects,
  };
}

// Spec 010-01: two-phase load, phase-two delta extraction. Pure — maps a
// `scanAll` result (run with a real, gh-enriched context) to the per-project
// fields the disk-only `/api/data` payload lacks or that PRs change, keyed on
// `path`. `ownerLogin`/`prs` are included only when scanProject attached them
// (gh available); `waitingOn`/`waitingStages` are always carried, together,
// so the client swaps both atomically and never desyncs them (AC5).
export function prDeltas(scanResult) {
  return scanResult.projects.map((p) => ({
    path: p.path,
    ...(p.ownerLogin !== undefined ? { ownerLogin: p.ownerLogin } : {}),
    ...(p.prs !== undefined ? { prs: p.prs } : {}),
    waitingOn: p.waitingOn,
    waitingStages: p.waitingStages,
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cfg = loadConfig(resolveConfigPath());
  process.stdout.write(JSON.stringify(scanAll(cfg), null, 2) + '\n');
}
