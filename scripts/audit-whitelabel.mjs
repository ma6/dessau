#!/usr/bin/env node
/**
 * Dessau — whitelabel audit.
 *
 *   node scripts/audit-whitelabel.mjs
 *
 * Repository-wide, case-insensitive search for any term that must not appear in
 * Dessau: names, domain vocabulary, internal hosts, retired typefaces, cliché
 * placeholder data.
 *
 * Scope is every file that can enter the history — contents, filenames, directory
 * names, comments, metadata, URLs, SVG contents, demo data. Anything git ignores is
 * out of scope, because it cannot be committed.
 *
 * -----------------------------------------------------------------------------
 * The term list lives OUTSIDE the repository
 * -----------------------------------------------------------------------------
 *
 * `.whitelabel-terms.json`, which is git-ignored. Copy
 * `.whitelabel-terms.example.json` to create it.
 *
 * The reason is not convenience. An audit that enumerates the names it searches
 * for becomes the most reliable place in the repository to find those names — the
 * check would be the single largest trace of exactly what it exists to keep out.
 * Keeping the list local removes that trace, and the audit still runs.
 *
 * If the file is missing, this script FAILS rather than passing with nothing to
 * search for. A check that cannot fail is worse than no check, because it is
 * trusted.
 *
 * Zero dependencies, Node stdlib only. Exit code 1 on any unjustified hit, and on
 * a missing term list.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = join(ROOT, '.whitelabel-terms.json');

/* ------------------------------------------------------------------- config */

let config;
try {
  config = JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
} catch (error) {
  console.error('\nCannot run: .whitelabel-terms.json is missing or unreadable.\n');
  console.error('  ' + (error.code === 'ENOENT' ? 'File not found.' : error.message));
  console.error('\nCreate it from the template:\n');
  console.error('  cp .whitelabel-terms.example.json .whitelabel-terms.json\n');
  console.error('The list is deliberately kept out of the repository — an audit that');
  console.error('enumerates the names it looks for is the best place to find them.');
  console.error('See the comment in the example file.\n');
  process.exit(1);
}

const TERMS = Array.isArray(config.terms) ? config.terms : [];
const ALLOWED = new Map(Object.entries(config.allowed || {}));

if (!TERMS.length) {
  console.error('\nCannot run: .whitelabel-terms.json contains no terms.\n');
  console.error('An audit with an empty term list passes unconditionally, which is');
  console.error('worse than no audit at all.\n');
  process.exit(1);
}

/* ----------------------------------------------------------------- scanning */

/**
 * Scope: exactly the files that can enter the history.
 *
 * That is what the audit is about, so it is asked of git in one command rather than
 * approximated with a hand-maintained exclusion list — which drifts from
 * `.gitignore` and then scans too much or, worse, too little.
 *
 *   git ls-files --cached --others --exclude-standard
 *
 * That is "tracked files, plus untracked files git would let you add" — precisely
 * the set that can be committed. Local reference material, working notes, generated
 * output and the term list itself are all ignored and therefore out of scope.
 *
 * An earlier attempt piped paths into `git check-ignore --stdin` via `execFile`.
 * `execFile` has no `input` option, so the child waited on stdin forever and the
 * script hung. Listing is the right operation anyway: one call, no stdin.
 */
async function committableFiles() {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const run = promisify(execFile);

  const { stdout } = await run(
    'git',
    ['-C', ROOT, 'ls-files', '--cached', '--others', '--exclude-standard'],
    { maxBuffer: 16 * 1024 * 1024 }
  );

  return stdout.split('\n').filter(Boolean);
}

const EXCLUDE_FILES = new Set([
  // Contains the search terms by definition.
  'scripts/audit-whitelabel.mjs',
  // Lists terms by definition.
  '.whitelabel-terms.example.json',
]);

// Binary formats: nothing readable to search.
const BINARY = /\.(ttf|woff2?|otf|png|jpe?g|gif|webp|ico|wav|mp[34])$/i;

function matcher(entry) {
  if (entry.raw) return new RegExp(entry.raw, 'i');
  const escaped = entry.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(entry.word ? `\\b${escaped}\\b` : escaped, 'i');
}

let files;
try {
  files = (await committableFiles())
    .filter((path) => !EXCLUDE_FILES.has(path))
    .filter((path) => !BINARY.test(path))
    .sort();
} catch (error) {
  console.error('\nCannot run: `git ls-files` failed.\n');
  console.error('  ' + error.message);
  console.error('\nThe audit defines its scope as "files that can be committed", so it');
  console.error('needs a git repository. Rather than fall back to scanning everything —');
  console.error('which would report git-ignored reference material as findings — it stops.\n');
  process.exit(1);
}
const findings = [];
/** Hits that matched a justified exception; reported, not failed. */
const allowed = [];

/* --- filenames and directory names ---------------------------------------- */

for (const relativePath of files) {
  for (const entry of TERMS) {
    if (matcher(entry).test(relativePath)) {
      findings.push({ file: relativePath, line: 0, term: entry.term, text: '(in the path)' });
    }
  }
}

/* --- file contents --------------------------------------------------------- */

for (const relativePath of files) {
  let source;
  try {
    source = await readFile(join(ROOT, relativePath), 'utf8');
  } catch {
    continue; // unreadable or binary
  }

  const lines = source.split('\n');

  for (const entry of TERMS) {
    const pattern = matcher(entry);
    lines.forEach((line, index) => {
      if (!pattern.test(line)) return;

      const key = relativePath + ':' + entry.term;
      if (ALLOWED.has(key)) {
        allowed.push({ file: relativePath, line: index + 1, term: entry.term });
        return;
      }

      findings.push({
        file: relativePath,
        line: index + 1,
        term: entry.term,
        text: line.trim().slice(0, 120),
      });
    });
  }
}

/* --- report ---------------------------------------------------------------- */

if (findings.length) {
  const byTerm = new Map();
  for (const finding of findings) {
    if (!byTerm.has(finding.term)) byTerm.set(finding.term, []);
    byTerm.get(finding.term).push(finding);
  }

  for (const [term, list] of byTerm) {
    console.log(`\n"${term}" — ${list.length} hit(s):`);
    for (const finding of list.slice(0, 12)) {
      console.log(`  ${finding.file}:${finding.line}`);
      console.log(`    ${finding.text}`);
    }
    if (list.length > 12) console.log(`  … and ${list.length - 12} more`);
  }
}

if (allowed.length) {
  console.log(`\nJustified exceptions (${allowed.length}) — the term appears as a prohibition:`);
  const seen = new Set();
  for (const item of allowed) {
    const key = item.file + ':' + item.term;
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(`  ${item.file}:${item.line}  "${item.term}"`);
    console.log(`    ${ALLOWED.get(key)}`);
  }
}

console.log(
  `\n${files.length} files scanned, ${TERMS.length} terms searched ` +
    `(case-insensitive; git-ignored files are out of scope).\n` +
    (findings.length === 0
      ? `CLEAN — 0 unjustified hits, ${allowed.length} justified.`
      : `${findings.length} UNJUSTIFIED HIT(S).`)
);

process.exit(findings.length === 0 ? 0 : 1);
