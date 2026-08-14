# Brand

The mark, the logo and the icon: where they come from, the one colour rule, and
the few things that will break if they are used carelessly.

---

## The three files

All three live in [`reference/assets/brand/`](../reference/assets/brand/).

| File | What it is | viewBox |
| --- | --- | --- |
| `dessau-mark.svg` | the D on its own | `0 0 92.323 100` |
| `dessau-logo.svg` | the mark as the initial, with "essau" in Inter Black | `0 0 509.42 101.34` |
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
| ink width | 92.323 | 0.923 |
| stem | 28.68 | 0.287 |
| seam between stem and bowl | 6.08 | 0.061 |
| bar, top and bottom of the bowl | 28.97 | 0.290 |
| notch | 90.9 × 42.6, open to the left | — |

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

900. The remaining 0.019 leaves the mark reading a shade heavier than the word,
which is the right direction for a logo — the initial leads.

Anything lighter puts a display-weight mark next to a text-weight word, which
does not read as a decision.

**Spacing.** The wordmark starts at 100.021: the mark's ink width (92.323), plus
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
.brand-mark {
  display: inline-block;
  block-size: 1.15em;
  aspect-ratio: 92.323 / 100;

  background-color: currentColor;
  mask-image: url("brand/dessau-mark.svg");
  mask-size: contain;
  mask-repeat: no-repeat;
}
```

or inline the SVG into the markup, where `fill="currentColor"` works normally.

The reference header uses the mask, wrapped in `@supports (mask-image: …)` so a
browser without mask support gets no box rather than a solid rectangle of
`currentColor` where the mark should be.

### The one exception

`dessau-icon.svg` carries two literal values, because a favicon has no text
beside it and no document to inherit from:

```
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
