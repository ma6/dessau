/**
 * Dessau — the dialog closes on the backdrop, and only on the backdrop.
 *
 *   npx playwright test tests/dialog.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * Light dismiss is now `closedby="any"` in the markup, with a feature-detected
 * fallback in `components.js` for engines that do not have it yet (#100). Two
 * implementations of one behaviour is exactly the situation where the two drift,
 * and only one of them runs on any given engine — so the assertions here are
 * about the behaviour and say nothing about which mechanism produced it.
 *
 * The second test is the one worth having. The hand-written version this replaced
 * closed on any `click` whose target was the dialog element, and that is not only
 * a backdrop click: a press that begins on a child and releases outside sends the
 * event to the common ancestor, which is the dialog. So selecting text in the
 * panel and overshooting threw the dialog away along with whatever the user was
 * doing. Nothing about that is visible in the source, nobody does it on purpose,
 * and it survived until a guide named the attribute that made the workaround
 * unnecessary.
 *
 * @covers dialog
 */

import { test, expect } from '@playwright/test';

const PAGE = '/reference/components.html';

async function openDialog(page) {
  await page.goto(PAGE);
  await page.locator('[data-dds-dialog-open="demo-dialog"]').first().click();

  const dialog = page.locator('dialog#demo-dialog');
  await expect(dialog).toHaveAttribute('open', '');
  return dialog;
}

test('the markup declares light dismiss rather than leaving it to script', async ({ page }) => {
  await page.goto(PAGE);

  /* Every `.dds-dialog` on the page, not just the one exercised below: the
     attribute is the mechanism on the engines that have it, and a dialog that
     misses it silently falls back to the compatibility path forever. */
  const dialogs = page.locator('dialog.dds-dialog');
  const count = await dialogs.count();
  expect(count).toBeGreaterThan(0);

  for (let index = 0; index < count; index += 1) {
    await expect(dialogs.nth(index)).toHaveAttribute('closedby', 'any');
  }
});

test('a click on the backdrop closes it', async ({ page }) => {
  const dialog = await openDialog(page);

  // Well outside the panel, which is centred: the top-left corner is backdrop on
  // every viewport this suite uses.
  await page.mouse.click(8, 8);

  await expect(dialog).not.toHaveAttribute('open', '');
});

test('a drag that starts inside and ends on the backdrop does not close it', async ({ page }) => {
  const dialog = await openDialog(page);

  const title = dialog.locator('.dds-dialog-title');
  const box = await title.boundingBox();

  /* A text selection that overshoots the panel. The `click` event lands on the
     dialog element, exactly as a backdrop click does — the difference is only
     where the press began, and that difference is the whole test. */
  await page.mouse.move(box.x + 4, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(8, 8, { steps: 12 });
  await page.mouse.up();

  await expect(
    dialog,
    'the dialog closed on a drag that started inside it, taking the selection with it'
  ).toHaveAttribute('open', '');
});

test('a click inside the panel does not close it', async ({ page }) => {
  const dialog = await openDialog(page);

  await dialog.locator('.dds-dialog-title').click();

  await expect(dialog).toHaveAttribute('open', '');
});

test('Escape still closes it', async ({ page }) => {
  const dialog = await openDialog(page);

  await page.keyboard.press('Escape');

  await expect(dialog).not.toHaveAttribute('open', '');
});

/* ===========================================================================
   The compatibility path, forced

   All three engines in this matrix now support `closedby`, so everything above
   is testing the browser rather than `components.js` — and the fallback would
   ship as code no run has ever executed, on its way to an older Safari where it
   is the only thing there is.
   =========================================================================== */

test.describe('without closedby support', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // What `components.js` feature-detects on.
      delete HTMLDialogElement.prototype.closedBy;

      // And the attribute itself, or the browser's own light dismiss keeps
      // running and the fallback is never the thing being measured.
      document.addEventListener(
        'DOMContentLoaded',
        () => {
          document.querySelectorAll('dialog.dds-dialog').forEach((dialog) => {
            dialog.removeAttribute('closedby');
          });
        },
        { once: true }
      );
    });
  });

  test('the fallback closes on the backdrop', async ({ page }) => {
    const dialog = await openDialog(page);

    await page.mouse.click(8, 8);

    await expect(dialog).not.toHaveAttribute('open', '');
  });

  test('the fallback survives a drag that starts inside', async ({ page }) => {
    const dialog = await openDialog(page);

    const box = await dialog.locator('.dds-dialog-title').boundingBox();

    await page.mouse.move(box.x + 4, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(8, 8, { steps: 12 });
    await page.mouse.up();

    /* The bug the old code had, isolated: `click` fires on the dialog element
       for this gesture exactly as it does for a backdrop click. */
    await expect(dialog).toHaveAttribute('open', '');
  });
});
