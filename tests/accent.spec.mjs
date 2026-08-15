/**
 * Dessau — selecting an accent resolves per hue, per theme and per subtree.
 *
 *   npx playwright test tests/accent.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * `data-dds-accent` is a cascade trick, not a script: five rules that re-point
 * `--dds-color-accent` at one of five theme-aware pairs. Everything that can go
 * wrong with it goes wrong silently.
 *
 *   - A typo in a hue name matches nothing, so the element keeps the default and
 *     renders as a perfectly good clay bar in a chart of five clay bars.
 *   - The selection rules weigh the same as `:root` and `[data-theme="dark"]`.
 *     If they ever stop being last in the file, `<html data-theme="dark"
 *     data-dds-accent="…">` silently takes the theme block's clay instead — in
 *     one theme only, which is the half nobody screenshots.
 *   - The per-hue values are declared in both theme blocks. Drop one and the
 *     accent keeps the other theme's value: a light-mode magenta on a dark page,
 *     which looks deliberate.
 *
 * `scripts/check-contrast.mjs` and `scripts/check-accent-separation.mjs` verify
 * the values. Only a browser can verify that the right value arrives at the right
 * element, which is what all three failures above are about.
 *
 * @covers none — no script is involved. The mechanism is the cascade, and that is
 *   exactly what makes it worth a browser test.
 *
 */

import { test, expect } from '@playwright/test';

const FOUNDATIONS = '/reference/foundations.html';

const ACCENTS = ['clay', 'magenta', 'cyan', 'green', 'violet'];

/** Read a custom property as the browser resolves it for one element. */
async function accentOn(locator) {
  return locator.evaluate((element) =>
    getComputedStyle(element).getPropertyValue('--dds-color-accent').trim()
  );
}

const specimen = (page, hue) =>
  page.locator(`[data-ref-accent-specimen] [data-dds-accent="${hue}"]`);

test('all five accents resolve, and to five different colours', async ({ page }) => {
  await page.goto(FOUNDATIONS);

  const values = new Map();
  for (const hue of ACCENTS) {
    const value = await accentOn(specimen(page, hue));
    expect(value, `data-dds-accent="${hue}" resolved to nothing`).not.toBe('');
    values.set(hue, value);
  }

  /**
   * Five names that all render as clay is the failure this catches: every
   * contrast check still passes, and the chart still says nothing.
   */
  expect(
    new Set(values.values()).size,
    `two accents resolved to the same colour: ${[...values].map(([k, v]) => `${k}=${v}`).join(', ')}`
  ).toBe(ACCENTS.length);
});

test('an element with no attribute keeps the default accent, and it is clay', async ({ page }) => {
  await page.goto(FOUNDATIONS);

  const fromRoot = await page.locator('main').evaluate((element) =>
    getComputedStyle(element).getPropertyValue('--dds-color-accent').trim()
  );
  const clay = await accentOn(specimen(page, 'clay'));

  expect(fromRoot).not.toBe('');
  expect(
    fromRoot,
    'the default accent is not clay — something re-pointed --dds-color-accent'
  ).toBe(clay);
});

for (const hue of ACCENTS) {
  test(`the ${hue} accent takes its value from the theme in force`, async ({ page }) => {
    await page.goto(FOUNDATIONS);

    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    const inLight = await accentOn(specimen(page, hue));

    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    const inDark = await accentOn(specimen(page, hue));

    expect(inLight).not.toBe('');
    expect(
      inLight,
      `${hue} is the same colour in both themes — its dark value is missing, so it ` +
        `keeps the light one on a dark page and looks deliberate`
    ).not.toBe(inDark);
  });
}

test('an accent and a forced theme hold together on the same element', async ({ page }) => {
  await page.goto(FOUNDATIONS);
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));

  /**
   * The documented way to force a theme on a subtree of a branded page: both
   * attributes on the one element. It works because the selection rules sit
   * after the theme blocks at equal specificity — this asserts that ordering,
   * which nothing else can.
   */
  await page.evaluate(() => {
    const panel = document.createElement('div');
    panel.id = 'accent-under-forced-theme';
    panel.setAttribute('data-theme', 'light');
    panel.setAttribute('data-dds-accent', 'magenta');
    document.body.appendChild(panel);
  });

  const forced = await page.locator('#accent-under-forced-theme').evaluate((element) =>
    getComputedStyle(element).getPropertyValue('--dds-color-accent').trim()
  );
  const darkMagenta = await accentOn(specimen(page, 'magenta'));

  expect(forced).not.toBe('');
  expect(
    forced,
    'the forced-light panel kept the dark magenta — the theme block did not win ' +
      'back the per-hue value, or the selection rule did not win the accent'
  ).not.toBe(darkMagenta);
});
