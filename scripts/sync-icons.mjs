#!/usr/bin/env node
/**
 * Dessau — inline the icon sprite into every HTML page.
 *
 *   node scripts/sync-icons.mjs
 *   node scripts/sync-icons.mjs --check   # verify only, exit 1 if stale
 *
 * -----------------------------------------------------------------------------
 * Why the sprite has to be inlined at all
 * -----------------------------------------------------------------------------
 *
 * `<use href="icons.svg#dds-icon-check">` pointing at an external file does not
 * work reliably. The referenced content is cloned into a shadow tree whose style
 * computation does not see the referencing document's CSS, so `currentColor`
 * falls back to a default — effectively black — regardless of theme, hover state
 * or button variant.
 *
 * It fails the same way in every current engine, and it fails *silently*: the
 * icon renders, just in the wrong colour. That makes it exactly the kind of bug
 * that reaches production.
 *
 * -----------------------------------------------------------------------------
 * Why a script rather than a documented manual step
 * -----------------------------------------------------------------------------
 *
 * Inlining means the sprite exists in N places. "Remember to update all of them"
 * is not a strategy — it is a promise that they will diverge. One source file
 * plus a script that rewrites the copies keeps the duplication without the drift.
 *
 * `--check` makes it verifiable rather than merely automated, so a stale copy is
 * a failure rather than a surprise.
 *
 * Zero dependencies, Node stdlib only.
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SPRITE_PATH = join(ROOT, 'dds/icons/icons.svg');
const CHECK_ONLY = process.argv.includes('--check');

const START_MARKER = '<!-- DDS_ICON_SPRITE:START';
const END_MARKER = '<!-- DDS_ICON_SPRITE:END -->';

/** Recursively find HTML files, skipping anything ignored or generated. */
async function findHtmlFiles(directory) {
  const skip = new Set(['node_modules', '.git', 'src', 'dist']);
  const found = [];

  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || skip.has(entry.name)) continue;
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
      } else if (entry.name.endsWith('.html')) {
        found.push(path);
      }
    }
  }

  await walk(directory);
  return found.sort();
}

/**
 * Extract just the <svg>…</svg> element from the sprite file, dropping the XML
 * declaration and the file's own explanatory comment — neither belongs in the
 * middle of an HTML body.
 */
function spriteMarkup(source) {
  // Match the ROOT element specifically, by its `xmlns` attribute. A plain
  // indexOf('<svg') matches the `<svg class="dds-icon">` example inside the
  // file's own explanatory comment, which produced a sprite that began
  // mid-sentence and rendered no icons at all.
  const start = source.search(/<svg\s+xmlns=/);
  const end = source.lastIndexOf('</svg>');
  if (start === -1 || end === -1) {
    throw new Error('Could not find the root <svg xmlns=…> element in dds/icons/icons.svg');
  }
  return source.slice(start, end + '</svg>'.length);
}

const spriteSource = await readFile(SPRITE_PATH, 'utf8');
const sprite = spriteMarkup(spriteSource);

// Every symbol id in the sprite, so pages can be checked for references to
// icons that do not exist.
const availableIds = new Set(
  [...spriteSource.matchAll(/<symbol\s+id="([^"]+)"/g)].map((match) => match[1])
);

const htmlFiles = await findHtmlFiles(ROOT);

let updated = 0;
let stale = 0;
let missingMarkers = 0;
let brokenReferences = 0;

for (const file of htmlFiles) {
  const source = await readFile(file, 'utf8');
  const shortPath = relative(ROOT, file);

  const startIndex = source.indexOf(START_MARKER);
  const endIndex = source.indexOf(END_MARKER);

  if (startIndex === -1 || endIndex === -1) {
    // A page with no markers is a page that does not want a sprite. Report it
    // rather than guessing where to put one.
    console.warn(`  no sprite markers: ${shortPath}`);
    missingMarkers++;
    continue;
  }

  // Verify every icon the page references actually exists. A typo in a `<use>`
  // renders nothing at all, with no error anywhere.
  for (const match of source.matchAll(/<use\s+href="#(dds-icon-[^"]+)"/g)) {
    if (!availableIds.has(match[1])) {
      console.error(`  ERROR ${shortPath}: references unknown icon #${match[1]}`);
      brokenReferences++;
    }
  }

  const startLineEnd = source.indexOf('-->', startIndex) + '-->'.length;
  const before = source.slice(0, startLineEnd);
  const after = source.slice(endIndex);
  const next = `${before}\n${sprite}\n${after}`;

  if (next === source) continue;

  if (CHECK_ONLY) {
    console.error(`  STALE ${shortPath}`);
    stale++;
  } else {
    await writeFile(file, next, 'utf8');
    console.log(`  updated ${shortPath}`);
    updated++;
  }
}

const problems = stale + brokenReferences;

console.log(
  `\n${htmlFiles.length} HTML files scanned, ${availableIds.size} icons available.` +
    (CHECK_ONLY
      ? stale === 0
        ? ' All inline sprites are current.'
        : ` ${stale} STALE.`
      : ` ${updated} updated.`) +
    (missingMarkers ? ` ${missingMarkers} without markers.` : '') +
    (brokenReferences ? ` ${brokenReferences} BROKEN icon references.` : '')
);

process.exit(problems === 0 ? 0 : 1);
