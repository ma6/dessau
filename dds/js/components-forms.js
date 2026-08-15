/**
 * DDS — form component behaviour.
 *
 *   <script src="/dds/js/dds.js" defer></script>
 *   <script src="/dds/js/components-forms.js" defer></script>
 *
 * Contents: password reveal · number stepper · file upload · character count
 *
 * Everything here degrades to a working native control. Without this file the
 * stepper is a usable `<input type="number">`, the upload is a usable
 * `<input type="file">`, the password field is an ordinary masked input, and the
 * character count is simply absent — while `maxlength` still enforces the limit,
 * because the limit was never enforced here in the first place.
 */
(function (global) {
  'use strict';

  var DDS = global.DDS;
  if (!DDS) {
    console.error('[DDS] components-forms.js requires dds.js to be loaded first');
    return;
  }

  var SVG_NS = 'http://www.w3.org/2000/svg';

  /** An icon element referencing the inlined sprite. */
  function spriteIcon(id, className) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', className ? 'dds-icon ' + className : 'dds-icon');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    var use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', '#' + id);
    svg.appendChild(use);

    return svg;
  }

  /* =========================================================================
     Password reveal
     =========================================================================
     Markup:
       <input class="dds-input" type="password" autocomplete="current-password">

     That is the whole contract. Every password field in the document gets the
     wrapper and the reveal button, without asking for them.

     ---------------------------------------------------------------------------
     Why this one enhancement is not opt-in
     ---------------------------------------------------------------------------

     Everything else in DDS waits for a `data-dds-*` attribute. This does not,
     and the reason is that a missing reveal toggle is an accessibility defect
     rather than a missing feature: WCAG 2.2 3.3.8 Accessible Authentication
     (Minimum) forbids a cognitive function test without an alternative, and
     typing a long password blind is exactly that test. Opt-in would mean the
     compliant version is the one somebody remembered, and a password field with
     no toggle looks entirely normal — so nothing would ever report the omission.

     `type="password"` is an unambiguous statement of intent already present in
     the markup, which is what an opt-in attribute would have been for. See
     DECISIONS.md.

     Opt out where a field genuinely must stay masked:

       <input type="password" data-dds-password="off">

     That is the attribute's only job. The wording comes from the document's own
     `lang`, because the document already says what language it is in and asking
     twice is asking for the two answers to disagree.

     ---------------------------------------------------------------------------
     The details that matter
     ---------------------------------------------------------------------------

      - It is a real `<button type="button">` with `aria-pressed`, not a div and
        not a checkbox. It is one control in two states, so its accessible name
        must stay CONSTANT — a button whose name changes when pressed is
        announced as a different control each time. The state lives in
        `aria-pressed`.
      - Revealing is announced, because the change is invisible to a
        screen-reader user and silently switching a field from masked to visible
        is a privacy matter they should know about.
      - Only `type` changes. `autocomplete` is never touched: rewriting it is the
        usual reason a reveal toggle breaks password managers, and keeping the
        manager working is the very thing 3.3.8 depends on. Paste is never
        blocked, for the same reason.

     Without this file the field is a normal masked input. Less accessible, still
     functional, and it still submits.
     ========================================================================= */

  /**
   * Wording, per language.
   *
   * `action` is the button's accessible name and stays the same in both states —
   * the icon and the field itself carry the state. The two announcements are
   * what a screen-reader user gets instead of seeing the characters appear.
   */
  var PASSWORD_LABELS = {
    en: {
      action: 'Show password',
      shown: 'Password is now visible',
      hidden: 'Password is now hidden',
    },
    de: {
      action: 'Passwort anzeigen',
      shown: 'Das Passwort ist jetzt sichtbar',
      hidden: 'Das Passwort ist jetzt verborgen',
    },
  };

  /**
   * The wording for one field, in the language of the place it sits.
   *
   * `DDS.utils.wording` is the single answer to "which strings apply here?" in
   * the system, and it resolves the language from `lang` — see the note there
   * for why nothing in DDS asks for the language a second time. English when the
   * language is unrecognised: a button named in the wrong language still beats
   * one with no name.
   */
  function passwordLabels(element) {
    return DDS.utils.wording(element, PASSWORD_LABELS);
  }

  /**
   * Wire one button to one field.
   *
   * Shared by both routes to a toggle: the one this file injects, and one a page
   * wrote by hand with `data-dds-password-toggle`.
   */
  function wireReveal(button, input) {
    var labels = passwordLabels(input);

    // `type="button"`, or it submits the form instead of revealing anything.
    if (button.tagName === 'BUTTON' && !button.getAttribute('type')) button.type = 'button';

    button.setAttribute('aria-pressed', input.type === 'text' ? 'true' : 'false');

    button.addEventListener('click', function () {
      var revealing = input.type === 'password';

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

      DDS.announce(revealing ? labels.shown : labels.hidden);
    });
  }

  /** Is there already a toggle in this document pointing at this field? */
  function hasAuthoredToggle(input) {
    if (!input.id) return false;

    return Array.prototype.some.call(
      document.querySelectorAll('[data-dds-password-toggle]'),
      function (button) {
        return button.getAttribute('data-dds-password-toggle') === input.id;
      }
    );
  }

  DDS.register(
    'password',
    'input[type="password"]:not([data-dds-password="off"])',
    function (input) {
      var parent = input.parentElement;
      if (!parent) return;

      // A page that wrote its own toggle keeps it. Two toggles on one field is
      // two controls that disagree about the state.
      if (parent.querySelector('.dds-password-toggle') || hasAuthoredToggle(input)) return;

      /**
       * Where the button goes.
       *
       * A wrapper that already carries the border — because the page wrote
       * `.dds-password`, or because the field sits in an `.dds-input-group` — is
       * used as it is. Wrapping a wrapper would draw a second border inside the
       * first.
       *
       * Otherwise the input is moved into a new one. Moving an input preserves
       * its value, and this runs at DOMContentLoaded, before anything is focused.
       */
      var host = parent;
      if (!parent.matches('.dds-password, .dds-input-group')) {
        /**
         * A field nested inside its own `<label>` is the one shape this cannot be
         * added to. A `<label>` may not contain a labelable element other than the
         * control it labels, and a `<button>` is labelable — so the toggle would be
         * invalid markup with undefined activation behaviour, which is worse than
         * no toggle. Said out loud, because the consequence is a WCAG 2.2 3.3.8
         * failure and the fix is one Dessau asks for anyway.
         */
        if (input.closest('label')) {
          console.error(
            '[DDS] no password reveal added: the field is inside its own <label>, ' +
              'which cannot contain a button. Use a separate <label for>.',
            input
          );
          return;
        }

        host = document.createElement('span');
        host.className = 'dds-password';
        input.replaceWith(host);
        host.appendChild(input);
      }

      var button = document.createElement('button');
      button.type = 'button';
      button.className =
        'dds-button dds-button-subtle dds-button-icon dds-button-sm dds-password-toggle';

      // The name is a real element rather than `aria-label`, so it is translated
      // by the same machinery as the rest of the page.
      var name = document.createElement('span');
      name.className = 'dds-sr-only';
      name.textContent = passwordLabels(input).action;
      button.appendChild(name);

      button.appendChild(spriteIcon('dds-icon-eye', 'dds-password-show'));
      button.appendChild(spriteIcon('dds-icon-eye-off', 'dds-password-hide'));

      // A disabled field has nothing to reveal, and an operable control beside a
      // dead one is a lie about what the form will accept.
      if (input.disabled) button.disabled = true;

      host.appendChild(button);
      wireReveal(button, input);
    }
  );

  /* A toggle written by hand, pointing at a field by id. Still supported: a
     product may want the button somewhere this file would not have put it. */
  DDS.register('password-toggle', '[data-dds-password-toggle]', function (button) {
    var id = button.getAttribute('data-dds-password-toggle');
    var input = document.getElementById(id);

    if (!input) {
      console.error('[DDS] password toggle references unknown field "' + id + '"', button);
      return;
    }

    wireReveal(button, input);
  });

  /* =========================================================================
     Number stepper
     =========================================================================
     Markup:
       <div class="dds-stepper" data-dds-stepper>
         <button type="button" class="dds-stepper-button" data-dds-stepper-decrement>
           <span class="dds-sr-only">Decrease quantity</span>
           <svg class="dds-icon" aria-hidden="true"><use href="#dds-icon-minus"/></svg>
         </button>
         <input id="qty" type="number" value="1" min="1" max="99" step="1">
         <button type="button" class="dds-stepper-button" data-dds-stepper-increment>
           <span class="dds-sr-only">Increase quantity</span>
           <svg class="dds-icon" aria-hidden="true"><use href="#dds-icon-plus"/></svg>
         </button>
       </div>

     The input stays authoritative: min, max and step are read from it, and it
     remains typeable. The buttons only move the same value.

     `stepUp()`/`stepDown()` are used rather than arithmetic, because they respect
     `step` bases and floating-point steps correctly — `value + 0.1` produces
     0.30000000000000004 and the browser's own implementation does not.
     ========================================================================= */

  DDS.register('stepper', '[data-dds-stepper]', function (root) {
    var input = root.querySelector('input');
    var decrement = root.querySelector('[data-dds-stepper-decrement]');
    var increment = root.querySelector('[data-dds-stepper-increment]');

    if (!input) {
      console.error('[DDS] stepper needs an <input>', root);
      return;
    }

    function limits() {
      return {
        min: input.min === '' ? -Infinity : Number(input.min),
        max: input.max === '' ? Infinity : Number(input.max),
      };
    }

    /**
     * Disable a button once its direction is exhausted, so the control shows its
     * own boundaries instead of silently doing nothing.
     */
    function syncButtons() {
      var bounds = limits();
      var value = Number(input.value);

      if (decrement) decrement.disabled = Number.isFinite(value) && value <= bounds.min;
      if (increment) increment.disabled = Number.isFinite(value) && value >= bounds.max;
    }

    function step(direction) {
      // An empty field has no value to step from; start at the minimum, or zero.
      if (input.value === '') {
        var bounds = limits();
        input.value = Number.isFinite(bounds.min) ? bounds.min : 0;
      } else if (direction > 0) {
        input.stepUp();
      } else {
        input.stepDown();
      }

      // Notify anything watching — validation, a framework binding, a total.
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));

      syncButtons();

      // Announce the new value. The visual change is obvious to a sighted user
      // and invisible otherwise, and the buttons themselves say nothing about
      // what the value became.
      var label = input.labels && input.labels[0] ? input.labels[0].textContent.trim() : 'Value';
      DDS.announce(label + ': ' + input.value);
    }

    if (decrement) {
      decrement.addEventListener('click', function () {
        step(-1);
      });
    }

    if (increment) {
      increment.addEventListener('click', function () {
        step(1);
      });
    }

    // Typing directly must keep the buttons in step.
    input.addEventListener('input', syncButtons);
    input.addEventListener('change', syncButtons);

    syncButtons();
  });

  /* =========================================================================
     File upload
     =========================================================================
     Markup:
       <div class="dds-upload" data-dds-upload>
         <div class="dds-upload-zone">
           <svg class="dds-icon" aria-hidden="true"><use href="#dds-icon-upload"/></svg>
           <label>
             <span class="dds-button dds-button-secondary">Choose files</span>
             <input class="dds-sr-only" type="file" multiple
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png">
           </label>
           <p class="dds-hint">PDF, JPG or PNG, up to 10 MB each. You can also drop files here.</p>
         </div>
         <ul class="dds-upload-list" data-dds-upload-list></ul>
       </div>

     Drag-and-drop is added on top of the native picker, never instead of it:
     dragging is impossible for many people and awkward for most on a trackpad
     (WCAG 2.2 2.5.7 Dragging Movements). The button is always the primary route.

     Client-side size and type checks are convenience only. The server checks
     again — a rejected file here has simply not been uploaded yet.
     ========================================================================= */

  DDS.register('upload', '[data-dds-upload]', function (root) {
    var input = root.querySelector('input[type="file"]');
    var zone = root.querySelector('.dds-upload-zone') || root;
    var list = root.querySelector('[data-dds-upload-list]');

    if (!input) {
      console.error('[DDS] upload needs an <input type="file">', root);
      return;
    }

    var maxBytes = Number(root.getAttribute('data-dds-upload-max-bytes')) || Infinity;

    function formatSize(bytes) {
      // Use the locale-aware formatter when it is loaded; fall back to something
      // reasonable rather than requiring format.js.
      if (DDS.format && DDS.format.fileSize) return DDS.format.fileSize(bytes);
      return Math.round(bytes / 1024) + ' kB';
    }

    /**
     * Does the file match the input's `accept` attribute?
     *
     * Checked here as well as by the picker, because a dropped file never went
     * through the picker and so was never filtered.
     */
    function accepts(file) {
      var accept = (input.getAttribute('accept') || '').trim();
      if (!accept) return true;

      return accept.split(',').some(function (rule) {
        var pattern = rule.trim().toLowerCase();
        if (!pattern) return false;

        // ".pdf" — extension match.
        if (pattern.startsWith('.')) {
          return file.name.toLowerCase().endsWith(pattern);
        }
        // "image/*" — type group match.
        if (pattern.endsWith('/*')) {
          return file.type.toLowerCase().startsWith(pattern.slice(0, -1));
        }
        // "application/pdf" — exact MIME match.
        return file.type.toLowerCase() === pattern;
      });
    }

    function render() {
      if (!list) return;

      list.replaceChildren();
      var files = Array.prototype.slice.call(input.files || []);

      files.forEach(function (file, index) {
        var tooBig = file.size > maxBytes;
        var wrongType = !accepts(file);
        var rejected = tooBig || wrongType;

        var item = document.createElement('li');
        item.className = 'dds-upload-item';
        if (rejected) item.setAttribute('data-dds-rejected', '');

        var icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.setAttribute('class', 'dds-icon');
        icon.setAttribute('aria-hidden', 'true');
        var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', rejected ? '#dds-icon-error' : '#dds-icon-document');
        icon.appendChild(use);
        item.appendChild(icon);

        var name = document.createElement('span');
        name.className = 'dds-upload-item-name';
        // textContent: a filename is user-supplied and may contain anything.
        name.textContent = file.name;
        item.appendChild(name);

        var meta = document.createElement('span');
        meta.className = 'dds-upload-item-size';
        if (tooBig) {
          meta.textContent = formatSize(file.size) + ' — too large';
          meta.classList.add('dds-text-error');
        } else if (wrongType) {
          meta.textContent = 'Unsupported format';
          meta.classList.add('dds-text-error');
        } else {
          meta.textContent = formatSize(file.size);
        }
        item.appendChild(meta);

        var remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'dds-button dds-button-subtle dds-button-icon dds-button-sm dds-upload-item-remove';
        // The name says WHICH file, so a list of five remove buttons is not five
        // identical controls.
        var removeLabel = document.createElement('span');
        removeLabel.className = 'dds-sr-only';
        removeLabel.textContent = 'Remove ' + file.name;
        remove.appendChild(removeLabel);
        var removeIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        removeIcon.setAttribute('class', 'dds-icon');
        removeIcon.setAttribute('aria-hidden', 'true');
        var removeUse = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        removeUse.setAttribute('href', '#dds-icon-close');
        removeIcon.appendChild(removeUse);
        remove.appendChild(removeIcon);

        remove.addEventListener('click', function () {
          removeAt(index, file.name);
        });

        item.appendChild(remove);
        list.appendChild(item);
      });
    }

    /**
     * Remove one file.
     *
     * `input.files` is a read-only FileList, so removal means rebuilding it via
     * DataTransfer. This is the only way to drop a single file from a multi-file
     * input without clearing the whole selection.
     */
    function removeAt(index, name) {
      var transfer = new DataTransfer();
      Array.prototype.slice.call(input.files || []).forEach(function (file, i) {
        if (i !== index) transfer.items.add(file);
      });
      input.files = transfer.files;

      input.dispatchEvent(new Event('change', { bubbles: true }));
      render();
      DDS.announce('Removed ' + name);
    }

    input.addEventListener('change', function () {
      render();
      var count = (input.files || []).length;
      DDS.announce(
        count === 0
          ? 'No files selected'
          : count === 1
            ? '1 file selected'
            : count + ' files selected'
      );
    });

    /* --- drag and drop, strictly additive ------------------------------- */

    // Only offer it where the API exists.
    if (typeof DataTransfer !== 'undefined') {
      ['dragenter', 'dragover'].forEach(function (type) {
        zone.addEventListener(type, function (event) {
          // preventDefault is what tells the browser this is a drop target;
          // without it the browser navigates to the dropped file instead.
          event.preventDefault();
          zone.setAttribute('data-dds-dragging', '');
        });
      });

      ['dragleave', 'drop'].forEach(function (type) {
        zone.addEventListener(type, function (event) {
          event.preventDefault();
          // `dragleave` also fires when moving over a child element, so only
          // clear the state when the pointer has really left the zone.
          if (type === 'dragleave' && zone.contains(event.relatedTarget)) return;
          zone.removeAttribute('data-dds-dragging');
        });
      });

      zone.addEventListener('drop', function (event) {
        var dropped = event.dataTransfer && event.dataTransfer.files;
        if (!dropped || !dropped.length) return;

        var transfer = new DataTransfer();

        // Append to the existing selection when the input allows several files;
        // otherwise replace, matching what the picker would do.
        if (input.multiple) {
          Array.prototype.slice.call(input.files || []).forEach(function (file) {
            transfer.items.add(file);
          });
        }

        Array.prototype.slice.call(dropped).forEach(function (file) {
          transfer.items.add(file);
          if (!input.multiple) return;
        });

        input.files = transfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    render();
  });

  /* =========================================================================
     Character count
     =========================================================================
     Markup:
       <textarea id="notes" maxlength="280" aria-describedby="notes-count"></textarea>
       <p class="dds-charcount" id="notes-count"
          data-dds-charcount="notes" role="status" aria-live="polite"></p>

     The count is debounced before it reaches the live region. Announcing a
     number after every keystroke makes a screen reader unusable, and the count
     is only interesting near the limit anyway.

     `maxlength` does the enforcing. This is purely informational, which is why
     an "over" state can only be reached when a product sets a soft limit itself.
     ========================================================================= */

  DDS.register('charcount', '[data-dds-charcount]', function (output) {
    var id = output.getAttribute('data-dds-charcount');
    var field = document.getElementById(id);

    if (!field) {
      console.error('[DDS] charcount references unknown field "' + id + '"', output);
      return;
    }

    var max = Number(field.getAttribute('maxlength')) || Number(output.getAttribute('data-dds-charcount-max'));
    if (!max) {
      console.error('[DDS] charcount needs a maxlength on the field', field);
      return;
    }

    // The live region only carries the text; the visible number updates
    // immediately so a sighted user sees it respond to every keystroke.
    var visible = document.createElement('span');
    output.replaceChildren(visible);

    function state(remaining) {
      if (remaining < 0) return 'over';
      // Warn within the last 10%, or the last 20 characters, whichever is more.
      if (remaining <= Math.max(20, max * 0.1)) return 'near';
      return 'ok';
    }

    function paint() {
      var used = field.value.length;
      var remaining = max - used;

      visible.textContent = remaining + ' characters remaining';
      output.setAttribute('data-dds-charcount-state', state(remaining));
    }

    // Debounced, and separate from the visual update.
    var announceCount = DDS.utils.debounce(function () {
      var remaining = max - field.value.length;
      // Only worth speaking when it starts to matter.
      if (state(remaining) === 'ok') return;
      DDS.announce(remaining + ' characters remaining');
    }, 700);

    field.addEventListener('input', function () {
      paint();
      announceCount();
    });

    paint();
  });
})(typeof window !== 'undefined' ? window : globalThis);
