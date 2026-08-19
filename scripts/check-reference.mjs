#!/usr/bin/env node
/**
 * Dessau — verify the reference against the implementation.
 *
 *   node scripts/check-reference.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this gate exists
 * -----------------------------------------------------------------------------
 *
 * `reference/` is what a person opens to see what the system actually does. It is
 * read as authoritative — which means a reference that has drifted is worse than
 * no reference at all, because a missing page prompts a look at the CSS while a
 * wrong page is simply believed.
 *
 * Drift here is quiet by nature. A component gains a variant and the page still
 * shows the old three. A token is renamed and the swatch keeps its stale name as
 * a label. A demo's script path changes and the demo silently stops enhancing —
 * it still renders, it just does nothing, and it looks fine in a screenshot.
 *
 * None of that produces an error anywhere. So it is checked:
 *
 *   1. every indexed component is RENDERED on its reference page — not merely
 *      mentioned in prose or shown in a code sample;
 *   2. every `reference` anchor in the index resolves to a real `id`;
 *   3. every `--dds-*` name printed in the reference exists in the CSS;
 *   4. every stylesheet, script and asset a reference page loads exists;
 *   5. the named breakpoints in the CSS are the ones the foundations page shows.
 *
 * Check 1 is the one that was actually needed. An earlier version of this
 * verified that the reference *page* existed, which every entry passed while
 * twelve components had no demo anywhere in the repository.
 *
 * WHAT PASSING HERE DOES NOT MEAN. This checks `agent/index.json`'s catalogue
 * against the pages — every indexed component and pattern. It has nothing to
 * say about a reference page that documents something outside that catalogue,
 * because there is nothing in the index to check it against: `writing.html`
 * (the UX-writing standard) and `architecture.html` (the layer model and
 * consumption story) are neither a component nor a pattern, so a derived
 * system that repoints every other page and leaves either of those aimed at
 * Dessau's own copy still gets a clean run here — confirmed twice, on two
 * separate pages, in the same walk. "This check passes" verifies the indexed
 * catalogue; "the reference is done" is a claim about the whole directory,
 * and the first is not proof of the second (#72, derive-a-standalone-
 * system.md step 6).
 *
 * Zero dependencies, Node stdlib only. Exit code 1 on any finding.
 * @catches A documented component with no rendered example, an anchor or in-page
 *   link that does not resolve, a token name no stylesheet declares, an asset
 *   that does not load, unbalanced markup, a forced `data-theme` with no rule to
 *   match, a flex component missing its `-body` wrapper, a `<video>` or
 *   `<audio>` with no transcript beside it, and a stale generated block.
 *
 */

import { readFile, readdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve as resolvePath } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REFERENCE_DIR = join(ROOT, 'reference');

const findings = [];
const report = (message) => findings.push(message);

async function exists(absolute) {
  try {
    await access(absolute);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------- inputs */

const index = JSON.parse(await readFile(join(ROOT, 'agent/index.json'), 'utf8'));

const pageNames = (await readdir(REFERENCE_DIR)).filter((n) => n.endsWith('.html'));

/** Each page in two forms: the full source, and the source minus code samples. */
const pages = new Map();
for (const name of pageNames) {
  const source = await readFile(join(REFERENCE_DIR, name), 'utf8');
  pages.set(`reference/${name}`, {
    source,
    /**
     * Code samples are shown escaped (`&lt;div class="dds-card"&gt;`), which still
     * contains `class="dds-card"` as literal text. A demo has to be real markup,
     * so samples and comments come out before looking for one.
     */
    rendered: source
      .replace(/<pre[\s\S]*?<\/pre>/g, '')
      .replace(/<code[\s\S]*?<\/code>/g, '')
      .replace(/<!--[\s\S]*?-->/g, ''),
  });
}

const CSS_DIR = join(ROOT, 'dds/css');
let allCss = '';
for (const name of (await readdir(CSS_DIR)).filter((n) => n.endsWith('.css'))) {
  allCss += await readFile(join(CSS_DIR, name), 'utf8');
}
const cssCode = allCss.replace(/\/\*[\s\S]*?\*\//g, '');

/** Every custom property the CSS actually declares. */
const declaredProperties = new Set(
  [...cssCode.matchAll(/(--dds-[\w-]+)\s*:/g)].map((m) => m[1])
);

/**
 * Match a class name exactly, as one entry in a `class` attribute.
 *
 * `\b` is not enough. A hyphen is a non-word character, so `\bdds-banner\b`
 * matches inside `dds-banner-info` — which made the variant count as the root, and
 * made a page showing four variants look like it showed thirteen roots. Every
 * component here has hyphenated variants, so this was wrong for all of them.
 */
function classPattern(name, flags = '') {
  return new RegExp(`class="[^"]*(?<![\\w-])${name}(?![\\w-])`, flags);
}

/* ------------------------------------------- 1. every component is rendered */

/**
 * A component counts as demonstrated when its root class appears in a `class`
 * attribute in real markup on the page the index points at.
 *
 * The root class specifically. A page that shows only `.dds-button-primary` has
 * not shown what a button is, and "some class from the family appears somewhere"
 * is the weak check that let the gap open in the first place.
 */
const entries = [
  ...index.components.map((e) => ({ ...e, kind: 'component' })),
  ...index.patterns.map((e) => ({ ...e, kind: 'pattern' })),
];

/**
 * Some components have no markup to demonstrate, because they do not exist until
 * something happens. A toast is built when `DDS.toast()` is called; a lightbox
 * dialog is built when its trigger is activated. Their root class can never appear
 * in a static page, and demanding it would make the check unsatisfiable — at which
 * point the honest fix is an exception list and the dishonest one is fake markup
 * that looks like the component but is not it.
 *
 * So which components those are is read from the JavaScript rather than listed: a
 * class the JS assigns to an element it created is a class no author writes. For
 * those, what has to be demonstrated is the TRIGGER — the attribute or the call
 * that brings the component into existence — because that is the part someone
 * copying the reference actually needs.
 */
let allJs = '';
for (const path of await readdir(join(ROOT, 'dds/js'), { recursive: true })) {
  if (!path.endsWith('.js')) continue;
  allJs += await readFile(join(ROOT, 'dds/js', path), 'utf8');
}

const jsCreatedClasses = new Set([
  ...[...allJs.matchAll(/className\s*=\s*['"]([^'"]+)['"]/g)]
    .flatMap((m) => m[1].split(/\s+/)),
  ...[...allJs.matchAll(/setAttribute\(\s*['"]class['"]\s*,\s*['"]([^'"]+)['"]/g)]
    .flatMap((m) => m[1].split(/\s+/)),
]);

for (const entry of entries) {
  const root = (entry.classes || [])[0];
  if (!root || !entry.reference) continue;

  const [pagePath, anchor] = entry.reference.split('#');
  const page = pages.get(pagePath);

  if (!page) {
    report(`${entry.kind} "${entry.name}": reference page ${pagePath} does not exist`);
    continue;
  }

  const bare = root.replace(/^\./, '');
  const inAttribute = classPattern(bare);

  /* --- a component the JavaScript builds is demonstrated by its trigger --- */

  if (jsCreatedClasses.has(bare) && !inAttribute.test(page.rendered)) {
    const hooks = entry.hooks || [];
    const triggered =
      hooks.some((hook) => page.source.includes(hook)) ||
      // A component with no attribute hook is summoned by a call.
      new RegExp(`DDS\\.${entry.name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())}\\s*\\(`)
        .test(page.source);

    if (!triggered) {
      report(
        `${entry.kind} "${entry.name}": ${root} is built by the JavaScript, so it ` +
          `cannot appear in markup — but ${pagePath} has nothing that triggers it ` +
          `either (expected one of: ${hooks.join(', ') || 'a DDS.* call'})`
      );
    }

    // Its anchor still has to resolve.
    if (anchor && !new RegExp(`id="${anchor}"`).test(page.source)) {
      report(
        `${entry.kind} "${entry.name}": reference anchor #${anchor} does not exist ` +
          `on ${pagePath} — the link lands at the top of the page`
      );
    }
    continue;
  }

  if (!inAttribute.test(page.rendered)) {
    // Distinguish the three ways this fails — they need different fixes.
    const onAnotherPage = [...pages.entries()].find(
      ([path, other]) => path !== pagePath && inAttribute.test(other.rendered)
    );
    const onlyInASample = inAttribute.test(page.source);

    if (onAnotherPage) {
      report(
        `${entry.kind} "${entry.name}": index points at ${pagePath}, but ${root} is ` +
          `only rendered on ${onAnotherPage[0]} — fix the index`
      );
    } else if (onlyInASample) {
      report(
        `${entry.kind} "${entry.name}": ${root} appears on ${pagePath} only in a code ` +
          `sample, never as a live example`
      );
    } else {
      report(
        `${entry.kind} "${entry.name}": ${root} is not demonstrated anywhere in ` +
          `reference/ — it is documented but has never been seen to work`
      );
    }
  }

  /* ------------------------------------------------- 2. the anchor resolves */

  if (anchor && !new RegExp(`id="${anchor}"`).test(page.source)) {
    report(
      `${entry.kind} "${entry.name}": reference anchor #${anchor} does not exist on ` +
        `${pagePath} — the link lands at the top of the page`
    );
  }
}

/* -------------------------------- 3. every token named in the reference exists */

/**
 * The reference prints token names as labels next to swatches and values. A
 * renamed token leaves the old name sitting there looking correct, which is the
 * most believable kind of wrong.
 */
for (const [path, page] of pages) {
  const named = new Set([...page.source.matchAll(/--dds-[\w-]+/g)].map((m) => m[0]));

  for (const name of named) {
    if (declaredProperties.has(name)) continue;
    // Prefixes used to build a name by concatenation are not claims about a token.
    if (name.endsWith('-')) continue;
    report(`${path}: names ${name}, which no stylesheet declares`);
  }
}

/* ----------------------------------------- 4. every asset a page loads exists */

/**
 * A stylesheet or script with a wrong path fails silently: the page still renders,
 * it just renders unstyled or unenhanced. In a reference, that reads as "this
 * component looks like this" rather than as an error.
 */
for (const [path, page] of pages) {
  const references = [
    ...[...page.source.matchAll(/<link[^>]+href="([^"]+)"/g)].map((m) => m[1]),
    ...[...page.source.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]),
    ...[...page.source.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]),
  ];

  for (const relative of references) {
    if (/^(https?:|data:|#|mailto:)/.test(relative)) continue;

    const absolute = resolvePath(REFERENCE_DIR, relative.split(/[?#]/)[0]);
    if (!(await exists(absolute))) {
      report(`${path}: loads ${relative}, which does not exist`);
    }
  }
}

/* ------------------------------------------- 5. breakpoints match the CSS */

/**
 * The four named breakpoints are documentation — CSS cannot use a custom property
 * in a query condition, so nothing in the browser enforces that the page showing
 * them shows the current ones.
 *
 * The page answers that by rendering the values live, reading them back through
 * `getComputedStyle` on every resize. So what is checked here is that each name is
 * in the list the page renders from — not that its value is written on the page.
 *
 * An earlier version did check for the literal, and it was quietly wrong: `64rem`
 * passed only because the generated threshold table happened to contain a 64rem
 * row, while `80rem` failed for a page that was entirely correct. A check that
 * passes for the wrong reason is the same defect it is meant to catch.
 */
const namedBreakpoints = [
  ...cssCode.matchAll(/(--dds-breakpoint-[\w-]+)\s*:\s*([^;]+);/g),
].map((m) => ({ name: m[1], value: m[2].trim() }));

const foundations = pages.get('reference/foundations.html');

if (!namedBreakpoints.length) {
  report('no --dds-breakpoint-* values are declared in the CSS');
} else if (!foundations) {
  report('reference/foundations.html is missing, so breakpoints are undocumented');
} else {
  const rendered = foundations.source.match(/data-ref-breakpoints='([^']+)'/);

  if (!rendered) {
    report(
      'reference/foundations.html has no [data-ref-breakpoints] element, so the ' +
        'breakpoints are not rendered from the stylesheet and can drift from it'
    );
  } else {
    for (const { name } of namedBreakpoints) {
      if (!rendered[1].includes(name)) {
        report(
          `reference/foundations.html does not render ${name} — it is declared in ` +
            `the CSS but the foundations page never shows it`
        );
      }
    }
  }
}

/* --------------------- 5a. the page shell is separated from the intro */

/**
 * Every page with a side navigation puts a divider between the introduction and the
 * two-column layout. It is not decoration: without it the heading of the first
 * section sits directly against the intro paragraph, and the page reads as one
 * cramped block.
 *
 * That spacing was accidental for a long time — six pages happened to have a divider
 * and the two that did not looked wrong, which is how it was noticed. Whitespace that
 * depends on an unrelated element happening to be present is whitespace that will
 * disappear on the next page someone writes.
 */
for (const [path, page] of pages) {
  if (!page.source.includes('class="ref-layout"')) continue;

  const beforeLayout = page.source.slice(0, page.source.indexOf('class="ref-layout"'));

  // Anything within the last stretch of markup counts as adjacent.
  if (!/dds-divider[^"]*dds-mbs-2xl/.test(beforeLayout.slice(-400))) {
    report(
      `${path}: no divider between the introduction and .ref-layout — the first ` +
        `section heading sits against the intro text`
    );
  }
}

/* ------------------------ 5b. the root redirect points somewhere real */

/**
 * `index.html` at the repository root is a zero-delay meta refresh into the
 * reference. Its target is a plain string in an attribute, so a renamed or moved
 * landing page leaves a redirect that resolves to nothing — and the failure is a
 * blank page or a 404 at the single most likely entry point, reached by anyone who
 * opens the repository in a browser for the first time.
 */
{
  const rootIndex = join(ROOT, 'index.html');

  if (await exists(rootIndex)) {
    const source = await readFile(rootIndex, 'utf8');
    const refresh = source.match(/http-equiv="refresh"\s+content="(\d+);\s*url=([^"]+)"/i);

    if (!refresh) {
      report('index.html has no meta refresh, so opening the repository root does nothing');
    } else {
      const [, delay, target] = refresh;

      if (Number(delay) !== 0) {
        report(
          `index.html redirects after ${delay}s. A DELAYED redirect fails WCAG 2.2.1 ` +
            `Timing Adjustable — the reader is moved off the page with no way to stop ` +
            `it. Only a zero-delay redirect is exempt.`
        );
      }

      if (!(await exists(join(ROOT, target.split(/[?#]/)[0])))) {
        report(`index.html redirects to ${target}, which does not exist`);
      }

      // The visible fallback matters when the refresh is blocked.
      if (!new RegExp(`href="${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`).test(source)) {
        report(
          `index.html redirects to ${target} but offers no link to it — if the refresh ` +
            `is blocked, the page is a dead end`
        );
      }
    }
  }
}

/* -------------------------------- 6. the markup nests correctly */

/**
 * An unbalanced tag does not produce an error. The browser silently repairs the
 * tree — usually by closing an element early — and the page renders with a
 * component nested one level shallower or deeper than intended. Layout goes wrong
 * somewhere that has nothing obviously to do with the missing tag, and a container
 * query stops matching because its container is no longer an ancestor.
 *
 * That has already cost time here: adding a wrapper around the filtering pattern
 * left the closers one short, and the symptom was a sidebar that would not go
 * side-by-side.
 */
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr',
  // SVG children written without a closing tag.
  'use', 'path', 'polyline', 'polygon', 'line', 'circle', 'ellipse', 'rect', 'stop',
]);

for (const [path, page] of pages) {
  const markup = page.source
    .replace(/<!--[\s\S]*?-->/g, '')
    // Script contents can contain `<` in comparisons and template markup.
    .replace(/<script[\s\S]*?<\/script>/g, '');

  const open = [];
  let line = 1;

  for (const match of markup.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>|\n/g)) {
    if (match[0] === '\n') {
      line++;
      continue;
    }

    const [, closing, rawTag, , selfClosing] = match;
    const tag = rawTag.toLowerCase();

    if (VOID_ELEMENTS.has(tag) || selfClosing) continue;

    if (!closing) {
      open.push({ tag, line });
      continue;
    }

    const innermost = open.pop();

    if (!innermost) {
      report(`${path}:${line}: </${tag}> closes nothing that is open`);
    } else if (innermost.tag !== tag) {
      report(
        `${path}:${line}: </${tag}> closes <${innermost.tag}> from line ` +
          `${innermost.line} — the tree is repaired silently and the nesting ends ` +
          `up different from the source`
      );
    }
  }

  for (const unclosed of open) {
    report(`${path}:${unclosed.line}: <${unclosed.tag}> is never closed`);
  }
}

/* ------------------------- 7. every in-page link resolves */

/**
 * An `href="#something"` pointing at an id that does not exist does nothing at all.
 * The browser does not navigate, does not scroll and does not report anything — the
 * link simply looks like a link and is inert.
 *
 * In a reference that is worse than elsewhere: an error summary whose entries link
 * to fields is *demonstrating* that they link to fields. One shipped here pointing
 * at `#v-terms`, a field that was never in the form.
 */
for (const [path, page] of pages) {
  const ids = new Set([...page.source.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

  const targets = new Set(
    [...page.source.matchAll(/href="#([^"]+)"/g)].map((m) => m[1])
  );

  for (const target of targets) {
    // A bare `#` is a deliberate no-op placeholder; an icon reference is not a link.
    if (!target || target.startsWith('dds-icon-')) continue;
    if (ids.has(target)) continue;
    report(
      `${path}: links to #${target}, which is not an id on the page — the link is ` +
        `inert and reports nothing when clicked`
    );
  }
}

/* --------------------- 8. every forced theme has a rule to match */

/**
 * `data-theme` on a subtree only does something if a rule matches that exact
 * value. Custom properties inherit, so a subtree marked with a theme that has no
 * rule keeps whatever the page root set — it renders perfectly, in the wrong theme,
 * with a label next to it claiming otherwise.
 *
 * That is not hypothetical. The side-by-side theme comparison on the foundations
 * page showed two dark panels in dark mode, one of them titled "Light", because
 * only `[data-theme="dark"]` had a rule and `[data-theme="light"]` fell through to
 * the inherited dark values.
 */
const themeRules = new Set(
  [...cssCode.matchAll(/\[data-theme="([^"]+)"\]/g)].map((m) => m[1])
);
// `:root` carries the default theme, so it needs no attribute rule of its own.
const rootTheme = 'light';

for (const [path, page] of pages) {
  const used = new Set(
    [...page.source.matchAll(/\sdata-theme="([^"]+)"/g)].map((m) => m[1])
  );

  for (const theme of used) {
    if (themeRules.has(theme)) continue;
    if (theme === rootTheme) {
      report(
        `${path}: forces data-theme="${theme}" on a subtree, but the CSS only ` +
          `declares those values on :root — the subtree inherits the page's theme ` +
          `instead, and looks correct while being wrong`
      );
    } else {
      report(`${path}: uses data-theme="${theme}", which no rule matches`);
    }
  }
}

/* ------------------- 9a. every player has a transcript beside it */

/**
 * WCAG 2.2 1.2.1 requires an alternative for audio-only and video-only content,
 * and it is the single most commonly skipped requirement in the standard —
 * because the work is producing the transcript, not writing the markup. A rule
 * whose cost is entirely outside the code is a rule that needs a gate.
 *
 * The transcript is looked for as a `[data-dds-transcript]` sibling within the
 * same specimen or figure, not anywhere on the page: "there is a transcript
 * somewhere" is exactly the claim that stops being true when a second player is
 * added.
 *
 * A `<video>` carrying only `<track kind="captions">` still fails. Captions
 * serve somebody watching; a transcript serves somebody reading, searching or
 * skimming, and a search engine only ever reads the second.
 */
for (const [path, page] of pages) {
  for (const [element, tag] of page.source.matchAll(/<(video|audio)\b[^>]*>/g)) {
    const at = page.source.indexOf(element);

    /* The enclosing block: a specimen, a figure, or failing both, a generous
       window after the element. Deliberately not the whole page. */
    const before = page.source.slice(Math.max(0, at - 2000), at);
    const blockStart =
      Math.max(
        before.lastIndexOf('<div class="ref-specimen'),
        before.lastIndexOf('<figure')
      ) + Math.max(0, at - 2000);

    const scope = page.source.slice(
      blockStart > 0 ? blockStart : at,
      at + 3000
    );

    if (scope.includes('data-dds-transcript')) continue;

    report(
      `${path}: <${tag}> with no [data-dds-transcript] beside it — WCAG 2.2 ` +
        `1.2.1 requires an alternative for audio-only and video-only content, ` +
        `and it is required rather than recommended (agent/components.md)`
    );
  }
}

/* -------------------------- 10. every select has its arrow wrapper */

/**
 * `.dds-select` sets `appearance: none`, which removes the browser's arrow. The
 * replacement is a sprite chevron in the markup, inside `.dds-select-wrap` — so a
 * select written without the wrapper has no arrow at all and looks like a plain
 * text input that mysteriously opens a menu.
 *
 * The wrapper is the price of being able to place the arrow: the native one is
 * painted flush against the edge and cannot be moved, and a background-image
 * chevron cannot take `currentColor`, so it would not follow the theme.
 */
for (const [path, page] of pages) {
  const selects = [...page.rendered.matchAll(classPattern('dds-select', 'g'))];
  if (!selects.length) continue;

  const wraps = [...page.rendered.matchAll(classPattern('dds-select-wrap', 'g'))];
  const arrows = [...page.rendered.matchAll(classPattern('dds-select-arrow', 'g'))];

  if (wraps.length < selects.length || arrows.length < selects.length) {
    report(
      `${path}: ${selects.length} .dds-select but ${wraps.length} .dds-select-wrap ` +
        `and ${arrows.length} .dds-select-arrow — a select without the wrapper has ` +
        `no arrow, because appearance:none removed the browser's own`
    );
  }
}

/* ------------------- 9. flex components have their content wrapper */

/**
 * A flex container lays out boxes, not text. Every child becomes a flex item —
 * including each inline element and each run of text between them — so a sentence
 * with three `<code>` spans in a flex container comes out as seven items with the
 * container's `gap` between all of them: the words strewn across ragged columns
 * with the inline bits boxed out on their own.
 *
 * It reads as a font or a wrapping problem, never as a layout one, which is why it
 * survives review. `.ref-note` shipped like that for a long time.
 *
 * Components built as flex rows therefore define a `-body` child to hold the text,
 * and omitting it is silent. Which components need one is read from the CSS rather
 * than listed here, so a new flex component is covered the day it is written.
 */
const flexRoots = [];
for (const match of cssCode.matchAll(/\.(dds-[\w-]+)\s*\{([^}]*)\}/g)) {
  const [, className, body] = match;
  if (!/display\s*:\s*flex/.test(body)) continue;
  if (!/\bgap\s*:/.test(body)) continue;
  // Only if the component actually offers a text wrapper.
  if (!declaredClass(`${className}-body`)) continue;
  flexRoots.push(className);
}

function declaredClass(name) {
  return new RegExp(`\\.${name}\\s*[,{:>\\s]`).test(cssCode);
}

for (const [path, page] of pages) {
  for (const root of flexRoots) {
    const roots = [...page.rendered.matchAll(classPattern(root, 'g'))];
    if (!roots.length) continue;

    const bodies = [
      ...page.rendered.matchAll(classPattern(root + '-body', 'g')),
    ];

    if (bodies.length < roots.length) {
      report(
        `${path}: ${roots.length} .${root} but only ${bodies.length} .${root}-body — ` +
          `a .${root} without its body wrapper turns its own sentence into flex items`
      );
    }
  }
}

/* -------------------------------- 14. no id appears twice on a page */

/**
 * A duplicate `id` is invalid HTML, and the way it fails is worse than invalid:
 * everything that resolves an id takes the FIRST match and silently ignores the
 * rest. `aria-labelledby` names the wrong element, `href="#x"` jumps to the
 * wrong place, `<label for>` labels nothing.
 *
 * Written after splitting the components page into one section per component
 * created `<section id="upload">` on a page that already had
 * `<input id="upload">`. Nothing here noticed. Nine browser tests fell over it
 * instead — they were looking for the input and found a section — which is a
 * slow and confusing way to learn about a two-character mistake.
 */
for (const [path, page] of pages) {
  const seen = new Map();

  for (const match of page.source.matchAll(/\sid="([^"]+)"/g)) {
    const id = match[1];
    const line = page.source.slice(0, match.index).split('\n').length;
    if (seen.has(id)) {
      report(
        `${path}:${line}: id="${id}" is already used on line ${seen.get(id)} — ` +
          `everything that resolves an id takes the first match and ignores this one`
      );
    } else {
      seen.set(id, line);
    }
  }
}

/* --------------- 13. width-dependent behaviour can be seen without a phone */

/**
 * A component that changes shape by width gets a width switcher around its
 * specimen and a note saying what it does.
 *
 * `agent/responsive.md` calls the switcher the most useful documentation tool in
 * the system, and gives the reason: without it nobody looks at the narrow state —
 * not the person building the component, not the person reviewing it, and not a
 * tool. On the day this check was written, `data-ref-bp` appeared six times in a
 * reference holding 229 specimens.
 *
 * The two kinds of width-dependence are checked differently, and the difference
 * is the point:
 *
 *   - **A container query** reads the stage the switcher narrows, so the switcher
 *     demonstrates it. Both are required.
 *   - **A viewport media query** reads the window, which the switcher does not
 *     change — the buttons would visibly do nothing. Only the note is required,
 *     and it is the note that should say so.
 *
 * Read from the stylesheets rather than from a list, so a component that gains a
 * query is caught the same day rather than when somebody remembers.
 */
const queryClasses = { container: new Set(), media: new Set() };

for (const match of cssCode.matchAll(/@(container|media)([^{]*)\{/g)) {
  const [, kind, condition] = match;
  if (!/inline-size|min-width|max-width|width\s*[<>]/.test(condition)) continue;

  // Walk to the matching brace: the block may contain nested rules.
  let depth = 1;
  let i = match.index + match[0].length;
  while (depth > 0 && i < cssCode.length) {
    if (cssCode[i] === '{') depth += 1;
    else if (cssCode[i] === '}') depth -= 1;
    i += 1;
  }

  for (const rule of cssCode.slice(match.index + match[0].length, i).matchAll(/\.(dds-[\w-]+)/g)) {
    queryClasses[kind].add(`.${rule[1]}`);
  }
}

/** The markup of one section of a reference page, by anchor. */
function sectionSource(pagePath, anchor) {
  const page = pages.get(pagePath);
  if (!page) return null;
  const at = page.source.indexOf(`id="${anchor}"`);
  if (at === -1) return null;
  const end = page.source.indexOf('</section>', at);
  return page.source.slice(at, end === -1 ? undefined : end);
}

for (const entry of entries) {
  const classes = entry.classes || [];
  const byContainer = classes.some((name) => queryClasses.container.has(name));
  const byViewport = classes.some((name) => queryClasses.media.has(name));
  if (!byContainer && !byViewport) continue;

  const [pagePath, anchor] = entry.reference.split('#');
  const section = sectionSource(pagePath, anchor);
  if (!section) continue; // the anchor check above already reports this

  if (!/\bref-note\b/.test(section)) {
    report(
      `${entry.kind} "${entry.name}": changes shape by width and its section has no ` +
        `.ref-note saying what it does — the narrow state is then documented nowhere`
    );
  }

  if (byContainer && !/\bdata-ref-bp\b/.test(section)) {
    report(
      `${entry.kind} "${entry.name}": responds to its container but its specimen has ` +
        `no width switcher (data-ref-bp), so nobody can see the narrow state without ` +
        `resizing a window`
    );
  }
}

/* ------------------- 12. every visible table is in a real scroll region */

/**
 * A table is the one component that routinely cannot become narrower than the
 * screen, so `.dds-table-wrap` is documented as not optional: `overflow-x`, a tab
 * stop, and a name, or the columns past the edge are unreachable without a mouse
 * and the table sets the width of the page for everything else.
 *
 * "Not optional" was enforced by nothing. On the day this check was written,
 * twelve of the fourteen tables in this reference had no wrapper — and eight of
 * those were inside `<div class="dds-scroll">`, a class that is declared in no
 * stylesheet at all. That is the worst version of the failure: the markup looks
 * like somebody thought about it, reviews as correct, and does nothing whatsoever.
 * `check-css.mjs` could not see it either, because it reads stylesheets and the
 * mistake was in the markup.
 *
 * Visually hidden tables are exempt and must stay exempt: the data table behind a
 * chart is never rendered, never scrolled, and giving it a visible frame and a tab
 * stop would be a defect rather than a fix.
 */
const TABLE_WRAP_CLASS = 'dds-table-wrap';

for (const [path, page] of pages) {
  const source = page.source;

  for (const match of source.matchAll(/<table\b[^>]*>/g)) {
    const openTag = match[0];
    const line = source.slice(0, match.index).split('\n').length;

    // The screen-reader-only table behind a chart or a figure.
    if (/\bdds-(sr-only|visually-hidden)\b/.test(openTag)) continue;

    /* The nearest preceding element start tag. A table's scroll region is its
       PARENT — an ancestor further up would scroll the surrounding prose with it,
       which is the layout bug rather than the fix. */
    const before = source.slice(0, match.index);
    const parentTag = before.match(/<(\w+)\b[^>]*>\s*$/);

    if (!parentTag || !parentTag[0].includes(TABLE_WRAP_CLASS)) {
      report(
        `${path}:${line}: <table> is not directly inside .${TABLE_WRAP_CLASS} — ` +
          `it will widen the page instead of scrolling, and the columns past the ` +
          `edge cannot be reached without a mouse`
      );
      continue;
    }

    const wrapper = parentTag[0];
    if (!/\btabindex="0"/.test(wrapper)) {
      report(
        `${path}:${line}: the .${TABLE_WRAP_CLASS} around this table has no ` +
          `tabindex="0" — a scroll region without a tab stop cannot be scrolled ` +
          `by keyboard (WCAG 2.1.1)`
      );
    }

    const named = /\baria-labelledby="([^"]+)"/.exec(wrapper) || /\baria-label="/.exec(wrapper);
    if (/\brole="region"/.test(wrapper) && !named) {
      report(
        `${path}:${line}: the .${TABLE_WRAP_CLASS} around this table claims ` +
          `role="region" with no accessible name — an unnamed region is dropped ` +
          `by screen readers, so the tab stop is spent on nothing`
      );
    }

    if (named && named[1]) {
      const ids = new Set([...source.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
      if (!ids.has(named[1])) {
        report(
          `${path}:${line}: the table's region is named by #${named[1]}, which is ` +
            `not an id on the page — the name resolves to nothing`
        );
      }
    }
  }
}

/* --------------------------- 11. the generated blocks are not stale */

/**
 * Two blocks in the reference are generated: the icon sprite and the breakpoint
 * threshold table. A stale generated block is the most believable kind of wrong,
 * because it was correct when it was written.
 */
for (const [marker, script] of [
  ['DDS_ICON_SPRITE', 'scripts/sync-icons.mjs'],
  ['DDS_BREAKPOINT_TABLE', 'scripts/sync-breakpoints.mjs'],
]) {
  const target = marker === 'DDS_ICON_SPRITE' ? [...pages.keys()] : ['reference/foundations.html'];

  for (const path of target) {
    const page = pages.get(path);
    if (!page) continue;
    const hasStart = page.source.includes(`${marker}:START`);
    const hasEnd = page.source.includes(`${marker}:END`);
    if (hasStart !== hasEnd) {
      report(`${path}: ${marker} has only one of its two markers — run ${script}`);
    }
  }
}

/* -------------------------------------------------------------------- report */

if (findings.length) {
  console.log('');
  for (const finding of findings) console.log(`  ${finding}`);
}

console.log(
  `\n${entries.length} entries checked against ${pages.size} reference pages, ` +
    `${declaredProperties.size} declared properties, ` +
    `${namedBreakpoints.length} named breakpoints. ` +
    (findings.length === 0
      ? 'Reference matches the implementation.'
      : `${findings.length} FINDING(S).`)
);

process.exit(findings.length === 0 ? 0 : 1);
