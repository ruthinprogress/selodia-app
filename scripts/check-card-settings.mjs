// A WAY IN TO THE TIME, THE LENGTH AND THE REMINDER.
//
//   node scripts/check-card-settings.mjs
//
// Ruth, 18 October 2026:
//
//   "I cant find how to set the reminder alarm/notification for the activity
//    card."
//   "There is no way to edit the start time or duration time for the activity."
//
// The reminder layer had been built the day before - scheduling, the weekly
// fire, an off switch inside the notification - and reached by nothing. That is
// the fault this file exists to make impossible to repeat: a capability with no
// door is indistinguishable from one that was never built, and nothing fails
// when the door is missing.

import assert from 'node:assert';
import fs from 'node:fs';

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

const settings = fs.readFileSync('mobile/src/components/card-settings-sheet.tsx', 'utf8');
const sheet = fs.readFileSync('mobile/src/components/log-plan-sheet.tsx', 'utf8');
const plans = fs.readFileSync('mobile/src/app/(tabs)/plans.tsx', 'utf8');
const week = fs.readFileSync('mobile/src/components/week-view.tsx', 'utf8');
const card = fs.readFileSync('mobile/src/lib/week-card.ts', 'utf8');
const notifications = fs.readFileSync('mobile/src/lib/notifications.ts', 'utf8');

console.log('\n  THE REMINDER HAS A DOOR\n');

check('THE REMINDER IS REACHABLE FROM A CARD', () => {
  assert.ok(/onEdit/.test(sheet), 'the tap sheet has no route to the settings');
  assert.ok(/Time, length and reminder/.test(sheet), 'the route has no label anybody would read');
  assert.ok(/CardSettingsSheet/.test(plans), 'the settings sheet is never mounted');
  assert.ok(/setEditingCard\(/.test(plans), 'nothing ever opens it');
  return 'tap sheet to settings sheet';
});

check('SAVING RE-SCHEDULES, OR THE ALARM DOES NOT EXIST', () => {
  // THE TRAP. applyReminderSchedule cancels everything and rebuilds from stored
  // state, so a row written without a re-sync does not ring until the next
  // launch - which looks exactly like the switch being broken.
  const at = plans.indexOf('await updateWeekCard(');
  assert.ok(at > -1, 'the sheet no longer writes the card');
  const after = plans.slice(at, at + 1200);
  assert.ok(/syncRemindersNow\(\)/.test(after), 'saving no longer re-schedules anything');
  return 'updateWeekCard then syncRemindersNow';
});

check('AN OFFSET IS NEVER STORED WITHOUT A TIME TO BE BEFORE', () => {
  // "Half an hour before" with no clock time is not a reminder, it is an
  // arithmetic error that fires at midnight. fireTime clamps to the start of
  // the day, so the symptom would be an alarm at 00:00 nobody asked for.
  assert.ok(
    /remind_offset_minutes:\s*\n?\s*remindAt &&/.test(card),
    'an offset can now be stored against a card with no reminder time'
  );
  assert.ok(
    /remind_at:\s*remindAt/.test(card) && /test\(edit\.remindAt \?\? ''\)/.test(card),
    'the reminder time is no longer validated at the write'
  );
  return 'guarded at the write, not only in the sheet';
});

check('A SILENCED REMINDER STAYS SILENT', () => {
  // reminder_cancelled_at exists so "never wanted one" and "stopped one" stay
  // different answers. To the week screen they mean the same thing, and reading
  // remind_at alone would show a bell on a card somebody silenced from a
  // notification - the exact betrayal that off switch prevents.
  assert.ok(/function activeReminder\(/.test(week), 'the week reads remind_at directly again');
  assert.ok(
    /if \(row\.reminder_cancelled_at\) return null;/.test(week),
    'a cancelled reminder is shown as live'
  );
  assert.ok(
    !/reminds=\{row\.remind_at/.test(week),
    'a card reads remind_at without checking whether it was switched off'
  );
  return 'cancelled reads as none';
});

check('THE WEEK SHOWS A BELL AND STILL NO TICK', () => {
  const visible = week
    .split('\n')
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    })
    .join('\n');
  assert.ok(/notifications-outline/.test(visible), 'the bell Ruth asked for is not drawn');
  assert.ok(!/checkmark/i.test(visible), 'a tick came back');
  // AND NOT IN AUDIO EITHER. Removing the mark for everybody who can see it
  // while leaving it for everybody who cannot is the worse half of the fault.
  assert.ok(!/', logged'/.test(visible), 'a screen reader is still told a card is logged');
  assert.ok(/reminder set/.test(visible), 'the bell is not announced to a screen reader');
  return 'bell drawn and spoken, tick gone from both';
});

check('AND EVERY KIND OF REMINDER OPENS THE GATE ON LAUNCH', () => {
  // THE BUG THIS FOUND, which was live. restoreReminders returns early unless
  // somebody wants reminders - and the gate counted only the app's own and the
  // custom ones. Week reminders landed and the gate was not widened, so an
  // account that had declined the log reminders would silently never schedule
  // one. The symptom is an alarm that does not arrive, which nobody can report.
  const at = notifications.indexOf('export async function restoreReminders');
  const body = notifications.slice(at, at + 1800);
  assert.ok(/const week = await loadWeekReminders\(\)/.test(body), 'the gate ignores week reminders');
  assert.ok(
    /week\.length === 0/.test(body),
    'week reminders are loaded but not counted, so the gate still closes on them'
  );
  return 'log, custom and week all open it';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
