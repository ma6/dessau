/**
 * Dessau — a table scrolls inside its region, and says so.
 *
 *   npx playwright test tests/table.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * `.dds-table-wrap` was documented as not optional and enforced by nothing.
 * Twelve of the fourteen tables in this repository's own reference had no
 * wrapper, eight of them inside `<div class="dds-scroll">` — a class no
 * stylesheet declares. The markup read as though somebody had thought about it
 * and did nothing whatsoever, which is the kind of failure that survives review.
 *
 * `scripts/check-reference.mjs` now catches the markup case without a browser, so
 * this file deliberately does NOT re-check the pages. It checks the two things
 * only a browser can answer:
 *
 *   1. a table wider than its container scrolls its region instead of widening
 *      the page — the actual promise, and the reason the wrapper exists;
 *   2. the enhancement repairs a table that arrives without a wrapper, giving it
 *      a keyboard-reachable, named region, and marks the edges that have more
 *      content beyond them.
 *
 * The second one is checked on markup built in the page rather than on a
 * reference page, precisely because every reference page is now correct. A test
 * that can only pass because nothing is broken tests nothing.
 *
 * @covers table
 *
 */

import { test, expect } from '@playwright/test';

const COMPONENTS = '/reference/components.html';

/** A phone, where the defect this component exists for actually happens. */
const PHONE = { width: 390, height: 844 };

test.describe('table scroll region', () => {
  test('a wide table scrolls its own region and does not widen the page', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto(COMPONENTS);

    const wrap = page.locator('.dds-table-wrap').first();
    await expect(wrap).toBeVisible();

    const measured = await wrap.evaluate((element) => ({
      scrollable: element.scrollWidth > element.clientWidth,
      regionWithinViewport:
        element.getBoundingClientRect().width <= document.documentElement.clientWidth + 1,
      pageOverflow:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));

    // The table is genuinely wider than a phone — otherwise this asserts nothing.
    expect(measured.scrollable).toBe(true);
    expect(measured.regionWithinViewport).toBe(true);
    expect(measured.pageOverflow).toBeLessThanOrEqual(1);
  });

  test('the region is reachable and named without a mouse', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto(COMPONENTS);

    const wrap = page.locator('.dds-table-wrap').first();

    await expect(wrap).toHaveAttribute('tabindex', '0');

    const name = await wrap.evaluate((element) => {
      const id = element.getAttribute('aria-labelledby');
      return id ? document.getElementById(id)?.textContent?.trim() : element.getAttribute('aria-label');
    });

    expect(name, 'an unnamed region is dropped by screen readers').toBeTruthy();

    // Focusable in fact, not merely by attribute.
    await wrap.focus();
    await expect(wrap).toBeFocused();
  });
});

test.describe('table enhancement', () => {
  /**
   * A table with no wrapper at all, inserted after load and enhanced explicitly.
   * `DDS.enhance` is the documented entry point for markup that arrives late, so
   * this exercises the same path a product's own rendering would.
   */
  async function insertBareTable(page) {
    return page.evaluate(() => {
      const host = document.createElement('div');
      host.id = 'bare-table-host';
      // Narrow on purpose: the table must be wider than what holds it.
      host.style.inlineSize = '200px';

      const columns = 12;
      host.innerHTML = `
        <table class="dds-table">
          <caption>Unwrapped table</caption>
          <thead><tr>${'<th scope="col">A long enough heading</th>'.repeat(columns)}</tr></thead>
          <tbody><tr>${'<td>A cell with some text in it</td>'.repeat(columns)}</tr></tbody>
        </table>`;

      document.querySelector('main').appendChild(host);
      window.DDS.enhance(host);
    });
  }

  test('a table with no wrapper is given one, focusable and named', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto(COMPONENTS);
    await insertBareTable(page);

    const wrap = page.locator('#bare-table-host .dds-table-wrap');
    await expect(wrap).toHaveCount(1);
    await expect(wrap).toHaveAttribute('tabindex', '0');
    await expect(wrap).toHaveAttribute('role', 'region');

    const named = await wrap.evaluate((element) => {
      const id = element.getAttribute('aria-labelledby');
      return document.getElementById(id)?.textContent?.trim();
    });
    expect(named).toBe('Unwrapped table');
  });

  test('the edge marks follow the real scroll position', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto(COMPONENTS);
    await insertBareTable(page);

    const frame = page.locator('#bare-table-host .dds-table-frame');
    const wrap = page.locator('#bare-table-host .dds-table-wrap');

    // At the start there is more to the right and nothing to the left.
    await expect(frame).toHaveAttribute('data-dds-scroll', 'end');

    await wrap.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });

    // At the far end, the reverse. `toHaveAttribute` retries, which is what
    // waits for the scroll event rather than a fixed timeout.
    await expect(frame).toHaveAttribute('data-dds-scroll', 'start');
  });

  test('a screen-reader-only table is left alone', async ({ page }) => {
    await page.goto('/reference/content.html');

    /* The data table behind a chart is never rendered and never scrolled.
       Wrapping it would add a visible frame and a tab stop to something that is
       deliberately invisible — a defect dressed as a fix. */
    const hidden = page.locator('table.dds-table.dds-sr-only').first();
    await expect(hidden).toHaveCount(1);

    const wrapped = await hidden.evaluate((element) =>
      element.parentElement.classList.contains('dds-table-wrap')
    );
    expect(wrapped).toBe(false);
  });
});
