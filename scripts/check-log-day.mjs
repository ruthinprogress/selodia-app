// A MEAL SHE IS CATCHING UP LANDS ON THE DAY SHE IS CATCHING UP.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-log-day.mjs
//
// Ruth, 12 October 2026: "I go to catch up on my food logs and log to add more
// into Friday and it logs it for today." The reply said "a good Friday dinner";
// the row said Monday 12 October. The day had been named a message earlier, and
// logText - the only thing the food parser sees - had it stripped out.
//
// So the classifier now hands the day over as logDate, and log-day.ts turns it
// into a moment both writers use. This checks the arithmetic, the refusals, and
// that both writers are actually given it.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { logDayHappenedAt, londonToday, OLDEST_DAY_BACK } = await import(root + '/app/lib/log-day.ts');

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

// Monday 12 October 2026, 20:16 in London (BST, so 19:16 UTC): the moment she
// logged the pizza.
const NOW = new Date('2026-10-12T19:16:48Z');
const londonDay = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
const londonTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' });

console.log('\n  A MEAL SHE IS CATCHING UP LANDS ON THE DAY SHE IS CATCHING UP\n');

check('Friday, named on Monday evening, is Friday', () => {
  const at = logDayHappenedAt('2026-10-09', NOW);
  assert.ok(at, 'a real past day was refused');
  assert.strictEqual(londonDay(at), '2026-10-09', `landed on ${londonDay(at)}`);
  assert.strictEqual(londonTime(at), '20:16', 'the time of day was not carried over in London time');
  return `${londonDay(at)} at ${londonTime(at)}`;
});

check('a late summer evening does not slip into the next day', () => {
  // 23:30 BST is 22:30 UTC. A bare UTC time on the named day would be fine
  // here, but 00:30 BST is 23:30 UTC the day BEFORE, and that is the slip.
  const late = new Date('2026-07-14T23:30:00Z'); // 00:30 BST on 15 July
  const at = logDayHappenedAt('2026-07-11', late);
  assert.strictEqual(londonDay(at), '2026-07-11', `landed on ${londonDay(at)}`);
  return '00:30 BST stays on the day named';
});

check('today, nothing, and rubbish all mean "leave it as today"', () => {
  for (const v of [londonToday(NOW), undefined, null, '', 'Friday', '2026-13-01', 42]) {
    assert.strictEqual(logDayHappenedAt(v, NOW), undefined, `${JSON.stringify(v)} produced a date`);
  }
  return 'undefined for each';
});

check('never a future day, never more than a month back', () => {
  assert.strictEqual(logDayHappenedAt('2026-10-13', NOW), undefined, 'tomorrow was accepted');
  assert.ok(logDayHappenedAt('2026-09-11', NOW), `${OLDEST_DAY_BACK} days back was refused`);
  assert.strictEqual(logDayHappenedAt('2026-09-10', NOW), undefined, 'more than a month back was accepted');
  return `0 to ${OLDEST_DAY_BACK} days back`;
});

check('the classifier is asked for the day, including one named earlier', () => {
  assert.ok(/logDate: \{\s*type: 'string',/.test(route), 'there is no logDate field in the schema');
  assert.ok(/NAMED EARLIER IN THE CONVERSATION/.test(route), 'the field does not say the day may come from an earlier message');
  assert.ok(/logDate\?: string;/.test(route), 'the verdict type has no logDate');
  return 'field, description, type';
});

check('both writers are given it', () => {
  assert.ok(
    /result\.logText\?\.trim\(\) \|\| message,\s*\/\/[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*logDayHappenedAt\(result\.logDate\),/.test(route),
    'the food log is not given the day'
  );
  assert.ok(
    /logActivityFromText\(supabase, user\.id, result\.logText\?\.trim\(\) \|\| message, logDayHappenedAt\(result\.logDate\)\)/.test(route),
    'the activity log is not given the day'
  );
  return 'food and activity';
});

check('and this check can fail', () => {
  // THE OLD CALL: the food text and nothing else, so the day fell back to now.
  const old = `logFoodFromText(
              supabase,
              user.id,
              result.logText?.trim() || message,
              undefined,
              undefined,
              undefined,
              voiceTurnId
            )`;
  assert.ok(
    !/result\.logText\?\.trim\(\) \|\| message,\s*\/\/[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*logDayHappenedAt\(result\.logDate\),/.test(old),
    'the old call reads as passing the day'
  );
  return 'the old call is caught';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
