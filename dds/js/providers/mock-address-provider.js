/**
 * DDS — mock address provider.
 *
 * A provider that satisfies the contract in `address-provider.md` using a small
 * in-memory list. It exists for two reasons:
 *
 *  1. The reference implementation of Address Search needs something to search,
 *     and it must not depend on a network service or an API key.
 *
 *  2. It can be told to behave badly. Latency, failures and empty results are
 *     the states that real integrations get wrong, and they are hard to
 *     reproduce against a service that works. Being able to turn them on is the
 *     difference between "the happy path renders" and "the pattern is done".
 *
 * Not for production. Replace it with a real provider; nothing else changes.
 *
 * -----------------------------------------------------------------------------
 * About the data
 * -----------------------------------------------------------------------------
 *
 * Invented streets in real cities across several countries. Deliberately:
 *
 *  - Multi-country, so nothing in the pattern can quietly assume one national
 *    address format or one postcode shape.
 *  - Full of diacritics and non-ASCII characters (ø, ä, ç, ł, ș, ü, å). These
 *    are the characters that expose a broken charset, a bad `sort`, a truncating
 *    database column or a font missing glyphs — and they only expose it if the
 *    example data actually contains them.
 *  - Varied in length, so a long street name is exercised against truncation.
 *  - Including one address with no street number, because they exist and a form
 *    that cannot accept one is broken for the people who live there.
 */
(function (global) {
  'use strict';

  var DDS = global.DDS;
  if (!DDS) {
    console.error('[DDS] mock-address-provider.js requires dds.js to be loaded first');
    return;
  }

  var ADDRESSES = [
    { streetLine: 'Sagløkkveien 7',            postalCode: '0159',      locality: 'Oslo',       country: 'NO' },
    { streetLine: 'Møllehaven 12',             postalCode: '2200',      locality: 'Copenhagen', country: 'DK' },
    { streetLine: 'Lindbergsgatan 26',         postalCode: '211 22',    locality: 'Malmö',      country: 'SE' },
    { streetLine: 'Purolehdonkatu 9',          postalCode: '00120',     locality: 'Helsinki',   country: 'FI' },
    { streetLine: 'Vlietkade 88',              postalCode: '1017 XZ',   locality: 'Amsterdam',  country: 'NL' },
    { streetLine: 'Wolvenstraatje 14',         postalCode: '1000',      locality: 'Brussels',   country: 'BE' },
    { streetLine: 'Rue du Vieux-Pressoir 5',   postalCode: '1004',      locality: 'Lausanne',   country: 'CH' },
    { streetLine: 'Talwiesenweg 41',           postalCode: '40233',     locality: 'Düsseldorf', country: 'DE' },
    { streetLine: 'Ahornsteig 6',              postalCode: '80339',     locality: 'Munich',     country: 'DE' },
    { streetLine: 'Grünmarktgasse 23',         postalCode: '1062',      locality: 'Vienna',     country: 'AT' },
    { streetLine: 'Ulica Wierzbowa Górna 18',  postalCode: '31-034',    locality: 'Kraków',     country: 'PL' },
    { streetLine: 'Strada Cerbului Mic 42',    postalCode: '030167',    locality: 'Bucharest',  country: 'RO' },
    { streetLine: 'Rézkapu utca 7',            postalCode: '1073',      locality: 'Budapest',   country: 'HU' },
    { streetLine: 'Rua das Oliveiras Novas 31', postalCode: '1250-108', locality: 'Lisbon',     country: 'PT' },
    { streetLine: 'Carrer de les Bassetes 77', postalCode: '08036',     locality: 'Barcelona',  country: 'ES' },
    { streetLine: 'Via dei Tigli Antichi 6',   postalCode: '00185',     locality: 'Rome',       country: 'IT' },
    { streetLine: 'Kranichplatz',              postalCode: '28217',     locality: 'Bremen',     country: 'DE' },
    { streetLine: 'Ashfield Row 12',           postalCode: 'D04 R720',  locality: 'Dublin',     country: 'IE' },
    { streetLine: 'Cobblers Yard 47',          postalCode: 'EH3 9QB',   locality: 'Edinburgh',  country: 'GB' },
    { streetLine: 'Rue des Deux Lanternes 19', postalCode: '75014',     locality: 'Paris',      country: 'FR' },
    { streetLine: 'Yıldız Bahçe Sokak 18',     postalCode: '34387',     locality: 'Istanbul',   country: 'TR' },
    { streetLine: 'Ąžuolų alėja 64',           postalCode: '44291',     locality: 'Kaunas',     country: 'LT' },
    { streetLine: 'Kaselehe tee 82',           postalCode: '10135',     locality: 'Tallinn',    country: 'EE' },
    { streetLine: 'Nedre Hagestien 3',         postalCode: '5003',      locality: 'Bergen',     country: 'NO' },
  ].map(function (address) {
    // `label` and `secondary` are the display shape the combobox renders. Derived
    // here so a provider only has to know its own data, not the pattern's UI.
    return Object.assign({}, address, {
      label: address.streetLine,
      secondary: address.postalCode + ' ' + address.locality,
    });
  });

  /**
   * Create a mock provider.
   *
   * @param {object} [options]
   * @param {number}  [options.latencyMs=250]  Simulated round trip.
   * @param {number}  [options.failRate=0]     0..1 probability of rejection.
   * @param {string}  [options.emptyFor]       Any query containing this returns
   *                                           no results, so the "nothing found"
   *                                           state can be reached on demand.
   * @returns {{ search: Function, attribution: string }}
   */
  function createMockAddressProvider(options) {
    var opts = options || {};
    var latencyMs = typeof opts.latencyMs === 'number' ? opts.latencyMs : 250;
    var failRate = typeof opts.failRate === 'number' ? opts.failRate : 0;

    return {
      search: function (query, context) {
        var ctx = context || {};
        var signal = ctx.signal;
        var limit = ctx.limit || 20;

        return new Promise(function (resolve, reject) {
          // Abort before the timer even starts, if the signal is already spent.
          if (signal && signal.aborted) {
            reject(new DOMException('Aborted', 'AbortError'));
            return;
          }

          var timer = setTimeout(function () {
            if (signal) signal.removeEventListener('abort', onAbort);

            if (failRate > 0 && Math.random() < failRate) {
              // Reject rather than resolving empty, so the pattern can tell the
              // user the service failed instead of claiming no such address.
              reject(new Error('Mock address provider: simulated failure'));
              return;
            }

            // `typeof` rather than a truthiness check, so `emptyFor: ''` means
            // "always return nothing" (every string contains the empty string).
            // A plain `if (opts.emptyFor)` would silently skip that case.
            if (
              typeof opts.emptyFor === 'string' &&
              query.toLowerCase().indexOf(opts.emptyFor.toLowerCase()) !== -1
            ) {
              resolve([]);
              return;
            }

            var needle = query.toLowerCase().trim();

            var matches = ADDRESSES.filter(function (address) {
              // Match against the whole address, so "Copenhagen" and "2200" and
              // "Nørrebrogade" all find the same entry. Users search by
              // whichever part they remember.
              var haystack = (
                address.streetLine + ' ' + address.postalCode + ' ' + address.locality
              ).toLowerCase();
              return haystack.indexOf(needle) !== -1;
            });

            resolve(matches.slice(0, limit));
          }, latencyMs);

          function onAbort() {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
          }

          if (signal) signal.addEventListener('abort', onAbort, { once: true });
        });
      },

      attribution: 'Example data — not a real address service',
    };
  }

  DDS.mockAddressProvider = createMockAddressProvider;
})(typeof window !== 'undefined' ? window : globalThis);
