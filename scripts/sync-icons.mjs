#!/usr/bin/env node
/**
 * Dessau — inline the icon sprite into every HTML page.
 *
 *   node scripts/sync-icons.mjs
 *   node scripts/sync-icons.mjs --check          # verify only, exit 1 if stale
 *   node scripts/sync-icons.mjs --dir=../my-app  # a consuming product's pages
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
 * @catches A stale inline icon sprite, or a page referring to an icon the sprite
 *   does not have.
 *
 */

import { readFile, writeFile, readdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SPRITE_PATH = join(ROOT, 'dds/icons/icons.svg');
const CHECK_ONLY = process.argv.includes('--check');

/**
 * Where to look for HTML files.
 *
 * Defaults to this repository. `--dir=<path>` points it at a consuming product
 * instead, which is the whole reason the sprite step is scriptable rather than a
 * documented copy-and-paste: a product has the same duplication problem Dessau
 * does, and the same need for a `--check` that fails on a stale copy.
 *
 * Relative paths resolve against the current working directory, so
 * `--dir=../my-app` reads the way it looks.
 */
const dirArgument = process.argv.find((argument) => argument.startsWith('--dir='));
const TARGET = dirArgument
  ? resolve(process.cwd(), dirArgument.slice('--dir='.length))
  : ROOT;

const START_MARKER = '<!-- DDS_ICON_SPRITE:START';
const END_MARKER = '<!-- DDS_ICON_SPRITE:END -->';

/** Vendored Dessau checkouts that were walked past, for the run's report. */
const vendored = [];

/**
 * Is this directory a Dessau checkout in its own right?
 *
 * Detected by what a checkout always has rather than by where a product happened
 * to put it: `libs/dessau`, `vendor/dessau` and `third_party/dds` are all real
 * conventions and none of them is guaranteed.
 */
async function isDessauCheckout(directory) {
  try {
    await access(join(directory, 'dds', 'dds.css'));
    await access(join(directory, 'agent', 'index.json'));
    return true;
  } catch {
    return false;
  }
}

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
        /**
         * Never walk into a vendored copy of Dessau.
         *
         * Running this from a product with `--dir=.` used to descend into
         * `libs/dessau` and rewrite Dessau's own reference pages with the
         * product's icon set — a build step writing into its own pinned
         * dependency, which is the one thing a pinned dependency exists to
         * prevent. It only stayed invisible because the sprites happened to
         * match.
         *
         * Checked per directory rather than by name: `libs/dessau`,
         * `vendor/dessau` and `third_party/dds` are all real conventions.
         */
        if (path !== directory && (await isDessauCheckout(path))) {
          vendored.push(relative(directory, path) || path);
          continue;
        }
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

/**
 * The attribution line that goes into every page with the sprite.
 *
 * MIT requires its notice to accompany copies; it does not say where, and a
 * licence file shipped alongside is the normal way to satisfy that. `dds/icons/
 * LICENSE-ionicons.txt` is that file — but the sprite is *inlined*, so a deployed
 * product needs no `dds/icons/` at runtime and may not ship it at all. Then the
 * notice is not elsewhere, it is gone.
 *
 * So one line travels with the artwork: the copyright notice itself, which is
 * short and is the part MIT names first, and a link to the permission notice.
 * The full text would be ~1.6 kB on every page for nothing a reader will read.
 */
const ATTRIBUTION =
  '<!-- Icons: Ionicons — Copyright (c) 2015-present Ionic (http://ionic.io/) — ' +
  'MIT: https://github.com/ionic-team/ionicons/blob/main/LICENSE -->';

const spriteSource = await readFile(SPRITE_PATH, 'utf8');
const sprite = `${ATTRIBUTION}\n${spriteMarkup(spriteSource)}`;

// Every symbol id in the sprite, so pages can be checked for references to
// icons that do not exist.
const availableIds = new Set(
  [...spriteSource.matchAll(/<symbol\s+id="([^"]+)"/g)].map((match) => match[1])
);

const htmlFiles = await findHtmlFiles(TARGET);

let updated = 0;
let stale = 0;
let missingMarkers = 0;
let brokenReferences = 0;
let malformed = 0;

for (const file of htmlFiles) {
  const source = await readFile(file, 'utf8');
  const shortPath = relative(TARGET, file);

  const startIndex = source.indexOf(START_MARKER);
  const endIndex = source.indexOf(END_MARKER);

  if (startIndex === -1 || endIndex === -1) {
    // A page with no markers is a page that does not want a sprite. Report it
    // rather than guessing where to put one.
    console.warn(`  no sprite markers: ${shortPath}`);
    missingMarkers++;
    continue;
  }

  /* A malformed block, which this script used to carry forever rather than
     report. `indexOf` finds the FIRST end marker and everything from it is kept
     verbatim — so a second end marker is copied through on every run, the output
     equals the input, and `--check` calls the page current. Two pages carried a
     duplicated end marker for exactly that reason.

     An ambiguous block is worse than a stale one: stale is a known state with a
     fix, ambiguous means any future change to how the block is located has to
     guess which marker was meant. */
  const starts = source.split(START_MARKER).length - 1;
  const ends = source.split(END_MARKER).length - 1;

  if (starts > 1 || ends > 1 || endIndex < startIndex) {
    console.error(
      `  ERROR ${shortPath}: malformed sprite block — ` +
        `${starts} start marker(s), ${ends} end marker(s)` +
        (endIndex < startIndex ? ', end before start' : '') +
        '. Fix the markers by hand; this script will not guess which one was meant.'
    );
    malformed++;
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

const problems = stale + brokenReferences + malformed;

/* Said out loud, because "it skipped some files" is exactly the kind of quiet
   helpfulness that becomes a mystery later. */
if (vendored.length) {
  console.log(
    `\n  Left alone (a Dessau checkout of its own, not this product's pages):`
  );
  for (const path of vendored) console.log(`    ${path}`);
}

console.log(
  `\n${htmlFiles.length} HTML files scanned in ${relative(process.cwd(), TARGET) || '.'}, ` +
    `${availableIds.size} icons available.` +
    (CHECK_ONLY
      ? stale === 0
        ? ' All inline sprites are current.'
        : ` ${stale} STALE.`
      : ` ${updated} updated.`) +
    (missingMarkers ? ` ${missingMarkers} without markers.` : '') +
    (brokenReferences ? ` ${brokenReferences} BROKEN icon references.` : '') +
    (malformed ? ` ${malformed} MALFORMED sprite block(s).` : '')
);

process.exit(problems === 0 ? 0 : 1);
