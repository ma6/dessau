/**
 * Dessau — the reference navigation is reachable at every width.
 *
 *   npx playwright test tests/reference-nav.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * A collapsing navigation has one catastrophic failure mode and it is not visible in
 * the source: the panel is hidden, the viewport grows past the threshold, the toggle
 * that would reopen it is now `display: none`, and the navigation is unreachable. The
 * page looks fine. Every link is still in the DOM. There is simply no way to get to
 * any of them.
 *
 * It needs a real viewport resize to find, which is the definition of a browser test.
 *
 * The two-level structure has a quieter failure: the second row names the current
 * group's pages, so a wrong group means the reader is offered somebody else's
 * siblings. That is checked too, on every page, because the generator derives it and a
 * derivation is only as good as the structure it reads.
 */

import { test, expect } from '@playwright/test';
import { readdir } from 'node:fs/promises';

const PAGES = (await readdir('reference'))
  .filter((name) => name.endsWith('.html'))
  .sort();

/** Matches the media query in reference.css. */
const WIDE = { width: 1280, height: 900 };
const NARROW = { width: 480, height: 900 };
/**
 * The floor, not a fourth opinion about layout: WCAG 2.2 1.4.10 Reflow is
 * measured at 320px, and `agent/responsive.md` names it as the width everything
 * has to survive. The header wrap this file caught at 480px had more room there
 * than it has here, so 480 passing is not evidence 320 does.
 */
const PHONE = { width: 320, height: 900 };

test('the navigation survives growing past the threshold while collapsed', async ({ page }) => {
  await page.setViewportSize(NARROW);
  await page.goto('/reference/components.html');

  const toggle = page.locator('.ref-nav-toggle');
  const panel = page.locator('#ref-nav-panel');

  await expect(toggle).toBeVisible();

  // Open it, then close it, so the panel carries `hidden` when the window grows.
  await toggle.click();
  await expect(panel).toBeVisible();
  await toggle.click();
  await expect(panel).toBeHidden();

  await page.setViewportSize(WIDE);

  /**
   * The exact trap. Above the threshold the toggle is gone, so if `hidden` still
   * applied there would be no way back to any link on the site.
   */
  await expect(
    panel,
    'the panel stayed hidden after the viewport grew, and the toggle that would ' +
      'reopen it is no longer displayed — every link is unreachable'
  ).toBeVisible();
  await expect(toggle).toBeHidden();
});

test('the navigation is usable with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  await page.setViewportSize(WIDE);
  await page.goto('/reference/components.html');

  /**
   * The panel is not `hidden` in the markup — it is hidden by CSS only where the
   * toggle is displayed. So with no JavaScript the links are present rather than
   * behind a button that cannot do anything, which is the right direction to fail.
   */
  await expect(page.locator('#ref-nav-panel')).toBeVisible();
  await expect(page.locator('.ref-nav a[href="patterns.html"]')).toBeVisible();

  await context.close();
});

test('Escape closes the panel and returns focus to the button', async ({ page }) => {
  await page.setViewportSize(NARROW);
  await page.goto('/reference/components.html');

  const toggle = page.locator('.ref-nav-toggle');
  await toggle.click();

  await page.locator('#ref-nav-panel a').first().focus();
  await page.keyboard.press('Escape');

  await expect(page.locator('#ref-nav-panel')).toBeHidden();

  // Focus left on a hidden element falls to <body>, and the next Tab restarts at the
  // top of the page.
  await expect(toggle).toBeFocused();
});

for (const file of PAGES) {
  test(`${file}: exactly one current page, and the second row matches its group`, async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto(`/reference/${file}`);

    const panel = page.locator('#ref-nav-panel');

    // One `aria-current="page"` across both levels. Two would make the header say two
    // things; none would leave the reader with no answer.
    await expect(
      panel.locator('[aria-current="page"]'),
      'the header names something other than exactly one current page'
    ).toHaveCount(1);

    const secondary = page.locator('.ref-nav-secondary');

    if ((await secondary.count()) === 0) {
      // A group of one gets no second row — then the current page must be a top-level
      // entry, or nothing marks it at all.
      await expect(page.locator('.ref-nav [aria-current="page"]')).toHaveCount(1);
      return;
    }

    /**
     * The current page is one of the pages the second row offers. If it is not, the
     * generator has put the page in a group whose siblings are somebody else's — the
     * reader is shown a set of choices that does not contain where they are.
     */
    const currentInSecondary = await secondary
      .locator(`a[href="${file}"][aria-current="page"]`)
      .count();

    expect(
      currentInSecondary,
      `${file} shows a second row that does not contain ${file} itself`
    ).toBe(1);

    // And the group's own entry in the first row is marked as the current section.
    await expect(page.locator('.ref-nav a[data-current-section]')).toHaveCount(1);
  });
}

test('the active first-level entry is distinguishable by more than colour', async ({ page }) => {
  await page.setViewportSize(WIDE);
  await page.goto('/reference/content.html');

  const section = page.locator('.ref-nav a[data-current-section]');
  const sibling = page.locator('.ref-nav a:not([data-current-section])').first();

  /**
   * The first version of this marker was a colour step plus a weight step, and it was
   * too quiet to find at a glance — which is the one job it has. Asserting on more than
   * one channel is what stops it quietly regressing to that: greyscale, a colour vision
   * difference or forced-colors each remove a different cue, so no single one may carry
   * the state.
   */
  const [current, other] = await Promise.all([
    section.evaluate((el) => {
      const s = getComputedStyle(el);
      return { weight: s.fontWeight, background: s.backgroundColor, shadow: s.boxShadow };
    }),
    sibling.evaluate((el) => {
      const s = getComputedStyle(el);
      return { weight: s.fontWeight, background: s.backgroundColor, shadow: s.boxShadow };
    }),
  ]);

  expect(Number(current.weight), 'no weight difference').toBeGreaterThan(Number(other.weight));
  expect(current.background, 'no fill difference').not.toBe(other.background);
  expect(
    current.shadow,
    'no connecting bar under the entry that owns the second row'
  ).not.toBe(other.shadow);
});

test('the header is the same height on every page', async ({ page }) => {
  await page.setViewportSize(WIDE);

  const heights = new Map();

  for (const file of PAGES) {
    await page.goto(`/reference/${file}`);
    const box = await page.locator('.ref-header').boundingBox();
    heights.set(file, Math.round(box.height));
  }

  /**
   * Three of the pages are a group of one and have no second row. Without a reserved
   * height the header changed size when moving between them — and it is sticky, so the
   * whole page shifted under the pointer on every navigation.
   */
  const distinct = new Set(heights.values());

  expect(
    distinct.size,
    'the header is not the same height everywhere, so it resizes as you navigate: ' +
      [...heights].map(([f, h]) => `${f}=${h}`).join(', ')
  ).toBe(1);
});

test('the first-level entries sit at the same height on every page', async ({ page }) => {
  await page.setViewportSize(WIDE);

  const tops = new Map();

  for (const file of PAGES) {
    await page.goto(`/reference/${file}`);
    const box = await page.locator('.ref-nav').boundingBox();
    tops.set(file, Math.round(box.y));
  }

  /**
   * A constant header height is not enough on its own. With the rows centred in a
   * reserved box, a page with a second row centred the pair and a page without it
   * centred the single row alone — so the first level moved as you navigated, inside a
   * header that no longer changed size. Half a fix, and the visible half was the half
   * left over.
   */
  expect(
    new Set(tops.values()).size,
    'the first-level navigation is at a different height depending on the page, so the ' +
      'entries move as you navigate: ' +
      [...tops].map(([f, y]) => `${f}=${y}`).join(', ')
  ).toBe(1);
});

test('the brand and the theme toggle sit on the navigation row, on every page', async ({ page }) => {
  await page.setViewportSize(WIDE);

  const rows = new Map();

  for (const file of PAGES) {
    await page.goto(`/reference/${file}`);

    rows.set(
      file,
      await page.evaluate(() => {
        const top = (selector) =>
          Math.round(document.querySelector(selector).getBoundingClientRect().top);
        return {
          brand: top('.ref-brand'),
          nav: top('.ref-nav'),
          theme: top('.ref-header-inner > .dds-theme-toggle'),
        };
      })
    );
  }

  /**
   * All three on one line, and the same line everywhere.
   *
   * `align-items: center` centred the brand and the theme toggle against the tallest
   * item in the row — the navigation panel, two rows tall on most pages. So the brand
   * sat below the navigation it belongs beside, and any difference between the panel's
   * real height and its reserved height moved both of them.
   *
   * Comparing the three to each other AND across pages is what makes this hold: equal
   * positions on one page prove alignment, equal positions across pages prove nothing
   * moves as you navigate, and only both together are the property being asked for.
   */
  for (const [file, { brand, nav, theme }] of rows) {
    expect(
      { brand, theme },
      `on ${file} the brand or the theme toggle is off the navigation's line ` +
        `(nav=${nav}, brand=${brand}, theme=${theme})`
    ).toEqual({ brand: nav, theme: nav });
  }

  const distinct = new Set([...rows.values()].map((r) => r.nav));
  expect(
    distinct.size,
    'the header row is at a different height depending on the page: ' +
      [...rows].map(([f, r]) => `${f}=${r.nav}`).join(', ')
  ).toBe(1);
});

test('the collapsed menu does not change the header height', async ({ page }) => {
  await page.setViewportSize(NARROW);
  await page.goto('/reference/components.html');

  const header = page.locator('.ref-header');
  const closed = (await header.boundingBox()).height;

  await page.locator('.ref-nav-toggle').click();
  await expect(page.locator('#ref-nav-panel')).toBeVisible();

  const open = (await header.boundingBox()).height;

  /**
   * The panel is an overlay below the header, not a row inside it. In flow it took the
   * full width, which pushed the theme toggle onto a third row — so opening the menu
   * both grew the header and reordered it.
   */
  expect(
    Math.round(open),
    'opening the menu changed the header height, so the page jumps under the pointer'
  ).toBe(Math.round(closed));
});

test('the theme toggle is the last control in the header row', async ({ page }) => {
  for (const size of [WIDE, NARROW, PHONE]) {
    await page.setViewportSize(size);
    await page.goto('/reference/components.html');

    const positions = await page.evaluate(() => {
      const inRow = [...document.querySelectorAll('.ref-header-inner > *')].filter(
        // The overlay is out of flow, so it is not part of the row.
        (el) => getComputedStyle(el).position !== 'absolute'
      );
      return inRow.map((el) => ({
        name: el.className || el.tagName,
        end: Math.round(el.getBoundingClientRect().right),
      }));
    });

    const last = positions[positions.length - 1];

    expect(
      last.name,
      `at ${size.width}px the last control in the header row is "${last.name}" — ` +
        `a utility control belongs at the end, which is where it is looked for`
    ).toContain('theme-toggle');

    // And it really is the rightmost thing, not merely last in the DOM. Being
    // last and being at the end are the same thing only while the row does not
    // wrap: at 480px the brand and the Menu button filled it, and the toggle went
    // to a line of its own, at the far left.
    const rightmost = Math.max(...positions.map((p) => p.end));
    expect(
      last.end,
      `at ${size.width}px the theme toggle is not the rightmost control — ` +
        `the header row has wrapped (${positions
          .map((p) => `${p.name}=${p.end}`)
          .join(', ')})`
    ).toBe(rightmost);
  }
});
