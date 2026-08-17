# Template: AGENTS.md for a product that uses Dessau

> **This is a template, not an active instruction file.** Copy everything below the
> line into the product repository as `AGENTS.md`, fill in the `[…]` placeholders,
> and add the product's own rules at the end. Point `CLAUDE.md` at it — either the
> same content, a one-line reference, or a symlink. Never two divergent copies.
>
> Without this file, an agent working in that repository does not know Dessau
> exists. It will invent a second button style, use raw hex values, write its own
> ARIA, and rebuild a pattern that already exists. Every one of those is expensive
> to find later and free to prevent now.

## How far this template has actually been executed

Stated for the same reason `recipes/new-product.md` states it: "these instructions
have never been run" was silently true of that recipe for long enough to be worth
never letting it be true silently again (#5).

**Not executed.** Nobody has copied this file into a product repository and watched
an agent work from it. Every line below is a claim about behaviour in a repository
that is not this one, and no check reaches it — `check-adoption.mjs` gates the
mechanical half of `new-product.md`, and nothing gates this at all. A script can
confirm that a path named here exists; it cannot confirm that an agent reading
this behaves differently from one that did not, which is the only thing this file
is for.

**What executing it would mean**, so the gap is not mistaken for a smaller one: a
separate repository with Dessau as a submodule, an agent given this file as its
only Dessau context, and one real UI task. Not a demo page in this repository —
that consumes Dessau by relative path, so it would test neither the submodule nor
the absolute `/libs/dessau/…` paths nor the sprite landing in a foreign tree, and
it would duplicate `reference/`, which is already verified.

Until somebody does that, treat the rules below as reasoned rather than tested.
They are read out of the implementation, not recalled — but that is a different
claim. Tracked as #55; when it is executed, this section says what was found.

---

# AGENTS.md — [PRODUCT NAME]

## Dessau

This product's visual and interaction foundation comes from **Dessau** — colours,
typography, spacing, component markup including ARIA, and the patterns that solve
recurring tasks.

**Location:** `[PATH, e.g. libs/dessau]`
**Read first:** `[PATH]/AGENTS.md`, then `[PATH]/agent/index.json`
**Rendered reference:** `[PATH]/reference/` — serve it and look at it when unsure
how something should behave.

**Also copy `skills-lock.json` and `.claude/settings.json` from `[PATH]` to this
product's own root**, unedited. A submodule's `.claude/` config does not extend
to the repository that contains it, so the `modern-web-guidance` skill this file
requires below is silently unavailable here until those two files exist at the
product's own root too (#122).

### Before building any UI

**Check `[PATH]/agent/index.json`.** It lists every component and pattern with its
files, classes and specification.

If it exists, use it. If something is close but not right, ask whether it should be
extended in Dessau rather than duplicated here — see "Reporting back" below.
Building a second, similar thing is the one move that is always wrong.

### What is shared, and what is not

Shared: the **CSS and token layer**, plus the reference markup including ARIA.

**Not** shared: a component runtime. There are no Web Components. The behaviour in
`[PATH]/dds/js/` is genuinely usable and entirely optional — this product may use
it as-is or reimplement any of it in its own idiom, keeping identical markup and
styling.

Icons need one extra step: the sprite from `[PATH]/dds/icons/icons.svg` must be
**inlined once per document**. An external `<use href="icons.svg#…">` breaks
`currentColor` silently — the icon renders black regardless of theme.

**The icons are third-party and carry an obligation.** They come from Ionicons under
MIT, which requires its notice to accompany copies. `sync-icons.mjs` writes a
one-line attribution above every inlined sprite — **do not strip it**, and do not
let a minifier strip it either. That line is the only trace that survives when a
deployment ships the inlined markup and not `[PATH]/dds/icons/`. The full notice is
`[PATH]/dds/icons/LICENSE-ionicons.txt`; shipping it alongside is the safer answer
if this product publishes a licences page.

### Rules that are not negotiable

- **WCAG 2.2 AA is the floor.** It outranks visual preference, convenience and
  deadline. Calculate contrast, never estimate it.
- **Semantic values only.** `var(--dds-color-*)`. Never a raw hex, never a fixed
  pixel where a value exists, and **never a primitive** like
  `--dds-indigo-600` — a primitive does not follow the theme, so it breaks dark
  mode and nothing else.
- **Use `.dds-*` classes; never redefine them.** This product's own styles get this
  product's namespace. Because Dessau uses cascade layers, an unlayered rule here
  already wins — **no `!important` is ever needed**.
- **Take the reference markup, including ARIA, and translate it** into this
  product's idiom. Do not rebuild it from a screenshot.
- **Semantic HTML first.** ARIA supplements semantics; it never replaces them.
- **Progressive enhancement.** The markup works before JavaScript runs.
- **Native before custom.** `<dialog>`, `<details>`, `<select>`, `<progress>`, the
  Constraint Validation API, `popover`.
- **`modern-web-guidance` runs during the work, on any significant HTML/CSS/JS
  task** — not recalled from training, not skipped because Dessau's own markup
  looks native-before-custom already. If the skill will not resolve, the guides
  are still on disk in Dessau's own checkout and must be read directly, the same
  rule Dessau applies to itself (`[PATH]/CLAUDE.md`).
- **Never colour alone.** Status, selection and error carry text or an icon too.
- **No Web Components / Custom Elements.** A deliberate Dessau decision; do not
  introduce them here either.
- **Light and dark both work.** Dark comes free once semantic values are used, so
  skipping it is a deliberate decision — and it goes in `DECISIONS.md` with its
  reversal condition, not into a commit message and not nowhere. A silent omission
  reads as an oversight forever.
- **Formats via `DDS.format`.** German by default: `1.234,56 €`, `01.08.2026`,
  `14:30 Uhr`. Never `parseFloat` on a formatted number.
- **A placeholder is never a label. Required is stated in words.**
- **Never style validity from CSS `:invalid`** — it matches before the user has
  typed.

### Updating Dessau

Dessau is **pinned**, not loaded live from a shared URL. A version update is a
**deliberate, separate step**: bump the pin, test this product, commit. Never part
of an unrelated feature commit.

```bash
git submodule update --remote [PATH]
```

### This product keeps its own reference

`[PATH]/reference/` shows what **Dessau** does. It cannot show what this product
does, and it is never edited — it is a pinned dependency.

So this product keeps a reference of its own, for the reason Dessau keeps one: a
reference that has drifted is worse than no reference, because a missing page sends
somebody to the code while a wrong page is simply believed.

**What needs an entry here:**

| The component is | Reference |
| --- | --- |
| Used unchanged | Dessau's. Do not copy it — a second copy is a second thing to keep true |
| Retuned only through tokens or a few declarations | Dessau's, unless it now reads differently enough that somebody comparing would be misled |
| **Built differently** — own structure, own markup | **This product's, rendered from this product's markup.** Dessau's page is explicitly *not* its reference |
| Product-specific, no Dessau equivalent | This product's |

**The third row is the one that goes wrong.** Navigation is the likely first case:
a product that replaces the site header ships something Dessau's reference does not
describe — and this file elsewhere tells you to go and look at that reference. Two
answers, no way to rank them. Adding your own version is not enough; the reader has
to be told which one this product ships.

**A replaced component is therefore also a deviation**, and belongs in the list
below. The two have to agree: anything in "Current deviations" that changes a
component's structure needs an entry in this product's reference, and anything with
an entry there for that reason is a deviation. If only one of them knows, the other
is wrong.

**Completeness is the union**, and neither half is complete alone: Dessau's
reference for what is used unchanged, this product's for everything else.

**On checking it.** Dessau gates this with `check-reference.mjs`, which verifies
that every indexed component is *rendered* rather than merely mentioned — needed,
because an earlier version checked only that the page existed, which every entry
passed while twelve components had no demo anywhere. That script reads
`agent/index.json`, so it is not repointable by changing a path or two the way
`check-accent-separation.mjs` is: wanting the gate here means keeping an index in
the same shape. Worth it or not is this product's call; going without it and
knowing that is fine, and going without it and assuming you are covered is not.

### Where reasoning gets written down

A response ends with the session. Anything that should outlive it goes in a file,
and there are three, with different jobs. Pick by **what kind of thing it is**, not
by which file you happen to have open.

| Kind of thing | Goes in | Shape |
| --- | --- | --- |
| A standing rule, or a deviation from Dessau | **this file** | The rule, and the reason it holds |
| A choice that had alternatives | `[PATH TO PRODUCT DECISIONS.md, e.g. DECISIONS.md]` | Decision · why · what it cost · reversal condition |
| Something Dessau itself should absorb | an issue in this product's tracker | See "Reporting back" |

**The test for `DECISIONS.md` is whether somebody could reasonably undo it.** "We
use Sie" is a decision — the alternative was real, and a future reader who does not
know why will mix in a Du. "The button is 8px" is not; it comes from the radius
ramp and the ramp is the decision. Write the section that would stop a future
reader from reverting the change as pointless — **why** is the part that decays,
because six months on the choice is obvious from the code and the reason is not.

**Write it in the same commit as the change.** Documentation that lags behind its
code is documentation nobody can trust, and "I will write it up after" is the
sentence that produces a product whose reasoning is only recoverable from diffs.

### Deliberate deviation

Allowed, when there is a real reason — and it must then be **documented here**:
what, why, and whether it is temporary.

Undocumented deviation is the thing that is not allowed. A documented one makes the
divergence visible; an undocumented one just looks like a mistake nobody made on
purpose.

**A deviation that changes a component's structure also needs an entry in this
product's reference** — see above. The two lists have to agree; if only one knows,
the other is wrong.

**Current deviations in this product:**

- `[none / list them here]`

### Reporting back

If you build something here that other Dessau consumers would plausibly want — a
new pattern, a missing value, a genuine gap — do two things:

1. **Say so explicitly** in your response: *"Candidate for Dessau, because …"*.
2. **File it in this product's tracker**, so it survives the session. Name what was
   built, why it looks general rather than product-specific, and what it would take
   to move it.

The first alone is not enough. A candidate mentioned only in a response is a
candidate nobody will find, and the person who could act on it is usually not the
person reading that response.

Do not leave it silently product-local, and do not move it into Dessau yourself.
That is a decision for Dessau's maintainer, not an automatic step.

### Before calling a UI change done

1. Renders correctly in **both** themes — dark is where colour mistakes hide.
2. Contrast of anything new **calculated**, not estimated.
3. Keyboard only: everything reachable, focus visible, order matching reading
   order, nothing trapped.
4. 320px wide and 400% zoom.
5. Reduced motion honoured.
6. No new console errors.
7. Screen-reader pass on anything with announcements or focus management.
8. Walk `[PATH]/agent/definition-of-done.md`.
9. Anything decided along the way is written down — see "Where reasoning gets
   written down", and in the same commit as the change.

---

## [PRODUCT NAME] — specifics

### Voice and tone

Dessau settles the writing fundamentals (`[PATH]/agent/ux-writing.md`). This
product decides its own **form of address** and **domain vocabulary** — one choice,
never mixed within an interface.

- **Form of address:** `[German Sie / German Du / English formal — pick one]`
- **Domain vocabulary:** `[the nouns of this product's subject matter, and the
  terms that must never be used for them]`

### Workflow

Dessau files a GitHub Issue before building anything, references it in every
commit subject (`[#42] fix(…): …`), and closes it with `Closes #42` in the
commit that finishes it (`[PATH]/agent/recipes/new-requirement.md`). Optional
here — nothing about consuming Dessau requires it (`new-product.md` #6) — so
state the choice rather than leaving an agent to guess it from this section's
silence:

- **Issue-first workflow:** `[adopted, same as Dessau / not adopted — requirements tracked elsewhere / not adopted — no tracking]`

### Stack and commands

```
[build / dev / test / lint commands]
```

### Structure

```
[where templates, styles, components and tests live]
```

### Anything else an agent needs

`[domain rules, integrations, data handling, environments, deployment]`
