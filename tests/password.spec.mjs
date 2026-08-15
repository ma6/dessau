/**
 * Dessau — the password reveal is standard behaviour, not markup someone remembered.
 *
 *   npx playwright test tests/password.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * WCAG 2.2 3.3.8 Accessible Authentication is satisfied here by a control that
 * nothing in the markup asks for. That is the whole point of DECISIONS.md 027 —
 * and it also means there is nothing on the page to review. If the enhancement
 * stops running, every password field silently goes back to being a box that
 * cannot be read, on a page that looks entirely normal.
 *
 * So the assertions are on what a user gets: a button that is there, that says the
 * same thing in both states, and that makes the characters readable.
 *
 * @covers password, password-toggle — the enhancement that builds the control,
 *   and the behaviour of one the page authored itself
 *
 */

import { test, expect } from '@playwright/test';

const COMPONENTS = '/reference/components.html';

test('a bare password input gets a wrapper and a reveal button', async ({ page }) => {
  await page.goto(COMPONENTS);

  const input = page.locator('#f-password');
  const wrapper = page.locator('.dds-password', { has: input });
  const toggle = wrapper.locator('.dds-password-toggle');

  await expect(input).toHaveAttribute('type', 'password');
  await expect(wrapper).toHaveCount(1);
  await expect(toggle).toHaveCount(1);

  // A submit button here would submit the form on the first click instead of
  // revealing anything — the single most common defect in a hand-built version.
  await expect(toggle).toHaveAttribute('type', 'button');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
});

test('the toggle reveals and re-masks, and its name never changes', async ({ page }) => {
  await page.goto(COMPONENTS);

  const input = page.locator('#f-password');
  const toggle = page.locator('.dds-password', { has: input }).locator('.dds-password-toggle');

  const name = await toggle.textContent();

  await toggle.click();
  await expect(input).toHaveAttribute('type', 'text');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');

  await toggle.click();
  await expect(input).toHaveAttribute('type', 'password');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');

  /**
   * One control in two states, so the accessible name is CONSTANT and the state
   * lives in `aria-pressed`. A button that renames itself when pressed is
   * announced as a different control each time it is used.
   */
  expect(await toggle.textContent()).toBe(name);
});

test('revealing does not touch autocomplete, and keeps the value and the caret', async ({ page }) => {
  await page.goto(COMPONENTS);

  const input = page.locator('#f-password');
  const toggle = page.locator('.dds-password', { has: input }).locator('.dds-password-toggle');

  await input.fill('a-password-worth-reading');
  await toggle.click();

  await expect(input).toHaveValue('a-password-worth-reading');

  /**
   * Rewriting `autocomplete` is the usual reason a reveal toggle breaks password
   * managers — and the manager is what makes 3.3.8 satisfiable in the first
   * place, so breaking it defeats the control's own purpose.
   */
  await expect(input).toHaveAttribute('autocomplete', 'current-password');

  // The caret is at the end, not thrown back to the start by the type switch.
  expect(await input.evaluate((el) => el.selectionStart)).toBe(
    'a-password-worth-reading'.length
  );
});

test('data-dds-password="off" is left alone entirely', async ({ page }) => {
  await page.goto(COMPONENTS);

  const optedOut = page.locator('#f-password-off');

  await expect(optedOut).toHaveAttribute('type', 'password');
  await expect(page.locator('.dds-password', { has: optedOut })).toHaveCount(0);
});

test('the toggle speaks the language of the field, not of the script', async ({ page }) => {
  await page.goto(COMPONENTS);

  const english = page.locator('.dds-password', { has: page.locator('#f-password') });
  const german = page.locator('.dds-password', { has: page.locator('#f-password-de') });

  await expect(english.locator('.dds-password-toggle')).toHaveText(/Show password/);

  /**
   * The page is `lang="en"`; the field is inside `lang="de"`. Nothing in the
   * markup asks for German wording — asking would mean two places stating the
   * language, and the one that is wrong would be the silent one.
   */
  await expect(german.locator('.dds-password-toggle')).toHaveText(/Passwort anzeigen/);
});

test('a disabled password field has a disabled toggle', async ({ page }) => {
  await page.goto(COMPONENTS);

  const disabled = page.locator('#f-password-disabled');
  const toggle = page.locator('.dds-password', { has: disabled }).locator('.dds-password-toggle');

  await expect(toggle).toBeDisabled();
});

test('the sign-in pattern gets the toggle without asking for it', async ({ page }) => {
  await page.goto('/reference/patterns.html');

  /**
   * The pattern's markup is a bare `<input type="password">`. This is the
   * assertion that the accessibility of a sign-in page no longer depends on
   * whoever wrote it remembering a wrapper, a button and two icons.
   */
  const input = page.locator('#a-password');
  const toggle = page.locator('.dds-password', { has: input }).locator('.dds-password-toggle');

  await expect(toggle).toHaveCount(1);

  await toggle.click();
  await expect(input).toHaveAttribute('type', 'text');
});

test('exactly one toggle per password field', async ({ page }) => {
  await page.goto('/reference/patterns.html');

  /**
   * Two toggles on one field is two controls that disagree about the state, and
   * it is what a second enhancement route produces if it does not check. The
   * reset step has two password fields on one form, which is where this would
   * first show up.
   */
  const counts = await page.evaluate(() =>
    [...document.querySelectorAll('.dds-password')].map(
      (wrapper) => wrapper.querySelectorAll('button').length
    )
  );

  expect(counts.length, 'no password fields were enhanced at all').toBeGreaterThan(0);
  expect(counts.every((n) => n === 1), `toggles per field: ${counts.join(', ')}`).toBe(true);
});
