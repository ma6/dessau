# Lessons learned

Reusable experience from real work. **Not a bug tracker** — a bug that was fixed and
taught nobody anything does not belong here.

The test for an entry: *would knowing this in advance have saved someone real time,
or prevented a defect that reached a user?*

Each entry states what happened, why it happened, and what to do instead.

---

## Silent failures are the expensive ones

The thread running through most of what follows.

Every failure recorded here produced **no error**: no console message, no broken
layout, no failing test. Something was quietly absent or quietly wrong, and it was
noticed weeks later, in a product, by a user.

That is why Dessau has six verification scripts rather than a linter config. A
failure that announces itself gets fixed in minutes. A silent one gets shipped.

---

## An undefined custom property invalidates the whole declaration

`var(--dds-space-4)`, where that name does not exist, does **not** fall back to the
previous declaration. The declaration becomes invalid at computed-value time and
falls back to `inherit` or `initial`. A padding silently becomes zero.

There is no console warning. The element simply has no padding, and it looks like a
design choice.

**Do:** keep the space ramp thin and closed, so reaching for a step that does not
exist is unusual. Run `check-css.mjs`. Use a fallback — `var(--x, 1rem)` — where a
value is genuinely optional.

---

## A container query with no matching `container-name` matches nothing

`@container dds-thing (…)` with no element declaring
`container-name: dds-thing` never matches. The component stays in its base form —
usually the narrow one — at every width. No error.

The subtle version: a container query **cannot style the element that establishes
the container**, only its descendants. Writing `container-type` and the layout on
the same element produces a query that is valid, parses fine, and does nothing.

**Do:** the `-frame` pattern. Outer element carries `container-type` and
`container-name` and nothing else; an inner element carries the layout. Run
`check-css.mjs`.

---

## `order` applied unconditionally reverses the stacked order too

A component swapped its two columns with `order: 2`, outside any query. Above the
breakpoint it looked right. Below it, where the component stacks into one column,
the reorder still applied — putting the caption before what it captioned.

Invisible on a desktop. A WCAG 1.3.2 failure, because the reading order no longer
matched the visual order.

**Do:** bind any reorder **inside** the query it is meant for. If a component
stacks into one column below a threshold, `order` must be neutral there — by
leaving the rule out, not by resetting it.

---

## An externally referenced icon sprite loses `currentColor`

`<use href="icons.svg#dds-icon-check">` pointing at a separate file does not work.
The referenced content is cloned into a shadow tree whose style computation does not
see the referencing document's CSS, so `currentColor` resolves to a default —
effectively black — regardless of theme, hover state or button variant.

It fails the same way in every current engine, and it fails **silently**: the icon
renders, just in the wrong colour. Which means it survives review.

**Do:** inline the sprite once per document. Keep one source file and a script that
copies it, with a `--check` mode — "remember to update all of them" is not a
strategy, it is a promise that they will diverge.

---

## A CSS declaration beats an SVG presentation attribute

After switching to Ionicons, every outline icon filled solid black.

Ionicons carries `fill:none; stroke:currentColor` as inline attributes on each
path. `.dds-icon` declared `fill: currentColor` in CSS. CSS wins over a presentation
attribute, so the fill overrode the attribute and closed every outline shape.

The inverse also bit: paths with *no* fill attribute — the solid dot on an `i`, the
dot under a `!` — inherited the CSS `fill: none` and disappeared entirely.

**Do:** decide once where fill and stroke live. If the sprite carries them, the CSS
must not declare them. `fill="currentColor"` on the `<symbol>` covers the paths that
declare nothing, because `fill` is inherited in SVG.

---

## `background-image` paints over `background-color`

The colour swatches on the foundations page were meant to show a chequerboard
*behind* each colour, so a token that was unexpectedly transparent would look
transparent rather than white.

Every swatch came out chequered. The chequerboard was a `background-image` and the
colour was `background-color` — and background images paint **above** the background
colour, always.

**Do:** if a colour needs to sit above a pattern, make it a background *layer*:
`linear-gradient(<colour>, <colour>)` as the **first** entry in `background-image`.
Layers stack front to back, so the first one listed is on top.

---

## Never a filename containing `token`

The agent sandbox denies read and write on any path containing `token`. The failure
is silent: `Write` appears to succeed, the path resolves to a device file, and the
result is an empty file with no error. A subsequent `Edit` then fails with a
confusing permissions message.

Two files were written this way before it was noticed.

**Do:** name files after the architectural layer — `primitives.css`,
`semantic.css`, `foundations.md`, `check-css.mjs`. This turned out to be better
naming anyway: `primitives` and `semantic` describe the distinction that matters,
while `tokens` names the mechanism, which is the least interesting thing about them.

Recorded in `agent/conventions.md` and `CLAUDE.md`, because it is not discoverable.

---

## Anchor a selector search to a line start, or prose matches it

The contrast checker read its dark-mode values by finding `[data-theme="dark"]` with
`indexOf`. It found the mention inside the file's own header comment, took the text
after it, extracted zero values — and silently checked every dark pair against the
**light** values instead.

Result: 148 pairs "passing", with dark mode never actually tested. It reported
identical ratios for both themes, which is the only reason it was caught.

**Do:** anchor a selector match to the start of a line. And be suspicious of a
checker that reports suspiciously similar numbers for cases that should differ — a
verification script that cannot fail is worse than none, because it is trusted.

---

## Find the root element, not the first matching tag

`sync-icons.mjs` extracted the sprite with `indexOf('<svg')`. The sprite file's
header comment contains `<svg class="dds-icon">` as a usage example, so the script
matched that, produced a sprite beginning mid-sentence, and injected broken markup
into six pages.

**Do:** match the root specifically — `<svg\s+xmlns=` — when a file documents its
own syntax. A file that explains itself will contain examples of itself.

---

## Node's `fetch` ignores `HTTP_PROXY`

`scripts/build-icons.mjs` failed with `ENOTFOUND` while `curl` fetched the same URL
fine from the same shell. Node's built-in `fetch` does not honour the
`HTTP_PROXY`/`HTTPS_PROXY` environment variables.

In any proxied environment — a corporate network, a sandboxed agent — it fails
while every other tool on the machine works, which makes it look like a network
outage rather than a client limitation.

**Do:** in a maintainer script that must work anywhere, try `fetch` and fall back to
`curl`, with a comment saying why. The fallback is not paranoia.

---

## `emptyFor: ''` is falsy, and that silently disabled a test mode

The mock address provider took an `emptyFor` string and checked
`if (opts.emptyFor && query.includes(opts.emptyFor))`. The reference page passed
`''` to mean "always return nothing" — every string contains the empty string — and
the truthiness check skipped it entirely. The "never matches" test mode did nothing.

**Do:** `typeof x === 'string'` when the empty string is a meaningful value. This
applies to `0` and `false` for the same reason.

---

## `<details>` cannot be forced open with CSS

An attempt to have a collapsible contents list on narrow screens and an
always-visible one on wide screens tried `display: block !important` on the content
at the wide breakpoint. It does not work: a closed `<details>` hides its content
through the UA stylesheet in a way CSS cannot reliably override, and
`::details-content` is not interoperable.

**Do:** if a control only exists at one width, the state it controls will
desynchronise on resize. Eight links do not justify that. A plain always-visible
list was the right answer.

---

## Ask before generalising away breadth

A first pass reduced roughly seventy-eight source components to about forty, on the
principle that a small excellent foundation beats a large catalogue.

That principle is right and the application was wrong. The things cut were not
speculative features — they were solved problems with their accessibility work
already done: the width switcher that makes anyone actually look at the narrow
state, the full WCAG catalogue organised by check frequency, the writing standard as
its own layer, and around twenty genuinely reusable components.

Rebuilding them cost far more than keeping them would have.

**Do:** when scoping a foundation, inventory the surface explicitly — *keep and
generalise / convert to pattern / rewrite / remove* — and get the removals agreed
before writing anything. "Small and excellent" is about not inventing speculative
features. It is not a licence to discard proven ones.

---

## Documentation that is trusted and wrong is worse than missing

The reason `check-agent-index.mjs` exists.

Agent-facing context is read as authoritative. An entry naming a class that no
longer exists does not produce a question — it produces a component built against a
class that does nothing. Missing context at least prompts someone to look.

**Do:** make context verifiable. Every claim in `agent/index.json` — classes, files,
hooks, specification sections — is checked against the implementation, in both
directions: an entry that no longer resolves **and** a component in the CSS that no
entry covers.
