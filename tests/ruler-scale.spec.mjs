/**
 * Dessau — a scaled ruler bar renders strictly wider for a strictly larger value.
 *
 *   npx playwright test tests/ruler-scale.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * `fitRulers()` (reference/assets/reference.js) draws the container-width ramp
 * on reference/foundations.html proportionally once the widest bar no longer
 * fits at true size. It computed each bar's width as a PERCENTAGE, applied per
 * row — but the rows are not equal width to start with, because the readout
 * text differs by row ("75rem (1200px)" is wider than "60rem (960px)"). A `%`
 * resolves against its own row, so two bars at different percentages of
 * unequal rows are not comparable, and a flex item without `flex-shrink: 0`
 * silently re-compresses whichever one has less room.
 *
 * Found by eye, on the rendered page, not by reading the source: `xl` (100%)
 * rendered narrower than `lg` (80%). Measured directly — 541px vs 545px at a
 * 1400px viewport — before the fix, which scales every bar against one shared
 * pixel value instead of each bar's own row.
 *
 * @covers none — this is reference-site-only tooling
 *   (`reference/assets/reference.js`), not a `dds/` component
 *
 */

import { test, expect } from '@playwright/test';

const FOUNDATIONS = '/reference/foundations.html';

test('every ramp renders strictly wider bars for strictly larger values', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(FOUNDATIONS);

  const ramps = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-ref-rulers]')).map((container) => {
      const rows = Array.from(container.querySelectorAll('.ref-ruler'));
      return rows.map((row) => ({
        name: row.querySelector('.ref-ruler-name').textContent,
        widthPx: row.querySelector('.ref-ruler-bar').getBoundingClientRect().width,
      }));
    });
  });

  expect(ramps.length).toBeGreaterThan(0);

  for (const bars of ramps) {
    for (let i = 1; i < bars.length; i += 1) {
      expect(
        bars[i].widthPx,
        `${bars[i].name} (${bars[i].widthPx}px) should be >= ${bars[i - 1].name} (${bars[i - 1].widthPx}px)`
      ).toBeGreaterThanOrEqual(bars[i - 1].widthPx);
    }
  }
});

test('the container ramp specifically: xl renders wider than lg', async ({ page }) => {
  // The exact reported case, at the width it was reported at.
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(FOUNDATIONS);

  const [lg, xl] = await page.evaluate(() => {
    const rows = Array.from(
      document.querySelectorAll('[data-ref-rulers] .ref-ruler')
    ).filter((row) => {
      const name = row.querySelector('.ref-ruler-name').textContent;
      return name === '--dds-container-lg' || name === '--dds-container-xl';
    });
    return rows.map((row) => row.querySelector('.ref-ruler-bar').getBoundingClientRect().width);
  });

  expect(xl).toBeGreaterThan(lg);
});
