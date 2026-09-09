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

const FOCUS = ['reduce', 'maintain', 'increase'];

// TDEE and bodyweight values chosen to exercise the branches rather than to be
// realistic: a null TDEE, a null weight on the deficit path (which must return
// null rather than guess), and rounding boundaries either side of a multiple of 10.
const TDEES = [null, 0, 1487, 1490, 1495, 2000, 2317];
const WEIGHTS = [null, 0, 52.4, 68, 91.7];

let checked = 0;
let mismatched = 0;

for (const fatFocus of FOCUS) {
  for (const muscleFocus of FOCUS) {
    for (const tdeeKcal of TDEES) {
      for (const weightKg of WEIGHTS) {
        const params = { tdeeKcal, weightKg, fatFocus, muscleFocus };
        const a = JSON.stringify(server(params));
        const b = JSON.stringify(client(params));
        checked++;
        if (a !== b) {
          mismatched++;
          console.log(`  MISMATCH  fat=${fatFocus} muscle=${muscleFocus} tdee=${tdeeKcal} weight=${weightKg}`);
          console.log(`      server: ${a}`);
          console.log(`      client: ${b}`);
        }
      }
    }
  }
}

// The nine documented combinations, spelled out, so a change to the matrix has to
// be a deliberate edit here rather than something that slips through on totals.
console.log('\n  The 3x3 matrix at TDEE 2000, 68kg:\n');
for (const fatFocus of FOCUS) {
  for (const muscleFocus of FOCUS) {
    const r = server({ tdeeKcal: 2000, weightKg: 68, fatFocus, muscleFocus });
    const recomp = r?.isRecomposition ? '  (recomposition)' : '';
    console.log(`    fat=${fatFocus.padEnd(8)} muscle=${muscleFocus.padEnd(8)} -> ${String(r?.targetKcal).padStart(5)} kcal  ${r?.mode}${recomp}`);
  }
}

console.log(`\n  ${checked} combinations checked, ${mismatched} mismatched.\n`);
process.exit(mismatched > 0 ? 1 : 0);
