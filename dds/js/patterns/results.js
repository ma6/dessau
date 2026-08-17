/**
 * DDS — search and results pattern.
 *
 *   <script src="/dds/js/dds.js" defer></script>
 *   <script src="/dds/js/patterns/results.js" defer></script>
 *
 * A query and its outcome, in four states: loading, results, nothing found,
 * request failed. All four are part of the pattern — "failed" is the one most
 * often skipped, and the one where the user most needs to be told what to do
 * next.
 *
 * -----------------------------------------------------------------------------
 * Progressive enhancement
 * -----------------------------------------------------------------------------
 *
 * Without this file the search field is a plain, labelled input inside a
 * <form> that submits to a results page — a full-page search that works with
 * no JavaScript. Once this file is present, results already update live as
 * the user types, so the form's own submit is prevented rather than left to
 * fire on Enter — submitting would navigate away from a view that already
 * has the answer. The <form> and its action stay in the markup regardless;
 * this only stops it from acting once the live behaviour has taken over.
 *
 * -----------------------------------------------------------------------------
 * Request lifecycle
 * -----------------------------------------------------------------------------
 *
 * Same shape as the combobox: input is debounced, and every in-flight request
 * is aborted the moment a newer one starts. Without the abort, a slow response
 * for an earlier query can land after a faster later one and overwrite it —
 * a bug that only shows up on a slow connection, which is exactly where it
 * hurts most.
 *
 * -----------------------------------------------------------------------------
 * Markup contract
 * -----------------------------------------------------------------------------
 *
 *   <div class="dds-results" data-dds-results>
 *     <form method="get" action="/search">
 *       <input type="search" class="dds-input" name="q" ...>
 *     </form>
 *
 *     <p class="dds-results-summary" role="status" data-dds-results-summary></p>
 *     <p class="dds-results-loading" hidden data-dds-results-loading>
 *       <span class="dds-spinner" aria-hidden="true"></span>
 *       <span role="status">Searching…</span>
 *     </p>
 *     <ul class="dds-results-list" role="list" data-dds-results-list></ul>
 *
 *     <div class="dds-empty" hidden data-dds-results-empty>
 *       …product-authored "nothing found" content, with an optional
 *       [data-dds-results-empty-title] slot and a [data-dds-results-clear] button…
 *     </div>
 *
 *     <div class="dds-notice dds-notice-error" role="alert" hidden data-dds-results-error>
 *       …product-authored "request failed" content, with an optional
 *       [data-dds-results-retry] button…
 *     </div>
 *   </div>
 *
 * The empty and error regions are authored markup that this file only shows,
 * hides and lightly annotates — never generated. What "nothing found" and
 * "request failed" should say and offer is product-specific (which action to
 * suggest, whether to offer "include archived"), the same reason a combobox's
 * option is rendered by the caller rather than built here.
 */
(function (global) {
  'use strict';

  var DDS = global.DDS;
  if (!DDS) {
    console.error('[DDS] results.js requires dds.js to be loaded first');
    return;
  }

  var DEFAULTS = {
    /** Quiet period after typing stops, in ms. */
    debounceMs: 300,
  };

  var WORDING = {
    en: {
      loading: 'Searching…',
      counts: {
        one: '1 result for "{q}".',
        other: '{n} results for "{q}".',
      },
      error: 'Search is unavailable. Your query is still in the box — try again in a moment.',
      empty: 'No results for "{q}".',
      cleared: 'Search field cleared',
    },
    de: {
      loading: 'Wird gesucht …',
      counts: {
        one: '1 Treffer für „{q}“.',
        other: '{n} Treffer für „{q}“.',
      },
      error: 'Die Suche ist nicht verfügbar. Ihre Anfrage bleibt erhalten — versuchen Sie es gleich noch einmal.',
      empty: 'Keine Treffer für „{q}“.',
      cleared: 'Suchfeld geleert',
    },
  };

  /**
   * Turn a results root into a working search-and-results region.
   *
   * @param {HTMLElement} root
   * @param {object} options
   * @param {(query: string, ctx: { signal: AbortSignal }) => Promise<Array>} options.source
   * @param {(item: object) => Node} options.renderItem  One `<li>`'s worth of markup.
   * @returns {{ destroy: () => void, refresh: () => void }}
   */
  function createResults(root, options) {
    var config = Object.assign({}, DEFAULTS, options);
    config.messages = Object.assign({}, DDS.utils.wording(root, WORDING), (options || {}).messages);

    var input = root.querySelector('input[type="search"], input[type="text"]');
    var list = root.querySelector('[data-dds-results-list]') || root.querySelector('.dds-results-list');
    var summary =
      root.querySelector('[data-dds-results-summary]') || root.querySelector('.dds-results-summary');
    var loading =
      root.querySelector('[data-dds-results-loading]') || root.querySelector('.dds-results-loading');
    var empty = root.querySelector('[data-dds-results-empty]');
    var emptyTitle = root.querySelector('[data-dds-results-empty-title]');
    var errorRegion = root.querySelector('[data-dds-results-error]');
    var retryButton = root.querySelector('[data-dds-results-retry]');
    var clearButton = root.querySelector('[data-dds-results-clear]');

    if (!input || !list) {
      console.error('[DDS] results needs a search input and a results list', root);
      return { destroy: function () {}, refresh: function () {} };
    }
    if (typeof config.source !== 'function') {
      console.error('[DDS] results needs a `source` function', root);
      return { destroy: function () {}, refresh: function () {} };
    }
    if (typeof config.renderItem !== 'function') {
      console.error('[DDS] results needs a `renderItem` function', root);
      return { destroy: function () {}, refresh: function () {} };
    }
    if (list && !list.hasAttribute('role')) list.setAttribute('role', 'list');

    var controller = null;
    var destroyed = false;
    var lastQuery = '';

    function hide(element) {
      if (element) element.hidden = true;
    }
    function show(element) {
      if (element) element.hidden = false;
    }

    /** Every state hides everything, then the caller shows what applies —
        one place that can never leave two states visible at once. */
    function setState(state, query) {
      hide(loading);
      hide(empty);
      hide(errorRegion);

      if (state === 'loading') {
        root.setAttribute('aria-busy', 'true');
        show(loading);
        return;
      }

      root.removeAttribute('aria-busy');

      if (state === 'results') return;

      // Neither "empty" nor "error" leaves the stale list on screen — it is
      // not what the current query returned, and showing it would be showing
      // the wrong answer rather than no answer.
      list.replaceChildren();

      if (state === 'empty') {
        if (emptyTitle) emptyTitle.textContent = config.messages.empty.replace('{q}', query);
        show(empty);
      } else if (state === 'error') {
        show(errorRegion);
      }
    }

    function runQuery(query) {
      if (destroyed) return;
      lastQuery = query;

      // Abort whatever is still in flight, for the reason the combobox does:
      // an earlier, slower response must never overwrite a later, faster one.
      if (controller) controller.abort();
      controller = new AbortController();
      var signal = controller.signal;

      setState('loading');

      Promise.resolve()
        .then(function () {
          return config.source(query, { signal: signal });
        })
        .then(function (results) {
          if (signal.aborted || destroyed) return;

          var items = Array.isArray(results) ? results : [];

          if (!items.length) {
            setState('empty', query);
            // `.dds-results-summary` already carries `role="status"` in the
            // markup contract — setting its text IS the announcement, the
            // same live region the count uses below. No second region.
            if (summary) summary.textContent = config.messages.empty.replace('{q}', query);
            return;
          }

          list.replaceChildren();
          items.forEach(function (item) {
            var node = config.renderItem(item);
            if (node) list.appendChild(node);
          });
          setState('results');

          if (summary) {
            summary.textContent = DDS.utils
              .plural(root, items.length, config.messages.counts)
              .replace('{q}', query);
          }
        })
        .catch(function (error) {
          if (signal.aborted || destroyed) return;

          // An abort is expected control flow, not a failure.
          if (error && error.name === 'AbortError') return;

          console.error('[DDS] results source failed', error);
          setState('error');
          // A stale "N results for X" reading alongside a fresh error notice
          // contradicts it — cleared, because the error region (role="alert")
          // now carries the state, not the summary line.
          if (summary) summary.textContent = '';
          DDS.announce(config.messages.error, { assertive: true, from: root });
        });
    }

    var debouncedQuery = DDS.utils.debounce(runQuery, config.debounceMs);

    function handleInput() {
      var query = input.value.trim();

      if (!query) {
        if (controller) controller.abort();
        setState('results'); // clears loading/empty/error without touching the list
        list.replaceChildren();
        if (summary) summary.textContent = '';
        return;
      }

      debouncedQuery(query);
    }

    function handleRetry() {
      if (lastQuery) runQuery(lastQuery);
    }

    function handleClear() {
      input.value = '';
      handleInput();
      input.focus();
      DDS.announce(config.messages.cleared, { from: root });
    }

    /**
     * A no-JS input needs a `<form>` to be reachable without this file at
     * all — that submission is the whole point when this file is absent.
     * Once it is present, results already update live as the user types, so
     * submitting on Enter would navigate away from a view that already has
     * the answer. Prevented here, the same reasoning upload-flow.js applies
     * to its own leftover submit button.
     */
    var form = input.form;
    function handleSubmit(event) {
      event.preventDefault();
    }
    if (form) form.addEventListener('submit', handleSubmit);

    input.addEventListener('input', handleInput);
    if (retryButton) retryButton.addEventListener('click', handleRetry);
    if (clearButton) clearButton.addEventListener('click', handleClear);

    return {
      refresh: function () {
        handleInput();
      },
      destroy: function () {
        destroyed = true;
        if (controller) controller.abort();
        input.removeEventListener('input', handleInput);
        if (retryButton) retryButton.removeEventListener('click', handleRetry);
        if (clearButton) clearButton.removeEventListener('click', handleClear);
        if (form) form.removeEventListener('submit', handleSubmit);
      },
    };
  }

  DDS.results = createResults;

  /* =========================================================================
     Declarative enhancement
     =========================================================================
     For a static list defined in markup, with no application code — the same
     shape combobox.js offers:

       <div class="dds-results" data-dds-results>
         <input type="search" class="dds-input" ...>
         …the rest of the markup contract above…
         <script type="application/json" data-dds-results-items>
           [{"label": "Harbour redevelopment", "secondary": "Approved"}]
         </script>
       </div>

     Renders each item as a plain card. A product with its own card shape
     calls `DDS.results(root, { source, renderItem })` directly instead.
     ========================================================================= */

  function defaultRenderItem(item) {
    var li = document.createElement('li');
    li.className = 'dds-card dds-card-compact';

    var heading = document.createElement('h3');
    heading.className = 'dds-text-md';
    heading.textContent = item.label;
    li.appendChild(heading);

    if (item.secondary) {
      var secondary = document.createElement('p');
      secondary.className = 'dds-text-sm dds-text-muted dds-mbs-2xs';
      secondary.textContent = item.secondary;
      li.appendChild(secondary);
    }

    return li;
  }

  DDS.register('results', '[data-dds-results]', function (root) {
    var dataScript = root.querySelector('[data-dds-results-items]');
    if (!dataScript) return; // a scripted results region configures itself

    var items;
    try {
      items = JSON.parse(dataScript.textContent);
    } catch (error) {
      console.error('[DDS] could not parse results items as JSON', error, root);
      return;
    }

    createResults(root, {
      source: function (query) {
        var needle = query.toLowerCase();
        return items.filter(function (item) {
          return (item.label || '').toLowerCase().indexOf(needle) !== -1;
        });
      },
      renderItem: defaultRenderItem,
    });
  });
})(typeof window !== 'undefined' ? window : globalThis);
