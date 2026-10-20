// THE REPLY IS TOLD WHAT HAPPENED, INCLUDING WHEN IT FAILED.
//
//   node --import ./scripts/ts-resolve-hook.mjs scripts/check-the-app-says-what-it-did.mjs
//
// Selodía's own chat, asked on 20 October 2026 what makes its job harder,
// named this first:
//
//   "I can't see what happened after I act. I asked for the calendar entry and
//    the reminder, but couldn't tell whether they worked, so I kept passing the
//    failures back to you."
//
// IT WAS RIGHT, AND THE SHAPE OF THE BUG IS WORTH KEEPING. Both writes ended
// `if (error) console.log(...)` with the result left null, so a failure was
// indistinguishable from a turn that never touched the diary - and neither the
// failure NOR the success was ever added to didLines, the block the reply is
// written from. The outcome reached the phone and the server log, and not the
// one participant whose job is to describe it.
//
// This is the same contract the plan removal already states in the route: "The
// app says what happened, always... The model is told not to claim anything,
// and this is the half of that instruction that does not depend on the model
// obeying it." The diary and the reminder were never given their half.
//
// WHAT IS CHECKED IS THE WIRE, NOT THE WORDS. A note that says the right thing
// and is never passed to the reply is the bug; so is a `console.log` that is
// the only record of a failed write.

import assert from 'node:assert';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const here = (p) => pathToFileURL(path.join(process.cwd(), p)).href;
const { calendarNote, reminderNote } = await import(here('app/lib/action-notes.ts'));

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

// LINE ENDINGS NORMALISED FIRST. This repo checks out CRLF on Windows, and an
// anchor written with a backslash-n stops matching the moment git rewrites the
// file - which it does on any stash or checkout. The owner-filter check below
// passed, then failed after a `git stash pop`, with nothing about the code
// having changed. check-plan-edit.mjs had the same fault on the same day.
const raw = fs.readFileSync('app/api/ask-selodia/route.ts', 'utf8').replace(/\r\n/g, '\n');
/** Source with its comments gone, so a check cannot match its own prose. */
const route = raw
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

console.log('\n  WHAT THE APP DID, AND WHETHER THE REPLY WAS TOLD\n');

check('A FAILED WRITE IS AN OUTCOME, NOT A CONSOLE LINE', () => {
  // The exact shape of the bug: an error handled only by logging it, with the
  // result left null for the rest of the turn to misread as "nothing asked".
  for (const [what, marker] of [
    ['the diary insert', 'CALENDAR INSERT FAILED'],
    ['the diary cancel', 'CALENDAR CANCEL FAILED'],
    ['the reminder insert', 'CUSTOM REMINDER INSERT FAILED'],
    ['the reminder cancel', 'CUSTOM REMINDER CANCEL FAILED'],
  ]) {
    const at = route.indexOf(marker);
    assert.ok(at > -1, `${what} no longer reports a failure at all`);
    // Within the handler, something must set a result. 220 characters covers
    // the log line and the assignment under it.
    const handler = route.slice(at, at + 220);
    assert.ok(
      /action: 'failed'/.test(handler),
      `${what} logs its error and tells the turn nothing - the reply cannot know it failed`
    );
  }
  return '4 of 4 failures recorded';
});

check('AND BOTH OUTCOMES REACH THE BLOCK THE REPLY IS WRITTEN FROM', () => {
  // THE HALF THAT WAS MISSING. Both results existed and both went only to the
  // HTTP response. didLines is what the reply reads.
  const at = route.indexOf('const appendedNotes = [');
  assert.ok(at > -1, 'the notes list moved - this check is testing nothing');
  const list = route.slice(at, route.indexOf('].filter(', at));
  assert.ok(/calendarNote\(calendarResult\)/.test(list), 'the diary outcome never reaches the reply');
  assert.ok(/reminderNote\(reminderResult\)/.test(list), 'the reminder outcome never reaches the reply');
  // And appendedNotes is what feeds didLines on both paths.
  assert.ok(
    route.split('didLines').length - 1 >= 2,
    'didLines is no longer built from the notes list'
  );
  return 'both, into appendedNotes';
});

check('A FAILURE SAYS SO PLAINLY, AND NEVER SOUNDS LIKE A SUCCESS', () => {
  // This is the line that stops a reply claiming a write that did not happen,
  // so it has to be unmistakable to a model skim-reading a long block.
  const diary = calendarNote({ action: 'failed', doing: 'add' });
  assert.ok(/FAILED/.test(diary), 'a failed diary write is not stated plainly');
  assert.ok(/Do not say it is/i.test(diary), 'nothing stops the reply claiming it worked');
  const made = reminderNote({ action: 'failed', label: 'magnesium', doing: 'create' });
  const stopped = reminderNote({ action: 'failed', label: 'water', doing: 'cancel' });
  assert.ok(/FAILED/.test(made) && /Do not say/i.test(made), 'a failed reminder is not stated plainly');
  assert.ok(/still active/i.test(stopped), 'a reminder that could not be cancelled is not described');
  // A SUCCESS AND A FAILURE MUST NOT READ ALIKE.
  const ok = calendarNote({
    action: 'added',
    title: 'physio',
    eventDate: '2026-10-27',
    eventTime: '15:00',
    reminderDropped: false,
  });
  assert.ok(!/FAILED/.test(ok), 'a successful write mentions failure');
  assert.ok(/physio/.test(ok) && /2026-10-27/.test(ok), 'a successful write does not say what it wrote');
  return 'failure is loud, success is specific';
});

check('NOTHING IS SAID WHEN THE TURN TOUCHED NEITHER', () => {
  // A note on every turn is furniture, and furniture is what people - and
  // models - stop reading.
  assert.strictEqual(calendarNote(null), null, 'the diary speaks on turns that did not touch it');
  assert.strictEqual(reminderNote(null), null, 'the reminder speaks on turns that did not touch it');
  return 'silent unless something happened';
});

check('A REFUSAL AND AN EMPTY MATCH ARE DIFFERENT FROM A FAILURE', () => {
  // Three things that all leave the diary unchanged and mean different things
  // to the person reading the reply: we would not, we found nothing, it broke.
  const refused = calendarNote({ action: 'refused', because: 'in the past', detail: '2026-01-02' });
  assert.ok(/NOT written/.test(refused) && /in the past/.test(refused), 'a refusal loses its reason');
  const none = calendarNote({ action: 'cancelled', title: 'dentist', count: 0 });
  assert.ok(/nothing matched|nothing in their diary matched/i.test(none), 'cancelling nothing is not said');
  assert.ok(!/FAILED/.test(none), 'finding nothing reads as a failure');
  const some = calendarNote({ action: 'cancelled', title: 'dentist', count: 2 });
  assert.ok(/2 entries/.test(some), 'the number cancelled is not said');
  return 'would not, found none, broke';
});

check('AND AN IGNORED REMINDER REQUEST IS NAMED', () => {
  // Asking for a reminder on an all-day entry is reasonable and gets dropped
  // silently. Without this she is told the reminder is set and nothing comes.
  const dropped = calendarNote({
    action: 'added',
    title: 'scan',
    eventDate: '2026-11-12',
    eventTime: null,
    reminderDropped: true,
  });
  assert.ok(/reminder/i.test(dropped) && /not set/i.test(dropped), 'the dropped reminder is not mentioned');
  return 'said, not swallowed';
});

check('THE REMINDER CANCEL ONLY TOUCHES THEIR OWN', () => {
  // It matched on the label alone, with no owner filter - every sibling query
  // in this file carries one. RLS is on custom_reminders and the request runs
  // as the signed-in user, so this was never a leak; it was one policy away
  // from being one, which is not where a health app should keep its margin.
  const at = route.indexOf("from('custom_reminders')\n        .update({ active: false })");
  assert.ok(at > -1, 'the reminder cancel moved - this check is testing nothing');
  const q = route.slice(at, at + 400);
  assert.ok(/\.eq\('user_id', user\.id\)/.test(q), 'the reminder cancel has no owner filter');
  return 'scoped to the signed-in user';
});

check('AND THE PROMPT DOES NOT DESCRIBE A RULE THAT REMOVES', () => {
  // The second thing the chat named: "Rules that clash. One removes quad work
  // while another says to include it once you confirm."
  //
  // It was reading a real contradiction. applyRules was changed on 20 October
  // to keep every exercise and flag the ones a rule touches - Ruth: "An app
  // that decided what a user can and cannot do is not helpful, it's
  // inflexible" - while the classifier's own description of matchTerms still
  // said "the app uses them to physically remove movements from anything it
  // builds". The model was told both things in one system prompt and had to
  // pick one.
  //
  // A PROMPT THAT DESCRIBES THE OLD BEHAVIOUR IS A BUG, not untidiness. It is
  // the same fault as a stale app map, or a capability listed as not built the
  // week after it shipped, and this project has shipped all three.
  const at = raw.indexOf('A RULE is a MOVEMENT CONSTRAINT');
  assert.ok(at > -1, 'the rule description moved - this check is testing nothing');
  const block = raw.slice(at, at + 1200);
  assert.ok(
    !/physically remove|remove movements/i.test(block),
    'the prompt says a rule removes movements, and the code flags them instead'
  );
  assert.ok(/FLAGS THE MOVEMENT AND ASKS/i.test(block), 'the prompt no longer says what a match does');
  // AND THE CODE STILL KEEPS EVERYTHING, so this cannot pass by both halves
  // drifting back together in the wrong direction.
  const gate = fs.readFileSync('app/lib/rules-gate.ts', 'utf8');
  assert.ok(/kept: exercises, flagged/.test(gate), 'applyRules strips exercises again');
  return 'flagged in both halves';
});

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
if (failures.length > 0) process.exit(1);
