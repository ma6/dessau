# Definition of Done

**A component or pattern is not done because it renders.**

Rendering is the first ten percent. What follows is the part that decides whether
the thing is reusable or whether every product that touches it has to finish the
job again.

Work through this before saying something is finished. Where an item genuinely does
not apply, it does not apply — but say so rather than skipping silently.

---

## 1. Structure

- [ ] The **semantic element** for the job. `<button>`, `<table>`, `<dialog>`,
      `<details>`, `<fieldset>`, `<dl>` — not a `<div>` with a role.
- [ ] ARIA only where semantics do not reach, and never contradicting them.
- [ ] Heading levels reflect structure, not type size.
- [ ] **Reading order matches visual order** at every width.
- [ ] Every `id` unique; every reference (`for`, `aria-labelledby`,
      `aria-describedby`, `aria-controls`) resolves.

## 2. Keyboard

- [ ] Every control reachable and operable by keyboard alone. **Unplug the mouse
      and try.**
- [ ] Focus visible at all times, via `:focus-visible`.
- [ ] Focus order follows reading order.
- [ ] Nothing traps focus except a modal, which Escape closes.
- [ ] Focus never lands on an invisible or removed element.
- [ ] A composite widget is **one** tab stop with arrow-key navigation, not one
      stop per item.
- [ ] Focus not obscured by sticky furniture (WCAG 2.2 2.4.11).

## 3. Screen reader

- [ ] Every control has an accessible name that says what it does.
- [ ] The name contains the **visible** label (WCAG 2.5.3).
- [ ] Icon-only controls carry a name; the icon is `aria-hidden`.
- [ ] State changes announced through a live region — politely unless urgent.
- [ ] Announcements are **debounced** where driven by typing.
- [ ] Nothing announced that the user did not cause.
- [ ] Listened to as a **whole flow**, not element by element. The question is
      whether it makes sense, not whether it is parseable.

## 4. Colour and contrast

- [ ] `node scripts/check-contrast.mjs` passes.
- [ ] Body text ≥ 4.5:1; boundaries, states and focus ≥ 3:1.
- [ ] **Nothing conveyed by colour alone** — text or an icon as well.
- [ ] Emphasis and selection change fill or weight, not only hue.
- [ ] Verified in **both** themes. Dark mode is where colour mistakes hide.

## 5. Themes

- [ ] Light mode correct.
- [ ] Dark mode correct — not merely "not broken".
- [ ] Only **semantic** values used. `node scripts/check-css.mjs` passes.
- [ ] Any surface that sets a background also sets a paired foreground.

## 6. Responsive

- [ ] Responds to its **container**, not the viewport — unless it genuinely
      depends on the device.
- [ ] A `-frame` layer exists where a container query needs one.
- [ ] Checked at every stop on the width switcher (`data-ref-bp`).
- [ ] Works at **320px** with no horizontal page scroll, and at **400% zoom**.
- [ ] Any reorder is bound inside the query it is meant for.
- [ ] Touch targets ≥ 24px at the narrowest width.
- [ ] A `.ref-note` on the reference page describes the width-dependent
      behaviour.

## 7. Motion

- [ ] Motion reports state or origin; it does not decorate.
- [ ] `prefers-reduced-motion: reduce` produces a correct static result — not a
      broken one. A spinner needs an explicit non-moving fallback.
- [ ] Nothing flashes more than three times per second.

## 8. States

Every state the thing can actually be in, rendered and reachable:

- [ ] Default, hover, active, focus, disabled.
- [ ] Empty, loading, populated.
- [ ] **Error** — and worded so the user knows what to do.
- [ ] **Nothing found**, distinct from **request failed**.
- [ ] Selected / current / expanded where applicable.
- [ ] Busy, with an announcement rather than only a spinner.

The two most often missing are "request failed" and "nothing found treated as a
different thing from a failure". Check those specifically.

## 9. Progressive enhancement

- [ ] **Works with JavaScript disabled.** Say what the reader gets: it must be a
      usable outcome, not "nothing".
- [ ] Behavioural ARIA is applied by the script, so it is absent when the script
      is.
- [ ] Enhancement is idempotent and survives `DDS.enhance()` running again.
- [ ] Anything asynchronous aborts in-flight work when superseded.
- [ ] An external service sits behind a provider interface, and the task is
      completable without it.

## 10. Content

- [ ] Wording follows [`ux-writing.md`](ux-writing.md).
- [ ] Buttons name the action with a verb.
- [ ] Errors say what is wrong **and** what to do.
- [ ] Formats via `DDS.format` — German default.
- [ ] Example data realistic, invented, with diacritics, and including the
      awkward-but-real case.
- [ ] No real personal data anywhere, including fixtures and commit messages.

## 11. Naming and code

- [ ] `dds` namespace throughout; nothing unprefixed.
- [ ] Named by **role**, not by appearance.
- [ ] Inside the correct cascade layer. **No `!important`.**
- [ ] Logical properties, not physical.
- [ ] Adjustables exposed as component-local custom properties.
- [ ] Comments explain **why**, not what.
- [ ] Understandable by someone who has not read the rest of the file.
- [ ] No new dependency.

## 12. Documented and discoverable

This is the part that gets skipped, and skipping it is what makes the work
unusable by the next person or agent.

- [ ] Specified in [`components.md`](components.md) or
      [`patterns.md`](patterns.md) — purpose, when **not** to use it, markup
      contract, states, accessibility.
- [ ] Listed in [`index.json`](index.json).
- [ ] Rendered in the matching `reference/*.html`, with every variant and state.
- [ ] A `data-ref-code` block, so the real markup is visible and copyable.
- [ ] Do / don't guidance where a misuse is likely.
- [ ] `node scripts/check-agent-index.mjs` passes.
- [ ] Lasting reasoning in `DECISIONS.md`; hard-won experience in
      `LESSONS_LEARNED.md`.

## 13. Modern Web Guidance

- [ ] Cross-checked against the guidance skill — see
      [`modern-web-guidance.md`](modern-web-guidance.md).
- [ ] A newer platform feature preferred over a hand-rolled equivalent where one
      exists.
- [ ] Anything not yet interoperable sits behind `@supports` and degrades
      correctly.
- [ ] Any deliberate divergence from guidance recorded in `DECISIONS.md`.

---

## The scripted gate

All of these must pass. They are fast and each catches a class of failure that is
otherwise silent:

```bash
node scripts/check-contrast.mjs
node scripts/check-css.mjs
node scripts/check-agent-index.mjs
node scripts/sync-icons.mjs --check
node scripts/sync-reference-toc.mjs --check
node scripts/build-foundations.mjs --check
```

An automated pass is a floor, not a result. It cannot tell you whether an
announcement is useful, whether focus order matches how the page reads, or whether
an error message helps.

---

## The three questions

If the checklist feels long, these three catch most of what it covers:

1. **What does someone using only a keyboard and a screen reader experience?**
2. **What happens when the network is slow, the request fails, or the script never
   loads?**
3. **Could another agent find this, understand its contract, and use it correctly
   without reading the implementation?**

If any answer is unsatisfactory, it is not done.
