/**
 * Dessau — the consent gate remembers the choice, and asks again when it must.
 *
 *   npx playwright test tests/consent-gate.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * The pattern's whole value is in the parts that do not render: that a decline
 * is stored and honoured on the next visit, that there is no implicit-consent
 * escape hatch, that re-opening from the revocation control moves focus in and
 * hands it back, and that bumping the policy version re-opens the bar. A
 * screenshot proves none of it.
 *
 * @covers consent-gate, consent-reopen
 *
 */

import { test, expect } from '@playwright/test';

const PAGE = '/reference/patterns.html';
const NAME = 'analytics-demo';
const KEY = 'dds-consent:' + NAME;

const gate = (page) => page.locator('[data-dds-consent="' + NAME + '"]');

test.beforeEach(async ({ page }) => {
  await page.goto(PAGE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('with no stored decision, the bar is shown', async ({ page }) => {
  await expect(gate(page)).toBeVisible();
});

test('declining hides the bar, is recorded, and is honoured on reload', async ({ page }) => {
  await gate(page).getByRole('button', { name: 'Decline' }).click();

  await expect(gate(page)).toBeHidden();

  const stored = await page.evaluate((key) => localStorage.getItem(key), KEY);
  expect(stored).toBeTruthy();
  const record = JSON.parse(stored);
  expect(record.state).toBe('denied');
  expect(record.policy).toBe('2026-09-01');
  expect(typeof record.at).toBe('string');

  expect(await page.evaluate((n) => window.DDS.consent.get(n), NAME)).toBe('denied');
  await expect(page.locator('#ref-consent-status')).toContainText('Declined');

  // The remembered part: a fresh load does not ask again.
  await page.reload();
  await expect(gate(page)).toBeHidden();
});

test('allowing is recorded as granted', async ({ page }) => {
  await gate(page).getByRole('button', { name: 'Allow analytics' }).click();

  await expect(gate(page)).toBeHidden();
  expect(await page.evaluate((n) => window.DDS.consent.get(n), NAME)).toBe('granted');
  await expect(page.locator('#ref-consent-status')).toContainText('Granted');
});

test('there is no implicit-consent escape hatch', async ({ page }) => {
  // No dismiss control in the bar.
  await expect(gate(page).locator('.dds-banner-dismiss')).toHaveCount(0);

  // Escape does nothing: the bar stays, and nothing is recorded.
  await gate(page).getByRole('button', { name: 'Decline' }).focus();
  await page.keyboard.press('Escape');

  await expect(gate(page)).toBeVisible();
  expect(await page.evaluate((n) => window.DDS.consent.get(n), NAME)).toBeNull();
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBeNull();
});

test('the two buttons are peers — decline is neither a link nor a subtle button', async ({ page }) => {
  const decline = gate(page).getByRole('button', { name: 'Decline' });
  await expect(decline).toHaveClass(/dds-button-secondary/);
  await expect(decline).not.toHaveClass(/dds-button-subtle/);
});

test('Privacy choices re-opens the bar, moves focus in, and hands it back on a choice', async ({ page }) => {
  await gate(page).getByRole('button', { name: 'Decline' }).click();
  await expect(gate(page)).toBeHidden();

  const reopen = page.locator('[data-dds-consent-reopen="' + NAME + '"]');
  await reopen.click();

  await expect(gate(page)).toBeVisible();
  // Focus moves to the title when the bar is summoned, like a dialog.
  await expect(page.locator('#ref-consent-title')).toBeFocused();

  await gate(page).getByRole('button', { name: 'Allow analytics' }).click();

  await expect(gate(page)).toBeHidden();
  // …and returns to the control that opened it (WCAG 2.4.3).
  await expect(reopen).toBeFocused();
  expect(await page.evaluate((n) => window.DDS.consent.get(n), NAME)).toBe('granted');
});

test('a decision made under an older policy is treated as no decision', async ({ page }) => {
  await page.evaluate((key) => {
    localStorage.setItem(
      key,
      JSON.stringify({ state: 'granted', policy: '2020-01-01', at: '2020-01-01T00:00:00.000Z' })
    );
  }, KEY);
  await page.reload();

  // The raw record is still there…
  expect(await page.evaluate((n) => window.DDS.consent.record(n).state, NAME)).toBe('granted');
  // …but get() reports null against the current policy, so the bar comes back.
  expect(await page.evaluate((n) => window.DDS.consent.get(n), NAME)).toBeNull();
  await expect(gate(page)).toBeVisible();
});

test('onChange fires once immediately with the current state', async ({ page }) => {
  await gate(page).getByRole('button', { name: 'Allow analytics' }).click();

  const seen = await page.evaluate((n) => {
    return new Promise((resolve) => {
      window.DDS.consent.onChange(n, (detail) => resolve(detail.state));
    });
  }, NAME);

  expect(seen).toBe('granted');
});
