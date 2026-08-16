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

test('the term is on the page, and no word is inside the button', async ({ page }) => {
  await page.goto(PAGE);

  const specimen = page.locator('#tooltip [data-ref-code]').first();
  await expect(specimen).toContainText('Aufbewahrungsdauer');

  /* What a sighted reader sees inside the trigger, which is the thing under
     discussion: an icon and nothing else. The button's own `textContent` is not
     that — it holds the `.dds-sr-only` name, which is the point of the name.
     `getByText(term, { exact: true })` was the first attempt and matched
     nothing on any engine, because the term is a bare text node in the
     paragraph rather than an element of its own. Wrapping it in a `<span>` to
     make the assertion easy would have put markup on the page for the test's
     benefit and left the actual claim — no word in the button — unasserted. */
  const visibleTriggerText = await specimen
    .locator('button[popovertarget]')
    .evaluate((button) =>
      Array.from(button.childNodes)
        .filter(
          (node) =>
            !(node.nodeType === Node.ELEMENT_NODE && node.classList.contains('dds-sr-only'))
        )
        .map((node) => node.textContent)
        .join('')
        .trim()
    );

  expect(visibleTriggerText, 'the trigger shows a word, not just an icon').toBe('');
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
