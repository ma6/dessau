# Modern Web Guidance review — before the first commit

**Date:** first commit
**Scope:** the complete implementation — 13 stylesheets, 14 scripts, 6 reference
pages, the agent context.

---

## How this review was performed

The `Skill(skill="modern-web-guidance")` tool call did not resolve — the skill was
installed mid-session and the registry loads at session start. However, the skill is
installed **at project level**, in `.agents/skills/modern-web-guidance/`, so its
guides were read directly from disk instead.

That is the real guidance, not recall. The review below cites specific guides and
the corrections it produced.

Two passes were made:

1. **A grep pass** over the actual files, for legacy patterns, physical properties,
   superseded properties and undefined classes. This found two real defects.
2. **A guidance pass**, reading the guides most directly relevant to what Dessau
   implements: forms and validation timing, address autofill, accessible error
   announcement, `:has()`, dark mode, font fallbacks, dialog and popover control.
   This found two corrections where the reasoning was right and the mechanism was
   out of date.

---

## What was checked

```bash
# legacy CSS patterns
grep -rn 'float:|clearfix|!important|outline: *none' dds/css/
# physical instead of logical properties
grep -rn 'margin-left|padding-right|\bleft:|text-align: *left|border-left' dds/css/
# superseded properties
grep -rn 'transform:|100vh' dds/css/
# legacy DOM patterns
grep -rn 'innerHTML' dds/js/
# non-passive scroll and touch listeners
grep -rn "addEventListener\('scroll'|addEventListener\('touch" dds/js/
# classes toggled by JS with no CSS definition
node scripts/check-css.mjs
```

---

## Findings

### 1. `.dds-scroll-locked` toggled by JavaScript, never defined in CSS — **FIXED**

**Severity:** real defect. The scroll lock behind every modal dialog and the
lightbox did nothing. The page scrolled behind an open dialog.

Silent: no error, and the dialog still opened correctly, so it survived review.

**Fixed** by defining `.dds-scroll-locked` in `base.css`, using `overflow: hidden`
on the root. No compensating padding is needed because `scrollbar-gutter: stable`
already reserves the scrollbar's space permanently — which is what the gutter is
for, and why the usual `padding-right: <scrollbar-width>` hack is absent.

**Also fixed the class of failure**, not just the instance: `check-css.mjs` now
verifies every `dds-*` class that JavaScript adds, removes or assigns against the
stylesheets. The CSS-only checks could not see this, because nothing in the CSS was
wrong.

### 2. Chequerboard painted over the swatch colours — **FIXED**

**Severity:** real defect in the reference site. Every colour swatch on the
foundations page rendered chequered.

The chequerboard was a `background-image` and the colour a `background-color`.
Background images paint **above** the background colour, always — so the pattern
intended to reveal transparency was drawn over every colour instead.

**Fixed** by making the colour the first background *layer*
(`linear-gradient(<colour>, <colour>)`) with the chequerboard beneath. Layers stack
front to back, so the first listed is on top.

### 3. `outline: none` in five places — **reviewed, correct**

Each is a control inside a wrapper that shows the focus ring via
`:has(:focus-visible)` — input group, stepper, search field, password field. The
indicator then matches the visible control rather than one segment of it, which is
better than the default, not worse.

`base.css` additionally provides `[data-dds-focus="custom"]` as an explicit,
reviewable opt-out hook so nobody needs to write `outline: none` inline. Nothing
uses it.

### 4. `!important` in six places — **reviewed, correct; DECISIONS 003 corrected**

- `prefers-reduced-motion` overrides in `base.css` — must beat every component.
- Spinner and skeleton reduced-motion fallbacks — must beat the global duration
  collapse, or a spinner is left as a static broken ring.
- `.dds-hidden` and `.dds-no-print` — a hiding utility that loses is not a utility.

DECISIONS 003 originally stated that `!important` inside `dds/` is *always* a bug.
That was too absolute, so it has been corrected rather than left as an aspiration
the code contradicts.

### 5. Physical properties — **none**

Logical properties throughout. The only grep hit was inside a prose comment.

### 6. `transform`, `100vh` — **none**

`scale` and `translate` used as individual properties. `100svh` throughout, so
mobile browser chrome does not clip a full-height layout.

### 7. `innerHTML` — **none**

Every text insertion uses `textContent`. The one place that cannot — highlighting a
matched substring in a combobox option — takes the run from the **source** text
rather than the query, so no user input is reflected back.

### 8. Non-passive scroll and touch listeners — **none**

No scroll listeners at all. Active-section marking uses
`IntersectionObserver`, which reports only when a threshold is crossed rather than
running a callback per scroll frame.

---

### 9. `:user-invalid` should carry the visual invalid state — **FIXED**

**Guide:** `forms/validate-input-after-interaction`, `forms/required-field-feedback`,
`accessibility/accessible-error-announcement`

Dessau's reasoning was right and its mechanism was out of date.

DECISIONS 007 correctly identified that CSS `:invalid` matches from page load, so a
required field looks wrong before anything is typed — and therefore drove the visual
state from `aria-invalid`, set by JavaScript on submit.

The platform now solves this directly. **`:user-invalid`** matches only once the
browser's own "user has committed to a value" flag is set — on blur, or on a submit
attempt — and stops matching the instant the value becomes valid. It has been
**Baseline widely available since 2023-11-02** (Chrome 119, Edge 119, Firefox 88,
Safari 16.5).

**Fixed:**

- `:user-invalid` now carries the visual state, alongside `[aria-invalid="true"]`
  for programmatic and server-side errors. Both selectors are needed; neither is
  redundant.
- `form-validation.js` now bridges the two by testing `field.matches(':user-invalid')`
  **directly**, rather than tracking its own notion of "touched". The visual and
  announced states therefore change at exactly the same moment, using the same
  definition — two separate notions of "touched" is how a focus ring and an
  announcement end up disagreeing.
- A feature test falls back to the previous submit-flag behaviour below that floor.
- Added `.dds-input-confirm:user-valid` as an **opt-in** positive confirmation. Not a
  default: a green border on every satisfied field turns a form into a scoreboard.

### 10. `aria-errormessage` for the error, `aria-describedby` for the hint — **FIXED**

**Guide:** `accessibility/accessible-error-announcement`

Dessau folded both hint and error into one space-separated `aria-describedby`.
`aria-errormessage` is the specified attribute for an error, and it is only exposed
while `aria-invalid="true"` — which is exactly the desired semantics.

**Fixed:** the error is now linked with `aria-errormessage`. `aria-describedby` is
kept in sync **as well**, deliberately: screen-reader support for
`aria-errormessage` is still uneven, and a silently unannounced error is the worst
possible outcome. Assistive technology that understands the attribute uses it;
anything that does not still hears the message as a description.

### 11. Street address as a `<textarea>` — **considered, not adopted**

**Guide:** `forms/autofill-address-form`

The guide recommends a single `<textarea autocomplete="street-address">` for the
street address, as the most flexible option across international formats.

**Not adopted**, deliberately. Dessau already follows the substance of the
recommendation — street and number in **one** field, never split — but keeps it a
single-line `<input>`:

- The field is populated by an address provider, which returns a single line.
- A `<textarea>` invites newlines, and a newline inside a street line breaks
  downstream systems that expect one, silently and later.
- Multi-line international formats are served by the separate, always-present
  `address-line2` field, which is manual and never auto-filled.

The guide's underlying point — do not assume a "normal" address format — is honoured;
the specific element is not. Recorded rather than ignored.

### 12. Confirmed already aligned

The guidance was checked against these and required no change:

| Guide | Dessau |
| --- | --- |
| `forms/autofill-address-form` | `autocomplete` on every field, one name input, `type`/`inputmode` correct, `required` present, no Latin-only patterns |
| `forms/autofill-sign-in-form` | `username` + `current-password`, paste never blocked, reveal toggle |
| `css/style-parent-with-has` | `:has()` for input group, choice card, switch, chip, stepper |
| `css/size-aware-styling` | Container queries with the frame layer |
| `css/fluid-scaling` | `clamp()` on the type scale |
| `css/individual-transform-properties` | `scale`, `translate`, `rotate` — no `transform` shorthand |
| `visual-design/dark-mode` | `color-scheme` bound to the theme, both themes verified |
| `visual-design/visually-stable-font-fallbacks` | `size-adjust` and metric overrides on the fallback face |
| `visual-design/improve-text-layout-and-legibility` | `text-wrap: balance` / `pretty`, `overflow-wrap` |
| `ui-behaviors/declarative-dialog-popover-control` | `popovertarget` for menus; `showModal()` for dialogs |
| `ui-behaviors/light-dismiss-a-dialog` | Backdrop click closes; `popover` light-dismiss for menus |
| `ui-behaviors/animate-to-from-top-layer` | `@starting-style` + `transition-behavior: allow-discrete` |
| `ui-atoms/position-aware-tooltips` | Anchor positioning behind `@supports`, implicit anchor |
| `performance/defer-rendering-heavy-content` | `content-visibility` on long reference sections |
| `accessibility/accessibility` | WCAG 2.2 AA as the floor, catalogued by check frequency |

---

## Platform features adopted

Verified present, not assumed:

| Feature | Where | Replaces |
| --- | --- | --- |
| `@layer` | `dds.css` | Specificity wars and `!important` |
| Custom properties | Throughout | Preprocessor variables |
| `:has()` | Input group, choice card, switch, chip, stepper | A JavaScript parent-state class |
| Container queries | Header, footer, steps, text-media, filtering, address | Breakpoint-based component layout |
| `<dialog>` + `showModal()` | Dialog, lightbox | A div modal with a hand-built focus trap |
| `popover` + `popovertarget` | Menu, tooltip | A click-outside listener and a z-index fight |
| `<details name>` | Accordion | A JavaScript accordion |
| Constraint Validation API | Form validation | Hand-written validation rules |
| `Intl` | `DDS.format` | Hand-formatted numbers and dates |
| `IntersectionObserver` | Table of contents | A scroll listener |
| `accent-color` | Checkbox, radio, range | A rebuilt control from a hidden input |
| Logical properties | Throughout | A separate right-to-left stylesheet |
| `clamp()` | Type scale | Fixed steps with media queries |
| `outline` + `:focus-visible` | Focus model | A `box-shadow` ring, discarded under forced colours |
| `AbortController` | Combobox, derived output | Fetch races on every keystroke |
| `scrollbar-gutter: stable` | Root | Scrollbar-width compensation hacks |
| `text-wrap: balance` / `pretty` | Headings, paragraphs | Manual line breaks |
| `100svh` | Body, dialog, lightbox | `100vh` clipped by mobile chrome |
| `scale`, `translate`, `rotate` | Switch, disclosure, lightbox | `transform` shorthand collisions |
| `@starting-style` + `allow-discrete` | Dialog | A JavaScript animation class |
| `field-sizing` — **not** used | — | See below |
| Anchor positioning | Menu, tooltip, behind `@supports` | JavaScript position measurement |
| `interpolate-size` | Conditional fields, behind `@supports` | A JavaScript height animation |
| `mask` | Donut chart, progress ring | An opaque inner circle matching its surface |
| `env(safe-area-inset-*)` | Toast, action bar | A control under the home indicator |
| `content-visibility` | Long reference sections | Rendering work for off-screen content |
| `role="switch"` over a checkbox | Switch | A div with `aria-checked` |
| `lh` unit | Textarea minimum height | A guessed pixel height |

---

## Deliberately not adopted

Recorded so the question does not have to be re-answered. Full reasoning in
DECISIONS 013.

| Feature | Status | Why |
| --- | --- | --- |
| `light-dark()` | Declined | Would halve the semantic colour definitions, but a manual theme override needs an explicit `[data-theme]` block anyway. Two mechanisms is worse than one. |
| `field-sizing: content` | Not yet | Not interoperable. A control that sizes to content in one engine and not another is a layout designed twice. |
| `::details-content` | Not yet | Not interoperable. |
| `appearance: base-select` | Not yet | Not interoperable. The native select popup is correct on touch, with a keyboard, and in untested languages. |
| View transitions | Not adopted | A product-level choice, not a foundation concern. |
| `@scope` | Not needed | Cascade layers already solve what it would be used for here. |
| CSS nesting | Used sparingly | Flat selectors read better in files this heavily commented. |

---

## WCAG 2.2 additions — verified present

The criteria newer than most checklists, which is why they are listed explicitly:

| Criterion | Where it is handled |
| --- | --- |
| 2.4.11 Focus Not Obscured | `scroll-margin-block` on every focusable element; `.dds-actionbar-host` |
| 2.5.7 Dragging Movements | Upload always offers a button; drag and drop is additive |
| 2.5.8 Target Size | Enforced as a floor in `base.css`; most controls are 44px |
| 3.2.6 Consistent Help | Documented as a product responsibility |
| 3.3.7 Redundant Entry | Wizard keeps answers on Back; review step shows them |
| 3.3.8 Accessible Authentication | Password managers work, paste never blocked, one field for a one-time code, reveal toggle |

---

## Not verifiable by any of this

Stated plainly, because a review that implies completeness it does not have is worse
than a shorter one:

- **No real screen-reader pass has been performed.** VoiceOver + Safari and NVDA +
  Firefox are the next step, and no amount of static analysis substitutes for
  listening to a whole flow.
- **No real browser rendering check across engines.** The reference pages are
  tag-balanced and the CSS is verified, which is not the same as looked at in
  Safari.
- **Whether an announcement is *useful*** — as opposed to present — is a judgement
  no script makes.
- **Whether focus order matches how the page reads.**
- **Whether an error message actually helps.**

Recorded as follow-up issues rather than left as an implied claim.
