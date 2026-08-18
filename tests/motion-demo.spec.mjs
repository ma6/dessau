/**
 * Dessau — the Motion section's live demo plays the real tokens, and respects
 * prefers-reduced-motion.
 *
 *   npx playwright test tests/motion-demo.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * The whole point of `reference/foundations.html`'s Motion demo (#138) is that
 * it plays the actual `--dds-duration-*`/`--dds-ease-*` tokens rather than a
 * hand-tuned approximation, and that it goes static under reduced motion the
 * same way every real component does — via the global rule in `base.css`, with
 * no extra JavaScript check of its own. Both are easy to get only-apparently
 * right: a demo can look like it is reading live values while actually just
 * echoing hand-typed text beside it, and a demo can look calm at rest while
 * still animating exactly as much as ever once played, if the global CSS rule
 * happens not to reach it (a JS-driven Web Animations API call would silently
 * escape it, for one).
 *
 * @covers none — this is reference-site-only tooling
 *   (`reference/assets/reference.js`), not a `dds/` component
 */

import { test, expect } from '@playwright/test';

const FOUNDATIONS = '/reference/foundations.html';

test('each track reads its resolved value from the live computed style', async ({ page }) => {
  await page.goto(FOUNDATIONS);

  const readouts = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-ref-motion-dot]')).map((dot) => ({
      token: dot.dataset.refMotionToken,
      readout: dot.closest('.ref-motion-track').querySelector('[data-ref-motion-readout]').textContent,
      computed: getComputedStyle(document.documentElement).getPropertyValue(dot.dataset.refMotionToken).trim(),
    }));
  });

  expect(readouts.length).toBeGreaterThan(0);
  for (const { token, readout, computed } of readouts) {
    expect(readout, `${token} readout should equal its live computed value`).toBe(computed);
  }
});

test('replay moves the dot from the start of the rail to the end', async ({ page }) => {
  await page.goto(FOUNDATIONS);

  const dot = page.locator('[data-ref-motion-dot]').first();
  const before = await dot.evaluate((el) => el.getBoundingClientRect().left);

  await page.locator('[data-ref-motion-replay]').click();
  // The slowest token demonstrated is --dds-duration-slow (320ms); give it room.
  await page.waitForTimeout(500);

  const after = await dot.evaluate((el) => el.getBoundingClientRect().left);
  expect(after, 'dot should have moved right after Replay').toBeGreaterThan(before);
});

test('reduced motion collapses the transition to effectively instant', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(FOUNDATIONS);

  const dot = page.locator('[data-ref-motion-dot]').last(); // --dds-ease-emphasis track
  const before = await dot.evaluate((el) => el.getBoundingClientRect().left);

  await page.locator('[data-ref-motion-replay]').click();
  // No timeout: reduced motion collapses transition-duration to ~0.01ms
  // (base.css), so the end state should already be reached on the next frame.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  const after = await dot.evaluate((el) => el.getBoundingClientRect().left);
  const maxTravel = await dot.evaluate((el) => {
    const rail = el.closest('.ref-motion-rail').getBoundingClientRect();
    const self = el.getBoundingClientRect();
    // The dot cannot travel the full rail width — its own width and the
    // inset on both ends are never part of the distance covered.
    return rail.width - self.width - 2 * parseFloat(getComputedStyle(el).insetInlineStart);
  });

  expect(after - before, 'dot should already be at (near) its end position').toBeGreaterThan(maxTravel * 0.9);
});
