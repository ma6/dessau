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
 *
 * @covers toc
 *
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
      /**
       * Three frames, not one. The first lets layout run, the second lets the
       * observers that layout triggers fire, and the third lets the work those
       * observers schedule land. Two was enough to settle the height and not enough
       * for the highlight to have been recomputed from it.
       */
      await new Promise((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => requestAnimationFrame(resolve))
        )
      );
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

test('the highlight always names exactly one section', async ({ page }) => {
  await page.goto('/reference/patterns.html');

  const toc = page.locator('[data-dds-toc]').first();

  /**
   * At every scroll position, including the very top and the very bottom. "Exactly
   * one" is the property the geometric approach buys and the band did not: a band can
   * be empty, and an empty answer leaves the previous mark in place — which is how the
   * last entry became permanently unreachable.
   */
  const positions = [0, 0.25, 0.5, 0.75, 1];

  for (const fraction of positions) {
    await page.evaluate((f) => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: Math.round(max * f), behavior: 'instant' });
    }, fraction);

    await expect(
      toc.locator('[aria-current]'),
      `at ${fraction * 100}% down the page, the highlight names ` +
        `something other than exactly one section`
    ).toHaveCount(1);
  }
});

/**
 * The narrow state, which is the one nobody had looked at.
 *
 * Below the reference shell's two-column threshold the list is not sticky: it
 * sits above the content and scrolls away with it, so a reader never sees the
 * mark move. What they see is whatever was current when the list was last on
 * screen — always the first entry — and it reads as a selection. Announced, it
 * states a reading position that on that screen never changes.
 *
 * The component decides this from its own computed position rather than from a
 * width, so this test asserts the behaviour a phone produces, not the mechanism.
 */
test('on a phone, where the list scrolls away, no entry claims to be current', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/reference/patterns.html');

  const toc = page.locator('[data-dds-toc]').first();
  await expect(toc).toBeVisible();

  // The list is genuinely not sticky here — otherwise this asserts nothing.
  const sticky = await toc.evaluate((element) => {
    for (let node = element; node && node !== document.body; node = node.parentElement) {
      const position = getComputedStyle(node).position;
      if (position === 'sticky' || position === 'fixed') return true;
    }
    return false;
  });
  expect(sticky, 'the list is sticky at this width, so this test proves nothing').toBe(false);

  for (const fraction of [0, 0.5, 1]) {
    await page.evaluate((f) => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: Math.round(max * f), behavior: 'instant' });
    }, fraction);

    await expect(
      toc.locator('[aria-current]'),
      `at ${fraction * 100}% down a phone-sized page, an entry is marked as the ` +
        `reading position — but the list has not been on screen since the top`
    ).toHaveCount(0);
  }
});

/** And the wide state still works, decided the same way. */
test('where the list is sticky, it still tracks', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/reference/patterns.html');

  const toc = page.locator('[data-dds-toc]').first();
  await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' }));

  await expect(toc.locator('[aria-current="location"]')).toHaveCount(1);
});

/**
 * The mark has to be somewhere the reader can see it.
 *
 * The list lives in a sticky box with a `max-block-size` and `overflow-y: auto`,
 * so on a page with more entries than fit it, the mark moves down a list that
 * never scrolls — and after a few sections it is outside the visible part of its
 * own list, in both directions (#91). A component whose entire job is to say
 * where you are was then silent for exactly the pages long enough to need one.
 *
 * Every assertion that already exists here passed throughout, because they all
 * ask which entry is marked and none asks whether anybody can see it.
 */
test('the marked entry stays inside its own list, scrolling down and back up', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/reference/components.html');

  const toc = page.locator('[data-dds-toc]').first();

  /* The list must genuinely overflow its box, or this test asserts nothing on a
     page that happens to be short enough. `components.html` has the longest list
     in the reference, which is why it is the page used here. */
  const overflows = await toc.evaluate((element) => {
    for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
      const overflow = getComputedStyle(node).overflowY;
      if ((overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight) {
        return true;
      }
    }
    return false;
  });
  expect(overflows, 'the list fits its box here, so this test proves nothing').toBe(true);

  /** Is the marked entry inside the visible part of the box that holds it? */
  async function markIsVisible() {
    return toc.evaluate((element) => {
      const current = element.querySelector('[aria-current="location"]');
      if (!current) return null;

      let box = current.parentElement;
      while (box && box !== document.body) {
        const overflow = getComputedStyle(box).overflowY;
        if ((overflow === 'auto' || overflow === 'scroll') && box.scrollHeight > box.clientHeight) {
          break;
        }
        box = box.parentElement;
      }
      if (!box || box === document.body) return null;

      const item = current.getBoundingClientRect();
      const frame = box.getBoundingClientRect();
      return item.top >= frame.top - 1 && item.bottom <= frame.bottom + 1;
    });
  }

  const downThenUp = [0.2, 0.45, 0.7, 0.95, 0.7, 0.45, 0.2, 0];

  for (const fraction of downThenUp) {
    await page.evaluate((f) => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: Math.round(max * f), behavior: 'instant' });
    }, fraction);

    /* Poll: the reveal runs from the same throttled frame as the mark, and on a
       page with `content-visibility: auto` the height keeps settling. */
    await expect
      .poll(markIsVisible, {
        message: `at ${Math.round(fraction * 100)}% down the page, the marked entry is outside the visible part of its list`,
      })
      .toBe(true);
  }
});

/**
 * The page is what the reader is scrolling; the list is not allowed to join in.
 *
 * `scrollIntoView` is the obvious call for the test above and the wrong one — it
 * scrolls every scrollable ancestor including the document, so the page scroll
 * that moved the reading position would be answered by moving the page.
 */
test('revealing the marked entry never moves the page', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/reference/components.html');

  for (const fraction of [0.3, 0.6, 0.9]) {
    const target = await page.evaluate((f) => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const top = Math.round(max * f);
      window.scrollTo({ top, behavior: 'instant' });
      return top;
    }, fraction);

    // Long enough for several throttled frames, and any reveal they trigger.
    await page.waitForTimeout(250);

    const landed = await page.evaluate(() => Math.round(window.scrollY));

    // Tolerant of the page growing under `content-visibility: auto`, intolerant
    // of the tens or hundreds of pixels a hijacked scroll would move.
    expect(Math.abs(landed - target)).toBeLessThan(4);
  }
});
