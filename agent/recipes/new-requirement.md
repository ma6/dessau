# Recipe: file a requirement as a ticket

Every requirement the maintainer states becomes a GitHub Issue **before** the work
starts, and every commit answering it names the issue number.

A commit records what changed and why it was built that way. It does not record
what was asked for, and those are different things — one is the answer, the other
is the question. Without the question written down, the request is only
recoverable by inferring it backwards from a diff.

## 0. Decide whether this is a requirement

**File a ticket when** the maintainer asks for something that does not exist yet,
changes how Dessau behaves, or changes how work in it is done. If it took a
sentence of intent to describe, it is a requirement.

**Do not file a ticket for** a typo, a follow-up question about work just done, a
correction to a change in flight, or a fix for something the current task broke.
Those belong to the ticket already open, or to no ticket at all.

If it is unclear, file one. An extra ticket costs a minute; a requirement with no
record costs the reasoning behind it.

## 1. Write it as a user story

The role, the capability and the benefit — in the maintainer's words, not
translated into implementation.

```markdown
**As** <role>, **I want** <capability>, **so that** <benefit>.

**Context.** What exists today and why this is being asked for now.

**Outcome.** What is true when this is done.

**Acceptance criteria**
- [ ] Verifiable, not aspirational
- [ ] One line each
- [ ] Enough of them that "done" is not a judgement call

**Out of scope.** What this deliberately does not cover.
```

**Context is the part that decays.** The capability is usually obvious from the
title six months later; the reason it was worth doing is not. Write the sentence
that would stop a future reader from reverting the change as pointless.

Acceptance criteria are how the ticket gets closed honestly. "Works well" is not
one. "Passes `node scripts/check-contrast.mjs` in both themes" is.

## 2. File it

```bash
gh issue create --title "<the capability, as a sentence>" \
                --label story \
                --body-file "$TMPDIR/story.md"
```

The `story` label marks a requirement that came from the maintainer, which is what
separates it from the follow-up work an agent noticed and set aside. Add a second
label where one fits — `accessibility`, `documentation`, `test`, `build`, `bug`.

Write the body to a file and pass `--body-file`. A heredoc into `--body` mangles
backticks and blank lines.

## 3. Reference it in every commit

The ticket goes at the **front of the subject line**, before the conventional type
and scope, so `git log --oneline` reads as a list of requirements rather than a
list of changes:

```text
[#42] feat(patterns): the summary moves focus, the fields do not

<why, in the usual style>

Closes #42

AI-assisted change (Claude Code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

**In brackets, never bare.** `#42 feat(patterns): …` is a comment line to Git.
`--cleanup=strip` is the default whenever a message passes through an editor, and
it removes the line in full — subject included, silently:

```bash
printf '#42 feat: subject\n\nbody\n' | git stripspace --strip-comments
# body
```

`Closes #42` at the end goes only on the commit that satisfies the last acceptance
criterion; GitHub closes the issue when it reaches `main`. Earlier commits carry
the ticket in the subject and no trailer — the subject is what makes the thread
readable, and repeating it below adds nothing.

One requirement is often several commits. That is the point: the issue is the
thread that ties them together, and `Refs` on each is what makes the thread
visible from either end.

## 4. Close it deliberately

Before `Closes`, walk the acceptance criteria and tick them in the issue body. If
one cannot be met, say so in a comment and leave the issue open — a ticket closed
with an unmet criterion is worse than no ticket, because it claims something that
is not true.

Work discovered along the way that does not belong to this requirement gets its
own issue, without the `story` label, and does not expand the current one.
