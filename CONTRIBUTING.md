# Contributing

Short version: **please don't, and use it freely anyway.**

## There is no support

Dessau is MIT licensed. Use it, change it, ship it, sell what you build with it —
keep the notice and you are done. Nothing is owed in return, and nothing is owed to
you: no support, no answers, no fixes on a schedule, no compatibility promise to
anybody who is not paying for one.

That is not unfriendliness. A foundation that quietly acquires obligations to
strangers stops being maintainable by one person, and this one is maintained by one
person on purpose.

## The issues are working notes

Every requirement here becomes a GitHub Issue before it is built, because a commit
records what changed and only a ticket records what was asked for. Those issues are
the maintainer's own thread, not a queue.

An issue from outside will most likely be closed without discussion. That is not a
judgement of it — it is that triaging is the work this project is not taking on.
If something here is wrong, you have the source and the licence to fix it in your
own copy, which is faster than waiting anyway.

## Pull requests are not being accepted

Not a review-quality question. Accepting a contribution means keeping a second
person's reasoning alive in a repository built on the premise that reasoning is
written down and stays true — `DECISIONS.md`, `LESSONS_LEARNED.md`, the "how far
this has actually been executed" sections. That is the cost, and it is not one this
project is set up to carry.

## If you are forking it

Good — that is what the licence is for. Two things worth knowing before you do:

- **`agent/recipes/derive-a-standalone-system.md`** exists for exactly this. Dessau
  is built to be a base for other design systems: substitute the foundation, keep
  the rest, and you get one that owes nothing to this repository at runtime.
- **The verification scripts are hardcoded to `dds/css/*`.** Run them unchanged in
  your fork and they will measure Dessau's values and report success while yours go
  unchecked. Repoint them, then break each one on purpose to confirm it can still
  fail.

## Security

If you find something with security consequences, an issue is fine. See "no support"
for what that does and does not promise.
