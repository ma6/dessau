# Modern Web Guidance

The `modern-web-guidance` skill is **mandatory**, and it is used *during* the work
rather than as an audit at the end.

```
Skill(skill="modern-web-guidance", args="<what you are building>")
```

---

## Why it is used continuously, not at the end

A review at the end can only find things to change. Guidance consulted while
building changes what gets written — which is the difference between a rewrite and
a decision.

The specific value: the web platform gains capabilities faster than habits change.
Most of the code in a design system is written from muscle memory formed several
years earlier, and a lot of that muscle memory is now solving problems the platform
solves natively. That is not a knowledge failure, it is the normal state of
affairs — which is why checking is a step rather than an insult.

---

## When to invoke it

Any significant work on:

- HTML structure
- CSS architecture
- JavaScript behaviour
- a component
- a pattern
- forms and validation
- address search, or anything with an asynchronous lifecycle
- responsive behaviour
- accessibility-related interaction
- the agent context, where it concerns web implementation

"Significant" means: anything you would explain to someone in more than one
sentence.

---

## What to ask it for

Concretely, not generically. The useful questions are:

1. **Is there a platform feature for this now?**
   Before writing behaviour, check whether an element or CSS feature already does
   it. This is where the biggest wins are — `<dialog>`, `<details name>`,
   `popover`, `:has()`, `accent-color`, `field-sizing`, `Intl` and container
   queries have each removed a whole category of hand-written code.

2. **Is the markup as semantic as it can be?**
   Usually the answer is "one level more than you wrote".

3. **Can this JavaScript be less, or none?**
   Every line removed is a line that cannot fail to load.

4. **Is this an outdated pattern?**
   Float-based layout, clearfixes, `box-shadow` focus rings, `!important`,
   `outline: none`, jQuery-shaped DOM code, a click-outside listener where
   `popover` exists, a scroll listener where `IntersectionObserver` exists.

5. **Does this help or hurt accessibility?**
   Guidance and WCAG mostly agree; where they appear not to, WCAG wins.

6. **What does this cost to load and render?**
   Blocking resources, layout thrash, unnecessary work on the main thread.

7. **Does this work at every width, in both directions, in both themes?**

---

## The order of precedence

```
Dessau principles  →  WCAG 2.2 AA  →  Modern Web Guidance  →  preference
```

Guidance **complements** — it does not replace — Dessau's principles, WCAG 2.2 AA,
semantic HTML, progressive enhancement, or actually testing the thing.

**Where guidance conflicts with a documented principle, the principle wins**, and
the conflict is recorded in `DECISIONS.md` with the reasoning. Do not follow
guidance mechanically; do not dismiss it casually either.

Two examples of how that resolves in practice, both recorded in `DECISIONS.md`:

- **`light-dark()`** would halve the semantic colour definitions. Not adopted,
  because a manual theme override needs an explicit `[data-theme]` block anyway,
  and having both mechanisms is worse than having one.
- **`field-sizing: content`** is genuinely useful and not yet interoperable. Not
  adopted, because a control that sizes to its content in one engine and not
  another is a layout that has to be designed twice.

Neither is a rejection of the guidance. Both are "not yet", written down so the
question does not have to be re-answered.

---

## The full review before a significant commit

After building, and after the whitelabel audit, run a deliberate pass over the
**changed surface**:

1. Invoke the skill for each area the change touched.
2. Walk the actual files — not from memory.
3. For each finding, decide: **fix**, **defer with an issue**, or **decline with a
   reason**.
4. Fix what is worth fixing now.
5. Record declines in `DECISIONS.md`. Record defers as a GitHub Issue.
6. Note in the commit message that the review happened.

A finding that is neither fixed nor written down is a finding that will be
rediscovered, and the rediscovery costs more than the note.

---

## If the skill does not resolve

Say so plainly, in the work summary. Do not quietly substitute recall and describe
it as a guidance review — the whole point of the skill is that it is more current
than recall.

Then:

1. Retry it. The skill registry loads at session start, so a newly installed skill
   may need a fresh session.
2. If it still does not resolve, perform the equivalent review from documented
   platform practice and **label it as such**.
3. Record the substitution in `DECISIONS.md` and open an issue to redo the review
   with the real skill.

---

## What Dessau already does as a result

Kept here so a review does not re-litigate settled ground, and so the reasoning is
visible.

| Instead of | Dessau uses |
| --- | --- |
| A div-based modal with a focus trap | `<dialog>` + `showModal()` |
| A JS accordion | `<details name>` |
| A JS dropdown with a click-outside listener | `popover` + `popovertarget` |
| A custom checkbox from a hidden input and a span | the native input + `accent-color` |
| Hand-written validation rules | the Constraint Validation API |
| Hand-formatted numbers and dates | `Intl`, via `DDS.format` |
| A scroll listener for active-section marking | `IntersectionObserver` |
| Specificity wars and `!important` | cascade layers |
| A JS parent-state class | `:has()` |
| Physical properties and an RTL stylesheet | logical properties |
| Breakpoint-based component layout | container queries |
| Fixed type steps with media queries | `clamp()` |
| A `box-shadow` focus ring | `outline` + `:focus-visible` |
| A JS-measured tooltip position | CSS anchor positioning, behind `@supports` |
| `transform: scale()` | `scale` |
| Fetch races on every keystroke | `AbortController` + debounce |
| Duplicating a mobile navigation | one nav, container query |
| `100vh` | `100svh` |

And what is deliberately **not** adopted yet, each behind `@supports` or waiting:

| Feature | Status |
| --- | --- |
| `light-dark()` | Declined — see `DECISIONS.md` |
| `field-sizing: content` | Not interoperable |
| `interpolate-size` | Behind `@supports`, for the conditional-fields reveal |
| `@starting-style` | Used; degrades to no entry animation |
| Anchor positioning | Behind `@supports`, for menu and tooltip |
| View transitions | Not used; a product may opt in |
| `::details-content` | Not interoperable |
| `appearance: base-select` | Not interoperable |
