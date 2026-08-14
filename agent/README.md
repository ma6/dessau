# Dessau — Agentic Version

Structured context for coding agents. This directory is not documentation that
happens to be machine-readable; it is the agent-facing representation of Dessau,
and it is a core part of the system rather than tooling around it.

Start from [`../AGENTS.md`](../AGENTS.md). This file is the map of what is here.

---

## Why this exists

A design system that only publishes UI code for humans to browse gets used
wrongly by agents — and increasingly, agents are who is using it. Left to infer
the rules, an agent invents a second button style, writes raw hex values, guesses
at ARIA, and rebuilds a pattern that already exists three directories away. Every
one of those is expensive to find later and cheap to prevent now.

So the test applied to everything in this directory is:

> **What does an agent need in order to build a new product correctly with
> Dessau, without rediscovering its rules?**

If a file does not help answer that, it does not belong here. If a rule exists
only in someone's head or only in a CSS comment, it belongs here.

---

## What is here

| File | Answers |
| --- | --- |
| [`principles.md`](principles.md) | What is non-negotiable, and why |
| [`architecture.md`](architecture.md) | Where does this belong? Component or Pattern? |
| [`foundations.md`](foundations.md) | Which value do I use, and what does it mean |
| [`components.md`](components.md) | Does this component exist? What is its contract? |
| [`patterns.md`](patterns.md) | Does this pattern exist? What are its rules? |
| [`accessibility.md`](accessibility.md) | The WCAG 2.2 AA floor, by check frequency |
| [`ux-writing.md`](ux-writing.md) | How to word it — German default, English variant |
| [`responsive.md`](responsive.md) | Container queries, breakpoints, what to verify |
| [`conventions.md`](conventions.md) | Naming, CSS and JS conventions |
| [`definition-of-done.md`](definition-of-done.md) | When is it actually finished |
| [`modern-web-guidance.md`](modern-web-guidance.md) | How to use the guidance skill |
| [`index.json`](index.json) | Machine-readable inventory of everything |
| [`recipes/`](recipes/) | Step-by-step procedures for recurring jobs |
| [`consumer-AGENTS.template.md`](consumer-AGENTS.template.md) | Template for a product repository |

---

## Read in this order

**Before touching anything:** `principles.md`, then `architecture.md`.

**Before building anything:** query `index.json`. It is the fastest route to
"does this already exist?", and extending something that exists is always
correct where adding a near-duplicate is always wrong.

**While building:** `foundations.md` for values, `components.md` or
`patterns.md` for the contract, `conventions.md` for naming,
`accessibility.md` for the requirements, `ux-writing.md` for the words.

**Before claiming done:** `definition-of-done.md`.

---

## How this relates to the rest of the repository

```
agent/        ← the rules, in prose and as data     (you are here)
dds/          ← the implementation                  (the truth)
reference/    ← the rendered proof                  (what it looks like)
docs/         ← the reasoning, for humans           (why)
DECISIONS.md  ← lasting architectural decisions
LESSONS_LEARNED.md ← reusable experience
```

**`dds/` is the source of truth.** Where this directory and the implementation
disagree, the implementation is right and the documentation is a bug — fix the
documentation in the same commit.

Deliberately, there is **one rendered representation**, not two. `reference/`
holds the live pages and this directory points at them by anchor. The
alternative — a parallel set of agent-facing rendered pages — is a second copy
of every component that drifts from the first, and the drift always shows up in
the ARIA attributes, which is exactly the part that gets copied without
checking. See `DECISIONS.md`.

---

## Verifying the context

These checks exist because context that has quietly gone stale is worse than no
context: an agent trusts it.

```bash
node scripts/check-agent-index.mjs    # every entry in index.json really exists
node scripts/check-css.mjs            # no silent CSS failures
node scripts/check-contrast.mjs       # every colour pair vs WCAG 2.2 AA
node scripts/sync-icons.mjs --check   # inline icon sprites are current
node scripts/sync-reference-toc.mjs --check
node scripts/build-foundations.mjs --check
```

---

## Keeping it current

When a component or pattern is added, changed or removed:

1. Update its entry in `index.json`.
2. Update its specification in `components.md` or `patterns.md`.
3. Add or update its section in the matching `reference/*.html` page.
4. Run the checks above.
5. Commit all of it **together**. A specification that lags behind its code is a
   specification nobody can trust, and one that is trusted while wrong is worse
   than one that is obviously missing.

If a change alters a principle, an accessibility expectation or the
architectural model, record the reasoning in `DECISIONS.md` as well.
