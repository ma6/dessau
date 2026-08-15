/**
 * DDS — Address Search pattern.
 *
 *   <script src="/dds/js/dds.js" defer></script>
 *   <script src="/dds/js/patterns/combobox.js" defer></script>
 *   <script src="/dds/js/patterns/address-search.js" defer></script>
 *
 * A search field that fills a set of structured address fields, over a
 * replaceable provider (see providers/address-provider.md).
 *
 * -----------------------------------------------------------------------------
 * Why this is a Pattern and not a Component
 * -----------------------------------------------------------------------------
 *
 * It is not a widget; it is a solution to a task. It composes a combobox, four
 * fields, a live region and an external service, and the valuable part is the
 * rules about how they behave together — which is exactly what a component
 * boundary cannot hold.
 *
 * -----------------------------------------------------------------------------
 * The rules, and why each exists
 * -----------------------------------------------------------------------------
 *
 * 1. The structured fields are always present and always editable.
 *    The search is an accelerator. Every address a provider does not know must
 *    still be enterable by hand — a form that only accepts addresses in a
 *    third-party database excludes real people at real addresses: new
 *    buildings, rural addresses, recent renames, anywhere the licence did not
 *    cover.
 *
 * 2. Selecting a result never disables, hides or locks a field.
 *    Providers return stale and wrong data. The person filling in the form is
 *    the authority on where they live, so they must always be able to correct
 *    it.
 *
 * 3. Street and number are one field.
 *    Number-before-street and number-after-street are both correct depending on
 *    the country, and some addresses have no number at all. Splitting them
 *    imposes one country's format on everyone.
 *
 * 4. The secondary line (apartment, floor, care-of) is never auto-filled, and
 *    is cleared when a new address is selected.
 *    No provider knows it. Clearing it matters: leaving "Flat 4" attached while
 *    the street changes underneath produces an address that looks complete and
 *    is wrong.
 *
 * 5. Autofill tokens are on every field.
 *    The browser's own address autofill is faster than any search, works
 *    offline, and is what many people already rely on. WCAG 2.2 1.3.5 requires
 *    it. Never break it to make a custom search look better.
 *
 * 6. Filling the fields is announced.
 *    Four fields changing at once is invisible to a screen-reader user. Without
 *    an announcement, the interaction appears to have done nothing.
 *
 * -----------------------------------------------------------------------------
 * Without JavaScript
 * -----------------------------------------------------------------------------
 *
 * The address fields are ordinary labelled inputs and submit normally. The
 * search field is a plain text input; this module hides it when there is no
 * provider, so nobody is offered a search box that cannot search.
 */
(function (global) {
  'use strict';

  var DDS = global.DDS;
  if (!DDS) {
    console.error('[DDS] address-search.js requires dds.js to be loaded first');
    return;
  }
  if (!DDS.combobox) {
    console.error('[DDS] address-search.js requires patterns/combobox.js to be loaded first');
    return;
  }

  var DEFAULTS = {
    // Three characters before querying: fewer matches too much to be useful,
    // and most address services charge per request.
    minLength: 3,
    debounceMs: 250,
    maxResults: 20,
  };

  /**
   * Address-search wording, per language.
   *
   * The three failure messages all end with what to do instead — type it into
   * the fields below — and that clause is the whole value of them. A search that
   * says only "unavailable" leaves the user believing the form is broken, when
   * every field they need is right there and works.
   *
   * `filled` builds the confirmation from the address itself, so the parts come
   * from the provider and only the sentence around them is translated. The
   * comma-and-space between the parts stays as it is: it is punctuation both
   * languages share, and pulling it into the table would suggest it varies.
   */
  var WORDING = {
    en: {
      filled: function (address) {
        return (
          'Address filled in: ' +
          [address.streetLine, address.postalCode, address.locality].filter(Boolean).join(', ') +
          '. All fields can still be edited.'
        );
      },
      noResults: 'No matching address found. You can type the address in the fields below.',
      error: 'Address search is unavailable. Please type the address in the fields below.',
      minLength: 'Type at least 3 characters to search for an address',
    },
    de: {
      filled: function (address) {
        return (
          'Adresse übernommen: ' +
          [address.streetLine, address.postalCode, address.locality].filter(Boolean).join(', ') +
          '. Alle Felder lassen sich weiter bearbeiten.'
        );
      },
      noResults: 'Keine passende Adresse gefunden. Sie können die Adresse unten eintragen.',
      error: 'Die Adresssuche ist nicht verfügbar. Bitte tragen Sie die Adresse unten ein.',
      minLength: 'Mindestens 3 Zeichen eingeben, um nach einer Adresse zu suchen',
    },
  };

  /**
   * Field roles looked up inside the pattern root, and the autofill token each
   * one must carry.
   *
   * `addressLine2` is intentionally absent from anything the provider fills.
   */
  var FIELD_ROLES = {
    street: 'street-address',
    line2: 'address-line2',
    postalCode: 'postal-code',
    locality: 'address-level2',
    region: 'address-level1',
    country: 'country-name',
  };

  /**
   * Enhance an address search region.
   *
   * @param {HTMLElement} root
   * @param {object} options
   * @param {{search: Function, attribution?: string}} options.provider
   * @returns {{ destroy: () => void }}
   */
  function createAddressSearch(root, options) {
    var config = Object.assign({}, DEFAULTS, options);
    // Language first, the product's own overrides on top. See combobox.js.
    config.messages = Object.assign({}, DDS.utils.wording(root, WORDING), (options || {}).messages);

    var comboboxRoot = root.querySelector('[data-dds-address-combobox]');
    var searchField = root.querySelector('[data-dds-address-search-field]');

    // Look up each structured field by its role attribute.
    var fields = {};
    Object.keys(FIELD_ROLES).forEach(function (role) {
      fields[role] = root.querySelector('[data-dds-address-field="' + role + '"]');
    });

    if (!fields.street || !fields.postalCode || !fields.locality) {
      console.error(
        '[DDS] address search needs at least street, postalCode and locality fields',
        root
      );
      return { destroy: function () {} };
    }

    // The fields must work on their own, so the browser's autofill is wired up
    // whether or not a provider ever arrives.
    Object.keys(FIELD_ROLES).forEach(function (role) {
      var field = fields[role];
      if (field && !field.hasAttribute('autocomplete')) {
        field.setAttribute('autocomplete', FIELD_ROLES[role]);
      }
    });

    var provider = config.provider;

    if (!provider || typeof provider.search !== 'function') {
      // No provider: hide the search field rather than leaving a dead control
      // on the page. The address is still fully enterable below.
      if (searchField) {
        var wrapper = searchField.closest('[data-dds-address-searchbox]') || comboboxRoot;
        if (wrapper) wrapper.hidden = true;
      }
      return { destroy: function () {} };
    }

    if (!comboboxRoot || !searchField) {
      console.error('[DDS] address search needs a combobox root and a search field', root);
      return { destroy: function () {} };
    }

    /* --- attribution ------------------------------------------------------ */
    // Several address services require visible attribution. Rendered from the
    // provider so the requirement travels with the provider, not with the page.
    if (provider.attribution) {
      var existing = root.querySelector('[data-dds-address-attribution]');
      var note = existing || document.createElement('p');
      if (!existing) {
        note.setAttribute('data-dds-address-attribution', '');
        note.className = 'dds-hint';
        comboboxRoot.insertAdjacentElement('afterend', note);
      }
      note.textContent = provider.attribution;
    }

    /* --- fill the fields -------------------------------------------------- */
    function fill(address) {
      setValue(fields.street, address.streetLine);
      setValue(fields.postalCode, address.postalCode);
      setValue(fields.locality, address.locality);
      setValue(fields.region, address.region);
      setValue(fields.country, address.country);

      // Rule 4: the provider cannot know this, and a leftover value would
      // silently attach itself to a different address.
      if (fields.line2) setValue(fields.line2, '');

      // Rule 6: four fields changing at once is invisible without this.
      DDS.announce(config.messages.filled(address), { from: root });

      // Clear any stale validation state on the fields that were just filled.
      [fields.street, fields.postalCode, fields.locality].forEach(function (field) {
        if (field) field.removeAttribute('aria-invalid');
      });
    }

    function setValue(field, value) {
      if (!field) return;
      field.value = value == null ? '' : String(value);

      // Dispatch `input` so anything watching the fields — validation, a
      // framework binding, a dirty-state tracker — sees the change. A
      // programmatic assignment fires no event on its own, and this is the
      // usual reason a filled form still reports its fields as empty.
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
    }

    /* --- the combobox ----------------------------------------------------- */
    var combobox = DDS.combobox(comboboxRoot, {
      minLength: config.minLength,
      debounceMs: config.debounceMs,
      maxResults: config.maxResults,
      // The address is the whole line; highlighting a fragment of a street name
      // in a two-line option adds noise rather than clarity.
      highlightMatch: false,

      source: function (query, ctx) {
        return provider.search(query, {
          signal: ctx.signal,
          limit: config.maxResults,
        });
      },

      onSelect: function (address) {
        fill(address);
      },

      messages: {
        noResults: config.messages.noResults,
        error: config.messages.error,
        minLength: config.messages.minLength,
      },
    });

    return {
      destroy: function () {
        combobox.destroy();
      },
    };
  }

  DDS.addressSearch = createAddressSearch;

  /* =========================================================================
     Declarative enhancement
     =========================================================================
     A region marked `data-dds-address-search` is picked up automatically. The
     provider is resolved from a global name, so a page can wire it up without
     any inline script:

       <div data-dds-address-search data-dds-address-provider="myAddressProvider">

     A provider that needs configuration is passed by calling
     `DDS.addressSearch(root, { provider })` directly instead.
     ========================================================================= */

  DDS.register('address-search', '[data-dds-address-search]', function (root) {
    var providerName = root.getAttribute('data-dds-address-provider');
    if (!providerName) {
      // No declared provider: still run, so the autofill tokens get applied and
      // the dead search field is hidden.
      createAddressSearch(root, {});
      return;
    }

    var provider = global[providerName];

    if (!provider || typeof provider.search !== 'function') {
      console.error(
        '[DDS] address provider "' + providerName + '" is not available on the global object'
      );
      createAddressSearch(root, {});
      return;
    }

    createAddressSearch(root, { provider: provider });
  });
})(typeof window !== 'undefined' ? window : globalThis);
