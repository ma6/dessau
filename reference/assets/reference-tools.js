/**
 * Reference pages — documentation tooling.
 *
 * Not part of DDS. These are the two tools that make the reference pages
 * genuinely useful for reviewing a component rather than just admiring it.
 *
 *   1. Breakpoint preview — a width switcher around a specimen.
 *   2. Code view — the specimen's real markup, generated from the live DOM.
 */
(function (global) {
  'use strict';

  var DDS = global.DDS;

  /* =========================================================================
     Breakpoint preview
     =========================================================================
     Markup:
       <div data-ref-bp>
         <div class="…the component…"></div>
       </div>

     The toolbar, scroller and stage are generated, so adding a preview to a
     specimen is one attribute rather than five nested elements to keep in sync.

     -----------------------------------------------------------------------
     Why this only works with container queries
     -----------------------------------------------------------------------

     The stage is narrowed with `inline-size`. A component whose layout comes
     from `@container` measures the stage and responds. A component using
     `@media` measures the browser window, which has not changed — so the
     buttons appear to do nothing at all.

     That is the practical reason DDS requires container queries for anything
     with layout-shifting behaviour, and why `scripts/check-css.mjs` reports a
     named `@container` query with no matching `container-name`: without the
     name, the query never matches and the component silently stays in its
     narrow form at every width.
     ========================================================================= */

  var WIDTHS = [
    { label: '375', value: '375px', title: 'Narrow phone' },
    { label: '480', value: '480px', title: 'Large phone' },
    { label: '768', value: '768px', title: 'Tablet' },
    { label: '1024', value: '1024px', title: 'Small laptop' },
    { label: '1280', value: '1280px', title: 'Desktop' },
    { label: 'Full', value: '', title: 'Full available width' },
  ];

  function buildBreakpointPreview(host) {
    // Take the specimen out first, so it can be moved into the stage without
    // being cloned — a clone would break any behaviour already attached to it.
    var content = Array.prototype.slice.call(host.childNodes);

    var wrapper = document.createElement('div');
    wrapper.className = 'ref-bp';

    var toolbar = document.createElement('div');
    toolbar.className = 'ref-bp-toolbar';
    // A group of related controls needs a name, or the buttons are announced as
    // six unlabelled numbers.
    toolbar.setAttribute('role', 'group');
    toolbar.setAttribute('aria-label', 'Preview width');

    var label = document.createElement('span');
    label.className = 'ref-bp-toolbar-label';
    label.textContent = 'Width';
    toolbar.appendChild(label);

    var scroll = document.createElement('div');
    scroll.className = 'ref-bp-scroll';
    // A scrollable region must be reachable by keyboard, and named so the tab
    // stop announces what it is.
    scroll.tabIndex = 0;
    scroll.setAttribute('role', 'region');
    scroll.setAttribute('aria-label', 'Component preview');

    var stage = document.createElement('div');
    stage.className = 'ref-bp-stage';
    content.forEach(function (node) {
      stage.appendChild(node);
    });
    scroll.appendChild(stage);

    var readout = document.createElement('span');
    readout.className = 'ref-bp-readout';
    // Live, so the measured width is announced when it changes rather than only
    // being visible.
    readout.setAttribute('role', 'status');

    var buttons = [];

    function select(entry, button) {
      stage.style.inlineSize = entry.value || '100%';

      buttons.forEach(function (other) {
        // `aria-pressed` on a set of toggles: the active one is announced, not
        // merely tinted.
        other.setAttribute('aria-pressed', other === button ? 'true' : 'false');
      });

      // Report the width actually achieved, which differs from the requested one
      // when the available space is smaller. That difference is worth seeing.
      requestAnimationFrame(function () {
        var actual = Math.round(stage.getBoundingClientRect().width);
        readout.textContent = actual + 'px';
      });
    }

    WIDTHS.forEach(function (entry, index) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'dds-button dds-button-subtle dds-button-sm';
      button.textContent = entry.label;
      button.title = entry.title;
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', function () {
        select(entry, button);
      });
      buttons.push(button);
      toolbar.appendChild(button);
    });

    toolbar.appendChild(readout);

    wrapper.appendChild(toolbar);
    wrapper.appendChild(scroll);
    host.appendChild(wrapper);

    // Start at full width: the specimen should look normal before anyone touches
    // the controls.
    var full = WIDTHS[WIDTHS.length - 1];
    select(full, buttons[buttons.length - 1]);

    // Keep the readout honest when the page itself is resized.
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(function () {
        readout.textContent = Math.round(stage.getBoundingClientRect().width) + 'px';
      }).observe(stage);
    }
  }

  /* =========================================================================
     Code view
     =========================================================================
     Markup:
       <div class="ref-specimen" data-ref-code>
         <p class="ref-specimen-label">…</p>     ← skipped, reference-only
         <div class="…the component…"></div>     ← this, and any sibling like it
         <p class="ref-note">…</p>               ← skipped, reference-only
       </div>

     The markup is read from the live DOM and cleaned up, rather than being
     written out by hand beside the demo.

     Two sources of truth is one too many, and the copy is always the one that
     goes stale — usually in the ARIA attributes, which is precisely the part
     somebody will copy without checking. Generating it means the sample cannot
     be wrong.

     Attributes added at runtime by DDS (`data-dds-enhanced`, and the ARIA that
     `combobox.js` applies) are stripped, because they are not what an author
     writes. Showing them would suggest they have to be typed by hand.
     ========================================================================= */

  /** Attributes that exist only at runtime and must not appear in a sample. */
  var RUNTIME_ATTRIBUTES = [
    'data-dds-enhanced',
    'aria-activedescendant',
    'data-dds-charcount-state',
    'data-dds-dragging',
  ];

  function cleanClone(node) {
    var clone = node.cloneNode(true);

    // Remove runtime-only attributes throughout.
    var all = [clone].concat(Array.prototype.slice.call(clone.querySelectorAll('*')));
    all.forEach(function (element) {
      RUNTIME_ATTRIBUTES.forEach(function (attribute) {
        element.removeAttribute(attribute);
      });
      // Elements generated wholly at runtime (an error message, a rendered
      // option) are not authored markup.
      if (element.hasAttribute && element.hasAttribute('data-dds-error-for')) {
        element.remove();
      }
      // Neither is reference-only markup that sits *inside* a specimen — a
      // cluster of variants captions each one. Skipping it at the top level and
      // then serialising it from one level down would put the class into the
      // sample by the back door.
      if (element !== clone && isReferenceOnly(element)) {
        element.remove();
      }
    });

    // A rendered suggestion list is runtime output, not markup.
    clone.querySelectorAll('.dds-combobox-list').forEach(function (list) {
      list.replaceChildren();
      list.hidden = true;
      list.removeAttribute('aria-label');
      list.removeAttribute('aria-labelledby');
      // These are applied by combobox.js.
      list.removeAttribute('id');
    });

    clone.querySelectorAll('[role="combobox"]').forEach(function (input) {
      ['role', 'aria-expanded', 'aria-controls', 'aria-autocomplete', 'spellcheck'].forEach(
        function (attribute) {
          input.removeAttribute(attribute);
        }
      );
    });

    return clone;
  }

  /**
   * Re-indent serialised HTML.
   *
   * `outerHTML` preserves the source's own indentation, which is relative to
   * wherever the element sat in the page — so a deeply nested specimen comes out
   * indented by ten levels. Normalising means removing the common leading
   * whitespace rather than reformatting, which would risk changing meaning
   * inside `<pre>` or between inline elements.
   */
  function dedent(html) {
    var lines = html.replace(/\t/g, '  ').split('\n');

    // Drop leading and trailing blank lines.
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();

    /* The first line is excluded from the measurement and from the cut.
       `outerHTML` begins *at* the element, so that line has already lost its
       indentation while every line after it has kept the source's — measuring
       across all of them therefore always finds a common indent of zero and
       removes nothing. The bug was invisible for as long as the only thing this
       ever serialised was a single-line caption. */
    var indents = lines
      .slice(1)
      .filter(function (line) {
        return line.trim();
      })
      .map(function (line) {
        return line.match(/^ */)[0].length;
      });

    var common = indents.length ? Math.min.apply(null, indents) : 0;

    return lines
      .map(function (line, index) {
        return index === 0 ? line : line.slice(common);
      })
      .join('\n');
  }

  /**
   * The elements of a specimen that are the component.
   *
   * A specimen is not just its component: it opens with a caption, it usually
   * ends with a note, and it may demonstrate several elements at once — a
   * divider between two paragraphs, a button and the dialog it opens. Taking the
   * first child assumed a shape that most specimens on the reference do not
   * have, and quietly offered the caption as the markup for the component.
   *
   * So the rule is by role, not by position, and it follows the convention that
   * already exists: `ref-` is reference-only (`agent/conventions.md`). Anything
   * carrying it is either scaffolding to skip or a layout wrapper to unwrap, and
   * everything else is what an author would write.
   */
  function componentParts(host) {
    var parts = [];

    Array.prototype.forEach.call(host.children, function (child) {
      // Reference layout that exists to arrange several variants side by side.
      // The variants are the sample; the grid holding them is not.
      if (child.classList.contains('ref-matrix') || child.classList.contains('ref-bp-stage')) {
        parts = parts.concat(Array.prototype.slice.call(child.children));
        return;
      }
      // Caption, note, and the code view this function is building.
      if (isReferenceOnly(child)) return;

      parts.push(child);
    });

    return parts;
  }

  function isReferenceOnly(element) {
    return Array.prototype.some.call(element.classList, function (name) {
      return name.indexOf('ref-') === 0;
    });
  }

  function buildCodeView(host) {
    var sources = componentParts(host);
    if (!sources.length) return;

    var details = document.createElement('details');
    details.className = 'ref-codeview';

    var summary = document.createElement('summary');
    var summaryText = document.createElement('span');
    summaryText.textContent = 'Show markup';
    summary.appendChild(summaryText);

    var marker = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    marker.setAttribute('class', 'dds-icon ref-codeview-marker');
    marker.setAttribute('aria-hidden', 'true');
    var markerUse = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    markerUse.setAttribute('href', '#dds-icon-chevron-down');
    marker.appendChild(markerUse);
    summary.appendChild(marker);

    details.appendChild(summary);

    var body = document.createElement('div');
    body.className = 'ref-codeview-body';

    var pre = document.createElement('pre');
    // A scrollable region needs a tab stop and a name.
    pre.tabIndex = 0;
    pre.setAttribute('role', 'region');
    pre.setAttribute('aria-label', 'Component markup');

    var code = document.createElement('code');
    // Serialised on open rather than up front: reading `outerHTML` for every
    // specimen on a long page is work nobody asked for.
    var serialised = null;

    details.addEventListener('toggle', function () {
      if (!details.open || serialised !== null) return;
      // Each part dedented on its own, then joined: they are siblings, so a
      // shared indent is not a nesting level and would only be noise to delete.
      serialised = sources
        .map(function (source) {
          return dedent(cleanClone(source).outerHTML);
        })
        .join('\n');
      // textContent, so the markup is displayed rather than parsed.
      code.textContent = serialised;
      summaryText.textContent = 'Hide markup';
    });

    details.addEventListener('toggle', function () {
      if (!details.open) summaryText.textContent = 'Show markup';
      else summaryText.textContent = 'Hide markup';
    });

    pre.appendChild(code);
    body.appendChild(pre);

    var actions = document.createElement('div');
    actions.className = 'ref-codeview-actions';

    var copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'dds-button dds-button-subtle dds-button-sm';
    copy.textContent = 'Copy markup';
    copy.addEventListener('click', function () {
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(code.textContent).then(
        function () {
          if (DDS) {
            DDS.announce('Markup copied to clipboard');
            if (DDS.toast) DDS.toast('Markup copied', { kind: 'success', duration: 2000 });
          }
        },
        function () {
          if (DDS) DDS.announce('Could not copy. Select the markup and copy it manually.', { assertive: true });
        }
      );
    });

    if (!navigator.clipboard) copy.hidden = true;
    actions.appendChild(copy);
    body.appendChild(actions);

    details.appendChild(body);
    host.appendChild(details);
  }

  /* ------------------------------------------------------------------- init */

  function init() {
    // Breakpoint previews first: they move the specimen into a stage, and the
    // code view must serialise from wherever the specimen actually ends up.
    document.querySelectorAll('[data-ref-bp]').forEach(buildBreakpointPreview);
    document.querySelectorAll('[data-ref-code]').forEach(buildCodeView);
  }

  /* DOMContentLoaded, not `readyState === 'loading'` — a deferred script is
     already past `"loading"` when it runs. See the note in reference.js. */
  if (document.readyState === 'complete') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  }
})(typeof window !== 'undefined' ? window : globalThis);
