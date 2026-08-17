/**
 * Dessau — `.dds-grid` never leaves more than one empty cell in its last row.
 *
 *   npx playwright test tests/grid.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * `.dds-grid`'s `auto-fit` column count is a pure function of container width,
 * never item count. Invisible when every row is full or fully empty; silently
 * wrong when a partial last row inherits real column widths from a
 * fully-populated earlier row — confirmed live twice (#126, ma6/dessau.dev#5):
 * `reference/components.html`'s own card demo (4 items, 3 columns fit at
 * 1920px, one item stranded next to two empty cells) and a consuming
 * product's six-card section.
 *
 * The first test reproduces the exact reported instance. The second sweeps a
 * wide range of item counts, because a fix that only works for 4 items is not
 * a fix for the rule the ticket actually asked for — "at any item count".
 * The third checks the two invariants the ticket is explicit about: the
 * mechanism may only ever REDUCE the column count `auto-fit` would otherwise
 * use, never increase it, and it must react to item count changing after
 * load, not only to the viewport resizing — a grid whose items are filtered
 * or paginated changes count with no resize event to trigger a recompute.
 *
 * @covers grid
 *
 */

import { test, expect } from '@playwright/test';

const COMPONENTS = '/reference/components.html';

/** Reads the actually-rendered column count (0px collapsed tracks excluded —
 *  those are real `auto-fit` behaviour, not a defect) and the resulting last
 *  row's empty-cell count for a given `.dds-grid` element. */
function measure(page, selector) {
  return page.$eval(selector, (grid) => {
    const count = grid.children.length;
    const tracks = getComputedStyle(grid)
      .gridTemplateColumns.trim()
      .split(/\s+/)
      .map(parseFloat)
      .filter((w) => w > 0);
    const columns = tracks.length;
    const rows = columns ? Math.ceil(count / columns) : 0;
    const lastRowItems = columns ? count - (rows - 1) * columns : 0;
    const emptyCells = columns ? columns - lastRowItems : 0;
    return { count, columns, emptyCells };
  });
}

test('the reported instance: 4 cards, wide viewport, no longer stranded', async ({ page }) => {
  // The exact width ma6/dessau.dev#5 measured the bug at: 3 natural columns,
  // "Interactive" alone in row two next to two empty cells.
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.goto(COMPONENTS);

  const { emptyCells } = await measure(page, '.dds-grid');
  expect(emptyCells).toBeLessThanOrEqual(1);
});

test('never more than one empty trailing cell, at a range of item counts and widths', async ({
  page,
}) => {
  await page.goto(COMPONENTS);

  const widths = [320, 768, 1024, 1440, 1920, 2400];
  const counts = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 17];

  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });

    for (const count of counts) {
      const result = await page.evaluate((n) => {
        const grid = document.querySelector('.dds-grid');
        grid.innerHTML = '';
        for (let i = 0; i < n; i += 1) {
          grid.appendChild(document.createElement('div'));
        }
        return new Promise((resolve) => {
          // Two frames: one for the MutationObserver callback to run, one
          // for the style it applies to be reflected in computed style.
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              const tracks = getComputedStyle(grid)
                .gridTemplateColumns.trim()
                .split(/\s+/)
                .map(parseFloat)
                .filter((w) => w > 0).length;
              const rows = tracks ? Math.ceil(n / tracks) : 0;
              const lastRowItems = tracks ? n - (rows - 1) * tracks : 0;
              resolve({ n, tracks, emptyCells: tracks ? tracks - lastRowItems : 0 });
            })
          );
        });
      }, count);

      expect(
        result.emptyCells,
        `width ${width}px, ${count} items: ${result.tracks} columns, ${result.emptyCells} empty cells`
      ).toBeLessThanOrEqual(1);
    }
  }
});

test('only ever reduces the column count, and reacts to item count changing without a resize', async ({
  page,
}) => {
  await page.goto(COMPONENTS);
  await page.setViewportSize({ width: 1920, height: 900 });

  // Establish the natural (unassisted) column count at this width.
  const natural = await page.evaluate(() => {
    const grid = document.querySelector('.dds-grid');
    const previous = grid.style.gridTemplateColumns;
    grid.style.removeProperty('grid-template-columns');
    const tracks = getComputedStyle(grid)
      .gridTemplateColumns.trim()
      .split(/\s+/)
      .map(parseFloat)
      .filter((w) => w > 0).length;
    grid.style.setProperty('grid-template-columns', previous);
    return tracks;
  });

  // An item count with two empty cells at the natural count, so a reduction
  // is expected to fire.
  const applied = await page.evaluate((n) => {
    const grid = document.querySelector('.dds-grid');
    grid.innerHTML = '';
    for (let i = 0; i < n; i += 1) grid.appendChild(document.createElement('div'));
    return new Promise((resolve) => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          resolve(
            getComputedStyle(grid)
              .gridTemplateColumns.trim()
              .split(/\s+/)
              .map(parseFloat)
              .filter((w) => w > 0).length
          );
        })
      );
    });
  }, natural + 2);

  expect(applied).toBeLessThanOrEqual(natural);

  // Now change item count alone, no resize: a filtered/paginated grid's
  // real-world case. The count must be re-measured, not stale.
  const afterMutation = await page.evaluate(() => {
    const grid = document.querySelector('.dds-grid');
    grid.innerHTML = '';
    // A single item: always clean, and a different answer than whatever
    // was just applied, so a stale override would be caught here.
    grid.appendChild(document.createElement('div'));
    return new Promise((resolve) => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          resolve(grid.style.gridTemplateColumns || '(none)');
        })
      );
    });
  });

  expect(afterMutation).toBe('(none)');
});
