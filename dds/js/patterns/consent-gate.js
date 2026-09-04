/**
 * DDS — consent gate pattern.
 *
 *   <script src="/dds/js/dds.js" defer></script>
 *   <script src="/dds/js/patterns/consent-gate.js" defer></script>
 *
 * A page-level, *remembered* opt-in for something that would otherwise load
 * without asking — a self-hosted analytics script, a marketing tag. The visual
 * is `.dds-banner` inside a `.dds-consentgate`; this file is the choice, the
 * memory of it, and the contract a product's script-injection code subscribes
 * to.
 *
 * It is the remembered sibling of the consent embed in `components-content.js`.
 * The embed gates one iframe and forgets the choice on purpose — a single
 * `<iframe>` is cheap to re-consent. A page-wide analytics opt-in is not, and
 * under TTDSG §25 + GDPR the choice has to be remembered, revocable, and
 * re-asked when the policy changes. That is what this adds.
 *
 * -----------------------------------------------------------------------------
 * DDS.consent — the contract, not the storage
 * -----------------------------------------------------------------------------
 *
 *   DDS.consent.get(name)        'granted' | 'denied' | null
 *                                null means "not decided" — and a decision made
 *                                under an older policy version counts as not
 *                                decided, so the banner comes back.
 *   DDS.consent.record(name)     { state, policy, at } | null — the raw stored
 *                                decision, ignoring policy staleness.
 *   DDS.consent.set(name, state) persist 'granted' | 'denied', stamp it with the
 *                                current policy and an ISO timestamp, and fire
 *                                the `dds:consent` event.
 *   DDS.consent.clear(name)      forget the decision; fires with state null.
 *   DDS.consent.onChange(name, fn)
 *                                fn({ name, state, policy }) on every change AND
 *                                once, synchronously, with the current state —
 *                                so the caller writes ONE code path for "decided
 *                                just now" and "decided on an earlier visit".
 *                                Returns an unsubscribe function.
 *   DDS.consent.configure({ policy, storage })
 *                                override the policy version and/or swap the
 *                                storage backend ({ get, set, remove }).
 *   DDS.consent.policy           the current policy version string.
 *
 * The policy version comes from `<meta name="dds-consent-policy" content="…">`
 * or `DDS.consent.configure({ policy })`. Any string that changes when the
 * privacy notice materially changes — a date, a hash. When it changes, every
 * stored decision goes stale and every gate re-opens.
 *
 * Storage defaults to `localStorage`, key `dds-consent:<name>`, value
 * `{"state":"granted","policy":"2026-09-01","at":"2026-09-04T…Z"}`. A product
 * that needs the value server-side (to decide before the page renders) passes
 * its own cookie-backed `{ get, set, remove }` to `configure`. The consent
 * decision is not PII, so `localStorage` is an acceptable home for it — unlike a
 * session token. If storage is unavailable (private mode, disabled), `get`
 * always returns null and `set` still fires the event, so gating still works for
 * the current page — it is just not remembered.
 *
 * -----------------------------------------------------------------------------
 * Recommended shape for the gated script (product code, NOT shipped here)
 * -----------------------------------------------------------------------------
 *
 *   DDS.consent.onChange('analytics', function (e) {
 *     if (e.state !== 'granted') return;              // denied or undecided
 *     if (document.getElementById('analytics-js')) return;
 *     var s = document.createElement('script');
 *     s.id = 'analytics-js';
 *     s.src = 'https://analytics.example/matomo.js';
 *     s.async = true;
 *     document.head.appendChild(s);
 *   });
 *
 * Because `onChange` fires once immediately, this one block covers the first
 * decision and every later visit. On `denied` there is nothing to do — a script
 * already running cannot be recalled; revocation takes effect on the next load,
 * and the product should also clear whatever cookies that script set.
 *
 * -----------------------------------------------------------------------------
 * The rules, and why each exists
 * -----------------------------------------------------------------------------
 *
 * 1. Nothing loads before the choice. The gated script is injected by the
 *    product only on `granted`, never speculatively. This module never injects
 *    anything — it only records the decision and announces it.
 *
 * 2. No implicit consent. There is no dismiss control, Escape does nothing, and
 *    the gate is not dismissible without picking one of the buttons. A consent
 *    bar you can wave away is a consent bar that counts silence as a yes.
 *
 * 3. Declining is exactly as easy as accepting. Both are real `<button>`s of
 *    peer visual weight — `data-dds-consent-set="denied"` is never a link and
 *    never `.dds-button-subtle`. The CSS of `.dds-consentgate` also lets the
 *    page carry on behind the bar (`pointer-events`), so "do nothing" is a
 *    genuine third option and not a trap.
 *
 * 4. It does not block first paint and does not steal focus on load. On a fresh
 *    visit the bar simply appears at the end of the document, reachable by Tab
 *    where it sits — last, matching its position pinned to the bottom. Focus is
 *    moved into it ONLY when a person re-opens it from the revocation control,
 *    because then it behaves like a dialog they summoned; focus returns to that
 *    control once they choose.
 *
 * 5. Announced politely, never as an alert. The appearance-on-reopen and the
 *    recorded choice go through `DDS.announce` (role="status"). Interrupting a
 *    screen-reader user to tell them a consent bar exists is hostile.
 *
 * 6. Revocable. A persistent `[data-dds-consent-reopen="<name>"]` control —
 *    recommended in `.dds-sitefooter` — re-opens the gate so the answer can be
 *    changed. Consent that cannot be withdrawn is not lawful consent.
 *
 * -----------------------------------------------------------------------------
 * Without JavaScript
 * -----------------------------------------------------------------------------
 *
 * The gated script never loads (the privacy-safe default holds), and the two
 * buttons are `type="submit"` inside a `<form method="post" action="…">`
 * pointing at a product endpoint that records the choice in a cookie and
 * redirects back. DDS documents that shape; the endpoint is the product's. With
 * JavaScript this file intercepts the submit and never navigates.
 */
(function (global) {
  'use strict';

  var DDS = global.DDS;
  if (!DDS) {
    console.error('[DDS] consent-gate.js requires dds.js to be loaded first');
    return;
  }

  /* =========================================================================
     DDS.consent — read/write the decision, tell people it changed
     ========================================================================= */

  var STORAGE_PREFIX = 'dds-consent:';
  var EVENT = 'dds:consent';

  var config = {
    policy: metaPolicy(),
    /** A caller-supplied { get, set, remove }, or null for the localStorage default. */
    storage: null,
  };

  /** The policy version declared in the document head, or '' if none. */
  function metaPolicy() {
    var meta = document.querySelector('meta[name="dds-consent-policy"]');
    return meta ? (meta.getAttribute('content') || '').trim() : '';
  }

  function currentPolicy() {
    return config.policy || '';
  }

  /**
   * The storage backend. The localStorage default is probed once per call
   * rather than cached: a browser can revoke access mid-session (a setting
   * change, a quota eviction), and a stale "it worked earlier" reference would
   * throw where a fresh probe degrades quietly.
   */
  function storage() {
    if (config.storage) return config.storage;
    try {
      var probe = '__dds_consent_probe__';
      global.localStorage.setItem(probe, probe);
      global.localStorage.removeItem(probe);
      return {
        get: function (key) {
          return global.localStorage.getItem(key);
        },
        set: function (key, value) {
          global.localStorage.setItem(key, value);
        },
        remove: function (key) {
          global.localStorage.removeItem(key);
        },
      };
    } catch (error) {
      return null;
    }
  }

  function readRecord(name) {
    var store = storage();
    if (!store) return null;

    var raw;
    try {
      raw = store.get(STORAGE_PREFIX + name);
    } catch (error) {
      return null;
    }
    if (!raw) return null;

    try {
      var parsed = JSON.parse(raw);
      if (parsed && (parsed.state === 'granted' || parsed.state === 'denied')) {
        return parsed;
      }
    } catch (error) {
      /* A value we did not write, or wrote in an older shape. Treat it as
         absent — the person is asked again, which is the safe direction. */
    }
    return null;
  }

  function getState(name) {
    var record = readRecord(name);
    if (!record) return null;
    // A decision taken under a superseded policy is treated as no decision, so
    // the gate re-opens and the person is asked against the current notice.
    if (currentPolicy() && record.policy !== currentPolicy()) return null;
    return record.state;
  }

  function emit(name, state) {
    document.dispatchEvent(
      new CustomEvent(EVENT, {
        detail: { name: name, state: state, policy: currentPolicy() },
      })
    );
  }

  function setState(name, state) {
    if (state !== 'granted' && state !== 'denied') {
      throw new Error(
        '[DDS] consent state must be "granted" or "denied", got ' + JSON.stringify(state)
      );
    }

    var store = storage();
    if (store) {
      try {
        store.set(
          STORAGE_PREFIX + name,
          JSON.stringify({
            state: state,
            policy: currentPolicy(),
            at: new Date().toISOString(),
          })
        );
      } catch (error) {
        console.warn('[DDS] consent could not be persisted; it holds for this page only', error);
      }
    } else {
      console.warn('[DDS] no usable storage for consent; the choice holds for this page only');
    }

    emit(name, state);
  }

  function clearState(name) {
    var store = storage();
    if (store) {
      try {
        store.remove(STORAGE_PREFIX + name);
      } catch (error) {
        /* Nothing to do — the caller wanted it gone and, as far as anyone can
           tell, it is. */
      }
    }
    emit(name, null);
  }

  function onChange(name, handler) {
    function listener(event) {
      if (event.detail && event.detail.name === name) handler(event.detail);
    }
    document.addEventListener(EVENT, listener);

    // Fire once now with the current state. This is what lets the gated-script
    // code be written as a single branch instead of "wire the event AND also
    // check on load".
    handler({ name: name, state: getState(name), policy: currentPolicy() });

    return function unsubscribe() {
      document.removeEventListener(EVENT, listener);
    };
  }

  function configure(options) {
    options = options || {};
    if (typeof options.policy === 'string') config.policy = options.policy.trim();
    if (options.storage) config.storage = options.storage;
  }

  DDS.consent = {
    get: getState,
    record: readRecord,
    set: setState,
    clear: clearState,
    onChange: onChange,
    configure: configure,
    get policy() {
      return currentPolicy();
    },
  };

  /* =========================================================================
     The banner — showing it, hiding it, and moving focus with intent
     ========================================================================= */

  /**
   * The control that last re-opened a gate, per consent name. Focus returns
   * here once a choice is made, the same contract a dialog keeps with its
   * trigger (WCAG 2.4.3).
   */
  var openers = Object.create(null);

  var WORDING = {
    en: {
      opened: function (label) {
        return label + ' — choose whether to allow it';
      },
      granted: function (label) {
        return label + ' allowed';
      },
      denied: function (label) {
        return label + ' declined';
      },
      fallbackLabel: 'Optional cookies and scripts',
    },
    de: {
      opened: function (label) {
        return label + ' — bitte treffen Sie eine Wahl';
      },
      granted: function (label) {
        return label + ' erlaubt';
      },
      denied: function (label) {
        return label + ' abgelehnt';
      },
      fallbackLabel: 'Optionale Cookies und Skripte',
    },
  };

  function labelFor(gate) {
    var explicit = gate.getAttribute('data-dds-consent-label');
    if (explicit) return explicit;
    var title = gate.querySelector('.dds-banner-title');
    if (title && title.textContent.trim()) return title.textContent.trim();
    return DDS.utils.wording(gate, WORDING).fallbackLabel;
  }

  function gateFor(name) {
    var selector =
      '[data-dds-consent="' +
      (global.CSS && global.CSS.escape ? global.CSS.escape(name) : name) +
      '"]';
    return document.querySelector(selector);
  }

  DDS.register('consent-gate', '[data-dds-consent]', function (gate) {
    var name = gate.getAttribute('data-dds-consent');
    if (!name) {
      console.error('[DDS] a consent gate needs a name: data-dds-consent="…"', gate);
      return;
    }

    var buttons = Array.prototype.slice.call(gate.querySelectorAll('[data-dds-consent-set]'));
    if (!buttons.length) {
      console.error(
        '[DDS] a consent gate needs at least one [data-dds-consent-set] button',
        gate
      );
      return;
    }

    function conclude(state) {
      var words = DDS.utils.wording(gate, WORDING);
      var label = labelFor(gate);

      try {
        DDS.consent.set(name, state);
      } catch (error) {
        console.error('[DDS] consent gate button has an invalid state', error, gate);
        return;
      }

      DDS.announce(state === 'granted' ? words.granted(label) : words.denied(label), {
        from: gate,
      });

      gate.hidden = true;

      var opener = openers[name];
      if (opener && document.contains(opener)) opener.focus();
      openers[name] = null;
    }

    buttons.forEach(function (button) {
      button.addEventListener('click', function (event) {
        // The button is a submit inside a <form action> for the no-JS path.
        // With JS the decision is ours and the page never navigates.
        event.preventDefault();
        conclude(button.getAttribute('data-dds-consent-set'));
      });
    });

    // Belt and braces: if the buttons sit in a <form> (the no-JS path), stop it
    // navigating however it is triggered — Enter in a field, a submit() call.
    var form = gate.querySelector('form');
    if (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
      });
    }

    // JavaScript owns visibility from here. A decision that still stands (and is
    // current against the policy) means the gate never shows; otherwise it does,
    // whatever the server rendered.
    gate.hidden = DDS.consent.get(name) !== null;

    // The hook the revocation control calls. Kept on the element so
    // `[data-dds-consent-reopen]` can find its gate by name without this module
    // holding a registry.
    gate.ddsConsentReopen = function (fromControl) {
      openers[name] = fromControl || null;
      gate.hidden = false;

      var title = gate.querySelector('.dds-banner-title');
      if (title) {
        // Programmatically focusable, never a permanent tab stop.
        if (!title.hasAttribute('tabindex')) title.setAttribute('tabindex', '-1');
        title.focus();
      }

      DDS.announce(DDS.utils.wording(gate, WORDING).opened(labelFor(gate)), { from: gate });
    };
  });

  DDS.register('consent-reopen', '[data-dds-consent-reopen]', function (control) {
    control.addEventListener('click', function () {
      var name = control.getAttribute('data-dds-consent-reopen');
      var gate = gateFor(name);

      if (gate && typeof gate.ddsConsentReopen === 'function') {
        gate.ddsConsentReopen(control);
      } else if (gate) {
        // The gate has not been enhanced yet (script order); do the visible part
        // now and let enhancement wire the rest.
        gate.hidden = false;
      } else {
        console.error(
          '[DDS] no consent gate found for data-dds-consent-reopen="' + name + '"',
          control
        );
      }
    });
  });
})(typeof window !== 'undefined' ? window : globalThis);
