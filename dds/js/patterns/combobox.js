/**
 * DDS — combobox pattern.
 *
 *   <script src="/dds/js/dds.js" defer></script>
 *   <script src="/dds/js/patterns/combobox.js" defer></script>
 *
 * A text input with a filtered list of suggestions, over any data source.
 *
 * -----------------------------------------------------------------------------
 * Progressive enhancement
 * -----------------------------------------------------------------------------
 *
 * Without this file the markup is a plain, labelled `<input type="text">`. It
 * submits, it autofills, it works. The suggestion list is an accelerator layered
 * on top — never the only way to provide a value. That is the difference between
 * a combobox and a `<select>` dressed up as one, and it is why the input must
 * always accept a value the source has never heard of.
 *
 * -----------------------------------------------------------------------------
 * Accessibility contract (ARIA combobox pattern)
 * -----------------------------------------------------------------------------
 *
 * - The input keeps DOM focus at all times. The user is still typing, so focus
 *   must not move into the list; the visually active option is pointed at with
 *   `aria-activedescendant` instead. This is the single most important detail
 *   in the pattern and the one most often got wrong.
 * - `aria-expanded` on the input reflects whether the list is showing.
 * - `aria-selected="true"` marks the option that Enter would choose.
 * - Result counts, loading, emptiness and failure are announced through a
 *   polite live region — debounced, so typing eight characters produces one
 *   announcement rather than eight.
 * - Escape is two-stage: close the list, then clear the field.
 *
 * -----------------------------------------------------------------------------
 * Request lifecycle
 * -----------------------------------------------------------------------------
 *
 * Input is debounced, and every in-flight request is aborted when a newer one
 * starts. Without the abort, responses can arrive out of order and a slow
 * response for "Ber" will overwrite the results for "Berlin" — a bug that only
 * shows up on a slow connection, which is exactly where it hurts most.
 */
(function (global) {
  'use strict';

  var DDS = global.DDS;
  if (!DDS) {
    console.error('[DDS] combobox.js requires dds.js to be loaded first');
    return;
  }

  var DEFAULTS = {
    /** Characters required before the source is queried. */
    minLength: 1,
    /** Quiet period after typing stops, in ms. */
    debounceMs: 200,
    /** Cap on rendered options. A list of 500 is not browsable. */
    maxResults: 20,
    /** Highlight the matched substring in each option. */
    highlightMatch: true,
  };

  /**
   * Combobox wording, per language.
   *
   * This used to be `DEFAULTS.messages`, one set of English strings. It is now
   * one set per language, chosen from the nearest `[lang]` when the combobox is
   * created — and a `messages` option still overrides any of it, per instance,
   * which is what a product with its own voice needs.
   *
   * `resultCount` is the one that could not stay as it was. It counted with
   * `count === 1 ? … : …`, which is English's rule written as if it were
   * arithmetic. `DDS.utils.plural` asks the language instead.
   *
   * Every entry carries its whole sentence, including the keyboard instructions
   * after the count. Those are the part a user actually needs — a bare "5
   * suggestions" tells somebody who cannot see the list nothing about how to
   * reach it — and they are also the part most likely to be left in English by
   * a translation that only looked at the noun.
   */
  var WORDING = {
    en: {
      loading: 'Searching…',
      noResults: 'No matches found',
      error: 'Search is unavailable. You can still type the value yourself.',
      minLength: 'Keep typing to see suggestions',
      cleared: 'Search field cleared',
      /* Last resort for the listbox's name, when the page labelled neither the
         input nor the list. Reached only by markup that is already wrong, which
         is why it is not in `messages`: overriding it would paper over that. */
      listLabel: 'Suggestions',
      counts: {
        one: '1 suggestion. Use the up and down arrow keys to review, Enter to choose.',
        other: '{n} suggestions. Use the up and down arrow keys to review, Enter to choose.',
      },
      truncated: function (shown, total) {
        return (
          'Showing the first ' + shown + ' of ' + total + ' matches. Keep typing to narrow them down.'
        );
      },
    },
    de: {
      loading: 'Wird gesucht …',
      noResults: 'Keine Treffer',
      error: 'Die Suche ist nicht verfügbar. Sie können den Wert selbst eintragen.',
      minLength: 'Weiter tippen für Vorschläge',
      cleared: 'Suchfeld geleert',
      listLabel: 'Vorschläge',
      counts: {
        one: '1 Vorschlag. Mit den Pfeiltasten nach oben und unten durchgehen, mit der Eingabetaste auswählen.',
        other:
          '{n} Vorschläge. Mit den Pfeiltasten nach oben und unten durchgehen, mit der Eingabetaste auswählen.',
      },
      truncated: function (shown, total) {
        return (
          'Die ersten ' + shown + ' von ' + total + ' Treffern. Weiter tippen, um sie einzugrenzen.'
        );
      },
    },
  };

  /**
   * Turn a combobox root element into a working combobox.
   *
   * @param {HTMLElement} root  Element containing the input and the listbox.
   * @param {object} options
   * @param {(query: string, ctx: { signal: AbortSignal }) => Promise<Array>|Array} options.source
   *        Returns items shaped `{ id?, label, secondary?, value? }`.
   * @param {(item: object) => void} [options.onSelect]
   * @param {() => void} [options.onClear]
   * @returns {{ destroy: () => void, close: () => void, refresh: () => void }}
   */
  function createCombobox(root, options) {
    var config = Object.assign({}, DEFAULTS, options);
    /* Language first, then the product's overrides on top. Resolved once, at
       creation: the `lang` of a region does not change under a live component,
       and re-reading it per announcement would only invite it to disagree with
       itself mid-interaction. */
    config.messages = Object.assign({}, DDS.utils.wording(root, WORDING), (options || {}).messages);

    var input = root.querySelector('input');
    var list = root.querySelector('[role="listbox"]');

    if (!input || !list) {
      console.error('[DDS] combobox needs an <input> and a [role="listbox"]', root);
      return { destroy: function () {}, close: function () {}, refresh: function () {} };
    }
    if (typeof config.source !== 'function') {
      console.error('[DDS] combobox needs a `source` function', root);
      return { destroy: function () {}, close: function () {}, refresh: function () {} };
    }

    /* --- wire up the ARIA relationships ---------------------------------- */
    // Set here rather than demanded of the markup: these attributes describe the
    // JavaScript behaviour, so they should not be present when the JavaScript is
    // not. An input advertising `role="combobox"` with no list to expand is a
    // worse starting point than a plain text input.
    if (!list.id) list.id = DDS.utils.uniqueId('dds-combobox-list');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', list.id);
    // "list" means: the suggestions are a list, and nothing is inserted into the
    // field as the user types. Inline completion is hostile in a field where the
    // user may legitimately need a value that is not in the list.
    input.setAttribute('aria-autocomplete', 'list');
    // Turn off the browser's own history dropdown, which would otherwise cover
    // the suggestion list with a second, unrelated one.
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');

    if (!list.hasAttribute('aria-label') && !list.hasAttribute('aria-labelledby')) {
      // A listbox needs a name. Borrow the input's label rather than inventing
      // one, so the two agree.
      var labelledBy = input.getAttribute('aria-labelledby');
      var label = input.id ? root.ownerDocument.querySelector('label[for="' + input.id + '"]') : null;
      if (labelledBy) {
        list.setAttribute('aria-labelledby', labelledBy);
      } else if (label) {
        if (!label.id) label.id = DDS.utils.uniqueId('dds-combobox-label');
        list.setAttribute('aria-labelledby', label.id);
      } else {
        list.setAttribute('aria-label', DDS.utils.wording(root, WORDING).listLabel);
      }
    }

    /* --- state ----------------------------------------------------------- */
    var items = [];        // currently rendered items
    var activeIndex = -1;  // index into `items`, -1 = nothing active
    var controller = null; // aborts the in-flight request
    var destroyed = false;

    // Announcements are debounced separately from the request, and more slowly.
    // A screen reader interrupted on every keystroke is unusable.
    var announceResults = DDS.utils.debounce(function (message) {
      DDS.announce(message, { from: root });
    }, 350);

    /* --- opening and closing --------------------------------------------- */
    function isOpen() {
      return input.getAttribute('aria-expanded') === 'true';
    }

    function open() {
      if (isOpen()) return;
      input.setAttribute('aria-expanded', 'true');
      list.hidden = false;
    }

    function close() {
      input.setAttribute('aria-expanded', 'false');
      list.hidden = true;
      setActive(-1);
    }

    /* --- the active option ----------------------------------------------- */
    function setActive(index) {
      var options = list.querySelectorAll('[role="option"]');

      options.forEach(function (option) {
        option.setAttribute('aria-selected', 'false');
      });

      if (index < 0 || index >= options.length) {
        activeIndex = -1;
        // Removing the attribute (rather than emptying it) is what tells
        // assistive technology that nothing is active.
        input.removeAttribute('aria-activedescendant');
        return;
      }

      activeIndex = index;
      var active = options[index];
      active.setAttribute('aria-selected', 'true');
      input.setAttribute('aria-activedescendant', active.id);
      // Keep the active option in view when navigating by keyboard. `nearest`
      // scrolls the minimum amount, so the list does not jump.
      active.scrollIntoView({ block: 'nearest' });
    }

    function moveActive(delta) {
      if (!items.length) return;
      var next;

      if (activeIndex === -1) {
        // Nothing active yet: Down goes to the first, Up to the last.
        next = delta > 0 ? 0 : items.length - 1;
      } else {
        // Wrap at both ends.
        next = (activeIndex + delta + items.length) % items.length;
      }

      setActive(next);
    }

    /* --- rendering -------------------------------------------------------- */
    function renderMessage(text, isError) {
      // `role="presentation"` keeps the row out of the option count, so a
      // "no matches" row is never announced as a choosable result.
      list.replaceChildren();
      var li = document.createElement('li');
      li.className = 'dds-combobox-message';
      li.setAttribute('role', 'presentation');
      li.textContent = text;
      if (isError) li.classList.add('dds-text-error');
      list.appendChild(li);
      items = [];
      setActive(-1);
      open();
    }

    function highlight(text, query) {
      if (!config.highlightMatch || !query) return document.createTextNode(text);

      var index = text.toLowerCase().indexOf(query.toLowerCase());
      if (index === -1) return document.createTextNode(text);

      var fragment = document.createDocumentFragment();
      fragment.appendChild(document.createTextNode(text.slice(0, index)));

      var mark = document.createElement('span');
      mark.className = 'dds-combobox-match';
      // The matched run is taken from the SOURCE text, not from the query, so
      // the original casing survives and no user input is reflected back.
      mark.textContent = text.slice(index, index + query.length);
      fragment.appendChild(mark);

      fragment.appendChild(document.createTextNode(text.slice(index + query.length)));
      return fragment;
    }

    function renderItems(results, query) {
      var total = results.length;
      items = results.slice(0, config.maxResults);

      list.replaceChildren();

      items.forEach(function (item, index) {
        var li = document.createElement('li');
        li.id = DDS.utils.uniqueId('dds-combobox-option');
        li.className = 'dds-combobox-option';
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', 'false');

        if (item.secondary) {
          // Two-line option. The primary line is the identity, the secondary
          // disambiguates.
          var primary = document.createElement('span');
          primary.className = 'dds-combobox-option-primary';
          primary.appendChild(highlight(item.label, query));
          li.appendChild(primary);

          var secondary = document.createElement('span');
          secondary.className = 'dds-combobox-option-secondary';
          secondary.textContent = item.secondary;
          li.appendChild(secondary);
        } else {
          li.appendChild(highlight(item.label, query));
        }

        li.addEventListener('click', function () {
          choose(index);
        });

        // Keep pointer and keyboard agreeing about which option is active.
        li.addEventListener('mousemove', function () {
          if (activeIndex !== index) setActive(index);
        });

        list.appendChild(li);
      });

      if (total > items.length) {
        var note = document.createElement('li');
        note.className = 'dds-combobox-message';
        note.setAttribute('role', 'presentation');
        note.textContent = config.messages.truncated(items.length, total);
        list.appendChild(note);
      }

      setActive(-1);
      open();

      /**
       * `resultCount` was a documented option and takes a count, so a product
       * that supplied one keeps winning — the option contract does not get to
       * break because the default behind it improved. Without an override the
       * count goes through the language's own plural rules.
       */
      var counted = config.messages.resultCount
        ? config.messages.resultCount(items.length)
        : DDS.utils.plural(root, items.length, config.messages.counts);

      announceResults(
        total > items.length ? config.messages.truncated(items.length, total) : counted
      );
    }

    /* --- selection -------------------------------------------------------- */
    function choose(index) {
      var item = items[index];
      if (!item) return;

      // The visible field shows the human-readable label; `value` is what the
      // application cares about and is handed to onSelect.
      input.value = item.label;
      close();

      if (typeof config.onSelect === 'function') config.onSelect(item);

      // Return focus to the input after a pointer selection, so the next Tab
      // continues from the field rather than from the document.
      input.focus();
    }

    /* --- querying --------------------------------------------------------- */
    function runQuery(query) {
      if (destroyed) return;

      // Abort whatever is still in flight. Without this, a slow earlier
      // response can land after a faster later one and overwrite it.
      if (controller) controller.abort();
      controller = new AbortController();
      var signal = controller.signal;

      root.setAttribute('aria-busy', 'true');

      Promise.resolve()
        .then(function () {
          return config.source(query, { signal: signal });
        })
        .then(function (results) {
          if (signal.aborted || destroyed) return;
          root.removeAttribute('aria-busy');

          var list_ = Array.isArray(results) ? results : [];

          if (!list_.length) {
            renderMessage(config.messages.noResults);
            announceResults(config.messages.noResults);
            return;
          }

          renderItems(list_, query);
        })
        .catch(function (error) {
          if (signal.aborted || destroyed) return;
          root.removeAttribute('aria-busy');

          // An abort is expected control flow, not a failure.
          if (error && error.name === 'AbortError') return;

          console.error('[DDS] combobox source failed', error);
          // Say what the user can do instead, not just that something broke.
          renderMessage(config.messages.error, true);
          DDS.announce(config.messages.error, { assertive: true, from: root });
        });
    }

    var debouncedQuery = DDS.utils.debounce(runQuery, config.debounceMs);

    function handleInput() {
      var query = input.value.trim();

      if (query.length < config.minLength) {
        if (controller) controller.abort();
        // Below the threshold, close rather than showing a prompt: an empty
        // field that pops open a panel on focus is startling.
        if (query.length === 0) {
          close();
          list.replaceChildren();
          items = [];
          if (typeof config.onClear === 'function') config.onClear();
        } else {
          renderMessage(config.messages.minLength);
        }
        return;
      }

      debouncedQuery(query);
    }

    /* --- events ----------------------------------------------------------- */
    function handleKeydown(event) {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          if (!isOpen() && input.value.trim().length >= config.minLength) {
            // Re-open with the results already on screen rather than re-querying.
            if (items.length) {
              open();
              setActive(0);
            } else {
              runQuery(input.value.trim());
            }
          } else {
            moveActive(1);
          }
          break;

        case 'ArrowUp':
          event.preventDefault();
          if (isOpen()) moveActive(-1);
          break;

        case 'Home':
          // Only hijack Home/End while navigating the list; otherwise they must
          // still move the caret within the text.
          if (isOpen() && activeIndex !== -1) {
            event.preventDefault();
            setActive(0);
          }
          break;

        case 'End':
          if (isOpen() && activeIndex !== -1) {
            event.preventDefault();
            setActive(items.length - 1);
          }
          break;

        case 'Enter':
          if (isOpen() && activeIndex !== -1) {
            // Only swallow Enter when it is choosing an option. Otherwise it
            // must still submit the form.
            event.preventDefault();
            choose(activeIndex);
          }
          break;

        case 'Escape':
          // Two-stage, per the ARIA pattern: close the list first, and only
          // clear the field if the list was already closed. One Escape should
          // not destroy what the user typed.
          if (isOpen()) {
            event.preventDefault();
            close();
          } else if (input.value !== '') {
            event.preventDefault();
            input.value = '';
            items = [];
            list.replaceChildren();
            if (typeof config.onClear === 'function') config.onClear();
            DDS.announce(config.messages.cleared, { from: root });
          }
          break;

        case 'Tab':
          // Tab commits the active option and moves on — the user has clearly
          // finished with this field.
          if (isOpen() && activeIndex !== -1) {
            choose(activeIndex);
          }
          close();
          break;

        default:
          break;
      }
    }

    function handleDocumentPointerDown(event) {
      if (!root.contains(event.target)) close();
    }

    input.addEventListener('input', handleInput);
    input.addEventListener('keydown', handleKeydown);
    // `pointerdown` rather than `click`: closing on click would fire after the
    // browser had already moved focus, which made the list flicker.
    document.addEventListener('pointerdown', handleDocumentPointerDown);

    /**
     * Pressing an option must not move focus out of the input.
     *
     * Without this, clicking a suggestion did nothing at all. The sequence is
     * `pointerdown` → the input blurs → the blur handler closes the list →
     * `mouseup` → `click`. By the time the click would arrive, the option is
     * hidden, so the listener on it never runs: the field stays empty and the
     * component looks broken while the keyboard path works perfectly.
     *
     * Deferring the blur with a timer is the usual attempt, and it is a race — the
     * timer and the click are separate tasks with no guaranteed order. Preventing
     * the default on `pointerdown` removes the race instead of narrowing it: focus
     * never leaves the input, so there is no blur to tolerate.
     */
    list.addEventListener('pointerdown', function (event) {
      event.preventDefault();
    });

    /**
     * Blur still closes the list, for the cases that are not a click on an option:
     * Tab away, a click elsewhere on the page, the window losing focus.
     *
     * `relatedTarget` is where focus is going. Checking it is exact, where checking
     * `document.activeElement` after a timeout was both delayed and wrong — during
     * a pointer press on a non-focusable list item, `activeElement` is `<body>`.
     */
    input.addEventListener('blur', function (event) {
      if (event.relatedTarget && root.contains(event.relatedTarget)) return;
      close();
    });

    return {
      close: close,
      refresh: function () {
        handleInput();
      },
      destroy: function () {
        destroyed = true;
        if (controller) controller.abort();
        input.removeEventListener('input', handleInput);
        input.removeEventListener('keydown', handleKeydown);
        document.removeEventListener('pointerdown', handleDocumentPointerDown);
        close();
        // Hand the input back the way it was found, so the markup degrades to
        // the same plain text input it started as.
        ['role', 'aria-expanded', 'aria-controls', 'aria-autocomplete', 'aria-activedescendant'].forEach(
          function (attribute) {
            input.removeAttribute(attribute);
          }
        );
      },
    };
  }

  /**
   * Build a source function that filters a fixed in-memory array.
   *
   * For genuinely small, static sets. Anything backed by a service should
   * supply its own source and do the filtering server-side.
   */
  function arraySource(itemsOrFactory, options) {
    var opts = options || {};

    return function (query) {
      var all = typeof itemsOrFactory === 'function' ? itemsOrFactory() : itemsOrFactory;
      var needle = query.toLowerCase();

      return all
        .map(function (item) {
          return typeof item === 'string' ? { label: item } : item;
        })
        .filter(function (item) {
          var haystack = [item.label, opts.searchSecondary ? item.secondary : '']
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return haystack.indexOf(needle) !== -1;
        });
    };
  }

  DDS.combobox = createCombobox;
  DDS.combobox.arraySource = arraySource;

  /* =========================================================================
     Declarative enhancement
     =========================================================================
     For a static list defined in markup, with no application code:

       <div class="dds-combobox" data-dds-combobox>
         <input class="dds-input" id="city" ...>
         <ul class="dds-combobox-list" role="listbox" hidden></ul>
         <script type="application/json" data-dds-combobox-items>
           ["Amsterdam", "Antwerp", "Athens"]
         </script>
       </div>

     A `<script type="application/json">` block rather than a `data-` attribute:
     it survives quoting, holds structured objects, and is not parsed as HTML.
     ========================================================================= */

  DDS.register('combobox', '[data-dds-combobox]', function (root) {
    var dataScript = root.querySelector('[data-dds-combobox-items]');
    if (!dataScript) return; // a scripted combobox configures itself

    var items;
    try {
      items = JSON.parse(dataScript.textContent);
    } catch (error) {
      console.error('[DDS] could not parse combobox items as JSON', error, root);
      return;
    }

    createCombobox(root, {
      source: arraySource(items),
      minLength: Number(root.getAttribute('data-dds-combobox-min-length') || 1),
    });
  });
})(typeof window !== 'undefined' ? window : globalThis);
