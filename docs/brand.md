# Brand

The mark, the logo and the icon: where they come from, the one colour rule, and
the few things that will break if they are used carelessly.

---

## The three files

All three live in [`reference/assets/brand/`](../reference/assets/brand/).

| File | What it is | viewBox |
| --- | --- | --- |
| `dessau-mark.svg` | the D on its own | `0 0 91.8 100` |
| `dessau-logo.svg` | the mark as the initial, with "essau" in Inter Black | `0 0 508.89 101.34` |
| `dessau-icon.svg` | the mark on a square canvas, for the favicon | `0 0 128 128` |

They sit under `reference/`, not under `dds/`, and that placement is the
argument: **the brand is not part of the design system.** A product that adopts
DDS takes the components, the tokens and the patterns, and brings its own name.
A Dessau logo inside `dds/` would be shipped into every consuming product, one
`<use>` away from being drawn by accident.

---

## Where the mark comes from

The D was **drawn**, not derived from a typeface: a detached bar, a bowl, and an
open notch where a letter would have a closed counter. That stencil break is the
mark's whole character, and it is why it reads as a logo rather than as a
capital D someone set in a font.

The file here is that drawing, unchanged in shape. Two mechanical things were
done to it:

1. The design tool's transform (`matrix(0.1, 0, 0, -0.1, -154, 623)` — a y-flip)
   was multiplied into the coordinates, so nothing has to be resolved at render
   time.
2. The result was scaled so the letter is exactly 100 units tall.

Every number in the file is therefore a percentage of the cap height, and the
proportions can be read straight off the path:

| | units | of the cap |
| --- | --- | --- |
| ink width | 91.8 | 0.918 |
| stem | 28.68 | 0.287 |
| seam between stem and bowl | 6.08 | 0.061 |
| bar, top and bottom of the bowl | 28.97 | 0.290 |
| notch | 90.9 × 42.6, open to the left | — |

The ink width is measured from the **flattened curves**. A box taken from the
path's points instead gives 92.323, because the bowl's Bézier handles reach 0.523
past the curve they steer — half a percent of empty space that would otherwise be
welded into every use of the file, shrinking the mark inside any `mask-size:
contain` box and pushing the wordmark 0.523 too far right. The other three edges
need no such care: they are the straight bars and the flat side of the stem,
where the points sit on the curve.

Two artefacts of the original drawing are **preserved rather than tidied**: the
stem is 99.942 tall against the bowl's 100, and the outer corners carry a curve
of roughly 0.2 units. Both are well under a pixel at any size anyone will use,
and silently "correcting" someone's drawing is how a mark stops being theirs.

---

## Why the wordmark is Inter Black

The mark's stroke is 0.29 of its cap height. To find what can stand beside that,
Inter's weight axis was instanced and the D's stem measured at each stop:

| wght | stroke / cap | | wght | stroke / cap |
| --- | --- | --- | --- | --- |
| 400 | 0.128 | | 700 | 0.205 |
| 500 | 0.153 | | 800 | 0.237 |
| 600 | 0.179 | | 900 | **0.271** |

So the wordmark is set at 900. The remaining 0.016 leaves the mark reading a
shade heavier than the word, which is the right direction for a logo — the
initial leads.

Anything lighter puts a display-weight mark next to a text-weight word, which
does not read as a decision.

Measured with a horizontal cut at half the cap height, taking the first run of
ink — not by picking a contour out of the outline. Inter builds its D as a
separate stem rectangle, so counting contours happens to work there and silently
returns the *counter* for a font that draws the D as one outer shape plus one
hole. That mistake reads as the stem getting thinner as the weight rises.

### Why not Space Grotesk, the site's display face

The obvious objection is that the reference sets its headings in Space Grotesk,
so the logo "should" be in the family. It cannot be, and the axis says so:

| | stroke / cap |
| --- | --- |
| the mark | 0.286 |
| Space Grotesk 700, its heaviest | 0.189 |
| Inter 900 | 0.270 |

Space Grotesk's weight axis ends at 700, a third lighter than the mark. Its
x-height is also 0.694 of the cap against Inter's 0.75, so the lowercase falls
smaller as well and widens the gap. Set that way, the mark does not lead the
word — it looks bolted onto it, and at the 14 px of the header the word goes
thin while the mark stays blocky.

A logo is not a heading. Two faces doing two jobs is normal; a lockup whose two
halves disagree about weight is not. The only honest way to put the display face
in the logo would be to redraw the mark lighter, which is a different mark.

**Spacing.** The wordmark starts at 99.498: the mark's ink width (91.8), plus
Inter Black's own right side bearing after a D (4.698), plus 3 units of optical
correction, because this D is wider and heavier than the one Inter fits for. No
tracking inside the word — that letterfit is the typeface's.

**Outlines, not live text.** An SVG used as an image gets no fonts from the
document, so a `<text>` element would render in Inter only on machines that
already have Inter. The outlines were produced by instancing the variable font
directly from `reference/assets/fonts/Inter-Variable.ttf` — `gvar` deltas, IUP
for the points a tuple does not list, and the phantom points for the advance
widths — and the instancer was checked by running it at the default weight and
diffing the result against the static outline.

---

## The colour rule

**The brand is always the colour of the text beside it.** No brand colour, no
field, no second palette. `dessau-mark.svg` and `dessau-logo.svg` are pure
`currentColor`.

### The trap

An SVG loaded through `<img src="…">` is an independent document. It has nothing
to inherit from, so `currentColor` resolves to the initial colour — black. The
mark in an `<img>` is therefore black in both themes: invisible in dark mode, and
perfectly fine-looking in the light mode where it was checked.

So the mark is **never** an `<img>`. Two ways to place it:

```css
/* A mask. The file supplies the shape, the page supplies the colour. */
.brand-logo {
  display: inline-block;
  block-size: 0.8em;
  aspect-ratio: 508.89 / 101.34;   /* or 91.8 / 100 for the mark */

  background-color: currentColor;
  mask-image: url("brand/dessau-logo.svg");
  mask-size: contain;
  mask-repeat: no-repeat;
}
```

or inline the SVG into the markup, where `fill="currentColor"` works normally.

### In the reference header

The header carries the **whole logo**, not the mark beside the word set in the
display face — the same word twice, in two different drawings, is a lockup
nobody chose.

```html
<a class="ref-brand" href="index.html">
  <span class="ref-brand-logo" aria-hidden="true"></span>
  <span class="ref-brand-name">Dessau</span>
  <span class="ref-brand-sub">Foundations for digital products</span>
</a>
```

Both the mask and the rule that hides `.ref-brand-name` live inside the same
`@supports (mask-image: …)`. That is deliberate and it is the whole fallback:

- **with** mask support — the logo is drawn, the word is hidden the way
  `dds-sr-only` hides things, and the accessible name is unchanged;
- **without** it — no logo is drawn, and the word is simply visible, which is
  what the header looked like before there was a logo.

Hiding the word with `class="dds-sr-only"` in the markup instead would hide it
unconditionally, and a browser without mask support would render a header with
no brand in it at all.

Sizing is in `em` so the logo tracks the sub-line beside it as the fluid type
scale changes. At `0.8em` of box height the wordmark's cap lands just above
Space Grotesk's `0.70em` cap — the right direction, since Inter Black reads
heavier than the bold it replaces and needs less size to carry the same weight.
No `align-self` is needed: a flex item with no line boxes takes its baseline
from its bottom edge, which is where this logo's baseline already is.

### The one exception

`dessau-icon.svg` carries two literal values, because a favicon has no text
beside it and no document to inherit from:

```text
light scheme   #201e1a   stone-950 ink
dark scheme    #f4f2ee   stone-100 paper
```

switched with `prefers-color-scheme` inside the file, on a **scoped class** — not
on `:root`, which would let the file restyle any page it was inlined into. If a
browser ignores the media query the light value applies, which is the right way
round: most tab strips are light, so the failure is invisible rather than a black
mark on black.

The icon also opens the seam from 6.08 to 8.08 units. At 16 px the original seam
is 0.76 of a pixel — it closes, and the two pieces read as one shape. This is an
optical size in the sense the `opsz` axis of a typeface means it, and it is the
only difference from the mark. It was chosen by rendering 16, 32 and 120 px:
two units more is visible at 32 and hinted at 16, five starts to read as two
separate shapes.

---

## Using them

**Clear space.** One stem width — 0.287 of the cap — on every side. The `viewBox`
of each file is the ink box exactly, with no padding built in, so this is the
layout's job.

**Minimum sizes.** The logo needs about 16 px of cap height before "essau" fills
in; below that use the mark or the icon. The icon holds at 16 px, which is why
the letter fills 78% of its canvas rather than a more composed 60%.

**Accessible naming.** Each file has `role="img"` and a `<title>`, which is what
an inlined SVG needs. A mask has no semantics at all: if the mark is the only
thing naming the brand, put the name on the element (`role="img"` plus
`aria-label`). Where visible text already says "Dessau" — as in the reference
header — the mark is decorative and takes `aria-hidden="true"`.

**Don't.** Give it a brand colour or a field. Add a gradient or a shadow. Close
the seam or the notch. Stretch it to a different aspect ratio. Set the wordmark
in anything but Inter Black, or re-space it by eye.

---

## What is deliberately missing

**A PNG `apple-touch-icon`.** iOS home-screen icons still want a raster file, and
Dessau has no rasterisation toolchain — adding one means a build step and a
dependency, both of which this project spends real effort not having. Browsers
get the SVG through `<link rel="icon">`. A product that needs the raster should
generate it from `dessau-icon.svg` in its own pipeline.

**A committed generator for the wordmark outlines.** The variable-font instancer
that produced them was written for the job and not kept. The derivation is
recorded in `dessau-logo.svg` precisely enough to redo — weight, cap height, pen
position, and how the advance widths were obtained — but redoing it means writing
the tool again. That is the honest cost of a one-off artefact, and it is only
worth paying back if the wordmark starts changing.

**A `favicon.ico` at the repository root.** Every page links its icon explicitly,
so the root fallback is never reached.
