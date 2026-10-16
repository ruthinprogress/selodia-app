// EVERY SPOTLIGHT TARGET POINTS AT SOMETHING THAT EXISTS.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-spotlight-targets-are-real.mjs
//
// The spotlight is the app dimming the screen and pulsing the thing somebody
// asked where to find. The model chooses the target by id, from a list handed
// to it in the prompt, and the id is validated against a registry - so an id
// that is in the registry but attached to no element passes every check there
// was and highlights nothing. Silent, on the one feature whose entire job is
// to show somebody where a thing is.
//
// WHAT WAS FOUND, 16 October 2026. Three of nineteen were dead:
// `almanac.tabs`, `measurements.week` and `food.entries`. All three were
// offered to the model on every typed turn.
//
// AND NINE MORE NAMED A SCREEN THAT NO LONGER EXISTS. The descriptions said
// "on Today" and "the Almanac's Me view"; the tab bar says Now, and Me became
// a tab of its own. spotlight-targets.ts already carried a note about having
// been through exactly this in September - "when a screen changes, update
// app-structure.ts in the same pass" - which is the proof that a convention
// alone did not hold it. It drifted twice, silently, and both times it was
// found by checking rather than by reading.
//
// THE OTHER HALF OF THE SAME PROBLEM, and why this is worth a check rather
// than a careful pass: the block that lists these ids also says, two
// paragraphs earlier, "NEVER INVENT A CONTROL... never send someone to a
// screen, tab, menu, setting, button or option that is not named above". A
// stale description does not break that rule, it makes the rule a liar.

import assert from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { SPOTLIGHT_TARGETS } = await import(root + '/app/lib/spotlight-targets.ts');

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

/** Every line of the app's own source, so an id can be looked for in it. */
function sources(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push({ full, text: readFileSync(full, 'utf8') });
  }
  return out;
}
const app = sources('mobile/src');
const ids = Object.keys(SPOTLIGHT_TARGETS);

console.log('\n  SPOTLIGHT TARGETS ARE REAL\n');

check('the server and the phone offer the same ids', () => {
  const mobile = readFileSync('mobile/src/lib/spotlight.ts', 'utf8');
  const listed = [...mobile.matchAll(/'([a-z]+\.[a-z]+)'/g)].map((m) => m[1]);
  const inMobile = new Set(listed);
  for (const id of ids) assert.ok(inMobile.has(id), `the server offers ${id} and the phone does not know it`);
  for (const id of listed) {
    assert.ok(ids.includes(id), `the phone lists ${id} and the server never offers it`);
  }
  return `${ids.length} ids, both sides`;
});

check('EVERY ID IS ATTACHED TO SOMETHING THE PERSON CAN SEE', () => {
  // The whole point. An id rendered nowhere highlights nothing, and nothing is
  // exactly what it looks like when it is working.
  const dead = ids.filter((id) => {
    // Attached literally, or through a variable whose type names the id - the
    // three Today headings bind that way and a literal search misses them.
    return !app.some(({ text }) => text.includes(`"${id}"`) || text.includes(`'${id}'`));
  });
  assert.deepStrictEqual(dead, [], `declared to the model and rendered nowhere: ${dead.join(', ')}`);
  return `${ids.length} ids, all rendered`;
});

check('no description names a screen the app does not have', () => {
  // The tab bar is the authority on what the tabs are called.
  const tabs = readFileSync('mobile/src/components/app-tabs.tsx', 'utf8');
  const labels = [...tabs.matchAll(/<NativeTabs\.Trigger\.Label>([^<]+)</g)].map((m) => m[1].trim());
  assert.ok(labels.length >= 4, `only found ${labels.length} tab labels`);

  // Names that USED to be tabs and are not any more. A description mentioning
  // one of these is the drift this check exists for.
  const gone = ['Today', 'Body tab', 'the Almanac tab'];
  for (const [id, text] of Object.entries(SPOTLIGHT_TARGETS)) {
    for (const old of gone) {
      assert.ok(
        !new RegExp(`\\b${old}\\b`).test(text),
        `${id} still says "${old}"; the tabs are ${labels.join(', ')}`
      );
    }
  }
  return `tabs are ${labels.join(', ')}`;
});

check('and this check can fail', () => {
  // The version that was in place until today: the id is in the registry, so
  // it is valid. That passed for all three of the dead ones.
  const registryOnly = (id) => Object.hasOwn(SPOTLIGHT_TARGETS, id);
  assert.strictEqual(registryOnly('settings.delete'), true, 'a live id is not in the registry');
  // A dead id would also have passed that, which is why it is not the test.
  const rendered = (id) => app.some(({ text }) => text.includes(`'${id}'`) || text.includes(`"${id}"`));
  assert.strictEqual(rendered('almanac.tabs'), false, 'almanac.tabs is rendered after all, so it should be restored');
  return 'being in the registry proves nothing; being on screen does';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
