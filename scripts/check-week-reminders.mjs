// A REMINDER THAT COMES FROM YOUR WEEK, AND CAN BE SWITCHED OFF FROM ITSELF.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-week-reminders.mjs
//
// Ruth, 18 October 2026, after two people at the rope climbing gym said what
// they liked about another training app was that "it told them what to do and
// when", and one of them had switched the notifications on:
//
//   "What if a user could add their own plans as cards into the week too...
//    They can also on that same screen choose to 'set up reminder'."
//
// And the part she cared most about:
//
//   "Each time the reminder comes in there should be a way to permanently
//    switch off reminders about that item permanently FROM the notification
//    alarm without entering the app, so overwhelming ones don't need you to go
//    rummaging, you just say 'remove this regular reminder'."
//
// Three things here can go wrong silently, which is why they are checked rather
// than trusted.

import assert from 'node:assert';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const mod = pathToFileURL(
  path.join(process.cwd(), 'mobile', 'src', 'lib', 'week-reminder-time.ts')
).href;
const { fireTime, weekdayNumber } = await import(mod);

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

console.log('\n  WHAT IS IN YOUR WEEK CAN REMIND YOU\n');

check('the offset is taken off the time, not baked into it', () => {
  // "Half an hour before my class" must still mean that if the class moves, so
  // the offset is stored and subtracted rather than applied once and lost.
  const at = fireTime({ remind_at: '19:00:00', remind_offset_minutes: 30 });
  assert.deepStrictEqual(at, { hour: 18, minute: 30 });

  const onTime = fireTime({ remind_at: '07:15:00', remind_offset_minutes: null });
  assert.deepStrictEqual(onTime, { hour: 7, minute: 15 }, 'no offset should fire at the time');

  const hour = fireTime({ remind_at: '09:05:00', remind_offset_minutes: 60 });
  assert.deepStrictEqual(hour, { hour: 8, minute: 5 });
  return '30 before, on the hour, and an hour before';
});

check('AN OFFSET NEVER MOVES A REMINDER ONTO THE DAY BEFORE', () => {
  // An hour before a 00:30 class is 23:30 the previous evening - a different
  // day, and the reminder would arrive on a day she did not choose. Clamped to
  // the start of her day instead, because a reminder slightly early on the
  // right day is recoverable and one on the wrong day is just wrong.
  assert.deepStrictEqual(fireTime({ remind_at: '00:30:00', remind_offset_minutes: 60 }), {
    hour: 0,
    minute: 0,
  });
  return 'clamped to the start of the day';
});

check('the days map to what expo actually expects', () => {
  // expo-notifications counts SUNDAY as 1. DAY_KEYS starts on Monday. Getting
  // this wrong by one puts every reminder a day out, which nothing would catch
  // except somebody being nudged on the wrong morning.
  assert.strictEqual(weekdayNumber('sun'), 1, 'Sunday must be 1');
  assert.strictEqual(weekdayNumber('mon'), 2, 'Monday must be 2');
  assert.strictEqual(weekdayNumber('sat'), 7, 'Saturday must be 7');
  // And an unknown day is refused rather than guessed.
  assert.strictEqual(weekdayNumber('someday'), null, 'an unknown day was guessed at');
  assert.strictEqual(weekdayNumber(''), null);
  return 'sun=1, mon=2, sat=7, nonsense refused';
});

check('SWITCHING OFF WRITES TO STORAGE, NOT JUST THE SCHEDULE', () => {
  // THE TRAP, and it is invisible. restoreReminders() rebuilds the entire
  // schedule from stored state on every launch, so cancelling only the pending
  // alarm brings the reminder back the next time the app opens - and it looks
  // exactly like the off switch is broken, which is worse than not having one.
  const lib = fs.readFileSync('mobile/src/lib/week-reminders.ts', 'utf8');
  assert.ok(
    /reminder_cancelled_at: new Date\(\)\.toISOString\(\)/.test(lib),
    'cancelling no longer records anything in the database'
  );

  const handler = fs.readFileSync('mobile/src/lib/week-reminder-response.ts', 'utf8');
  const storageAt = handler.indexOf('await cancelWeekReminder(rowId)');
  const scheduleAt = handler.indexOf('getAllScheduledNotificationsAsync');
  assert.ok(storageAt > -1, 'the handler no longer records the decision');
  assert.ok(
    storageAt < scheduleAt,
    'the schedule is cleared before the decision is stored, so any failure loses it'
  );
  return 'stored first, then unscheduled';
});

check('a cancelled reminder is excluded in SQL, not filtered afterwards', () => {
  // A reminder somebody switched off must never come back by accident, and the
  // narrowest place to guarantee that is the query that fetches them.
  const lib = fs.readFileSync('mobile/src/lib/week-reminders.ts', 'utf8');
  assert.ok(
    /\.is\('reminder_cancelled_at', null\)/.test(lib),
    'cancelled reminders are no longer excluded by the query'
  );
  assert.ok(
    /\.not\('remind_at', 'is', null\)/.test(lib),
    'cards with no reminder are no longer excluded by the query'
  );
  return 'both filters in the query';
});

check('IT IS SCHEDULED WHERE IT WILL SURVIVE A RESCHEDULE', () => {
  // applyReminderSchedule cancels EVERYTHING first and rebuilds. Anything
  // scheduled anywhere else is wiped the next time log reminders are applied -
  // the file says so itself, about her own custom reminders, in 2026-09-18.
  const notifications = fs.readFileSync('mobile/src/lib/notifications.ts', 'utf8');
  const applyAt = notifications.indexOf('export async function applyReminderSchedule');
  const weekAt = notifications.indexOf('loadWeekReminders()');
  assert.ok(weekAt > applyAt, 'week reminders are scheduled outside applyReminderSchedule');
  assert.ok(
    /cancelAllScheduledNotificationsAsync/.test(notifications.slice(applyAt, weekAt)),
    'the rebuild no longer clears first, so this check proves nothing'
  );
  return 'inside the rebuild, after the cancel';
});

check('the notification carries its own off switch, and the row id to use it', () => {
  const notifications = fs.readFileSync('mobile/src/lib/notifications.ts', 'utf8');
  assert.ok(
    /categoryIdentifier: WEEK_REMINDER_CATEGORY/.test(notifications),
    'the reminder no longer carries its action category'
  );
  assert.ok(
    /weekRowId: r\.id/.test(notifications),
    'the row id no longer travels with the notification'
  );
  assert.ok(
    /opensAppToForeground: false/.test(notifications),
    'the off switch now opens the app, which is the rummaging it exists to avoid'
  );
  // Registered BEFORE anything is scheduled, or the buttons simply do not
  // appear and nothing reports it.
  const registerAt = notifications.indexOf('setNotificationCategoryAsync');
  const scheduleAt = notifications.indexOf('loadWeekReminders()');
  assert.ok(registerAt > -1 && registerAt < scheduleAt, 'the category is registered too late');
  return 'category, row id, and it does not open the app';
});

check('AND THE TIME IS NEVER READ FROM THE PROSE ONE', () => {
  // time_of_day holds "after the school run" on purpose. Alarming on it would
  // mean parsing prose into a clock time, which week-view.tsx explicitly
  // refuses to do.
  const lib = fs.readFileSync('mobile/src/lib/week-reminders.ts', 'utf8');
  assert.ok(!/time_of_day/.test(lib.replace(/\/\/.*$/gm, '')), 'the reminder reads time_of_day');
  assert.ok(/remind_at/.test(lib), 'the reminder has no time of its own');
  return 'its own column, never the prose one';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
