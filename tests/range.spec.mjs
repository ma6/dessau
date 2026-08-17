/**
 * Dessau — a range slider's value is real text beside it, and it is announced.
 *
 *   npx playwright test tests/range.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * `.dds-range`'s own contract says the current value is always shown as text
 * beside the slider and announced — a slider alone says nothing to anyone who
 * cannot see where the thumb is. Nothing wired that contract up (#116): the
 * `<output for>` in the reference markup was static, and never moved when the
 * slider did.
 *
 * The announcement is checked separately from the visible text, and debounced
 * rather than immediate on purpose: dragging fires `input` continuously, and a
 * value spoken dozens of times a second while the pointer is still moving is
 * the same failure charcount's own debounce exists to avoid.
 *
 * @covers range
 *
 */

import { test, expect } from '@playwright/test';

const COMPONENTS = '/reference/components.html';

test('the visible value updates as the slider moves', async ({ page }) => {
  await page.goto(COMPONENTS);

  const input = page.locator('#threshold');
  const output = page.locator('output[for="threshold"]');

  await expect(output).toHaveText('70 %');

  await input.focus();
  await input.press('ArrowRight');

  // Step is 5, so one ArrowRight moves 70 -> 75. Visible text updates
  // immediately — no debounce on the sighted-facing part.
  await expect(output).toHaveText('75 %');
});

test('the value is announced once the slider settles, with the field label', async ({ page }) => {
  await page.goto(COMPONENTS);

  const input = page.locator('#threshold');
  const live = page.locator('div.dds-sr-only[aria-live="polite"][aria-atomic="true"]');

  await input.focus();
  await input.press('ArrowRight');
  await input.press('ArrowRight');
  await input.press('ArrowRight');

  // The debounce coalesces three rapid steps into the one settled
  // announcement — not the label with an intermediate value (75 or 80) that
  // a per-keystroke announcement would have left behind.
  await expect(live).toContainText('Warnschwelle: 85 %', { timeout: 2000 });
});

test('rapid steps do not each get their own announcement', async ({ page }) => {
  await page.goto(COMPONENTS);

  const input = page.locator('#threshold');

  // Force the lazily-created live region into existence first, and let its
  // first debounced announcement settle, so the observer below has a real
  // node to watch before the steps it is actually measuring.
  await input.focus();
  await input.press('ArrowRight');
  await expect(
    page.locator('div.dds-sr-only[aria-live="polite"][aria-atomic="true"]')
  ).toContainText('75', { timeout: 2000 });

  const announced = await page.evaluate(async () => {
    const seen = [];
    const region = document.querySelector(
      'div.dds-sr-only[aria-live="polite"][aria-atomic="true"]'
    );
    const observer = new MutationObserver(() => {
      if (region.textContent) seen.push(region.textContent);
    });
    observer.observe(region, { childList: true, characterData: true, subtree: true });

    const field = document.getElementById('threshold');
    for (let i = 0; i < 3; i += 1) {
      field.value = Number(field.value) + 5;
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }

    await new Promise((resolve) => setTimeout(resolve, 900));
    observer.disconnect();
    return seen;
  });

  // Exactly one settled announcement for the three steps, not one per step.
  expect(announced.length).toBe(1);
  expect(announced[0]).toContain('90');
});

test('a unit is only added where the input opts in', async ({ page }) => {
  await page.goto(COMPONENTS);

  // The reference's own range carries data-dds-range-unit=" %" — verified
  // directly, since a component with no such attribute should show the bare
  // number and this page has only the one instance to check it against.
  const unit = await page.locator('#threshold').getAttribute('data-dds-range-unit');
  expect(unit).toBe(' %');
});
