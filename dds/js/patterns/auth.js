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

  /* =========================================================================
     Password reset — confirming a new password
     =========================================================================
     Markup:
       <div data-dds-password-confirm>
         <input type="password" autocomplete="new-password" data-dds-password-new>
         <input type="password" autocomplete="new-password" data-dds-password-repeat>
         <p role="status" data-dds-password-match></p>
       </div>

     One job: tell the user whether the two entries agree, while they are typing,
     without telling them off for a password they have not finished entering.

     ---------------------------------------------------------------------------
     `autocomplete="new-password"` on BOTH fields
     ---------------------------------------------------------------------------

     Not `off`, and not `new-password` on the first with `off` on the second. That
     token is how a password manager knows to offer to generate and then to save.
     Set it on both and the manager fills both; set it on one and the user gets a
     generated password in the first field and has to retype 24 random characters
     into the second, which is precisely the situation the manager exists to avoid.

     `off` on either one is worse than useless: browsers largely ignore it for
     passwords, and where it is honoured it disables the manager rather than the
     autofill — so the user gets no generator, no save prompt, and reaches for a
     password they can remember.

     ---------------------------------------------------------------------------
     When the mismatch is announced
     ---------------------------------------------------------------------------

     Never before the second field has been left, and never while it is shorter than
     what has been typed into the first. "Passwords do not match" appearing on the
     second keystroke of a confirmation field is not information — it is noise that
     is true of every confirmation field until the moment it is not, and it trains
     people to ignore the message that eventually matters.

     `role="status"` rather than `role="alert"`: this is feedback on progress, not an
     interruption. It is also why the message is only *written* when it changes —
     rewriting identical text into a live region makes a screen reader repeat it.

     Without JavaScript: two ordinary password fields. The server compares them,
     which it has to do anyway — a client-side check is a convenience and never the
     authority. */

  DDS.register('password-confirm', '[data-dds-password-confirm]', function (root) {
    var first = root.querySelector('[data-dds-password-new]');
    var second = root.querySelector('[data-dds-password-repeat]');
    var status = root.querySelector('[data-dds-password-match]');

    if (!first || !second) return;

    var MESSAGES = {
      match: root.getAttribute('data-dds-password-match-text') || 'Both entries match.',
      differ:
        root.getAttribute('data-dds-password-differ-text') ||
        'The two entries are different.',
    };

    /** Only write to the live region when the text actually changes. */
    var announced = null;
    function say(text) {
      if (!status || announced === text) return;
      announced = text;
      status.textContent = text;
    }

    /**
     * `setCustomValidity` is what makes the browser and the validation pattern agree.
     * Without it the form would submit with two different passwords and the message
     * beside the field would be the only thing that had noticed.
     */
    function check(options) {
      var settled = options && options.settled;
      var repeat = second.value;

      if (repeat === '') {
        second.setCustomValidity('');
        second.removeAttribute('aria-invalid');
        say('');
        return;
      }

      if (repeat === first.value) {
        second.setCustomValidity('');
        second.removeAttribute('aria-invalid');
        say(MESSAGES.match);
        return;
      }

      /**
       * Still shorter than the first entry: this is someone mid-way through typing,
       * not a mismatch. The constraint is set so a submit right now still fails, but
       * nothing is said yet.
       */
      var typing = !settled && repeat.length < first.value.length;

      second.setCustomValidity(MESSAGES.differ);

      if (typing) {
        second.removeAttribute('aria-invalid');
        say('');
        return;
      }

      second.setAttribute('aria-invalid', 'true');
      say(MESSAGES.differ);
    }

    first.addEventListener('input', function () {
      // Editing the first field re-tests the second, so an already-typed
      // confirmation stops being reported as wrong once the first one catches up.
      check();
    });

    second.addEventListener('input', function () {
      check();
    });

    // Leaving the field is the point at which "not finished yet" stops being a
    // plausible explanation.
    second.addEventListener('blur', function () {
      check({ settled: true });
    });
  });

})(typeof window !== 'undefined' ? window : globalThis);
