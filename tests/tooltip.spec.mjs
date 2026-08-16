/**
 * Dessau — the tooltip trigger is the icon, and it says what it explains.
 *
 *   npx playwright test tests/tooltip.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * The specimen used to wrap the whole term in `.dds-button-secondary`, so
 * "Aufbewahrungsdauer" — a term, not an action — was drawn as a bordered button
 * that promised to do something when pressed (#90). It also inverted the
 * component's own rule: a tooltip is supplementary to a control that *already*
 * has a name, and turning the label into a button invents the control to hang it
 * on.
 *
 * Both of the things asserted here are invisible in a screenshot and absent from
 * every static check. An accessible name is computed, not written — the name here
 * comes from a `.dds-sr-only` span the eye never sees — and a description
 * referenced on a closed popover either reaches the accessibility tree or does
 * not, with nothing on screen either way.
 *
 * @covers none — the tooltip is markup and CSS over `popover`, with no
 *   enhancement. What is asserted is the contract the specification states.
 */

import { test, expect } from '@playwright/test';

const PAGE = '/reference/components.html';

test('the term is not inside the button', async ({ page }) => {
  await page.goto(PAGE);

  const specimen = page.locator('#tooltip [data-ref-code]').first();

  await expect(specimen.getByText('Aufbewahrungsdauer', { exact: true })).toBeVisible();

  /* The button holds an icon and a visually hidden name — nothing a sighted
     reader reads as a word. A trigger with the term inside it is the bug. */
  const triggerText = await specimen
    .locator('button[popovertarget]')
    .evaluate((button) => button.textContent.trim());

  expect(triggerText).not.toBe('Aufbewahrungsdauer');
});

test('the trigger is named after the term, not "Info"', async ({ page }) => {
  await page.goto(PAGE);

  const trigger = page.locator('#tooltip button[popovertarget]').first();

  /* Read out of context — in a list of controls, in a rotor — "Info, button"
     three times on a page is three identical controls. */
  await expect(trigger).toHaveAccessibleName(/Aufbewahrungsdauer/);
});

test('the tooltip text is in the accessibility tree before it is opened', async ({ page }) => {
  await page.goto(PAGE);

  const trigger = page.locator('#tooltip button[popovertarget]').first();
  const tooltip = page.locator('#tip-retention');

  // Closed: a popover shows nothing and, on opening, moves no focus and
  // announces nothing. `aria-describedby` is what makes the text reachable.
  await expect(tooltip).toBeHidden();
  await expect(trigger).toHaveAccessibleDescription(/zehn Jahre/);
});

test('the trigger clears the target size floor', async ({ page }) => {
  await page.goto(PAGE);

  const box = await page.locator('#tooltip button[popovertarget]').first().boundingBox();

  // WCAG 2.2 2.5.8 — 24x24 CSS pixels is the floor, not the target.
  expect(box.width).toBeGreaterThanOrEqual(24);
  expect(box.height).toBeGreaterThanOrEqual(24);
});
