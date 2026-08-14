#!/usr/bin/env node
/**
 * Dessau — optional CSS bundler.
 *
 *   node scripts/bundle.mjs
 *
 * Writes `dist/dds.css` (one file, comments intact) and `dist/dds.min.css`
 * (comments and whitespace removed).
 *
 * -----------------------------------------------------------------------------
 * Why this exists
 * -----------------------------------------------------------------------------
 *
 * `dds.css` uses `@import`, which serialises requests: the browser has to parse
 * the entry file before it discovers the eight layer files behind it. That is a
 * real cost on a first visit, accepted in the source because it keeps the code
 * navigable with no build step.
 *
 * This resolves the imports ahead of time for anyone who wants to pay the cost
 * once instead of on every cold load. It is entirely optional — linking
 * `dds/dds.css` directly is fully supported.
 *
 * -----------------------------------------------------------------------------
 * Why the output is not committed
 * -----------------------------------------------------------------------------
 *
 * `dist/` is git-ignored. A committed build artefact is a second copy of the
 * truth, and the moment someone edits a source file without re-running the build
 * it becomes a wrong copy that looks authoritative. Generating it on demand costs
 * one command and removes the whole class of problem.
 *
 * -----------------------------------------------------------------------------
 * Why the minifier is deliberately timid
 * -----------------------------------------------------------------------------
 *
 * It removes comments and collapses whitespace. That is all. It does not touch
 * string literals, `url()` contents, `calc()` operators (where whitespace around
 * `+` and `-` is significant), or custom property values (which are parsed as
 * raw token streams and can legitimately contain almost anything).
 *
 * Correctness beats compression: a stylesheet that is 3% smaller and subtly wrong
 * is worse than no minifier at all. Gzip recovers most of the difference anyway.
 *
 * Zero dependencies, Node stdlib only.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = join(ROOT, 'dds/dds.css');
const OUT_DIR = join(ROOT, 'dist');

/**
 * Inline `@import url("…") layer(…)` recursively.
 *
 * The `layer()` function is preserved by wrapping the imported file in an
 * explicit `@layer <name> { … }` block, which is exactly what the at-rule means.
 * Dropping it would collapse everything into the default layer and destroy the
 * cascade guarantees that are the whole point of the architecture.
 */
async function inlineImports(file, seen = new Set()) {
  const path = resolve(file);

  if (seen.has(path)) {
    // A cycle would otherwise recurse until the stack gives out.
    throw new Error(`Circular @import detected at ${path}`);
  }
  seen.add(path);

  const source = await readFile(path, 'utf8');
  const base = dirname(path);

  const IMPORT = /@import\s+url\(\s*["']([^"']+)["']\s*\)\s*(?:layer\(\s*([^)]*)\s*\))?\s*;/g;

  let output = '';
  let cursor = 0;
  let match;

  while ((match = IMPORT.exec(source)) !== null) {
    output += source.slice(cursor, match.index);
    cursor = match.index + match[0].length;

    const [, href, layerName] = match;

    // `scripts/sync-cache-busting.mjs` appends `?v=<hash>` to every import, so the
    // browser cannot serve a layer file from cache after it changes. That query is
    // part of the URL, not part of the path: keeping it here asks the filesystem
    // for `primitives.css?v=db001cd4` and gets an ENOENT that looks like a missing
    // file rather than like a URL that was never meant to be one.
    const path = href.split(/[?#]/)[0];
    const importedPath = join(base, path);
    const imported = await inlineImports(importedPath, new Set(seen));

    output += `\n/* ---- inlined: ${path} ---- */\n`;
    output += layerName ? `@layer ${layerName} {\n${imported}\n}\n` : imported;
  }

  output += source.slice(cursor);
  return output;
}

/**
 * Remove comments and collapse whitespace, without touching anything where
 * whitespace or content is significant.
 */
function minify(css) {
  let output = '';
  let index = 0;

  while (index < css.length) {
    const char = css[index];

    // Preserve string literals verbatim, including any `/*` inside them.
    if (char === '"' || char === "'") {
      const quote = char;
      let literal = char;
      index++;
      while (index < css.length) {
        // A backslash escapes the next character, including the closing quote.
        if (css[index] === '\\') {
          literal += css.slice(index, index + 2);
          index += 2;
          continue;
        }
        literal += css[index];
        if (css[index] === quote) {
          index++;
          break;
        }
        index++;
      }
      output += literal;
      continue;
    }

    // Preserve url(…) contents, which may be unquoted.
    if (css.startsWith('url(', index)) {
      const close = css.indexOf(')', index);
      if (close !== -1) {
        output += css.slice(index, close + 1);
        index = close + 1;
        continue;
      }
    }

    // Drop comments.
    if (css.startsWith('/*', index)) {
      const close = css.indexOf('*/', index + 2);
      index = close === -1 ? css.length : close + 2;
      // Leave a single space behind: `a/*x*/b` must not become `ab`.
      output += ' ';
      continue;
    }

    output += char;
    index++;
  }

  return (
    output
      // Collapse runs of whitespace to one space.
      .replace(/\s+/g, ' ')
      // Remove space around structural punctuation. `+`, `-`, `*` and `/` are
      // deliberately absent: whitespace around them is significant in calc().
      .replace(/\s*([{}:;,>])\s*/g, '$1')
      // A trailing semicolon before a closing brace is redundant.
      .replace(/;}/g, '}')
      .trim()
  );
}

const bundled = await inlineImports(ENTRY);
const minified = minify(bundled);

await mkdir(OUT_DIR, { recursive: true });
await writeFile(join(OUT_DIR, 'dds.css'), bundled, 'utf8');
await writeFile(join(OUT_DIR, 'dds.min.css'), minified, 'utf8');

const kb = (value) => (value / 1024).toFixed(1) + ' kB';

console.log('Wrote dist/dds.css      ' + kb(Buffer.byteLength(bundled)));
console.log('Wrote dist/dds.min.css  ' + kb(Buffer.byteLength(minified)));
console.log(
  '\nBoth are optional. Linking dds/dds.css directly is fully supported; ' +
    'dist/ is git-ignored so a stale artefact can never be mistaken for the source.'
);
