// A WEEK PLANNED IN ONE CONVERSATION GOES IN ON ONE TURN.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-a-week-goes-in-at-once.mjs
//
// WHY THIS EXISTS. 22 October 2026, from her own thread, after an evening
// designing a training week that she described as "a fantastic display of
// help". At 22:19 the app said:
//
//   "Wednesday's gym is in your Week now. I can only add one entry at a time,
//    so the rest need a few more messages from you."
//
// She typed "Next". Then "Next". Then "Next".
//
// THE MODEL WAS BEING HONEST. weekEntry was a single object, so a turn could
// write exactly one row. The limit was in the schema, written when the field's
// only job was "add french class on thursday" - one thing, mentioned in
// passing. Planning a whole week is a different shape and arrived later.
//
// WHAT THIS GUARDS. That the field stays plural, that the reader still accepts
// the old singular shape, and that a partial failure names itself instead of
// hiding inside good news.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const root = 'file://' + process.cwd().replace(/\\/g, '/');
const { weekEntriesNote, weekNotesNeeded } = await import(root + '/app/lib/week-entry.ts');

// NORMALISED LINE ENDINGS, because the repository's TypeScript is CRLF and
// every anchor below is written with a bare newline.
const ROUTE = readFileSync('app/api/ask-selodia/route.ts', 'utf8')
  .split('\r\n')
  .join('\n');

let pass = 0;
const failures = [];
function check(name, fn) {
  try {
    fn();
    pass += 1;
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
}

// ANCHORED ON THE FIELD DEFINITION, from the property name to the end of its
// block, rather than on a character window or on wording anywhere in the file.
function fieldBlock(name) {
  const at = ROUTE.indexOf(`    ${name}: {`);
  if (at < 0) return null;
  const end = ROUTE.indexOf('\n    },\n', at);
  return end < 0 ? null : ROUTE.slice(at, end);
}

check('weekEntry is a list in the tool schema', () => {
  const block = fieldBlock('weekEntry');
  assert.ok(block, 'weekEntry field not found - this check is anchored on it');
  assert.match(
    block,
    /type:\s*'array'/,
    'weekEntry is not an array, so one turn can write one row and she is back to typing "Next"'
  );
});

check('the route reads several, and still reads one', () => {
  assert.match(
    ROUTE,
    /Array\.isArray\(result\.weekEntry\)\s*\?\s*result\.weekEntry\s*:/,
    'the route does not accept both shapes'
  );
  assert.match(ROUTE, /addWeekEntries\(/, 'the route is not calling the plural writer');
});

check('the write is still recorded, so it cannot be denied', () => {
  // The sister fault, checked here too: a week entry that lands without being
  // recorded gets the same "that did not save" the plan save was getting.
  const at = ROUTE.indexOf('addWeekEntries(');
  assert.match(
    ROUTE.slice(at, at + 600),
    /writes\.record\(\s*['"]week entry['"]\s*\)/,
    'the week write does not register in the write log'
  );
});

// -- the note ---------------------------------------------------------------

const added = (activity, days, time = null) => ({ kind: 'added', activity, days, time });

check('five sessions become one sentence, not five', () => {
  const note = weekEntriesNote([
    added('Gym', ['wed']),
    added('Climbing', ['thu'], '3pm'),
    added('Cardio', ['fri']),
    added('Gym', ['sat']),
    added('Ballet', ['mon'], '7:30pm'),
  ]);
  assert.match(note, /Ballet/, 'the last one is missing');
  assert.match(note, /Gym \(Wednesday\)/, 'the day is not named');
  assert.match(note, /Climbing \(Thursday, 3pm\)/, 'the time is not named');
  assert.equal(note.split('.').filter((s) => s.trim()).length <= 2, true, 'it is still a list of lines');
});

check('a single entry reads exactly as it always did', () => {
  const note = weekEntriesNote([added('French class', ['thu'], '7pm')]);
  assert.equal(note, "French class is in your week, Thursday at 7pm. It's on the Week view in Plans.");
});

check('a failure inside a success is named, not swallowed', () => {
  const note = weekEntriesNote([added('Gym', ['wed']), { kind: 'failed' }]);
  assert.match(note, /Gym/, 'lost the one that worked');
  assert.match(note, /did ?n'?t go in/i, 'the failure disappeared into the good news');
});

check('nothing to say stays silent', () => {
  assert.equal(weekEntriesNote([]), null);
  assert.equal(weekEntriesNote([{ kind: 'nothing' }]), null);
});

check('the app speaks when the reply left any of them unconfirmed', () => {
  const outcomes = [added('Gym', ['wed']), added('Climbing', ['thu'])];
  const namedBoth = 'Gym and Climbing are in your week now.';
  const namedOne = 'Gym is in your week now.';
  assert.equal(weekNotesNeeded(namedBoth, outcomes), false, 'repeated what the reply already said');
  assert.equal(weekNotesNeeded(namedOne, outcomes), true, 'left Climbing unconfirmed');
});

// -- every case above must be able to fail ---------------------------------

const useless = [];
function mustFail(name, fn) {
  try {
    fn();
    useless.push(name);
  } catch {
    /* threw, which is the point */
  }
}

mustFail('schema is plural', () => assert.doesNotMatch(fieldBlock('weekEntry') ?? '', /type:\s*'array'/));
mustFail('list is combined', () =>
  assert.doesNotMatch(weekEntriesNote([added('Gym', ['wed']), added('Ballet', ['mon'])]) ?? '', /Ballet/)
);
mustFail('failure is named', () =>
  assert.doesNotMatch(weekEntriesNote([added('Gym', ['wed']), { kind: 'failed' }]) ?? '', /did ?n'?t go in/i)
);
mustFail('unconfirmed triggers the note', () =>
  assert.equal(weekNotesNeeded('Gym is in your week now.', [added('Gym', ['wed']), added('Climbing', ['thu'])]), false)
);

for (const f of failures) console.log(`  FAIL  ${f}`);
for (const u of useless) console.log(`  USELESS  "${u}" passed with its premise inverted`);

const total = pass + failures.length;
console.log(`${pass}/${total} passed, ${failures.length} failed, ${useless.length} useless`);
process.exit(failures.length + useless.length > 0 ? 1 : 0);
