/**
 * Reference pages — specimen rendering and demo wiring.
 *
 * Not part of DDS. This file only exists to document DDS.
 *
 * The important idea: every specimen reads its value from the LIVE computed
 * style, never from a copy written into this file. A swatch labelled
 * `--dds-color-action-primary` shows whatever that custom property currently
 * resolves to, and the contrast badge next to it is computed from that same
 * value at render time.
 *
 * That makes drift between the documentation and the implementation structurally
 * impossible rather than merely discouraged — which matters, because a design
 * system's documentation is only trusted for as long as it has never been wrong.
 */
(function (global) {
  'use strict';

  var DDS = global.DDS;

  /* =========================================================================
     Reading values
     ========================================================================= */

  function tokenValue(name, element) {
    return getComputedStyle(element || document.documentElement)
      .getPropertyValue(name)
      .trim();
  }

  /**
   * Resolve any CSS colour to [r, g, b].
   *
   * Rather than parsing every colour syntax by hand, the browser is asked: the
   * value is assigned to an element and the computed style is read back, which
   * always comes out as `rgb()` or `rgba()`. That means `color-mix()`, `oklch()`,
   * named colours and hex all work with no parser to maintain.
   */
  var probe = null;
  function toRgb(cssColor) {
    if (!probe) {
      probe = document.createElement('span');
      probe.style.display = 'none';
      document.body.appendChild(probe);
    }
    probe.style.color = '';
    probe.style.color = cssColor;
    var computed = getComputedStyle(probe).color;
    var match = computed.match(/-?[\d.]+/g);
    if (!match) return null;
    return [Number(match[0]), Number(match[1]), Number(match[2])];
  }

  function luminance(rgb) {
    var linear = rgb
      .map(function (channel) {
        return channel / 255;
      })
      .map(function (channel) {
        return channel <= 0.03928
          ? channel / 12.92
          : Math.pow((channel + 0.055) / 1.055, 2.4);
      });
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  }

  function contrastRatio(foreground, background) {
    var a = luminance(foreground);
    var b = luminance(background);
    var lighter = Math.max(a, b);
    var darker = Math.min(a, b);
    return (lighter + 0.05) / (darker + 0.05);
  }

  /* =========================================================================
     Colour swatches
     =========================================================================
     Markup:
       <div class="ref-swatches" data-ref-swatches='["--dds-color-…", …]'
            data-ref-swatch-on="--dds-color-surface-default"></div>

     `data-ref-swatch-on` names the surface the contrast badge is computed
     against, so the number shown is the one that actually matters for that
     token's role rather than a generic figure against white.
  */
  function renderSwatches(container) {
    var names;
    try {
      names = JSON.parse(container.getAttribute('data-ref-swatches'));
    } catch (error) {
      console.error('[reference] bad swatch list', error, container);
      return;
    }

    var against = container.getAttribute('data-ref-swatch-on');
    var minRatio = Number(container.getAttribute('data-ref-swatch-min') || 4.5);

    // The surface is resolved inside the same subtree, so a forced-theme panel
    // compares against its own surface rather than the page's.
    var backgroundRgb = against ? toRgb(tokenValue(against, container)) : null;

    container.replaceChildren();

    names.forEach(function (name) {
      var value = tokenValue(name, container);

      var swatch = document.createElement('div');
      swatch.className = 'ref-swatch';

      /* Same failure as the rulers: an unresolved custom property is an empty string,
         which is a valid colour layer that paints nothing — so the chip would show the
         chequerboard and read as "this token is transparent" rather than as "this token
         is not there". */
      if (!value) {
        swatch.classList.add('ref-swatch-missing');
        var note = document.createElement('p');
        note.className = 'ref-swatch-name dds-text-error';
        note.textContent = name + ' does not resolve';
        var why = document.createElement('span');
        why.className = 'ref-swatch-note';
        why.textContent = 'Not declared, or a cached stylesheet. Reload without cache.';
        swatch.appendChild(note);
        swatch.appendChild(why);
        container.appendChild(swatch);
        console.error('[reference] ' + name + ' resolved to an empty string', container);
        return;
      }

      var chip = document.createElement('div');
      chip.className = 'ref-swatch-chip';
      /* Set as a custom property, not `background-color`. The chip draws the
         colour as its first background LAYER so it sits above the chequerboard;
         a `background-color` would land underneath it and every swatch would
         come out chequered. See .ref-swatch-chip in reference.css. */
      chip.style.setProperty('--ref-swatch-color', value);
      swatch.appendChild(chip);

      var body = document.createElement('div');
      body.className = 'ref-swatch-body';

      var nameEl = document.createElement('code');
      nameEl.className = 'ref-swatch-name';
      nameEl.textContent = name;
      body.appendChild(nameEl);

      var note = document.createElement('span');
      note.className = 'ref-swatch-note';

      if (backgroundRgb) {
        var foregroundRgb = toRgb(value);
        if (foregroundRgb) {
          var ratio = contrastRatio(foregroundRgb, backgroundRgb);
          var passes = ratio >= minRatio;
          // The word, not only a colour: a red badge that says nothing is
          // useless in exactly the situation this page is documenting.
          note.textContent =
            ratio.toFixed(2) + ':1 · ' + (passes ? 'passes' : 'FAILS') +
            ' ' + minRatio + ':1';
          note.style.color = passes
            ? 'var(--dds-color-text-success)'
            : 'var(--dds-color-text-error)';
          note.style.fontWeight = passes ? '' : 'var(--dds-font-weight-bold)';
        }
      } else {
        note.textContent = value;
      }

      body.appendChild(note);
      swatch.appendChild(body);
      container.appendChild(swatch);
    });
  }

  /* =========================================================================
     Spacing rulers
     ========================================================================= */
  function renderRulers(container) {
    var names;
    try {
      names = JSON.parse(container.getAttribute('data-ref-rulers'));
    } catch (error) {
      console.error('[reference] bad ruler list', error, container);
      return;
    }

    container.replaceChildren();

    names.forEach(function (name) {
      var value = tokenValue(name, container);

      var row = document.createElement('div');
      row.className = 'ref-ruler';

      var label = document.createElement('code');
      label.className = 'ref-ruler-name';
      label.textContent = name;
      row.appendChild(label);

      /**
       * A token that does not resolve says so, loudly.
       *
       * `getPropertyValue` returns an empty string for a custom property that is not
       * declared, and an empty string is a perfectly valid `inline-size` — so the row
       * rendered with its name, no bar and no number, and looked like a gap in the
       * ramp rather than like a failure. That is the exact shape of silent failure the
       * rest of this repository is built to refuse.
       *
       * The common cause is not a missing token at all: it is a cached stylesheet. The
       * page reloads, the JSON list already names the new token, and the CSS the
       * browser kept does not have it yet. Saying which of the two it is saves the
       * next person the ten minutes it cost this time.
       */
      if (!value) {
        var missing = document.createElement('span');
        missing.className = 'ref-ruler-missing dds-text-error dds-text-xs';
        missing.textContent =
          name + ' does not resolve — either it is not declared, or this page is ' +
          'using a cached stylesheet. Reload without cache.';
        row.appendChild(missing);
        container.appendChild(row);
        console.error('[reference] ' + name + ' resolved to an empty string', container);
        return;
      }

      var bar = document.createElement('div');
      bar.className = 'ref-ruler-bar';
      // Drawn at true size, so the ramp can be judged by eye.
      bar.style.inlineSize = value;
      row.appendChild(bar);

      var readout = document.createElement('span');
      readout.className = 'ref-ruler-readout dds-text-2xs dds-text-muted';
      // Resolved pixels alongside the authored rem, because the ramp is designed
      // in one and reasoned about in the other.
      var pixels = parseFloat(value) * (value.indexOf('rem') !== -1 ? 16 : 1);
      readout.textContent = value + (value.indexOf('rem') !== -1 ? ' (' + pixels + 'px)' : '');
      row.appendChild(readout);

      container.appendChild(row);
    });
  }

  /* =========================================================================
     The icon set — read from the sprite

     Rendered from the `<symbol>` elements actually present in the page, so the
     gallery cannot be missing an icon or showing one that has been removed.

     The previous version was a hand-written list of `<use>` elements. Keeping it
     complete was nobody's job, so an icon added to `scripts/build-icons.mjs` would
     simply not appear here — invisible, because a gallery of icons looks complete
     by definition.
     ========================================================================= */
  function renderIcons(container) {
    var symbols = Array.prototype.slice.call(
      document.querySelectorAll('[data-dds-icons] symbol[id^="dds-icon-"]')
    );

    container.replaceChildren();

    if (!symbols.length) {
      var missing = document.createElement('p');
      missing.className = 'dds-text-sm dds-text-error';
      missing.textContent =
        'No sprite found in this page. Run: node scripts/sync-icons.mjs';
      container.appendChild(missing);
      return;
    }

    symbols.forEach(function (symbol) {
      var role = symbol.id.replace('dds-icon-', '');

      var cell = document.createElement('div');
      cell.className = 'ref-icon';

      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'dds-icon');
      // Decorative here: the role name beside it is the real text.
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', '#' + symbol.id);
      svg.appendChild(use);
      cell.appendChild(svg);

      var name = document.createElement('code');
      name.className = 'ref-icon-name';
      // The role, not the upstream file name: the role is the stable part, and
      // swapping which Ionicon backs it must not change any markup.
      name.textContent = role;
      cell.appendChild(name);

      container.appendChild(cell);
    });

    var count = document.createElement('p');
    count.className = 'dds-text-2xs dds-text-muted';
    count.textContent =
      symbols.length + ' icons in the sprite, read from this page at runtime.';
    container.appendChild(count);
  }

  /* =========================================================================
     Breakpoints — live

     Rendered from the values the browser has actually resolved, and re-rendered
     on resize, so the page shows which breakpoint is active right now rather than
     a table of numbers someone typed.

     That matters more here than elsewhere. CSS cannot use a custom property in a
     media query condition, so nothing in the browser enforces that these four
     values are the ones any query uses — the documented set and the used set stay
     in agreement only because `scripts/check-reference.mjs` compares them. Reading
     them live at least removes the page itself as a source of drift.
     ========================================================================= */
  function renderBreakpoints(container) {
    var names;
    try {
      names = JSON.parse(container.getAttribute('data-ref-breakpoints'));
    } catch (error) {
      console.error('[reference] bad breakpoint list', error, container);
      return;
    }

    function draw() {
      var viewport = window.innerWidth;

      var resolved = names.map(function (name) {
        var value = tokenValue(name, container);
        var pixels = parseFloat(value) * (value.indexOf('rem') !== -1 ? 16 : 1);
        return { name: name, value: value, pixels: pixels };
      });

      // The active breakpoint is the largest one the viewport has reached. Below
      // the smallest, none is active — that is the base case, not an error.
      var active = null;
      resolved.forEach(function (entry) {
        if (viewport >= entry.pixels) active = entry.name;
      });

      container.replaceChildren();

      var readout = document.createElement('p');
      readout.className = 'ref-breakpoint-readout dds-text-sm';
      readout.setAttribute('role', 'status');
      readout.textContent =
        'Viewport ' + viewport + 'px — active: ' +
        (active ? active.replace('--dds-breakpoint-', '') : 'base (below phone)');
      container.appendChild(readout);

      var list = document.createElement('div');
      list.className = 'ref-breakpoint-list';

      resolved.forEach(function (entry) {
        var reached = viewport >= entry.pixels;

        var row = document.createElement('div');
        row.className = 'ref-breakpoint';
        if (entry.name === active) row.setAttribute('data-active', '');

        var label = document.createElement('code');
        label.className = 'ref-breakpoint-name';
        label.textContent = entry.name;
        row.appendChild(label);

        var value = document.createElement('span');
        value.className = 'ref-breakpoint-value dds-numeric';
        value.textContent = entry.value + ' (' + entry.pixels + 'px)';
        row.appendChild(value);

        var state = document.createElement('span');
        state.className = 'ref-breakpoint-state dds-text-2xs';
        // Wording is about the viewport, not about the breakpoint being "on":
        // a breakpoint below the current width is reached, not active.
        state.textContent = entry.name === active
          ? 'active'
          : reached ? 'reached' : 'not reached';
        row.appendChild(state);

        list.appendChild(row);
      });

      container.appendChild(list);
    }

    draw();

    if (!container.hasAttribute('data-ref-breakpoints-bound')) {
      container.setAttribute('data-ref-breakpoints-bound', '');
      var frame = null;
      window.addEventListener('resize', function () {
        // Resize fires continuously; one redraw per frame is enough and keeps the
        // readout from thrashing a screen reader via role="status".
        if (frame) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(draw);
      });
    }
  }


  /* =========================================================================
     Locale switch — for the writing page's format table

     Calls the real `DDS.format.setLocale()` and re-renders, so the table shows what
     a product would actually get rather than a transcription of what it should get.
     Two locales because the standard names two: German is the default and English is
     the documented alternative.
     ========================================================================= */
  function wireLocaleSwitch(group) {
    /* `renderAll` runs again on every theme change, so wiring has to happen once.
       Without this each theme toggle would add another click listener and one press
       would switch the locale twice — which is invisible, because switching twice to
       the same value looks like switching once. */
    if (group.hasAttribute('data-ref-locale-bound')) return;

    var buttons = Array.prototype.slice.call(
      group.querySelectorAll('[data-ref-locale]')
    );
    if (!buttons.length || !DDS || !DDS.format) return;

    group.setAttribute('data-ref-locale-bound', '');

    /** The currency has to follow the locale, or `en-GB` formats pounds as euros. */
    var CURRENCY = { 'de-DE': 'EUR', 'en-GB': 'GBP' };

    function select(locale) {
      DDS.format.setLocale(locale, CURRENCY[locale]);
      DDS.format.refresh();

      buttons.forEach(function (button) {
        var active = button.getAttribute('data-ref-locale') === locale;
        // `aria-pressed` rather than a class: the state is what the control reports,
        // and a screen reader gets it from the attribute either way.
        button.setAttribute('aria-pressed', String(active));
      });

      // The table changed under the reader; say so once, politely.
      if (DDS.announce) {
        DDS.announce(
          locale === 'de-DE'
            ? 'Formate auf Deutsch umgestellt'
            : 'Formats switched to English'
        );
      }
    }

    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        select(button.getAttribute('data-ref-locale'));
      });
    });
  }

  /* =========================================================================
     Everything that needs re-rendering when the theme changes
     ========================================================================= */
  function renderAll(root) {
    var scope = root || document;

    scope.querySelectorAll('[data-ref-swatches]').forEach(renderSwatches);
    scope.querySelectorAll('[data-ref-rulers]').forEach(renderRulers);
    scope.querySelectorAll('[data-ref-breakpoints]').forEach(renderBreakpoints);
    scope.querySelectorAll('[data-ref-icons]').forEach(renderIcons);
    scope.querySelectorAll('[data-ref-locale-switch]').forEach(wireLocaleSwitch);
  }

  /**
   * Run once the stylesheets that declare the tokens have actually applied.
   *
   * Everything on this page that draws a swatch or a ruler reads a custom
   * property back out of the computed style, and a custom property is readable
   * only after the sheet declaring it has applied. `dds.css` reaches its layer
   * files with `@import`, which the browser can only discover after parsing
   * `dds.css` itself — so a deferred script can genuinely run before a single
   * `--dds-*` exists.
   *
   * Chromium happened to have them by `DOMContentLoaded`. WebKit did not, and
   * the foundations page reported fifty of its own tokens as undeclared, in the
   * page whose entire job is to show that they are declared. Neither engine is
   * wrong: nothing in the specification says an imported sheet has applied by
   * then.
   *
   * So render when the values are there, and wait for `load` when they are not
   * — `load` waits for every stylesheet, imported ones included. If they are
   * still missing then, the renderers say so, which is the real failure and
   * worth reporting.
   */
  function whenTokensResolve(run) {
    if (tokenValue('--dds-color-surface-default')) return run();
    if (document.readyState === 'complete') return run();
    window.addEventListener('load', run, { once: true });
  }

  function init() {
    whenTokensResolve(function () {
      renderAll(document);
    });

    // Contrast badges are theme-dependent, so they are recomputed on every
    // theme change rather than being calculated once at load.
    if (DDS && DDS.theme) {
      DDS.theme.subscribe(function () {
        // A frame's delay lets the new custom property values settle before
        // they are read back.
        requestAnimationFrame(function () {
          renderAll(document);
        });
      });
    }
  }

  /* A deferred script runs after parsing, when `readyState` is already
     `"interactive"` — never `"loading"`. Testing for `"loading"` therefore always
     took the else branch and ran `init()` immediately, before any later deferred
     script had loaded. It happened to work here only because this file is nearly
     last; the same guard in `dds.js` meant nothing on any page was enhanced.

     `"complete"` covers being loaded dynamically after the page has settled,
     when there is no event left to wait for. */
  if (document.readyState === 'complete') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  }

  global.ReferencePage = { renderAll: renderAll, tokenValue: tokenValue, contrastRatio: contrastRatio };
})(typeof window !== 'undefined' ? window : globalThis);
