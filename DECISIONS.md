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

**Why.** The source this was generalised from maintained two rendered
representations and had to keep them in sync by hand. Two copies of every component
drift, and the drift always shows up in the ARIA attributes — which is precisely
the part someone copies without checking.

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
