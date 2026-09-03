/**
 * Dessau — the site header's opt-in drawer (`data-dds-drawer`).
 *
 *   npx playwright test tests/siteheader-drawer.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * `tests/siteheader.spec.mjs` covers the default in-flow disclosure. With
 * `data-dds-drawer` the same toggle drives `contentnav`'s off-canvas machinery
 * instead — `data-dds-open`, a real scrim, `.dds-scroll-locked` on `<html>`,
 * `inert` on the page content, Escape, scrim click, and a ResizeObserver that
 * unwinds all of it when the header grows past 48rem while open.
 *
 * The catastrophic case is a surviving `inert` or scroll lock: the CSS makes the
 * nav inline again on its own when the container widens, but it cannot undo
 * state set on `<html>` and the content, so a page that looks completely normal
 * would be unscrollable and unclickable. That is reachable by resizing the
 * window with the drawer open, and it is invisible in a screenshot.
 *
 * These mirror `tests/contentnav.spec.mjs` deliberately: same behaviour, same
 * assertions, different component.
 *
 * @covers nav-toggle
 *
 */

import { test, expect } from '@playwright/test';

const NAVIGATION = '/reference/navigation.html';

const frame = (page) => page.locator('#siteheader-drawer');
const toggle = (page) => frame(page).locator('.dds-siteheader-toggle');
const nav = (page) => frame(page).locator('.dds-primary-nav');
const scrim = (page) => frame(page).locator('.dds-siteheader-scrim');
const content = (page) => frame(page).locator('[data-dds-nav-content]');
const closeButton = (page) => nav(page).locator('[data-dds-nav-close]');

/** Below 48rem, so the nav is a drawer. */
const DRAWER = '600px';
/** Above it, so the nav is inline and the toggle is gone. */
const INLINE = '900px';

/** Drive the container the drawer specimen measures, leaving the window alone. */
async function setContainerWidth(page, width) {
  await page.evaluate((value) => {
    document.querySelector('#siteheader-drawer').closest('.ref-bp-stage').style.inlineSize = value;
  }, width);
}

async function openDrawer(page) {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(NAVIGATION);
  await setContainerWidth(page, DRAWER);
  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true');
}

test('opening the drawer makes the page behind genuinely unavailable', async ({ page }) => {
  await openDrawer(page);

  await expect(nav(page)).toHaveAttribute('data-dds-open', '');
  await expect(scrim(page)).toHaveAttribute('data-dds-open', '');
  await expect(content(page)).toHaveAttribute('inert', '');
  await expect(page.locator('html')).toHaveClass(/dds-scroll-locked/);

  // The panel itself takes focus, not its first link: it is labelled, so a
  // screen reader announces what opened before reading the list.
  await expect(nav(page)).toBeFocused();
});

test('inert removes the content from the tab order, it does not merely cover it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(NAVIGATION);
  await setContainerWidth(page, DRAWER);

  // Scoped to this specimen — the contentnav demo has a probe of its own.
  const probe = content(page).locator('[data-ref-inert-probe]');

  await probe.focus();
  await expect(probe).toBeFocused();

  await toggle(page).click();

  const focusedProbe = await page.evaluate(() => {
    const link = document.querySelector('#siteheader-drawer [data-ref-inert-probe]');
    link.focus();
    return document.activeElement === link;
  });

  expect(focusedProbe, 'a link inside the inert content still took focus').toBe(false);
});

test('Escape closes the drawer and returns focus to the toggle', async ({ page }) => {
  await openDrawer(page);

  await page.keyboard.press('Escape');

  await expect(nav(page)).not.toHaveAttribute('data-dds-open', '');
  await expect(scrim(page)).not.toHaveAttribute('data-dds-open', '');
  await expect(content(page)).not.toHaveAttribute('inert', '');
  await expect(page.locator('html')).not.toHaveClass(/dds-scroll-locked/);
  await expect(toggle(page)).toBeFocused();
});

test('clicking the scrim closes the drawer and returns focus to the toggle', async ({ page }) => {
  await openDrawer(page);

  await scrim(page).click();

  await expect(nav(page)).not.toHaveAttribute('data-dds-open', '');
  await expect(page.locator('html')).not.toHaveClass(/dds-scroll-locked/);
  await expect(toggle(page)).toBeFocused();
});

test('the in-panel close button closes the drawer and returns focus to the toggle', async ({
  page,
}) => {
  await openDrawer(page);

  // Visible and inside the panel — the header toggle is behind the scrim, and at
  // phone widths under the panel entirely (#154).
  await expect(closeButton(page)).toBeVisible();

  await closeButton(page).click();

  await expect(nav(page)).not.toHaveAttribute('data-dds-open', '');
  await expect(scrim(page)).not.toHaveAttribute('data-dds-open', '');
  await expect(content(page)).not.toHaveAttribute('inert', '');
  await expect(page.locator('html')).not.toHaveClass(/dds-scroll-locked/);
  await expect(toggle(page)).toBeFocused();
});

test('the close button is the first tab stop inside the drawer', async ({ page }) => {
  await openDrawer(page);

  // Structural rather than driving Tab: WebKit's `document.hasFocus()` goes false
  // under parallel workers and `toBeFocused()` then reports "inactive". The
  // property is that the close is first among the panel's focusable descendants,
  // ahead of every nav link — mirroring contentnav.
  const firstFocusableIsClose = await nav(page).evaluate((navEl) => {
    const first = navEl.querySelector(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    return !!first && first.matches('[data-dds-nav-close]');
  });
  expect(firstFocusableIsClose).toBe(true);
});

test('opening and closing the drawer leaves the page scroll where it was', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 760 });
  await page.goto(NAVIGATION);
  await setContainerWidth(page, DRAWER);

  // Drive the whole cycle from inside the page: a Playwright `.click()` would
  // scroll the toggle into view itself and mask what the component does. The
  // page is parked far below the drawer's own toggle — the case where a
  // focus-restore that scrolls to reveal it, or an `overflow: hidden` that drops
  // the offset, shows up as a jump (#156).
  const positions = await page.evaluate(() => {
    const out = [];
    const t = document.querySelector('#siteheader-drawer .dds-siteheader-toggle');
    const nav = document.querySelector('#siteheader-drawer .dds-primary-nav');
    const closeBtn = () => document.querySelector('#siteheader-drawer [data-dds-nav-close]');
    const y = () => Math.round(window.scrollY);

    window.scrollTo(0, 4000);
    out.push(y()); // parked
    t.click();
    out.push(y()); // drawer open
    closeBtn().click();
    out.push(y()); // closed via the in-panel button
    t.click();
    out.push(y()); // open again
    nav.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    out.push(y()); // closed via Escape
    return out;
  });

  expect(positions[0], 'the page did not park far enough down to expose the jump').toBeGreaterThan(
    2000
  );
  expect(new Set(positions).size, `the scroll moved across the cycle: ${positions.join(' → ')}`).toBe(
    1
  );
});

test('the close button is gone once the nav is inline', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(NAVIGATION);
  await setContainerWidth(page, INLINE);

  // A "Close" in an inline nav makes no sense — the wide container query hides it
  // with the rest of the panel furniture.
  await expect(closeButton(page)).toBeHidden();
});

test('the closed drawer panel is collapsed so it cannot widen the page', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 760 });
  await page.goto(NAVIGATION);
  await setContainerWidth(page, DRAWER);

  // The fixed panel is parked past the inline-end edge with `translate`, and
  // some engines count that toward the page's scrollable width when the
  // consumer's header is its containing block (a `backdrop-filter` header is
  // enough) — ~300px of phantom horizontal scroll with the drawer never opened.
  // `clip-path` clips paint, not the layout box, so it did not fix it (#155,
  // #157). Zeroing the box does: the resting panel measures ~0 wide.
  const closed = await nav(page).evaluate((n) => n.getBoundingClientRect().width);
  expect(closed, 'the closed drawer panel still has width to overflow with').toBeLessThan(2);

  // ...and opens to its full size.
  await toggle(page).click();
  await expect(nav(page)).toHaveAttribute('data-dds-open', '');
  const open = await nav(page).evaluate((n) => n.getBoundingClientRect().width);
  expect(open, 'the drawer did not expand on open').toBeGreaterThan(200);
});

test('following a link closes the drawer without taking focus back', async ({ page }) => {
  await openDrawer(page);

  await nav(page).locator('a[href]').first().click();

  await expect(nav(page)).not.toHaveAttribute('data-dds-open', '');
  await expect(content(page)).not.toHaveAttribute('inert', '');
  // Deliberately not the toggle: the link is a navigation, and moving focus back
  // first would compete with it.
  await expect(toggle(page)).not.toBeFocused();
});

test('growing past the threshold while open clears inert and the scroll lock', async ({ page }) => {
  await openDrawer(page);

  await setContainerWidth(page, INLINE);

  // The CSS makes the nav inline again on its own; what it cannot undo is the
  // state on `<html>` and the content — and that is the state that strands a
  // page looking normal but frozen.
  await expect(content(page)).not.toHaveAttribute('inert', '');
  await expect(page.locator('html')).not.toHaveClass(/dds-scroll-locked/);
  await expect(toggle(page)).toBeHidden();
  await expect(nav(page)).toBeVisible();
  await expect(nav(page).locator('a').first()).toBeVisible();
});

test('the default in-flow header is untouched by the drawer logic', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(NAVIGATION);

  const plain = page.locator('.dds-siteheader').first();
  await page.evaluate(() => {
    document.querySelector('.dds-siteheader-frame').closest('.ref-bp-stage').style.inlineSize =
      '600px';
  });
  const plainToggle = plain.locator('.dds-siteheader-toggle');
  await expect(plainToggle).toBeVisible();

  await plainToggle.click();
  await expect(plainToggle).toHaveAttribute('aria-expanded', 'true');

  // No `data-dds-drawer`: none of the modal machinery runs.
  await expect(plain.locator('.dds-primary-nav')).not.toHaveAttribute('data-dds-open', '');
  await expect(page.locator('html')).not.toHaveClass(/dds-scroll-locked/);
});
