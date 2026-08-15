# Responsive behaviour

Responsive behaviour belongs to components and patterns, not to a global
breakpoint sheet.

---

## The rule: container queries, not media queries

**A component responds to the space it was given, not to the browser window.**

```css
/* The frame establishes the container and does nothing else. */
.dds-thing-frame {
  container-type: inline-size;
  container-name: dds-thing;
}

/* The query targets a DESCENDANT. */
@container dds-thing (inline-size >= 40rem) {
  .dds-thing { grid-template-columns: 1fr 1fr; }
}
```

Why this and not `@media`: the same component has to work on a full page, inside a
narrow sidebar, inside a dialog, and inside the reference site's width switcher. A
media query reads the window, which has not changed, so the component lays itself
out for space it does not have. It works on the page it was written for and is
wrong everywhere else — which is exactly the failure that makes a component
non-reusable.

### The frame layer is not optional

**A container query cannot style the element that establishes the container**,
only its descendants. So the outer element carries `container-type` and
`container-name` and nothing else; an inner element carries the grid or flex
layout and is what the query targets.

Skip the frame and the query silently matches nothing — the component just stays
in its narrow form at every width, with no error anywhere.
`node scripts/check-css.mjs` reports a named `@container` with no matching
`container-name` for exactly this reason.

Components in DDS that use a frame: `.dds-siteheader-frame`,
`.dds-sitefooter-frame`, `.dds-steps-frame`, `.dds-textmedia-frame`,
`.dds-filtering-frame`. `.dds-address-search` is its own container because it
styles only descendants.

### When no query is needed at all

Prefer a layout that adapts by itself:

- `flex-wrap: wrap` — wraps exactly when it runs out of room.
- `grid-template-columns: repeat(auto-fit, minmax(min(<ideal>, 100%), 1fr))` — the
  column count follows the available space.
- `flex-basis` maths, as in `.dds-sidebar`, which collapses when the main column
  would get too narrow.

The inner `min(<ideal>, 100%)` matters: without it a single item overflows a
container narrower than the minimum, which is the classic failure of the
`auto-fit` pattern at 320px.

### A track's minimum is its content, and that is how one wide thing widens a page

A grid track sized `auto`, and any grid or flex item, cannot be narrower than its
own min-content. So a single descendant that refuses to become narrow — a table
without its scroll region, a `max-content` column, a long unbroken identifier —
makes its track wider than the viewport, and **every sibling in that track is
stretched to match**.

That is what turns one local overflow into a page-wide symptom. The grids inside
then compute their column count against a width the screen does not have, put the
later columns off-screen, and each look like a wrapping bug — while wrapping
exactly as written. It was measured once at roughly three times the viewport on a
phone, across eight sections that were all individually correct.

**So anything that lays children out in a track constrains the track and the
items:**

```css
.thing        { display: grid; grid-template-columns: minmax(0, 1fr); }
.thing > *    { min-inline-size: 0; }
```

Both, not one. A grid item's automatic minimum is its content too, so
constraining only the track moves the inflation one level down.

`.dds-grid` and `.dds-sidebar` do this for you. A product writing its own grid or
flex layout has to do it itself, and the symptom if it does not is never local to
the element that caused it — which is why this is written down rather than left
to be rediscovered.

What the guard does *not* do is make the wide thing fit. It makes it overflow
itself, and what it does about that is its own decision: scroll it (the table's
named scroll region), wrap it, or let it clip.

### A label column is a share, not a width

The same failure in miniature: a two-column pairing written as

```css
grid-template-columns: minmax(8rem, max-content) 1fr;   /* as wide as the longest term */
grid-template-columns: fit-content(40%) 1fr;            /* up to two fifths, then it wraps */
```

`max-content` means "as wide as the longest word in it", which for a label column
is a promise nobody can keep on a phone — one compound noun and the row is wider
than the screen. `fit-content(<percentage>)` gives the column what it needs up to
a share of the container and makes it wrap after that.

A proportion rather than a threshold, so there is no query, nothing to state a
reason for, and nothing that stops being true at some width nobody tested.
`.dds-keyvalue-columns`, `.dds-chart-row` and `.dds-derived-output` all use it.

And a row of controls laid out with `grid-auto-flow: column` cannot wrap **by
definition**. If they should sit side by side and drop to a second line when they
run out of room, that is `display: flex; flex-wrap: wrap`.

### When a media query IS correct

For the **page shell**, and for anything that genuinely depends on the device
rather than on available space:

- The reference site's two-column page layout — it depends on the viewport.
- `.dds-dialog-sheet` anchoring to the bottom edge on a phone — "reachable by a
  thumb" is a viewport property.
- `@media (hover: hover)`, `(prefers-reduced-motion)`, `(forced-colors)`,
  `(prefers-color-scheme)`, `print`.

---

## Four named breakpoints, and no proliferation

Two different things, and both are true.

**There are four named breakpoints**, in `primitives.css`, for the page shell:

| Token | Value | For |
| --- | --- | --- |
| `--dds-breakpoint-phone` | 30rem / 480px | one hand, one column |
| `--dds-breakpoint-tablet` | 48rem / 768px | two columns of readable text fit |
| `--dds-breakpoint-laptop` | 64rem / 1024px | a sidebar plus content fits |
| `--dds-breakpoint-desktop` | 80rem / 1280px | a third region fits |

They exist so the shell has a documented set to choose from and so a conversation has
vocabulary — "this breaks at tablet" instead of a number someone picked. They are for
the page shell and for the genuinely device-dependent cases: reachability by thumb,
print, orientation.

**A component does not use them.** A component responds to its container, and its
switching point comes from its own content — the width at which two columns of *its*
text stop being readable, or *its* labels stop fitting beside *its* controls. That
width has no relationship to any device and must not be rounded to one. Nobody designs
for "tablet"; they design for "two columns of this text stop being readable below
here".

So the four are a vocabulary for the shell, not a grid every component snaps to. That
is the distinction the old wording missed by claiming there was no scale at all.

### A custom property cannot be used in a query

```css
@media (min-width: var(--dds-breakpoint-tablet))   /* does NOT work */
```

A query condition is evaluated before custom properties are resolved, so the value is
never substituted and the query simply never matches — silently, with no error. Every
query writes its own literal, which means the named set is documentation rather than
something the browser enforces.

Two things keep it honest:

- `scripts/build-foundations.mjs` extracts every width actually used into
  `dds/foundations.json` under `breakpoints.inUse`, so the documented set and the used
  set can be compared rather than trusted.
- `scripts/sync-breakpoints.mjs` generates the table on
  `reference/foundations.html` from the stylesheets, including the reason from the
  comment above each query. Hand-writing that table produced three wrong rows on the
  first attempt.

### Every threshold states its reason

Next to the query, in a comment — not in a central document that drifts from it. A
threshold with no stated reason is a number nobody can safely change, and seven of the
nine in use had none until the generator asked for them.

---

## Mobile-first, and fully functional

- **No feature is removed on a small screen.** With more width comes more density
  and parallelism, not more capability. A user on a phone gets everything, arranged
  differently.
- **Layouts stack before they crush.** One column is better than two cramped ones.
- **No horizontal page scroll** at 320px (WCAG 1.4.10). The one legitimate
  exception is a genuinely wide component — a data table — inside a focusable,
  named scroll region.
- **Long words must not force it.** `overflow-wrap: break-word` on text elements
  (`base.css`) handles URLs, identifiers and compound nouns.

---

## Reading order must survive reordering

`order`, `row-reverse` and `grid-area` reorder visually without reordering the DOM.
The DOM order is the reading order and the tab order (WCAG 1.3.2, 2.4.3).

**Therefore: bind any reorder inside the query it is meant for.**

```css
/* Correct — only swaps where two columns exist. */
@container dds-textmedia (inline-size > 40rem) {
  .dds-textmedia-media-end .dds-textmedia-media { order: 2; }
}
```

Applied unconditionally, that `order` also reverses the stacked order at narrow
widths, putting a caption before what it captions. It is a 1.3.2 failure that is
invisible on a desktop.

Rule of thumb: if a component stacks into one column below a threshold, `order`
must be neutral there — by leaving the rule out, not by resetting it.

---

## Below the floor, everything stays narrow — and that is the plan

Container queries are Baseline 2023: Chrome 105, Safari 16, Firefox 110. There is
no fallback and there will not be one.

Below that floor, `@container` matches nothing, so every component stays
permanently in its narrow form. That form is the mobile-first one: every control
reachable, every label readable, nothing clipped and nothing hidden. What is lost
is the wide layout, not the functionality.

It is written down because the outcome is indistinguishable from a bug. Somebody
meeting a desktop that looks like it was designed for a phone cannot tell the
documented degradation from a stylesheet that failed to load, and will go looking
for the second. See DECISIONS.md 029 for why no polyfill, and for what to do if a
consumer genuinely cannot move off an older engine.

---

## `content-visibility: auto` changes what "the page" is

`.dds-defer-render` sets `content-visibility: auto` with a `contain-intrinsic-size`
estimate. It skips the rendering work for sections that are off-screen, which on a
long page is a real saving — and it is opt-in, because it has a consequence that is
not obvious from the declaration and is not local to the element it is on.

**An off-screen section is laid out at its estimated height and takes its real
height only as it approaches the viewport.** So the page grows while you scroll
towards its end — and it keeps growing *after* the last scroll event has been
handled, because the growth is a layout change, not a scroll.

Everything below follows from that one sentence.

### Anything positional needs a `ResizeObserver`, not only a scroll listener

A component that answers "where am I?" by listening to `scroll` is answering it
against a page that is still changing size. The table of contents got this wrong
three times in three different mechanisms — an `IntersectionObserver` band, a
sentinel at the end of the document, then a geometric reading line — each of which
worked on some pages and failed on others while the component was identical.

`scrollTo(scrollHeight)` does not reliably reach the bottom either, for the same
reason: the value read is already stale. That affects tests and "jump to end"
controls alike.

### A click can land on nothing

This is the expensive one, and it is not about scrolling arithmetic at all.

The reference pages had `content-visibility: auto` on every section. On WebKit,
clicking a control far down a page did nothing: the sections above it took their
real heights while the pointer was being aimed, and the button was no longer where
it had been measured to be. Three unrelated demos failed identically — a wizard's
Continue button, a theme toggle, a password field — and the components were all
correct. Chromium's size estimates differ, so it happened on one engine only.

### A custom property can read as an empty string

`getComputedStyle(el).getPropertyValue('--dds-color-…')` returns `''` for an
element inside a skipped section. An empty string is a valid value for almost
every property, so this fails silently: the swatch paints nothing and reads as
"this token is transparent" rather than "this token was not readable".

### The diagnostic

**Behaviour that differs per page while the code is identical points at the page
content, not at the component logic.** That is the tell. A component that works on
`components.html` and fails on `foundations.html`, with nothing about the component
between them, is being affected by how tall the page is and where the thing sits in
it.

### Before reaching for it

Measure first. The reference pages carried it on every section and the saving was
never measured; it cost three WebKit-only defects and was removed. It is right for
a genuinely long page with heavy sections, and it is overhead everywhere else. It
is also wrong where in-page search must find text in a section nobody has scrolled
to yet.

---

## Documenting the behaviour

**A component with width-dependent behaviour gets a sentence describing it**, in a
fixed place: a `.ref-note` immediately after the specimen on the reference page.

A fixed location, rather than "somewhere in the prose". Scattered between body
text, a do/don't block and nowhere at all, such a note is impossible to audit — you
cannot see which components are missing one. A consistent slot is what makes its
absence visible.

---

## The width switcher

Any component with width-dependent behaviour gets `data-ref-bp` around its
specimen, which generates a width switcher (375 / 480 / 768 / 1024 / 1280 / full).

This is the most useful documentation tool in the system, for one reason: **without
it, nobody looks at the narrow state.** Not the person building the component, not
the person reviewing it, and not a tool. The narrow layout is where responsive bugs
live, and the switcher makes checking it a two-second act rather than a deliberate
exercise.

It only works on components that respond to their container. A component using
`@media` reads the real window and ignores the stage entirely — the buttons
visibly do nothing. That is the practical enforcement of the rule at the top of
this file.

**Both halves are checked.** `scripts/check-reference.mjs` reads every width
query out of the stylesheets, maps the classes inside it back to their index
entry, and fails when that entry's section has no `.ref-note` — or, for a
container query, no `data-ref-bp` around its specimen. The two cases differ on
purpose: a viewport media query needs the note and cannot use the switcher, and
saying so is what the note is for. `.dds-dialog-sheet` is the one component in
that position.

It is read from the CSS rather than from a list, so a component that gains a
query is caught the same day rather than when somebody remembers to look.

---

## What every component says about itself

Each entry in [`index.json`](index.json) carries a `responsive` field, which
answers one question: **what does this do at 320px?** One of four kinds, and the
kind is the part that is checked:

| Kind | Means | Example |
| --- | --- | --- |
| `container` | responds to the space it was given, at a stated threshold | `siteheader — dds-siteheader (inline-size >= 48rem)` |
| `viewport` | genuinely depends on the device | `dialog — (max-width: 30rem)` |
| `self` | adapts with no threshold at all | `breadcrumb — wraps when it runs out of room` |
| `none` | nothing about it changes with width, and that is correct | `badge` |

Today that is 9 · 1 · 28 · 38 across seventy-six entries, which is the honest
shape of the system: most components have nothing to change, a quarter adapt by
themselves, and ten have a threshold.

`scripts/check-agent-index.mjs` verifies the falsifiable half. A claim of
`container` or `viewport` must be backed by a query the CSS actually contains,
and a claim of `self` or `none` must not be — so a component that gains a query
while its entry still says "nothing changes" is caught the same day. Whether the
prose after the dash is a *good* description is not something a script can judge,
and pretending otherwise would make the check a spellchecker with opinions.

The point of the field is not the field. It is that "does this component adapt,
and how?" used to be answerable only by reading the stylesheets — which is why
the four named breakpoints came to read as decoration.

---

## What to verify

1. **320px wide** — no horizontal page scroll, nothing clipped, nothing
   overlapping.
2. **400% zoom** (WCAG 1.4.10) — reflows to one column, everything reachable.
3. **Every stop on the width switcher** for a component with a frame.
4. **Inside a narrow container**, not only on a full page.
5. **Reading order** still matches visual order at every width.
6. **Text spacing overrides** do not break the layout (WCAG 1.4.12).
7. **Both orientations** (WCAG 1.3.4).
8. **Touch targets** still ≥ 24px at the narrowest width (WCAG 2.5.8).
9. **On a second engine**, if anything on the page uses `content-visibility` —
   size estimates differ per engine, and so does everything that depends on them.

Points 1 and 8 are measured rather than judged:

```bash
npx playwright test tests/viewport.spec.mjs
```

It loads every reference page at 320, 390, 412 and 834, fails when the document
is wider than the viewport, and **names the outermost elements that are over the
edge** — because "the page is 812px too wide" is a true statement nobody can act
on, and the element responsible is usually nowhere near the section that looks
wrong. It asserts the 24px minimum target size at 320 as well.

Anything inside a scroll or clip container is exempt, so a table scrolling in its
own region is the documented exception rather than a finding.

The rest still needs eyes:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
# http://localhost:8000/reference/navigation.html
```
