// Does a weigh-in get FACTS, or room to invent?
//
// Ruth, 27 September 2026: "Add a test: a weigh-in with no activity logged in
// the previous 3 days must not produce any claim about exercise."
//
// WHAT THIS CAN AND CANNOT PROVE, stated plainly because the difference
// matters. It tests the half that is deterministic: what the app puts in front
// of the model. It cannot test what the model then writes, because that would
// need a real call and would be flaky in exactly the way a guard must not be.
//
// So the standard here is: when nothing is logged, the block must SAY nothing
// is logged, in terms that cannot be read as an invitation. A list the model
// has to notice is empty is what produced "you had a hard session a day or two
// ago" in the first place.

import { weighInFacts } from '../app/lib/weigh-in-facts.ts';

const TODAY = new Date('2026-09-27T09:00:00Z');

// Her real record for that week: one reading on the 24th, two minutes of
// pushups on the 24th, nothing else.
const HER_MEASUREMENTS = [
  { measured_at: '2026-09-24T08:16:00Z', weight_kg: 55.58, body_fat_pct: 27.9 },
];
const PUSHUPS = [
  { happened_at: '2026-09-24T18:00:00Z', activity_type: 'pushups', duration_min: 2, intensity: 'light' },
];

let failed = 0;
const check = (name, ok, detail) => {
  if (!ok) failed++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${detail && !ok ? `\n          ${detail}` : ''}`);
};

console.log('\n  A WEIGH-IN GETS FACTS, NOT ROOM TO INVENT\n');

// 1. THE LIVE ONE. No activity at all in the window.
{
  const block = weighInFacts(HER_MEASUREMENTS, [], [], TODAY);
  check(
    'no activity logged: the block says so in as many words',
    /NOTHING AT ALL IS LOGGED/.test(block),
    block
  );
  check(
    'no activity logged: it forbids the exact sentence she saw',
    /hard session/.test(block) && /may not say/.test(block),
    block
  );
}

// 2. Two minutes of pushups is not a hard session, and the block says the size.
{
  const block = weighInFacts(HER_MEASUREMENTS, PUSHUPS, [], TODAY);
  check('activity logged: it is listed with its date and duration', /2026-09-24: pushups, 2 min/.test(block), block);
  check(
    'activity logged: it says two minutes does not explain a kilogram',
    /does not explain a kilogram/.test(block),
    block
  );
}

// 3. THE DATE IS A FACT, not an estimate. Her reply said "2 days ago" when it
//    was three.
{
  const block = weighInFacts(HER_MEASUREMENTS, [], [], TODAY);
  check('the previous reading carries its real date', /2026-09-24/.test(block), block);
  check('and how long ago that actually was', /3 days earlier/.test(block), block);
  check('and it forbids guessing an interval', /never say "a couple of days ago"/.test(block), block);
}

// 4. ROUND EACH FIGURE, THEN SUBTRACT. 55.58 shows as 55.6, and 56.9 - 55.6 is
//    1.3 - which is what the screen says. Rounding the difference gives 1.4.
{
  const block = weighInFacts(HER_MEASUREMENTS, [], [], TODAY);
  check('the previous weight is given as the screen rounds it (55.6)', /55\.6 kg/.test(block), block);
  check('and it is told to round before subtracting', /ROUND EACH FIGURE TO ONE DECIMAL PLACE AND THEN SUBTRACT/.test(block), block);
  // The arithmetic this produces, checked here rather than trusted.
  const shown = Math.round(55.58 * 10) / 10;
  const delta = Math.round((56.9 - shown) * 10) / 10;
  check(`round-then-subtract gives 1.3, not 1.4 (got ${delta})`, delta === 1.3);
}

// 5. Salt is only claimable when the log supports it.
{
  const none = weighInFacts(HER_MEASUREMENTS, [], [], TODAY);
  check('no food logged: a salty day may not be offered as the reason', /do not suggest a salty day/.test(none), none);

  const salty = weighInFacts(
    HER_MEASUREMENTS,
    [],
    [{ happened_at: '2026-09-27T12:00:00Z', sodium_mg: 2600 }],
    TODAY
  );
  check('food logged with sodium: the figure is given', /2600 mg of sodium/.test(salty), salty);
  check('and it is one possibility, not the cause', /rather than as the cause/.test(salty), salty);
}

// 6. Nothing on record at all must not become a "change".
{
  const block = weighInFacts([], [], [], TODAY);
  check('no previous reading: it may not be called a rise or a fall', /do not describe it as a rise/.test(block), block);
}

console.log(`\n  ${failed === 0 ? 'all checks pass' : `${failed} FAILED`}\n`);
process.exit(failed ? 1 : 0);
