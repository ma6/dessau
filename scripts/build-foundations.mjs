#!/usr/bin/env node
/**
 * Dessau — machine-readable foundations export.
 *
 *   node scripts/build-foundations.mjs
 *   node scripts/build-foundations.mjs --check   # verify only, exit 1 if stale
 *
 * Writes `dds/foundations.json`: every foundation value, both themes, with its
 * layer and its resolved value.
 *
 * -----------------------------------------------------------------------------
 * Why an export, and why it is generated
 * -----------------------------------------------------------------------------
 *
 * Design tools, native apps and anything that is not a browser cannot read CSS
 * custom properties. Without an export, those consumers end up transcribing
 * values by hand — which is how a design file and an implementation drift apart
 * while both look authoritative.
 *
 * It is derived, one-directionally: **the CSS is the source of truth.** The
 * generated file is downstream of `primitives.css` and `semantic.css`, never
 * upstream. If the export and the CSS disagree, the CSS is right and the export
 * is stale — which is what `--check` is for.
 *
 * That direction is deliberate. The alternative — a JSON file that generates the
 * CSS — sounds tidier and means the values you can actually run in a browser are
 * no longer the ones you edit.
 *
 * Zero dependencies, Node stdlib only.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK_ONLY = process.argv.includes('--check');

const OUT = join(ROOT, 'dds/foundations.json');

/** Read a rule's declarations, anchored so a mention in prose is not matched. */
function extractBlock(css, selector) {
  const anchored = new RegExp(
    `^\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{`,
    'm'
  );
  const found = anchored.exec(css);
  if (!found) throw new Error(`Selector not found as a rule: ${selector}`);

  const open = found.index + found[0].length - 1;
  const close = css.indexOf('}', open);
  const body = css.slice(open + 1, close);

  const declarations = new Map();
  for (const line of body.split('\n')) {
    const match = line.match(/(--dds-[\w-]+)\s*:\s*([^;]+);/);
    if (match) declarations.set(match[1], match[2].trim());
  }
  return declarations;
}

/** Follow `var(--other)` indirection to a literal value. */
function resolve(all, name, seen = new Set()) {
  if (seen.has(name)) throw new Error(`Circular reference at ${name}`);
  seen.add(name);

  const raw = all.get(name);
  if (raw === undefined) return null;

  const reference = raw.match(/^var\(\s*(--[\w-]+)\s*\)$/);
  if (reference) return resolve(all, reference[1], seen);

  return raw;
}

/**
 * Group a name into a category, so a consumer can find "all the colours" without
 * pattern-matching on names itself.
 */
function categoryOf(name) {
  if (/^--dds-color-/.test(name)) return 'color';
  if (/^--dds-(stone|indigo|clay|green|amber|red|cyan)-/.test(name)) return 'palette';
  if (/^--dds-font-size-/.test(name)) return 'fontSize';
  if (/^--dds-font-weight-/.test(name)) return 'fontWeight';
  if (/^--dds-font-/.test(name)) return 'fontFamily';
  if (/^--dds-line-height-/.test(name)) return 'lineHeight';
  if (/^--dds-letter-spacing-/.test(name)) return 'letterSpacing';
  if (/^--dds-measure-/.test(name)) return 'measure';
  if (/^--dds-space-/.test(name)) return 'space';
  if (/^--dds-radius-/.test(name)) return 'radius';
  if (/^--dds-border-/.test(name)) return 'border';
  if (/^--dds-container-/.test(name)) return 'container';
  if (/^--dds-shadow-|^--dds-elevation-/.test(name)) return 'elevation';
  if (/^--dds-duration-|^--dds-ease-/.test(name)) return 'motion';
  if (/^--dds-z-/.test(name)) return 'zIndex';
  if (/^--dds-focus-/.test(name)) return 'focus';
  return 'other';
}

const primitivesCss = await readFile(join(ROOT, 'dds/css/primitives.css'), 'utf8');
const semanticCss = await readFile(join(ROOT, 'dds/css/semantic.css'), 'utf8');

const primitives = extractBlock(primitivesCss, ':root');
const semanticLight = extractBlock(semanticCss, ':root');
const semanticDark = extractBlock(semanticCss, '[data-theme="dark"]');

const lightAll = new Map([...primitives, ...semanticLight]);
// Dark overrides only what changes; everything else inherits from :root.
const darkAll = new Map([...primitives, ...semanticLight, ...semanticDark]);

/** Build the primitive layer: literal values, no theme. */
const palette = {};
for (const [name, raw] of primitives) {
  const category = categoryOf(name);
  palette[category] ??= {};
  palette[category][name] = { value: raw };
}

/** Build the semantic layer: intent, with both themes where they differ. */
const semantic = {};
for (const name of semanticLight.keys()) {
  const category = categoryOf(name);
  semantic[category] ??= {};

  const light = resolve(lightAll, name);
  const dark = resolve(darkAll, name);

  semantic[category][name] = {
    /** What it points at, so the indirection stays visible. */
    reference: semanticLight.get(name),
    light,
    // Only recorded when it actually differs — a `dark` on every entry would
    // suggest every value is theme-dependent, and most are not.
    ...(dark !== light ? { dark } : {}),
    ...(semanticDark.has(name) ? { darkReference: semanticDark.get(name) } : {}),
  };
}

const output = {
  $schema: 'https://dessau.local/foundations.schema.json',
  name: 'Dessau Design System foundations',
  namespace: 'dds',

  generator: {
    script: 'scripts/build-foundations.mjs',
    note:
      'GENERATED — do not edit. The CSS is the source of truth: dds/css/primitives.css ' +
      'and dds/css/semantic.css. If this file and the CSS disagree, the CSS is right ' +
      'and this file is stale. Regenerate with `node scripts/build-foundations.mjs`.',
    sources: ['dds/css/primitives.css', 'dds/css/semantic.css'],
  },

  themes: ['light', 'dark'],
  themeSelector: '[data-theme="dark"]',

  layers: {
    palette: {
      description:
        'Primitive values. Literal, no intent, no theme awareness. Components must ' +
        'NOT consume these — a primitive does not follow the theme, so using one ' +
        'breaks dark mode and nothing else.',
      values: palette,
    },
    semantic: {
      description:
        'Intent. What components consume. `reference` is what the value points at ' +
        'in the palette layer; `light` and `dark` are the resolved literals.',
      values: semantic,
    },
  },

  counts: {
    palette: primitives.size,
    semantic: semanticLight.keys.length ?? semanticLight.size,
    darkOverrides: semanticDark.size,
  },
};

const serialised = JSON.stringify(output, null, 2) + '\n';

let existing = null;
try {
  existing = await readFile(OUT, 'utf8');
} catch {
  // Not generated yet.
}

if (CHECK_ONLY) {
  if (existing === serialised) {
    console.log(`dds/foundations.json is current (${primitives.size} palette, ${semanticLight.size} semantic).`);
    process.exit(0);
  }
  console.error('dds/foundations.json is STALE — run: node scripts/build-foundations.mjs');
  process.exit(1);
}

await writeFile(OUT, serialised, 'utf8');

console.log(
  `Wrote dds/foundations.json\n` +
    `  ${primitives.size} palette values\n` +
    `  ${semanticLight.size} semantic values\n` +
    `  ${semanticDark.size} dark-mode overrides`
);
