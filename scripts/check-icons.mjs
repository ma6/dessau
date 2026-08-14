#!/usr/bin/env node
/**
 * Dessau — icons come from the sprite, never from a font glyph.
 *
 *   node scripts/check-icons.mjs
 *
 * -----------------------------------------------------------------------------
 * Why a glyph is not an icon
 * -----------------------------------------------------------------------------
 *
 * Typing `×` for a close button or `→` for a link arrow works, right up until it
 * does not, and every way it fails is invisible to the person who wrote it:
 *
 *   - A screen reader announces it. `×` is read as "times" or "multiplication
 *     sign", so a close button announces "times". An arrow becomes "rightwards
 *     arrow" in the middle of a sentence. The glyph is content, not decoration,
 *     and there is no `aria-hidden` on a bare text node.
 *   - It renders in whatever font has it, which is usually not the UI font. Weight,
 *     baseline and optical size are all wrong, and it shifts when the font stack
 *     falls through differently on another machine.
 *   - Coverage is not guaranteed. A missing glyph is a tofu box, and it will be
 *     missing on exactly the platform nobody tested.
 *   - It cannot be sized or aligned like an icon. `1em` of a glyph is not `1em` of
 *     drawn artwork, so it never lines up with a real icon beside it.
 *
 * The sprite has none of those problems: it is `currentColor`, it is
 * `aria-hidden`, it scales, and the label lives in text.
 *
 * So the rule is absolute — every icon is a `<use>` into the sprite. This checks
 * it, because it is the kind of rule that erodes one convenient character at a
 * time.
 *
 * It also checks the failure mode the rule creates: a `<use href="#dds-icon-x">`
 * pointing at a symbol that is not in that page's sprite renders *nothing at all*.
 * No error, no warning, no fallback — just empty space where an icon was meant to
 * be. That is the single easiest thing to miss in a page full of working icons.
 *
 * Zero dependencies, Node stdlib only. Exit code 1 on any finding.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const run = promisify(execFile);

const findings = [];
const report = (message) => findings.push(message);

/* ------------------------------------------------------------------- scope */

/** Same scope as the whitelabel audit: the files that can enter the history. */
const { stdout } = await run(
  'git',
  ['-C', ROOT, 'ls-files', '--cached', '--others', '--exclude-standard'],
  { maxBuffer: 16 * 1024 * 1024 }
);

const files = stdout
  .split('\n')
  .filter(Boolean)
  .filter((path) => /\.(html|css|js|json)$/.test(path))
  // This file names the glyphs it prohibits.
  .filter((path) => path !== 'scripts/check-icons.mjs');

/**
 * Blank out comments, keeping line numbers intact.
 *
 * The rule is about what reaches the screen, and a comment does not. An arrow in
 * `Date of birth → autocomplete="bday"` is prose describing a mapping; forbidding
 * it would be a checker enforcing its own literal reading over the rule's purpose,
 * and the noise would get the whole check switched off.
 */
function stripComments(source, path) {
  let out = source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));

  if (/\.(js|json)$/.test(path)) {
    // Line comments only where a `//` cannot be part of a URL.
    out = out.replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, before) =>
      before + ' '.repeat(m.length - before.length)
    );
  }

  return out;
}

/* --------------------------------------------------- 1. no glyphs as icons */

/**
 * Characters that get reached for instead of an icon. Deliberately not "all
 * symbols": punctuation that belongs in prose is fine, and so are the typographic
 * characters that are genuinely text — an em dash, a real ellipsis, quotation
 * marks, `·` between metadata items.
 *
 * These are the ones that are only ever used as a picture of something.
 */
const GLYPHS = [
  {
    char: '×',
    name: 'MULTIPLICATION SIGN',
    instead: 'the close icon',
    /**
     * Between numbers it is doing its actual job. `2×10⁹` and `16×16` are correct
     * typography — writing `x` there would be the error. Only a `×` standing on its
     * own is a picture of a close button.
     */
    exceptWhen: /[\d)\s]\s*×\s*[\d(]/,
  },
  { char: '✕', name: 'MULTIPLICATION X', instead: 'the close icon' },
  { char: '✖', name: 'HEAVY MULTIPLICATION X', instead: 'the close icon' },
  { char: '✗', name: 'BALLOT X', instead: 'the close icon' },
  { char: '✘', name: 'HEAVY BALLOT X', instead: 'the close icon' },
  { char: '✓', name: 'CHECK MARK', instead: 'the check icon' },
  { char: '✔', name: 'HEAVY CHECK MARK', instead: 'the check icon' },
  { char: '→', name: 'RIGHTWARDS ARROW', instead: 'the arrow-right icon' },
  { char: '←', name: 'LEFTWARDS ARROW', instead: 'the arrow-left icon' },
  { char: '↑', name: 'UPWARDS ARROW', instead: 'a chevron icon' },
  { char: '↓', name: 'DOWNWARDS ARROW', instead: 'a chevron icon' },
  { char: '▸', name: 'BLACK RIGHT-POINTING SMALL TRIANGLE', instead: 'the chevron-right icon' },
  { char: '▾', name: 'BLACK DOWN-POINTING SMALL TRIANGLE', instead: 'the chevron-down icon' },
  { char: '▴', name: 'BLACK UP-POINTING SMALL TRIANGLE', instead: 'the chevron-up icon' },
  { char: '◂', name: 'BLACK LEFT-POINTING SMALL TRIANGLE', instead: 'the chevron-left icon' },
  { char: '›', name: 'SINGLE RIGHT-POINTING ANGLE QUOTATION MARK', instead: 'the chevron-right icon' },
  { char: '‹', name: 'SINGLE LEFT-POINTING ANGLE QUOTATION MARK', instead: 'the chevron-left icon' },
  { char: '≡', name: 'IDENTICAL TO', instead: 'the menu icon' },
  { char: '☰', name: 'TRIGRAM FOR HEAVEN', instead: 'the menu icon' },
  { char: '⚠', name: 'WARNING SIGN', instead: 'the warning icon' },
  { char: 'ℹ', name: 'INFORMATION SOURCE', instead: 'the info icon' },
  { char: '★', name: 'BLACK STAR', instead: 'a drawn icon' },
  { char: '☆', name: 'WHITE STAR', instead: 'a drawn icon' },
  { char: '☀', name: 'BLACK SUN WITH RAYS', instead: 'the sun icon' },
  { char: '☽', name: 'FIRST QUARTER MOON', instead: 'the moon icon' },
];

/** Emoji, which are the same mistake with a colour picture. */
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;

for (const path of files) {
  const source = await readFile(join(ROOT, path), 'utf8');
  const lines = stripComments(source, path).split('\n');

  /**
   * Build scripts print to a terminal, which has no sprite. An arrow in
   * `console.log` is the right character there.
   */
  const isUserInterface = !path.startsWith('scripts/');

  if (isUserInterface) lines.forEach((line, i) => {
    for (const glyph of GLYPHS) {
      if (!line.includes(glyph.char)) continue;
      // A character that is genuinely being used for its own meaning, not as artwork.
      if (glyph.exceptWhen && glyph.exceptWhen.test(line)) continue;
      report(
        `${path}:${i + 1}: uses ${glyph.name} (${glyph.char}) as an icon — ` +
          `use ${glyph.instead} from the sprite\n      ${line.trim().slice(0, 100)}`
      );
    }

    const emoji = line.match(EMOJI);
    if (emoji) {
      report(
        `${path}:${i + 1}: contains the emoji ${emoji[0]} — an icon is a <use> into ` +
          `the sprite\n      ${line.trim().slice(0, 100)}`
      );
    }
  });

  /* ---------------------- 2. a CSS `content` that draws instead of labelling */

  /**
   * `content: "\2713"` is the same mistake written as an escape, and it is worse:
   * generated content is not reliably exposed to assistive technology, and it
   * cannot be found by searching for the character.
   */
  if (path.endsWith('.css')) {
    lines.forEach((line, i) => {
      const escape = line.match(/content\s*:\s*["'][^"']*\\([0-9a-fA-F]{2,5})/);
      if (!escape) return;
      const codepoint = parseInt(escape[1], 16);
      // Below U+00A0 is ASCII punctuation used for real text — a colon, a slash.
      if (codepoint < 0xa0) return;
      report(
        `${path}:${i + 1}: draws U+${escape[1].toUpperCase()} with \`content\` — ` +
          `generated content is not reliably announced; use the sprite\n` +
          `      ${line.trim().slice(0, 100)}`
      );
    });
  }
}

/* ------------------------------- 3. every <use> resolves to a real symbol */

/**
 * A `<use>` naming a symbol that is not present renders nothing. Silently. On a
 * page with thirty working icons, one missing symbol is invisible unless the exact
 * spot is looked at.
 */
/** Every icon used on any page, so an unused symbol can be judged across the set. */
const usedAnywhere = new Set();
const spriteSymbols = new Set();

for (const path of files.filter((p) => p.endsWith('.html'))) {
  const source = await readFile(join(ROOT, path), 'utf8');

  const symbols = new Set(
    [...source.matchAll(/<symbol[^>]+id="([^"]+)"/g)].map((m) => m[1])
  );
  for (const id of symbols) if (id.startsWith('dds-icon-')) spriteSymbols.add(id);

  const used = [...source.matchAll(/<use[^>]+(?:xlink:)?href="#([^"]+)"/g)];

  for (const [, id] of used) {
    usedAnywhere.add(id);
    if (!symbols.has(id)) {
      report(
        `${path}: <use href="#${id}"> has no matching <symbol> on the page — ` +
          `it renders as empty space. Run: node scripts/sync-icons.mjs`
      );
    }
  }
}

/**
 * A symbol no page uses at all is dead weight in every page load. Checked across
 * the whole set rather than per page: the sprite is shared deliberately, so one
 * page carrying icons it does not use is the design, not a finding.
 */
for (const id of spriteSymbols) {
  if (!usedAnywhere.has(id)) {
    report(
      `<symbol id="${id}"> is in the sprite but no page uses it — ` +
        `drop it from scripts/build-icons.mjs`
    );
  }
}

/* ------------------------------------------------------------------ report */

if (findings.length) {
  console.log('');
  for (const finding of findings) console.log(`  ${finding}`);
}

console.log(
  `\n${files.length} files checked, ${GLYPHS.length} prohibited glyphs. ` +
    (findings.length === 0
      ? 'Every icon comes from the sprite.'
      : `${findings.length} FINDING(S).`)
);

process.exit(findings.length === 0 ? 0 : 1);
