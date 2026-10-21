// A ONE-OFF HAS A DATE, AND THE WEEK NEVER DOES.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-calendar.mjs
//
// Ruth, 18 October 2026, drawing the line herself:
//
//   "Week is a template of your week, it's not a real week... It's not a
//    calendar. It's not for one-off appointments. If it was a one-off
//    appointment, they would ask in chat to add something to their calendar
//    (that's build already right?)"
//
// It was not. "we need to build calendar also then."
//
// THE ONE THING MOST LIKELY TO GO WRONG HERE IS A DATE, and a wrong date is
// only discovered by missing the thing. The prompt carries a rule for turning
// named weekdays into dates - "the most recent one that has already happened,
// never one still to come" - which is right for logging a meal and exactly
// backwards for an appointment. A prompt rule that contradicts another prompt
// rule is a coin toss, so the guard is in code.

import assert from 'node:assert';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const here = (p) => pathToFileURL(path.join(process.cwd(), p)).href;
const { checkCalendarEvent, validEventDate, daysAhead } = await import(
  here('app/lib/calendar-event.ts')
);
const { reminderMoment, eventDateLabel, eventTimeLabel } = await import(
  here('mobile/src/lib/calendar-time.ts')
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

const route = fs.readFileSync('app/api/ask-selodia/route.ts', 'utf8');
const migration = fs.readFileSync(
  'supabase/migrations/20261018200000_a_one_off_has_a_date_the_week_never_does.sql',
  'utf8'
);

console.log('\n  THE DIARY\n');

check('AN APPOINTMENT IS NEVER FILED IN THE PAST', () => {
  // The backwards-weekday fault, which is the one that would actually happen.
  // "Tuesday" read by the logging rule lands up to six days behind.
  const today = '2026-10-18';
  const back = checkCalendarEvent({ title: 'physio', date: '2026-10-13' }, today);
  assert.strictEqual(back.ok, false, 'a date five days behind was accepted');
  assert.strictEqual(back.because, 'in the past');

  // YESTERDAY IS ALLOWED. Writing up an appointment you went to yesterday is
  // real and harmless; anything older is the wrong rule having been applied.
  const yesterday = checkCalendarEvent({ title: 'physio', date: '2026-10-17' }, today);
  assert.strictEqual(yesterday.ok, true, 'yesterday was refused, which is too strict');

  const ahead = checkCalendarEvent({ title: 'physio', date: '2026-10-20' }, today);
  assert.strictEqual(ahead.ok, true, 'a date in the future was refused');
  return 'five days back refused, yesterday kept';
});

check('a date that is not a date is refused rather than guessed at', () => {
  const today = '2026-10-18';
  assert.strictEqual(validEventDate('2026-02-31'), null, 'a day that does not exist passed');
  assert.strictEqual(validEventDate('next Tuesday'), null, 'prose passed as a date');
  assert.strictEqual(validEventDate('18/10/2026'), null, 'the wrong format passed');
  assert.strictEqual(validEventDate('2026-10-18'), '2026-10-18');
  assert.strictEqual(checkCalendarEvent({ title: 'x', date: 'soon' }, today).because, 'no date');
  assert.strictEqual(checkCalendarEvent({ title: ' ', date: today }, today).because, 'no title');
  assert.strictEqual(daysAhead('2026-10-20', today), 2);
  assert.strictEqual(daysAhead('2026-10-16', today), -2);
  return 'bad dates refused with a reason';
});

check('AN HOUR IS NEVER INVENTED', () => {
  // "My scan is on the 24th" is a complete thing to be told. A made-up 9am on a
  // hospital letter is worse than no time, because it looks like information.
  const r = checkCalendarEvent({ title: 'scan', date: '2026-10-24' }, '2026-10-18');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.row.event_time, null, 'a time appeared from nowhere');
  const timed = checkCalendarEvent(
    { title: 'physio', date: '2026-10-20', time: '15:00' },
    '2026-10-18'
  );
  assert.strictEqual(timed.row.event_time, '15:00');
  // And a time that is not one does not become one.
  const junk = checkCalendarEvent(
    { title: 'physio', date: '2026-10-20', time: 'afternoon' },
    '2026-10-18'
  );
  assert.strictEqual(junk.row.event_time, null, '"afternoon" became a clock time');
  return 'no time stays no time';
});

check('A REMINDER NEEDS SOMETHING TO BE BEFORE', () => {
  // "Remind me an hour before" against a date with no hour is meaningless. The
  // honest answer is to keep the appointment and say the reminder could not be
  // set, never to invent a 9am so the offset has something to subtract from.
  const noTime = checkCalendarEvent(
    { title: 'scan', date: '2026-10-24', remindMinutesBefore: 60 },
    '2026-10-18'
  );
  assert.strictEqual(noTime.row.remind_at, null, 'a reminder was set with no time to be before');
  assert.strictEqual(noTime.reminderDropped, true, 'the dropped reminder is not reported');

  const withTime = checkCalendarEvent(
    { title: 'physio', date: '2026-10-20', time: '15:00', remindMinutesBefore: 60 },
    '2026-10-18'
  );
  assert.strictEqual(withTime.row.remind_at, '15:00');
  assert.strictEqual(withTime.row.remind_offset_minutes, 60);
  assert.strictEqual(withTime.reminderDropped, false);
  return 'offset kept only beside a real time';
});

check('and it never rings about something that has already happened', () => {
  const now = new Date(2026, 9, 18, 12, 0);
  const future = reminderMoment(
    { event_date: '2026-10-20', remind_at: '15:00:00', remind_offset_minutes: 60, reminder_cancelled_at: null },
    now
  );
  assert.ok(future, 'a reminder still to come was dropped');
  assert.strictEqual(future.getHours(), 14, 'the offset was not subtracted');

  const past = reminderMoment(
    { event_date: '2026-10-18', remind_at: '09:00:00', remind_offset_minutes: null, reminder_cancelled_at: null },
    now
  );
  assert.strictEqual(past, null, 'a moment that has passed was scheduled');

  const stopped = reminderMoment(
    { event_date: '2026-10-20', remind_at: '15:00:00', remind_offset_minutes: null, reminder_cancelled_at: '2026-10-18T10:00:00Z' },
    now
  );
  assert.strictEqual(stopped, null, 'a reminder she switched off was scheduled anyway');
  return 'past refused, cancelled refused, offset subtracted';
});

check('a day with no hour says nothing rather than midnight', () => {
  assert.strictEqual(eventTimeLabel(null), null);
  assert.strictEqual(eventTimeLabel('15:00:00'), '15:00');
  assert.strictEqual(eventDateLabel('2026-10-18', '2026-10-18'), 'Today');
  assert.strictEqual(eventDateLabel('2026-10-19', '2026-10-18'), 'Tomorrow');
  assert.ok(/Tuesday/.test(eventDateLabel('2026-10-20', '2026-10-18')), 'the weekday is missing');
  // Beyond the week ahead a weekday is ambiguous, so the date carries it.
  assert.ok(
    !/day/i.test(eventDateLabel('2026-11-30', '2026-10-18')),
    'a weekday is used for a date weeks away, where it means nothing'
  );
  return 'Today, Tomorrow, weekday, then the date';
});

check('THE WEEK AND THE DIARY STAY DIFFERENT TABLES', () => {
  // user_week holds day NAMES and recurs forever; its own comment says it is "a
  // list, not a calendar". A date in there would make every read ask "is this
  // one of the recurring ones?", which is the question nobody remembers to ask.
  assert.ok(/create table if not exists public\.calendar_events/.test(migration));
  assert.ok(/event_date date not null/.test(migration), 'the date is optional');
  assert.ok(/event_time time(?!stamp)/.test(migration), 'the time is not separable from the date');
  assert.ok(/what_to_bring/.test(migration), 'what to bring is missing, which is the point of it');
  assert.ok(
    !/alter table public\.user_week/.test(migration),
    'the diary reached into the week table'
  );
  // No completion column, same as the week. An appointment that has happened is
  // in the past and the date says so; a tick box would invite counting kept and
  // missed appointments, which is a judgement about an illness.
  assert.ok(!/completed|done_at/.test(migration), 'something here can be marked done');
  return 'its own table, date required, hour optional';
});

check('AND THE PROMPT NO LONGER SAYS APPOINTMENTS ARE IMPOSSIBLE', () => {
  // The example of "something not built yet" was the calendar, three times in
  // two files. check-not-built-means-not-built guards the prompts themselves;
  // this guards the one comment that chose the example, because it is a comment
  // that recorded its own fault happening twice already.
  assert.ok(/calendarAction/.test(route), 'the classifier cannot file an appointment');
  assert.ok(
    /A DIARY LOOKS FORWARD/.test(route),
    'nothing tells the model a diary reads a weekday forwards'
  );
  assert.ok(
    !/The example is now the calendar, which genuinely is not built/.test(route),
    'the not-built example is the calendar again, which is now built'
  );
  return 'the example moved to the gap that is still real';
});

check('A DIARY ENTRY SLIDES TO DELETE, AND THE BELL TOGGLES', () => {
  // Ruth, 21 October 2026: "I want all pills like this to slide to delete. I
  // wonder if the same could be said for turning off the reminder. It could
  // just be slide to the left and see delete and Ring bell/ring bell strike
  // through, most people know this."
  //
  // THE SAME GESTURE THE LOG AND THE ME TAB ALREADY USE, rather than a second
  // copy of it - so the reveal, the catch distance and the one-open-at-a-time
  // rule stay one behaviour.
  const diary = fs.readFileSync('mobile/src/components/diary-section.tsx', 'utf8');
  assert.ok(/<SwipeToDelete/.test(diary), 'a diary entry no longer slides to delete');
  assert.ok(/onDelete=\{\(\) => deleteEvent\(e\.id\)\}/.test(diary), 'the swipe does not delete the entry');
  // THE BELL IS A TOGGLE, BOTH WAYS. Cancelling used to be reachable from the
  // notification and from the detail sheet with nothing anywhere to put it
  // back, so a reminder switched off by a mis-swipe was gone for good.
  assert.ok(/restoreEventReminder/.test(diary), 'a cancelled reminder cannot be switched back on');
  assert.ok(/cancelEventReminder/.test(diary), 'the reminder cannot be switched off from the swipe');
  assert.ok(
    /Reminder off/.test(diary) && /Reminder on/.test(diary),
    'the bell does not say which way it goes'
  );
  // AND IT ONLY APPEARS WHEN THERE IS A REMINDER TO SWITCH. A struck-through
  // bell on an entry that never had one offers something that cannot happen.
  assert.ok(/hasReminder/.test(diary), 'the bell is offered on entries with no reminder');
  return 'delete, and a bell that goes both ways';
});

check('AND RESTORING A REMINDER DOES NOT INVENT AN HOUR', () => {
  // The hour she asked for is hers and was never what changed - only the
  // cancellation is lifted.
  const lib = fs.readFileSync('mobile/src/lib/calendar.ts', 'utf8');
  const at = lib.indexOf('export async function restoreEventReminder');
  assert.ok(at > -1, 'there is no way to switch a reminder back on');
  const body = lib.slice(at, at + 400);
  assert.ok(/reminder_cancelled_at: null/.test(body), 'restoring does not clear the cancellation');
  assert.ok(!/remind_at:/.test(body), 'restoring writes a reminder time, which is hers to have set');
  return 'the cancellation only';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
