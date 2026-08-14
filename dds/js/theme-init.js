/**
 * DDS — theme initialiser.
 *
 * Load this SYNCHRONOUSLY in <head>, before any stylesheet:
 *
 *   <script src="/dds/js/theme-init.js"></script>
 *
 * Do not add `defer` or `async`, and do not move it to the end of <body>.
 *
 * Why a blocking script, when blocking scripts are normally the thing to avoid:
 * the theme has to be on the <html> element before the first paint. Any later and
 * the page paints in one theme and repaints in the other — a flash on every
 * navigation. That flash is worse than the sub-millisecond cost of this file,
 * which is why it is deliberately tiny and has no dependencies.
 *
 * -----------------------------------------------------------------------------
 * Resolution order
 * -----------------------------------------------------------------------------
 *
 *   1. an explicit stored choice        →  that choice
 *   2. the operating system preference  →  that preference
 *   3. neither is known                 →  dark
 *
 * Step 3 is the part worth explaining. `prefers-color-scheme` is queried for BOTH
 * values rather than testing `dark` and assuming light otherwise:
 *
 *   - `(prefers-color-scheme: dark)` matches   → the system asked for dark
 *   - `(prefers-color-scheme: light)` matches  → the system asked for light
 *   - neither matches                          → no support, no answer → dark
 *
 * Testing only for `dark` would silently treat "we cannot tell" as "light", which
 * is how the default ends up being light for everyone on an older browser.
 *
 * The stored choice always wins, in both directions. Someone who explicitly chose
 * light expects light even after their operating system switches to dark at
 * sunset — an explicit action outranks an ambient signal.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'dds-theme';
  /** Used when neither a stored choice nor a system preference is available. */
  var FALLBACK_THEME = 'dark';

  function apply(theme) {
    // Both attributes are written: `data-dds-theme` is the namespaced one and
    // `data-theme` is the selector the CSS matches. Keeping the short one means a
    // product can toggle the theme with no DDS JavaScript at all.
    document.documentElement.dataset.ddsTheme = theme;
    document.documentElement.dataset.theme = theme;
  }

  function systemTheme() {
    if (!window.matchMedia) return null;
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    return null;
  }

  try {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      apply(stored);
    } else {
      apply(systemTheme() || FALLBACK_THEME);
    }
  } catch (error) {
    // localStorage throws in private browsing modes and when storage is blocked
    // by policy. A missing preference is not worth breaking the page over — fall
    // back to the system, then to the default.
    apply(systemTheme() || FALLBACK_THEME);
  }
})();
