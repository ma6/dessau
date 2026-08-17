# Decisions

Lasting architectural decisions and the reasoning behind them.

A decision without its reasoning gets reversed by the next person who finds it
inconvenient. Recording *why* is what makes a constraint survive contact with a
deadline — including when that next person is me, or an agent.

Newest last. A decision is only reversed by adding a new entry that supersedes it,
never by editing the old one.

---

## 001 — No framework, no build step, no runtime dependencies

**Decision.** Semantic HTML, modern CSS, vanilla JavaScript. No React, Vue,
Angular, Svelte, Stencil, Storybook, bundler or CSS framework. The verification
scripts use the Node standard library only.

**Why.** Longevity, not minimalism. A foundation is meant to outlive the products
built on it and the fashions around it. Every dependency is a future migration, and
a foundation that needs migrating is a foundation nobody trusts to start from.

**Cost.** More is written by hand. No component-level hot reload, no ecosystem of
prebuilt widgets.

**Reversal condition.** A compelling, documented need — recorded here first.

---

## 002 — No Web Components

**Decision.** No custom elements, no shadow DOM. Behaviour is offered as
unobtrusive enhancement over working markup (`DDS.register` / `DDS.enhance`).

**Why.** Three separate reasons, any one of which would be sufficient:

1. Shadow DOM encapsulates away the custom properties the entire token
   architecture depends on.
2. A custom element that has not upgraded yet renders as **nothing** — the exact
   opposite of progressive enhancement.
3. It forces a shared JavaScript runtime on every consumer, including the ones
   that render on the server.

**Consequence.** What is shared is the CSS and token layer plus reference markup
including ARIA. A product may reimplement any behaviour in its own idiom and keep
identical markup and styling.

---

## 003 — Cascade layers, and therefore no `!important`

**Decision.** Every rule in `dds/` lives in a declared layer.

```css
@layer dds.reset, dds.foundation, dds.base, dds.typography,
       dds.layout, dds.components, dds.patterns, dds.utilities;
```

**Why.** Unlayered CSS always beats layered CSS, so a product's own stylesheet
overrides anything in DDS with no `!important` and no specificity escalation. A
plain `.my-thing { padding: 0 }` wins over `.dds-card` automatically.

Consumers fighting the cascade is the most common reason a design system gets
abandoned. This removes the fight structurally.

**Consequence.** `!important` inside `dds/` is a bug **for anything to do with
appearance** — it means the layer order is wrong. `:where()` throughout `base.css`
keeps element defaults at zero specificity.

**Two justified exceptions**, both found and reviewed during the pre-commit guidance
review (`docs/guidance-review.md`):

1. **User-preference overrides.** The `prefers-reduced-motion` block in `base.css`,
   and the spinner and skeleton fallbacks that must beat the global duration
   collapse. A component must not be able to opt out of someone's accessibility
   setting, so these deliberately win over everything.
2. **Hiding utilities.** `.dds-hidden` and `.dds-no-print`. A utility whose whole
   purpose is to hide something, and which can lose, is not a utility.

This entry originally claimed `!important` was *always* a bug. That was too absolute
and the code contradicted it, so it is corrected here rather than left as an
aspiration.

---

## 004 — Two token layers, and components consume only the semantic one

**Decision.** Primitives (`--dds-indigo-600`) carry no meaning. Semantic values
(`--dds-color-action-primary`) carry the meaning. Components use only the latter.

**Why.** Not tidiness. A primitive is theme-independent, so a component using one
renders correctly in light mode and is wrong in dark mode — **and only in dark
mode**, which is where nobody looks first. It is a silent, delayed failure.

**Enforcement.** `node scripts/check-css.mjs` reports any primitive colour used
outside the foundation layer.

**Deliberate exception.** Space, radius, type, motion, z-index and border widths
have no semantic alias, because they are not theme-dependent. Consuming
`--dds-space-md` directly is correct.

---

## 005 — Fixed values for overlays, solid statuses and selection

**Decision.** `--dds-color-*-solid`, `--dds-color-selection-*` and
`--dds-color-overlay*` are identical in both themes.

**Why.** A saturated fill that shifts per theme needs its paired text colour to
shift too, and that pairing is exactly where contrast regressions hide. One fixed
pair per status is one thing to verify instead of two.

For overlays there is a second reason: an overlay darkens whatever is behind it
rather than tinting it, so one value is correct for both themes by construction.

**Known limitation.** Overlay pairs are not machine-checkable, because the
effective background depends on the content behind. Mitigated by the strong
variant: at 85% black, near-white text clears AA against anything underneath.

---

## 006 — Container queries for components, media queries for the page shell

**Decision.** Anything with layout-shifting behaviour responds to its container.
Media queries are reserved for the page shell and for genuinely device-dependent
things.

**Why.** The same component has to work on a full page, in a narrow sidebar, in a
dialog and in the reference site's width switcher. A media query reads the window,
which has not changed, so the component lays itself out for space it does not have.
It works on the page it was written for and is wrong everywhere else.

**Consequence.** The recurring `-frame` wrapper. A container query cannot style the
element that establishes the container, only its descendants — so the outer element
carries `container-type`/`container-name` and an inner element carries the layout.
Skip the frame and the query silently matches nothing.

**Enforcement.** `check-css.mjs` reports a named `@container` with no matching
`container-name`.

---

## 007 — `:user-invalid` for the visual state, `aria-invalid` for the programmatic one

**Decision.** Never the CSS `:invalid` pseudo-class. The visual invalid state comes
from **`:user-invalid`**; `[aria-invalid="true"]` carries the programmatic state and
covers server-side and asynchronous errors.

**Why not `:invalid`.** It matches from the moment the page loads, so a required
field is styled as an error before the user has typed anything. That trains people to
ignore error styling — which is exactly the styling you need them to read later.

**Why `:user-invalid`.** It is the platform's answer to precisely that problem: it
matches only once the browser's own "the user has committed to a value" flag is set
— on blur, or on a submit attempt — and stops matching the instant the value becomes
valid. Baseline widely available since 2023-11-02.

**Superseding note.** This entry originally specified that the visual state be driven
from `aria-invalid` set by JavaScript, with a hand-tracked "has the user submitted
yet" flag. The reasoning was right; the mechanism predated `:user-invalid` becoming
Baseline. Corrected during the pre-commit Modern Web Guidance review
(`docs/guidance-review.md`, findings 9 and 10), which read
`forms/validate-input-after-interaction` and
`accessibility/accessible-error-announcement` directly.

**Consequence.** `form-validation.js` bridges the two states by testing
`field.matches(':user-invalid')` **directly**, rather than tracking its own notion of
"touched". The visual and announced states then change at the same moment, using the
same definition. Two separate notions of "touched" is how a focus ring and an
announcement end up disagreeing.

The error is linked with `aria-errormessage` — the specified attribute, exposed only
while `aria-invalid="true"` — and **also** appended to `aria-describedby`, because
screen-reader support for `aria-errormessage` is still uneven and a silently
unannounced error is the worst outcome available.

---

## 008 — One rendered representation, referenced from the agent context

**Decision.** `reference/` holds the live pages. `agent/` is prose plus
`index.json`, and points at the rendered pages by anchor. There is no parallel set
of agent-facing rendered pages.

**Why.** Two rendered representations of the same component have to be kept in
sync by hand, and hand-synced copies drift. The drift shows up in the ARIA
attributes first — which is precisely the part someone copies without reading.

**Consequence.** `check-agent-index.mjs` verifies that every entry in `index.json`
resolves to real classes, real files, real hooks and a real specification section —
and that nothing in the CSS is missing from the index.

---

## 009 — Typography: Space Grotesk, Inter, JetBrains Mono; DDS ships no binaries

**Decision.** Space Grotesk (display), Inter (body/UI), JetBrains Mono (mono), all
OFL. `dds/` contains no font files; the tokens name the family and fall through to
`system-ui`. The reference site self-hosts all three.

**Why.** The body face is the one that matters — it renders every label, field and
table cell, for hours. Inter's tabular figures and unambiguous character shapes are
exactly what a form-heavy, data-heavy foundation needs.

Not shipping binaries keeps the foundation byte-light and the licence surface at
zero for products that do not need them. The reference site self-hosts so the
typography page can actually show the typography, and so the self-hosting recipe is
advice that has been tested.

**Full evaluation of all three candidate systems:** `docs/typography.md`.

---

## 010 — Icons from Ionicons, generated, role-named, inlined

**Decision.** The sprite is built from Ionicons (MIT) by
`scripts/build-icons.mjs`. Symbol ids describe the **role**
(`dds-icon-error`), not the picture (`alert-circle`). The generated sprite is
committed and must be **inlined** into each document.

**Why role names.** The glyph behind a role can then be changed in one place rather
than at every call site, and a component never depends on what an icon happens to
look like today.

**Why inlined.** `<use href="icons.svg#…">` pointing at an external file does not
work reliably: the referenced content is cloned into a shadow tree whose style
computation does not see the referencing document's CSS. `currentColor` falls back
to black regardless of theme — and it fails **silently**, because the icon still
renders.

**Why generated.** A hand-committed sprite makes it impossible to tell later which
upstream version a path came from or whether it was edited.

**Consequence.** `.dds-icon` must not declare `fill` or `stroke` in CSS: Ionicons
carries those as inline attributes, and a CSS declaration would beat them and fill
every outline icon solid. `sync-icons.mjs --check` guards the inline copies.

**Amended (#14) — the set grows by addition, never by reuse.** A missing role is
added to `ICON_MAP`; an existing role is never pointed at a new meaning. This is
the one icon mistake nothing can check: the `<use>` resolves, the icon renders,
every script passes, and the interface shows a picture that means something else.
Four had accumulated — a sun on "show password", a document on both the upload zone
and the download link, and the navigation hamburger on an overflow menu — so the
rule is now stated in `ICON_MAP`, in `agent/foundations.md` and in
`reference/foundations.html#icons`, which is to say at all three places someone
arrives from.

**Amended (#14) — two reversals that made that rule affordable.**

*`chevron-up` returns, and the direction families are complete.* It was left out
because a disclosure rotates `chevron-down` by 180deg. Disclosures still do, and
should — the rotation animates the change and keeps both states unmistakably the
same control. But that is one component's technique, and it was standing in for a
reason the vocabulary should be missing a direction. All four chevrons and all four
arrows now exist.

*The unused-symbol rule gains a declared exemption.* `check-icons.mjs` reports a
symbol no page uses, which is what keeps the set small — and, unqualified, is also
what produced the four misuses: it forbids adding an icon until something already
needs it, and at that moment the nearest existing symbol is right there. A role may
now be declared in `ICON_MAP` with the reason it belongs without a caller; the build
emits `data-dds-vocabulary`, the checker exempts it on that declaration, and prints
every exempt symbol on each run. Three use it: `chevron-up`, `arrow-up`,
`arrow-down`. "A product might want it" is not a reason.

---

## 011 — German is the default locale; formatting via `Intl`

**Decision.** `DDS.format` wraps `Intl` with `de-DE` as the default and `en-GB` as
the documented alternative. Code, class names, comments and agent context are in
English; content, examples and formats default to German.

**Why a default at all.** A wrong number format is a correctness problem, not a
preference. `1,234.56` shown to a German reader reads as one and a bit, not as one
thousand two hundred.

**Why `Intl`.** It carries the full CLDR data — separators, currency placement,
ordering, plural rules — including for locales nobody on the project has tested.
Hand-rolled `replace('.', ',')` formatting is wrong for most of the world.

**Consequence.** `DDS.format.parseNumber()` exists because `parseFloat` reads the
German `1.234,56` as `1.234` — a silent, plausible, wrong answer.

---

## 012 — Theme: explicit choice, then system preference, then dark

**Decision.** Resolution order is: a stored explicit choice → the operating system
preference → **dark**.

**Why the dark fallback.** `prefers-color-scheme` has no reliable "no preference"
value any more; a system with nothing configured reports `light`. Both values are
therefore queried explicitly, and "neither matches" — no support, no answer —
resolves to dark rather than being silently treated as light.

**Why the stored choice always wins.** In both directions. Someone who explicitly
chose light expects light even after their operating system switches to dark at
sunset. An explicit action outranks an ambient signal.

**Requirement this creates.** The theme toggle must be present and reachable on
every page, and the choice is persisted. Light-on-dark is harder to read with
astigmatism, which is common — a product that hides the toggle has broken this
decision.

**Implementation.** `theme-init.js` must load synchronously in `<head>`, before any
stylesheet, or the page paints in one theme and repaints in the other.

---

## 013 — Modern Web Guidance: adopted, with three deliberate exceptions

**Decision.** The `modern-web-guidance` skill is used during the work, not as a
final audit. Where guidance conflicts with a documented principle, the principle
wins and the conflict is recorded here.

**Adopted:** native `<dialog>` + `showModal()`, `<details name>` for accordions,
`popover` + `popovertarget` for menus and tooltips, the Constraint Validation API,
`Intl`, `IntersectionObserver`, cascade layers, `:has()`, logical properties,
container queries, `clamp()`, `outline` + `:focus-visible`, `accent-color`,
`AbortController`, `100svh`, `scale` over `transform: scale()`, `@starting-style`,
`transition-behavior: allow-discrete`, CSS anchor positioning behind `@supports`.

**Not adopted, and why:**

- **`light-dark()`** would halve the semantic colour definitions. Declined: a
  manual theme override needs an explicit `[data-theme]` block anyway, and having
  both mechanisms is worse than having one.
- **`field-sizing: content`** is genuinely useful and not yet interoperable.
  Declined for now: a control that sizes to its content in one engine and not
  another is a layout that has to be designed twice.
- **`::details-content` and `appearance: base-select`** are not interoperable.
  Waiting.

Neither of the first two is a rejection of the guidance. Both are "not yet",
written down so the question does not have to be re-answered.

---

## 014 — Verification by script, because these failures are silent

**Decision.** Six zero-dependency scripts gate "done":

| Script | Catches |
| --- | --- |
| `check-contrast.mjs` | Any colour pair below WCAG 2.2 AA, both themes |
| `check-css.mjs` | Undefined custom properties, primitive leaks, raw colours, dead container queries |
| `check-agent-index.mjs` | Agent context that no longer matches the implementation |
| `sync-icons.mjs --check` | A stale inline sprite, or a reference to a missing icon |
| `sync-reference-toc.mjs --check` | A stale side navigation |
| `build-foundations.mjs --check` | A stale machine-readable export |

**Why.** Each catches a class of failure that produces **no** error anywhere — no
console message, no broken layout, no failing test. Just a piece of design quietly
absent, noticed weeks later, in a product, by a user.

The archetype: an undefined custom property invalidates the entire declaration at
computed-value time. It does not fall back to the previous declaration — it falls
back to `inherit`. A padding silently becomes zero.

**Limitation, stated plainly.** An automated pass is a floor, not a result. No
script can tell you whether an announcement is useful, whether focus order matches
how the page reads, or whether an error message helps.

---

## 015 — Generated artefacts: committed when consumed, ignored when not

**Decision.** `dds/icons/icons.svg` and `dds/foundations.json` are generated and
**committed**. `dist/` is generated and **git-ignored**.

**Why the difference.** Products consume the sprite and the export directly and
must not need a network round trip or a Node install to render an icon. The CSS
bundle is a pure optimisation of files that are already usable, so generating it on
demand costs one command and removes a whole class of stale-artefact problem.

Every committed generated file says so in its first lines and names the script that
makes it, and each has a `--check` mode so staleness is a failure rather than a
surprise.

---

## 016 — Bootstrap material and `src/` stay out of the history

**Decision.** `/src/`, `DESSAU_BOOTSTRAP.md` and `MINI_PROMPT*.txt` are
git-ignored. They may remain locally indefinitely.

**Why.** `src/` is local reference material from another project. The bootstrap
instructions necessarily name that project, its organisation and its domain — so
committing them would put exactly the material Dessau exists to be free of into
Dessau's first commit.

Dessau is independent by construction, not by cleanup.

---

## 017 — Filenames never contain `token`

**Decision.** The foundation files are `primitives.css`, `semantic.css`,
`foundations.md` and `check-css.mjs` — not `tokens.*`.

**Why.** The agent sandbox denies read and write on paths containing `token`, and
**the failure is silent**: a write appears to succeed and lands on a device file,
producing an empty file with no error.

**Secondary benefit.** The names turned out better. `primitives` and `semantic`
describe the architectural layer, which is the useful distinction; `tokens` names
the mechanism, which is the least interesting thing about them.

See `LESSONS_LEARNED.md`.

---

## 018 — Registration is self-sufficient, so script order cannot break anything

**Decision.** `DDS.register(name, selector, setup)` enhances matching elements
immediately if the initial document sweep has already run. The sweep itself is bound
to `DOMContentLoaded`, never to `readyState === 'loading'`.

**Why.** A deferred script executes after parsing, when `document.readyState` is
already `"interactive"`. Testing for `"loading"` therefore always took the
else branch and swept the document the instant `dds.js` finished — before
`components.js` and before every pattern file had registered. The registry was
empty; **nothing on any page was ever enhanced**, silently, because progressive
enhancement means the markup works without it.

**Why the condition was not simply corrected.** Correcting it makes the current
script order work. Making registration self-sufficient makes *every* order work,
including a lazily loaded pattern and a product registering its own enhancement from
application code. Dessau is dropped in as plain script tags with no bundler to
guarantee order, so order must not be load-bearing.

**Verified by.** `tests/enhancement.spec.mjs`. No static check can find this: the
registry is only empty at one moment during page load.

---

## 019 — The reference is verified, not maintained

**Decision.** `scripts/check-reference.mjs` is a release gate. It checks that every
indexed component is *rendered* on its reference page, that anchors resolve, that
every `--dds-*` name printed is one the CSS declares, that assets load, that markup
nests correctly, that a forced `data-theme` has a rule to match, that flex components
carry their `-body` wrapper, and that generated blocks are not stale.

**Why.** The reference is read as authoritative, so a page that has drifted is worse
than a missing one: a gap prompts a look at the CSS, a wrong page is simply believed.
Twelve components were documented with no rendered example anywhere, and the previous
check passed all of them — it verified the page *existed*.

**Consequence.** Two blocks are generated rather than written: the breakpoint
threshold table (`sync-breakpoints.mjs`) and the icon gallery (rendered from the
sprite at runtime). Both had been hand-written, and both were wrong.

---

## 020 — The theme is overridable in both directions

**Decision.** Light values are declared on `:root, [data-theme="light"]`, not on
`:root` alone.

**Why.** Custom properties inherit, so a subtree marked with a theme that has no rule
keeps whatever the root set. With only `[data-theme="dark"]` declared, a panel forced
to light inside a dark page matched nothing and stayed dark — rendering correctly, in
the wrong theme, next to a label saying "Light". It worked in light mode, which is why
looking at it did not find it.

**Cost.** Both extractors (`build-foundations.mjs`, `check-contrast.mjs`) anchor their
selector match to the start of a line and now accept a selector list. Both failed
loudly on the change, which was the right behaviour.

**Verified by.** `tests/theme-scoping.spec.mjs`, which asserts the values resolve
differently *and* the right way round — comparing them only proves they differ, and a
swapped pair would pass that.

---

## 021 — Icons are a foundation, and never a character

**Decision.** The icon set lives in `reference/foundations.html`, alongside colour and
type. Every icon is a `<use>` into the inlined sprite;
`scripts/check-icons.mjs` fails the build on a Unicode glyph, an emoji, or a
`content:` escape used as a picture.

**Why a glyph is not an icon.** A screen reader announces it — `×` on a close button
is read as "multiplication sign". It renders in whatever font happens to have it, so
weight, baseline and optical size are all wrong and shift when the font stack falls
through differently. Coverage is not guaranteed, and a missing glyph is a tofu box on
exactly the platform nobody tested. The sprite has none of those problems: it is
`currentColor`, it is `aria-hidden`, and the label lives in text.

**What the check also catches.** A `<use>` naming a symbol not present on the page
renders as *nothing at all* — no error, no fallback, just empty space in a page full
of working icons. It also reports a symbol no page uses, which is how `chevron-up`
was found to be dead weight: a disclosure rotates `chevron-down` by 180°, so the
second glyph never had a caller.

---

## 022 — Optical alignment is derived, never tuned

**Decision.** An icon beside text gets `block-size: 1lh` and
`align-self: flex-start`, not a hand-picked `margin-block-start`.

**Why.** `1lh` makes the icon's box exactly one line tall, and an SVG's default
`preserveAspectRatio` centres the square glyph inside it — correct at any font size,
any line height, and in a language whose default leading differs. The `0.15em` it
replaced was measured by eye at one size and sat visibly high everywhere else.

**Same reasoning, elsewhere.** `.dds-choice > input` centres on its label's first line
the same way. Sizing a native checkbox is not an option, so the box moves rather than
the control.

---

## 023 — What Dessau deliberately does not include

**Decision.** The following are out of scope, and the entry exists so "why is there
no X?" has an answer other than "we forgot".

**A pricing or plan-comparison card.** A side-by-side comparison of product tiers
cannot be generalised without becoming a different component: the fields, the
emphasis and the rules are all specific to what is being sold. The generic parts
exist separately — `.dds-choice-card` for choosing an option, `.dds-specs` for
comparing features, `.dds-table` for comparing down a column.

**Any format-specific identifier lookup** — a bank code, a VAT number, a national
ID number. The validation rules are domain knowledge and the checksum belongs
on a server. What is reusable is the *shape*: a read-only value resolved from
validated input, over a replaceable resolver. That is the derived-output pattern.

**Brand assets** — a logo, a mark, a favicon. Dessau is a foundation, not a brand.

**A level-3 voice guide.** Writing has three levels (`agent/ux-writing.md`); level 3
is the product's own voice and belongs to the product. It is an explicit slot in
`agent/consumer-AGENTS.template.md`, deliberately empty here.

**Committed build artefacts.** `scripts/bundle.mjs` generates into git-ignored
`dist/`. A committed minified file is a second copy of the truth that eventually
becomes a wrong copy, and nothing in the reference depends on one — which is also
why there is no cache-busting query string anywhere: there is nothing to bust.

**Organisational process.** No reviewer counts, approval gates, ticket workflows,
prescribed status transitions, team roles or escalation paths. None of it belongs in
a foundation, and a foundation that carries it makes every consumer inherit someone
else's org chart.

Dessau states what it does **not** require, explicitly, so an agent does not invent
it. That means a handful of process terms appear in `AGENTS.md`,
`agent/principles.md` and `README.md` — always as prohibitions. The whitelabel audit
lists each as a justified exception rather than dropping the term from its search, so
the same word appearing as real content would still fail the gate.

---

## 024 — The reference site has a brand; DDS still does not

**Supersedes** the "Brand assets" bullet of 023, and only that bullet. The rest of
023 stands.

**Decision.** Dessau has a mark, a logo and an icon, in
[`reference/assets/brand/`](reference/assets/brand/). They are **not** in `dds/`,
are not exported by `scripts/bundle.mjs`, and no component, token or pattern refers
to them. A product adopting DDS still receives no brand of ours.

**Why the old entry was half right.** "Dessau is a foundation, not a brand" is
correct about the *design system* and wrong about the *reference site*. The
reference is not the foundation: it is a product that consumes the foundation, and
it already says so — `assets/fonts.css` opens by explaining that DDS ships no font
binaries while the reference, being a product, self-hosts three. A product with no
favicon and no identity is not a worked example of anything. The directory boundary
keeps both halves true.

**Not in the icon sprite.** `dds/icons/icons.svg` is inlined into every page by
`scripts/sync-icons.mjs`, so a mark added there would land in every consuming
product and a white-labelling product would have to remember to strip it. Icons are
a foundation (021); a logo is the opposite of one.

**The colour rule: the brand is always the colour of the text.** No brand colour,
no field, no second palette. The mark and the logo are pure `currentColor`.

That has a consequence which is easy to get wrong, so it is written down here as
well as in `docs/brand.md`: **the brand can never be an `<img>`.** An SVG loaded as
an image is its own document with nothing to inherit from, so `currentColor` there
resolves to black — in both themes, with no error. The reference header therefore
uses the file as a CSS **mask** over `background-color: currentColor`. Inlining the
SVG is the other correct option.

**The header carries the whole logo, and the word stays in the DOM.** The mark
beside "Dessau" set in the display face is the same word twice, in two different
drawings. So the header masks `dessau-logo.svg` and hides the text — but the hiding
rule sits inside the *same* `@supports (mask-image: …)` as the mask. With mask
support: logo drawn, word hidden the way `dds-sr-only` hides things, accessible
name unchanged. Without it: no logo, and the word is simply visible, which is what
the header was before. `class="dds-sr-only"` in the markup would have hidden the
word unconditionally and left a brandless header wherever the mask is unsupported.

**The favicon is the one exception, and it is not a loophole.** A tab strip has no
text to inherit from, so `dessau-icon.svg` states `#1e1e1e` and `#f2f2f2` and
switches them on `prefers-color-scheme`, in a scoped class rather than on `:root`
so the file cannot restyle a page it is inlined into. Anything *inside* a page uses
the mark instead, which follows the site's own theme even when that disagrees with
the operating system.

**The wordmark is Inter Black, and that was measured, not chosen.** The mark's
stroke is 0.286 of its cap height; Inter's weight axis was instanced and the stem
measured at every stop (0.128 at 400 through 0.270 at 900). 900 is the only weight
that stands beside the mark without looking like an accident. The outlines are
baked into the file because an SVG used as an image gets no fonts from the
document.

**Not the display face, and this is the entry that says why.** Setting the logo
in Space Grotesk is the obvious request — it is what the reference uses for
headings. Its weight axis ends at 700, which measures 0.189: a third lighter than
the mark, with an x-height of 0.694 of the cap against Inter's 0.75 on top. Both
were rendered side by side at header size before deciding. A logo is not a
heading; two faces doing two jobs is ordinary, while a lockup whose halves
disagree about weight reads as an accident. Putting the display face in the logo
would mean redrawing the mark lighter, which is a different mark.

**Cost.** Two literal colours exist in the icon and do not follow a token change,
and the wordmark's outlines cannot be regenerated without rewriting the variable
font instancer that produced them. Both are recorded in `docs/brand.md` so the
search finds them.

**Reversal condition.** If the reference site is ever moved out of this repository,
the brand goes with it and this entry goes back to reading like 023.

---

## 025 — Requirements are tickets, and the tickets live in GitHub

**Decision.** Every requirement the maintainer states is filed as a GitHub Issue
before the work starts, written as a user story — role, capability, benefit,
context, acceptance criteria — and labelled `story`. Every commit answering it
opens its subject with `[#n]`, and the commit satisfying the last criterion adds a
`Closes #n` trailer. The procedure is `agent/recipes/new-requirement.md`.

**At the front of the subject, in brackets.** A trailer at the bottom is invisible
in `git log --oneline`, `git blame` and every GitHub list view, which is where the
history is actually read; the ticket has to be in the forty characters that get
shown. Brackets rather than a bare `#n` because a subject beginning with `#` is a
comment line to Git, and `--cleanup=strip` — the default whenever a message passes
through an editor — removes it entirely. The failure is silent and takes the whole
subject with it.

**Why.** A commit message in this repository already explains what changed and why
it was built that way, at length. What it cannot explain is what was *asked for*.
Those are different records: one is the answer, the other is the question, and the
question is the one that decays. Reading a diff six months later tells you what
somebody decided; only the ticket tells you what somebody wanted, in their own
words, before an implementation existed to describe it in. Without it the original
request is recoverable only by inferring it backwards from its own solution —
which is exactly the reasoning that gets a change reverted as pointless.

`story` separates the two directions work arrives from. Issues 1–12 are follow-ups
an agent noticed and set aside; a requirement stated by the maintainer is a
different kind of object and reads differently, so the label is what keeps the
backlog from flattening into one undifferentiated list.

**In GitHub, not in the repository.** A backlog checked into the tree goes stale
the moment the work is done, and `ISSUES-TO-CREATE.md` — git-ignored, written when
`gh` was unavailable — exists as the proof. Issues also cross-link to commits by
number in both directions, which a Markdown file cannot do. The repository holds
what is true about Dessau now; the issue tracker holds what was asked and what is
outstanding.

**Cost.** A minute before each requirement, and one more place to look. Offline
work cannot file the ticket at the moment the requirement is stated — file it when
the network returns, before the work is claimed done, not after.

**Not** a process. One maintainer, no milestones, no estimates, no status columns,
no pull requests. The ticket exists to be read later, not to be managed.

**Reversal condition.** If the backlog ever outgrows a single reader's attention,
this becomes a real tracker with real triage — and this entry is superseded rather
than edited.

---

## 026 — Every asset reference carries the hash of what it points at

**Supersedes** one clause of 023 — "there is no cache-busting query string
anywhere: there is nothing to bust". The rest of 023 stands, `dist/` is still
git-ignored, and no build artefact is committed.

**Decision.** `scripts/sync-cache-busting.mjs` appends `?v=<hash>` to every
stylesheet and script reference in `index.html` and `reference/*.html`, and to
every `@import` in `dds/dds.css`. The hash is the first eight hex characters of
sha256 over the file's own content. `npm run check` fails when a stamp is stale.

**Why the old clause was wrong.** It reasoned from the artefact and not from the
URL. `dist/` genuinely has nothing to bust — nobody links it. But the reference
links `dds/dds.css`, ten scripts and its own two assets by bare path, on pages a
returning reader has already cached. Not having a build step does not mean not
having cacheable URLs; it means the URLs are stable, which is precisely the
condition under which a browser keeps serving yesterday's copy.

And a stale script is the most expensive kind of wrong, because it does not look
like caching. It looks like the component you just changed no longer works. The
first hour goes into code that was already correct.

**Content, not a timestamp.** A version regenerated per run is one line shorter and
cannot work here: `check:generated` verifies that every generated artefact matches
what the current sources produce, and a clock-derived value is stale immediately
after it is written. Hashing the content is what lets `--check` mean anything, and
it keeps the blast radius honest — editing one pattern script re-versions that one
file, not all eighteen references.

**The imports are stamped too, and that is the point.** `dds/dds.css` is an entry
point with eleven `@import`s behind it. Versioning only the `<link>` refetches the
entry file, which then names the same import URLs it named last time, and the
browser serves every layer file from cache. It would look busted and be busted for
almost all of the CSS. So imports are stamped first, bottom-up, and the entry file
is hashed after that rewrite: the whole chain moves or none of it does.

**Cost.** `dds/dds.css` now carries generated content in a hand-written file, and a
CSS change produces a slightly larger diff than the CSS change alone.
`scripts/bundle.mjs` had to learn that `?v=` is part of a URL and not part of a
path — it asked the filesystem for `primitives.css?v=db001cd4` and got an ENOENT
that read like a missing file.

**What this does not fix.** The version lives in the HTML, so it only helps once
the HTML itself is refetched. A host serving these pages with a long max-age hands
the visitor an old page and, with it, old references. HTML must stay short-lived;
what this makes safe is caching the assets hard.

**Not stamped.** Fonts, images and `icons.svg`. They are referenced from inside
stylesheets and from `<use href>`, they change on the order of never, and reaching
them would mean parsing `url()` for a problem nobody has had.

**Reversal condition.** A real hosting pipeline with content-addressed filenames.
Then the query string is redundant and this script is deleted rather than kept
alongside it.

---

## 027 — The password reveal is automatic, not opt-in

**Decision.** `dds/js/components-forms.js` enhances every
`<input type="password">` in the document: it wraps the field in
`.dds-password` and appends a reveal toggle, with no attribute asked for and no
markup written. `data-dds-password="off"` opts a field out, and that is the
attribute's only job: the wording is read from the nearest `[lang]`, because
`<html lang>` already states the language and a second place to say it is a
second place for it to be wrong.

**Why this breaks the usual rule, deliberately.** Every other enhancement in DDS
waits for a `data-dds-*` attribute, and `dds.js` says so in as many words:
"JavaScript finds elements that opted in via a `data-dds-*` attribute". That rule
exists so nothing in DDS happens to markup that did not ask for it. It is the
right default and it is wrong here, for one reason: a missing reveal toggle is not
a missing feature, it is an accessibility defect. WCAG 2.2 3.3.8 Accessible
Authentication (Minimum) forbids a cognitive function test without an
alternative, and typing a long password blind — on a phone, with a tremor, with
dyslexia, or because the password manager did not fire — is that test.

Opt-in would have meant the compliant version is the one somebody remembered to
ask for. And the failure is invisible: a password field with no toggle looks
completely normal, on every device, in every review. Nothing would ever report
it. The evidence was already in this repository before the change — the reference
pages spelled the toggle two different ways, one of them
(`.dds-input-action`) with a class no stylesheet defined, so one of the two demos
of "how to do this correctly" was rendering an unstyled button.

**`type="password"` is the opt-in signal.** The rule's purpose is that the author
must have stated the intent in the markup. `type="password"` states it more
plainly than an attribute could, and it is the only input type where the platform
deliberately withholds the value from the person typing it.

**Scope, so this does not become a licence.** This is the one enhancement that may
act on a native type rather than an attribute, and it qualifies because all three
hold: the absence is a WCAG failure, the type alone carries the full intent, and
nothing is taken away — the field keeps its value, its `autocomplete`, its
validation and its behaviour without JavaScript. A future enhancement wanting the
same exemption has to meet all three.

**Cost.** DDS moves an element in the DOM that a product wrote, which it does
nowhere else: the input is re-parented into a generated wrapper. That is visible
to anything holding a reference to `input.parentElement`, and it means the CSS for
`.dds-password` has to be correct for markup nobody hand-wrote. An input already
inside `.dds-password` or `.dds-input-group` is left where it is, and an authored
toggle is wired rather than duplicated.

**Reversal condition.** A platform-native reveal that is reliable across engines
and not suppressed by `appearance` — Edge's own `::-ms-reveal` was exactly this
and was neither. Then the injected button is deleted and the native one is left
alone.

---

## 028 — Wording follows `lang`, and nothing else

**Decision.** Every string DDS writes into a page — an accessible name, a live
announcement — takes its language from `DDS.utils.language(element)`, which reads
the nearest ancestor `[lang]`. No `data-dds-*` attribute names a language. The
theme toggle's `data-dds-theme-toggle="de"` is gone; a leftover value logs a
warning and is ignored.

**Why.** `lang` is not decoration. It is what tells a screen reader which voice
and which pronunciation rules to use (WCAG 3.1.1), so any page worth localising
has already stated its language — and an attribute repeating it is not a
convenience, it is a second source of truth. The two can disagree, and the
disagreement is invisible in a way that matters: the button is *named* in German
and *spoken* by an English voice. Nothing on screen looks wrong. Only someone
listening finds out.

**`closest`, not `documentElement`.** A part of a page in another language has to
say so regardless (WCAG 3.1.2 Language of Parts) — that is what makes the text
pronounceable. Reading the same attribute means a control inside that part is
spoken in that part's language for free, and it is one mechanism rather than a
general rule plus an exception.

**What this exposed.** The theme toggle's announcement was assembled as
`labels[theme].short + ' — dark theme on'`: the label came from the table, the
sentence after it was written in English in the code. On a German page it
announced "Dunkel — dark theme on". Wording that varies by language cannot be
half in a table and half in the source, so the announcement became a third string
in the table.

**Cost.** A product that set `data-dds-theme-toggle="de"` on a page with no `lang`
now gets English. That page had a WCAG 3.1.1 failure the attribute was quietly
compensating for, and it is better found than papered over — hence the warning
rather than a silent change.

**Reversal condition.** A case where the language of a control genuinely differs
from the language of its surroundings and cannot be expressed with `lang`. None
is known; `lang` on the control itself covers the ones that have come up.

**Extended (#20).** The rule now applies to every string DDS writes, not to the
two controls that happened to prompt it. `DDS.utils.wording(element, table)` is
the lookup and `DDS.utils.plural(element, count, forms)` is the part that could
not be a table alone.

Three things were decided while making it universal, and each is a place where
the obvious implementation is wrong:

- **An entry containing a value is a function.** `'Remove ' + name` cannot be
  German — the verb goes last there — so a caller that decides where the value
  sits has only translated the nouns. The table owns the whole phrase, word order
  included.
- **`Intl.PluralRules`, never `n === 1`.** English and German agree about where
  the boundary falls, which is precisely why the ternary passes review: it is
  correct in both languages anybody in this repository checks. Russian has four
  categories and Arabic six. The point of the tables is that a third language is
  a data change, and a ternary quietly is not.
- **The element the words are about decides, not the component root.** An error
  message resolves from the FIELD. A form may hold a part in another language and
  has to declare it anyway (WCAG 3.1.2), so that field is spoken in that language
  and the error about it has to be too. Only a toast reads `documentElement`,
  because it is raised by the application about the page rather than from inside
  a region.

**Kept.** `DDS.formValidation.messages` still exists and is still English: it is
the table every unrecognised language falls back to. `data-dds-error-<constraint>`,
`data-dds-label` and the `messages` option all still beat the table, and
`messages.resultCount` still works even though the default behind it became a
plural rule — an option contract does not break because its default improved.

**Extended again (#44), and this is the part the rule had a hole in.** Choosing the
string by `lang` is only half of it. The string still has to be *said* somewhere,
and `DDS.announce` said it somewhere else: a single live region appended to
`<body>`, inheriting `<html lang="en">`. So the last bullet above was true of the
lookup and false of the outcome — the field decided the words, and the destination
overruled the voice. A `lang="de"` component produced correct German and VoiceOver
read it out in English. Found by ear, on a German Mac, walking #4.

`DDS.announce(message, { from: element })` now takes the element the message is
about, and there is one region per politeness **and** language — `lang` set once at
creation, never mutated. Mutating it was the smaller change and it is the wrong one
for the same reason `aria-live` is not mutated either: a screen reader is watching
that element, and an attribute changed underneath it mid-flight is not something to
depend on. Omitting `from` still means "about the document as a whole", which is
the toast's argument and remains a claim rather than a default worth falling into.

The general shape, worth stating once: **text moved out of its subtree leaves its
language behind.** Anything appended to `<body>` — a live region, a dialog, a
lightbox, a toast — is in the document's language whatever the code around it says.

---

## 029 — Container queries have no fallback, and that is written down

**Decision.** Every DDS component responds to its container, with no fallback
for engines below Baseline 2023 — Chrome 105, Safari 16, Firefox 110. Below that
floor every component stays permanently in its narrow form. No polyfill.

**Why the degradation is acceptable.** The narrow form is the mobile-first form,
and it is a complete, usable component: every control is reachable, every label
is readable, nothing is clipped and nothing is hidden. What is lost is the wide
layout, not the functionality. A user on a 2021 browser gets a design that looks
like it was made for a phone, on a desktop.

**Why it still needs saying.** That outcome is indistinguishable from a bug. The
person who meets it has no way to tell "this is the documented degradation" from
"the stylesheet failed to load", and will spend an afternoon looking for the
second. Silence is the only option here that costs somebody real time.

**Why no polyfill.** `container-query-polyfill` works by parsing the stylesheets
and re-evaluating them with a `ResizeObserver`. It is a runtime dependency, it
runs on every resize, and it does not support `@container` inside `@layer` —
which is where every rule in DDS lives. Dessau's promise is no build step and no
runtime dependencies, and that promise is worth more than the wide layout on
browsers three years out of support.

**Reversal condition.** A consumer with a measured population below the floor
that they cannot move. The answer then is a product-level stylesheet using
`@media` for that one product — not a polyfill in the foundation, and not a
second set of rules in DDS that everyone else pays to download.


---

## 030 — Built artefacts hang on a release tag, not in the tree

**Decision.** `dist/` stays git-ignored (023). A tagged release carries
`dds.css` and `dds.min.css` as attached assets, built by
`.github/workflows/release.yml` from the tag's own source.

**CSS only.** `bundle.mjs` produces no `dds.min.js`, and none is added here. The
scripts are separate files a page includes as it needs them — `dds.js` plus
whichever components and patterns it uses — so there is no single order to
concatenate them in, and a page that uses two patterns should not download
seventeen. Offering a bundle that does not exist would be worse than offering
none.

**The gap this closes.** 023 is right that a committed minified file is a second
copy of the truth that eventually becomes a wrong copy. It left a consumer with
nowhere to get one, and that contradicted "no build step" — a product pinning
Dessau as a submodule got the layer files and a bundler to run. The answer
differed depending on which document you read, which is the actual defect.

**Why an attached asset rather than a committed one.** A release asset is
versioned, immutable and outside the working tree, so it cannot drift from the
source it was built from — it is rebuilt from the tag every time, by a workflow
nobody has to remember to run. Committing `dist/` on tags only would have the
same effect with a history that is inconsistent about what a commit contains.

**What did not change.** Linking the layer files directly still works and is
still documented; `dds.css` still reaches them with `@import`. Both remain
equivalent to the bundle, and the bundle additionally removes the `@import`
timing problem — a token read from script at `DOMContentLoaded` can come back as
an empty string when the sheets arrive that way (see LESSONS_LEARNED.md).

**Reversal condition.** Releases becoming frequent enough that building on each
tag is slower than the alternative. Nothing about that is in prospect.

---

## 031 — The neutral is a true grey, in both themes

**Supersedes** the warm neutral, which was never written down here — it lived as
a comment in `primitives.css` and so was reversible by anybody who found it
inconvenient, which is exactly what this file exists to prevent. Recording it now,
in the entry that reverses it.

**Decision.** `--dds-stone-*` carries no hue at any step, in light and in dark.
Every value is the grey with the **identical relative luminance** to the warm one
it replaced, so no contrast pair in the system moved.

```text
stone-50   #fbfaf8 → #fafafa      stone-700  #514c44 → #4d4d4d
stone-100  #f4f2ee → #f2f2f2      stone-800  #3a3630 → #363636
stone-200  #e8e5df → #e5e5e5      stone-850  #2b2823 → #282828
stone-300  #d5d1c9 → #d1d1d1      stone-900  #201e1a → #1e1e1e
stone-400  #b1aba1 → #acacac      stone-950  #151310 → #131313
stone-500  #8a8377 → #848484
stone-600  #6a645a → #656565      shadow ink rgb(21 19 16) → rgb(19 19 19)
```

**Why.** The old argument was that a slight warmth reads as paper rather than as
screen, for long-form reading and dense forms. That argument is sound *at the
light end of the ramp*, and it was only ever made there.

The ramp was hue 78–85° throughout — yellow-brown — at a chroma of up to 0.020.
At L 86–99% that is paper. At L 19–34%, which is every surface in dark mode, there
is no white point anywhere in view to judge the tint against: the whole field *is*
the tint, and it reads as brown. Dark mode had inherited a decision that had only
ever been looked at in light mode, which is the failure mode `CLAUDE.md` warns
about for colour work and this repository still walked into.

**Why identical luminance.** Contrast ratios are computed from relative luminance
and nothing else, so holding luminance fixed makes every one of the 148 pairs
unchanged **by construction** rather than by re-testing and hoping. It also makes
the change honestly reversible: it is the same ramp with the hue removed, not a
new ramp with new decisions folded in.

**What did not change.** The accent stays clay — a muted terracotta is still the
right decorative counterweight, and "Bauhaus" here means material honesty rather
than red/yellow/blue geometry (see the comment on the ramp). Indigo still owns
action, the four status hues are untouched, and the overlays were already pure
black. The only other warm values in the system were the shadow ink and the two
literals in `dessau-icon.svg`, and both follow the ramp.

**Cost.** Light mode loses the paper warmth that was deliberate and defensible.
That is the trade the maintainer chose when the alternative — warm in light,
neutral in dark — would have meant the neutral was two different decisions
depending on the theme, and one of them undocumented.

**Reversal condition.** Someone establishes, by looking at both themes rather
than at one, that the warmth was worth more than the neutrality. It would then be
warm at the light end only, with the dark end explicitly exempted — and written
down here, not in a comment.

---

## 032 — Work happens on `main`; a branch is for risk, not for tickets

**Decision.** A ticket is implemented in a series of commits on `main`. There is
no branch per ticket and no pull request as a matter of course.

A branch is the right tool in three cases, and they are the only ones:

1. **Genuine parallelism** — two or more agents working at the same time, each in
   its own worktree. Here isolation solves a real problem, because the writes
   really are concurrent.
2. **Something that may be thrown away** — a large refactor or a spike whose
   outcome is uncertain. The branch is an undo, not a process.
3. **Something that needs to be seen before it lands** — a change wanting CI, or
   a second pair of eyes that actually exists.

**Why.** Branching does not avoid merge conflicts here; it defers them. A
conflict requires two changes to the same lines that did not see each other.
Dessau is maintained by one person working sequentially, so there is nothing for
a branch to be isolated *from* — the isolation is real but the concurrency it
protects against never happens.

In a design system it is worse than merely redundant. The conflict surface is not
spread across the tree, it is concentrated in a few files that almost every
ticket touches: `dds/css/semantic.css`, `dds/css/primitives.css`,
`agent/index.json`, and this file. Three tickets developed in parallel branches
would all edit the semantic layer and would *manufacture* conflicts that linear
work never produces.

The second cost is the one that matters more. Verification here is global, not
local: `check-contrast.mjs` walks every pair in both themes, and a token change
is only meaningful against the whole system. Each branch passes on its own; what
ships is the union, which nothing has checked. Splitting the work splits the
evidence, and the evidence is the point.

**Cost.** `main` is never a clean slate mid-ticket, so an abandoned change is
reverted rather than discarded, and a half-finished ticket is visible in the
history. Both are acceptable at this scale, and case 2 above is the escape hatch
for when a change is large enough that they are not.

**Consequence for agents.** Do not create a branch to "be safe". Commit small,
run the scripts, and leave the history linear and readable. See principle 13 —
this entry is the reasoning that principle states in one line.

**Reversal condition.** A second regular contributor, or parallel agent runs
becoming the normal way of working rather than the exception. Either would make
the concurrency real, and case 1 would stop being a special case.

---

## 032 — No optional `@font-face` layer; the recipe is the deliverable

**Decision.** DDS does not ship `dds/css/fonts.css`, or any other optional layer
that declares faces. A product that wants the full identity follows the
self-hosting recipe in `docs/typography.md` by hand. Extends 009, which
established that DDS ships no font binaries.

**Why the question was open.** A recipe gets followed slightly wrong, and the
three ways it goes wrong are each a real defect that is not obvious from the
result: a missing `format()` hint, `font-display` omitted, a preload without
`crossorigin`. A linkable file would make those unmissable.

**Why the answer is still no.** All three are already written out in the recipe,
each with its reason attached, precisely because they are the three that go
wrong. A file that protects against mistakes the instructions already prevent
buys very little — and costs a second declaration of the same thing, needing to
stay in step with the reference site's own `fonts.css`, in exchange for saving
one `<link>`.

The larger reason is the one 023 already gives for what Dessau leaves out: an
optional layer is an opinion the foundation cannot verify. DDS does not know
which faces a product has licensed, which subset it needs, what its delivery
constraints are, or where it keeps its files. Every one of those is in the
recipe as a decision the product makes, and would be a default in the file.

**Cost.** Self-hosting stays six manual steps. A product that gets one of them
wrong finds out from its own network tab rather than from us.

**Amended by #23 — a fourth way it goes wrong, and the worst of the four.** A
subsetter keeps a default set of OpenType features and drops the rest, and
`tnum`, `cv05` and `ss03` are not in that default set although DDS asks for all
three by name. Dropped, tabular figures stop aligning and no tool anywhere
reports it: the font loads, the network tab is clean, and the page is subtly
wrong. Unlike the other three, this one is invisible in the network tab — which
is the only place the paragraph above expects a product to catch its mistakes.
It is now written into the recipe in `docs/typography.md` and beside the
commands in `reference/assets/fonts.css`. It does not change the answer, because
a shipped `fonts.css` could not have prevented it either — the feature list
belongs to the subsetting step, not to the declaration.

**Reversal condition.** Evidence rather than anticipation: a product that
followed the recipe and still got it wrong. The first fix would then be a clearer
recipe, and the file only if that failed too.

---

## 033 — Five accents, selected by attribute, sharing two ramps with status

> **Superseded in part by 034.** The set, the mechanism and the ramp sharing all
> stand. The *names* do not: the hue names below were replaced by numbered slots,
> because a slot is a pointer and a hue name in it goes stale the moment a derived
> system replaces the ramp. Read 034 for what the API is now; this entry is kept
> whole because its reasoning is what 034 had to answer.

**Decision.** DDS ships five decorative accents — `clay`, `magenta`, `cyan`,
`green`, `violet` — declared per theme as `--dds-color-accent-<hue>` and
`--dds-color-accent-<hue>-subtle`. `data-dds-accent="<hue>"` on any element puts
one of them in force for that subtree by re-pointing `--dds-color-accent`. Clay
is the default, so nothing that existed before changes colour.

**Why one mechanism for two jobs.** The request was two things that look
different: a categorical set for chart series, tags and avatars, and a brand
accent a product picks for itself. They are the same thing at different scopes.
On `<html>` the attribute is a brand; on a chart bar it is one category among
five. Building them separately would have meant two vocabularies, two places to
add a sixth colour, and a product's brand accent that charts could not use.

**Why an inherited custom property rather than component variants.** Every
component that already read `--dds-color-accent` — the bar chart, the donut, the
avatar, `.dds-quote-accented` — follows without a line of new CSS, because all
that changed is a value it inherits. The alternative, `.dds-chart-bar-magenta`
and its four siblings on each of four components, is twenty classes that all say
the same thing and go stale one at a time.

**Why hue names and not `accent-1` … `accent-5`.** An ordinal set is the obvious
shape for a categorical palette and it was rejected twice over: a second name for
one colour has to be kept in step with the first, and `data-dds-accent="3"`
cannot be reviewed without a lookup table while `data-dds-accent="cyan"` can. A
product assigning colours in a loop reads the documented order and indexes it
itself.

**Why `green` and `cyan` are shared with the status ramps.** Because the
alternative is worse. The hue circle was already spoken for — red, clay, amber,
green and cyan mean something, indigo means "you can act on this" — so an accent
set of five either reuses two of those hues or mints near-duplicates a few degrees
away. Two greens nobody can tell apart is not a separation; it is a choice
everybody has to make and nobody can make correctly. A primitive is a raw value
with no meaning, and meaning is assigned one layer up. What keeps "success" and
"category three" apart is that status is never carried by colour alone, and that
**an accent may never encode status** — written into `semantic.css`,
`agent/foundations.md` and the reference page, because it is the one rule this
sharing puts weight on.

**Why the two new ramps were derived rather than picked.** Every step of
`magenta` and `violet` sits at the mean OKLCH lightness of the four older
chromatic ramps at that step, so a `600` here behaves like every other `600`
against a surface. Chroma is ~1.3× the mean: at the shared chroma these two — the
closest pair in the set — were close enough to argue about, and the extra
saturation is what buys the separation. Their hue angles are the ends of the only
free arc, with violet held back from the blue end because the next thing along it
is the action colour.

**Why a second check script.** `check-contrast.mjs` answers whether a colour can
be seen against a background. It cannot answer whether two colours can be told
apart — two hues at the same luminance have a ratio of 1.0 whether they are
obviously different or identical — and that second question is the entire point
of a categorical palette. `check-accent-separation.mjs` measures perceptual
distance in OKLab, floor ΔE 0.07, both themes. For scale: the closest pair of
meaningful colours already in Dessau is clay against red at 0.04; the shipped
accent set's worst pair is magenta against violet in dark mode at 0.109.

**Cost, and it is a real one.** An element carrying `data-theme` re-declares
`--dds-color-accent` from its theme block, so a forced-theme subtree inside a
branded page falls back to clay. This is not fixable without giving something up:
custom properties are substituted where they are declared, not where they are
used, so the theme block *must* re-declare the accent for a forced theme to work
at all — which is decision 020, and it outranks this. The workaround is one
attribute: put `data-dds-accent` on the same element as `data-theme`.

The dark clay tint also moved, from a hand-written `#3a2318` to `--dds-clay-900`.
Five bespoke dark tints would not have landed within 1.20–1.29:1 of the page by
luck; one rule for all five did, and it makes the clay tint slightly more visible
than before rather than less.

**Reversal condition.** A sixth accent being asked for. Five is the point at
which a set stops being memorable and starts being a lookup, and the honest
answer to a sixth is a product setting the two custom properties itself and
owning the contrast result — not a sixth entry here.

---

## 034 — The accent slots are numbered, and the product supplies the names

**Decision.** The five accents are `--dds-color-accent-1` … `-5`, with matching
`-subtle` tints and `data-dds-accent="1"` … `"5"`. The hue names 033 chose —
`clay`, `magenta`, `cyan`, `green`, `violet` — are gone, not aliased. Products
name the slots themselves, in their own unlayered stylesheet:

```css
[data-dds-accent="finance"] {
  --dds-color-accent:        var(--dds-color-accent-2);
  --dds-color-accent-subtle: var(--dds-color-accent-2-subtle);
}
```

No colour moved. Slot *n* is exactly the hue that used to hold that position.

**Why.** 033 rejected `accent-1` … `accent-5` for two reasons, and the first of
them is what broke: *a second name for one colour has to be kept in step with the
first.* That was correct, and it was an argument against the names 033 shipped.
`--dds-color-accent-clay: var(--dds-clay-600)` is a slot with no value of its own
— the hue name is the second name, and it is the one that goes stale.

It goes stale on a path Dessau actively recommends. `recipes/derive-a-design-system.md`
tells a product to replace a primitive ramp when it wants to change the system's
character. Do that to `--dds-clay-*` and `--dds-color-accent-clay` is grey, and
`<span data-dds-accent="clay">Vertrag</span>` renders grey and goes on saying clay
— in the markup, which is where a wrong name survives longest, because contrast
checks, separation checks and the browser all resolve the pointer without ever
reading the label. Dessau's own audits were green throughout the failure.

033's second argument — `data-dds-accent="3"` cannot be reviewed without a lookup
table, `"cyan"` can — holds only while the name is true. Once it is not, a hue
name is *worse* than an ordinal: an ordinal makes no claim, and a stale hue name
makes a false one that used to be true, which is the kind a reviewer trusts.

**Why numbers rather than something semantic.** Because there is no semantics
available at this layer, and pretending otherwise is how the hue names happened.
A decorative accent's entire job is to say "this category is not that category";
what the category *is* belongs to the product. `primary` … `quinary` was
considered and rejected twice over — it collides with `--dds-color-action-primary`,
and it asserts a rank that five peer categories do not have. So Dessau ships
positions and the product supplies meaning, which puts the name that can go stale
in the hands of the only party who can keep it true.

**What it cost.** 033's reviewability argument was real and is now spent: an
unaliased `data-dds-accent="3"` in a template *does* need a lookup. The mitigation
is that a product is expected never to write one — the aliasing pattern is in
`agent/foundations.md`, the reference page and the derive recipe — but "expected
to" is weaker than "cannot", and a product that skips the alias has traded a name
that could go wrong for a number that says nothing. That is the better failure,
not a free one.

Also spent: `clay` was the last trace in the semantic layer of the accent this set
grew out of, and a few comments now explain a name the reader can no longer see.

**Reversal condition.** A product-facing alias layer being asked for in Dessau
itself — say `--dds-color-accent-brand` as a documented synonym for slot 1. That
would be 033's argument returning with a name that cannot go stale, and it would
deserve a hearing. A return to hue names would not, unless ramps stop being
replaceable, which would cost more than this ever did.

---

## 035 — An anchored popover is `position: fixed`, and the reason is the containing block

**Decision.** In the `@supports` branch where `.dds-menu` and `.dds-tooltip` are
anchored to their invoker, `position` stays `fixed` — inherited from the base rule,
not overridden to `absolute`. The anchored branch resets `inset`, sets
`position-anchor: auto`, and leaves `position` alone.

```css
.dds-menu {
  position: fixed;          /* also the centred fallback: inset: 0; margin: auto */
  inset: 0;
  margin: auto;
}

@supports (anchor-name: --dds-probe) and (position-anchor: auto) {
  .dds-menu {
    inset: auto;
    margin: 0;
    position-anchor: auto;
    inset-block-start: anchor(bottom, 35%);
    inset-inline-end: anchor(right, 35%);
    position-try-fallbacks: flip-block, flip-inline;
  }
}
```

**Why.** `position: absolute` on a top-layer element takes the *initial containing
block*, which is anchored at the document origin. Everything an engine computes
about overflow is then computed against a box that has scrolled away from what the
reader can see — and `position-try-fallbacks` is a decision made entirely on the
answer to that question.

Both engines got it wrong from this, in opposite directions, which is what kept it
invisible for so long. Measured on `reference/navigation.html`, 1280×900:

| Engine | Situation | Behaviour |
| --- | --- | --- |
| WebKit | 400px of visible room below the invoker | flipped the menu above it anyway |
| Chromium | invoker at the bottom edge | declined to flip; menu hung 117px off-screen |

The dump that settled it: computed `top: 687.14px` on a box rendering at `285.14`
— a difference of `402`, exactly the scroll offset. A fixed element's containing
block is the viewport, so the overflow question is asked about the space the reader
actually has, and both engines then agree.

**Why this is not merely cosmetic.** The last item in these menus is "Sign out" or
"Delete selected". Off the bottom of the screen it cannot be clicked, and there is
nothing on screen to suggest it exists.

**What it cost, and what had to be proved.** A fixed element is positioned against
the viewport, so it only follows its invoker if the engine applies the anchor's
scroll adjustment. If it does not, the menu stays where it was drawn while the
button scrolls out from under it — worse than the defect being fixed, and invisible
to any test that never scrolls. `tests/menu.spec.mjs` therefore scrolls with the
menu open and asserts it is still fastened. That test is not optional decoration;
it is the evidence this decision rests on.

**Reversal condition.** An engine that tracks the anchor for `absolute` and not for
`fixed`, which would show up as the scroll test failing on one project and not the
others. The fix would then be per-engine and belongs behind a feature query, not in
a blanket swap back — reverting to `absolute` would restore both flip defects.

---

## 036 — Dessau is a base for several derived design systems, by token substitution

**Decision.** The primary consumer of Dessau is not a product. It is a **derived
design system** — one per client — which must work without Dessau, and which is
itself consumed by products. A derived system supplies its own `primitives.css` and
`semantic.css` and inherits the rest, rather than overriding Dessau from a layer
above:

```
client-ds/
  libs/dessau/        submodule, pinned, untouched
  tokens/             this system's primitives + semantic
  client-ds.css       the layer declaration and 12 imports:
                      two of its own, ten of Dessau's
  dist/client-ds.css  one file, one value per token, no Dessau at runtime
```

The `dds-` **implementation namespace** stays — and that is the only thing a
derived system inherits about its identity. **Its name, its brand, its logo, its
voice and its whole visual identity are its own.** 024 already put brand assets
outside `dds/` and kept the mark out of the icon sprite for precisely this reason:
"a white-labelling product would have to remember to strip it." Nothing about
`.dds-button` obliges a system to be called Dessau, or to look like it.

Products remain a supported consumer, one level
further down.

**Why substitution rather than overriding.** A derived system cannot ship "Dessau
plus a diff", because its consumers would then depend on Dessau. Overriding also
produces two values for every token it touches — Dessau's, with the derived value
on top — which a client sees in devtools and which grows the artefact by the size
of everything replaced.

The mechanism was already there and nothing pointed at it. `dds/dds.css` is a
`@layer` declaration and twelve `@import`s, and the first two are the foundation:
`primitives.css` and `semantic.css` under `layer(dds.foundation)`. Everything after
them declares its own layer internally and is imported plainly. **The layer
architecture already separates the values from the system**, so swapping the first
two is a supported operation rather than a workaround. It is Bootstrap's
`_variables.scss` substitution without a preprocessor, and — unlike a fork — it
keeps updates as submodule bumps.

**Why the namespace stays `dds-`, and the better reason found afterwards.** `dds`
reads as *derived design system* as readily as it reads as *Dessau Design System*.
That was not why it was chosen and is not a claim about intent — it was noticed
after this entry was written — but it is now the stronger of the two arguments. The
prefix in a client's codebase is then not somebody else's name inherited; it is a
description of what the thing is, and it is accurate in all five of them at once.
It also matches the layer chain, which has carried "Derived systems" as its own
layer since #62: the layer and the prefix are the same word.

The pragmatic argument stands underneath it. Renaming per client forks the agent context per
client: 957 `dds-` occurrences in `agent/`, 237 in `scripts/`, plus `index.json`,
every recipe and every check. Five clients would mean five diverging copies of the
thing that makes Dessau a base rather than a template somebody copied. Two derived
systems can only collide if one product loads both, and none will. Bootstrap made
the same call and it was right: everybody's Bootstrap was `.btn`, and the
differentiation lived in the values.

**What it costs.**

*Ambiguity in the wild, and it is smaller than first recorded.* A client's
developer sees `.dds-card` and cannot search for it — but the prefix at least tells
them what kind of thing it is, which a name like `acme-` would not. The class names
still carry a namespace whose documentation they do not have, and supplying that is
the derived system's job: it owes its own reference and its own `index.json` rather
than pointing at Dessau's.

*Every gate has to be repointed.* `check-contrast.mjs` and
`check-accent-separation.mjs` read `dds/css/*` by hardcoded path. A derived system
that runs them unchanged gets a green tick for Dessau's palette while its own is
unmeasured. This was already true for accents and is now general.

*Dessau inherits an obligation it did not have.* One product could be broken and
fixed. Several derived systems cannot, which is what 037 is for.

**Reversal condition.** A single derived system that needs a different namespace
badly enough to justify maintaining its own agent context — a client whose own
design system is already called something with a `dds` prefix, say. That is a
reason; taste is not.

---

## 037 — What a derived system may rely on, and what it may not

**Decision.** Dessau's public surface is a contract. A change to anything on the
first list obliges every derived system; nothing on the second is a promise.

**Contract**

- Class names — `.dds-siteheader`, `.dds-button`
- Markup structure and the ARIA that belongs to it
- Token names — `--dds-color-accent-2`, `--dds-space-md`
- The `data-dds-*` behaviour hooks
- The cascade layer names and their order
- **Which step of a ramp a component takes** — the assignment, not the value

**Implementation**

- The concrete value behind any token
- Internal selectors, and how a component is assembled inside its own markup
- Anything in `reference/`, which is a product consuming the foundation, not part
  of it
- Anything in `docs/`

**Why a list rather than a version scheme.** Pinning by commit is enough for one
product: you bump when you choose and test once. For a base carrying several
derived systems the question is no longer "did this break me" but "which of my five
does this oblige me to revisit", and a version number cannot answer that — only a
statement of what was promised can. Semver, release branches, deprecation windows
and migration tooling are all process, and a foundation that carries process makes
every consumer inherit it (023).

This is the failure that ended Bootstrap's theme ecosystem. Nothing said which
parts were promises, so everything was treated as one, and every release could
break anybody.

**The two entries that were argued about**, recorded because the arguments will
recur:

*Layer names are contract.* An unlayered override beating every DDS layer is the
whole consumer-facing guarantee, so the names cannot move. They are also contract
by duplication: a derived system's entry file restates the `@layer` declaration, so
a rename breaks it directly rather than subtly.

*Ramp assignment is contract; ramp values are not.* "A button takes `md`" is a rule
a derived system relies on when it sets its own radius ramp — if Dessau moved the
button to `lg`, every derived system's proportions would change without any of them
touching a value. That the `md` step is `0.5rem` is not a promise; a derived system
is expected to change it. #52 documented the assignment as a rule somebody can rely
on, and this entry makes that reliance real rather than incidental.

**When the contract has to change anyway**, because it will: it changes in a commit
that says so in its subject, with the migration written in the message rather than
inferred from the diff. There is no deprecation window, because there is no release
train to hold one — a derived system is pinned and updates when it chooses. What it
is owed is not delay, it is being told.

**What it costs.** A contract is a constraint on Dessau, not only a service to its
consumers. Renaming a class for clarity, restructuring a component's markup to
simplify it, or moving a component to a different radius step were all free before
this entry and are not any more.

**Untested.** No derived system exists yet, so no part of this list has been
checked against one. It is derived from how the system is built rather than from
experience of maintaining several, and the first real derived system is what will
show which line is in the wrong place.

---

## 038 — MIT, and no support

**Decision.** Dessau is MIT licensed, `Copyright (c) 2026 Martin Gude`. One licence
for the whole repository. `CONTRIBUTING.md` states plainly that there is no
support, that the issues are the maintainer's own working notes, and that pull
requests are not being accepted.

**Why MIT.** It is the intent stated in legal form: anybody may use, change, ship
and sell, provided the copyright and permission notice travel with copies, with
warranty and liability disclaimed in full. It is what the design systems this one
is modelled against use, and it is already the licence of the Ionicons material
inside `dds/`.

**Why one licence and not two.** A split — MIT for the code, CC BY 4.0 for the
prose in `agent/` and `docs/` — was drafted and dropped. It would mean explaining
which file falls under which, forever, in a repository whose whole argument is that
a second copy of anything eventually becomes a wrong copy. Creative Commons also
advises against CC licences for software, and this is CSS, JavaScript and Node
scripts with prose alongside rather than the reverse.

**Why not ShareAlike.** It was the first instinct and it would have been expensive.
A derived design system incorporates ten of Dessau's twelve CSS imports into what
it ships, which makes it an adaptation rather than a use. Under BY-SA the client's
own design system would have to be copyleft — negotiable in every engagement, and
usually not the thing a client commissioning a bespoke system expects to hear. MIT
lets a derived system carry the notice and license itself however it likes, which
is the arrangement 036 assumes.

**"No support" is not a licence term**, and the distinction is worth keeping
straight. There is no support obligation to disclaim; a licence disclaims warranty
and liability, which MIT does. What is being declined is a *relationship*, and that
belongs in prose where a person will read it rather than in a legal text they will
not.

The reason it is declined at all: the documentation burden of open source is
already paid here — the agent context, the recipes, the reversal conditions, the
"how far this has actually been executed" sections — because agents need it. What
open source would newly add is triage, response expectations, and a compatibility
promise to consumers who cannot be telephoned. 037's contract binds this repository
to a handful of derived systems it controls; extending it to strangers is a
different and unbounded commitment.

**`"private": true` stays in `package.json`**, alongside `"license": "MIT"`. It is
not a statement about openness — it prevents an accidental `npm publish`, and
Dessau is consumed as a submodule rather than a package. The two fields answer
different questions and both answers are deliberate.

**What it costs.** MIT gives away the right to do anything with this, including
compete with it, without asking. That is the trade for the reputational value of it
being visible and usable, and it is a trade rather than an oversight.

**Reversal condition.** MIT is not practically reversible for what has already been
published — anybody who has a copy keeps their rights to it. What can change is the
licence on future work. A reason to consider that would be Dessau becoming
commercially load-bearing in a way that a permissive licence undermines; wanting
peace and quiet is not one, because that is what `CONTRIBUTING.md` is for.

**Before this repository is made public**, one step remains that is easy to assume
away. The history was rewritten once already (#67) to remove material that had been
committed and later cleaned out of the working tree, and it was force-pushed. An
unreferenced commit can stay reachable by its SHA on GitHub for some time after
that — it is gone from every branch and from the local object store, but "gone from
the default view" and "not fetchable" are different claims. Ask GitHub support to
run a garbage collection before publication, and run
`node scripts/audit-whitelabel.mjs` again on the day rather than trusting that it
was clean on some earlier day.

---

## 039 — A button label wraps rather than leaving the page

**Decision.** `.dds-button` no longer sets `white-space: nowrap`. A label that
does not fit its button wraps onto a second line, with `text-wrap: balance` so
the break lands sensibly.

**What it cost to find.** `tests/viewport.spec.mjs` reported `patterns.html` as
73px too wide at 320px with **no element over the edge**, and said so for three
runs while the diagnostic was sharpened twice. The cause was an upload row's
cancel button, 69px wide, holding 197px of label. Inline text sticking out of a
`nowrap` box is not a box, so every measurement that looks at element rectangles
— which is every one anybody reaches for first — was blind to it. What found it
was asking a different question: which is the deepest element whose scrollable
area exceeds its client area.

**Why wrapping rather than the alternatives.**

- *Keep `nowrap` and clip with an ellipsis.* The full name would survive in the
  accessible name, so it is defensible, and it renders "Übertr…" in a 69px box.
  A verb the user cannot read is not a control they can use.
- *Keep `nowrap` and require short labels.* That is a rule enforced by nobody
  against content that arrives from a product, in a language the system does not
  choose. German compound nouns and a filename in a label are ordinary, not
  exotic — both were in this repository's own demo.
- *Cap the button at `max-inline-size: 100%`.* It caps the box and not the text.
  The overflow is the label, not the button.

**What it costs.** A two-word label in a very narrow container may now take two
lines where it previously took one and overflowed. That is the trade, and it is
the right way round: a taller button is a layout that still works, and a label
over the page edge is a WCAG 1.4.10 failure for the whole page.

**The general lesson, which is bigger than the button.** `nowrap` moves a
component's overflow from its own box to the page, and does it invisibly. Any
`white-space: nowrap` on something that carries content — as opposed to a
readout or a unit, which are short by construction — deserves the same question:
what happens when this does not fit?

**The other thirteen were surveyed rather than left.** `.dds-upload-item-name`
clips with an ellipsis, and says why in its own comment. `.dds-input-group-affix`
(a unit), `.dds-upload-item-size` (a file size), `.dds-kbd` (a key) and the
badge are short by construction. `.dds-table thead th` is inside the scroll
region the table now always has. `.dds-segmented-option` is the one that could
grow a long label from a product, and it is left as it is deliberately: a
segmented control with a wrapping option is a different control, and the
constraint that its options are short is part of what the component is for.

---

## 040 — Variants that differ in content or behaviour are switched, not stacked

**Decision.** On the reference pages, a component with two to five variants that
change its layout, its wording or what it does is shown one variant at a time
behind a `.dds-segmented` control: `data-ref-variants` on the specimen,
`data-ref-variant` on each child (#87). `.ref-matrix` stays for the other case.

**The dividing question** is whether the reader compares the variants side by
side or one after the other. Five button sizes in a row: the grid *is* the
comparison. Three text-media layouts in a column: the difference between them
never appears in one viewport, and the difference is the entire reason anybody
scrolled to that section.

**Why the segmented control specifically.** DDS already prescribes it for "two to
five mutually exclusive options, all visible at once", and the reference should be
the first place that takes its own prescription seriously — a documentation page
that reaches for a bespoke tab strip is evidence against the component it is
documenting. It is built from radios, so the keyboard behaviour is the platform's
and the checked option is announced rather than merely tinted.

**Three details that are not decoration.**

- Inactive variants carry the `hidden` **attribute**. Hidden with CSS instead,
  the page looks identical and every control in the two invisible variants stays
  in the tab order — the same failure Dessau already forbids for conditional form
  fields.
- Without JavaScript nothing is hidden at all: every variant stays on the page and
  CSS captions each one from its own attribute. A control is what earns the right
  to hide something.
- The width chosen in one variant is applied to the others. Without that,
  switching layouts at 375px lands back at full width, and the reader compares a
  phone layout against a desktop one and reads the difference as a variant
  difference.

**Nothing is announced on switch**, deliberately. The option's own label names
what is now on screen and the browser announces a radio becoming checked; a live
region would say it twice. The locale switch on the writing page does announce,
because it re-renders a table elsewhere on the page and its control gives no hint
of it. The distinction is whether the control already names the outcome.

**What it exposed.** The code view had to learn which variant is the sample, and
unwrapping the reference's own layout one level deep turned out to be too shallow
already. A width preview is four levels — host, frame, scroller, stage — so where
a specimen wrapped one, `<div data-ref-bp>` was serialised as the component and
`cleanClone` then stripped the generated frame out of it as reference-only.
Three specimens on `navigation.html` offered an empty `<div>` as their markup.
`tests/codeview.spec.mjs` passed on all three, because an empty div is not blank,
carries no `ref-` class and mentions no runtime attribute. Unwrapping now recurses
over both the generated classes and the authored host attributes, and
`codeview.spec.mjs` gained the assertion that would have caught it: a sample with
no content in it is not a sample.

**And it overflowed a phone on the first try**, which is worth recording because
039 predicted it in the same component and the prediction was not applied. The
segmented control keeps `white-space: nowrap` on its options deliberately — a
wrapping label is a different control, and short options are part of what the
component is for. Three variant labels of ordinary length therefore measured
366px inside a 238px slot at 320px, and nothing could give: `.dds-segmented`
would not shrink, and a grid item's `min-width: auto` handed its min-content
width to the whole column.

Two fixes, and only one of them is the general one. The labels are shorter, named
after the modifiers they select — useful on a reference page for its own sake.
But a tool other people will reach for cannot depend on everyone guessing a
character budget nobody told them about, so `.ref-variants-switch` wraps onto a
second row and caps at `100%`. Wrapping the GROUP is not what 039 ruled out:
every option stays intact and only the arrangement changes.

`tests/viewport.spec.mjs` found it on the first full run after the change, at 320
and at 390, on all three engines. The targeted specs for the switcher all passed
— they ask whether it works, and none of them asks how wide it is.

---

## 041 — Text-media writes the media first, and the phone gets it on top

**Decision.** `.dds-textmedia` has three variants — `media-start`, `media-end`,
`media-top` — and one markup contract: `.dds-textmedia-media` is the **first**
child, in all three. Below the 40rem container query every variant stacks with
the media above the text, including the trailing one.

**What it replaces.** The block had one modifier and put the media second, so the
stacked layout read text-then-media: on every phone, the image arrived after the
paragraphs it illustrates. The maintainer asked for the opposite (#86).

**The part that is a real decision.** There are two ways to draw a phone layout
that leads with the media, and they produce the same pixels:

1. Write the media first and let the stacked state be the source order.
2. Write the text first and hoist the media with `order` below the query.

The second is worse in a way no screenshot shows. `order` moves what is drawn and
not what is announced (WCAG 1.3.2), so option 2 lies about its reading order —
and it lies in the *narrow* layout, which is the one the most people are in and
the one nearly all screen-reader use is in. Option 1 spends the mismatch on the
wide layout instead, where the swap is between a text column and an illustration
column and neither order is the meaningful one.

So: the media element first, and the `order` that places the columns bound inside
the container query, where the columns exist.

**This sharpens 'bind the reorder inside the query'; it does not reverse it.**
The earlier rule said `order` must be neutral in the stacked state. It still must
be. What was implicit, and is now written down in `agent/responsive.md`, is the
step before it: **the source order is a decision.** Whatever the stacked layout
should read as, write that order in the DOM first — then let the wide layout
rearrange it. The old block had the rule right and the source order by accident.

**What `media-top` gives up.** It never becomes two columns, so at 1280px it is a
full-width image over a text block, and the text is capped at
`--dds-measure-default` because full width is not a measure. Half the width would
have been a smaller picture rather than a different layout, which is not what the
variant is for.

---

## 042 — What a script inserts is marked, and the markup sample strips it

**Decision.** Any element DDS creates and puts inside authored markup carries
`data-dds-generated`. The reference's code view removes every marked element from
its sample, in one rule (#88).

**What it replaces.** Three hand-named special cases in `reference-tools.js` — a
validation error, a combobox list, a set of ARIA attributes — in a file that knows
nothing about components and had to be edited every time one grew a generated
element. It was not edited for the lightbox. So the magnifier badge, which
`components-content.js` builds *because* promising a viewer that does not exist
would be a lie, was offered in the sample as markup to hard-code: the component's
own documentation undoing the component's own reasoning.

**Why a marker rather than a list.** The list lives in the reference tooling; the
knowledge lives in the component. A marker put on the element at the moment it is
created cannot go stale, cannot be forgotten by a file that has no reason to know
the component exists, and answers the same question for a person in dev tools —
"did I write this, or did the script?" — which previously required searching the
source for a class name.

**Not on a wrapper.** `.dds-password` and the table's scroll region are generated
too, and are deliberately unmarked: they enclose the author's own control, and
"strip this element" would take it with them. The marker means *this element is
not the author's*, which a wrapper around the author's element is not. Whole
widgets appended to `<body>` — the lightbox dialog, the toast region — need no
marker either; they are inside nobody's markup.

**The lightbox trigger stays in the accessibility tree**, which was raised at the
same time and answered the other way. Hiding the link would remove the thumbnail's
`alt` — the image's only description — and leave a focusable element with no
accessible name (WCAG 4.1.2), and it would take the enlargement away from the
readers most likely to want a bigger picture. What is hidden is the badge, which
is `aria-hidden` because the link already says where it goes. The redundancy worth
removing was the announcement, and it was already removed.

---

## 043 — The global reduced-motion collapse stays global (#101)

**Decision.** `base.css`'s `prefers-reduced-motion: reduce` block keeps
collapsing every `animation-duration` and `transition-duration` to `0.01ms`
rather than being dismantled into per-component `--animation-reduced` custom
properties. No mechanism changed. This entry exists because the guidance skill
said not to, and it is right about the general case — this is the documented
exception.

**The conflict, stated plainly.** `modern-web-guidance`'s `css.md` §9: *"DO NOT
globally apply `animation-duration: 0.01ms;` globally as it can cause certain
animations to become more jarring. Either apply reduced motion versions on a
case by case basis, or use a custom property."* `agent/principles.md` already
said the opposite, before the guidance sweep existed to disagree with it: *"the
switch is global, not per component, because a component that forgets can
genuinely make someone ill."* Per `CLAUDE.md`, a documented Dessau principle
beats the skill, and the disagreement gets written down instead of quietly
overridden. This is that write-down.

**Why the principle is right and not just older.** The guidance's own concern —
"certain animations become more jarring" — is real, but it is a claim about a
specific failure shape: an `animation` with `infinite` (or any loop) forced to
`iteration-count: 1` completes one cycle in 0.01ms and then freezes on whatever
frame the loop's `to` state leaves it on, which is not the same as "not
animating." A `transition` has no such failure mode — collapsing its duration
to near-zero lands the element on its end state, which for a state change
(colour swap, translate, rotate, opacity, fill) is exactly what "reduced
motion" is supposed to look like. Conflating the two is where "DO NOT globally
apply" overreaches: it is true of `animation-duration`, not of
`transition-duration`, and the guide's own remedy (the `--animation-reduced`
custom property, set through the `animation` shorthand) only ever addresses
`animation` — it has no equivalent for `transition` at all.

**The inventory (checklist item 1).** Every `animation:` and `transition:` in
`dds/css/`, grepped rather than estimated:

- `animation`, three sites total: `.dds-spinner` (`dds-spin`, infinite),
  `.dds-skeleton` (`dds-skeleton-sweep`, infinite), `.dds-toast`
  (`dds-toast-in`, one-shot). Both infinite ones already carry a case-by-case
  `@media (prefers-reduced-motion: reduce)` override with `!important` — the
  spinner becomes an opacity pulse, the skeleton drops its sweep entirely. The
  one-shot toast animation needs nothing extra: collapsed to 0.01ms it simply
  appears, which is correct.
- `transition`, roughly twenty-seven sites across `components.css`,
  `components-forms.css`, `components-navigation.css`,
  `components-content.css` and `patterns.css`. Colour, background-color,
  opacity, translate, rotate, scale, inline-size. None loop. None have a
  meaningful intermediate frame. Collapsed to 0.01ms, every one of them lands
  correctly on its end state.

That closes the ticket's real fear — "a third will not announce itself" — for
the current codebase: there is no undiscovered infinite animation hiding
without an override. There are exactly two, and both were already found and
fixed, the hard way, before this ticket existed.

**What the two existing overrides actually are.** Not workarounds for a broken
mechanism — they are Dessau already doing the guidance's own first-listed
remedy: *"apply reduced motion versions on a case by case basis."* The global
collapse is the floor (nothing animates fully if a component is forgotten); the
spinner and skeleton overrides are the case-by-case ceiling for the two
components where the floor alone was not good enough. That is a safety net with
two known holes patched, not a pattern being contradicted twice. Neither is
"no longer needed" — they are the mechanism.

**One honest gap, not worth closing.** `.dds-skeleton`'s override sets
`animation: none !important`, not a collapsed duration — so unlike the rest of
the system, an `animationend` listener on a skeleton would not fire under
reduced motion, contradicting the "durations collapse to ~0 rather than `none`
so JS still gets its event" guarantee stated in `base.css` and
`agent/foundations.md`. Nothing in the codebase currently listens for
`animationend` or `transitionend` anywhere (checked). Recorded here so the next
person adding such a listener checks this component first, rather than
learning it by a stuck skeleton.

**The `!important` count.** Unchanged, and already covered by
[003](#003--cascade-layers-and-therefore-no-important)'s "user-preference
overrides" exception — this entry sharpens that exception's reasoning, it does
not add to it.

**Reversal condition.** A fourth animation site is added that loops and has no
case-by-case override — then it gets one, the same way the first two did. The
global switch itself is reversed only if `agent/principles.md` is reversed
first, since the switch exists to serve the principle and not the other way
round.

---

## 044 — `.dds-tooltip` stays `popover`, not `popover="hint"` (#94)

**Decision.** `.dds-tooltip` keeps the bare `popover` attribute (the `auto`
state). It does not switch to `popover="hint"`, despite that being the value
`modern-web-guidance`'s `interest-triggered-tooltips.md` prescribes for a
tooltip specifically.

**Why this needed measurement and not reasoning.** `popover` is an enumerated
attribute. A browser that does not recognise `"hint"` applies its own
*invalid-value default*, and the HTML spec leaves engines free to choose one —
it is not something a guide, or a changelog, or a support table can answer
correctly from outside a browser. Guessing wrong in either direction was
possible: assuming the default is `auto` when it is actually `manual` ships a
component with no light dismiss and no Escape to every Safari user, which is
the exact WCAG 2.2 1.4.13 failure the current `popover` design exists to
avoid. So this was checked directly rather than inferred from the guide's
support table, which only states feature *availability*, not fallback
*behaviour* — those are different questions and the table only answers one.

**The measurement.** A minimal page — one `popovertarget` button, one
`popover="hint"` target — driven through Playwright on all three engines,
checking the `popover` IDL reflection, dismissal on an outside click, and
dismissal on `Escape`:

| Engine | `.popover` reflects | Outside click dismisses | Escape dismisses |
| --- | --- | --- | --- |
| Chromium | `hint` | yes | yes |
| Firefox | `hint` | yes | yes |
| WebKit | `manual` | **no** | **no** |

WebKit's invalid-value default is confirmed as `manual`, and a `manual`
popover has neither light dismiss nor Escape by design — that is what
`manual` means. This is the regression the ticket asked whether the fallback
avoided. It does not. (Measured through Playwright's bundled WebKit, which
implements the same popover behaviour as Safari; not measured in Safari
itself, which is close enough for an attribute default defined by the HTML
spec and implemented in WebKit's DOM code, not in Safari's application
layer.)

**What stays true regardless.** `role="tooltip"` continues to not be set by
hand — the guide is right about that independent of which popover state is
used, and `.dds-tooltip`'s implicit role already comes from being referenced
by `aria-describedby`, not from `popover="hint"`. `interestfor` stays out of
scope, per the ticket, under [001](#001--no-framework-no-build-step-no-runtime-dependencies)
— it has no native support outside Chrome/Edge and needs a polyfill.

**Reversal condition.** Safari changes `popover="hint"`'s invalid-value
default, or ships `hint` support outright. `agent/modern-web-guidance.md`'s
row for this is the thing to check first — re-measure with the same script
before flipping the attribute, rather than trusting that a new Safari version
number means the fallback question is settled.

---

## 045 — `.dds-toc` keeps revealing from `scroll`, not `scrollend` (#98)

**Decision.** `.dds-toc`'s reveal — the `getBoundingClientRect()` pair and the
`scrollTop` write that keep the marked entry inside its scrolling list — stays
on the existing rAF-throttled `scroll` handler. It does not move to
`scrollend`, even though `defer-work-until-scroll-ends.md` names exactly this
shape (layout-dependent work inside a `scroll` handler) as the thing to move.

**Why this needed measurement and not just agreement with the guide.** The
guide's reasoning is sound in general, but the ticket that found this
correctly declined to fix it on the strength of the reasoning alone: "the
cost is a handful of forced layouts across a whole page rather than sixty a
second" is a claim about *how often*, not about whether the cost is large
enough to matter, and moving to `scrollend` is not free — the marked entry
would stop following during a slow continuous scroll and jump to catch up
once the reader stops, which is a real, user-visible behaviour change made
for a performance reason that had not actually been checked.

**The measurement.** `components.html` has the most `.dds-toc` entries of any
reference page (30, against 6–20 elsewhere) and a page height where the
sticky list genuinely overflows and scrolls itself — confirmed directly
(`.ref-aside`: `scrollHeight` 858 vs `clientHeight` 704) rather than assumed
from the CSS. A simulated slow scroll from top to bottom (150 steps, 16ms
apart, driving real `scroll` events) was run twice through Chrome's
`Performance.getMetrics`, once against the current code and once with
`Element.prototype.scrollTop`'s setter replaced by a no-op — keeping both
`getBoundingClientRect()` reads in `reveal()` but removing only the write, to
isolate its cost. Confirmed the no-op actually changed behaviour first: the
list's own `scrollTop` ended the run at 154px with the write live, 0px with
it disabled — so the write really was running and really was neutralised,
not silently skipped for some unrelated reason.

| | Layouts | Layout duration | Script duration | Task duration | Long tasks (>50ms) |
| --- | --- | --- | --- | --- | --- |
| Write live (current code) | 43 | 8.25ms | 11.80ms | 253.10ms | 0 |
| Write disabled (isolated) | 43 | 8.29ms | 11.44ms | 253.17ms | 0 |

Identical layout count, and every duration within noise of the other. Zero
long tasks in either run, across the whole scroll. The forced layout the
guide warns about is real in shape — a write followed by a read that needs
current geometry — but at this component's scale (a few dozen list items,
firing only when the marked entry changes, not once a frame) it does not
surface as measurable cost, on the page most likely to show one.

**What this is not.** Not a claim that `defer-work-until-scroll-ends.md` is
wrong, or that no `.dds-toc`-shaped component ever needs `scrollend`. It is a
claim about this component, at this scale, measured rather than assumed —
the same distinction [044](#044--dds-tooltip-stays-popover-not-popoverhint-94)
draws for a different question. A page with hundreds of sections, or a
reveal that ran on every frame instead of on change, would be a different
measurement.

**The slow-scroll behaviour, decided anyway.** Even though the performance
case did not hold, the ticket asked for this to be a deliberate choice, not
a side effect of leaving the code alone: the mark **should** track a slow
continuous scroll rather than lag and catch up at rest, because it is
reporting a reading position, not a destination — a reader watching the list
while scrolling slowly is exactly the case `scrollend`-only updates would
make wrong, and there is no measured cost buying that trade back.

**Reversal condition.** A future page whose `.dds-toc` is meaningfully larger
than 30 entries, or a change that makes `reveal()` run every frame instead of
only on a mark change — re-measure with the same method before assuming
either the old numbers or the guide's general concern still apply.

---

## 046 — Enter stays inert in the wizard (#103)

**Decision.** `.dds-wizard` does not gain a `keydown` handler to make Enter
advance the current step. Enter in a wizard field continues to do nothing on
every step but the last, where it already submits natively. This was a real
option, not a straw one: `agent/patterns.md`'s own `enterkeyhint` note already
sketched the exact implementation (reuse `validateCurrent()` and `show()`,
the same path `[data-dds-wizard-next]`'s click handler takes), and the ticket
that raised this named the cost of not doing it plainly — pressing Enter
after filling a field is one of the most common things a keyboard user does,
and here it silently does nothing.

**Why inertness won anyway.** `agent/components.md`'s `enterkeyhint` section,
written for #102 just before this ticket was filed against the same
component, already states the governing reasoning: *"overriding Enter in a
form is a native behaviour worth keeping."* That line was written about
`enterkeyhint="next"` specifically, but the reasoning is not about the
attribute — it is about whether Dessau hijacks Enter's meaning inside a form
at all, and the wizard advancing on Enter is exactly that hijack, just spelled
with a `keydown` listener instead of an HTML attribute. Keeping the two
consistent mattered more than the two tickets happening to be filed
separately.

**The tie-break that made it not a coin flip.** Every other component in
Dessau that intercepts Enter (`.dds-combobox`, the one precedent) does so to
implement a widely-implemented, spec-described interaction — Enter selecting
the active option in an open listbox — and even there the code's own comment
is defensive about it: *"Otherwise it must still submit the form."* A wizard
advancing on Enter has no equivalent standard to point to; it would be a
Dessau-specific convention invented for one component. `agent/principles.md`
already prices this kind of trade: *"Replacing a native control requires
documenting what it gains and what it gives up. It always gives up
something."* What it would give up here is the one property the reference
architecture note at the top of `wizard.js` exists to protect — the module is
explicitly *"a single-page enhancement,"* not the source of truth, and the
source of truth (one URL per step, server-rendered) has never needed Enter's
behaviour touched at all, because each step there is an ordinary form.

**What is not being claimed.** Not that discoverability doesn't matter — the
ticket's cost is real and stays real. Not that no wizard-shaped component
should ever intercept Enter. Only that for *this* component, with a
server-rendered alternative that already gets this right for free, inventing
a bespoke convention to recover it in the JS enhancement was judged not worth
the "native behaviour" it spends, applying the same scale
`agent/components.md` had already set down days earlier for the adjacent
question.

**Reversal condition.** A second component independently wants to advance on
Enter, which would turn "a bespoke convention for one component" into "an
emerging pattern," and change the trade this entry weighs.

---

## 047 — The toast stays `position: fixed`; `popover="manual"` does not fix it (#115)

**Decision.** `.dds-toast-region` keeps its current `position: fixed` and a
z-index nobody can reach a `<dialog>` through. It does not move to
`popover="manual"`, despite that being both `modern-web-guidance`'s
`persistent-toast-notifications` guide's own recommendation and this
ticket's own working hypothesis going in.

**The bug is real.** `--dds-z-toast`'s comment claimed "above a dialog," and
that was false whenever a toast fired while a `<dialog>` was open — a
`<dialog>` opened with `showModal()` is promoted to the browser's top layer,
which no z-index reaches, so a toast fired from inside a dialog (`data-dds-copy`
is one call site that could do this) is announced to a screen reader and
invisible to everyone else. That part of #115 is confirmed, not in question.

**The proposed remedy was measured, and it does not work.** The hypothesis —
promote the toast region to the top layer too, via `popover="manual"`, called
lazily so the region enters the top layer *after* whatever dialog is
currently open — was built and tested directly, across Chromium, Firefox and
WebKit, both orders (dialog opened before the popover shown, and the reverse).
**A modal `<dialog>` outranks a `popover="manual"` element in every case,
regardless of which entered the top layer more recently.** Two popovers shown
in sequence stack in insertion order exactly as expected — confirmed as a
sanity check, so this is not a general top-layer misunderstanding — but a
modal dialog is not an ordinary top-layer citizen: browsers give it elevated
stacking specifically so that a *blocking* dialog cannot be visually covered
by anything else in the top layer, popovers included. That is the correct
behaviour for the dialog's own job (true modality would break if something
else could sit on top of it) and it is exactly what defeats this fix.

**What this means for the guidance.** `persistent-toast-notifications`'s
`popover="manual"` recommendation is not wrong in general — it is the right
answer for a toast competing with ordinary page content, which is the case
the guide is written for. It does not cover the specific case this ticket is
about: a toast that needs to outrank a *currently open modal dialog*, which
is a narrower and harder problem the guide doesn't address. Declined for that
reason, not because the guide's general advice is bad.

**What would actually work, and why it is not done here.** The only way for a
toast to visually outrank an open dialog is to render *inside* that dialog's
own top-layer box — reparenting the toast (or a dialog-scoped toast region)
into the currently-open `<dialog>` while one is open, and back to `<body>`
once it closes. That is a real, buildable fix, but it is a different and
larger piece of work than this ticket measured: it needs to track dialog
open/close state, decide what happens to a toast already showing when a
dialog opens over it, and re-verify focus and `role="status"` announcement
behaviour in the reparented case specifically. Filed separately as #121
rather than built here, so this measurement's answer — `popover="manual"`
alone does not solve it — doesn't get conflated with the different question
of whether the reparenting approach does.

**Reversal condition.** #121 lands with a working reparenting fix, which
supersedes this entry rather than contradicting it — this entry is about why
the *simpler* fix fails, not a claim that no fix exists.

**Superseded by [049](#049--the-toast-reparents-into-the-open-dialog-121).**
#121 landed the reparenting fix this entry predicted was the only thing that
would work. `.dds-toast-region` still keeps `position: fixed` and the same
z-index — nothing here was wrong — but the toast now gets appended inside
whatever dialog is open rather than always at body level, which is the part
this entry left undone.

---

## 048 — No `@media (prefers-color-scheme: dark)` fallback in `semantic.css` (#119)

**Decision.** `semantic.css` keeps applying dark values only through
`[data-theme="dark"]`. It does not gain a `@media (prefers-color-scheme:
dark)` block as a second, CSS-only path to the same values.

**The gap is real.** `theme-init.js` sets `[data-theme]` and is the only thing
that does. If it fails to load — a CDN outage, a CSP block, the exact class
of failure `agent/principles.md` #3 exists to survive — a page with no
`data-theme` in its markup renders light-only, silently. That doesn't match
`DECISIONS.md` #012's own stated resolution order, "neither known → dark,"
which currently lives only in JavaScript. The markup half of this gap is
already closed: every reference page, and now the documented product recipe
(#113), hardcodes `data-theme="dark"` on `<html>` specifically as the no-JS
fallback.

**Why a second mechanism is declined rather than added.** This is the same
trade `[013](#013--modern-web-guidance-adopted-with-three-deliberate-exceptions)`
already made about `light-dark()`, for the same reason, word for word: *"a
manual theme override needs an explicit `[data-theme]` block anyway, and
having both mechanisms is worse than having one."* A `@media
(prefers-color-scheme: dark)` block is a second path to the same ~60 lines of
dark tokens, scoped to fire only when `[data-theme]` is absent — which means
every future dark-mode token gets written twice, in two different selector
mechanisms, and the two copies have no structural way to be kept in sync
short of a build step this project has deliberately not adopted
([001](#001--no-framework-no-build-step-no-runtime-dependencies)). A token
added to one and not the other is a *worse* failure than the one being
guarded against: not "briefly stuck in the wrong theme until the toggle is
used," but "silently wrong forever, in the one block nobody remembers to
check both copies of."

**What actually closes the gap, and what doesn't.** The markup-level fallback
already covers every page this project ships and documents. It does not cover
a product that skips the documented recipe and writes its own `<html>` with
no `data-theme` — but that product has already diverged from the
documentation in a way a CSS fallback in `semantic.css` cannot generally
compensate for, and `agent/recipes/new-product.md` is where that
responsibility is stated, not `semantic.css`.

**Reversal condition.** Dessau adopts a build step that can generate both
copies of the dark tokens from one source (matching how
`scripts/build-foundations.mjs` already keeps `dds/foundations.json`
generated rather than hand-maintained) — at that point the duplication cost
this entry declines on is no longer real, and the trade should be re-made.

---

## 049 — The toast reparents into the open dialog (#121)

**Decision.** `DDS.toast()`'s region is chosen fresh at call time: if a modal
`<dialog>` is currently open (`document.querySelector('dialog:modal')`), the
toast is appended inside that dialog; otherwise it goes to the existing
body-level region, as before. Completes the fix
[047](#047--the-toast-stays-position-fixed-popovermanual-does-not-fix-it-115)
measured and could not finish with a smaller change.

**Why reparenting and nothing cleverer.** 047 established, by direct
cross-engine measurement, that nothing outside an open `<dialog>` — no
z-index, no `popover="manual"` — can be made to render above it, because a
modal dialog gets stacking priority over every other top-layer citizen by
design. The only remaining lever is to stop being "outside" it: a toast that
is a DOM descendant of the open dialog is part of the dialog's own top-layer
box, and needs no stacking trick at all. `.dds-toast-region`'s existing CSS
(`position: fixed`, bottom-aligned) turns out to already do the right thing
nested inside a dialog — `.dds-dialog[open]` sets a non-`none` `translate`
for its own entrance transition, which by spec establishes the containing
block for `position: fixed` descendants, so the region anchors to the
dialog's own box instead of the viewport with no extra CSS.

**Scope, decided deliberately narrower than the ticket's full list.** #121
asked four questions. Two got a real answer built; two got a documented
"not this":

- *Detect the open dialog, and place new toasts inside it* — built.
  `dialog:modal` is the browser's own answer to "is this dialog currently
  blocking the page", true only between `showModal()` and `close()`.
- *Keep `role="status"`/`aria-live` working reparented* — verified, not
  assumed: a live region created and populated as a fresh child of an
  already-open dialog announces correctly on all three engines, checked
  directly rather than inferred from spec text.
- *A toast already showing at body level when a dialog opens over it* — **not
  moved**. It stays exactly where the current (fixed) bug already leaves it:
  invisible until the dialog closes. Migrating an in-flight toast is a
  different problem — its running dismiss timer, whether relocating it counts
  as a new announcement to a screen reader — than the one #115 actually
  reported, which is a toast *created* while a dialog is already open. Scoped
  out rather than guessed at.
- *A dialog-scoped toast when the dialog closes mid-timer* — **not migrated
  back**. It closes with the dialog, the same way everything else inside a
  closed dialog stops being visible. A confirmation toast for an action taken
  inside a dialog the user has already dismissed has mostly done its job; the
  alternative (reparent back to body, preserve the timer, avoid a visual jump)
  is real complexity spent on a rarer sequence than the one being fixed.

**Reversal condition.** Either narrowed case turns out to matter in practice
— report of a toast silently lost because a dialog opened over it, or a toast
that visibly needed to survive its dialog closing — and either becomes its
own ticket, measured the same way this one was, rather than retrofitted here.

---

## 050 — 0.9.0: what the number means, and what it deliberately does not

**Decision.** `package.json` and `DDS.version` move from `0.1.0` to `0.9.0`.
Not `1.0.0`.

**What earns 0.9.** The guidance-unread gap #93 found (#86-92, a whole
session shipped without the modern-web-guidance skill actually being read)
is closed: #95 audited that surface, #106 audited everything before it — 67
components and patterns, plus the foundations layer — and every finding from
both sweeps is fixed, deferred with its own ticket and reasoning, or declined
with a recorded reason. `npm run check` and the full three-engine browser
suite are confirmed green on `main`, not just believed to be: several of
today's CI failures (#120) turned out to be genuinely latent, masked by
earlier ones in the same `&&` chain, and were only found by fixing forward
through all of them and watching the actual run go green rather than trusting
a green run from before the fix existed.

**Why not 1.0.** Three open tickets already say what 1.0 requires, and none
of them are about code quality: **#27** ("Build one real product on
Dessau"), **#55** (the consumer template "has never been executed in a real
product"), **#72** (the derived-system recipe "has never been walked against
a real derived system"). All three ask the same question from a different
angle — has anything outside this repository actually been built on it — and
the honest answer today is still no. A guidance audit, however thorough,
checks whether the system is internally consistent with its own stated
rules. It cannot check whether those rules are the right ones for a real
product's actual constraints, which is a different question with a different
kind of evidence, and Dessau does not have that evidence yet.

**What 0.9 is not a claim about.** Not "feature complete" — `agent/index.json`
and the reference pages describe what exists today, not a fixed final set.
Not "no more bugs" — #106's own sweep found a genuine cross-platform bug
(#120's header wrap) that had been invisible for as long as CI ran on
overlay-scrollbar macOS runners, which is itself evidence that "looks done"
and "is done" are not the same claim.

**Reversal condition.** #27, #55 and #72 (or their equivalent) land, meaning
a real product has actually been built against Dessau and reported back what
broke — that is what moves the number to 1.0, not a further round of
internal review.

---

## 051 — Space Grotesk's fallback `size-adjust` is 108%, not 101% (#124)

**Decision.** `"Space Grotesk Fallback"` in `reference/assets/fonts.css` ships
`size-adjust: 108%`, `ascent-override: 91%`, `descent-override: 27%`.

**Two prior values, both measured and both wrong, for the same reason.** A
cap-height-ratio derivation (10.6% width error) and, replacing it, an
eight-string average glyph-width ratio (101.4%, still 5–8% error once
shipped) were each checked against real Space Grotesk headings and both
underperformed doing nothing. The common flaw wasn't the ratio math — it was
the baseline both compared against: `"Helvetica Neue"` queried **by family
name directly**. A fallback stack never does that; it only ever reaches
Helvetica Neue through the `@font-face { src: local("Helvetica Neue"), … }`
wrapper the fallback declares. Measured directly, that wrapper resolves
`bold` to a narrower face than the family name does when queried straight
(633px vs 675px on a 48px sample) — a genuine Chromium behaviour, present
with every descriptor stripped out, so neither prior `size-adjust` value nor
the overrides caused it. Re-run against the wrapper itself, the real ratio is
108%, not 101%.

**Why this is likely also true of Inter, unexamined until now.** 108% lands
within a point of Inter's own long-shipped 107% — the same correction for
the same underlying behaviour, on the same `local("Helvetica Neue")` source,
arrived at independently for Inter well before this ticket and never
previously explained in this file. That is corroboration, not proof: nobody
re-derived Inter's 107% from first principles here, only checked that the
`ascent-override`/`descent-override` formula reproduces its shipped vertical
values when run backwards (see 050's neighbour, the block comment in
`fonts.css` itself).

**Measured outcome.** Against seven representative heading strings at 48px
bold, matched-fallback width error is 0.4–3.9% (one short-word outlier
aside), against 5–8% for the unmatched `system-ui` fallback it replaces.

**Reversal condition.** A future measurement on a different Chromium version,
or on Firefox/WebKit's own `local()` weight-resolution behaviour, finds the
633-vs-675 gap has changed or does not hold — the 108% is a measured
constant for a specific, observed browser behaviour, not a typographic
property of Space Grotesk itself, and would need re-deriving if that
behaviour changes.

---

## 052 — SemVer stays; no move to CalVer (`yy.mm.i`)

**Decision.** `package.json` and `DDS.version` keep using SemVer
(`major.minor.patch`). Considered and declined: date-based versioning of the
form `yy.mm.i` (year, month, an incrementing index within the month).

**Why.** 050 already spent the version number on a specific claim —
`0.9.0` versus `1.0.0` is tied to whether a real product has been built on
Dessau, not to how much time has passed or how many releases have shipped.
Consumers pin Dessau by tag (`v*`, [release.yml](.github/workflows/release.yml))
across a submodule boundary, so the thing worth signalling to them is
compatibility: does this release change the contract a pinned consumer
relies on. SemVer's major/minor/patch positions carry exactly that meaning;
`yy.mm.i` carries only when a release happened, which is not what a
consumer deciding whether to bump a pin needs to know. Dessau also has no
fixed release cadence to make a calendar scheme a natural fit — releases
happen when 050-style criteria are met, not on a schedule.

**Reversal condition.** Dessau moves to a release cadence regular enough
that the month of a release is more informative to consumers than its
compatibility class — which would also mean semantic version bumps had
stopped being meaningful, the same condition under which 050's reasoning
would need revisiting too.

---

## 053 — Search-and-results and upload flow, built to the combobox standard (#24)

**Decision.** `dds/js/patterns/results.js` and `dds/js/patterns/
upload-flow.js` give both patterns real behaviour — debounce, abort,
announcement, every documented state reachable, degrading to something
that works without JavaScript — closing the gap #24 found: CSS and a
specification for both, and no script behind either.

**Deviation from the ticket's own wording: upload-flow has no `DDS.register`
entry.** #24 asked for "both registered enhancements." `results.js` has
one, the same declarative path `combobox.js` offers for a static array.
`upload-flow.js` does not, on purpose — the one thing every instance
needs, the `upload` function itself, cannot come from a data attribute,
so there is no sensible zero-config default to register against. Adding a
`DDS.register` entry with nothing meaningful for it to do would be the
false-completeness this repository's own tooling exists to catch, not
progress toward it. `check-enhancement-coverage.mjs` cannot track an
enhancement that was never registered, so `tests/upload-flow.spec.mjs`
carries `@covers none` with that reasoning rather than a name the checker
would rightly reject.

**Two recovery paths for upload-flow, not one — found while testing, not
anticipated when the ticket was filed.** A client-side rejection (too
large, wrong type) and a failure after the upload was accepted (dropped
connection, server error) both land the item in `failed`, and the first
version offered "Replace" for both. That is wrong for the second case: the
file was never the problem, so forcing a new pick throws away a perfectly
good file over a transient failure. `failed` now carries which cause it
was, and shows Replace only for a rejection, Retry — re-sending the
identical file — for everything else.

**Progressive enhancement found broken while walking `definition-of-done.md`
against upload-flow specifically, not assumed correct.** The first
markup shipped the file input `hidden` in the AUTHORED markup, with only a
`type="button"` trigger to reveal it — meaning no JavaScript, no way to
reach the input at all, since that button does nothing on its own. Fixed
by inverting which element starts hidden: the input (and the form's own
submit button) start visible, and `upload-flow.js` hides them — and
reveals the trigger — only once it can actually hand both jobs to itself.
The same check found a second real bug in passing: a focused Cancel button
removed by `item.action.replaceChildren()` when its upload finished
mid-focus dropped focus to `<body>` with no visual sign anything happened;
`setItemState` now checks whether focus was inside the item before
rebuilding it, and hands focus to the new state's own button, or to the
item itself when the new state has none.

**Reversal condition.** A real, common enough need for a zero-config
`upload` default emerges — a same-origin `fetch` helper that most products
could use unmodified, the way `arraySource` serves most static lists —
in which case upload-flow gets the declarative path #24 originally
expected, and this entry's first deviation no longer holds.
