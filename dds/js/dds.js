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
 * There is exactly one exception, and it is documented as one: the password
 * reveal toggle acts on `<input type="password">` itself, because its absence is
 * a WCAG 2.2 3.3.8 failure rather than a missing convenience. See DECISIONS.md
 * 027 — including the three conditions any future exception has to meet.
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

  var VERSION = '1.2.0';
  var THEME_STORAGE_KEY = 'dds-theme';
  /** Used when neither a stored choice nor a system preference is available. */
  var FALLBACK_THEME = 'dark';

  /**
   * Toggle wording, per language, chosen by `DDS.utils.language(button)`.
   *
   * Two strings per theme: `short` is the visible label, `action` is the
   * accessible name, and `action` begins with `short` so the name contains the
   * visible label (WCAG 2.5.3 Label in Name).
   *
   * Kept here rather than in the markup so that every toggle in a document stays
   * consistent without the page having to repeat the strings — and so switching
   * one updates the wording on all of them.
   */
  var THEME_LABELS = {
    en: {
      dark: {
        short: 'Dark',
        action: 'Dark theme — switch on',
        applied: 'Dark — dark theme on',
      },
      light: {
        short: 'Light',
        action: 'Light theme — switch on',
        applied: 'Light — light theme on',
      },
    },
    de: {
      dark: {
        short: 'Dunkel',
        action: 'Dunkel — dunkles Design einschalten',
        applied: 'Dunkel — dunkles Design ist eingeschaltet',
      },
      light: {
        short: 'Hell',
        action: 'Hell — helles Design einschalten',
        applied: 'Hell — helles Design ist eingeschaltet',
      },
    },
  };

  /**
   * The wording for one toggle, in the language of the place it sits.
   *
   * `applied` is the third string and it exists because the announcement used to
   * be assembled here as `labels[…].short + ' — dark theme on'` — a German label
   * followed by an English sentence, spoken as one message. Wording that varies
   * by language cannot be half in a table and half in the code.
   */
  function themeLabelsFor(button) {
    return wording(button, THEME_LABELS);
  }
  var ENHANCED_FLAG = 'ddsEnhanced';

  /* =========================================================================
     Enhancement registry
     ========================================================================= */

  var registry = [];

  /**
   * Whether the initial document-wide sweep has run.
   *
   * Registrations that arrive after it enhance themselves immediately (see
   * `register`), which is what makes script order irrelevant.
   */
  var swept = false;

  /**
   * Register a progressive enhancement.
   *
   * @param {string} name      Unique name, used to mark elements as enhanced.
   * @param {string} selector  What to look for.
   * @param {(element: Element) => void} setup  Called once per element.
   */
  function register(name, selector, setup) {
    var entry = { name: name, selector: selector, setup: setup };
    registry.push(entry);

    /**
     * If the first sweep has already happened, enhance this one pattern now.
     *
     * Without it, load order silently decides whether anything works. Every
     * pattern lives in its own file and registers when that file runs, so a
     * pattern registered after the sweep would never be applied — the markup
     * renders, the behaviour is simply absent, and nothing reports a problem.
     *
     * That is not a hypothetical ordering worry. It shipped: `enhance(document)`
     * ran while `document.readyState` was `"interactive"`, which is the state
     * during deferred script execution — so the sweep ran immediately after
     * `dds.js` and before any component or pattern file had registered. Nothing
     * on any reference page was enhanced.
     *
     * Making registration self-sufficient means order genuinely does not matter,
     * which is what a system dropped in as plain script tags needs.
     */
    if (swept) applyEntry(entry, document);
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
      applyEntry(entry, scope);
    });
  }

  /** Apply one registered enhancement within one scope. */
  function applyEntry(entry, scope) {
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
  }

  /* =========================================================================
     Live region announcements
     ========================================================================= */

  var liveRegions = {};

  /**
   * Create (once) and return a live region.
   *
   * One region per politeness *and* per language, and both for the same reason:
   * a screen reader watches the element, and changing what the element says
   * about itself while it is being watched is not dependable. `aria-live` is the
   * obvious case. `lang` is the one that was missed — see below.
   *
   * @param {string} politeness  `polite` or `assertive`.
   * @param {string} lang  A primary language subtag, or `''` for "not stated",
   *   which leaves the region inheriting the document's language.
   */
  function getLiveRegion(politeness, lang) {
    var key = politeness + '|' + lang;
    if (liveRegions[key]) return liveRegions[key];

    var region = document.createElement('div');
    region.className = 'dds-sr-only';
    region.setAttribute('aria-live', politeness);
    // `role` is set as well as `aria-live`: some assistive technology honours
    // one and some the other, and the pairing is what makes it dependable.
    region.setAttribute('role', politeness === 'assertive' ? 'alert' : 'status');
    // Announce the whole region so a partial DOM update is read as one message
    // rather than as a fragment.
    region.setAttribute('aria-atomic', 'true');
    if (lang) region.setAttribute('lang', lang);
    document.body.appendChild(region);

    liveRegions[key] = region;
    return region;
  }

  /**
   * Announce a message to assistive technology.
   *
   * `from` is the element the message is about — the same one whose wording table
   * produced it. **Pass it.** The message is not spoken where it was raised: it is
   * written into a region appended to `<body>`, which inherits the document's
   * language and nothing else's. Without `from`, a German sentence from a
   * `lang="de"` component is read out in an English voice on an English page. The
   * words are right, the pronunciation is not, and it is inaudible to everybody
   * who can see the screen. That is how it survived every check in this
   * repository until somebody listened to it (#44).
   *
   * Omitting `from` says "this is about the document as a whole" — an application
   * -level message, the same argument the toast region makes about itself. It is
   * a claim, not a default to fall into.
   *
   * @param {string} message
   * @param {{ assertive?: boolean, from?: Element }} [options]
   *   `assertive: true` interrupts whatever is being read. Reserve it for
   *   something the user must know immediately — a failed submit, a lost
   *   connection. Everything else is polite, because interrupting someone
   *   mid-sentence to tell them a list got shorter is hostile.
   */
  function announce(message, options) {
    var opts = options || {};
    var region = getLiveRegion(
      opts.assertive ? 'assertive' : 'polite',
      opts.from ? language(opts.from) : ''
    );

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

    /* Keep every toggle in the document in sync. There may be one in the header,
       one in a footer utility row and one in a settings panel — switching at any
       of them updates all of them, because they all reflect one piece of state.

       The label and the accessible name both describe the NEXT action, so they
       swap together. No `aria-pressed`: see the naming note in
       components-forms.css. A control cannot both rename itself and claim a
       pressed state without contradicting itself. */
    var next = theme === 'dark' ? 'light' : 'dark';

    document.querySelectorAll('[data-dds-theme-toggle]').forEach(function (button) {
      var labels = themeLabelsFor(button);

      var label = button.querySelector('.dds-theme-toggle-label');
      if (label) label.textContent = labels[next].short;

      /* The accessible name. Where there is a visible label, the name must contain
         it (WCAG 2.5.3), so the full sentence starts with the same word. Where
         there is not — the icon-only variant — this is the only name the control
         has. */
      button.setAttribute('aria-label', labels[next].action);

      // Left over from an earlier toggle-button spelling; remove it so the two
      // patterns cannot end up mixed on one control.
      button.removeAttribute('aria-pressed');
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
    // `type="button"`, or a toggle inside a form submits it.
    if (button.tagName === 'BUTTON' && !button.getAttribute('type')) button.type = 'button';

    /* The attribute's value used to name a language: `data-dds-theme-toggle="de"`.
       It no longer does — `lang` does — and a value left behind is now a silent
       no-op on markup whose author believes it is doing something. Said once, per
       toggle, at setup rather than on every repaint. */
    if (button.getAttribute('data-dds-theme-toggle')) {
      console.warn(
        '[DDS] data-dds-theme-toggle no longer takes a value; the wording follows ' +
          'the nearest `lang`. Remove the value, and set `lang` if it is missing.',
        button
      );
    }

    button.addEventListener('click', function () {
      theme.toggle();

      /* Announce the resulting state, not the next action. The label has just
         changed to say what pressing again would do, which is not what the user
         needs to hear — they need confirmation of what just happened. The change
         is obvious to a sighted user and invisible otherwise. */
      announce(themeLabelsFor(button)[currentTheme()].applied, { from: button });
    });
  });

  // Paint the label and name on load, so a server-rendered toggle is correct
  // before anyone touches it.
  applyTheme(currentTheme());

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

  /**
   * Which language an element's text is in.
   *
   * There is exactly one answer to this in a document and it is already written
   * down: `lang`. It is not optional markup — a screen reader picks its voice and
   * pronunciation rules from it (WCAG 3.1.1) — so any page correct enough to be
   * worth localising has already said it. A `data-dds-*` attribute repeating the
   * answer would only add a second place for it to be wrong, and the failure is
   * silent in the worst way: a German accessible name read aloud by an English
   * voice.
   *
   * `closest` rather than `documentElement`, because a part of a page may be in
   * another language and must say so (WCAG 3.1.2 Language of Parts). A control
   * inside that part is spoken in that language, which is the same rule that
   * makes the text beside it pronounceable — not a special case.
   *
   * The region subtag is dropped: `de-AT` and `de-CH` are `de` for wording. An
   * unrecognised language is the caller's problem to fall back on, and every
   * caller in DDS falls back to English rather than to nothing, because a control
   * named in the wrong language still beats one with no name at all.
   *
   * @param {Element} element
   * @returns {string} A primary language subtag, lowercased. `''` if nothing said.
   */
  function language(element) {
    var scope = element && element.closest ? element.closest('[lang]') : null;
    var declared = scope ? scope.getAttribute('lang') : '';

    return (declared || '').toLowerCase().split('-')[0];
  }

  /**
   * The wording table for the language of the place an element sits.
   *
   * Every string DDS writes into a page comes through here. A table is keyed by
   * primary language subtag and always has an `en` entry, which is what an
   * unrecognised language falls back to — a control named in the wrong language
   * still beats one with no name at all.
   *
   *     var WORDING = {
   *       en: { cleared: 'Search field cleared' },
   *       de: { cleared: 'Suchfeld geleert' },
   *     };
   *     DDS.announce(DDS.utils.wording(input, WORDING).cleared);
   *
   * The table lives beside the behaviour that uses it, not in one central file.
   * A message and the code that decides when to say it are read together, and
   * separating them is how a table grows entries nothing uses and loses entries
   * something needs.
   *
   * **Every string in a table varies together.** A label taken from the table and
   * joined to a sentence written in the source is the defect this whole rule
   * exists to prevent: the theme toggle announced "Dunkel — dark theme on" for
   * exactly that reason (DECISIONS.md 028).
   *
   * @param {Element} element  Anything inside the region whose language applies.
   * @param {object} table     Keyed by language subtag; `en` is required.
   */
  function wording(element, table) {
    return table[language(element)] || table.en;
  }

  /**
   * Choose a plural form for a count, in the language of the place.
   *
   *     plural(list, files.length, {
   *       one: '1 file selected',
   *       other: '{n} files selected',
   *     })
   *
   * `Intl.PluralRules`, not a ternary on `n === 1`. English has two forms and so
   * the ternary looks correct forever; the moment a third language arrives it is
   * wrong in a way nobody who speaks English will notice. Russian has four
   * categories, Polish three, Arabic six — and even among two-form languages the
   * boundary is not always at one.
   *
   * A form the language does not have falls back to `other`, which every
   * language has. `{n}` is replaced with the count formatted for that language,
   * because a thousands separator is a localisation too.
   *
   * @param {Element} element
   * @param {number} count
   * @param {Record<string, string>} forms  Keys are CLDR categories: `one`,
   *   `other`, and whichever of `zero`/`two`/`few`/`many` the language needs.
   */
  function plural(element, count, forms) {
    var locale = language(element) || 'en';
    var category = 'other';

    try {
      category = new Intl.PluralRules(locale).select(count);
    } catch (error) {
      /* An unrecognised locale. `other` is the safe category and the loop below
         still produces a sentence, which is the point: a wrong plural form is a
         far smaller failure than no message. */
    }

    var template = forms[category] || forms.other;
    return template.replace('{n}', new Intl.NumberFormat(locale).format(count));
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
      language: language,
      wording: wording,
      plural: plural,
    },
  };

  global.DDS = DDS;

  /* =========================================================================
     The initial sweep
     =========================================================================

     Timed to DOMContentLoaded, and the distinction matters more than it looks.

     A deferred script runs AFTER parsing finishes, at which point
     `document.readyState` is already `"interactive"` — not `"loading"`. An
     earlier version tested for `"loading"`, took the else branch, and swept the
     document the instant `dds.js` finished executing: before `components.js`,
     before every pattern file, before anything had called `register`. The
     registry was empty, the sweep enhanced nothing, and every interactive demo on
     every page was inert. No error, no warning — the markup renders and simply
     does nothing, which is the failure mode progressive enhancement is supposed
     to make survivable, not silent.

     Waiting for DOMContentLoaded lets every deferred script register first.
     `register` covers whatever arrives later.

     `"complete"` is checked as well, for the case where `dds.js` is loaded
     dynamically long after the page settled; there is no event left to wait for
     then. ========================================================================= */
  function sweep() {
    swept = true;
    enhance(document);
  }

  if (document.readyState === 'complete') {
    sweep();
  } else {
    document.addEventListener('DOMContentLoaded', sweep, { once: true });
  }
})(typeof window !== 'undefined' ? window : globalThis);
