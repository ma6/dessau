# Recipe: stand up a derived design system

For building **a design system on Dessau** — one that works without Dessau and is
itself consumed by products. One per client, roughly what a Bootstrap theme was.

Not to be confused with its neighbours:

| Recipe | For |
| --- | --- |
| `derive-a-design-system.md` | The six decisions — colour, type, roundness, density, depth, motion. **Do that first.** |
| **this one** | Standing the derived system up as a repository that ships without Dessau |
| `new-product.md` | A product consuming Dessau — or consuming *your* derived system |

The six decisions come first and this is the plumbing under them. Read
`derive-a-design-system.md` for *what* the values are; this file is *where they go*
when the answer has to stand alone.

**Your system's name, brand and identity are yours.** The only thing inherited is
the `dds-` implementation namespace — class names and custom properties — and that
is a maintenance decision about not forking the agent context per client, nothing
more (DECISIONS 036). Dessau ships no brand: 024 keeps the mark and the logo out of
`dds/` and out of the icon sprite precisely so a derived system has nothing to
strip. Call it what you like and make it look like whatever it is.

## 0. Substitution, not overriding

A product overrides: it loads Dessau and puts its own unlayered stylesheet on top.
A derived system cannot do that, for two reasons.

It cannot ship "Dessau plus a diff", because its consumers would then depend on
Dessau — and the point is that they do not. And overriding leaves **two values for
every token it touches**: Dessau's, with yours on top. Your client sees both in
devtools, and the artefact carries the weight of everything you replaced.

So you substitute. `dds/dds.css` is a `@layer` declaration and twelve `@import`s,
and the first two are the foundation:

```css
@import url("./css/primitives.css") layer(dds.foundation);   /* ← yours */
@import url("./css/semantic.css")   layer(dds.foundation);   /* ← yours */
@import url("./css/base.css");                               /* ← inherited */
…
```

Everything after the foundation declares its own layer internally, which is why it
is imported plainly. **The layer architecture already separates the values from the
system**, so swapping the first two is a supported operation and not a trick. See
DECISIONS 036.

## 1. The repository

```
client-ds/
  libs/dessau/           submodule, pinned. Never edited.
  tokens/
    primitives.css       your ramps
    semantic.css         your roles — usually Dessau's, copied and adjusted
  client-ds.css          the entry: layer declaration + 12 imports
  dist/client-ds.css     built, single file, no Dessau at runtime
  agent/                 your index.json, your AGENTS.md
  reference/             your rendered proof
  scripts/               copied from Dessau and repointed — see step 5
```

**Consider mirroring Dessau's own internal shape instead** —
`dds/css/{primitives,semantic}.css` and `dds/dds.css` in place of `tokens/` and
a hand-named entry file. Every check script in step 5 derives its own root from
its file location and then reads hardcoded *relative* paths
(`dds/css/primitives.css`, `agent/index.json`, …). Mirror the shape those paths
already assume and copying a script into your repository is the whole
repointing job — zero string edits, because the relative paths already
resolve. Follow the layout above literally and repointing becomes five
separate manual path-edits instead, which is exactly the kind of drift risk
this repository warns about elsewhere. Either layout works; the mirrored one
is less to get wrong.

**`libs/dessau/` is never edited.** It is a pinned dependency, and this repository
has already paid for writing into one: `sync-icons.mjs --dir=.` used to descend
into the vendored copy of Dessau and rewrite its reference pages, invisible for as
long as the two sprites matched.

## 2. Set up modern-web-guidance

Building this repository IS the kind of work CLAUDE.md's mandate covers —
substituting the foundation and writing a reference are real CSS/JS work, not
plumbing exempt from it. Two things, not one, or the skill is silently
unavailable (the same gap #129 found and fixed for a product; the derived-system
path never had it at all):

1. **Install the plugin**, once per machine, if it is not already:

   ```text
   /plugin marketplace add GoogleChrome/modern-web-guidance
   /plugin install modern-web-guidance@googlechrome
   /reload-plugins
   ```

2. **Enable it for this project.** Copy `skills-lock.json` and
   `.claude/settings.json` from `libs/dessau`'s own root, unedited. This step
   presumes step 1 already happened — it scopes an installed plugin to this
   repository, it does not install one.

## 3. The entry file

Copy `libs/dessau/dds/dds.css`, point the first two imports at `tokens/`, and leave
the other ten alone.

Two things that bite:

**The `@layer` declaration must come first and must keep its names and order.** It
is what makes an unlayered rule in a consuming product win with no `!important` —
your consumers inherit that guarantee from this line. The names are contract
(DECISIONS 037).

**The `?v=` hashes.** Dessau's imports carry cache-busting query strings that
`sync-cache-busting.mjs` maintains and `npm run check` fails on when stale. A
hand-written entry file will not have them. Either drop them — nothing forces you
to have them — or take that script too and let it own your entry file. Do not leave
Dessau's hashes in place pointing at your files; they are hashes of somebody else's
content and will be wrong from the first edit.

## 4. What to copy from `semantic.css`, and what not to

`primitives.css` is yours outright — it is the ramps, and the ramps are the
identity.

`semantic.css` is mostly not. It is the mapping from roles to ramps, and that
mapping is the reasoning you are inheriting: which role gets which step, how the
dark theme re-points, why the solid statuses are fixed across themes. Copy it
wholesale, then change only the lines you have a reason to change — and keep the
comments, because they say why the line is what it is and you will otherwise
re-derive them badly.

If you find yourself rewriting most of it, stop: you are building a different
system rather than a derived one, and Dessau's components will not hold together
on top of it.

**Changing one ramp touches more lines than the ramp's own block.** Repointing
the action colour ripples across surfaces, text, focus and selection — four
sections, not one — and at least one pair in Dessau's own file is not the
`var()` reference the rest of the section is: `--dds-color-action-secondary-hover`
and `-active` in the `[data-theme="dark"]` block are hand-written hex, not
`var(--dds-indigo-N)`. A find-and-replace on the ramp name silently misses
them. Grep for hex literals near the ramp you are replacing, not just for the
ramp's own name.

## 5. Repoint the gates, or they lie

This is the step people skip, and it fails in the most convincing way possible: the
checks pass.

`check-reference.mjs` is listed below with the other five, but what it needs —
your own reference, and what belongs on it — is step 6, one step after this one.
Read step 6 before you act on this script; the precondition comes after the
instruction to satisfy it.

`check-contrast.mjs` and `check-accent-separation.mjs` read `dds/css/primitives.css`
and `dds/css/semantic.css` by **hardcoded path**. Run them unchanged in your
repository and they measure Dessau's palette, report success, and say nothing at
all about yours.

```
check-contrast.mjs            repoint at tokens/ + your built output
check-accent-separation.mjs   repoint at tokens/
check-css.mjs                 repoint at your CSS
check-reference.mjs           reads agent/index.json — needs YOUR index
check-agent-index.mjs         same
build-foundations.mjs         same
```

Copy them, change the paths, and **prove each one can still fail** — break a value
on purpose, see the report, put it back. A check that cannot fail is worse than no
check, because it is trusted.

**They are not equally mechanical, and it is three scripts, not two.**
`check-contrast.mjs`, `check-accent-separation.mjs` and `build-foundations.mjs`
read exactly two hardcoded files each — a path edit, or nothing at all if you
mirrored Dessau's shape per step 1. `check-css.mjs`, `check-agent-index.mjs`
**and `check-reference.mjs`** assume the repository owns a full `dds/js/`
directory and a fully-documented, fully-populated component catalogue
(`agent/components.md`, `agent/patterns.md`, `agent/index.json`), and behave
badly at both ends of populating that catalogue:

- **Empty index.** All three crash on a missing `dds/js/` or catalogue file
  rather than degrading gracefully. If you are genuinely not building the
  full reference — step 6 says when that argument is yours to make — give
  them something to find instead: an empty `dds/js/README.md` so the
  directory read does not throw, and `agent/index.json` with `components: []`
  / `patterns: []` plus stub `.md` files so their loops check zero entries
  honestly instead of erroring.
- **Populated index — the more likely outcome, and the one to plan for.**
  Once `agent/index.json` actually lists your inherited components (all of
  them, if you inherited all of them unchanged), `check-css.mjs` and
  `check-agent-index.mjs` need to search for those classes and that JS
  **across your own CSS and `libs/dessau/dds/{css,js}` both**, not just the
  two files your own repository owns — the implementations live in Dessau,
  not in your token substitution. Scoping the search to only your own `dds/`
  reports every inherited entry as "class not defined": one derived system
  hit this directly, going from 0 findings against an empty index to 384
  against a real one, entirely from search-path scope rather than actual
  drift.

`check-reference.mjs`'s own check 5b — that the root `index.html` is a
zero-delay meta-refresh — assumes Dessau's specific redirect convention. A
derived system with a real landing page rather than a redirect stub needs
that check widened to accept either shape; the requirement being verified is
"root is not a dead end," not "root redirects."

## 6. What you owe your own consumers

You are a design system now, so you owe what Dessau owes:

- **Your own `agent/index.json`**, because your consumers query it to answer "does
  this already exist?". Pointing them at Dessau's is wrong — it lists components in
  Dessau's values, not yours.
- **Your own `AGENTS.md`**, and your own consumer template beneath it.
- **Your own version of `consumer-init.prompt.md`.** Your consumers are products,
  the same way Dessau's are, and they need the same paste-ready artefact — adapted
  from Dessau's own, `libs/dessau` replaced throughout by your own repository's
  path and URL. Without it, your first product's agent either hand-edits Dessau's
  copy (the exact silent drift `consumer-init.prompt.md` exists to prevent) or
  gets no prompt at all. `derived-system-init.prompt.md` asks for this as part of
  step 7.

  **This one does not stand alone — `consumer-init.prompt.md`'s own stated
  philosophy is that it routes to a recipe rather than repeating one**, the
  same reason `derived-system-init.prompt.md` gives for routing to *this*
  file instead of restating it. That recipe is `new-product.md`, and it is
  unconditional: copy it too, paths one layer deeper than yours (a product
  consuming you sees `libs/<you>/libs/dessau/...`, not `libs/dessau/...`
  directly), or your `consumer-init.prompt.md` inherits Dessau's philosophy
  in name only and repeats the plumbing steps inline — the exact second copy
  that line exists to prevent, and it will not be obvious from reading the
  prompt alone that the recipe it claims to route to was never built.

  **Not every recipe needs this treatment, and the recipe does not currently
  say which is which.** `override-a-component.md` is pure mechanism — cascade
  layers, container queries, the ARIA contract — with no path assumptions or
  Dessau-specific values, so point your own `AGENTS.md` at Dessau's copy
  directly rather than forking it. `new-component.md`, `new-pattern.md` and
  `new-requirement.md` are about extending the design system itself, or
  Dessau's own maintainer workflow — not a product's concern, and out of
  scope for you too under the same "do not build components" instruction
  that applies to standing yourself up. Only `new-product.md` is both
  product-facing and path-sensitive, which is what makes it the one that
  needs an adapted copy rather than a pointer.

  **Your adapted `consumer-init.prompt.md` points a product at two rendered
  references, not one, and that is the shape to write in from the start.**
  You substituted tokens, not markup — so your own `reference/` shows the
  right *appearance* and Dessau's, one level down through the nested
  submodule, is the one that independently re-proves markup and ARIA are
  still correct, because your own reference does not re-verify what you
  never touched. Neither reference is a fallback for the other; a product
  agent needs both, and the prompt should say so:

  ```
  <your-reference-url>
    <Your system>'s own tokens — copy colour, spacing and depth from here.

  <dessau-reference-url>
    Dessau's. Markup and ARIA are correct there; the visual values are not
    — <your system> substitutes those.
  ```

  One URL per line, its explanation on the line below rather than trailing
  and hand-aligned against it — a trailing explanation long enough to need
  alignment is the shape that overflows the first time it renders somewhere
  narrower than the editor it was written in. Found by hitting exactly this
  going from Dessau's one-reference original to a derived system's
  necessarily-two-reference version.
- **Your own reference.** Every component you ship is rendered on it, from your own
  markup and in your own values. You inherit Dessau's rule rather than the softer
  product version: `check-reference.mjs` exists because an earlier version verified
  that the reference *page* existed, which every entry passed while twelve
  components had no demo anywhere.

  **`check-reference.mjs` passing is not the same claim as "the reference is
  done."** The script verifies `agent/index.json`'s catalogue against the
  pages — components and patterns, the indexed entries. Dessau's own
  `reference/` directory has pages that are neither: `foundations.html`,
  `writing.html` (the UX-writing standard), `architecture.html` (the layer
  model and consumption story). All three are invisible to the script in both
  directions — leave one pointed at Dessau's own copy and the gate has
  nothing to say about it. One derived system missed `writing.html` and then
  `architecture.html` on two separate passes, both times behind an already-
  green `check-reference.mjs`; twice on the same root cause is a pattern, not
  a one-off. **Copy the whole directory's shape, not the indexed subset**:
  every page in `reference/` gets read and repointed, whether or not
  `agent/index.json` knows it exists.

  `architecture.html` carries its own trap inside the trap: most of the page
  (the layer model, the component/pattern test, the JS model, browser
  support) is genuinely generic and needs no rewrite, but its "how a product
  consumes this" section is consumption-specific content — Dessau's version
  names `new-product.md`, yours names your own equivalent (see below), and
  copying the section verbatim describes onboarding onto the wrong system.
  The markup-vs-prose split from earlier in this step isn't only a
  per-page decision; it can run within a single page too.

  **`reference/assets/reference.css`'s header logo assumes you have one, and
  breaks silently if you don't.** The `@supports (mask-image: …)` block that
  masks `dds-logo.svg` over `.ref-brand-logo` also hides `.ref-brand-name`
  unconditionally *within that same block* — deliberately, so the text stays
  visible in a browser without mask-image support and only disappears where
  the logo is guaranteed to draw in its place. That guarantee holds for
  Dessau, which always renders a `.ref-brand-logo` element. It does not hold
  for a derived system with no brand mark, which is the ordinary case — you
  substitute tokens, not necessarily a logo. Copy the stylesheet without
  adding your own `.ref-brand-logo` markup and every reference page's header
  text is masked to 1×1px in any current browser, with nothing drawn in its
  place: not a missing logo, a blank header, and no error anywhere. Either
  add your own mark as `.ref-brand-logo`, or delete the `@supports` block so
  the name stays visible — check which by loading a page and looking at the
  header, because `check-css.mjs` and `check-reference.mjs` have no way to
  know a `mask-image` rule with nothing to mask is a bug.

  **The root overview page (`index.html`) carries real weight, not a redirect
  stub.** Dessau's own is a six-decisions summary, the layer model, component-
  vs-pattern guidance, agent-context pointers and a real integration example
  — not a landing page that defers everything to `reference/`. A derived
  system owes the same depth, adapted: its own decisions, its own position in
  the layer model, its own consumer path. Check 5b (above) only asks that
  root not be a dead end; this is a separate, higher bar this step is asking
  for regardless of what that check verifies.

  The rule for *what* goes in it is the same one your own consumers will follow,
  and it is written once in `consumer-AGENTS.template.md` → "This product keeps its
  own reference": used unchanged needs no entry, **built differently needs one, and
  the upstream page is then explicitly not its reference.** At your level
  "unchanged" is rare — you have replaced the whole foundation, so almost
  everything reads differently and almost everything needs rendering. Assume you
  are showing all of it until you can argue otherwise, and treat "we only
  substituted tokens, nothing changed structurally" as the argument to make
  explicitly rather than the default to assume — an agent building products
  against you cannot verify a colour claim it cannot see rendered, and "trust the
  CSS cascade" is not the same guarantee as a page.

  **Markup is safe to copy verbatim. Prose is not.** Dessau's reference pages
  read colour and spacing values live from the tokens (`data-ref-swatches` and
  the like), so copied markup renders correctly against your substitution with
  no edits — but Dessau's reference *prose* names specific values that are
  Dessau's, not architecture: a webfont table naming Space Grotesk and Inter,
  a line describing elevation as a two-part shadow, "action indigo." Copying
  that verbatim ships a reference that renders right and reads wrong —
  accurate swatches next to a description of a different system's choices.
  Read every paragraph that names a font, a shadow, a hue or a number, and
  rewrite the ones that are actually about yours.
- **A statement of what you promise**, in the shape of DECISIONS 037. Your
  consumers need to know what may change under them, and you now have Dessau's
  contract *and* whatever you added on top.

## 7. Updating Dessau

```bash
git submodule update --remote libs/dessau
```

Then rebuild, run your repointed checks, and read Dessau's commits since your last
pin for anything touching the contract in DECISIONS 037. A deliberate, separate
step — never part of an unrelated commit.

Because you substituted rather than forked, this stays a bump. That is the whole
reason for the shape of step 0.

---

## How far this recipe has actually been executed

Stated for the reason `new-product.md` states it: "these instructions have never
been run" was silently true of that one for long enough to be worth never letting
it be true silently again (#5).

**Executed once (#72),** standing up `caberpunky-ds`. What the walk found is
folded into the steps above; summarised here:

- **Step 4 held up**, with one real trap not previously written down: a ramp
  swap ripples across four sections of `semantic.css`, not one, and at least one
  pair in Dessau's own file is hand-written hex rather than a `var()` reference.
  Now flagged in step 4.
- **Step 5's six scripts were presented as equivalently mechanical and are
  not.** Three of the six (`check-css.mjs`, `check-agent-index.mjs`,
  `check-reference.mjs`) assume the repository owns a full `dds/js/`
  directory and a fully-populated component catalogue, and misbehave at both
  ends of populating one: they crash on an empty catalogue, and once the
  catalogue is genuinely populated with inherited entries, `check-css.mjs`
  and `check-agent-index.mjs` need to search Dessau's own `dds/css` and
  `dds/js` too — not just the derived system's own two files — or every
  inherited entry reports as missing (one run went from 0 findings on an
  empty index to 384 on a real one, purely from search-path scope, zero
  actual drift). `check-reference.mjs`'s own check 5b additionally assumes
  Dessau's specific root-redirect convention and needed widening for a
  derived system with a real landing page. All now flagged in step 5.
- **Step 1's suggested layout works against step 5's repointing ask.** Mirroring
  Dessau's own `dds/`-shaped directory layout turns "repoint five scripts" into
  a directory copy, because every script's hardcoded paths are relative to its
  own location. The walk used the mirrored shape rather than `tokens/` +
  `client-ds.css`. Now offered as the recommended layout in step 1.
- **Step 5 asked for `check-reference.mjs` before step 6 established whether
  there was anything to reference.** A forward pointer now sits at the top of
  step 5.
- **Step 6's "every component rendered" read as unconditional and produced a
  real judgement call** about what a token-only substitution owes. Resolved by
  treating "nothing changed" as the claim to argue explicitly rather than
  assume — see step 6.
- **The accent-separation floor was closer than expected for the ordinary case
  this recipe recommends** — re-hueing an accent near an untouched status
  colour. See `derive-a-design-system.md`'s own retrospective, and #144 for the
  Dessau-side question of whether the floor itself needs revisiting.
- **A hand-written hex pair in Dessau's own `semantic.css`** broke the
  ramp-swap-by-find-and-replace assumption step 4 relied on. Filed as #145 —
  and fixed, along with #144, before this recipe's own writeback was
  considered done. A found gap that stays a filed issue is not the same claim
  as a recipe actually surviving contact with a real run.
- **Copied reference markup renders correctly against a substituted
  foundation; copied reference prose does not read correctly.** Dessau's
  reference pages pull colour and spacing live from tokens, so the markup
  needed no edits — but the prose around it names Dessau's specific choices
  (font names, a shadow description, a hue), and copying that verbatim ships
  a reference that renders right and reads wrong. ~250 lines of `foundations.
  html` prose needed an actual read-through and rewrite, not a mechanical
  copy. Now flagged in step 6.

All six gates are proven for `caberpunky-ds` (commit `2d4c150`):
`check-reference.mjs` was the one left unproven mid-walk — building a full
reference was initially treated as out of scope for exercising the recipe,
then reversed once it became clear a foundations-only reference was not
enough for a product agent to build against (#72). That reversal is itself
worth recording: the recipe's "assume you are showing all of it" line in
step 6 was right, and the instinct to treat a token-only system as exempt was
the thing to distrust, not the line. The finished reference covers all 64
components and 13 patterns Dessau ships, across five pages, with zero
`check-reference.mjs` findings.

Steps 4, 5 and 6 were, as suspected, the ones most likely to be wrong — all
three held real gaps, now closed.
