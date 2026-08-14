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

### When a media query IS correct

For the **page shell**, and for anything that genuinely depends on the device
rather than on available space:

- The reference site's two-column page layout — it depends on the viewport.
- `.dds-dialog-sheet` anchoring to the bottom edge on a phone — "reachable by a
  thumb" is a viewport property.
- `@media (hover: hover)`, `(prefers-reduced-motion)`, `(forced-colors)`,
  `(prefers-color-scheme)`, `print`.

---

## No breakpoint proliferation

There is no global breakpoint scale, deliberately. A component states the width at
which **its own** layout stops working, in `rem`, next to the rule that changes.

Values in use, and why each:

| Width | Component | Because |
| --- | --- | --- |
| 26rem | Address locality row | Postcode + locality fit side by side |
| 34rem | Step progress | Four steps fit horizontally |
| 40rem | Text-media, footer groups | Two columns of readable text |
| 48rem | Site header | Four nav links plus brand and actions |
| 52rem | Filtering | A 16rem sidebar plus usable results |
| 30rem (max) | Dialog sheet | Phone-sized, viewport-dependent |
| 64rem | Reference page shell | Sidebar plus content, viewport-dependent |

Each is derived from **content**, not from a device. Nobody designs for "tablet";
they design for "two columns of this text stop being readable below here".

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

## Documenting the behaviour

**A component with width-dependent behaviour gets a sentence describing it**, in a
fixed place: a `.ref-note` immediately after the specimen on the reference page.

A fixed location, rather than "somewhere in the prose". The source this was learned
from had such a note on roughly a third of its components, scattered between body
text, do/don't blocks and nowhere at all. A consistent slot is what makes its
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

```bash
python3 -m http.server 8000 --bind 127.0.0.1
# http://localhost:8000/reference/navigation.html
```
