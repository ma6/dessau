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
