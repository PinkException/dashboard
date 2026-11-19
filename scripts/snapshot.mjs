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
// Roadmap modes (spec 012-03) — the writer owns every order computation:
//   ... --headline "..." --roadmap <file.json>   narrative block (+ optional proposedOrder)
//   node scripts/snapshot.mjs --project <path> --move <id> --before <id>   owner correction
//   node scripts/snapshot.mjs --project <path> --print-order               read-only
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
import { mergeSavedOrder, realSliceCounts, validateRoadmapInput, validateSnapshot } from '../src/lib.mjs';
import {
  expandHome,
  loadConfig,
  readSavedEntries,
  resolveConfigPath,
  scanProject,
  scannedProvenance,
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
// spec completion (`specs.done`/`specs.total`), slice completion
// (`slices.done`/`slices.total`, spec 013-03: a finished or added slice is a
// point) and which spec is active (`next`). Deliberately EXCLUDES the open-bug
// count and the `scanned` provenance: a bug that opens and closes nets zero
// real progress but would otherwise write two series points — churn, not
// signal. An older stored entry without `slices` differs from a new one with
// them (null vs a number), so the first slice-carrying entry is always written.
// 012-03: the signature also hashes the entry's `roadmap` block (null when
// absent — `auto` entries never carry one, so they always hash it as null and
// their cadence is unchanged), so a roadmap-only change is never skipped.
function progressSignature(snap) {
  return JSON.stringify({
    done: snap.specs?.done ?? null,
    total: snap.specs?.total ?? null,
    sliceDone: snap.slices?.done ?? null,
    sliceTotal: snap.slices?.total ?? null,
    next: snap.next ?? null,
    // 012-03 AC9: a roadmap change is a change.
    roadmap: snap.roadmap ?? null,
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

const ARROW = ' → ';
// Roadmap block for a `--roadmap` write: the writer, never the caller, sets
// `order` (012-03 AC2). Returns { block, note } or { error }.
function composeRoadmap(root, scanned, file, ts) {
  let input;
  try {
    input = JSON.parse(fs.readFileSync(expandHome(file), 'utf8'));
  } catch (err) {
    return { error: `invalid roadmap file ${file}: ${err.message}` };
  }
  if (input && typeof input === 'object' && 'order' in input) {
    return { error: `invalid roadmap file ${file}: the writer owns \`order\`; send \`proposedOrder\` instead` };
  }
  const errs = validateRoadmapInput(input);
  if (errs.length) return { error: `invalid roadmap file ${file}: ${errs.join('; ')}` };
  const auto = scanned.roadmap.autoOrder;
  const prev = readSavedEntries(root).roadmap?.roadmap || null;
  const block = {};
  for (const k of ['groups', 'layers', 'rule', 'locked']) if (input[k] !== undefined) block[k] = input[k];
  let note = null;
  if (prev && prev.orderOrigin === 'corrected') {
    block.order = mergeSavedOrder(prev.order, auto);
    block.orderOrigin = 'corrected';
    if (prev.correctedAt) block.correctedAt = prev.correctedAt;
    if (input.proposedOrder) {
      note = `suggested order (not applied; yours stands): ${mergeSavedOrder(input.proposedOrder, auto).join(ARROW)}`;
    }
  } else if (input.proposedOrder || !prev) {
    block.order = mergeSavedOrder(input.proposedOrder, auto);
    block.orderOrigin = 'proposed';
    block.proposedAt = ts;
  } else {
    block.order = mergeSavedOrder(prev.order, auto);
    block.orderOrigin = 'proposed';
    if (prev.proposedAt) block.proposedAt = prev.proposedAt;
  }
  return { block, note };
}

// `--move <id> --before <id>`: the owner's correction as one new entry.
function composeMove(root, scanned, args, ts) {
  const { narrative, roadmap } = readSavedEntries(root);
  if (!roadmap || !narrative) return { error: 'no saved roadmap for this project; nothing to move' };
  const order = mergeSavedOrder(roadmap.roadmap.order, scanned.roadmap.autoOrder);
  const id = args.move;
  const before = args.before;
  if (typeof id !== 'string' || typeof before !== 'string') return { error: '--move needs --before <id>' };
  if (!order.includes(id) || !order.includes(before)) return { error: `unknown slice id (current order: ${order.join(ARROW)})` };
  if (id === before) return { error: '--move and --before name the same slice' };
  const next = order.filter((x) => x !== id);
  next.splice(next.indexOf(before), 0, id);
  const { proposedAt: _p, ...rest } = roadmap.roadmap;
  const snapshot = { v: 1, ts, headline: narrative.headline };
  if (narrative.next !== undefined) snapshot.next = narrative.next;
  if (narrative.blockers !== undefined) snapshot.blockers = narrative.blockers;
  snapshot.source = narrative.source ?? 'manual';
  snapshot.roadmap = { ...rest, order: next, orderOrigin: 'corrected', correctedAt: ts };
  return { snapshot };
}

function writeSnapshot(root, args) {
  const scanned = scanProject({ path: root, pinnedWorkstreams: [], hiddenWorkstreams: [] });
  if (scanned.error) return { root, error: scanned.error };
  if (!scanned.jigManaged) return { root, skipped: 'not jig-managed' };

  if (args['print-order']) {
    const o = scanned.roadmap.order;
    return { root, printed: `${o.ids.join(ARROW) || '(nothing unfinished)'}\n${o.label}` };
  }

  const ts = args.ts || new Date().toISOString();
  let snapshot = { v: 1, ts };
  let note = null;
  if (args.move !== undefined) {
    const m = composeMove(root, scanned, args, ts);
    if (m.error) return { root, error: m.error };
    snapshot = m.snapshot;
  } else if (args.auto) {
    Object.assign(snapshot, autoFields(scanned), { source: 'auto' });
  } else {
    snapshot.headline = args.headline;
    if (args.next) snapshot.next = args.next;
    if (args.blockers) {
      snapshot.blockers = args.blockers.split(';').map((s) => s.trim()).filter(Boolean);
    }
    snapshot.source = 'manual';
    if (typeof args.roadmap === 'string') {
      const c = composeRoadmap(root, scanned, args.roadmap, ts);
      if (c.error) return { root, error: c.error };
      snapshot.roadmap = c.block;
      note = c.note;
    }
  }
  // --source overrides the default provenance tag. The dashboard-owned snapshot
  // skill (slice 005-03) passes `--source dashboard` so its narrative entries are
  // distinguishable from a human `manual` headline and the deterministic `auto`
  // line. A bare `--source` with no value is ignored — the default tag stands.
  if (typeof args.source === 'string' && args.source) snapshot.source = args.source;
  snapshot.specs = { done: scanned.progress.done, total: scanned.progress.denom };
  // Spec 013-03: slice and bug counts plus where the count was taken. Additive:
  // old readers ignore them; `slices` is omitted when there are no real slices.
  const slices = realSliceCounts(scanned.specs);
  if (slices) snapshot.slices = slices;
  snapshot.bugs = { open: scanned.counts.bugs.open };
  snapshot.scanned = scannedProvenance(root);

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
  return { root, snapshot, target, note };
}

const args = parseArgs(process.argv.slice(2));
const usage =
  'usage: node scripts/snapshot.mjs --project <path> --headline "..." [--next "..."] [--blockers "a;b"] [--ts <iso>] [--source <value>]\n' +
  '       node scripts/snapshot.mjs --project <path> --auto\n' +
  '       node scripts/snapshot.mjs --all --auto [--if-changed] [--config <path>]\n' +
  '       node scripts/snapshot.mjs --project <path> --headline "..." --roadmap <file.json> [--source dashboard]\n' +
  '       node scripts/snapshot.mjs --project <path> --move <id> --before <id>\n' +
  '       node scripts/snapshot.mjs --project <path> --print-order';

// 012-03: refuse ambiguous roadmap-mode combinations before touching anything.
function argConflict(a) {
  if (a.roadmap === true) return '--roadmap needs a file path (--roadmap <file.json>)';
  if (a.move !== undefined && a.move === true) return '--move needs a slice id (--move <id> --before <id>)';
  if (a.before !== undefined && a.move === undefined) return '--before is only valid with --move';
  if (a.roadmap !== undefined && a.auto) return '--roadmap cannot be combined with --auto';
  if (a['print-order']) {
    for (const k of ['move', 'headline', 'roadmap', 'auto']) {
      if (a[k] !== undefined) return `--print-order is read-only and cannot be combined with --${k}`;
    }
  }
  if (a.move !== undefined) {
    for (const k of ['headline', 'roadmap', 'auto', 'source', 'next', 'blockers']) {
      if (a[k] !== undefined) return `--move cannot be combined with --${k} (a correction copies the latest entry, including its source)`;
    }
  }
  if (a.all && (a.move !== undefined || a['print-order'])) return '--move and --print-order work on one --project, not --all';
  return null;
}
const conflict = argConflict(args);
if (conflict) {
  console.error(conflict + '\n' + usage);
  process.exit(1);
}

let targets;
if (args.all) {
  if (!args.auto) {
    console.error('--all requires --auto (a shared manual headline would be wrong per project)\n' + usage);
    process.exit(1);
  }
  let cfg;
  try {
    cfg = loadConfig(args.config ? expandHome(args.config) : resolveConfigPath());
  } catch (err) {
    // A missing config is the fresh-install case (slice 007-01), a malformed
    // one a hand-edit gone wrong: either way print the one friendly pointer
    // line and exit cleanly, no stack trace. Any other failure surfaces
    // honestly instead.
    if (err && (err.code === 'CONFIG_MISSING' || err.code === 'CONFIG_MALFORMED')) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }
  targets = cfg.projects.map((p) => p.path);
} else if (args.project && (args.auto || args.headline || args['print-order'] || args.move !== undefined)) {
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
  } else if (res.printed) {
    console.log(res.printed);
  } else if (res.unchanged) {
    console.log(`- ${root}: unchanged (no new entry)`);
  } else {
    console.log(`✓ ${root}: ${res.snapshot.headline}`);
    console.log(`  → ${res.target}`);
    if (res.note) console.log(`  ${res.note}`);
  }
}
process.exit(failed ? 1 : 0);
