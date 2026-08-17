#!/usr/bin/env node
/**
 * Dessau — every registered enhancement has been seen to work in a browser.
 *
 *   node scripts/check-enhancement-coverage.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this gate exists
 * -----------------------------------------------------------------------------
 *
 * The enhancement bug — the document-wide sweep running before any pattern had
 * called `register` — was invisible for as long as it existed, and it was
 * invisible for a good reason. Progressive enhancement means the markup works on
 * its own: a page with no behaviour at all still renders, still submits, still
 * navigates. It just does none of the things it documents.
 *
 * `tests/enhancement.spec.mjs` now catches that specific case. Nothing
 * guarantees the next pattern is covered, and "we should add a test" is not a
 * mechanism.
 *
 * The reasoning is the same as `check-reference.mjs`: a component that has never
 * been *seen* to work is documented rather than delivered. This gate makes the
 * difference countable.
 *
 * -----------------------------------------------------------------------------
 * Why an annotation rather than a guess
 * -----------------------------------------------------------------------------
 *
 * Coverage is declared, in a `@covers` line in each spec's header comment:
 *
 *     @covers combobox, address-search
 *     @covers none — this is about CSS scoping, not about an enhancement
 *
 * The alternative was inferring it from file names, and a file name lies about
 * this constantly: `password.spec.mjs` exercises one enhancement,
 * `enhancement.spec.mjs` exercises two and is named after neither, and
 * `language.spec.mjs` is named after a rule that cuts across several. A guess
 * here would report coverage that does not exist, which is worse than reporting
 * none.
 *
 * `none` is a legitimate answer and has to be written down for the same reason
 * every other exemption in this repository is: an unstated one is
 * indistinguishable from an oversight.
 *
 * -----------------------------------------------------------------------------
 * Why the backlog is a list in this file
 * -----------------------------------------------------------------------------
 *
 * Fifteen of the twenty-two registered enhancements had no browser test on the
 * day this was written. A gate that goes red on its first run and stays red is
 * not a gate — it is noise that everyone learns to scroll past, and it takes the
 * other seven checks' credibility with it.
 *
 * So the existing gap is stated explicitly in `KNOWN_GAPS`, and the check fails
 * on MOVEMENT rather than on the balance:
 *
 *   - a newly registered enhancement that nothing covers and nobody listed;
 *   - an entry in `KNOWN_GAPS` that is now covered — the note is stale and the
 *     backlog just got shorter, which is worth noticing;
 *   - an entry in `KNOWN_GAPS` for something that no longer registers at all;
 *   - a `@covers` naming an enhancement that does not exist.
 *
 * The list is meant to shrink. Every line in it is a thing that ships without
 * ever having been watched working.
 *
 * Zero dependencies, Node stdlib only. Exit code 1 on any finding.
 * @catches A registered enhancement with no browser test, a spec that never says
 *   what it covers, a coverage note that has gone stale in either direction, and
 *   a `@covers` naming an enhancement nothing registers.
 *
 */

import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const JS_DIR = join(ROOT, 'dds/js');
const TESTS_DIR = join(ROOT, 'tests');

const findings = [];
const report = (message) => findings.push(message);

/**
 * Enhancements shipping without a browser test, each with the reason it is still
 * on the list. Ordered as `dds/js` loads them, so the list reads like the system.
 *
 * Tracked as issues; see #2. Delete a line the moment a spec claims it — the
 * check below insists on exactly that.
 */
const KNOWN_GAPS = new Map([
  ['dialog-open', 'the opener half of the same pair'],
  ['tabs', 'roving tabindex and the arrow-key contract'],
  ['lightbox', 'opens, traps, restores focus to the thumbnail'],
  ['embed', 'the consent gate: nothing is requested before the click'],
  ['format', 'input masking without destroying the caret'],
  ['charcount', 'the live count and its threshold'],
  ['stepper', 'increment, decrement, clamping, and the announcement'],
  ['conditional-fields', 'fields appearing and disappearing, and what that does to validity'],
  ['derived-output', 'the computed value appearing, and being announced once'],
  ['password-confirm', 'the match/mismatch state, separate from the reveal toggle'],
]);

/* ------------------------------------------------------------------ helpers */

/** Blank out comments, keeping line numbers intact. */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, before) =>
      before + ' '.repeat(m.length - before.length)
    );
}

/** Every `.js` file under a directory, recursively. */
async function jsFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const found = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await jsFiles(path)));
    else if (entry.name.endsWith('.js')) found.push(path);
  }

  return found.sort();
}

/**
 * Read a block tag out of a header comment, continuation lines included.
 *
 * Same shape as `blockTag` in `sync-checks.mjs`, and for the same reason: a
 * description runs until the comment says it is over, not until the end of the
 * line it started on.
 */
function blockTag(source, tag) {
  const lines = source.split('\n');
  const opens = new RegExp(`^\\s*\\*\\s*@${tag}\\b\\s*`);

  const start = lines.findIndex((line) => opens.test(line));
  if (start === -1) return null;

  const parts = [lines[start].replace(opens, '')];

  for (const line of lines.slice(start + 1)) {
    if (/^\s*\*\//.test(line)) break;
    if (!/^\s*\*/.test(line)) break;

    const text = line.replace(/^\s*\*\s?/, '').trim();
    if (!text || /^@\w+/.test(text)) break;

    parts.push(text);
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim() || null;
}

/* -------------------------------------------------- 1. what is registered */

const registered = new Map();

for (const file of await jsFiles(JS_DIR)) {
  const source = stripComments(await readFile(file, 'utf8'));
  const where = relative(ROOT, file);

  for (const [, name] of source.matchAll(/\bregister\(\s*['"]([^'"]+)['"]/g)) {
    if (registered.has(name)) {
      report(
        `${where}: registers "${name}", which ${registered.get(name)} already ` +
          `registers — the second one silently wins the name`
      );
      continue;
    }
    registered.set(name, where);
  }
}

if (registered.size === 0) {
  report(
    `no \`register(\` call found anywhere in dds/js — either the registry moved ` +
      `or this check is reading the wrong thing`
  );
}

/* ------------------------------------------------------ 2. what is covered */

const covered = new Map();
const specs = (await readdir(TESTS_DIR)).filter((name) => name.endsWith('.spec.mjs')).sort();

for (const name of specs) {
  const where = `tests/${name}`;
  const source = await readFile(join(TESTS_DIR, name), 'utf8');
  const declared = blockTag(source, 'covers');

  if (!declared) {
    report(
      `${where} has no \`@covers\` line in its header comment. Add one naming the ` +
        `enhancements it exercises, or \`@covers none — <why>\` if it exercises none.`
    );
    continue;
  }

  // `none — reason`: the reason is required, the rest of the line is prose.
  if (/^none\b/i.test(declared)) {
    if (!/^none\s*[—-]\s*\S/.test(declared)) {
      report(`${where}: \`@covers none\` with no reason after it — say why.`);
    }
    continue;
  }

  /**
   * Names first, then an em dash, then prose for a reader.
   *
   *     @covers nav-toggle — through the reference's own header, not the component
   *
   * Splitting the whole line on commas would break the moment the note contains
   * one, which the first note written did. The dash is the boundary because it
   * is already how every other explanation in this repository is attached.
   */
  const [names] = declared.split(/\s+—\s+/);

  for (const entry of names.split(',').map((part) => part.trim()).filter(Boolean)) {
    // A stray trailing word is still a mistake worth naming precisely.
    const enhancement = entry.split(/\s/)[0];

    if (!registered.has(enhancement)) {
      report(
        `${where}: \`@covers ${enhancement}\`, but nothing in dds/js registers ` +
          `that name — the spec was renamed out from under the note, or the ` +
          `enhancement was`
      );
      continue;
    }

    if (!covered.has(enhancement)) covered.set(enhancement, []);
    covered.get(enhancement).push(where);
  }
}

/* ------------------------------------------------------------ 3. the gap */

const uncovered = [...registered.keys()].filter((name) => !covered.has(name)).sort();

for (const name of uncovered) {
  if (KNOWN_GAPS.has(name)) continue;
  report(
    `"${name}" (${registered.get(name)}) is registered and no spec covers it.\n` +
      `      Write one, or add it to KNOWN_GAPS in this file with the reason it ` +
      `ships untested.`
  );
}

/**
 * A gap that has quietly closed. Not a defect in the code — it is the opposite —
 * but the note has stopped being true, and a backlog nobody prunes is a backlog
 * nobody reads.
 */
for (const [name, reason] of KNOWN_GAPS) {
  if (!registered.has(name)) {
    report(
      `KNOWN_GAPS lists "${name}", which nothing registers any more. ` +
        `Remove the line.`
    );
    continue;
  }

  if (covered.has(name)) {
    report(
      `KNOWN_GAPS lists "${name}" as untested — ${covered.get(name).join(', ')} ` +
        `now covers it. Remove the line; the backlog just got shorter.\n` +
        `      (was: ${reason})`
    );
  }
}

/* ------------------------------------------------------------------ report */

if (findings.length) {
  console.log('');
  for (const finding of findings) console.log(`  ${finding}`);
}

/* Printed on every run, pass or fail. The list is the whole point: an
   enhancement nobody has watched working is not finished, and the number should
   be visible often enough to stay uncomfortable. */
if (uncovered.length) {
  console.log(`\n  Registered, never seen working in a browser (${uncovered.length}):`);
  for (const name of uncovered) {
    console.log(`    ${name.padEnd(20)} ${KNOWN_GAPS.get(name) ?? ''}`);
  }
}

console.log(
  `\n${registered.size} enhancements, ${covered.size} covered by ${specs.length} specs. ` +
    (findings.length === 0
      ? 'No new gaps.'
      : `${findings.length} FINDING(S).`)
);

process.exit(findings.length === 0 ? 0 : 1);
