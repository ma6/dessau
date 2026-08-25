# Dessau DS

> **The Dessau Design System — a base for design systems, and for the products built on them**

A reusable foundation: the principles that do not change, the design foundations
everything is measured against, a small set of components, the patterns that solve
recurring tasks — and structured context so a coding agent can use all of it
correctly without rediscovering the rules.

"Dessau DS" is the short form; **the Dessau Design System** is the full
name, and the one worth using where it matters — said in full, there is no
mistaking this for the city of Dessau. `dds` is the implementation namespace
throughout the code: `.dds-button`, `--dds-color-action-primary`,
`data-dds-dialog-open`, `window.DDS`.

It reads the other way too, and that is the useful half: **derived design system.**
Every system built on Dessau DS keeps the `dds-` prefix, so in a client's codebase it
is not somebody else's name inherited — it is a description of what the thing is.
(DECISIONS 036.)

```
Principles → Foundations → Components → Patterns → Derived systems → Products
```

**The layer before products is what Dessau DS is primarily for.** A *derived design
system* is built on Dessau DS, works **without** Dessau DS, and is itself consumed by
products — one per client, roughly what a Bootstrap theme was. It supplies its own
`primitives.css` and `semantic.css` and inherits the other ten imports, so its
consumers get one value per token and no dependency on this repository.

A product consuming Dessau DS directly is supported, and is the second case rather
than the first.

---

## Set up a development machine

Only for working **on** Dessau DS. Using it needs no dependencies at all.

```bash
npm install && npx playwright install chromium webkit firefox
npm run check && npx playwright test
```

Full setup, CI notes and the whitelabel term list:
[`docs/development-machine.md`](docs/development-machine.md).

---

## Look at it

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Then <http://localhost:8000/reference/>.

| Page | Shows |
| --- | --- |
| `reference/index.html` | What Dessau DS is, and how to start |
| `reference/foundations.html` | Colour, typography, space, radius, motion — read live from the CSS |
| `reference/components.html` | Buttons, fields, choices, dialogs, tables, tabs |
| `reference/content.html` | Quote, teaser, facts, charts, lightbox, consent embeds |
| `reference/navigation.html` | Header, footer, breadcrumb, steps, menus — with a width switcher |
| `reference/patterns.html` | Address search, validation, wizard, filtering, authentication |

A `file://` open mostly works, with one real exception: **self-hosted fonts do not
load.** A font preloaded with `crossorigin` — which is required for a preload to be
usable — is blocked by CORS from a `file://` origin, because that origin is `null`.
The pages fall back to the system font stack and otherwise behave normally.

`@import` and `<use>` resolution are also more faithful over HTTP. The browser tests
serve the pages for the same reason.

---

## Which are you building?

Two answers, and they take different routes. Both start with the same hour.

**Everybody: [`agent/recipes/derive-a-design-system.md`](agent/recipes/derive-a-design-system.md)
first.** Six decisions — colour, type, roundness, density, depth, motion. Skip it
and you have not chosen neutrality; you have taken Dessau DS's taste complete and
unexamined, and roundness in particular is close to unchangeable by the time there
are forty components.

| You are building | Recipe | Prompt to paste into an agent |
| --- | --- | --- |
| **A design system** that ships to a client and works without Dessau DS | [`derive-a-standalone-system.md`](agent/recipes/derive-a-standalone-system.md) | [`derived-system-init.prompt.md`](agent/derived-system-init.prompt.md) |
| **A product**, on Dessau DS or on a derived system | [`new-product.md`](agent/recipes/new-product.md) | [`consumer-init.prompt.md`](agent/consumer-init.prompt.md) |

The difference is not scale. A derived system **substitutes** the foundation,
because it cannot hand its own consumers a dependency on Dessau DS. A product
**overrides**, unlayered, from above. Reading the product route and applying it to
a system produces something that only works while Dessau DS is present, which is the
one thing a client deliverable may not do. See
[`agent/architecture.md`](agent/architecture.md) → Two kinds of consumer.

---

## Start a new project

For the **product** case, and it is seven steps:
**[`agent/recipes/new-product.md`](agent/recipes/new-product.md)** — submodule, page
shell, icon sprite, behaviour scripts, locale, agent context, and the two things to
decide and write down. No build step, no dependencies, no framework.

Or hand it to an agent:
**[`agent/consumer-init.prompt.md`](agent/consumer-init.prompt.md)** — paste it into
a coding agent standing in an empty product repository. It routes through the
recipes rather than restating them, and it makes the agent **ask** the six design
decisions rather than answer them.

Recipes for the recurring jobs — a new component, a new pattern, an accessible
form, adapting one Dessau DS already ships — are in
[`agent/recipes/`](agent/recipes/).

---

## What is in here

```
agent/       machine-oriented context — the Agentic Version
dds/         the implementation (the source of truth)
docs/        human-facing reasoning
reference/   the rendered proof
scripts/     zero-dependency verification tooling
```

| Document | For |
| --- | --- |
| [`AGENTS.md`](AGENTS.md) | Coding agents. The canonical instruction set |
| [`CLAUDE.md`](CLAUDE.md) | Claude Code — points at `AGENTS.md` |
| [`agent/README.md`](agent/README.md) | Map of the agent context |
| [`agent/index.json`](agent/index.json) | Machine-readable inventory of every component and pattern |
| [`DECISIONS.md`](DECISIONS.md) | Lasting architectural decisions, and why |
| [`LESSONS_LEARNED.md`](LESSONS_LEARNED.md) | Reusable experience from real work |
| [`docs/typography.md`](docs/typography.md) | The type decision, alternatives, and self-hosting |
| [`docs/brand.md`](docs/brand.md) | The mark, the logo and the icon — and the one colour rule |

---

## Built to be used by coding agents

Dessau DS does not just publish UI code for a person to browse and copy. Increasingly,
the thing using a design system is an agent — and left to infer the rules it will
invent a second button style, write raw hex values, guess at ARIA, and rebuild a
pattern that already exists.

So the rules are written down as structured context, and the context is verified
against the implementation:

- **[`AGENTS.md`](AGENTS.md)** — the entry point. `CLAUDE.md` points at the same
  content; there is one instruction set, not two.
- **[`agent/`](agent/)** — principles, architecture, foundations, component and
  pattern specifications, a WCAG 2.2 AA catalogue organised by check frequency, the
  writing standard, responsive expectations, conventions, and a Definition of Done.
- **[`agent/index.json`](agent/index.json)** — the fastest route to *does this
  already exist?*, with every component and pattern mapped to its files, classes,
  hooks and specification.
- **[`agent/recipes/`](agent/recipes/)** — step-by-step procedures for the jobs that
  recur.
- **[`agent/consumer-AGENTS.template.md`](agent/consumer-AGENTS.template.md)** — for
  a product repository, so an agent working there knows Dessau DS exists.
- **[`agent/consumer-init.prompt.md`](agent/consumer-init.prompt.md)** — the sentence
  that starts it: a prompt to paste into an agent standing in an empty product
  repository. It routes through the recipes rather than restating them, and it makes
  the agent **ask** the six design decisions rather than answer them.

The test applied to all of it:

> **What does an agent need in order to build a new product correctly with Dessau DS,
> without rediscovering its rules?**

Neither the prompt nor the consumer template has been executed against a real
product yet, and both say so where they are read rather than only here.

---

## Principles, in short

1. **Accessibility is a constraint, not a review step.** WCAG 2.2 AA is the floor.
2. **Semantic HTML first.** ARIA supplements semantics; it never replaces them.
3. **Progressive enhancement.** The markup works before JavaScript runs.
4. **Native before custom.** `<dialog>`, `<details>`, `<select>`, `popover`, `Intl`.
5. **Semantic values only.** A primitive does not follow the theme.
6. **Never colour alone.** Text or an icon as well, always.
7. **Extend before duplicating.** A second button style is a defect.
8. **Reusable complexity belongs in Patterns.** Not reduced to atomic components.
9. **Keep technology understandable.** No framework, no build step, no dependencies.

Full text with reasoning: [`agent/principles.md`](agent/principles.md).

---

## Verify

```bash
npm run check
```

Ten scripts, Node standard library only, each catching a class of failure that
produces no error anywhere — no console message, no broken layout, no failing
test. The generated table on
[`reference/architecture.html`](reference/architecture.html) lists every one with
what it catches; `AGENTS.md` §5 is what to run before calling something done.

An automated pass is a floor, not a result. No script can tell you whether an
announcement is useful, whether focus order matches how the page reads, or whether
an error message helps.

---

## Locale

German is the default; English is the fully supported alternative. Formatting goes
through `DDS.format`, over `Intl`:

```js
DDS.format.currency(1234.56);   // 1.234,56 €
DDS.format.dateLong('2026-08-01'); // 1. August 2026
DDS.format.setLocale('en-GB');  // switch, once, at start-up
```

Code, class names, comments and agent context are in English. Content, examples and
formats default to German. See [`agent/ux-writing.md`](agent/ux-writing.md).

---

## Licence, and what is not offered

**MIT** — [`LICENSE`](LICENSE). Use it, change it, ship it, sell what you build with
it; keep the notice and you are done.

**No support, no contributions, no compatibility promise** to anybody not paying
for one. The issues here are the maintainer's own working notes rather than a
queue, and pull requests are not being accepted — see
[`CONTRIBUTING.md`](CONTRIBUTING.md) for why that is a maintenance decision rather
than an unfriendly one. Forking is the intended answer, and
[`agent/recipes/derive-a-standalone-system.md`](agent/recipes/derive-a-standalone-system.md)
is written for it.

---

## Third-party material

| What | Licence |
| --- | --- |
| Icons — Ionicons | MIT · [`dds/icons/LICENSE-ionicons.txt`](dds/icons/LICENSE-ionicons.txt) |
| Inter, Space Grotesk, JetBrains Mono | OFL 1.1 · `reference/assets/fonts/OFL-*.txt` |

The fonts are used by the reference site only. `dds/` ships no font binaries — see
[`docs/typography.md`](docs/typography.md).

---

## Working on it

Maintained by one person. No pull request required, no peer approval, no release
gate, no simulated team roles. Direct commits on `main` are fine.

Small, coherent commits: one purpose each, leave Dessau DS working, include the
documentation the change needs. A specification that lags behind its code is a
specification nobody can trust.

Worthwhile work outside the current task goes to a GitHub Issue rather than
expanding the task.

---

> **Every project should leave Dessau DS better than it found it.**
