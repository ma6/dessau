/**
 * Dessau — a wizard step that fails validation says so programmatically.
 *
 *   npx playwright test tests/wizard.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * The wizard validates the current step itself rather than letting the form
 * submit, because advancing is not submitting. That makes it the one place in
 * Dessau where the error presentation is driven by hand, and a hand-driven path
 * is the one that quietly stops doing half its job.
 *
 * An earlier assertion about this failed on WebKit and passed on Chromium, with
 * no error message present at all — see #9. Two things came out of chasing it.
 *
 * The first is a real defect, and it is visible in the source: the wizard called
 * `showError(field, field.validationMessage)`. That is the browser's own
 * wording, in the browser's own UI language, so the same empty required field
 * was described one way on a step and another way on the form around it — and
 * `validationMessage` is not guaranteed to be a sentence. When it is empty, the
 * error element is unhidden with nothing in it: `aria-invalid` set,
 * `aria-errormessage` pointing at an element with no text, a red line on screen
 * with no words in it, and nothing for a screen reader to announce. That is
 * exactly the reported symptom.
 *
 * The second is about the assertion itself. It read `page.accessibility.snapshot()`,
 * which is a Chromium-oriented API — asking it what WebKit exposes is asking the
 * wrong question of the wrong engine. Everything below asserts on attributes and
 * on text, which both engines implement identically and which is what assistive
 * technology reads anyway.
 *
 * @covers wizard
 *
 */

import { test, expect } from '@playwright/test';

const PATTERNS = '/reference/patterns.html';

const wizard = (page) => page.locator('form[data-dds-wizard]');
const step = (page, index) => wizard(page).locator('[data-dds-wizard-step]').nth(index);

test('a step with empty required fields does not advance', async ({ page }) => {
  await page.goto(PATTERNS);

  await step(page, 0).locator('[data-dds-wizard-next]').click();

  await expect(step(page, 0)).toBeVisible();
  await expect(step(page, 1)).toBeHidden();
});

test('the failure is programmatic, not only visual', async ({ page }) => {
  await page.goto(PATTERNS);

  const name = page.locator('#w-name');
  await step(page, 0).locator('[data-dds-wizard-next]').click();

  await expect(name).toHaveAttribute('aria-invalid', 'true');

  /**
   * `aria-errormessage` has to point at something, and that something has to
   * have words in it. Half of this pair was what #9 was actually about: the
   * attribute was set, the element existed, and it was empty.
   */
  const errorId = await name.getAttribute('aria-errormessage');
  expect(errorId, 'no aria-errormessage on the invalid field').toBeTruthy();

  const error = page.locator(`#${errorId}`);
  await expect(error).toBeVisible();
  await expect(error).not.toBeEmpty();
});

test('the message is the one DDS writes, not the one the browser writes', async ({ page }) => {
  await page.goto(PATTERNS);

  await step(page, 0).locator('[data-dds-wizard-next]').click();

  /**
   * The demo sets `data-dds-label="your full name"`, so DDS's `valueMissing`
   * template resolves to a sentence nothing else could produce. A browser's own
   * message for the same field is "Please fill out this field" or its
   * translation — different words, and different words per engine and per UI
   * language, which is why asserting the DDS wording is the assertion that
   * distinguishes the two sources.
   */
  const errorId = await page.locator('#w-name').getAttribute('aria-errormessage');
  await expect(page.locator(`#${errorId}`)).toContainText('Enter your full name');
});

test('focus goes to the first invalid field, and the count is announced', async ({ page }) => {
  await page.goto(PATTERNS);

  await step(page, 0).locator('[data-dds-wizard-next]').click();

  await expect(page.locator('#w-name')).toBeFocused();

  /**
   * DDS's own live region, not any polite region on the page — the same
   * distinction tests/language.spec.mjs had to learn. This one is assertive,
   * because a blocked action is not an aside.
   */
  const live = page.locator('div.dds-sr-only[aria-live="assertive"][aria-atomic="true"]');
  await expect(live).toContainText(/2 problems on this step/);
});

test('a completed step advances, moves focus to the heading, and updates the position', async ({
  page,
}) => {
  await page.goto(PATTERNS);

  await page.locator('#w-name').fill('Ada Lovelace');
  await page.locator('#w-email').fill('ada@example.org');
  await step(page, 0).locator('[data-dds-wizard-next]').click();

  await expect(step(page, 1)).toBeVisible();
  await expect(step(page, 0)).toBeHidden();

  /**
   * Focus on the new step's heading. Without it, focus is left on a button that
   * is now `hidden`, which drops it to the top of the document — a
   * screen-reader user is told nothing happened and a keyboard user starts
   * again from the beginning of the page.
   */
  await expect(step(page, 1).locator('[data-dds-wizard-heading]')).toBeFocused();
});

test('going back never discards what was typed', async ({ page }) => {
  await page.goto(PATTERNS);

  await page.locator('#w-name').fill('Ada Lovelace');
  await page.locator('#w-email').fill('ada@example.org');
  await step(page, 0).locator('[data-dds-wizard-next]').click();

  await step(page, 1).locator('[data-dds-wizard-back]').click();

  /**
   * Steps are hidden, never emptied. Break this once and the user learns not to
   * go back, which means they stop checking their answers — a correctness
   * problem wearing a convenience problem's clothes.
   */
  await expect(page.locator('#w-name')).toHaveValue('Ada Lovelace');
  await expect(page.locator('#w-email')).toHaveValue('ada@example.org');
});

/**
 * Enter does nothing on any step but the last (#103, `DECISIONS.md` #046).
 * Load-bearing three separate ways at once — the Continue button forced to
 * `type="button"`, the final step's submit button `disabled` while hidden, and
 * no `keydown` handler added to recover the behaviour — so a change to any one
 * of them is invisible in the source and only shows up by pressing the key.
 */
test('Enter in a field neither advances the step nor submits', async ({ page }) => {
  await page.goto(PATTERNS);

  const name = page.locator('#w-name');
  await name.fill('Ada Lovelace');
  await page.locator('#w-email').fill('ada@example.org');

  await name.press('Enter');

  await expect(step(page, 0)).toBeVisible();
  await expect(step(page, 1)).toBeHidden();
  await expect(name).toHaveValue('Ada Lovelace');
});

test('a wizard field carries no enterkeyhint — Enter does nothing, so nothing is promised', async ({
  page,
}) => {
  await page.goto(PATTERNS);

  await expect(page.locator('#w-name')).not.toHaveAttribute('enterkeyhint');
  await expect(page.locator('#w-email')).not.toHaveAttribute('enterkeyhint');
});
