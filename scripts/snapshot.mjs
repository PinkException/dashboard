// Snapshot writer. Appends to the dashboard-owned store outside every repo
// (ADR-0004, slice 005-01); never into the surveyed project.
//
// Manual (narrative supplied by you, or by the dashboard's own snapshot skill):
//   node scripts/snapshot.mjs --project <path> --headline "..." \
//     [--next "..."] [--blockers "a;b"] [--ts <iso>] [--source <value>]
//
// --source overrides the provenance tag (default: `auto` under --auto, else
// `manual`). The dashboard-owned narrative skill passes `--source dashboard`.
//
// Auto (deterministic headline from scan data; for scheduled routines):
//   node scripts/snapshot.mjs --project <path> --auto
//   node scripts/snapshot.mjs --all --auto     # every jig project in the resolved config
//
// --if-changed (on-change cadence, slice 005-04): skip a project whose newest
// stored same-source entry already carries the same progress signature (spec
// completion + active spec; bug-count churn is deliberately ignored). Composes
// with --all --auto for the unattended routine — the series then grows only on
// real progress transitions rather than on a fixed cadence:
//   node scripts/snapshot.mjs --all --auto --if-changed
import fs from 'node:fs';
import path from 'node:path';
import { validateSnapshot } from '../src/lib.mjs';
import {
  expandHome,
  loadConfig,
  resolveConfigPath,
  scanProject,
  snapshotFileFor,
} from '../src/scan.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = argv[i + 1];
      i++;
    }
  }
  return args;
}

// The deterministic progress signal a snapshot carries, reduced to what the
// on-change cadence rule (slice 005-04, `--if-changed`) treats as "changed":
// spec completion (`specs.done`/`specs.total`) and which spec is active
// (`next`). Deliberately EXCLUDES the open-bug count: a bug that opens and
// closes nets zero real progress but would otherwise write two series points —
// churn, not signal. Because progress here is measured at spec granularity, a
// multi-slice spec produces no auto point until a spec completes or the active
// spec changes; slice-level granularity would require enriching the auto
// fingerprint and is deferred to the future evolution-chart spec.
function progressSignature(snap) {
  return JSON.stringify({
    done: snap.specs?.done ?? null,
    total: snap.specs?.total ?? null,
    next: snap.next ?? null,
  });
}

// The most recent stored entry of a given provenance, or null if the store file
// is absent or holds no such entry. `--if-changed` compares within the same
// `source` so an interleaved human/skill narrative entry never resets the
// deterministic auto series' change baseline.
function lastEntryOfSource(target, source) {
  let raw;
  try {
    raw = fs.readFileSync(target, 'utf8');
  } catch {
    return null;
  }
  let last = null;
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj && obj.source === source) last = obj;
    } catch {
      // Malformed lines are ignored here exactly as the reader ignores them.
    }
  }
  return last;
}

function autoFields(scanned) {
  const p = scanned.progress;
  const parts = [`${p.done}/${p.denom} specs done`];
  if (p.by.IN_PROGRESS) parts.push(`${p.by.IN_PROGRESS} in progress`);
  if (scanned.counts.bugs.open) parts.push(`${scanned.counts.bugs.open} open bug(s)`);
  const inProgress = scanned.specs.find((s) => s.status === 'IN_PROGRESS');
  return {
    headline: `auto: ${parts.join(' · ')}`,
    ...(inProgress ? { next: `in progress: ${inProgress.id}` } : {}),
  };
}

function writeSnapshot(root, args) {
  const scanned = scanProject({ path: root, pinnedWorkstreams: [], hiddenWorkstreams: [] });
  if (scanned.error) return { root, error: scanned.error };
  if (!scanned.jigManaged) return { root, skipped: 'not jig-managed' };

  const snapshot = { v: 1, ts: args.ts || new Date().toISOString() };
  if (args.auto) {
    Object.assign(snapshot, autoFields(scanned), { source: 'auto' });
  } else {
    snapshot.headline = args.headline;
    if (args.next) snapshot.next = args.next;
    if (args.blockers) {
      snapshot.blockers = args.blockers.split(';').map((s) => s.trim()).filter(Boolean);
    }
    snapshot.source = 'manual';
  }
  // --source overrides the default provenance tag. The dashboard-owned snapshot
  // skill (slice 005-03) passes `--source dashboard` so its narrative entries are
  // distinguishable from a human `manual` headline and the deterministic `auto`
  // line. A bare `--source` with no value is ignored — the default tag stands.
  if (typeof args.source === 'string' && args.source) snapshot.source = args.source;
  snapshot.specs = { done: scanned.progress.done, total: scanned.progress.denom };

  const errors = validateSnapshot(snapshot);
  if (errors.length) return { root, error: 'invalid snapshot: ' + errors.join('; ') };

  // ADR-0004 §1: the snapshot goes to the dashboard-owned store outside every
  // repo. Never into the surveyed project — that write was the leak (bug 002).
  //
  // I/O failures return like every other error here rather than throwing: the
  // store is one shared directory, so an unhandled EACCES would abort every
  // remaining project in an `--all` run instead of just this one.
  const target = snapshotFileFor(root);

  // On-change cadence (slice 005-04): skip the write when this project's newest
  // stored entry of the same provenance already carries the same progress
  // signature. Keeps the series lean — every stored point is a real spec-level
  // progress transition, not a fixed-cadence duplicate.
  if (args['if-changed']) {
    const prev = lastEntryOfSource(target, snapshot.source);
    if (prev && progressSignature(prev) === progressSignature(snapshot)) {
      return { root, unchanged: true, target };
    }
  }

  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.appendFileSync(target, JSON.stringify(snapshot) + '\n');
  } catch (err) {
    return { root, error: `could not write ${target}: ${err.message}` };
  }
  return { root, snapshot, target };
}

const args = parseArgs(process.argv.slice(2));
const usage =
  'usage: node scripts/snapshot.mjs --project <path> --headline "..." [--next "..."] [--blockers "a;b"] [--ts <iso>] [--source <value>]\n' +
  '       node scripts/snapshot.mjs --project <path> --auto\n' +
  '       node scripts/snapshot.mjs --all --auto [--if-changed] [--config <path>]';

let targets;
if (args.all) {
  if (!args.auto) {
    console.error('--all requires --auto (a shared manual headline would be wrong per project)\n' + usage);
    process.exit(1);
  }
  const cfg = loadConfig(args.config ? expandHome(args.config) : resolveConfigPath());
  targets = cfg.projects.map((p) => p.path);
} else if (args.project && (args.auto || args.headline)) {
  targets = [expandHome(args.project)];
} else {
  console.error(usage);
  process.exit(1);
}

let failed = 0;
for (const root of targets) {
  const res = writeSnapshot(root, args);
  if (res.error) {
    failed++;
    console.error(`✗ ${root}: ${res.error}`);
  } else if (res.skipped) {
    console.log(`- ${root}: skipped (${res.skipped})`);
  } else if (res.unchanged) {
    console.log(`- ${root}: unchanged (no new entry)`);
  } else {
    console.log(`✓ ${root}: ${res.snapshot.headline}`);
    console.log(`  → ${res.target}`);
  }
}
process.exit(failed ? 1 : 0);
