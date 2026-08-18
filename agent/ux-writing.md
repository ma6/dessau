# UX writing

Interface text is part of the interface, not a layer applied afterwards. A
correctly built form with badly worded errors is a badly built form.

**German is the default locale. English is the fully supported alternative.**
Both are specified here; where only one example is given, the rule is
language-independent.

Formatting is produced by `DDS.format` (`dds/js/format.js`) over `Intl`, with
`de-DE` as the default. Never format a number, date or amount by hand.

---

## The three levels

Text decisions live at one of three levels. Knowing which one you are at prevents
the most common mistake: putting a product-specific decision into the shared
standard, or re-deciding a shared rule per product.

| Level | Scope | Decided | Lives in |
| --- | --- | --- | --- |
| **1 — System** | Every product | Once, in Dessau | This file |
| **2 — Writing fundamentals** | Every product | Once, in Dessau | This file |
| **3 — Product voice** | One product | Per product | The product's own guide |

**Level 1 — System.** Terminology for system concepts, the wording of shared
components, formats, accessibility rules. Not negotiable per product.

**Level 2 — Writing fundamentals.** Principles, gender-fair language, sentence
construction, number and date formats, text accessibility. Binding across
products; a product may add to it but not contradict it.

**Level 3 — Product voice.** Form of address, tone, domain vocabulary, how much
personality. Genuinely differs: a tool used forty times a day by a colleague
should not read like a first-time public form.

### What belongs at level 3, and nowhere else

- **Form of address.** German distinguishes *Sie* and *Du*; English distinguishes
  register rather than pronoun. The choice is a product decision — but it is
  **one** decision per product and never mixed within an interface.
  - Public and customer-facing products: German **Sie**; English formal-neutral
    ("Enter your email address").
  - Internal tools for colleagues: German **Du** is common and reads as
    collegial; English stays the same but gets terser.
- **Domain vocabulary.** The nouns of the product's subject matter.
- **How much warmth.** A confirmation may be friendly in one product and purely
  factual in another.

Everything else is level 1 or 2 and is settled below.

---

## Principles

1. **Clear over clever.** One idea per sentence. Active voice. Concrete terms.
2. **Only as much text as the decision needs.** Every extra sentence is a sentence
   between the reader and what they came to do.
3. **One concept, one term.** Never a synonym for variety. If it is called a
   "project" once, it is a project everywhere — never a "workspace" in the next
   sentence.
4. **Describe what the reader does or experiences,** not what the system does.
   "Your changes are saved", not "The system has persisted the changes".
5. **Calm and factual.** No alarm language, no exclamation marks, no judgement of
   the reader. Nothing "unfortunately" happened, and nobody "failed" to do
   anything.
6. **Say what to do next.** Particularly in errors and empty states. A message
   that only reports a state is half a message.
7. **No sentence-case shouting.** Never all-caps as a stylistic device. It costs
   legibility, defeats word-shape recognition, and some screen readers read
   genuinely capitalised text letter by letter.

---

## Gender-fair language

Binding at level 2, in both languages.

**German.** Prefer genuinely neutral formulations over any marker:

| Prefer | Instead of |
| --- | --- |
| Nutzende, Bearbeitende, Mitarbeitende | Benutzer, Bearbeiter, Mitarbeiter |
| das Team, die Person, alle | jeder Mitarbeiter |
| Wer ein Projekt anlegt, … | Der Nutzer, der ein Projekt anlegt, … |

- No generic masculine.
- Where a neutral term is genuinely unavailable, a gender star (`Nutzer*innen`) is
  acceptable as a **second** choice. It is a fallback, not the default: screen
  readers handle it inconsistently.
- Often the simplest fix is to address the reader directly, which removes the
  problem entirely: "Dein Projekt" rather than "das Projekt des Nutzers".

**English.** Singular *they* for a person of unstated gender. Never *he/she* and
never *he* as a generic. Address the reader as *you* wherever possible.

---

## Numbers, dates and units

German is the default. Produced by `DDS.format`; never assembled by hand.

| Thing | German (default) | English | `DDS.format` |
| --- | --- | --- | --- |
| Decimal separator | comma — `1234,56` | point — `1,234.56` | `number()` |
| Thousands separator | point — `1.234` | comma — `1,234` | `number()` |
| Amount | `1.234,56 €` | `€1,234.56` | `currency()` |
| Percentage | `19,5 %` (with space) | `19.5%` (no space) | `percent()` — takes a **ratio** |
| Short date | `01.08.2026` | `01/08/2026` | `date()` |
| Long date | `1. August 2026` | `1 August 2026` | `dateLong()` |
| Time | `14:30 Uhr` | `14:30` | `time()` + " Uhr" in the copy |
| Relative | `vor 3 Tagen` | `3 days ago` | `relativeTime()` |
| File size | `1,4 MB` | `1.4 MB` | `fileSize()` |

**Notes that matter:**

- **24-hour time in both languages.** German appends " Uhr" in running text; that
  is a writing rule, not a formatting one, so it belongs in the copy.
- **A narrow no-break space between a number and its unit is deliberate.** Never
  "clean it up": a value that wraps between the number and its unit — `1.234,56`
  at the end of one line and `€` at the start of the next — is read as two
  separate things.
- **Never break a multi-part value across lines.** An account identifier, a phone
  number, an amount with its unit: use `.dds-nowrap`.
- **`percent()` takes a ratio** (`0.195`), not a percentage (`19.5`). This is the
  Intl convention and it avoids the bug where a value is divided by a hundred
  twice.
- **Tabular figures for any column a reader compares vertically** —
  `.dds-numeric`. Otherwise the columns do not align and comparison becomes
  manual work.
- **Parse with `DDS.format.parseNumber()`**, never `parseFloat`. `parseFloat`
  reads the German `1.234,56` as `1.234` — a silent, plausible, wrong answer.

---

## Per-element guidance

### Labels

- A noun or noun phrase, not a question. "Email address", not "What is your email
  address?"
- **Never a placeholder instead of a label.** It vanishes on input, fails
  contrast, and is announced inconsistently.
- Required stated in words: `(required)` / `(erforderlich)`. Not an asterisk, not
  colour.
- Mark the shorter set. If most fields are required, mark the optional ones
  instead.

### Buttons

- A verb naming the action: "Save changes", "Delete project", "Send request".
  German: "Änderungen speichern", "Projekt löschen".
- **Not** "OK", "Yes", "No", "Submit", "Confirm". A button labelled "Confirm"
  beside one labelled "Cancel" tells the reader nothing about what is about to
  happen.
- The label answers "what will happen if I press this?" — so a dialog's confirm
  button repeats the action, not the dialog's title.
- Destructive actions name the thing: "Delete project", not "Delete".

### Hints

- The rule or the format, **before** the reader gets it wrong. "Format: 7K4M-92QX".
- Never repeat the label. Never carry information that exists nowhere else and is
  essential.
- Present in both the valid and the error state — see errors below.

### Errors

The highest-value writing in any product. Structure:

> **What is wrong** — then **what to do about it**.

| Instead of | Write |
| --- | --- |
| "Invalid input" | "Enter an email address, for example name@example.org" |
| "Please match the requested format" | "Enter the reference code as four characters, a hyphen, then four more — for example 7K4M-92QX" |
| "Error 500" | "We could not save your changes. Your text is still in the form — try again in a moment." |
| "Field required" | "Enter your full name" |
| "Ungültige Eingabe" | "Gib eine E-Mail-Adresse ein, zum Beispiel name@example.org" |

Rules:

- **Never blame the reader.** No "you failed to", no "invalid", no "illegal".
- **Say whether their input survived.** "Your text is still in the form" removes
  the fear that retrying means retyping.
- **The hint stays.** The reader needs the format rule *and* the failure.
- **Distinguish "the service failed" from "there is no such thing."** One says try
  again, the other says check the spelling. Collapsing them leaves the reader
  guessing — this is the single most common failure in search and lookup.
- **Never reveal whether an account exists** in an authentication error.
- Summary wording at the top of a form must **match** the per-field wording. Two
  descriptions of one problem is one too many.

### Warnings

- State the consequence, not the severity. "Two collaborators will lose access"
  rather than "Warning: permissions change".
- Warnings before an action; errors after one.

### Success

- Confirm what happened, and where it now is. "Changes published. Anyone with the
  link can see them."
- Do not congratulate the reader for using the software.

### Empty states

Two genuinely different situations, and conflating them is a common mistake:

- **Nothing yet** — a new account, an unused feature. Explain what this is for and
  offer the first action. "A project holds documents, a budget and the people who
  can see it. Create one to get started."
- **Nothing found** — a query that matched nothing. Confirm what was searched and
  offer a way to broaden it. "No projects match 'kalvebod bridge 2019'. Try fewer
  words, or search by owner instead."

**Never a bare "No data" or "Keine Daten".**

### Loading

- Say what is happening, not that something is happening. "Searching addresses…"
  rather than "Loading…".
- Announce it in a live region. A spinner communicates nothing to a screen
  reader.
- Do not announce on every keystroke — debounce.

### Destructive actions

- Name the scope and the consequence: "This removes the project and its 47
  documents for everyone. It cannot be undone."
- **Never "Are you sure?"** It asks the reader to confirm a decision without
  giving them the information to make it. Say what is at stake instead.
- Say plainly whether it can be undone.
- The confirming button carries the verb; the cancelling one says what happens
  instead ("Keep project" reads better than "Cancel").

### Headings

- Describe the content, not the interface. "Your details", not "Form section 1".
- Sentence case. One `<h1>` per page, no skipped levels.

### Status and metadata

- Prefer relative time for recency ("vor 2 Stunden"), absolute for records
  ("1. August 2026, 14:30 Uhr").
- Give a status a word, always — never only a coloured dot.

---

## Accessibility in text

Level 2, binding.

- **Expand or explain a term of art** the first time it appears.
- **Write text that can be read aloud.** Avoid constructions that depend on
  layout ("see the box on the right"), and never rely on visual position alone.
- **Never abbreviate a name in an accessible label.** "IB" is not a name.
- **Link text says where it goes.** Never "click here", "here", or "read more" on
  its own — a screen-reader user listing the links on a page hears "read more" six
  times. "Read the setup guide" works out of context.
- **A link that opens in a new tab says so** in a visually hidden span.
- **Icon-only controls carry a name**; the icon itself is `aria-hidden`.
- **An accessible name must contain the visible label** (WCAG 2.5.3), so a
  speech-input user can say what they see.
- **Announce state changes** through a live region, politely unless the reader
  must know immediately.

---

## Example data

Demo, placeholder and test content is part of the product's quality.

- **Realistic, and invented.** Plausible names and addresses that do not identify a
  real person, household or building.
- **Never a cliché placeholder.** No "Max Mustermann", no "John Doe", no "Lorem
  ipsum". They signal unfinished work and they hide real layout problems.
- **Deliberately include diacritics and non-ASCII characters** — ø, ä, ç, ł, ș,
  ü, å, İ. These are what expose a broken charset, a bad sort, a truncating column
  or a font missing glyphs, and they only expose it if the example data contains
  them.
- **Vary the length.** A long street name and a long person name are what find
  truncation bugs.
- **Include the awkward-but-real case.** An address with no house number. A
  single-character surname. They exist, and a form that cannot accept them is
  broken for the people who have them.
- **Never real personal data**, in demos, tests, fixtures, screenshots or commit
  messages.
- **Never a placeholder domain that could become real.** Use the reserved
  `example.org` / `example.com` / `.example` for addresses that must not resolve.
- **A person's invented email reads as real when the domain is a real consumer
  provider** — gmail.com, gmx.net, outlook.com, web.de, orange.fr — with an
  invented local part. That is different from the previous rule: `example.org`
  is for an address with no person behind it — a syntax example in error copy
  (`name@example.org`), a mailto default, a link. A table of demo *users* all
  sharing `example.org` reads as staged data, the way a form full of "Max
  Mustermann" does.
- **No vocabulary from one industry.** Category labels, form fields, table rows and
  wizard steps stay in words any product recognises — a topic, a document, a
  department. Dessau is a foundation, and a specimen written in one sector's terms
  costs twice: it narrows what the reference appears to be for, and it is a trace
  of provenance in a repository whose whole point is not to carry one.
  `scripts/audit-whitelabel.mjs` enforces this, and its term list is local and
  git-ignored for the reason the script's header gives.

---

## Decision rule

When the right wording is not obvious:

1. What does the reader need to know **to do the next thing**?
2. Write that, in one sentence, in the plainest words available.
3. Remove everything that is not it.
4. Read it aloud. If it sounds like software talking about itself, rewrite it from
   the reader's side.
5. Check it against the level: is this a system rule, a fundamental, or this
   product's voice? Put it in the right place.
