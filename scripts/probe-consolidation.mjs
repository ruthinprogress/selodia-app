// When does the consolidation offer fire, and when must it not?
//
// This trigger asks somebody whether they still need the app, so the expensive
// mistake is firing it eagerly rather than missing it. Most of these check that
// it stays quiet. Pure, no API, free to run.
//
//   npx tsx scripts/probe-consolidation.mjs

import {
  assessConsolidation,
  CONSOLIDATION_DAYS,
  CONSOLIDATION_OFFER_BLOCK,
  isInLiteMode,
  LITE_MODE_STANDING_BLOCK,
} from '../app/lib/graduation.ts';

let pass = 0;
let fail = 0;
const check = (label, got, want) => {
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `   (got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)})`}`);
};

const ago = (days) => new Date(Date.now() - days * 86_400_000).toISOString();
const window = (fullDays, windowDays = 63) => ({
  windowDays, fullDays, isConsistent: fullDays === windowDays, currentRunDays: 0, missedDates: [],
});

// The eligible baseline: both at maintain for ten weeks, logging most days.
const base = {
  fatFocus: 'maintain', muscleFocus: 'maintain',
  fatSince: ago(70), muscleSince: ago(70),
  offeredAt: null, window: window(50),
};
const at = (over) => assessConsolidation({ ...base, ...over });

console.log(`\n  (the bar is ${CONSOLIDATION_DAYS} days at maintain, plus logging on more days than not)\n`);

console.log('  IT FIRES WHEN IT SHOULD\n');
check('ten weeks at maintain, logging steadily', at({}).eligible, true);
check('  and reports how long', at({}).daysSustained >= 70, true);
check('exactly at the bar', at({ fatSince: ago(63), muscleSince: ago(63) }).eligible, true);

console.log('\n  IT STAYS QUIET WHEN IT SHOULD\n');
check('one day short', at({ fatSince: ago(62), muscleSince: ago(62) }).eligible, false);
check('  reason is too-soon', at({ fatSince: ago(62), muscleSince: ago(62) }).reason, 'too-soon');
// The shorter of the two governs: both have to have held.
check('fat held ten weeks, muscle changed last week', at({ muscleSince: ago(7) }).eligible, false);
check('not at maintain (fat reducing)', at({ fatFocus: 'reduce' }).eligible, false);
check('  reason is not-maintaining', at({ fatFocus: 'reduce' }).reason, 'not-maintaining');
check('not at maintain (muscle increasing)', at({ muscleFocus: 'increase' }).eligible, false);
check('already asked', at({ offeredAt: ago(30) }).eligible, false);
check('  reason is already-asked', at({ offeredAt: ago(30) }).reason, 'already-asked');

console.log('\n  UNSTAMPED STATE IS NOT LONG-STANDING STATE\n');
check('no fat stamp', at({ fatSince: null }).eligible, false);
check('  reason is not-enough-data', at({ fatSince: null }).reason, 'not-enough-data');
check('no muscle stamp', at({ muscleSince: null }).eligible, false);
check('garbage stamp', at({ fatSince: 'whenever' }).eligible, false);

console.log('\n  "REAL, SUSTAINED WORK" HAS TO BE TRUE\n');
check('logged 50 of 63 days: offer', at({ window: window(50) }).eligible, true);
check('logged 32 of 63: just over half, offer', at({ window: window(32) }).eligible, true);
check('logged 31 of 63: under half, no offer', at({ window: window(31) }).eligible, false);
check('logged 2 of 63: away, not consolidating', at({ window: window(2) }).eligible, false);
check('  reason is not-enough-data', at({ window: window(2) }).reason, 'not-enough-data');
check('empty window', at({ window: window(0, 0) }).eligible, false);

console.log('\n  THE COPY DOES WHAT PART ELEVEN ASKS\n');
check('offer quotes the spec line', /fly solo for a while/.test(CONSOLIDATION_OFFER_BLOCK), true);
check('  explicitly not a celebration', /not a celebration/i.test(CONSOLIDATION_OFFER_BLOCK), true);
check('  forbids nudging either way', /not a nudge toward either answer/i.test(CONSOLIDATION_OFFER_BLOCK), true);
check('  asks once', /ask once/i.test(CONSOLIDATION_OFFER_BLOCK), true);
check('  shows no week count', /\b(nine weeks|63|weeks of)\b/i.test(CONSOLIDATION_OFFER_BLOCK.split('you do not need to')[1] ?? ''), false);
check('lite mode calls itself a success, not a lapse', /not a lapse/i.test(LITE_MODE_STANDING_BLOCK), true);
check('  forbids nudging them to log', /do not nudge them to log/i.test(LITE_MODE_STANDING_BLOCK), true);
check('  forbids "back on track" framing', /getting back on track/i.test(LITE_MODE_STANDING_BLOCK), true);

console.log('\n  LITE MODE DETECTION\n');
check('not in lite mode', isInLiteMode({ lite_mode_since: null }), false);
check('in lite mode', isInLiteMode({ lite_mode_since: ago(3) }), true);
check('null profile', isInLiteMode(null), false);

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
