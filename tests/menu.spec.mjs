/**
 * Dessau — a menu opens where the button that opened it is.
 *
 *   npx playwright test tests/menu.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * The user menu opened in the top-left corner of the screen (#48), and the source
 * looked right: `position: absolute`, an `@supports` block, `anchor(bottom)`,
 * `anchor(right)`. What it did not say is what it left behind. The UA stylesheet
 * gives a popover three declarations that only work as a set —
 * `position: fixed`, `inset: 0`, `margin: auto` — and the component overrode two
 * of them. A `max-content` box with all four insets at zero and no auto margin
 * collapses into the start corner.
 *
 * This is the failure mode `playwright.config.mjs` names as the reason a browser
 * is in this repository at all: a UA stylesheet beating an author rule, invisible
 * in the source and obvious the moment the cascade runs.
 *
 * Two things are asserted, and the split is deliberate:
 *
 *   - Anywhere, on any engine: the open menu is inside the viewport and not in
 *     the corner. That is the regression, and it does not depend on anchor
 *     positioning existing — the corner is where BOTH paths ended up.
 *   - Where anchor positioning exists: the menu is under its invoker and aligned
 *     to its trailing edge. That is the intent, and it can only be checked on an
 *     engine that implements it, so it is skipped elsewhere rather than asserted
 *     against a fallback it was never meant to describe.
 *
 * The row overflow menu is included separately because it is the case with an
 * ancestor that scrolls and clips. A menu that is correct in a header and wrong
 * in a table has not been tested.
 *
 * @covers none — this is CSS placement in the top layer, not an enhancement
 *
 */

import { test, expect } from '@playwright/test';

const NAVIGATION = '/reference/navigation.html';
const COMPONENTS = '/reference/components.html';

const VIEWPORT = { width: 1280, height: 900 };

/**
 * The same condition the stylesheet gates on, deliberately duplicated. Testing
 * only `anchor-name` would skip on an engine the CSS does not skip on, which is
 * the direction that hides a failure rather than reporting it.
 */
const supportsAnchor = (page) =>
  page.evaluate(
    () => CSS.supports('anchor-name: --dds-probe') && CSS.supports('position-anchor: auto')
  );

/** The invoker and the popover it opens, measured after the popover is open. */
async function openAndMeasure(page, id) {
  const invoker = page.locator(`[popovertarget="${id}"]`);
  await invoker.scrollIntoViewIfNeeded();
  await invoker.click();

  const popover = page.locator(`#${id}`);
  await expect(popover).toBeVisible();

  return popover.evaluate((element, target) => {
    const box = element.getBoundingClientRect();
    const anchor = document.querySelector(`[popovertarget="${target}"]`).getBoundingClientRect();
    return { box: box.toJSON(), anchor: anchor.toJSON() };
  }, id);
}

for (const { name, url, id } of [
  { name: 'the user menu', url: NAVIGATION, id: 'demo-usermenu' },
  { name: 'the row overflow menu', url: NAVIGATION, id: 'demo-rowmenu' },
  { name: 'the tooltip', url: COMPONENTS, id: 'tip-retention' },
]) {
  test(`${name} opens on screen, not in the corner`, async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await page.goto(url);

    const { box } = await openAndMeasure(page, id);

    /**
     * The bug produced left: 0, top: 0 exactly. Both fallbacks that are allowed
     * here — anchored to the invoker, or centred where anchor positioning is
     * missing — are strictly inside the viewport, so a margin of zero on either
     * edge is the defect and nothing else.
     */
    expect(box.left, 'flush against the start edge of the screen').toBeGreaterThan(0);
    expect(box.top, 'flush against the top edge of the screen').toBeGreaterThan(0);

    expect(box.right).toBeLessThanOrEqual(VIEWPORT.width);
    expect(box.bottom).toBeLessThanOrEqual(VIEWPORT.height);
    expect(box.width, 'collapsed to nothing').toBeGreaterThan(0);
    expect(box.height, 'collapsed to nothing').toBeGreaterThan(0);
  });
}

for (const { name, id } of [
  { name: 'the user menu', id: 'demo-usermenu' },
  { name: 'the row overflow menu', id: 'demo-rowmenu' },
]) {
  test(`${name} hangs from its invoker`, async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await page.goto(NAVIGATION);

    test.skip(!(await supportsAnchor(page)), 'no CSS anchor positioning in this engine');

    const { box, anchor } = await openAndMeasure(page, id);

    /**
     * Below the button, by the gap the component asks for and not much more.
     * `position-try-fallbacks: flip-block` may put it above instead when there
     * is no room underneath — at this viewport height there is room, so below is
     * the case being described.
     */
    expect(box.top).toBeGreaterThanOrEqual(anchor.bottom - 1);
    expect(box.top - anchor.bottom, 'detached from the button it belongs to').toBeLessThan(16);

    /**
     * Trailing edges aligned: the menu grows inward from the button, not across
     * the header. A pixel of slack for subpixel layout.
     *
     * This is the assertion that separates "anchored" from "sitting on the
     * fallback percentage in `anchor(right, 35%)`". The fallback can land under
     * the button by coincidence of a given layout — it did, on the page that was
     * first used to diagnose this — so a test that only checked the vertical gap
     * would have called the broken state correct.
     */
    expect(Math.abs(box.right - anchor.right)).toBeLessThan(2);
  });
}

test('the tooltip sits above its trigger', async ({ page }) => {
  await page.setViewportSize(VIEWPORT);
  await page.goto(COMPONENTS);

  test.skip(!(await supportsAnchor(page)), 'no CSS anchor positioning in this engine');

  const { box, anchor } = await openAndMeasure(page, 'tip-retention');

  expect(box.bottom).toBeLessThanOrEqual(anchor.top + 1);
  expect(anchor.top - box.bottom, 'detached from the control it explains').toBeLessThan(16);

  // Centred on the trigger — `justify-self: anchor-center`, which is the whole
  // reason the inline insets have to stay `auto`.
  const boxCentre = box.left + box.width / 2;
  const anchorCentre = anchor.left + anchor.width / 2;
  expect(Math.abs(boxCentre - anchorCentre)).toBeLessThan(2);
});
