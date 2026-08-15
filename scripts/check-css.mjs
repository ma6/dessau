#!/usr/bin/env node
/**
 * Dessau — silent-failure checker for CSS.
 *
 *   node scripts/check-css.mjs
 *
 * Catches seven classes of mistake that produce NO error anywhere — no console
 * message, no broken layout, no failing test. Just a piece of design that is
 * quietly absent. Every one of these is the kind of thing that gets noticed
 * weeks later, in a product, by a user.
 *
 * 1. Undefined custom property.
 *    `var(--dds-space-4)` where that name does not exist makes the ENTIRE
 *    declaration invalid at computed-value time. It does not fall back to the
 *    previous declaration — it falls back to `inherit` or `initial`. A padding
 *    silently becomes zero. A `var(--x, 1rem)` fallback is valid and is ignored
 *    by this check.
 *
 * 2. A component reaching past the semantic layer to a primitive colour.
 *    Using `--dds-indigo-600` instead of `--dds-color-action-primary` renders
 *    correctly — and then does not change when the theme does, because
 *    primitives are theme-independent. It breaks only in dark mode, which is
 *    exactly where nobody looks first.
 *
 * 3. A raw colour where a semantic one exists.
 *    Same failure mode: correct today, wrong after the first re-theme.
 *
 * 4. A class JavaScript adds or removes that no stylesheet defines.
 *    The feature is simply absent. This check exists because exactly that
 *    happened: `dds-scroll-locked` was toggled by the dialog code and never
 *    defined, so the scroll lock behind every modal silently did nothing.
 *
 * 5. `display` on a dialog outside its open state.
 *    The UA closes a `<dialog>` with `display: none`; an author declaration beats
 *    it, so the closed dialog stays in the layout and swallows every click.
 *
 * 6. A class whose `display` cancels the `hidden` attribute.
 *    `dds.components` is a later layer than `dds.base`, so a class that sets
 *    `display` beats the base sheet's `[hidden]` rule however that is written.
 *    The JavaScript hides the element, nothing logs, and the box stays.
 *
 * 7. A named `@container` query with no matching `container-name`.
 *    The rule never matches anything. The component just stays in its base form,
 *    usually the narrow one, at every width.
 *
 * Zero dependencies, Node stdlib only. Exit code 1 on any finding.
 * @catches An undefined custom property, a primitive colour leaking past the
 *   semantic layer, a raw colour value, a class the JavaScript toggles that no
 *   stylesheet defines, `display` on a dialog outside `[open]`, a class whose
 *   `display` defeats the `hidden` attribute, and a container query whose
 *   container does not exist.
 *
 */

import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, basename } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSS_DIR = join(ROOT, 'dds/css');

/* ---------------------------------------------------------------- gathering */

async function layerFiles() {
  const entries = await readdir(CSS_DIR, { withFileTypes: true });
  return entries
    .filter(
      (entry) =>
        entry.isFile() && entry.name.endsWith('.css') && !entry.name.endsWith('.min.css')
    )
    .map((entry) => join(CSS_DIR, entry.name))
    .sort();
}

const files = [join(ROOT, 'dds/dds.css'), ...(await layerFiles())];

const sources = new Map();
for (const file of files) {
  sources.set(file, await readFile(file, 'utf8'));
}

/**
 * Strip comments before analysing.
 *
 * Without this, every explanatory comment mentioning `var(--dds-space-4)` as a
 * counter-example would be reported as a real usage — and these stylesheets
 * deliberately explain their own failure modes in prose. Comments are replaced
 * with equal-length whitespace so reported line numbers stay correct.
 */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '));
}

const stripped = new Map();
for (const [file, source] of sources) {
  stripped.set(file, stripComments(source));
}

/* ------------------------------------------------------------- definitions */

const defined = new Set();
for (const css of stripped.values()) {
  for (const match of css.matchAll(/(--dds-[\w-]+)\s*:/g)) {
    defined.add(match[1]);
  }
}

/** Every `.dds-*` class actually defined in a selector. */
const definedClasses = new Set();
for (const css of stripped.values()) {
  for (const match of css.matchAll(/\.(dds-[\w-]+)/g)) {
    definedClasses.add(match[1]);
  }
}

const primitives = new Set();
{
  const css = stripped.get(join(CSS_DIR, 'primitives.css')) || '';
  for (const match of css.matchAll(/(--dds-[\w-]+)\s*:/g)) {
    primitives.add(match[1]);
  }
}

const findings = [];

function report(file, line, rule, message) {
  findings.push({ file: relative(ROOT, file), line, rule, message });
}

function lineOf(css, index) {
  return css.slice(0, index).split('\n').length;
}

/* ------------------------------------------------------- 1. undefined vars */

for (const [file, css] of stripped) {
  // Capture the character after the name so a fallback can be detected.
  for (const match of css.matchAll(/var\(\s*(--[\w-]+)\s*([,)])/g)) {
    const [, name, terminator] = match;

    // A fallback keeps the declaration valid regardless.
    if (terminator === ',') continue;

    // Only DDS names are our responsibility; a product may pass its own in.
    if (!name.startsWith('--dds-')) continue;

    if (!defined.has(name)) {
      report(
        file,
        lineOf(css, match.index),
        'undefined-custom-property',
        `var(${name}) is never defined — the whole declaration is invalid at computed-value time`
      );
    }
  }
}

/* ------------------------------- 1a. a comment that closed early */

/**
 * A stray `*​/` outside a comment, which means a comment closed where it was not
 * meant to and the prose after it is being parsed as CSS.
 *
 * This is not hypothetical and it is not cosmetic. Editing a comment above
 * `.dds-toolbar-group` left a paragraph between two `*​/` markers; the browser
 * read it as the beginning of a selector, and CSS error recovery discards
 * everything up to and including the NEXT block — so the rule below the comment
 * was dropped in full. The stylesheet still parsed, the page still rendered, and
 * one component silently lost its styling.
 *
 * Nothing else here could see it. Every other check in this file runs on the
 * comment-stripped text, where the damage looks like ordinary CSS.
 *
 * The test is simple because the failure is: after stripping every well-formed
 * comment, a `*​/` that survives had no opening partner.
 */
for (const [file, css] of stripped) {
  const stray = css.indexOf('*/');
  if (stray !== -1) {
    report(
      file,
      lineOf(css, stray),
      'unbalanced-comment',
      'a */ with no opening /* — the comment above it closed early, and everything ' +
        'from there to the end of the next rule is being parsed as CSS and discarded'
    );
  }
}

/* ------------------------ 2. primitive colours outside the foundation layer */

const FOUNDATION_FILES = new Set(['primitives.css', 'semantic.css']);

for (const [file, css] of stripped) {
  if (FOUNDATION_FILES.has(basename(file))) continue;

  for (const match of css.matchAll(/var\(\s*(--dds-[\w-]+)/g)) {
    const name = match[1];
    if (!primitives.has(name)) continue;

    // Space, radius, type, motion, z-index and border widths have no semantic
    // alias by design — they are not theme-dependent, so consuming them directly
    // is correct. Only the colour primitives are a real problem.
    const isColourPrimitive =
      /^--dds-(stone|indigo|clay|magenta|violet|green|amber|red|cyan)-/.test(name);
    if (!isColourPrimitive) continue;

    report(
      file,
      lineOf(css, match.index),
      'primitive-colour',
      `${name} is a primitive — use a semantic colour token, or this will not follow the theme`
    );
  }
}

/* ------------------------------------------------- 3. raw colours downstream */

const DOWNSTREAM_FILES = new Set([
  'components.css',
  'components-forms.css',
  'components-navigation.css',
  'components-content.css',
  'patterns.css',
  'patterns-flows.css',
  'layout.css',
  'typography.css',
  'utilities.css',
]);

for (const [file, css] of stripped) {
  if (!DOWNSTREAM_FILES.has(basename(file))) continue;

  for (const match of css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    report(
      file,
      lineOf(css, match.index),
      'raw-colour',
      `${match[0]} is a raw colour — use a semantic colour token`
    );
  }

  for (const match of css.matchAll(/\b(rgb|hsl)a?\(/g)) {
    // No exceptions. Translucent overlays are the one legitimate case for a raw
    // colour, and they now live behind `--dds-color-overlay*` in semantic.css —
    // so a downstream file reaching for rgb() directly is always a finding.
    report(
      file,
      lineOf(css, match.index),
      'raw-colour',
      `${match[0]}…) is a raw colour — use a semantic colour token`
    );
  }
}

/* -------------------------- 4. classes used by JS but never defined in CSS */

/**
 * A class that JavaScript adds or removes but no stylesheet defines does nothing.
 * No error, no visual change — the feature is simply absent.
 *
 * This check exists because exactly that happened: `dds-scroll-locked` was added
 * and removed by the dialog code and never defined, so the scroll lock behind every
 * modal silently did not work. The CSS-only checks above could not see it, because
 * nothing in the CSS was wrong.
 */
{
  const jsFiles = [];
  async function collect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await collect(path);
      else if (entry.name.endsWith('.js')) jsFiles.push(path);
    }
  }
  await collect(join(ROOT, 'dds/js'));

  for (const file of jsFiles) {
    const source = stripComments(await readFile(file, 'utf8'));

    // classList.add('x') / .remove('x') / .toggle('x'), and className = 'x y'.
    const references = new Set();
    for (const match of source.matchAll(/classList\.(?:add|remove|toggle)\(\s*'([^']+)'/g)) {
      match[1].split(/\s+/).forEach((name) => references.add(name));
    }
    for (const match of source.matchAll(/className\s*=\s*'([^']+)'/g)) {
      match[1].split(/\s+/).forEach((name) => references.add(name));
    }
    for (const match of source.matchAll(/setAttribute\(\s*'class'\s*,\s*'([^']+)'/g)) {
      match[1].split(/\s+/).forEach((name) => references.add(name));
    }

    for (const name of references) {
      if (!name.startsWith('dds-')) continue;
      // A trailing hyphen means the name is built by concatenation —
      // `'dds-toast-' + kind`. The complete name is not knowable statically, so
      // there is nothing to verify. Reporting it would be a false positive that
      // teaches people to ignore this check.
      if (name.endsWith('-')) continue;
      if (definedClasses.has(name)) continue;
      report(
        file,
        1,
        'undefined-class',
        `JavaScript references .${name} but no stylesheet defines it — the feature silently does nothing`
      );
    }
  }
}

/* ------------- 5. `display` on a dialog outside its open state ------------- */

/**
 * A `<dialog>` is closed by the UA stylesheet with
 * `dialog:not([open]) { display: none }`. Author styles beat UA styles, so
 * declaring `display` on the dialog's own class unconditionally overrides that —
 * and the closed dialog stays in the layout, invisible but still intercepting
 * pointer events. A full-viewport dialog then becomes an invisible overlay that
 * swallows every click on the page, including the one meant to open it.
 *
 * Found the hard way. The symptom was "the lightbox does not work", which points
 * nowhere near the CSS, and the dialog markup and JavaScript were both correct.
 *
 * The same applies to `popover`, which the UA also closes with `display: none`.
 * `display` must be scoped to `[open]` or `:popover-open`.
 */
{
  const DIALOG_ROOT = /\.dds-(dialog|lightbox|menu|tooltip)\b/;

  for (const [file, css] of stripped) {
    // These files have no nested braces inside a declaration block, so scanning
    // to the next `}` is enough to isolate a rule.
    for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const [, selector, body] = match;

      if (!DIALOG_ROOT.test(selector)) continue;
      // A descendant part may set `display` freely; only the root rule matters.
      if (/\.dds-(dialog|lightbox|menu|tooltip)-[\w-]+/.test(selector)) continue;
      // Already correctly scoped, or targeting the backdrop.
      if (/\[open\]|popover-open|::backdrop/.test(selector)) continue;

      if (!/(^|[;\s])display\s*:/.test(body)) continue;

      report(
        file,
        lineOf(css, match.index),
        'dialog-display-unscoped',
        `${selector.trim().replace(/\s+/g, ' ')} sets \`display\` outside [open] — the ` +
          `closed dialog stays in the layout and swallows pointer events. Scope it to [open].`
      );
    }
  }
}

/* ------------------- 6. a class that quietly disables `hidden` ------------- */

/**
 * `hidden` is the DOM's own way of saying "not here", and it is what the
 * JavaScript in this system uses: `element.hidden = true`, never a class. It is
 * hidden by `:where([hidden]:not([hidden="until-found"]))` in `dds.base`.
 *
 * A class that sets `display` cancels that, and not because of specificity —
 * `dds.components` is a later layer than `dds.base`, and layer order is resolved
 * first, so the base rule loses however it is written. The element keeps its box.
 *
 * That is a silent failure of the worst kind, because the JavaScript is right,
 * the markup is right, and nothing logs. The one that was found in the wild:
 * `clearError()` empties the message text and then hides the paragraph, so what
 * stayed on screen was a lone error icon, in error red, under a field the user
 * had just corrected. It read as "still wrong" and was not.
 *
 * The fix is one rule per class — `.dds-thing[hidden] { display: none }` — not a
 * blanket rule in a late layer. `.dds-primary-nav` is why: above its container
 * threshold it deliberately *shows* a `hidden` nav, so that the menu does not
 * stay collapsed after a resize. A system-wide override would break it.
 *
 * A class is only reported when something actually hides it: an element in the
 * repo's HTML carrying both the class and the `hidden` attribute, or a variable
 * in the JavaScript that is assigned that class and later hidden.
 *
 * That evidence is the limit of the check, and it is worth stating plainly.
 * `.dds-button` has the same defect — the copy button removes itself with
 * `button.hidden = true` when there is no clipboard API — and this check cannot
 * see it, because the behaviour is registered on `[data-dds-copy]` and no page in
 * this repository uses that attribute, so there is no markup to read the class
 * from. A product's own markup is outside what any static check here can reach.
 * The check narrows the gap; it does not close it.
 */
{
  /** Classes with evidence that something hides them, and where that came from. */
  const hiddenClasses = new Map();

  function noteHidden(name, evidence) {
    if (!name.startsWith('dds-')) return;
    if (!hiddenClasses.has(name)) hiddenClasses.set(name, evidence);
  }

  const htmlFiles = [join(ROOT, 'index.html')];
  for (const entry of await readdir(join(ROOT, 'reference'), { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.html')) {
      htmlFiles.push(join(ROOT, 'reference', entry.name));
    }
  }

  /** Every opening tag in the repo's HTML, so attributes can be looked up. */
  const tags = [];
  for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8');
    for (const match of html.matchAll(/<[a-zA-Z][^>]*>/g)) {
      tags.push({ file, tag: match[0] });
    }
  }

  function classesOf(tag) {
    const attribute = tag.match(/\sclass\s*=\s*"([^"]*)"/);
    return attribute ? attribute[1].split(/\s+/).filter(Boolean) : [];
  }

  // `hidden` written on an element that also carries a DDS class.
  for (const { file, tag } of tags) {
    // `hidden` as an attribute of its own, not `aria-hidden` and not a value.
    if (!/\shidden(\s|>|=\s*"(?:hidden|)")/.test(tag)) continue;
    for (const name of classesOf(tag)) {
      noteHidden(name, `${relative(ROOT, file)} writes hidden on .${name}`);
    }
  }

  /** The DDS classes on every element carrying a given `data-` attribute. */
  function classesForAttribute(attribute) {
    const found = new Set();
    for (const { tag } of tags) {
      if (!new RegExp(`\\s${attribute}(\\s|=|>)`).test(tag)) continue;
      classesOf(tag).forEach((name) => found.add(name));
    }
    return found;
  }

  const jsFiles = [];
  async function collectJs(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await collectJs(path);
      else if (entry.name.endsWith('.js')) jsFiles.push(path);
    }
  }
  await collectJs(join(ROOT, 'dds/js'));

  for (const file of jsFiles) {
    const source = stripComments(await readFile(file, 'utf8'));

    // Which variables get hidden at all.
    const hides = new Set();
    for (const match of source.matchAll(/\b([A-Za-z_$][\w$]*)\.hidden\s*=[^=]/g)) {
      hides.add(match[1]);
    }
    for (const match of source.matchAll(
      /\b([A-Za-z_$][\w$]*)\.setAttribute\(\s*'hidden'/g
    )) {
      hides.add(match[1]);
    }
    if (hides.size === 0) continue;

    for (const variable of hides) {
      const evidence = `${relative(ROOT, file)} hides \`${variable}\``;
      const escaped = variable.replace(/\$/g, '\\$');

      // Built here: `x.className = 'dds-thing'`, or `x.classList.add('dds-thing')`.
      const assigned = new RegExp(
        `\\b${escaped}\\.(?:className\\s*=|setAttribute\\(\\s*'class'\\s*,|classList\\.add\\()\\s*'([^']+)'`,
        'g'
      );
      for (const match of source.matchAll(assigned)) {
        match[1].split(/\s+/).forEach((name) => noteHidden(name, evidence));
      }

      // Found here: `var x = root.querySelector('.dds-thing')`, `closest(...)`.
      const bound = new RegExp(`\\b${escaped}\\s*=\\s*([^;]+);`, 'g');
      for (const match of source.matchAll(bound)) {
        /* Only the value, never the test that chose it. `var element = field
           .closest('.dds-field, .dds-choice') ? … : null` says nothing about
           `.dds-field` being hidden — it is the question, not the answer, and
           reading it as evidence reported two classes that are never hidden. */
        const branch = match[1].split(/\?(?!\.)/);
        const value = branch.length > 1 ? branch.slice(1).join('?') : match[1];

        for (const selector of value.matchAll(/\.(dds-[\w-]+)/g)) {
          noteHidden(selector[1], evidence);
        }
        for (const selector of match[1].matchAll(/\[(data-dds-[\w-]+)[\]=]/g)) {
          classesForAttribute(selector[1]).forEach((name) => noteHidden(name, evidence));
        }
      }

      // Handed in here: the root a behaviour is registered on, matched by
      // selector, so the class it carries is only knowable from the markup.
      const registered = new RegExp(
        `register\\(\\s*'[^']*'\\s*,\\s*'([^']+)'\\s*,\\s*function\\s*\\(\\s*${escaped}\\b`,
        'g'
      );
      for (const match of source.matchAll(registered)) {
        for (const selector of match[1].matchAll(/\.(dds-[\w-]+)/g)) {
          noteHidden(selector[1], evidence);
        }
        for (const selector of match[1].matchAll(/\[(data-dds-[\w-]+)[\]=]/g)) {
          classesForAttribute(selector[1]).forEach((name) => noteHidden(name, evidence));
        }
      }
    }
  }

  /** Where a class takes a `display` of its own, and where it guards `hidden`. */
  const displays = new Map();
  const guards = new Set();

  for (const [file, css] of stripped) {
    for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const [, selector, body] = match;
      if (!/(^|[;\s])display\s*:/.test(body)) continue;
      const hides = /display\s*:\s*none/.test(body);

      for (const part of selector.split(',')) {
        const trimmed = part.trim();

        const guard = trimmed.match(/^\.(dds-[\w-]+)\[hidden\]$/);
        if (guard && hides) {
          guards.add(guard[1]);
          continue;
        }

        // Only a rule whose whole subject is the class itself: a descendant or a
        // state variant does not decide whether the element has a box.
        const own = trimmed.match(/^\.(dds-[\w-]+)$/);
        if (own && !hides && !displays.has(own[1])) {
          displays.set(own[1], { file, line: lineOf(css, match.index) });
        }
      }
    }
  }

  for (const [name, evidence] of hiddenClasses) {
    if (guards.has(name)) continue;
    const declaration = displays.get(name);
    if (!declaration) continue;

    report(
      declaration.file,
      declaration.line,
      'hidden-defeated-by-display',
      `.${name} sets \`display\`, which beats the base sheet's [hidden] rule — a later ` +
        `layer wins whatever the specificity. ${evidence}, and the element stays in the ` +
        `layout. Add .${name}[hidden] { display: none }.`
    );
  }
}

/* ------------------------------------------------------ 7. container queries */

const containerNames = new Set();
for (const css of stripped.values()) {
  for (const match of css.matchAll(/container-name\s*:\s*([^;]+);/g)) {
    match[1]
      .split(/\s+/)
      .map((name) => name.trim())
      .filter(Boolean)
      .forEach((name) => containerNames.add(name));
  }
  // The shorthand also establishes a name: `container: <name> / <type>`.
  for (const match of css.matchAll(/[^-]container\s*:\s*([\w-]+)\s*\//g)) {
    containerNames.add(match[1]);
  }
}

for (const [file, css] of stripped) {
  for (const match of css.matchAll(/@container\s+([\w-]+)\s*\(/g)) {
    const name = match[1];
    // An unnamed `@container (width > x)` targets the nearest container and is
    // valid; only a *named* query can point at a name that does not exist.
    if (!containerNames.has(name)) {
      report(
        file,
        lineOf(css, match.index),
        'orphan-container-query',
        `@container ${name} has no matching container-name — the rule never matches, so the component stays in its base form at every width`
      );
    }
  }
}

/* ------------------------------------------------------------------ report */

const byRule = new Map();
for (const finding of findings) {
  if (!byRule.has(finding.rule)) byRule.set(finding.rule, []);
  byRule.get(finding.rule).push(finding);
}

for (const [rule, list] of byRule) {
  console.log(`\n${rule} (${list.length}):`);
  for (const finding of list) {
    console.log(`  ${finding.file}:${finding.line}`);
    console.log(`    ${finding.message}`);
  }
}

console.log(
  `\n${files.length} stylesheets checked, ${defined.size} custom properties defined ` +
    `(${primitives.size} primitive), ${containerNames.size} container names. ` +
    (findings.length === 0 ? 'No silent failures found.' : `${findings.length} FINDINGS.`)
);

process.exit(findings.length === 0 ? 0 : 1);
