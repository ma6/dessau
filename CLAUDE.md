# CLAUDE.md — Dessau

**Read [`AGENTS.md`](AGENTS.md) first. It is the canonical instruction set for
this repository.**

This file exists because Claude Code looks for `CLAUDE.md` by name. It is not a
second, competing set of rules — everything that governs work in Dessau is in
`AGENTS.md` and the [`agent/`](agent/) directory it points to. Maintaining two
divergent instruction files is how a repository ends up with contradictory
guidance, so this one deliberately stays thin.

If anything here ever appears to contradict `AGENTS.md`, `AGENTS.md` wins and
this file is the bug.

---

## Claude Code specifics

These are the few things that are genuinely about the tool rather than about
Dessau.

### The `modern-web-guidance` skill is mandatory

Invoke it — do not rely on recall — for any significant work on HTML structure,
CSS architecture, JavaScript behaviour, components, patterns, forms, address
search, responsive behaviour or accessibility-related interaction.

```
Skill(skill="modern-web-guidance", args="<what you are building>")
```

Use it *during* the work, not as a review at the end, and run a full pass over
the changed surface before a significant commit. Where guidance conflicts with a
documented Dessau principle, the principle wins and the conflict is recorded in
`DECISIONS.md`.

Full expectations: [`agent/modern-web-guidance.md`](agent/modern-web-guidance.md).

If the skill does not resolve, say so plainly rather than quietly substituting
recall, and note it in the work summary.

### Sandbox constraint: no `token` in a filename

The sandbox denies read and write on paths containing `token`. The failure is
silent — a write appears to succeed and lands on a device file, producing an
empty file with no error.

Dessau therefore names things after the architectural layer:
`dds/css/primitives.css`, `dds/css/semantic.css`, `agent/foundations.md`,
`scripts/check-css.mjs`. This turned out to be better naming anyway. Do not
"fix" it by reintroducing the word. See `LESSONS_LEARNED.md`.

### Verification is scripted, so run the scripts

```bash
node scripts/check-contrast.mjs   # WCAG 2.2 AA, every pair, both themes
node scripts/check-css.mjs        # silent CSS failures
node scripts/sync-icons.mjs --check
```

Do not estimate a contrast ratio. Do not assume a custom property exists. Both
are verifiable in under a second, and both fail silently in a browser.

### Rendering check

```bash
python3 -m http.server 8000 --bind 127.0.0.1
# then http://localhost:8000/reference/
```

Check **both themes**. Dark mode is where colour mistakes hide, because the
light-mode value is usually the one that was reasoned about.

### Commits

Committing is pre-authorised in this repository: commit after each completed step
without asking. `git push` is not — ask first.

Every commit message ends with:

```
AI-assisted change (Claude Code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### `src/` is off limits

`src/` holds local reference material. It is git-ignored and must never enter
this repository's history. Read it if it is present; never copy from it, never
stage it, never write into it.

---

## The short version

1. Read [`AGENTS.md`](AGENTS.md).
2. Check [`agent/index.json`](agent/index.json) before building anything new.
3. Use the `modern-web-guidance` skill while working.
4. Run the three verification scripts.
5. Walk [`agent/definition-of-done.md`](agent/definition-of-done.md).
6. Commit small, record the reasoning.
