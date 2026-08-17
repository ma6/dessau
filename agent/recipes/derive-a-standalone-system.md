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

## 5. Repoint the gates, or they lie

This is the step people skip, and it fails in the most convincing way possible: the
checks pass.

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
- **Your own reference.** Every component you ship is rendered on it, from your own
  markup and in your own values. You inherit Dessau's rule rather than the softer
  product version: `check-reference.mjs` exists because an earlier version verified
  that the reference *page* existed, which every entry passed while twelve
  components had no demo anywhere.

  The rule for *what* goes in it is the same one your own consumers will follow,
  and it is written once in `consumer-AGENTS.template.md` → "This product keeps its
  own reference": used unchanged needs no entry, **built differently needs one, and
  the upstream page is then explicitly not its reference.** At your level
  "unchanged" is rare — you have replaced the whole foundation, so almost
  everything reads differently and almost everything needs rendering. Assume you
  are showing all of it until you can argue otherwise.
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

**Not executed (#72).** No derived system exists. Every path, count and file
structure in this file was read out of the source rather than recalled — the twelve imports, the
two foundation lines, the hardcoded paths in the check scripts — but nobody has
stood one up and found what this leaves out. Steps 4 and 5 are the ones most likely
to be wrong, because they are where a derived system stops resembling a product and
this repository has only ever been the thing above it.

When somebody does it, this section says what they found.
