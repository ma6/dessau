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
