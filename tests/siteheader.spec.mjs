/**
 * Dessau — the site header, the component products actually ship.
 *
 *   npx playwright test tests/siteheader.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * `tests/reference-nav.spec.mjs` covers the reference's own header thoroughly —
 * collapse, growing past the threshold, no-JavaScript, Escape, constant height
 * across pages. It covers `.ref-*`. What a product installs is `.dds-siteheader`
 * with `.dds-primary-nav`, and that had no browser test at all.
 *
 * They share the `data-dds-nav-toggle` enhancement, so the behaviour is
 * exercised. What is not exercised is the component's own CSS, and that is where
 * the interesting failure lives:
 *
 *   - the container query at 48rem;
 *   - `.dds-primary-nav[hidden] { display: block }` above it, which is what
 *     stops a collapsed menu staying collapsed forever after a resize;
 *   - the `aria-current` treatment, which has to change from a fill to an
 *     underline to survive the row layout.
 *
 * The middle one is catastrophic and completely invisible in a screenshot: the
 * toggle is `display: none` above 48rem, so if `hidden` still won there, the
 * navigation would be in the DOM, correct, and unreachable — with nothing left
 * on screen to open it.
 *
 * And the point worth having: it is driven by CONTAINER width, not viewport. A
 * container-query component tested only at full window width has not been tested
 * for the thing that makes it a container-query component.
 *
 * @covers nav-toggle
 *
 */

import { test, expect } from '@playwright/test';

const NAVIGATION = '/reference/navigation.html';

const header = (page) => page.locator('.dds-siteheader');
const toggle = (page) => header(page).locator('.dds-siteheader-toggle');
const nav = (page) => header(page).locator('.dds-primary-nav');

/** Set the width of the container the header sits in, leaving the window alone. */
async function setContainerWidth(page, width) {
  await page.evaluate((value) => {
    const stage = document.querySelector('.dds-siteheader-frame').closest('.ref-bp-stage');
    stage.style.inlineSize = value;
  }, width);
}

test('below the threshold the navigation is a disclosure', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(NAVIGATION);
  await setContainerWidth(page, '600px');

  await expect(toggle(page)).toBeVisible();
  await expect(nav(page)).toBeHidden();

  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(nav(page)).toBeVisible();
});

test('the container decides, not the window', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(NAVIGATION);

  /**
   * A wide window and a narrow container. If this read the viewport, the header
   * would stay in its row layout with the toggle hidden — and a product that
   * puts the header inside a narrow column would get a navigation that does not
   * fit and cannot collapse.
   */
  await setContainerWidth(page, '600px');
  await expect(toggle(page)).toBeVisible();

  await setContainerWidth(page, '1000px');
  await expect(toggle(page)).toBeHidden();
});

test('growing past the threshold while collapsed leaves the navigation reachable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(NAVIGATION);
  await setContainerWidth(page, '600px');

  // Collapsed, and `hidden` is on the element.
  await expect(nav(page)).toBeHidden();
  await expect(nav(page)).toHaveAttribute('hidden', '');

  await setContainerWidth(page, '1000px');

  /**
   * The catastrophic case, and the reason `.dds-primary-nav[hidden] { display:
   * block }` exists. Above the threshold the toggle is `display: none` — so if
   * `hidden` still won, every link would be in the DOM, correct, and permanently
   * unreachable, with nothing on screen that could reopen it.
   *
   * `hidden` is deliberately still on the attribute: the disclosure state is not
   * rewritten by a resize, so shrinking again returns to where the user left it.
   */
  await expect(toggle(page)).toBeHidden();
  await expect(nav(page)).toBeVisible();
  await expect(nav(page).locator('a').first()).toBeVisible();
});

test('the current page marker survives the row layout', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(NAVIGATION);
  await setContainerWidth(page, '1000px');

  const current = nav(page).locator('[aria-current="page"]');
  await expect(current).toHaveCount(1);

  /**
   * Above the threshold the fill is dropped for an underline, because a filled
   * pill in a row reads as a button rather than as "you are here". The marker
   * has to remain perceivable without colour either way (WCAG 1.4.1), so what is
   * asserted is that something other than colour is drawn — a box-shadow here.
   */
  const marker = await current.evaluate((element) => {
    const style = getComputedStyle(element);
    return { shadow: style.boxShadow, background: style.backgroundColor };
  });

  expect(marker.shadow, 'no underline on the current entry in the row layout').not.toBe('none');
});
