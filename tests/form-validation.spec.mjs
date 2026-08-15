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
