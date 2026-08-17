# Recipe: derive a design system from Dessau

Before a product is wired up, it needs to know what it looks like. This is the
hour that decides that.

**Which recipe you want after this one depends on what you are building.** If the
answer is a product, it is `new-product.md` and the override model below is the
right instrument. If the answer is a **design system of your own** — one that ships
to a client and works without Dessau — it is
[`derive-a-standalone-system.md`](derive-a-standalone-system.md), and the override
model below is *not*: a derived system substitutes the foundation rather than
layering over it, because it cannot hand its consumers a dependency on Dessau. The
six decisions are the same either way; only where the answers go differs.

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

**If you are an agent walking this recipe for someone, and that someone is
reachable, ask.** Six real questions, one at a time, and wait for six real
answers before writing anything down. The default exists for the run where
nobody is present to ask — not as a shortcut past asking someone who is. "The
reasoning is recorded in DECISIONS.md" describes a decision that was made; it
does not make one, and a person who was never asked six questions did not make
six decisions no matter how the record reads afterward. This went wrong once
already (#123) — six defaults taken and written up as answered, for a person
who had not been asked any of them.

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
true? How many decorative accents do you need, and what do *you* call them? Does
dark mode ship?

**The default.** Indigo action, a hue-free grey neutral, five decorative accents
led by a muted terracotta, dark mode on. Four status hues you almost certainly
should not touch.

**Where it goes.** Primitive ramps, if you are changing the identity:

| Ramp | Steps | What depends on it |
| --- | --- | --- |
| `--dds-indigo-*` | 50…950 | Every action, link, focus ring and selected state |
| `--dds-stone-*` | 0, 50…950 (+850) | Every surface, text colour and border |
| `--dds-clay/magenta/violet-*` | 50…900 | Accent slots 1, 2 and 5 — decorative only |
| `--dds-green/amber/red/cyan-*` | 50…900 | Success, warning, error, information — **and** accent slots 4 and 3 |

A full ramp is eleven values and it has to stay monotonic — each step
perceptibly lighter than the next, with no two steps that read the same. If you
are replacing one, replace all of it; a ramp with three new values and eight
inherited ones is not a ramp.

**Leave the status hues alone** unless you have a reason better than taste. They
are four unmistakably different hues on purpose, so status survives being read by
somebody who sees hue differently — and the amber is olive-leaning specifically
so it cannot be confused with the accents or the error red. Note the last column
above: two of the five accents *share* their ramp with a status hue. Repointing
`--dds-green-*` because accent 4 should be teal also repaints every success
message you have.

### Strongly recommended: your brand is not your action or status colour

This one is advice rather than a rule — it is your system and your call — but it
is the advice given with the least hedging in this document, because the move it
warns against is the first one most people reach for. Making the action colour the
brand colour, and pulling status towards the brand palette so the interface looks
of a piece, is the obvious way to make a derived system feel owned. It is also the
one that costs the most and shows the bill latest.

**Action is a learned signal, not decoration.** The whole reason DDS has *one*
interactive colour is so that colour comes to mean "you can act on this". A brand
colour does not stay in interactive places: it is in the header, the illustration,
the empty state, the marketing banner someone drops in later. Bind the two and
either everything brand-coloured reads as actionable, or — much more likely —
nothing does, and the signal you spent the restraint on is gone.

**The two colours are chosen under different constraints.** A brand hue is judged
large, once, on a background somebody controlled. An action colour has to clear
3:1 as a graphical object and 4.5:1 as text, in both themes, at 16px, against
surfaces you do not get to choose. Plenty of brand colours simply cannot — a
bright yellow, a pale teal — and the usual ending is a value nudged far enough to
pass that it is no longer recognisably the brand. The coupling then delivered
neither thing.

**Brands change on somebody else's schedule.** Bound to action, a rebrand re-tunes
every affordance, focus ring and selected state in the product, and re-opens the
contrast work across the whole system. That puts an accessibility-critical
decision in the hands of people who do not own accessibility and will not be told
that is what they decided.

**Status is the worse half.** Red, amber, green and cyan are conventions a reader
brings with them; they are not yours to re-mean. Tint them towards a brand and
success means whatever the brand means this year — and if the brand is itself red,
an error stops being distinguishable from ordinary chrome. Status is also the one
place where being wrong is not a matter of taste.

**Where the brand does belong: the accent layer.** That is what it is for. DDS
treats a product's brand accent and a categorical chart colour as the same
mechanism at different scopes (DECISIONS 033) — `data-dds-accent` on `<html>` is
the brand, on a bar it is a category. The accent is decorative by rule, so a brand
sitting there can be any colour it likes, changes without touching a signal, and
never has to carry meaning it cannot support.

**If you are going to do it anyway**, and sometimes there is a real reason, the
test is honest and short. The brand hue has to meet the action colour's contrast
obligations *on its own merits*, in both themes, measured rather than eyeballed —
and you have to accept in writing that the next rebrand re-opens that measurement
across the system. Record both in the product's `DECISIONS.md`, including the
reversal condition, because this is the decision most likely to be inherited by
somebody who was not in the room.

### The five accents, and naming them yourself

The accent set is five numbered slots — `--dds-color-accent-1` … `-5`, each with
a `-subtle` tint, selected with `data-dds-accent="<n>"` on any element.

The numbers are deliberately meaningless, and this is the one place in the recipe
where the *product* is expected to add a name rather than change a value. What a
category is — a department, a region, a product line — is yours, not Dessau's. So
declare your vocabulary once, unlayered, and never write a bare number in a
template:

```css
[data-dds-accent="finance"] {
  --dds-color-accent:        var(--dds-color-accent-2);
  --dds-color-accent-subtle: var(--dds-color-accent-2-subtle);
}

[data-dds-accent="cyan"] {          /* naming one after its hue is fine here */
  --dds-color-accent:        var(--dds-color-accent-3);
  --dds-color-accent-subtle: var(--dds-color-accent-3-subtle);
}
```

The second one is not a contradiction of the paragraph below. In *your* stylesheet
the ramp and the name move together — one file, one commit, one owner — which is
exactly the promise Dessau could not make while the ramp was yours to replace. The
staleness comes back only if you re-tune your own ramp and leave the alias, and
then it is a line you can grep for in your own repository.

**If you only need one brand accent** and no categories at all, skip the slots
and repoint the two tokens in force, per theme:

```css
:root, [data-theme="light"] { --dds-color-accent: …; --dds-color-accent-subtle: …; }
[data-theme="dark"]         { --dds-color-accent: …; --dds-color-accent-subtle: …; }
```

Know what that costs: unlayered beats every layer regardless of specificity, so
those two declarations disable `data-dds-accent` entirely — including per-subtree
selection, including in the bar chart and the donut. Right answer if you have no
categorical colour; wrong one the day you add a chart.

**Why the slots are numbered** is worth thirty seconds, because it is the trap
this section used to walk you into. The slots were once named after their hues
(`clay`, `magenta`, …). A slot is a pointer with no value of its own, so that name
was a claim about a ramp this very recipe tells you to replace — and once you did,
`--dds-color-accent-clay` was grey and `<span data-dds-accent="clay">` was grey,
in your markup, where nothing checks it. See DECISIONS 033 and 034.

### If you need more than five

You are not held to five, and nothing in DDS is. Components read
`--dds-color-accent` and `--dds-color-accent-subtle` and have no idea where the
value came from — there is no registry, no count, no validation of the attribute.
DECISIONS 033 anticipated this: the honest answer to a sixth accent is a product
declaring it and owning the result, rather than a sixth entry in Dessau.

**Five is Dessau's number for two reasons, and you may share neither.**

The first is that Dessau's accents are dual-purpose. The same mechanism is a
brand accent on `<html>` and one category on a chart bar, and a brand accent has
to be *memorable* — which is where a set stops working long before it stops being
distinguishable. A categorical palette that only ever appears in charts carries no
such requirement, because the mapping lives in a legend or a label rather than in
the reader's head. Palettes of eight or twelve are ordinary for that job.

The second is that Dessau shares its hue circle with meaning. Indigo is "you can
act on this"; four hues are status; two of the five accents already sit on status
ramps. A product's own chart palette does not have to leave those angles alone,
and gets a wider circle to spend.

**Adding a slot.** Mirror the shape DDS uses, because both ways of getting it
wrong are silent:

```css
/* 1. The slot itself — a per-theme PAIR, not one value. */
:root, [data-theme="light"] {
  --dds-color-accent-6:        #0f766e;
  --dds-color-accent-6-subtle: #ccfbf1;
}
[data-theme="dark"] {
  --dds-color-accent-6:        #5eead4;
  --dds-color-accent-6-subtle: #0c2f2b;
}

/* 2. The selection rule — and it MUST come after your theme blocks. */
[data-dds-accent="logistics"] {
  --dds-color-accent:        var(--dds-color-accent-6);
  --dds-color-accent-subtle: var(--dds-color-accent-6-subtle);
}
```

*One value instead of a pair* keeps its light colour on a dark page, at whatever
contrast that lands on, and looks deliberate. *The selection rule above your theme
blocks* loses to them: both are unlayered and both weigh (0,1,0), so source order
decides, and `<html data-theme="dark" data-dds-accent="logistics">` silently takes
the theme value instead. That is the same ordering constraint `semantic.css`
documents for its own five — you are reproducing it, so put your selection rules
last in the file.

**The real limit is not the count, it is legend matching.** Past roughly eight
categories, matching a colour in a chart to an entry in a legend stops being
reliable however well separated the colours are. The answer to that is direct
labelling at the mark, not a smaller palette. Seven directly labelled categories
are fine; five that force a reader's eye back and forth to a legend are not.

**What you must measure, because nothing else will.** Copy
`scripts/check-accent-separation.mjs` into your own repository and repoint the two
`readFile` paths at your stylesheet. Contrast has the same hardcoded-path problem
and is covered above, but separation is the one that bites here: seven colours in
a circle with indigo and four status hues cut out of it is precisely the case
where two of them converge. The shipped five already sit at ΔE 0.109 at their
closest, against a floor of 0.07. That headroom is what you are spending.

**And keep the brand accent on one slot.** If you extend the set for charts,
decide separately which slot is the product's identity. A brand accent that is
also "category 4 of 7" is a brand accent nobody will recognise as one.

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

**Said plainly, because "take the default" is easy to answer without
registering it: almost nobody has Space Grotesk or Inter installed as a
system font.** "The default costs nothing" is true of what ships, not of
what renders — without self-hosting (below), the named face is a request
that almost always misses, and every reader sees `system-ui` regardless of
which of the two you chose. Taking the default typography decision and
skipping self-hosting are, in practice, close to the same decision wearing
two different names.

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
  --dds-radius-sm: 0.25rem;   /*  4px — leaves, and text fields */
  --dds-radius-md: 0.5rem;    /*  8px — buttons, and anything holding a leaf */
  --dds-radius-lg: 0.875rem;  /* 14px — outermost containers */
  --dds-radius-pill: 999rem;  /*        a detachable token, or a track */
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

### Which step does a given component get?

You do not answer this per component. You answer it once, with a rule, and the
assignment falls out — which is the whole reason the ramp is a decision and not
forty decisions.

**The rule is containment, not identity.** Ask what the element holds and what
holds it, never what it is called. The inner radius is always smaller than the
outer one.

The number comes from the concentric relation: **inner ≈ outer − padding**. A card
at 14px with 8px of padding wants a child at about 6px, so it takes the 4px step
if the child is a leaf and the 8px step if the child is itself a container. This
is why a card at 14px holding a field at 8px looks intentional and the same card
holding a field at 14px looks like a mistake — the corners are no longer
concentric and the eye reads the gap as uneven.

Applied to Dessau, that produces this. Every entry read out of the stylesheets:

| Step | What it means | Where it lands |
| --- | --- | --- |
| `lg` 14px | Outermost container, sits on the page | `card`, `dialog`, `cta`, `empty`, `upload-zone` |
| `md` 8px | Holds `sm` things — or stands alone as a pressable object | `menu`, `combobox-list`, `segmented`, `toast`, `notice`, `disclosure`, `table-wrap`, `choice-card`, **`button`** |
| `sm` 4px | A leaf, and every text field | `menu-item`, `combobox-option`, `segmented-option`, `upload-item`, `badge`, `kbd`, `tooltip`, `skeleton`, **`select`**, **`search`**, **`password`**, **`stepper`**, **`input-group`** |
| `pill` | Not a size. "A detachable token, or a track" | `chip`, `badge-count`, `switch-track`, `progress` |
| `circle` | Geometry, never taste | `avatar`, `spinner`, `step-marker`, `donut` |

The nesting pairs are where the rule becomes visible rather than asserted:
`menu` md → `menu-item` sm. `segmented` md → `segmented-option` sm.
`combobox-list` md → `combobox-option` sm. Each time, the container takes the step
above its contents.

**Button `md`, text field `sm` — the one pair containment does not settle.** Both
are controls, both are the same height, and they differ anyway. A field's corner
sits beside text on a baseline and a caret at the left edge, so a larger radius
pushes the optical inset away from the text inset and the field reads as lopsided.
Fields are also grouped — `.dds-search > button` carries `border-radius: 0`
precisely because the outer group's corner has already been spent. A button has
neither problem, and it is the most-seen corner in the interface.

So: **if you are going to judge your ramp by one element, judge it by the button.**
It is the signature value, and `md` is the step it lives on.

**On `--dds-radius-pill`.** It is the loudest value in the set and it is doing
more than rounding. A pill reads as a *token* — something small, complete and
detachable, like a tag you could pick up — or as a *track*, something a value
travels along. That is why it goes to `chip` and `badge-count` but not to
`.dds-badge`, which is `sm`: a badge is a label on the thing it describes, not a
thing in itself. Setting `pill` to `0` in a square system is a real decision: your
chips become rectangles, and the system gets quieter and more technical in a way
people notice without being able to say why.

**The trap.** Radius interacts with border width as well as with nesting. A 2px
border inside a 4px radius reads as a smudge at the corner. Check one nested case
and one bordered case before committing to the ramp — a field inside a card, and
whatever you give `--dds-border-thick` to.

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
- **Accent separation.** `node scripts/check-accent-separation.mjs` has the same
  hardcoded paths, and the same consequence: it will pass on Dessau's five while
  yours are three shades of the same blue. Two accents nobody can tell apart make
  a chart legend say nothing, and no contrast check will ever notice.
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
