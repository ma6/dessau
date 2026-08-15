/**
 * Dessau — a forced theme works on a subtree, in both directions.
 *
 *   npx playwright test tests/theme-scoping.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * `data-theme` on a subtree only does anything if a rule matches that exact value.
 * Custom properties inherit, so a subtree marked with a theme that has no rule
 * keeps whatever the page root set. It renders perfectly — in the wrong theme.
 *
 * That shipped. Light values were declared only on `:root`, so a panel marked
 * `data-theme="light"` inside a dark page matched nothing, inherited the dark
 * values, and appeared as a second dark panel labelled "Light". In light mode the
 * same markup was correct, which is why looking at it was not enough to find it.
 *
 * A static check can confirm the rule exists (`scripts/check-reference.mjs` does).
 * Only a browser can confirm the values actually resolve differently, which is the
 * thing that was broken.
 *
 * @covers none — this is about which custom properties resolve where. No script
 *   is involved: a forced `data-theme` is markup, and the bug was in the cascade.
 *
 */

import { test, expect } from '@playwright/test';

const FOUNDATIONS = '/reference/foundations.html';

/** Read a semantic token as the browser resolves it for one element. */
async function tokenOn(locator, name) {
  return locator.evaluate(
    (element, property) =>
      getComputedStyle(element).getPropertyValue(property).trim(),
    name
  );
}

for (const pageTheme of ['light', 'dark']) {
  test(`a forced theme overrides a ${pageTheme} page`, async ({ page }) => {
    await page.goto(FOUNDATIONS);
    await page.evaluate(
      (theme) => document.documentElement.setAttribute('data-theme', theme),
      pageTheme
    );

    const light = page.locator('.ref-theme-panel[data-theme="light"]');
    const dark = page.locator('.ref-theme-panel[data-theme="dark"]');

    await expect(light).toBeVisible();
    await expect(dark).toBeVisible();

    for (const property of [
      '--dds-color-surface-default',
      '--dds-color-text-default',
      '--dds-color-border-subtle',
    ]) {
      const inLight = await tokenOn(light, property);
      const inDark = await tokenOn(dark, property);

      expect(inLight, `${property} must resolve in the light panel`).not.toBe('');
      expect(
        inLight,
        `${property} is identical in both panels — the forced theme did not apply, ` +
          `which is invisible on a ${pageTheme} page until you compare the two`
      ).not.toBe(inDark);
    }

    /**
     * The panels must also be the right way round. Comparing them only proves they
     * differ; a swapped pair would pass that and be just as wrong.
     */
    const lightSurface = await tokenOn(light, '--dds-color-surface-default');
    const darkSurface = await tokenOn(dark, '--dds-color-surface-default');

    const luminance = (colour) => {
      const [r, g, b] = colour.match(/\d+/g)?.map(Number) ?? [];
      if (r === undefined) return null;
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const lightValue = luminance(lightSurface);
    const darkValue = luminance(darkSurface);

    if (lightValue !== null && darkValue !== null) {
      expect(
        lightValue,
        `the "light" panel is darker than the "dark" one — the two are swapped`
      ).toBeGreaterThan(darkValue);
    }
  });
}

test('color-scheme follows a forced theme, so native controls match', async ({ page }) => {
  await page.goto(FOUNDATIONS);
  await page.evaluate(() =>
    document.documentElement.setAttribute('data-theme', 'dark')
  );

  const light = page.locator('.ref-theme-panel[data-theme="light"]');

  /**
   * Without this, a date picker or a scrollbar inside a forced-light panel keeps
   * the page's dark chrome. The tokens would look right and the native parts would
   * not — the hardest kind of mismatch to attribute to a cause.
   */
  const scheme = await light.evaluate(
    (element) => getComputedStyle(element).colorScheme
  );

  expect(scheme).toBe('light');
});
