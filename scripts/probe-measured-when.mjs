// A READING FILED TWO YEARS AGO (Ruth, 24 September 2026).
//
// Her scale screenshot was parsed with measured_at 2024-09-24, and one wrong
// year produced four faults in one message: a weekday that was right for 2024,
// a direction that was right for yesterday's reading, a cycle day that was
// right for yesterday, and a weigh-in that never appeared in this week.
//
//   npx tsx scripts/probe-measured-when.mjs

import { measuredWhen } from '../app/lib/measured-when.ts';

const NOW = new Date('2026-09-24T09:07:00Z');

let pass = 0;
let fail = 0;
function check(name, ok, detail) {
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${name}`);
    if (detail !== undefined) console.log(`        ${detail}`);
  }
}

console.log('\n  WHEN A READING WAS ACTUALLY TAKEN\n');

// ---- her reading ----------------------------------------------------------
{
  const r = measuredWhen('2024-09-24T07:24:00+00:00', NOW);
  console.log(`  her scale screenshot -> ${r.iso}`);
  check('the year is corrected to this one', r.iso.startsWith('2026-09-24'), r.iso);
  check('the time of day she weighed is kept', r.iso.includes('07:24'), r.iso);
  check('and the correction is recorded, not silent', Boolean(r.corrected), String(r.corrected));
  check('it is a Thursday again', new Date(r.iso).getUTCDay() === 4, String(new Date(r.iso).getUTCDay()));
}

// ---- an ordinary catch-up is left alone -----------------------------------
{
  const three = measuredWhen('2026-09-01T07:00:00Z', NOW);
  check('a reading three weeks old is kept as it is', three.iso === '2026-09-01T07:00:00.000Z' && three.corrected === null, JSON.stringify(three));

  const year = measuredWhen('2025-12-01T07:00:00Z', NOW);
  check('one from ten months ago is kept too', year.corrected === null, JSON.stringify(year));

  const today = measuredWhen('2026-09-24T07:24:00Z', NOW);
  check('today is kept exactly', today.iso === '2026-09-24T07:24:00.000Z' && today.corrected === null, JSON.stringify(today));
}

// ---- a scale cannot weigh somebody tomorrow -------------------------------
{
  const ahead = measuredWhen('2027-09-24T07:24:00Z', NOW);
  check('a future year is pulled back to this one', ahead.iso.startsWith('2026-09-24'), ahead.iso);
  check('and says so', Boolean(ahead.corrected));

  const drift = measuredWhen('2026-09-24T18:00:00Z', NOW);
  check('a few hours ahead is clock drift, and kept', drift.corrected === null, JSON.stringify(drift));
}

// ---- a day and month that have not happened yet this year -----------------
{
  // 30 December 2024, read on 24 September 2026: the most recent 30 December
  // is 2025, not 2026, because 2026's has not come round yet.
  const dec = measuredWhen('2024-12-30T08:00:00Z', NOW);
  console.log(`  2024-12-30 -> ${dec.iso}`);
  check('it lands on the most recent one that has happened', dec.iso.startsWith('2025-12-30'), dec.iso);
}

// ---- nothing to go on -----------------------------------------------------
{
  const none = measuredWhen(null, NOW);
  check('no date at all becomes now', none.iso === NOW.toISOString() && none.corrected === null, JSON.stringify(none));

  const junk = measuredWhen('yesterday morning', NOW);
  check('unparseable becomes now, and says so', junk.iso === NOW.toISOString() && Boolean(junk.corrected), JSON.stringify(junk));

  const empty = measuredWhen('   ', NOW);
  check('whitespace becomes now', empty.iso === NOW.toISOString(), JSON.stringify(empty));
}

// ---- 29 February, which does not exist most years -------------------------
{
  const leap = measuredWhen('2020-02-29T08:00:00Z', NOW);
  console.log(`  2020-02-29 -> ${leap.iso}`);
  check('a leap day is not silently moved into March', !leap.iso.startsWith('2026-03'), leap.iso);
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
