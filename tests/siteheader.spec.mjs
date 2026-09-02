/**
 * Dessau — the site header, the component products actually ship.
 *
 *   npx playwright test tests/siteheader.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * `tests/reference-nav.spec.mjs` covers the reference's own header thoroughly —
 * collapse, growing past the threshold, no-JavaScript, Escape, constant height
 * across pages. It covers `.ref-*`. What a product installs is `.dds-siteheader`
 * with `.dds-primary-nav`, and that had no browser test at all.
 *
 * They share the `data-dds-nav-toggle` enhancement, so the behaviour is
 * exercised. What is not exercised is the component's own CSS, and that is where
 * the interesting failure lives:
 *
 *   - the container query at 48rem;
 *   - `.dds-primary-nav[hidden] { display: block }` above it, which is what
 *     stops a collapsed menu staying collapsed forever after a resize;
 *   - the `aria-current` treatment, which has to change from a fill to an
 *     underline to survive the row layout.
 *
 * The middle one is catastrophic and completely invisible in a screenshot: the
 * toggle is `display: none` above 48rem, so if `hidden` still won there, the
 * navigation would be in the DOM, correct, and unreachable — with nothing left
 * on screen to open it.
 *
 * And the point worth having: it is driven by CONTAINER width, not viewport. A
 * container-query component tested only at full window width has not been tested
 * for the thing that makes it a container-query component.
 *
 * @covers nav-toggle
 *
 */

import { test, expect } from '@playwright/test';

const NAVIGATION = '/reference/navigation.html';

const header = (page) => page.locator('.dds-siteheader');
const toggle = (page) => header(page).locator('.dds-siteheader-toggle');
const actions = (page) => header(page).locator('.dds-siteheader-actions');
const nav = (page) => header(page).locator('.dds-primary-nav');

/**
 * Every edge the row-order assertions care about, read in one layout pass so the
 * numbers are mutually consistent. `edge` is the header's content-box inline-end
 * — where an item flush against the edge lands, inside `.dds-container`'s
 * padding.
 */
async function rowGeometry(page) {
  return header(page).evaluate((el) => {
    const box = (sel) => {
      const child = el.querySelector(sel);
      if (!child) return null;
      const r = child.getBoundingClientRect();
      return { left: r.left, right: r.right, width: r.width, top: r.top, bottom: r.bottom };
    };
    const rect = el.getBoundingClientRect();
    return {
      edge: rect.right - parseFloat(getComputedStyle(el).paddingInlineEnd),
      brand: box('.dds-siteheader-brand'),
      toggle: box('.dds-siteheader-toggle'),
      actions: box('.dds-siteheader-actions'),
      nav: box('.dds-primary-nav'),
    };
  });
}

/** Set the width of the container the header sits in, leaving the window alone.
 *  Settles fonts and two frames; the geometry tests still `expect.poll` on top,
 *  because the reference's breakpoint-preview tooling keeps adjusting the stage
 *  for a beat after the width is set. */
async function setContainerWidth(page, width) {
  await page.evaluate(async (value) => {
    const stage = document.querySelector('.dds-siteheader-frame').closest('.ref-bp-stage');
    stage.style.inlineSize = value;
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, width);
}

test('below the threshold the navigation is a disclosure', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(NAVIGATION);
  await setContainerWidth(page, '600px');

  await expect(toggle(page)).toBeVisible();
  await expect(nav(page)).toBeHidden();

  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(nav(page)).toBeVisible();
});

test('the container decides, not the window', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(NAVIGATION);

  /**
   * A wide window and a narrow container. If this read the viewport, the header
   * would stay in its row layout with the toggle hidden — and a product that
   * puts the header inside a narrow column would get a navigation that does not
   * fit and cannot collapse.
   */
  await setContainerWidth(page, '600px');
  await expect(toggle(page)).toBeVisible();

  await setContainerWidth(page, '1000px');
  await expect(toggle(page)).toBeHidden();
});

test('growing past the threshold while collapsed leaves the navigation reachable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(NAVIGATION);
  await setContainerWidth(page, '600px');

  // Collapsed, and `hidden` is on the element.
  await expect(nav(page)).toBeHidden();
  await expect(nav(page)).toHaveAttribute('hidden', '');

  await setContainerWidth(page, '1000px');

  /**
   * The catastrophic case, and the reason `.dds-primary-nav[hidden] { display:
   * block }` exists. Above the threshold the toggle is `display: none` — so if
   * `hidden` still won, every link would be in the DOM, correct, and permanently
   * unreachable, with nothing on screen that could reopen it.
   *
   * `hidden` is deliberately still on the attribute: the disclosure state is not
   * rewritten by a resize, so shrinking again returns to where the user left it.
   */
  await expect(toggle(page)).toBeHidden();
  await expect(nav(page)).toBeVisible();
  await expect(nav(page).locator('a').first()).toBeVisible();
});

test('below the threshold the disclosure button is last on the row, flush to the edge', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(NAVIGATION);
  await setContainerWidth(page, '600px');
  await expect(toggle(page)).toBeVisible();

  // Poll: the reference's breakpoint-preview tooling keeps nudging the stage
  // width for a beat after it is set.
  await expect
    .poll(async () => {
      const g = await rowGeometry(page);
      return {
        // Toggle hard against the inline-end edge.
        toggleFlush: Math.round(g.edge - g.toggle.right) === 0,
        // Actions are a group immediately left of the toggle, not out past it.
        actionsLeftOfToggle: g.actions.right <= g.toggle.left + 1,
        // The free space is between the brand and the group, not inside it.
        gapIsBeforeGroup:
          g.actions.left - g.brand.right > g.toggle.left - g.actions.right + 20,
      };
    })
    .toEqual({ toggleFlush: true, actionsLeftOfToggle: true, gapIsBeforeGroup: true });
});

test('the disclosure button does not move when the actions are absent', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(NAVIGATION);
  await setContainerWidth(page, '600px');
  await expect(toggle(page)).toBeVisible();

  // Flush to the edge with the actions present...
  await expect
    .poll(async () => {
      const g = await rowGeometry(page);
      return Math.round(g.edge - g.toggle.right);
    })
    .toBe(0);

  await actions(page).evaluate((el) => el.remove());

  // ...and still flush to the same edge with them gone: the toggle owns the gap
  // when it is alone, the actions own it when they are present.
  await expect
    .poll(async () => {
      const g = await rowGeometry(page);
      return Math.round(g.edge - g.toggle.right);
    })
    .toBe(0);
});

test('opening the navigation does not drop the disclosure button onto a lower row', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(NAVIGATION);
  await setContainerWidth(page, '600px');
  await expect(toggle(page)).toBeVisible();

  await toggle(page).click();
  await expect(nav(page)).toBeVisible();

  // The nav takes its own full-width row *below* the brand row; the toggle stays
  // on the brand row, flush to the inline-end edge — it does not follow the nav
  // down. (`order: 100` on the nav is what keeps that row order.)
  await expect
    .poll(async () => {
      const g = await rowGeometry(page);
      return {
        toggleFlush: Math.round(g.edge - g.toggle.right) === 0,
        toggleOnBrandRow: Math.abs(g.toggle.top - g.brand.top) < 40,
        navBelowToggle: g.nav.top >= g.toggle.bottom - 1,
      };
    })
    .toEqual({ toggleFlush: true, toggleOnBrandRow: true, navBelowToggle: true });
});

test('the current page marker survives the row layout', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(NAVIGATION);
  await setContainerWidth(page, '1000px');

  const current = nav(page).locator('[aria-current="page"]');
  await expect(current).toHaveCount(1);

  /**
   * Above the threshold the fill is dropped for an underline, because a filled
   * pill in a row reads as a button rather than as "you are here". The marker
   * has to remain perceivable without colour either way (WCAG 1.4.1), so what is
   * asserted is that something other than colour is drawn — a box-shadow here.
   */
  const marker = await current.evaluate((element) => {
    const style = getComputedStyle(element);
    return { shadow: style.boxShadow, background: style.backgroundColor };
  });

  expect(marker.shadow, 'no underline on the current entry in the row layout').not.toBe('none');
});
