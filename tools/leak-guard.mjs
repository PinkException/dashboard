#!/usr/bin/env node
// leak-guard - refuse to commit a tracked file that names one of the owner's
// OTHER private projects. This repo is a public plugin; docs/ ships to every
// installer, so a real project name from the owner's local config must never
// land in a tracked file. The deny-list is derived at run time from the LIVE
// config (~/.claude/my-dashboard/config.json), never hard-coded here, so this
// guard carries no private names itself.
//
// Usage:
//   node tools/leak-guard.mjs --staged   # scan git-staged files (pre-commit)
//   node tools/leak-guard.mjs --all      # scan every tracked file
// Config override for tests: DASHBOARD_CONFIG=/path/to/config.json
//
// Exit 0 = clean (or no config to guard against); 1 = a private name was found
// (block the commit); 2 = usage error.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_CONFIG = path.join(os.homedir(), '.claude', 'my-dashboard', 'config.json');

function expandHome(p) {
  return p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
}

// Guard the project directory BASENAMES (e.g. "sample-alpha"), not the
// free-text labels, which contain generic words that would false-positive.
export function denyTokensFromConfig(configPath) {
  let raw;
  try {
    raw = fs.readFileSync(configPath, 'utf8');
  } catch {
    return null;
  }
  let cfg;
  try {
    cfg = JSON.parse(raw);
  } catch {
    return null;
  }
  const projects = Array.isArray(cfg) ? cfg : cfg.projects || [];
  const tokens = new Set();
  for (const p of projects) {
    const base = path.basename(expandHome(String(p.path || ''))).trim();
    if (base.length >= 4) tokens.add(base);
  }
  tokens.delete(path.basename(process.cwd()));
  tokens.delete('dashboard');
  return [...tokens];
}

function trackedFiles(mode) {
  const args =
    mode === '--staged'
      ? ['diff', '--cached', '--name-only', '--diff-filter=ACM']
      : ['ls-files'];
  return execFileSync('git', args, { encoding: 'utf8' }).split('\n').filter(Boolean);
}

// Token bounded by non-word / non-hyphen chars, case-insensitive.
export function tokenRegex(token) {
  const esc = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp('(?<![\\w-])' + esc + '(?![\\w-])', 'i');
}

export function scanFiles(files, tokens, readFile) {
  const regexes = tokens.map((t) => ({ token: t, re: tokenRegex(t) }));
  const hits = [];
  for (const file of files) {
    let content;
    try {
      content = readFile(file);
    } catch {
      continue;
    }
    content.split('\n').forEach((line, i) => {
      for (const { token, re } of regexes) {
        if (re.test(line)) hits.push({ file, line: i + 1, token });
      }
    });
  }
  return hits;
}

function main() {
  const mode = process.argv[2];
  if (mode !== '--staged' && mode !== '--all') {
    process.stderr.write('usage: leak-guard.mjs --staged | --all\n');
    process.exit(2);
  }
  const configPath = process.env.DASHBOARD_CONFIG || DEFAULT_CONFIG;
  const tokens = denyTokensFromConfig(configPath);
  if (!tokens || tokens.length === 0) process.exit(0);
  const hits = scanFiles(trackedFiles(mode), tokens, (f) => fs.readFileSync(f, 'utf8'));
  if (hits.length > 0) {
    process.stderr.write('\nleak-guard: a private project name from your local config was found\n');
    process.stderr.write('in a tracked file. This repo is a public plugin - use sample names.\n\n');
    for (const h of hits) process.stderr.write('  ' + h.file + ':' + h.line + '  names "' + h.token + '"\n');
    process.stderr.write('\nCommit blocked. Replace the name with sample data and retry.\n');
    process.exit(1);
  }
  process.exit(0);
}

if (import.meta.url === 'file://' + process.argv[1]) main();
