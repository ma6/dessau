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

  /* =========================================================================
     Search and results demo
     =========================================================================
     A deliberately tiny in-memory table, harbour-themed to match the fixed
     example this page used to show as four separate static snapshots.

     "error" reaching every query it appears in is what makes the failed
     state reachable on demand rather than by chance — the same reason the
     address-search demo above has a `failing` profile instead of relying on
     an unreliable connection to happen to be unreliable during a walkthrough.
     ========================================================================= */

  var PROJECTS = [
    { label: 'Harbour redevelopment', secondary: 'Eastern quay · Approved · 47 documents', href: '#results' },
    { label: 'Harbour drainage survey', secondary: 'Eastern quay · In progress · 8 documents', href: '#results' },
    { label: 'Harbour access consultation', secondary: 'Public engagement · Needs review · 1,204 documents', href: '#results' },
    { label: 'Kalvebod bridge maintenance', secondary: 'Structural · Approved · 12 documents', href: '#results' },
    { label: 'Quayside lighting upgrade', secondary: 'Eastern quay · Planning · 3 documents', href: '#results' },
  ];

  function resultsSource(query, context) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        if (query.toLowerCase().indexOf('error') !== -1) {
          reject(new Error('simulated search failure'));
          return;
        }

        var needle = query.toLowerCase();
        resolve(
          PROJECTS.filter(function (item) {
            return item.label.toLowerCase().indexOf(needle) !== -1;
          })
        );
      }, 500);

      if (context && context.signal) {
        context.signal.addEventListener(
          'abort',
          function () {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
          },
          { once: true }
        );
      }
    });
  }

  function resultsRenderItem(item) {
    var li = document.createElement('li');
    li.className = 'dds-card dds-card-compact';

    var heading = document.createElement('h3');
    heading.className = 'dds-text-md';
    var link = document.createElement('a');
    link.href = item.href;
    link.textContent = item.label;
    heading.appendChild(link);
    li.appendChild(heading);

    var secondary = document.createElement('p');
    secondary.className = 'dds-text-sm dds-text-muted dds-mbs-2xs';
    secondary.textContent = item.secondary;
    li.appendChild(secondary);

    return li;
  }

  /* =========================================================================
     Upload flow demo
     =========================================================================
     `DDS.uploadFlow.simulate` (upload-flow.js) already reproduces progress
     over time with no network. Wrapped here to also fail roughly one upload
     in five AFTER it starts, so the "failed mid-upload" recovery path is
     reachable without waiting for a real connection to drop — the
     size-rejection path is already reachable directly, by choosing a file
     over the 2 MB the markup sets.
     ========================================================================= */

  function uploadFlowUpload(file, ctx) {
    return DDS.uploadFlow.simulate(file, ctx).then(function () {
      if (Math.random() < 0.2) throw new Error('simulated upload failure');
    });
  }

  /* =========================================================================
     Consent gate demo
     =========================================================================
     `consent-gate.js` ships `DDS.consent` and the banner behaviour. This wiring
     is the product's half: a policy version, and the `onChange` subscription
     that would inject the analytics script — here it just narrates what would
     happen, so the reference does not actually load a tracker.
     ========================================================================= */

  var CONSENT_NAME = 'analytics-demo';

  var CONSENT_STATUS = {
    granted: 'Granted — the product would inject the analytics script now, and again on every future visit.',
    denied: 'Declined — nothing is loaded, now or on return visits, until the choice is changed.',
    none: 'No decision yet — the gated script stays unloaded.',
  };

  function initConsentDemo() {
    if (!DDS.consent) return;

    // The policy version is declared in the page head
    // (<meta name="dds-consent-policy">), the same as a real product would — so
    // it is in place before the gate is enhanced. Nothing to configure here.

    var status = document.getElementById('ref-consent-status');
    if (status) {
      DDS.consent.onChange(CONSENT_NAME, function (event) {
        status.textContent = CONSENT_STATUS[event.state || 'none'];
      });
    }

    var reset = document.getElementById('ref-consent-reset');
    if (reset) {
      reset.addEventListener('click', function () {
        DDS.consent.clear(CONSENT_NAME);
        var gate = document.querySelector('[data-dds-consent="' + CONSENT_NAME + '"]');
        if (gate) gate.hidden = false;
      });
    }
  }

  function init() {
    initConsentDemo();

    var buttons = Array.prototype.slice.call(
      document.querySelectorAll('[data-ref-provider]')
    );
    var status = document.getElementById('ref-provider-status');

    if (buttons.length) {
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

    var resultsRoot = document.getElementById('ref-results');
    if (resultsRoot && DDS.results) {
      DDS.results(resultsRoot, { source: resultsSource, renderItem: resultsRenderItem });
    }

    var uploadFlowRoot = document.getElementById('ref-uploadflow');
    if (uploadFlowRoot && DDS.uploadFlow) {
      DDS.uploadFlow(uploadFlowRoot, { upload: uploadFlowUpload });
    }
  }

  /* DOMContentLoaded, not `readyState === 'loading'` — a deferred script is
     already past `"loading"` when it runs. See the note in reference.js. */
  if (document.readyState === 'complete') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  }
})(typeof window !== 'undefined' ? window : globalThis);
