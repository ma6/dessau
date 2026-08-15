/**
 * Dessau — every page fits the screen it is on.
 *
 *   npx playwright test tests/viewport.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * `agent/responsive.md` states it plainly: no horizontal page scroll at 320px
 * (WCAG 1.4.10), with a wide data table inside a named scroll region as the one
 * legitimate exception. Nothing verified it.
 *
 * `check-css.mjs` reads stylesheets and cannot know what a browser did with
 * them. `check-reference.mjs` checks structure. Every other spec in this suite
 * runs at a desktop size, and the two that resize do it to test a navigation
 * disclosure. So the single class of defect that is invisible on the machine the
 * work is done on was also the one class nothing looked for — and it accumulated
 * until somebody opened the reference on a phone. A full-page capture came back
 * roughly three times the width of the screen.
 *
 * The cause was one grid track with no constraint (#79), the largest source was
 * tables with no scroll region (#75), and neither was findable from a stylesheet.
 * A page-level measurement is the only thing that catches this class at all.
 *
 * -----------------------------------------------------------------------------
 * Why it names the element
 * -----------------------------------------------------------------------------
 *
 * "The page is 812px too wide" is a true statement nobody can act on, and the
 * amplification is exactly what makes it hard: the element that sets the width
 * is usually nowhere near the section that looks wrong. So a failure reports the
 * outermost offending elements with their measurements, and skips anything
 * inside a scroll or clip container — a table that scrolls in its own region is
 * the documented exception, not a finding.
 *
 * 320px is also the 400% zoom case from WCAG 1.4.10: 1280px at 400% reflows to a
 * 320px viewport. Testing it here is testing both.
 *
 * @covers none — this is layout at a viewport size, not an enhancement
 *
 */

import { test, expect } from '@playwright/test';

/**
 * The narrowest supported width, two real phones, and a tablet in portrait.
 *
 * 320 is the WCAG floor and the zoom case. 390 and 412 are the two devices this
 * was first seen failing on. 834 is a tablet held upright — the width where the
 * reference is still in its phone shell, which is the case nobody looks at
 * because it is neither of the two shapes anyone designs for.
 */
const VIEWPORTS = [
  { name: '320 — the WCAG floor, and 400% zoom', width: 320, height: 640 },
  { name: '390 — a phone', width: 390, height: 844 },
  { name: '412 — a larger phone', width: 412, height: 915 },
  { name: '834 — a tablet in portrait', width: 834, height: 1112 },
];

const PAGES = [
  '/reference/index.html',
  '/reference/foundations.html',
  '/reference/components.html',
  '/reference/patterns.html',
  '/reference/navigation.html',
  '/reference/content.html',
  '/reference/writing.html',
  '/reference/architecture.html',
];

/**
 * Everything wider than the viewport, reported outermost-first.
 *
 * Runs in the page because it needs geometry for every element, and one round
 * trip per element would take longer than the rest of the suite together.
 */
const findOverflow = () => {
  const viewport = document.documentElement.clientWidth;
  const scrolls = (style) => /(auto|scroll|hidden|clip)/.test(style.overflowX);

  const offenders = [];
  /* What the two filters above took out. When the page overflows and the
     filters have left nothing to report, the cause is in here — and which
     filter hid it is the answer. */
  const skipped = [];

  for (const element of document.body.querySelectorAll('*')) {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    // A pixel of tolerance: subpixel layout routinely lands a hair over, and a
    // suite that fails on 0.4px is a suite that gets switched off.
    if (rect.right <= viewport + 1 && rect.left >= -1) continue;

    const style = getComputedStyle(element);
    // Off-screen by design: the visually-hidden recipe, and anything a
    // transform has parked outside the viewport on purpose.
    if (style.position === 'absolute' && rect.width <= 2) {
      skipped.push({ element, why: 'absolutely positioned and 1px wide' });
      continue;
    }

    // Inside something that contains its own overflow — a table's scroll region
    // is the documented exception, not a finding.
    let ancestor = element.parentElement;
    let contained = false;
    while (ancestor) {
      if (scrolls(getComputedStyle(ancestor))) {
        contained = true;
        break;
      }
      ancestor = ancestor.parentElement;
    }
    if (contained) {
      skipped.push({ element, why: 'inside something that scrolls or clips' });
      continue;
    }

    offenders.push(element);
  }

  // Outermost only. A wide table reports itself, not its forty cells.
  const outermost = offenders.filter(
    (element) => !offenders.some((other) => other !== element && other.contains(element))
  );

  const describe = (element) => {
    const rect = element.getBoundingClientRect();
    const id = element.id ? `#${element.id}` : '';
    const classes = element.className
      ? `.${String(element.className).trim().split(/\s+/).slice(0, 3).join('.')}`
      : '';
    const text = (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return (
      `${element.tagName.toLowerCase()}${id}${classes} — ` +
      `${Math.round(rect.width)}px wide, right edge at ${Math.round(rect.right)} ` +
      `of ${viewport}${text ? ` — "${text}"` : ''}`
    );
  };

  /* When the page scrolls sideways and nothing is over the edge, the cause is
     inside something that clips or scrolls — so the element responsible is
     invisible to the test above. Reporting the widest boxes on the page gives
     the next person somewhere to start instead of a bare number. */
  const widest = [...document.body.querySelectorAll('*')]
    .map((element) => ({ element, rect: element.getBoundingClientRect() }))
    .filter(({ rect }) => rect.width > viewport)
    .sort((a, b) => b.rect.width - a.rect.width)
    .slice(0, 6)
    .map(({ element }) => describe(element));

  /* Where the overflow BEGINS, by definition rather than by geometry.
     ----------------------------------------------------------------------
     An element whose scrollable area is wider than its client area contains
     something that sticks out — and for a box with `overflow: visible` that
     fact propagates up the ancestor chain, so the whole chain reports it. The
     DEEPEST such elements are therefore where it starts.

     This finds what element rects cannot: a pseudo-element, a margin, a
     transformed box, an inline box's overflow. All of those were guesses in the
     previous two runs; this is a measurement.

     `::before` and `::after` are read out of the computed style for the same
     reason — they have no rect to measure, and they are the first suspect when
     nothing else is over the edge. */
  const overflowing = [...document.body.querySelectorAll('*')].filter(
    (element) => element.scrollWidth - element.clientWidth > 1
  );
  const deepest = overflowing
    .filter((element) => !overflowing.some((other) => other !== element && element.contains(other)))
    .slice(0, 6)
    .map((element) => {
      const pseudo = ['::before', '::after']
        .map((which) => {
          const style = getComputedStyle(element, which);
          if (!style.content || style.content === 'none') return null;
          return `${which} { content: ${style.content}; width: ${style.width}; position: ${style.position} }`;
        })
        .filter(Boolean);
      return (
        `${describe(element)}  [scrollWidth ${Math.round(element.scrollWidth)} vs ` +
        `client ${Math.round(element.clientWidth)}]` +
        (pseudo.length ? `\n        ${pseudo.join('\n        ')}` : '')
      );
    });

  return {
    deepest,
    pageOverflow: document.documentElement.scrollWidth - viewport,
    viewport,
    offenders: outermost.slice(0, 8).map(describe),
    offenderCount: outermost.length,
    widest,
    skipped: skipped.slice(0, 8).map(({ element, why }) => `${describe(element)}  [${why}]`),
  };
};

/** Interactive controls smaller than the WCAG 2.2 minimum target (2.5.8). */
const findSmallTargets = () => {
  const selector =
    'a[href], button, input:not([type="hidden"]), select, textarea, summary, ' +
    '[role="button"], [role="tab"], [role="option"], [tabindex]:not([tabindex="-1"])';

  const small = [];

  for (const element of document.querySelectorAll(selector)) {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    const style = getComputedStyle(element);
    if (style.visibility === 'hidden') continue;

    /* The visually-hidden recipe: a 1×1 clipped box with a visible label or
       button in front of it. The file input is the case that found this — it is
       `.dds-sr-only` by design, and the control a finger actually lands on is
       the label. Measuring the hidden box reports a 1×1 target that no pointer
       will ever be asked to hit. */
    if (element.closest('.dds-sr-only, .dds-visually-hidden')) continue;
    if (style.clipPath && style.clipPath !== 'none' && rect.width <= 2) continue;

    /* An exception the success criterion itself makes: a control in a sentence
       is sized by the text it is part of, and enlarging it would break the line
       it sits in. Everything else is in scope. */
    const inline = style.display === 'inline';
    if (inline && element.tagName === 'A') continue;

    if (rect.width < 24 || rect.height < 24) {
      const id = element.id ? `#${element.id}` : '';
      small.push(
        `${element.tagName.toLowerCase()}${id} — ` +
          `${Math.round(rect.width)}×${Math.round(rect.height)}px: ` +
          `"${(element.textContent || element.getAttribute('aria-label') || '').trim().slice(0, 30)}"`
      );
    }
  }

  return small;
};

for (const viewport of VIEWPORTS) {
  test.describe(`at ${viewport.name}`, () => {
    for (const path of PAGES) {
      test(`${path} fits`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(path);
        // The swatches, rulers and icon gallery are drawn from the CSS after the
        // stylesheets resolve, so measuring before that measures an empty page.
        await page.waitForLoadState('load');

        const result = await page.evaluate(findOverflow);

        expect(
          result.pageOverflow,
          result.offenderCount
            ? `${result.offenderCount} element(s) exceed the ${result.viewport}px viewport:\n` +
              result.offenders.map((line) => `    ${line}`).join('\n')
            : 'the page scrolls sideways and no element survived the filters. ' +
              'The widest boxes:\n' +
              (result.widest.length
                ? result.widest.map((line) => `    ${line}`).join('\n')
                : '    (none wider than the viewport)') +
              '\n  Where the overflow begins (deepest box whose content sticks out):\n' +
              (result.deepest.length
                ? result.deepest.map((line) => `    ${line}`).join('\n')
                : '    (nothing)') +
              '\n  Over the edge but filtered out:\n' +
              (result.skipped.length
                ? result.skipped.map((line) => `    ${line}`).join('\n')
                : '    (nothing — so the overflow is not from an element box at all: ' +
                  'a pseudo-element, a margin, or the top layer)')
        ).toBeLessThanOrEqual(1);
      });
    }

    /**
     * Only at the narrowest width. A target that is big enough at 320px is big
     * enough everywhere, and running this on all four sizes reports the same
     * control four times.
     */
    if (viewport.width === 320) {
      for (const path of PAGES) {
        test(`${path} keeps its targets reachable`, async ({ page }) => {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await page.goto(path);
          await page.waitForLoadState('load');

          const small = await page.evaluate(findSmallTargets);

          expect(
            small,
            `below the 24×24px minimum target size (WCAG 2.5.8):\n` +
              small.map((line) => `    ${line}`).join('\n')
          ).toEqual([]);
        });
      }
    }
  });
}
