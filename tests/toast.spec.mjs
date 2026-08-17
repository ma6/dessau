/**
 * Dessau — a toast carries its status on its fill, its icon and its words.
 *
 *   npx playwright test tests/toast.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * The toasts were reported as having lost their colour, and every static check
 * disagreed: `.dds-toast-success` and its three siblings are declared after the
 * base rule, in the same layer, in the right order; `--dds-color-success-solid`
 * resolves to a real value in both themes; nothing else in the CSS declares
 * those tokens; nothing unlayered on the reference pages touches `.dds-toast`.
 *
 * It turned out to be a stylesheet the browser had kept — the colour came back
 * on a reload. That is the outcome this repository already expects often enough
 * to stamp every asset with a content hash (#15), and it is exactly the failure
 * that cannot be told apart from a real defect by looking.
 *
 * Which is why the test stays. Not because the fill was broken, but because
 * fifteen minutes went into reading a stylesheet that was correct all along. The
 * next report of this shape is answered by one command, in the only place that
 * can answer it: the computed style of a real toast, in both themes.
 *
 * It is deliberately written against the SEMANTIC TOKEN rather than a colour
 * value. A test asserting `rgb(19, 90, 60)` would have to be edited every time
 * the palette moves, and would fail for a reason that has nothing to do with
 * what it is checking. What matters is that the fill is the status fill and not
 * the neutral surface — which is exactly the regression as described.
 *
 * The word and the icon are checked too, because the fill is not allowed to be
 * the only carrier (WCAG 1.4.1) and a test that only looked at colour would pass
 * a toast that says nothing to a screen reader.
 *
 * @covers none — `DDS.toast` is an API a product calls, not an enhancement that
 *   sweeps the DOM, so it registers no name for the coverage gate to match.
 *
 */

import { test, expect } from '@playwright/test';

const COMPONENTS = '/reference/components.html';

/** Resolve a semantic token the way the page does, to compare like with like. */
const token = (page, name) =>
  page.evaluate(
    (property) => getComputedStyle(document.documentElement).getPropertyValue(property).trim(),
    name
  );

/** Fire a toast of one kind and hand back its element. */
async function raise(page, kind) {
  await page.evaluate((k) => window.DDS.toast('A thing happened', { kind: k, duration: 0 }), kind);
  return page.locator(`.dds-toast-${kind}`).last();
}

for (const theme of ['light', 'dark']) {
  test.describe(`in ${theme} mode`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(COMPONENTS);
      await page.evaluate((t) => {
        document.documentElement.dataset.theme = t;
      }, theme);
    });

    for (const [kind, tokenName] of [
      ['success', '--dds-color-success-solid'],
      ['warning', '--dds-color-warning-solid'],
      ['error', '--dds-color-error-solid'],
      ['info', '--dds-color-info-solid'],
    ]) {
      test(`a ${kind} toast is filled with its status colour`, async ({ page }) => {
        const toast = await raise(page, kind);
        await expect(toast).toBeVisible();

        const [fill, expected, neutral] = await Promise.all([
          toast.evaluate((element) => getComputedStyle(element).backgroundColor),
          token(page, tokenName),
          token(page, '--dds-color-surface-raised'),
        ]);

        /* Both are read from the same document, so this compares what the browser
           computed with what the token says — no colour literal in the test. */
        const asRendered = await page.evaluate((value) => {
          const probe = document.createElement('div');
          probe.style.backgroundColor = value;
          document.body.appendChild(probe);
          const computed = getComputedStyle(probe).backgroundColor;
          probe.remove();
          return computed;
        }, expected);

        expect(
          fill,
          `the ${kind} toast is painted ${fill}, and ${tokenName} is ${asRendered} — ` +
            `if it is the neutral surface (${neutral}) instead, the variant rule is ` +
            `not reaching the element`
        ).toBe(asRendered);
      });
    }

    test('the status is also in words and in an icon, not only in the fill', async ({ page }) => {
      const toast = await raise(page, 'error');

      // WCAG 1.4.1: colour is never the only carrier. The word is visually
      // hidden because the fill and the icon say it to everyone else.
      await expect(toast.locator('.dds-sr-only')).toHaveText(/error/i);
      await expect(toast.locator('svg.dds-icon').first()).toBeVisible();
    });
  });
}

/**
 * -----------------------------------------------------------------------------
 * Fired while a modal dialog is open (#115, #121)
 * -----------------------------------------------------------------------------
 *
 * A modal `<dialog>` always outranks ordinary top-layer content — measured
 * directly in #115, including a `popover="manual"` toast region, which still
 * lost to an open dialog on all three engines. The only way for a toast to
 * render above an open dialog is to become part of the dialog's own top-layer
 * box: appended inside it, not beside it.
 */
test.describe('while a dialog is open', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(COMPONENTS);
  });

  test('the toast is appended inside the dialog, not at body level', async ({ page }) => {
    await page.click('[data-dds-dialog-open="demo-dialog"]');
    await expect(page.locator('#demo-dialog')).toBeVisible();

    await page.evaluate(() => window.DDS.toast('Saved from inside the dialog', { duration: 0 }));

    const insideDialog = page.locator('#demo-dialog > .dds-toast-region > .dds-toast');
    await expect(insideDialog).toHaveCount(1);

    // Not also duplicated at body level.
    const bodyLevel = page.locator('body > .dds-toast-region > .dds-toast');
    await expect(bodyLevel).toHaveCount(0);
  });

  test('the toast is visually on top of the dialog, not hidden behind it', async ({ page }) => {
    await page.click('[data-dds-dialog-open="demo-dialog"]');
    await page.evaluate(() => window.DDS.toast('On top', { duration: 0 }));

    const toast = page.locator('#demo-dialog .dds-toast').last();
    await expect(toast).toBeVisible();

    // The element actually under the toast's own centre point must be the
    // toast itself (or something inside it) — not the dialog's backdrop,
    // which is exactly what #115 found before this fix.
    const isOnTop = await toast.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const topElement = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2
      );
      return el.contains(topElement);
    });
    expect(isOnTop).toBe(true);
  });

  test('the toast still carries role=status and aria-live once reparented', async ({ page }) => {
    await page.click('[data-dds-dialog-open="demo-dialog"]');
    await page.evaluate(() => window.DDS.toast('Announced', { duration: 0 }));

    const region = page.locator('#demo-dialog > .dds-toast-region');
    await expect(region).toHaveAttribute('role', 'status');
    await expect(region).toHaveAttribute('aria-live', 'polite');
    await expect(region).toContainText('Announced');
  });

  test('opening the toast does not move focus away from the dialog', async ({ page }) => {
    await page.click('[data-dds-dialog-open="demo-dialog"]');
    const focusedBefore = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);

    await page.evaluate(() => window.DDS.toast('Should not steal focus', { duration: 0 }));

    const focusedAfter = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
    expect(focusedAfter).toBe(focusedBefore);
  });

  test('once the dialog closes, a new toast goes to the body-level region again', async ({ page }) => {
    await page.click('[data-dds-dialog-open="demo-dialog"]');
    await page.evaluate(() => window.DDS.toast('Inside', { duration: 0 }));
    await page.keyboard.press('Escape');
    await expect(page.locator('#demo-dialog')).toBeHidden();

    await page.evaluate(() => window.DDS.toast('Outside again', { duration: 0 }));

    const bodyToast = page.locator('body > .dds-toast-region > .dds-toast');
    await expect(bodyToast).toHaveCount(1);
    await expect(bodyToast).toContainText('Outside again');
  });

  test('with no dialog open, a toast still goes to the body-level region', async ({ page }) => {
    await page.evaluate(() => window.DDS.toast('Ordinary toast', { duration: 0 }));

    await expect(page.locator('body > .dds-toast-region > .dds-toast')).toHaveCount(1);
  });
});
