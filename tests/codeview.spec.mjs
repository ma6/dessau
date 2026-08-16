/**
 * Dessau — the "Show markup" sample is the component.
 *
 *   npx playwright test tests/codeview.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * The code view generates its sample from the live DOM rather than carrying a
 * hand-written copy beside the demo, and `reference-tools.js` argues the reason
 * at length: two sources of truth is one too many, and the copy is the one that
 * goes stale — usually in the ARIA, which is precisely the part somebody copies
 * without checking.
 *
 * That argument buys the sample a great deal of trust, and it is exactly why the
 * generator going wrong is worse than a stale copy would be. It did go wrong: it
 * took the specimen's first child, most specimens open with their caption, and
 * seventeen of thirty-nine offered `<p class="ref-specimen-label">` as the markup
 * for the component. "Copy markup" copied that. Nothing failed, nothing looked
 * broken, and the page still said the sample could not be wrong (#43).
 *
 * A generated sample therefore needs a test that the generation is right, and it
 * has to be a browser: the sample does not exist until a `<details>` is opened.
 *
 * The assertions are about the *shape* of every sample rather than the content of
 * any one, so a new specimen is covered the day it is added without anybody
 * remembering to extend this file.
 *
 * @covers none — the code view is the reference's own tooling, not a shipped DDS
 *   enhancement. What it demonstrates is covered by the specs for those; what is
 *   checked here is that the demonstration tells the truth.
 *
 */

import { test, expect } from '@playwright/test';
import { readdir } from 'node:fs/promises';

const PAGES = (await readdir('reference'))
  .filter((name) => name.endsWith('.html'))
  .sort();

/** Open every disclosure: the sample is serialised on first open, not up front. */
async function openEveryCodeView(page) {
  await page.$$eval('details.ref-codeview', (views) => {
    views.forEach((view) => {
      view.open = true;
    });
  });
}

function samples(page) {
  return page.$$eval('[data-ref-code]', (hosts) =>
    hosts.map((host) => ({
      caption:
        host.querySelector('.ref-specimen-label')?.textContent.trim() ?? '(no caption)',
      code: host.querySelector('.ref-codeview code')?.textContent ?? '',
    }))
  );
}

for (const name of PAGES) {
  test(`${name}: every sample is markup, and it is the component's`, async ({ page }) => {
    await page.goto(`/reference/${name}`);
    await openEveryCodeView(page);

    for (const { caption, code } of await samples(page)) {
      const where = `${name} — ${caption}`;

      expect(code.trim(), `${where}: the sample is empty`).not.toBe('');

      // The bug this file was written for. `ref-` is reference-only by
      // convention (`agent/conventions.md`), so a sample containing one is a
      // sample of the reference's own scaffolding rather than of a component —
      // whether it is the caption at the top level or a variant label nested
      // one down.
      expect(code, `${where}: the sample contains reference-only markup`).not.toMatch(
        /class="[^"]*\bref-/
      );

      // Attributes DDS applies at runtime are not what an author writes, and
      // showing them suggests they have to be typed by hand.
      expect(code, `${where}: the sample contains a runtime attribute`).not.toMatch(
        /data-dds-enhanced/
      );

      /* The host of a reference tool is scaffolding too, and it is the half the
         `ref-` check above cannot see: `data-ref-bp` and `data-ref-variants` sit
         on plain `<div>`s that carry no class of their own. */
      expect(code, `${where}: the sample is a reference tool's host`).not.toMatch(
        /data-ref-(bp|variants|variant|code)\b/
      );

      /* An element DDS inserted into the markup is not markup. The lightbox's
         magnifier badge was in its own sample for as long as the code view knew
         about generated elements one component at a time — offered as something
         to type, in the specimen of a component that builds it so nobody has
         to (#88). */
      expect(code, `${where}: the sample contains a generated element`).not.toMatch(
        /data-dds-generated/
      );

      /* "Not blank" is a weaker claim than it looks. Unwrapping the width
         preview one level deep left `<div data-ref-bp>` standing as the sample,
         `cleanClone` stripped the generated frame out of it as reference-only,
         and three specimens shipped an empty `<div>` as the markup for their
         component — past every assertion above, because an empty element is not
         a blank string. */
      expect(code, `${where}: the sample is an empty element`).not.toMatch(
        /^<(\w[\w-]*)[^>]*><\/\1>$/
      );
    }
  });

  test(`${name}: every sample starts at the left margin`, async ({ page }) => {
    await page.goto(`/reference/${name}`);
    await openEveryCodeView(page);

    for (const { caption, code } of await samples(page)) {
      const lines = code.split('\n').filter((line) => line.trim());
      if (lines.length < 2) continue;

      /* `outerHTML` keeps the source's indentation on every line but the first,
         which it has already dropped. Measuring across all of them therefore
         always finds zero and dedents nothing, and the sample arrives indented
         by however deep the specimen happened to sit in the page. Measuring from
         the second line is what makes the dedent do anything at all. */
      const deepest = Math.min(...lines.slice(1).map((line) => line.match(/^ */)[0].length));

      expect(deepest, `${name} — ${caption}: the sample carries the page's indentation`).toBe(
        0
      );
    }
  });
}

test('the lightbox badge is on the page and not in the sample', async ({ page }) => {
  await page.goto('/reference/content.html');
  await openEveryCodeView(page);

  const specimen = page.locator('#lightbox [data-ref-code]').first();

  // Both halves matter. Generated and stripped is correct; stripped because it
  // was never generated is a broken component with a tidy sample.
  await expect(specimen.locator('.dds-lightbox-zoom')).toHaveCount(1);

  const code = await specimen.locator('.ref-codeview code').textContent();
  expect(code).toContain('data-dds-lightbox');
  expect(code).not.toContain('dds-lightbox-zoom');
  expect(code).not.toContain('data-dds-lightbox-ready');
});

test('a specimen that demonstrates several elements shows all of them', async ({ page }) => {
  await page.goto('/reference/components.html');
  await openEveryCodeView(page);

  /* The divider is demonstrated as three siblings — a paragraph, the rule, a
     second paragraph — and a sample of any one of them would be useless. Taking
     the first child returned the caption here and would have returned a single
     paragraph once that was fixed, so "the component" cannot mean one element. */
  const code = await page.$$eval('[data-ref-code]', (hosts) => {
    const host = hosts.find((candidate) =>
      candidate.querySelector('.ref-specimen-label')?.textContent.trim().startsWith('Divider')
    );
    return host?.querySelector('.ref-codeview code')?.textContent ?? '';
  });

  expect(code).toContain('<hr class="dds-divider');
  expect(code.match(/<p class="dds-text-sm"/g) ?? []).toHaveLength(2);
});
