/**
 * Dessau — wording follows `lang`, and nothing else.
 *
 *   npx playwright test tests/language.spec.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this test exists
 * -----------------------------------------------------------------------------
 *
 * The strings DDS writes into a page — an accessible name, an announcement — are
 * the ones nobody looks at. A wrong one is not visible: the button still renders,
 * the theme still switches, the password still reveals. It is only wrong out
 * loud, to the one user who cannot check it against the screen.
 *
 * So the assertions are on the two places that decide it: the language resolver
 * itself, and the two controls that use it. See DECISIONS.md 028.
 */

import { test, expect } from '@playwright/test';

const COMPONENTS = '/reference/components.html';

test('the language resolver reads the nearest lang, not the document', async ({ page }) => {
  await page.goto(COMPONENTS);

  const resolved = await page.evaluate(() => {
    const scope = document.createElement('div');
    scope.setAttribute('lang', 'de-AT');

    const inner = document.createElement('span');
    scope.appendChild(inner);
    document.body.appendChild(scope);

    const answers = {
      // The page itself.
      document: window.DDS.utils.language(document.body),
      // Inside a part in another language, and the region subtag is dropped.
      part: window.DDS.utils.language(inner),
    };

    scope.remove();
    return answers;
  });

  expect(resolved.document).toBe('en');
  expect(resolved.part).toBe('de');
});

test('the theme toggle is named in the language of where it sits', async ({ page }) => {
  await page.goto(COMPONENTS);

  const english = page.locator('.dds-theme-toggle').first();
  const german = page.locator('[lang="de"] .dds-theme-toggle');

  /**
   * The name, not the visible label: for the icon-only variant it is the only
   * name there is, and WCAG 2.5.3 requires it to contain the visible one where
   * there is a label.
   */
  await expect(english).toHaveAttribute('aria-label', /theme/i);
  await expect(german).toHaveAttribute('aria-label', /Design/);
});

test('the announcement is not half-translated', async ({ page }) => {
  await page.goto(COMPONENTS);

  const german = page.locator('[lang="de"] .dds-theme-toggle');
  await german.click();

  /**
   * DDS's own live region, not any polite region on the page.
   *
   * `[aria-live="polite"]` alone also matches the character-count demo, which is a
   * component's own status element — the first version of this test asked for
   * both and failed on the ambiguity. The one DDS creates is the visually hidden,
   * atomic one it appends to the body (see `getLiveRegion` in dds.js).
   */
  const live = page.locator('div.dds-sr-only[aria-live="polite"][aria-atomic="true"]');

  /**
   * This is the defect the rule was hiding: the label came from the table and the
   * sentence after it was written in English in the source, so a German page
   * announced "Dunkel — dark theme on". A string that varies by language cannot
   * be half in a table and half in the code.
   *
   * The positive assertion goes first and does the waiting — the region is filled
   * after a double `requestAnimationFrame`, and a bare "does not contain English"
   * would be satisfied by an empty region that has not been written to yet.
   */
  await expect(live).toHaveText(/Design/);
  expect(await live.textContent(), 'the announcement still contains English').not.toMatch(
    /theme on/
  );
});

test('every German passage in the reference declares itself', async ({ page }) => {
  for (const path of ['components', 'content', 'patterns', 'writing']) {
    await page.goto(`/reference/${path}.html`);

    /**
     * WCAG 3.1.2 Language of Parts. The reference pages are `lang="en"` and their
     * demo content is largely German, which is the failure this looks for —
     * without pretending to detect German in general. These are words that are
     * unambiguous, are not proper names, and were each found untagged here.
     */
    const untagged = await page.evaluate(() => {
      const GERMAN = /\b(auswählen|Dateien können|ausfüllen|Frühestens|gelöscht|Sortieren|Zuletzt geändert|Lesezeit|Bruttogeschossfläche|übertragen|Dokumente|Eingabe)\b/;
      const found = [];

      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!GERMAN.test(node.textContent)) continue;

        const element = node.parentElement;
        if (!element || element.closest('code, pre')) continue;
        if (element.closest('[lang="de"]')) continue;

        found.push(node.textContent.trim().slice(0, 60));
      }

      return found;
    });

    expect(untagged, `${path}.html has German text with no lang="de"`).toEqual([]);
  }
});
