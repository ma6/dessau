/**
 * DDS — form component behaviour.
 *
 *   <script src="/dds/js/dds.js" defer></script>
 *   <script src="/dds/js/components-forms.js" defer></script>
 *
 * Contents: number stepper · file upload · character count
 *
 * Everything here degrades to a working native control. Without this file the
 * stepper is a usable `<input type="number">`, the upload is a usable
 * `<input type="file">`, and the character count is simply absent — while
 * `maxlength` still enforces the limit, because the limit was never enforced
 * here in the first place.
 */
(function (global) {
  'use strict';

  var DDS = global.DDS;
  if (!DDS) {
    console.error('[DDS] components-forms.js requires dds.js to be loaded first');
    return;
  }

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
