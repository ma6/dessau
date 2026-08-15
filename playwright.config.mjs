/**
 * Dessau — browser test configuration.
 *
 *   npx playwright test
 *
 * -----------------------------------------------------------------------------
 * What belongs in a browser test here, and what does not
 * -----------------------------------------------------------------------------
 *
 * Most of what could go wrong in Dessau is caught without a browser, by the
 * `scripts/check-*.mjs` gates: a token that does not exist, a class the JavaScript
 * toggles but no stylesheet defines, a contrast pair below 4.5:1, a component
 * documented but never demonstrated. Those are static facts, and a static check
 * finds them faster and more reliably than a browser can.
 *
 * A browser is for the things that are only true once the cascade has run:
 *
 *   - a custom property that resolves to a different value than intended, because
 *     of inheritance rather than because of a typo;
 *   - a UA stylesheet beating an author rule, which is how every closed `<dialog>`
 *     stayed in the layout and swallowed clicks;
 *   - focus actually moving where it was meant to;
 *   - `inert` genuinely removing a subtree from the tab order.
 *
 * Each of those has already shipped broken here at least once, and each looked
 * correct in the source.
 *
 * -----------------------------------------------------------------------------
 * Served over HTTP, and why that had to change
 * -----------------------------------------------------------------------------
 *
 * These tests first ran over `file://`, on the reasoning that it is how a person
 * actually opens the pages and that anything which only works when served is broken.
 *
 * That was wrong in one specific way, and the first run said so. A font preloaded
 * with `crossorigin` — which is required for a preload to be usable at all — is
 * blocked by CORS from a `file://` origin, because the origin is `null`. Every page
 * therefore logged two console errors that had nothing to do with the page, which
 * made "assert there were no console errors" unusable.
 *
 * The pages do work from `file://`. What does not work is self-hosted fonts, and no
 * amount of markup fixes that: it is a property of the protocol. So the tests are
 * served, and the limitation is documented in README.md rather than encoded into an
 * assertion that would have to ignore real errors to tolerate it.
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.mjs',

  // A failing check must fail the run, not be retried until it passes.
  retries: 0,
  forbidOnly: !!process.env.CI,

  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: 'http://127.0.0.1:8123',
    trace: 'retain-on-failure',
  },

  /**
   * Python's own server, because it is already the command README.md tells a reader
   * to use. One fewer dependency, and the tests exercise the same setup the
   * documentation describes.
   */
  webServer: {
    command: 'python3 -m http.server 8123 --bind 127.0.0.1',
    url: 'http://127.0.0.1:8123/reference/index.html',
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    /**
     * WebKit is not optional here. It is the engine on every iPhone and iPad, it is
     * the last to ship several of the features Dessau relies on, and it is where a
     * container query or an `:has()` selector behaves differently first.
     */
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    /**
     * Firefox, because two engines out of three is a choice and the missing one was
     * the only Gecko. Blink and WebKit agree with each other more often than either
     * agrees with Gecko, so a suite of those two can be entirely green while the
     * third engine is where `@supports`-gated features, anchor positioning and
     * `interpolate-size` actually diverge (#22).
     *
     * It is the cheapest half of that ticket. The expensive half — somebody opening
     * eight pages on three engines in both themes and looking — a test run cannot
     * do, because a layout that is wrong but not broken passes every assertion in
     * this suite.
     */
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
});
