// Spec 011-01: every text colour meets WCAG 2.1 AA (>= 4.5:1) in both modes.
//
// Parses the two token blocks of public/index.html (the light `:root` and the
// dark `@media (prefers-color-scheme: dark)` override), resolves `var(--x)`
// aliases per mode (AC4c), and checks every token used as a text colour
// (a `color:` declaration in index.html or an inline style in render.mjs)
// against every text-bearing surface (AC1/AC2). Explicit chip pairs (a chip
// fill with its own text token) are checked separately, not through the grid.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, '..', 'public', 'index.html'), 'utf8');
const renderSrc = fs.readFileSync(path.join(here, '..', 'public', 'render.mjs'), 'utf8');

const AA = 4.5;

// The rule: a surface is listed if text can sit on it. Pure fills (e.g.
// --inset, --track, the meter cells) carry no text and are not listed. Chip
// fills are checked as explicit pairs below, not added here.
const SURFACES = ['--canvas', '--sheet', '--topbar', '--hover', '--blocked-bg', '--warn-bg'];

// Each chip fill against its own text token. Chip text tokens are excluded
// from the surface grid (they only ever sit on their chip fill).
const CHIP_PAIRS = [['--on-chip-amber', '--chip-amber-bg']];
const CHIP_TEXT = new Set(CHIP_PAIRS.map(([fg]) => fg));

// Non-colour keywords a `color:` declaration may use without being a literal.
const KEYWORDS = new Set(['inherit', 'currentcolor', 'transparent', 'initial', 'unset']);

function decls(block) {
  const out = {};
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

function tokenBlocks(src) {
  const light = src.match(/<style>\s*(?:\/\*[\s\S]*?\*\/\s*)?:root\s*\{([^}]*)\}/);
  const dark = src.match(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([^}]*)\}/);
  assert.ok(light, 'light :root token block not found');
  assert.ok(dark, 'dark @media :root token block not found');
  return { light: decls(light[1]), dark: decls(dark[1]) };
}

const blocks = tokenBlocks(html);
const MODES = {
  light: blocks.light,
  // The dark block only overrides; anything declared once in :root (aliases,
  // mode-invariant chip tokens) carries through.
  dark: { ...blocks.light, ...blocks.dark },
};

function resolve(map, name, seen = new Set()) {
  if (seen.has(name)) throw new Error(`alias cycle at ${name}`);
  seen.add(name);
  const v = map[name];
  if (v === undefined) throw new Error(`token ${name} is not declared`);
  const alias = v.match(/^var\((--[\w-]+)\)$/);
  return alias ? resolve(map, alias[1], seen) : v;
}

function rgb(hex) {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) throw new Error(`not a 6-digit hex colour: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
}

function luminance(hex) {
  const [r, g, b] = rgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Every `color:` declaration (with or without a space after the colon), not
// `border-color:` / `background-color:` etc.
function colorDecls(src) {
  return [...src.matchAll(/(?<![-\w])color\s*:\s*([^;"'}]+)/g)].map((m) => m[1].trim());
}

const allColorValues = [...colorDecls(html), ...colorDecls(renderSrc)];
const TEXT_TOKENS = [
  ...new Set(
    allColorValues
      .map((v) => v.match(/^var\((--[\w-]+)\)$/))
      .filter(Boolean)
      .map((m) => m[1])
      .filter((t) => !CHIP_TEXT.has(t)),
  ),
].sort();

test('011-01 AC2: the text-token set is found in both index.html and render.mjs', () => {
  assert.ok(TEXT_TOKENS.length >= 20, `expected the full text-token set, got ${TEXT_TOKENS.length}`);
  assert.ok(colorDecls(renderSrc).length >= 1, 'render.mjs inline style colours are scanned');
  assert.deepEqual(colorDecls('a{color:var(--x)}'), ['var(--x)'], 'no-space `color:var(...)` is matched');
  assert.deepEqual(colorDecls('a{border-color:var(--x)}'), [], 'border-color is not a text colour');
});

test('011-01 AC2: no `color:` declaration uses a literal colour instead of a token', () => {
  const literals = allColorValues.filter(
    (v) => !/^var\(--[\w-]+\)$/.test(v) && !KEYWORDS.has(v.toLowerCase()),
  );
  assert.deepEqual(literals, [], `literal colours in color: declarations: ${literals.join(', ')}`);
});

test('011-01 AC4c: aliases resolve per mode (an alias declared only in :root follows the dark override)', () => {
  // Synthetic check of the resolver itself, independent of the palette.
  const light = { '--a': '#111111', '--b': 'var(--a)' };
  const dark = { ...light, '--a': '#eeeeee' };
  assert.equal(resolve(light, '--b'), '#111111');
  assert.equal(resolve(dark, '--b'), '#eeeeee');
});

for (const [mode, map] of Object.entries(MODES)) {
  test(`011-01 AC1: every text token reaches ${AA}:1 on every text-bearing surface (${mode})`, () => {
    const failures = [];
    for (const fg of TEXT_TOKENS) {
      for (const bg of SURFACES) {
        const ratio = contrast(resolve(map, fg), resolve(map, bg));
        if (ratio < AA) failures.push(`${fg} on ${bg} = ${ratio.toFixed(2)}`);
      }
    }
    assert.deepEqual(failures, [], `${mode}: ${failures.length} pair(s) below ${AA}:1\n  ${failures.join('\n  ')}`);
  });

  test(`011-01 AC2: explicit chip pairs reach ${AA}:1 (${mode})`, () => {
    const failures = [];
    for (const [fg, bg] of CHIP_PAIRS) {
      const ratio = contrast(resolve(map, fg), resolve(map, bg));
      if (ratio < AA) failures.push(`${fg} on ${bg} = ${ratio.toFixed(2)}`);
    }
    assert.deepEqual(failures, []);
  });
}

test('011-01 AC4: chip tokens are mode-invariant (declared once, never overridden in the dark block)', () => {
  for (const [fg, bg] of CHIP_PAIRS) {
    assert.ok(fg in blocks.light && bg in blocks.light, `${fg}/${bg} declared in :root`);
    assert.ok(!(fg in blocks.dark) && !(bg in blocks.dark), `${fg}/${bg} not overridden in dark`);
  }
});

function rule(selector) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = html.match(new RegExp(`(?:^|[}\\s,])${esc}\\s*\\{([^}]*)\\}`, 'm'));
  return m ? m[1] : null;
}

test('011-01 AC3: older session rows are dimmed by text tokens, not opacity', () => {
  const older = rule('.session-row.older');
  assert.ok(older === null || !/opacity/.test(older), '.session-row.older must not use opacity');
  // Each child steps down one text level; the branch keeps the link colour.
  // (last-activity is not restyled: label/faint alias --text-dim, so a step is a no-op.)
  for (const child of ['.sr-title', '.sr-worktree']) {
    assert.ok(rule(`.session-row.older ${child}`), `older rows restyle ${child}`);
  }
  assert.equal(rule('.session-row.older .sr-last'), null, 'no no-op .sr-last override');
  assert.match(rule('.session-row.older .sr-title'), /color\s*:\s*var\(--text-body\)/);
});

test('011-01 AC4: the amber REVIEW verb is a chip (fill, border and text all overridden)', () => {
  const r = rule('.rv-REVIEW');
  assert.ok(r, '.rv-REVIEW rule exists');
  assert.match(r, /(?<![-\w])color\s*:\s*var\(--on-chip-amber\)/);
  assert.match(r, /background\s*:\s*var\(--chip-amber-bg\)/);
  assert.match(r, /border(?:-color)?\s*:[^;]*var\(--chip-amber-bg\)/);
});

// Every top-level CSS rule in index.html as [selector, body].
function allRules(src) {
  const css = src.match(/<style>([\s\S]*?)<\/style>/)[1].replace(/\/\*[\s\S]*?\*\//g, '');
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]]);
}

test('011-01: every amber chip fill hugs its text (fit-content or inline-block)', () => {
  const chips = allRules(html).filter(([, b]) => /background\s*:\s*var\(--chip-amber-bg\)/.test(b));
  assert.ok(chips.length >= 3, 'amber chip rules found');
  for (const [sel, body] of chips) {
    assert.ok(
      /width\s*:\s*fit-content/.test(body) || /display\s*:\s*inline-block/.test(body),
      `${sel} sets the chip fill but does not constrain its width`,
    );
  }
});

test('011-01: on-chip-amber text is only used together with the chip fill', () => {
  for (const [sel, body] of allRules(html)) {
    if (/(?<![-\w])color\s*:\s*var\(--on-chip-amber\)/.test(body)) {
      assert.match(body, /background\s*:\s*var\(--chip-amber-bg\)/, `${sel} uses --on-chip-amber without the chip fill`);
    }
  }
});
