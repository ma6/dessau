/**
 * Dessau — the content navigation is modal without being a `<dialog>`.
 *
 *   npx playwright test tests/contentnav.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * `.dds-contentnav` is deliberately not a `<dialog>`: the same element has to be
 * a static column above 64rem, and the user agent closes a dialog with
 * `display: none`. So the modal behaviour is assembled by hand out of `inert`,
 * a scroll lock and manual focus handling.
 *
 * All of that was reasoned and none of it had been observed. Hand-assembled
 * modality is exactly the kind of thing that is correct in the source and wrong
 * in a browser, and every failure mode here is silent:
 *
 *   - `inert` that covers rather than removes leaves the content clickable and
 *     readable to a screen reader, behind a panel that looks modal;
 *   - focus left on a hidden element lands on `<body>`, so the next Tab starts
 *     from the top of the page — the user pressed Escape and was sent back to
 *     the skip link;
 *   - a stale `inert` or scroll lock leaves a page that looks entirely normal
 *     and cannot be scrolled or clicked. Nothing about it looks broken.
 *
 * The width cases matter most, and they are why this cannot be a static check:
 * the component measures its CONTAINER, not the viewport, so the interesting
 * transitions happen without the window changing size at all.
 *
 * @covers contentnav
 *
 */

import { test, expect } from '@playwright/test';

const NAVIGATION = '/reference/navigation.html';

const layout = (page) => page.locator('[data-dds-contentnav]');
const toggle = (page) => layout(page).locator('[data-dds-contentnav-toggle]');
const nav = (page) => layout(page).locator('.dds-contentnav');
const content = (page) => layout(page).locator('[data-dds-contentnav-content]');

/**
 * Set the width of the container the component measures, leaving the window
 * alone.
 *
 * The widths are the container's, not the viewport's, and the first version of
 * this file confused the two: it grew the window to 1400px and expected the
 * panel to become a column. The reference's content column is capped well below
 * that, so the frame never reached 64rem and the component was right to stay a
 * panel. Driving the container directly removes a whole class of test that fails
 * for a reason that has nothing to do with the component.
 *
 * A window resize reaches the same code through the same observer — the frame is
 * what is watched, and the window only matters insofar as it changes the frame.
 */
async function setContainerWidth(page, width) {
  await page.evaluate((value) => {
    document.querySelector('.dds-contentnav-frame').closest('.ref-bp-stage').style.inlineSize =
      value;
  }, width);
}

/** Below 64rem, so the nav is a panel. */
const PANEL = '640px';
/** Above it, so the nav is a static column and the toggle is gone. */
const COLUMN = '1200px';

async function openPanel(page) {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(NAVIGATION);
  await setContainerWidth(page, PANEL);
  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true');
}

test('opening the panel makes the content genuinely unavailable', async ({ page }) => {
  await openPanel(page);

  /**
   * `inert`, not `aria-hidden` and not a scrim alone. The attribute is the
   * mechanism: the platform then removes the subtree from the tab order and
   * from the accessibility tree, which is what "unavailable" has to mean for
   * everybody rather than only for a pointer.
   */
  await expect(content(page)).toHaveAttribute('inert', '');
  await expect(page.locator('html')).toHaveClass(/dds-scroll-locked/);

  // The panel itself takes focus, not its first link: it is labelled, so a
  // screen reader announces what opened before it starts reading the list.
  await expect(nav(page)).toBeFocused();
});

test('inert removes the content from the tab order, it does not merely cover it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(NAVIGATION);
  await setContainerWidth(page, PANEL);

  // Scoped to this component's content — the siteheader drawer demo on the same
  // page has an inert probe of its own.
  const probe = content(page).locator('[data-ref-inert-probe]');

  // Reachable before, so the assertion after means something.
  await probe.focus();
  await expect(probe).toBeFocused();

  await toggle(page).click();

  /**
   * Asking the element to take focus and watching it refuse. A `tabindex` sweep
   * would test the same property less directly, and `page.accessibility.snapshot()`
   * is Chromium-oriented — asking it what WebKit exposes is asking the wrong
   * question of the wrong engine, which is half of what went wrong in #9.
   */
  const focusedProbe = await page.evaluate(() => {
    const link = document.querySelector('[data-dds-contentnav-content] [data-ref-inert-probe]');
    link.focus();
    return document.activeElement === link;
  });

  expect(focusedProbe, 'a link inside the inert content still took focus').toBe(false);
});

test('Escape closes the panel and returns focus to the toggle, not to the body', async ({
  page,
}) => {
  await openPanel(page);

  await page.keyboard.press('Escape');

  await expect(nav(page)).not.toHaveAttribute('data-dds-open', '');
  await expect(content(page)).not.toHaveAttribute('inert', '');

  /**
   * The whole point. Focus left on a hidden element falls to `<body>`, and the
   * next Tab restarts at the top of the page — so somebody who opened the panel
   * and changed their mind is silently sent back to the skip link.
   */
  await expect(toggle(page)).toBeFocused();
});

test('following a link closes the panel without taking focus back', async ({ page }) => {
  await openPanel(page);

  await nav(page).locator('a[href]').first().click();

  await expect(nav(page)).not.toHaveAttribute('data-dds-open', '');

  /**
   * Deliberately NOT the toggle. These links go to other pages, and moving focus
   * back first would compete with the navigation already under way.
   */
  await expect(toggle(page)).not.toBeFocused();
});

test('growing past the threshold while open clears inert and the scroll lock', async ({ page }) => {
  await openPanel(page);

  // Wide enough that the container query turns the panel back into a column.
  await setContainerWidth(page, COLUMN);

  /**
   * The CSS makes the nav visible again on its own. What it cannot undo is the
   * state set on other elements — and a surviving `inert` or scroll lock leaves
   * a page that looks completely normal and cannot be scrolled or clicked.
   */
  await expect(content(page)).not.toHaveAttribute('inert', '');
  await expect(page.locator('html')).not.toHaveClass(/dds-scroll-locked/);
});

test('it is the container that decides, not the window', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(NAVIGATION);

  /**
   * A wide window and a narrow container. If the component read the viewport it
   * would stay a column here and the toggle would be hidden — which is the
   * failure a container-query component tested only at full width never sees.
   *
   * The demo sits in the reference's width switcher, so this is the same thing a
   * reader does by clicking one of its buttons.
   */
  await setContainerWidth(page, PANEL);

  await expect(toggle(page)).toBeVisible();
  await toggle(page).click();
  await expect(content(page)).toHaveAttribute('inert', '');

  /**
   * And back the other way, without the window ever changing size. The component
   * used to listen for `resize`, which never fires for this — so the panel state
   * survived the container becoming a column, leaving the page inert and locked
   * with nothing on screen to explain it.
   */
  await setContainerWidth(page, COLUMN);

  await expect(content(page)).not.toHaveAttribute('inert', '');
  await expect(page.locator('html')).not.toHaveClass(/dds-scroll-locked/);
});
