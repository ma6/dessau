/**
 * DDS — core runtime.
 *
 *   <script src="/dds/js/dds.js" defer></script>
 *
 * Provides four things and nothing else:
 *
 *   DDS.register(name, selector, setup)  register a progressive enhancement
 *   DDS.enhance(root)                    apply enhancements within a subtree
 *   DDS.announce(message, options)       speak to assistive technology
 *   DDS.theme                            read, set and observe the theme
 *
 * -----------------------------------------------------------------------------
 * The enhancement model
 * -----------------------------------------------------------------------------
 *
 * DDS never renders UI. Markup exists first and works first; JavaScript finds
 * elements that opted in via a `data-dds-*` attribute and adds behaviour that
 * the platform does not provide on its own.
 *
 * Two consequences worth being explicit about:
 *
 *  - If this file fails to load, the page still works. A form submits, a
 *    `<details>` still opens, a link still navigates, an address is still
 *    enterable by hand. What is lost is convenience, never capability.
 *
 *  - Enhancement is idempotent and re-runnable. `DDS.enhance(element)` after
 *    inserting markup is all a server-rendered, HTMX, Turbo or framework-driven
 *    product needs — there is no lifecycle to hook into and nothing to tear
 *    down. Elements are marked once enhanced and skipped thereafter.
 *
 * There are deliberately no Web Components here. Shadow DOM would encapsulate
 * away the custom properties that the whole token architecture depends on, and
 * a custom element that has not upgraded yet renders as nothing — which is the
 * opposite of progressive enhancement.
 */
(function (global) {
  'use strict';

  var VERSION = '0.1.0';
  var THEME_STORAGE_KEY = 'dds-theme';
  /** Used when neither a stored choice nor a system preference is available. */
  var FALLBACK_THEME = 'dark';
  var ENHANCED_FLAG = 'ddsEnhanced';

  /* =========================================================================
     Enhancement registry
     ========================================================================= */

  var registry = [];

  /**
   * Register a progressive enhancement.
   *
   * @param {string} name      Unique name, used to mark elements as enhanced.
   * @param {string} selector  What to look for.
   * @param {(element: Element) => void} setup  Called once per element.
   */
  function register(name, selector, setup) {
    registry.push({ name: name, selector: selector, setup: setup });
  }

  /**
   * Apply every registered enhancement inside `root`.
   *
   * Safe to call repeatedly and safe to call on a subtree: each element is
   * enhanced at most once per enhancement name.
   *
   * @param {ParentNode} [root=document]
   */
  function enhance(root) {
    var scope = root || document;

    registry.forEach(function (entry) {
      var elements = Array.prototype.slice.call(scope.querySelectorAll(entry.selector));

      // `querySelectorAll` looks only at descendants, so a root that itself
      // matches would be skipped. That is the common case when enhancing a
      // freshly inserted element.
      if (scope.nodeType === 1 && scope.matches && scope.matches(entry.selector)) {
        elements.unshift(scope);
      }

      elements.forEach(function (element) {
        var done = element.dataset[ENHANCED_FLAG];
        var seen = done ? done.split(' ') : [];
        if (seen.indexOf(entry.name) !== -1) return;

        seen.push(entry.name);
        element.dataset[ENHANCED_FLAG] = seen.join(' ').trim();

        try {
          entry.setup(element);
        } catch (error) {
          // One broken enhancement must not stop the others. The element keeps
          // whatever behaviour its markup already had.
          console.error('[DDS] enhancement "' + entry.name + '" failed', error, element);
        }
      });
    });
  }

  /* =========================================================================
     Live region announcements
     ========================================================================= */

  var liveRegions = {};

  /**
   * Create (once) and return a live region.
   *
   * Two separate regions, because politeness is not a per-message decision the
   * same element can make: a screen reader watches the element, and changing
   * `aria-live` on it mid-flight is unreliable.
   */
  function getLiveRegion(politeness) {
    if (liveRegions[politeness]) return liveRegions[politeness];

    var region = document.createElement('div');
    region.className = 'dds-sr-only';
    region.setAttribute('aria-live', politeness);
    // `role` is set as well as `aria-live`: some assistive technology honours
    // one and some the other, and the pairing is what makes it dependable.
    region.setAttribute('role', politeness === 'assertive' ? 'alert' : 'status');
    // Announce the whole region so a partial DOM update is read as one message
    // rather than as a fragment.
    region.setAttribute('aria-atomic', 'true');
    document.body.appendChild(region);

    liveRegions[politeness] = region;
    return region;
  }

  /**
   * Announce a message to assistive technology.
   *
   * @param {string} message
   * @param {{ assertive?: boolean }} [options]
   *   `assertive: true` interrupts whatever is being read. Reserve it for
   *   something the user must know immediately — a failed submit, a lost
   *   connection. Everything else is polite, because interrupting someone
   *   mid-sentence to tell them a list got shorter is hostile.
   */
  function announce(message, options) {
    var opts = options || {};
    var region = getLiveRegion(opts.assertive ? 'assertive' : 'polite');

    // Clearing first forces a change even when the new message is identical to
    // the previous one, which otherwise would not be announced at all. The
    // double rAF gives the platform a frame to notice the emptied region.
    region.textContent = '';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        region.textContent = message;
      });
    });
  }

  /* =========================================================================
     Theme
     ========================================================================= */

  var themeListeners = [];

  function currentTheme() {
    // `light` only when explicitly set; anything else, including a missing
    // attribute, resolves to dark. theme-init.js sets it before first paint.
    return document.documentElement.dataset.ddsTheme === 'light' ? 'light' : 'dark';
  }

  /**
   * The operating system preference, or null when it cannot be determined.
   *
   * Both values are queried rather than testing `dark` and assuming light —
   * otherwise "we cannot tell" is silently treated as "light". See theme-init.js.
   */
  function systemTheme() {
    if (!global.matchMedia) return null;
    if (global.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    if (global.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    return null;
  }

  function applyTheme(theme) {
    // Both attributes are written: `data-dds-theme` is the namespaced one, and
    // `data-theme` is the selector the CSS actually matches. Keeping the short
    // one means a product can toggle the theme with no DDS JavaScript at all.
    document.documentElement.dataset.ddsTheme = theme;
    document.documentElement.dataset.theme = theme;

    // Keep every toggle in the document in sync — there may be one in the
    // header and another in a settings panel.
    document.querySelectorAll('[data-dds-theme-toggle]').forEach(function (button) {
      button.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    });

    themeListeners.forEach(function (listener) {
      try {
        listener(theme);
      } catch (error) {
        console.error('[DDS] theme listener failed', error);
      }
    });
  }

  function setTheme(theme) {
    var next = theme === 'dark' ? 'dark' : 'light';
    applyTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch (error) {
      // Storage unavailable: the theme still applies for this page view.
    }
  }

  /**
   * Forget the explicit choice and follow the system again, falling back to dark.
   */
  function clearTheme() {
    try {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } catch (error) {
      /* ignore */
    }
    applyTheme(systemTheme() || FALLBACK_THEME);
  }

  var theme = {
    get: currentTheme,
    set: setTheme,
    clear: clearTheme,
    toggle: function () {
      setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    },
    /** Observe theme changes. Returns an unsubscribe function. */
    subscribe: function (listener) {
      themeListeners.push(listener);
      return function () {
        var index = themeListeners.indexOf(listener);
        if (index !== -1) themeListeners.splice(index, 1);
      };
    },
  };

  /* Follow the system live, but only while the reader has made no explicit
     choice. Someone whose operating system switches to dark at sunset expects the
     page to follow; someone who explicitly chose light expects it not to. An
     explicit action outranks an ambient signal, in both directions. */
  if (global.matchMedia) {
    global.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (event) {
      var stored = null;
      try {
        stored = localStorage.getItem(THEME_STORAGE_KEY);
      } catch (error) {
        /* ignore */
      }
      if (stored === 'light' || stored === 'dark') return;
      applyTheme(event.matches ? 'dark' : 'light');
    });
  }

  register('theme-toggle', '[data-dds-theme-toggle]', function (button) {
    // `aria-pressed` rather than swapping the label: the control is one thing
    // in two states ("Dark mode, pressed"), not two different controls. The
    // label must therefore stay constant — a button whose name changes when you
    // press it is announced as a different control each time.
    button.setAttribute('aria-pressed', currentTheme() === 'dark' ? 'true' : 'false');

    button.addEventListener('click', function () {
      theme.toggle();
      // The visual change is obvious to a sighted user and invisible to a
      // screen-reader user, so state changes are spoken.
      announce(currentTheme() === 'dark' ? 'Dark theme on' : 'Light theme on');
    });
  });

  /* =========================================================================
     Small shared helpers
     ========================================================================= */

  /**
   * Debounce: delay `fn` until `wait` ms have passed without another call.
   *
   * Used for anything driven by typing. Firing a request per keystroke wastes
   * the network, races its own responses, and — more importantly — produces a
   * live-region announcement per character, which makes a screen reader
   * unusable.
   */
  function debounce(fn, wait) {
    var timer = null;
    return function debounced() {
      var args = arguments;
      var context = this;
      clearTimeout(timer);
      timer = setTimeout(function () {
        timer = null;
        fn.apply(context, args);
      }, wait);
    };
  }

  /** Does the user want motion? Read at call time, not cached — it can change. */
  function prefersReducedMotion() {
    return Boolean(
      global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  /**
   * Escape text for insertion as HTML.
   *
   * Needed wherever a value from outside the application (a search query, a
   * provider response) is highlighted inside markup. Everything else in DDS
   * uses `textContent`; this exists for the one case that genuinely cannot.
   */
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Generate a DOM id that is unique in this document. */
  var idCounter = 0;
  function uniqueId(prefix) {
    var id;
    do {
      idCounter += 1;
      id = (prefix || 'dds') + '-' + idCounter;
    } while (document.getElementById(id));
    return id;
  }

  /* =========================================================================
     Public surface
     ========================================================================= */

  var DDS = {
    version: VERSION,
    register: register,
    enhance: enhance,
    announce: announce,
    theme: theme,
    utils: {
      debounce: debounce,
      prefersReducedMotion: prefersReducedMotion,
      escapeHtml: escapeHtml,
      uniqueId: uniqueId,
    },
  };

  global.DDS = DDS;

  // Enhance once the document is parsed. `defer` scripts run before
  // DOMContentLoaded fires, so the event is the right hook either way.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      enhance(document);
    });
  } else {
    enhance(document);
  }
})(typeof window !== 'undefined' ? window : globalThis);
