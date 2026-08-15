/**
 * Dessau — every page loads without a console error.
 *
 *   npx playwright test tests/console.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * `dds.js` catches a throw per registry entry, deliberately: one broken
 * enhancement must not stop the other twenty-one from running. The cost of that
 * decision is that a throw becomes a console message and nothing else. The page
 * still renders, still submits, still navigates — it simply does one fewer thing
 * than it documents, and only somebody with devtools open finds out.
 *
 * `tests/enhancement.spec.mjs` already asserts a clean console, but on
 * `reference/patterns.html` alone. Every reference page loads the same scripts
 * against different markup, and markup is what the enhancements read. A selector
 * that throws on a component only demonstrated on `content.html` is invisible to
 * a test that only ever opens `patterns.html`.
 *
 * So: every page, cheaply, with no knowledge of what is on it. That is the
 * opposite trade from the rest of the suite — no depth at all, and complete
 * coverage of the surface.
 *
 * -----------------------------------------------------------------------------
 * Errors fail. Warnings are reported.
 * -----------------------------------------------------------------------------
 *
 * A warning is frequently not ours: a deprecation notice from an engine, a
 * cookie policy note, an autoplay refusal. Failing on those makes the first
 * browser update a red build for a reason nobody in this repository can fix,
 * and a gate that cries wolf gets switched off.
 *
 * They are still worth seeing, so they are attached to the test result rather
 * than discarded. Visible and non-blocking is the honest treatment.
 *
 * @covers none — it asserts that no enhancement throws, which is every one of
 *   them at once and none of them in particular. Coverage means watching a
 *   component do its job; this only watches it fail loudly.
 *
 */

import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Read from disk, not from a list written here.
 *
 * A hard-coded list means a page added next month is untested and nothing says
 * so — the same silent-gap failure this whole file exists to close.
 */
const REFERENCE_PAGES = readdirSync(join(ROOT, 'reference'))
  .filter((name) => name.endsWith('.html'))
  .sort()
  .map((name) => `/reference/${name}`);

/**
 * The root redirect is included because it is a real page with real script tags
 * — `theme-init.js` runs there before anything else, and it runs on every
 * consumer page too. Its zero-delay `<meta refresh>` means this case also walks
 * the reference index; that is a bonus, not the purpose.
 */
const PAGES = ['/index.html', ...REFERENCE_PAGES];

/** Two frames after load, so anything deferred to rAF has run and thrown. */
const twoFrames = () =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

/**
 * Wait out the frames, and survive the page leaving while we do.
 *
 * The root redirect is a zero-delay `<meta refresh>`, so it navigates during
 * exactly this wait and destroys the context the evaluation was running in.
 * That is the page doing its job, not a failure — but it arrives as an
 * exception, and the first version of this file reported it as one.
 *
 * Console listeners are attached to the page, not to the document, so they keep
 * collecting across the navigation. Nothing is lost by settling again on the
 * other side.
 */
async function settle(page) {
  try {
    await page.evaluate(twoFrames);
  } catch (error) {
    if (!/Execution context was destroyed|navigation/i.test(error.message)) throw error;
    await page.waitForLoadState('load');
    await page.evaluate(twoFrames);
  }
}

for (const path of PAGES) {
  test(`${path} loads with no console error`, async ({ page }, testInfo) => {
    const errors = [];
    const warnings = [];

    page.on('console', (message) => {
      const text = `${message.text()}  ← ${message.location().url || path}`;
      if (message.type() === 'error') errors.push(text);
      if (message.type() === 'warning') warnings.push(text);
    });

    /**
     * An uncaught exception is not always a console message in every engine, and
     * it is the more serious of the two. Collected separately so the failure
     * message can say which it was.
     */
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    /**
     * A request that never resolves is a failure of its own — a stylesheet or a
     * script that 404s leaves the page looking plausible and behaving wrongly.
     * `check-reference.mjs` verifies that referenced assets exist on disk; this
     * catches the ones the server refuses to hand over.
     */
    const failedRequests = [];
    page.on('requestfailed', (request) => {
      const reason = request.failure()?.errorText ?? 'failed';

      /* An ABORTED request is not a request that never arrived — it is one that
         stopped being wanted. The root `index.html` is a meta-refresh redirect,
         so a favicon still in flight when the navigation happens is cancelled by
         the browser, and Firefox reports that as `NS_BINDING_ABORTED`. Counting
         it as a failure made a page that works exactly as designed fail on one
         engine, intermittently, depending on which of two requests won a race.

         `check-reference.mjs` verifies that every referenced asset exists on
         disk, so a genuinely missing file is still caught — by the check that
         can be sure. */
      if (/ABORTED/i.test(reason)) return;

      failedRequests.push(`${reason} ${request.url()}`);
    });

    const response = await page.goto(path, { waitUntil: 'load' });
    expect(response?.status(), `${path} did not load`).toBeLessThan(400);

    await settle(page);

    if (warnings.length) {
      testInfo.annotations.push({ type: 'console warning', description: warnings.join('\n') });
    }

    expect(pageErrors, `${path} threw an uncaught exception`).toEqual([]);
    expect(errors, `${path} logged a console error`).toEqual([]);
    expect(failedRequests, `${path} has a request that never arrived`).toEqual([]);
  });
}
