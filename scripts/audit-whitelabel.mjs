#!/usr/bin/env node
/**
 * Dessau — whitelabel audit.
 *
 *   node scripts/audit-whitelabel.mjs
 *
 * Repository-wide, case-insensitive search for any trace of the source project,
 * its organisation, its domain or its process baggage — across everything that is
 * or could become part of Dessau's Git history.
 *
 * `src/` is excluded because it IS the source material and is git-ignored. So are
 * the bootstrap instructions, which necessarily name what they are asking to be
 * removed. Everything else is in scope: file contents, filenames, directory names,
 * comments, metadata, URLs, SVG contents, and demo data.
 *
 * Run before any commit that could carry inherited material.
 *
 * Zero dependencies, Node stdlib only. Exit code 1 on any hit.
 */

import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, basename } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Paths never scanned. Each exclusion is deliberate and justified. */
const EXCLUDE_DIRS = new Set([
  '.git',
  'node_modules',
  'dist', // generated, git-ignored
  'src', // the source material itself; git-ignored
]);

const EXCLUDE_FILES = new Set([
  // The bootstrap instructions name the things they ask to be removed. Both are
  // git-ignored and never enter the history.
  'DESSAU_BOOTSTRAP.md',
  // This file: it contains the search terms by definition.
  'audit-whitelabel.mjs',
]);

const EXCLUDE_PATTERNS = [/^MINI_PROMPT.*\.txt$/, /\.(ttf|woff2?|otf|png|jpe?g|gif|webp|ico|wav|mp[34])$/i];

/**
 * Terms to search for.
 *
 * `word: true` requires a word boundary — without it, `HK` matches inside
 * "checkbox" and `lp-` inside "help-", producing noise that hides real hits.
 */
const TERMS = [
  // --- the source project ---
  { term: 'lily', word: true },
  { term: 'lilly', word: true },
  { term: 'lily patch' },
  { term: 'lilly patch' },
  { term: 'lily-patch' },
  { term: 'lilly-patch' },
  { term: 'lp-', raw: /(^|[^a-z0-9-])lp-/i },
  { term: '--lp-' },
  { term: 'data-lp' },
  { term: 'window.LilyPatch' },
  { term: 'fleur-de-lis' },

  // --- the organisation ---
  { term: 'HK', word: true },
  { term: 'haftpflicht' },
  { term: 'haftpflichtkasse' },
  { term: 'VVaG', word: true },
  { term: 'meineHK' },

  // --- the domain ---
  { term: 'versicherung' },
  { term: 'insurance', word: true },
  { term: 'tarif' },
  { term: 'policen' },
  { term: 'schadennummer' },
  { term: 'sparte' },
  { term: 'makler' },
  { term: 'endkundenportal' },
  { term: 'extranet' },

  // --- internal systems, people, places ---
  { term: 'jaimes' },
  { term: 'DOWT-', raw: /DOWT-\d/i },
  { term: 'ro-docker' },
  { term: 'ro-nexus' },
  { term: 'scm/dowt' },
  { term: 'rudolf-reusch' },
  { term: 'reusch' },

  // --- process baggage that does not belong in a solo-maintained foundation ---
  { term: 'DORA', word: true },
  { term: 'vier-augen' },
  { term: 'four-eyes' },
  { term: 'Verfahrensanweisung' },
  { term: 'CAB', word: true },
  { term: 'Freigabe-Gate' },
  { term: 'peer approval' },
  { term: 'mandatory review' },

  // --- retired typography and cliché demo data ---
  { term: 'Filson' },
  { term: 'IBM Plex' },
  { term: 'Mustermann' },
  { term: 'Lorem ipsum' },
  { term: 'John Doe' },
  { term: 'example.com' },
];

/**
 * Justified exceptions.
 *
 * Some of these terms legitimately appear as PROHIBITIONS — "no four-eyes rule",
 * "never use Max Mustermann". Removing the term from the search instead would be
 * weaker: the audit would then no longer catch the term appearing as real content.
 *
 * So each exception is enumerated with a reason, and anything not listed here is
 * still a failure. An audit with visible, justified exceptions is stronger than one
 * with quiet omissions.
 *
 * Matched as `<file>:<term>`.
 */
const ALLOWED = new Map([
  [
    'AGENTS.md:four-eyes',
    'Names the process Dessau deliberately does not have, so an agent does not invent it.',
  ],
  [
    'AGENTS.md:peer approval',
    'Same — stating the absence is the requirement.',
  ],
  [
    'README.md:peer approval',
    'Same, in the human-facing summary.',
  ],
  [
    'agent/principles.md:four-eyes',
    'Principle 13: no invented process. The absence has to be stated to be binding.',
  ],
  [
    'agent/principles.md:peer approval',
    'Same.',
  ],
  [
    'agent/ux-writing.md:Mustermann',
    'A do-not rule about demo data. The cliché has to be named to be prohibited.',
  ],
  [
    'agent/ux-writing.md:John Doe',
    'Same rule, same line.',
  ],
  [
    'agent/ux-writing.md:example.com',
    'Recommends the RFC 2606 reserved domains for addresses that must not resolve.',
  ],
]);

function matcher(entry) {
  if (entry.raw) return entry.raw;
  const escaped = entry.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(entry.word ? `\\b${escaped}\\b` : escaped, 'i');
}

async function walk(directory, files = []) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (item.name.startsWith('.') && item.name !== '.gitignore') continue;
    if (EXCLUDE_DIRS.has(item.name)) continue;

    const path = join(directory, item.name);

    if (item.isDirectory()) {
      await walk(path, files);
      continue;
    }

    if (EXCLUDE_FILES.has(item.name)) continue;
    if (EXCLUDE_PATTERNS.some((pattern) => pattern.test(item.name))) continue;

    files.push(path);
  }
  return files;
}

const files = (await walk(ROOT)).sort();
const findings = [];
/** Hits that matched a justified exception; reported, not failed. */
const allowed = [];

/* --- filenames and directory names ---------------------------------------- */

for (const file of files) {
  const relativePath = relative(ROOT, file);
  for (const entry of TERMS) {
    if (matcher(entry).test(relativePath)) {
      findings.push({ file: relativePath, line: 0, term: entry.term, text: '(in the path)' });
    }
  }
}

/* --- file contents --------------------------------------------------------- */

for (const file of files) {
  const relativePath = relative(ROOT, file);
  let source;
  try {
    source = await readFile(file, 'utf8');
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
    `(case-insensitive, excluding src/ and the bootstrap instructions).\n` +
    (findings.length === 0
      ? `CLEAN — 0 unjustified hits, ${allowed.length} justified.`
      : `${findings.length} UNJUSTIFIED HIT(S).`)
);

process.exit(findings.length === 0 ? 0 : 1);
