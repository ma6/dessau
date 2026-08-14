/**
 * DDS — locale-aware formatting.
 *
 *   <script src="/dds/js/dds.js" defer></script>
 *   <script src="/dds/js/format.js" defer></script>
 *
 * Formats numbers, currency, percentages, dates, times and file sizes for the
 * product's locale.
 *
 * -----------------------------------------------------------------------------
 * German is the default
 * -----------------------------------------------------------------------------
 *
 * `de-DE` is the default locale, `en-GB` is the fully supported alternative. A
 * product overrides the default once:
 *
 *   DDS.format.setLocale('en-GB');
 *
 * Why a default at all, rather than reading the document language: a wrong
 * format is worse than an obviously missing one. `1,234.56` shown to a German
 * reader is not merely unfamiliar — it reads as one and a bit, not as one
 * thousand two hundred. Number formats are a correctness concern, not a
 * preference.
 *
 * -----------------------------------------------------------------------------
 * Why Intl and not string manipulation
 * -----------------------------------------------------------------------------
 *
 * `Intl.NumberFormat` and `Intl.DateTimeFormat` are built into every engine and
 * carry the full CLDR data: separators, currency placement, ordering, calendar
 * rules, and the correct behaviour for locales nobody on the team has tested.
 * Hand-rolled `replace('.', ',')` formatting is wrong for most of the world and
 * subtly wrong for the rest.
 *
 * Formatter instances are cached: constructing one is comparatively expensive,
 * and a table of a thousand rows would otherwise construct a thousand of them.
 *
 * -----------------------------------------------------------------------------
 * Non-breaking spaces
 * -----------------------------------------------------------------------------
 *
 * Intl already inserts a narrow no-break space between a number and its unit in
 * the locales that require it. That is deliberate and must not be "cleaned up":
 * a value that wraps between the number and its unit — `1.234,56` at the end of
 * one line and `€` at the start of the next — is read as two separate things.
 */
(function (global) {
  'use strict';

  var DDS = global.DDS;
  if (!DDS) {
    console.error('[DDS] format.js requires dds.js to be loaded first');
    return;
  }

  /** German is the default. See the note above. */
  var DEFAULT_LOCALE = 'de-DE';
  var DEFAULT_CURRENCY = 'EUR';

  var locale = DEFAULT_LOCALE;
  var currency = DEFAULT_CURRENCY;

  // Cache keyed by locale plus options, since constructing a formatter is the
  // expensive part and the same few configurations repeat constantly.
  var cache = new Map();

  function formatter(Constructor, kind, options) {
    var key = kind + '|' + locale + '|' + JSON.stringify(options || {});
    if (cache.has(key)) return cache.get(key);
    var instance = new Constructor(locale, options);
    cache.set(key, instance);
    return instance;
  }

  function numberFormatter(options) {
    return formatter(Intl.NumberFormat, 'number', options);
  }

  function dateFormatter(options) {
    return formatter(Intl.DateTimeFormat, 'date', options);
  }

  /** Accept a Date, a timestamp or an ISO string. */
  function toDate(value) {
    if (value instanceof Date) return value;
    if (typeof value === 'number') return new Date(value);
    return new Date(String(value));
  }

  var format = {
    /**
     * Set the product's locale. Call once, at start-up.
     * Supported and tested: 'de-DE' (default), 'en-GB'. Any BCP 47 tag the
     * engine knows will work; only those two are documented.
     */
    setLocale: function (nextLocale, nextCurrency) {
      locale = nextLocale || DEFAULT_LOCALE;
      if (nextCurrency) currency = nextCurrency;
      // Cached formatters are bound to the old locale.
      cache.clear();
      return locale;
    },

    getLocale: function () {
      return locale;
    },

    /**
     * A plain number.
     *   de-DE  1.234,56
     *   en-GB  1,234.56
     */
    number: function (value, options) {
      if (value == null || value === '') return '';
      return numberFormatter(options).format(value);
    },

    /**
     * An amount of money.
     *   de-DE  1.234,56 €
     *   en-GB  €1,234.56
     *
     * Currency position differs by locale, which is exactly why this is not a
     * template string with the symbol appended.
     */
    currency: function (value, currencyCode, options) {
      if (value == null || value === '') return '';
      return numberFormatter(
        Object.assign(
          {
            style: 'currency',
            currency: currencyCode || currency,
          },
          options
        )
      ).format(value);
    },

    /**
     * A percentage. Takes a RATIO, not a percentage — 0.195, not 19.5.
     *   de-DE  19,5 %
     *   en-GB  19.5%
     *
     * The ratio convention matches Intl and avoids the ambiguity that causes
     * values to be divided by a hundred twice.
     */
    percent: function (ratio, options) {
      if (ratio == null || ratio === '') return '';
      return numberFormatter(
        Object.assign({ style: 'percent', maximumFractionDigits: 1 }, options)
      ).format(ratio);
    },

    /**
     * A short date.
     *   de-DE  01.08.2026
     *   en-GB  01/08/2026
     */
    date: function (value, options) {
      if (!value) return '';
      return dateFormatter(
        Object.assign({ day: '2-digit', month: '2-digit', year: 'numeric' }, options)
      ).format(toDate(value));
    },

    /**
     * A long date, for prose and confirmations where the month must be
     * unambiguous.
     *   de-DE  1. August 2026
     *   en-GB  1 August 2026
     */
    dateLong: function (value, options) {
      if (!value) return '';
      return dateFormatter(
        Object.assign({ day: 'numeric', month: 'long', year: 'numeric' }, options)
      ).format(toDate(value));
    },

    /**
     * A time of day, 24-hour in both supported locales.
     *   de-DE  14:30
     *   en-GB  14:30
     *
     * German convention appends " Uhr" in running text; that is a writing rule
     * rather than a formatting one, so it belongs in the copy. See
     * agent/ux-writing.md.
     */
    time: function (value, options) {
      if (!value) return '';
      return dateFormatter(
        Object.assign({ hour: '2-digit', minute: '2-digit', hour12: false }, options)
      ).format(toDate(value));
    },

    dateTime: function (value) {
      if (!value) return '';
      return format.date(value) + ', ' + format.time(value);
    },

    /**
     * A file size in binary units.
     *
     * Binary (KiB steps of 1024) rather than decimal, because that is what an
     * operating system reports — a file the OS calls 1,0 MiB should not appear
     * as 1,05 MB in the interface.
     */
    fileSize: function (bytes) {
      if (bytes == null || bytes === '') return '';
      if (bytes === 0) return format.number(0) + ' B';

      var units = ['B', 'kB', 'MB', 'GB', 'TB'];
      var exponent = Math.min(Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024)), units.length - 1);
      var value = bytes / Math.pow(1024, exponent);

      return (
        numberFormatter({
          // One decimal above kilobytes; whole bytes are never fractional.
          maximumFractionDigits: exponent === 0 ? 0 : 1,
        }).format(value) +
        // A narrow no-break space, so the number never wraps away from its unit.
        ' ' +
        units[exponent]
      );
    },

    /**
     * A relative time, for "last edited" style metadata.
     *   de-DE  vor 3 Tagen
     *   en-GB  3 days ago
     *
     * `Intl.RelativeTimeFormat` handles the plural rules, which are genuinely
     * hard: German and English are simple, Polish and Russian are not.
     */
    relativeTime: function (value, options) {
      if (!value) return '';

      var target = toDate(value).getTime();
      var seconds = Math.round((target - Date.now()) / 1000);

      var units = [
        ['year', 60 * 60 * 24 * 365],
        ['month', 60 * 60 * 24 * 30],
        ['week', 60 * 60 * 24 * 7],
        ['day', 60 * 60 * 24],
        ['hour', 60 * 60],
        ['minute', 60],
        ['second', 1],
      ];

      var relative = formatter(
        Intl.RelativeTimeFormat,
        'relative',
        Object.assign({ numeric: 'auto' }, options)
      );

      for (var i = 0; i < units.length; i++) {
        var unit = units[i][0];
        var size = units[i][1];
        if (Math.abs(seconds) >= size || unit === 'second') {
          return relative.format(Math.round(seconds / size), unit);
        }
      }

      return '';
    },

    /**
     * Parse a locale-formatted number back to a Number.
     *
     * Needed for a text input where the user types `1.234,56`. `parseFloat`
     * would read that as 1.234, which is a silent, plausible, wrong answer —
     * the worst kind.
     *
     * Returns NaN when the value is not a number, so a caller can distinguish
     * "empty" from "not valid".
     */
    parseNumber: function (text) {
      if (text == null || text === '') return NaN;

      var parts = numberFormatter().formatToParts(12345.6);
      var group = (parts.find(function (part) { return part.type === 'group'; }) || {}).value || ',';
      var decimal = (parts.find(function (part) { return part.type === 'decimal'; }) || {}).value || '.';

      var normalised = String(text)
        .trim()
        // Strip everything that is not a digit, a sign, or a separator.
        .replace(/[^\d\-+.,  \s]/g, '')
        // Remove the group separator, whatever it is in this locale.
        .split(group)
        .join('')
        // Whitespace, including the narrow no-break space, is also a group
        // separator in several locales.
        .replace(/[\s  ]/g, '')
        // Normalise the decimal separator for Number().
        .replace(decimal, '.');

      var value = Number(normalised);
      return Number.isFinite(value) ? value : NaN;
    },
  };

  /* =========================================================================
     Declarative formatting
     =========================================================================
       <span data-dds-format="currency" data-dds-value="1234.56"></span>
       <time data-dds-format="dateLong" datetime="2026-08-01"></time>
       <span data-dds-format="fileSize" data-dds-value="2411724"></span>

     The raw value stays in the DOM (`data-dds-value`, or `datetime` for a
     `<time>`), so the formatted text can be regenerated after a locale change
     and the machine-readable value is never lost. That matters for `<time>`
     specifically: the `datetime` attribute is what assistive technology and
     search engines read, and it must stay in ISO 8601 regardless of what is
     displayed.
     ========================================================================= */

  function applyFormat(element) {
    var kind = element.getAttribute('data-dds-format');
    var fn = format[kind];

    if (typeof fn !== 'function') {
      console.error('[DDS] unknown format "' + kind + '"', element);
      return;
    }

    var raw =
      element.getAttribute('data-dds-value') ||
      element.getAttribute('datetime') ||
      element.textContent.trim();

    var isNumeric = ['number', 'currency', 'percent', 'fileSize'].indexOf(kind) !== -1;
    var value = isNumeric ? Number(raw) : raw;

    element.textContent = fn(value);
  }

  DDS.register('format', '[data-dds-format]', applyFormat);

  /** Re-render every formatted element. Call after changing the locale. */
  format.refresh = function (root) {
    (root || document).querySelectorAll('[data-dds-format]').forEach(applyFormat);
  };

  DDS.format = format;
})(typeof window !== 'undefined' ? window : globalThis);
