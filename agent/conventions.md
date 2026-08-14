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
