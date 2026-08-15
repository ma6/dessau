/**
 * Dessau — form validation places and counts its errors correctly.
 *
 *   npx playwright test tests/form-validation.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * A radio group is one question. The validation pattern treated each radio as its
 * own field, so a required group produced one identical message per option —
 * "Enter how we should reply" printed beside every radio — and each message was
 * inserted with `insertAdjacentElement('afterend')` on an input that lives inside
 * its own `<label>`, which put the error text between the radio and the word it
 * labels:
 *
 *     ( ) [!] Enter how we should reply  By email
 *     ( ) [!] Enter how we should reply  By phone
 *
 * Both halves of that are invisible to a static check: the DOM is only wrong after
 * a failed submit, and the message text is generated at that moment.
 *
 * @covers form-validation
 *
 */

import { test, expect } from '@playwright/test';

const PATTERNS = '/reference/patterns.html';

test('a required radio group gets exactly one error, after the options', async ({ page }) => {
  await page.goto(PATTERNS);

  /**
   * Scoped to the validation section. The same question is asked again in the wizard,
   * so an unscoped locator matches two fieldsets and fails on strict mode — which
   * reads as the component being wrong rather than the selector.
   */
  const group = page
    .locator('#validation .dds-fieldgroup')
    .filter({ hasText: 'How should we reply?' })
    .first();

  await expect(group).toBeVisible();

  // Submit the step without choosing, which is what triggers validation.
  const form = group.locator('xpath=ancestor::form');
  await form.locator('button[type="submit"], [data-dds-wizard-next]').first().click();

  const errors = group.locator('.dds-error:not([hidden])');
  await expect(
    errors,
    'one message per radio instead of one per group'
  ).toHaveCount(1);

  /**
   * The message must come after every option, not inside a label. Comparing document
   * order is the check that actually matters — a message with the right text in the
   * wrong place still reads as nonsense.
   */
  const afterLastOption = await page.evaluate(() => {
    const group_ = [
      ...document.querySelectorAll('#validation .dds-fieldgroup'),
    ].find((f) => f.textContent.includes('How should we reply?'));
    if (!group_) return null;

    const error = group_.querySelector('.dds-error:not([hidden])');
    const options = [...group_.querySelectorAll('input[type="radio"]')];
    if (!error || !options.length) return null;

    return {
      insideALabel: !!error.closest('label'),
      afterEveryOption: options.every(
        (option) =>
          option.compareDocumentPosition(error) & Node.DOCUMENT_POSITION_FOLLOWING
      ),
    };
  });

  expect(afterLastOption).not.toBeNull();
  expect(
    afterLastOption.insideALabel,
    'the error was inserted inside a label, splitting the radio from its text'
  ).toBe(false);
  expect(
    afterLastOption.afterEveryOption,
    'the error is not after every option, so it is read before the choices it is about'
  ).toBe(true);
});

test('the error summary lists a radio group once', async ({ page }) => {
  await page.goto(PATTERNS);

  const form = page.locator('#validation form[data-dds-validate]').first();

  await form.locator('button[type="submit"], [data-dds-wizard-next]').first().click();

  const summary = form.locator('[data-dds-error-summary]');
  if ((await summary.count()) === 0) return; // this step may not render a summary

  const entries = summary.locator('a', { hasText: /how we should reply/i });
  await expect(
    entries,
    'the summary repeated one question once per radio option'
  ).toHaveCount(1);
});

test('an error is announced programmatically, not only coloured', async ({ page }) => {
  await page.goto(PATTERNS);

  /**
   * Exercised through the validation form, which is where this property is defined.
   *
   * It was first written against the wizard, which reaches the same behaviour through
   * its own step-validation code — the most indirect available route to a rule that is
   * not about wizards at all. It failed on WebKit and passed on Chromium, and the
   * failure said nothing useful about the rule being tested.
   *
   * Whether the wizard's own path sets the programmatic state on every engine is a
   * separate question, and it has its own issue rather than being smuggled in here.
   */
  const form = page.locator('#validation form[data-dds-validate]').first();
  await form.locator('button[type="submit"]').first().click();

  const name = page.locator('#v-name');

  // The visible message first: it is the observable outcome, and waiting for it means
  // the assertions below are not racing the handler that produces both.
  await expect(form.locator('.dds-error:not([hidden])').first()).toBeVisible();

  /**
   * Colour and an icon are not enough on their own. The programmatic state is what a
   * screen reader reads: `aria-invalid` says something is wrong, and
   * `aria-errormessage` or `aria-describedby` says what.
   */
  await expect(name).toHaveAttribute('aria-invalid', 'true');

  const described = await name.evaluate((element) => {
    const ids = [
      ...(element.getAttribute('aria-errormessage') || '').split(/\s+/),
      ...(element.getAttribute('aria-describedby') || '').split(/\s+/),
    ].filter(Boolean);

    return ids.some((id) => {
      const target = document.getElementById(id);
      return target && !target.hidden && target.textContent.trim() !== '';
    });
  });

  expect(
    described,
    'the field is marked invalid but points at no message with any text in it'
  ).toBe(true);
});

/**
 * A corrected field goes back to looking correct.
 *
 * `clearError()` empties the message text and sets `hidden` on the paragraph, and
 * both of those were true while the icon stayed on screen: `.dds-error` sets
 * `display: flex` in `dds.components`, and the rule that hides `[hidden]` is in
 * `dds.base`, which is an earlier layer and therefore loses regardless of how it
 * is written. What was left under the corrected field was the error glyph alone,
 * in error red, saying something is still wrong.
 *
 * Only a browser can see this. The DOM is exactly what it should be — the element
 * is `hidden` and its text is empty — so the failure exists solely in the
 * cascade, and the assertion has to be about layout, not about attributes.
 */
test('a corrected field leaves no part of the error behind', async ({ page }) => {
  await page.goto(PATTERNS);

  const form = page.locator('#validation form[data-dds-validate]').first();
  await form.locator('button[type="submit"]').first().click();

  const name = page.locator('#v-name');
  const error = form.locator('[data-dds-error-for="v-name"]');
  await expect(error).toBeVisible();

  // Correct it. The pattern clears the error the moment the value becomes valid.
  await name.fill('Ilva Bergström');
  await expect(error).toBeHidden();

  /**
   * `toBeHidden()` alone would have passed while the bug was live: Playwright
   * reads the `hidden` attribute. The box is the thing to measure.
   */
  const box = await error.evaluate((element) => {
    const rects = [...element.getClientRects()];
    const icon = element.querySelector('.dds-icon');
    return {
      rects: rects.length,
      iconRects: icon ? icon.getClientRects().length : 0,
      display: getComputedStyle(element).display,
    };
  });

  expect(box.display, 'the error still generates a box after being cleared').toBe('none');
  expect(box.rects, 'the cleared error still occupies space').toBe(0);
  expect(box.iconRects, 'the error icon is still painted under a corrected field').toBe(0);
});
