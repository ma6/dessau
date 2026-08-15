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
 *   - Where anchor positioning exists: the menu is fastened to its invoker —
 *     against one of its block edges, trailing edges flush. That is the intent,
 *     and it can only be checked on an engine that implements it, so it is
 *     skipped elsewhere rather than asserted against a fallback it was never
 *     meant to describe.
 *
 * "Fastened to", not "below": `position-try-fallbacks: flip-block` is asked for
 * on purpose, and the engines use it at different moments (#54). Asserting the
 * side would be asserting an engine's overflow arithmetic, which is not this
 * component's contract.
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

/** Attached to one of the invoker's block edges, with the gap the component asks for. */
const fastened = ({ box, anchor }) =>
  (box.top >= anchor.bottom - 1 && box.top - anchor.bottom < 16) ||
  (box.bottom <= anchor.top + 1 && anchor.top - box.bottom < 16);

/**
 * The invoker and the popover it opens, measured after the popover is open.
 *
 * `align` decides where the invoker is put first, and both settings are load
 * bearing. `center` gives the menu room on either side, so a flip is a choice
 * rather than a necessity. `end` presses the invoker against the bottom edge,
 * which is the case in #54.
 *
 * The invoker is scrolled deliberately rather than left to
 * `scrollIntoViewIfNeeded`, and that is not tidiness. `scrollIntoViewIfNeeded` — and Playwright's own auto-scroll before a
 * click — moves an element just far enough to be visible, which leaves it pressed
 * against the bottom edge. There is then no room underneath for the menu, every
 * engine is entitled to `flip-block` it above the button instead, and a test that
 * asserts "below" is asserting something the component never promised in that
 * situation. Centring the invoker is what makes "below" the case actually under
 * test.
 */
async function openAndMeasure(page, id, { align = 'center' } = {}) {
  const invoker = page.locator(`[popovertarget="${id}"]`);
  await invoker.evaluate(
    (element, block) => element.scrollIntoView({ block }),
    align
  );
  await invoker.click();

  const popover = page.locator(`#${id}`);
  await expect(popover).toBeVisible();

  return measure(page, id);
}

/** Measure an already-open popover against its invoker. */
async function measure(page, id) {
  const measured = await page.locator(`#${id}`).evaluate((element, target) => {
    const box = element.getBoundingClientRect();
    const anchor = document.querySelector(`[popovertarget="${target}"]`).getBoundingClientRect();
    const style = getComputedStyle(element);

    return {
      box: box.toJSON(),
      anchor: anchor.toJSON(),
      /**
       * Carried so that a failure reports what the cascade decided, not only where
       * the box ended up. "285 is not >= 497" is a number; "the inset computed to
       * `auto` and this engine rejects `anchor()` in a logical inset property" is
       * the bug.
       */
      computed: {
        position: style.position,
        inset: [style.top, style.right, style.bottom, style.left].join(' '),
        positionAnchor: style.positionAnchor ?? '(unreadable)',
      },
      supports: {
        logical: CSS.supports('inset-block-start: anchor(bottom)'),
        physical: CSS.supports('top: anchor(bottom)'),
        tryFallbacks: CSS.supports('position-try-fallbacks: flip-block'),
      },
    };
  }, id);

  return { ...measured, detail: JSON.stringify(measured, null, 2) };
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

    const { box, anchor, detail } = await openAndMeasure(page, id);

    /**
     * Attached to the button, on one side or the other. Not "below", and the
     * difference is the whole point of this assertion.
     *
     * `position-try-fallbacks: flip-block` is asked for deliberately, so a menu
     * above its invoker is the component working, not failing. Which side an
     * engine picks is a different question, and the engines genuinely disagree:
     * whether the space is there is measured by the engine, and #54 is about
     * getting that measurement right. What this test asserts is the contract:
     * the menu is fastened to its invoker at all.
     */
    expect(fastened({ box, anchor }), `neither below nor above its invoker\n${detail}`).toBe(true);

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
    expect(Math.abs(box.right - anchor.right), `trailing edges not flush\n${detail}`).toBeLessThan(2);
  });
}

test('the tooltip sits above its trigger', async ({ page }) => {
  await page.setViewportSize(VIEWPORT);
  await page.goto(COMPONENTS);

  test.skip(!(await supportsAnchor(page)), 'no CSS anchor positioning in this engine');

  const { box, anchor, detail } = await openAndMeasure(page, 'tip-retention');

  // Same reasoning as the menu: attached to its trigger, either side. The tooltip
  // asks for `flip-block` too, and which side it takes depends on the room there is.
  expect(fastened({ box, anchor }), `detached from the control it explains\n${detail}`).toBe(true);

  // Centred on the trigger — `justify-self: anchor-center`, which is the whole
  // reason the inline insets have to stay `auto`.
  const boxCentre = box.left + box.width / 2;
  const anchorCentre = anchor.left + anchor.width / 2;
  expect(Math.abs(boxCentre - anchorCentre)).toBeLessThan(2);
});

/**
 * #54. The invoker is pressed against the bottom edge of the viewport, so the menu
 * cannot open downwards without leaving the screen, and `flip-block` has to put it
 * above the button instead.
 *
 * Both engines got this wrong from the same cause and in opposite directions, which
 * is what makes it worth a test rather than a note. A top-layer `position: absolute`
 * element takes the initial containing block, which sits at the document origin —
 * so on a scrolled page the engine asks "does this overflow" about a region the
 * reader is not looking at. Chromium left the menu 117px below the bottom edge;
 * WebKit flipped one that had 400px of room. The fix is `position: fixed`, whose
 * containing block is the viewport.
 *
 * What is at stake is not tidiness: the last item in these menus is "Sign out" and
 * "Delete selected", and off the bottom of the screen it cannot be clicked.
 */
for (const { name, id } of [
  { name: 'the user menu', id: 'demo-usermenu' },
  { name: 'the row overflow menu', id: 'demo-rowmenu' },
]) {
  test(`${name} stays on screen when it opens at the bottom edge`, async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await page.goto(NAVIGATION);

    test.skip(!(await supportsAnchor(page)), 'no CSS anchor positioning in this engine');

    const { box, anchor, detail } = await openAndMeasure(page, id, { align: 'end' });

    expect(box.bottom, `hanging off the bottom of the screen\n${detail}`).toBeLessThanOrEqual(
      VIEWPORT.height
    );
    expect(box.top, `pushed off the top of the screen\n${detail}`).toBeGreaterThanOrEqual(0);

    // Still attached — a menu that avoids the edge by detaching from its button
    // has traded one defect for a worse one.
    expect(fastened({ box, anchor }), `no longer attached to its invoker\n${detail}`).toBe(true);
  });
}

/**
 * The risk that comes with `position: fixed`, and the reason it could not simply be
 * assumed to be the fix. A fixed element is positioned against the viewport, so if
 * an engine does not apply the anchor's scroll adjustment, the menu stays where it
 * was drawn while the button scrolls out from under it. That would be a worse defect
 * than the one being fixed, and it is invisible in any test that never scrolls.
 */
test('the menu stays attached to its invoker while the page scrolls', async ({ page }) => {
  await page.setViewportSize(VIEWPORT);
  await page.goto(NAVIGATION);

  test.skip(!(await supportsAnchor(page)), 'no CSS anchor positioning in this engine');

  await openAndMeasure(page, 'demo-usermenu');

  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(150);

  const { box, anchor, detail } = await measure(page, 'demo-usermenu');

  expect(fastened({ box, anchor }), `left behind by the scroll\n${detail}`).toBe(true);
  expect(Math.abs(box.right - anchor.right), `drifted sideways\n${detail}`).toBeLessThan(2);
});
