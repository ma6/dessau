# Recipe: build an accessible form

The most common thing a product builds, and the most commonly got wrong.

## 1. Each field

```html
<div class="dds-field">
  <label class="dds-label" for="email">
    E-Mail-Adresse <span class="dds-label-note">(erforderlich)</span>
  </label>
  <input class="dds-input" id="email" name="email" type="email"
         autocomplete="email" required
         data-dds-label="deine E-Mail-Adresse"
         aria-describedby="email-hint">
  <p class="dds-hint" id="email-hint">Nur zur Bestätigung der Anfrage.</p>
</div>
```

Non-negotiable:

- A **visible** `<label for>`. A placeholder is not a label.
- `autocomplete` — WCAG 1.3.5, and it is what most people actually use.
- Required in **words**, not an asterisk and not colour.
- The hint referenced by `aria-describedby`.
- `type` matching the data, so the right keyboard appears.

## 2. Group what belongs together

A radio group or a single-question checkbox group **needs** `<fieldset>` +
`<legend>`. Without it each option is announced with no idea what the question was.

## 3. Constraints in the markup

`required`, `type`, `minlength`, `maxlength`, `pattern`, `min`, `max`, `step`.

The browser evaluates them. Do not re-implement them in JavaScript — that is a
second rulebook that will drift from the first.

## 4. Turn on the validation pattern

```html
<form class="dds-form" data-dds-validate novalidate method="post" action="/submit">
```

You get: errors on submit only, then on blur for fields already flagged; a summary
at the top; focus moved to it; entries linking to their fields; matching wording;
errors clearing as soon as the correction is valid.

**Never validate while typing.** It tells people off for not having finished, and
they learn to ignore error styling — which is the styling you need them to read
later.

## 5. Word the errors

**What is wrong**, then **what to do**.

> "Gib eine E-Mail-Adresse ein, zum Beispiel name@example.org"

Not "Ungültige Eingabe". Say whether their input survived. Override per field with
`data-dds-error-<constraint>`.

## 6. Conditional fields

`data-dds-reveal` + the `hidden` attribute. Never CSS-only hiding — it leaves
invisible tab stops. Do not move focus into the revealed region.

## 7. Formats

`DDS.format`. German by default: `1.234,56 €`, `01.08.2026`, `14:30 Uhr`. Parse
with `DDS.format.parseNumber()`, never `parseFloat`.

## 8. Long forms

Sticky `.dds-actionbar`, and `.dds-actionbar-host` on the scrolling ancestor so the
bar never covers a focused field (WCAG 2.2 2.4.11).

Genuinely sequential? Use the wizard — one URL per step server-side if the data
matters.

## 9. Authentication

Read `agent/patterns.md` → Authentication first. WCAG 2.2 3.3.8 rules out blocking
paste, splitting a one-time code across inputs, and any field a password manager
cannot recognise.

## 10. Verify

- Submit it empty. Is every problem listed, is focus on the summary, does each
  entry jump to its field?
- Fix one field. Does its error clear immediately?
- Keyboard only, start to finish.
- Screen reader, start to finish. Does the summary announcement make sense?
- **Disable JavaScript.** Does it still submit and validate server-side?
- 320px and 400% zoom.
- Both themes.
