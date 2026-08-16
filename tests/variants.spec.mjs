/**
 * Dessau — the variant switch shows one variant, and the sample follows it.
 *
 *   npx playwright test tests/variants.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * The switch is reference tooling, and reference tooling that goes wrong is worse
 * than no tooling: it is a demonstration that lies while looking correct. That is
 * not a hypothetical here — `tests/codeview.spec.mjs` exists because the code view
 * offered seventeen captions as component markup and every assertion passed.
 *
 * Three of the things this tool does are invisible when they break:
 *
 *   - `hidden` on the inactive variants. Hidden with CSS instead, the demo looks
 *     identical and the two invisible variants keep every one of their controls in
 *     the tab order.
 *   - the code view following the switch. Stale, it offers the markup of a layout
 *     nobody is looking at — and it is generated markup, so it is trusted.
 *   - the width surviving a switch. Reset, the reader compares a phone layout with
 *     a desktop one and reads the difference as a variant difference.
 *
 * @covers none — the switch is the reference's own tooling, not a shipped DDS
 *   enhancement. What it demonstrates is covered by the specs for those.
 */

import { test, expect } from '@playwright/test';

const PAGE = '/reference/content.html';

test('one variant is on show, and it is the one the control says', async ({ page }) => {
  await page.goto(PAGE);

  const group = page.locator('[data-ref-variants]').first();
  const panels = group.locator('[data-ref-variant]');

  await expect(panels).toHaveCount(3);
  await expect(panels.filter({ visible: true })).toHaveCount(1);

  // The switch is a radio group, so the keyboard behaviour is the platform's.
  const options = group.locator('.dds-segmented-option input[type="radio"]');
  await expect(options).toHaveCount(3);
  await expect(options.nth(0)).toBeChecked();

  await options.nth(2).check();
  await expect(panels.nth(2)).toBeVisible();
  await expect(panels.nth(0)).toBeHidden();
});

test('an inactive variant is hidden by the attribute, not by CSS', async ({ page }) => {
  await page.goto(PAGE);

  /* The distinction the eye cannot make. `display: none` from a class looks the
     same and leaves every control inside the hidden variants as a tab stop. */
  const hiddenAttribute = await page
    .locator('[data-ref-variants] > [data-ref-variant]')
    .evaluateAll((panels) => panels.map((panel) => panel.hasAttribute('hidden')));

  expect(hiddenAttribute.filter(Boolean)).toHaveLength(hiddenAttribute.length - 1);
});

test('an inactive variant is still findable by find-in-page', async ({ page }) => {
  await page.goto(PAGE);

  /* Where the engine has no `until-found` the attribute is simply `hidden`, and
     the variant is hidden outright — the behaviour this replaced. Nothing to
     assert there, and skipping says so rather than asserting a weaker thing on
     every engine. */
  const supported = await page.evaluate(() => 'onbeforematch' in HTMLElement.prototype);
  test.skip(!supported, 'this engine does not support hidden="until-found"');

  /* This is documentation, and find-in-page is how documentation gets read. A
     plain `hidden` makes two thirds of a section unfindable because a control is
     set to the wrong option — which nobody would guess is why their search
     failed. */
  const values = await page
    .locator('[data-ref-variants] > [data-ref-variant][hidden]')
    .evaluateAll((panels) => panels.map((panel) => panel.getAttribute('hidden')));

  expect(values.length).toBeGreaterThan(0);
  for (const value of values) {
    expect(value, 'an inactive variant is hidden outright, not until found').toBe('until-found');
  }
});

test('the group is named, so it is not three unrelated radio buttons', async ({ page }) => {
  await page.goto(PAGE);

  const legend = page.locator('[data-ref-variants] legend').first();
  await expect(legend).toHaveClass(/dds-sr-only/);
  await expect(legend).not.toBeEmpty();
});

test('the sample is the variant on screen, and it changes with it', async ({ page }) => {
  await page.goto(PAGE);

  const specimen = page.locator('#textmedia [data-ref-code]').first();
  await specimen.locator('details.ref-codeview').evaluate((view) => {
    view.open = true;
  });

  const code = specimen.locator('.ref-codeview code');
  const first = await code.textContent();

  expect(first).toContain('dds-textmedia-media-end');
  // The other two variants are in the DOM. Neither is the sample.
  expect(first).not.toContain('dds-textmedia-media-top');

  // And the generated width preview around them is scaffolding, never markup.
  expect(first).not.toContain('data-ref-bp');
  expect(first).not.toMatch(/class="[^"]*\bref-/);

  await specimen.locator('.dds-segmented-option input[type="radio"]').nth(2).check();

  const second = await code.textContent();
  expect(second).toContain('dds-textmedia-media-top');
  expect(second).not.toContain('dds-textmedia-media-end');
});

test('a width chosen in one variant survives switching to the next', async ({ page }) => {
  await page.goto(PAGE);

  const group = page.locator('#textmedia [data-ref-variants]').first();

  // 375: the width at which all three variants are meant to be the same layout,
  // which is the comparison the switch exists to make possible.
  await group
    .locator('[data-ref-variant]:not([hidden]) .ref-bp-toolbar button', { hasText: '375' })
    .click();

  await group.locator('.dds-segmented-option input[type="radio"]').nth(1).check();

  const stage = group.locator('[data-ref-variant]:not([hidden]) .ref-bp-stage');
  await expect(stage).toHaveCSS('width', '375px');
});

test('below the query every variant stacks with the media on top', async ({ page }) => {
  await page.goto(PAGE);

  const group = page.locator('#textmedia [data-ref-variants]').first();
  const options = group.locator('.dds-segmented-option input[type="radio"]');

  await group
    .locator('[data-ref-variant]:not([hidden]) .ref-bp-toolbar button', { hasText: '375' })
    .click();

  for (let index = 0; index < 3; index += 1) {
    await options.nth(index).check();

    const shown = group.locator('[data-ref-variant]:not([hidden])');

    /* Wait for the width, do not assume it. The stage animates between widths,
       and this assertion retries until it is there — measuring before it settles
       reads a layout that is on its way somewhere else. */
    await expect(shown.locator('.ref-bp-stage')).toHaveCSS('width', '375px');

    /* Both rectangles in ONE evaluate, from one layout pass. Two `boundingBox()`
       calls are two round trips, and anything that reflows between them — the
       tail of that width transition — is measured half in the old layout and
       half in the new. That read as a 22px overlap on Firefox and WebKit and as
       a pass on Chromium, which is a report about the timing and not about the
       component. */
    const gap = await shown.locator('.dds-textmedia').evaluate((block) => {
      const media = block.querySelector('.dds-textmedia-media');
      const text = Array.from(block.children).find((child) => child !== media);
      return text.getBoundingClientRect().top - media.getBoundingClientRect().bottom;
    });

    /* Including the media-trailing variant, which on a desktop looks like the
       one that would put the image underneath. A phone shows the illustration
       with its heading, not four paragraphs later. */
    expect(gap, `variant ${index} at 375px: the media is not above the text`).toBeGreaterThanOrEqual(
      0
    );
  }
});

test('the media element is first in the source, in every variant', async ({ page }) => {
  await page.goto(PAGE);

  /* The stacked layout needs no `order` only because the source order is already
     the intended one. If a variant is ever authored the other way round, the
     phone layout still looks right and the announced order silently stops
     matching it (WCAG 1.3.2) — which is the failure no screenshot can show. */
  const mediaIsFirst = await page
    .locator('#textmedia .dds-textmedia')
    .evaluateAll((blocks) =>
      blocks.map((block) => block.firstElementChild?.classList.contains('dds-textmedia-media'))
    );

  expect(mediaIsFirst).toHaveLength(3);
  expect(mediaIsFirst.every(Boolean)).toBe(true);
});
