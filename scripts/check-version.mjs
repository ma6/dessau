#!/usr/bin/env node
/**
 * Dessau — DDS.version and package.json agree.
 *
 *   node scripts/check-version.mjs
 *
 * -----------------------------------------------------------------------------
 * Why this gate exists
 * -----------------------------------------------------------------------------
 *
 * `dds/js/dds.js` carries its own `VERSION` constant, read by `DDS.version` —
 * the one place a page inspecting the library at runtime can ask what it has.
 * It is a second copy of `package.json`'s `version`, by hand, and nothing
 * compared the two.
 *
 * They drifted. `060` and `061` both record moving `DDS.version` to `1.0.0`
 * and `1.0.1` — neither commit actually touched `dds/js/dds.js`, whose
 * constant had not moved since `8a6bb9d` set it to `0.9.0`. It sat wrong
 * through two tagged releases before `063` caught it while cutting a third,
 * not because a consumer reported `DDS.version` lying to them, but because
 * someone happened to read the line while touching something else. That is
 * exactly the kind of finding a release should not depend on.
 *
 * Zero dependencies, Node stdlib only. Exit code 1 on any finding.
 * @catches `package.json`'s `version` and `dds/js/dds.js`'s `VERSION` constant
 *   disagreeing — the release-day mistake of bumping one and forgetting the
 *   other.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
const ddsSource = await readFile(join(ROOT, 'dds/js/dds.js'), 'utf8');

const match = ddsSource.match(/var VERSION = '([^']+)';/);

if (!match) {
  console.log(
    "\n  dds/js/dds.js: no line matches var VERSION = '…'; — this check's own " +
      'pattern needs updating alongside whatever changed there.'
  );
  process.exit(1);
}

const [, ddsVersion] = match;

if (ddsVersion !== pkg.version) {
  console.log(
    `\n  package.json says ${pkg.version}; dds/js/dds.js's VERSION says ` +
      `${ddsVersion} — DDS.version would report the wrong thing at runtime.\n` +
      `  Fix: set VERSION in dds/js/dds.js to '${pkg.version}'.`
  );
  process.exit(1);
}

console.log(`\nDDS.version matches package.json — both ${pkg.version}.`);
process.exit(0);
