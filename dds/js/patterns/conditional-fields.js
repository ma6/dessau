/**
 * DDS — conditional fields pattern.
 *
 *   <script src="/dds/js/dds.js" defer></script>
 *   <script src="/dds/js/patterns/conditional-fields.js" defer></script>
 *
 * Reveals a group of fields based on an earlier answer.
 *
 * Markup — the controlling input names the region it reveals; an empty value
 * means "this option reveals nothing":
 *
 *   <label class="dds-choice">
 *     <input type="radio" name="invoice" value="same" checked
 *            data-dds-reveal="" aria-controls="invoice-fields" aria-expanded="false">
 *     <span class="dds-choice-label">To the address above</span>
 *   </label>
 *   <label class="dds-choice">
 *     <input type="radio" name="invoice" value="other"
 *            data-dds-reveal="invoice-fields" aria-controls="invoice-fields" aria-expanded="false">
 *     <span class="dds-choice-label">To a different address</span>
 *   </label>
 *
 *   <div class="dds-conditional" id="invoice-fields" hidden> … </div>
 *
 * -----------------------------------------------------------------------------
 * The four rules
 * -----------------------------------------------------------------------------
 *
 * 1. Hidden with the `hidden` attribute, not with CSS.
 *    `hidden` removes the region from the tab order AND from the accessibility
 *    tree. Hiding it with `opacity`, `visibility` or an off-screen position
 *    leaves invisible tab stops behind, which is deeply disorienting: the focus
 *    ring disappears and Tab appears to do nothing.
 *
 * 2. The revealed region comes immediately after its trigger in the DOM.
 *    Reading order must match visual order (WCAG 1.3.2). Enforcing it in markup
 *    rather than with CSS `order` is the only way it stays true.
 *
 * 3. Focus is not moved into the revealed region.
 *    The user is working through the form in order and will arrive there next.
 *    Moving focus would skip whatever sits between the trigger and the region.
 *
 * 4. Required fields inside a hidden region must not block submission.
 *    The user cannot see them. `form-validation.js` skips anything inside a
 *    `[hidden]` ancestor for exactly this reason.
 *
 * Without JavaScript every region is visible, which is the correct fallback: all
 * the fields are reachable and the form still works. It asks a little more of the
 * user and excludes nobody.
 */
(function (global) {
  'use strict';

  var DDS = global.DDS;
  if (!DDS) {
    console.error('[DDS] conditional-fields.js requires dds.js to be loaded first');
    return;
  }

  /**
   * Collect every region controlled by any input in this control's group, so
   * choosing one option can close the region belonging to another.
   */
  function regionsForGroup(input) {
    var form = input.form || document;
    var selector = input.name
      ? '[data-dds-reveal][name="' + input.name + '"]'
      : '[data-dds-reveal]';

    var ids = [];
    form.querySelectorAll(selector).forEach(function (sibling) {
      var id = sibling.getAttribute('data-dds-reveal');
      if (id && ids.indexOf(id) === -1) ids.push(id);
    });

    return ids
      .map(function (id) {
        return document.getElementById(id);
      })
      .filter(Boolean);
  }

  function sync(input) {
    var group = input.name
      ? (input.form || document).querySelectorAll('[data-dds-reveal][name="' + input.name + '"]')
      : [input];

    var regions = regionsForGroup(input);
    var wanted = [];

    Array.prototype.forEach.call(group, function (control) {
      var id = control.getAttribute('data-dds-reveal');
      var on = control.type === 'checkbox' || control.type === 'radio' ? control.checked : true;

      // `aria-expanded` on the control makes the relationship announced rather
      // than merely visual.
      if (control.hasAttribute('aria-controls')) {
        control.setAttribute('aria-expanded', on && id ? 'true' : 'false');
      }

      if (on && id) wanted.push(id);
    });

    regions.forEach(function (region) {
      region.hidden = wanted.indexOf(region.id) === -1;
    });
  }

  DDS.register('conditional-fields', '[data-dds-reveal]', function (input) {
    // Establish the initial state from the markup: a server may have rendered a
    // different option as checked.
    sync(input);

    // `change` rather than `click`: it fires for keyboard selection too, and for
    // a radio group it fires on the control that became checked.
    input.addEventListener('change', function () {
      sync(input);
    });
  });
})(typeof window !== 'undefined' ? window : globalThis);
