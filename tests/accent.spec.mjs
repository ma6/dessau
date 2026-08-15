/**
 * Dessau — selecting an accent resolves per slot, per theme and per subtree.
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
 *   - A typo in a slot number matches nothing, so the element keeps the default
 *     and renders as a perfectly good accent-1 bar in a chart of five of them.
 *   - The selection rules weigh the same as `:root` and `[data-theme="dark"]`.
 *     If they ever stop being last in the file, `<html data-theme="dark"
 *     data-dds-accent="…">` silently takes the theme block's accent 1 instead —
 *     in one theme only, which is the half nobody screenshots.
 *   - The per-slot values are declared in both theme blocks. Drop one and the
 *     accent keeps the other theme's value: a light-mode accent on a dark page,
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

const ACCENTS = ['1', '2', '3', '4', '5'];

/** Read a custom property as the browser resolves it for one element. */
async function accentOn(locator) {
  return locator.evaluate((element) =>
    getComputedStyle(element).getPropertyValue('--dds-color-accent').trim()
  );
}

const specimen = (page, slot) =>
  page.locator(`[data-ref-accent-specimen] [data-dds-accent="${slot}"]`);

test('all five accents resolve, and to five different colours', async ({ page }) => {
  await page.goto(FOUNDATIONS);

  const values = new Map();
  for (const slot of ACCENTS) {
    const value = await accentOn(specimen(page, slot));
    expect(value, `data-dds-accent="${slot}" resolved to nothing`).not.toBe('');
    values.set(slot, value);
  }

  /**
   * Five slots that all render as the same colour is the failure this catches:
   * every contrast check still passes, and the chart still says nothing.
   */
  expect(
    new Set(values.values()).size,
    `two accents resolved to the same colour: ${[...values].map(([k, v]) => `${k}=${v}`).join(', ')}`
  ).toBe(ACCENTS.length);
});

test('an element with no attribute keeps the default accent, and it is accent 1', async ({ page }) => {
  await page.goto(FOUNDATIONS);

  const fromRoot = await page.locator('main').evaluate((element) =>
    getComputedStyle(element).getPropertyValue('--dds-color-accent').trim()
  );
  const first = await accentOn(specimen(page, '1'));

  expect(fromRoot).not.toBe('');
  expect(
    fromRoot,
    'the default accent is not accent 1 — something re-pointed --dds-color-accent'
  ).toBe(first);
});

for (const slot of ACCENTS) {
  test(`accent ${slot} takes its value from the theme in force`, async ({ page }) => {
    await page.goto(FOUNDATIONS);

    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    const inLight = await accentOn(specimen(page, slot));

    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    const inDark = await accentOn(specimen(page, slot));

    expect(inLight).not.toBe('');
    expect(
      inLight,
      `accent ${slot} is the same colour in both themes — its dark value is missing, so ` +
        `it keeps the light one on a dark page and looks deliberate`
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
    panel.setAttribute('data-dds-accent', '2');
    document.body.appendChild(panel);
  });

  const forced = await page.locator('#accent-under-forced-theme').evaluate((element) =>
    getComputedStyle(element).getPropertyValue('--dds-color-accent').trim()
  );
  const darkSecond = await accentOn(specimen(page, '2'));

  expect(forced).not.toBe('');
  expect(
    forced,
    'the forced-light panel kept the dark accent 2 — the theme block did not win ' +
      'back the per-slot value, or the selection rule did not win the accent'
  ).not.toBe(darkSecond);
});
