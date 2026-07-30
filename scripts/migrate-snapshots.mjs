#!/usr/bin/env node
// Slice 005-02 — fold the scattered compass histories into the dashboard-owned
// store (ADR-0004 §5). Reads sources, writes only the store; deletes nothing.
//
// Previewing is the default. Writing takes --write, and even then the run
// refuses if anything is ambiguous or if a source moved under it.
//
//   node scripts/migrate-snapshots.mjs --search-root <dir> [--search-root <dir>]
//   node scripts/migrate-snapshots.mjs --search-root <dir> --write
//
// Options:
//   --search-root <dir>   where to look for live histories (repeatable, required)
//   --archive <dir>       an archived capture/backup directory (repeatable;
//                         defaults to every `_migration-*` folder beside the store)
//   --aliases <file>      owner-confirmed identity list (default: beside the store)
//   --report <file>       where to write the report (default: beside the store)
//   --write               actually write; without it nothing is written anywhere
import fs from 'node:fs';
import path from 'node:path';
import { resolveSnapshotsDir, expandHome } from '../src/scan.mjs';
import {
  collectSources,
  buildPlan,
  renderReport,
  writePlan,
  writeCapture,
  loadAliases,
  defaultAliasPath,
} from '../src/migrate.mjs';

function parseArgs(argv) {
  const opts = { searchRoots: [], archiveDirs: [], write: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => expandHome(argv[(i += 1)]);
    if (a === '--search-root') opts.searchRoots.push(next());
    else if (a === '--archive') opts.archiveDirs.push(next());
    else if (a === '--aliases') opts.aliases = next();
    else if (a === '--report') opts.report = next();
    else if (a === '--write') opts.write = true;
    else if (a === '--capture') opts.capture = true;
    else {
      console.error(`unknown option: ${a}`);
      process.exit(2);
    }
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
if (!opts.searchRoots.length) {
  console.error(
    'refusing to guess where your projects live — pass at least one --search-root.\n' +
      'The report records the roots used, so the search is never a silent assumption.',
  );
  process.exit(2);
}

const storeDir = resolveSnapshotsDir();
const dataDir = path.dirname(storeDir);

if (!opts.archiveDirs.length) {
  try {
    opts.archiveDirs = fs
      .readdirSync(dataDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name.startsWith('_migration-'))
      .map((d) => path.join(dataDir, d.name))
      .sort();
  } catch {
    opts.archiveDirs = [];
  }
}

const stamp = new Date().toISOString().slice(0, 10);

// A fresh capture before anything is merged: worktree copies are created and
// pruned continuously, so the set on disk today is not the set of a week ago.
if (opts.capture) {
  const dir = path.join(dataDir, `_migration-capture-${stamp}`);
  const live = collectSources({ searchRoots: opts.searchRoots });
  const { files, lines } = writeCapture(live, { dir, searchRoots: opts.searchRoots });
  console.log(`captured ${files} file(s), ${lines} line(s) → ${dir}`);
  process.exit(0);
}

const aliasPath = opts.aliases ?? defaultAliasPath();
const aliases = loadAliases(aliasPath);

const sources = collectSources({
  searchRoots: opts.searchRoots,
  archiveDirs: opts.archiveDirs,
});
const plan = buildPlan({ sources, aliases });

const reportPath = opts.report ?? path.join(dataDir, `_migration-report-${stamp}.md`);
const report = renderReport(plan, {
  searchRoots: opts.searchRoots,
  archiveDirs: opts.archiveDirs,
  storeDir,
});

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, report);

const { parsed, written, duplicates, malformed, balanced } = plan.accounting;
console.log(`aliases:  ${aliases.length} (${aliasPath})`);
console.log(`sources:  ${sources.length} file(s)`);
console.log(`entries:  ${parsed} read → ${written} to write, ${duplicates.length} duplicate(s)`);
console.log(`malformed: ${malformed.length}`);
console.log(`balances: ${balanced ? 'yes' : 'NO'}`);
console.log(`projects: ${plan.projects.length}`);
for (const p of plan.projects) {
  console.log(`  ${String(p.entries.length).padStart(4)}  ${p.root}  (${p.sources.length} source(s))`);
}
console.log(`report:   ${reportPath}`);

if (plan.problems.length) {
  console.error(`\n${plan.problems.length} problem(s) — nothing will be written:`);
  for (const p of plan.problems) console.error(`  - ${p}`);
  process.exit(1);
}

if (!opts.write) {
  console.log('\npreview only — nothing was written. Re-run with --write to apply.');
  process.exit(0);
}

const { appended, touched } = writePlan(plan, { storeDir });
console.log(`\nwrote ${appended} entry(ies) across ${touched.length} project file(s) in ${storeDir}`);
