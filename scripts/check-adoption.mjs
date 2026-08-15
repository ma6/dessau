#!/usr/bin/env node
/**
 * Dessau — the instructions for adopting it still point at things that exist.
 *
 *   node scripts/check-adoption.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this gate exists
 * -----------------------------------------------------------------------------
 *
 * `README.md` describes seven steps to start a project and
 * `agent/recipes/new-product.md` describes the same thing for an agent. Both had
 * been written and neither had been executed by anybody who did not already know
 * the answers (#5).
 *
 * Walking them found what a walk finds: a step that was missing rather than
 * wrong, and a table row that had quietly stopped being true —
 * `js/patterns/auth.js` was still documented as the password reveal a year after
 * the reveal moved to `components-forms.js`. A reader following that table loads
 * a file they do not need, gets the reveal anyway from a file the table did not
 * send them to, and learns something false about how the system is arranged.
 *
 * A walk cannot be repeated on every commit and a person cannot be asked to. So
 * the half of it that is mechanical is a check:
 *
 *   1. every repository path the documentation names exists;
 *   2. the README's script table and `dds/js/` agree — in both directions.
 *
 * The second one is the interesting half. A script listed and absent is a broken
 * instruction; a script present and unlisted is a capability nobody knows they
 * have, which is the same defect wearing the other hat. `sync-checks.mjs` makes
 * exactly this argument about the verification table.
 *
 * What this cannot check is whether the steps WORK, or whether their order makes
 * sense to somebody meeting them for the first time. That still needs a person
 * or an agent with no context, and #5 records where that stands.
 *
 * Zero dependencies, Node stdlib only. Exit code 1 on any finding.
 * @catches A path named in the README or in `agent/` that does not exist, and a
 *   script in `dds/js/` that the README's behaviour table has stopped agreeing
 *   with in either direction.
 *
 */

import { readFile, readdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const findings = [];
const report = (message) => findings.push(message);

const exists = async (path) => {
  try {
    await access(join(ROOT, path));
    return true;
  } catch {
    return false;
  }
};

/* ------------------------------------------------------------------- inputs */

/** Every `.md` under `agent/`, plus the three at the root that instruct. */
async function docs() {
  const found = ['README.md', 'AGENTS.md', 'CLAUDE.md'];

  async function walk(directory) {
    for (const entry of await readdir(join(ROOT, directory), { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) await walk(path);
      else if (entry.name.endsWith('.md')) found.push(path);
    }
  }

  await walk('agent');
  return found;
}

/**
 * Paths that are named on purpose and are not expected to exist here.
 *
 * Each is a thing the reader creates, or a thing deliberately kept out of the
 * repository. Listed rather than pattern-matched, so adding one is a decision
 * somebody makes rather than a rule that quietly widens.
 */
const NOT_OURS = new Map([
  ['assets/product.css', "the product's own stylesheet, created by the reader"],
  ['dist/dds.css', 'built artefact; dist/ is git-ignored (DECISIONS 023, 030)'],
  ['dist/dds.min.css', 'built artefact; dist/ is git-ignored'],
  ['agent/consumer-AGENTS.template.md', 'exists — kept here so the name is checked below'],
  [
    'SCREAMING_SNAKE.md',
    'agent/conventions.md names the file-naming convention, not a file',
  ],
]);

/* ------------------------- 1. every path the documentation names exists */

/**
 * Repository paths, as they are written in prose: in backticks, optionally
 * behind the `libs/dessau/` prefix a consuming product uses.
 *
 * Anchored to the directories Dessau actually has. A looser pattern matches
 * every filename in every code sample — `icons.svg`, `product.css`, a made-up
 * `orders/new.html` — and a check that reports those is a check that gets
 * switched off.
 */
const PATH_IN_PROSE =
  /`(?:\/?libs\/dessau\/)?((?:dds|agent|scripts|docs|reference|tests)\/[\w./-]+\.\w+)`/g;

/**
 * Root documents, which use SCREAMING_SNAKE by convention — `DECISIONS.md`,
 * `LESSONS_LEARNED.md`, `README.md`.
 *
 * A second pattern rather than a wider first one, because "any word ending in
 * `.md`" matches a product's own files in every example that mentions one.
 *
 * This half exists because it was needed within an hour of the first half being
 * written. `ISSUES-TO-CREATE.md` is git-ignored on purpose — its own header says
 * to delete it once the issues exist — and it was deleted, correctly, leaving a
 * recipe pointing at a file that had never been in the repository and was now
 * not on disk either. A committed document may not depend on an uncommitted one:
 * it reads as a broken link to everybody except the person whose working copy
 * still has it.
 */
const ROOT_DOC_IN_PROSE = /`([A-Z][A-Z0-9_-]*\.md)`/g;

for (const doc of await docs()) {
  const source = await readFile(join(ROOT, doc), 'utf8');

  for (const [, path] of source.matchAll(PATH_IN_PROSE)) {
    if (NOT_OURS.has(path)) continue;
    /* A glob or an ellipsis is describing a shape, not naming a file. */
    if (/[*<>…]/.test(path)) continue;
    if (await exists(path)) continue;

    report(`${doc}: names \`${path}\`, which does not exist`);
  }

  for (const [, name] of source.matchAll(ROOT_DOC_IN_PROSE)) {
    if (NOT_OURS.has(name)) continue;
    if (await exists(name)) continue;
    report(
      `${doc}: names \`${name}\`, which does not exist. A committed document ` +
        `cannot point at one that is git-ignored or deleted — it reads as a ` +
        `broken link to everybody whose working copy does not happen to have it.`
    );
  }
}

/* ------------- 2. the README's behaviour table and dds/js agree, both ways */

const readme = await readFile(join(ROOT, 'README.md'), 'utf8');

/** Table rows of the shape: | `js/patterns/wizard.js` | what it gives you | */
const listed = new Set(
  [...readme.matchAll(/^\|\s*`(js\/[\w./-]+\.js)`\s*\|/gm)].map((m) => `dds/${m[1]}`)
);

if (listed.size === 0) {
  report(
    "README.md: the behaviour table has no rows this check can read. It looks for " +
      '`| `js/…` |` — if the table moved or changed shape, this check is now blind ' +
      'and needs updating rather than deleting.'
  );
}

/**
 * Scripts a product never loads from the table, with the reason.
 *
 * `theme-init.js` is documented two steps earlier and separately, because it is
 * the one script that must be blocking and in the `<head>` — listing it beside
 * the deferred ones is how somebody defers it and gets a white flash on every
 * navigation.
 */
const NOT_IN_TABLE = new Map([
  ['dds/js/theme-init.js', 'documented in step 2: blocking, in the head, never deferred'],
  [
    'dds/js/providers/mock-address-provider.js',
    'demo data for the reference; a product brings its own provider',
  ],
]);

async function scriptsInDdsJs(directory = 'dds/js') {
  const found = [];
  for (const entry of await readdir(join(ROOT, directory), { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) found.push(...(await scriptsInDdsJs(path)));
    else if (entry.name.endsWith('.js')) found.push(path);
  }
  return found.sort();
}

const shipped = await scriptsInDdsJs();

for (const path of shipped) {
  if (listed.has(path) || NOT_IN_TABLE.has(path)) continue;
  report(
    `README.md: \`dds/js/\` ships ${path}, which the behaviour table does not ` +
      `list — a capability nobody is told they have. Add a row, or add it to ` +
      `NOT_IN_TABLE in this script with the reason a product never loads it.`
  );
}

for (const path of listed) {
  if (shipped.includes(path)) continue;
  report(`README.md: the behaviour table lists ${path}, which does not exist`);
}

for (const [path, reason] of NOT_IN_TABLE) {
  if (!shipped.includes(path)) {
    report(`NOT_IN_TABLE names ${path}, which is no longer in dds/js. Remove the line.`);
  } else if (listed.has(path)) {
    report(
      `NOT_IN_TABLE says ${path} is deliberately unlisted (${reason}), but the ` +
        `README lists it. One of the two changed its mind.`
    );
  }
}

/* ------------------------------------------------------------------ report */

if (findings.length) {
  console.log('');
  for (const finding of findings) console.log(`  ${finding}`);
}

console.log(
  `\n${(await docs()).length} instruction documents checked, ` +
    `${shipped.length} scripts in dds/js, ${listed.size} listed for consumers. ` +
    (findings.length === 0
      ? 'The instructions point at things that exist.'
      : `${findings.length} FINDING(S).`)
);

process.exit(findings.length === 0 ? 0 : 1);
