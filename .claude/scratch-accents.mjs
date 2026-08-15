/* scratch: evaluate candidate accent ramps. Not part of the repository. */

const hex = (h) => {
  const s = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
const lum = ([r, g, b]) => {
  const l = [r, g, b].map((c) => c / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(hex(a)), lum(hex(b))];
  const [hi, lo] = x > y ? [x, y] : [y, x];
  return (hi + 0.05) / (lo + 0.05);
};

/* sRGB -> OKLab, for perceptual separation between two accents. */
function oklab(h) {
  const [r, g, b] = hex(h).map((c) => c / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
const deltaE = (a, b) => {
  const [l1, a1, b1] = oklab(a);
  const [l2, a2, b2] = oklab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
};

const RAMPS = {
  clay: { 100: '#fae8de', 300: '#e5ab8a', 600: '#9a4b2c', 900: '#482417' },
  green: { 100: '#d2f3e0', 300: '#6bcf9d', 600: '#16724a', 900: '#0c3423' },
  cyan: { 100: '#d9edfa', 300: '#7cbfea', 600: '#14669e', 900: '#0e344e' },
  magenta: { 100: '#fbe3f1', 300: '#ea9dcb', 600: '#a32d74', 900: '#4d1637' },
  violet: { 100: '#eee3fb', 300: '#c2a2ec', 600: '#6d39ab', 900: '#341c52' },
};

const WHITE = '#ffffff';
const PAGE_LIGHT = '#fafafa';
const TEXT_LIGHT = '#1e1e1e';
const SURF_DARK = '#1e1e1e';
const PAGE_DARK = '#131313';
const TEXT_DARK = '#f2f2f2';

const fmt = (n) => n.toFixed(2).padStart(6);
const mark = (n, min) => (n >= min ? 'ok  ' : 'FAIL');

console.log('LIGHT — accent = 600, subtle = 100');
for (const [name, r] of Object.entries(RAMPS)) {
  const a = r[600], s = r[100];
  console.log(
    `  ${name.padEnd(8)} 600 on white ${fmt(ratio(a, WHITE))} ${mark(ratio(a, WHITE), 3)}` +
    ` | on page ${fmt(ratio(a, PAGE_LIGHT))} ${mark(ratio(a, PAGE_LIGHT), 3)}` +
    ` | 600 on 100 ${fmt(ratio(a, s))} ${mark(ratio(a, s), 4.5)}` +
    ` | text on 100 ${fmt(ratio(TEXT_LIGHT, s))} ${mark(ratio(TEXT_LIGHT, s), 4.5)}`
  );
}

console.log('\nDARK — accent = 300, subtle = 900');
for (const [name, r] of Object.entries(RAMPS)) {
  const a = r[300], s = r[900];
  console.log(
    `  ${name.padEnd(8)} 300 on surf ${fmt(ratio(a, SURF_DARK))} ${mark(ratio(a, SURF_DARK), 3)}` +
    ` | on page ${fmt(ratio(a, PAGE_DARK))} ${mark(ratio(a, PAGE_DARK), 3)}` +
    ` | 300 on 900 ${fmt(ratio(a, s))} ${mark(ratio(a, s), 4.5)}` +
    ` | text on 900 ${fmt(ratio(TEXT_DARK, s))} ${mark(ratio(TEXT_DARK, s), 4.5)}`
  );
}

console.log('\nDARK — clay subtle today (#3a2318) for comparison');
console.log(`  clay 300 on #3a2318 ${fmt(ratio('#e5ab8a', '#3a2318'))}`);

for (const [label, step] of [['light (600)', 600], ['dark (300)', 300]]) {
  console.log(`\nSeparation between accents, OKLab dE — ${label}`);
  const names = Object.keys(RAMPS);
  let worst = [Infinity, ''];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const d = deltaE(RAMPS[names[i]][step], RAMPS[names[j]][step]);
      if (d < worst[0]) worst = [d, `${names[i]}/${names[j]}`];
      console.log(`  ${names[i].padEnd(8)} ${names[j].padEnd(8)} ${d.toFixed(3)}`);
    }
  }
  console.log(`  worst: ${worst[1]} ${worst[0].toFixed(3)}`);
}

console.log('\nSeparation from the action hue and the status hues (light 600 vs 600)');
const OTHERS = { indigo: '#4649b8', amber: '#836811', red: '#ad3630' };
for (const [n, v] of Object.entries(OTHERS)) {
  for (const [name, r] of Object.entries(RAMPS)) {
    const d = deltaE(r[600], v);
    if (d < 0.2) console.log(`  close: ${name} vs ${n} ${d.toFixed(3)}`);
  }
}
