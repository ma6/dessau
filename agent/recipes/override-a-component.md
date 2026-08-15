# Recipe: adapt a component Dessau already ships

This is the common job. `new-component.md` is for something that does not exist;
this is for the header that exists and is the wrong colour.

**Nothing here needs `!important`, and nothing here needs a fork.** If you reach
for either, the answer is one of the four steps below and you have skipped it.
Copying a component's CSS into your repository is the expensive mistake: from that
day on, every Dessau update is a merge instead of a submodule bump, and the copy
diverges silently because nothing compares them.

The site header is the worked example throughout. It is
`.dds-siteheader-frame` · `.dds-siteheader` · `-brand` · `-toggle` · `-actions`,
plus `.dds-primary-nav`.

## 0. Check you are overriding the right component

Before anything: a site header moves people **between pages** — brand, primary
navigation, search. `.dds-topbar` names the **current context** in an application
and holds the actions for it. `agent/components.md` puts the consequence of
confusing them plainly: you get either a marketing site that feels like an admin
tool, or an admin tool where the user cannot tell what they are editing.

Restyling a header into a topbar is the wrong fix for wanting a topbar.

## 1. Scope a token to the subtree — try this first

Custom properties inherit. A token set on the component's own element re-themes
everything inside it, including the parts you did not think to list:

```css
.dds-siteheader-frame {
  --dds-color-surface-default: #101418;
  --dds-color-border-subtle:   transparent;
}
```

Nothing structural is overridden, so nothing structural can break. **Most "I have
to override the header" cases are this one**, and it is the step people skip
because it does not feel like enough work.

**Per theme, always.** A single unlayered `:root`-style override beats both of
DDS's theme blocks — including the dark one — and flattens dark mode silently. Use
the shape DDS uses:

```css
.dds-siteheader-frame                       { --dds-color-surface-default: #f7f5f2; }
[data-theme="dark"] .dds-siteheader-frame   { --dds-color-surface-default: #101418; }
```

## 2. Override declarations — unlayered wins, with no fight

Your stylesheet loads last and unlayered, and **unlayered CSS beats every cascade
layer regardless of specificity**:

```css
.dds-siteheader { padding-block: 0; gap: 2rem; }
```

That is the whole mechanism. A plain class selector wins over `dds.components`
without `!important` and without escalating specificity. See
`agent/architecture.md` → The cascade layers; if something appears to need
`!important`, the layer order is what is wrong, not your selector.

**The trap: container queries.** `.dds-siteheader-frame` carries
`container-type: inline-size` and `container-name: dds-siteheader`, and the rule
that puts the navigation inline above 48rem is
`@container dds-siteheader (inline-size >= 48rem)`. Override the layout in a way
that removes or replaces that element and the query stops matching — the
navigation simply never expands, at any width, with no error anywhere.

If you restructure, keep the container. If you replace the frame, declare
`container-type` and `container-name` on whatever takes its place.

## 3. Replace the component, keep the contract

The architectural fact that makes this cheap: **styling hangs on `.dds-*` classes,
behaviour hangs on `data-dds-*` attributes, and the two are independent.** The
header disclosure is registered as

```js
DDS.register('nav-toggle', '[data-dds-nav-toggle]', …)
```

— no class in the selector. So you may drop `.dds-siteheader` entirely, write
`.my-header`, keep `data-dds-nav-toggle`, and the behaviour still works. Or keep
the classes and implement the behaviour yourself. Neither direction needs the
other's permission.

What you carry over is the **accessibility contract**, which is not styling:

- **One navigation, in one place in the DOM.** A separate mobile menu is a second
  copy that drifts, and a screen reader announces both.
- **A disclosure, not a menu** — `aria-expanded` plus `aria-controls`, and
  explicitly **not** `role="menu"`.
- **Collapsed navigation uses the `hidden` attribute**, not `display: none`, so
  there are no invisible tab stops.
- **`aria-current="page"` on the current page**, and the active state carries more
  than colour — it is the only way a screen-reader user knows where they are.

`agent/components.md` is the source for this per component. Read the entry for
whatever you are replacing rather than generalising from the header.

## 4. What not to do

- **Do not fork the CSS into your repository.** Every update becomes a merge, and
  the copy diverges without anything noticing.
- **Do not restyle a `.dds-*` class to mean something else.** A `.dds-siteheader`
  that is no longer a site header breaks every agent reading `AGENTS.md` and every
  future update — and it fails nothing today, which is what makes it expensive.
  Use your own class name for your own component.
- **Do not use `!important`.** It is a sign step 2 was applied wrongly, not a tool.
- **Do not delete the accessibility attributes because the styling changed.** They
  are the part that was never about looks.

## The short version

| How far you are going | The move |
| --- | --- |
| Colour, tone, elevation | Scope a token to the component (step 1) |
| Spacing, size, layout | Unlayered declarations (step 2) |
| Genuinely different structure | Your own class, Dessau's contract (step 3) |

Escalate only when the cheaper step cannot do it. Each step down the table costs
more to maintain across updates than the one above it.
