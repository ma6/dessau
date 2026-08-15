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

## Set up a development machine

Assumes macOS with [Homebrew](https://brew.sh). Nothing here is needed to *use*
Dessau in a product — that has no dependencies at all. This is for working on
Dessau itself: the checks, the generated files and the browser tests.

```bash
# Node — runs the checks and the generators. Node 20 or newer.
brew install node

# GitHub CLI — issues and pull requests from the terminal.
brew install gh
gh auth login

# Playwright — the browser tests. The npm package first, then the browsers,
# which are a separate ~500 MB download and not part of the package.
npm install
npx playwright install chromium webkit firefox
```

Check it worked:

```bash
node --version          # v20 or newer
gh auth status          # logged in
npx playwright --version
```

Then run everything:

```bash
npm run check           # every static gate
npx playwright test     # the browser tests
```

Playwright puts its browsers in `~/Library/Caches/ms-playwright` on macOS. To keep
them inside the repository instead — useful if a sandbox cannot read your home
directory:

```bash
PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers npx playwright install chromium webkit firefox
```

`.playwright-browsers/` is git-ignored. Set the same variable when running the
tests, or they will look in the default location and report the browsers as
missing.

Both commands also run in CI, on every push and every pull request, on Chromium
and on WebKit — see [`.github/workflows/ci.yml`](.github/workflows/ci.yml).
Running them locally is faster feedback, not a substitute: a check that only
runs when somebody remembers is a check that eventually does not.

One thing CI cannot do for itself is the whitelabel audit's term list.
`.whitelabel-terms.json` is git-ignored deliberately — an audit that enumerates
the names it looks for is the best place to find them — so CI reads it from the
`WHITELABEL_TERMS` repository secret:

```bash
gh secret set WHITELABEL_TERMS < .whitelabel-terms.json
```

Without the secret the audit falls back to `.whitelabel-terms.example.json` and
says so in the run's annotations. The generic entries still apply; the
project-specific ones do not.

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

A `file://` open mostly works, with one real exception: **self-hosted fonts do not
load.** A font preloaded with `crossorigin` — which is required for a preload to be
usable — is blocked by CORS from a `file://` origin, because that origin is `null`.
The pages fall back to the system font stack and otherwise behave normally.

`@import` and `<use>` resolution are also more faithful over HTTP. The browser tests
serve the pages for the same reason.

---

## Start a new project

Seven steps. No build step, no dependencies, no framework.

### Or hand it to an agent

If a coding agent is doing the setup, paste this into an **empty product
repository**. It routes the agent through the recipes rather than repeating them,
so it cannot go stale against them.

```text
This product uses Dessau as its design system.

1. Add it as a submodule at libs/dessau:
   git submodule add https://github.com/ma6/dessau.git libs/dessau

2. Read, in this order, and treat them as authoritative over anything you
   already believe about design systems:
   - libs/dessau/AGENTS.md
   - libs/dessau/agent/index.json
   - libs/dessau/agent/recipes/derive-a-design-system.md
   - libs/dessau/agent/recipes/new-product.md

3. Work through derive-a-design-system.md FIRST. It is six decisions: colour,
   type, roundness, density, depth, motion.

   ASK ME each one. Do not answer them yourself and do not take the defaults
   silently. They are decisions about this product, not facts you can look up —
   and roundness in particular is close to unchangeable once there are forty
   components. Tell me what the default is and what it would cost to change it,
   then wait.

   Write my answers into this repository's DECISIONS.md: the decision, why, what
   it cost, and what would have to be true for it to be wrong. Say explicitly
   which of the six I took the default for.

4. Then follow new-product.md end to end.

5. Copy libs/dessau/agent/consumer-AGENTS.template.md into this repository as
   AGENTS.md, fill in every [PLACEHOLDER], and point CLAUDE.md at it — one
   instruction set, never two divergent copies.

Two things you will not discover on your own, and both fail silently:

- The pages must be SERVED, not opened as file://. The paths are absolute
  (/libs/dessau/…), so a file:// origin resolves them against the disk root and
  loads no stylesheet, no script, and reports no error.
  python3 -m http.server 8000 --bind 127.0.0.1

- The icon sprite must be INLINED into each document:
  node libs/dessau/scripts/sync-icons.mjs --dir=.
  An external <use href="icons.svg#…"> breaks currentColor silently — the icon
  renders, in black, in both themes.

Before you tell me it is done:
  node libs/dessau/scripts/sync-icons.mjs --dir=. --check
  and walk libs/dessau/agent/definition-of-done.md.

Build nothing that agent/index.json already lists. If something is close but not
right, say so and ask — a second button style is a defect, not a variant.
```

Then the seven steps below are what the agent is actually doing, and what you are
checking it against.

### 1. Bring Dessau in

Pinned and local — never loaded at runtime from a shared URL, so a change here can
never reach your product untested. ([Why](agent/architecture.md#distribution-a-pinned-artefact-not-a-live-endpoint))

```bash
# Recommended: a submodule, pinned to a commit
git submodule add https://github.com/ma6/dessau.git libs/dessau

# Or copy it in. Simpler to start, updates pulled by hand. Fine for a prototype.
cp -R <dessau>/dds libs/dessau/dds
```

Only `dds/` is needed at runtime. `agent/`, `docs/`, `reference/` and `scripts/`
are for working *on* Dessau and for reading.

### 2. The page shell

```html
<!DOCTYPE html>
<html lang="de" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Specific page name — Product</title>
  <meta name="color-scheme" content="dark light">

  <!-- BLOCKING, and before any stylesheet. Sets the theme before the first paint;
       any later and the page flashes on every navigation. Do not add defer. -->
  <script src="/libs/dessau/dds/js/theme-init.js"></script>

  <link rel="stylesheet" href="/libs/dessau/dds/dds.css">

  <!-- Your own CSS last, and UNLAYERED. It then overrides anything in Dessau with
       no !important and no specificity fight. -->
  <link rel="stylesheet" href="/assets/product.css">
</head>
<body>
  <a class="dds-skip-link" href="#main">Zum Hauptinhalt springen</a>

  <!-- DDS_ICON_SPRITE:START -->
  <!-- DDS_ICON_SPRITE:END -->

  <header>…</header>
  <main id="main">…</main>
  <footer>…</footer>

  <script src="/libs/dessau/dds/js/dds.js" defer></script>
  <script src="/libs/dessau/dds/js/format.js" defer></script>
  <script src="/libs/dessau/dds/js/components.js" defer></script>
</body>
</html>
```

Two load-order rules, both load-bearing: **`theme-init.js` is synchronous and in
`<head>`**, and **`dds.js` comes before every other Dessau script**.

### 3. Inline the icon sprite

Those two markers in the shell are where the sprite goes. Fill them in:

```bash
node libs/dessau/scripts/sync-icons.mjs --dir=.
node libs/dessau/scripts/sync-icons.mjs --dir=. --check   # in CI
```

Then reference an icon by role:

```html
<svg class="dds-icon" aria-hidden="true"><use href="#dds-icon-check"/></svg>
```

**The sprite must be inlined, not linked.** `<use href="icons.svg#…">` pointing at a
file breaks `currentColor` silently — the icon renders, in black, regardless of
theme. Re-run the command whenever you update Dessau.

**If the role you need is not in the set, ask for it — do not borrow a near one.**
`#dds-icon-document` on a download link resolves, renders and passes every check,
and it is a picture of a document. The set is meant to grow: open an issue naming
the role and what it is for. The full list and the reasoning are in
[`agent/foundations.md`](agent/foundations.md#icons) and on the
[foundations reference page](reference/foundations.html#icons).

### 4. Load only the behaviour you use

Every component renders correctly with **CSS alone**. These add behaviour the
platform does not provide.

| Script | Gives you |
| --- | --- |
| `js/dds.js` | **Required by all the others.** `register` / `enhance` / `announce` / `theme` |
| `js/format.js` | `DDS.format` — numbers, dates, currency, file sizes |
| `js/components.js` | Dialog opener, tabs, `DDS.toast()`, copy-to-clipboard |
| `js/components-forms.js` | Number stepper, file upload, character count, password reveal |
| `js/components-navigation.js` | Header disclosure, table of contents |
| `js/components-content.js` | Lightbox, consent embed |
| `js/patterns/combobox.js` | Autocomplete |
| `js/patterns/address-search.js` | Address search — **needs `combobox.js`** |
| `js/patterns/form-validation.js` | Accessible validation and error summary |
| `js/patterns/conditional-fields.js` | Fields revealed by an earlier answer |
| `js/patterns/wizard.js` | Multi-step form |
| `js/patterns/derived-output.js` | A read-only value resolved from input |
| `js/patterns/auth.js` | Confirming a new password against its repeat |

All `defer`, all in that order. Adding markup later? `DDS.enhance(element)` — that
is the whole integration for dynamic content.

### 5. Set the locale

German is the default. Only call this if your product is not German:

```js
DDS.format.setLocale('en-GB');
```

```js
DDS.format.currency(1234.56);       // 1.234,56 €
DDS.format.dateLong('2026-08-01');  // 1. August 2026
DDS.format.parseNumber('1.234,56'); // 1234.56  — never use parseFloat
```

### 6. Give agents the context

```bash
cp libs/dessau/agent/consumer-AGENTS.template.md AGENTS.md
# fill in the [PATH] placeholders, then point CLAUDE.md at it
```

Do this. Without it an agent working in your repository does not know Dessau exists,
and will invent a second button style, use raw hex values, write its own ARIA, and
rebuild a pattern that already exists.

### 7. Decide two things, and write them down

- **Dark mode.** It works automatically once you use semantic values. Skipping it is
  therefore a deliberate decision to record, not a silent omission.
- **Form of address.** German *Sie* or *Du* — one choice, never mixed within an
  interface. ([Why it belongs to you](agent/ux-writing.md#the-three-levels))

---

### Your first component

```html
<div class="dds-field">
  <label class="dds-label" for="email">
    E-Mail-Adresse <span class="dds-label-note">(erforderlich)</span>
  </label>
  <input class="dds-input" id="email" name="email" type="email"
         autocomplete="email" required aria-describedby="email-hint">
  <p class="dds-hint" id="email-hint">Nur zur Bestätigung der Anfrage.</p>
</div>
```

That is the whole contract: a visible label, the right `autocomplete`, required
stated in words, and the hint referenced from the control. Copy the rest from
[`reference/`](reference/) — every component there has a **Show markup** block with
its real, current markup.

### Before you ship

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

1. **Both themes.** Dark is where colour mistakes hide.
2. **Keyboard only** — unplug the mouse. Everything reachable, focus always visible.
3. **320px wide**, and **400% zoom**.
4. **Disable JavaScript.** Forms must still submit.
5. A screen-reader pass over one complete flow.

Then walk [`agent/definition-of-done.md`](agent/definition-of-done.md).

### Updating Dessau later

```bash
git submodule update --remote libs/dessau
node libs/dessau/scripts/sync-icons.mjs --dir=.   # the sprite may have changed
```

A deliberate, separate step: bump, test, commit. **Never part of an unrelated
feature commit.**

Step-by-step recipes for the recurring jobs — a new component, a new pattern, an
accessible form — are in [`agent/recipes/`](agent/recipes/).

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

The sentence that starts that is in
[Start a new project → Or hand it to an agent](#or-hand-it-to-an-agent) — a
copy-pasteable prompt for an empty product repository. It points at the recipes
instead of restating them, and it makes the agent **ask** the six design decisions
rather than answer them, because an agent that answers them has not chosen
neutrality; it has chosen Dessau's taste and presented it as a decision.

It has not itself been executed against a real product — see
[`agent/consumer-AGENTS.template.md`](agent/consumer-AGENTS.template.md), which
says the same about itself.

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

Seven scripts, all Node standard library only. Each catches a class of failure that
produces no error anywhere — no console message, no broken layout, no failing test.

```bash
node scripts/check-contrast.mjs          # every colour pair vs WCAG 2.2 AA, both themes
node scripts/check-css.mjs               # undefined properties, primitive leaks, dead queries
node scripts/check-agent-index.mjs       # agent context still matches the implementation
node scripts/sync-icons.mjs --check      # inline icon sprites are current
node scripts/sync-reference-toc.mjs --check
node scripts/build-foundations.mjs --check
node scripts/sync-cache-busting.mjs --check   # asset versions match the assets
```

Maintainer-only, run when the thing they generate changes:

```bash
node scripts/build-icons.mjs         # rebuild the sprite from Ionicons (needs network)
node scripts/build-foundations.mjs   # regenerate dds/foundations.json
node scripts/sync-icons.mjs          # re-inline the sprite into every page
node scripts/sync-reference-toc.mjs  # rebuild each page's side navigation
node scripts/sync-cache-busting.mjs  # re-stamp ?v= on every stylesheet and script
node scripts/bundle.mjs              # optional: dist/dds.css and dds.min.css
```

### Where a consumer gets the built stylesheet

Three ways, all equivalent, in the order most projects should try them:

1. **Link the layer files directly**, or link `dds/dds.css` and let its `@import`s
   fetch them. Works today, no build, no release. One caveat, and it is real:
   an `@import`ed sheet has not necessarily applied by `DOMContentLoaded`, so a
   script reading `--dds-*` back out of the computed style can get an empty
   string. Wait for `load`, or use one of the other two.
2. **A tagged release**, which carries `dds.css` and `dds.min.css` as attached
   assets. Built from the tag's own source by
   [`.github/workflows/release.yml`](.github/workflows/release.yml) — versioned,
   immutable, and not in the tree.
3. **Run `node scripts/bundle.mjs` yourself** and ship the output from your own
   pipeline.

`dist/` is git-ignored and stays that way: a committed minified file is a second
copy of the truth that eventually becomes a wrong copy
([`DECISIONS.md`](DECISIONS.md) 023 and 030).

There is no JavaScript bundle. The scripts are separate files a page includes as
it needs them — `dds.js` plus whichever components and patterns it uses — so
there is no single order to concatenate them in, and a page using two patterns
should not download seventeen.

The `?v=<hash>` on every `<link>` and `<script>` is generated, never typed. It is
the content hash of the file being referenced, so a change to a stylesheet reaches
a reader who already has the old one — including the eleven layer files behind
`dds/dds.css`, whose `@import`s are stamped for the same reason. It only works if
the HTML itself is served with a short cache lifetime; the assets are what this
makes safe to cache hard. Reasoning: [`DECISIONS.md`](DECISIONS.md) 026.

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
