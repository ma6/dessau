/**
 * DDS — derived output pattern.
 *
 *   <script src="/dds/js/dds.js" defer></script>
 *   <script src="/dds/js/patterns/derived-output.js" defer></script>
 *
 * A read-only value worked out from something the user entered: a bank name from
 * an account identifier, a region from a postcode, a delivery estimate from a
 * postcode and a weight, a total from a quantity and a price.
 *
 * Markup:
 *
 *   <div class="dds-derived" data-dds-derived data-dds-derived-resolver="lookupBank">
 *     <div class="dds-field">
 *       <label class="dds-label" for="account">Account identifier</label>
 *       <input class="dds-input dds-input-code" id="account" name="account"
 *              data-dds-derived-input spellcheck="false" autocapitalize="characters">
 *       <p class="dds-hint" id="account-hint">…</p>
 *     </div>
 *
 *     <p class="dds-derived-check" data-dds-derived-check hidden>
 *       <svg class="dds-icon" aria-hidden="true"><use href="#dds-icon-check-circle"/></svg>
 *       Identifier recognised
 *     </p>
 *
 *     <dl class="dds-derived-output" data-dds-derived-output
 *         aria-live="polite" hidden></dl>
 *   </div>
 *
 * -----------------------------------------------------------------------------
 * Why this is a pattern rather than four one-off implementations
 * -----------------------------------------------------------------------------
 *
 * Every product grows two or three of these, and each one is built slightly
 * wrong in the same few ways:
 *
 *  1. The derived value is rendered as an editable input.
 *     It is output. An editable field invites the user to change it, and then
 *     either their edit is silently discarded or two contradictory values are
 *     submitted. This pattern renders a `<dl>` — a labelled value, associated
 *     programmatically, impossible to type into.
 *
 *  2. It is not announced.
 *     The value appears while focus is still in the input, so nobody using a
 *     screen reader learns it exists. The output region is `aria-live="polite"`,
 *     and `aria-atomic` so the label and value are read as one statement.
 *
 *  3. "Not yet resolvable" is treated as an error.
 *     A half-typed identifier is incomplete, not wrong. Resolution runs on
 *     `change`/blur, not on every keystroke, so the user is never told off
 *     mid-typing.
 *
 *  4. The reference data is shipped to the browser.
 *     A resolver is asynchronous by contract precisely so the lookup can be a
 *     request. Reference tables belong on the server: they are large, they change,
 *     and they are usually not ours to redistribute.
 *
 * -----------------------------------------------------------------------------
 * The resolver contract
 * -----------------------------------------------------------------------------
 *
 *   async function resolver(value, { signal }) {
 *     // → null when the input is incomplete: no output, no error.
 *     // → { fields: { Label: 'Value', … } } on success.
 *     // → throw with a .userMessage for an input that is complete but invalid.
 *   }
 *
 * The three outcomes are distinct on purpose. Collapsing "incomplete" and
 * "invalid" is what produces an error message while someone is still typing.
 */
(function (global) {
  'use strict';

  var DDS = global.DDS;
  if (!DDS) {
    console.error('[DDS] derived-output.js requires dds.js to be loaded first');
    return;
  }

  function createDerivedOutput(root, options) {
    var config = options || {};
    var input = root.querySelector('[data-dds-derived-input]');
    var output = root.querySelector('[data-dds-derived-output]');
    var check = root.querySelector('[data-dds-derived-check]');

    if (!input || !output) {
      console.error('[DDS] derived output needs an input and an output element', root);
      return { destroy: function () {} };
    }
    if (typeof config.resolver !== 'function') {
      console.error('[DDS] derived output needs a `resolver` function', root);
      return { destroy: function () {} };
    }

    // `aria-atomic` so the whole pairing is read as one statement rather than
    // announcing only the changed cell.
    output.setAttribute('aria-live', 'polite');
    output.setAttribute('aria-atomic', 'true');

    var controller = null;

    function clear() {
      output.replaceChildren();
      output.hidden = true;
      if (check) check.hidden = true;
      input.removeAttribute('aria-invalid');
      if (DDS.formValidation) DDS.formValidation.clearError(input);
    }

    function render(fields) {
      output.replaceChildren();

      Object.keys(fields).forEach(function (label) {
        var term = document.createElement('dt');
        term.textContent = label;
        output.appendChild(term);

        var value = document.createElement('dd');
        // textContent: the value came from outside the application.
        value.textContent = fields[label];
        output.appendChild(value);
      });

      output.hidden = false;
      if (check) check.hidden = false;
      input.removeAttribute('aria-invalid');
      if (DDS.formValidation) DDS.formValidation.clearError(input);
    }

    function resolve() {
      var value = input.value.trim();

      if (!value) {
        clear();
        return;
      }

      if (controller) controller.abort();
      controller = new AbortController();
      var signal = controller.signal;

      root.setAttribute('aria-busy', 'true');

      Promise.resolve()
        .then(function () {
          return config.resolver(value, { signal: signal });
        })
        .then(function (result) {
          if (signal.aborted) return;
          root.removeAttribute('aria-busy');

          // `null` means "incomplete" — not an error. Nothing is shown and
          // nothing is complained about.
          if (!result || !result.fields) {
            clear();
            return;
          }

          render(result.fields);
        })
        .catch(function (error) {
          if (signal.aborted || (error && error.name === 'AbortError')) return;
          root.removeAttribute('aria-busy');

          clear();
          input.setAttribute('aria-invalid', 'true');

          // A message the user can act on, supplied by the resolver. The generic
          // fallback still says what to do rather than only that it failed.
          var message =
            (error && error.userMessage) ||
            'This value could not be checked. Please confirm it and try again.';

          if (DDS.formValidation) {
            DDS.formValidation.showError(input, message);
          }
          DDS.announce(message, { assertive: true });
        });
    }

    // `change` rather than `input`: resolution happens once the user has
    // finished, so a partially typed value is never reported as invalid.
    input.addEventListener('change', resolve);

    // Editing after a result invalidates that result immediately. Leaving a
    // stale derived value on screen while the input has moved on is worse than
    // showing nothing — the user believes it still matches.
    input.addEventListener('input', function () {
      if (!output.hidden || input.getAttribute('aria-invalid') === 'true') clear();
    });

    // Resolve a value that was already there on load (a server-rendered form, a
    // browser restoring a session).
    if (input.value.trim()) resolve();

    return {
      destroy: function () {
        if (controller) controller.abort();
        input.removeEventListener('change', resolve);
      },
      refresh: resolve,
    };
  }

  DDS.derivedOutput = createDerivedOutput;

  /* =========================================================================
     Declarative enhancement
     =========================================================================
       <div data-dds-derived data-dds-derived-resolver="lookupPostcode">

     The resolver is looked up by name on the global object, so a page can wire
     one up with no inline script.
     ========================================================================= */

  DDS.register('derived-output', '[data-dds-derived]', function (root) {
    var name = root.getAttribute('data-dds-derived-resolver');
    if (!name) return; // configured from application code instead

    var resolver = global[name];
    if (typeof resolver !== 'function') {
      console.error('[DDS] derived-output resolver "' + name + '" is not a global function');
      return;
    }

    createDerivedOutput(root, { resolver: resolver });
  });
})(typeof window !== 'undefined' ? window : globalThis);
