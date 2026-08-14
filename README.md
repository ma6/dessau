# Dessau

> **Foundations for digital products**

A reusable foundation for building digital products: the principles that do not
change, the design foundations everything is measured against, a small set of
components, the patterns that solve recurring tasks — and structured context so a
coding agent can use all of it correctly without rediscovering the rules.

**DDS** — the Dessau Design System — is the UI layer inside Dessau. `dds` is the
implementation namespace throughout: `.dds-button`,
`--dds-color-action-primary`, `data-dds-dialog-open`, `window.DDS`.

```
Principles → Foundations → Components → Patterns → Products
```

---

## Look at it

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Then <http://localhost:8000/reference/>.

| Page | Shows |
| --- | --- |
| `reference/index.html` | What Dessau is, and how to start |
| `reference/foundations.html` | Colour, typography, space, radius, motion — read live from the CSS |
| `reference/components.html` | Buttons, fields, choices, dialogs, tables, tabs |
| `reference/content.html` | Quote, teaser, facts, charts, lightbox, consent embeds |
| `reference/navigation.html` | Header, footer, breadcrumb, steps, menus — with a width switcher |
| `reference/patterns.html` | Address search, validation, wizard, filtering, authentication |

A `file://` open mostly works; `@import` and `<use>` resolution are more faithful
over HTTP.

---

## Use it

One stylesheet, and two scripts if you want the behaviour. No build step, no
dependencies, no framework.

```html
<!DOCTYPE html>
<html lang="de" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <!-- Blocking, in <head>, before any stylesheet: sets the theme before the first
       paint. Any later and the page flashes on every navigation. -->
  <script src="/dds/js/theme-init.js"></script>
  <link rel="stylesheet" href="/dds/dds.css">
</head>
<body>
  <!-- Inline the icon sprite once per document — see dds/icons/icons.svg. -->

  <main>…</main>

  <script src="/dds/js/dds.js" defer></script>
  <script src="/dds/js/components.js" defer></script>
</body>
</html>
```

**Every component renders correctly with CSS alone.** The scripts add behaviour the
platform does not provide; they are never what makes a page work.

Full setup: [`agent/recipes/new-product.md`](agent/recipes/new-product.md).

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

---

## Built to be used by coding agents

Dessau does not just publish UI code for a person to browse and copy. Increasingly,
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
  a product repository, so an agent working there knows Dessau exists.

The test applied to all of it:

> **What does an agent need in order to build a new product correctly with Dessau,
> without rediscovering its rules?**

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

Six scripts, all Node standard library only. Each catches a class of failure that
produces no error anywhere — no console message, no broken layout, no failing test.

```bash
node scripts/check-contrast.mjs          # every colour pair vs WCAG 2.2 AA, both themes
node scripts/check-css.mjs               # undefined properties, primitive leaks, dead queries
node scripts/check-agent-index.mjs       # agent context still matches the implementation
node scripts/sync-icons.mjs --check      # inline icon sprites are current
node scripts/sync-reference-toc.mjs --check
node scripts/build-foundations.mjs --check
```

Maintainer-only, run when the thing they generate changes:

```bash
node scripts/build-icons.mjs         # rebuild the sprite from Ionicons (needs network)
node scripts/build-foundations.mjs   # regenerate dds/foundations.json
node scripts/sync-icons.mjs          # re-inline the sprite into every page
node scripts/sync-reference-toc.mjs  # rebuild each page's side navigation
node scripts/bundle.mjs              # optional: dist/dds.css and dds.min.css
```

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

Small, coherent commits: one purpose each, leave Dessau working, include the
documentation the change needs. A specification that lags behind its code is a
specification nobody can trust.

Worthwhile work outside the current task goes to a GitHub Issue rather than
expanding the task.

---

> **Every project should leave Dessau better than it found it.**
