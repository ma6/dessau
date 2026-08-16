# Recipe: add a component

## 0. Check it does not exist

```bash
grep -i '<name>' agent/index.json
```

**Extending what exists is always correct; adding a near-duplicate never is.** A
second button style is a defect. If something is close but not right, add a variant
to it.

## 1. Confirm it is a Component, not a Pattern

Apply the tests in `agent/architecture.md`. Briefly: does it render sensibly with
no task in mind? Does describing it need the word "then"? Does it own asynchronous
behaviour, focus management or announcements?

If any of the last three, it is a Pattern.

## 2. Check the platform first

Is there an element for this? `<dialog>`, `<details>`, `<select>`, `<progress>`,
`<input type=…>`, `popover`. Invoke the `modern-web-guidance` skill and ask
directly.

A native control brings keyboard behaviour, platform conventions, forced-colours
support and assistive-technology support. Replacing one requires documenting what
it gains and what it gives up — and it always gives up something.

## 3. Write the markup first

Semantic HTML, working, with no CSS and no JavaScript. If it does not work here, no
amount of either will fix it.

Labels, `scope`, `aria-labelledby`, `aria-describedby`, `hidden` — the structural
attributes that are true whether or not a script runs.

## 4. Then the CSS

In the right file (`agent/architecture.md` → Where does my change go?), inside
`@layer dds.components`.

- Semantic values only.
- Adjustables as component-local custom properties, so a variant sets a property
  rather than re-declaring a rule.
- Logical properties.
- State from the platform: `:disabled`, `:checked`, `[aria-expanded]`, `:has()`.
- Never colour alone — fill or weight changes too.
- A `-frame` layer if a container query needs one.
- Forced-colours handling if the state relied on a fill.
- Comments explaining **why**.

## 5. Then behaviour, only if the platform lacks it

`DDS.register(name, selector, setup)`. Idempotent, re-runnable, fails safe.
Behavioural ARIA set here, not in the markup. Announce anything a sighted user sees
and a screen-reader user does not.

## 6. Document it

Three places, in the same commit:

1. `agent/components.md` — purpose, when **not** to use it, markup, states,
   accessibility.
2. `agent/index.json` — the entry.
3. `reference/<page>.html` — every variant and state, with `data-ref-code`, plus
   `data-ref-bp` if it has width-dependent behaviour, plus a `.ref-note` describing
   that behaviour, plus do/don't guidance where misuse is likely.

Variants that differ in **content or behaviour** — a different layout, different
wording, a different thing done — go behind a segmented control rather than down
the page: `data-ref-variants="<axis>"` on the specimen, `data-ref-variant="<label>"`
on each one. `.ref-matrix` is for the other case, where the variants are small
state variations and seeing them together *is* the comparison. See
[`../conventions.md`](../conventions.md) → Reference specimens.

## 7. Verify

```bash
node scripts/check-contrast.mjs
node scripts/check-css.mjs
node scripts/check-agent-index.mjs
node scripts/sync-icons.mjs
```

Then `agent/definition-of-done.md`, in full.

## 8. Commit

```
feat(components): add <name>
```

Code, specification, index entry and reference page **together**.
