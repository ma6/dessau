# Architecture

Where things belong, and how to decide.

---

## The layer model

```
Principles  →  Foundations  →  Components  →  Patterns  →  Products
```

Each layer depends **only** on the ones before it. Nothing downstream introduces
a value that does not exist upstream.

That one-way dependency is what keeps the system coherent as it grows. Break it
and you get the failure mode every design system dies of: a component with a
hardcoded colour, a pattern with its own spacing scale, and no way to change
anything in one place.

| Layer | Contains | Must not |
| --- | --- | --- |
| Principles | Non-negotiable rules | — |
| Foundations | Primitive + semantic values | Know about components |
| Components | Reusable building blocks | Invent a value; know a task |
| Patterns | Compositions solving a task | Invent a value or a component |
| Products | Actual pages and flows | Redefine a `.dds-*` rule |

---

## Component or Pattern?

The question that decides where new work goes.

### Component

One reusable building block with **one purpose**. It has variants, sizes and
states, and it **does not know what task it is being used for**.

> button · field · checkbox · radio · switch · select · badge · card · dialog ·
> table · tabs · disclosure · avatar · chip · stepper · segmented control

### Pattern

Components **plus behaviour**, solving a **recurring user task**. It owns what a
single element cannot: focus order, live announcements, request lifecycle, error
recovery, and the fallback when the clever path fails.

> address search · autocomplete · form validation · search and results ·
> filtering · multi-step form · conditional fields · derived output ·
> authentication · upload flow

### The tests

Apply in order. The first one that answers, answers.

1. **Does it render sensibly in isolation, with no task in mind?**
   Yes → Component. A button is a button with no context.

2. **Does describing it require the word "then"?**
   "The user types, *then* results appear, *then* selecting one fills the
   fields." → Pattern.

3. **Does it own asynchronous behaviour, focus management or live
   announcements?**
   → Pattern. Those are exactly the concerns a single element cannot hold.

4. **Would two different products use it for two different tasks?**
   Yes → Component. No → Pattern.

5. **Does it talk to an external service?**
   → Pattern, and the service goes behind a provider interface.

### Worked examples

| Thing | Which | Why |
| --- | --- | --- |
| Text input | Component | No task attached |
| Combobox | Pattern | Query lifecycle, `aria-activedescendant`, announcements |
| Address search | Pattern | Combobox + fields + provider + fallback |
| Dialog | Component | A container; the platform owns the behaviour |
| Confirm before deleting | Pattern | Dialog + wording + focus + consequence |
| Table | Component | Presents rows; task-agnostic |
| Search and results | Pattern | Four states, announcements, request lifecycle |
| Error message | Component | One labelled message |
| Form validation | Pattern | When to show, summary, focus, recovery |
| Chip | Component | A removable token |
| Filtering | Pattern | Chips + controls + results + empty + URL state |

### The failure mode to avoid

A "component" that knows about addresses. A "pattern" that is really just a
styled box. Both happen when the decision is made by file size rather than by
the tests above.

---

## Repository layout

```
dessau/
├── AGENTS.md                    agent entry point
├── CLAUDE.md                    → points at AGENTS.md
├── DECISIONS.md                 lasting architectural decisions
├── LESSONS_LEARNED.md           reusable experience
│
├── agent/                       the Agentic Version
│   ├── index.json               machine-readable inventory
│   └── recipes/                 step-by-step procedures
│
├── dds/                         THE IMPLEMENTATION — source of truth
│   ├── dds.css                  entry; declares the cascade layer order
│   ├── foundations.json         generated export for non-CSS consumers
│   ├── css/
│   │   ├── primitives.css       literal values — never consumed by components
│   │   ├── semantic.css         intent — what components consume
│   │   ├── base.css             element defaults, focus, motion, forced colours
│   │   ├── typography.css       type utilities, reading measure
│   │   ├── layout.css           six layout primitives
│   │   ├── components.css       core building blocks
│   │   ├── components-forms.css     stepper, segmented, upload, range, count
│   │   ├── components-navigation.css header, footer, breadcrumb, steps, menu…
│   │   ├── components-content.css    quote, teaser, facts, charts, embeds…
│   │   ├── patterns.css         combobox, address search, form, results…
│   │   ├── patterns-flows.css   wizard, derived output, review, auth, filtering
│   │   └── utilities.css        single-purpose helpers
│   ├── js/
│   │   ├── theme-init.js        BLOCKING, in <head> — theme before first paint
│   │   ├── dds.js               core: register / enhance / announce / theme
│   │   ├── format.js            Intl-based formatting, de-DE default
│   │   ├── components*.js       component behaviour
│   │   ├── patterns/            pattern behaviour
│   │   └── providers/           replaceable external-service adapters
│   └── icons/icons.svg          generated from Ionicons
│
├── docs/                        human-facing reasoning
├── reference/                   rendered proof (the live pages)
└── scripts/                     zero-dependency verification tooling
```

---

## Where does my change go?

| Change | File |
| --- | --- |
| A new colour, size, duration | `dds/css/primitives.css` **and** a role in `semantic.css` |
| A new meaning for an existing value | `dds/css/semantic.css` only |
| Element default, focus, motion, forced colours | `dds/css/base.css` |
| A layout arrangement used more than once | `dds/css/layout.css` |
| A reusable building block | the matching `components*.css` + `agent/components.md` |
| A composition solving a task | `patterns*.css` + `agent/patterns.md` |
| Behaviour the platform lacks | `dds/js/components*.js` or `dds/js/patterns/` |
| An external service | `dds/js/providers/` behind an interface |
| Locale-specific formatting | `dds/js/format.js` |
| Documentation tooling (demo frames, previews) | `reference/assets/` — **never** `dds/` |
| Why a decision was made | `DECISIONS.md` |
| What was learned the hard way | `LESSONS_LEARNED.md` |

**`reference/assets/` versus `dds/`** is worth being strict about. A component
demo frame, a width switcher and a code viewer are documentation concerns. Put
them in `dds/` and every product carries them forever.

---

## The cascade layers

Declared in `dds/dds.css`, before any layer has content, so the order is fixed
regardless of load order:

```css
@layer dds.reset, dds.foundation, dds.base, dds.typography,
       dds.layout, dds.components, dds.patterns, dds.utilities;
```

This is the most consequential decision in the CSS, and it is what a product
gets for free:

- **Unlayered CSS always beats layered CSS.** A product's own stylesheet
  overrides anything in DDS with no `!important` and no specificity escalation.
  A plain `.my-thing { padding: 0 }` wins over `.dds-card` automatically.
- Inside DDS, a component can use a low-specificity selector without being
  accidentally overridden by a utility. The layer decides, not selector weight.
- `:where()` throughout `base.css` keeps element defaults at zero specificity, so
  overriding a base style never means matching a selector chain.

The practical effect: consumers stop fighting the cascade, which is the most
common reason a design system gets abandoned.

**Therefore: never write `!important` in DDS.** If something needs it, the layer
order is wrong.

---

## The JavaScript model

```js
DDS.register(name, selector, setup)   // register an enhancement
DDS.enhance(root)                     // apply enhancements in a subtree
DDS.announce(message, options)        // speak to assistive technology
DDS.theme                             // read / set / observe the theme
```

Markup exists first and works first. JavaScript finds elements that opted in via
a `data-dds-*` attribute and adds behaviour the platform does not provide.

Enhancement is **idempotent and re-runnable**: `DDS.enhance(element)` after
inserting markup is all a server-rendered, HTMX, Turbo or framework-driven
product needs. There is no lifecycle to hook into and nothing to tear down.

### No Web Components

A deliberate architectural decision, not an omission:

- Shadow DOM encapsulates away the custom properties the entire token
  architecture depends on.
- A custom element that has not upgraded renders as **nothing** — the opposite of
  progressive enhancement.
- It forces a shared JavaScript runtime on every consumer, including the ones
  that render on the server.

What is shared is the **CSS and token layer plus reference markup including
ARIA**. Behaviour is offered — `dds/js/` is genuinely usable — but never
required. A product may reimplement any behaviour in its own idiom and keep
identical markup and styling.

---

## External services

Anything that talks to a service goes behind a **provider**: one object with one
method, documented as an interface.

The reference case is `dds/js/providers/address-provider.md`. The reasoning
generalises: a third-party service is always specific to a country or a contract,
and it will be replaced at least once during a product's life. Everything
genuinely reusable — the interaction, the keyboard handling, the announcements,
the fallback to manual entry — lives in the pattern; everything specific lives
behind the interface.

A provider must:

- return a promise, even when resolving synchronously;
- honour an `AbortSignal`, so a slow earlier response cannot overwrite a fast
  later one;
- **reject** on failure rather than resolving empty, so "the service is down" and
  "there is no such thing" can be worded differently;
- never be required for the task to be completable by hand.

---

## Verification is part of the architecture

Several classes of failure in this system are **silent** — no console error, no
broken layout, no failing test, just a piece of design quietly absent. They are
caught by script, not by review:

| Script | Catches |
| --- | --- |
| `check-contrast.mjs` | Any colour pair below WCAG 2.2 AA, in both themes |
| `check-css.mjs` | Undefined custom properties, primitive leaks, raw colours, dead container queries |
| `check-agent-index.mjs` | An entry in `index.json` that no longer exists |
| `sync-icons.mjs --check` | A stale inline icon sprite, or a reference to a missing icon |
| `sync-reference-toc.mjs --check` | A stale side navigation |
| `build-foundations.mjs --check` | A stale machine-readable export |
| `sync-cache-busting.mjs --check` | A `?v=` that no longer matches the file it versions, so a browser keeps serving the old one |

All zero-dependency, Node stdlib only. Run them before claiming anything is done.

---

## Two kinds of consumer

**A derived design system** is the primary one: a system built on Dessau, one per
client, which must work *without* Dessau and which is itself consumed by products.
It substitutes the foundation — its own `primitives.css` and `semantic.css`,
Dessau's other ten imports — rather than overriding from a layer above, because it
cannot ship "Dessau plus a diff" to consumers who must not depend on Dessau.
Procedure: `recipes/derive-a-standalone-system.md`. Reasoning: DECISIONS 036.

**A product** is the other, one level further down, consuming either Dessau
directly or a derived system. It overrides, unlayered, from above. That is the
model the rest of this section describes.

Both keep the `dds-` namespace. Renaming per derived system would fork the agent
context per system, which is what turns a base into a template somebody copied.

### What a consumer may rely on

The public surface is a contract, because a base carrying several derived systems
cannot answer "did this break me" one consumer at a time. Full list and reasoning
in DECISIONS 037; in short:

**Contract** — class names, markup structure and its ARIA, token names, the
`data-dds-*` hooks, the cascade layer names and their order, and *which step of a
ramp a component takes*.

**Implementation** — the concrete value behind any token, internal selectors, how a
component is assembled inside its own markup, and everything in `reference/` and
`docs/`.

The contract may still change; what a consumer is owed is not delay but being told,
in a commit that says so in its subject with the migration in its message.

---

## How a product consumes Dessau

What is shared is the **CSS and token layer plus reference markup including
ARIA** — not a component runtime.

That is the whole integration surface, and it is deliberately small so it works
with any rendering model: server-rendered templates, a client framework, a static
site generator, or plain HTML. The behaviour in `dds/js/` is genuinely usable and
genuinely optional; a product may reimplement any of it in its own idiom and keep
identical markup and styling.

### Minimal integration

```html
<!-- Blocking, in <head>, before any stylesheet: theme before first paint. -->
<script src="/dds/js/theme-init.js"></script>
<link rel="stylesheet" href="/dds/dds.css">
```

```html
<body>
  <!-- The icon sprite, inlined once per document. -->
  …
  <script src="/dds/js/dds.js" defer></script>
  <script src="/dds/js/components.js" defer></script>
</body>
```

Load order matters in exactly two places, and both are load-bearing:

1. **`theme-init.js` is synchronous and in `<head>`.** Any later and the page
   paints in the default theme and repaints in the chosen one — a white flash for
   someone who asked for a dark interface, on every navigation.
2. **`dds.js` before any other DDS script.** Everything else registers against it.

### Getting the files in

Two ways, and the difference is how closely the product tracks changes:

- **Git submodule (recommended).** Points at a fixed commit; updates with a
  deliberate `git submodule update --remote`.
- **Copy.** Simpler to start, full control, updates pulled in by hand. Fine for a
  prototype.

Either way, **pinned and local**. See the next section for why.

### Framework-neutral behaviour

The tricky interactive ARIA patterns — combobox keyboard navigation, focus
management, live announcements — are provided as unobtrusive enhancements over
working markup (`DDS.register` / `DDS.enhance`), not as components.

That shape is what lets the same logic run inside a server-rendered page, wrapped
in a framework component, or on a static page, without change.
`DDS.enhance(element)` after inserting markup is the entire integration for
dynamic content.

---

## Distribution: a pinned artefact, not a live endpoint

**Decision.** Dessau is consumed as a **versioned artefact that each product pins
and serves locally** — *not* as a central file every product loads at runtime from
one shared URL.

A single live endpoint sounds convenient and couples every consumer to a runtime
dependency:

- **Every change reaches every product at once, untested.** One careless CSS change
  breaks every application simultaneously. A product must be able to *adopt* a
  change once it has tested it, not receive it.
- **It is a shared runtime dependency** — precisely the thing rejected in the
  decision against Web Components. Especially wrong for JavaScript, where
  behaviour is meant to be translatable into each product's idiom.
- **Operationally it is a single point of failure**, plus caching, CDN, CORS, CSP
  and privacy considerations that otherwise do not exist.
- **It hides the version.** Nobody can answer "which version is this product on?",
  which is the first question when something looks wrong.

The upgrade path is therefore always: bump the pinned version → test the product →
commit. A version update is a **deliberate, separate step**, never a side effect of
an unrelated feature commit.

---

## Where does a solution live?

The one rule that decides whether something belongs in Dessau or in the product.
Deliberately lightweight — self-assessment, not an approval gate.

> **Does more than one consumer need it?**
> Concretely foreseeable, not theoretically imaginable.
>
> - **Yes** → solve it in Dessau.
> - **No** → solve it in the product.

When genuinely unsure:

- **Toward the system** if the solution can be stated generally — a value, a
  class, a markup pattern.
- **Toward the product** if it only works with product-specific logic or data.

**What belongs in Dessau:** values and component styles, reusable markup and ARIA
patterns, writing fundamentals, accessibility requirements, binding design
decisions.

**What belongs in the product:** concrete pages and flows, domain models and
business logic, the behaviour behind a pattern where the product has its own
idiom, and anything genuinely specific to one product.

### If Dessau cannot deliver in time

The system must never block the product. Build the solution in the product, to
Dessau's standards — semantic values, `dds` conventions where applicable, WCAG 2.2
AA — and mark it as a candidate to move into Dessau later. Say so explicitly
rather than leaving it silently product-local.

### Deliberate deviation is allowed

A product may deviate from Dessau when there is a real reason. It must then
**document the deviation** — what, why, and whether it is temporary — in the
product's own code or documentation.

Undocumented deviation is the thing that is not allowed. A documented one makes
the divergence visible and keeps it a candidate for being resolved; an
undocumented one just looks like a mistake nobody made on purpose.

---

## Conformance expectations for a consuming product

- **Look before building.** Check `agent/index.json`. Extending what exists is
  always correct; adding a near-duplicate never is.
- **Take the reference markup, including ARIA, and translate it** into the
  product's idiom. Do not rebuild it from a screenshot.
- **Semantic values only** — never a raw hex or a fixed pixel where a value
  exists.
- **Use `.dds-*` classes; never redefine them.** Product styles get the product's
  own namespace. The cascade layers mean no `!important` is ever needed.
- **Light mode is mandatory. Dark mode is nearly free** — it works automatically
  once semantic values are used instead of raw ones. Skipping dark mode is
  therefore a deliberate decision to record, not a silent omission.
- **WCAG 2.2 AA is the floor**, in the product as much as in the system.
- **Report back anything generally useful.** A new pattern, a missing value: say
  so explicitly rather than leaving it product-local.

---

## Verification before calling a UI change done

1. Tags balance.
2. Renders correctly in **both** themes — not one of them. Dark mode is where
   colour mistakes hide, because the light value is the one that was reasoned
   about.
3. Contrast of any new or changed combination **calculated**, not estimated.
4. No new console errors.
5. Keyboard: every control reachable, focus visible, focus order matching reading
   order, nothing trapped.
6. Narrow width checked — 320px, and 400% zoom (WCAG 1.4.10).
7. Reduced motion honoured.
8. Screen-reader pass on anything with announcements or focus management.

```bash
python3 -m http.server 8000 --bind 127.0.0.1
# http://localhost:8000/reference/
```

---

## Browser support

The floor is set by the platform features Dessau depends on rather than by a
version table, because that is what actually determines whether a page works:

| Feature | Used for |
| --- | --- |
| Cascade layers (`@layer`) | The entire override model |
| Custom properties | Every value |
| `:has()` | Parent state without JavaScript |
| Container queries | Component-level responsiveness |
| `:focus-visible` | The focus model |
| Logical properties | Right-to-left support |
| `<dialog>` + `showModal()` | Modals |
| `popover` | Menus, tooltips |
| `Intl` | All formatting |

In practice: current Chrome, Edge, Firefox and Safari, and the last two versions
of each. Progressive enhancement covers the rest — anything newer than the list
above (anchor positioning, `interpolate-size`, `@starting-style`) sits behind
`@supports` and degrades to a correct, unanimated result.

No polyfills, and no fallbacks for browsers below that floor. Adding one is a
`DECISIONS.md` change, not a patch.
