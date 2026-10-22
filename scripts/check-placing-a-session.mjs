// A LINE THAT NAMES A PROBLEM HAS TO OFFER THE WAY OUT OF IT.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-placing-a-session.mjs
//
// Ruth, 21 October 2026, on a screenshot of "1 session is not counted here yet,
// because it could not be placed on these six":
//
//   "It needs a link for user to resolve this. Its not clear."
//
// The sentence shipped the day before with nothing to tap. It told her the
// drawing was under-reporting and handed her no way to stop it, which leaves
// somebody worse off than silence would have.
//
// WHAT IS ACTUALLY BEING GUARDED HERE. Three things, and the first is the one
// that would do damage:
//
//   1. ALL SIX COLUMNS OR NONE. A partial write makes a petal read low for a
//      reason nobody can ever find afterwards.
//   2. A FAILURE IS NEVER REPORTED AS A PLACEMENT. The row is still null, so
//      the only honest answer is "still not placed".
//   3. THE SENTENCE MATCHES WHAT HAPPENED, including the half-and-half case -
//      one placed, one not - which is the true shape of her own data today and
//      the shape a summary would round away.

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const here = (p) => pathToFileURL(path.join(process.cwd(), p)).href;
const { placementSentence } = await import(here('mobile/src/lib/placement-sentence.ts'));

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

const route = fs.readFileSync('app/api/place-activity/route.ts', 'utf8');
const section = fs.readFileSync('mobile/src/components/balance-flower-section.tsx', 'utf8');

console.log('\n  PLACING A SESSION THE DRAWING COULD NOT READ\n');

check('THE LINE IS SOMETHING SHE CAN PRESS', () => {
  // The whole sentence is the target, not a word inside it: the thing she wants
  // to act on is the line she has just read.
  const at = section.indexOf('not counted here yet');
  assert.ok(at > -1, 'the line about uncounted sessions is gone');
  const before = section.slice(Math.max(0, at - 1800), at);
  assert.ok(/<Pressable/.test(before), 'the line is not pressable');
  assert.ok(/placeUnreadSessions/.test(before), 'pressing it does not place anything');
  assert.ok(/accessibilityRole="button"/.test(before), 'it does not announce itself as a button');
  return 'the sentence is the target';
});

check('AND THE DRAWING RE-READS ITSELF AFTERWARDS', () => {
  // A petal that just gained a session grows while she is looking at it.
  // Without this the count stays on screen and nothing visibly happened.
  // From the CALL, not from the import line at the top of the file.
  const at = section.indexOf('await placeUnreadSessions');
  assert.ok(at > -1, 'nothing calls the placement');
  const after = section.slice(at, at + 700);
  assert.ok(/reload\(\)/.test(after), 'the flower is not redrawn after a placement');
  assert.ok(
    /outcome\.ok && outcome\.placed\.length > 0/.test(after),
    'it redraws even when nothing was placed, which says something happened'
  );
  return 'redrawn only when something changed';
});

check('ALL SIX COLUMNS OR NONE', () => {
  // The one failure here that would be invisible afterwards.
  assert.ok(/for \(const d of DIMENSIONS\) columns\[COVER_COLUMN\[d\]\] = coverage\[d\]/.test(route),
    'the six columns are not written from the one coverage answer');
  assert.ok(!/cover_strength:/.test(route), 'a column is being written by hand');
  return 'written from DIMENSIONS, never by name';
});

check('A WRITE THAT FAILED IS NOT A PLACEMENT', () => {
  // FROM THE BATCH LOOP, not from the top of the file. The single-session
  // describe path was added above it on 22 October and owns the first
  // 'writeError' in the file, which is a different write with a different
  // (also correct) shape. A check that drifts onto the wrong function reports
  // a fault in code that is fine.
  const batch = route.indexOf('for (const [name, group] of byName)');
  assert.ok(batch > -1, 'the batch loop is gone');
  const at = route.indexOf('writeError', batch);
  assert.ok(at > -1, 'the write is not checked at all');
  const after = route.slice(at, at + 600);
  assert.ok(/stillUnplaced\.push/.test(after), 'a failed write is reported as placed');
  //  matters: stillUnplaced.push ends in "placed.push" and would match
  // without it, which is how this check first passed itself.
  assert.ok(!/placed\.push/.test(after.slice(0, after.indexOf('continue'))),
    'a failed write reaches the placed list');
  return 'a failed write stays unplaced';
});

check('AND NOTHING IS PLACED FOR SOMEBODY ELSE', () => {
  // Both the read and the write are pinned to the signed-in user. RLS would
  // catch it, but a route that relies on RLS alone is one bad policy from
  // writing into another person's log.
  assert.ok(/\.eq\('user_id', user\.id\)/.test(route), 'the read is not scoped to the user');
  const writeAt = route.indexOf(".from('activity_logs')\n      .update(");
  const write = route.slice(writeAt, writeAt + 400);
  assert.ok(/eq\('user_id', user\.id\)/.test(write), 'the update is not scoped to the user');
  return 'read and write both scoped';
});

check('A NAME IT CANNOT PLACE IS LEFT ALONE', () => {
  // resolveCoverage returns null rather than guessing, and null has to stay
  // null: a guessed classification is worse than an uncounted session, because
  // the drawing would then be confidently wrong about what her body was given.
  const batch = route.indexOf('for (const [name, group] of byName)');
  const at = route.indexOf('if (!coverage)', batch);
  assert.ok(at > -1, 'nothing handles a name the classifier could not place');
  const after = route.slice(at, at + 300);
  assert.ok(/stillUnplaced\.push/.test(after), 'an unplaceable name is not reported');
  assert.ok(/continue/.test(after), 'it goes on to write something anyway');
  return 'null stays null';
});

check('THE SENTENCE SAYS WHAT HAPPENED, BOTH HALVES', () => {
  const both = placementSentence({
    ok: true,
    placed: [{ id: '1', activityType: 'Pull-up practice', dimensions: ['strength'] }],
    unplaced: [{ id: '2', activityType: 'gym session' }],
  });
  assert.ok(/Pull-up practice/.test(both), 'the placed session is not named');
  assert.ok(/gym session/.test(both), 'the one still missing is not named');

  const none = placementSentence({ ok: true, placed: [], unplaced: [] });
  assert.ok(/Nothing was waiting/.test(none), 'an empty run reads as a success');

  // A FAILURE MUST NOT READ AS "NOTHING TO PLACE". The two are identical from
  // the phone's side and mean opposite things.
  const failed = placementSentence({ ok: false });
  assert.ok(/did not work/.test(failed), 'a failed call sounds like a finished one');
  assert.ok(!/Nothing was waiting/.test(failed), 'a failure reads as an empty window');
  return 'placed, unplaced, empty and failed all read differently';
});

check('AND IT NAMES THEM UNTIL NAMING STOPS BEING READABLE', () => {
  const many = placementSentence({
    ok: true,
    placed: ['a', 'b', 'c', 'd'].map((n, i) => ({ id: String(i), activityType: n, dimensions: [] })),
    unplaced: [],
  });
  assert.ok(/4 sessions/.test(many), 'four names are read out in a line under a drawing');
  // And repeats of one name are one name, not four.
  const repeats = placementSentence({
    ok: true,
    placed: [1, 2, 3, 4].map((i) => ({ id: String(i), activityType: 'Pull-up practice', dimensions: [] })),
    unplaced: [],
  });
  assert.ok(/Pull-up practice/.test(repeats), 'one repeated name was counted instead of named');
  return 'named up to three, counted beyond';
});

check('A PLANNED SESSION IS PLACED WHEN IT IS WRITTEN', () => {
  // Ruth, 22 October 2026, on tapping the link that placed her Pull-up
  // practice: "I thought the reason we put that there was because it needed
  // more info to make sense to the algorithm of the flower. What did it do?
  // That was a bit odd and pointless."
  //
  // She was right, and the answer was not a better button. A button that runs a
  // classifier needing NOTHING from her is the app asking permission to do its
  // own work. The row should never have been unclassified.
  const plans = fs.readFileSync('mobile/src/app/(tabs)/plans.tsx', 'utf8');
  assert.ok(/placeUnreadSessions/.test(plans), 'a planned session is still left for her to place by hand');
  // ONLY WHEN THE PHONE'S OWN TABLE CANNOT ANSWER IT. Thirty-one names are free
  // and instant; asking the server for those would be a round trip for nothing.
  assert.ok(
    /Object\.keys\(coverageColumns\(input\.activity\)\)\.length === 0/.test(plans),
    'the server is asked even for names the phone already knows'
  );
  // AND NOT AWAITED. The row is saved and correct; this only fills in what it
  // contributes, and a failure must not cost her the log.
  assert.ok(/void placeUnreadSessions/.test(plans), 'the log now waits on a classification');
  return 'classified at the write, only when needed';
});

check('AND THE ONE THING SHE CAN HELP WITH IS THE ONE THING SHE IS ASKED', () => {
  // What reaches the screen now is a name with nothing in it. "Gym session"
  // describes a building; no amount of re-running anything places it, and the
  // only thing that can is her saying what she did there.
  assert.ok(/What did your \{u\.activityType\} involve\?/.test(section),
    'the unplaceable sessions are named but nothing is asked');
  assert.ok(/describeSession/.test(section), 'her description goes nowhere');
  // It leaves the question up when the description did not help either, rather
  // than clearing it and implying success.
  const at = section.indexOf('await describeSession(');
  assert.ok(at > -1, 'her description is never sent');
  const after = section.slice(at, at + 700);
  assert.ok(/outcome\.ok && outcome\.placed\.length > 0/.test(after),
    'the question disappears whether or not it worked');
  return 'asked, and only cleared when it landed';
});

check('AND HER WORDS ARE ADDED TO THE NAME, NEVER OVER IT', () => {
  // The stored name is what she called it and other things match on it, so the
  // description joins it rather than replacing it - and "gym session: squats,
  // bench press" places better than either half alone.
  assert.ok(/\$\{row\.activity_type\}: \$\{describedAs\}/.test(route),
    'her description replaces the name she gave it');
  assert.ok(!/activity_type: describedAs/.test(route), 'the stored name is overwritten');
  // A description that still cannot be placed writes nothing and says so.
  const at = route.indexOf('if (!coverage) {');
  assert.ok(at > -1, 'a description that fails to place is not handled');
  assert.ok(/unplaced: \[\{ id/.test(route.slice(at, at + 260)), 'it is not reported back as unplaced');
  return 'name plus description, and null stays null';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
