# Principles

Non-negotiable. These outrank convenience, visual preference, deadline and any
individual opinion — including a well-argued one.

Where a principle and a piece of external guidance conflict, the principle wins
and the conflict is recorded in `DECISIONS.md`.

---

## 1. Accessibility is a constraint, not a review step

**WCAG 2.2 AA is the floor.** Not a target, not a phase, not something checked at
the end.

A design that requires falling below it is a design that changes. There is no
trade-off conversation to have here, for the same reason there is no trade-off
conversation about whether a form submits: an interface some people cannot use is
not finished.

Practical consequences:

- Contrast is **calculated**, never estimated. `node scripts/check-contrast.mjs`.
- Every interactive element is keyboard operable and visibly focused.
- Status, selection and error are never signalled by colour alone.
- Every control has a programmatically associated label.
- Motion respects `prefers-reduced-motion`; the switch is global, not per
  component, because a component that forgets can genuinely make someone ill.

Full requirements: [`accessibility.md`](accessibility.md).

> Accessibility is structural. It is decided by the markup and the tokens, which
> is why it is cheap here and expensive later.

## 2. Semantic HTML first

A `<button>` is a button. A `<table>` is a table. A heading level reflects
document structure, not type size.

**ARIA supplements semantics; it never replaces them.** `role="button"` on a
`<div>` is a bug, not a technique — it has no keyboard behaviour, no form
participation, and no forced-colors rendering, and every one of those has to be
rebuilt by hand and usually is not.

The first rule of ARIA is that not using ARIA is better than using it wrongly.

## 3. Progressive enhancement, always

**The markup works before JavaScript runs.**

If `dds.js` fails to load — a bad network, a blocked CDN, an old browser, a
script error three files up — the page still functions. Forms submit. Content is
readable. Links navigate. `<details>` still opens.

JavaScript adds behaviour the platform does not provide. It is never what makes a
page work. This is why there are no Web Components in Dessau: a custom element
that has not upgraded yet renders as nothing.

Concretely, for every pattern: what does a person get with no JavaScript? If the
answer is "nothing", the pattern is wrong.

## 4. Native before custom

Use the platform's element if one exists.

`<dialog>` with `showModal()`. `<details>` and `<summary>`. `<select>`.
`<progress>`. `<input type="file">`. The Constraint Validation API. The `popover`
attribute. `accent-color`. `Intl`.

A native control brings correct keyboard behaviour, platform conventions,
forced-colors support, assistive-technology support, and correctness in a
language nobody on the project has tested. A custom replacement gives up all of
that, and the reason is usually that an arrow looked wrong.

Replacing a native control requires documenting **what it gains and what it gives
up**. It always gives up something.

> **native before custom · HTML before JavaScript · simple before clever**

## 5. Semantic values only

Components consume the **semantic** layer: `--dds-color-action-primary`.

Never a primitive (`--dds-indigo-600`), never a raw value (`#4649b8`, `12px`).

This is not tidiness. A primitive is theme-independent, so a component using one
renders correctly in light mode and is wrong in dark mode — and only in dark
mode, which is where nobody looks first. `node scripts/check-css.mjs` enforces
it.

## 6. One namespace, used consistently

`dds` everywhere: `.dds-button`, `--dds-color-*`, `data-dds-*`, `window.DDS`.

Never `ds-`, `dx-`, `ui-`, or an unprefixed class. A product's own styles use the
product's namespace and never redefine a `.dds-*` rule — the cascade layers mean
they never need to.

## 7. Never colour alone

Every status, selection, error and current-state carries **text or an icon as
well as** colour (WCAG 1.4.1). Emphasis changes fill or weight, not only hue.

The system is designed so this holds in greyscale, under forced colours, and for
the roughly one in twelve men who sees red and green differently. If a state is
only distinguishable by tint, it is not distinguishable.

## 8. Extend before duplicating

Search [`index.json`](index.json) first.

A second button style is a defect, not a variant. If an existing component is
close but not right, extend it or add a variant to it. Creating a parallel
component is how a design system becomes a junk drawer, and the second one is
always slightly less accessible than the first.

## 9. Component or Pattern — decide deliberately

A **Component** is one reusable building block with one purpose.
A **Pattern** combines components and behaviour to solve a recurring user task.

The distinction is kept explicit in code, documentation and this context, because
it is the question that decides where new work goes. Getting it wrong is how a
system ends up with a "component" that knows about addresses.

See [`architecture.md`](architecture.md).

## 10. Reusable complexity belongs in Patterns

Dessau is **not** reduced to atomic components.

Address search, autocomplete, filtering, validation, multi-step forms,
progressive disclosure, loading, empty, error and confirmation states are the
hard, valuable, repeatedly-rebuilt parts of a product. They belong in the system,
generalised, with their accessibility work done once.

A system of only buttons and inputs pushes all the difficulty into every product
that consumes it — which is the difficulty it existed to absorb.

## 11. Keep technology understandable

Semantic HTML, modern CSS, vanilla JavaScript, no build step, no runtime
dependencies.

No React, Vue, Angular, Svelte, Stencil, Storybook, bundler or CSS framework
without a compelling need documented in `DECISIONS.md` first.

The reason is longevity, not minimalism. A foundation is supposed to outlive the
products built on it and the fashions around it. Every dependency is a future
migration, and a foundation that needs migrating is a foundation nobody trusts to
start from.

## 12. Write down the reasoning

`DECISIONS.md` for lasting architectural decisions. `LESSONS_LEARNED.md` for
reusable experience from real product work — not a bug tracker.

A decision without its reasoning gets reversed by the next person who finds it
inconvenient. Recording *why* is what makes a constraint survive contact with a
deadline.

## 13. No invented process

Dessau is maintained by one person. No peer approval, no four-eyes rule, no
mandatory pull request, no release gate, no approval board, no simulated team
roles.

Optimise for quality, not for the appearance of governance. Branches and pull
requests are tools for risky changes, not ceremony — work happens on `main`, and
`DECISIONS.md` 032 records the three cases where a branch is nonetheless the right
tool, and why branching would not prevent conflicts here anyway.

---

## Design principles

The visual and interaction character, as distinct from the rules above.

1. **Clarity over density.** Generous spacing, one reading measure (~68
   characters) for running text. Scannable parallel material — card grids,
   dashboards, wide tables — may deliberately be wider, because it is skimmed
   rather than read line by line. Narrow is the default; wide is a justified
   exception, never an accident.

2. **One state, one signal — never colour alone.** See principle 7.

3. **One interactive hue.** A single colour carries every interactive
   affordance, so colour starts to mean "you can act on this". The accent is
   decorative and never actionable; status colours are never decorative.

4. **Fully functional at every size.** No feature is removed on a small screen.
   With more width comes more density and parallelism, not more capability.

5. **Components respond to their container, not the window.** A component has to
   work inside a narrow column, a dialog and a preview stage — not only on the
   page it was written for. See [`responsive.md`](responsive.md).

6. **Motion reports, it does not decorate.** Short durations. Motion shows a
   state change or where something came from. It is never the point of interest,
   and it is always optional.

7. **Clear over clever, in words too.** One idea per sentence, active voice,
   concrete terms. One concept, one term. Describe what the reader does or
   experiences, not what the system does. See
   [`ux-writing.md`](ux-writing.md).

---

## The Bauhaus reference, precisely

Dessau takes its bearing from the idea Gropius put as *"Art and technology — a
new unity"*: design, craft, systems, technology and production treated as one
problem rather than five.

**It is not a Bauhaus-themed interface.** No primary-colour geometry, no
historical pastiche, no decorative circles and triangles. The influence appears
as clarity, reduction, consistency and systems thinking — and as the belief that
how a thing is made is part of how well it is designed.

---

> **Every project should leave Dessau better than it found it.**
