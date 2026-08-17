/**
 * Dessau — copy-to-clipboard puts the right value on the clipboard and says so.
 *
 *   npx playwright test tests/copy.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * `data-dds-copy` (dds/js/components.js) was real and correct, but had no
 * reference entry, no index.json entry and no test — found only by reading
 * the JS source directly, while building a real product on Dessau (#130).
 * "Registered, never seen working in a browser" is exactly the state
 * `check-enhancement-coverage.mjs` exists to surface, and clipboard write is
 * genuinely testable, unlike some of that list's harder cases.
 *
 * The clipboard-write assertion is Chromium-only: Playwright can only grant
 * the `clipboard-read`/`clipboard-write` permissions via CDP, which Firefox
 * and WebKit do not expose. Granting via `context.grantPermissions()` inside
 * the test body, after an explicit `browserName` skip, keeps the skip from
 * running too late — `test.use({ permissions })` fails at context creation,
 * before a skip inside the test body would ever be reached.
 *
 * @covers copy
 *
 */

import { test, expect } from '@playwright/test';

const COMPONENTS = '/reference/components.html';

test('clicking copy puts the referenced value on the clipboard, and confirms it', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'clipboard permission grants are Chromium-only');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  await page.goto(COMPONENTS);

  const value = await page.locator('#ref-copy-value').textContent();
  await page.locator('[data-dds-copy="#ref-copy-value"]').click();

  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toBe(value.trim());

  await expect(page.locator('.dds-toast-success').last()).toBeVisible();
  await expect(
    page.locator('div.dds-sr-only[aria-live="polite"][aria-atomic="true"]')
  ).toContainText('Copied to clipboard');
});

test('with no async Clipboard API, the button hides itself rather than doing nothing', async ({
  page,
}) => {
  // Simulate a non-secure context / unsupported browser: the registration
  // itself checks `navigator.clipboard` once, at setup.
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    });
  });
  await page.goto(COMPONENTS);

  await expect(page.locator('[data-dds-copy="#ref-copy-value"]')).toBeHidden();
  // The value itself stays selectable as ordinary text — not removed, not disabled.
  await expect(page.locator('#ref-copy-value')).toBeVisible();
});
