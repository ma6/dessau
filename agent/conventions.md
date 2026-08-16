# Conventions

Naming, and the code style that follows from it.

---

## Namespace

Everything is `dds`. Never `ds-`, `dx-`, `ui-`, or unprefixed.

| Kind | Form | Example |
| --- | --- | --- |
| CSS class | `.dds-<component>[-<part>][-<variant>]` | `.dds-button-primary`, `.dds-dialog-footer` |
| Custom property — primitive | `--dds-<family>-<step>` | `--dds-indigo-600`, `--dds-space-md` |
| Custom property — semantic | `--dds-color-<role>[-<state>]` | `--dds-color-action-primary-hover` |
| Component-local property | `--dds-<component>-<thing>` | `--dds-button-padding-inline` |
| Data attribute | `data-dds-<feature>` | `data-dds-dialog-open`, `data-dds-validate` |
| JavaScript | `window.DDS.<thing>` | `DDS.enhance`, `DDS.toast`, `DDS.format` |
| Icon symbol | `#dds-icon-<role>` | `#dds-icon-error` |
| Reference-only | `.ref-*`, `data-ref-*` | `.ref-specimen`, `data-ref-bp` |

`ref-` exists so nothing in the documentation chrome can be mistaken for part of
the system.

### Class name structure

```
.dds-card              the component root
.dds-card-raised       a variant of the root
.dds-card-compact      another variant
.dds-card-header       a part of it
.dds-card-target       a part with a specific role
```

No BEM `__` or `--`. A single hyphen throughout: it is shorter, and the
distinction between element and modifier is carried by the words, which is where a
reader looks anyway.

### Naming by role, not by appearance

`--dds-color-action-primary`, not `--dds-color-blue`.
`#dds-icon-error`, not `#dds-icon-alert-circle`.
`.dds-notice-warning`, not `.dds-notice-yellow`.

A name describing appearance is a name that becomes a lie the first time the
appearance changes — and then either the lie persists or every call site changes.

---

## CSS

### Every rule lives in a layer

```css
@layer dds.components {
  .dds-thing { … }
}
```

Never write CSS outside a layer inside `dds/`. Never write `!important` — if
something seems to need it, the layer order is wrong.

### Logical properties, always

| Use | Not |
| --- | --- |
| `inline-size`, `block-size` | `width`, `height` |
| `margin-inline`, `padding-block` | `margin-left/right`, `padding-top/bottom` |
| `inset-inline-start`, `inset-block-end` | `left`, `bottom` |
| `border-inline-start` | `border-left` |
| `text-align: start` | `text-align: left` |
| `border-start-start-radius` | `border-top-left-radius` |

A right-to-left locale then needs no separate stylesheet. It costs nothing to
write and is expensive to retrofit.

### Component-local properties for anything adjustable

```css
.dds-button {
  --dds-button-padding-inline: var(--dds-space-md);
  padding-inline: var(--dds-button-padding-inline);
}

.dds-button-sm {
  --dds-button-padding-inline: var(--dds-space-sm);
}
```

A variant sets the property rather than re-declaring the rule. An instance can be
adjusted without a new class, and the component stays one rule.

### State from the platform

`:disabled`, `:checked`, `:invalid` (with care), `[aria-expanded]`,
`[aria-invalid]`, `[aria-selected]`, `[open]`, `[hidden]`, `:focus-visible`,
`:has()`.

An `.is-*` class is a last resort. Reading state from the DOM means the visual
state and the announced state cannot drift apart, which is the bug class this
avoids.

**Exception: never style validity from `:invalid`.** It matches from page load, so
a required field looks wrong before anything was typed. Use `aria-invalid`, set by
the application.

### `:where()` for element defaults

```css
:where(h1, h2, h3) { … }
```

Zero specificity, so overriding a base style never means matching a selector
chain.

### Comments explain *why*

```css
/* `outline` rather than `box-shadow`: outline follows the element's shape, never
   affects layout, and is preserved in forced-colors mode where box-shadow is
   discarded. */
```

Not "sets the outline". The value is in the reasoning — a rule with its reasoning
survives the next person who finds it inconvenient.

### File order within a file

A header comment with a section index, then sections in a stable order, each with
a banner comment. A component's own comment states what it is for, when **not** to
use it, and anything non-obvious about its accessibility.

---

## JavaScript

### Style

- ES5-compatible syntax in `dds/js/` — `var`, `function`, no arrow functions, no
  template literals, no optional chaining. It ships to browsers with no build
  step, and there is nothing here that a modern syntax would make meaningfully
  clearer.
- `'use strict'` and an IIFE per file.
- ES modules and modern syntax **are** used in `scripts/`, which runs on Node.
- Two-space indent, semicolons, single quotes.

### Every file is a progressive enhancement

```js
DDS.register('thing', '[data-dds-thing]', function (element) { … });
```

- Idempotent: an element is enhanced at most once per name.
- Re-runnable: `DDS.enhance(root)` after inserting markup is the whole integration
  for dynamic content.
- Fails safe: one broken enhancement is caught and logged; the others still run,
  and the element keeps whatever its markup already did.

### Set behavioural ARIA from the script, not the markup

Attributes that describe JavaScript behaviour — `role="combobox"`,
`aria-expanded`, `aria-activedescendant` — are applied by the script. An input
advertising a combobox with no list to expand is a worse starting point than a
plain text input.

Attributes that describe **structure** — `aria-labelledby`, `aria-describedby`,
`scope`, `aria-current` — belong in the markup, because they are true whether or
not the script runs.

### An element the script inserts carries `data-dds-generated`

Anything a script creates and puts **inside authored markup** says so:

```js
badge.setAttribute('data-dds-generated', '');
```

Two things read it. A person opening dev tools, who can otherwise only find out
by searching the source for a class. And the reference's code view, which
serialises its markup sample from the live DOM and therefore has no other way to
tell the author's markup from the script's — it strips every marked element, in
one rule, for every component including the ones not written yet.

Without it the sample offers generated markup as something to type, which is the
exact opposite of what generating it was for. The lightbox's magnifier badge is
built by `components-content.js` *because* promising a viewer that does not exist
would be a lie, and the sample was inviting authors to hard-code it (#88).

**Not on a wrapper.** `.dds-password` and the table's scroll region enclose the
author's own control; marked, they would take it with them when stripped. The
marker means "this element is not the author's", which a wrapper around the
author's element is not.

Whole widgets appended to `<body>` — a dialog, a toast region — need no marker.
They are not inside anybody's markup.

### Text goes in with `textContent`

Never `innerHTML` for a value from outside the application. The one place that
cannot use it — highlighting a matched substring — takes the run from the
**source** text rather than the query, so no user input is reflected back.

### Announce, do not assume

Any state change a sighted user can see and a screen-reader user cannot needs
`DDS.announce()`. Politely, unless the user must know immediately. Debounce
anything driven by typing.

### Abort in-flight work

Anything asynchronous and re-triggerable uses `AbortController`. Without it a slow
earlier response lands after a fast later one and overwrites it — a bug that only
appears on a slow connection.

### Wording follows `lang`

Any string a script puts on the page — an accessible name, an announcement — takes
its language from `DDS.utils.language(element)`, which reads the nearest `[lang]`.

**Never a `data-dds-*` attribute naming a language.** The document already states
it, and `lang` is not optional markup: a screen reader picks its voice and
pronunciation rules from it (WCAG 3.1.1). A second place to say it is a second
place for it to be wrong, and the failure is silent in the worst way — a German
accessible name spoken by an English voice. Both the theme toggle and the password
reveal used to take a language code in their own attribute; neither does now.

`closest`, not `documentElement`: a part of a page may be in another language and
has to say so anyway (WCAG 3.1.2 Language of Parts), so a control inside that part
is spoken in that language. Region subtags are dropped — `de-AT` is `de`. An
unrecognised language falls back to English, because a control named in the wrong
language still beats one with no name.

A table of strings per language lives beside the behaviour that uses them, and
**every** string in it varies together. A label from the table joined to a
sentence written in the code is how one announcement ends up half-translated.

This is now universal rather than aspirational: every string DDS writes comes
from such a table, in `en` and `de`, resolved by `DDS.utils.wording(element,
TABLE)`. Adding a third language is a data change and nothing else — that is the
property the tables exist to have, so keep it.

Three rules follow from the tables being complete phrases:

- **An entry that contains a value is a function**, not a prefix the caller
  prepends. `'Remove ' + name` cannot be German, where the verb goes last. If the
  code decides where the value sits in the sentence, the sentence is only
  translated as far as its nouns.
- **A count goes through `DDS.utils.plural`**, never `n === 1 ? … : …`. English
  and German agree about where the boundary is, which is exactly why the ternary
  survives review — it is correct in both languages anybody here checks. Russian
  has four categories.
- **Resolve from the element the words are about.** An error message reads the
  FIELD's language, not the form's: a form may hold a part in another language
  and has to say so anyway (WCAG 3.1.2), so the field inside it is spoken in that
  language and the error about it must be too. Only something genuinely raised
  about the page as a whole — a toast — reads `documentElement`.

---

## HTML

- Semantic element first. `<div>` only when nothing else fits.
- Attribute order: `class`, `id`, `type`/`href`/`src`, `name`, `value`, then
  `data-*`, then `aria-*`. Not enforced; consistent enough to read.
- Every form control has a `<label for>`. Every `id` is unique.
- Every `<iframe>` has a `title`.
- Decorative SVG is `aria-hidden="true"`.
- `hidden` for hiding — it removes the element from the tab order and the
  accessibility tree. Never CSS alone.

---

## Reference specimens

The reference pages have three tools, each one attribute (`reference-tools.js`):

| Attribute | What it builds |
| --- | --- |
| `data-ref-bp` | A width switcher around the specimen |
| `data-ref-variants="<axis>"` | A segmented control over `[data-ref-variant]` children |
| `data-ref-code` | "Show markup", generated from the live DOM |

**Variants that differ in content or behaviour are switched, not stacked.** Where
a component has two to five variants that change its layout, its wording or what
it does, the specimen wraps them in `data-ref-variants` and lets a segmented
control choose between them:

```html
<div class="ref-specimen" data-ref-code>
  <p class="ref-specimen-label">Text-media</p>
  <div data-ref-variants="Layout">
    <div data-ref-variant="Media trailing">…</div>
    <div data-ref-variant="Media leading">…</div>
  </div>
</div>
```

`.ref-matrix` remains right for the other case: small state variations — sizes,
tones, disabled — where seeing them all at once *is* the comparison. The dividing
question is whether the reader compares them side by side or one after the other.
A variant that is a whole layout is the second kind, and three of those in a
column put the difference between them outside the viewport.

The code view serialises the visible variant only, and re-serialises when the
choice changes. Anything carrying a `ref-` class or a `data-ref-*` host attribute
is reference scaffolding and never reaches the sample.

---

## Files

- `kebab-case.css`, `kebab-case.js`, `SCREAMING_SNAKE.md` for root documents,
  `lower-case.md` inside `agent/` and `docs/`.
- **Never `token` in a filename.** The agent sandbox denies those paths and the
  failure is silent — a write appears to succeed and lands on a device file. Name
  the layer instead: `primitives`, `semantic`, `foundations`. See
  `LESSONS_LEARNED.md`.
- Generated files say so in their first lines, and name the script that makes
  them.

---

## Commits

```
<type>(<scope>): <what changed>
```

`feat` · `fix` · `refactor` · `docs` · `chore` · `test`

Scope is the area: `tokens`, `components`, `patterns`, `a11y`, `agentic`, `css`,
`forms`, `combobox`, `icons`.

```
feat(patterns): add derived output pattern
fix(combobox): abort in-flight request on new query
docs(a11y): document WCAG 2.2 additions
refactor(css): move overlay values into semantic layer
```

One purpose per commit. Leave Dessau working. Include the documentation the change
needs — a specification that lags its code is a specification nobody can trust.

Every message ends with:

```
AI-assisted change (Claude Code)

Co-Authored-By: Claude <noreply@anthropic.com>
```
