# Recipe: start a product with Dessau

## 0. Decide what it looks like — `derive-a-design-system.md`

This recipe is plumbing. Before it, spend an hour on
[`derive-a-design-system.md`](derive-a-design-system.md), which walks the six
decisions a derived system is made of: colour, type, roundness, density, depth
and motion.

It is genuinely first, not merely recommended. Skip it and the product does not
get a neutral starting point — it gets Dessau's own taste, complete and
unexamined, and roundness in particular is close to unchangeable by the time
there are forty components using it.

## 1. Bring Dessau in

Git submodule, pinned:

```bash
git submodule add https://github.com/ma6/dessau.git libs/dessau
```

Either way **pinned and local** — never loaded at runtime from a shared URL. See
`agent/architecture.md` → Distribution.

**Or copy `dds/` in**, and know what that costs. Only `dds/` is needed *at
runtime*; three directories are not runtime and are not optional either:

| Directory | Needed for |
| --- | --- |
| `agent/` | The `AGENTS.md` you copy into the product opens with "Read first: `[PATH]/AGENTS.md`, then `[PATH]/agent/index.json`" |
| `scripts/` | `sync-icons.mjs`, which inlines the icon sprite — step 3 |
| `reference/` | The rendered proof the same template tells an agent to serve and look at |

A copied `dds/` therefore leaves the product's own `AGENTS.md` pointing at three
things that are not there, and nothing announces it — the icon step is the only
part that fails out loud, with *command not found*.

**For a derived design system the copy is not a trade-off, it is the wrong tool**:
there the scripts are its verification, `index.json` is what its own consumers
query, and the reference is what it forks its own from. See
`agent/recipes/derive-a-standalone-system.md`.

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
<!-- data-theme="dark" is the no-JS fallback (#113): theme-init.js overwrites
     both theme attributes unconditionally once it runs, so this only matters
     if the script fails to load — and then it must match the resolution
     order's own last step ("neither known → dark", see theme-init.js and
     DECISIONS.md #012), not silently default to light. -->
<html lang="de" data-theme="dark" data-dds-theme="dark">
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

### Load only the behaviour you use

Every component renders correctly with **CSS alone**. These add behaviour the
platform does not provide — the shell above loads the first three.

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

**It writes a one-line Ionicons attribution above the sprite. Keep it.** The icons
are MIT-licensed third-party artwork and MIT requires its notice to accompany
copies. The sprite is inlined, so a deployment may ship the artwork without ever
shipping `libs/dessau/dds/icons/` — that line is then the only notice there is.
Check that a minifier is not configured to strip comments from your HTML.

`--dir=.` walks the whole project and deliberately steps over the vendored copy
of Dessau, saying so in its output. It used to descend into `libs/dessau` and
rewrite Dessau's own reference pages with the product's icon set — a build step
writing into its own pinned dependency, which is the one thing pinning exists to
prevent. It stayed invisible for as long as the two sprites happened to match.

Re-run it whenever Dessau is updated.

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
`libs/dessau/reference/` — every component there has a **Show markup** block with
its real, current markup.

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

**Also carry the `modern-web-guidance` setup, at the product's own root — not
inside `libs/dessau/`.** A submodule's own `.claude/` config does not extend to
the checkout that contains it, so this is genuinely two things, not one, and
skipping either leaves the skill silently unavailable:

1. **Install the plugin**, once per machine, if it is not already:

   ```text
   /plugin marketplace add GoogleChrome/modern-web-guidance
   /plugin install modern-web-guidance@googlechrome
   /reload-plugins
   ```

   This is the part #122's fix left out (#129) — copying config alone was
   tried, against a machine that already had the plugin installed, which is
   exactly why the gap did not show up until someone tried it on one that
   did not.
2. **Enable it for this project.** Copy `skills-lock.json` (declares the
   skill's source and a content hash) and `.claude/settings.json`
   (`"enabledPlugins": {"modern-web-guidance@googlechrome": true}`) from
   Dessau's own root, unedited. This step presumes step 1 already happened —
   it scopes an installed plugin to this repository, it does not install one.

CLAUDE.md and AGENTS.md both call this skill mandatory for CSS/JS/component
work; a product that skips either step is building without it and nothing
says so.

## 6. Decide three things, and write them down

If an agent is building this and the person it is building for is reachable,
these are asked, not assumed — the same rule `derive-a-design-system.md`
states for its own six (#123).

- **Dark mode.** It works automatically once semantic values are used. Skipping it
  is therefore a deliberate decision to record, not a silent omission.
- **Form of address.** German *Sie* or *Du*; one choice, never mixed. See
  `agent/ux-writing.md` → level 3.
- **The issue-first workflow.** Dessau files a GitHub Issue before building
  anything (`agent/recipes/new-requirement.md`), commits reference the ticket
  in the subject (`[#42] fix(…): …`), and every commit that finishes one ends
  with `Closes #42`. This is genuinely optional for a product — nothing about
  consuming Dessau requires it — but it is not the default anywhere else, so a
  product that wants it has to say so, the same way dark mode and form of
  address do. If adopted, say so in this product's own `AGENTS.md`, in the
  product-specific section below the Dessau one — an agent reading only the
  Dessau section has no reason to expect it.

## 7. Before shipping

- `python3 -m http.server` and check **both themes**. Dark is where colour mistakes
  hide.
- Keyboard only, mouse unplugged. Everything reachable, focus always visible.
- 320px wide and 400% zoom.
- **Disable JavaScript.** Forms must still submit.
- A screen-reader pass over one complete flow —
  `docs/screenreader-walkthrough.md` is the script.
- Walk `agent/definition-of-done.md`.

## 8. Updating Dessau later

```bash
git submodule update --remote libs/dessau
node libs/dessau/scripts/sync-icons.mjs --dir=.   # the sprite may have changed
```

A deliberate, separate step: bump, test, commit. **Never part of an unrelated
feature commit.**

---

## How far this recipe has actually been tested

Stated because "these instructions have never been executed" was true for long
enough to be worth never letting be true silently again (#5).

**Executed.** Steps 1 to 3, literally, in an empty repository, by somebody
following the text and filling nothing in from memory. That found one defect —
`sync-icons.mjs --dir=.` descending into the vendored copy of Dessau and
rewriting its reference pages — and three missing steps, all now in the text
above.

**Gated.** `node scripts/check-adoption.mjs` verifies the mechanical half on
every run: every repository path this file and `README.md` name exists, and the
README's behaviour table agrees with `dds/js/` in both directions. It was written
because a table row had quietly stopped being true — `patterns/auth.js` was
documented as the password reveal long after the reveal moved to
`components-forms.js`.

**Not tested.** Whether the steps read correctly to somebody meeting Dessau for
the first time, and whether their order makes sense before you know what any of
it is for. Steps 4 to 7 have been read for accuracy but not executed end to end.
A check can tell you the recipe points at things that exist; it cannot tell you
the recipe is followable.

The honest test for that is one real product, built by somebody who did not write
this, with everything that turns out to be wrong or missing written back into
this file. Nothing here substitutes for it. A foundation nobody has built on is a
foundation whose every integration claim is still a hypothesis.
