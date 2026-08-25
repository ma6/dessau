/**
 * Reference pages — documentation tooling.
 *
 * Not part of DDS. These are the three tools that make the reference pages
 * genuinely useful for reviewing a component rather than just admiring it.
 *
 *   1. Breakpoint preview — a width switcher around a specimen.
 *   2. Variant switch — a segmented control over variants of one component.
 *   3. Code view — the specimen's real markup, generated from the live DOM.
 */
(function (global) {
  'use strict';

  var DDS = global.DDS;

  /**
   * Every breakpoint preview on the page, by its host element.
   *
   * The variant switch needs to reach into the previews it contains, so that a
   * width chosen while looking at one variant is still selected after switching
   * to the next. Kept out of the DOM: a property hung on an element is a second,
   * undocumented API that the next reader has to discover by accident.
   */
  var previews = new WeakMap();

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

    /* What another preview may do to this one, and what this one reports back.
       `onChange` is left null until something links previews together. */
    var api = { select: null, index: WIDTHS.length - 1, onChange: null };

    /**
     * @param {number} index  Into WIDTHS.
     * @param {boolean} [quiet]  Set when the change came from a linked preview,
     *   so answering it does not bounce back and forth.
     */
    function select(index, quiet) {
      var entry = WIDTHS[index];
      api.index = index;
      stage.style.inlineSize = entry.value || '100%';

      buttons.forEach(function (other, position) {
        // `aria-pressed` on a set of toggles: the active one is announced, not
        // merely tinted.
        other.setAttribute('aria-pressed', position === index ? 'true' : 'false');
      });

      // Report the width actually achieved, which differs from the requested one
      // when the available space is smaller. That difference is worth seeing.
      requestAnimationFrame(function () {
        var actual = Math.round(stage.getBoundingClientRect().width);
        readout.textContent = actual + 'px';
      });

      if (!quiet && api.onChange) api.onChange(index);
    }

    api.select = function (index) {
      select(index, true);
    };

    WIDTHS.forEach(function (entry, index) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'dds-button dds-button-subtle dds-button-sm';
      button.textContent = entry.label;
      button.title = entry.title;
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', function () {
        select(index);
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
    select(WIDTHS.length - 1, true);

    // Keep the readout honest when the page itself is resized — and when the
    // preview was hidden inside an inactive variant, where it measured zero.
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(function () {
        readout.textContent = Math.round(stage.getBoundingClientRect().width) + 'px';
      }).observe(stage);
    }

    previews.set(host, api);
  }

  /* =========================================================================
     Variant switch
     =========================================================================
     Markup:
       <div data-ref-variants="Layout">
         <div data-ref-variant="Media end">…</div>
         <div data-ref-variant="Media start">…</div>
         <div data-ref-variant="Media top">…</div>
       </div>

     The attribute on the group names the axis and becomes the legend; the
     attribute on each child is its label — named after the modifier it selects,
     which keeps it short and connects what is on screen to what an author types.

     -----------------------------------------------------------------------
     Why a segmented control, and why not simply stacking them
     -----------------------------------------------------------------------

     `.ref-matrix` already arranges small state variations side by side, and that
     is right for a row of buttons. It is wrong for a variant that is a whole
     layout: three text-media blocks in a column are most of a screen of
     near-identical demo, and the difference between them — the one thing the
     reader came for — is the part that never appears in the same viewport twice.

     A segmented control is what DDS already prescribes for "two to five mutually
     exclusive options, all visible at once", so the reference uses its own
     answer. It is built from radios, which means the keyboard behaviour is the
     platform's and the checked option is announced rather than merely tinted.

     The convention is general: where variants of a component differ in content
     or behaviour, they are switched, not stacked (`agent/conventions.md`).

     -----------------------------------------------------------------------
     Without JavaScript
     -----------------------------------------------------------------------

     Every variant stays visible and CSS captions each one from its own
     attribute. Nothing is hidden until there is a control able to bring it back.

     -----------------------------------------------------------------------
     Why nothing is announced
     -----------------------------------------------------------------------

     The locale switch in `reference.js` calls `DDS.announce` because it re-renders
     a table somewhere else on the page and the control gives no hint of it. Here
     the option's own label — "Media above" — names exactly what is now on screen,
     and the browser announces a radio becoming checked. A live region would say
     the same thing a second time, which is not more accessible, only louder.
     ========================================================================= */

  /** Radio groups need names that cannot collide with another group's. */
  var variantGroups = 0;

  function buildVariantSwitch(host) {
    var panels = Array.prototype.slice.call(host.children).filter(function (child) {
      return child.hasAttribute('data-ref-variant');
    });

    // One variant is not a choice, and a control with a single option is a
    // control that lies about having somewhere to go.
    if (panels.length < 2) return;

    var name = 'ref-variant-' + ++variantGroups;

    var fieldset = document.createElement('fieldset');
    fieldset.className = 'dds-segmented ref-variants-switch';

    var legend = document.createElement('legend');
    legend.className = 'dds-sr-only';
    // Named, or the group is announced as three unrelated radio buttons.
    legend.textContent = host.getAttribute('data-ref-variants') || 'Variant';
    fieldset.appendChild(legend);

    /**
     * @param {number} index
     * @param {Element} [revealed]  A panel the browser is about to show because
     *   find-in-page matched inside it. It must not be hidden again here.
     */
    function show(index, revealed) {
      panels.forEach(function (panel, position) {
        if (position === index || panel === revealed) {
          panel.removeAttribute('hidden');
          return;
        }

        /* The `hidden` attribute, never `display: none` from a class. A variant
           that is out of view must also be out of the tab order, and hiding with
           CSS alone leaves every control inside it as an invisible tab stop —
           the same rule DDS applies to conditional form fields.

           `until-found` so the text inside an inactive variant is still found by
           Ctrl+F and still reachable by a scroll-to-text link. This is
           documentation: find-in-page is how people read it, and three quarters
           of a section being unfindable because a control is set to the wrong
           option is a poor trade for tidiness. It degrades by itself — a browser
           that does not know the value has a `hidden` attribute and hides the
           element outright, which is where this started. */
        panel.setAttribute('hidden', 'until-found');
      });

      /* The code view listens: its sample is the variant on screen, and a stale
         one would offer the markup of a layout nobody is looking at. */
      host.dispatchEvent(new CustomEvent('ref:variantchange', { bubbles: true }));
    }

    panels.forEach(function (panel, index) {
      panel.classList.add('ref-variant');

      var label = document.createElement('label');
      label.className = 'dds-segmented-option';

      var input = document.createElement('input');
      input.type = 'radio';
      input.name = name;
      input.checked = index === 0;

      /* `change`, not `click`: arrow keys move the selection in a radio group
         without a click ever happening, and that is half of why this control is
         built on radios. */
      input.addEventListener('change', function () {
        if (input.checked) show(index);
      });

      /* Find-in-page matched inside this variant, and the browser is about to
         reveal it. Move the control to match, or the page ends up showing one
         variant while the switch says another — the state the `hidden` attribute
         was doing the work of preventing. Fires only where `until-found` is
         supported; where it is not, there is nothing to match. */
      panel.addEventListener('beforematch', function () {
        input.checked = true;
        show(index, panel);
      });

      var text = document.createElement('span');
      text.textContent = panel.getAttribute('data-ref-variant') || 'Variant ' + (index + 1);

      label.appendChild(input);
      label.appendChild(text);
      fieldset.appendChild(label);
    });

    host.insertBefore(fieldset, panels[0]);

    /* Says "a control is now responsible for what is visible", which is what
       lets the stylesheet stop captioning every variant at once. Set before the
       first `show`, so no variant is ever hidden without it. */
    host.setAttribute('data-ref-variants-enhanced', '');
    show(0);

    linkWidths(panels);
  }

  /**
   * Keep the width previews inside one variant group on the same width.
   *
   * Each variant carries its own preview, so without this, switching from one
   * layout to the next at 375px lands back at full width — and the reader has to
   * re-select the width in every variant to compare exactly the thing the
   * variants exist to be compared at.
   */
  function linkWidths(panels) {
    var group = [];

    panels.forEach(function (panel) {
      panel.querySelectorAll('[data-ref-bp]').forEach(function (host) {
        var api = previews.get(host);
        if (api) group.push(api);
      });
    });

    if (group.length < 2) return;

    group.forEach(function (api) {
      api.onChange = function (index) {
        group.forEach(function (other) {
          if (other !== api) other.select(index);
        });
      };
    });
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

     So are elements DDS inserts into authored markup. Those carry
     `data-dds-generated` and the rule is one line, which is the point: it was
     three hand-named special cases, one per component, in a file that knows
     nothing about components — so the lightbox's magnifier badge was offered as
     markup to type, in the specimen of a component whose script generates it
     precisely so that nobody has to (#88). The marker travels with the element
     that needs it. See `agent/conventions.md`.
     ========================================================================= */

  /** Attributes that exist only at runtime and must not appear in a sample. */
  var RUNTIME_ATTRIBUTES = [
    'data-dds-enhanced',
    'aria-activedescendant',
    'data-dds-breadcrumb-hidden',
    'data-dds-charcount-state',
    'data-dds-dragging',
    'data-dds-lightbox-ready',
  ];

  function cleanClone(node) {
    var clone = node.cloneNode(true);

    // Remove runtime-only attributes throughout.
    var all = [clone].concat(Array.prototype.slice.call(clone.querySelectorAll('*')));
    all.forEach(function (element) {
      RUNTIME_ATTRIBUTES.forEach(function (attribute) {
        element.removeAttribute(attribute);
      });
      /* An element DDS made — a magnifier badge, an error message, a rendered
         row. Never one that WRAPS authored markup: those are not marked, because
         removing them would take the author's own content with them. */
      if (element.hasAttribute && element.hasAttribute('data-dds-generated')) {
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
   *
   * Unwrapping has to recurse, because the wrappers nest. A width preview is
   * four levels — host, frame, scroller, stage — and taking one level off left
   * `<div data-ref-bp>` standing as the sample: `cleanClone` then stripped the
   * generated frame out of it as reference-only, and eleven specimens across
   * three pages offered an empty `<div>` as the markup for the component. Every
   * assertion in `tests/codeview.spec.mjs` passed, because an empty div is not
   * blank, carries no `ref-` class and mentions no runtime attribute.
   */
  function componentParts(host) {
    var parts = [];

    Array.prototype.forEach.call(host.children, function (child) {
      /* A variant that is not on show is not the sample. The specimen holds all
         of them; only one of them is what the reader is looking at.

         The ATTRIBUTE, not the `hidden` property: an inactive variant carries
         `hidden="until-found"`, and the property reflects that as a string in
         browsers that support it and as a boolean in browsers that do not. */
      if (child.hasAttribute('data-ref-variant') && child.hasAttribute('hidden')) return;

      if (isReferenceLayout(child)) {
        parts = parts.concat(componentParts(child));
        return;
      }

      // Caption, note, and the code view this function is building.
      if (isReferenceOnly(child)) return;

      parts.push(child);
    });

    return parts;
  }

  /**
   * Reference layout that arranges specimens rather than being one.
   *
   * Both halves matter. The classes are the wrappers the tools generate; the
   * attributes are the hosts an author writes, which carry no class of their own
   * and would otherwise be serialised as though they were the component.
   */
  function isReferenceLayout(element) {
    if (element.hasAttribute('data-ref-bp') || element.hasAttribute('data-ref-variants')) {
      return true;
    }

    return ['ref-matrix', 'ref-bp', 'ref-bp-scroll', 'ref-bp-stage', 'ref-variant'].some(
      function (name) {
        return element.classList.contains(name);
      }
    );
  }

  function isReferenceOnly(element) {
    return Array.prototype.some.call(element.classList, function (name) {
      return name.indexOf('ref-') === 0;
    });
  }

  function buildCodeView(host) {
    if (!componentParts(host).length) return;

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
    var fresh = false;

    function render() {
      // Read the parts now, not once at build time: which of them are the
      // component can change under a variant switch.
      //
      // Each part dedented on its own, then joined: they are siblings, so a
      // shared indent is not a nesting level and would only be noise to delete.
      // textContent, so the markup is displayed rather than parsed.
      code.textContent = componentParts(host)
        .map(function (source) {
          return dedent(cleanClone(source).outerHTML);
        })
        .join('\n');
      fresh = true;
    }

    details.addEventListener('toggle', function () {
      summaryText.textContent = details.open ? 'Hide markup' : 'Show markup';
      if (details.open && !fresh) render();
    });

    /* The visible variant changed, so the sample no longer describes what is on
       screen. Re-read it while open; otherwise mark it stale and let the next
       open pay for it. */
    host.addEventListener('ref:variantchange', function () {
      fresh = false;
      if (details.open) render();
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
    // Then the variant switches, which link the previews they contain — and
    // which decide, by hiding the rest, what the code view has to serialise.
    document.querySelectorAll('[data-ref-variants]').forEach(buildVariantSwitch);
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
