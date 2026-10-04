// CAN SHE DELETE SATURDAY'S ENTRIES ON SUNDAY?
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-correction-named-day.mjs
//
// Ruth, 4 October 2026: "Chat says it can't delete Saturdays entries. It most
// definitely should be able to see and do that for the user."
//
// WHAT HAPPENED. She logged Saturday's food on Sunday lunchtime, so every row
// carries a happened_at around 13:00 Saturday. She asked for them deleted at
// 16:35 on Sunday - twenty-six and a half hours later. The correction window is
// a rolling day measured from NOW, so the lookup genuinely found nothing and
// said so honestly.
//
// THEN THE WORSE HALF. The refusal asked her which day she meant. She answered
// "Saturday". She got the same refusal, because naming the day had nowhere to
// go: log-correction.ts's own comment promised that "last week's dinner needs
// the day named explicitly, which nothingToCorrectMessage below already asks
// for", and nothing ever read the answer. An app that asks a question it cannot
// act on is worse than one that does not ask.
//
// THE SAME SHAPE AS THE DUPLICATE GUARD FIXED EARLIER THE SAME DAY, which could
// not see a meal logged for a past day because its candidate query was anchored
// to NOW rather than to the entry. Any window measured from the clock excludes
// exactly the entries somebody is catching up on, and catching up is ordinary.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { correctionDayRange, correctionCutoff, CORRECTION_WINDOW_MIN } = await import(
  root + '/app/lib/log-correction.ts'
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

console.log('\n  A DAY SHE NAMES IS A DAY SHE CAN REACH\n');

// Her rows, verbatim: logged Sunday 12:59 UTC, stamped Saturday 3 October.
const HER_ENTRY = '2026-10-03T12:59:08.000Z';
const SHE_ASKED = new Date('2026-10-04T15:35:35.000Z');

check('the old rolling window really did exclude them', () => {
  // The case has to be reproducible or the fix is a guess. This is why she was
  // told it could not be found, and it was an honest answer.
  const cutoff = correctionCutoff(SHE_ASKED);
  assert.ok(
    Date.parse(HER_ENTRY) < Date.parse(cutoff),
    `her entry at ${HER_ENTRY} was inside the rolling window ending ${cutoff} - ` +
      'the failure does not reproduce, so this check is not testing her bug'
  );
  const hours = (SHE_ASKED.getTime() - Date.parse(HER_ENTRY)) / 3_600_000;
  return `${hours.toFixed(1)}h old against a ${CORRECTION_WINDOW_MIN / 60}h window`;
});

check('naming Saturday reaches them', () => {
  const range = correctionDayRange('2026-10-03');
  assert.ok(range, 'no range for a plain yyyy-mm-dd');
  assert.ok(
    Date.parse(HER_ENTRY) >= Date.parse(range.from) &&
      Date.parse(HER_ENTRY) < Date.parse(range.to),
    `${HER_ENTRY} is outside ${range.from}..${range.to}`
  );
  return `${range.from} to ${range.to}`;
});

check('a named day is one day, not a reach backwards', () => {
  // The bound matters: widening this to "everything since" would let "delete
  // Saturday's" take a fortnight of dinners with it.
  const range = correctionDayRange('2026-10-03');
  const span = Date.parse(range.to) - Date.parse(range.from);
  assert.strictEqual(span, 86_400_000, `the day spans ${span / 3_600_000} hours`);
  // The day before and the day after are both outside it.
  assert.ok(Date.parse('2026-10-02T22:00:00Z') < Date.parse(range.from));
  assert.ok(Date.parse('2026-10-04T23:30:00Z') >= Date.parse(range.to));
  return '24 hours, local midnight to local midnight';
});

check('British Summer Time is read, not assumed', () => {
  // 3 October is BST (UTC+1), so the day starts at 23:00 the night before in
  // UTC. A fixed Z would put an hour of every summer evening on the wrong day -
  // and that hour is dinner.
  const summer = correctionDayRange('2026-10-03');
  assert.strictEqual(summer.from, '2026-10-02T23:00:00.000Z', `BST start was ${summer.from}`);
  // Late October is GMT, where local midnight IS midnight UTC.
  const winter = correctionDayRange('2026-11-15');
  assert.strictEqual(winter.from, '2026-11-15T00:00:00.000Z', `GMT start was ${winter.from}`);
  return 'BST starts at 23:00Z, GMT at 00:00Z';
});

check('a dinner at 8pm in summer belongs to its own day', () => {
  // The hour the offset bug would have stolen.
  const range = correctionDayRange('2026-07-04');
  const dinner = Date.parse('2026-07-04T19:30:00.000Z'); // 20:30 local
  assert.ok(
    dinner >= Date.parse(range.from) && dinner < Date.parse(range.to),
    'an evening meal fell outside its own day'
  );
  return 'kept on the right day';
});

check('a half-parsed date is refused rather than guessed', () => {
  // This bounds a DELETE. Leniency here removes the wrong rows.
  for (const bad of ['', 'Saturday', '2026-10', '03-10-2026', '2026-13-01', '2026-10-32', 'yesterday', '2026-10-03T12:00:00Z']) {
    assert.strictEqual(correctionDayRange(bad), null, `"${bad}" produced a range`);
  }
  return '8 malformed inputs, all refused';
});

// ---- and it is actually reachable from the model -------------------------
check('the model can say which day, and the lookup uses it', () => {
  const src = readFileSync('app/api/ask-selodia/route.ts', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.ok(/correctionDate: \{/.test(src), 'there is no field for the day she names');
  assert.ok(
    /correctionDayRange\(result\.correctionDate\)/.test(src),
    'the named day is never turned into a window, so the field is collected and ' +
      'read by nobody - which is the same fault one layer up'
  );
  assert.ok(
    !/\.gte\(timeCol, correctionCutoff\(\)\)/.test(src),
    'a lookup still uses the rolling window directly, so the target and its ' +
      'duplicates can be searched in two different windows'
  );
  return 'collected, and read';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
