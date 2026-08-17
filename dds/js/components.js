/**
 * DDS — component behaviour.
 *
 *   <script src="/dds/js/dds.js" defer></script>
 *   <script src="/dds/js/components.js" defer></script>
 *
 * Load after dds.js. Optional: a product that builds its own behaviour can skip
 * this file entirely and keep the same markup and CSS.
 *
 * Everything here is behaviour the platform does NOT already provide. Anything
 * the platform does provide is left alone, which is why there is no accordion
 * (`<details name>`), no disclosure toggle (`<details>`), no focus trap
 * (`showModal()`), and no validation engine (constraint validation API).
 *
 * Contents: dialog opener · tabs · toast · copy-to-clipboard · table
 */
(function (global) {
  'use strict';

  var DDS = global.DDS;
  if (!DDS) {
    console.error('[DDS] components.js requires dds.js to be loaded first');
    return;
  }

  /* =========================================================================
     Dialog opener
     =========================================================================
     Markup:
       <button data-dds-dialog-open="my-dialog">Open</button>
       <dialog id="my-dialog" class="dds-dialog" aria-labelledby="my-dialog-title">
         ...
         <button data-dds-dialog-close>Cancel</button>
       </dialog>

     `showModal()` is what does the real work: it moves focus into the dialog,
     makes everything behind it inert, closes on Escape, renders in the top layer
     so no `overflow: hidden` ancestor can clip it, and returns focus to the
     opener on close. None of that is reimplemented here.

     What is added: scroll locking (the page behind a modal should not scroll)
     and the declarative open/close attributes.
     ========================================================================= */

  var SCROLL_LOCK_CLASS = 'dds-scroll-locked';
  var openDialogCount = 0;

  function lockScroll() {
    openDialogCount += 1;
    document.documentElement.classList.add(SCROLL_LOCK_CLASS);
  }

  function unlockScroll() {
    openDialogCount = Math.max(0, openDialogCount - 1);
    // Only release when the last dialog closes — a dialog opened from a dialog
    // would otherwise unlock the page while one is still open.
    if (openDialogCount === 0) {
      document.documentElement.classList.remove(SCROLL_LOCK_CLASS);
    }
  }

  DDS.register('dialog-open', '[data-dds-dialog-open]', function (trigger) {
    trigger.addEventListener('click', function () {
      var id = trigger.getAttribute('data-dds-dialog-open');
      var dialog = document.getElementById(id);

      if (!dialog) {
        console.error('[DDS] no dialog found with id "' + id + '"');
        return;
      }
      if (typeof dialog.showModal !== 'function') {
        console.error('[DDS] element is not a <dialog>', dialog);
        return;
      }

      lockScroll();
      dialog.showModal();
    });
  });

  DDS.register('dialog', 'dialog.dds-dialog', function (dialog) {
    // Release the lock however the dialog closed: a close button, Escape, a
    // form submit, or `close()` from application code.
    dialog.addEventListener('close', unlockScroll);

    /* Light dismiss belongs to `closedby="any"` in the markup, not to this file.
       The browser compares the press and the release, so a drag that starts
       inside the dialog and ends on the backdrop — a text selection that
       overshoots — does not close it.

       Safari has no `closedby` yet, so the fallback below runs there and nowhere
       else. It has to answer the same question by hand, and the hand-written
       version this replaces got it wrong: `click` fires with the dialog as its
       target for a backdrop click, but ALSO when a press begins on a child and
       the release lands outside, because the event goes to the common ancestor.
       Closing on that throws away whatever the user was in the middle of.

       So the press is recorded and a release only counts when both ends were the
       backdrop. A keyboard activation cannot reach this: `event.target` is only
       the dialog itself for a pointer landing outside the panel. */
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      var pressedBackdrop = false;

      dialog.addEventListener('pointerdown', function (event) {
        pressedBackdrop = event.target === dialog;
      });

      dialog.addEventListener('click', function (event) {
        if (event.target === dialog && pressedBackdrop) dialog.close('dismiss');
        pressedBackdrop = false;
      });
    }

    dialog.querySelectorAll('[data-dds-dialog-close]').forEach(function (button) {
      button.addEventListener('click', function () {
        dialog.close(button.getAttribute('data-dds-dialog-close') || 'close');
      });
    });
  });

  /* =========================================================================
     Tabs
     =========================================================================
     Markup:
       <div class="dds-tabs" data-dds-tabs>
         <div class="dds-tablist" role="tablist" aria-label="Sections">
           <button class="dds-tab" role="tab" id="t1" aria-controls="p1">One</button>
           <button class="dds-tab" role="tab" id="t2" aria-controls="p2">Two</button>
         </div>
         <div id="p1" role="tabpanel" aria-labelledby="t1" tabindex="0">…</div>
         <div id="p2" role="tabpanel" aria-labelledby="t2" tabindex="0" hidden>…</div>
       </div>

     Implements the ARIA tabs pattern:
      - A roving tabindex: the tablist is ONE tab stop, not one per tab. Tab
        enters the list and Tab again leaves it for the panel; arrow keys move
        between tabs. A list of nine tabs must not cost nine presses to pass.
      - Home/End jump to the ends.
      - Selection follows focus, which is correct when switching is cheap and
        reversible.

     `aria-selected` and `hidden` are the state — read from and written to the
     DOM, so the visual state and the announced state cannot drift apart.
     ========================================================================= */

  DDS.register('tabs', '[data-dds-tabs]', function (root) {
    var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
    if (!tabs.length) return;

    function panelFor(tab) {
      var id = tab.getAttribute('aria-controls');
      return id ? document.getElementById(id) : null;
    }

    function select(tab, moveFocus) {
      tabs.forEach(function (candidate) {
        var isSelected = candidate === tab;
        candidate.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        // Only the selected tab is reachable with Tab.
        candidate.tabIndex = isSelected ? 0 : -1;

        var panel = panelFor(candidate);
        if (panel) panel.hidden = !isSelected;
      });

      if (moveFocus) tab.focus();
    }

    // Establish the initial state from the markup rather than assuming the
    // first tab: a server may have rendered a different one as selected.
    var initial = tabs.filter(function (tab) {
      return tab.getAttribute('aria-selected') === 'true';
    })[0] || tabs[0];
    select(initial, false);

    tabs.forEach(function (tab, index) {
      tab.addEventListener('click', function () {
        select(tab, false);
      });

      tab.addEventListener('keydown', function (event) {
        var target = null;

        switch (event.key) {
          // Wrap around at both ends: reaching the last tab and pressing Right
          // should not simply stop.
          case 'ArrowRight':
            target = tabs[(index + 1) % tabs.length];
            break;
          case 'ArrowLeft':
            target = tabs[(index - 1 + tabs.length) % tabs.length];
            break;
          case 'Home':
            target = tabs[0];
            break;
          case 'End':
            target = tabs[tabs.length - 1];
            break;
          default:
            return;
        }

        // Only prevent default once a key is actually handled, so an unrelated
        // shortcut still reaches the browser.
        event.preventDefault();
        select(target, true);
      });
    });
  });

  /* =========================================================================
     Toast
     =========================================================================
       DDS.toast('Draft saved');
       DDS.toast('Could not save', { kind: 'error', duration: 8000 });

     A toast is for confirming something that already happened. It must never
     be the only place important information lives, and it must never contain
     the only route to an action: it disappears on a timer, which excludes
     anyone reading slowly, magnifying the screen, or away from the keyboard.

     The region is `role="status"` (polite), so a toast never interrupts. The
     timer pauses on hover and on focus, because a message that vanishes while
     being read or while its close button has focus is a trap.
     ========================================================================= */

  var TOAST_ICONS = {
    success: 'dds-icon-check-circle',
    warning: 'dds-icon-warning',
    error: 'dds-icon-error',
    info: 'dds-icon-info',
  };

  // A visible word per kind, so the meaning does not depend on the icon shape
  // or the fill colour.
  var TOAST_PREFIX = {
    success: 'Success',
    warning: 'Warning',
    error: 'Error',
    info: 'Information',
  };

  function createToastRegion() {
    var region = document.createElement('div');
    region.className = 'dds-toast-region';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    // Read only what was added, not the whole stack again.
    region.setAttribute('aria-atomic', 'false');
    return region;
  }

  /**
   * Where the next toast goes.
   *
   * A modal `<dialog>` always outranks ordinary top-layer content, and that
   * includes a `popover="manual"` region — measured directly, not assumed
   * (#115, DECISIONS.md #047). Nothing outside an open dialog can be made to
   * render above it, so a toast fired while one is open has to become part of
   * the dialog's own top-layer box instead: appended inside it, not beside it.
   *
   * `dialog:modal` rather than tracking open state by hand — it is exactly
   * the browser's own answer to "is a dialog currently blocking the page",
   * and it is false the instant `close()` runs.
   *
   * Scoped with `:scope >` deliberately: `document.body.querySelector
   * ('.dds-toast-region')` would find a dialog's own nested region too, since
   * a dialog is inside body's subtree — which would hand a body-level toast
   * to a dialog-scoped region, or the reverse, depending on DOM order rather
   * than on where the toast was actually meant to appear.
   *
   * A toast already showing at body level when a dialog opens over it is not
   * moved — it stays exactly where the bug already left it, invisible until
   * the dialog closes. Reparenting an in-flight toast is a different problem
   * (its dismiss timer, its announcement, whether moving it counts as a new
   * announcement) than the one this fixes: a toast created while a dialog is
   * already open, which is the reported case (#115) and the common one.
   */
  function getToastRegion() {
    var openDialog = document.querySelector('dialog:modal');
    var host = openDialog || document.body;

    var region = host.querySelector(':scope > .dds-toast-region');
    if (!region) {
      region = createToastRegion();
      host.appendChild(region);
    }

    return region;
  }

  /**
   * Show a toast.
   *
   * @param {string} message
   * @param {{ kind?: 'success'|'warning'|'error'|'info', duration?: number }} [options]
   * @returns {HTMLElement} the toast, so a caller can dismiss it early.
   */
  /**
   * Toast wording. One string: the message itself comes from the caller, which
   * is the application, which knows its own language.
   */
  var TOAST_WORDING = {
    en: { dismiss: 'Dismiss message' },
    de: { dismiss: 'Meldung schließen' },
  };

  function toast(message, options) {
    var opts = options || {};
    var kind = TOAST_ICONS[opts.kind] ? opts.kind : 'info';
    var duration = typeof opts.duration === 'number' ? opts.duration : 5000;

    var element = document.createElement('div');
    element.className = 'dds-toast dds-toast-' + kind;

    var icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('class', 'dds-icon');
    icon.setAttribute('aria-hidden', 'true');
    var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#' + TOAST_ICONS[kind]);
    icon.appendChild(use);
    element.appendChild(icon);

    // The kind, in words, for anyone who does not see the colour or the icon.
    var prefix = document.createElement('span');
    prefix.className = 'dds-sr-only';
    prefix.textContent = TOAST_PREFIX[kind] + ': ';
    element.appendChild(prefix);

    var text = document.createElement('span');
    // textContent, not innerHTML: a toast frequently carries a value that came
    // from outside the application.
    text.textContent = message;
    element.appendChild(text);

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'dds-toast-close';
    /* The toast region is appended to `<body>` and so has no language of its
       own. `documentElement` is the right answer here and only here: a toast is
       raised by the application about the page as a whole, not from inside a
       region that might be in another language. */
    close.setAttribute(
      'aria-label',
      DDS.utils.wording(document.documentElement, TOAST_WORDING).dismiss
    );
    var closeIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    closeIcon.setAttribute('class', 'dds-icon');
    closeIcon.setAttribute('aria-hidden', 'true');
    var closeUse = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    closeUse.setAttribute('href', '#dds-icon-close');
    closeIcon.appendChild(closeUse);
    close.appendChild(closeIcon);
    element.appendChild(close);

    getToastRegion().appendChild(element);

    var timer = null;

    function dismiss() {
      clearTimeout(timer);
      element.remove();
    }

    function startTimer() {
      // `duration: 0` means "stay until dismissed" — the right choice for
      // anything the user genuinely needs to read.
      if (duration > 0) timer = setTimeout(dismiss, duration);
    }

    function pauseTimer() {
      clearTimeout(timer);
    }

    startTimer();

    element.addEventListener('mouseenter', pauseTimer);
    element.addEventListener('mouseleave', startTimer);
    // focusin/focusout rather than focus: the close button inside is what
    // receives focus, and focus does not bubble.
    element.addEventListener('focusin', pauseTimer);
    element.addEventListener('focusout', startTimer);
    close.addEventListener('click', dismiss);

    return element;
  }

  DDS.toast = toast;

  /* =========================================================================
     Copy to clipboard
     =========================================================================
     Markup:
       <button data-dds-copy="#reference-value">Copy</button>

     Small, but it is the kind of thing every product rebuilds badly. The part
     usually missed: confirming that it worked. A button that silently succeeds
     leaves the user unsure whether to press it again.
     ========================================================================= */

  /**
   * Copy-button wording.
   *
   * The failure has two strings, not one, and they are different lengths on
   * purpose: the toast is a glance and the announcement has to say what to do
   * instead. A copy that silently did nothing is the worst outcome here, because
   * the user walks away believing they have the value.
   */
  var COPY_WORDING = {
    en: {
      copied: 'Copied to clipboard',
      failedAnnouncement: 'Could not copy. Select the text and copy it manually.',
      failedToast: 'Could not copy automatically',
    },
    de: {
      copied: 'In die Zwischenablage kopiert',
      failedAnnouncement:
        'Kopieren nicht möglich. Markieren Sie den Text und kopieren Sie ihn selbst.',
      failedToast: 'Automatisches Kopieren nicht möglich',
    },
  };

  DDS.register('copy', '[data-dds-copy]', function (button) {
    // No async clipboard API means no reliable copy. Rather than a button that
    // does nothing, remove it and let the user select the text themselves.
    if (!navigator.clipboard) {
      button.hidden = true;
      return;
    }

    button.addEventListener('click', function () {
      var selector = button.getAttribute('data-dds-copy');
      var source = document.querySelector(selector);
      if (!source) return;

      var value = 'value' in source ? source.value : source.textContent;

      var words = DDS.utils.wording(button, COPY_WORDING);

      navigator.clipboard.writeText(String(value).trim()).then(
        function () {
          DDS.announce(words.copied, { from: button });
          toast(words.copied, { kind: 'success', duration: 2500 });
        },
        function () {
          // Denied permission, or a non-secure context.
          DDS.announce(words.failedAnnouncement, { assertive: true, from: button });
          toast(words.failedToast, { kind: 'error' });
        }
      );
    });
  });

  /* =========================================================================
     Table — the scroll region, and knowing there is more of it
     =========================================================================
     Markup, unchanged and still the contract:

       <div class="dds-table-wrap" role="region" aria-labelledby="cap" tabindex="0">
         <table class="dds-table"><caption id="cap">…</caption>…</table>
       </div>

     Two things are added here, and neither is what makes a table work.

     1. A missing wrapper is built. The wrapper is documented as not optional and
        it is still the markup a product should write — but "not optional" was
        enforced by nothing, and twelve of the fourteen tables in this
        repository's own reference had no wrapper on the day this was written.
        A rule that lives only in a comment holds until the first hurry. So the
        rule is now checked (scripts/check-reference.mjs, for this repository)
        AND repaired at runtime (here, for everyone else).

        Before this runs, an unwrapped table overflows — but since the layout
        primitives stopped amplifying it (#79), it overflows ITSELF rather than
        widening the page around it. That is the difference between one awkward
        table and a page laid out three times too wide.

     2. The reader is told when content continues past an edge. On a phone there
        is no scrollbar until a finger moves, so a table that scrolls and a table
        that is cut off look exactly alike — and "cut off" is what a reader
        assumes, because it is the more common defect. `data-dds-scroll` carries
        `start`, `end`, both or neither, and the CSS draws a shadow at those
        edges.

     Why an attribute and a listener rather than pure CSS: the background-layer
     trick paints BEHIND the table, so a header row or a zebra stripe hides it,
     and `container-type: scroll-state` is Chromium-only — which is precisely
     the engine where the problem is least visible. This is behaviour the
     platform does not yet provide portably, which is the bar for putting it in
     JavaScript at all.
     ========================================================================= */

  /** Does this element sit inside something that is only for screen readers? */
  function isVisuallyHidden(element) {
    return !!element.closest('.dds-sr-only, [hidden]');
  }

  /**
   * The wrapper, built to the documented contract.
   *
   * Named from the caption, because a table's caption IS its name and a region
   * without one is announced as "region" — a landmark that tells you nothing is
   * worse than the tab stop it costs.
   */
  function wrapTable(table) {
    var wrap = document.createElement('div');
    wrap.className = 'dds-table-wrap';
    wrap.setAttribute('tabindex', '0');

    var caption = table.querySelector('caption');
    if (caption) {
      if (!caption.id) caption.id = DDS.utils.uniqueId('dds-table-caption');
      wrap.setAttribute('role', 'region');
      wrap.setAttribute('aria-labelledby', caption.id);
    }
    // No caption: no name, so no landmark either. `role="region"` without an
    // accessible name is dropped by screen readers anyway, and claiming one is
    // worse than not claiming it. The region still scrolls and is still
    // focusable, which is what keeps the content reachable.

    table.parentNode.insertBefore(wrap, table);
    wrap.appendChild(table);
    return wrap;
  }

  DDS.register('table', 'table.dds-table', function (table) {
    // A table that is deliberately off-screen — the data behind a chart — is
    // never scrolled and must not gain a visible frame or a tab stop.
    if (isVisuallyHidden(table)) return;

    var wrap = table.parentElement;
    if (!wrap || !wrap.classList.contains('dds-table-wrap')) {
      wrap = wrapTable(table);
    }

    /* The shadows cannot live on the scroll container itself: its own
       background paints behind the table, and anything absolutely positioned
       inside a scroller scrolls away with the content. So the frame is a second,
       non-scrolling box around it — the same frame/inner split the container
       queries use elsewhere in DDS, for the same structural reason. */
    var frame = wrap.parentElement;
    if (!frame || !frame.classList.contains('dds-table-frame')) {
      frame = document.createElement('div');
      frame.className = 'dds-table-frame';
      wrap.parentNode.insertBefore(frame, wrap);
      frame.appendChild(wrap);
    }

    function update() {
      /* `scrollLeft` is negative in a right-to-left scroller and positive in a
         left-to-right one, so the distance travelled is its magnitude either
         way. Reading it as a signed number is the classic RTL bug here. */
      var travelled = Math.abs(wrap.scrollLeft);
      var remaining = wrap.scrollWidth - wrap.clientWidth - travelled;

      // A pixel of tolerance: fractional layout sizes mean an unscrollable
      // region routinely reports a remainder of 0.5px, which would leave a
      // shadow permanently on and make it mean nothing.
      var edges = [];
      if (travelled > 1) edges.push('start');
      if (remaining > 1) edges.push('end');

      if (edges.length) {
        frame.setAttribute('data-dds-scroll', edges.join(' '));
      } else {
        frame.removeAttribute('data-dds-scroll');
      }
    }

    wrap.addEventListener('scroll', update, { passive: true });

    /* Width changes with no scroll event: the window resizes, a column's content
       loads, a container query reshapes something above. `ResizeObserver` sees
       all three; a resize listener sees only the first. */
    if (typeof ResizeObserver === 'function') {
      var observer = new ResizeObserver(update);
      observer.observe(wrap);
      observer.observe(table);
    } else {
      global.addEventListener('resize', DDS.utils.debounce(update, 100));
    }

    update();
  });
})(typeof window !== 'undefined' ? window : globalThis);
