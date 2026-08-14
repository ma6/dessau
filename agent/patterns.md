# Patterns

Every pattern, with its rules and the reason each rule exists.

**Rendered:** `reference/patterns.html`.
**Machine-readable:** [`index.json`](index.json).

A pattern combines components and behaviour to solve a recurring user task. It
owns what a single element cannot: focus order, live announcements, request
lifecycle, error recovery, and the fallback when the clever path fails.

Most of the real accessibility work in a product lives here, which is why each
entry states the rules rather than only the markup. A pattern implemented without
its rules looks finished and is not.

---

## Combobox — `.dds-combobox`

**For:** a text input with filtered suggestions, over any data source.
**Not for:** a short, known list — use a native `<select>`. An autocomplete costs
the user a decision about whether to type or browse, only worth paying above
roughly fifteen options.

**Behaviour:** `dds/js/patterns/combobox.js`

```html
<div class="dds-combobox" data-dds-combobox>
  <input class="dds-input" id="city" name="city">
  <ul class="dds-combobox-list" role="listbox" hidden></ul>
  <script type="application/json" data-dds-combobox-items>["Amsterdam", …]</script>
</div>
```

```js
DDS.combobox(root, { source, onSelect, minLength: 1, debounceMs: 200 });
```

### Rules

- **DOM focus stays in the input.** The user is still typing. The visually active
  option is pointed at with `aria-activedescendant`. This is the single most
  important detail in the pattern and the one most often got wrong — moving focus
  into the list stops the user refining their query.
- `aria-expanded` on the input reflects whether the list is showing;
  `aria-selected="true"` marks the option Enter would choose.
- **The ARIA attributes are applied by the script, not the markup.** An input
  advertising `role="combobox"` with no list to expand is a worse starting point
  than a plain text input.
- **Escape is two-stage:** close the list; only clear the field if the list was
  already closed. One Escape must not destroy what was typed.
- **Announcements are debounced** — 350ms, separately from the request. Typing
  eight characters produces one announcement, not eight.
- **Every in-flight request is aborted when a newer one starts.** Without it, a
  slow response for "Ber" lands after the fast one for "Berlin" and overwrites it
  — a bug that only appears on a slow connection, which is where it hurts most.
- A "no matches" row is `role="presentation"`, so it is never counted or announced
  as a choosable result.
- **The input always accepts a value the source has never heard of.** That is the
  difference between a combobox and a `<select>` in disguise.

### Without JavaScript

A plain, labelled `<input type="text">`. It submits, it autofills, it works.

---

## Address search — `.dds-address-search`

**For:** filling structured address fields from a search, over a replaceable
provider.

The reference pattern, because it exercises everything at once: components,
asynchronous behaviour, accessibility, progressive enhancement and an abstraction
over an external service.

**Behaviour:** `dds/js/patterns/address-search.js`
**Provider contract:** `dds/js/providers/address-provider.md`

### Rules, and why each exists

1. **The structured fields are always present and always editable.**
   The search is an accelerator. Every address a provider does not know must still
   be enterable by hand — a form that only accepts addresses in a third-party
   database excludes real people at real addresses: new buildings, rural
   addresses, recent renames, anywhere the licence did not cover.

2. **Selecting a result never disables, hides or locks a field.**
   Providers return stale and wrong data. The person filling in the form is the
   authority on where they live.

3. **Street and number are ONE field.**
   Number-before-street and number-after-street are both correct depending on the
   country, and some addresses have no number at all. Splitting them imposes one
   country's format on everyone.

4. **The secondary line (apartment, floor, care-of) is never auto-filled, and is
   cleared when a new address is selected.**
   No provider knows it. Clearing matters: leaving "Flat 4" attached while the
   street changes underneath produces an address that looks complete and is wrong.

5. **`autocomplete` on every field.**
   The browser's own address autofill is faster than any search, works offline, and
   is what many people already rely on. WCAG 2.2 1.3.5 requires it. Never break it
   to make a custom search look better.

6. **Filling the fields is announced.**
   Four fields changing at once is invisible to a screen-reader user. Without an
   announcement the interaction appears to have done nothing.

7. **No provider means no search field.** The module hides it rather than leaving a
   dead control on the page.

### The four states to verify

Not done because the happy path renders. Walk all four, including with a screen
reader, since three of them are announced rather than seen:

| State | Must |
| --- | --- |
| Results | Announce the count |
| Nothing found | Say the fields can be filled in by hand |
| Request failed | Be worded **differently** from nothing found |
| No JavaScript | Leave a fully usable set of address fields |

`DDS.mockAddressProvider({ latencyMs, failRate, emptyFor })` produces each on
demand.

---

## Form validation — `data-dds-validate`

**For:** accessible client-side validation.

**Behaviour:** `dds/js/patterns/form-validation.js`

Constraints stay in the markup — `required`, `type="email"`, `minlength`,
`pattern`, `min`, `max` — and the browser evaluates them via `checkValidity()`.
Re-implementing that in JavaScript means a second rulebook that drifts from the
first.

What is replaced is the **presentation**: native validation bubbles cannot be
styled, vanish on their own, appear one at a time, are not reliably announced, and
are lost as soon as the user scrolls.

### When errors appear — the part that matters most

Not while typing. Not on first blur of an untouched field. Only:

- **on submit**, for every invalid field at once, and
- **after that**, on blur, for a field the user has already been told about.

Validating early looks helpful and is not: telling someone their email is invalid
after two characters is telling them off for not having finished. People learn to
ignore error styling that is always present — which is exactly the styling you
need them to read later.

An error clears as soon as the correction becomes valid, so the user gets
immediate confirmation rather than having to submit again to find out.

### The error summary

The highest-value accessibility feature in any form. On a failed submit:

- a summary appears at the top listing **every** problem;
- **focus moves to it**, so the user lands on the explanation rather than being
  silently returned to the top of the page;
- each entry is a **link to its field**;
- the wording **matches** the per-field message — two descriptions of one problem
  is one too many;
- it is `tabindex="-1"`: focusable programmatically, never a permanent tab stop.

Without it, a user whose submit failed has no idea how many things are wrong or
where, and must walk the whole form again.

### Also

- Fields inside a `[hidden]` ancestor are skipped — the user cannot see them, so
  they must not block progress.
- Messages say what to do, not just what is wrong. Override per field with
  `data-dds-error-<constraint>`.
- **Client validation is a convenience, never a guarantee.** The server validates
  again, always.

---

## Search and results — `.dds-results`

**For:** a query and its outcome.

Four states, all part of the pattern:

| State | Treatment |
| --- | --- |
| Loading | `aria-busy="true"`; keep the previous list, dimmed and unclickable |
| Results | Count announced politely via `role="status"` |
| Nothing found | Confirm what was searched; offer a way to broaden it |
| Failed | Say it failed, that the query survived, and offer retry |

**"Failed" is the state most often skipped**, and the one where the user most needs
to be told what to do next. "The service is down" and "there is no such thing"
need different messages: one says try again, the other says check the spelling.

Keeping the stale list on screen while loading preserves the user's context and
avoids a layout collapse on every keystroke. It is made unclickable because acting
on data about to be replaced is worse than waiting.

---

## Empty state — `.dds-empty`

**For:** when there is nothing to show.

Two genuinely different situations:

- **Nothing yet** — explain what this is for, offer the first action.
- **Nothing found** — confirm the query, offer a way to broaden it.

**Never a bare "No data".** See [`ux-writing.md`](ux-writing.md).

---

## Conditional fields — `.dds-conditional`

**For:** fields that appear because of an earlier answer.

**Behaviour:** `dds/js/patterns/conditional-fields.js`

- **Toggled with the `hidden` attribute**, so hidden fields are out of the tab
  order and out of the accessibility tree. Hiding with CSS alone leaves invisible
  tab stops — the focus ring disappears and Tab appears to do nothing.
- The controlling input carries `aria-expanded` and `aria-controls`, so the
  relationship is announced rather than merely visual.
- Revealed content sits **immediately after its trigger in the DOM**, so reading
  order and visual order agree (WCAG 1.3.2).
- **Focus is NOT moved into the revealed region.** The user is working through the
  form in order and will arrive there next; moving focus would skip whatever sits
  between.
- Required fields inside a hidden region must not block submission.

Without JavaScript every region is visible — all fields reachable, form still
works. It asks a little more of the user and excludes nobody.

---

## Multi-step form — `.dds-wizard`

**For:** a process with a genuine sequence, or too long for one screen.
**Not for:** six fields. A four-step wizard around six fields is six fields plus
three extra decisions.

**Behaviour:** `dds/js/patterns/wizard.js`

**One URL per step, rendered by the server, is the reference model.** It survives a
reload, a shared link, the back button and a failed script, and it cannot lose the
user's answers because they are already on the server. The module is the
single-page enhancement over that — not a replacement for anything long or
valuable, where a browser crash on step six loses everything.

### Rules

- **Back never discards input.** The rule that gets broken. Steps are hidden, never
  emptied. Break it and the user learns not to go back, and stops checking their
  own answers.
- **Hidden steps do not block submission.** Their fields are `disabled` while
  hidden, and re-enabled before the final submit — otherwise the answers from
  hidden steps are dropped.
- **Focus moves to the new step's heading, and the change is announced.** Otherwise
  focus sits on a button that no longer exists.
- **Position is stated as text** — "Step 2 of 4" — not only drawn as markers.
- **Advancing validates the current step only.** Validating the whole form reports
  problems the user has not reached.
- **A summary step precedes anything irreversible.**

---

## Review — `.dds-review`

**For:** the last screen before something happens.

- Show **every** value that will be submitted. A review that summarises
  selectively is worse than none, because it implies completeness.
- Each group gets its own "Change" control, returning to that step with the data
  intact, and **naming what it changes** — a list of eight controls all called
  "Change" is eight identical controls.
- The action names the consequence: "Submit application", not "Confirm".
- Say plainly whether it can be undone.

---

## Derived output — `.dds-derived`

**For:** a read-only value worked out from something the user entered — a bank name
from an account identifier, a region from a postcode, a total from a quantity.

**Behaviour:** `dds/js/patterns/derived-output.js`

The generalised form of a pattern every product grows two or three of, each built
wrong in the same few ways:

1. **The derived value rendered as an editable input.** It is output. An editable
   field invites a change, and then either the edit is silently discarded or two
   contradictory values are submitted. Render a `<dl>`.
2. **Not announced.** The value appears while focus is elsewhere, so nobody using a
   screen reader learns it exists. The output region is `aria-live="polite"` and
   `aria-atomic`.
3. **"Not yet resolvable" treated as an error.** A half-typed identifier is
   incomplete, not wrong. Resolution runs on `change`/blur, never on keystroke.
4. **Reference data shipped to the browser.** The resolver is asynchronous by
   contract precisely so the lookup can be a request.

A stale derived value beside a changed input is cleared immediately — leaving it
is worse than showing nothing, because the user believes it still matches.

### Resolver contract

```js
async function resolver(value, { signal }) {
  // → null           incomplete: no output, no error
  // → { fields: {} } resolved
  // → throw          complete but invalid; set error.userMessage
}
```

The three outcomes are distinct on purpose. Collapsing "incomplete" and "invalid"
is what produces an error message while someone is still typing.

---

## Authentication — `.dds-auth`

**For:** signing in, and recovering access.

**Behaviour:** `dds/js/patterns/auth.js` (the password reveal toggle).

**WCAG 2.2 3.3.8 Accessible Authentication (Minimum)** governs this, and it rules
out a lot of received practice:

- **No cognitive function test without an alternative.** Remembering a password
  counts, so the page **must** support a password manager: correct `autocomplete`
  tokens (`username`, `current-password`, `new-password`), no paste blocking, no
  code split across separate inputs, no field a manager cannot recognise.
- **Never block paste.** It breaks every password manager and pushes people toward
  passwords they can type — which are worse.
- **Offer a password reveal.** Typing a long password blind on a phone keyboard is
  exactly the barrier the criterion is about. A real `<button>` with
  `aria-pressed`, whose accessible name stays **constant** — a control whose name
  changes when pressed is announced as a different control each time.
- **A one-time code goes in ONE field** with `autocomplete="one-time-code"`, so the
  platform can offer it from the message. Six separate boxes look tidy and defeat
  autofill, paste and screen readers at once.
- **Never reveal whether an account exists.** Same response either way.
- The reveal toggle changes only `type`. Rewriting `autocomplete` is the usual
  reason a reveal toggle breaks password managers.

---

### Password reset — three steps

**Step 1, request.** One email field, `autocomplete="username email"`. The response is
identical whether or not an account exists — "If that address has an account, we have
sent a code", never "no account found". A reset form that distinguishes the two is a
free account-enumeration oracle: an address list can be tested against it to learn who
has an account, which for a health, legal or dating service is a disclosure in itself.
Match the response *time* too, or the difference is measurable.

**Step 2, the code. Never a clickable link.** A reset link is a bearer credential
sitting in an inbox: it gets forwarded, it gets pre-fetched by mail security tooling
which silently consumes single-use tokens, it appears in referrer headers and history,
and it opens in whichever browser the mail client prefers — usually not the one the
user was in. A typed code keeps the session where it started, survives a mail client
that strips links, and can be read out over the phone to someone who needs help.

The code is `[A-Za-z0-9]{6}` with `autocapitalize="characters"`, accepted in either
case, and `inputmode="text"` — **not `numeric`**, because a numeric keypad cannot type
letters and a code field that will not accept the code in it is a dead end on a phone.
Six digits is 10⁶ combinations; six alphanumerics is about 2×10⁹, which is what makes a
short code safe to leave valid for fifteen minutes. `.dds-input-code` sets a monospace
face with ligatures off so `0`/`O` and `1`/`l` are distinguishable when transcribing.
`autocomplete="one-time-code"` stays on it. One field, never six boxes.

**Step 3, the new password.** `autocomplete="new-password"` on **both** fields. Not
`off`, and not only on the first: that token is how a manager knows to generate and
then to save, and setting it on one field leaves the user retyping 24 random characters
into the other. `off` on either is worse than useless — browsers largely ignore it for
passwords, and where honoured it disables the manager rather than the autofill.

`minlength="12"` and nothing else. No character-class rules: they measurably push
people towards `Password1!` and are no longer recommended by NIST or the BSI.

The mismatch is announced once the confirmation is at least as long as the first entry,
or once the field is left — never on the second keystroke. "Passwords do not match" is
true of every confirmation field until the moment it is not, and saying so immediately
teaches people to ignore it. `role="status"`, not `role="alert"`: this is progress
feedback, not an interruption. The text is only written when it changes, or a screen
reader repeats it on every keypress. `setCustomValidity` carries the state so the
browser and the validation pattern agree — without it the form would submit with two
different passwords and only the message beside the field would have noticed.

Without JavaScript: two ordinary password fields, compared by the server, which has to
compare them anyway. The client-side check is a convenience and never the authority.

## Filtering — `.dds-filtering`

**For:** narrowing a list, and being able to tell what has been narrowed.

Composes the filter bar and chips with the results and empty states.

- **Applied filters are always visible as removable chips.** A short list with
  three invisible filters applied is the most common dead end in a filtered
  interface — the user concludes the data is missing.
- The result count is announced when it changes, politely and debounced.
- "No results" **names the active filters** and offers to clear them.
- **Filter state lives in the URL**, so a filtered view can be shared, bookmarked
  and returned to with the back button.
- Filters apply on change, **or** behind an explicit Apply button — never
  ambiguously both.

---

## Upload flow — `.dds-uploadflow`

**For:** choosing files, seeing them checked, and recovering from a rejection.

The upload component handles selection and listing. The flow adds:

- Per-file progress and a real way to cancel one in flight.
- A rejection that says **why and what to do**: "18 MB — the limit is 10 MB. Try a
  smaller file or split it." Not "Upload failed".
- One failure does not discard the others.
- Progress announced at intervals, not continuously. A live region updated per
  percent is unusable.

---

## Confirmation

Not a separate CSS pattern — it is the dialog component plus wording rules,
because the wording *is* the pattern.

- State what will happen and to how much: "This removes the project and its 47
  documents for everyone."
- Say whether it can be undone.
- **Never "Are you sure?"** — it asks for confirmation without giving the
  information to decide.
- The confirming button carries the verb; the cancelling one says what happens
  instead ("Keep project").
- The destructive button is **not** the default focus target.

---

## Adding a pattern

See [`recipes/new-pattern.md`](recipes/new-pattern.md).
