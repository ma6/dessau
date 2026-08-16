/**
 * Dessau — every bar in a chart starts and ends in the same place.
 *
 *   npx playwright test tests/chart.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * `.dds-chart-row` used to declare its own `grid-template-columns`, so every row
 * was an independent grid: the label column was measured against that row's label
 * and the value column against that row's number. Four labels of four lengths
 * therefore gave four different starting points, and the 39% bar was drawn
 * beginning further right than the 100% one (#89).
 *
 * Comparing lengths that do not share an origin is the one thing the eye cannot
 * do, and it is the only thing a bar chart is for — so this was not untidiness,
 * it was the chart misreading its own data. Every static check passed: the tokens
 * were right, the contrast was right, the markup was right, and the picture was
 * wrong.
 *
 * A browser is the only place the failure exists, because it is a fact about
 * resolved track sizes rather than about the source.
 *
 * @covers none — the chart is CSS with no enhancement. What is asserted here is
 *   the geometry the CSS is for.
 */

import { test, expect } from '@playwright/test';

test('every track in a chart shares its left and right edge', async ({ page }) => {
  await page.goto('/reference/content.html');

  const edges = await page.locator('.dds-chart-bars').first().evaluate((bars) =>
    Array.from(bars.querySelectorAll('.dds-chart-track')).map((track) => {
      const box = track.getBoundingClientRect();
      // Rounded: sub-pixel differences are the layout engine, not the layout.
      return { left: Math.round(box.left), right: Math.round(box.right) };
    })
  );

  expect(edges.length).toBeGreaterThan(2);

  for (const edge of edges) {
    expect(edge.left, 'a bar starts somewhere its neighbours do not').toBe(edges[0].left);
    expect(edge.right, 'a bar ends somewhere its neighbours do not').toBe(edges[0].right);
  }
});

test('the labels still wrap rather than widening the column past its share', async ({ page }) => {
  await page.goto('/reference/content.html');

  /* The other half of the fix. One shared grid could just as easily have been
     `max-content`, which aligns the bars perfectly and lets one long label take
     the row — the failure the cap was introduced to prevent, now with every bar
     paying for it instead of one. */
  const share = await page.locator('.dds-chart-bars').first().evaluate((bars) => {
    const label = bars.querySelector('.dds-chart-label');
    return label.getBoundingClientRect().width / bars.getBoundingClientRect().width;
  });

  expect(share).toBeLessThanOrEqual(0.36);
});
