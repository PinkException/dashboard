// Leak gate — no surveyed project's identity or vocabulary, and no credential,
// may appear in a tracked file (2026-07-24 audit; see docs/inbox.md).
//
// This repo ships publicly as a Claude Code plugin and `docs/` is part of the
// package, so a tracked deny-list written in plain text would reproduce exactly
// what it forbids. The terms are therefore stored as SHA-256 digests: the gate
// still recognises them, the file itself discloses nothing. The unredacted list
// lives in `.private/` (git-ignored, never shipped).
//
// For the same reason every example in this file uses invented words. Nothing
// here may name a real project — this file is scanned by its own first test.
//
// Adding a term: hash the lowercased form and append it below.
//   node -e 'console.log(require("node:crypto").createHash("sha256").update("<term>","utf8").digest("hex"))'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_NGRAM = 3;

const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

// Surveyed-project identities and borrowed domain vocabulary.
const DENY = new Set([
  '7c02a1336b79d6b4569611a8860dda38b92286537047ef76e2d4a692cac7bb5c',
  '1bf7c77d7268dc887c3bf0674f1ae62e224d1757e9ae962e4bffbf22cf3ccd46',
  '7b2e03faff0e8c5d06f989ef6752c6ee299035d986cbb0a1cf450838595006e1',
  '5f004f81a60bf1347e270788340d5c5a49dc7984f9031dd0b8bfe9f3e73631a0',
  'ab5b9636fb94e02b4c2a020b35f7033ce59efcd3ba612263b1b6b60cf9fc7be9',
  'aac0e7e707ae77da4c20aa56ca6a91e863c1dff3edb3e8d8d56921392907e5a2',
  'c934a0375eaf8319311907be7ab3b0e801c0deb5c54138c1221dacc9147072bc',
  '4a068ef355d82ad5a1579ccf2d32f67ae2e509358d5a228d4df1ce69e99986e7',
  'd65fbe6b9098dee22b3ead0197b07b884146a734a86112000ef4dc873cde6d9d',
  '863bf98ac628fcf66a77c2502abc563bc12ef1046e31c6e53e0b4b846ff542f3',
  '6753eef4b864b927b0bcc954543f4a534ad6f3e0a766ad0ddc9f4fb8533e6dbb',
  '1706868b718c2995eeff92dc0da4bbdb85301f852e19ad9ebdee304c7e799081',
  '6e7fdbd5f140bcac91378b7b7c2c1ed48d9de6e33807f4dc48558e01901ffc04',
  '9c4edab56a724e0dd1402085bf8518dc1968bc72951537160c13c683fcb64f25',
  '2c4fe4bf73b64cc01ff9a56a1cac6513982c18fef724505eadd79d6296dc3d88',
  '60eba27c2e3fe870083554d13f90b3f4d1f113b381581582eeb718dfade28c57',
]);

// Credential shapes are generic patterns, so they stay readable.
const CREDENTIALS = [
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{20,}\b/],
  ['GitHub fine-grained token', /\bgithub_pat_[A-Za-z0-9_]{20,}\b/],
  ['OpenAI/Anthropic key', /\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}\b/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ['private key block', /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/],
  ['home-directory path', /\/Users\/[a-zA-Z0-9._-]+\//],
];

function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, maxBuffer: 1 << 24 })
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
}

// Lowercase, then split into words that keep internal hyphens and dots, so a
// hyphenated name or a version like `2.0` survives as one token. Trailing
// punctuation is shed so `widget-log.` and `widget-log` hash alike.
export function wordsOf(text) {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9.-]*/g) || [])
    .map((w) => w.replace(/[.-]+$/, ''))
    .filter(Boolean);
}

// Every 1..MAX_NGRAM word sequence, space-joined, so multi-word terms are
// caught as well as single ones.
export function ngramHashes(text) {
  const words = wordsOf(text);
  const hashes = new Set();
  for (let n = 1; n <= MAX_NGRAM; n++) {
    for (let i = 0; i + n <= words.length; i++) {
      hashes.add(sha256(words.slice(i, i + n).join(' ')));
    }
  }
  return hashes;
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
    for (const h of ngramHashes(text)) {
      // The matched term is deliberately not printed — this message can land in
      // CI logs. The filename is enough to find it.
      if (DENY.has(h)) {
        offenders.push(rel);
        break;
      }
    }
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
    for (const [label, re] of CREDENTIALS) {
      if (re.test(text)) offenders.push(`${rel} (${label})`);
    }
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
