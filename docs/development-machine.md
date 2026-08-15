# Setting up a development machine

For working **on** Dessau: the checks, the generated files and the browser tests.
A product or a derived system consuming Dessau needs none of this — see
[`../README.md`](../README.md) for which route is yours.

Assumes macOS with [Homebrew](https://brew.sh). Using Dessau needs no
dependencies at all; this is only for the repository itself.

```bash
# Node — runs the checks and the generators. Node 20 or newer.
brew install node

# GitHub CLI — issues and pull requests from the terminal.
brew install gh
gh auth login

# Playwright — the browser tests. The npm package first, then the browsers,
# which are a separate ~500 MB download and not part of the package.
npm install
npx playwright install chromium webkit firefox
```

Check it worked:

```bash
node --version          # v20 or newer
gh auth status          # logged in
npx playwright --version
```

Then run everything:

```bash
npm run check           # every static gate
npx playwright test     # the browser tests
```

Playwright puts its browsers in `~/Library/Caches/ms-playwright` on macOS. To keep
them inside the repository instead — useful if a sandbox cannot read your home
directory:

```bash
PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers npx playwright install chromium webkit firefox
```

`.playwright-browsers/` is git-ignored. Set the same variable when running the
tests, or they will look in the default location and report the browsers as
missing.

Both commands also run in CI, on every push and every pull request, on Chromium
and on WebKit — see [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).
Running them locally is faster feedback, not a substitute: a check that only
runs when somebody remembers is a check that eventually does not.

One thing CI cannot do for itself is the whitelabel audit's term list.
`.whitelabel-terms.json` is git-ignored deliberately — an audit that enumerates
the names it looks for is the best place to find them — so CI reads it from the
`WHITELABEL_TERMS` repository secret:

```bash
gh secret set WHITELABEL_TERMS < .whitelabel-terms.json
```

Without the secret the audit falls back to `.whitelabel-terms.example.json` and
says so in the run's annotations. The generic entries still apply; the
project-specific ones do not.

