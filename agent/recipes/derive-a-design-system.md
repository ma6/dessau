# Recipe: derive a design system from Dessau

Before a product is wired up, it needs to know what it looks like. This is the
hour that decides that.

`new-product.md` is the next step and it is about plumbing — submodule, shell,
sprite, locale. This one is about form, and it comes first for a reason: pull
Dessau in without doing it and you have not chosen neutrality, you have chosen
Dessau's answers. They are argued for and they are defensible, but they are
answers to questions somebody else was asking. A derived system needs to know
they were questions.

Six of them. Colour, type, roundness, density, depth, motion. Each section states
the question, the default if you decline to answer it, and where the answer goes.

**Answer them in order and stop whenever you like.** Every section has a working
default, so a half-finished pass leaves a product that runs — just one that has
made fewer decisions of its own.

---

## How an override works, once

Two token layers. Components read the **semantic** layer only
(`--dds-color-text-error`, what it is *for*), which reads the **primitive** layer
(`--dds-red-600`, what it *is*). See `agent/architecture.md`.

That gives you two legal moves, and they are not interchangeable:

- **Repoint a semantic token** when you want one role to change. "Links are
  green" is a semantic change.
- **Replace a primitive ramp** when you want the whole system's character to
  change. "We are not an indigo company" is a primitive change, and every
  semantic role pointing at that ramp follows automatically.

Prefer the primitive move for identity and the semantic move for exceptions. A
product that repoints forty semantic tokens has usually replaced a ramp the long
way round.

Your overrides live in the product's own stylesheet, loaded **last and
unlayered**, exactly as `new-product.md` sets up:

```html
<link rel="stylesheet" href="/libs/dessau/dds/dds.css">
<link rel="stylesheet" href="/assets/product.css">
```

Unlayered author styles beat every cascade layer, whatever the specificity. No
`!important`, no specificity fight.

### The trap that costs an afternoon

That same rule is why this is wrong:

```css
/* WRONG — silently flattens dark mode */
:root {
  --dds-color-action-primary: #006b3c;
}
```

DDS declares its light values on `:root, [data-theme="light"]` and its dark
values on `[data-theme="dark"]`, both inside a layer. Your unlayered `:root`
beats **both** — including the dark one — so the product now shows its light
green on a near-black surface, at whatever contrast that happens to be, in a
theme nobody re-checked.

Override in the same shape DDS declares them:

```css
/* RIGHT — one decision per theme, like the file you are overriding */
:root,
[data-theme="light"] {
  --dds-color-action-primary: #006b3c;
}

[data-theme="dark"] {
  --dds-color-action-primary: #6ec9a0;
}
```

Only colour and elevation have dark variants. Radius, spacing, type and motion
are not theme-dependent, so a single unlayered `:root` is right for those.

---

## 1. Colour

**The questions.** What is your action colour? Is your neutral warm, cool or
true? Do you need a decorative accent that is neither action nor status? Does
dark mode ship?

**The default.** Indigo action, a hue-free grey neutral, a muted terracotta
accent, dark mode on. Four status hues you almost certainly should not touch.

**Where it goes.** Primitive ramps, if you are changing the identity:

| Ramp | Steps | What depends on it |
| --- | --- | --- |
| `--dds-indigo-*` | 50…950 | Every action, link, focus ring and selected state |
| `--dds-stone-*` | 0, 50…950 (+850) | Every surface, text colour and border |
| `--dds-clay-*` | 50…900 | The decorative accent, and nothing else |
| `--dds-green/amber/red/cyan-*` | 50…900 | Success, warning, error, information |

A full ramp is eleven values and it has to stay monotonic — each step
perceptibly lighter than the next, with no two steps that read the same. If you
are replacing one, replace all of it; a ramp with three new values and eight
inherited ones is not a ramp.

**Leave the status hues alone** unless you have a reason better than taste. They
are four unmistakably different hues on purpose, so status survives being read by
somebody who sees hue differently — and the amber is olive-leaning specifically
so it cannot be confused with the accent or the error red.

**The trap.** Judge every colour at **both ends of the ramp**, in both themes.
Dessau got this wrong in its own palette and shipped it: the neutral was warm on
the argument that warmth reads as paper, which is true at 90% lightness and false
at 20%, where there is no white point in view to judge the tint against and it
simply reads as brown. Nobody noticed until somebody looked at dark mode and said
it looked dirty. See DECISIONS.md 031.

The corollary: a dark theme is not a light theme with the lightness inverted. Any
value you choose by looking at one is a value you have not chosen for the other.

---

## 2. Typography

**The questions.** A display face and a text face, or the platform's own? And if
a named face, do you self-host it?

**The default.** Space Grotesk for display, Inter for text, JetBrains Mono for
code — each as the first entry in a stack that falls through to `system-ui`.
**Dessau ships no font binaries**, so the default costs nothing and downloads
nothing: readers who have the face see it, readers who do not get their
platform's UI font, which is a good typeface everywhere current.

**Where it goes.** Three semantic tokens, no primitive layer beneath them:

```css
:root {
  --dds-font-display: "Your Display", system-ui, -apple-system, "Segoe UI", sans-serif;
  --dds-font-body: "Your Text", system-ui, -apple-system, "Segoe UI", sans-serif;
  --dds-font-mono: "Your Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
```

Keep `system-ui` before the named fallbacks, and keep a generic family last.

`docs/typography.md` has the evaluation behind the defaults, the rules that come
with them, and the self-hosting setup including how to match a fallback's metrics
so the page does not reflow when the face arrives. Read it rather than
reinventing it; it is the longest-considered document in the repository.

**The trap.** Choosing a face is cheap and self-hosting it is not. A webfont is a
render-blocking dependency, a licence, a `@font-face` block, a preload, a metric
match and a decision about what happens for the first 100ms. If none of that is
being taken on, the system stack is not a compromise — it is the better answer.

---

## 3. Roundness

**The question.** Are you round or square?

It sounds like the smallest decision here and it is the most visible. It lands on
every button, field, card, badge, panel and menu on every screen, it takes one
minute to make, and by the time a product has forty components it is effectively
permanent. So make it now, deliberately, as one ramp — not per component, forty
times, by whoever built each one.

**The default.** 4 / 8 / 14px. Softened, not round.

**Where it goes.** Five primitive values, all unlayered, no theme variants:

```css
/* Square — Bauhaus, engineering, dense data. Nothing is softened. */
:root {
  --dds-radius-sm: 0;
  --dds-radius-md: 0;
  --dds-radius-lg: 0;
  --dds-radius-pill: 0;
}

/* Dessau's default — softened. */
:root {
  --dds-radius-sm: 0.25rem;   /*  4px — chips, small controls, inline marks */
  --dds-radius-md: 0.5rem;    /*  8px — buttons, fields, menus */
  --dds-radius-lg: 0.875rem;  /* 14px — cards, dialogs, panels */
  --dds-radius-pill: 999rem;  /*        badges, tags, toggles */
}

/* Round — consumer, friendly, marketing-adjacent. */
:root {
  --dds-radius-sm: 0.5rem;    /*  8px */
  --dds-radius-md: 1rem;      /* 16px */
  --dds-radius-lg: 1.5rem;    /* 24px */
  --dds-radius-pill: 999rem;
}
```

`--dds-radius-circle: 50%` is geometry, not taste — avatars and the progress ring
are circles in every one of these. Leave it.

**On `--dds-radius-pill`.** It is the loudest value in the set and it is doing
more than rounding. A pill reads as a *token* — something small, complete and
detachable, like a tag you could pick up. That is right for a badge and wrong for
a button, which is why Dessau uses it for the first and not the second. Setting
`pill` to `0` in a square system is a real decision: your badges become
rectangles, and the system gets quieter and more technical in a way people notice
without being able to say why.

**The trap.** Radius interacts with border width and with nesting. A 2px border
inside a 4px radius reads as a smudge at the corner; a card at 14px containing a
field at 8px looks intentional, and the same card containing a field at 14px
looks like a mistake. Keep the inner radius smaller than the outer one, and check
one nested case before committing to the ramp.

---

## 4. Density

**The question.** Is this a tool people live in all day, or a page they visit?

**The default.** A 4px base with a geometric-ish ramp: 2, 4, 8, 12, 16, 20, 24,
32, 48, 72. Comfortable rather than compact.

**Where it goes.** `--dds-space-*`. Change the **middle** of the ramp and leave
both ends:

```css
/* Compact — an internal tool, a dense table, a data application. */
:root {
  --dds-space-sm: 0.5rem;    /*  8px, from 12 */
  --dds-space-md: 0.75rem;   /* 12px, from 16 */
  --dds-space-ml: 1rem;      /* 16px, from 20 */
  --dds-space-lg: 1.25rem;   /* 20px, from 24 */
}
```

`3xs` and `2xs` are hairlines and optical nudges — 2px is 2px whatever the
density. `2xl` and `3xl` separate whole regions of a page, and squeezing them is
what makes a compact interface feel cramped rather than efficient. The middle is
where density actually lives.

**The trap.** Spacing is not the only thing that sets density, and it is the
least effective one on its own. Line height and control height matter more:
Dessau's controls carry `min-block-size: 2.75rem` for a 44px pointer target
(WCAG 2.5.8), and that floor is not negotiable on touch. A compact ramp with
44px controls is a legitimate combination; a 32px control is not, whatever it
does for the screenshot.

---

## 5. Depth — elevation or line

**The question.** When one surface sits above another, what says so: a shadow, or
an edge?

**The default.** Both, shadow-led. Two-part shadows at three levels, plus a
border palette underneath.

**Where it goes.** Repoint the semantic elevation tokens, which is one of the few
places where the semantic move is the right one — the shadows are primitives, but
*whether you use them* is intent:

```css
/* Line-led: no shadows anywhere, edges carry the whole hierarchy. */
:root,
[data-theme="light"] {
  --dds-elevation-sm: none;
  --dds-elevation-md: none;
  --dds-elevation-lg: none;
}

[data-theme="dark"] {
  --dds-elevation-sm: none;
  --dds-elevation-md: none;
  --dds-elevation-lg: none;
}
```

Then make sure `--dds-color-border-default` and `--dds-color-border-strong` are
carrying their weight, because they have just become the only thing separating a
dialog from the page behind it.

**Why this is worth a minute even if you keep the default.** A shadow is a
light-mode idea. On a near-black surface, black at 40% opacity is close to
nothing — Dessau found this the hard way in its segmented control, where the
"raised" selected option measured 1.1:1 against its track and the shadow that was
supposed to sell the effect was invisible in dark mode. A shadow-led system is
therefore two systems: shadow-led in light, and whatever is left in dark. A
line-led system is one system, and for a square, Bauhaus-leaning identity it is
also more honest.

**The trap.** Removing shadows without strengthening borders does not produce a
flat design, it produces a design where overlays have no edges. Check a dialog
over a page, and a menu over a card, before deciding it worked.

---

## 6. Motion

**The question.** How much, and how fast?

**The default.** Four durations, 80 / 140 / 220 / 320ms, with three easings.
Short, and used only to report a state change or show where something came from.

**Where it goes.**

```css
/* Faster and flatter — a tool, where motion is latency. */
:root {
  --dds-duration-instant: 60ms;
  --dds-duration-fast: 100ms;
  --dds-duration-base: 150ms;
  --dds-duration-slow: 200ms;
}
```

**What you do not have to do.** `prefers-reduced-motion` is already handled
globally in `base.css`, for everything, including anything you add. You cannot
opt out of it by accident, and you should not opt out of it on purpose.

**The trap.** Do not set the durations to `0`. Dessau's own reduced-motion block
collapses them to `0.01ms` rather than to zero, and the comment there says why:
JavaScript that waits for `transitionend` or `animationend` still fires, and
nothing is left stuck mid-state. A product that zeroes the tokens to "turn
animation off" reintroduces exactly the bug that block was written to avoid.
Short is the way to have no motion. Zero is a different thing.

---

## 7. Write the answers down

The answers go in the **product's** `DECISIONS.md`, not in Dessau's. One entry
per section you actually decided; skip the ones you took the default for, and say
that you took it.

```markdown
## 00N — <the decision, as a sentence>

**Decision.** What the tokens are now.

**Why.** The reason a future reader should not revert this. Not "it looks
better" — the constraint, the audience or the brand rule that made it the answer.

**What it cost.** What got worse. Every one of these trades something.

**Reversal condition.** What would have to be true for this to be wrong.
```

The section that decays is **Why**. Six months on, "our radius is 0" is obvious
from the stylesheet; "because the whole product is dense tabular data and rounded
corners at 13px row height turn into mush" is not recoverable from anything.

---

## 8. What a re-themed system still owes

Changing tokens does not change the obligations that come with them.

- **Contrast.** `node scripts/check-contrast.mjs` measures **Dessau's** values —
  its paths are hardcoded to `dds/css/semantic.css` and `dds/css/primitives.css`,
  so it will happily pass while your overrides fail. If you changed any colour,
  either copy the script and point those two constants at your own file, or
  measure by hand every pair you touched. Do not skip this because a green tick
  appeared: it was measuring somebody else's palette.
- **Both themes, by eye.** `python3 -m http.server 8000`, then look at the
  product in light and dark. Dark is where colour mistakes hide.
- **Greyscale.** Any state you introduced — selected, current, checked — must
  still be obvious with the hue gone. See `agent/accessibility.md`.
- **Targets.** 44px pointer targets survive a compact density, or the density is
  wrong.
- Then `agent/definition-of-done.md`, as for any other work.

---

## How far this recipe has actually been executed

Stated for the same reason `new-product.md` states it: "these instructions have
never been run" was true of that recipe for long enough to be worth never letting
be true silently again (#5).

**Not yet executed.** This document was written from the implementation — every
token name, path and default in it was read out of the source rather than
recalled, and the cascade trap in *How an override works* was derived from how
`semantic.css` declares its themes. But nobody has yet sat down with an empty
product and worked through all six sections.

Until somebody has, treat the section order as a proposal and the traps as the
tested part. When somebody does, this section says what they found.
