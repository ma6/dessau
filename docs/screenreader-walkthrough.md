# Screen-reader walkthrough

Everything in Dessau is reasoned against WCAG 2.2 AA and the mechanical parts are
gated — contrast, roles, labels, focus order, announcement presence. None of it
has been **heard**.

That gap is not closable by more static checking, and it is not a small one.
Reasoning catches the wrong attribute. It does not catch an announcement that is
technically correct and useless in context: a button that announces "button", a
close control that announces "times", a live region that repeats itself, a
heading level that makes the outline nonsense. Every one of those passes every
check in this repository.

This is the script for closing it. It is written to be worked through by a person
with a screen reader, in one sitting per pattern, without needing to know how any
of it is implemented.

**Issue:** #4. Findings go into `LESSONS_LEARNED.md` — that is the durable part,
and it outlasts the fix.

---

## Before starting

```bash
python3 -m http.server 8000 --bind 127.0.0.1
# http://localhost:8000/reference/
```

Two combinations, because they disagree and the disagreements are the point:

| Screen reader | Browser | Platform |
| --- | --- | --- |
| VoiceOver | Safari | macOS, and iOS for the touch pass |
| NVDA | Firefox | Windows |

The reference pages are `lang="en"` with German demo content tagged `lang="de"`,
so both voices will be exercised. That is deliberate: a wrong `lang` is most
audible exactly at the switch.

### The three questions

For every announcement, in this order. Most defects fail the second, and the
second is the one no check can ask.

1. **Was anything said?** Silence where something changed is the worst outcome.
2. **Was it useful?** "Button", "times", "clickable" and a bare number are all
   technically announcements and none of them tells the user what happened.
3. **Was it said once?** A live region that repeats on every keystroke is worse
   than one that says nothing — the user cannot get past it to the content.

### How to record a finding

One line each, in a scratch file, in this shape:

```
[pattern] [SR + browser] what you did → what you heard → what you expected
```

Do not fix anything while walking. The walk is worth more uninterrupted, and a
finding written down at the time is a finding described accurately.

---

## 1. Address search — `reference/patterns.html`

The highest-value pattern to hear, because all four of its states are things a
sighted user reads and a screen-reader user is told.

- [ ] Tab to the address search field. Its purpose is announced before you type,
      not after.
- [ ] Type two characters. **Below the minimum**: you are told to keep typing,
      not left in silence wondering whether it is broken.
- [ ] Type `Talwiesen`. **Results**: the count is announced, and it says how to
      reach them — arrow keys, Enter. A bare "5 suggestions" is a finding.
- [ ] Arrow down through the list. Each option is announced as you reach it, and
      the field keeps focus. If your review cursor jumped into the list, that is
      a finding.
- [ ] Press Enter. The confirmation names the address that was filled in, and
      says the fields can still be edited.
- [ ] Tab through the filled fields. Each one announces its own label and its
      value. **The values arrived without you typing them** — if nothing said so,
      note it.
- [ ] Type `zzzzzz`. **No results**: you are told there is no match *and* that
      you can type the address yourself.
- [ ] The error state needs the network stopped, or the mock provider set to
      fail. If that is awkward to reach, say so and skip it rather than guessing.

## 2. Form validation — `reference/patterns.html#validation`

- [ ] Submit the form empty. Focus lands on the summary and the summary is read.
- [ ] The count is right, and it is a sentence — not "2".
- [ ] Move through the summary's links. Each names the field it goes to in words
      the user will recognise from the label, not the `name` attribute.
- [ ] Follow one. Focus lands **in** the field, not near it.
- [ ] The field announces: its label, that it is invalid, and the reason. All
      three, in that order, without you moving.
- [ ] Fix it. The error stops being announced the moment the value is valid —
      not on the next submit.
- [ ] The radio group gets **one** error, not one per option. This is regression-
      tested, but hear it: the test asserts the count, not the experience.
- [ ] The word "Error" is read before the message. It is there for anybody who
      gets neither the colour nor the icon.

## 3. Combobox — `reference/patterns.html#combobox`

- [ ] Focus the field. It announces as a combobox, collapsed.
- [ ] Type `B`. The result count is announced once, after the pause — not on
      every keystroke.
- [ ] Arrow down. The active option is announced. **Focus stays in the field**:
      you should still be able to type.
- [ ] Escape. The list closes and that is announced or otherwise obvious.
- [ ] Type `kakaka`. "No matches" is announced, not silence.
- [ ] Clear the field with the clear button. Something is said.
- [ ] With a long result set, the truncation message says both numbers and what
      to do about it.

## 4. Wizard — `reference/patterns.html#wizard`

- [ ] Press Continue with the fields empty. The problem count is announced
      assertively, and focus is in the first invalid field with its reason.
- [ ] Fill both, Continue. The step change is announced with the position and the
      step's name — "Step 2 of 3: Preferences", not "Step 2 of 3".
- [ ] Focus is on the new step's heading. Read on from there: the step's content
      follows in a sensible order.
- [ ] The step indicator announces each step's state in words — completed,
      current, not started. Not by colour, and not by position alone.
- [ ] Go Back. Nothing you typed is lost, and it is announced as a step change
      rather than as a new page.

## 5. Derived output — `reference/patterns.html`

- [ ] Change the input the value derives from. The new value is announced.
- [ ] It is announced **once**, not on every keystroke.
- [ ] The announcement says what the value *is*, not just the number.

## 6. Toast and copy — `reference/components.html`

- [ ] Press a copy button. "Copied to clipboard" is announced.
- [ ] The toast's dismiss button announces a purpose, not "button".
- [ ] A toast appearing does not interrupt what you were reading, unless it is an
      error — an error should.

## 7. Upload — `reference/components.html`

This demo is `lang="de"`. Both the content and DDS's own strings should come out
in a German voice.

- [ ] Choose one file. "1 Datei ausgewählt", in German, in a German voice. A
      German sentence in an English voice is a finding and an important one.
- [ ] Choose two. The plural is right.
- [ ] Each file's remove button names **which** file. Five identical "Entfernen"
      buttons is a finding.
- [ ] Remove one. The removal is announced and names the file.
- [ ] Add a file that is too large. The rejection is announced and says why.

## 8. Content navigation and site header — `reference/navigation.html`

- [ ] Narrow the width switcher below 64rem. Open the content navigation. The
      panel announces what it is before reading the list.
- [ ] Try to reach the page content behind it. You should not be able to — not
      with Tab and not with the review cursor. Content you can still read behind
      a modal panel is a finding.
- [ ] Escape. Focus is back on the button that opened it, and you can tell.
- [ ] Follow a link in the panel. Focus does not fight the navigation.
- [ ] In the site header, the current page is announced as current.

## 9. The pages themselves

Cheap, and it catches the things nobody thinks to check.

- [ ] Pull up the heading list. Does it read as an outline of the page, or as a
      list of fragments? A level that skips, or a heading used for size, shows up
      here immediately.
- [ ] Pull up the landmark list. One main, named regions, nothing anonymous.
- [ ] Pull up the link list. Are the links meaningful out of context? "Here",
      "read more" and three identical "Documentation" links are all findings.
- [ ] Tab from the top of the page. The skip link is first, and it works.
- [ ] The theme toggle announces its state, not just its name.

---

## After the walk

1. Everything on the list is either ticked or has a finding written against it. A
   line with neither means it was not tried, and should say so.
2. Findings that are defects: fix them, and add a `LESSONS_LEARNED.md` entry for
   any that would have been caught by a rule that does not exist yet.
3. Findings that are not defects — a screen reader being verbose, a platform
   difference nobody can act on — go in `DECISIONS.md` if they constrain anything
   later, and are dropped otherwise.
4. Close #4 with the list and what came of it. **Not before**: the issue's claim
   is that none of this has been heard, and that stays true until it has.
