/**
 * DDS — authentication pattern behaviour.
 *
 *   <script src="/dds/js/dds.js" defer></script>
 *   <script src="/dds/js/patterns/auth.js" defer></script>
 *
 * One thing: the password reveal toggle.
 *
 * -----------------------------------------------------------------------------
 * Why a reveal toggle is a requirement, not a convenience
 * -----------------------------------------------------------------------------
 *
 * WCAG 2.2 3.3.8 Accessible Authentication (Minimum) forbids a cognitive function
 * test without an alternative. Typing a long password blind — on a phone keyboard,
 * with a motor impairment, with dyslexia, or simply with a password manager that
 * did not fire — is exactly the barrier the criterion is about. Being able to see
 * what was typed is the alternative.
 *
 * The details that matter:
 *
 *  - It is a real `<button type="button">` with `aria-pressed`, not a div and not
 *    a checkbox. It is one control in two states, so its accessible name must
 *    stay CONSTANT — a button whose name changes when pressed is announced as a
 *    different control each time. The state lives in `aria-pressed`.
 *  - Revealing is announced, because the change is invisible to a screen-reader
 *    user and silently switching a field from masked to visible is a privacy
 *    matter they should know about.
 *  - The toggle never touches `autocomplete`. Changing the input's `type` is
 *    enough; clearing or rewriting `autocomplete` would break the password
 *    manager, which is the very thing the criterion requires to keep working.
 *
 * Without this file the password field is a normal masked input. Less accessible,
 * still functional.
 */
(function (global) {
  'use strict';

  var DDS = global.DDS;
  if (!DDS) {
    console.error('[DDS] auth.js requires dds.js to be loaded first');
    return;
  }

  DDS.register('password-toggle', '[data-dds-password-toggle]', function (button) {
    var id = button.getAttribute('data-dds-password-toggle');
    var input = document.getElementById(id);

    if (!input) {
      console.error('[DDS] password toggle references unknown field "' + id + '"', button);
      return;
    }

    // `type="button"`, or it submits the form instead of revealing anything.
    if (button.tagName === 'BUTTON' && !button.getAttribute('type')) button.type = 'button';

    button.setAttribute('aria-pressed', input.type === 'text' ? 'true' : 'false');

    button.addEventListener('click', function () {
      var revealing = input.type === 'password';

      // Only `type` changes. `autocomplete` is deliberately left alone: rewriting
      // it here is the usual reason a reveal toggle breaks password managers.
      input.type = revealing ? 'text' : 'password';
      button.setAttribute('aria-pressed', revealing ? 'true' : 'false');

      // Keep the caret where it was. Reassigning `type` moves it to the start in
      // some engines, which is maddening halfway through a long password.
      try {
        var position = input.value.length;
        input.setSelectionRange(position, position);
      } catch (error) {
        // Not all input types support selection ranges; not worth failing over.
      }

      input.focus();

      DDS.announce(revealing ? 'Password is now visible' : 'Password is now hidden');
    });
  });
})(typeof window !== 'undefined' ? window : globalThis);
