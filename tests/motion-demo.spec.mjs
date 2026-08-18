/**
 * Dessau — the Motion table's live Demo column plays the real tokens, each
 * row independently, returns to its start position after a pause, and
 * respects prefers-reduced-motion.
 *
 *   npx playwright test tests/motion-demo.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * The Motion section on `reference/foundations.html` used to be two blocks —
 * a live demo, then a token table — stating the same seven values twice
 * (#138, #139). Folding the demo into the table's own Demo column (#140)
 * means the Value column now has to be read live rather than typed twice,
 * each row's dot has to be wired to derive its own duration/easing from
 * nothing but its `data-ref-motion-token`, and the dot has to return to its
 * start position on its own after a pause rather than sitting at the end
 * forever. All three are easy to get only-apparently right in the same ways
 * the previous version of this test already caught once, plus a new one:
 * "returns after a pause" could silently regress into "never returns" or
 * "returns instantly with no pause to actually see the end state."
 *
 * @covers none — this is reference-site-only tooling
 *   (`reference/assets/reference.js`), not a `dds/` component
 */

import { test, expect } from '@playwright/test';

const FOUNDATIONS = '/reference/foundations.html';

test('each row reads its resolved value from the live computed style', async ({ page }) => {
  await page.goto(FOUNDATIONS);

  const readouts = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-ref-motion-row]')).map((row) => {
      const token = row.dataset.refMotionToken;
      return {
        token,
        readout: row.querySelector('[data-ref-motion-readout]').textContent,
        computed: getComputedStyle(document.documentElement).getPropertyValue(token).trim(),
      };
    });
  });

  expect(readouts.length).toBeGreaterThan(0);
  for (const { token, readout, computed } of readouts) {
    expect(readout, `${token} readout should equal its live computed value`).toBe(computed);
  }
});

test('each row has its own Play control, named for the token it plays', async ({ page }) => {
  await page.goto(FOUNDATIONS);

  const rows = page.locator('[data-ref-motion-row]');
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i += 1) {
    const row = rows.nth(i);
    const token = await row.getAttribute('data-ref-motion-token');
    const button = row.locator('[data-ref-motion-play]');
    await expect(button).toHaveAccessibleName('Play ' + token);
  }
});

test('playing one row moves only that row\'s dot, not the others', async ({ page }) => {
  await page.goto(FOUNDATIONS);

  const dots = page.locator('[data-ref-motion-dot]');
  const dotCount = await dots.count();
  const before = await dots.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().left));

  // Play only the second row (--dds-duration-fast), not the first.
  await page.locator('[data-ref-motion-row]').nth(1).locator('[data-ref-motion-play]').click();
  await page.waitForTimeout(400);

  const after = await dots.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().left));

  for (let i = 0; i < dotCount; i += 1) {
    if (i === 1) {
      expect(after[i], 'the played row\'s dot should have moved').toBeGreaterThan(before[i]);
    } else {
      expect(after[i], `row ${i} should not move when a different row is played`).toBeCloseTo(before[i], 0);
    }
  }
});

test('a played dot holds at the end, then returns to its start position on its own', async ({ page }) => {
  await page.goto(FOUNDATIONS);

  const row = page.locator('[data-ref-motion-row]').first(); // --dds-duration-instant: 80ms
  const dot = row.locator('[data-ref-motion-dot]');
  const start = await dot.evaluate((el) => el.getBoundingClientRect().left);

  await row.locator('[data-ref-motion-play]').click();

  // Shortly after arriving (well within the hold), it should still be held
  // at the end, not already on its way back.
  await page.waitForTimeout(300);
  const held = await dot.evaluate((el) => el.getBoundingClientRect().left);
  expect(held, 'dot should still be held at the end shortly after arriving').toBeGreaterThan(start);

  // The hold is 900ms; well after it plus the (short) return trip, the dot
  // should be back where it started.
  await page.waitForTimeout(900);
  const returned = await dot.evaluate((el) => el.getBoundingClientRect().left);
  expect(returned, 'dot should have returned to its start position').toBeCloseTo(start, 0);
});

test('reduced motion collapses a played row\'s transition to effectively instant', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(FOUNDATIONS);

  const row = page.locator('[data-ref-motion-row]').last(); // --dds-ease-emphasis
  const dot = row.locator('[data-ref-motion-dot]');
  const before = await dot.evaluate((el) => el.getBoundingClientRect().left);

  await row.locator('[data-ref-motion-play]').click();
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
