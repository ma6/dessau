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

**All three are stated by the recipes step 3 already puts in front of the
agent** — `derive-a-design-system.md`'s own instruction to ask (#123),
`derive-a-standalone-system.md`'s step 0 (substitution) and step 5 (prove the
gates can fail) — so the fenced block below no longer restates them inline.
It did once; that stopped being anything but a second copy the moment the
recipes said it themselves, read before the agent would reach any of it.

**Executed once (#72).** Pasted into an agent working in an empty repository
(`caberpunky-ds`), which produced a working, dependency-free derived system —
confirmed by grep: zero `@import`/`url()` references to `libs/dessau` survive
in the built artefact. What that run found is recorded in
`derive-a-standalone-system.md` and `derive-a-design-system.md`'s own
retrospective sections, not repeated here — this prompt routes to those
recipes rather than restating them, and that held for the writeback too. Two
things specific to *this file*, not the recipes it routes to:

- **Step 7's confirm-before-writing instruction worked as intended.** The
  clone URL and `libs/<name>` directory name were proposed as candidates and
  confirmed before being written into the derived system's own
  `consumer-init.prompt.md`, rather than read off `git remote` and assumed.
- **The six-questions-one-at-a-time instruction in step 4's target recipe met
  a tool that caps question batches at four.** Answered with two batched
  calls (4 then 2) rather than six serial round-trips; six individually
  selected answers were still collected. `derive-a-design-system.md` now
  says this is not the violation "one at a time" guards against — deciding
  for the person being asked is.

---

```text
This repository is going to become a design system built on Dessau. It must work
WITHOUT Dessau: what it ships to its consumers carries no dependency on it.

1. Add Dessau as a submodule:
   git submodule add https://github.com/ma6/dessau.git libs/dessau

   Never edit anything inside libs/dessau. It is a pinned dependency.

2. Set up modern-web-guidance — two things, not one:

   a. Install the plugin, once per machine, if it is not already:
      /plugin marketplace add GoogleChrome/modern-web-guidance
      /plugin install modern-web-guidance@googlechrome
      /reload-plugins

   b. Copy skills-lock.json and .claude/settings.json from libs/dessau's
      own root, unedited. This scopes an already-installed plugin to this
      repository; it does not install one on its own.

   Substituting the foundation and writing a reference below is real CSS/JS
   work, not plumbing exempt from CLAUDE.md's mandate.

3. Read, in this order, and treat them as authoritative:
   - libs/dessau/AGENTS.md
   - libs/dessau/agent/index.json
   - libs/dessau/agent/recipes/derive-a-design-system.md
   - libs/dessau/agent/recipes/derive-a-standalone-system.md

4. Work through derive-a-design-system.md end to end — it already tells you
   to ask rather than answer, and where the answers go.

5. Then follow derive-a-standalone-system.md end to end.

6. Repoint the verification scripts and prove each one can still fail —
   derive-a-standalone-system.md step 5 says how, and why a check that
   cannot fail is worse than none. Report which checks you repointed and
   what each one said when you broke it.

7. This is a design system, so it owes what one owes (derive-a-standalone-
   system.md step 6): our own agent/index.json, AGENTS.md, reference, and
   our own version of libs/dessau/agent/consumer-init.prompt.md.

   Do not read this repository's future clone URL from `git remote` and
   treat it as settled. Propose it as a candidate if you want, but ASK ME
   to confirm both the URL and the `libs/<name>` directory name before
   writing them into that prompt — a repo can be local-only, forked, or
   moved before its first consumer exists.

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
