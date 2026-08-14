/**
 * Dessau — every table-of-contents entry can actually become active.
 *
 *   npx playwright test tests/toc.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * The highlight uses an `IntersectionObserver` with a reading band near the top of
 * the viewport — which is right for the question "what is being read", and leaves
 * the last entry permanently unreachable.
 *
 * At the bottom of the page there is nothing left to scroll, so a short final
 * section never rises into the band. The section above it keeps the marker while the
 * last section fills the screen: one entry in the list that can never be reached, on
 * every long page, in a component whose whole job is to say where you are.
 *
 * It is not visible in the source and not visible on a short page. It needs a real
 * viewport, a real scroll, and a check on the last entry specifically.
 */

import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const PAGES = ['patterns', 'components', 'content', 'navigation', 'foundations'];

for (const name of PAGES) {
  test(`${name}: the last table-of-contents entry activates at the end of the page`, async ({ page }) => {
    await page.goto(pathToFileURL(join(process.cwd(), `reference/${name}.html`)).href);

    const toc = page.locator('[data-dds-toc]').first();
    const links = toc.locator('a[href^="#"]');

    const count = await links.count();
    expect(count, 'no table of contents on this page').toBeGreaterThan(1);

    const last = links.nth(count - 1);
    const target = await last.getAttribute('href');

    await page.evaluate(() =>
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })
    );

    // The observer reports asynchronously; expect() polls, so no fixed wait.
    await expect(
      last,
      `scrolled to the bottom and ${target} is still not the active entry — ` +
        `the last section cannot reach the reading band, so its entry is dead`
    ).toHaveAttribute('aria-current', 'location');

    /** Exactly one entry is current. Two would make the list say two things. */
    await expect(toc.locator('[aria-current]')).toHaveCount(1);
  });
}

test('the marker is "location", not "page"', async ({ page }) => {
  await page.goto(pathToFileURL(join(process.cwd(), 'reference/patterns.html')).href);

  await page.evaluate(() => window.scrollTo({ top: 800, behavior: 'instant' }));

  const current = page.locator('[data-dds-toc] [aria-current]').first();

  /**
   * `aria-current="page"` would tell a screen-reader user they are on a different
   * page. They are not — the reading position moved within this one.
   */
  await expect(current).toHaveAttribute('aria-current', 'location');
});

test('the sentinel adds no height to the page', async ({ page }) => {
  await page.goto(pathToFileURL(join(process.cwd(), 'reference/patterns.html')).href);

  const grew = await page.evaluate(() => {
    const sentinel = document.querySelector('[data-dds-toc-sentinel]');
    if (!sentinel) return null;
    const before = document.documentElement.scrollHeight;
    sentinel.remove();
    return before - document.documentElement.scrollHeight;
  });

  expect(grew, 'no sentinel was inserted').not.toBeNull();
  expect(
    grew,
    'the sentinel adds scroll height, so the page can be scrolled past its content'
  ).toBe(0);
});
