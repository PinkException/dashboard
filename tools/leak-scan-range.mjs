#!/usr/bin/env node
// leak-scan-range — scan commit DIFFS for a denied project name or a credential
// and refuse the push/merge if one is present. This is the gate the tip-tree
// checks miss: a name redacted from the current file still lives in the diff of
// the commit that removed it (exactly what happened in 003-02, where a real
// project name survives in the patch of the "redact" commit). Anyone browsing
// history on a public repo sees that diff, so the diff is what must be clean.
//
// Self-contained: it matches against the HASHED deny-list in tools/leak-scan.mjs,
// so it runs identically on your machine (pre-push) and on GitHub (CI), with no
// access to your private config.
//
// Usage:
//   node tools/leak-scan-range.mjs --all-history        # every commit on HEAD (CI)
//   node tools/leak-scan-range.mjs --range <A>..<B>      # an explicit range
//   node tools/leak-scan-range.mjs --commits <sha>...    # specific commits
//   node tools/leak-scan-range.mjs --pre-push            # read refs on stdin (hook)
//
// Exit 0 = clean; 1 = a leak was found (block); 2 = usage error.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { hasDeniedTerm, credentialHits } from './leak-scan.mjs';

// Parse `git log -p` text and return findings, one per (commit,file,kind).
// The offending term is NEVER included — these messages can land in CI logs;
// the commit and file are enough to locate it. Scans every patch body line
// (added, removed, context) because the name is present in the stored diff
// regardless of which side of the change it sits on.
export function findingsInPatch(patchText) {
  const findings = [];
  let commit = '(working tree)';
  let file = '(unknown)';
  const seen = new Set();
  const push = (kind) => {
    const key = `${commit}\0${file}\0${kind}`;
    if (!seen.has(key)) {
      seen.add(key);
      findings.push({ commit, file, kind });
    }
  };
  for (const line of patchText.split('\n')) {
    const c = line.match(/^commit ([0-9a-f]{7,40})/);
    if (c) {
      commit = c[1].slice(0, 10);
      file = '(commit message)';
      continue;
    }
    const d = line.match(/^diff --git a\/.* b\/(.*)$/);
    if (d) {
      file = d[1];
      continue;
    }
    // Strip a leading diff marker (+/-/space) so `+sample-name` matches `sample-name`.
    const body = /^[+\- ]/.test(line) ? line.slice(1) : line;
    if (hasDeniedTerm(body)) push('denied-term');
    for (const label of credentialHits(body)) push(`credential:${label}`);
  }
  return findings;
}

function gitLogP(revArgs) {
  return execFileSync('git', ['log', '-p', '--no-color', ...revArgs], {
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
  });
}

// Commits reachable from the pushed tip but not yet on any remote-tracking ref.
function prePushRanges(stdinText) {
  const ZERO = /^0+$/;
  const revArgs = [];
  let sawAny = false;
  for (const raw of stdinText.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const [, localSha, , remoteSha] = line.split(/\s+/);
    if (!localSha || ZERO.test(localSha)) continue; // branch deletion — nothing to scan
    sawAny = true;
    if (remoteSha && !ZERO.test(remoteSha)) {
      revArgs.push(`${remoteSha}..${localSha}`);
    } else {
      // New branch: everything reachable from the tip that isn't already
      // published on some remote-tracking ref.
      revArgs.push(localSha, '--not', '--remotes');
    }
  }
  return { revArgs, sawAny };
}

function report(findings) {
  if (findings.length === 0) return true;
  process.stderr.write('\nleak-scan: a private project name or credential is present in a\n');
  process.stderr.write('commit DIFF you are about to publish. This repo is a public plugin.\n\n');
  for (const f of findings) {
    process.stderr.write(`  ${f.commit}  ${f.file}  [${f.kind}]\n`);
  }
  process.stderr.write('\nBlocked. Rewrite history to remove it (rebase/squash the offending\n');
  process.stderr.write('commit so the name is absent from every diff), then retry.\n');
  process.stderr.write('The term itself is withheld on purpose — see .private/ for the list.\n\n');
  return false;
}

function main() {
  const [mode, ...rest] = process.argv.slice(2);
  let patch;
  if (mode === '--all-history') {
    patch = gitLogP([]);
  } else if (mode === '--range') {
    if (!rest[0]) return usage();
    patch = gitLogP([rest[0]]);
  } else if (mode === '--commits') {
    if (rest.length === 0) return usage();
    patch = gitLogP(['--no-walk', ...rest]);
  } else if (mode === '--pre-push') {
    const stdin = readStdin();
    const { revArgs, sawAny } = prePushRanges(stdin);
    if (!sawAny) process.exit(0); // nothing to push
    patch = revArgs.length ? gitLogP(revArgs) : '';
  } else {
    return usage();
  }
  process.exit(report(findingsInPatch(patch)) ? 0 : 1);
}

function usage() {
  process.stderr.write(
    'usage: leak-scan-range.mjs --all-history | --range <A>..<B> | --commits <sha>... | --pre-push\n',
  );
  process.exit(2);
}

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8'); // fd 0 = the ref lines git feeds the hook
  } catch {
    return '';
  }
}

if (import.meta.url === 'file://' + process.argv[1]) main();
