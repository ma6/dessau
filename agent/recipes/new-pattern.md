# Recipe: add a pattern

A pattern solves a recurring user task. Most of the work is not visual.

## 0. Check it does not exist, and that it is a Pattern

`agent/index.json`, then the tests in `agent/architecture.md`.

## 1. Write down the rules before the code

This is the step that matters. For each rule, state **what breaks without it** —
a rule without its failure mode gets removed by the next person who finds it
inconvenient.

The questions that produce the rules:

- What must remain possible when the clever path fails?
- What is invisible to a screen-reader user, and therefore needs announcing?
- Where does focus go, at each step, and why there?
- Which state is most likely to be forgotten? (It is almost always "request
  failed", worded differently from "nothing found".)
- What must never be locked, hidden or auto-filled?
- What happens on a slow connection, and can a stale response overwrite a fresh
  one?

## 2. Enumerate every state

Loading · results · nothing found · **failed** · empty · partially complete · no
JavaScript.

Build all of them. A pattern with only its happy path is not a pattern.

## 3. Put external services behind a provider

One object, one method, documented as an interface. It must:

- return a promise;
- honour an `AbortSignal`;
- **reject** on failure rather than resolving empty;
- never be required for the task to be completable by hand.

Ship a mock that can misbehave on demand — latency, failure, emptiness. Those are
the states real integrations get wrong and are hard to reproduce against a working
service. See `dds/js/providers/`.

## 4. Compose, do not invent

A pattern introduces **no new values and no new components**. If it seems to need a
component, that is a missing component — promote it first, then compose.

## 5. Behaviour

`dds/js/patterns/<name>.js`. Debounce anything driven by typing. Abort in-flight
work. Announce outcomes politely, debounced. Manage focus explicitly and document
where it goes.

## 6. Document and verify

Same as a component, plus: `agent/patterns.md` states **the rules and why each one
exists**, not just the markup.

Walk all four provider behaviours with a screen reader before calling it done.

```
feat(patterns): add <name>
```
