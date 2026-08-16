/**
 * Dessau — the landmarks and group semantics a page claims are actually there.
 *
 *   npx playwright test tests/landmarks.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * A landmark either exists in the accessibility tree or it does not, and nothing
 * on screen changes either way. That makes it the one part of the markup where
 * "it looks right" carries no information at all — and the part most likely to be
 * quietly lost when the markup is modernised, because the modern version is
 * usually the one with *less* ARIA in it.
 *
 * `.dds-search` moved from `<form role="search">` to a `<search>` element (#99).
 * That is the right direction — the element carries the landmark natively, and
 * ARIA supplements semantics rather than replacing them — but it swaps an
 * explicit role for an implicit one, and an implicit role is exactly what an
 * engine can decline to give. Only a browser can answer whether it did.
 *
 * @covers none — these are markup semantics, not an enhancement.
 */

import { test, expect } from '@playwright/test';

test('the search field is a search landmark', async ({ page }) => {
  await page.goto('/reference/components.html');

  const search = page.getByRole('search');
  await expect(search).toHaveCount(1);

  /* And it is the element doing it, not a role somebody left behind. A page that
     passes the assertion above because `role="search"` is still on the form has
     not made the change this test exists to protect. */
  const roleAttributes = await page
    .locator('#search [role="search"]')
    .evaluateAll((elements) => elements.length);

  expect(roleAttributes, 'role="search" is still in the markup').toBe(0);

  // The form is inside it, so the landmark actually contains the controls.
  await expect(search.locator('form.dds-search')).toHaveCount(1);
});

test('the search input says what its Enter key does', async ({ page }) => {
  await page.goto('/reference/components.html');

  /* `enterkeyhint` states what Enter will do, so it has to be true. Here Enter
     submits a search, which is the one value that cannot be wrong — unlike
     `next`, which promises a focus move that a plain HTML form never performs. */
  await expect(page.locator('form.dds-search input[type="search"]')).toHaveAttribute(
    'enterkeyhint',
    'search'
  );
});
