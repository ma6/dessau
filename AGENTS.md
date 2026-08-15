# AGENTS.md — Dessau

You are working in **Dessau**, a reusable foundation for building digital
products. This file is the entry point for any coding agent. Read it fully
before making changes.

`CLAUDE.md` points here. There is one canonical set of instructions, not two.

---

## 1. What Dessau is

A foundation, not a component catalogue. Six layers, each depending only on the
ones before it:

```
Principles → Foundations → Components → Patterns → Derived systems → Products
```

**The layer before products is the one Dessau is primarily for.** A derived design
system is built on Dessau, works *without* it, and is itself consumed by products —
one per client. It substitutes the foundation rather than overriding it. A product
consuming Dessau directly is supported and is the second case, not the first. See
`agent/architecture.md` → Two kinds of consumer, and DECISIONS 036.

**DDS** (Dessau Design System) is the UI layer inside Dessau. `dds` is the
implementation namespace everywhere: `.dds-button`, `--dds-color-action-primary`,
`data-dds-dialog-open`, `window.DDS`.

Dessau is deliberately lightweight: semantic HTML, modern CSS, vanilla
JavaScript, no framework, no build step, no runtime dependencies.

---

## 2. Orientation — read in this order

| Need | File |
| --- | --- |
| What is non-negotiable | [`agent/principles.md`](agent/principles.md) |
| Where does this belong? | [`agent/architecture.md`](agent/architecture.md) |
| Which value do I use? | [`agent/foundations.md`](agent/foundations.md) |
| Does this component exist? | [`agent/components.md`](agent/components.md) |
| Does this pattern exist? | [`agent/patterns.md`](agent/patterns.md) |
| Accessibility requirements | [`agent/accessibility.md`](agent/accessibility.md) |
| How do I word this? | [`agent/ux-writing.md`](agent/ux-writing.md) |
| Responsive expectations | [`agent/responsive.md`](agent/responsive.md) |
| Naming and code conventions | [`agent/conventions.md`](agent/conventions.md) |
| When am I finished? | [`agent/definition-of-done.md`](agent/definition-of-done.md) |
| Modern Web Guidance | [`agent/modern-web-guidance.md`](agent/modern-web-guidance.md) |
| Step-by-step procedures | [`agent/recipes/`](agent/recipes/) |
| Machine-readable inventory | [`agent/index.json`](agent/index.json) |

Start with [`agent/README.md`](agent/README.md) for the full map.

**`agent/index.json` is the fastest route to "does this already exist?"** It
lists every component and pattern with its files, its semantic tokens, its
markup contract and its specification anchor. Query it before writing anything
new.

---

## 3. The ten rules

Break any of these and the change is wrong, regardless of how it looks.

1. **Accessibility is a constraint, not a review step.** WCAG 2.2 AA is the
   floor. It outranks visual preference, convenience and deadline. If a design
   requires falling below it, the design changes.

2. **Semantic HTML first.** A `<button>` is a button, a `<table>` is a table, a
   heading level reflects structure. ARIA supplements semantics; it never
   replaces them. `role="button"` on a `<div>` is a bug, not a technique.

3. **Progressive enhancement, always.** The markup works before JavaScript runs.
   Scripts add behaviour the platform lacks; they are never what makes a page
   function. If `dds.js` fails to load, forms still submit and content is still
   readable.

4. **Native before custom.** Use the platform's element if one exists:
   `<dialog>`, `<details>`, `<select>`, `<progress>`, the Constraint Validation
   API, `popover`. A custom replacement must document what it gains and what it
   gives up — and it always gives up something.

5. **Semantic tokens only.** Components read `--dds-color-*`, never
   `--dds-indigo-600` and never a hex value. A primitive does not follow the
   theme, so using one breaks dark mode and nothing else. `node
   scripts/check-css.mjs` enforces this.

6. **`dds` namespace, consistently.** Never `ds-`, `dx-`, `ui-` or an
   unprefixed class. Product-specific styles use the product's own namespace and
   never redefine a `.dds-*` rule.

7. **Never colour alone.** Every status, selection and error carries text or an
   icon as well as colour (WCAG 1.4.1). Emphasis changes fill or weight, not
   just hue.

8. **Extend before duplicating.** Search `agent/index.json` first. A second
   button style is a defect. If an existing component is close but not right,
   extend it or add a variant — do not create a parallel one.

9. **Component or Pattern — decide deliberately.** A Component is one reusable
   building block. A Pattern combines components and behaviour to solve a
   recurring user task. See [`agent/architecture.md`](agent/architecture.md).
   Getting this wrong is how a design system turns into a junk drawer.

10. **Use Modern Web Guidance.** Cross-check any significant HTML, CSS,
    JavaScript, component, pattern, form or responsive work against the
    `modern-web-guidance` skill. See
    [`agent/modern-web-guidance.md`](agent/modern-web-guidance.md).

---

## 4. Where things live

```
dessau/
├── AGENTS.md            ← you are here
├── CLAUDE.md            → points here
├── DECISIONS.md          lasting architectural decisions and their reasons
├── LESSONS_LEARNED.md    reusable experience from real product work
│
├── agent/                machine-oriented context (the Agentic Version)
│   ├── index.json        inventory: components, patterns, tokens, files
│   └── recipes/          step-by-step procedures for recurring jobs
│
├── dds/                  the implementation
│   ├── dds.css           single stylesheet entry (declares the layer order)
│   ├── css/
│   │   ├── primitives.css   raw values — NEVER consumed by components
│   │   ├── semantic.css     intent — what components consume
│   │   ├── base.css         element defaults, focus, motion, forced colours
│   │   ├── typography.css   type utilities, reading measure
│   │   ├── layout.css       six layout primitives
│   │   ├── components.css   reusable building blocks
│   │   ├── patterns.css     task-solving compositions
│   │   └── utilities.css    single-purpose helpers
│   ├── js/
│   │   ├── theme-init.js    blocking, in <head> — sets theme pre-paint
│   │   ├── dds.js           core: register/enhance/announce/theme
│   │   ├── components.js    dialog, tabs, toast, copy
│   │   ├── patterns/        combobox, address-search, form-validation,
│   │   │                    conditional-fields
│   │   └── providers/       replaceable external-service adapters
│   └── icons/icons.svg      the icon sprite (source of truth)
│
├── docs/                 human-facing documentation (the why)
├── reference/            rendered reference pages (the visible proof)
└── scripts/              zero-dependency verification tooling
```

**Deciding where a change goes:**

| Change | Goes in |
| --- | --- |
| A new colour, size or duration | `dds/css/primitives.css` + a role in `semantic.css` |
| A new meaning for an existing value | `dds/css/semantic.css` only |
| Element default, focus, motion, forced colours | `dds/css/base.css` |
| A reusable building block | `dds/css/components.css` (+ `agent/components.md`) |
| A composition solving a user task | `dds/css/patterns.css` (+ `agent/patterns.md`) |
| Behaviour the platform lacks | `dds/js/components.js` or `dds/js/patterns/` |
| An external service | `dds/js/providers/` behind an interface |
| Why a decision was made | `DECISIONS.md` |
| What was learned the hard way | `LESSONS_LEARNED.md` |

---

## 5. Verify before claiming done

Run all of them. They are fast, dependency-free, and each catches a class of
failure that is otherwise silent:

```bash
node scripts/check-contrast.mjs   # every colour pair vs WCAG 2.2 AA, both themes
node scripts/check-css.mjs        # undefined properties, primitive leaks, dead queries
node scripts/sync-icons.mjs       # re-inline the icon sprite into every page
node scripts/sync-icons.mjs --check   # verify the inline copies are current
node scripts/sync-cache-busting.mjs   # re-stamp ?v= after any CSS or JS change
```

The last one is not optional after touching a stylesheet or a script: the `?v=`
each page carries is that file's content hash, and leaving it stale is how a reader
keeps being served the version you just replaced.

Then walk [`agent/definition-of-done.md`](agent/definition-of-done.md).

To view the reference pages:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
# http://localhost:8000/reference/
```

A file:// open mostly works, but `@import` and `<use>` resolution are more
faithful over HTTP.

---

## 6. Working style in this repository

- **One maintainer.** No pull request is required, no peer approval, no
  four-eyes rule, no release gate, no simulated team roles. Do not invent
  process. Direct commits on `main` are fine.
- **Every requirement becomes a ticket first.** When the maintainer asks for
  something new, file it as a GitHub Issue written as a user story — role,
  capability, benefit, acceptance criteria — **before** starting the work, with
  the `story` label. Then reference it in every commit that answers it. A commit
  says what changed; only the ticket says what was asked for. Procedure and
  format: [`agent/recipes/new-requirement.md`](agent/recipes/new-requirement.md).
  Not for typos, corrections in flight, or follow-up questions about work just
  done.
- **Small, coherent commits.** One purpose each; leave Dessau working; include
  the documentation the change needs. **The ticket comes first in the subject**,
  then the conventional type and scope:
  ```
  [#42] feat(patterns): the summary moves focus, the fields do not
  ```
  In brackets, not bare. A subject beginning with `#` is a comment to Git, and
  `--cleanup=strip` — the default whenever the message passes through an editor —
  deletes the whole line without a word. Verify with
  `printf '#42 x\n\nbody\n' | git stripspace --strip-comments`.
- **End every commit message with:**
  ```
  Closes #42        ← only on the commit that finishes the ticket

  AI-assisted change (Claude Code)

  Co-Authored-By: Claude <noreply@anthropic.com>
  ```
- **Stage only what this session changed. Never `git add -A`, never `git add .`.**
  The maintainer codes in parallel, in the same working tree, and a blanket stage
  sweeps up whatever they have open — a scratch file, a half-finished spec, a
  debug script — and commits it under a ticket it has nothing to do with. Name the
  paths, or stage the files this session actually wrote:
  ```bash
  git add dds/css/semantic.css reference/foundations.html   # yes
  git add -A                                                # no
  ```
  Check `git status` before committing and after, and if something you did not
  write is in the commit, take it out with `git rm --cached` and amend. Leave the
  file on disk untouched — it is somebody's work in progress, not litter, and
  deleting it is not the fix.
- **Keep documentation in the same commit as the change.** A component whose
  specification lags behind its code is a component nobody can trust.
- **`agent/<topic>.md` and `reference/<topic>.html` are one thing in two forms.**
  Change the prose in one and change it in the other, in the same commit. The
  rendered page says so in its own footer — "the same material, written for an
  agent, is in …" — and nothing checks it: `check-reference.mjs` verifies
  components, anchors, tokens and assets, not sentences. Two changes to
  `agent/architecture.md` shipped without their rendered half before this was
  written down, and the page that calls itself the proof was the stale one.
- **Record reasoning, not just outcomes.** `DECISIONS.md` for architecture,
  `LESSONS_LEARNED.md` for experience. Both explain *why*.
- **File a GitHub Issue** for worthwhile work outside the current task — without
  the `story` label, which is reserved for what the maintainer asked for. Capture
  the problem, the intended outcome, relevant context, and acceptance criteria
  where useful. Do not expand the current task because a good idea appeared, and
  do not turn every thought into an issue.

### Ask, rather than deciding alone, only when

a change would alter Dessau's purpose, its technology philosophy, the Agentic
Version principle, the accessibility baseline, or the architectural model.

Everything else: evaluate against the principles, cross-check Modern Web
Guidance, choose the simpler reusable option, implement it, record the reasoning
in `DECISIONS.md`, continue.

---

## 7. Never do these

- Introduce React, Vue, Angular, Svelte, Stencil, Storybook, a bundler or a CSS
  framework. Document a compelling need in `DECISIONS.md` first.
- Build Web Components or Custom Elements. Shadow DOM encapsulates away the
  custom properties the entire token architecture depends on, and an
  un-upgraded custom element renders as nothing — the opposite of progressive
  enhancement.
- Add a runtime dependency. The verification scripts use Node stdlib only.
- Use a raw hex, rgb() or px value where a token exists.
- Use a primitive token in a component.
- Style validity from the CSS `:invalid` pseudo-class — it matches before the
  user has typed anything.
- Use a placeholder as a label.
- Mark a required field with an asterisk or colour alone.
- Remove a field's hint when its error appears.
- Use `<dialog open>` — it renders non-modally and Escape does nothing. Use
  `showModal()`.
- Reference the icon sprite as an external file. `<use href="icons.svg#…">`
  breaks `currentColor` silently. Inline the sprite; run
  `node scripts/sync-icons.mjs`.
- Create a file with `token` in its name. The agent sandbox denies those paths,
  and the failure is silent — writes land on a device file. Name the layer
  instead (`primitives`, `semantic`, `foundations`). See `LESSONS_LEARNED.md`.
- Hide form fields with CSS alone. Use the `hidden` attribute, or invisible tab
  stops remain.
- Add a `!important`. The cascade layers make it unnecessary.
- Commit anything from `src/`. It is local reference material, git-ignored, and
  must never enter this repository's history.

---

## 8. Product repositories

A product that consumes Dessau should copy
[`agent/consumer-AGENTS.template.md`](agent/consumer-AGENTS.template.md) into
its own `AGENTS.md`, fill in the paths, and add its product-specific rules
below the Dessau section.

Without it, an agent in that repository does not know Dessau exists and will
invent a second button style, use raw hex values, and write its own ARIA.

---

> **Every project should leave Dessau better than it found it.**
