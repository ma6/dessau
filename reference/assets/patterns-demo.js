/**
 * Reference pages — pattern demo wiring.
 *
 * Not part of DDS. This is the glue that makes the reference page interactive:
 * it supplies a provider for the address search and lets that provider be
 * switched between behaviours.
 *
 * The provider switcher is the point of this file. A pattern is not finished
 * because its happy path renders — the states that break in production are
 * latency, failure and emptiness, and they are hard to reproduce against a
 * service that works. Being able to turn each one on and walk through it,
 * including with a screen reader, is what turns "it renders" into "it is done".
 */
(function (global) {
  'use strict';

  var DDS = global.DDS;
  if (!DDS || !DDS.mockAddressProvider) {
    console.error('[reference] mock address provider is not available');
    return;
  }

  /**
   * The behaviours worth checking, in the order they are usually forgotten.
   */
  var PROFILES = {
    normal: { latencyMs: 220 },
    slow: { latencyMs: 2000 },
    failing: { latencyMs: 300, failRate: 1 },
    // Any query containing a letter returns nothing, so "no matches" is
    // reachable without having to invent a query that genuinely misses.
    empty: { latencyMs: 220, emptyFor: '' },
  };

  var LABELS = {
    normal: 'normal',
    slow: 'slow, two second response',
    failing: 'always failing',
    empty: 'never matching',
  };

  /**
   * The global the markup points at via `data-dds-address-provider`.
   *
   * Assigned synchronously at script-evaluation time, NOT inside a
   * DOMContentLoaded handler: `DDS.enhance()` runs on DOMContentLoaded and looks
   * this name up on the global object, so it has to exist by then.
   *
   * It delegates to whichever mock is currently selected, which means switching
   * behaviour does not require re-creating the pattern.
   */
  var active = DDS.mockAddressProvider(PROFILES.normal);

  global.referenceAddressProvider = {
    search: function (query, context) {
      return active.search(query, context);
    },
    attribution: 'Example data — not a real address service',
  };

  /* =========================================================================
     A resolver for the derived-output pattern
     =========================================================================
     Looks up a region and a delivery zone from a postcode.

     A deliberately tiny in-memory table, because this is a demonstration. In a
     product the equivalent function would `fetch` from the server — which is the
     whole reason the resolver contract is asynchronous. A real postcode table is
     large, changes, and is usually not ours to redistribute.

     It shows the three distinct outcomes the contract requires:
       null   → incomplete. No output, no error, no telling-off mid-typing.
       object → resolved.
       throw  → complete but invalid, with a message the user can act on.
     ========================================================================= */

  var POSTCODES = {
    '10115': { region: 'Berlin', zone: 'Zone A — next working day' },
    '10557': { region: 'Berlin', zone: 'Zone A — next working day' },
    '20095': { region: 'Hamburg', zone: 'Zone A — next working day' },
    '28217': { region: 'Bremen', zone: 'Zone B — two working days' },
    '40233': { region: 'Nordrhein-Westfalen', zone: 'Zone A — next working day' },
    '50667': { region: 'Nordrhein-Westfalen', zone: 'Zone A — next working day' },
    '80331': { region: 'Bayern', zone: 'Zone B — two working days' },
    '80339': { region: 'Bayern', zone: 'Zone B — two working days' },
    '04109': { region: 'Sachsen', zone: 'Zone C — three working days' },
  };

  global.referencePostcodeResolver = function (value, context) {
    var signal = context && context.signal;

    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        var code = String(value).replace(/\s/g, '');

        // Incomplete, not wrong. Resolving with null keeps the field quiet.
        if (!/^\d{1,5}$/.test(code) || code.length < 5) {
          resolve(null);
          return;
        }

        var match = POSTCODES[code];

        if (!match) {
          // Complete but unknown. Rejecting with a userMessage is what lets the
          // pattern distinguish this from "still typing".
          var error = new Error('Unknown postcode: ' + code);
          error.userMessage =
            'We do not recognise the postcode ' + code +
            '. Check the digits, or continue and we will confirm the region later.';
          reject(error);
          return;
        }

        resolve({
          fields: {
            Region: match.region,
            'Delivery zone': match.zone,
          },
        });
      }, 300);

      if (signal) {
        signal.addEventListener(
          'abort',
          function () {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
          },
          { once: true }
        );
      }
    });
  };

  function init() {
    var buttons = Array.prototype.slice.call(
      document.querySelectorAll('[data-ref-provider]')
    );
    var status = document.getElementById('ref-provider-status');
    if (!buttons.length) return;

    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        var profile = button.getAttribute('data-ref-provider');
        if (!PROFILES[profile]) return;

        active = DDS.mockAddressProvider(PROFILES[profile]);

        // `aria-pressed` on a set of toggles, so the active one is announced
        // rather than only tinted.
        buttons.forEach(function (other) {
          other.setAttribute('aria-pressed', other === button ? 'true' : 'false');
        });

        if (status) status.textContent = 'Provider: ' + LABELS[profile] + '.';
        DDS.announce('Address provider set to ' + LABELS[profile]);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
