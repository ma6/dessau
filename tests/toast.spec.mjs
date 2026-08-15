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
