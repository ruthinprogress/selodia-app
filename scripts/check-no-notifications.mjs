// DID SLICE 6 WIRE A NOTIFICATION IT WAS TOLD NOT TO WIRE?
//
// Ruth's overnight brief: "Reminders and notification strings: write them for
// review, but do not wire any live notifications tonight."
//
// THE FIRST VERSION OF THIS FILE HAD THE PREMISE WRONG, and the correction is
// worth keeping. It checked whether the app could send a notification at all,
// found three scheduling calls, and reported them as failures. They are not:
// Selodía has had a working local reminder system since Part Fourteen -
// notifications.ts, reminder-settings.ts, reminder-offer.tsx and
// use-reminder-restore.ts - built with care, asked for at the first log rather
// than up front, and shipped. The instruction was not "the app has none". It
// was "do not add one tonight".
//
// So the wired files are listed below as a BASELINE, with the shape of the
// question fixed: anything OUTSIDE that list that schedules a notification is
// new, and new is what was forbidden. Slice 6 adds notification copy, a days
// field on every week row, and a function deciding whether today is a planned
// day - every ingredient of a working reminder, and none of them connected.
// The gap between "we did not wire it" and "we believe we did not wire it" is
// one import.
//
// IT ALSO CHECKS THE REMINDER COPY AGAINST THE RULES IT WAS WRITTEN TO, because
// a string file nobody checks drifts the same way a comment does.
//
//   node --import ./scripts/ts-paths.mjs scripts/check-no-notifications.mjs

import fs from 'node:fs';
import path from 'node:path';

import { MISSED_SESSION, REMINDER_STRINGS, plannedTodayLine } from '../mobile/src/lib/reminders.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'mobile', 'src');

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(full);
  }
  return out;
}

// The calls that would actually put something on somebody's lock screen.
const WIRING = [
  'scheduleNotificationAsync',
  'presentNotificationAsync',
  'setNotificationChannelAsync',
  'requestPermissionsAsync',
];

// THE PRE-EXISTING REMINDER SYSTEM (Part Fourteen). These files are allowed to
// schedule; they have been doing it since August. Anything else that starts to
// is what this check is for.
const BASELINE = new Set(['mobile/src/lib/notifications.ts']);

let problems = 0;
const found = [];

for (const file of walk(SRC)) {
  const text = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  // Worth SEEING every file that touches the module, even the ones only reading
  // a preference - the module graph reaching a native module from the wrong
  // screen is a bug this app has already had twice.
  if (/expo-notifications/.test(text)) found.push(rel);
  for (const call of WIRING) {
    if (text.includes(call)) {
      if (BASELINE.has(rel)) continue;
      problems += 1;
      console.log(`  NEW WIRING  ${rel}  calls ${call}`);
    }
  }
}

console.log(`  ${found.length} file(s) reference expo-notifications:`);
for (const f of found) console.log(`    ${f}${BASELINE.has(f) ? '   (baseline, may schedule)' : ''}`);
console.log();

// ---- the copy, against the rules it was written to ----------------------

const RULES = [
  [
    'nothing counts, scores or scolds',
    () =>
      REMINDER_STRINGS.every(
        (r) =>
          !/streak|in a row|you haven't|you have not|missed|behind|don't forget|days? since/i.test(
            `${r.title} ${r.body}`
          )
      ),
  ],
  [
    'no notification is an instruction',
    () =>
      REMINDER_STRINGS.every(
        (r) => !/^(time (for|to)|get |go |do |remember to)/i.test(r.body.trim())
      ),
  ],
  [
    'every string says why it is worth interrupting somebody',
    () => REMINDER_STRINGS.every((r) => r.justification.length > 40),
  ],
  [
    'there is no missed-session notification, and there is no code for one',
    () => MISSED_SESSION === null,
  ],
  [
    'the planned-day line appears only in Guide me',
    () => {
      const rows = [{ activity: 'Gym', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] }];
      return (
        plannedTodayLine(rows, 'guide_me') !== null &&
        plannedTodayLine(rows, 'let_me_lead') === null &&
        plannedTodayLine(rows, null) === null
      );
    },
  ],
  [
    'the planned-day line appears only on a planned day',
    () => {
      // A Monday, and a row that is only ever on a Sunday.
      const monday = new Date('2026-09-28T09:00:00');
      const rows = [{ activity: 'Gym', days: ['sun'] }];
      return (
        plannedTodayLine(rows, 'guide_me', monday) === null &&
        plannedTodayLine([{ activity: 'Gym', days: ['mon'] }], 'guide_me', monday) ===
          'On the plan: gym'
      );
    },
  ],
];

for (const [name, run] of RULES) {
  let ok = false;
  try {
    ok = run() === true;
  } catch (err) {
    console.log(`  threw: ${err.message}`);
  }
  if (!ok) problems += 1;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}`);
}

console.log();
if (problems > 0) {
  console.log(`  ${problems} problem(s). Slice 6 was not to wire anything new.`);
} else {
  console.log(
    `  No new wiring beyond the existing reminder system. ` +
      `${REMINDER_STRINGS.length} strings written, awaiting Ruth's review.`
  );
}
process.exitCode = problems > 0 ? 1 : 0;
