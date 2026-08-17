/**
 * Dessau — upload flow: per-file progress, cancel, and recovering from a
 * rejection without discarding what already worked.
 *
 *   npx playwright test tests/upload-flow.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * `.dds-uploadflow` had CSS, a specification, and a static markup snapshot of
 * three states — done, uploading, failed — with no `dds/js/patterns/
 * upload-flow.js` behind any of it (#24). No progress, no cancel, no way to
 * recover from a rejection without losing the files that had already
 * uploaded.
 *
 * Two recovery paths exist and look similar, and the test that matters most
 * here is proving they are not interchangeable: a client-side rejection
 * (too large) offers "Replace" because the SAME file will fail again — an
 * upload that failed after being accepted offers "Retry" because the file
 * itself was never the problem. Confusing the two either strands a working
 * file behind a needless re-pick, or endlessly retries a file that can never
 * succeed.
 *
 * -----------------------------------------------------------------------------
 * Deterministic instances, not the reference page's own demo
 * -----------------------------------------------------------------------------
 *
 * `reference/assets/patterns-demo.js` wraps every upload in the live
 * `#ref-uploadflow` specimen with a ~20% random failure, deliberately — a
 * human walking through the reference page needs the "failed after
 * accepting" recovery path reachable without a real connection happening to
 * drop. A test asserting one specific outcome cannot use that instance for
 * anything but the always-deterministic client-side rejection (over the
 * size limit, checked before any upload is attempted); everything that
 * needs a real upload to reliably succeed or reliably fail gets its own
 * isolated instance with a fixed `upload` function instead.
 *
 * @covers none — upload-flow has no `DDS.register` entry point by design
 *   (no sensible zero-config default exists for an `upload` function, the
 *   same reason combobox has `arraySource` and results has a plain filter
 *   but this does not), so there is no registered enhancement name for the
 *   coverage check to match this spec against
 *
 */

import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PATTERNS = '/reference/patterns.html';

function tempFile(name, bytes) {
  const path = join(tmpdir(), name);
  writeFileSync(path, Buffer.alloc(bytes, 'x'));
  return path;
}

/**
 * Builds an isolated `.dds-uploadflow` with a deterministic `upload`
 * function and returns a locator scoped to it — a fresh instance per call,
 * independent of the reference page's own live demo and its random failure.
 *
 * `maxBytes`, if given, MUST be set before `DDS.uploadFlow()` is called —
 * upload-flow.js reads `data-dds-uploadflow-max-bytes` once, at creation,
 * and caches it in a closure; setting the attribute afterwards has no
 * effect at all, which cost a debugging round trip to find out the hard way.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} id
 * @param {'succeed'|'fail-once'} behaviour
 * @param {number} [maxBytes]
 */
async function isolatedUploadFlow(page, id, behaviour, maxBytes) {
  await page.evaluate(
    ({ id, behaviour, maxBytes }) => {
      var root = document.createElement('div');
      root.id = id;
      root.className = 'dds-uploadflow';
      if (maxBytes) root.setAttribute('data-dds-uploadflow-max-bytes', String(maxBytes));
      root.innerHTML =
        '<p role="status" data-dds-uploadflow-summary></p>' +
        '<button type="button" data-dds-uploadflow-trigger>Choose</button>' +
        '<input type="file" multiple hidden data-dds-uploadflow-input>';
      document.body.appendChild(root);

      var attempts = 0;
      window.DDS.uploadFlow(root, {
        // A real delay, not an immediate resolve — synchronous success
        // skipped the "uploading" state before a test could ever observe
        // it, since it was already "done" by the next microtask. 1200ms
        // (not the first, shorter value tried) leaves headroom for the
        // cancel test's own click to land before the mock resolves on its
        // own — under load, a shorter delay raced the two and occasionally
        // lost, an "element was detached from the DOM" flake caused by the
        // upload completing out from under the click, not a product bug.
        // Must also honour ctx.signal itself: upload-flow.js's cancel
        // button calls controller.abort(), and a mock that ignores the
        // signal treats a cancelled upload as a normal success instead —
        // every real fetch/XHR-based `upload` is expected to respect it
        // for the same reason.
        upload: function (file, ctx) {
          attempts += 1;
          return new Promise(function (resolve, reject) {
            var timer = setTimeout(function () {
              if (behaviour === 'fail-once' && attempts === 1) {
                reject(new Error('simulated failure'));
                return;
              }
              ctx.onProgress(100);
              resolve();
            }, 1200);

            ctx.signal.addEventListener('abort', function () {
              clearTimeout(timer);
              reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
            });
          });
        },
      });
    },
    { id: id, behaviour: behaviour, maxBytes: maxBytes }
  );

  return page.locator('#' + id);
}

test('a small file uploads: progress runs, then done, and the summary counts it', async ({
  page,
}) => {
  await page.goto(PATTERNS);
  const scope = await isolatedUploadFlow(page, 'test-uploadflow-small', 'succeed');
  const small = tempFile('dessau-upload-small.txt', 1000);

  await scope.locator('[data-dds-uploadflow-input]').setInputFiles([small]);

  const item = scope.locator('.dds-uploadflow-item').first();
  await expect(item).toHaveAttribute('data-dds-state', 'uploading');
  await expect(item.locator('.dds-uploadflow-progress')).toBeVisible();

  await expect(item).toHaveAttribute('data-dds-state', 'done', { timeout: 3000 });
  await expect(scope.locator('[data-dds-uploadflow-summary]')).toContainText('1');
});

test('a file over the limit is rejected immediately, with a reason and Replace — not Retry', async ({
  page,
}) => {
  await page.goto(PATTERNS);
  const big = tempFile('dessau-upload-big.bin', 3 * 1024 * 1024); // over the live demo's 2 MB limit

  // Deterministic regardless of instance: the size check runs before any
  // upload is attempted, so the reference page's own demo is fine here.
  await page.locator('[data-dds-uploadflow-input]').setInputFiles([big]);

  const item = page.locator('.dds-uploadflow-item').first();
  await expect(item).toHaveAttribute('data-dds-state', 'failed');
  await expect(item.locator('.dds-uploadflow-reason')).toContainText('2');
  // Replace, specifically — not Retry. Retrying the identical oversized file
  // would only fail again.
  await expect(item.locator('button')).toContainText(/ersetzen/i);
});

test('replacing a rejected file removes it and uploads the new one in its place', async ({
  page,
}) => {
  await page.goto(PATTERNS);
  const scope = await isolatedUploadFlow(page, 'test-uploadflow-replace', 'succeed', 2097152);

  const big = tempFile('dessau-upload-big2.bin', 3 * 1024 * 1024);
  const small = tempFile('dessau-upload-replacement.txt', 500);

  const fileInput = scope.locator('[data-dds-uploadflow-input]');
  await fileInput.setInputFiles([big]);
  await expect(scope.locator('.dds-uploadflow-item')).toHaveCount(1);
  await expect(scope.locator('.dds-uploadflow-item').first()).toHaveAttribute('data-dds-state', 'failed');

  await scope.locator('.dds-uploadflow-item button').first().click(); // "Ersetzen"
  await fileInput.setInputFiles([small]);

  // Still exactly one item — the rejected one was replaced, not appended to.
  await expect(scope.locator('.dds-uploadflow-item')).toHaveCount(1);
  await expect(scope.locator('.dds-uploadflow-item').first()).toContainText('dessau-upload-replacement.txt');
  await expect(scope.locator('.dds-uploadflow-item').first()).toHaveAttribute('data-dds-state', 'done', {
    timeout: 3000,
  });
});

test('cancelling an upload in progress removes the item and does not count it', async ({
  page,
}) => {
  await page.goto(PATTERNS);
  const scope = await isolatedUploadFlow(page, 'test-uploadflow-cancel', 'succeed');
  // Large enough (well within the limit) that the simulated upload takes a
  // moment — cancel happens before either outcome either way.
  const file = tempFile('dessau-upload-cancel.bin', 500 * 1024);

  await scope.locator('[data-dds-uploadflow-input]').setInputFiles([file]);
  const item = scope.locator('.dds-uploadflow-item').first();
  await expect(item).toHaveAttribute('data-dds-state', 'uploading');

  await item.locator('button').click(); // Cancel
  await expect(scope.locator('.dds-uploadflow-item')).toHaveCount(0);
});

test('one rejected file does not discard a file that already succeeded', async ({ page }) => {
  await page.goto(PATTERNS);
  const scope = await isolatedUploadFlow(page, 'test-uploadflow-partial', 'succeed', 2097152);

  const small = tempFile('dessau-upload-good.txt', 1000);
  const big = tempFile('dessau-upload-bad.bin', 3 * 1024 * 1024);

  const fileInput = scope.locator('[data-dds-uploadflow-input]');
  await fileInput.setInputFiles([small]);
  await expect(scope.locator('.dds-uploadflow-item').first()).toHaveAttribute('data-dds-state', 'done', {
    timeout: 3000,
  });

  await fileInput.setInputFiles([big]);
  await expect(scope.locator('.dds-uploadflow-item')).toHaveCount(2);

  // The first file's success is untouched by the second one's rejection.
  await expect(scope.locator('.dds-uploadflow-item').first()).toHaveAttribute('data-dds-state', 'done');
  await expect(scope.locator('.dds-uploadflow-item').last()).toHaveAttribute('data-dds-state', 'failed');
});

test('a genuine upload failure (not a rejection) offers Retry, and retry re-sends the same file', async ({
  page,
}) => {
  await page.goto(PATTERNS);
  const scope = await isolatedUploadFlow(page, 'test-uploadflow-retry', 'fail-once');
  const file = tempFile('dessau-upload-retry.txt', 1000);

  await scope.locator('[data-dds-uploadflow-input]').setInputFiles([file]);

  const item = scope.locator('.dds-uploadflow-item');
  await expect(item).toHaveAttribute('data-dds-state', 'failed', { timeout: 2000 });
  await expect(item.locator('button')).toContainText(/retry/i);

  await item.locator('button').click();
  await expect(item).toHaveAttribute('data-dds-state', 'done');
  // Still the same file — retry re-sent it, it did not ask for a new one.
  await expect(item).toContainText('dessau-upload-retry.txt');
});
