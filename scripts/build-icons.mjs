#!/usr/bin/env node
/**
 * Dessau — build the icon sprite from Ionicons.
 *
 *   node scripts/build-icons.mjs
 *
 * Downloads the Ionicons SVGs listed in `ICON_MAP`, converts them, and writes
 * `dds/icons/icons.svg` plus the licence notice.
 *
 * -----------------------------------------------------------------------------
 * Why a build step for icons, when Dessau otherwise has none
 * -----------------------------------------------------------------------------
 *
 * The sprite is a derived artefact with a real upstream. Committing it by hand
 * means nobody can tell later which Ionicons version a path came from, whether it
 * was edited, or how to add the twenty-fifth icon. This script makes the mapping
 * from role name to upstream name the source of truth, so adding an icon is one
 * line and the conversion is identical every time.
 *
 * The sprite it produces IS committed — it has to be, because products consume it
 * directly and must not need a network round trip or a Node install to render an
 * icon.
 *
 * Run it only when the icon set changes. It is the one script here that needs
 * network access.
 *
 * Zero dependencies, Node stdlib only.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ICONS_DIR = join(ROOT, 'dds/icons');
const UPSTREAM = 'https://raw.githubusercontent.com/ionic-team/ionicons/main';

/**
 * Role name → Ionicons file name.
 *
 * The two-layer naming is deliberate. Symbol ids describe the ROLE
 * (`dds-icon-error`), not the picture (`alert-circle`), so the glyph behind a
 * role can be swapped once, here, rather than at every call site — and a
 * component never depends on what an icon happens to look like today.
 */
const ICON_MAP = [
  {
    group: 'Status',
    icons: [
      ['check', 'checkmark-outline'],
      ['check-circle', 'checkmark-circle-outline'],
      ['warning', 'warning-outline'],
      ['error', 'alert-circle-outline'],
      ['info', 'information-circle-outline'],
    ],
  },
  {
    group: 'Navigation',
    icons: [
      ['chevron-down', 'chevron-down-outline'],
      /* No `chevron-up`. A disclosure rotates `chevron-down` by 180deg, which
         animates the change and needs one symbol instead of two — so an "up"
         chevron had no caller and was weight in every page's sprite. Rotating also
         keeps the two states unmistakably the same control, which two separate
         glyphs do not guarantee. `scripts/check-icons.mjs` is what noticed. */
      ['chevron-left', 'chevron-back-outline'],
      ['chevron-right', 'chevron-forward-outline'],
      ['arrow-right', 'arrow-forward-outline'],
      ['arrow-left', 'arrow-back-outline'],
      ['external', 'open-outline'],
    ],
  },
  {
    group: 'Actions',
    icons: [
      ['close', 'close-outline'],
      ['search', 'search-outline'],
      ['plus', 'add-outline'],
      ['minus', 'remove-outline'],
      ['edit', 'create-outline'],
      ['trash', 'trash-outline'],
      ['menu', 'menu-outline'],
    ],
  },
  {
    group: 'Objects',
    icons: [
      ['location', 'location-outline'],
      ['document', 'document-text-outline'],
      ['inbox', 'file-tray-outline'],
      ['sun', 'sunny-outline'],
      ['moon', 'moon-outline'],
    ],
  },
];

/**
 * Fetch a URL as text.
 *
 * Tries the built-in `fetch` first and falls back to `curl`. The fallback is not
 * paranoia: Node's fetch implementation ignores the `HTTP_PROXY`/`HTTPS_PROXY`
 * environment variables, so in any proxied environment — a corporate network, a
 * sandboxed agent — it fails with ENOTFOUND while every other tool on the machine
 * works fine. `curl` honours those variables, so it succeeds where fetch cannot.
 */
async function fetchText(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.text();
  } catch (error) {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const run = promisify(execFile);

    try {
      const { stdout } = await run('curl', ['-sSf', '--max-time', '30', url], {
        maxBuffer: 8 * 1024 * 1024,
      });
      return stdout;
    } catch (curlError) {
      throw new Error(
        `Could not fetch ${url}\n` +
          `  fetch: ${error.message}\n` +
          `  curl:  ${curlError.message}`
      );
    }
  }
}

/**
 * Extract the drawing children of an Ionicons SVG, made theme-aware.
 *
 * Exactly one change: the hardcoded #000 becomes `currentColor`, so the icon
 * follows its container's colour and therefore the theme. Stroke widths, caps,
 * joins and the 512 viewBox are left as Ionicons drew them, so the icons keep
 * their intended optical weight instead of being re-weighted by guesswork.
 */
function convert(svg) {
  let inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

  inner = inner
    .replaceAll('stroke:#000', 'stroke:currentColor')
    .replaceAll('stroke="#000"', 'stroke="currentColor"')
    .replaceAll('fill:#000', 'fill:currentColor')
    .replaceAll('fill="#000"', 'fill="currentColor"');

  // Ionicons puts every drawing element on one line; break them up so the sprite
  // is reviewable in a diff.
  inner = inner.replace(/>\s*</g, '>\n<');

  return inner
    .trim()
    .split('\n')
    .map((line) => '      ' + line.trim())
    .join('\n');
}

const HEADER = `<?xml version="1.0" encoding="UTF-8"?>
<!--
  DDS — Icon set

  GENERATED by scripts/build-icons.mjs. Do not hand-edit; change ICON_MAP there
  and re-run.

  Built from Ionicons (https://ionic.io/ionicons), MIT licensed. The full licence
  text is in dds/icons/LICENSE-ionicons.txt — MIT requires that notice to travel
  with the copies, which is why it is committed alongside rather than only linked.

  ---------------------------------------------------------------------------
  Two naming layers, on purpose
  ---------------------------------------------------------------------------

  Symbol ids describe the ROLE (\`dds-icon-error\`), not the picture
  (\`alert-circle\`). That indirection means the glyph behind a role can be changed
  once, in ICON_MAP, instead of at every call site — and it stops a component from
  depending on what an icon happens to look like today. The Ionicons source name
  is kept in a comment above each symbol so the mapping stays traceable.

  ---------------------------------------------------------------------------
  Colour
  ---------------------------------------------------------------------------

  Ionicons ships its outline icons with a hardcoded \`stroke:#000\`. That is
  replaced with \`currentColor\` and NOTHING else is touched, so the icons keep
  their intended optical weight.

  Because \`fill\` and \`stroke\` are set as presentation ATTRIBUTES here,
  \`.dds-icon\` must not declare them in CSS — a CSS declaration beats a
  presentation attribute, which would fill every outline icon solid.

  ---------------------------------------------------------------------------
  IMPORTANT — this file must be INLINED into the document, not referenced
  ---------------------------------------------------------------------------

  \`<use href="icons.svg#dds-icon-check">\` pointing at this file as an external
  resource does not work reliably: the referenced content is cloned into a shadow
  tree whose style computation does not see the referencing document's CSS.
  \`currentColor\` then falls back to a default — effectively black — regardless of
  theme, hover state or button variant.

  It fails the same way in every current engine, and it fails SILENTLY: the icon
  renders, just in the wrong colour. So the sprite is copied into each HTML
  document once, hidden, immediately after <body>, and referenced with:

      <svg class="dds-icon" aria-hidden="true"><use href="#dds-icon-check"/></svg>

  \`node scripts/sync-icons.mjs\` does the copying and keeps every page's inline
  copy identical to this file. Never hand-edit an inlined copy.
-->
<svg xmlns="http://www.w3.org/2000/svg" hidden aria-hidden="true" data-dds-icons>
  <defs>
`;

const parts = [HEADER];
let count = 0;

for (const { group, icons } of ICON_MAP) {
  parts.push(`\n    <!-- ${group} ${'-'.repeat(Math.max(4, 66 - group.length))} -->\n`);

  for (const [role, upstreamName] of icons) {
    const svg = await fetchText(`${UPSTREAM}/src/svg/${upstreamName}.svg`);
    /* `fill="currentColor"` on the <symbol> rather than on every child.
       `fill` is an inherited SVG property, so this gives the solid parts of an
       icon (the dot on an "i", the dot under a "!") the container's colour, while
       the outline paths keep their own inline `fill:none` and are unaffected.
       Without it those solid parts default to black and stay black in dark mode —
       a genuinely invisible dot on a dark surface. */
    parts.push(
      `\n    <!-- Ionicons: ${upstreamName} -->\n` +
        `    <symbol id="dds-icon-${role}" viewBox="0 0 512 512" fill="currentColor">\n` +
        convert(svg) +
        `\n    </symbol>\n`
    );
    count++;
    console.log(`  ${role} ← ${upstreamName}`);
  }
}

parts.push('\n  </defs>\n</svg>\n');

await mkdir(ICONS_DIR, { recursive: true });
await writeFile(join(ICONS_DIR, 'icons.svg'), parts.join(''), 'utf8');

const licence = await fetchText(`${UPSTREAM}/LICENSE`);
await writeFile(
  join(ICONS_DIR, 'LICENSE-ionicons.txt'),
  'Ionicons — licence notice for the DDS icon set\n' +
    '==============================================\n\n' +
    'dds/icons/icons.svg is built from Ionicons by scripts/build-icons.mjs.\n' +
    'Upstream: https://github.com/ionic-team/ionicons\n\n' +
    'MIT permits reuse and modification, and requires this notice to accompany the\n' +
    'copies. The only modification made is replacing the hardcoded #000 stroke and\n' +
    'fill values with `currentColor`, so the icons follow the active theme.\n\n' +
    '----------------------------------------------------------------------\n\n' +
    licence,
  'utf8'
);

console.log(`\nWrote dds/icons/icons.svg with ${count} symbols.`);
console.log('Wrote dds/icons/LICENSE-ionicons.txt.');
console.log('\nNow run: node scripts/sync-icons.mjs');
