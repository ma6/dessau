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
 * names, comments, metadata, URLs, SVG contents, demo data — AND every commit
 * message. Anything git ignores is out of scope, because it cannot be committed.
 *
 * The commit messages matter as much as the files. A message is the one place a name
 * can sit permanently with nothing scanning it, and rewriting one costs almost
 * nothing before a first push and a great deal afterwards.
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
 * @catches Any prohibited term in a committable file **or in a commit message** —
 *   names, domain vocabulary, internal hosts, cliché placeholder data, and
 *   phrases that describe provenance without naming it.
 *
 */

import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = join(ROOT, '.whitelabel-terms.json');

/** Shared by both git calls. Module scope, because it was once local to one of them
    and the other silently caught the resulting ReferenceError. */
const run = promisify(execFile);

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

/** Every line the working tree currently holds, so the history pass below can tell
    "this used to say X" from "this still says X and was already reported". */
const currentLines = new Set();

for (const relativePath of files) {
  let source;
  try {
    source = await readFile(join(ROOT, relativePath), 'utf8');
  } catch {
    continue; // unreadable or binary
  }

  const lines = source.split('\n');
  for (const line of lines) currentLines.add(line.trim());

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

/* --- commit messages ------------------------------------------------------- */

/**
 * The history is part of the repository, and a commit message is the one place a
 * name can sit forever with nothing scanning it.
 *
 * This is not hypothetical: after every file was clean, two commit messages still
 * referred to the material Dessau was generalised from — one of them in the subject
 * line of the initial commit, which is the single most visible string in the whole
 * project. The file audit passed the entire time, because a commit message is not a
 * file.
 *
 * Rewriting a message means rewriting history, which is cheap before a first push
 * and expensive afterwards. So it is checked from the start.
 */
async function commitMessages() {
  try {
    const { stdout } = await run(
      'git',
      ['-C', ROOT, 'log', '--format=%H%x1f%B%x1e', '--all'],
      { maxBuffer: 32 * 1024 * 1024 }
    );

    return stdout
      .split('\x1e')
      .map((record) => record.trim())
      .filter(Boolean)
      .map((record) => {
        const [hash, body] = record.split('\x1f');
        return { hash: hash.trim().slice(0, 9), body: body || '' };
      });
  } catch (error) {
    /**
     * A repository with no commits yet is legitimately empty. Anything else is a
     * broken audit pretending to be a clean one.
     *
     * The first version of this was a bare `catch { return [] }`, which swallowed a
     * ReferenceError and reported "0 commit messages scanned" as a pass. That is the
     * exact failure this whole script exists to prevent — a check that cannot fail.
     */
    if (/does not have any commits yet|unknown revision/i.test(error.message)) {
      return [];
    }

    console.error('\nCannot run: reading the commit history failed.\n');
    console.error('  ' + error.message);
    console.error('\nThe history is in scope, so an audit that cannot read it has not');
    console.error('checked what it claims to check.\n');
    process.exit(1);
  }
}

const commits = await commitMessages();

for (const commit of commits) {
  const lines = commit.body.split('\n');

  for (const entry of TERMS) {
    const pattern = matcher(entry);

    lines.forEach((line, index) => {
      if (!pattern.test(line)) return;

      // The same allowlist mechanism, keyed by commit rather than by file.
      const key = 'commit:' + entry.term;
      if (ALLOWED.has(key)) {
        allowed.push({ file: `commit ${commit.hash}`, line: index + 1, term: entry.term });
        return;
      }

      findings.push({
        file: `commit ${commit.hash} (message)`,
        line: index + 1,
        term: entry.term,
        text: line.trim().slice(0, 120),
      });
    });
  }
}

/* --- 3. historical file contents ------------------------------------------- */

/**
 * What a file USED to say, which is the half this audit did not cover.
 *
 * The two halves had different reach and the weaker one was the half that matters
 * when a repository is made public:
 *
 *   commit messages   git log --all              the whole history
 *   file contents     git ls-files               the current working tree only
 *
 * A term that sat in a file at some commit and was later removed is still in the
 * history, still readable by anybody with a clone, and was invisible here. While
 * the repository is private that is theoretical. On the day it goes public it is
 * the only thing standing between "clean today" and "safe to publish" — and by
 * then it is unfixable without rewriting history.
 *
 * Added lines across every diff, rather than every blob in every tree. Anything
 * that ever entered a file entered as an addition somewhere, including in the
 * initial commit, so this sees it once instead of once per commit it survived.
 * `--unified=0` drops context lines, which would otherwise report the same
 * surviving line again for every commit that happened to touch its neighbours.
 *
 * What it does not see: content inside binary files, which git does not diff as
 * text. Nothing in this repository is binary except the reference site's fonts and
 * images, and a term hidden in one of those is not the failure mode this guards
 * against.
 */
async function historicalAdditions() {
  try {
    const { stdout } = await run(
      'git',
      ['-C', ROOT, 'log', '--all', '-p', '--unified=0', '--format=%x1e%H'],
      { maxBuffer: 256 * 1024 * 1024 }
    );

    const records = [];

    for (const chunk of stdout.split('\x1e')) {
      if (!chunk.trim()) continue;
      const newline = chunk.indexOf('\n');
      const hash = (newline === -1 ? chunk : chunk.slice(0, newline)).trim().slice(0, 9);
      let path = '';

      for (const line of chunk.slice(newline + 1).split('\n')) {
        if (line.startsWith('+++ b/')) {
          path = line.slice('+++ b/'.length);
          continue;
        }
        /* `+++` is a header, not an addition. Everything else starting with a
           single `+` is a line that entered the repository. */
        if (line.startsWith('+') && !line.startsWith('+++')) {
          records.push({ hash, path, text: line.slice(1) });
        }
      }
    }

    return records;
  } catch (error) {
    console.error('\nCannot run: reading the history diffs failed.\n');
    console.error('  ' + error.message);
    console.error('\nPast file contents are in scope, so an audit that cannot read');
    console.error('them has not checked what it claims to check.\n');
    process.exit(1);
  }
}

const additions = await historicalAdditions();

/* Only what is no longer present. A term on a line the working tree still holds
   was already reported by the pass above, and reporting it again with a commit
   hash attached would bury the findings that are visible only here. */
for (const addition of additions) {
  /* The same exclusions as the working-tree pass. This script and the example term
     list contain the terms by definition, and they contained them in every earlier
     revision too — without this, the audit reports itself, loudly, and buries the
     findings that matter. */
  if (EXCLUDE_FILES.has(addition.path)) continue;
  if (BINARY.test(addition.path)) continue;

  for (const entry of TERMS) {
    if (!matcher(entry).test(addition.text)) continue;
    if (currentLines.has(addition.text.trim())) continue;

    const key = 'history:' + entry.term;
    if (ALLOWED.has(key)) {
      allowed.push({ file: `history ${addition.hash}`, line: 0, term: entry.term });
      continue;
    }

    findings.push({
      file: `${addition.path} @ ${addition.hash} (removed since)`,
      line: 0,
      term: entry.term,
      text: addition.text.trim().slice(0, 120),
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
  `\n${files.length} files and ${commits.length} commit messages scanned, ` +
    `${TERMS.length} terms searched ` +
    `(case-insensitive; git-ignored files are out of scope).\n` +
    (findings.length === 0
      ? `CLEAN — 0 unjustified hits, ${allowed.length} justified.`
      : `${findings.length} UNJUSTIFIED HIT(S).`)
);

process.exit(findings.length === 0 ? 0 : 1);
