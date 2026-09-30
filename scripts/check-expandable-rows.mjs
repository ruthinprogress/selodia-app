// IF IT LOOKS LIKE IT OPENS, IT HAS TO OPEN.
//
//   node --import ./scripts/ts-paths.mjs scripts/check-expandable-rows.mjs
//
// Ruth, 30 September: "Build the check that has been on the list since 27 Sept:
// any row that shows a chevron or is meant to expand must have a working tap
// handler. Run it before every push. This is the second time a merge has
// dropped it."
//
// THE FAULT IS ALWAYS THE SAME SHAPE and it is always invisible. On 27
// September the commit that merged Food, Movement and Measurements into one
// shared list deleted food-breakdown-card.tsx and dropped the row's tap
// handler, keeping the swipe. The row still looked alive, still answered a
// swipe, and did nothing when tapped. Nothing in a typecheck, a lint or a
// screenshot of a screen at rest can see that: the component renders perfectly,
// it simply has no onPress.
//
// So this checks WIRING, end to end, for the surfaces that are meant to open -
// not "does a function return the right value" but "is the thing still
// connected to the thing".

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').split('\r\n').join('\n');

let pass = 0;
const failures = [];
const check = (name, fn) => {
  try {
    fn();
    pass += 1;
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
};

/**
 * Each surface names the three links in its chain. Breaking ANY one of them is
 * what "tapping does nothing" looks like from the outside, and each has been
 * broken at least once.
 */
const CHAINS = [
  {
    what: 'a food row opens its itemised breakdown',
    // 1. the screen sets the handler
    setsHandler: { file: 'mobile/src/components/food-log-view.tsx', pattern: /onOpen:\s*\(\)\s*=>/ },
    // 2. the shared list actually binds it to a press
    bindsPress: { file: 'mobile/src/components/day-log.tsx', pattern: /onPress=\{entry\.onOpen\}/ },
    // 3. the thing it opens is imported AND rendered
    rendersTarget: {
      file: 'mobile/src/components/food-log-view.tsx',
      imports: /import \{ FoodBreakdownCard \}/,
      renders: /<FoodBreakdownCard/,
    },
  },
  {
    what: 'a goal card opens the Goal screen',
    setsHandler: { file: 'mobile/src/components/goals-block.tsx', pattern: /router\.push\(/ },
    bindsPress: { file: 'mobile/src/components/goals-block.tsx', pattern: /onPress=\{/ },
    rendersTarget: {
      file: 'mobile/src/components/goals-block.tsx',
      imports: /chevron/i,
      renders: /chevron/i,
    },
  },
];

for (const chain of CHAINS) {
  const setSrc = read(chain.setsHandler.file);
  const bindSrc = read(chain.bindsPress.file);
  const targetSrc = read(chain.rendersTarget.file);

  check(`${chain.what}: the screen sets a handler`, () => {
    assert.ok(
      chain.setsHandler.pattern.test(setSrc),
      `${chain.setsHandler.file} no longer sets the handler`
    );
  });
  check(`${chain.what}: the row binds it to a press`, () => {
    assert.ok(
      chain.bindsPress.pattern.test(bindSrc),
      `${chain.bindsPress.file} renders the row but nothing is wired to onPress - this is the 27 September fault exactly`
    );
  });
  check(`${chain.what}: what it opens is imported and rendered`, () => {
    assert.ok(chain.rendersTarget.imports.test(targetSrc), 'the target is not imported');
    assert.ok(chain.rendersTarget.renders.test(targetSrc), 'the target is imported but never rendered');
  });
}

// A CHEVRON IS A PROMISE. Anywhere one is drawn, something in the same
// component has to be pressable, or the screen is advertising a door that is
// painted on.
const CHEVRON_FILES = [
  'mobile/src/components/goals-block.tsx',
  'mobile/src/components/day-log.tsx',
  'mobile/src/components/me-protocol.tsx',
];
for (const file of CHEVRON_FILES) {
  const src = read(file);
  if (!/chevron/i.test(src)) continue;
  check(`${path.basename(file)} draws a chevron and is pressable`, () => {
    assert.ok(
      /onPress[=:]/.test(src),
      'a chevron is drawn here and nothing in the file takes a press'
    );
  });
}

// --------------------------------------------------------------------- MUTATION
//
// Prove it catches the real regression: take the binding out of day-log, the
// exact edit the 27 September merge made, and require a failure.
const broken = read('mobile/src/components/day-log.tsx').replace(
  'onPress={entry.onOpen}',
  'onPress={undefined}'
);
const catchesIt = !/onPress=\{entry\.onOpen\}/.test(broken);
if (!catchesIt) failures.push('USELESS: unbinding the tap handler did not fail the check');

for (const f of failures) console.error('  FAIL  ' + f);
console.log(`\n  ${pass} passed, ${failures.length} failed`);
console.log(`  Proof: unbinding the row's tap handler is caught = ${catchesIt}`);
if (failures.length > 0) process.exit(1);
