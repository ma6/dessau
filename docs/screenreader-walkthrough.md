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

This is the script for closing it. It is written to be worked through in one
sitting per pattern, without needing to know how any of it is implemented.

**Issue:** #4. Findings go into `LESSONS_LEARNED.md` — that is the durable part,
and it outlasts the fix.

## Who is walking, and what that decides

Two different people can work through this document and they do not get the same
answer out of it. Which one you are changes what a clean run means, so decide it
before starting rather than at the end.

**A screen reader user** can answer everything below, including the question the
whole exercise is about.

**Somebody who can see the screen, switching VoiceOver on to listen** can answer
less than it feels like at the time. That is not a lack of care. You know what you
just clicked, so an announcement that arrives too late still makes sense; you know
what the control is, so a thin name sounds adequate; you have no reference for how
much talking is too much, so verbosity sounds like thoroughness. What you can hear
is **silence**, **repetition**, and **a voice that is wrong for the words** —
which is a real and useful reach, and one such defect (#44) is what the first pass
actually found.

If you are the second, the walk is worth doing and the result is *"nothing
obviously broken"*. It is not *"this is good"*, and the difference matters when it
gets written into an issue. Say which one you were, in the finding notes.

---

## Before starting

```bash
python3 -m http.server 8000 --bind 127.0.0.1
# http://localhost:8000/reference/
```

One combination:

| Screen reader | Browser | Platform |
| --- | --- | --- |
| VoiceOver | Safari | macOS, and iOS for the touch pass |

NVDA + Firefox on Windows is out of scope for #4. It is the pairing that would
disagree with VoiceOver, and the disagreements are worth having — but a second
reader is a comparison, and this walk is about the first one. Nothing here has
been heard at all, and one reader closes that.

The reference pages are `lang="en"` with German demo content tagged `lang="de"`,
so both voices will be exercised. That is deliberate: a wrong `lang` is most
audible exactly at the switch.

### The three questions

For every announcement, in this order. Most defects fail the second, and the
second is the one no check can ask — and, as it turns out, the one a sighted
listener cannot reliably ask either.

1. **Was anything said?** Silence where something changed is the worst outcome.
   *Anyone can answer this.*
2. **Was it useful?** "Button", "times", "clickable" and a bare number are all
   technically announcements and none of them tells the user what happened.
   *Partly answerable by anyone — a control that names no purpose is audible. The
   rest of it, whether the announcement is useful at that moment in that flow,
   needs somebody who works this way. Leave it unticked rather than guessing.*
3. **Was it said once?** A live region that repeats on every keystroke is worse
   than one that says nothing — the user cannot get past it to the content.
   *Anyone can answer this.*

A fourth, which is not in the original three because nobody expected it and it is
the one the first pass found: **was it said in the right voice?** German text read
by an English voice is unmistakable even to someone who has never used a screen
reader, and it is completely silent to everybody looking at the screen. Listen for
it at every `lang="de"` boundary.

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

This section is the one part of the walk a sighted listener can complete on equal
terms, because the rotor lists are *read*, not heard. An outline is either an
outline or it is not, and that judgement does not depend on using a screen reader
daily. If time runs out, this section and §7 are the two to have done.

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
3. Findings that are not defects — a platform difference nobody can act on — go in
   `DECISIONS.md` if they constrain anything later, and are dropped otherwise.
   **"The screen reader was verbose" is not one of these unless a screen reader
   user said so.** From anybody else it is an observation with no conclusion
   attached, and writing it off is the one mistake this document can cause.
4. Say who walked it. A clean run by a sighted listener is *"nothing obviously
   broken"*, and it will be read as *"verified"* by everyone downstream unless the
   sentence says otherwise.
5. Close #4 with the list and what came of it. **Not before**: the issue's claim
   is that none of this has been heard, and that stays true until it has.

Worth being plain about what remains after even a perfect run of this document. It
establishes that the announcements exist, are not duplicated, and are in the right
language. It does not establish that the reference is usable with a screen reader.
That question is answered by one person using it for half an hour, and there is no
document, check or second platform that substitutes for that.
