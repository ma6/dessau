# Typography

The decision, the alternatives that were considered, and how to self-host.

---

## What was required

Three roles, from freely redistributable families — OFL preferred:

- **Display** — headings and page openers.
- **Body / UI** — running text, and every label, field and button.
- **Monospace** — values a person transcribes or compares character by character.

Assessed on: readability, accessibility, suitability for interface work,
character, language coverage, available weights, variable-font support, and web
performance.

Dessau does not inherit its typography: one of its faces was
commercially licensed and not redistributable, and reusing the other would have
tied Dessau's identity to something it is meant to be independent of.

---

## The three candidates

### A — Grotesk Contemporary · **chosen**

**Space Grotesk** (display) · **Inter** (body/UI) · **JetBrains Mono** (mono)
All OFL 1.1. All variable.

| | |
| --- | --- |
| Readability | Inter is drawn for screen UI at small sizes: tall x-height, open apertures, unambiguous `Il1`, `O0`. Best in class for dense forms. |
| Accessibility | Inter distinguishes the characters most often confused; slashed zero and straight-legged `l` available as features. |
| UI suitability | Tabular figures, case-sensitive punctuation, contextual alternates, and a large set of interface-specific features. |
| Character | Inter is neutral to the point of anonymity; Space Grotesk supplies the personality in headings — geometric with deliberate quirks. |
| Language coverage | Inter: Latin extended, Greek, Cyrillic, Vietnamese. Space Grotesk: Latin extended. |
| Weights | Inter and JetBrains Mono variable 100–900; Space Grotesk 300–700. |
| Performance | All three variable, so one file per family covers every weight. |

**Against it:** Inter is extremely common, so it contributes little distinctiveness
on its own. Space Grotesk's Latin-only coverage limits the display face if the
product ever needs Greek or Cyrillic headings.

### B — Humanist Editorial

**Fraunces** (display) · **Source Sans 3** (body/UI) · **Source Code Pro** (mono)
All OFL 1.1. All variable.

Fraunces is a genuinely interesting variable face — optical size, plus `SOFT` and
`WONK` axes — and gives a warm, editorial voice. Source Sans 3 is a well-tested
humanist sans with very wide coverage including Cyrillic and Greek.

**Against it:** Fraunces' character is strong enough to date, and its personality
competes with content rather than framing it. Source Sans 3 has a smaller
x-height than Inter and slightly less clear character differentiation at 13–14px,
which is where most interface text actually lives. For a foundation intended to
outlive its first products, the editorial voice is a liability rather than an
asset.

### C — Systems Neutral

**Archivo** (display) · **Public Sans** (body/UI) · **DM Mono** (mono)
All OFL 1.1. Archivo and Public Sans variable; DM Mono is not.

Public Sans is drawn explicitly for accessible government interface work — a
strong provenance — and is less ubiquitous than Inter. Archivo brings a width axis
useful for compact headings.

**Against it:** Public Sans has fewer interface-oriented OpenType features than
Inter, notably around numerals, which matters directly for the data-heavy
interfaces Dessau targets. DM Mono not being variable means three separate files
for the monospace role.

---

## The decision: A

Chosen because **the body face is the one that matters**.

Display type appears a few times per page. The body/UI face renders every label,
every field, every table cell, every error message — for hours. Inter's specific
strengths, tabular figures and unambiguous character shapes, are exactly the
properties a form-heavy, data-heavy foundation needs, and its ubiquity is
irrelevant to the person reading a table.

Space Grotesk then supplies headline character without competing with content: it
is geometric and systematic rather than expressive, which suits a system whose
stated influence is clarity and reduction. JetBrains Mono is the strongest of the
three monospaces for reading a reference code aloud, which is the actual job.

---

## The reference site self-hosts; DDS does not ship binaries

Worth stating clearly, because the two facts sit side by side in this repository:

- **`dds/` contains no font files.** A product that consumes Dessau carries no font
  weight and no licence obligation it did not ask for.
- **`reference/` self-hosts all three faces.** The reference site is a product that
  consumes Dessau and wants the full typographic identity, so it does what this
  document recommends — and therefore serves as the worked example of the recipe
  below. See `reference/assets/fonts.css`, which is commented for that purpose.

If the reference site used the fallback stack instead, the typography page could
not show the typography, and the self-hosting recipe would be advice nobody had
tested.

## Why DDS ships no font binaries

```css
--dds-font-display: "Space Grotesk", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
--dds-font-body: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
--dds-font-mono: "JetBrains Mono", ui-monospace, "SF Mono", "Cascadia Mono", "Roboto Mono", Menlo, Consolas, monospace;
```

The named family is used when the reader already has it; otherwise the stack falls
through to the platform's own UI font, which is a good typeface on every current
platform.

**Why not ship them:** OFL permits redistribution, so this is a choice rather than
a restriction.

- A foundation should be byte-light. Products have very different delivery
  constraints, and the one that has a font pipeline already should not inherit a
  second one.
- **Every self-hosted font is a licence obligation that travels.** Not shipping
  them keeps the compliance surface at zero for anyone who does not need them.
- The fallback genuinely renders well. `system-ui` before the named fallbacks is
  deliberate: it resolves to the platform UI face, which is what the reader's own
  operating system already optimises for.
- There is no layout shift, no `font-display` decision, no flash of unstyled text
  and no third-party request — by construction rather than by tuning.

**What the foundation actually contributes** is the typographic *system*: the
scale, the weights, the line heights, the reading measure, the numeral handling,
`text-wrap: balance` and `pretty`, and the rule that a form control never goes
below 16px. That system is the durable part; the choice of face is the swappable
part.

---

## Self-hosting, when a product wants the full identity

Recommended, and straightforward. Never a third-party CDN — it leaks the reader's
IP address to another party and adds a connection on the critical path.

1. **Get the files.** Each family's own repository, the Google Fonts source
   repository (`github.com/google/fonts/ofl/<family>`), or
   `google-webfonts-helper`. Take the **variable** file where available: one file
   covers every weight.

   **Convert to WOFF2.** The Google Fonts repository publishes TTF, which is
   roughly 60% larger. `woff2_compress`, or `fonttools` with the `woff2` extra,
   does it in one command. The reference site here ships TTF and says so, because
   converting needs tooling Dessau deliberately does not depend on — a product with
   any build step at all should not copy that compromise.

2. **Subset them.** Latin plus Latin Extended-A and -B covers every
   Latin-script language in Europe — German, French, Turkish, Polish, Czech,
   Hungarian, Romanian with comma-below, Croatian, the Baltic languages,
   Icelandic, Maltese, Estonian. Do **not** trim below that even for a
   German-only product: it costs almost nothing to keep and means another
   language later needs no font rebuild.

3. **Declare them**, in a stylesheet loaded before `dds.css`:

   ```css
   @font-face {
     font-family: "Inter";
     src: url("/fonts/Inter-Variable-latin-ext.woff2") format("woff2-variations");
     /* The whole range, because it is one variable file. */
     font-weight: 100 900;
     font-style: normal;
     /* Render immediately in the fallback, swap when ready. Never `block`:
        invisible text is worse than briefly different text. */
     font-display: swap;
     unicode-range: U+0000-00FF, U+0100-024F, U+2000-206F, U+20A0-20BF;
   }
   ```

4. **Preload only the body face.** It renders first and everywhere; preloading all
   three competes for bandwidth with the content.

   ```html
   <link rel="preload" href="/fonts/Inter-Variable-latin-ext.woff2"
         as="font" type="font/woff2" crossorigin>
   ```

5. **Keep the fallback stack.** The tokens already list it; do not reduce them to a
   single family. A failed font request should degrade, not blank the page.

6. **Include the licence.** OFL requires the notice to travel with the files. Put
   `OFL.txt` beside them in the same directory.

### Matching the fallback

The swap is less noticeable if the fallback is adjusted to the metrics of the real
face. `size-adjust`, `ascent-override` and `descent-override` on a fallback
`@font-face` largely remove the reflow:

```css
@font-face {
  font-family: "Inter Fallback";
  src: local("Helvetica Neue"), local("Arial");
  size-adjust: 107%;
  ascent-override: 90%;
  descent-override: 22%;
  line-gap-override: 0%;
}
```

Worth doing for a content-heavy product; unnecessary for an internal tool.

---

## Language notes

- **Set `lang` correctly** — on `<html>`, and on any passage in another language.
  It drives hyphenation, screen-reader pronunciation and, in Turkish, the correct
  `i`/`İ` casing.
- **Never `text-transform: uppercase` on Turkish text without `lang="tr"`** — `i`
  becomes `I` instead of `İ`, which is a different letter. Dessau does not use
  all-caps as a stylistic device anyway.
- **Greek and Cyrillic:** Inter and Source Sans 3 have them; Space Grotesk does
  not. A product needing non-Latin headings should pick a different display face
  and record the decision.

---

## Rules that come with the system

- **Never override the root font size.** It breaks the reader's own font-size
  setting, which is the most used accessibility feature on the web. All sizes are
  `rem`.
- **A form control is never below `--dds-font-size-md`** (16px). iOS Safari zooms
  the viewport when focusing a smaller control, which is disorienting and hard to
  recover from. This is why there is no `.dds-input-sm`.
- **Tabular figures for any column compared vertically** — `.dds-numeric`.
- **Monospace for anything transcribed** — `.dds-input-code`, `.dds-code`, with
  ligatures off so character pairs are not visually merged.
- **No all-caps as a stylistic device.** It costs legibility, defeats word-shape
  recognition, and is read letter by letter by some screen readers when the source
  text is genuinely capitalised.
- **`text-wrap: balance`** on headings, **`pretty`** on paragraphs. Both
  progressive; unsupported browsers simply wrap normally.

---

## Revisiting this

Reasons that would justify reopening the decision:

- A product needs Greek or Cyrillic **headings** (Space Grotesk cannot).
- A product's brand requires a specific face — then the display token changes and
  the body face very likely should not.
- Inter's ubiquity becomes an active problem for a product that must look
  distinctive — again, change the display face first.

In all three cases the change is a token value, not a rewrite. That is the point of
having the tokens.
