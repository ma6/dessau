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
 * No web server
 * -----------------------------------------------------------------------------
 *
 * The reference pages are opened over `file://`. That is deliberate: it is how a
 * person actually opens them, and it means the tests exercise the same thing the
 * documentation promises — no build, no server, open the file. If something only
 * works when served, the reference is broken and the test should say so.
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
    // Reference pages are local files; there is no base URL to resolve against.
    baseURL: undefined,
    trace: 'retain-on-failure',
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
  ],
});
