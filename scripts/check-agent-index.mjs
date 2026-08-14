#!/usr/bin/env node
/**
 * Dessau — verify the agent index against reality.
 *
 *   node scripts/check-agent-index.mjs
 *
 * `agent/index.json` is the machine-readable inventory an agent queries to answer
 * "does this already exist?". It is hand-maintained, because the useful parts —
 * purpose, when not to use it, the accessibility notes — cannot be derived from
 * CSS.
 *
 * Hand-maintained means it can go stale, and **stale context is worse than no
 * context**: an agent trusts it. So every claim it makes is checked here:
 *
 *   - every listed CSS class actually exists in the stylesheets;
 *   - every listed file actually exists;
 *   - every listed `data-dds-*` hook appears in the JavaScript;
 *   - every documented component and pattern has a specification section;
 *   - nothing in the CSS is missing from the index.
 *
 * The last check is the one that catches drift in the other direction: a
 * component added to the CSS and forgotten in the index is invisible to an agent,
 * which will then build a second one.
 *
 * Zero dependencies, Node stdlib only. Exit code 1 on any finding.
 * @catches A claim in `agent/index.json` that no longer holds — a missing class,
 *   file, hook or specification section — and the reverse: a component in the CSS
 *   that no entry covers, which an agent cannot discover and will build a second
 *   time.
 *
 */

import { readFile, readdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const findings = [];
const report = (message) => findings.push(message);

/* ------------------------------------------------------------------ inputs */

const index = JSON.parse(await readFile(join(ROOT, 'agent/index.json'), 'utf8'));

const CSS_DIR = join(ROOT, 'dds/css');
const cssFiles = (await readdir(CSS_DIR)).filter((name) => name.endsWith('.css'));

let allCss = '';
for (const name of cssFiles) {
  allCss += await readFile(join(CSS_DIR, name), 'utf8');
}

/** Strip comments, so a class named only in prose does not count as defined. */
const cssCode = allCss.replace(/\/\*[\s\S]*?\*\//g, '');

/** Every `.dds-*` class actually defined in a selector. */
const definedClasses = new Set(
  [...cssCode.matchAll(/\.(dds-[\w-]+)/g)].map((match) => match[1])
);

/** Every `data-dds-*` attribute referenced anywhere in the JS. */
async function collectJs(directory) {
  let source = '';
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) source += await collectJs(path);
    else if (entry.name.endsWith('.js')) source += await readFile(path, 'utf8');
  }
  return source;
}

const allJs = await collectJs(join(ROOT, 'dds/js'));
const jsHooks = new Set(
  [...allJs.matchAll(/data-dds-[\w-]+/g)].map((match) => match[0])
);

const componentsDoc = await readFile(join(ROOT, 'agent/components.md'), 'utf8');
const patternsDoc = await readFile(join(ROOT, 'agent/patterns.md'), 'utf8');

async function exists(relative) {
  try {
    await access(join(ROOT, relative));
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------- checks */

const entries = [
  ...index.components.map((entry) => ({ ...entry, kind: 'component' })),
  ...index.patterns.map((entry) => ({ ...entry, kind: 'pattern' })),
];

const indexedClasses = new Set();

for (const entry of entries) {
  const label = `${entry.kind} "${entry.name}"`;

  // Classes must exist in the CSS.
  for (const className of entry.classes || []) {
    const bare = className.replace(/^\./, '');
    indexedClasses.add(bare);
    if (!definedClasses.has(bare)) {
      report(`${label}: class .${bare} is not defined in any stylesheet`);
    }
  }

  // Files must exist.
  for (const file of [entry.css, entry.js].flat().filter(Boolean)) {
    if (!(await exists(file))) {
      report(`${label}: file ${file} does not exist`);
    }
  }

  // JS hooks must appear in the JavaScript.
  for (const hook of entry.hooks || []) {
    if (!jsHooks.has(hook)) {
      report(`${label}: hook ${hook} is not referenced in any script`);
    }
  }

  // Every entry needs a specification section.
  const doc = entry.kind === 'component' ? componentsDoc : patternsDoc;
  const docName = entry.kind === 'component' ? 'components.md' : 'patterns.md';
  if (!doc.includes(entry.spec)) {
    report(`${label}: spec heading "${entry.spec}" not found in agent/${docName}`);
  }

  // Every entry needs a rendered example.
  if (entry.reference && !(await exists(entry.reference.split('#')[0]))) {
    report(`${label}: reference page ${entry.reference} does not exist`);
  }
}

/* --- drift the other way: a component in the CSS but not in the index ----- */

/**
 * Root class names — `.dds-button` but not `.dds-button-primary`. A component's
 * parts and variants do not each need an index entry; its root does.
 *
 * Anything listed here is deliberately not an index entry: layout primitives,
 * utilities and type helpers are documented in foundations.md and layout, not as
 * components.
 */
const NOT_COMPONENTS = new Set([
  // layout primitives
  'dds-container', 'dds-stack', 'dds-cluster', 'dds-grid', 'dds-sidebar',
  'dds-split', 'dds-center', 'dds-scroll', 'dds-visually', 'dds-skip', 'dds-defer',
  // typography and utilities
  'dds-text', 'dds-weight', 'dds-font', 'dds-display', 'dds-eyebrow', 'dds-prose',
  'dds-numeric', 'dds-code', 'dds-truncate', 'dds-clamp', 'dds-nowrap',
  'dds-measure', 'dds-mbs', 'dds-mbe', 'dds-hidden', 'dds-sr', 'dds-decorative',
  'dds-surface', 'dds-elevation', 'dds-radius', 'dds-w', 'dds-no',
  'dds-scroll-locked',
]);

const roots = new Set();
for (const className of definedClasses) {
  // A root is the first two hyphen-separated segments: dds-<name>.
  const match = className.match(/^(dds-[a-z0-9]+)/);
  if (match) roots.add(match[1]);
}

for (const root of [...roots].sort()) {
  if (NOT_COMPONENTS.has(root)) continue;
  // Is any indexed class inside this root's family?
  const covered = [...indexedClasses].some(
    (indexed) => indexed === root || indexed.startsWith(root + '-')
  );
  if (!covered) {
    report(
      `.${root}* exists in the CSS but no index entry covers it — ` +
        `an agent cannot discover it and will build a second one`
    );
  }
}

/* ------------------------------------------------------------------ report */

if (findings.length) {
  console.log('');
  for (const finding of findings) console.log(`  ${finding}`);
}

console.log(
  `\n${entries.length} entries checked ` +
    `(${index.components.length} components, ${index.patterns.length} patterns), ` +
    `${definedClasses.size} classes defined, ${jsHooks.size} hooks found. ` +
    (findings.length === 0 ? 'Index matches the implementation.' : `${findings.length} FINDINGS.`)
);

process.exit(findings.length === 0 ? 0 : 1);
