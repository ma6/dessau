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
import { readdir, readFile } from 'node:fs/promises';

/**
 * Every reference page that has a side navigation, read from the filesystem.
 *
 * A hard-coded list was five names long and two pages out of date within a day of
 * those pages being written — and the gap is invisible, because the tests that do run
 * all pass. Deriving it means a new page is covered the moment it exists, which is the
 * only version of this that stays true.
 */
const PAGES = (
  await Promise.all(
    (await readdir('reference'))
      .filter((name) => name.endsWith('.html'))
      .sort()
      .map(async (name) => {
        const source = await readFile(`reference/${name}`, 'utf8');
        return source.includes('data-dds-toc') ? name.replace('.html', '') : null;
      })
  )
).filter(Boolean);

/**
 * Scroll to the true bottom of the page.
 *
 * A single `scrollTo(scrollHeight)` is not enough here, and the reason is worth
 * knowing rather than working around blindly. `.ref-section` uses
 * `content-visibility: auto` with `contain-intrinsic-size: auto 30rem`, so an
 * off-screen section is *estimated* at 30rem and its real height only replaces the
 * estimate once it comes near the viewport.
 *
 * So scrolling to what is currently `scrollHeight` reveals sections, their real
 * heights land, and the page becomes taller than the target that was just jumped to.
 * The scroll therefore stops somewhere short of the end — by a different amount on
 * every page, which is exactly why some pages passed this test and some failed while
 * the component behaved identically on all of them.
 *
 * Repeating until the height stops changing is the honest fix: it reaches the bottom
 * the way a person scrolling would, rather than assuming one jump gets there.
 */
async function scrollToBottom(page) {
  await page.evaluate(async () => {
    let previous = -1;

    // Bounded: a page whose height never settles is a bug, not something to loop on.
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const height = document.documentElement.scrollHeight;
      if (height === previous) break;
      previous = height;

      window.scrollTo({ top: height, behavior: 'instant' });
      // One frame for layout, one for the observers that layout triggers.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
  });
}

for (const name of PAGES) {
  test(`${name}: the last table-of-contents entry activates at the end of the page`, async ({ page }) => {
    await page.goto(`/reference/${name}.html`);

    const toc = page.locator('[data-dds-toc]').first();
    const links = toc.locator('a[href^="#"]');

    const count = await links.count();
    expect(count, 'no table of contents on this page').toBeGreaterThan(1);

    const last = links.nth(count - 1);
    const target = await last.getAttribute('href');

    await scrollToBottom(page);

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
  await page.goto('/reference/patterns.html');

  await page.evaluate(() => window.scrollTo({ top: 800, behavior: 'instant' }));

  const current = page.locator('[data-dds-toc] [aria-current]').first();

  /**
   * `aria-current="page"` would tell a screen-reader user they are on a different
   * page. They are not — the reading position moved within this one.
   */
  await expect(current).toHaveAttribute('aria-current', 'location');
});

test('the sentinel adds no height to the page', async ({ page }) => {
  await page.goto('/reference/patterns.html');

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
