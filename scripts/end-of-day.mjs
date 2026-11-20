// Deterministic half of /dashboard:end-of-day (spec 012-04). The skill does the
// narrative work; this script owns the window, the selection and the run state,
// so those rules are testable and never improvised by a model.
//
//   node scripts/end-of-day.mjs --select [--now <iso>]
//     prints JSON: { since, firstRun, capped, projects: [{label, path, retry, worktreeOnly}] }
//   node scripts/end-of-day.mjs --record --started <iso> [--failed <path>,<path>]
//     writes the run state (the run's START time + failed project paths)
//
// State lives beside the config (ADR-0003): ~/.claude/my-dashboard/end-of-day.json
// (moves with DASHBOARD_CONFIG, like the snapshots dir). Read-only over the
// session store and every surveyed repo; no git.
import fs from 'node:fs';
import path from 'node:path';
import { attributeSessionDir, encodeCwdSlug } from '../src/lib.mjs';
import { loadConfig, resolveConfigPath, resolveSessionStore } from '../src/scan.mjs';

const DAY = 86400000;
const stateFile = () => path.join(path.dirname(resolveConfigPath()), 'end-of-day.json');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) args[key] = true;
    else args[key] = argv[++i];
  }
  return args;
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

// Missing, unreadable, malformed or future-dated (clock skew) state all mean "first run".
function readState(now) {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    const t = Date.parse(s.lastRunStarted);
    if (Number.isNaN(t) || t > now) return null;
    return { lastRunStarted: t, failed: Array.isArray(s.failed) ? s.failed.filter((x) => typeof x === 'string') : [] };
  } catch {
    return null;
  }
}

// Transcript mtimes only (no bodies): per project root, did any session (main
// or worktree) touch it after `sinceMs`, and was any of that on main?
function activity(projects, sinceMs, config) {
  const out = new Map();
  const storeDir = resolveSessionStore(config);
  const projectsDir = path.join(storeDir, 'projects');
  let dirs;
  try {
    dirs = fs.readdirSync(projectsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return out; // unreadable/missing store: no activity signal, failed projects still selected
  }
  const roots = projects.map((p) => ({ root: p.path, slug: encodeCwdSlug(p.path) }));
  for (const d of dirs) {
    const att = attributeSessionDir(d, roots);
    if (!att) continue;
    let files;
    try {
      files = fs.readdirSync(path.join(projectsDir, d));
    } catch {
      continue;
    }
    for (const f of files) {
      if (!f.endsWith('.jsonl')) continue;
      let m;
      try {
        m = fs.statSync(path.join(projectsDir, d, f)).mtimeMs;
      } catch {
        continue;
      }
      if (m <= sinceMs) continue;
      const cur = out.get(att.root) || { main: false, worktree: false };
      if (att.worktree) cur.worktree = true;
      else cur.main = true;
      out.set(att.root, cur);
    }
  }
  return out;
}

function select(args) {
  const now = args.now === undefined ? Date.now() : Date.parse(args.now);
  if (Number.isNaN(now)) fail('--now must be an ISO timestamp');
  let config;
  try {
    config = loadConfig(resolveConfigPath());
  } catch (err) {
    fail(err.message); // ConfigMissingError already says: run /dashboard:open
  }
  const state = readState(now);
  const floor = now - 7 * DAY;
  const wanted = state ? state.lastRunStarted : now - DAY;
  const capped = state !== null && wanted < floor;
  const sinceMs = Math.max(wanted, floor);
  const act = activity(config.projects, sinceMs, config);
  const failed = new Set(state ? state.failed : []);
  const projects = [];
  for (const p of config.projects) {
    const a = act.get(p.path);
    const retry = failed.has(p.path); // a failed path no longer in config never reaches here: dropped quietly
    if (!a && !retry) continue;
    projects.push({
      label: p.label || path.basename(p.path),
      path: p.path,
      retry,
      worktreeOnly: Boolean(a && a.worktree && !a.main),
    });
  }
  console.log(JSON.stringify({ since: new Date(sinceMs).toISOString(), firstRun: state === null, capped, projects }, null, 2));
}

function record(args) {
  if (typeof args.started !== 'string' || Number.isNaN(Date.parse(args.started))) {
    fail('--record needs --started <iso timestamp> (the run\'s start time)');
  }
  const failed = typeof args.failed === 'string' ? args.failed.split(',').filter(Boolean) : [];
  const file = stateFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ v: 1, lastRunStarted: new Date(args.started).toISOString(), failed }, null, 2) + '\n');
  console.log(`recorded end-of-day run started ${new Date(args.started).toISOString()} (${failed.length} failed) in ${file}`);
}

const args = parseArgs(process.argv.slice(2));
if (args.select) select(args);
else if (args.record) record(args);
else fail('usage: node scripts/end-of-day.mjs --select [--now <iso>]\n       node scripts/end-of-day.mjs --record --started <iso> [--failed <path>,<path>]');
