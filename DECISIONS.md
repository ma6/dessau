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
text to inherit from, so `dessau-icon.svg` states `#201e1a` and `#f4f2ee` and
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

