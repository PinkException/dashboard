// Leak gate — no surveyed project's identity or vocabulary, and no credential,
// may appear in a tracked file (2026-07-24 audit; see docs/inbox.md).
//
// The deny-list and detection logic now live in tools/leak-scan.mjs (shared
// with the pre-push hook and CI diff-scan). This file scans the tracked file
// tree at tip; tools/leak-scan-range.mjs scans commit diffs. Together they
// cover both "a name in the current files" and "a name in an old commit's
// diff" — the latter being the vector that leaked in 003-02.
//
// Adding a term: hash the lowercased form and append it to DENY in
// tools/leak-scan.mjs (see that file's header).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DENY,
  sha256,
  wordsOf,
  ngramHashes,
  hasDeniedTerm,
  credentialHits,
} from '../tools/leak-scan.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, maxBuffer: 1 << 24 })
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
}

function readText(rel) {
  try {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
  } catch {
    return null; // unreadable or binary — nothing to match
  }
}

test('no tracked file contains a denied project name or borrowed term', () => {
  const offenders = [];
  for (const rel of trackedFiles()) {
    const text = readText(rel);
    if (text === null) continue;
    // The matched term is deliberately not printed — this message can land in
    // CI logs. The filename is enough to find it.
    if (hasDeniedTerm(text)) offenders.push(rel);
  }
  assert.deepEqual(
    offenders,
    [],
    `denied term found in: ${offenders.join(', ')} — see .private/ for the list`,
  );
});

test('no tracked file contains a credential or a home-directory path', () => {
  const offenders = [];
  for (const rel of trackedFiles()) {
    const text = readText(rel);
    if (text === null) continue;
    for (const label of credentialHits(text)) offenders.push(`${rel} (${label})`);
  }
  assert.deepEqual(offenders, [], `credential-shaped content in: ${offenders.join(', ')}`);
});

// Guards against the gate silently becoming a no-op. Uses an invented canary
// rather than a real denied term, so this file stays clean under its own scan.
test('the gate detects a multi-word term, not just single words', () => {
  const canary = sha256('zarnak quillfen threebly');
  assert.ok(
    ngramHashes('prose mentioning zarnak quillfen threebly in passing').has(canary),
    'three-word n-gram was not produced — the gate would miss multi-word terms',
  );
  assert.equal(ngramHashes('prose mentioning nothing of the sort').has(canary), false);
});

test('word splitting keeps hyphenated terms whole and sheds trailing punctuation', () => {
  assert.deepEqual(wordsOf('`widget-log`, and 2.0.'), ['widget-log', 'and', '2.0']);
  assert.deepEqual(wordsOf('Alpha-finder 2.0'), ['alpha-finder', '2.0']);
});

test('a denied term is caught however it is punctuated or cased', () => {
  // Built at runtime from parts so the literal never appears in this file.
  const term = ['widget', 'log'].join('-');
  const denyOne = new Set([sha256(term)]);
  for (const sample of [`\`${term}\`,`, term.toUpperCase(), `${term}.`, `(${term})`]) {
    const hit = [...ngramHashes(sample)].some((h) => denyOne.has(h));
    assert.equal(hit, true, `missed the term in: ${sample}`);
  }
});

// The shared deny-list is non-empty — a refactor that emptied it would make
// every scan a silent no-op.
test('the deny-list is populated', () => {
  assert.ok(DENY.size >= 10, `deny-list unexpectedly small (${DENY.size})`);
});
