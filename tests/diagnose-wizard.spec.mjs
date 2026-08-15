/**
 * TEMPORARY — a probe, not a test. Delete once #9 is answered.
 *
 *   npx playwright test tests/diagnose-wizard.spec.mjs
 *
 * On WebKit, clicking Continue on step 1 of the wizard with both required
 * fields empty leaves `aria-invalid` unset, no error element, and focus where it
 * was. On Chromium the same click does all three. Step 1 stays on screen in both
 * — so the click is arriving somewhere and the advance is being prevented.
 *
 * Three explanations fit that, and they need different fixes:
 *
 *   A. the enhancement never ran on this element, so there is no handler;
 *   B. the handler ran and `DDS.formValidation` was not there, so it took the
 *      `reportValidity()` fallback, which sets no ARIA of its own;
 *   C. the handler never ran because the click never landed on the button —
 *      `.ref-section` uses `content-visibility: auto`, so the page grows while
 *      Playwright scrolls the element into view, and a click dispatched at
 *      coordinates measured a moment earlier lands somewhere else. That is the
 *      trap #10 is about, and it would explain the two other WebKit-only
 *      failures on this run, both of which are also "a click did nothing".
 *
 * The discriminator is a synthetic `element.click()` from inside the page: it
 * runs the handler with no scrolling, no hit-testing and no coordinates. If the
 * synthetic click sets `aria-invalid` and the real one does not, it is C.
 *
 * @covers none — a probe for #9. It asserts nothing and is deleted once the
 *   question it asks has an answer.
 *
 */

import { test, expect } from '@playwright/test';

test('#9 probe: what the wizard sees on this engine', async ({ page }, testInfo) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(`${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(`console: ${message.text()}`);
  });

  await page.goto('/reference/patterns.html');

  const before = await page.evaluate(() => {
    const root = document.querySelector('form[data-dds-wizard]');
    const first = root.querySelector('[data-dds-wizard-step]');
    const fields = [...first.querySelectorAll('input, select, textarea')];

    return {
      wizardEnhanced: root.dataset.ddsEnhanced || null,
      formValidationPresent: typeof window.DDS.formValidation,
      messageForPresent: typeof (window.DDS.formValidation || {}).messageFor,
      registered: window.DDS.version || null,
      fields: fields.map((field) => ({
        id: field.id,
        willValidate: field.willValidate,
        disabled: field.disabled,
        valid: field.checkValidity(),
        validationMessage: field.validationMessage,
      })),
    };
  });

  // The synthetic click: the handler, with nothing between it and us.
  const afterSynthetic = await page.evaluate(() => {
    document.querySelector('[data-dds-wizard-next]').click();
    const name = document.querySelector('#w-name');
    return {
      ariaInvalid: name.getAttribute('aria-invalid'),
      ariaErrormessage: name.getAttribute('aria-errormessage'),
      focused: document.activeElement ? document.activeElement.id : null,
      errorText: (document.querySelector('[data-dds-error-for="w-name"]') || {}).textContent || null,
    };
  });

  // Reload, then the real one: scrolled to, hit-tested, dispatched at a point.
  await page.reload();
  await page.locator('[data-dds-wizard-next]').first().click();

  const afterReal = await page.evaluate(() => {
    const name = document.querySelector('#w-name');
    return {
      ariaInvalid: name.getAttribute('aria-invalid'),
      ariaErrormessage: name.getAttribute('aria-errormessage'),
      focused: document.activeElement ? document.activeElement.id : null,
      errorText: (document.querySelector('[data-dds-error-for="w-name"]') || {}).textContent || null,
    };
  });

  const report = JSON.stringify({ before, afterSynthetic, afterReal, pageErrors }, null, 2);
  console.log(`\n=== #9 probe on ${testInfo.project.name} ===\n${report}\n`);
  testInfo.annotations.push({ type: '#9 probe', description: report });

  // Always passes. This file exists to print, and it is deleted once it has.
  expect(typeof report).toBe('string');
});
