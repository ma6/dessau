# Lessons learned

Reusable experience from real work. **Not a bug tracker** — a bug that was fixed and
taught nobody anything does not belong here.

The test for an entry: *would knowing this in advance have saved someone real time,
or prevented a defect that reached a user?*

Each entry states what happened, why it happened, and what to do instead.

---

## Silent failures are the expensive ones

The thread running through most of what follows.

Every failure recorded here produced **no error**: no console message, no broken
layout, no failing test. Something was quietly absent or quietly wrong, and it was
noticed weeks later, in a product, by a user.

That is why Dessau has six verification scripts rather than a linter config. A
failure that announces itself gets fixed in minutes. A silent one gets shipped.

---

## An undefined custom property invalidates the whole declaration

`var(--dds-space-4)`, where that name does not exist, does **not** fall back to the
previous declaration. The declaration becomes invalid at computed-value time and
falls back to `inherit` or `initial`. A padding silently becomes zero.

There is no console warning. The element simply has no padding, and it looks like a
design choice.

**Do:** keep the space ramp thin and closed, so reaching for a step that does not
exist is unusual. Run `check-css.mjs`. Use a fallback — `var(--x, 1rem)` — where a
value is genuinely optional.

---

## A container query with no matching `container-name` matches nothing

`@container dds-thing (…)` with no element declaring
`container-name: dds-thing` never matches. The component stays in its base form —
usually the narrow one — at every width. No error.

The subtle version: a container query **cannot style the element that establishes
the container**, only its descendants. Writing `container-type` and the layout on
the same element produces a query that is valid, parses fine, and does nothing.

**Do:** the `-frame` pattern. Outer element carries `container-type` and
`container-name` and nothing else; an inner element carries the layout. Run
`check-css.mjs`.

---

## `order` applied unconditionally reverses the stacked order too

A component swapped its two columns with `order: 2`, outside any query. Above the
breakpoint it looked right. Below it, where the component stacks into one column,
the reorder still applied — putting the caption before what it captioned.

Invisible on a desktop. A WCAG 1.3.2 failure, because the reading order no longer
matched the visual order.

**Do:** bind any reorder **inside** the query it is meant for. If a component
stacks into one column below a threshold, `order` must be neutral there — by
leaving the rule out, not by resetting it.

---

## An externally referenced icon sprite loses `currentColor`

`<use href="icons.svg#dds-icon-check">` pointing at a separate file does not work.
The referenced content is cloned into a shadow tree whose style computation does not
see the referencing document's CSS, so `currentColor` resolves to a default —
effectively black — regardless of theme, hover state or button variant.

It fails the same way in every current engine, and it fails **silently**: the icon
renders, just in the wrong colour. Which means it survives review.

**Do:** inline the sprite once per document. Keep one source file and a script that
copies it, with a `--check` mode — "remember to update all of them" is not a
strategy, it is a promise that they will diverge.

---

## A CSS declaration beats an SVG presentation attribute

After switching to Ionicons, every outline icon filled solid black.

Ionicons carries `fill:none; stroke:currentColor` as inline attributes on each
path. `.dds-icon` declared `fill: currentColor` in CSS. CSS wins over a presentation
attribute, so the fill overrode the attribute and closed every outline shape.

The inverse also bit: paths with *no* fill attribute — the solid dot on an `i`, the
dot under a `!` — inherited the CSS `fill: none` and disappeared entirely.

**Do:** decide once where fill and stroke live. If the sprite carries them, the CSS
must not declare them. `fill="currentColor"` on the `<symbol>` covers the paths that
declare nothing, because `fill` is inherited in SVG.

---

## `background-image` paints over `background-color`

The colour swatches on the foundations page were meant to show a chequerboard
*behind* each colour, so a token that was unexpectedly transparent would look
transparent rather than white.

Every swatch came out chequered. The chequerboard was a `background-image` and the
colour was `background-color` — and background images paint **above** the background
colour, always.

**Do:** if a colour needs to sit above a pattern, make it a background *layer*:
`linear-gradient(<colour>, <colour>)` as the **first** entry in `background-image`.
Layers stack front to back, so the first one listed is on top.

---

## Never a filename containing `token`

The agent sandbox denies read and write on any path containing `token`. The failure
is silent: `Write` appears to succeed, the path resolves to a device file, and the
result is an empty file with no error. A subsequent `Edit` then fails with a
confusing permissions message.

Two files were written this way before it was noticed.

**Do:** name files after the architectural layer — `primitives.css`,
`semantic.css`, `foundations.md`, `check-css.mjs`. This turned out to be better
naming anyway: `primitives` and `semantic` describe the distinction that matters,
while `tokens` names the mechanism, which is the least interesting thing about them.

Recorded in `agent/conventions.md` and `CLAUDE.md`, because it is not discoverable.

---

## Anchor a selector search to a line start, or prose matches it

The contrast checker read its dark-mode values by finding `[data-theme="dark"]` with
`indexOf`. It found the mention inside the file's own header comment, took the text
after it, extracted zero values — and silently checked every dark pair against the
**light** values instead.

Result: 148 pairs "passing", with dark mode never actually tested. It reported
identical ratios for both themes, which is the only reason it was caught.

**Do:** anchor a selector match to the start of a line. And be suspicious of a
checker that reports suspiciously similar numbers for cases that should differ — a
verification script that cannot fail is worse than none, because it is trusted.

---

## Find the root element, not the first matching tag

`sync-icons.mjs` extracted the sprite with `indexOf('<svg')`. The sprite file's
header comment contains `<svg class="dds-icon">` as a usage example, so the script
matched that, produced a sprite beginning mid-sentence, and injected broken markup
into six pages.

**Do:** match the root specifically — `<svg\s+xmlns=` — when a file documents its
own syntax. A file that explains itself will contain examples of itself.

---

## Node's `fetch` ignores `HTTP_PROXY`

`scripts/build-icons.mjs` failed with `ENOTFOUND` while `curl` fetched the same URL
fine from the same shell. Node's built-in `fetch` does not honour the
`HTTP_PROXY`/`HTTPS_PROXY` environment variables.

In any proxied environment — a corporate network, a sandboxed agent — it fails
while every other tool on the machine works, which makes it look like a network
outage rather than a client limitation.

**Do:** in a maintainer script that must work anywhere, try `fetch` and fall back to
`curl`, with a comment saying why. The fallback is not paranoia.

---

## `emptyFor: ''` is falsy, and that silently disabled a test mode

The mock address provider took an `emptyFor` string and checked
`if (opts.emptyFor && query.includes(opts.emptyFor))`. The reference page passed
`''` to mean "always return nothing" — every string contains the empty string — and
the truthiness check skipped it entirely. The "never matches" test mode did nothing.

**Do:** `typeof x === 'string'` when the empty string is a meaningful value. This
applies to `0` and `false` for the same reason.

---

## `<details>` cannot be forced open with CSS

An attempt to have a collapsible contents list on narrow screens and an
always-visible one on wide screens tried `display: block !important` on the content
at the wide breakpoint. It does not work: a closed `<details>` hides its content
through the UA stylesheet in a way CSS cannot reliably override, and
`::details-content` is not interoperable.

**Do:** if a control only exists at one width, the state it controls will
desynchronise on resize. Eight links do not justify that. A plain always-visible
list was the right answer.

---

## Agree what is being dropped before dropping it

A first pass through the component set cut it roughly in half, on the principle that
a small excellent foundation beats a large catalogue.

That principle is right and the application was wrong. What got cut was not
speculative — it was solved problems with their accessibility work already done: the
width switcher that makes anyone actually look at the narrow state, the full WCAG
catalogue organised by check frequency, the writing standard as its own layer, and
around twenty genuinely reusable components.

Rebuilding them cost far more than keeping them would have.

**Do:** when reducing a set of components, classify every one explicitly — *keep /
convert to pattern / rewrite / remove* — and get the removals agreed **before**
writing anything. "Small and excellent" is about not inventing speculative features.
It is not a licence to discard proven ones.

---

## Documentation that is trusted and wrong is worse than missing

The reason `check-agent-index.mjs` exists.

Agent-facing context is read as authoritative. An entry naming a class that no
longer exists does not produce a question — it produces a component built against a
class that does nothing. Missing context at least prompts someone to look.

**Do:** make context verifiable. Every claim in `agent/index.json` — classes, files,
hooks, specification sections — is checked against the implementation, in both
directions: an entry that no longer resolves **and** a component in the CSS that no
entry covers.

---

## A check that verifies the wrong thing is indistinguishable from one that works

`check-agent-index.mjs` verified that every documented component had a `reference`
page and that the page existed. Every entry passed for weeks. Twelve components had
no rendered example anywhere in the repository.

The check was answering "does the file exist" while claiming to answer "can this be
seen to work". Both produce a green line of output.

The same shape appeared three more times in one afternoon:

- The contrast checker located the dark-theme block with `indexOf('[data-theme="dark"]')`,
  which matched the mention of that selector in the file's own header comment. It
  read an empty token set and silently compared the light values against
  themselves — 148 pairs, all passing, all the same theme twice.
- A class-presence check matched `\bdds-banner\b`. A hyphen is a non-word character,
  so `dds-banner-info` matched too: a page showing four variants looked like it
  showed thirteen roots, and two genuinely missing components stayed hidden.
- A breakpoint check required the CSS value to appear as a literal on the
  foundations page. `64rem` passed only because the generated threshold table
  happened to contain a 64rem row; `80rem` failed on a page that was entirely
  correct.

**Do:** when writing a check, deliberately break the thing it is meant to catch and
confirm it goes red. A check that has never failed has not been tested — it has only
been observed to pass, which is the same output.

**Do:** be suspicious of a check that passes on the first run. Both the contrast bug
and the demo-coverage gap announced themselves as clean.

---

## The most expensive bug was three characters of state name

`enhance(document)` was guarded like this:

```js
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () { enhance(document); });
} else {
  enhance(document);
}
```

A deferred script runs *after* parsing finishes, when `readyState` is already
`"interactive"` — never `"loading"`. So the else branch ran every time, sweeping the
document the instant `dds.js` finished executing: before `components.js`, before
every pattern file, before anything had called `register`. The registry was empty.

**Nothing on any page was ever enhanced.** No error, no warning. The combobox never
became a combobox, the lightbox never got its magnifier, the validation never ran,
the scroll lock never engaged. Several of those were reported separately as
individual broken components, and each was investigated as its own bug.

Progressive enhancement is what made it invisible: the markup works on its own, so a
page with zero enhancement still renders, still submits, still navigates. The
property that makes the architecture robust is the same property that hid a total
failure of it.

**Do:** the fix was not to correct the condition. It was to make registration
self-sufficient — a `register()` call arriving after the initial sweep enhances
matching elements immediately. Load order now cannot decide whether anything works,
which is what a system dropped in as plain script tags needs.

**Do:** assert on the observable consequence in a browser. `tests/enhancement.spec.mjs`
checks that elements which opted in are actually marked as enhanced. No static check
can find this — the registry is only empty at one particular moment during load.

---

## Flex does not lay out text

`.ref-note` was `display: flex` with a `gap`, to sit an icon beside a sentence.
Every child of a flex container becomes a flex item, *including each inline element
and each run of text between them*. A sentence containing four `<code>` spans came
out as eleven items with a gap between all of them — the words strewn across two
ragged columns with the numbers boxed out on their own.

It was reported as "the notes look strange", and it reads as a font or a wrapping
problem. Nothing points at the layout mode.

**Do:** a container that holds prose is a block. Put the icon out of flow —
`position: absolute` — rather than making it a sibling item of the text. Components
that genuinely are flex rows (`.dds-notice`, `.dds-banner`) define a `-body` wrapper
for their text, and `check-reference.mjs` now verifies every instance has one.

---

## Hand-tuned optical alignment is a number that will be wrong somewhere

An icon beside text was aligned with `margin-block-start: 0.15em`, derived by eye at
one font size. At every other size and line height it sat visibly high — most
obviously in a validation message, which is where it was finally noticed.

`block-size: 1lh` makes the icon's box exactly one line tall, and an SVG's default
`preserveAspectRatio` centres the glyph inside it. The alignment is then correct by
construction, at any size, any leading, and in a language whose default leading
differs.

**Do:** prefer a rule that derives the value from the context over a constant that
happened to look right in the context it was measured in.

---

## Generated beats written, wherever the content is derivable

A hand-written table of component breakpoint thresholds had three wrong rows within
the hour of being written — the content navigation listed at 48rem when its query
says 64rem, and two rows naming components that had nothing to do with the width
beside them. A hand-written icon gallery was a list of 24 `<use>` elements whose
completeness was nobody's job, with a caption stating the exact opposite of how the
icons work.

Neither produced any signal. A wrong table looks exactly like a right one, and a
gallery of icons looks complete by definition.

**Do:** derive it. `sync-breakpoints.mjs` generates the threshold table from the
stylesheets, including the rationale from the comment above each query; the icon
gallery renders from the `<symbol>` elements present in the page. What cannot be
derived — *why* 34rem and not 32rem — is written once, next to the thing it explains,
and pulled from there.

**Do:** when generation surfaces a gap, fix the gap rather than the generator. Seven
of nine thresholds turned out to have no stated reason at all. A threshold nobody can
justify is a number nobody can safely change.

---

## A commit subject starting with `#` is deleted, not committed

Putting the ticket first — `#42 feat(patterns): …` — reads well and is what most
issue conventions look like. To Git that line is a comment. `--cleanup=strip`,
which is the default whenever a message passes through an editor, removes every
line beginning with `#`, and the subject is a line beginning with `#`.

```bash
printf '#42 feat: subject\n\nbody\n' | git stripspace --strip-comments
# body
```

The commit still succeeds. Its subject is now the first line of the body, or the
message is empty and the commit is aborted with a message about an empty message
rather than about a comment.

`-m` and `-F` use `--cleanup=whitespace`, which keeps comments, so this survives
every scripted commit and fails only when a human edits one — the case that is
never tested.

**Do:** `[#42] feat(patterns): …`. The bracket puts a non-comment character first,
the ticket still leads the subject, and the conventional type and scope stay where
every parser expects them.

---

## Behaviour that differs per page with identical code points at the page

`content-visibility: auto` was on every section of every reference page. It cost
four attempts at a table of contents and then three more defects, all of which
looked like component bugs and none of which were.

An off-screen section is laid out at an estimated height and takes its real height
only as it approaches the viewport. The page therefore keeps growing *after* the
last scroll event has been handled, because the growth is a layout change and not
a scroll. Three things follow, and only the first is the one anybody expects:

- **Positional logic reads stale geometry.** The table of contents got this wrong
  in three separate mechanisms — an `IntersectionObserver` band, an end-of-document
  sentinel, a geometric reading line — each working on some pages and failing on
  others with the component unchanged.
- **A click can land on nothing.** On WebKit, three unrelated controls far down a
  long page did nothing when clicked: a wizard's Continue button, a theme toggle, a
  password field. The sections above them took their real heights while the pointer
  was being aimed. Chromium's estimates differ, so it happened on one engine only,
  and all three components were correct.
- **A custom property reads as an empty string.** `getPropertyValue('--dds-color-…')`
  returns `''` inside a skipped section, and an empty string is a valid value for
  almost every property — so the foundations page reported fifty of its own tokens
  as undeclared and painted nothing, silently.

**The diagnostic is the durable part:** when the same code behaves differently on
different pages, stop reading the component and start looking at the page. The
variable is how tall it is and where the thing sits in it.

**Do:** treat `content-visibility` as opt-in with a measured reason
(`.dds-defer-render`), pair anything positional with a `ResizeObserver`, and check
a second engine whenever it is in play. It was removed from the reference
entirely: the saving had never been measured.

---

## An imported stylesheet has not applied by `DOMContentLoaded`

`dds.css` reaches its layer files with `@import`, so the browser discovers them
only after parsing `dds.css` itself. A deferred script runs before that finishes.

`reference.js` draws every colour swatch by reading a token back out of the
computed style, at `DOMContentLoaded`. On Chromium the values were there. On
WebKit they were not, so the page whose entire job is to show that fifty tokens
are declared reported all fifty as undeclared. Neither engine is wrong — nothing
in the specification says an imported sheet has applied by then.

It failed loudly only because those renderers had already been written to refuse
an empty string. Everywhere else, `''` is a valid value and nothing would have
been said at all.

**Do:** anything reading a custom property from script waits for `load`, or checks
the value and falls back to waiting. Shipping a concatenated stylesheet instead of
an `@import` chain removes the problem rather than working around it.

---

## An author `display` silently defeats the UA's `[hidden]`

The inline icon sprite is `<svg hidden aria-hidden data-dds-icons>` at the top of
every page. It rendered anyway, as an empty 300×150 box, pushing every page down
by 150px, on every page of the reference, for as long as the media reset has
existed:

```css
:where(img, picture, video, canvas, svg, iframe) {
  display: block;
  max-inline-size: 100%;
}
```

The UA stylesheet's `[hidden] { display: none }` is in the **user-agent origin**.
Origin is resolved before specificity, so any author declaration beats it — and
`:where()` scoring zero is irrelevant, because that contest never reaches
specificity. Writing the reset in `:where()` to keep it weak against *author*
rules does nothing to keep it weak against the UA.

Every property of the failure is one this repository has a rule against:

- The markup is right. `hidden` is there, `aria-hidden` is there, the sprite is
  current and complete.
- Nothing failed. No console error, no missing icon, no check red. The page just
  started 150px lower.
- No script could have found it. `check-icons.mjs` verifies the sprite is present
  and up to date, which it was. It is a cascade-origin interaction and is only
  true once a page is rendered.
- Both CI engines agreed, because both were correct.

It was found by somebody looking at a page and asking whether the black bar above
the header was intentional.

**Do:** restate `[hidden]` after any reset that sets `display` on elements that
might carry it, at zero specificity so it undoes that reset and nothing else, and
exclude `hidden="until-found"` — that value is deliberately not `display: none`.

**And:** a reset written in `:where()` is weak against author rules only. Against
the UA stylesheet it is as strong as any other author declaration, which is the
whole point of `:where()` being about specificity rather than about origin.

---

## The fix for that had the same hole, one layer up

The rule written to close the gap above lives in `dds.base`:

```css
:where([hidden]:not([hidden="until-found"])) { display: none; }
```

Zero specificity, deliberately, so it undoes the media reset and nothing else. It
also does nothing at all for `.dds-error`, `.dds-field` or `.dds-button` — because
`dds.components` is a **later layer**, and layer order is resolved before
specificity, so the base rule loses however it is written. `:where()` was never the
weak part. The layer was.

The symptom was not a visibly wrong error message. `clearError()` empties the
message text *and then* hides the paragraph, so what stayed on screen under a
corrected field was the error icon on its own, in error red, still saying no.

Everything that made the first version hard to find was true again: the markup was
right, the JavaScript was right, `element.hidden` was `true`, and nothing logged.
It was found the same way, by somebody looking at a screen and asking what the
circle under the valid field was for.

**Do:** when a class sets `display`, say in the same place what `hidden` means for
it — `.dds-thing[hidden] { display: none }`. `check-css.mjs` now reports a class
that is hidden somewhere in the repository and has no such rule.

**Do not:** fix it once in a late layer. `[hidden] { display: none }` in
`dds.utilities` would win everywhere, including over `.dds-primary-nav[hidden] {
display: block }`, which exists so the header menu does not stay collapsed after a
resize past its container threshold. A blanket rule would break the one component
that means something different by `hidden`.

**And:** the static check can only see what the repository can see. The copy
button hides itself the same way and is registered on `[data-dds-copy]`, which no
page here uses, so no markup connects the behaviour to `.dds-button`. Its rule was
written by hand and the gap is recorded in the script rather than pretended away.

---

## Text moved out of its subtree leaves its language behind

The upload demo is `lang="de"`. Choosing a file announced "1 Datei ausgewählt" —
the right words, in the right language — and VoiceOver read it out **in an English
voice**.

Nothing about the wording was wrong. `wording()` and `plural()` resolved the
nearest `lang` and returned German, which is the rule the whole of DECISIONS.md 028
is about. The message was then written into the live region `DDS.announce` appends
to `<body>`, and `<body>` inherits `<html lang="en">`. The text had left the
subtree whose `lang` produced it, so the attribute that made it pronounceable no
longer applied to it.

This is not specific to live regions. Anything relocated to the end of the document
— a live region, a `<dialog>`, a lightbox, a toast — is in the *document's*
language, whatever the code that built it was looking at. Two places in DDS had
already reasoned their way to it one case at a time (the lightbox resolves its
wording from the thumbnail, the toast from `documentElement`, both with a comment
saying why) without anyone noticing it was the same fact twice, and the third case
was left broken.

Every property of a failure this repository claims to guard against:

- Nothing is visibly wrong. The sentence renders correctly for anyone reading it.
- No check could see it. The markup is valid, the `lang` is present, the strings
  are the right strings, and both the language spec and the enhancement coverage
  gate were green.
- It is only wrong out loud, and only to the one user who cannot check it against
  the screen.
- It needs two languages on one page to be audible at all. On a monolingual page
  it is invisible forever.

It was found by somebody putting VoiceOver on and listening to the upload demo. It
had been there since `announce` was written.

**Do:** when a string is written anywhere other than where it was decided, carry
the language with it — `announce(message, { from: element })`, or `lang` on the
node you insert. The test is mechanical: if the text ends up outside the element
whose `lang` chose it, that `lang` is gone.

**And:** set it once, at creation, rather than mutating it on a live element. One
region per politeness and language, not one region reconfigured per message —
assistive technology is watching that element, and the same reasoning that keeps
`aria-live` fixed applies to `lang`.

**And:** the general lesson about the gates. Contrast, roles, labels and focus
order are all checkable because they are facts about the DOM. "Is this
announcement useful, and is it in the right voice" is a fact about what a person
hears, and no script in this repository can ask it. That is what the walkthrough
in `docs/screenreader-walkthrough.md` is for, and this entry is the argument for
doing it before a release rather than after.

---

## `git add -A` commits whatever the maintainer had open

Dessau has one maintainer and one working tree, and the maintainer codes in it
while an agent does. That is the normal condition, not an edge case.

An agent finishing the accent-token rename staged with `git add -A` and committed
19 files. One of them was `menupos.tmp.mjs` — a Playwright scratch script about
menu positioning, written by the maintainer, in the tree, untracked, and nothing
to do with accents. It went into the history under `[#47]`.

The command did exactly what it was asked. That is the whole difficulty:

- **Nothing failed.** No check runs on staging, and none could. Git does not
  record which files a session wrote, so there is no fact to compare against.
- **The commit lies in two directions.** Its diff no longer answers "what did
  this ticket change", and the scratch file is now in the history at a
  half-finished moment nobody chose — which is the worse half. Before a commit an
  experiment is deletable; after one it is archaeology.
- **It was caught by luck**, reading `git show --stat` after the fact rather than
  `git status` before it.

**Do:** name the paths. `git add dds/css/semantic.css reference/foundations.html`,
not `git add -A`, not `git add .` — and read `git status` before committing rather
than after.

**When it happens anyway:** `git rm --cached <file>` and `git commit --amend`.
**Leave the file on disk.** It is somebody's work in progress, and an agent
deciding to tidy it away is a second, larger version of the same mistake.

**And the general shape:** the tempting fix is a pre-commit hook, and it cannot
work — it would need to know which files this session wrote, which is exactly the
fact git does not have. Some rules have no check behind them and have to be
instructions that are actually followed. `AGENTS.md` §6 carries this one.

---

## `@supports` answers a different question than the one the code depends on

The user menu opened in the top-left corner of the screen. The CSS behind it read
like a careful piece of progressive enhancement:

```css
@supports (anchor-name: --dds-probe) {
  .dds-menu {
    inset-block-start: anchor(bottom);
    inset-inline-end: anchor(right);
  }
}
```

Three separate defects were stacked in those five lines, and each one alone put
the menu in the same corner — which is why fixing the first two changed nothing
visible and looked, from the outside, like no progress at all.

1. **The UA stylesheet was half-overridden.** A popover gets
   `position: fixed; inset: 0; margin: auto` — three declarations that only mean
   "centred" together. The component took `position: absolute; margin: 0` and left
   `inset: 0` standing, and a `max-content` box with four zero insets and no auto
   margin collapses into the start corner.
2. **Releasing `inset` was necessary and made it worse.** With `inset: auto` the
   box has nothing holding it if `anchor()` fails — and a failing `anchor()` is
   invalid at computed-value time, so every inset computes to `auto` and a
   top-layer element sits at the origin of the viewport. Same corner, new reason.
3. **The real defect.** `position-anchor` computes to `normal`, meaning *no*
   anchor. A popover invoked through `popovertarget` does have an implicit anchor,
   but nothing reaches for it until `position-anchor: auto` says so. The comment
   in the file asserted the opposite, in confident prose, for months.

The `@supports` condition is where the mistake became invisible.
`(anchor-name: --dds-probe)` asks *does this engine implement anchor positioning*.
What the rule actually needed was *does this engine resolve the implicit anchor of
a popover's invoker* — a narrower question, with no `@supports` syntax to ask it,
and the answer was no even in a current Chrome.

**Do:** in an `@supports` condition, name the property the rule cannot work
without — `(anchor-name: --x) and (position-anchor: auto)` — rather than the
nearest recognisable feature. A condition that is broader than the dependency is a
claim the code cannot keep.

**Do:** give `anchor()` a fallback: `anchor(bottom, 35%)`. Where `@supports`
cannot express the dependency, the fallback is the only thing standing between a
missing anchor and a box at coordinate zero. It is not a placement anyone designs;
it is the difference between degraded and unusable.

**And the part that cost the most time:** the first two fixes were reasoned from
the specification and shipped without being seen. The reasoning was sound and the
result was still wrong, because a fourth thing was also wrong. What ended it was a
throwaway page that opened the popover through a real invoker click and printed the
computed insets and both rectangles — the numbers matched the fallback percentages
to the pixel, which no amount of reading the spec would have revealed. When
placement is wrong, measure the box; do not deduce it.

**A trap inside the measuring:** the first version of that probe opened the popover
with `showPopover()`. There is no invoker on that path and therefore no implicit
anchor, so it reproduced the symptom for a reason that had nothing to do with the
bug and nearly sent the fix towards WebKit. A probe has to exercise the real entry
point, or it is measuring itself.

---

## Any `#<number>` in a commit message links to that issue, whether meant to or not

`DECISIONS.md` numbers its entries sequentially — `#054`, `#057`, `#058` — and a
commit landing one reads naturally as `docs(decisions): #059 — …` or `… see
DECISIONS.md #057`. GitHub does not know the difference between that and a real
ticket reference. Its autolinker matches `#` followed by digits anywhere in a
commit message, subject or body, and turns it into a link to the issue or PR with
that number in the same repository — unconditionally, with no way to tell it
"this one isn't a ticket." Every one of `#043` through `#059` used this way
across this repository's history landed on a real, unrelated issue and left a
"mentioned this in a commit" entry on its timeline — found only because the
maintainer happened to notice `#59` rendered as a link in a screenshot of a commit
that had nothing to do with issue 59.

The two numbering schemes collide by construction: `DECISIONS.md` started at 001
specifically to mirror how issues are numbered, so a decision number and a ticket
number are the same shape and frequently the same magnitude at the same point in
the project's life.

Nothing short of not writing `#<digits>` prevents it — the issue does not need to
exist for GitHub to try the match, and prefixing with a word (`DECISIONS.md
#057`) does not help, because the autolinker doesn't care what comes before the
`#`, only that a word boundary does.

**Do:** write a `DECISIONS.md` entry number as `DECISIONS.md entry 057` or
`decision 057` in commit messages — no `#`. Reserve `#<number>` in a commit
message for an actual GitHub issue or PR in this repository, where the
cross-reference is the point.

**Not attempted:** rewriting the affected history. The references go back to
`#043`, long before this was noticed, spanning commits behind already-tagged
releases — a rebase deep enough to fix all of them would force-push over
published tags. The stray timeline mentions are cosmetic and land on closed
issues; left alone rather than traded for that.

---

## `getComputedStyle()` can report a stale value for an attribute selector, in one engine, for no visible reason

The Motion reference demo (#138) plays a token by adding `data-ref-motion-run`
to a dot, which a CSS rule matches to set its end position:

```css
.ref-motion-dot[data-ref-motion-run] {
  inset-inline-start: calc(100% - 1.375rem - 0.1875rem);
}
```

Passed in every local browser, every time. Failed on CI's Linux WebKit
specifically, deterministically, on the same row, across three separate fix
attempts that each targeted a different plausible cause — a `requestAnimationFrame`
chain that CI's headless tab might throttle, a fixed wait too short for a
resource-constrained single-worker run, then `expect.poll` instead of a fixed
wait at all. None of them changed the outcome, because none of them were the
actual problem, and each round cost a real CI run (~8–10 minutes) to learn that.

What ended it was refusing a fourth guess and adding a diagnostics dump to the
failing assertion itself instead — the row's inline style, the dot's own
inline style, `getComputedStyle(dot).transitionDuration`, `.insetInlineStart`,
and the geometry, all folded into the failure message so the answer would
appear directly in the CI log rather than needing another trace download.
The answer: `--ref-motion-duration` had resolved to exactly the right value
(`0.14s`, matching the token), `dot.hasAttribute('data-ref-motion-run')` was
`true` — and `getComputedStyle(dot).insetInlineStart` still reported the REST
value, never the `[data-ref-motion-run]` rule's. The attribute existed. Every
custom property fed by it was correct. The one thing that depended on an
*attribute selector specifically* matching was the only thing wrong, and nothing
in the DOM said so — `hasAttribute` and the CSSOM computed value simply
disagreed with each other, in one engine, on one build.

**Do:** when a CSS rule and everything upstream of it check out correct in
isolation, and the failure is confined to one CI-only browser build with no
local reproduction (checked here with `--workers=1` too, to rule out
parallelism), suspect the *mechanism*, not the logic. Attribute-selector-driven
style changes route through a different invalidation path than an inline style
write. Switching this demo to set `dot.style.insetInlineStart` directly —
computed from live rail/dot geometry, not a duplicated constant — sidesteps
whatever the actual invalidation bug is, rather than finding and reporting it
upstream to WebKit.

**Do:** dump real state into the failure message before trying a fourth fix.
Three attempts each replaced a plausible-sounding mechanism with another
plausible-sounding mechanism, on reasoning that was individually sound and
collectively no closer to the actual answer. One `evaluate()` call, read once,
answered it.
