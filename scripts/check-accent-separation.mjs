#!/usr/bin/env node
/**
 * Dessau — the five accents stay tellable apart.
 *
 *   node scripts/check-accent-separation.mjs
 *   node scripts/check-accent-separation.mjs --verbose   # print every pair
 *
 * -----------------------------------------------------------------------------
 * Why this exists
 * -----------------------------------------------------------------------------
 *
 * `scripts/check-contrast.mjs` asks whether a colour can be seen against its
 * background. That is a different question from whether two colours can be told
 * apart from each other, and contrast ratio cannot answer it: two hues with the
 * same luminance have a ratio of 1.0 and may be obviously different, or the same
 * colour. A categorical palette lives entirely on the second question — five
 * accents whose only job is to say "this bar is not that bar".
 *
 * So the promise "five distinguishable accents" needs its own check, or it is not
 * a promise. Perceptual distance in OKLab is the measure, because Euclidean
 * distance in sRGB is not perceptual and CIELAB is a worse fit for the blues that
 * two of these accents are made of.
 *
 * Both themes, because the dark values are a different five colours: every accent
 * lightens to its 300, and lightening compresses the distances — the closest pair
 * in the system is in dark mode, not light.
 *
 * WHAT THIS DELIBERATELY DOES NOT CHECK. The subtle tints are not compared: at
 * that lightness every hue converges, and no threshold worth having would pass.
 * A tint is a background for something that names itself, not an identifier. Nor
 * is the distance to the action and status hues checked — `clay` against `red`
 * has always sat at 0.04, so a threshold that failed on it would fail on the day
 * it was written, and one that passed would never fail on anything.
 *
 * Zero dependencies, Node stdlib only. Exit code 1 on any pair below the floor.
 * @catches Two accent colours that have drifted close enough to be mistaken for
 *   each other, in either theme — which makes a chart legend or a set of category
 *   tags say nothing while every contrast check still passes.
 *
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VERBOSE = process.argv.includes('--verbose');

/** The accent slots. Numbered, not named after their hues — see semantic.css. */
const ACCENTS = [1, 2, 3, 4, 5];

/**
 * The floor, in OKLab ΔE.
 *
 * For scale: the closest pair of *meaningful* colours already in Dessau is clay
 * against red, at 0.04 — a pair nobody has ever had to tell apart, because one is
 * decoration and the other is an error. The accent set is held to nearly twice
 * that, because telling two of them apart is the entire job.
 *
 * The shipped set's worst pair is accent 2 against accent 5 in dark mode, at 0.109.
 * The gap between that and this number is the room a future re-tune has before it
 * has taken something away.
 */
const MINIMUM = 0.07;

/* ---------------------------------------------------------------- extraction */

/** Pull `--dds-*: value` declarations out of one rule, anchored to a line start. */
function extractTokens(css, blockSelector) {
  const anchored = new RegExp(
    `^\\s*${blockSelector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(?:,[^{}]*)?\\{`,
    'm'
  );
  const found = anchored.exec(css);
  if (!found) throw new Error(`Selector not found as a rule in CSS: ${blockSelector}`);

  const open = found.index + found[0].length - 1;
  const close = css.indexOf('}', open);
  const body = css.slice(open + 1, close);

  const tokens = new Map();
  for (const line of body.split('\n')) {
    const match = line.match(/(--dds-[\w-]+)\s*:\s*([^;]+);/);
    if (match) tokens.set(match[1], match[2].trim());
  }
  return tokens;
}

function parseHex(hex) {
  const h = hex.trim().replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

function resolve(tokens, name, seen = new Set()) {
  if (seen.has(name)) throw new Error(`Circular token reference at ${name}`);
  seen.add(name);
  const raw = tokens.get(name);
  if (raw === undefined) throw new Error(`Undefined token: ${name}`);
  const reference = raw.match(/^var\(\s*(--[\w-]+)\s*\)$/);
  if (reference) return resolve(tokens, reference[1], seen);
  const rgb = parseHex(raw);
  if (!rgb) throw new Error(`${name} is not a plain hex colour: ${raw}`);
  return rgb;
}

/* -------------------------------------------------------------------- OKLab */

/**
 * sRGB to OKLab (Björn Ottosson, 2020). The matrices are the published ones; the
 * cube roots are what makes the space perceptually uniform, which is the only
 * property this file actually needs.
 */
function oklab([r8, g8, b8]) {
  const [r, g, b] = [r8, g8, b8]
    .map((c) => c / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

const separation = (a, b) => {
  const [l1, a1, b1] = oklab(a);
  const [l2, a2, b2] = oklab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
};

/* ------------------------------------------------------------------- runner */

const primitiveCss = await readFile(join(ROOT, 'dds/css/primitives.css'), 'utf8');
const semanticCss = await readFile(join(ROOT, 'dds/css/semantic.css'), 'utf8');

const primitives = extractTokens(primitiveCss, ':root');
const light = extractTokens(semanticCss, ':root');
const dark = extractTokens(semanticCss, '[data-theme="dark"]');

const themes = [
  { name: 'light', tokens: new Map([...primitives, ...light]) },
  // Dark overrides only what changes; everything else inherits from :root.
  { name: 'dark', tokens: new Map([...primitives, ...light, ...dark]) },
];

let failures = 0;
let checks = 0;

for (const theme of themes) {
  const lines = [];
  let closest = { distance: Infinity, label: '' };

  for (let i = 0; i < ACCENTS.length; i++) {
    for (let j = i + 1; j < ACCENTS.length; j++) {
      const names = [ACCENTS[i], ACCENTS[j]].map((slot) => `--dds-color-accent-${slot}`);

      let a, b;
      try {
        [a, b] = names.map((name) => resolve(theme.tokens, name));
      } catch (error) {
        console.error(`  ERROR ${theme.name}: ${error.message}`);
        failures++;
        continue;
      }

      const distance = separation(a, b);
      const ok = distance >= MINIMUM;
      checks++;
      if (!ok) failures++;
      if (distance < closest.distance) {
        closest = { distance, label: `${ACCENTS[i]}/${ACCENTS[j]}` };
      }

      if (!ok || VERBOSE) {
        lines.push(
          `  ${ok ? 'pass' : 'FAIL'}  ΔE ${distance.toFixed(3)}  (min ${MINIMUM})  ` +
          `accent ${ACCENTS[i]} vs accent ${ACCENTS[j]}`
        );
      }
    }
  }

  if (lines.length) {
    console.log(`\n${theme.name}:`);
    console.log(lines.join('\n'));
  }
  if (VERBOSE) {
    console.log(`  closest pair in ${theme.name}: ${closest.label} at ΔE ${closest.distance.toFixed(3)}`);
  }
}

console.log(
  `\n${checks} accent pairs compared across light and dark. ` +
  (failures === 0
    ? `All at least ΔE ${MINIMUM} apart in OKLab.`
    : `${failures} FAILED — those two accents cannot be relied on to mean different things.`)
);

process.exit(failures === 0 ? 0 : 1);
