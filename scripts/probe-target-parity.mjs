// Do the server and the client agree about what somebody's calorie target is?
//
// `calculateCalorieTarget` now exists twice: in `mobile/src/lib/calorie-target.ts`,
// where the Overview renders from it, and in `app/lib/daily-targets.ts`, where the
// chat pipeline reads it. The duplication is deliberate - there is no shared
// package across the Next/Expo boundary, and `body-metrics.ts` is already mirrored
// the same way - but deliberate duplication still drifts.
//
// THIS PROJECT HAS ALREADY BEEN BITTEN BY EXACTLY THIS. The onboarding opener is
// quoted in three places, and a comment claimed a "parity test" kept them honest
// when no such test existed anywhere in the repository. That comment was written
// describing an intention and read as a guarantee. This is the thing that comment
// described, for a different pair of files, and it actually runs.
//
// If the two ever disagree, the person sees one calorie target on the Overview and
// is advised against a different one in chat, with nothing on screen to explain
// the gap. That is the failure this prevents.
//
//   npx tsx scripts/probe-target-parity.mjs

import { calculateCalorieTarget as server } from '../app/lib/daily-targets.ts';
import { calculateCalorieTarget as client } from '../mobile/src/lib/calorie-target.ts';

// NULL AND UNDEFINED ARE IN THE MATRIX FROM 2026-09-28, and they are the
// combinations that matter most now. Both files stopped treating an unset focus
// as maintenance on that date, and a divergence there would mean one side
// showing a maintenance target while the other correctly shows none - which is
// worse than the drift this probe was written for, because it looks like data
// rather than like a bug.
const FOCUS = ['reduce', 'maintain', 'increase', null, undefined];

// TDEE and bodyweight values chosen to exercise the branches rather than to be
// realistic: a null TDEE, a null weight on the deficit path (which must return
// null rather than guess), and rounding boundaries either side of a multiple of 10.
const TDEES = [null, 0, 1487, 1490, 1495, 2000, 2317];
const WEIGHTS = [null, 0, 52.4, 68, 91.7];

// BMRs CHOSEN SO THE FLOOR ACTUALLY BITES (added 2026-10-02 with the floor).
//
// A parity probe over inputs that never reach the new branch proves parity of
// the old code and reports it as parity of all of it. The floor is the higher
// of her BMR and 1,200, so:
//
//   undefined  no BMR given, floor falls back to 1,200
//   null       the same, by the other spelling
//   1123       Ruth's own, below the absolute floor, so 1,200 wins
//   1400       above it, so the BMR wins
//   1900       high enough to clamp a 2,000 TDEE deficit hard
//
// At tdee 1487 and weight 91.7 the deficit is 655/day, which lands at 830 -
// well under either floor. That combination is the one this exists for.
const BMRS = [undefined, null, 1123, 1400, 1900];

let checked = 0;
let mismatched = 0;
// HOW MANY TIMES THE FLOOR ACTUALLY FIRED. Printed, because a probe that
// reports parity over inputs that never reach a branch is reporting parity of
// the code it did not run. If this is 0 the floor is untested and the suite
// says so rather than passing.
let floored = 0;

for (const fatFocus of FOCUS) {
  for (const muscleFocus of FOCUS) {
    for (const tdeeKcal of TDEES) {
      for (const weightKg of WEIGHTS) {
        for (const bmrKcal of BMRS) {
          const params = { tdeeKcal, weightKg, bmrKcal, fatFocus, muscleFocus };
          const a = JSON.stringify(server(params));
          const b = JSON.stringify(client(params));
          checked++;
          if (JSON.parse(a || 'null')?.flooredAt != null) floored++;
          if (a !== b) {
            mismatched++;
            console.log(
              `  MISMATCH  fat=${fatFocus} muscle=${muscleFocus} tdee=${tdeeKcal} weight=${weightKg} bmr=${bmrKcal}`
            );
            console.log(`      server: ${a}`);
            console.log(`      client: ${b}`);
          }
        }
      }
    }
  }
}

// The documented combinations, spelled out, so a change to the matrix has to be
// a deliberate edit here rather than something that slips through on totals.
const show = (v) => (v === null ? 'null' : v === undefined ? 'unset' : v);
console.log('\n  The matrix at TDEE 2000, 68kg:\n');
for (const fatFocus of FOCUS) {
  for (const muscleFocus of FOCUS) {
    const r = server({ tdeeKcal: 2000, weightKg: 68, fatFocus, muscleFocus });
    const recomp = r?.isRecomposition ? '  (recomposition)' : '';
    const outcome = r ? `${String(r.targetKcal).padStart(5)} kcal  ${r.mode}${recomp}` : '    no target';
    console.log(`    fat=${show(fatFocus).padEnd(8)} muscle=${show(muscleFocus).padEnd(8)} -> ${outcome}`);
  }
}

console.log(
  `\n  ${checked} combinations checked, ${mismatched} mismatched. ` +
    `The floor bit on ${floored} of them.\n`
);
if (floored === 0) {
  console.log(
    '  FAIL  the floor never fired, so this proves nothing about it. Add inputs that reach it.'
  );
  process.exit(1);
}
process.exit(mismatched > 0 ? 1 : 0);
