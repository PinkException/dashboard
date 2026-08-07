import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { denyTokensFromConfig, tokenRegex, scanFiles } from '../tools/leak-guard.mjs';

function tmpConfig(obj) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'leakguard-'));
  const p = path.join(dir, 'config.json');
  fs.writeFileSync(p, JSON.stringify(obj));
  return p;
}

test('deny tokens are the project basenames, excluding this repo', () => {
  const cfg = tmpConfig({
    projects: [
      { path: '~/Documents/Claude/dashboard', label: 'this page' },
      { path: '~/Documents/Claude/sample-alpha', label: 'x' },
      { path: '~/Documents/Claude/sample-beta', label: 'y' },
    ],
  });
  const tokens = denyTokensFromConfig(cfg);
  assert.ok(tokens.includes('sample-alpha'));
  assert.ok(tokens.includes('sample-beta'));
  assert.ok(!tokens.includes('dashboard'), 'own repo name must not be a deny token');
});

test('missing or malformed config yields null (does not block)', () => {
  assert.equal(denyTokensFromConfig('/no/such/config.json'), null);
  const bad = tmpConfig('not json');
  fs.writeFileSync(bad, '{ this is not json');
  assert.equal(denyTokensFromConfig(bad), null);
});

test('tokenRegex matches whole token, not substrings', () => {
  const re = tokenRegex('sample-alpha');
  assert.ok(re.test('the sample-alpha project'));
  assert.ok(re.test('SAMPLE-ALPHA in caps'));
  assert.ok(!re.test('sample-alphabet is different'));
});

test('scanFiles flags a private name and reports file:line', () => {
  const files = { 'docs/brief.md': 'row for sample-alpha here\nclean line' };
  const hits = scanFiles(Object.keys(files), ['sample-alpha'], (f) => files[f]);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].file, 'docs/brief.md');
  assert.equal(hits[0].line, 1);
  assert.equal(hits[0].token, 'sample-alpha');
});

test('scanFiles passes clean content', () => {
  const files = { 'docs/brief.md': 'only invented names: Trailhead, Verdant' };
  const hits = scanFiles(Object.keys(files), ['sample-alpha'], (f) => files[f]);
  assert.equal(hits.length, 0);
});
