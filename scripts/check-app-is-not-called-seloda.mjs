// THE APP IS NOT CALLED SELODA.
//
//   node scripts/check-app-is-not-called-seloda.mjs
//
// Ruth, 10 October 2026, on Apple's first-upload email, which referred to "the
// 'Seloda.app' bundle": "that's not correct. change it seloda.app is wrong".
//
// I had just told her it was only an internal name and not worth minding. It is
// a misspelling of the product, it reaches Apple's review correspondence and
// iOS Settings, and she was right to reject the shrug.
//
// WHERE IT COMES FROM, which is the useful part - Expo's own sanitiser, at
// @expo/config-plugins/build/ios/utils/Xcodeproj.js:
//
//     name.replace(/[\W_]+/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '')
//
// The steps run in the wrong order. Without the `u` flag `\W` matches "í", so
// the first replace DELETES it, and the NFD normalise and combining-mark strip
// that follow - whose entire job is turning "í" into "i" - arrive too late.
// "Selodía" becomes "Seloda" instead of "Selodia".
//
// This check does not test Expo. It tests that OUR config does not depend on
// that line being correct, and that nothing anywhere ships the misspelling.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

let pass = 0;
const failures = [];
function check(name, fn) {
  try {
    const note = fn();
    console.log(`  PASS  ${name}${note ? `   ${note}` : ''}`);
    pass += 1;
  } catch (e) {
    console.log(`  FAIL  ${name}\n          ${e.message}`);
    failures.push(name);
  }
}
function ok(cond, msg) {
  if (!cond) throw new Error(msg);
}

const appJson = JSON.parse(readFileSync('mobile/app.json', 'utf8'));
const expo = appJson.expo;
const plugin = readFileSync('mobile/plugins/with-product-name.js', 'utf8');

console.log('\n  THE APP IS NOT CALLED SELODA\n');

/** Expo's sanitiser, copied exactly, so this check sees what Expo would do. */
function expoSanitise(name) {
  return name
    .replace(/[\W_]+/g, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

check("Expo's own sanitiser still produces the misspelling", () => {
  // The reason the plugin exists. If Expo ever fixes the ordering this will
  // fail, and that failure is the signal to delete the plugin rather than a
  // problem - so the message says so.
  const got = expoSanitise(expo.name);
  ok(
    got === 'Seloda',
    `Expo now sanitises "${expo.name}" to "${got}". If that is "Selodia", the ordering ` +
      'bug is fixed upstream and mobile/plugins/with-product-name.js can go.'
  );
  // And show what the correct order would have given, so the claim is visible.
  const correct = expo.name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\W_]+/g, '');
  assert.strictEqual(correct, 'Selodia');
  return `"${expo.name}" -> "${got}", where the right order gives "${correct}"`;
});

check('the plugin that overrides it is actually registered', () => {
  const plugins = (expo.plugins ?? []).map((p) => (Array.isArray(p) ? p[0] : p));
  ok(
    plugins.includes('./plugins/with-product-name'),
    'with-product-name is not in app.json plugins, so PRODUCT_NAME falls back to Seloda'
  );
  return 'in app.json';
});

check('it sets a correctly spelled product name and a readable bundle name', () => {
  ok(/const PRODUCT_NAME = 'Selodia'/.test(plugin), 'PRODUCT_NAME is not "Selodia"');
  ok(/const DISPLAY_NAME = 'Selodía'/.test(plugin), 'DISPLAY_NAME lost its accent');
  ok(/CFBundleName = DISPLAY_NAME/.test(plugin), 'CFBundleName is not set, so it stays $(PRODUCT_NAME)');
  ok(/CFBundleDisplayName = DISPLAY_NAME/.test(plugin), 'CFBundleDisplayName is not pinned');
  return 'PRODUCT_NAME Selodia, the two bundle names Selodía';
});

check('it fails loudly rather than silently doing nothing', () => {
  // A plugin that cannot find its anchor and shrugs produces a build that looks
  // fine and is wrong where nobody looks - which is how this survived at all.
  ok(/throw new Error/.test(plugin), 'the plugin does not throw when it finds no PRODUCT_NAME');
  return 'throws when it finds nothing to set';
});

check('the misspelling appears nowhere in the shipped config', () => {
  const raw = readFileSync('mobile/app.json', 'utf8');
  ok(!/Seloda[^a-zí]/i.test(raw.replace(/Selodia|Selodía/g, '')), 'app.json contains "Seloda"');
  return 'not in app.json';
});

check('and this check can fail', () => {
  // Prove each assertion is testing something, not passing on an empty string.
  assert.strictEqual(expoSanitise('Selodía'), 'Seloda', 'the sanitiser copy is wrong');
  assert.strictEqual(expoSanitise('Selodia'), 'Selodia', 'an unaccented name should survive intact');
  // A plugin file with the wrong name in it must be detected.
  ok(!/const PRODUCT_NAME = 'Seloda'/.test(plugin), 'the plugin would ship the misspelling');
  ok(expo.name === 'Selodía', `expo.name is "${expo.name}", so these assertions are about the wrong app`);
  return 'the sanitiser, the plugin and the app name all read correctly';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
