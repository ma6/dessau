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
 * What it cannot catch, and the reason the rule above is written where it is: a
 * `<use>` pointing at the WRONG role. `#dds-icon-sun` on a "show password" button
 * resolves, renders, and is a picture of the sun. Only a person reading the markup
 * sees that. The countermeasure is not a check, it is that the set contains the
 * role you need — see `ICON_MAP` in `scripts/build-icons.mjs`, which says so at
 * the point where a missing role is felt.
 *
 * Zero dependencies, Node stdlib only. Exit code 1 on any finding.
 * @catches A Unicode glyph or emoji used as an icon, a `content:` escape drawing
 *   one, a `<use>` naming a symbol that is not on the page (which renders as
 *   nothing at all), a script building a `<use>` for a symbol the sprite does not
 *   have, and a symbol nothing uses and no one has declared a reason for.
 *
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
  { char: '↑', name: 'UPWARDS ARROW', instead: 'the arrow-up icon' },
  { char: '↓', name: 'DOWNWARDS ARROW', instead: 'the arrow-down icon' },
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
  /* There is no star in the set, which is the point: the fix is to add one to
     `ICON_MAP` in scripts/build-icons.mjs, not to type the character. Every entry
     in this list is a role the set either has or should gain — none of them is a
     reason to reuse a role that means something else. */
  { char: '★', name: 'BLACK STAR', instead: 'a drawn icon — add one to ICON_MAP' },
  { char: '☆', name: 'WHITE STAR', instead: 'a drawn icon — add one to ICON_MAP' },
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
/**
 * Symbols the sprite marks `data-dds-vocabulary` — in the set deliberately
 * without a caller here, with the reason in the comment above them. Today that is
 * only the direction families: "up" is meaningful because "down" is, not because
 * a page in this repository happens to point at it this week.
 */
const declaredVocabulary = new Set();

for (const path of files.filter((p) => p.endsWith('.html'))) {
  const source = await readFile(join(ROOT, path), 'utf8');

  const symbols = new Set();
  for (const [, attributes] of source.matchAll(/<symbol\b([^>]*)>/g)) {
    const id = (attributes.match(/\bid="([^"]+)"/) || [])[1];
    if (!id) continue;
    symbols.add(id);
    if (id.startsWith('dds-icon-') && /\bdata-dds-vocabulary\b/.test(attributes)) {
      declaredVocabulary.add(id);
    }
  }
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
 * A script naming a symbol is a caller too.
 *
 * Not every icon reaches the page through hand-written markup: an enhancement
 * that builds a control builds its icon with it — the file list in an upload, the
 * reveal toggle on a password field. Reading only HTML, this check called those
 * symbols dead weight and told the maintainer to delete the only artwork the
 * component has.
 *
 * The names are matched as string literals, with or without the leading `#`,
 * because both spellings occur: `href="#" + id` and `setAttribute('href',
 * '#dds-icon-close')`. An id assembled at runtime from a fragment is invisible
 * here, exactly as it is to any reader of the file.
 */
const ICON_ID_IN_SCRIPT = /['"`]#?(dds-icon-[a-z0-9]+(?:-[a-z0-9]+)*)['"`]/g;

for (const path of files.filter((p) => p.endsWith('.js'))) {
  const source = stripComments(await readFile(join(ROOT, path), 'utf8'), path);

  for (const [, id] of source.matchAll(ICON_ID_IN_SCRIPT)) {
    usedAnywhere.add(id);
    if (!spriteSymbols.has(id)) {
      report(
        `${path}: builds <use href="#${id}">, which is not in the sprite — ` +
          `it renders as empty space. Add the role to ICON_MAP in ` +
          `scripts/build-icons.mjs and re-run the icon build.`
      );
    }
  }
}

/**
 * A symbol no page uses at all is dead weight in every page load. Checked across
 * the whole set rather than per page: the sprite is shared deliberately, so one
 * page carrying icons it does not use is the design, not a finding.
 *
 * The exception, and why it exists: unqualified, this rule says an icon may not be
 * added until something already needs it — and at the moment something needs it,
 * the nearest existing symbol is right there and resolves. That is how a SUN ended
 * up on a "show password" button and the navigation HAMBURGER on an overflow menu.
 * Both rendered. Both passed this check.
 *
 * So a role may be declared in `ICON_MAP` with a reason it belongs without a
 * caller; the build writes that as `data-dds-vocabulary` and the reason as the
 * comment above the symbol. The exemption is granted on the declaration alone —
 * and every exempt symbol is listed on each run, so it stays an argument someone
 * made rather than a silent hole in the rule.
 */
for (const id of spriteSymbols) {
  if (usedAnywhere.has(id) || declaredVocabulary.has(id)) continue;
  report(
    `<symbol id="${id}"> is in the sprite but no page uses it — ` +
      `give it a caller, or declare in scripts/build-icons.mjs why it belongs ` +
      `without one`
  );
}

/**
 * The other half of the exemption: a declaration that has quietly acquired a
 * caller is no longer an exemption, it is an untidy one. Not a failure — the icon
 * is in use and correct — but worth saying, because the reason attached to it has
 * stopped being the reason it is there.
 */
const nowUsed = [...declaredVocabulary].filter((id) => usedAnywhere.has(id));

/* ------------------------------------------------------------------ report */

if (findings.length) {
  console.log('');
  for (const finding of findings) console.log(`  ${finding}`);
}

/* Printed on every run, pass or fail. An exemption nobody sees is an exemption
   nobody revisits, and the whole point of declaring it was to keep it arguable. */
if (declaredVocabulary.size) {
  console.log(
    `\n  In the set without a caller, by declaration ` +
      `(see ICON_MAP in scripts/build-icons.mjs):`
  );
  for (const id of [...declaredVocabulary].sort()) {
    console.log(`    ${id}${usedAnywhere.has(id) ? '  — now has a caller' : ''}`);
  }
  if (nowUsed.length) {
    console.log(
      `\n  ${nowUsed.length} of them are now used. The declaration is no longer ` +
        `what keeps them\n  in the set, so it can go.`
    );
  }
}

console.log(
  `\n${files.length} files checked, ${GLYPHS.length} prohibited glyphs. ` +
    (findings.length === 0
      ? 'Every icon comes from the sprite.'
      : `${findings.length} FINDING(S).`)
);

process.exit(findings.length === 0 ? 0 : 1);
