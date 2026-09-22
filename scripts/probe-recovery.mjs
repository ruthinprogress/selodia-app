// REST IS SOMETHING THE BODY DOES, NOT SOMETHING THAT HAPPENS WHEN YOU STOP.
//
// Ruth, 22 September 2026: "the Health flower in Today is empty, but I'm pretty
// sure I've been resting since i've not been doing workouts, so we need to
// discuss how the rest gets activated."
//
//   npx tsx scripts/probe-recovery.mjs

import {
  NIGHT_MAX,
  REST_DAY_POINTS,
  daysOfWeek,
  nightQuality,
  recoveryFromRestDays,
  recoveryFromSleep,
} from '../mobile/src/lib/recovery.ts';

let passed = 0;
let failed = 0;

function group(name) { console.log(`\n  ${name.toUpperCase()}\n`); }
function check(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) { passed += 1; console.log(`  PASS  ${name}`); }
  else { failed += 1; console.log(`  FAIL  ${name}\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`); }
}
function near(name, got, want, slack = 0.001) {
  if (Math.abs(got - want) <= slack) { passed += 1; console.log(`  PASS  ${name}`); }
  else { failed += 1; console.log(`  FAIL  ${name}\n        got  ${got}\n        want ~${want}`); }
}

const night = (o = {}) => ({ night_of: '2026-09-21', duration_min: 480, quality: 'good', awakenings: 0, ...o });

group('what a night is worth');

check('eight hours, slept well', nightQuality(night()), 1);
check('seven hours is still the band', nightQuality(night({ duration_min: 420 })), 1);
// MORE IS NOT BETTER, BUT IT IS NOT BAD EITHER. A ten hour night is usually a
// body catching up or a body struggling; it scores below a settled eight and
// well above a broken five. This used to land on 0.75 by falling through the
// bands rather than by anyone deciding it.
check('ten hours is good but not better', nightQuality(night({ duration_min: 600 })), 0.9);
check('nine and a half is still the band', nightQuality(night({ duration_min: 570 })), 1);
check('six and a half hours', nightQuality(night({ duration_min: 390 })), 0.75);
check('five and a half', nightQuality(night({ duration_min: 330 })), 0.5);
check('four hours', nightQuality(night({ duration_min: 240 })), 0.3);

group('how it felt counts too');

check('good', nightQuality(night({ quality: 'good' })), 1);
check('ok', nightQuality(night({ quality: 'ok' })), 0.8);
check('broken', nightQuality(night({ quality: 'broken' })), 0.5);
check('poor', nightQuality(night({ quality: 'poor' })), 0.3);
// UNSAID IS NOT BAD. Somebody who logged hours and no word is not penalised.
check('nothing said about how it felt', nightQuality(night({ quality: null })), 0.85);
// AND NOTHING SAID ABOUT LENGTH IS STILL SOMETHING. "Slept badly" is a real entry.
near('badly, with no hours', nightQuality(night({ duration_min: null, quality: 'poor' })), 0.18);

group('waking repeatedly');

// It is the continuity that does the repairing.
check('three wakings takes something off', nightQuality(night({ awakenings: 3 })), 0.85);
check('two does not', nightQuality(night({ awakenings: 2 })), 1);

group('a week of sleep against the petal');

const week = (q) => Array.from({ length: 7 }, (_, i) => night({ night_of: `2026-09-${15 + i}`, quality: q }));
// SEVEN GOOD NIGHTS VERY NEARLY FILLS IT, which is the point: sleeping well all
// week is real recovery and should look like it.
check('seven good nights', recoveryFromSleep(week('good')), NIGHT_MAX * 7);
check('seven poor nights is a fraction of that', recoveryFromSleep(week('poor')), Math.round(NIGHT_MAX * 7 * 0.3));
check('nothing logged is nothing earned', recoveryFromSleep([]), 0);
// A WEEK OF SLEEPING BADLY AND A WEEK OF SLEEPING WELL MUST NOT LOOK THE SAME.
// That was the whole complaint about the old flower.
check('and the two weeks differ', recoveryFromSleep(week('good')) > recoveryFromSleep(week('poor')) * 2, true);
check('the same night twice counts once', recoveryFromSleep([night(), night()]), NIGHT_MAX);
check('a row with no date is ignored', recoveryFromSleep([{ night_of: '', duration_min: 480, quality: 'good', awakenings: 0 }]), 0);

group('a rest day only counts if there was something to recover from');

const DAYS = ['2026-09-21', '2026-09-22', '2026-09-23'];
const hard = { happened_at: '2026-09-21T10:00:00Z', intensity: 'intense', eccentric_load: 'high' };
const easy = { happened_at: '2026-09-21T10:00:00Z', intensity: 'light', eccentric_load: 'none' };

check('the day after a hard session', recoveryFromRestDays([hard], DAYS), REST_DAY_POINTS);
// THIS IS THE DISTINCTION THE WHOLE THING RESTS ON: an empty calendar is not
// recovery, or a week of doing nothing would score full marks.
check('an empty week earns nothing', recoveryFromRestDays([], DAYS), 0);
check('the day after an easy session earns nothing', recoveryFromRestDays([easy], DAYS), 0);
// A DAY YOU TRAINED IS NOT A REST DAY, however hard yesterday was.
check(
  'training the next day is not resting',
  recoveryFromRestDays([hard, { happened_at: '2026-09-22T10:00:00Z', intensity: 'light', eccentric_load: 'low' }], DAYS),
  0
);
check('moderate eccentric load counts as load', recoveryFromRestDays([{ happened_at: '2026-09-21T10:00:00Z', intensity: 'moderate', eccentric_load: 'moderate' }], DAYS), REST_DAY_POINTS);
check('a bad timestamp is skipped', recoveryFromRestDays([{ happened_at: 'whenever', intensity: 'intense', eccentric_load: 'high' }], DAYS), 0);

group('the week itself');

const days = daysOfWeek(new Date('2026-09-21T00:00:00'));
check('seven days', days.length, 7);
check('starting on the Monday given', days[0], '2026-09-21');
check('ending on the Sunday', days[6], '2026-09-27');

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
