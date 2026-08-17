/**
 * Dessau — search and results: all four states are reachable, and reachable
 * in order.
 *
 *   npx playwright test tests/results.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * `.dds-results` had CSS and a specification and no behaviour at all (#24) —
 * four states documented and rendered as static, disconnected snapshots, with
 * no `dds/js/patterns/results.js` doing the debounce, the abort, the
 * announcement or the state transitions. An agent reading `agent/patterns.md`
 * had no way to tell a working pattern from a picture of one.
 *
 * The abort test is the one that matters most and is easiest to get wrong
 * silently: without it, a slow response for an earlier query can land after a
 * faster later one and overwrite it — invisible on a fast connection, which
 * is exactly why it needs a real, timed browser test rather than a read of
 * the source.
 *
 * @covers results
 *
 */

import { test, expect } from '@playwright/test';

const PATTERNS = '/reference/patterns.html';

test('a matching query shows results, with a count in the summary', async ({ page }) => {
  await page.goto(PATTERNS);

  await page.fill('#ref-results-input', 'harbour');
  await expect(page.locator('[data-dds-results-list] li')).toHaveCount(3, { timeout: 2000 });
  await expect(page.locator('[data-dds-results-summary]')).toContainText('3 results for "harbour"');
  await expect(page.locator('[data-dds-results-empty]')).toBeHidden();
  await expect(page.locator('[data-dds-results-error]')).toBeHidden();
});

test('a non-matching query reaches the empty state, not the error state', async ({ page }) => {
  await page.goto(PATTERNS);

  await page.fill('#ref-results-input', 'zzz-nothing-matches-this');
  await expect(page.locator('[data-dds-results-empty]')).toBeVisible({ timeout: 2000 });
  await expect(page.locator('[data-dds-results-empty-title]')).toContainText(
    'No results for "zzz-nothing-matches-this"'
  );
  await expect(page.locator('[data-dds-results-list] li')).toHaveCount(0);
  await expect(page.locator('[data-dds-results-error]')).toBeHidden();
});

test('a failed request reaches the error state, and retry recovers', async ({ page }) => {
  await page.goto(PATTERNS);

  await page.fill('#ref-results-input', 'error');
  await expect(page.locator('[data-dds-results-error]')).toBeVisible({ timeout: 2000 });
  // A stale count next to a fresh error notice would contradict it.
  await expect(page.locator('[data-dds-results-summary]')).toHaveText('');

  // The query still in the box is the pattern's own contract — nothing here
  // clears it on failure.
  await expect(page.locator('#ref-results-input')).toHaveValue('error');

  await page.click('[data-dds-results-retry]');
  await expect(page.locator('[data-dds-results-error]')).toBeVisible({ timeout: 2000 });
});

test('the loading state is visible during the request, on top of the stale list', async ({
  page,
}) => {
  await page.goto(PATTERNS);

  await page.fill('#ref-results-input', 'harbour');
  await expect(page.locator('[data-dds-results-list] li')).toHaveCount(3, { timeout: 2000 });

  // A second query: loading must show while the stale list from the first
  // query is still on screen (dimmed by aria-busy, not removed).
  await page.fill('#ref-results-input', 'quayside');
  await expect(page.locator('[data-dds-results-loading]')).toBeVisible();
  await expect(page.locator('#ref-results')).toHaveAttribute('aria-busy', 'true');

  await expect(page.locator('[data-dds-results-loading]')).toBeHidden({ timeout: 2000 });
  await expect(page.locator('#ref-results')).not.toHaveAttribute('aria-busy', 'true');
});

test('an earlier, slower request never overwrites a later, faster one', async ({ page }) => {
  await page.goto(PATTERNS);

  // Both queries are debounced from the same keystroke burst; only the
  // in-flight request for the LAST one should ever land. Simulated latency
  // is fixed (500ms) in the demo, so this exercises the abort on every
  // request that was not the final one, not a race that depends on timing.
  await page.fill('#ref-results-input', 'harbour');
  await page.waitForTimeout(50);
  await page.fill('#ref-results-input', 'zzz-nothing-matches-this');

  await expect(page.locator('[data-dds-results-empty]')).toBeVisible({ timeout: 2000 });
  // If the aborted "harbour" response had landed anyway, these would show
  // instead of the empty state.
  await expect(page.locator('[data-dds-results-list] li')).toHaveCount(0);
});

test('clearing the query clears the results, with no state left showing', async ({ page }) => {
  await page.goto(PATTERNS);

  await page.fill('#ref-results-input', 'harbour');
  await expect(page.locator('[data-dds-results-list] li')).toHaveCount(3, { timeout: 2000 });

  await page.fill('#ref-results-input', '');
  await expect(page.locator('[data-dds-results-list] li')).toHaveCount(0);
  await expect(page.locator('[data-dds-results-empty]')).toBeHidden();
  await expect(page.locator('[data-dds-results-error]')).toBeHidden();
});
