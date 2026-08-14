#!/usr/bin/env node
/**
 * Dessau — contrast checker.
 *
 * Reads the semantic colour tokens straight out of the CSS (no duplicated
 * palette in this file) and verifies every pair that a user can actually see
 * against WCAG 2.2 AA:
 *
 *   - 4.5:1  normal body text
 *   - 3:1    large text (>=24px, or >=18.66px bold) and non-text UI
 *            (component boundaries, focus indicators, graphical objects)
 *
 * Why this exists: contrast regressions are silent. Nothing throws, nothing
 * looks broken in a screenshot — the text is just harder to read for people
 * who need the contrast. A machine check is the only reliable guard.
 *
 * Zero dependencies, Node stdlib only. Exit code 1 on any failure.
 *
 *   node scripts/check-contrast.mjs
 *   node scripts/check-contrast.mjs --verbose   # print passing pairs too
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VERBOSE = process.argv.includes('--verbose');

/* ---------------------------------------------------------------- colour maths */

function parseHex(hex) {
  const h = hex.trim().replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

/** Relative luminance per WCAG 2.x definition. */
function luminance([r, g, b]) {
  const lin = [r, g, b]
    .map((c) => c / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function ratio(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/* ------------------------------------------------------- token extraction */

/**
 * Pull `--dds-*: value` declarations out of a CSS block.
 * `blockSelector` picks which rule to read, so light and dark are read from
 * the same file without maintaining a second copy of the values here.
 */
function extractTokens(css, blockSelector) {
  // Match the selector only where it starts a rule at the beginning of a line.
  // Searching the raw text with indexOf() is not enough: these files describe
  // their own selectors in prose, so `[data-theme="dark"]` also appears inside
  // a header comment. That match returned an empty token set and every dark
  // pair was silently checked against the light values instead.
  const anchored = new RegExp(
    // The selector may head a list — `:root, [data-theme="light"] { … }` — so a
    // trailing comma-separated tail is allowed before the brace. Without this the
    // extractor threw the moment the light values gained a second selector, which
    // was the correct failure but not a useful one.
    `^\\s*${blockSelector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(?:,[^{}]*)?\\{`,
    'm'
  );
  const found = anchored.exec(css);
  if (!found) throw new Error(`Selector not found as a rule in CSS: ${blockSelector}`);

  // The token blocks contain no nested braces, so scanning to the first `}`
  // is sufficient and keeps this parser trivial.
  const open = found.index + found[0].length - 1;
  const close = css.indexOf('}', open);
  const body = css.slice(open + 1, close);

  const tokens = new Map();
  for (const line of body.split('\n')) {
    const m = line.match(/(--dds-[\w-]+)\s*:\s*([^;]+);/);
    if (m) tokens.set(m[1], m[2].trim());
  }
  return tokens;
}

/** Resolve a token to a hex value, following `var(--other)` indirection. */
function resolve(tokens, name, seen = new Set()) {
  if (seen.has(name)) throw new Error(`Circular token reference at ${name}`);
  seen.add(name);
  const raw = tokens.get(name);
  if (raw === undefined) throw new Error(`Undefined token: ${name}`);
  const varRef = raw.match(/^var\(\s*(--[\w-]+)\s*\)$/);
  if (varRef) return resolve(tokens, varRef[1], seen);
  const rgb = parseHex(raw);
  if (!rgb) throw new Error(`Token ${name} is not a plain hex colour: ${raw}`);
  return rgb;
}

/* --------------------------------------------------------------- the matrix */

/**
 * Every pair we promise. `min` is the threshold that applies to that pair's
 * role: 4.5 for body text, 3 for large text and non-text UI.
 *
 * Adding a semantic colour token means adding it here. A token nobody checks
 * is a token nobody can trust.
 */
const SURFACES = [
  '--dds-color-surface-page',
  '--dds-color-surface-default',
  '--dds-color-surface-raised',
  '--dds-color-surface-sunken',
];

const PAIRS = [
  // --- body text on every surface -----------------------------------------
  ...SURFACES.flatMap((surface) => [
    { fg: '--dds-color-text-default', bg: surface, min: 4.5, role: 'body text' },
    { fg: '--dds-color-text-subtle', bg: surface, min: 4.5, role: 'secondary text' },
    { fg: '--dds-color-text-muted', bg: surface, min: 4.5, role: 'muted text' },
    { fg: '--dds-color-text-link', bg: surface, min: 4.5, role: 'link text' },
    { fg: '--dds-color-text-link-hover', bg: surface, min: 4.5, role: 'link hover' },
    { fg: '--dds-color-text-link-visited', bg: surface, min: 4.5, role: 'link visited' },
  ]),

  // --- non-text UI: borders and focus must be visible on every surface ----
  ...SURFACES.flatMap((surface) => [
    { fg: '--dds-color-border-default', bg: surface, min: 3, role: 'component border' },
    { fg: '--dds-color-border-strong', bg: surface, min: 3, role: 'strong border' },
    { fg: '--dds-color-border-field', bg: surface, min: 3, role: 'input border' },
    { fg: '--dds-color-focus-ring', bg: surface, min: 3, role: 'focus indicator' },
  ]),

  // --- action (primary button): label on fill, and fill against the page --
  { fg: '--dds-color-action-on-primary', bg: '--dds-color-action-primary', min: 4.5, role: 'primary button label' },
  { fg: '--dds-color-action-on-primary', bg: '--dds-color-action-primary-hover', min: 4.5, role: 'primary button label (hover)' },
  { fg: '--dds-color-action-on-primary', bg: '--dds-color-action-primary-active', min: 4.5, role: 'primary button label (active)' },
  { fg: '--dds-color-action-primary', bg: '--dds-color-surface-default', min: 3, role: 'primary button fill vs surface' },

  // --- status text and borders on the surfaces they are used on -----------
  ...['success', 'warning', 'error', 'info'].flatMap((kind) => [
    { fg: `--dds-color-text-${kind}`, bg: '--dds-color-surface-default', min: 4.5, role: `${kind} text` },
    { fg: `--dds-color-text-${kind}`, bg: '--dds-color-surface-page', min: 4.5, role: `${kind} text on page` },
    { fg: `--dds-color-text-${kind}`, bg: `--dds-color-surface-${kind}`, min: 4.5, role: `${kind} text on its own tint` },
    { fg: `--dds-color-border-${kind}`, bg: '--dds-color-surface-default', min: 3, role: `${kind} border` },
    { fg: `--dds-color-border-${kind}`, bg: `--dds-color-surface-${kind}`, min: 3, role: `${kind} border on its own tint` },
    // Body text has to stay readable on the tinted status surfaces too.
    { fg: '--dds-color-text-default', bg: `--dds-color-surface-${kind}`, min: 4.5, role: `body text on ${kind} tint` },
  ]),

  // --- solid status fills (toasts): deliberately identical in both themes -
  ...['success', 'warning', 'error', 'info'].map((kind) => ({
    fg: `--dds-color-on-${kind}-solid`,
    bg: `--dds-color-${kind}-solid`,
    min: 4.5,
    role: `${kind} solid fill label`,
  })),

  // --- selection --------------------------------------------------------
  { fg: '--dds-color-selection-text', bg: '--dds-color-selection-bg', min: 4.5, role: 'text selection' },

  // --- accent is decorative only: never text, but must be a visible object -
  { fg: '--dds-color-accent', bg: '--dds-color-surface-default', min: 3, role: 'accent as graphical object' },
];

/* ------------------------------------------------------------------- runner */

const cssPath = join(ROOT, 'dds/css/semantic.css');
const primitivesPath = join(ROOT, 'dds/css/primitives.css');

const semanticCss = await readFile(cssPath, 'utf8');
const primitiveCss = await readFile(primitivesPath, 'utf8');

const primitives = extractTokens(primitiveCss, ':root');

const themes = [
  { name: 'light', selector: ':root' },
  { name: 'dark', selector: '[data-theme="dark"]' },
];

let failures = 0;
let checks = 0;

for (const theme of themes) {
  const tokens = new Map([...primitives, ...extractTokens(semanticCss, theme.selector)]);
  // Dark mode only overrides what changes; unlisted tokens inherit from :root.
  const base = theme.name === 'dark'
    ? new Map([...primitives, ...extractTokens(semanticCss, ':root'), ...extractTokens(semanticCss, theme.selector)])
    : tokens;

  const lines = [];
  for (const pair of PAIRS) {
    let fg, bg;
    try {
      fg = resolve(base, pair.fg);
      bg = resolve(base, pair.bg);
    } catch (err) {
      console.error(`  ERROR ${theme.name}: ${err.message}`);
      failures++;
      continue;
    }
    const r = ratio(fg, bg);
    const ok = r >= pair.min;
    checks++;
    if (!ok) failures++;
    if (!ok || VERBOSE) {
      lines.push(
        `  ${ok ? 'pass' : 'FAIL'}  ${r.toFixed(2).padStart(6)}:1  (min ${pair.min})  ` +
        `${pair.role}\n         ${pair.fg} on ${pair.bg}`
      );
    }
  }

  if (lines.length) {
    console.log(`\n${theme.name}:`);
    console.log(lines.join('\n'));
  }
}

console.log(
  `\n${checks} contrast pairs checked across light and dark. ` +
  (failures === 0 ? 'All meet WCAG 2.2 AA.' : `${failures} FAILED.`)
);

process.exit(failures === 0 ? 0 : 1);
