/**
 * Dessau — the banner's dismiss button actually dismisses the banner.
 *
 *   npx playwright test tests/banner.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * `.dds-banner-dismiss` existed in the CSS and in the reference markup, with no
 * click handler anywhere in `dds/js/` — grepping the whole tree found nothing
 * that registered or wired it (#117). The button rendered, looked correct, and
 * did nothing when clicked. A dead control with no test is exactly the kind of
 * gap a static check cannot see and a guidance sweep can only catch once.
 *
 * @covers banner
 *
 */

import { test, expect } from '@playwright/test';

const NAVIGATION = '/reference/navigation.html';

test('clicking dismiss removes the banner from the page', async ({ page }) => {
  await page.goto(NAVIGATION);

  const banners = page.locator('.dds-banner');
  const before = await banners.count();
  const dismissedTitle = await banners
    .first()
    .locator('.dds-banner-title')
    .textContent();

  // `.first()` re-resolves after the DOM changes, so it would report the NEXT
  // banner in line rather than "none" the moment a second one exists — the
  // count and the specific title are checked instead of the locator itself.
  await banners.first().locator('.dds-banner-dismiss').click();

  await expect(banners).toHaveCount(before - 1);
  await expect(page.locator('.dds-banner-title', { hasText: dismissedTitle })).toHaveCount(0);
});

test('dismissing one banner leaves the others alone', async ({ page }) => {
  await page.goto(NAVIGATION);

  const banners = page.locator('.dds-banner');
  const before = await banners.count();
  expect(before).toBeGreaterThan(1);

  await banners.first().locator('.dds-banner-dismiss').click();

  await expect(banners).toHaveCount(before - 1);
});
