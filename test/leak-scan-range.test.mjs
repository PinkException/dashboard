// Unit tests for the commit-diff scanner. Fixtures are assembled from parts at
// runtime so no credential-shaped literal or denied name appears in this file
// (it is itself scanned by no-leaks.test.mjs and by the diff scan).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findingsInPatch } from '../tools/leak-scan-range.mjs';

// A syntactically valid AWS-access-key shape, never a real key.
const AWS_KEY = 'AKIA' + 'Z'.repeat(16);
// A home-directory path shape, assembled so the literal isn't in this file.
const HOME_PATH = ['', 'Users', 'sample-person', 'x'].join('/');

function patch({ commit = 'abc1234567', file = 'docs/thing.md', lines }) {
  return [
    `commit ${commit}`,
    'Author: someone <a@b.c>',
    '',
    `diff --git a/${file} b/${file}`,
    '--- a/' + file,
    '+++ b/' + file,
    ...lines,
  ].join('\n');
}

test('flags a credential added in a + line, attributed to commit and file', () => {
  const f = findingsInPatch(patch({ lines: ['+ here is a key ' + AWS_KEY] }));
  assert.equal(f.length, 1);
  assert.equal(f[0].commit, 'abc1234567');
  assert.equal(f[0].file, 'docs/thing.md');
  assert.match(f[0].kind, /credential/);
});

test('flags a credential even on a removed (-) line — the diff still carries it', () => {
  const f = findingsInPatch(patch({ lines: ['-old line with ' + AWS_KEY] }));
  assert.equal(f.length, 1);
  assert.match(f[0].kind, /credential/);
});

test('flags a home-directory path shape', () => {
  const f = findingsInPatch(patch({ lines: ['+see ' + HOME_PATH + '/config'] }));
  assert.equal(f.length, 1);
  assert.match(f[0].kind, /home-directory/);
});

test('clean patch yields no findings', () => {
  const f = findingsInPatch(
    patch({ lines: ['+a perfectly ordinary line', '-another ordinary line', ' context'] }),
  );
  assert.deepEqual(f, []);
});

test('the same finding is reported once per commit+file+kind, not per line', () => {
  const f = findingsInPatch(
    patch({ lines: ['+first ' + AWS_KEY, '+second ' + AWS_KEY, '+third ' + AWS_KEY] }),
  );
  assert.equal(f.length, 1);
});

test('parses multiple commits and attributes each finding correctly', () => {
  const text =
    patch({ commit: '1111111111', file: 'a.md', lines: ['+clean here'] }) +
    '\n' +
    patch({ commit: '2222222222', file: 'b.md', lines: ['+leak ' + AWS_KEY] });
  const f = findingsInPatch(text);
  assert.equal(f.length, 1);
  assert.equal(f[0].commit, '2222222222');
  assert.equal(f[0].file, 'b.md');
});
