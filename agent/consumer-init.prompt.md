# Prompt: initialise a product with Dessau

> **This is an artefact to paste, not an instruction file.** Copy everything inside
> the fenced block below into a coding agent, working in an **empty product
> repository**. It is the sibling of
> [`consumer-AGENTS.template.md`](consumer-AGENTS.template.md): that one is copied
> into the product as a file, this one is pasted into the agent as a message.
>
> **This is the product case, which is the second of two.** If what is being stood
> up is a *derived design system* — one that ships to a client and works without
> Dessau — this prompt is the wrong one: it sets up an override on top of a
> submodule, and a derived system substitutes the foundation instead. Use
> [`derived-system-init.prompt.md`](derived-system-init.prompt.md).
>
> **This covers consuming Dessau directly. A product consuming a *derived* design
> system is still this case** — `recipes/new-product.md` and
> `recipes/derive-a-standalone-system.md` both say so — but the block below is
> written Dessau-default. If the derived system already exists and has produced
> its own version of this prompt (`derive-a-standalone-system.md` step 5 asks it
> to), paste that one instead. If it has not, substitute before pasting: every
> `libs/dessau` becomes `libs/<the derived system's own name>`, and the submodule
> URL in step 1 becomes that system's repository. Nothing else in the block
> changes shape — the recipe underneath is the same one either way.

It points at the recipes rather than repeating them. A prompt that restates a
recipe is a second copy that drifts, and a drifted prompt is worse than none — it
looks authoritative while sending an agent somewhere the recipe no longer goes.

**The load-bearing instruction is step 3: the agent must ask, not answer.** The six
design decisions belong to the product. An agent that answers them has not chosen
neutrality; it has chosen Dessau's taste and presented it as a decision somebody
made, which is precisely what `recipes/derive-a-design-system.md` exists to
prevent. Roundness in particular is close to unchangeable by the time there are
forty components using it.

**Not executed.** Nobody has pasted this into an agent against a real product. Its
paths are gated — `scripts/check-adoption.mjs` reads this file's bare
`libs/dessau/…` paths, which it had to be taught to do, because a paste block has
no backticks and the backticked pattern could not see them. But that verifies the
paths exist, not that an agent given this produces a correct product. Tracked with
the template's own gap as #55.

---

```text
This product uses Dessau as its design system.

1. Add it as a submodule at libs/dessau:
   git submodule add https://github.com/ma6/dessau.git libs/dessau

2. Read, in this order, and treat them as authoritative over anything you
   already believe about design systems:
   - libs/dessau/AGENTS.md
   - libs/dessau/agent/index.json
   - libs/dessau/agent/recipes/derive-a-design-system.md
   - libs/dessau/agent/recipes/new-product.md

3. Work through derive-a-design-system.md FIRST. It is six decisions: colour,
   type, roundness, density, depth, motion.

   ASK ME each one. Do not answer them yourself and do not take the defaults
   silently. They are decisions about this product, not facts you can look up —
   and roundness in particular is close to unchangeable once there are forty
   components. Tell me what the default is and what it would cost to change it,
   then wait.

   Write my answers into this repository's DECISIONS.md: the decision, why, what
   it cost, and what would have to be true for it to be wrong. Say explicitly
   which of the six I took the default for.

4. Then follow new-product.md end to end.

5. Copy libs/dessau/agent/consumer-AGENTS.template.md into this repository as
   AGENTS.md, fill in every [PLACEHOLDER], and point CLAUDE.md at it — one
   instruction set, never two divergent copies.

Two things you will not discover on your own, and both fail silently:

- The pages must be SERVED, not opened as file://. The paths are absolute
  (/libs/dessau/…), so a file:// origin resolves them against the disk root and
  loads no stylesheet, no script, and reports no error.
  python3 -m http.server 8000 --bind 127.0.0.1

- The icon sprite must be INLINED into each document:
  node libs/dessau/scripts/sync-icons.mjs --dir=.
  An external <use href="icons.svg#…"> breaks currentColor silently — the icon
  renders, in black, in both themes.

There is a rendered reference. Serve the project and open it when you are unsure
how a component should behave or what markup it expects:

  python3 -m http.server 8000 --bind 127.0.0.1
  http://localhost:8000/libs/dessau/reference/

It works from the project root because those pages reach into DDS only by relative
path. Prefer looking at it over guessing, and copy its markup including the ARIA.

Before you tell me it is done:
  node libs/dessau/scripts/sync-icons.mjs --dir=. --check
  and walk libs/dessau/agent/definition-of-done.md.

Build nothing that agent/index.json already lists. If something is close but not
right, say so and ask — a second button style is a defect, not a variant.
```

---

## What it deliberately does not do

- **It does not decide anything.** Every choice it reaches routes back to a
  question for the person, or to a recipe.
- **It does not restate a rule.** Two exceptions, both because an agent cannot
  discover them and both fail with no error: pages must be served rather than
  opened, and the sprite must be inlined.
- **It is not per vendor.** One prompt, in the repository's neutral vocabulary —
  the same reason `AGENTS.md` is canonical and `CLAUDE.md` is thin.

## When it needs changing

When a path in it moves, or when `new-product.md` or `derive-a-design-system.md`
gain a step that happens *before* the agent would otherwise reach it. Not when
those recipes gain detail — the detail is theirs to hold, and duplicating it here
is what this file is written to avoid.
