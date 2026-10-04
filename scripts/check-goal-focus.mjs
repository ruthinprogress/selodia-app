// DOES A GOAL NOBODY CHOSE STAY UNCHOSEN?
//
// The defect this guards is the one found on 28 September: the focus columns
// were NOT NULL DEFAULT 'maintain', asFocus turned null into 'maintain' on both
// sides of the Next/Expo boundary, and onboarding never wrote them at all. So
// every user finished onboarding on a maintenance target that she had not asked
// for and that the app then showed her as hers. Ruth's own account was one of
// them, set to maintain/maintain while she trains for a muscle up.
//
// EVERY CHECK RUNS TWICE: once against the real mapping, and once against the
// old behaviour, which answers 'maintain' to everything. A check that passes
// against THAT is not checking anything, and the run refuses.
//
//   node --import ./scripts/ts-paths.mjs scripts/check-goal-focus.mjs

import {
  GOAL_OPTIONS,
  focusFromGoals,
} from '../mobile/src/lib/goals.ts';
import { calculateCalorieTarget } from '../app/lib/daily-targets.ts';

// The way it used to behave: silence reads as maintenance.
const asFocusOld = () => 'maintain';
const brokenFromGoals = () => ({ fat: asFocusOld(), muscle: asFocusOld() });

// [name, fn] tuples, because that is the shape this project's check files use.
// An object of {name, test} was tried once and the self-test refused it before
// a token was spent, which is the system working.
const CHECKS = [
  [
    'choosing nothing leaves both unstated',
    (f) => {
      const { fat, muscle } = f([]);
      return fat === null && muscle === null;
    },
  ],
  [
    'unstated means no calorie target, not a maintenance one',
    (f) => {
      const { fat, muscle } = f([]);
      const target = calculateCalorieTarget({
        tdeeKcal: 2000,
        weightKg: 65,
        fatFocus: fat,
        muscleFocus: muscle,
      });
      return target === null;
    },
  ],
  [
    'lose fat produces a deficit',
    (f) => {
      const { fat, muscle } = f(['lose_fat']);
      if (fat !== 'reduce') return false;
      const target = calculateCalorieTarget({
        tdeeKcal: 2000,
        weightKg: 65,
        fatFocus: fat,
        muscleFocus: muscle,
      });
      return target?.mode === 'deficit';
    },
  ],
  [
    'build muscle raises protein and does NOT add calories',
    (f) => {
      // INVERTED ON 4 OCTOBER 2026, and the inversion is the point. This used to
      // assert a surplus. Ruth's decision A: "Build muscle never adds calories on
      // its own; calories rise only when Gain weight is on."
      //
      // Building muscle at the weight she is now is recomposition - it needs the
      // protein, not extra food - and a control that quietly added 150 kcal a day
      // is the same fault as "Get stronger" setting a surplus, which she found
      // the same evening. The muscle focus must still move, or the choice means
      // nothing at all.
      const { fat, muscle } = f(['build_muscle']);
      if (muscle !== 'increase') return false;
      const target = calculateCalorieTarget({
        tdeeKcal: 2000,
        weightKg: 65,
        fatFocus: fat,
        muscleFocus: muscle,
      });
      return target?.mode === 'maintenance' && target.deltaKcal === 0;
    },
  ],
  [
    'lose fat AND build muscle is recomposition, not a deficit',
    (f) => {
      const { fat, muscle } = f(['lose_fat', 'build_muscle']);
      const target = calculateCalorieTarget({
        tdeeKcal: 2000,
        weightKg: 65,
        fatFocus: fat,
        muscleFocus: muscle,
      });
      return target?.mode === 'maintenance' && target.isRecomposition === true;
    },
  ],
  [
    'keep things steady is the only option that writes maintain on its own',
    (f) => {
      const steady = f(['keep_steady']);
      if (steady.fat !== 'maintain' || steady.muscle !== 'maintain') return false;
      // And no OTHER single option produces maintain on both.
      return GOAL_OPTIONS.filter((o) => o.key !== 'keep_steady').every((o) => {
        const r = f([o.key]);
        return !(r.fat === 'maintain' && r.muscle === 'maintain');
      });
    },
  ],
  [
    'a goal that speaks to neither focus leaves both unstated',
    (f) => {
      for (const key of ['more_energy', 'learn_a_skill', 'menopause']) {
        const { fat, muscle } = f([key]);
        if (fat !== null || muscle !== null) return false;
      }
      return true;
    },
  ],
  [
    'the specific answer beats the steady one when both are chosen',
    (f) => {
      const { fat, muscle } = f(['keep_steady', 'lose_fat']);
      return fat === 'reduce' && muscle === 'maintain';
    },
  ],
  [
    'no option raises muscle except the two that are meant to',
    (f) => {
      // GET STRONGER DID, and that was the fault: it wrote muscle 'increase',
      // identical to Build muscle, so ticking a training aspiration silently
      // added calories to somebody's daily figure. Removed 4 October 2026.
      //
      // Asserted through the MAPPING rather than by looking for a missing key,
      // so it catches the next chip that quietly does the same thing under a
      // different name - which is the actual risk, not this one key returning.
      // BOTH HALVES, because "nothing does X" passes trivially against a stub
      // where nothing does anything - which is exactly what the usefulness test
      // caught when this only asserted the absence.
      const allowed = new Set(['build_muscle', 'recomposition']);
      const noneElse = GOAL_OPTIONS.every((o) => {
        const { muscle } = f([o.key]);
        return muscle !== 'increase' || allowed.has(o.key);
      });
      const theseDo = [...allowed].every((key) => f([key]).muscle === 'increase');
      return noneElse && theseDo;
    },
  ],
  [
    'every option in the list has a stated effect',
    () => GOAL_OPTIONS.every((o) => typeof o.effect === 'string' && o.effect.length > 20),
  ],
];

let failed = 0;
let useless = 0;

for (const [name, run] of CHECKS) {
  let real;
  try {
    real = run(focusFromGoals) === true;
  } catch (err) {
    real = false;
    console.log(`  threw: ${err.message}`);
  }

  // Against the old behaviour. A check the old code also passes is a check that
  // would not have caught the defect, so it is reported as useless even when it
  // passes - except for the last one, which is about the list and not the
  // mapping, so the broken mapping is irrelevant to it.
  let broken;
  try {
    broken = run(brokenFromGoals) === true;
  } catch {
    broken = false;
  }

  const aboutTheList = name.startsWith('every option');
  const ok = real && (aboutTheList || !broken);
  if (!real) failed += 1;
  else if (!aboutTheList && broken) useless += 1;

  const mark = ok ? 'ok  ' : real ? 'WEAK' : 'FAIL';
  console.log(`  ${mark}  ${name}`);
}

console.log();
if (failed) console.log(`  ${failed} FAILED: the mapping is wrong.`);
if (useless) console.log(`  ${useless} WEAK: passes against the old maintain-everything behaviour too.`);
if (!failed && !useless) console.log(`  ${CHECKS.length} checks, all meaningful.`);
process.exitCode = failed || useless ? 1 : 0;
