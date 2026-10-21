// MEETING THE GUIDANCE FILLS THE PETAL.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-flower-calibration.mjs
//
// WEEKLY_TARGET is 200 and health-flower.ts has always said so apologetically:
// "a choice, not a measurement... deliberately one number in one place, because
// it will want tuning once there is a real week of data to look at."
//
// On 21 October 2026 there was real data, and Ruth asked to open that lock. Her
// own last seven days read strength 78% from two sessions, which looked
// generous-to-wrong and looked like the number needed lowering.
//
// IT DID NOT. Tested against the guidance the six dimensions actually rest on,
// 200 lands almost exactly right:
//
//   two weightlifting sessions      strength  95   (WHO: strengthening 2+ days a week)
//   three runs                      cardio   100   (WHO: 150 min moderate a week)
//   three yoga                      balance  100   (WHO: balance 3+ days a week, 65+)
//   two walks                       cardio    45   (honest about a gentle week)
//
// What made her week look thin was not the target. It was that a third of her
// logged sessions carried no classification at all and counted for nothing -
// see classify-activity.ts. Lowering the target would have hidden that bug
// behind a fuller drawing.
//
// SO THIS PINS THE CALIBRATION RATHER THAN THE NUMBER. If somebody changes
// WEEKLY_TARGET, or changes a weighting, this says whether the flower still
// means "you met the guidance" - which is the only thing that makes a full
// petal worth anything.

import assert from 'node:assert';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const here = (p) => pathToFileURL(path.join(process.cwd(), p)).href;
const { coverageFor } = await import(here('mobile/src/lib/activity-weights.ts'));
const { coverageFromRows, DIMENSIONS, WEEKLY_TARGET } = await import(
  here('mobile/src/lib/health-flower.ts')
);

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

/** A week of named activities, as the flower reads it. */
function week(names) {
  const rows = names.map((n) => {
    const c = coverageFor(n);
    if (!c) throw new Error(`"${n}" is no longer in the weighting table`);
    return {
      cover_strength: c.strength,
      cover_cardio: c.cardio,
      cover_flexibility: c.flexibility,
      cover_balance: c.balance,
      cover_bone: c.bone,
      cover_recovery: c.recovery,
    };
  });
  return coverageFromRows(rows, 1);
}

console.log('\n  DOES MEETING THE GUIDANCE FILL THE PETAL\n');

check('TWO STRENGTH SESSIONS NEARLY FILL STRENGTH', () => {
  // The WHO asks for muscle-strengthening on at least two days a week. Somebody
  // who does exactly that should see a strength petal that reads as done.
  const c = week(['weightlifting', 'weightlifting']);
  assert.ok(c.strength >= 90, `two strength sessions read ${c.strength}, which does not read as met`);
  // AND NOT BY FILLING EVERYTHING ELSE TOO. A target low enough to fill strength
  // on two sessions must not also fill flexibility, or the drawing stops
  // distinguishing anything.
  assert.ok(c.flexibility < 30, `lifting twice also filled flexibility to ${c.flexibility}`);
  assert.ok(c.recovery < 30, `lifting twice also filled recovery to ${c.recovery}`);
  return `strength ${c.strength}, flexibility ${c.flexibility}`;
});

check('AND THE CARDIO AND BALANCE GUIDANCE DO THE SAME', () => {
  const cardio = week(['running', 'running', 'running']);
  assert.ok(cardio.cardio >= 95, `three runs read ${cardio.cardio} cardio`);
  // Balance work on three or more days a week, which is the guidance for 65+.
  const balance = week(['yoga', 'yoga', 'yoga']);
  assert.ok(balance.balance >= 95, `three yoga sessions read ${balance.balance} balance`);
  return `cardio ${cardio.cardio}, balance ${balance.balance}`;
});

check('A GENTLE WEEK STILL LOOKS LIKE A GENTLE WEEK', () => {
  // The other half, and the one a lower target would have broken. If two walks
  // read as a full week, a full petal stops meaning anything at all.
  const c = week(['walking', 'walking']);
  for (const d of DIMENSIONS) {
    assert.ok(c[d] < 60, `two walks filled ${d} to ${c[d]}`);
  }
  return 'nothing over 60';
});

check('AND A BROAD WEEK READS AS BROAD WITHOUT BEING PERFECT', () => {
  // Four different sessions should reach most of the six and still leave
  // something to notice - a drawing that is full whenever somebody is active
  // has stopped being a drawing of anything.
  const c = week(['weightlifting', 'running', 'yoga', 'ballet']);
  const high = DIMENSIONS.filter((d) => c[d] >= 75).length;
  assert.ok(high >= 4, `a broad week only reached 75 on ${high} of six`);
  assert.ok(high < 6, 'a broad week fills every petal, so the drawing says nothing');
  return `${high} of six at 75 or more`;
});

check('THE TARGET IS STILL ONE NUMBER IN ONE PLACE', () => {
  // Its own comment: "deliberately one number in one place, because it will
  // want tuning". That only holds while nothing else hard-codes it.
  assert.strictEqual(typeof WEEKLY_TARGET, 'number', 'WEEKLY_TARGET is gone');
  assert.ok(WEEKLY_TARGET > 0, 'the target is not a positive number');
  return `${WEEKLY_TARGET}, and the cases above are what it means`;
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
