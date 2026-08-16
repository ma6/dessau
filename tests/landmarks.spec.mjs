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

/**
 * The redundant role that is not redundant.
 *
 * Safari removes list semantics from a `<ul>`/`<ol>` outside `<nav>` once
 * `list-style: none` is applied, so a styled list stops being announced as a list
 * and stops being skippable as a group (#97). `role="list"` restores it, and
 * every rule about not adding redundant ARIA argues for deleting it again — which
 * is why the assertion exists rather than a comment.
 *
 * This runs on every engine on purpose. It asserts the ATTRIBUTE rather than the
 * computed role, because on Chromium and Firefox the computed role is right with
 * or without it, and the whole point is the markup that Safari needs.
 */
const STYLED_LISTS = [
  { page: 'content.html', selector: 'ul.dds-datalist' },
  { page: 'content.html', selector: 'ul.dds-gallery' },
  { page: 'components.html', selector: 'ul.dds-upload-list' },
  { page: 'patterns.html', selector: 'ul.dds-results-list' },
  { page: 'patterns.html', selector: 'ol.dds-steps' },
  { page: 'navigation.html', selector: '.dds-menu ul' },
];

for (const { page: name, selector } of STYLED_LISTS) {
  test(`${name}: ${selector} keeps its list semantics in Safari`, async ({ page }) => {
    await page.goto(`/reference/${name}`);

    const lists = page.locator(selector);
    const count = await lists.count();
    expect(count, 'the specimen this asserts about is not on the page').toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      await expect(lists.nth(index)).toHaveAttribute('role', 'list');
    }
  });
}

/** And the exemptions are exemptions, not oversights. */
test('a list inside <nav> does not carry the role, because it does not need it', async ({
  page,
}) => {
  await page.goto('/reference/components.html');

  /* Safari keeps list semantics inside `<nav>`, so the role there would be the
     redundant ARIA the rule actually forbids. `.dds-toc` is the one on every
     page, which makes it the one most likely to acquire it by copy-paste. */
  await expect(page.locator('nav.dds-toc ul[role="list"]')).toHaveCount(0);
  await expect(page.locator('nav.dds-toc ul')).not.toHaveCount(0);
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
