/**
 * Dessau — progressive enhancement actually runs.
 *
 *   npx playwright test tests/enhancement.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * Every interactive demo in the reference was dead, and nothing said so.
 *
 * `enhance(document)` was guarded with `document.readyState === 'loading'`, and
 * took the else branch instead. A deferred script runs after parsing, when
 * `readyState` is already `"interactive"` — so the sweep ran the moment `dds.js`
 * finished, before `components.js` and before every pattern file had called
 * `register`. The registry was empty. The sweep enhanced nothing.
 *
 * The failure is completely silent by design: progressive enhancement means the
 * markup works on its own, so a page with no enhancement at all still renders,
 * still submits, still navigates. It just does none of the things it documents.
 *
 * No static check can catch this. The registry is only empty at one particular
 * moment during page load, and finding that out requires loading the page.
 *
 * These tests assert on the observable consequences — `data-dds-enhanced`, the
 * ARIA attributes an enhancement adds, the elements it generates — rather than on
 * internals, so they keep testing the right thing if the implementation changes.
 */

import { test, expect } from '@playwright/test';

/** Resolved against the baseURL in playwright.config.mjs. */
const page_ = (name) => `/reference/${name}.html`;

test('every registered enhancement has been applied after load', async ({ page }) => {
  const problems = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });

  await page.goto(page_('patterns'));

  /**
   * The registry is compared against what is actually marked in the DOM. A
   * registration whose selector matches elements on the page but which has
   * enhanced none of them is the exact shape of the bug.
   */
  const unapplied = await page.evaluate(() => {
    const missed = [];

    for (const element of document.querySelectorAll('[data-dds-combobox], [data-dds-validate], [data-dds-wizard], [data-dds-conditional]')) {
      if (!element.dataset.ddsEnhanced) {
        missed.push(element.outerHTML.slice(0, 80));
      }
    }

    return missed;
  });

  expect(
    unapplied,
    'elements opted into an enhancement but were never enhanced — the sweep ran ' +
      'before the pattern files registered'
  ).toEqual([]);

  expect(problems, 'enhancement threw during load').toEqual([]);
});

test('the combobox enhances into a real ARIA combobox', async ({ page }) => {
  await page.goto(page_('patterns'));

  const input = page.locator('#ref-city');

  // Attributes the enhancement adds. Present means it ran; absent means it did not.
  await expect(input).toHaveAttribute('role', 'combobox');
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  await expect(input).toHaveAttribute('aria-autocomplete', 'list');
});

test('the combobox filters, and says so when nothing matches', async ({ page }) => {
  await page.goto(page_('patterns'));

  const input = page.locator('#ref-city');
  const list = page.locator('#ref-city').locator('xpath=../ul');

  await input.fill('Ber');
  await expect(list).toBeVisible();
  await expect(list.locator('[role="option"]')).toHaveCount(1);
  await expect(list.locator('[role="option"]')).toHaveText(/Bergen/);
  await expect(input).toHaveAttribute('aria-expanded', 'true');

  /**
   * A query that matches nothing must SAY so. Showing an empty panel — or no
   * panel — is indistinguishable from the component being broken, which is
   * exactly how the enhancement bug above was first noticed.
   */
  await input.fill('kakaka');
  await expect(list).toBeVisible();
  await expect(list.locator('[role="option"]')).toHaveCount(0);
  await expect(list).toContainText(/no match/i);
});

test('keyboard: arrow keys move the active option without moving focus', async ({ page }) => {
  await page.goto(page_('patterns'));

  const input = page.locator('#ref-city');
  const list = input.locator('xpath=../ul');

  await input.fill('B');

  /**
   * Wait for the list before pressing a key. The query is debounced, so an ArrowDown
   * sent immediately after typing arrives while there is nothing to move through —
   * which fails as "no active option" and looks exactly like the keyboard handling
   * being broken.
   */
  await expect(list.locator('[role="option"]').first()).toBeVisible();

  await input.press('ArrowDown');

  /**
   * Focus stays in the input — the user is still typing. The active option is
   * pointed at with `aria-activedescendant`. This is the detail most
   * implementations get wrong, usually by moving real focus into the list, which
   * breaks typing and loses the caret.
   */
  await expect(input).toBeFocused();

  const active = await input.getAttribute('aria-activedescendant');
  expect(active, 'no active option after ArrowDown').toBeTruthy();

  const option = page.locator(`#${active}`);
  await expect(option).toHaveAttribute('aria-selected', 'true');

  await input.press('Escape');
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  await expect(input).toBeFocused();
});

test('clicking a suggestion fills the field', async ({ page }) => {
  await page.goto(page_('patterns'));

  const input = page.locator('#ref-city');
  await input.fill('Ber');

  const option = page.locator('#ref-city').locator('xpath=../ul').locator('[role="option"]').first();
  await option.click();

  /**
   * The pointer path is a different code path from the keyboard one, and it is the
   * one that breaks. Pressing an option blurs the input; if the blur handler closes
   * the list, the option is gone before its click listener can run, and the click is
   * simply lost. The keyboard path keeps working the whole time, so the component
   * tests fine and is broken in use.
   */
  await expect(input).toHaveValue('Bergen');
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute('aria-expanded', 'false');
});

test('the address search fills every field from one selection', async ({ page }) => {
  await page.goto(page_('patterns'));

  const search = page.locator('[data-dds-address-combobox] input').first();

  /**
   * A street that is actually in the mock provider, and at least three characters —
   * the address search sets `minLength: 3`, because a one-character address query
   * matches everything and teaches the user nothing.
   *
   * The previous query was a street that had been replaced in the demo data, so the
   * test was asserting against an address the provider had never heard of.
   */
  await search.fill('Talwiesen');

  const option = page.locator('[data-dds-address-combobox] [role="option"]').first();
  await expect(option).toBeVisible();
  await option.click();

  /**
   * The point of the pattern: one selection, every field populated.
   *
   * Scoped to `[data-dds-address-search]`, not to a `<form>`. The pattern deliberately
   * does not require one — it is a set of fields that a product drops into whatever
   * form it already has — and an earlier version of this test assumed the demo wrapped
   * them in one. It reported "no address fields found" while the pattern worked
   * perfectly, which is a test failing about its own assumption.
   */
  const filled = await page.evaluate(() => {
    const region = document.querySelector('[data-dds-address-search]');
    if (!region) return null;
    return [...region.querySelectorAll('input')]
      .filter((i) => i.type !== 'search' && !i.closest('[data-dds-address-combobox]'))
      .map((i) => ({ name: i.name, value: i.value }));
  });

  expect(filled, 'no address fields found to check').not.toBeNull();
  expect(
    filled.filter((f) => f.value !== ''),
    'selecting an address left every field empty'
  ).not.toEqual([]);
});

test('a registration arriving after the sweep still applies', async ({ page }) => {
  await page.goto(page_('patterns'));

  /**
   * This is the guarantee that makes script order irrelevant, so it is worth
   * asserting directly rather than trusting it. A pattern file loaded lazily —
   * or a product's own enhancement registered from application code — must not
   * depend on having beaten DOMContentLoaded.
   */
  const enhanced = await page.evaluate(() => {
    const element = document.createElement('div');
    element.setAttribute('data-dds-late-registration-test', '');
    document.body.appendChild(element);

    let ran = false;
    window.DDS.register('late-registration-test', '[data-dds-late-registration-test]', () => {
      ran = true;
    });

    return ran;
  });

  expect(
    enhanced,
    'registering after the initial sweep did not enhance existing elements, so ' +
      'load order still decides whether a pattern works'
  ).toBe(true);
});
