#!/usr/bin/env node
/**
 * Dessau — stamp every stylesheet and script reference with a content version.
 *
 *   node scripts/sync-cache-busting.mjs
 *   node scripts/sync-cache-busting.mjs --check   # verify only, exit 1 if stale
 *
 * -----------------------------------------------------------------------------
 * Why this exists
 * -----------------------------------------------------------------------------
 *
 * A stale stylesheet or script does not announce itself. The page loads, nothing
 * errors, and a component simply behaves the way it did last week — which reads as
 * a defect in the code that was just written, not as a browser serving a copy from
 * disk. The first hour of that goes into the part that was already correct.
 *
 * Every reference therefore carries `?v=<hash>` derived from the content of the
 * file it points at. Change the file, the URL changes, the browser has no cached
 * entry for it. Change nothing, and the URL is byte-identical, so the cache is
 * still doing its job.
 *
 * -----------------------------------------------------------------------------
 * Why the hash is the content, not the clock
 * -----------------------------------------------------------------------------
 *
 * A timestamp regenerated per run is simpler to compute and is the usual shortcut.
 * It cannot work here: `npm run check:generated` verifies that every generated
 * artefact matches what the current sources produce, and a value that differs on
 * every run is stale one millisecond after it is written. Content hashing is what
 * makes `--check` mean something.
 *
 * It also keeps the blast radius honest. Editing one pattern script re-versions
 * that one file; the other seventeen references keep the URLs the browser already
 * has, so a reader who came back for one fix does not re-download the stylesheet.
 *
 * -----------------------------------------------------------------------------
 * Why `dds.css` gets its imports stamped too
 * -----------------------------------------------------------------------------
 *
 * `dds/dds.css` is an entry point: eleven `@import url("./css/…")` rules behind
 * one `<link>`. Versioning only the link is the trap — the browser refetches
 * `dds.css`, reads the same import URLs it read last time, and serves all eleven
 * layer files from cache. The link looks busted and almost none of the CSS is.
 *
 * So the imports are stamped first, bottom-up, and `dds.css` is hashed *after*
 * that rewrite. A change in `primitives.css` therefore changes the import line,
 * which changes the entry file, which changes the `<link>` — the whole chain moves
 * or none of it does.
 *
 * -----------------------------------------------------------------------------
 * Why a query string rather than a hashed filename
 * -----------------------------------------------------------------------------
 *
 * `dds/css/primitives.css` is a path a consumer links, a path the documentation
 * names, and a path an agent is told to read. Renaming it per build would make all
 * three wrong, and would require a rewrite layer in front of a repository whose
 * entire premise is that it is servable as static files with no build step.
 *
 * The old objection to query strings — that some intermediary proxies refused to
 * cache a URL containing `?` — was about forward proxies that have not been
 * relevant for well over a decade. Browser caches key on the full URL, query
 * included, and always have.
 *
 * -----------------------------------------------------------------------------
 * What this does not fix
 * -----------------------------------------------------------------------------
 *
 * The version lives *in the HTML*, so it only helps once the HTML is refetched. If
 * a host serves these pages with a long `Cache-Control` max-age, a visitor keeps
 * the old page and, with it, the old references. HTML must stay short-lived;
 * assets are what this makes safe to cache hard.
 *
 * Fonts, images and `icons.svg` are deliberately untouched. They are referenced
 * from inside stylesheets and from `<use href>`, they change on the order of never,
 * and stamping them would mean parsing `url()` for a problem nobody has had.
 *
 * @catches A stylesheet or script served from a stale browser cache, which
 *   presents as a component defect rather than as a caching problem.
 *
 * Zero dependencies, Node stdlib only.
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative, extname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK_ONLY = process.argv.includes('--check');

/** Everything this repository serves as a page. */
const HTML_PAGES = [
  join(ROOT, 'index.html'),
  ...(await readdir(join(ROOT, 'reference')))
    .filter((name) => name.endsWith('.html'))
    .sort()
    .map((name) => join(ROOT, 'reference', name)),
];

/** Path → 8 hex characters of sha256 over the file's final content. */
const versions = new Map();

/** Path → content that differs from what is on disk. Written once, at the end. */
const pending = new Map();

const problems = [];

const shortHash = (content) => createHash('sha256').update(content).digest('hex').slice(0, 8);

const show = (path) => relative(ROOT, path);

/**
 * Split a reference into the parts that survive stamping.
 *
 * An existing `?v=` is dropped rather than appended to, which is what makes a
 * second run a no-op instead of a URL with a history of every previous run in it.
 * A fragment is kept: nothing here uses one today, but silently discarding part of
 * a URL is not a thing a formatter should do.
 */
function split(reference) {
  const hash = reference.indexOf('#');
  const fragment = hash === -1 ? '' : reference.slice(hash);
  const withoutFragment = hash === -1 ? reference : reference.slice(0, hash);
  const query = withoutFragment.indexOf('?');
  return {
    path: query === -1 ? withoutFragment : withoutFragment.slice(0, query),
    fragment,
  };
}

/** A reference this repository owns, as opposed to one it merely points at. */
function isLocal(reference) {
  return !/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(reference);
}

/**
 * Resolve a reference the way the browser would: root-relative against the
 * repository root, everything else against the file doing the referencing.
 */
function resolveFrom(file, path) {
  return path.startsWith('/') ? join(ROOT, path.slice(1)) : resolve(dirname(file), path);
}

/**
 * The version of one asset, stamping its own `@import`s first if it has any.
 *
 * Depth-first and memoised, so the hash of an entry point always reflects the
 * files it pulls in. `seen` exists only to turn a circular import into a sentence
 * rather than a stack overflow.
 */
async function version(path, seen = new Set()) {
  if (versions.has(path)) return versions.get(path);

  if (seen.has(path)) {
    problems.push(`${show(path)}: circular @import, so no version can be derived`);
    return null;
  }

  let source;
  try {
    source = pending.get(path) ?? (await readFile(path, 'utf8'));
  } catch {
    return null;
  }

  const content = extname(path) === '.css' ? await stampImports(path, source, seen) : source;

  if (content !== source) pending.set(path, content);

  const hash = shortHash(content);
  versions.set(path, hash);
  return hash;
}

/**
 * Rewrite `@import url("…")` so each import carries the version of the file it
 * imports. Only the `url()` is touched — `layer(…)`, media conditions and
 * `supports()` are left exactly as written, because they are cascade semantics and
 * this script has no business having an opinion about them.
 */
async function stampImports(file, source, seen) {
  const IMPORT = /(@import\s+url\(\s*)(["']?)([^"')]+)\2(\s*\))/g;

  let output = '';
  let cursor = 0;

  for (const match of source.matchAll(IMPORT)) {
    const [whole, open, quote, reference, close] = match;
    output += source.slice(cursor, match.index);
    cursor = match.index + whole.length;

    const { path, fragment } = split(reference);

    if (!isLocal(reference) || extname(path) !== '.css') {
      output += whole;
      continue;
    }

    const target = resolveFrom(file, path);
    const hash = await version(target, new Set(seen).add(file));

    if (hash === null) {
      problems.push(`${show(file)}: imports ${path}, which does not exist`);
      output += whole;
      continue;
    }

    output += `${open}${quote}${path}?v=${hash}${fragment}${quote}${close}`;
  }

  return output + source.slice(cursor);
}

/**
 * Stamp the references in one page.
 *
 * Matching starts at a literal `<link` or `<script`, which is the whole reason the
 * escaped examples in the reference prose survive this. `&lt;link rel="stylesheet"
 * href="/dds/dds.css"&gt;` is documentation — it contains a real-looking `href="…"`
 * and a naive attribute regex rewrites it into a lie about what a consumer should
 * type. Requiring the opening bracket to be an actual tag delimiter is what keeps
 * prose out of scope.
 */
async function stampPage(file, source) {
  const TAG = /<(?:link|script)\b[^>]*>/gi;
  const ATTRIBUTE = /\b(href|src)="([^"]+)"/i;

  let output = '';
  let cursor = 0;
  let stamped = 0;

  for (const match of source.matchAll(TAG)) {
    const tag = match[0];
    output += source.slice(cursor, match.index);
    cursor = match.index + tag.length;

    const attribute = tag.match(ATTRIBUTE);

    if (!attribute) {
      output += tag;
      continue;
    }

    const [whole, name, reference] = attribute;
    const { path, fragment } = split(reference);

    if (!isLocal(reference) || !['.css', '.js'].includes(extname(path))) {
      output += tag;
      continue;
    }

    const target = resolveFrom(file, path);
    const hash = await version(target);

    if (hash === null) {
      problems.push(`${show(file)}: loads ${path}, which does not exist`);
      output += tag;
      continue;
    }

    output += tag.replace(whole, `${name}="${path}?v=${hash}${fragment}"`);
    stamped++;
  }

  return { content: output + source.slice(cursor), stamped };
}

/* -------------------------------------------------------------------- collect */

let references = 0;

for (const page of HTML_PAGES) {
  const source = await readFile(page, 'utf8');
  const { content, stamped } = await stampPage(page, source);

  references += stamped;
  if (content !== source) pending.set(page, content);
}

/* ---------------------------------------------------------------------- write */

const stale = [...pending.keys()].sort();

if (CHECK_ONLY) {
  if (problems.length) {
    console.error('\nCache busting cannot be verified:\n');
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }

  if (!stale.length) {
    console.log(
      `Asset versions are current — ${references} reference(s) across ${HTML_PAGES.length} pages.`
    );
    process.exit(0);
  }

  console.error(
    `\n${stale.length} file(s) carry a STALE asset version:\n\n` +
      stale.map((path) => `  ${show(path)}`).join('\n') +
      `\n\nRun: node scripts/sync-cache-busting.mjs\n`
  );
  process.exit(1);
}

for (const [path, content] of pending) {
  await writeFile(path, content, 'utf8');
}

console.log(
  `Versioned ${references} reference(s) across ${HTML_PAGES.length} pages` +
    (stale.length ? `, updating ${stale.length} file(s):` : ' — nothing to update.')
);

for (const path of stale) console.log(`  ${show(path)}`);

if (problems.length) {
  console.error('\nUnresolved references, left unstamped:\n');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
