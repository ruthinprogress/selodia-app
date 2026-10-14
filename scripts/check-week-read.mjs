// THE WEEK IS READ ACROSS THE DOMAINS, AND THE FIGURES ARE NOT THE MODEL'S.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-week-read.mjs
//
// Ruth, 14 October 2026: "it should really scan across all recorded data for
// the week and explain anything that comes up. could be ovulation week, mood
// has been very high due to exciting personal news, or ill and sedentary or
// anything that had been recorded that has an effect on anything else"
//
// And the reason it belongs in the chat at all, rather than on a screen: "In
// selodia, i'd just go an look at the weekly table with the average at the
// bottom and i might ask something more like, if i stay on this trjectory,
// what's the predicted fat loss this week." The tabs each show one domain. The
// chat's job is what no tab can do, which is how they bear on each other.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { weekReadBlock } = await import(root + '/app/lib/week-read.ts');

const route = readFileSync('app/api/ask-selodia/route.ts', 'utf8').split('\r\n').join('\n');

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

const TODAY = '2026-10-14';
const day = (n) => new Date(Date.parse(`${TODAY}T12:00:00Z`) - n * 86_400_000).toISOString();

/** A week with something in every domain, so the block can be read whole. */
const FULL = {
  today: TODAY,
  lastPeriod: '2026-10-01',
  food: [
    { happened_at: day(0), kcal: 600, protein_g: 40 },
    { happened_at: day(0), kcal: 400, protein_g: 20 },
    { happened_at: day(1), kcal: 1800, protein_g: 90 },
    { happened_at: day(2), kcal: 1600, protein_g: 80 },
    // Outside the window, and must not be counted.
    { happened_at: day(20), kcal: 9999, protein_g: 999 },
  ],
  activity: [
    { happened_at: day(1), activity_type: 'run', duration_min: 60, intensity: 'hard' },
    { happened_at: day(3), activity_type: 'HIIT', duration_min: 30, intensity: 'hard' },
  ],
  dailyBurn: [{ date: TODAY, steps: 8000, kcal_burned: 2100 }],
  drinks: [{ ml: 2000, happened_at: day(0) }],
  sleep: [
    { night_of: day(1), duration_min: 300, quality: 'poor', awakenings: 3 },
    { night_of: day(2), duration_min: 420, quality: 'ok', awakenings: 1 },
  ],
  measurements: [
    { measured_at: day(6), weight_kg: 64.0, body_fat_pct: 26 },
    { measured_at: day(0), weight_kg: 63.4, body_fat_pct: 25.8 },
  ],
};

console.log('\n  THE WEEK, READ ACROSS THE DOMAINS\n');

check('every domain gets a line, including the empty ones', () => {
  const bare = weekReadBlock({
    today: TODAY,
    lastPeriod: null,
    food: [], activity: [], dailyBurn: [], drinks: [], sleep: [], measurements: [],
  });
  // A block with no sleep line reads as an app that does not track sleep. The
  // same rule turn-facts.ts and the roundup card both keep.
  for (const domain of ['Food:', 'Movement:', 'Sleep:', 'Water:', 'Body:']) {
    assert.ok(bare.includes(domain), `${domain} vanishes when there is nothing in it`);
  }
  assert.ok(/nothing logged this week/.test(bare), 'an empty week does not say it is empty');
  return 'five domains, stated empty';
});

check('the arithmetic is done here, correctly, and only over the window', () => {
  const b = weekReadBlock(FULL);
  // 3 days logged: 1000, 1800, 1600 -> 1466.67 -> 1467
  assert.ok(/3 of 7 days logged/.test(b), `days logged wrong:\n${b}`);
  assert.ok(/averaging 1467 kcal/.test(b), `kcal average wrong:\n${b}`);
  // protein 60, 90, 80 -> 76.67 -> 77
  assert.ok(/77g protein/.test(b), `protein average wrong:\n${b}`);
  // The 20-day-old meal must not reach any of it.
  assert.ok(!/9999|999g/.test(b), 'a row outside the 7-day window was counted');
  return '3 days, 1467 kcal, 77g';
});

check('sleep says how short, because that is what interacts', () => {
  const b = weekReadBlock(FULL);
  assert.ok(/2 night\(s\) logged/.test(b), `nights wrong:\n${b}`);
  assert.ok(/averaging 6\.0 hours/.test(b), `sleep average wrong:\n${b}`);
  assert.ok(/1 of them under 6 hours/.test(b), 'short nights are not counted');
  assert.ok(/waking 2\.0 times a night/.test(b), 'awakenings are not averaged');
  return 'hours, short nights and wakings';
});

check('a weight change is given but never called fat', () => {
  const b = weekReadBlock(FULL);
  assert.ok(/a change of -0\.6 kg/.test(b), `weight change wrong:\n${b}`);
  assert.ok(/do not call this fat lost or gained/.test(b), 'a week of readings may be read as fat');
  // One reading is not a trend, and says so.
  const single = weekReadBlock({ ...FULL, measurements: [FULL.measurements[0]] });
  assert.ok(/One reading is not a trend/.test(single), 'a single weigh-in is presented as a trend');
  return '-0.6 kg, and not fat';
});

check('the cycle day is worked out, because no tab shows it against the rest', () => {
  const b = weekReadBlock(FULL);
  // 1 October to 14 October is 13 days, so day 14.
  assert.ok(/Cycle: day 14, counting from 2026-10-01/.test(b), `cycle day wrong:\n${b}`);
  const none = weekReadBlock({ ...FULL, lastPeriod: null });
  assert.ok(!/Cycle:/.test(none), 'a cycle day is claimed with no period on record');
  // And a stale date is not turned into day 400.
  const old = weekReadBlock({ ...FULL, lastPeriod: '2025-01-01' });
  assert.ok(!/Cycle:/.test(old), 'a period from last year still produces a cycle day');
  return 'day 14';
});

check('it is told to read across, and to say when there is nothing to say', () => {
  const b = weekReadBlock(FULL);
  assert.ok(/READ ACROSS THESE, NOT DOWN ONE/.test(b), 'nothing asks for the cross-domain reading');
  assert.ok(/what it interacts with/.test(b), 'the interaction is not named as the point');
  // THE FAILURE MODE OF THIS FEATURE IS FINDING MEANING IN NOISE, and that
  // costs more trust than staying quiet ever would.
  assert.ok(/NOTHING TO SAY/.test(b), 'it is never allowed to find the week unreadable');
  assert.ok(/noise with a story attached/.test(b), 'the noise warning is gone');
  return 'read across, and allowed to decline';
});

check('the figures are forbidden to the model', () => {
  const b = weekReadBlock(FULL);
  assert.ok(/do not recalculate them/.test(b), 'the model may redo the arithmetic');
  assert.ok(/do not state a figure that is not here/.test(b), 'the model may invent a figure');
  return 'computed once, in code';
});

check('both the classifier and the writer get it', () => {
  assert.ok(/const weekReadContextBlock = weekReadBlock\(\{/.test(route), 'the week is never computed');
  assert.ok(/\$\{weekReadContextBlock \? /.test(route), 'the classifier does not see it');
  const uses = route.match(/^\s+weekReadContextBlock,$/gm) ?? [];
  assert.ok(uses.length >= 2, `only ${uses.length} writer block list(s) carry it`);
  // AND IT COSTS NO ROUND TRIP, which is the reason it can exist at all given
  // a turn already takes 9 to 28 seconds.
  assert.ok(
    /food: recentFood \?\? \[\]/.test(route),
    'the week is built from a fresh query rather than the rows already loaded'
  );
  return 'classifier, writers, no extra query';
});

check('and this check can fail', () => {
  // The old world: no block at all.
  assert.strictEqual(weekReadBlock({ ...FULL, today: 'not-a-date' }), '', 'a bad date still produces a block');
  // And a week whose average is computed over 7 rather than the days logged
  // would give 629, not 1467.
  const over7 = Math.round((1000 + 1800 + 1600) / 7);
  assert.notStrictEqual(over7, 1467, 'the two ways of averaging agree, so this proves nothing');
  return 'averaging over seven days gives 629, not 1467';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
