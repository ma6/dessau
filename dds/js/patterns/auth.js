/**
 * DDS — authentication pattern behaviour.
 *
 *   <script src="/dds/js/dds.js" defer></script>
 *   <script src="/dds/js/patterns/auth.js" defer></script>
 *
 * One thing: confirming a new password against its repeat.
 *
 * The reveal toggle used to live here. It moved to `components-forms.js`, because
 * it belongs to the password field rather than to the sign-in page — a field gets
 * it wherever it appears, without this file being loaded at all. What is left
 * here is genuinely about a flow: two fields that have to agree.
 */
(function (global) {
  'use strict';

  var DDS = global.DDS;
  if (!DDS) {
    console.error('[DDS] auth.js requires dds.js to be loaded first');
    return;
  }

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
