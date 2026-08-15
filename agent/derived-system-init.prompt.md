# Prompt: stand up a derived design system

> **This is an artefact to paste, not an instruction file.** Copy everything inside
> the fenced block into a coding agent working in an **empty repository** that is
> going to become a design system of its own.
>
> **This is the derived-system case.** If what is being built is a *product* — pages
> and flows, consuming Dessau or a derived system — the other one is
> [`consumer-init.prompt.md`](consumer-init.prompt.md).

It routes to `recipes/derive-a-standalone-system.md` rather than repeating it. A
prompt that restates a recipe is a second copy that drifts; one that routes
inherits the recipe's uncertainty without adding to it.

**Three things carry the weight, and all three fail quietly.**

*The agent must ask the six decisions, not answer them.* Everything about a
client's identity belongs to the client. An agent that answers has not produced a
neutral starting point — it has produced Dessau's taste with somebody else's name
on it.

*Substitution, not overriding.* An agent that reaches for the override model builds
something that works only while Dessau is present, which is the one thing a client
deliverable may not do. Nothing about the result looks wrong until it is handed
over.

*The gates must be proven, not repointed.* `check-contrast.mjs` and
`check-accent-separation.mjs` read `dds/css/*` by hardcoded path. Left alone they
measure Dessau's palette and report success. So the prompt asks for each one to be
broken on purpose and seen to fail.

**Not executed.** Nobody has pasted this into an agent, and no derived system
exists. Its paths are gated by `scripts/check-adoption.mjs`; that they exist is not
the same claim as that an agent given this produces a working system. Tracked with
the recipe's own gap as #72.

---

```text
This repository is going to become a design system built on Dessau. It must work
WITHOUT Dessau: what it ships to its consumers carries no dependency on it.

1. Add Dessau as a submodule:
   git submodule add https://github.com/ma6/dessau.git libs/dessau

   Never edit anything inside libs/dessau. It is a pinned dependency.

2. Read, in this order, and treat them as authoritative:
   - libs/dessau/AGENTS.md
   - libs/dessau/agent/index.json
   - libs/dessau/agent/recipes/derive-a-design-system.md
   - libs/dessau/agent/recipes/derive-a-standalone-system.md

3. Work through derive-a-design-system.md FIRST. Six decisions: colour, type,
   roundness, density, depth, motion.

   ASK ME each one. Do not answer them yourself and do not take a default
   silently. This system carries somebody's identity and none of it is yours to
   choose. Tell me what Dessau's default is and what changing it costs, then
   wait.

   Write my answers into this repository's DECISIONS.md: the decision, why, what
   it cost, and what would have to be true for it to be wrong. Say explicitly
   which of the six I took the default for.

4. Then follow derive-a-standalone-system.md.

   The mechanism is SUBSTITUTION, not overriding, and this is the part to get
   right. libs/dessau/dds/dds.css is a @layer declaration and twelve @import
   statements; the first two are the foundation. This repository supplies its own
   primitives.css and semantic.css and inherits the other ten.

   Do NOT load Dessau's stylesheet and put ours on top. That produces two values
   for every token we touch and a system that only works while Dessau is present
   — which is exactly what we are not shipping.

   Copy Dessau's semantic.css wholesale, comments included, and change only the
   lines I gave you a reason to change. It is the mapping from roles to ramps and
   that reasoning is what we are inheriting.

5. Repoint the verification scripts at OUR files, and prove each one still works:
   break a value on purpose, see it reported, put it back. A check that cannot
   fail is worse than none, because it is trusted. Report to me which checks you
   repointed and what each one said when you broke it.

6. This is a design system, so it owes what one owes: our own agent/index.json,
   our own AGENTS.md, our own reference rendering every component we ship.

DO NOT build components. Dessau's already exist and we are inheriting them —
your job here is the foundation, the wiring and the gates. If something seems
missing, tell me rather than adding it.

Stop and show me the built stylesheet and the check output before going further.
```

---

## What it deliberately leaves out

- **A shell, a sprite, a locale call.** Those belong to a product, and a design
  system is not one. Its consumers do that.
- **Any component work.** An agent handed "set up a design system" will invent
  components unless told not to, and Dessau's already exist.
- **A finish line.** It stops at the foundation, the wiring and the gates, and asks
  to be checked. What comes after is the reference and the consumer-facing context,
  which need decisions this prompt has not collected.

## When it needs changing

When a path in it moves, or when `derive-a-standalone-system.md` gains a step
happening *before* the agent would otherwise reach it. Not when that recipe gains
detail — the detail is the recipe's to hold, and duplicating it here is what this
file exists to avoid.
