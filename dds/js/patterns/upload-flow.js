/**
 * DDS — upload flow pattern.
 *
 *   <script src="/dds/js/dds.js" defer></script>
 *   <script src="/dds/js/patterns/upload-flow.js" defer></script>
 *
 * Choosing files, seeing them checked, and recovering from a rejection.
 *
 * The `upload` component (components-forms.js) handles selecting and listing
 * files. This is a different pattern, for what happens next — per-file
 * progress, a real way to cancel one in flight, and a rejection that says why
 * and what to do, without discarding the files that succeeded.
 *
 * -----------------------------------------------------------------------------
 * Progressive enhancement
 * -----------------------------------------------------------------------------
 *
 * Without this file the input is a plain `<input type="file" multiple>`
 * inside a real `<form>`, with a real submit button — the browser's own
 * upload, no progress shown until the page navigates away. The input starts
 * VISIBLE in the markup, not hidden: a `hidden` baked in up front, with only
 * a `type="button"` trigger to reveal it, means no JavaScript, no way to
 * reach the input at all, because that button does nothing on its own. The
 * trigger runs the opposite way for the same reason: it starts `hidden`,
 * because a button with no listener yet is a dead control sitting beside
 * the real one, not a helpful extra. This file swaps both — hides the input
 * and the form's own submit button, reveals the trigger — once it can hand
 * every job to itself and to per-file auto-upload; a leftover submit button
 * would otherwise fire a real navigation on top of uploads already in
 * progress.
 *
 * -----------------------------------------------------------------------------
 * Markup contract
 * -----------------------------------------------------------------------------
 *
 *   <div class="dds-uploadflow" id="my-uploads"
 *        data-dds-uploadflow-max-bytes="10485760">
 *     <p class="dds-results-summary" role="status" data-dds-uploadflow-summary></p>
 *     <button type="button" class="dds-button dds-button-secondary dds-button-sm"
 *             data-dds-uploadflow-trigger hidden>Choose files</button>
 *     <form method="post" enctype="multipart/form-data" action="/upload">
 *       <input type="file" multiple data-dds-uploadflow-input accept="...">
 *       <button type="submit">Upload</button>
 *     </form>
 *   </div>
 *   <script>DDS.uploadFlow(document.getElementById('my-uploads'), { upload: … });</script>
 *
 * No bare `data-dds-uploadflow` marker and no declarative registration: the
 * one thing every instance needs — the `upload` function itself — cannot
 * come from an attribute, so there is no sensible zero-config default the
 * way a combobox has `arraySource` or results has a plain array filter.
 *
 * Items are inserted as siblings of the trigger button, in the order files
 * were added. `createUploadFlow` needs an `upload` function — there is no
 * meaningful default, the same reason a combobox needs a `source`.
 */
(function (global) {
  'use strict';

  var DDS = global.DDS;
  if (!DDS) {
    console.error('[DDS] upload-flow.js requires dds.js to be loaded first');
    return;
  }

  var WORDING = {
    en: {
      cancel: function (name) {
        return 'Cancel — uploading ' + name;
      },
      retry: function (name) {
        return 'Retry — ' + name;
      },
      replace: function (name) {
        return 'Replace — ' + name;
      },
      done: 'Done',
      tooLarge: function (size, max) {
        return size + ' — the maximum is ' + max + '. Save it smaller, or upload a portion of it.';
      },
      wrongType: 'This file type is not supported. Choose a different file.',
      uploadFailed: 'The upload failed. Your connection may have dropped — try again.',
      cancelled: function (name) {
        return name + ' cancelled';
      },
      uploaded: function (name) {
        return name + ' uploaded';
      },
      failed: function (name) {
        return name + ' failed';
      },
      summary: function (done, total, failed) {
        var base = done + ' of ' + total + ' file' + (total === 1 ? '' : 's') + ' transferred.';
        return failed ? base + ' ' + failed + ' file' + (failed === 1 ? '' : 's') + ' rejected.' : base;
      },
    },
    de: {
      cancel: function (name) {
        return 'Abbrechen — Übertragung von ' + name;
      },
      retry: function (name) {
        return 'Erneut versuchen — ' + name;
      },
      replace: function (name) {
        return 'Ersetzen — ' + name;
      },
      done: 'Fertig',
      tooLarge: function (size, max) {
        return size + ' — das Maximum sind ' + max + '. Speichern Sie die Datei kleiner, oder laden Sie einen Ausschnitt hoch.';
      },
      wrongType: 'Dieser Dateityp wird nicht unterstützt. Wählen Sie eine andere Datei.',
      uploadFailed: 'Die Übertragung ist fehlgeschlagen. Möglicherweise wurde die Verbindung unterbrochen — versuchen Sie es erneut.',
      cancelled: function (name) {
        return name + ' abgebrochen';
      },
      uploaded: function (name) {
        return name + ' übertragen';
      },
      failed: function (name) {
        return name + ' fehlgeschlagen';
      },
      summary: function (done, total, failed) {
        var base = done + ' von ' + total + ' Datei' + (total === 1 ? '' : 'en') + ' übertragen.';
        if (!failed) return base;
        return (
          base +
          (failed === 1
            ? ' Eine Datei wurde abgelehnt.'
            : ' ' + failed + ' Dateien wurden abgelehnt.')
        );
      },
    },
  };

  function formatSize(bytes) {
    if (DDS.format && DDS.format.fileSize) return DDS.format.fileSize(bytes);
    return Math.round(bytes / 1024) + ' kB';
  }

  var itemSerial = 0;

  /**
   * Turn an upload-flow root into a working per-file upload tracker.
   *
   * @param {HTMLElement} root
   * @param {object} options
   * @param {(file: File, ctx: { signal: AbortSignal, onProgress: (percent: number) => void }) => Promise<void>} options.upload
   * @returns {{ destroy: () => void, addFiles: (files: FileList|File[]) => void }}
   */
  function createUploadFlow(root, options) {
    var config = options || {};
    var words = DDS.utils.wording(root, WORDING);

    var input = root.querySelector('[data-dds-uploadflow-input]') || root.querySelector('input[type="file"]');
    var trigger = root.querySelector('[data-dds-uploadflow-trigger]');
    var summary = root.querySelector('[data-dds-uploadflow-summary]');

    if (!input) {
      console.error('[DDS] upload-flow needs an <input type="file">', root);
      return { destroy: function () {}, addFiles: function () {} };
    }
    if (typeof config.upload !== 'function') {
      console.error('[DDS] upload-flow needs an `upload` function', root);
      return { destroy: function () {}, addFiles: function () {} };
    }

    /**
     * The input starts VISIBLE in markup, not hidden — this is the
     * progressive-enhancement contract, not an accident. A `hidden`
     * baked into the markup up front with only a `type="button"` trigger
     * to reveal it means no JavaScript, no way to reach the input at all:
     * the button does nothing (`type="button"` never submits or acts on
     * its own) and the input stays invisible forever. Hiding it — and
     * handing its job to the trigger — is this file's decision to make,
     * once it knows it can actually wire the two together, not the
     * markup's to assume in advance.
     *
     * A no-JS input inside a real <form> needs a submit button to be
     * reachable at all, and that button becomes wrong the moment this file
     * takes over: every accepted file uploads itself as soon as it is
     * picked, so a leftover "Upload" button either does nothing useful or
     * fires a real form submission (a page navigation) on top of uploads
     * already in flight. Hidden and its default prevented, for the same
     * one reason the input itself is hidden — this is now handled.
     */
    if (trigger) {
      trigger.hidden = false;
      input.hidden = true;
      if (input.form) {
        Array.prototype.slice.call(input.form.querySelectorAll('[type="submit"]')).forEach(function (btn) {
          btn.hidden = true;
        });
        input.form.addEventListener('submit', function (event) {
          event.preventDefault();
        });
      }
    }

    var maxBytes = Number(root.getAttribute('data-dds-uploadflow-max-bytes')) || Infinity;
    var items = []; // { id, file, element, state, controller }
    var replacing = null; // the item the next file picked will replace
    var destroyed = false;

    function accepts(file) {
      var accept = (input.getAttribute('accept') || '').trim();
      if (!accept) return true;

      return accept.split(',').some(function (rule) {
        var pattern = rule.trim().toLowerCase();
        if (!pattern) return false;
        if (pattern.charAt(0) === '.') return file.name.toLowerCase().indexOf(pattern, file.name.length - pattern.length) !== -1;
        if (pattern.slice(-2) === '/*') return file.type.toLowerCase().indexOf(pattern.slice(0, -1)) === 0;
        return file.type.toLowerCase() === pattern;
      });
    }

    function rejectionReason(file) {
      if (file.size > maxBytes) return words.tooLarge(formatSize(file.size), formatSize(maxBytes));
      if (!accepts(file)) return words.wrongType;
      return null;
    }

    function updateSummary() {
      if (!summary) return;
      var done = items.filter(function (i) {
        return i.state === 'done';
      }).length;
      var failed = items.filter(function (i) {
        return i.state === 'failed';
      }).length;
      summary.textContent = items.length ? words.summary(done, items.length, failed) : '';
    }

    /** Builds one item's DOM. The visible content per state is set by `setItemState`. */
    function buildItem(file) {
      itemSerial += 1;
      var element = document.createElement('div');
      element.className = 'dds-uploadflow-item';
      element.dataset.ddsUploadflowId = String(itemSerial);

      var lead = document.createElement('span');
      element.appendChild(lead);

      var meta = document.createElement('span');
      var name = document.createElement('span');
      name.className = 'dds-weight-medium';
      name.textContent = file.name;
      meta.appendChild(name);
      var size = document.createElement('span');
      size.className = 'dds-text-sm dds-text-muted';
      size.textContent = ' · ' + formatSize(file.size);
      meta.appendChild(size);
      element.appendChild(meta);

      var action = document.createElement('span');
      element.appendChild(action);

      return { id: itemSerial, file: file, element: element, lead: lead, action: action, state: null, controller: null };
    }

    function svgIcon(role, color) {
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'dds-icon');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      if (color) svg.style.color = color;
      var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', '#dds-icon-' + role);
      svg.appendChild(use);
      return svg;
    }

    function button(label, handler) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dds-button dds-button-subtle dds-button-sm';
      btn.textContent = label;
      btn.addEventListener('click', handler);
      return btn;
    }

    /**
     * `isRejection` distinguishes two causes that look the same but need
     * different recovery: a client-side rejection (too large, wrong type)
     * will fail again on the identical file, so the only real fix is a
     * different one — "Replace". An upload that failed after being accepted
     * (a dropped connection, a server error) is not about the file at all,
     * so "Retry" re-attempts the SAME one rather than forcing a new pick.
     */
    function setItemState(item, state, reason, isRejection) {
      // Replacing `item.action`'s children below removes whatever button was
      // there — if that button had focus (Cancel, clicked and then the
      // upload finished before the click's own work was done; or simply
      // focus resting there while it completed), the browser drops focus to
      // `<body>` with no error and no visual sign anything happened. Whether
      // focus needs rescuing is decided before the removal, not after.
      var hadFocus = item.element.contains(document.activeElement);
      item.state = state;
      item.element.setAttribute('data-dds-state', state);
      item.lead.replaceChildren();
      item.action.replaceChildren();

      var existingProgress = item.element.querySelector('.dds-uploadflow-progress');
      if (existingProgress) existingProgress.remove();
      var existingReason = item.element.querySelector('.dds-uploadflow-reason');
      if (existingReason) existingReason.remove();

      if (state === 'uploading') {
        var ring = document.createElement('span');
        ring.className = 'dds-progress-ring';
        ring.style.setProperty('--dds-progress-ring-value', '0');
        ring.setAttribute('aria-hidden', 'true');
        item.lead.appendChild(ring);
        item._ring = ring;

        item.action.appendChild(
          button(words.cancel(item.file.name), function () {
            if (item.controller) item.controller.abort();
          })
        );

        var progress = document.createElement('progress');
        progress.className = 'dds-progress dds-uploadflow-progress';
        progress.max = 100;
        progress.value = 0;
        progress.textContent = '0 %';
        item.element.appendChild(progress);
        item._progressEl = progress;
      } else if (state === 'done') {
        item.lead.appendChild(svgIcon('check-circle', 'var(--dds-color-text-success)'));
        var doneLabel = document.createElement('span');
        doneLabel.className = 'dds-text-sm dds-text-success';
        doneLabel.textContent = words.done;
        item.action.appendChild(doneLabel);
      } else if (state === 'failed') {
        item.lead.appendChild(svgIcon('error', 'var(--dds-color-text-error)'));
        item.action.appendChild(
          isRejection
            ? button(words.replace(item.file.name), function () {
                replacing = item;
                input.click();
              })
            : button(words.retry(item.file.name), function () {
                startUpload(item);
              })
        );
        var reasonEl = document.createElement('p');
        reasonEl.className = 'dds-uploadflow-reason';
        reasonEl.textContent = reason || words.uploadFailed;
        item.element.appendChild(reasonEl);
      }

      if (hadFocus) {
        var nextFocusable = item.action.querySelector('button');
        if (nextFocusable) {
          nextFocusable.focus();
        } else {
          // 'done' has no button to hand focus to. The item itself becomes
          // the landing place — tabindex="-1" makes it focusable
          // programmatically without adding a stop to the normal tab order.
          item.element.setAttribute('tabindex', '-1');
          item.element.focus();
        }
      }
    }

    function updateProgress(item, percent) {
      var clamped = Math.max(0, Math.min(100, Math.round(percent)));
      if (item._ring) item._ring.style.setProperty('--dds-progress-ring-value', String(clamped));
      if (item._progressEl) {
        item._progressEl.value = clamped;
        item._progressEl.textContent = clamped + ' %';
      }
    }

    function startUpload(item) {
      item.controller = new AbortController();
      setItemState(item, 'uploading');

      config
        .upload(item.file, {
          signal: item.controller.signal,
          onProgress: function (percent) {
            if (item.state === 'uploading') updateProgress(item, percent);
          },
        })
        .then(function () {
          if (destroyed) return;
          setItemState(item, 'done');
          updateSummary();
          DDS.announce(words.uploaded(item.file.name), { from: root });
        })
        .catch(function (error) {
          if (destroyed) return;
          if (error && error.name === 'AbortError') {
            removeItem(item);
            DDS.announce(words.cancelled(item.file.name), { from: root });
            return;
          }
          setItemState(item, 'failed', words.uploadFailed, false);
          updateSummary();
          DDS.announce(words.failed(item.file.name), { assertive: true, from: root });
        });
    }

    function removeItem(item) {
      items = items.filter(function (i) {
        return i !== item;
      });
      if (item.element.parentNode) item.element.parentNode.removeChild(item.element);
      updateSummary();
    }

    function insertItem(item, before) {
      root.insertBefore(item.element, before || trigger || null);
    }

    function addFiles(fileList) {
      var files = Array.prototype.slice.call(fileList);
      if (!files.length) return;

      files.forEach(function (file) {
        var item = buildItem(file);
        var reason = rejectionReason(file);

        if (replacing) {
          var old = replacing;
          replacing = null;
          insertItem(item, old.element);
          removeItem(old);
        } else {
          insertItem(item);
        }
        // Tracked either way, whether accepted or rejected — a rejected
        // replacement must still be counted, and still be a valid target for
        // a second replace.
        items.push(item);

        if (reason) {
          setItemState(item, 'failed', reason, true);
        } else {
          startUpload(item);
        }
      });

      // Once per batch, after every item in it is tracked — so "X of Y
      // transferred" counts this batch's files from the moment they appear,
      // not only once each one finishes. Per-file updates on completion
      // (inside startUpload) still fire as each one settles.
      updateSummary();
    }

    function handleChange() {
      if (input.files && input.files.length) addFiles(input.files);
      // Reset so choosing the same file again still fires `change`.
      input.value = '';
    }

    function handleTriggerClick() {
      replacing = null;
      input.click();
    }

    input.addEventListener('change', handleChange);
    if (trigger) trigger.addEventListener('click', handleTriggerClick);

    return {
      addFiles: addFiles,
      destroy: function () {
        destroyed = true;
        items.forEach(function (item) {
          if (item.controller) item.controller.abort();
        });
        input.removeEventListener('change', handleChange);
        if (trigger) trigger.removeEventListener('click', handleTriggerClick);
      },
    };
  }

  /**
   * A demonstration `upload` function: no network, resolves after a delay
   * proportional to file size, reporting progress along the way. For the
   * reference page and for prototyping a flow before a real endpoint exists —
   * never for a shipped product, the same role `combobox.js`'s `arraySource`
   * plays for a static list.
   */
  function simulateUpload(file, ctx) {
    return new Promise(function (resolve, reject) {
      var duration = Math.max(600, Math.min(4000, file.size / 2000));
      var start = Date.now();
      var tick;

      function step() {
        if (ctx.signal.aborted) {
          clearInterval(tick);
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          return;
        }
        var elapsed = Date.now() - start;
        var percent = Math.min(100, (elapsed / duration) * 100);
        ctx.onProgress(percent);
        if (percent >= 100) {
          clearInterval(tick);
          resolve();
        }
      }

      tick = setInterval(step, 120);
      ctx.signal.addEventListener('abort', function () {
        clearInterval(tick);
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      });
    });
  }

  DDS.uploadFlow = createUploadFlow;
  DDS.uploadFlow.simulate = simulateUpload;
})(typeof window !== 'undefined' ? window : globalThis);
