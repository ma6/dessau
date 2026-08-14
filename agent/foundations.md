# Foundations

The canonical values, and what each is for.

**Source of truth:** `dds/css/primitives.css` and `dds/css/semantic.css`.
**Machine-readable:** `dds/foundations.json` (generated; the CSS wins on conflict).
**Rendered:** `reference/foundations.html`.

---

## The two layers

**Primitives** are literal values with no meaning: `--dds-indigo-600: #4649b8`.

**Semantic values** give them a job: `--dds-color-action-primary: var(--dds-indigo-600)`.

**Components consume only the semantic layer.** This is enforced by
`node scripts/check-css.mjs`, and the reason is not tidiness: a primitive is
theme-independent, so a component using one renders correctly in light mode and is
wrong in dark mode — and only in dark mode, which is where nobody looks first.

The exception, and it is deliberate: space, radius, type, motion, z-index and
border widths have **no** semantic alias, because they are not theme-dependent.
Consuming `--dds-space-md` directly is correct. Only colour needs the
indirection.

---

## Colour

One neutral, one interactive hue, one decorative accent, four status hues. The
restraint is the point: when everything actionable shares one colour, that colour
starts to mean "you can act on this".

### Primitive ramps

| Family | Character | Role |
| --- | --- | --- |
| `stone` | Warm-tinted grey | Every neutral surface, text and border |
| `indigo` | Blue-violet | The single interactive hue |
| `clay` | Muted terracotta | Decorative accent only |
| `green` | Green | Success |
| `amber` | Olive-leaning amber | Warning |
| `red` | Red | Error, and destructive actions |
| `cyan` | Cyan | Information |

Steps run `50` (lightest) to `950` (darkest), plus `--dds-stone-0` (pure white)
and `--dds-stone-850`.

Why warm neutrals: long-form reading and dense forms sit on these surfaces all
day, and a slight warmth reads as paper rather than as screen. It also keeps grey
clearly distinct from the cool action colour, so a grey surface never looks like a
faded blue one.

Why indigo rather than a cyan-blue: it must not be confusable with the
informational status hue. "This is information" and "this is a button" have to
look different.

### Semantic colour

**Surfaces** — four planes.

| Value | Use |
| --- | --- |
| `--dds-color-surface-page` | The backdrop everything sits on |
| `--dds-color-surface-default` | The normal content plane |
| `--dds-color-surface-raised` | Floats above default (dialogs, popovers, listboxes) |
| `--dds-color-surface-sunken` | Recedes below default (wells, code, inset areas) |
| `--dds-color-surface-hover` / `-active` | Interaction washes for rows and options |
| `--dds-color-surface-selected` | Chosen state |
| `--dds-color-surface-disabled` | Unavailable |
| `--dds-color-surface-success` / `-warning` / `-error` / `-info` | Status tints — backgrounds only, never text |

In light mode `default` and `raised` are both white and separation comes from
shadow. In dark mode shadow barely reads, so they differ in value instead. Same
three-plane model, different mechanism per theme.

**Text**

| Value | Use |
| --- | --- |
| `--dds-color-text-default` | Body copy |
| `--dds-color-text-subtle` | Secondary text |
| `--dds-color-text-muted` | Hints, metadata, placeholders |
| `--dds-color-text-inverse` | On an inverted surface |
| `--dds-color-text-disabled` | Exempt from contrast minimums per WCAG 1.4.3, still kept legible |
| `--dds-color-text-link` / `-hover` / `-visited` | Links |
| `--dds-color-text-success` / `-warning` / `-error` / `-info` | Status text |

**Action** — three emphasis levels, carried by fill and border, not hue.

| Value | Use |
| --- | --- |
| `--dds-color-action-primary` (+ `-hover`, `-active`) | Filled. One per view |
| `--dds-color-action-on-primary` | The label on the fill |
| `--dds-color-action-secondary` (+ `-hover`, `-active`) | Outlined |
| `--dds-color-action-danger` (+ `-hover`, `-active`, `-on-danger`) | Destructive |
| `--dds-color-action-disabled` | Unavailable |

In dark mode the filled button **lightens** and its label flips to dark. Keeping
a white label on a dark-mode indigo fill is the classic dark-mode contrast
failure.

Destructive actions borrow the error hue. This is the one sanctioned overlap
between action and status, because "delete" genuinely is both.

**Borders** — four weights, and only the first may be faint.

| Value | Threshold |
| --- | --- |
| `--dds-color-border-subtle` | Below 3:1 on purpose — decorative dividers only |
| `--dds-color-border-default` | ≥ 3:1. A real component boundary (WCAG 1.4.11) |
| `--dds-color-border-strong` | ≥ 3:1. Emphasis, selected state |
| `--dds-color-border-field` | ≥ 3:1. Form control edges, stronger than `default` |
| `--dds-color-border-success` / `-warning` / `-error` / `-info` | Status edges |

**Focus** — one treatment across the whole system.

`--dds-color-focus-ring`, `--dds-focus-ring-width` (2px),
`--dds-focus-ring-offset` (2px). Applied via `outline` on `:focus-visible`, never
`box-shadow` — outline follows the element's shape, never affects layout, and is
preserved under forced colours where box-shadow is discarded.

**Solid statuses** — saturated fills for toasts and badges.

`--dds-color-success-solid` / `-warning-solid` / `-error-solid` / `-info-solid`
and their paired `--dds-color-on-*-solid`.

**Identical in both themes, deliberately.** A fill that shifts per theme needs its
paired text colour to shift too, and that pairing is exactly where contrast
regressions hide. One fixed pair per status is one thing to verify instead of two.

**Overlay** — a scrim over arbitrary page content.

`--dds-color-overlay`, `--dds-color-overlay-strong`,
`--dds-color-on-overlay`, `--dds-color-on-overlay-muted`, and
`--dds-color-overlay-control*` for controls sitting directly on one.

Also identical in both themes: an overlay darkens what is behind it rather than
tinting it, so one value is correct for both. These pairs are **not**
machine-checkable, because the effective background depends on the content
behind. The mitigation is the strong variant — at 85% black, near-white text
clears AA against anything underneath.

**Accent** — `--dds-color-accent`, `--dds-color-accent-subtle`.

Decorative only. Never a status, never an action, never body text on a light
surface. It exists so illustration, charts and editorial emphasis have somewhere
to go that is not the action colour.

**Selection** — `--dds-color-selection-bg` / `-text`, fixed across themes.

### Verification

```bash
node scripts/check-contrast.mjs            # 148 pairs, both themes
node scripts/check-contrast.mjs --verbose  # print the passing ones too
```

Adding a semantic colour means adding it to the `PAIRS` table in that script. A
value nobody checks is a value nobody can trust.

---

## Typography

| Value | Family |
| --- | --- |
| `--dds-font-display` | Space Grotesk, then `system-ui` |
| `--dds-font-body` | Inter, then `system-ui` |
| `--dds-font-mono` | JetBrains Mono, then `ui-monospace` |

**Dessau ships no font binaries.** The first family is used when the reader
already has it; otherwise the stack falls through to the platform UI font, which
is a good typeface on every current platform. `system-ui` sits before the named
fallbacks deliberately. See `docs/typography.md` for the evaluation and for how to
self-host.

### Scale

Fluid via `clamp()` from `lg` upward, so there is no width at which text jumps.
All bounds in `rem`, so the reader's own browser font-size setting still scales
everything.

`--dds-font-size-2xs` · `xs` · `sm` · `md` (1rem, body) · `lg` · `xl` · `2xl` ·
`3xl` · `4xl`

**`md` is the minimum for a form control.** iOS Safari zooms the viewport when
focusing a control with a smaller font size, which is disorienting and hard to
recover from. This is why there is no `.dds-input-sm`.

### Weights, line heights, spacing

`--dds-font-weight-regular` (400) · `medium` (500) · `semibold` (600) · `bold` (700)

`--dds-line-height-tight` (1.15, display) · `snug` (1.3, headings) ·
`normal` (1.55, body) · `loose` (1.7, long-form)

`--dds-letter-spacing-tight` (large display only) · `normal` · `wide` (small UI labels)

### Measure

`--dds-measure-narrow` (45ch) · `default` (68ch) · `wide` (88ch)

In `ch`, because reading comfort is governed by characters per line, not pixels.

---

## Space

4px base, deliberately thin ramp. **There are no in-between values** — a layout
that needs 14px is a layout that has not decided yet.

| Value | Size | Use |
| --- | --- | --- |
| `--dds-space-3xs` | 2px | Hairline nudges, icon optical alignment |
| `--dds-space-2xs` | 4px | Base unit |
| `--dds-space-xs` | 8px | Inside small controls |
| `--dds-space-sm` | 12px | Label to control |
| `--dds-space-md` | 16px | Default gap |
| `--dds-space-ml` | 20px | The one midpoint — see below |
| `--dds-space-lg` | 24px | Between groups |
| `--dds-space-xl` | 32px | Between blocks |
| `--dds-space-2xl` | 48px | Between sections |
| `--dds-space-3xl` | 72px | Between major regions |

Reaching for a step that does not exist silently invalidates the whole
declaration — it falls back to `inherit`/`initial`, not to the previous
declaration. `node scripts/check-css.mjs` guards against it.

### The one midpoint

`ml` (20px) is the single in-between value, and it exists because the ramp had its
**widest relative jump in its most-used region**: 16 to 24 is 1.5×, while 12 to 16 and
24 to 32 are both 1.33×.

Everywhere else the ratio widens as the values grow, which is correct — a 16px
difference is a decision at 32px and noise at 72px. In the middle it was the other way
round, so the place needing the finest resolution had the coarsest.

The name is the least-bad option rather than a good one: a t-shirt scale has no clean
word for a midpoint. **If a second midpoint is ever needed, renumber the whole ramp**
(`space-1` … `space-10`) rather than inventing another two-letter name. One exception is
an exception; two are a naming scheme that has stopped working.

`.dds-stack-ml`, `.dds-mbs-ml` and `.dds-mbe-ml` exist alongside it, because a step that
the utilities cannot reach is a step half the system cannot use.

---

## Radius, borders, containers

`--dds-radius-none` · `sm` (4px) · `md` (8px) · `lg` (14px) · `pill` · `circle`

`sm` for things inside other things (inputs, buttons); `md` for containers.

`--dds-border-thin` (1px) · `--dds-border-thick` (2px)

`--dds-border-thick` exists so emphasis never depends on colour alone: a selected
card gains weight, not just hue.

`--dds-container-xs` (24rem) · `sm` (32rem) · `md` (45rem) · `lg` (60rem) ·
`xl` (75rem)

For page and form shells, **not** for prose line length — that is `--dds-measure-*`.

---

## Elevation

`--dds-elevation-sm` · `md` · `lg`

Two-part shadows: a tight contact shadow plus a soft ambient one, because a
single blur reads as a glow rather than as height. Dark mode overrides them — the
same shadow that reads as height on white reads as dirt on near-black.

---

## Motion

| Value | Duration | Use |
| --- | --- | --- |
| `--dds-duration-instant` | 80ms | Hover, focus, colour swaps |
| `--dds-duration-fast` | 140ms | Small reveals, toggles |
| `--dds-duration-base` | 220ms | Dialogs, panels |
| `--dds-duration-slow` | 320ms | Full-surface transitions only |

`--dds-ease-standard` (decelerating, arrivals) · `--dds-ease-exit`
(accelerating, departures) · `--dds-ease-emphasis` (slight overshoot)

All of it is neutralised globally under `prefers-reduced-motion: reduce`
(`base.css`) — a global switch, not a per-component opt-out. Durations collapse
to ~0 rather than `animation: none`, so JavaScript waiting on
`transitionend`/`animationend` still fires and nothing gets stuck mid-state.

---

## Z-index

A **closed** scale. Ad-hoc values are how stacking bugs are born, so anything that
stacks picks a name from this list or does not stack.

| Value | Layer |
| --- | --- |
| `--dds-z-base` (0) | Normal flow |
| `--dds-z-raised` (10) | Sticky header, sticky table head |
| `--dds-z-dropdown` (20) | Listbox, menu, popover |
| `--dds-z-scrim` (50) | Overlay behind a panel |
| `--dds-z-panel` (60) | Off-canvas, drawer |
| `--dds-z-dialog` (70) | Modal content |
| `--dds-z-toast` (80) | Status messages |
| `--dds-z-tooltip` (90) | Always outermost |

Native `<dialog>` and `popover` render in the **top layer** and sit outside the
scale entirely. That is one of the better reasons to use them.

---

## Icons

A sprite built from Ionicons by `scripts/build-icons.mjs`, inlined into every page
by `scripts/sync-icons.mjs`, referenced as
`<svg class="dds-icon" aria-hidden="true"><use href="#dds-icon-check"/></svg>`.

Symbol ids name the **role**, not the picture: `dds-icon-error`, never
`dds-icon-alert-circle`. Which Ionicon backs a role is decided in one place and
changes no markup.

### If the role you need is not in the set, add it

Do not point an existing role at a new meaning. That is the one icon mistake no
script can catch: the `<use>` resolves, the icon renders, every check passes, and
the interface shows a picture that means something else. Four had accumulated
before this was written down — a **sun** on the "show password" button, a
**document** on both the upload zone and the download link, and the navigation
**hamburger** on an overflow menu.

Adding a line to `ICON_MAP` is the expected move, not an escalation. Ionicons has
around 1,300 icons; the constraint is the naming and the caller, not the count.

A Unicode glyph is not the alternative. `check-icons.mjs` rejects twenty-five
characters by name, and the reason is in that file.

### The set today

| Group | Roles |
| --- | --- |
| Status | `check` `check-circle` `warning` `error` `info` |
| Navigation | `chevron-down` `chevron-up` `chevron-left` `chevron-right` `arrow-up` `arrow-down` `arrow-left` `arrow-right` `external` |
| Actions | `close` `search` `filter` `plus` `minus` `edit` `trash` `download` `upload` `menu` `more` `eye` `eye-off` |
| Objects | `location` `document` `tag` `inbox` `sun` `moon` |

`menu` is the hamburger and means **site navigation**; an overflow menu is `more`.
`document` is a file; getting one is `download`, sending one is `upload`. A role
means one thing everywhere, or it means nothing.

### Adding an icon

1. Is there a role that already **means** this? If yes, use it. A role that merely
   looks close is not one.
2. Pick the Ionicons **outline** variant and add `[role, 'name-outline']` to the
   right group in `ICON_MAP`.
3. Add the caller in the same change. An icon with no caller is reported by
   `check-icons.mjs` — unless step 4 applies.
4. If it genuinely belongs in the vocabulary without a caller, add a third element
   saying why. It is written into the sprite as `data-dds-vocabulary` and listed on
   every check run. Completing a direction family is a reason; "a product might
   want it" is not.
5. `node scripts/build-icons.mjs` (needs network), then
   `node scripts/sync-icons.mjs`.
6. `node scripts/check-icons.mjs` and `node scripts/sync-icons.mjs --check`.
7. It appears in `reference/foundations.html#icons` on its own — the gallery reads
   the sprite from the page at runtime.

---

## Theming

`color-scheme` is bound to the active theme, so native controls — date pickers,
scrollbars, the search field's clear button, autofill — follow along with no extra
styling.

Light values live in `:root`; dark mode overrides **only what changes** in
`[data-theme="dark"]`. Anything not listed there inherits from `:root` on purpose.

`dds/js/theme-init.js` must load **synchronously in `<head>`**, before any
stylesheet. Any later and the page paints in the default theme and then repaints
in the chosen one — a white flash for someone who asked for a dark interface, on
every navigation.

An explicit choice is stored in `localStorage` under `dds-theme` and always beats
the system preference. With no stored choice the system preference is followed
live, including when it changes at sunset.

---

## Adding a value

1. Does an existing semantic value already mean this? If yes, use it. Stop.
2. Does an existing primitive have the right value? If yes, add only a semantic
   role pointing at it.
3. Otherwise add the primitive to `primitives.css`, in the right ramp, at a step
   that keeps the ramp monotonic.
4. Add the semantic role to `semantic.css`, with a comment saying what it is
   **for** — not what it is.
5. Add a dark-mode override if the meaning requires one.
6. If it is a colour, add every relevant pair to `PAIRS` in
   `scripts/check-contrast.mjs`.
7. Run `node scripts/check-contrast.mjs` and `node scripts/check-css.mjs`.
8. Run `node scripts/build-foundations.mjs`.
9. Add it to `reference/foundations.html` so it is visible.
