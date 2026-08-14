# Address provider contract

The Address Search pattern knows nothing about where addresses come from. It
talks to a **provider**: one object with one method. Swap the provider and the
pattern is unchanged.

This separation is the point of the pattern. Address lookup is always someone
else's service, that service is always specific to a country or a contract, and
it will be replaced at least once during a product's life. Everything that is
genuinely reusable — the interaction, the keyboard handling, the announcements,
the fallback to manual entry — lives in the pattern; everything that is specific
lives behind this interface.

## The interface

```js
/**
 * @typedef {object} DdsAddress
 * @property {string}  label          Primary display line, and the value put
 *                                    into the search field on selection.
 *                                    Usually street plus number.
 * @property {string}  [secondary]    Supporting display line, shown dimmed
 *                                    under the label. Usually postcode and
 *                                    locality. Used to disambiguate.
 * @property {string}  [id]           Provider's own identifier, if it has one.
 * @property {string}  streetLine     Street and number as ONE line. See below.
 * @property {string}  postalCode
 * @property {string}  locality       City, town or village.
 * @property {string}  [region]       State, province or county.
 * @property {string}  [country]      ISO 3166-1 alpha-2, uppercase.
 */

/**
 * @typedef {object} DdsAddressProvider
 * @property {(query: string, ctx: SearchContext) => Promise<DdsAddress[]>} search
 * @property {string} [attribution]   Required by some services; rendered under
 *                                    the field when present.
 */

/**
 * @typedef {object} SearchContext
 * @property {AbortSignal} signal   Abort when a newer query supersedes this one.
 * @property {number}      limit    Maximum useful number of results.
 */
```

A provider must:

- **return a promise** — even if it resolves synchronously from a local array;
- **honour `ctx.signal`** — pass it to `fetch`, or check `signal.aborted` before
  resolving. Without this, a slow response to `Ber` arrives after the fast
  response to `Berlin` and overwrites it. The bug only appears on slow
  connections, which is where it does the most damage;
- **reject on failure** rather than resolving with an empty array. "The service
  is down" and "there is no such address" need different messages: one says try
  again or type it yourself, the other says check the spelling. Collapsing them
  into one leaves the user guessing;
- **never block manual entry.** The provider is an accelerator. If it knows
  nothing, the user still types their address into the fields.

## Address shape: deliberate choices

**Street and number are one field, not two.** Address formats vary enormously —
the number precedes the street in some countries and follows it in others, and
plenty of addresses have no number at all, or a name instead. Splitting them
forces every user into one country's format and makes a valid address
unenterable. One `streetLine` accepts all of them.

**`addressLine2` is not in the interface.** An apartment, floor, unit or care-of
line is information no address service has. The pattern renders the field, keeps
it manual, and clears it when a new address is selected so that a stale value
cannot silently attach itself to a different address.

**`country` is ISO alpha-2.** A display name is not stable enough to key on.

## Minimal provider

```js
const provider = {
  async search(query, { signal, limit }) {
    const response = await fetch(
      `/api/addresses?q=${encodeURIComponent(query)}&limit=${limit}`,
      { signal }
    );

    if (!response.ok) {
      // Reject, so the pattern can distinguish failure from emptiness.
      throw new Error(`Address lookup failed: ${response.status}`);
    }

    const data = await response.json();

    return data.items.map((item) => ({
      id: item.id,
      label: item.street,
      secondary: `${item.postcode} ${item.city}`,
      streetLine: item.street,
      postalCode: item.postcode,
      locality: item.city,
      country: item.countryCode,
    }));
  },

  attribution: 'Address data © Example Geodata Service',
};

DDS.addressSearch(document.querySelector('[data-dds-address-search]'), { provider });
```

## Using it

```js
DDS.addressSearch(root, {
  provider,
  minLength: 3,     // fewer characters than this is not a useful query
  debounceMs: 250,  // most lookups are paid per request
});
```

## Testing a provider

The reference implementation ships `mock-address-provider.js`, which can
simulate the conditions that break real integrations:

```js
DDS.mockAddressProvider({
  latencyMs: 600,   // is the loading state visible and announced?
  failRate: 1,      // does the failure path explain what to do next?
  emptyFor: 'zzz',  // is "nothing found" distinguishable from failure?
});
```

Run through all four states before calling an address integration done: results,
nothing found, request failed, and no JavaScript at all.
