/**
 * Dessau — the Motion section's live demo plays the real tokens, each track
 * independently, and respects prefers-reduced-motion.
 *
 *   npx playwright test tests/motion-demo.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * The whole point of `reference/foundations.html`'s Motion demo (#138) is that
 * it plays the actual `--dds-duration-*`/`--dds-ease-*` tokens rather than a
 * hand-tuned approximation, that each track has its own `Play` control rather
 * than one shared button that moves every dot at once (#139 — a single
 * "replay everything" control cannot answer "what does THIS one look like on
 * its own"), and that it goes static under reduced motion the same way every
 * real component does — via the global rule in `base.css`, with no extra
 * JavaScript check of its own. All three are easy to get only-apparently
 * right: a demo can look like it is reading live values while actually just
 * echoing hand-typed text beside it; a "per track" control can still be wired
 * to a shared handler that moves every dot; and a demo can look calm at rest
 * while still animating exactly as much as ever once played, if the global
 * CSS rule happens not to reach it (a JS-driven Web Animations API call would
 * silently escape it, for one).
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

test('each track has its own Play control, named for the token it plays', async ({ page }) => {
  await page.goto(FOUNDATIONS);

  const tracks = page.locator('.ref-motion-track');
  const count = await tracks.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i += 1) {
    const track = tracks.nth(i);
    const name = await track.locator('.ref-motion-name').textContent();
    const button = track.locator('[data-ref-motion-play]');
    await expect(button).toHaveAccessibleName(new RegExp('^Play ' + name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('playing one track moves only that track\'s dot, not the others', async ({ page }) => {
  await page.goto(FOUNDATIONS);

  const dots = page.locator('[data-ref-motion-dot]');
  const dotCount = await dots.count();
  const before = await dots.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().left));

  // Play only the second track (--dds-duration-fast), not the first.
  await page.locator('.ref-motion-track').nth(1).locator('[data-ref-motion-play]').click();
  await page.waitForTimeout(400);

  const after = await dots.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().left));

  for (let i = 0; i < dotCount; i += 1) {
    if (i === 1) {
      expect(after[i], 'the played track\'s dot should have moved').toBeGreaterThan(before[i]);
    } else {
      expect(after[i], `track ${i} should not move when a different track is played`).toBeCloseTo(before[i], 0);
    }
  }
});

test('reduced motion collapses a played track\'s transition to effectively instant', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(FOUNDATIONS);

  const track = page.locator('.ref-motion-track').last(); // --dds-ease-emphasis
  const dot = track.locator('[data-ref-motion-dot]');
  const before = await dot.evaluate((el) => el.getBoundingClientRect().left);

  await track.locator('[data-ref-motion-play]').click();
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
