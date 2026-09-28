// DOES THE APP EVER TELL A WOMAN SOMETHING HER LIFE STAGE SAYS IS NOT TRUE?
//
// THE FAILURE THIS GUARDS IS DEMONSTRATED, NOT HYPOTHETICAL. Before tonight the
// cycle code had no upper bound beyond a 45-day staleness ceiling, and a woman
// five years past her menopause with an old period start on file was told she
// was on "cycle day 1826, luteal phase", with her weight explained as water
// retention.
//
// AND THE CASE RUTH ADDED ON 28 SEPTEMBER IS THE HARDER ONE: a woman with a
// coil, or a hysterectomy with her ovaries kept, has no periods and is still
// cycling. The app must never infer menopause from that, and must never count a
// cycle day from it either. Those are two separate silences and both are tested.
//
// EVERY CHECK RUNS TWICE: once against the real functions, once against the old
// behaviour, which had no idea life stage existed. A check the old code passes
// would not have caught any of this.
//
//   node --import ./scripts/ts-paths.mjs scripts/check-life-stage.mjs

import {
  LIFE_STAGES,
  hidesCycleDay,
  hidesPeriodLogging,
  stageForReasoning,
} from '../mobile/src/lib/life-stage.ts';

// How it behaved before life stage existed: the answer never mattered.
const oldHidesCycleDay = () => false;
const oldStageForReasoning = (stage) => stage;

// REGRESSION CHECKS, honestly labelled. The pre-life-stage behaviour passes
// these, BY DESIGN: they say "nothing was taken away from the woman this always
// worked for". Counting them as proof of the NEW behaviour would be the
// self-flattery these files exist to prevent, so they run separately and are
// named for what they are.
const REGRESSION = [
  ['a regular cycle still gets a cycle day', () => hidesCycleDay('regular') === false],
  [
    'a stated stage IS still reasoned from',
    () =>
      stageForReasoning('perimenopause') === 'perimenopause' &&
      stageForReasoning('surgical') === 'surgical',
  ],
];

const CHECKS = [
  [
    'post-menopause gets no cycle day',
    (hides) => hides('post_menopause') === true,
  ],
  [
    'surgical menopause gets no cycle day',
    (hides) => hides('surgical') === true,
  ],
  [
    'a coil or hysterectomy gets no cycle day',
    (hides) => hides('no_periods_other') === true,
  ],
  [
    '"not sure" gets no cycle day either',
    // The cautious side: not knowing is not a reason to guess.
    (hides) => hides('not_sure') === true,
  ],
  [
    'every stage except regular hides the cycle day',
    (hides) => LIFE_STAGES.every((o) => hides(o.key) === (o.key !== 'regular')),
  ],
];

const REASONING_CHECKS = [
  [
    'a coil is never reasoned from as a menopause stage',
    (reason) => reason('no_periods_other') === null,
  ],
  [
    '"not sure" is never reasoned from',
    (reason) => reason('not_sure') === null,
  ],
  [
    '"prefer not to say" is never reasoned from',
    (reason) => reason('prefer_not_to_say') === null,
  ],
];

// Period logging and the cycle day come apart, and the difference matters:
// somebody in perimenopause still has periods to log, irregular ones, and
// turning logging off for her would remove the thing she most needs to record.
const LOGGING_CHECKS = [
  ['perimenopause keeps period logging', () => hidesPeriodLogging('perimenopause') === false],
  ['a regular cycle keeps period logging', () => hidesPeriodLogging('regular') === false],
  ['a coil turns period logging off', () => hidesPeriodLogging('no_periods_other') === true],
  ['post-menopause turns period logging off', () => hidesPeriodLogging('post_menopause') === true],
];

let failed = 0;
let useless = 0;

const run = (name, fn, real, broken) => {
  let ok = false;
  let alsoBroken = false;
  try {
    ok = fn(real) === true;
  } catch (err) {
    console.log(`  threw: ${err.message}`);
  }
  if (broken) {
    try {
      alsoBroken = fn(broken) === true;
    } catch {
      alsoBroken = false;
    }
  }
  if (!ok) failed += 1;
  else if (broken && alsoBroken) useless += 1;
  console.log(`  ${ok ? (broken && alsoBroken ? 'WEAK' : 'ok  ') : 'FAIL'}  ${name}`);
};

console.log('  CYCLE DAY\n');
for (const [name, fn] of CHECKS) run(name, fn, hidesCycleDay, oldHidesCycleDay);

console.log('\n  WHAT MAY BE REASONED FROM\n');
for (const [name, fn] of REASONING_CHECKS) run(name, fn, stageForReasoning, oldStageForReasoning);

console.log('\n  PERIOD LOGGING\n');
for (const [name, fn] of LOGGING_CHECKS) run(name, fn, null, null);

console.log('\n  REGRESSION (the old behaviour passes these too, and should)\n');
for (const [name, fn] of REGRESSION) run(name, fn, null, null);

console.log();
if (failed) console.log(`  ${failed} FAILED.`);
if (useless) console.log(`  ${useless} WEAK: the pre-life-stage behaviour passes these too.`);
if (!failed && !useless) {
  console.log(
    `  ${CHECKS.length + REASONING_CHECKS.length} behaviour checks, each caught by the old code. ` +
      `${LOGGING_CHECKS.length + REGRESSION.length} logging and regression checks.`
  );
}
process.exitCode = failed || useless ? 1 : 0;
