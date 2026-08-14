#!/usr/bin/env node
/**
 * Dessau — silent-failure checker for CSS.
 *
 *   node scripts/check-css.mjs
 *
 * Catches five classes of mistake that produce NO error anywhere — no console
 * message, no broken layout, no failing test. Just a piece of design that is
 * quietly absent. Every one of these is the kind of thing that gets noticed
 * weeks later, in a product, by a user.
 *
 * 1. Undefined custom property.
 *    `var(--dds-space-4)` where that name does not exist makes the ENTIRE
 *    declaration invalid at computed-value time. It does not fall back to the
 *    previous declaration — it falls back to `inherit` or `initial`. A padding
 *    silently becomes zero. A `var(--x, 1rem)` fallback is valid and is ignored
 *    by this check.
 *
 * 2. A component reaching past the semantic layer to a primitive colour.
 *    Using `--dds-indigo-600` instead of `--dds-color-action-primary` renders
 *    correctly — and then does not change when the theme does, because
 *    primitives are theme-independent. It breaks only in dark mode, which is
 *    exactly where nobody looks first.
 *
 * 3. A raw colour where a semantic one exists.
 *    Same failure mode: correct today, wrong after the first re-theme.
 *
 * 4. A class JavaScript adds or removes that no stylesheet defines.
 *    The feature is simply absent. This check exists because exactly that
 *    happened: `dds-scroll-locked` was toggled by the dialog code and never
 *    defined, so the scroll lock behind every modal silently did nothing.
 *
 * 5. A named `@container` query with no matching `container-name`.
 *    The rule never matches anything. The component just stays in its base form,
 *    usually the narrow one, at every width.
 *
 * Zero dependencies, Node stdlib only. Exit code 1 on any finding.
 */

import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, basename } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSS_DIR = join(ROOT, 'dds/css');

/* ---------------------------------------------------------------- gathering */

async function layerFiles() {
  const entries = await readdir(CSS_DIR, { withFileTypes: true });
  return entries
    .filter(
      (entry) =>
        entry.isFile() && entry.name.endsWith('.css') && !entry.name.endsWith('.min.css')
    )
    .map((entry) => join(CSS_DIR, entry.name))
    .sort();
}

const files = [join(ROOT, 'dds/dds.css'), ...(await layerFiles())];

const sources = new Map();
for (const file of files) {
  sources.set(file, await readFile(file, 'utf8'));
}

/**
 * Strip comments before analysing.
 *
 * Without this, every explanatory comment mentioning `var(--dds-space-4)` as a
 * counter-example would be reported as a real usage — and these stylesheets
 * deliberately explain their own failure modes in prose. Comments are replaced
 * with equal-length whitespace so reported line numbers stay correct.
 */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '));
}

const stripped = new Map();
for (const [file, source] of sources) {
  stripped.set(file, stripComments(source));
}

/* ------------------------------------------------------------- definitions */

const defined = new Set();
for (const css of stripped.values()) {
  for (const match of css.matchAll(/(--dds-[\w-]+)\s*:/g)) {
    defined.add(match[1]);
  }
}

/** Every `.dds-*` class actually defined in a selector. */
const definedClasses = new Set();
for (const css of stripped.values()) {
  for (const match of css.matchAll(/\.(dds-[\w-]+)/g)) {
    definedClasses.add(match[1]);
  }
}

const primitives = new Set();
{
  const css = stripped.get(join(CSS_DIR, 'primitives.css')) || '';
  for (const match of css.matchAll(/(--dds-[\w-]+)\s*:/g)) {
    primitives.add(match[1]);
  }
}

const findings = [];

function report(file, line, rule, message) {
  findings.push({ file: relative(ROOT, file), line, rule, message });
}

function lineOf(css, index) {
  return css.slice(0, index).split('\n').length;
}

/* ------------------------------------------------------- 1. undefined vars */

for (const [file, css] of stripped) {
  // Capture the character after the name so a fallback can be detected.
  for (const match of css.matchAll(/var\(\s*(--[\w-]+)\s*([,)])/g)) {
    const [, name, terminator] = match;

    // A fallback keeps the declaration valid regardless.
    if (terminator === ',') continue;

    // Only DDS names are our responsibility; a product may pass its own in.
    if (!name.startsWith('--dds-')) continue;

    if (!defined.has(name)) {
      report(
        file,
        lineOf(css, match.index),
        'undefined-custom-property',
        `var(${name}) is never defined — the whole declaration is invalid at computed-value time`
      );
    }
  }
}

/* ------------------------ 2. primitive colours outside the foundation layer */

const FOUNDATION_FILES = new Set(['primitives.css', 'semantic.css']);

for (const [file, css] of stripped) {
  if (FOUNDATION_FILES.has(basename(file))) continue;

  for (const match of css.matchAll(/var\(\s*(--dds-[\w-]+)/g)) {
    const name = match[1];
    if (!primitives.has(name)) continue;

    // Space, radius, type, motion, z-index and border widths have no semantic
    // alias by design — they are not theme-dependent, so consuming them directly
    // is correct. Only the colour primitives are a real problem.
    const isColourPrimitive = /^--dds-(stone|indigo|clay|green|amber|red|cyan)-/.test(name);
    if (!isColourPrimitive) continue;

    report(
      file,
      lineOf(css, match.index),
      'primitive-colour',
      `${name} is a primitive — use a semantic colour token, or this will not follow the theme`
    );
  }
}

/* ------------------------------------------------- 3. raw colours downstream */

const DOWNSTREAM_FILES = new Set([
  'components.css',
  'components-forms.css',
  'components-navigation.css',
  'components-content.css',
  'patterns.css',
  'patterns-flows.css',
  'layout.css',
  'typography.css',
  'utilities.css',
]);

for (const [file, css] of stripped) {
  if (!DOWNSTREAM_FILES.has(basename(file))) continue;

  for (const match of css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    report(
      file,
      lineOf(css, match.index),
      'raw-colour',
      `${match[0]} is a raw colour — use a semantic colour token`
    );
  }

  for (const match of css.matchAll(/\b(rgb|hsl)a?\(/g)) {
    // No exceptions. Translucent overlays are the one legitimate case for a raw
    // colour, and they now live behind `--dds-color-overlay*` in semantic.css —
    // so a downstream file reaching for rgb() directly is always a finding.
    report(
      file,
      lineOf(css, match.index),
      'raw-colour',
      `${match[0]}…) is a raw colour — use a semantic colour token`
    );
  }
}

/* -------------------------- 4. classes used by JS but never defined in CSS */

/**
 * A class that JavaScript adds or removes but no stylesheet defines does nothing.
 * No error, no visual change — the feature is simply absent.
 *
 * This check exists because exactly that happened: `dds-scroll-locked` was added
 * and removed by the dialog code and never defined, so the scroll lock behind every
 * modal silently did not work. The CSS-only checks above could not see it, because
 * nothing in the CSS was wrong.
 */
{
  const jsFiles = [];
  async function collect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await collect(path);
      else if (entry.name.endsWith('.js')) jsFiles.push(path);
    }
  }
  await collect(join(ROOT, 'dds/js'));

  for (const file of jsFiles) {
    const source = stripComments(await readFile(file, 'utf8'));

    // classList.add('x') / .remove('x') / .toggle('x'), and className = 'x y'.
    const references = new Set();
    for (const match of source.matchAll(/classList\.(?:add|remove|toggle)\(\s*'([^']+)'/g)) {
      match[1].split(/\s+/).forEach((name) => references.add(name));
    }
    for (const match of source.matchAll(/className\s*=\s*'([^']+)'/g)) {
      match[1].split(/\s+/).forEach((name) => references.add(name));
    }
    for (const match of source.matchAll(/setAttribute\(\s*'class'\s*,\s*'([^']+)'/g)) {
      match[1].split(/\s+/).forEach((name) => references.add(name));
    }

    for (const name of references) {
      if (!name.startsWith('dds-')) continue;
      // A trailing hyphen means the name is built by concatenation —
      // `'dds-toast-' + kind`. The complete name is not knowable statically, so
      // there is nothing to verify. Reporting it would be a false positive that
      // teaches people to ignore this check.
      if (name.endsWith('-')) continue;
      if (definedClasses.has(name)) continue;
      report(
        file,
        1,
        'undefined-class',
        `JavaScript references .${name} but no stylesheet defines it — the feature silently does nothing`
      );
    }
  }
}

/* ------------------------------------------------------ 5. container queries */

const containerNames = new Set();
for (const css of stripped.values()) {
  for (const match of css.matchAll(/container-name\s*:\s*([^;]+);/g)) {
    match[1]
      .split(/\s+/)
      .map((name) => name.trim())
      .filter(Boolean)
      .forEach((name) => containerNames.add(name));
  }
  // The shorthand also establishes a name: `container: <name> / <type>`.
  for (const match of css.matchAll(/[^-]container\s*:\s*([\w-]+)\s*\//g)) {
    containerNames.add(match[1]);
  }
}

for (const [file, css] of stripped) {
  for (const match of css.matchAll(/@container\s+([\w-]+)\s*\(/g)) {
    const name = match[1];
    // An unnamed `@container (width > x)` targets the nearest container and is
    // valid; only a *named* query can point at a name that does not exist.
    if (!containerNames.has(name)) {
      report(
        file,
        lineOf(css, match.index),
        'orphan-container-query',
        `@container ${name} has no matching container-name — the rule never matches, so the component stays in its base form at every width`
      );
    }
  }
}

/* ------------------------------------------------------------------ report */

const byRule = new Map();
for (const finding of findings) {
  if (!byRule.has(finding.rule)) byRule.set(finding.rule, []);
  byRule.get(finding.rule).push(finding);
}

for (const [rule, list] of byRule) {
  console.log(`\n${rule} (${list.length}):`);
  for (const finding of list) {
    console.log(`  ${finding.file}:${finding.line}`);
    console.log(`    ${finding.message}`);
  }
}

console.log(
  `\n${files.length} stylesheets checked, ${defined.size} custom properties defined ` +
    `(${primitives.size} primitive), ${containerNames.size} container names. ` +
    (findings.length === 0 ? 'No silent failures found.' : `${findings.length} FINDINGS.`)
);

process.exit(findings.length === 0 ? 0 : 1);
