# Recipe: start a product with Dessau

## 1. Bring Dessau in

Git submodule, pinned:

```bash
git submodule add <dessau-url> libs/dessau
```

Or copy `dds/` in. Either way **pinned and local** — never loaded at runtime from a
shared URL. See `agent/architecture.md` → Distribution.

Two things a first checkout runs into, both of which cost time and neither of
which is obvious from the step above:

- **The paths below are absolute** (`/libs/dessau/…`), so the page must be
  served, not opened from the filesystem. Opened as a `file://` URL it resolves
  them against the disk root and loads nothing at all — no stylesheet, no
  script, and no error that says why. `python3 -m http.server 8000` from the
  project root, then <http://localhost:8000/>. Use relative paths instead if the
  product will not be served from its root.
- **A submodule is not cloned with the repository.** Anybody who clones the
  product afterwards gets an empty `libs/dessau`. `git clone --recurse-submodules`,
  or `git submodule update --init` after the fact. Worth putting in the product's
  own README on the day the submodule is added, not the day somebody hits it.

## 2. Set up the shell

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Specific page name — Product</title>
  <meta name="color-scheme" content="light dark">

  <!-- BLOCKING, and before any stylesheet. Any later and the page paints in the
       default theme then repaints — a white flash on every navigation for anyone
       who chose dark mode. -->
  <script src="/libs/dessau/dds/js/theme-init.js"></script>
  <link rel="stylesheet" href="/libs/dessau/dds/dds.css">
  <!-- Your own styles LAST and unlayered: they then win over every DDS layer with
       no !important and no specificity fight.
       Create this file before the first load, even empty — a missing stylesheet
       is a 404 in the console on every page, and a console with a permanent
       error in it is a console nobody reads. -->
  <link rel="stylesheet" href="/assets/product.css">
</head>
<body>
  <a class="dds-skip-link" href="#main">Zum Hauptinhalt springen</a>

  <!-- The icon sprite goes between these markers. Fill them in with:
         node libs/dessau/scripts/sync-icons.mjs --dir=.
       An external <use href="icons.svg#…"> breaks currentColor silently. -->
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

## 3. Inline the icon sprite

```bash
node libs/dessau/scripts/sync-icons.mjs --dir=.
node libs/dessau/scripts/sync-icons.mjs --dir=. --check   # in CI
```

The markers in the shell above are where it goes. Then reference icons by role:

```html
<svg class="dds-icon" aria-hidden="true"><use href="#dds-icon-check"/></svg>
```

The script also reports any `<use>` pointing at an icon that does not exist — a typo
there renders nothing at all, with no error anywhere.

`--dir=.` walks the whole project and deliberately steps over the vendored copy
of Dessau, saying so in its output. It used to descend into `libs/dessau` and
rewrite Dessau's own reference pages with the product's icon set — a build step
writing into its own pinned dependency, which is the one thing pinning exists to
prevent. It stayed invisible for as long as the two sprites happened to match.

Re-run it whenever Dessau is updated.

## 4. Set the locale

German is the default. Only call this if the product is not German:

```js
DDS.format.setLocale('en-GB');
```

## 5. Give agents the context

Copy `agent/consumer-AGENTS.template.md` into the product as `AGENTS.md`, fill in
the paths, and add the product's own rules below the Dessau section. Point
`CLAUDE.md` at it.

Without this, an agent working in that repository does not know Dessau exists and
will invent a second button style, use raw hex values and write its own ARIA.

## 6. Decide two things, and write them down

- **Dark mode.** It works automatically once semantic values are used. Skipping it
  is therefore a deliberate decision to record, not a silent omission.
- **Form of address.** German *Sie* or *Du*; one choice, never mixed. See
  `agent/ux-writing.md` → level 3.

## 7. Before shipping

- `python3 -m http.server` and check **both themes**.
- Keyboard only, mouse unplugged.
- 320px wide and 400% zoom.
- A screen-reader pass over one complete flow.
- Walk `agent/definition-of-done.md`.
