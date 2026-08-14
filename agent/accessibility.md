# Accessibility

**WCAG 2.2 AA is the floor.** Not a target, not a phase, not a final audit.

Organised by **how often you need to check it**, not by WCAG's own numbering —
because the useful question is "what do I verify on this change?", not "what does
1.4.3 say?". The criterion number is given so it can be looked up.

- **A** — every component, every change.
- **B** — only when the feature is present.
- **C** — once per page or application.
- **D** — the criteria WCAG 2.2 added over 2.1, called out because they are the
  ones most often missed.
- **E** — beyond AA, worth doing anyway.

---

## A — Always check

### Colour and contrast

| Check | Criterion |
| --- | --- |
| Body text ≥ 4.5:1 | 1.4.3 |
| Large text (≥ 24px, or ≥ 18.66px bold) ≥ 3:1 | 1.4.3 |
| Component boundaries and states ≥ 3:1 | 1.4.11 |
| Focus indicator ≥ 3:1 against adjacent colours | 1.4.11 |
| Information never conveyed by colour alone | 1.4.1 |

**Calculate, never estimate:** `node scripts/check-contrast.mjs`. Check **both**
themes — dark mode is where colour mistakes hide, because the light value is the
one that was reasoned about.

Exempt: disabled controls, pure decoration, logotypes. `--dds-color-border-subtle`
is deliberately below 3:1 because it separates content that layout already
separates.

### Structure and semantics

| Check | Criterion |
| --- | --- |
| Semantic element for the job; ARIA only to supplement | 4.1.2 |
| One `<h1>` per page, no skipped levels | 1.3.1 |
| Landmarks: `<header>`, `<nav>`, `<main>`, `<footer>` | 1.3.1 |
| Lists marked up as lists; tables as tables with `<th scope>` | 1.3.1 |
| Reading order matches visual order | 1.3.2 |
| `lang` on `<html>`; `lang` on any passage in another language | 3.1.1, 3.1.2 |
| Name, role and value exposed for every control | 4.1.2 |

`order`, `flex-direction: row-reverse` and `grid-area` all reorder visually
without reordering the DOM. Where a component reorders, the reorder is bound
**inside** the query it is meant for — applied unconditionally it also reverses
the stacked order at narrow widths, which is exactly a 1.3.2 failure.

### Forms

| Check | Criterion |
| --- | --- |
| Visible `<label for>` on every control | 1.3.1, 3.3.2 |
| A placeholder is never the label | 3.3.2 |
| Required stated in words, not by colour or an asterisk | 1.4.1, 3.3.2 |
| Hint and error both referenced from one `aria-describedby` | 1.3.1 |
| Errors identify the field and say what to do | 3.3.1, 3.3.3 |
| Related controls grouped in `<fieldset>` with `<legend>` | 1.3.1 |
| Correct `autocomplete` token | 1.3.5 |

### Keyboard and focus

| Check | Criterion |
| --- | --- |
| Every control reachable and operable by keyboard | 2.1.1 |
| Nothing traps focus except a modal, which Escape closes | 2.1.2 |
| Focus visible on every focusable element | 2.4.7 |
| Focus order follows reading order | 2.4.3 |
| Focus never lands on something invisible | 2.4.3 |
| Focus not obscured by sticky furniture | **2.4.11** |
| A scrollable region has a tab stop and a name | 2.1.1 |

`:focus-visible`, not `:focus` — a mouse click should not leave a ring behind,
while keyboard and assistive-technology focus is always indicated. **Never
`outline: none`** without a guaranteed visible replacement.

### Targets and pointer

| Check | Criterion |
| --- | --- |
| Pointer targets ≥ 24×24 CSS px | **2.5.8** |
| Nothing requires a path-based gesture | 2.5.1 |
| Nothing requires dragging without an alternative | **2.5.7** |
| Actions trigger on `up`, not `down` | 2.5.2 |
| Accessible name contains the visible label | 2.5.3 |

DDS uses 44px for most controls — the comfortable platform size — and 32px for
dense contexts, still above the 24px minimum.

### Motion and interaction

| Check | Criterion |
| --- | --- |
| `prefers-reduced-motion: reduce` honoured | 2.3.3 |
| Nothing flashes more than three times per second | 2.3.1 |
| Anything auto-updating can be paused | 2.2.2 |
| No time limit, or it can be extended | 2.2.1 |

The reduced-motion switch is **global** (`base.css`), not per component. A
component that forgets it can genuinely make someone ill.

### Zoom and reflow

| Check | Criterion |
| --- | --- |
| Usable at 320px wide with no horizontal page scroll | 1.4.10 |
| Usable at 400% zoom | 1.4.10 |
| Text resizable to 200% without loss | 1.4.4 |
| Text spacing overrides do not break layout | 1.4.12 |
| Works in both orientations | 1.3.4 |

Never override the root font size — it breaks the reader's own font-size setting,
which is the single most used accessibility feature on the web. All sizes in `rem`
with `clamp()`.

Legitimate exception to horizontal scroll: one genuinely wide component, such as a
data table, inside a focusable, named scroll region.

---

## B — When the feature is present

### Messages and loading

| Check | Criterion |
| --- | --- |
| Status changes announced via a live region | 4.1.3 |
| `role="status"` for polite, `role="alert"` for urgent | 4.1.3 |
| Loading announced, not just spun | 4.1.3 |
| Result counts announced, debounced | 4.1.3 |

`role="alert"` interrupts. Reserve it for something the user must know
immediately. Announcing a result count on every keystroke makes a screen reader
unusable — debounce.

### Dialogs and overlays

| Check | Criterion |
| --- | --- |
| Focus moves into the dialog on open | 2.4.3 |
| Focus contained while open | 2.1.2 |
| Escape closes it | 2.1.2 |
| Focus returns to the opener on close | 2.4.3 |
| The dialog has an accessible name | 4.1.2 |
| Hover/focus content is dismissable, hoverable, persistent | 1.4.13 |

Native `<dialog>` + `showModal()` provides the first four. `<dialog open>` does
not — it renders non-modally.

### Media

| Check | Criterion |
| --- | --- |
| Captions for pre-recorded video with audio | 1.2.2 |
| Audio description, or a full text alternative | 1.2.3, 1.2.5 |
| Transcript for audio-only | 1.2.1 |
| Audio over 3 seconds can be stopped | 1.4.2 |
| Nothing autoplays with sound | 1.4.2 |

### Images and graphics

| Check | Criterion |
| --- | --- |
| Meaningful images have `alt` describing their purpose | 1.1.1 |
| Decorative images have `alt=""` | 1.1.1 |
| A chart is accompanied by its data as a table | 1.1.1 |
| Icons are `aria-hidden`; the control carries the name | 1.1.1 |
| Text in an image ≥ 4.5:1, or the text exists elsewhere | 1.4.5 |

`alt` and a caption are **not** interchangeable: `alt` replaces the image, a
caption supplements it. Using one as the other means the same sentence is
announced twice.

### Tables

| Check | Criterion |
| --- | --- |
| `<th scope="col">` / `scope="row"` | 1.3.1 |
| A `<caption>`, or an accessible name | 1.3.1 |
| Overflow region focusable and named | 2.1.1 |

### Authentication

| Check | Criterion |
| --- | --- |
| No cognitive function test without an alternative | **3.3.8** |
| Paste is never blocked | **3.3.8** |
| Password managers work; `autocomplete` correct | **3.3.8** |
| A one-time code in one field with `one-time-code` | **3.3.8** |
| A password reveal is offered — automatic on every `type="password"`, so check it is *there* rather than remembering to add it | **3.3.8** |

---

## C — Once per page or application

| Check | Criterion |
| --- | --- |
| A skip link to main content, genuinely visible on focus | 2.4.1 |
| Unique, descriptive `<title>` | 2.4.2 |
| Link text meaningful out of context | 2.4.4 |
| More than one way to find a page | 2.4.5 |
| Consistent navigation across pages | 3.2.3 |
| Consistent naming for the same function | 3.2.4 |
| Focus and input do not cause unexpected context changes | 3.2.1, 3.2.2 |
| A published accessibility statement | — |
| No duplicate `id` | 4.1.1 |
| Help is in a consistent place | **3.2.6** |
| Information is not asked for twice | **3.3.7** |

---

## D — Added by WCAG 2.2

The criteria most often missed, because they are newer than most checklists.

| Criterion | Requirement | Dessau |
| --- | --- | --- |
| **2.4.11** Focus Not Obscured | A focused element is not entirely hidden by sticky content | `scroll-margin-block` on focusables; `.dds-actionbar-host` |
| **2.5.7** Dragging Movements | Anything draggable has a single-pointer alternative | Upload always offers a button |
| **2.5.8** Target Size (Minimum) | 24×24 CSS px | Enforced in `base.css`; most controls are 44px |
| **3.2.6** Consistent Help | Help sits in the same place across pages | A product concern — put it in the footer |
| **3.3.7** Redundant Entry | Do not ask for the same information twice in one process | Wizard keeps answers; review step shows them |
| **3.3.8** Accessible Authentication | No cognitive function test without an alternative | See the authentication pattern |

---

## E — Beyond AA, worth doing

- **Forced colours.** `@media (forced-colors: active)` — anything that conveyed
  state through a fill needs a border or a system colour, because fills are
  stripped. Handled in `base.css` and per component.
- **Contrast beyond the minimum.** Most DDS text pairs clear 7:1 (AAA) without
  trying.
- **Visible focus that is genuinely obvious**, not technically compliant.
- **A `<title>` that reads well in a tab strip and in a screen-reader list.**
- **Announce nothing the user did not cause.** A live region that fires on its own
  is noise.
- **Test with a real screen reader**, not only an automated checker. Automation
  finds perhaps a third of real problems, and none of the ones about whether the
  announcement makes sense.

---

## What automation can and cannot do

**Scripted here:**

```bash
node scripts/check-contrast.mjs   # every colour pair, both themes
node scripts/check-css.mjs        # silent CSS failures
node scripts/sync-icons.mjs --check
```

**Not automatable, and therefore actually your job:**

- Whether an announcement is *useful*.
- Whether focus order matches how the page reads.
- Whether an error message tells the reader what to do.
- Whether `alt` text describes the image's *purpose* rather than its contents.
- Whether a heading structure reflects the document's actual structure.
- Whether the interface is usable with a screen reader, as opposed to technically
  parseable by one.

An automated pass is a floor, not a result.

---

## Manual pass

1. **Keyboard only.** Unplug the mouse. Reach every control, operate it, see focus
   at all times, get out of everything.
2. **Screen reader.** VoiceOver + Safari, or NVDA + Firefox. Listen to a whole
   flow, not individual elements.
3. **400% zoom** and **320px width**.
4. **Both themes.**
5. **Reduced motion** enabled.
6. **Forced colours** enabled, on Windows or via emulation.
7. **Tab through with your eyes closed** for the last few seconds — if you cannot
   tell where you are from what is announced, neither can anyone else.
